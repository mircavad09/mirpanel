(function () {
  "use strict";

  const HBO_TITLE = "HBO Max profil m\u0259lumatlar\u0131";
  const HBO_DESC = "HBO Max profil ad\u0131n\u0131z\u0131 v\u0259 profil kodunuzu qeyd edin.";
  const HBO_NAME_LABEL = "HBO Max profil ad\u0131";
  const HBO_NAME_PLACEHOLDER = "Profil ad\u0131n\u0131z\u0131 yaz\u0131n";
  const HBO_CODE_LABEL = "Profil kodu / PIN";
  const HBO_CODE_PLACEHOLDER = "4 r\u0259q\u0259mli profil kodunu yaz\u0131n";
  const HBO_CANCEL_TEXT = "L\u0259\u011fv et";
  const HBO_CONTINUE_TEXT = "Davam et";
  const HBO_CODE_ERROR = "Sad\u0259c\u0259 4 r\u0259q\u0259m yazmal\u0131s\u0131n\u0131z";
  const HBO_NAME_ERROR = "Ad\u0131n\u0131z\u0131 yaz\u0131n";
  const PRIME_TITLE = "Amazon Prime Video m\u0259lumatlar\u0131";
  const PRIME_DESC = "Prime Video profil ad\u0131n\u0131z\u0131 v\u0259 5 r\u0259q\u0259mli kodunuzu qeyd edin.";
  const PRIME_NAME_LABEL = "Ad";
  const PRIME_NAME_PLACEHOLDER = "Ad\u0131n\u0131z\u0131 yaz\u0131n";
  const PRIME_CODE_LABEL = "5 r\u0259q\u0259mli kod / PIN";
  const PRIME_CODE_PLACEHOLDER = "5 r\u0259q\u0259mli kod yaz\u0131n";
  const PRIME_CODE_ERROR = "Sad\u0259c\u0259 5 r\u0259q\u0259m yazmal\u0131s\u0131n\u0131z";

  function productBrandText(product) {
    return [
      product?.id,
      product?.slug,
      product?.name,
      product?.title,
      product?.variant,
      product?.badge,
      product?.category
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function isNetflixProduct(product) {
    return productBrandText(product).includes("netflix");
  }

  function isHboMaxProduct(product) {
    const text = productBrandText(product);
    return text.includes("hbomax") || text.includes("hbo max") || /\bhbo\b/.test(text);
  }

  function isPrimeVideoProduct(product) {
    const text = productBrandText(product);
    return text.includes("prime video") || text.includes("amazon prime") || text.includes("amazon") || /\bprime\b/.test(text);
  }

  function getOrderFormBrand(product, flow) {
    if (isPrimeVideoProduct(product)) return "prime";
    if (isHboMaxProduct(product)) return "hbo";
    if (isNetflixProduct(product)) return "netflix";
    return "default";
  }

  function getCurrentProductSafe() {
    try {
      if (typeof currentProduct !== "undefined" && currentProduct) return currentProduct;
    } catch (_) {}

    try {
      const hash = String(location.hash || "");
      const match = hash.match(/product=([^&]+)/i);
      const productId = match ? decodeURIComponent(match[1]) : "";
      if (productId && typeof DATA !== "undefined" && Array.isArray(DATA)) {
        return DATA.find((item) => String(item.id) === productId) || null;
      }
    } catch (_) {}

    return null;
  }

  function getSelectedPlanSafe(product) {
    try {
      if (typeof currentPlanIdx !== "undefined" && product?.plans?.[currentPlanIdx]) {
        return product.plans[currentPlanIdx];
      }
    } catch (_) {}

    return product?.plans?.find((plan) => Number(plan.price) > 0) || product?.plans?.[0] || {};
  }

  function ensureHboMaxOrderStyles() {
    if (document.getElementById("hboMaxOrderFixStyles")) return;

    const style = document.createElement("style");
    style.id = "hboMaxOrderFixStyles";
    style.textContent = `
      #modal.hboMaxOrderFormOpen .modalCard {
        border: 1px solid rgba(124, 92, 255, .72) !important;
        background:
          radial-gradient(circle at 20% 0%, rgba(37, 99, 235, .20), transparent 34%),
          radial-gradient(circle at 100% 15%, rgba(6, 182, 212, .14), transparent 34%),
          linear-gradient(145deg, rgba(8, 12, 28, .98), rgba(4, 7, 18, .98)) !important;
        box-shadow: 0 26px 70px rgba(15, 23, 42, .82), 0 0 42px rgba(37, 99, 235, .24), inset 0 1px 0 rgba(255, 255, 255, .08) !important;
      }
      #modal.hboMaxOrderFormOpen .mTop,
      #modal.hboMaxOrderFormOpen .mPlansTitle,
      #modal.hboMaxOrderFormOpen .mPlans,
      #modal.hboMaxOrderFormOpen .mInfoBox,
      #modal.hboMaxOrderFormOpen #mDesc,
      #modal.primeVideoOrderFormOpen .mTop,
      #modal.primeVideoOrderFormOpen .mPlansTitle,
      #modal.primeVideoOrderFormOpen .mPlans,
      #modal.primeVideoOrderFormOpen .mInfoBox,
      #modal.primeVideoOrderFormOpen #mDesc {
        display: none !important;
      }
      #modal.hboMaxOrderFormOpen #mForm,
      #modal.primeVideoOrderFormOpen #mForm {
        margin-top: 0 !important;
      }
      #modal.primeVideoOrderFormOpen .modalCard {
        border: 1px solid rgba(56, 189, 248, .72) !important;
        background:
          radial-gradient(circle at 18% 0%, rgba(14, 165, 233, .22), transparent 34%),
          radial-gradient(circle at 100% 15%, rgba(34, 211, 238, .14), transparent 34%),
          linear-gradient(145deg, rgba(3, 12, 23, .98), rgba(2, 6, 23, .98)) !important;
        box-shadow: 0 26px 70px rgba(2, 6, 23, .84), 0 0 42px rgba(14, 165, 233, .25), inset 0 1px 0 rgba(255, 255, 255, .08) !important;
      }
      .hboMaxOrderForm {
        display: grid;
        gap: 14px;
        padding: 18px 0 0;
      }
      .hboMaxOrderForm .mpFormTitle {
        margin: 0;
        text-align: center;
        font-size: clamp(24px, 5vw, 31px);
        line-height: 1.1;
        font-weight: 950;
        letter-spacing: 0;
        color: #f8fbff !important;
        text-shadow: 0 0 28px rgba(124, 92, 255, .30), 0 0 18px rgba(34, 211, 238, .14);
      }
      .hboMaxOrderForm .hboMaxOrderDesc {
        margin: -4px 0 4px;
        color: rgba(226, 232, 255, .76);
        font-size: 13px;
        line-height: 1.45;
        text-align: center;
      }
      .hboMaxOrderForm .hboMaxFields {
        display: grid;
        gap: 12px;
      }
      .hboMaxOrderForm .hboMaxField {
        display: grid;
        gap: 7px;
        margin: 0;
      }
      .hboMaxOrderForm .hboMaxField .mpLabel {
        color: rgba(239, 246, 255, .92);
        font-size: 13px;
        font-weight: 850;
      }
      .hboMaxOrderForm .mpInput {
        min-height: 52px;
        border-radius: 16px;
        border: 1px solid rgba(124, 92, 255, .34) !important;
        background: rgba(2, 6, 23, .82) !important;
        color: #f8fafc;
        font-size: 15px;
        font-weight: 750;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .07);
        transition: border-color .22s ease, box-shadow .22s ease, background .22s ease;
      }
      .hboMaxOrderForm .mpInput::placeholder {
        color: rgba(226, 232, 240, .48);
      }
      .hboMaxOrderForm .mpInput:focus {
        outline: none;
        border-color: rgba(34, 211, 238, .78) !important;
        background: rgba(5, 11, 26, .95) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 0 0 4px rgba(34, 211, 238, .11), 0 0 30px rgba(124, 92, 255, .20) !important;
      }
      .hboMaxOrderForm .hboMaxActions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 11px;
        margin-top: 4px;
      }
      .hboMaxOrderForm .mpBtn {
        min-height: 52px;
        border: 0;
        border-radius: 16px;
        font-size: 15px;
        font-weight: 950;
        color: #fff;
        transition: transform .18s ease, filter .2s ease, box-shadow .2s ease;
      }
      .hboMaxOrderForm .hboMaxCancel {
        background: linear-gradient(135deg, rgba(51, 65, 85, .98), rgba(15, 23, 42, .98)) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
      }
      .hboMaxOrderForm .hboMaxContinue {
        background: linear-gradient(135deg, #7c3aed, #2563eb 58%, #06b6d4) !important;
        box-shadow: 0 16px 38px rgba(37, 99, 235, .30), 0 0 25px rgba(34, 211, 238, .14), inset 0 1px 0 rgba(255, 255, 255, .18) !important;
      }
      .hboMaxOrderForm .mpBtn:hover {
        transform: translateY(-1px);
        filter: brightness(1.05);
      }
      .primeVideoOrderForm {
        display: grid;
        gap: 14px;
        padding: 18px 0 0;
      }
      .primeVideoOrderForm .mpFormTitle {
        margin: 0;
        text-align: center;
        font-size: clamp(24px, 5vw, 31px);
        line-height: 1.1;
        font-weight: 950;
        letter-spacing: 0;
        color: #f8fbff !important;
        text-shadow: 0 0 28px rgba(14, 165, 233, .34), 0 0 18px rgba(34, 211, 238, .18);
      }
      .primeVideoOrderForm .primeVideoOrderDesc {
        margin: -4px 0 4px;
        color: rgba(226, 242, 255, .77);
        font-size: 13px;
        line-height: 1.45;
        text-align: center;
      }
      .primeVideoOrderForm .primeVideoFields {
        display: grid;
        gap: 12px;
      }
      .primeVideoOrderForm .primeVideoField {
        display: grid;
        gap: 7px;
        margin: 0;
      }
      .primeVideoOrderForm .primeVideoField .mpLabel {
        color: rgba(239, 249, 255, .94);
        font-size: 13px;
        font-weight: 850;
      }
      .primeVideoOrderForm .mpInput {
        min-height: 52px;
        border-radius: 16px;
        border: 1px solid rgba(56, 189, 248, .36) !important;
        background: rgba(2, 8, 23, .84) !important;
        color: #f8fafc;
        font-size: 16px;
        font-weight: 750;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .07);
        transition: border-color .22s ease, box-shadow .22s ease, background .22s ease;
      }
      .primeVideoOrderForm .mpInput::placeholder {
        color: rgba(226, 232, 240, .50);
      }
      .primeVideoOrderForm .mpInput:focus {
        outline: none;
        border-color: rgba(34, 211, 238, .84) !important;
        background: rgba(2, 12, 28, .96) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 0 0 4px rgba(14, 165, 233, .12), 0 0 30px rgba(34, 211, 238, .19) !important;
      }
      .primeVideoOrderForm .primeVideoActions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 11px;
        margin-top: 4px;
      }
      .primeVideoOrderForm .mpBtn {
        min-height: 52px;
        border: 0;
        border-radius: 16px;
        font-size: 15px;
        font-weight: 950;
        color: #fff;
        transition: transform .18s ease, filter .2s ease, box-shadow .2s ease;
      }
      .primeVideoOrderForm .primeVideoCancel {
        background: linear-gradient(135deg, rgba(51, 65, 85, .98), rgba(15, 23, 42, .98)) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
      }
      .primeVideoOrderForm .primeVideoContinue {
        background: linear-gradient(135deg, #0284c7, #06b6d4 58%, #22d3ee) !important;
        box-shadow: 0 16px 38px rgba(14, 165, 233, .31), 0 0 25px rgba(34, 211, 238, .16), inset 0 1px 0 rgba(255, 255, 255, .20) !important;
      }
      .primeVideoOrderForm .mpBtn:hover {
        transform: translateY(-1px);
        filter: brightness(1.05);
      }
      .mirpanelOrderToast {
        position: fixed;
        top: max(18px, env(safe-area-inset-top));
        left: 50%;
        z-index: 999999;
        transform: translate(-50%, -10px);
        max-width: min(420px, calc(100vw - 28px));
        padding: 13px 16px;
        border: 1px solid rgba(34, 211, 238, .42);
        border-radius: 16px;
        background: linear-gradient(145deg, rgba(2, 8, 23, .96), rgba(3, 18, 34, .96));
        color: #f8fafc;
        box-shadow: 0 18px 40px rgba(2, 6, 23, .55), 0 0 28px rgba(34, 211, 238, .16);
        font-size: 14px;
        font-weight: 850;
        text-align: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity .22s ease, transform .22s ease;
      }
      .mirpanelOrderToast.show {
        opacity: 1;
        transform: translate(-50%, 0);
      }
      @media (max-width: 640px) {
        #modal.hboMaxOrderFormOpen,
        #modal.primeVideoOrderFormOpen {
          align-items: flex-start;
          padding: calc(12px + env(safe-area-inset-top)) 0 18px;
        }
        #modal.hboMaxOrderFormOpen .modalCard,
        #modal.primeVideoOrderFormOpen .modalCard {
          width: calc(100vw - 24px);
          max-height: calc(100dvh - 118px);
          overflow-y: auto;
          border-radius: 22px;
        }
        .hboMaxOrderForm,
        .primeVideoOrderForm {
          gap: 11px;
          padding-top: 14px;
        }
        .hboMaxOrderForm .mpFormTitle,
        .primeVideoOrderForm .mpFormTitle {
          max-width: calc(100% - 72px);
          margin: 0 auto;
          font-size: 23px;
        }
        .hboMaxOrderForm .hboMaxOrderDesc,
        .primeVideoOrderForm .primeVideoOrderDesc {
          font-size: 12px;
        }
        .hboMaxOrderForm .mpInput,
        .primeVideoOrderForm .mpInput {
          min-height: 48px;
          border-radius: 14px;
          font-size: 16px;
          padding: 12px 14px;
        }
        .hboMaxOrderForm .hboMaxActions,
        .primeVideoOrderForm .primeVideoActions {
          grid-template-columns: 1fr;
          gap: 9px;
        }
        .hboMaxOrderForm .mpBtn,
        .primeVideoOrderForm .mpBtn {
          min-height: 48px;
          font-size: 14px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function openHboMaxOrderForm(product, plan) {
    ensureHboMaxOrderStyles();

    const modal = document.getElementById("modal");
    const formHost = document.getElementById("mForm");
    if (!modal || !formHost) return false;

    modal.classList.add("show", "hboMaxOrderFormOpen");
    modal.classList.remove("netflixOrderFormOpen", "netflixOrderForm", "primeVideoOrderFormOpen");
    try {
      if (typeof lockBodyScroll === "function") lockBodyScroll();
    } catch (_) {}

    formHost.innerHTML = `
      <div class="mpForm hboMaxOrderForm">
        <div class="mpFormTitle">${HBO_TITLE}</div>
        <p class="hboMaxOrderDesc">${HBO_DESC}</p>
        <div class="hboMaxFields">
          <label class="hboMaxField">
            <span class="mpLabel">${HBO_NAME_LABEL}</span>
            <input id="hbo_name" class="mpInput" placeholder="${HBO_NAME_PLACEHOLDER}" autocomplete="name">
          </label>
          <label class="hboMaxField">
            <span class="mpLabel">${HBO_CODE_LABEL}</span>
            <input id="hbo_code" class="mpInput" type="text" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="${HBO_CODE_PLACEHOLDER}" autocomplete="one-time-code">
          </label>
        </div>
        <div class="hboMaxActions">
          <button id="hbo_cancel" type="button" class="mpBtn hboMaxCancel">${HBO_CANCEL_TEXT}</button>
          <button id="hbo_send" type="button" class="mpBtn hboMaxContinue">${HBO_CONTINUE_TEXT}</button>
        </div>
      </div>`;

    const nameInput = document.getElementById("hbo_name");
    const codeInput = document.getElementById("hbo_code");
    codeInput?.addEventListener("input", () => {
      codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 4);
    });

    document.getElementById("hbo_cancel")?.addEventListener("click", () => {
      modal.classList.remove("hboMaxOrderFormOpen");
      if (typeof closeModal === "function") closeModal();
      else modal.classList.remove("show");
    });

    document.getElementById("hbo_send")?.addEventListener("click", () => {
      const name = nameInput?.value.trim() || "";
      const code = codeInput?.value.trim() || "";
      if (!name) {
        alert((typeof UI !== "undefined" && UI.reqName) || HBO_NAME_ERROR);
        return;
      }
      if (!/^\d{4}$/.test(code)) {
        codeInput?.focus();
        alert(HBO_CODE_ERROR);
        return;
      }
      if (typeof sendWA === "function") {
        sendWA(product, plan, `${HBO_NAME_LABEL}: ${name}\n${HBO_CODE_LABEL}: ${code}`);
      }
      modal.classList.remove("hboMaxOrderFormOpen");
      if (typeof closeModal === "function") closeModal();
      else modal.classList.remove("show");
    });

    return true;
  }

  function showOrderToast(message) {
    let toast = document.querySelector(".mirpanelOrderToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "mirpanelOrderToast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toast.__hideTimer);
    toast.__hideTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  function openPrimeVideoOrderForm(product, plan) {
    ensureHboMaxOrderStyles();

    const modal = document.getElementById("modal");
    const formHost = document.getElementById("mForm");
    if (!modal || !formHost) return false;

    modal.classList.add("show", "primeVideoOrderFormOpen");
    modal.classList.remove("netflixOrderFormOpen", "netflixOrderForm", "hboMaxOrderFormOpen");
    try {
      if (typeof lockBodyScroll === "function") lockBodyScroll();
    } catch (_) {}

    formHost.innerHTML = `
      <div class="mpForm primeVideoOrderForm">
        <div class="mpFormTitle">${PRIME_TITLE}</div>
        <p class="primeVideoOrderDesc">${PRIME_DESC}</p>
        <div class="primeVideoFields">
          <label class="primeVideoField">
            <span class="mpLabel">${PRIME_NAME_LABEL}</span>
            <input id="prime_name" class="mpInput" placeholder="${PRIME_NAME_PLACEHOLDER}" autocomplete="name">
          </label>
          <label class="primeVideoField">
            <span class="mpLabel">${PRIME_CODE_LABEL}</span>
            <input id="prime_code" class="mpInput" type="text" inputmode="numeric" maxlength="5" pattern="\\d{5}" placeholder="${PRIME_CODE_PLACEHOLDER}" autocomplete="one-time-code">
          </label>
        </div>
        <div class="primeVideoActions">
          <button id="prime_cancel" type="button" class="mpBtn primeVideoCancel">${HBO_CANCEL_TEXT}</button>
          <button id="prime_send" type="button" class="mpBtn primeVideoContinue">${HBO_CONTINUE_TEXT}</button>
        </div>
      </div>`;

    const nameInput = document.getElementById("prime_name");
    const codeInput = document.getElementById("prime_code");
    codeInput?.addEventListener("input", () => {
      codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 5);
    });

    document.getElementById("prime_cancel")?.addEventListener("click", () => {
      modal.classList.remove("primeVideoOrderFormOpen");
      if (typeof closeModal === "function") closeModal();
      else modal.classList.remove("show");
    });

    document.getElementById("prime_send")?.addEventListener("click", () => {
      const name = nameInput?.value.trim() || "";
      const code = codeInput?.value.trim() || "";
      if (!name) {
        showOrderToast((typeof UI !== "undefined" && UI.reqName) || HBO_NAME_ERROR);
        nameInput?.focus();
        return;
      }
      if (!/^\d{5}$/.test(code)) {
        codeInput?.focus();
        showOrderToast(PRIME_CODE_ERROR);
        return;
      }
      if (typeof sendWA === "function") {
        sendWA(product, plan, `${PRIME_NAME_LABEL}: ${name}\n${PRIME_CODE_LABEL}: ${code}`);
      }
      modal.classList.remove("primeVideoOrderFormOpen");
      if (typeof closeModal === "function") closeModal();
      else modal.classList.remove("show");
    });

    return true;
  }

  let hboRepairing = false;

  function repairHboMaxModal() {
    if (hboRepairing) return;

    const product = getCurrentProductSafe();
    if (getOrderFormBrand(product, product?.flow) !== "hbo") return;

    const modal = document.getElementById("modal");
    const form = document.querySelector("#mForm .mpForm");
    if (!modal?.classList.contains("show") || !form) return;

    const modalText = modal.innerText || "";
    const hasNetflixLeak = /Netflix/i.test(modalText)
      || modal.classList.contains("netflixOrderFormOpen")
      || form.classList.contains("netflixOrderForm")
      || document.querySelector("#mForm .mpFormTitle")?.textContent?.trim() !== HBO_TITLE;

    if (!hasNetflixLeak) return;

    hboRepairing = true;
    try {
      modal.classList.remove("netflixOrderFormOpen", "netflixOrderForm");
      form.classList.remove("netflixOrderForm");
      openHboMaxOrderForm(product, getSelectedPlanSafe(product));
    } finally {
      setTimeout(() => {
        hboRepairing = false;
      }, 0);
    }
  }

  function installHboMaxModalGuard() {
    const modal = document.getElementById("modal");
    if (!modal || modal.__hboMaxModalGuardInstalled) return;

    const observer = new MutationObserver(() => {
      repairHboMaxModal();
    });
    observer.observe(modal, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true
    });
    modal.__hboMaxModalGuardInstalled = true;
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("#pp-order-btn");
    if (!button) return;

    const product = getCurrentProductSafe();
    const brand = getOrderFormBrand(product, product?.flow);
    if (brand !== "hbo" && brand !== "prime") {
      document.getElementById("modal")?.classList.remove("hboMaxOrderFormOpen", "primeVideoOrderFormOpen");
      return;
    }

    const plan = getSelectedPlanSafe(product);
    if (Number(plan?.price) <= 0) {
      alert((typeof UI !== "undefined" && UI.stokOut) || "Stokda yoxdur");
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    if (brand === "prime") {
      openPrimeVideoOrderForm(product, plan);
      return;
    }
    openHboMaxOrderForm(product, plan);
    setTimeout(repairHboMaxModal, 0);
    setTimeout(repairHboMaxModal, 120);
    setTimeout(repairHboMaxModal, 300);
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installHboMaxModalGuard, { once: true });
  } else {
    installHboMaxModalGuard();
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#closeModal")) return;
    document.getElementById("modal")?.classList.remove("hboMaxOrderFormOpen", "primeVideoOrderFormOpen");
  }, true);

  window.mirpanelHboMaxOrderFix = {
    isNetflixProduct,
    isHboMaxProduct,
    isPrimeVideoProduct,
    getOrderFormBrand,
    openHboMaxOrderForm,
    openPrimeVideoOrderForm
  };
})();
