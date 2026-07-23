(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function stockNumber(product) {
    if (product?.stockEnabled === false) return null;
    const rawStock = product.stock ?? product.stockCount ?? product.stockQuantity;
    if (rawStock === null || rawStock === "" || rawStock === undefined) return null;
    const stock = Number(rawStock);
    return Number.isFinite(stock) ? Math.max(0, stock) : null;
  }

  function stockBadgeData(product) {
    const stock = stockNumber(product);
    if (stock === null) return null;
    if (stock === 0) return { text: "Stokda yoxdur", className: "out" };
    return { text: `Stok: ${stock}`, className: stock <= 5 ? "low" : "ok" };
  }

  function stockBadgeHTML(product) {
    const badge = stockBadgeData(product);
    if (!badge) return "";
    return `<div class="cardStockLine"><span class="mpStockBadge cardStockBadge ${badge.className}">${escapeHtml(badge.text)}</span></div>`;
  }

  function minPrice(product) {
    if (typeof getMinPrice === "function") return getMinPrice(product);
    return Math.min(...(product.plans || []).filter((plan) => Number(plan.price) > 0).map((plan) => Number(plan.price)));
  }

  function priceText(product) {
    if (product.id === "tiktok_jeton") return `10.00 ${product.currency || "₼"}`;
    const min = minPrice(product);
    return min != null && min !== Infinity && min !== 0
      ? `${Number(min).toFixed(2)} ${product.currency || "₼"}`
      : "—";
  }

  function normalizeSearch(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("az")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replaceAll("ə", "e")
      .replaceAll("ı", "i")
      .replaceAll("ö", "o")
      .replaceAll("ü", "u")
      .replaceAll("ş", "s")
      .replaceAll("ç", "c")
      .replaceAll("ğ", "g");
  }

  function searchInputs() {
    const selectors = [
      "#q",
      "#sideMenuInput",
      ".side-search",
      ".headActions input[type='text']",
      "header input[type='text']",
      "input[placeholder*='Məhsul']",
      "input[placeholder*='məhsul']"
    ];

    return [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
      .filter((input) => input && input.tagName === "INPUT");
  }

  function currentSearchQuery() {
    const inputs = searchInputs();
    const active = document.activeElement;
    if (inputs.includes(active) && active.value.trim()) return active.value.trim();
    return inputs.find((input) => input.value.trim())?.value.trim() || "";
  }

  function syncSearchInputs(value, source) {
    searchInputs().forEach((input) => {
      if (input !== source && input.value !== value) input.value = value;
    });
  }

  function productMatches(product, query) {
    if (!query) return true;
    const blob = [
      product.title,
      product.variant,
      product.badge,
      product.category,
      product.desc,
      product.id,
      product.note
    ].join(" ");
    return normalizeSearch(blob).includes(query);
  }

  function sortedProducts(products) {
    const sortVal = document.getElementById("sortSelect")?.value || "default";
    const getPrice = (product) => {
      if (product.id === "tiktok_jeton") return 10;
      const price = minPrice(product);
      return price === Infinity || price === 0 ? 999999 : price;
    };

    return [...products].sort((a, b) => {
      const priceA = getPrice(a);
      const priceB = getPrice(b);

      if (sortVal === "price-asc") return priceA - priceB;
      if (sortVal === "price-desc") {
        if (priceA === 999999) return 1;
        if (priceB === 999999) return -1;
        return priceB - priceA;
      }
      if (sortVal === "az") return String(a.title || "").localeCompare(String(b.title || ""), "az");
      if (sortVal === "za") return String(b.title || "").localeCompare(String(a.title || ""), "az");
      return (Number(a.order ?? 9999) - Number(b.order ?? 9999));
    });
  }

  function installSearchRenderer() {
    if (!Array.isArray(DATA?.products)) return;

    renderGrid = window.renderGrid = function stockSearchAwareRenderGrid() {
      const grid = document.getElementById("grid");
      if (!grid) return;

      const rawQuery = currentSearchQuery();
      const query = normalizeSearch(rawQuery);
      syncSearchInputs(rawQuery, document.activeElement);

      const list = sortedProducts(
        DATA.products
          .filter((product) => product.active !== false)
          .filter((product) => productMatches(product, query))
      );

      if (!list.length) {
        grid.innerHTML = `<div class="mpNoSearchResult" style="grid-column:1/-1; padding:28px 18px; border:1px solid rgba(255,212,0,.18); border-radius:18px; background:rgba(255,255,255,.035); color:rgba(255,255,255,.82); text-align:center; font-weight:800;">Nəticə tapılmadı</div>`;
        return;
      }

      grid.innerHTML = list.map((product, index) => cardHTML(product, index)).join("");
    };
  }

  function installSearchInputs() {
    const bind = () => {
      searchInputs().forEach((input) => {
        if (input.dataset.mirpanelSearchBound === "1") return;
        input.dataset.mirpanelSearchBound = "1";
        input.addEventListener("input", () => {
          syncSearchInputs(input.value, input);
          if (typeof renderGrid === "function") renderGrid();
        });
        input.addEventListener("search", () => {
          syncSearchInputs(input.value, input);
          if (typeof renderGrid === "function") renderGrid();
        });
      });
    };

    bind();
    setTimeout(bind, 300);
  }

  function installCardRenderer() {
    if (typeof renderGrid !== "function") return;

    cardHTML = window.cardHTML = function stockAwareCardHTML(product, index) {
      const productSlug = String(product.seoSlug || "").replace(/^\/+|\/+$/g, "");
      const productUrl = productSlug ? `/${productSlug}/` : "#";
      return `
        <a class="card" href="${productUrl}" style="animation-delay:${Math.min(index * 0.03, 0.25)}s;text-decoration:none;color:inherit">
          <div class="imgWrap"><img class="img" src="${escapeHtml(product.image)}" alt=""><div class="cornerPrice">${priceText(product)}</div></div>
          <div class="pad">
            <div class="topline"><h3 class="title">${escapeHtml(product.title)}</h3><div class="badge">${escapeHtml(product.badge)}</div></div>
            <div class="meta">${escapeHtml(product.desc)}</div>
            ${stockBadgeHTML(product)}
            <div class="priceRow"><span class="btn primary" style="display:inline-flex;align-items:center;justify-content:center">${escapeHtml(UI?.orderBtn || "Sifariş et")}</span></div>
          </div>
        </a>
      `;
    };

    installSearchRenderer();
    installSearchInputs();
    renderGrid();
  }

  function decorateDetail(product) {
    if (!product) return;
    const imageBadge = document.querySelector(".pp-avail-badge");
    if (imageBadge) imageBadge.style.display = "none";

    document
      .querySelectorAll("#productPageView .pp-detail-stock-line, #productPageView .detailStockBadge")
      .forEach((element) => element.remove());

    const badgeData = stockBadgeData(product);
    if (!badgeData) return;

    if (badgeData.className === "out") {
      const button = document.getElementById("pp-order-btn");
      if (button) {
        button.disabled = true;
        button.textContent = "Stokda yoxdur";
        button.classList.add("disabled");
      }
    }
  }

  function installDetailDecorator() {
    if (typeof openProductPage !== "function") return;
    const originalOpenProductPage = openProductPage;

    openProductPage = window.openProductPage = function stockAwareOpenProductPage(id) {
      originalOpenProductPage(id);
      setTimeout(() => {
        const product = DATA?.products?.find((item) => item.id === id);
        decorateDetail(product);
      }, 0);
    };
  }

  installCardRenderer();
  installDetailDecorator();
})();

