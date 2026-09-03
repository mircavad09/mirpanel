(() => {
  "use strict";

  const API_BASE = window.MIRPANEL_PAYMENT_API || "https://mirpanel.onrender.com";
  const CHECKOUT_STORAGE_KEY = "mirpanel-payment-checkout-v1";
  const APPLE_RECEIPT_TYPES = new Set(["image/heic", "image/heif"]);
  let activeFlow = null;
  const SERVICE_ERROR = "Ödəniş xidməti hazırda cavab vermir. Yenidən cəhd edin";

  function validPayload(path, payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
    if (path === "/api/payments/methods") {
      return Array.isArray(payload.methods) && typeof payload.anyAvailable === "boolean" &&
        payload.methods.every((item) => item && typeof item.id === "string" && typeof item.providerName === "string" &&
          typeof item.available === "boolean" && /^\d{4}$/.test(item.last4)) &&
        payload.anyAvailable === payload.methods.some((item) => item.available);
    }
    if (path === "/api/payments/reservations") return typeof payload.reservationId === "string" &&
      Number.isFinite(Date.parse(payload.expiresAt)) && payload.method && typeof payload.method.number === "string";
    if (path.endsWith("/cancel")) return payload.ok === true;
    if (path === "/api/payments/checkout/resume") return payload.state === "expired" ||
      (payload.state === "submitted" && validOrder(payload.order)) ||
      (payload.state === "reserved" && validPayload("/api/payments/reservations", payload.reservation));
    return true;
  }

  function validOrder(order) {
    return order && typeof order.orderId === "string" && /^(?:MP-[A-Z0-9]+|[1-9]\d*)$/.test(order.orderCode || "") && order.receiptUploaded === true;
  }

  const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const uuid = () => crypto.randomUUID();

  function storedCheckout() {
    try {
      const value = JSON.parse(sessionStorage.getItem(CHECKOUT_STORAGE_KEY) || "null");
      if (!value?.checkoutKey || !value?.reservationId) return null;
      return value;
    } catch { return null; }
  }

  function storeCheckout(flow) {
    if (!flow.reservation) return;
    try {
      sessionStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({
        checkoutKey: flow.checkoutKey,
        reservationId: flow.reservation.reservationId,
        expiresAt: flow.reservation.expiresAt,
        orderIdempotencyKey: flow.orderIdempotencyKey,
        productId: flow.product.id,
        planIndex: flow.planIndex,
        submissionStarted: Boolean(flow.submissionStarted)
      }));
    } catch {}
  }

  function clearStoredCheckout() {
    try { sessionStorage.removeItem(CHECKOUT_STORAGE_KEY); } catch {}
  }

  async function request(path, options = {}) {
    const read = !options.method || options.method === "GET";
    for (let attempt = 0; attempt < (read ? 3 : 1); attempt += 1) {
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal?.addEventListener("abort", abort, { once: true });
      const timer = setTimeout(abort, read ? 12000 : 30000);
      let failure;
      try {
        const response = await fetch(`${API_BASE}${path}`, {
          ...options, signal: controller.signal, cache: "no-store",
          headers: { Accept: "application/json", ...(read ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) }
        });
        if (!/application\/json\b/i.test(response.headers.get("content-type") || "")) throw new Error(SERVICE_ERROR);
        const payload = await response.json();
        if (!response.ok) {
          throw Object.assign(new Error(response.status < 500 && typeof payload?.error === "string" ? payload.error : SERVICE_ERROR),
            { retryable: response.status >= 500 || response.status === 408, status: response.status });
        }
        if (!validPayload(path, payload)) throw new Error(SERVICE_ERROR);
        return payload;
      } catch (error) {
        failure = error;
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
      }
      if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (!read || attempt === 2 || failure.retryable === false) {
        throw Object.assign(new Error(failure.status && failure.status < 500 ? failure.message : SERVICE_ERROR), { status: failure.status });
      }
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 2000));
    }
  }

  function submitWithProgress(path, formData, progress, idempotencyKey) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}${path}`);
      xhr.timeout = 60_000;
      xhr.setRequestHeader("X-Idempotency-Key", idempotencyKey);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) progress(5 + Math.round((event.loaded / event.total) * 90));
      };
      xhr.onerror = () => reject(Object.assign(new Error("Çek yüklənmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin."), { userMessage: "Çek yüklənmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin.", retryable: true }));
      xhr.ontimeout = () => reject(Object.assign(new Error("Çek yüklənmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin."), { userMessage: "Çek yüklənmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin.", retryable: true }));
      xhr.onload = () => {
        let payload;
        try {
          if (!/application\/json\b/i.test(xhr.getResponseHeader("Content-Type") || "")) throw new Error("invalid response");
          payload = JSON.parse(xhr.responseText);
          if (!payload || typeof payload !== "object") throw new Error("invalid response");
        } catch { xhr.onerror(); return; }
        if (xhr.status < 200 || xhr.status >= 300) reject(Object.assign(new Error(payload.error || "Sifariş yaradılmadı."), { userMessage: payload.error || "Çek yüklənmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin.", retryable: xhr.status >= 500 || xhr.status === 408 || xhr.status === 429 }));
        else if (!validOrder(payload)) xhr.onerror();
        else resolve(payload);
      };
      progress(2);
      xhr.send(formData);
    });
  }

  async function submitReceiptWithRetry(path, formData, progress, idempotencyKey) {
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await submitWithProgress(path, formData, progress, idempotencyKey);
      } catch (error) {
        lastError = error;
        if (!error?.retryable || attempt === 1) throw error;
        progress(4);
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    }
    throw lastError;
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
      <button id="paymentMethodsRetry" type="button" hidden>Yenidən cəhd et</button>
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
    return methods.map((method) => {
      const reason = method.available ? "" : method.unavailableReason || (method.status === "limit_reached" ? "Bu gün limit dolub" : "Müvəqqəti rezervdədir");
      return `<button class="paymentMethodChoice theme-${esc(method.theme || "neutral")}" type="button" data-payment-method="${esc(method.id)}"${method.available ? "" : " disabled"} aria-disabled="${method.available ? "false" : "true"} aria-pressed="false" aria-label="${esc(`${method.providerName}, son dörd rəqəm ${method.last4}${reason ? `, ${reason}` : ""}`)}">${methodIcon(method.type)}<span>${esc(method.providerName)}</span><small>•••• ${esc(method.last4)}</small>${reason ? `<small>${esc(reason)}</small>` : ""}<i aria-hidden="true">✓</i></button>`;
    }).join("");
  }

  function detailMarkup(reservation) {
    const method = reservation.method;
    return `<div class="paymentSelectedWrap"><article class="paymentSelectedCard theme-${esc(method.theme || "neutral")}" style="--payment-card-color:${esc(method.color)}">
      <div class="paymentSelectedTop"><div><small>Ödəniş üsulu</small><strong>${esc(method.providerName)}</strong></div><div class="paymentSelectedTopActions"><span>${method.type === "wallet" ? "Elektron cüzdan" : "Bank kartı"}</span><button id="changePaymentMethod" type="button">Kartı dəyiş</button></div></div>
      <div class="paymentMagneticStripe" aria-hidden="true"></div>
      <div class="paymentHolder"><small>Sahib</small><strong>${esc(method.holderName || "Mirpanel")}</strong></div>
      <div class="paymentNumber"><code>${esc(method.number)}</code><button id="copyPaymentNumber" type="button">Kopyala</button></div>
      <div class="paymentAmount"><span>Ödəniləcək məbləğ</span><strong>${Number(reservation.amount).toFixed(2)} ${esc(reservation.currency)}</strong></div>
      <div class="paymentReservationFooter"><div id="paymentReservationTimer" class="paymentReservationTime" role="timer" aria-live="polite"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>Ödənişi tamamlamaq üçün qalan vaxt</span><strong id="paymentReservationCountdown">10:00</strong></div></div>
    </article><p class="paymentSelectedHint">Nömrəni kopyalayın, ödənişi tamamlayın və qəbzin şəklini və ya PDF faylını aşağıdan yükləyin.</p></div>`;
  }

  function receiptMarkup() {
    return `<form id="paymentReceiptForm" class="paymentReceiptBox" action="" method="post" novalidate>
      <label class="paymentReceiptPicker" for="paymentReceiptInput" tabindex="0" role="button" aria-describedby="paymentReceiptPickerDescription paymentReceiptPickerWarning paymentReceiptPickerFormats"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5"/></svg><strong>1. Çeki yüklə</strong><span id="paymentReceiptPickerDescription">Ödəniş çekinin şəklini və ya PDF faylını buraya əlavə edin.</span><em id="paymentReceiptPickerWarning">Çeki WhatsApp-a göndərməyin — bu hissəyə yükləyin.</em><small id="paymentReceiptPickerFormats">JPG, PNG, WEBP və ya PDF · maksimum 5 MB</small></label>
      <input id="paymentReceiptInput" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf" hidden>
      <div id="paymentReceiptPreview" class="paymentReceiptPreview hidden"></div>
      <div id="paymentUploadProgress" class="paymentUploadProgress hidden"><span></span><b>0%</b></div>
      <p id="paymentReceiptError" class="paymentReceiptError" role="alert" hidden></p>
      <p id="paymentReceiptRequiredHint" class="paymentReceiptRequiredHint">Davam etmək üçün əvvəlcə çeki yükləyin.</p>
      <div class="paymentSubmitActions"><button id="paymentCancel" type="button">Ləğv et</button><div id="paymentSubmitGuard" class="paymentSubmitGuard isBlocked"><button id="paymentSubmit" type="submit" disabled>2. Sifarişi göndər və WhatsApp-a keç</button></div></div>
    </form>`;
  }

  function setReceiptSubmitReady(ready) {
    const submit = document.getElementById("paymentSubmit");
    const guard = document.getElementById("paymentSubmitGuard");
    const hint = document.getElementById("paymentReceiptRequiredHint");
    if (submit) submit.disabled = !ready;
    guard?.classList.toggle("isBlocked", !ready);
    if (hint) hint.hidden = ready;
  }

  function promptForReceipt() {
    const picker = document.querySelector(".paymentReceiptPicker");
    const error = document.getElementById("paymentReceiptError");
    if (error) {
      error.textContent = "Əvvəlcə ödəniş çekini yükləyin.";
      error.hidden = false;
    }
    picker?.classList.add("needsReceipt");
    picker?.scrollIntoView({ behavior: "smooth", block: "center" });
    picker?.focus({ preventScroll: true });
    window.setTimeout(() => picker?.classList.remove("needsReceipt"), 2200);
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
    if (!id) return { ok: true, idempotent: true };
    const result = await request("/api/payments/reservations/cancel", { method: "POST", body: JSON.stringify({ reservationId: id, checkoutKey: flow.checkoutKey }) });
    flow.reservation = null;
    flow.previousReservationId = null;
    clearReceipt(flow);
    clearStoredCheckout();
    return result;
  }

  function clearReceipt(flow) {
    if (flow.receiptPreviewUrl) URL.revokeObjectURL(flow.receiptPreviewUrl);
    flow.receiptPreviewUrl = null;
    flow.receipt = null;
    const input = document.getElementById("paymentReceiptInput");
    if (input) input.value = "";
    const preview = document.getElementById("paymentReceiptPreview");
    if (preview) { preview.replaceChildren(); preview.classList.add("hidden"); }
  }

  async function start({ product, plan, planIndex }) {
    if (activeFlow && !activeFlow.settled) {
      if (activeFlow.shell === document.querySelector(".paymentFlow")) return activeFlow.promise;
      // A parent modal may have been closed/replaced while the read was pending.
      await activeFlow.finish(null, { cancel: true });
    }
    if (activeFlow?.reservation || activeFlow?.previousReservationId) await cancelReservation(activeFlow);
    renderShell(product, plan);
    const previous = storedCheckout();
    const flow = { product, plan, planIndex, checkoutKey: previous?.checkoutKey || uuid(), previousReservationId: previous?.reservationId || null, reservation: null, receipt: null, receiptPreviewUrl: null, orderIdempotencyKey: previous?.orderIdempotencyKey || uuid(), stopTimer: null, settled: false, submitting: false, reserving: false, changing: false, cancelling: false, stage: "payment_method_selection" };
    activeFlow = flow;
    flow.shell = document.querySelector(".paymentFlow");
    flow.reservationKeys = new Map();
    flow.promise = new Promise((resolve) => {
      const finish = async (value, options = {}) => {
        const { cancel = false, redirectHome = false, preserveModal = false } = options;
        if (flow.settled || flow.cancelling) return false;
        if (cancel) {
          flow.cancelling = true;
          try {
            if (flow.reservation || flow.previousReservationId) await cancelReservation(flow);
          } catch (error) {
            flow.cancelling = false;
            throw error;
          }
        }
        flow.settled = true;
        clearInterval(flow.queueRefreshTimer);
        flow.readController?.abort();
        flow.stopTimer?.();
        clearReceipt(flow);
        // Preserve only the checkout capability, never the card/receipt. A reload
        // can recover a committed order even when its HTTP response was lost.
        if (!value) clearStoredCheckout();
        if (!preserveModal) document.getElementById("modal")?.classList.remove("paymentFlowOpen");
        if (activeFlow === flow) activeFlow = null;
        resolve(value);
        if (redirectHome) {
          window.location.href = "https://mirpanel.com/";
          return true;
        }
        return true;
      };
      flow.finish = finish;
      document.querySelector(".paymentFlowClose").onclick = async (event) => {
        event.preventDefault();
        if (flow.submitting) return;
        if ((flow.reservation || flow.previousReservationId) && !window.confirm("Aktiv rezerv ləğv ediləcək. Pəncərəni bağlamaq istəyirsiniz?")) return;
        try {
          await finish(null, { cancel: true });
        } catch (error) {
          setMessage(`${error.message} Rezerv ləğv edilmədi, yenidən cəhd edin.`, "error");
        }
      };
      const retry = document.getElementById("paymentMethodsRetry");
      const loadMethods = async () => {
        if (flow.loadingMethods || flow.settled) return;
        flow.loadingMethods = true;
        flow.readController = new AbortController();
        retry.hidden = true;
        retry.disabled = true;
        setMessage("Aktiv ödəniş üsulları yüklənir. Server gecikərsə, sorğu avtomatik təkrarlanacaq...");
        document.getElementById("paymentMethodChoices")?.setAttribute("aria-busy", "true");
      try {
        let recovered;
        if (flow.previousReservationId && !flow.reservation) {
          recovered = await request("/api/payments/checkout/resume", {
            method: "POST", signal: flow.readController.signal,
            body: JSON.stringify({ reservationId: flow.previousReservationId, checkoutKey: flow.checkoutKey })
          });
          if (recovered.state === "submitted") {
            await finish(recovered.order, { preserveModal: true });
            return;
          }
          if (recovered.state === "expired") {
            clearStoredCheckout();
            flow.previousReservationId = null;
          } else if (recovered.productId !== product.id || recovered.planIndex !== Number(planIndex)) {
            // Never create another reservation while an older checkout is active.
            throw new Error("Başqa məhsul üçün aktiv rezerv var. Əvvəl həmin ödənişi tamamlayın və ya pəncərənin bağlama düyməsi ilə ləğv edin.");
          }
        }
        const result = await request("/api/payments/methods", { signal: flow.readController.signal });
        if (flow.settled || activeFlow !== flow) return;
        if (!recovered && (flow.reservation || flow.reserving)) return;
        const choices = document.getElementById("paymentMethodChoices");
        const renderChoices = () => {
          setStage(flow, "payment_method_selection");
          choices.hidden = false;
          choices.innerHTML = methodButtons(result.methods);
          document.getElementById("paymentMethodDetail").innerHTML = "";
          document.getElementById("paymentReceiptArea").innerHTML = "";
        };
        renderChoices();
        if (!result.methods.length) setMessage("Hazırda aktiv ödəniş üsulu yoxdur. Dəstəklə əlaqə saxlayın.", "error");
        else if (!result.anyAvailable) setMessage(result.methods.every((method) => method.status === "limit_reached")
          ? "Hazırda bütün kartların limiti dolub. Daha sonra yenidən yoxlayın və ya dəstəklə əlaqə saxlayın."
          : "Kartlar müvəqqəti rezervlərlə tutulub. Bir qədər sonra yenidən cəhd edin.", "error");
        else setMessage("Ödəniş edəcəyiniz kartı və ya cüzdanı özünüz seçin.");
        retry.hidden = result.anyAvailable;

        const showReservation = (reserved) => {
            flow.reservation = reserved;
            flow.previousReservationId = reserved.reservationId;
            flow.changing = false;
            flow.submissionStarted = false;
            storeCheckout(flow);
            setStage(flow, "payment_details");
            choices.replaceChildren();
            choices.hidden = true;
            document.getElementById("paymentMethodDetail").innerHTML = detailMarkup(reserved);
            document.getElementById("paymentReceiptArea").innerHTML = receiptMarkup();
            const receiptPicker = document.querySelector(".paymentReceiptPicker");
            receiptPicker.onkeydown = (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              document.getElementById("paymentReceiptInput")?.click();
            };
            document.getElementById("paymentSubmitGuard").onclick = () => {
              if (!flow.receipt && !flow.submitting) promptForReceipt();
            };
            setMessage("Rezerv yaradıldı. Ödənişdən sonra qəbzi yükləyin.", "success");
            setTimeout(() => {
              if (flow.reservation?.reservationId === reserved.reservationId && !flow.settled) setMessage("Ödəniş məlumatı hazırdır.", "success compact");
            }, 1800);
            document.getElementById("paymentMethodDetail")?.scrollIntoView({ behavior: "smooth", block: "start" });
            flow.stopTimer?.();
            flow.stopTimer = startCountdown(reserved.expiresAt, async () => {
              if (flow.submissionStarted) {
                // Submission may have committed. Keep its recovery key and never
                // cancel it from a client timer while the response is uncertain.
                document.getElementById("paymentMethodDetail").innerHTML = "";
                return;
              }
              const expiredId = flow.reservation?.reservationId;
              flow.reservation = null;
              flow.previousReservationId = null;
              clearReceipt(flow);
              clearStoredCheckout();
              flow.reservationKeys.clear();
              document.getElementById("paymentMethodDetail").innerHTML = "";
              document.getElementById("paymentReceiptArea").innerHTML = "";
              renderChoices();
              setMessage("Rezerv vaxtı bitdi. Ödəniş üsulunu yenidən seçin.", "error");
              if (expiredId) await request("/api/payments/reservations/cancel", { method: "POST", body: JSON.stringify({ reservationId: expiredId, checkoutKey: flow.checkoutKey }) }).catch(() => {});
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
                flow.reservationKeys.clear();
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
            document.getElementById("paymentCancel").onclick = async (event) => {
              event.preventDefault();
              if (flow.cancelling || flow.submitting) return;
              const cancelButton = document.getElementById("paymentCancel");
              const closeButton = document.querySelector(".paymentFlowClose");
              cancelButton.disabled = true;
              if (closeButton) closeButton.disabled = true;
              setMessage("Rezerv təhlükəsiz ləğv edilir...");
              try {
                await finish(null, { cancel: true, redirectHome: true });
                return;
              } catch (error) {
                cancelButton.disabled = false;
                if (closeButton) closeButton.disabled = false;
                setMessage(`${error.message} Rezerv ləğv edilmədi, yenidən cəhd edin.`, "error");
              }
            };
            document.getElementById("paymentReceiptInput").onchange = (fileEvent) => {
              const file = fileEvent.target.files?.[0];
              const error = document.getElementById("paymentReceiptError");
              error.hidden = true;
              const declaredType = String(file?.type || "").toLowerCase();
              const extension = String(file?.name || "").split(".").pop().toLowerCase();
              const isAppleReceipt = APPLE_RECEIPT_TYPES.has(declaredType) || extension === "heic" || extension === "heif";
              if (!file || file.size > 5 * 1024 * 1024 || isAppleReceipt) {
                clearReceipt(flow);
                setReceiptSubmitReady(false);
                error.textContent = !file ? "Qəbz seçilməyib." : file.size > 5 * 1024 * 1024 ? "Qəbz maksimum 5 MB ola bilər." : "HEIC/HEIF formatı dəstəklənmir. Şəkli JPG və ya PNG kimi saxlayıb yenidən seçin.";
                error.hidden = false;
                return;
              }
              clearReceipt(flow);
              flow.receipt = file;
              setStage(flow, "receipt_upload");
              const preview = document.getElementById("paymentReceiptPreview");
              preview.classList.remove("hidden");
              const looksLikeImage = declaredType.startsWith("image/") || ["jpg", "jpeg", "png", "webp"].includes(extension);
              flow.receiptPreviewUrl = looksLikeImage ? URL.createObjectURL(file) : null;
              const filePreview = flow.receiptPreviewUrl ? `<img src="${flow.receiptPreviewUrl}" alt="Yüklənəcək ödəniş qəbzi">` : `<div class="paymentPdfPreview" aria-label="PDF qəbzi"><strong>PDF</strong></div>`;
              preview.innerHTML = `${filePreview}<div class="paymentReceiptPreviewInfo"><strong>${esc(file.name)}</strong><span class="paymentReceiptPending" role="status">Çek seçildi — göndərildikdə təhlükəsiz yoxlanacaq.</span><div class="paymentReceiptPreviewActions"><button id="changePaymentReceipt" type="button">Dəyiş</button><button id="removePaymentReceipt" type="button">Sil</button></div></div>`;
              const submitButton = document.getElementById("paymentSubmit");
              setReceiptSubmitReady(true);
              submitButton.textContent = "2. Sifarişi göndər və WhatsApp-a keç";
              document.getElementById("changePaymentReceipt").onclick = () => document.getElementById("paymentReceiptInput")?.click();
              document.getElementById("removePaymentReceipt").onclick = () => {
                clearReceipt(flow); setStage(flow, "payment_details"); setReceiptSubmitReady(false);
              };
            };
            document.getElementById("paymentReceiptForm").addEventListener("submit", async (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (flow.submitting) return;
              const submit = document.getElementById("paymentSubmit");
              const error = document.getElementById("paymentReceiptError");
              if (!flow.receipt) { promptForReceipt(); return; }
              if (!flow.reservation) { error.textContent = "Aktiv rezerv tələb olunur."; error.hidden = false; return; }
              flow.submitting = true;
              flow.submissionStarted = true;
              storeCheckout(flow);
              submit.disabled = true;
              submit.textContent = "Çek yüklənir...";
              const lockedControls = document.querySelectorAll(".paymentFlowClose, #changePaymentMethod, #paymentCancel, #paymentReceiptInput, #changePaymentReceipt, #removePaymentReceipt");
              lockedControls.forEach((control) => { control.disabled = true; });
              error.hidden = true;
              const progress = document.getElementById("paymentUploadProgress");
              progress.classList.remove("hidden");
              progress.classList.remove("isError");
              const updateProgress = (value) => { progress.querySelector("span").style.width = `${value}%`; progress.querySelector("b").textContent = `${value}%`; };
              try {
                const formData = new FormData();
                formData.append("reservationId", flow.reservation.reservationId);
                formData.append("checkoutKey", flow.checkoutKey);
                formData.append("productId", product.id);
                formData.append("planIndex", String(planIndex));
                formData.append("consentAccepted", "true");
                formData.append("receipt", flow.receipt, flow.receipt.name || "receipt");
                const order = await submitReceiptWithRetry("/api/payments/orders", formData, updateProgress, flow.orderIdempotencyKey);
                updateProgress(100);
                setMessage(`Çek uğurla əlavə edildi. Sifariş: ${order.orderCode}`, "success");
                await finish(order, { preserveModal: true });
                return;
              } catch (submitError) {
                flow.submitting = false;
                lockedControls.forEach((control) => { control.disabled = false; });
                progress.classList.add("isError");
                error.textContent = submitError.userMessage || "Çek yüklənmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin.";
                error.hidden = false;
                submit.disabled = false;
                submit.textContent = "Yenidən cəhd et";
              }
            });
        };
        if (recovered?.state === "reserved") {
          showReservation(recovered.reservation);
          setMessage("Rezerv bərpa edildi. Göndərilməmiş çeki yenidən seçin.", "success");
        }
        choices.onclick = async (event) => {
          const button = event.target.closest("[data-payment-method]");
          if (!button || button.disabled || flow.reserving || flow.reservation) return;
          flow.reserving = true;
          button.classList.add("selected");
          button.setAttribute("aria-pressed", "true");
          choices.querySelectorAll("button").forEach((item) => { item.disabled = true; });
          setMessage("Kart üçün 10 dəqiqəlik rezerv yaradılır...");
          try {
            const methodId = button.dataset.paymentMethod;
            if (!flow.reservationKeys.has(methodId)) flow.reservationKeys.set(methodId, uuid());
            const idempotencyKey = flow.reservationKeys.get(methodId);
            const reserved = await request("/api/payments/reservations", {
              method: "POST",
              headers: { "X-Idempotency-Key": idempotencyKey },
              body: JSON.stringify({ methodId, productId: product.id, planIndex, idempotencyKey,
                checkoutKey: flow.checkoutKey, previousReservationId: flow.previousReservationId || null })
            });
            showReservation(reserved);
          } catch (reserveError) {
            choices.querySelectorAll("button").forEach((item) => { item.disabled = item.getAttribute("aria-disabled") === "true"; });
            button.classList.remove("selected");
            button.setAttribute("aria-pressed", "false");
            setMessage(reserveError.message, "error");
          } finally {
            flow.reserving = false;
          }
        };
      } catch (error) {
        if (!flow.settled && activeFlow === flow) {
          setMessage(error.message, "error");
          retry.hidden = false;
        }
      } finally {
        flow.loadingMethods = false;
        retry.disabled = false;
        if (!flow.settled) document.getElementById("paymentMethodChoices")?.setAttribute("aria-busy", "false");
      }
      };
      retry.onclick = () => { void loadMethods(); };
      void loadMethods();
      flow.queueRefreshTimer = setInterval(() => {
        if (flow.settled || !flow.shell.isConnected) { clearInterval(flow.queueRefreshTimer); return; }
        if (flow.stage === "payment_method_selection" && !flow.reserving && !flow.reservation && !flow.previousReservationId && !flow.cancelling) void loadMethods();
      }, 15000);
    });
    return flow.promise;
  }

  window.MirpanelPaymentFlow = {
    start,
    isSubmitting: () => Boolean(activeFlow?.submitting),
    forgetCompleted: () => { if (!activeFlow) clearStoredCheckout(); },
    async recoverSubmitted() {
      const previous = storedCheckout();
      if (!previous?.submissionStarted || activeFlow) return null;
      const result = await request("/api/payments/checkout/resume", { method: "POST",
        body: JSON.stringify({ reservationId: previous.reservationId, checkoutKey: previous.checkoutKey }) });
      return result.state === "submitted" ? result.order : null;
    }
  };
})();
