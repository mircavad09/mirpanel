(function () {
  "use strict";

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

  function getOrderFormBrand(product, flow) {
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
      #modal.hboMaxOrderFormOpen #mDesc {
        display: none !important;
      }
      #modal.hboMaxOrderFormOpen #mForm {
        margin-top: 0 !important;
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
      @media (max-width: 640px) {
        #modal.hboMaxOrderFormOpen {
          align-items: flex-start;
          padding: calc(12px + env(safe-area-inset-top)) 0 18px;
        }
        #modal.hboMaxOrderFormOpen .modalCard {
          width: calc(100vw - 24px);
          max-height: calc(100dvh - 118px);
          overflow-y: auto;
          border-radius: 22px;
        }
        .hboMaxOrderForm {
          gap: 11px;
          padding-top: 14px;
        }
        .hboMaxOrderForm .mpFormTitle {
          max-width: calc(100% - 72px);
          margin: 0 auto;
          font-size: 23px;
        }
        .hboMaxOrderForm .hboMaxOrderDesc {
          font-size: 12px;
        }
        .hboMaxOrderForm .mpInput {
          min-height: 48px;
          border-radius: 14px;
          font-size: 14px;
          padding: 12px 14px;
        }
        .hboMaxOrderForm .hboMaxActions {
          grid-template-columns: 1fr;
          gap: 9px;
        }
        .hboMaxOrderForm .mpBtn {
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
    modal.classList.remove("netflixOrderFormOpen", "netflixOrderForm");
    try {
      if (typeof lockBodyScroll === "function") lockBodyScroll();
    } catch (_) {}

    formHost.innerHTML = `
      <div class="mpForm hboMaxOrderForm">
        <div class="mpFormTitle">HBO Max profil məlumatları</div>
        <p class="hboMaxOrderDesc">HBO Max profil adınızı və profil kodunuzu qeyd edin.</p>
        <div class="hboMaxFields">
          <label class="hboMaxField">
            <span class="mpLabel">HBO Max profil adı</span>
            <input id="hbo_name" class="mpInput" placeholder="Profil adınızı yazın" autocomplete="name">
          </label>
          <label class="hboMaxField">
            <span class="mpLabel">Profil kodu / PIN</span>
            <input id="hbo_code" class="mpInput" type="text" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="4 rəqəmli profil kodunu yazın" autocomplete="one-time-code">
          </label>
        </div>
        <div class="hboMaxActions">
          <button id="hbo_cancel" type="button" class="mpBtn hboMaxCancel">Ləğv et</button>
          <button id="hbo_send" type="button" class="mpBtn hboMaxContinue">Davam et</button>
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
        alert((typeof UI !== "undefined" && UI.reqName) || "Adınızı yazın");
        return;
      }
      if (!/^\d{4}$/.test(code)) {
        codeInput?.focus();
        alert("Sadəcə 4 rəqəm yazmalısınız");
        return;
      }
      if (typeof sendWA === "function") {
        sendWA(product, plan, `HBO Max profil adı: ${name}\nProfil kodu / PIN: ${code}`);
      }
      if (typeof closeModal === "function") closeModal();
      else modal.classList.remove("show");
    });

    return true;
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("#pp-order-btn");
    if (!button) return;

    const product = getCurrentProductSafe();
    if (getOrderFormBrand(product, product?.flow) !== "hbo") return;

    const plan = getSelectedPlanSafe(product);
    if (Number(plan?.price) <= 0) {
      alert((typeof UI !== "undefined" && UI.stokOut) || "Stokda yoxdur");
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    openHboMaxOrderForm(product, plan);
  }, true);

  window.mirpanelHboMaxOrderFix = {
    isNetflixProduct,
    isHboMaxProduct,
    getOrderFormBrand,
    openHboMaxOrderForm
  };
})();