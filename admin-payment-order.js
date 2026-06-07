(() => {
  const PAYMENT_ENDPOINT = "/api/payment-orders";
  const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

  const defaultPayment = {
    enabled: false,
    requireCustomerEmail: true,
    emailLabel: "Sifarişin göndəriləcəyi Gmail ünvanı",
    emailPlaceholder: "məs: adiniz@gmail.com",
    receiptRequired: true,
    redirectWhatsApp: false,
    successMessage: "Sifarişiniz qəbul edildi. Ödəniş yoxlanıldıqdan sonra sizinlə əlaqə saxlanılacaq."
  };

  const defaultSettings = {
    bankName: "",
    cardHolderName: "",
    cardNumber: "",
    notifyEmail: "mircavad09@gmail.com"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function paymentFor(product) {
    return {
      ...defaultPayment,
      enabled: product?.id === "capcut",
      ...(product?.adminPaymentOrder || {})
    };
  }

  function settingsFor() {
    return {
      ...defaultSettings,
      ...(window.DATA?.paymentSettings || {})
    };
  }

  function stockNumber(product) {
    if (product?.stockEnabled !== true || product.stock === null || product.stock === "" || product.stock === undefined) return null;
    const stock = Number(product.stock);
    return Number.isFinite(stock) ? Math.max(0, stock) : null;
  }

  function stockAvailable(product) {
    if (!product || product.active === false || product.soldOut === true || product.flow === "out_of_stock") return false;
    const stock = stockNumber(product);
    return stock === null || stock > 0;
  }

  function selectedPlan(product) {
    return product?.plans?.[window.currentPlanIdx || 0] || product?.plans?.[0];
  }

  function planLabel(plan) {
    return String(plan?.label || "").trim() || (plan?.months ? `${plan.months} aylıq` : "");
  }

  function priceText(product, plan) {
    return `${Number(plan?.price || 0).toFixed(2)} ${product.currency || "₼"}`;
  }

  function lockModal() {
    document.getElementById("modal")?.classList.add("show");
    if (typeof lockBodyScroll === "function") lockBodyScroll();
    else document.body.classList.add("noScroll");
  }

  function closeOrderModal() {
    if (typeof closeModal === "function") closeModal();
    else {
      document.getElementById("modal")?.classList.remove("show");
      document.body.classList.remove("noScroll");
    }
  }

  function baseModal(product, plan) {
    lockModal();
    const img = document.getElementById("mImg");
    const title = document.getElementById("mTitle");
    const desc = document.getElementById("mDesc");
    const info = document.getElementById("mInfo");
    const infoBox = document.getElementById("mInfoBox");
    const plans = document.getElementById("mPlans");
    const footer = document.querySelector("#modal .mSmall");
    const form = document.getElementById("mForm");

    if (img) img.src = product.image || "";
    if (title) title.textContent = product.title || "";
    if (desc) desc.textContent = "";
    if (info) info.textContent = `${planLabel(plan)} / ${priceText(product, plan)}`;
    if (infoBox) infoBox.innerHTML = "";
    if (plans) plans.innerHTML = "";
    if (footer) footer.textContent = "";
    if (form) form.innerHTML = "";
  }

  function render(html) {
    const form = document.getElementById("mForm");
    if (form) form.innerHTML = html;
  }

  function injectStyles() {
    if (document.getElementById("adminPaymentOrderStyles")) return;
    const style = document.createElement("style");
    style.id = "adminPaymentOrderStyles";
    style.textContent = `
      #modal.adminPaymentOpen .modalCard{width:min(560px,calc(100vw - 28px));border:1px solid rgba(34,211,119,.72);background:radial-gradient(circle at 50% 0%,rgba(34,211,119,.12),transparent 38%),linear-gradient(180deg,rgba(18,24,21,.98),rgba(7,9,8,.98));box-shadow:0 26px 80px rgba(0,0,0,.62),0 0 34px rgba(34,211,119,.18)}
      #modal.adminPaymentOpen .mTop,#modal.adminPaymentOpen .mPlansTitle,#modal.adminPaymentOpen .mPlans,#modal.adminPaymentOpen .mInfoBox,#modal.adminPaymentOpen #mDesc{display:none!important}
      #modal.adminPaymentOpen #mForm{margin-top:0!important}
      #modal.adminPaymentOpen .mBottom{margin-top:18px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08)}
      #modal.adminPaymentOpen #mInfo{color:rgba(255,255,255,.92);font-size:17px;font-weight:800;text-align:center}
      #modal.adminPaymentOpen .mSmall{display:none}
      .adminPayForm{display:grid;gap:16px;padding:26px 2px 0}.adminPayTitle{margin:0;text-align:center;font-size:clamp(24px,4vw,30px);font-weight:900;color:#2dff86;background:linear-gradient(135deg,#c9ffe1,#2dff86 45%,#13b87c);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;text-shadow:0 0 24px rgba(45,255,134,.22)}
      .adminPaySummary{display:grid;gap:10px;padding:14px;border-radius:16px;border:1px solid rgba(45,255,134,.18);background:rgba(3,8,7,.58)}.adminPayRow{display:flex;justify-content:space-between;gap:12px;color:rgba(235,255,243,.78);font-size:13px;font-weight:700}.adminPayRow strong{color:#f8fff9;text-align:right}
      .adminPayField{display:grid;gap:8px;margin:0}.adminPayField span{color:rgba(235,255,243,.9);font-size:13px;font-weight:800}.adminPayField input{width:100%;min-height:52px;border-radius:16px;border:1px solid rgba(148,163,184,.28);background:rgba(3,8,7,.74);color:#f7fff9;font-family:inherit;font-size:15px;font-weight:600;outline:none;padding:14px 16px}.adminPayField input:focus{border-color:rgba(45,255,134,.78);box-shadow:0 0 0 4px rgba(45,255,134,.1),0 0 28px rgba(45,255,134,.16)}
      .adminPayActions{display:grid;grid-template-columns:1fr 1fr;gap:12px}.adminPayBtn{min-height:56px;border:0;border-radius:16px;color:#f8fff9;font-family:inherit;font-size:16px;font-weight:900;cursor:pointer}.adminPayBtn.primary{background:linear-gradient(135deg,#2dde7d,#12a978)}.adminPayBtn.cancel{background:linear-gradient(135deg,rgba(71,85,105,.95),rgba(38,48,63,.95))}.adminPayHint{color:rgba(235,255,243,.62);font-size:12px;line-height:1.5;margin-top:-4px}.adminPaySuccess{text-align:center;display:grid;gap:12px;padding:28px 4px 8px}.adminPaySuccessIcon{width:58px;height:58px;margin:0 auto;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#2dde7d,#12a978);color:#03140c;font-size:30px;font-weight:900}
      @media(max-width:560px){.adminPayActions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function setMode(active) {
    document.getElementById("modal")?.classList.toggle("adminPaymentOpen", active);
  }

  function showConfirmation(product, plan, onConfirm) {
    const c = {
      enabled: false,
      title: "Sifarişi təsdiqləyin",
      description: "",
      confirmText: "Təsdiqləyirəm",
      cancelText: "Ləğv et",
      footerText: "",
      ...(product.orderConfirmation || product.confirmationModal || {})
    };
    setMode(false);
    render(`
      <div class="mpForm orderConfirmation">
        <div class="mpFormTitle">${escapeHtml(c.title)}</div>
        <div class="orderConfirmationDesc">${escapeHtml(c.description || product.desc || "")}</div>
        ${product.note ? `<div class="orderConfirmationNote">${escapeHtml(product.note)}</div>` : ""}
        <div class="orderConfirmationActions">
          <button id="adminPayCancelConfirm" class="mpBtn orderConfirmationCancel" type="button">${escapeHtml(c.cancelText)}</button>
          <button id="adminPayConfirm" class="mpBtn" type="button">${escapeHtml(c.confirmText)}</button>
        </div>
      </div>
    `);
    document.getElementById("adminPayCancelConfirm").onclick = closeOrderModal;
    document.getElementById("adminPayConfirm").onclick = onConfirm;
  }

  function showSuccess(message, orderId) {
    setMode(true);
    render(`
      <div class="adminPaySuccess">
        <div class="adminPaySuccessIcon">✓</div>
        <div class="adminPayTitle">Sifariş qəbul edildi</div>
        <p style="margin:0;color:rgba(235,255,243,.78);font-weight:700;line-height:1.6;">${escapeHtml(message)}</p>
        <p style="margin:0;color:rgba(255,255,255,.75);font-weight:800;">#${escapeHtml(orderId || "")}</p>
        <button class="adminPayBtn primary" id="adminPaySuccessClose" type="button">Bağla</button>
      </div>
    `);
    document.getElementById("adminPaySuccessClose").onclick = closeOrderModal;
  }

  function showPaymentForm(product, plan) {
    const payment = paymentFor(product);
    const settings = settingsFor();
    setMode(true);
    render(`
      <form class="adminPayForm" id="adminPayForm">
        <div class="adminPayTitle">Ödənişli sifariş</div>
        <div class="adminPaySummary">
          <div class="adminPayRow"><span>Bank adı</span><strong>${escapeHtml(settings.bankName || "Admin paneldə əlavə edilməyib")}</strong></div>
          <div class="adminPayRow"><span>Kart sahibi</span><strong>${escapeHtml(settings.cardHolderName || "Admin paneldə əlavə edilməyib")}</strong></div>
          <div class="adminPayRow"><span>Kart nömrəsi</span><strong>${escapeHtml(settings.cardNumber || "Admin paneldə əlavə edilməyib")}</strong></div>
          <div class="adminPayRow"><span>Ödəniş məbləği</span><strong>${escapeHtml(priceText(product, plan))}</strong></div>
        </div>
        ${payment.requireCustomerEmail ? `<label class="adminPayField"><span>${escapeHtml(payment.emailLabel)}</span><input type="email" name="customerEmail" placeholder="${escapeHtml(payment.emailPlaceholder)}" required></label>` : ""}
        <label class="adminPayField"><span>Çek yüklə</span><input type="file" name="receiptFile" accept="image/jpeg,image/png,image/webp,application/pdf" ${payment.receiptRequired ? "required" : ""}></label>
        <div class="adminPayHint">Qəbul edilir: JPG, PNG, WEBP və PDF. Maksimum fayl ölçüsü 5 MB.</div>
        <div class="adminPayActions"><button class="adminPayBtn cancel" id="adminPayCancel" type="button">Ləğv et</button><button class="adminPayBtn primary" id="adminPaySubmit" type="submit">Sifarişi göndər</button></div>
      </form>
    `);
    document.getElementById("adminPayCancel").onclick = closeOrderModal;
    document.getElementById("adminPayForm").onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = document.getElementById("adminPaySubmit");
      const receipt = form.elements.receiptFile?.files?.[0] || null;
      const customerEmail = String(form.elements.customerEmail?.value || "").trim();
      if (payment.requireCustomerEmail && !customerEmail) return form.elements.customerEmail?.focus();
      if (payment.receiptRequired && !receipt) return form.elements.receiptFile?.focus();
      if (receipt && !ALLOWED_TYPES.has(receipt.type)) return alert("Çek JPG, PNG, WEBP və ya PDF olmalıdır.");
      if (receipt && receipt.size > MAX_RECEIPT_SIZE) return alert("Çek faylı maksimum 5 MB ola bilər.");
      const body = new FormData();
      body.append("productId", product.id);
      body.append("productTitle", product.title || product.id);
      body.append("plan", planLabel(plan));
      body.append("price", priceText(product, plan));
      body.append("customerEmail", customerEmail);
      if (receipt) body.append("receiptFile", receipt);
      button.disabled = true;
      button.textContent = "Göndərilir...";
      try {
        const response = await fetch(PAYMENT_ENDPOINT, { method: "POST", body });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok === false) throw new Error(result.error || "Sifariş göndərilmədi.");
        showSuccess(payment.successMessage, result.orderId);
      } catch (error) {
        alert(error.message || "Sifariş göndərilmədi.");
        button.disabled = false;
        button.textContent = "Sifarişi göndər";
      }
    };
  }

  function run(product, plan) {
    if (!stockAvailable(product) || !plan || Number(plan.price) <= 0) return alert("Stokda yoxdur.");
    injectStyles();
    baseModal(product, plan);
    const confirmation = product.orderConfirmation || product.confirmationModal || {};
    if (confirmation.enabled === true) showConfirmation(product, plan, () => showPaymentForm(product, plan));
    else showPaymentForm(product, plan);
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("#pp-order-btn");
    const product = window.currentProduct;
    if (!button || !product || !paymentFor(product).enabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    run(product, selectedPlan(product));
  }, true);
})();
