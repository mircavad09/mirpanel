(() => {
  "use strict";

  const API_BASE = window.MIRPANEL_PAYMENT_API || "https://mirpanel.onrender.com";
  let activeFlow = null;

  const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const uuid = () => crypto.randomUUID();

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
    form.innerHTML = `<section class="paymentFlow" aria-labelledby="paymentFlowTitle">
      <div class="paymentFlowHead"><div><span>Ödəniş</span><h2 id="paymentFlowTitle">Ödəniş üsulunu seçin</h2><p>${esc(product.title)} · ${Number(plan.price).toFixed(2)} ₼</p></div><button class="paymentFlowClose" type="button" aria-label="Ödənişi bağla">×</button></div>
      <div id="paymentFlowMessage" class="paymentFlowMessage" role="status">Aktiv ödəniş üsulları yüklənir...</div>
      <div id="paymentMethodChoices" class="paymentMethodChoices" aria-label="Ödəniş üsulları"></div>
      <div id="paymentMethodDetail"></div>
      <div id="paymentReceiptArea"></div>
    </section>`;
    return form;
  }

  function methodIcon(type) {
    return type === "wallet" ? '<svg viewBox="0 0 24 24"><path d="M4 7h15v12H4zM4 7l2-3h11l2 3M15 12h4v3h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></svg>';
  }

  function methodButtons(methods) {
    return methods.map((method) => `<button class="paymentMethodChoice" type="button" data-payment-method="${esc(method.id)}"${method.available ? "" : " disabled"} aria-disabled="${method.available ? "false" : "true"}">${methodIcon(method.type)}<span>${esc(method.providerName)}</span><small>${method.available ? esc(method.maskedNumber) : "× Kart gündəlik limitdədir"}</small></button>`).join("");
  }

  function detailMarkup(reservation) {
    const method = reservation.method;
    return `<article class="paymentSelectedCard" style="--payment-card-color:${esc(method.color)}">
      <div class="paymentSelectedTop"><div><small>Ödəniş üsulu</small><strong>${esc(method.providerName)}</strong></div><span>${method.type === "wallet" ? "Cüzdan" : "Bank kartı"}</span></div>
      <div class="paymentHolder"><small>Sahib</small><strong>${esc(method.holderName || "Mirpanel")}</strong></div>
      <div class="paymentNumber"><code>${esc(method.number)}</code><button id="copyPaymentNumber" type="button">Kopyala</button></div>
      <div class="paymentAmount"><span>Ödəniləcək məbləğ</span><strong>${Number(reservation.amount).toFixed(2)} ${esc(reservation.currency)}</strong></div>
      <p>Nömrəni kopyalayın, ödənişi tamamlayın və qəbzin şəklini və ya PDF faylını aşağıdan yükləyin.</p>
      <div class="paymentReservationTime">Rezerv vaxtı: <strong id="paymentReservationCountdown">10:00</strong></div>
    </article>`;
  }

  function receiptMarkup() {
    return `<section class="paymentReceiptBox">
      <label class="paymentReceiptPicker" for="paymentReceiptInput"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5"/></svg><strong>Ödəniş qəbzini yüklə</strong><span>JPG, PNG, WEBP və ya PDF · maksimum 5 MB</span></label>
      <input id="paymentReceiptInput" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden>
      <div id="paymentReceiptPreview" class="paymentReceiptPreview hidden"></div>
      <div id="paymentUploadProgress" class="paymentUploadProgress hidden"><span></span><b>0%</b></div>
      <p id="paymentReceiptError" class="paymentReceiptError" role="alert" hidden></p>
      <div class="paymentSubmitActions"><button id="paymentCancel" type="button">Ləğv et</button><button id="paymentSubmit" type="button" disabled>Göndər və WhatsApp-a keç</button></div>
    </section>`;
  }

  function setMessage(text, type = "") {
    const box = document.getElementById("paymentFlowMessage");
    if (box) { box.textContent = text; box.className = `paymentFlowMessage ${type}`; }
  }

  function startCountdown(expiresAt, onExpire) {
    const update = () => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      const target = document.getElementById("paymentReservationCountdown");
      if (target) target.textContent = `${String(Math.floor(remaining / 60000)).padStart(2, "0")}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}`;
      if (!remaining) { clearInterval(timer); onExpire(); }
    };
    const timer = setInterval(update, 1000);
    update();
    return () => clearInterval(timer);
  }

  async function cancelReservation(flow) {
    if (!flow.reservation?.reservationId) return;
    const id = flow.reservation.reservationId;
    flow.reservation = null;
    await request("/api/payments/reservations/cancel", { method: "POST", body: JSON.stringify({ reservationId: id }) }).catch(() => {});
  }

  async function start({ product, plan, planIndex }) {
    if (activeFlow) await cancelReservation(activeFlow);
    renderShell(product, plan);
    const flow = { product, plan, planIndex, reservation: null, receipt: null, stopTimer: null, settled: false };
    activeFlow = flow;
    return new Promise(async (resolve) => {
      const finish = async (value, cancel = false) => {
        if (flow.settled) return;
        flow.settled = true;
        flow.stopTimer?.();
        if (cancel) await cancelReservation(flow);
        document.getElementById("modal")?.classList.remove("paymentFlowOpen");
        if (activeFlow === flow) activeFlow = null;
        resolve(value);
      };
      document.querySelector(".paymentFlowClose").onclick = () => finish(null, true);
      try {
        const result = await request("/api/payments/methods");
        const choices = document.getElementById("paymentMethodChoices");
        choices.innerHTML = methodButtons(result.methods || []);
        if (!result.anyAvailable) setMessage("Hazırda aktiv ödəniş üsulu yoxdur. Dəstəklə əlaqə saxlayın.", "error");
        else setMessage("Ödəniş edəcəyiniz kartı və ya cüzdanı özünüz seçin.");

        choices.addEventListener("click", async (event) => {
          const button = event.target.closest("[data-payment-method]");
          if (!button || button.disabled) return;
          choices.querySelectorAll("button").forEach((item) => { item.disabled = true; });
          setMessage("Kart üçün 10 dəqiqəlik rezerv yaradılır...");
          try {
            await cancelReservation(flow);
            const idempotencyKey = uuid();
            const reserved = await request("/api/payments/reservations", {
              method: "POST",
              headers: { "X-Idempotency-Key": idempotencyKey },
              body: JSON.stringify({ methodId: button.dataset.paymentMethod, productId: product.id, planIndex, idempotencyKey })
            });
            flow.reservation = reserved;
            choices.querySelectorAll("button").forEach((item) => { item.classList.toggle("selected", item === button); item.disabled = item.getAttribute("aria-disabled") === "true"; });
            document.getElementById("paymentMethodDetail").innerHTML = detailMarkup(reserved);
            document.getElementById("paymentReceiptArea").innerHTML = receiptMarkup();
            setMessage("Rezerv yaradıldı. Ödənişdən sonra qəbzi yükləyin.", "success");
            flow.stopTimer?.();
            flow.stopTimer = startCountdown(reserved.expiresAt, () => {
              flow.reservation = null;
              document.getElementById("paymentMethodDetail").innerHTML = "";
              document.getElementById("paymentReceiptArea").innerHTML = "";
              choices.querySelectorAll("button").forEach((item) => { item.disabled = item.getAttribute("aria-disabled") === "true"; item.classList.remove("selected"); });
              setMessage("Rezerv vaxtı bitdi. Ödəniş üsulunu yenidən seçin.", "error");
            });
            document.getElementById("copyPaymentNumber").onclick = async () => {
              await navigator.clipboard.writeText(reserved.method.number);
              document.getElementById("copyPaymentNumber").textContent = "Kopyalandı";
            };
            document.getElementById("paymentCancel").onclick = () => finish(null, true);
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
              const preview = document.getElementById("paymentReceiptPreview");
              preview.classList.remove("hidden");
              preview.innerHTML = file.type.startsWith("image/") ? `<img src="${URL.createObjectURL(file)}" alt="Yüklənəcək ödəniş qəbzi"><div><strong>${esc(file.name)}</strong><button id="removePaymentReceipt" type="button">Çeki sil və yenisini seç</button></div>` : `<div class="paymentPdfPreview"><strong>PDF</strong><span>${esc(file.name)}</span></div><button id="removePaymentReceipt" type="button">Çeki sil və yenisini seç</button>`;
              document.getElementById("paymentSubmit").disabled = false;
              document.getElementById("removePaymentReceipt").onclick = () => {
                flow.receipt = null; fileEvent.target.value = ""; preview.innerHTML = ""; preview.classList.add("hidden"); document.getElementById("paymentSubmit").disabled = true;
              };
            };
            document.getElementById("paymentSubmit").onclick = async () => {
              const submit = document.getElementById("paymentSubmit");
              const error = document.getElementById("paymentReceiptError");
              if (!flow.receipt || !flow.reservation) { error.textContent = "Qəbz və aktiv rezerv tələb olunur."; error.hidden = false; return; }
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
              } catch (submitError) {
                error.textContent = submitError.message;
                error.hidden = false;
                submit.disabled = false;
              }
            };
          } catch (reserveError) {
            choices.querySelectorAll("button").forEach((item) => { item.disabled = item.getAttribute("aria-disabled") === "true"; });
            setMessage(reserveError.message, "error");
          }
        });
      } catch (error) {
        setMessage(error.message, "error");
      }
    });
  }

  function startReplacement(token) {
    const form = document.getElementById("mForm");
    const modal = document.getElementById("modal");
    if (!form || !modal || !token) return;
    modal.classList.add("show", "paymentFlowOpen");
    document.body.classList.add("noScroll");
    form.innerHTML = `<section class="paymentFlow" aria-labelledby="replacementReceiptTitle">
      <div class="paymentFlowHead"><div><span>Ödəniş yoxlaması</span><h2 id="replacementReceiptTitle">Yeni ödəniş çekini yükləyin</h2><p>Bu təhlükəsiz keçid yalnız bir dəfə işləyir və çek private yaddaşda saxlanılır.</p></div><button class="paymentFlowClose" type="button" aria-label="Pəncərəni bağla">×</button></div>
      <section class="paymentReceiptBox"><label class="paymentReceiptPicker" for="replacementReceiptInput"><svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5"/></svg><strong>Yeni ödəniş çekini seç</strong><span>JPG, PNG, WEBP və ya PDF · maksimum 5 MB</span></label>
      <input id="replacementReceiptInput" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden>
      <div id="replacementReceiptPreview" class="paymentReceiptPreview hidden"></div><div id="replacementProgress" class="paymentUploadProgress hidden"><span></span><b>0%</b></div><p id="replacementError" class="paymentReceiptError" role="alert" hidden></p>
      <div class="paymentSubmitActions"><button id="replacementClose" type="button">Ləğv et</button><button id="replacementSubmit" type="button" disabled>Yeni çeki göndər</button></div></section>
    </section>`;
    let file = null;
    const close = () => { modal.classList.remove("show", "paymentFlowOpen"); document.body.classList.remove("noScroll"); };
    form.querySelector(".paymentFlowClose").onclick = close;
    document.getElementById("replacementClose").onclick = close;
    document.getElementById("replacementReceiptInput").onchange = (event) => {
      file = event.target.files?.[0] || null;
      const error = document.getElementById("replacementError");
      error.hidden = true;
      if (!file || file.size > 5 * 1024 * 1024) {
        file = null; error.textContent = "Çek seçilməyib və ya 5 MB limitini keçir."; error.hidden = false; return;
      }
      const preview = document.getElementById("replacementReceiptPreview");
      preview.classList.remove("hidden");
      preview.innerHTML = file.type.startsWith("image/") ? `<img src="${URL.createObjectURL(file)}" alt="Yeni ödəniş çeki"><strong>${esc(file.name)}</strong>` : `<div class="paymentPdfPreview"><strong>PDF</strong><span>${esc(file.name)}</span></div>`;
      document.getElementById("replacementSubmit").disabled = false;
    };
    document.getElementById("replacementSubmit").onclick = async () => {
      if (!file) return;
      const submit = document.getElementById("replacementSubmit");
      const error = document.getElementById("replacementError");
      const progress = document.getElementById("replacementProgress");
      submit.disabled = true; error.hidden = true; progress.classList.remove("hidden");
      const updateProgress = (value) => { progress.querySelector("span").style.width = `${value}%`; progress.querySelector("b").textContent = `${value}%`; };
      try {
        const contentBase64 = await fileBase64(file, updateProgress);
        const result = await submitWithProgress("/api/payments/replacement-receipts", { token, receipt: { fileName: file.name, mimeType: file.type, contentBase64 } }, updateProgress);
        updateProgress(100);
        form.innerHTML = `<section class="paymentFlow"><div class="paymentFlowMessage success">Yeni çek yükləndi. Sifariş ${esc(result.orderCode)} yenidən yoxlamaya göndərildi.</div><button class="paymentFlowClose" type="button">Bağla</button></section>`;
        form.querySelector("button").onclick = close;
        history.replaceState({}, "", `${location.pathname}${location.hash}`);
      } catch (uploadError) {
        error.textContent = uploadError.message; error.hidden = false; submit.disabled = false;
      }
    };
  }

  window.MirpanelPaymentFlow = { start, startReplacement };
  const replacementToken = new URLSearchParams(location.search).get("paymentReceiptToken");
  if (replacementToken) {
    const open = () => setTimeout(() => startReplacement(replacementToken), 150);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", open, { once: true }); else open();
  }
})();
