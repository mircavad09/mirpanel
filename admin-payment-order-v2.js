(() => {
  const ENDPOINT = "/api/payment-orders";
  const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  const MAX = 5 * 1024 * 1024;
  const defaults = {
    enabled: false,
    requireCustomerEmail: true,
    emailLabel: "Sifarişin göndəriləcəyi Gmail ünvanı",
    emailPlaceholder: "məs: adiniz@gmail.com",
    receiptRequired: true,
    redirectWhatsApp: false,
    successMessage: "Sifarişiniz qəbul edildi. Ödəniş yoxlanıldıqdan sonra sizinlə əlaqə saxlanılacaq."
  };
  const defaultSettings = { bankName: "", cardHolderName: "", cardNumber: "", notifyEmail: "mircavad09@gmail.com" };

  const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const data = () => (typeof DATA !== "undefined" ? DATA : {});
  const product = () => (typeof currentProduct !== "undefined" ? currentProduct : null);
  const planIndex = () => (typeof currentPlanIdx !== "undefined" ? currentPlanIdx : 0);
  const settings = () => ({ ...defaultSettings, ...(data().paymentSettings || {}) });
  const payment = (p) => ({ ...defaults, enabled: p?.id === "capcut", ...(p?.adminPaymentOrder || {}) });
  const plan = (p) => p?.plans?.[planIndex()] || p?.plans?.[0];
  const planLabel = (pl) => String(pl?.label || "").trim() || (pl?.months ? `${pl.months} aylıq` : "");
  const priceText = (p, pl) => `${Number(pl?.price || 0).toFixed(2)} ${p.currency || "₼"}`;
  const stockNumber = (p) => p?.stockEnabled === true && p.stock !== null && p.stock !== "" && p.stock !== undefined ? Math.max(0, Number(p.stock) || 0) : null;
  const available = (p) => p && p.active !== false && p.soldOut !== true && p.flow !== "out_of_stock" && (stockNumber(p) === null || stockNumber(p) > 0);

  function close() {
    if (typeof closeModal === "function") closeModal();
    else {
      document.getElementById("modal")?.classList.remove("show");
      document.body.classList.remove("noScroll");
    }
  }

  function lock() {
    document.getElementById("modal")?.classList.add("show");
    if (typeof lockBodyScroll === "function") lockBodyScroll();
    else document.body.classList.add("noScroll");
  }

  function base(p, pl) {
    lock();
    document.getElementById("modal")?.classList.add("adminPaymentOpen");
    const nodes = { img: "mImg", title: "mTitle", desc: "mDesc", info: "mInfo", infoBox: "mInfoBox", plans: "mPlans", form: "mForm" };
    const img = document.getElementById(nodes.img);
    if (img) img.src = p.image || "";
    const title = document.getElementById(nodes.title);
    if (title) title.textContent = p.title || "";
    const desc = document.getElementById(nodes.desc);
    if (desc) desc.textContent = "";
    const info = document.getElementById(nodes.info);
    if (info) info.textContent = `${planLabel(pl)} / ${priceText(p, pl)}`;
    [nodes.infoBox, nodes.plans, nodes.form].forEach((id) => { const el = document.getElementById(id); if (el) el.innerHTML = ""; });
    const footer = document.querySelector("#modal .mSmall");
    if (footer) footer.textContent = "";
  }

  function html(markup) {
    const form = document.getElementById("mForm");
    if (form) form.innerHTML = markup;
  }

  function styles() {
    if (document.getElementById("adminPaymentOrderStyles")) return;
    const style = document.createElement("style");
    style.id = "adminPaymentOrderStyles";
    style.textContent = `#modal.adminPaymentOpen .modalCard{width:min(560px,calc(100vw - 28px));border:1px solid rgba(34,211,119,.72);background:radial-gradient(circle at 50% 0%,rgba(34,211,119,.12),transparent 38%),linear-gradient(180deg,rgba(18,24,21,.98),rgba(7,9,8,.98));box-shadow:0 26px 80px rgba(0,0,0,.62),0 0 34px rgba(34,211,119,.18)}#modal.adminPaymentOpen .mTop,#modal.adminPaymentOpen .mPlansTitle,#modal.adminPaymentOpen .mPlans,#modal.adminPaymentOpen .mInfoBox,#modal.adminPaymentOpen #mDesc{display:none!important}#modal.adminPaymentOpen #mForm{margin-top:0!important}.apf{display:grid;gap:16px;padding:26px 2px 0}.apt{text-align:center;font-size:clamp(24px,4vw,30px);font-weight:900;background:linear-gradient(135deg,#c9ffe1,#2dff86 45%,#13b87c);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}.aps{display:grid;gap:10px;padding:14px;border-radius:16px;border:1px solid rgba(45,255,134,.18);background:rgba(3,8,7,.58)}.apr{display:flex;justify-content:space-between;gap:12px;color:rgba(235,255,243,.78);font-size:13px;font-weight:700}.apr strong{color:#f8fff9;text-align:right}.apfield{display:grid;gap:8px}.apfield span{color:rgba(235,255,243,.9);font-size:13px;font-weight:800}.apfield input{width:100%;min-height:52px;border-radius:16px;border:1px solid rgba(148,163,184,.28);background:rgba(3,8,7,.74);color:#f7fff9;font-family:inherit;font-size:15px;font-weight:600;outline:none;padding:14px 16px}.apactions{display:grid;grid-template-columns:1fr 1fr;gap:12px}.apbtn{min-height:56px;border:0;border-radius:16px;color:#f8fff9;font-family:inherit;font-size:16px;font-weight:900;cursor:pointer}.apbtn.primary{background:linear-gradient(135deg,#2dde7d,#12a978)}.apbtn.cancel{background:linear-gradient(135deg,rgba(71,85,105,.95),rgba(38,48,63,.95))}.aphint{color:rgba(235,255,243,.62);font-size:12px;line-height:1.5}.apsuccess{text-align:center;display:grid;gap:12px;padding:28px 4px 8px}.apicon{width:58px;height:58px;margin:0 auto;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#2dde7d,#12a978);color:#03140c;font-size:30px;font-weight:900}@media(max-width:560px){.apactions{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function confirmFirst(p, pl, next) {
    const c = { title: "Sifarişi təsdiqləyin", description: "", confirmText: "Təsdiqləyirəm", cancelText: "Ləğv et", ...(p.orderConfirmation || p.confirmationModal || {}) };
    html(`<div class="mpForm orderConfirmation"><div class="mpFormTitle">${esc(c.title)}</div><div class="orderConfirmationDesc">${esc(c.description || p.desc || "")}</div>${p.note ? `<div class="orderConfirmationNote">${esc(p.note)}</div>` : ""}<div class="orderConfirmationActions"><button id="apCancelConfirm" class="mpBtn orderConfirmationCancel" type="button">${esc(c.cancelText)}</button><button id="apConfirm" class="mpBtn" type="button">${esc(c.confirmText)}</button></div></div>`);
    document.getElementById("apCancelConfirm").onclick = close;
    document.getElementById("apConfirm").onclick = next;
  }

  function success(message, orderId) {
    html(`<div class="apsuccess"><div class="apicon">✓</div><div class="apt">Sifariş qəbul edildi</div><p style="margin:0;color:rgba(235,255,243,.78);font-weight:700;line-height:1.6;">${esc(message)}</p><p style="margin:0;color:rgba(255,255,255,.75);font-weight:800;">#${esc(orderId || "")}</p><button class="apbtn primary" id="apSuccessClose" type="button">Bağla</button></div>`);
    document.getElementById("apSuccessClose").onclick = close;
  }

  function form(p, pl) {
    const pay = payment(p);
    const st = settings();
    html(`<form class="apf" id="apForm"><div class="apt">Ödənişli sifariş</div><div class="aps"><div class="apr"><span>Bank adı</span><strong>${esc(st.bankName || "Admin paneldə əlavə edilməyib")}</strong></div><div class="apr"><span>Kart sahibi</span><strong>${esc(st.cardHolderName || "Admin paneldə əlavə edilməyib")}</strong></div><div class="apr"><span>Kart nömrəsi</span><strong>${esc(st.cardNumber || "Admin paneldə əlavə edilməyib")}</strong></div><div class="apr"><span>Ödəniş məbləği</span><strong>${esc(priceText(p, pl))}</strong></div></div>${pay.requireCustomerEmail ? `<label class="apfield"><span>${esc(pay.emailLabel)}</span><input type="email" name="customerEmail" placeholder="${esc(pay.emailPlaceholder)}" required></label>` : ""}<label class="apfield"><span>Çek yüklə</span><input type="file" name="receiptFile" accept="image/jpeg,image/png,image/webp,application/pdf" ${pay.receiptRequired ? "required" : ""}></label><div class="aphint">Qəbul edilir: JPG, PNG, WEBP və PDF. Maksimum fayl ölçüsü 5 MB.</div><div class="apactions"><button class="apbtn cancel" id="apCancel" type="button">Ləğv et</button><button class="apbtn primary" id="apSubmit" type="submit">Sifarişi göndər</button></div></form>`);
    document.getElementById("apCancel").onclick = close;
    document.getElementById("apForm").onsubmit = async (event) => {
      event.preventDefault();
      const f = event.currentTarget;
      const btn = document.getElementById("apSubmit");
      const receipt = f.elements.receiptFile?.files?.[0] || null;
      const email = String(f.elements.customerEmail?.value || "").trim();
      if (pay.requireCustomerEmail && !email) return f.elements.customerEmail?.focus();
      if (pay.receiptRequired && !receipt) return f.elements.receiptFile?.focus();
      if (receipt && !TYPES.has(receipt.type)) return alert("Çek JPG, PNG, WEBP və ya PDF olmalıdır.");
      if (receipt && receipt.size > MAX) return alert("Çek faylı maksimum 5 MB ola bilər.");
      const body = new FormData();
      body.append("productId", p.id);
      body.append("productTitle", p.title || p.id);
      body.append("plan", planLabel(pl));
      body.append("price", priceText(p, pl));
      body.append("customerEmail", email);
      if (receipt) body.append("receiptFile", receipt);
      btn.disabled = true;
      btn.textContent = "Göndərilir...";
      try {
        const response = await fetch(ENDPOINT, { method: "POST", body });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok === false) throw new Error(result.error || "Sifariş göndərilmədi.");
        success(pay.successMessage, result.orderId);
      } catch (error) {
        alert(error.message || "Sifariş göndərilmədi.");
        btn.disabled = false;
        btn.textContent = "Sifarişi göndər";
      }
    };
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("#pp-order-btn");
    const p = product();
    if (!button || !p || !payment(p).enabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const pl = plan(p);
    if (!available(p) || !pl || Number(pl.price) <= 0) return alert("Stokda yoxdur.");
    styles();
    base(p, pl);
    const c = p.orderConfirmation || p.confirmationModal || {};
    if (c.enabled === true) confirmFirst(p, pl, () => form(p, pl));
    else form(p, pl);
  }, true);
})();