(function () {
  const TOAST_ID = "netflixPinToast";
  const STYLE_ID = "netflixOrderFormFixStyles";

  function injectNetflixStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #modal.netflixOrderFormOpen .modalCard {
        border-color: rgba(229, 9, 20, .74) !important;
        background: radial-gradient(circle at 50% 0%, rgba(229, 9, 20, .18), transparent 42%), linear-gradient(180deg, rgba(18, 12, 13, .98), rgba(6, 6, 7, .98)) !important;
        box-shadow: 0 26px 80px rgba(0, 0, 0, .66), 0 0 38px rgba(229, 9, 20, .22) !important;
      }

      #modal.netflixOrderFormOpen .close {
        border-color: rgba(229, 9, 20, .22) !important;
        background: rgba(10, 10, 12, .72) !important;
      }

      .netflixOrderForm.premiumOrderForm { gap: 16px !important; }

      .netflixOrderForm .mpFormTitle {
        color: #ff2330 !important;
        background: linear-gradient(135deg, #fff 0%, #ff4b55 36%, #e50914 100%) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        text-shadow: 0 0 28px rgba(229, 9, 20, .32) !important;
      }

      .netflixOrderSubtitle {
        margin: -4px 0 4px;
        color: rgba(255, 255, 255, .68);
        font-size: 13px;
        line-height: 1.5;
        text-align: center;
      }

      .netflixOrderForm .universalField span { color: rgba(255, 238, 238, .94) !important; }

      .netflixOrderForm .universalField input {
        border-color: rgba(255, 255, 255, .16) !important;
        background: rgba(7, 7, 9, .86) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .045), 0 12px 30px rgba(0, 0, 0, .26) !important;
      }

      .netflixOrderForm .universalField input:focus {
        border-color: rgba(229, 9, 20, .86) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 0 0 4px rgba(229, 9, 20, .13), 0 0 30px rgba(229, 9, 20, .20) !important;
      }

      .netflixOrderForm input[name="code_4"] {
        text-align: center;
        letter-spacing: .34em;
        font-size: 20px !important;
        font-weight: 900 !important;
      }

      .netflixOrderForm .mpBtn:not(.orderConfirmationCancel) {
        background: linear-gradient(135deg, #ff3340, #e50914 58%, #9f050d) !important;
        box-shadow: 0 14px 34px rgba(229, 9, 20, .30), inset 0 1px 0 rgba(255, 255, 255, .18) !important;
      }

      .netflixOrderForm .orderConfirmationCancel {
        background: linear-gradient(135deg, rgba(54, 57, 66, .95), rgba(21, 23, 28, .96)) !important;
      }

      @media (max-width: 600px) {
        #modal.netflixOrderFormOpen {
          align-items: flex-start !important;
          padding: calc(14px + env(safe-area-inset-top)) 0 18px !important;
        }

        #modal.netflixOrderFormOpen .modalCard {
          width: calc(100vw - 28px) !important;
          max-width: 500px !important;
          max-height: calc(100dvh - 120px) !important;
          overflow-y: auto !important;
          padding: 22px 18px 18px !important;
          border-radius: 22px !important;
          box-shadow: 0 18px 50px rgba(0, 0, 0, .64), 0 0 24px rgba(229, 9, 20, .20) !important;
        }

        #modal.netflixOrderFormOpen .close {
          top: 14px !important;
          right: 14px !important;
          padding: 9px 12px !important;
          border-radius: 12px !important;
          font-size: 13px !important;
        }

        .netflixOrderForm.premiumOrderForm {
          gap: 10px !important;
          padding: 0 !important;
        }

        .netflixOrderForm .mpFormTitle {
          max-width: calc(100% - 72px) !important;
          margin: 0 auto 4px !important;
          font-size: 28px !important;
          line-height: 1.08 !important;
          letter-spacing: 0 !important;
        }

        .netflixOrderSubtitle {
          margin: 0 0 8px !important;
          font-size: 14px !important;
          line-height: 1.35 !important;
        }

        .netflixOrderForm .premiumOrderFields {
          gap: 10px !important;
        }

        .netflixOrderForm .universalField {
          gap: 7px !important;
        }

        .netflixOrderForm .universalField span {
          font-size: 14px !important;
          line-height: 1.2 !important;
        }

        .netflixOrderForm .universalField input {
          min-height: 0 !important;
          height: 54px !important;
          padding: 0 16px !important;
          border-radius: 18px !important;
          font-size: 16px !important;
        }

        .netflixOrderForm input[name="code_4"] {
          height: 52px !important;
          font-size: 18px !important;
          letter-spacing: .26em !important;
        }

        .netflixOrderForm .orderConfirmationActions,
        .netflixOrderForm .premiumOrderActions {
          gap: 10px !important;
          margin-top: 8px !important;
        }

        .netflixOrderForm .mpBtn {
          min-height: 0 !important;
          height: 54px !important;
          padding: 0 16px !important;
          border-radius: 17px !important;
          font-size: 16px !important;
          line-height: 1 !important;
        }

        #modal.netflixOrderFormOpen .mBottom {
          margin-top: 10px !important;
          padding-top: 10px !important;
        }

        #modal.netflixOrderFormOpen .mInfo {
          font-size: 20px !important;
          line-height: 1.2 !important;
          margin: 0 !important;
        }

        #modal.netflixOrderFormOpen .mSmall {
          margin-top: 4px !important;
          font-size: 11px !important;
          line-height: 1.35 !important;
        }

        body.netflixOrderModalActive .gameFab,
        body.netflixOrderModalActive .waFab {
          opacity: 0 !important;
          pointer-events: none !important;
          transform: translateY(14px) scale(.96) !important;
        }
      }

      #${TOAST_ID} {
        position: fixed;
        top: calc(14px + env(safe-area-inset-top));
        left: 50%;
        z-index: 1000002;
        transform: translate(-50%, -16px);
        opacity: 0;
        pointer-events: none;
        max-width: min(420px, calc(100vw - 28px));
        padding: 12px 16px;
        border-radius: 999px;
        border: 1px solid rgba(229, 9, 20, .48);
        background: linear-gradient(135deg, rgba(34, 7, 9, .98), rgba(7, 7, 9, .96));
        color: #fff;
        font: 800 13px/1.2 Poppins, system-ui, sans-serif;
        text-align: center;
        box-shadow: 0 16px 44px rgba(0, 0, 0, .46), 0 0 26px rgba(229, 9, 20, .20);
        transition: opacity .2s ease, transform .2s ease;
      }

      #${TOAST_ID}.show {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    `;
    document.head.appendChild(style);
  }

  function showNetflixToast(message) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showNetflixToast.timer);
    showNetflixToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function isCode4Form(form) {
    return Boolean(form?.querySelector('input[name="code_4"]'));
  }

  function cleanCodeInput(input) {
    const clean = input.value.replace(/\D/g, "").slice(0, 4);
    if (input.value !== clean) input.value = clean;
  }

  function decorateNetflixForm(form) {
    if (!isCode4Form(form) || form.dataset.netflixDecorated === "1") return;

    document.getElementById("modal")?.classList.add("netflixOrderFormOpen");
    document.body.classList.add("netflixOrderModalActive");
    form.classList.add("netflixOrderForm");
    form.dataset.netflixDecorated = "1";

    const title = form.querySelector(".mpFormTitle");
    if (title) {
      title.textContent = "Netflix profil məlumatları";
      if (!form.querySelector(".netflixOrderSubtitle")) {
        const subtitle = document.createElement("div");
        subtitle.className = "netflixOrderSubtitle";
        subtitle.textContent = "Profil adını və 4 rəqəmli otaq PIN kodunu qeyd edin.";
        title.insertAdjacentElement("afterend", subtitle);
      }
    }

    const nameInput = form.querySelector('input[name="name"]');
    if (nameInput) {
      nameInput.placeholder = nameInput.placeholder || "Profil adını yazın";
      nameInput.autocomplete = "name";
    }

    const codeInput = form.querySelector('input[name="code_4"]');
    if (codeInput) {
      codeInput.type = "text";
      codeInput.inputMode = "numeric";
      codeInput.maxLength = 4;
      codeInput.pattern = "\\d{4}";
      codeInput.autocomplete = "off";
      codeInput.placeholder = "••••";
      codeInput.setAttribute("aria-label", "4 rəqəmli otaq PIN kodu");
      cleanCodeInput(codeInput);
    }
  }

  injectNetflixStyles();

  const observer = new MutationObserver(() => {
    document.querySelectorAll("#universalOrderForm").forEach(decorateNetflixForm);
    if (!document.querySelector('#universalOrderForm input[name="code_4"]')) {
      document.getElementById("modal")?.classList.remove("netflixOrderFormOpen");
      document.body.classList.remove("netflixOrderModalActive");
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("input", (event) => {
    const input = event.target.closest?.('#universalOrderForm input[name="code_4"]');
    if (!input) return;
    cleanCodeInput(input);
  }, true);

  document.addEventListener("paste", (event) => {
    const input = event.target.closest?.('#universalOrderForm input[name="code_4"]');
    if (!input) return;
    event.preventDefault();
    const text = event.clipboardData?.getData("text") || "";
    input.value = text.replace(/\D/g, "").slice(0, 4);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, true);

  document.addEventListener("submit", (event) => {
    const form = event.target.closest?.("#universalOrderForm");
    if (!isCode4Form(form)) return;

    const input = form.querySelector('input[name="code_4"]');
    if (!input) return;
    cleanCodeInput(input);

    if (!/^\d{4}$/.test(input.value.trim())) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showNetflixToast("Sadəcə 4 rəqəm yazmalısınız");
      input.focus();
    }
  }, true);
})();
