(() => {
  "use strict";

  const API_BASE = window.MIRPANEL_PAYMENT_API || "https://mirpanel.onrender.com";
  const CHECKOUT_STORAGE_KEY = "mirpanel-payment-checkout-v1";
  let activeFlow = null;

  const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const uuid = () => crypto.randomUUID();

  function storedCheckout() {
    try {
      const value = JSON.parse(sessionStorage.getItem(CHECKOUT_STORAGE_KEY) || "null");
      if (!value?.checkoutKey || !value?.reservationId || new Date(value.expiresAt).getTime() <= Date.now()) return null;
      return value;
    } catch { return null; }
  }

  function storeCheckout(flow) {
    if (!flow.reservation) return;
    try {
      sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
        checkoutKey: flow.checkoutKey,
        reservationId: flow.reservation.reservationId,
        expiresAt: flow.reservation.expiresAt
      }));
    } catch {}
  }

  function clearStoredCheckout() {
    try { sessionStorage.removeItem(CHECKOUT_STORAGE_KEY); } catch {}
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Ödəniş serveri cavab vermədi.");
    return payload;
  }

  function fileBase64(file, progress) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = (event) => { if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 20)); };
      reader.onerror = () => reject(new Error("Qəbz faylı oxunmadı."));
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.readAsDataURL(file);
    });
  }

  function submitWithProgress(path, body, progress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}${path}`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) progress(20 + Math.round((event.loaded / event.total) * 80));
      };
      xhr.onerror = () => reject(new Error("Çek serverə göndərilmədi. İnternet bağlantısını yoxlayın."));
      xhr.onload = () => {
        const payload = JSON.parse(xhr.responseText || "{}");
        if (xhr.status < 200 || xhr.status >= 300) reject(new Error(payload.error || "Sifariş yaradılmadı."));
        else resolve(payload);
      };
      xhr.send(JSON.stringify(body));
    });
  }

  function renderShell(product, plan) {
    const form = document.getElementById("mForm");
    if (!form) throw new Error("Sifariş pəncərəsi tapılmadı.");
    const modal = document.getElementById("modal");
    modal?.classList.remove("orderConfirmationModal", "premiumOrderFormOpen", "spotifyOrderConfirmationOpen", "hboMaxOrderFormOpen");
    modal?.classList.add("paymentFlowOpen");
    form.innerHTML = `<section class="paymentFlow" data-payment-stage="payment_method_selection" aria-labelledby="paymentFlowTitle">
      <div class="paymentFlowHead"><div><span>Ödəniş</span><h2 id="paymentFlowTitle">Ödəniş üsulunu seçin</h2><p>${esc(product.title)} · ${Number(plan.price).toFixed(2)} ₼</p></div><button class="paymentFlowClose" type="button" aria-label="Ödənişi bağla">×</button></div>
      <div id="paymentFlowMessage" class="paymentFlowMessage" role="status">Aktiv ödəniş üsulları yüklənir...</div>
      <div id="paymentMethodChoices" class="paymentMethodChoices" data-payment-stage-panel="payment_method_selection" aria-label="Ödəniş üsulları"></div>
      <div id="paymentMethodDetail" data-payment-stage-panel="payment_details"></div>
      <div id="paymentReceiptArea" data-payment-stage-panel="receipt_upload"></div>
    </section>`;
    return form;
  }

  function methodIcon(type) {
    return type === "wallet" ? '<svg viewBox="0 0 24 24"><path d="M4 7h15v12H4zM4 7l2-3h11l2 3M15 12h4v3h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>';
  }

  function methodButtons(methods) {
    return methods.map((method) => `<button class="paymentMethodChoice theme-${esc(method.theme || "neutral")}" type="button" data-payment-method="${esc(method.id)}"${method.available ? "" : " disabled"} aria-disabled="${method.available ? "false" : "true"} aria-pressed="false" aria-label="${esc(`${method.providerName}, son dörd rəqəm ${method.last4}${method.available ? "" : ", bu gün limit dolub"}`)}">${methodIcon(method.type)}<span>${esc(method.providerName)}</span><small>${method.available ? `•••• ${esc(method.last4)}` : "Bu gün limit dolub"}</small><i aria-hidden="true">✓</i></button>`).join("");
  }

  function detailMarkup(reservation) {
    const method = reservation.method;
    return `<article class="paymentSelectedCard theme-${esc(method.theme || "neutral")}" style="--payment-card-color:${esc(method.color)}">
      <div class="paymentSelectedTop"><div><small>Ödəniş üsulu</small><strong>${esc(method.providerName)}</strong></div><div class="paymentSelectedTopActions"><span>${method.type === "wallet" ? "Elektron cüzdan" : "Bank kartı"}</span><button id="changePaymentMethod" type="button">Kartı dəyiş</button></div></div>
      <div class="paymentMagneticStripe" aria-hidden="true"></div>
      <div class="paymentHolder"><small>Sahib</small><strong>${esc(method.holderName || "Mirpanel")}</strong></div>
      <div class="paymentNumber"><code>${esc(method.number)}</code><button id="copyPaymentNumber" type="button">Kopyala</button></div>
      <div class="paymentAmount"><span>Ödəniləcək məbləğ</span><strong>${Number(reservation.amount).toFixed(2)} ${esc(reservation.currency)}</strong></div>
      <p>Nömrəni kopyalayın, ödənişi tamamlayın və qəbzin şəklini və ya PDF faylını aşağıdan yükləyin.</p>
      <div class="paymentReservationFooter"><div id="paymentReservationTimer" class="paymentReservationTime" role="timer" aria-live="polite"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>Ödənişi tamamlamaq üçün qalan vaxt</span><strong id="paymentReservationCountdown">10:00</strong></div></div>
    </article>`;
  }

  function receiptMarkup() {
    return `<form id="paymentReceiptForm" class="paymentReceiptBox" action="" method="post" novalidate>
      <label class="paymentReceiptPicker" for="paymentReceiptInput"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5"/></svg><strong>Ödəniş qəbzini yüklə</strong><span>JPG, PNG, WEBP və ya PDF · maksimum 5 MB</span></label>
      <input id="paymentReceiptInput" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden>
      <div id="paymentReceiptPreview" class="paymentReceiptPreview hidden"></div>
      <div id="paymentUploadProgress" class="paymentUploadProgress hidden"><span></span><b>0%</b></div>
      <p id="paymentReceiptError" class="paymentReceiptError" role="alert" hidden></p>
      <div class="paymentSubmitActions"><button id="paymentCancel" type="button">Ləğv et</button><button id="paymentSubmit" type="submit" disabled>Göndər və WhatsApp-a keç</button></div>
    </form>`;
  }

  function setMessage(text, type = "") {
    const box = document.getElementById("paymentFlowMessage");
    if (box) { box.textContent = text; box.className = `paymentFlowMessage ${type}`; }
  }

  function setStage(flow, stage) {
    flow.stage = stage;
    const shell = document.querySelector(".paymentFlow");
    if (shell) shell.dataset.paymentStage = stage;
    const title = document.getElementById("paymentFlowTitle");
    if (title) title.textContent = stage === "payment_method_selection" ? "Ödəniş üsulunu seçin" : "Ödənişi tamamlayın";
  }

  function startCountdown(expiresAt, onExpire) {
    const update = () => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      const target = document.getElementById("paymentReservationCountdown");
      if (target) target.textContent = `${String(Math.floor(remaining / 60000)).padStart(2, "0")}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}`;
      const timerBox = document.getElementById("paymentReservationTimer");
      timerBox?.classList.toggle("urgent", remaining > 0 && remaining <= 120000);
      timerBox?.setAttribute("aria-label", `Ödənişi tamamlamaq üçün ${Math.ceil(remaining / 1000)} saniyə qalıb`);
      if (!remaining) { clearInterval(timer); onExpire(); }
    };
    const timer = setInterval(update, 1000);
    update();
    return () => clearInterval(timer);
  }

  async function cancelReservation(flow) {
    const id = flow.reservation?.reservationId || flow.previousReservationId;
    if (!id) return;
    await request("/api/payments/reservations/cancel", { method: "POST", body: JSON.stringify({ reservationId: id }) });
    flow.reservation = null;
    flow.previousReservationId = null;
    flow.receipt = null;
    clearStoredCheckout();
  }

  async function start({ product, plan, planIndex }) {
    if (activeFlow?.reservation || activeFlow?.previousReservationId) await cancelReservation(activeFlow);
    renderShell(product, plan);
    const previous = storedCheckout();
    const flow = { product, plan, planIndex, checkoutKey: previous?.checkoutKey || uuid(), previousReservationId: previous?.reservationId || null, reservation: null, receipt: null, stopTimer: null, settled: false, submitting: false, reserving: false, changing: false, stage: "payment_method_selection" };
    activeFlow = flow;
    return new Promise(async (resolve) => {
      const finish = async (value, cancel = false) => {
        if (flow.settled) return;
        flow.settled = true;
        flow.stopTimer?.();
        if (cancel && (flow.reservation || flow.previousReservationId)) await cancelReservation(flow);
        if (!cancel) clearStoredCheckout();
        document.getElementById("modal")?.classList.remove("paymentFlowOpen");
        if (activeFlow === flow) activeFlow = null;
        resolve(value);
      };
      document.querySelector(".paymentFlowClose").onclick = () => finish(null, true);
      try {
        const result = await request("/api/payments/methods");
        const choices = document.getElementById("paymentMethodChoices");
        const renderChoices = () => {
          setStage(flow, "payment_method_selection");
          choices.hidden = false;
          choices.innerHTML = methodButtons(result.methods || []);
          document.getElementById("paymentMethodDetail").innerHTML = "";
          document.getElementById("paymentReceiptArea").innerHTML = "";
        };
        renderChoices();
        if (!result.anyAvailable) setMessage("Hazırda aktiv ödəniş üsulu yoxdur. Dəstəklə əlaqə saxlayın.", "error");
        else setMessage("Ödəniş edəcəyiniz kartı və ya cüzdanı özünüz seçin.");

        choices.addEventListener("click", async (event) => {
          const button = event.target.closest("[data-payment-method]");
          if (!button || button.disabled || flow.reserving) return;
          flow.reserving = true;
          button.classList.add("selected");
          button.setAttribute("aria-pressed", "true");
          choices.querySelectorAll("button").forEach((item) => { item.disabled = true; });
          setMessage("Kart üçün 10 dəqiqəlik rezerv yaradılır...");
          try {
            const idempotencyKey = uuid();
            const reserved = await request("/api/payments/reservations", {
              method: "POST",
              headers: { "X-Idempotency-Key": idempotencyKey },
              body: JSON.stringify({
                methodId: button.dataset.paymentMethod,
                productId: product.id,
                planIndex,
                idempotencyKey,
                checkoutKey: flow.checkoutKey,
                previousReservationId: flow.reservation?.reservationId || flow.previousReservationId || null
              })
            });
            flow.reservation = reserved;
            flow.previousReservationId = reserved.reservationId;
            flow.changing = false;
            storeCheckout(flow);
            setStage(flow, "payment_details");
            choices.replaceChildren();
            choices.hidden = true;
            document.getElementById("paymentMethodDetail").innerHTML = detailMarkup(reserved);
            document.getElementById("paymentReceiptArea").innerHTML = receiptMarkup();
            setMessage("Rezerv yaradıldı. Ödənişdən sonra qəbzi yükləyin.", "success");
            setTimeout(() => {
              if (flow.reservation?.reservationId === reserved.reservationId && !flow.settled) setMessage("Ödəniş məlumatı hazırdır.", "success compact");
            }, 1800);
            document.getElementById("paymentMethodDetail")?.scrollIntoView({ behavior: "smooth", block: "start" });
            flow.stopTimer?.();
            flow.stopTimer = startCountdown(reserved.expiresAt, async () => {
              const expiredId = flow.reservation?.reservationId;
              flow.reservation = null;
              flow.previousReservationId = null;
              flow.receipt = null;
              clearStoredCheckout();
              document.getElementById("paymentMethodDetail").innerHTML = "";
              document.getElementById("paymentReceiptArea").innerHTML = "";
              renderChoices();
              setMessage("Rezerv vaxtı bitdi. Ödəniş üsulunu yenidən seçin.", "error");
              if (expiredId) await request("/api/payments/reservations/cancel", { method: "POST", body: JSON.stringify({ reservationId: expiredId }) }).catch(() => {});
            });
            document.getElementById("copyPaymentNumber").onclick = async () => {
              await navigator.clipboard.writeText(reserved.method.number);
              document.getElementById("copyPaymentNumber").textContent = "Kopyalandı";
            };
            document.getElementById("changePaymentMethod").onclick = async () => {
              if (flow.changing || flow.submitting) return;
              flow.changing = true;
              const changeButton = document.getElementById("changePaymentMethod");
              changeButton.disabled = true;
              setMessage("Əvvəlki rezerv təhlükəsiz ləğv edilir...");
              try {
                await cancelReservation(flow);
                flow.stopTimer?.();
                renderChoices();
                setMessage("Yeni ödəniş üsulunu seçin.");
              } catch (error) {
                changeButton.disabled = false;
                setMessage(error.message, "error");
              } finally {
                flow.changing = false;
              }
            };
            document.getElementById("paymentCancel").onclick = async () => {
              try { await finish(null, true); } catch (error) { setMessage(error.message, "error"); }
            };
            document.getElementById("paymentReceiptInput").onchange = (fileEvent) => {
              const file = fileEvent.target.files?.[0];
              const error = document.getElementById("paymentReceiptError");
              error.hidden = true;
              if (!file || file.size > 5 * 1024 * 1024) {
                error.textContent = file ? "Qəbz maksimum 5 MB ola bilər." : "Qəbz seçilməyib.";
                error.hidden = false;
                return;
              }
              flow.receipt = file;
              setStage(flow, "receipt_upload");
              const preview = document.getElementById("paymentReceiptPreview");
              preview.classList.remove("hidden");
              preview.innerHTML = file.type.startsWith("image/") ? `<img src="${URL.createObjectURL(file)}" alt="Yüklənəcək ödəniş qəbzi"><div><strong>${esc(file.name)}</strong><button id="removePaymentReceipt" type="button">Çeki sil və yenisini seç</button></div>` : `<div class="paymentPdfPreview"><strong>PDF</strong><span>${esc(file.name)}</span></div><button id="removePaymentReceipt" type="button">Çeki sil və yenisini seç</button>`;
              document.getElementById("paymentSubmit").disabled = false;
              document.getElementById("removePaymentReceipt").onclick = () => {
                flow.receipt = null; setStage(flow, "payment_details"); fileEvent.target.value = ""; preview.innerHTML = ""; preview.classList.add("hidden"); document.getElementById("paymentSubmit").disabled = true;
              };
            };
            document.getElementById("paymentReceiptForm").addEventListener("submit", async (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (flow.submitting) return;
              const submit = document.getElementById("paymentSubmit");
              const error = document.getElementById("paymentReceiptError");
              if (!flow.receipt || !flow.reservation) { error.textContent = "Qəbz və aktiv rezerv tələb olunur."; error.hidden = false; return; }
              flow.submitting = true;
              submit.disabled = true;
              error.hidden = true;
              const progress = document.getElementById("paymentUploadProgress");
              progress.classList.remove("hidden");
              const updateProgress = (value) => { progress.querySelector("span").style.width = `${value}%`; progress.querySelector("b").textContent = `${value}%`; };
              try {
                const contentBase64 = await fileBase64(flow.receipt, updateProgress);
                const order = await submitWithProgress("/api/payments/orders", {
                  reservationId: flow.reservation.reservationId,
                  productId: product.id,
                  planIndex,
                  consentAccepted: true,
                  receipt: { fileName: flow.receipt.name, mimeType: flow.receipt.type, contentBase64 }
                }, updateProgress);
                updateProgress(100);
                setMessage(`Çek yükləndi. Sifariş: ${order.orderCode}`, "success");
                await finish(order, false);
                return;
              } catch (submitError) {
                flow.submitting = false;
                error.textContent = submitError.message;
                error.hidden = false;
                submit.disabled = false;
              }
            });
          } catch (reserveError) {
            choices.querySelectorAll("button").forEach((item) => { item.disabled = item.getAttribute("aria-disabled") === "true"; });
            button.classList.remove("selected");
            button.setAttribute("aria-pressed", "false");
            setMessage(reserveError.message, "error");
          } finally {
            flow.reserving = false;
          }
        });
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  }

  window.MirpanelPaymentFlow = { start };
})();
