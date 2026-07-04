(function () {
  const PRODUCT_HASH_PREFIX = "#product=";
  let lastHomeScrollY = 0;

  function productIdFromHash() {
    const hash = String(window.location.hash || "");
    if (!hash.startsWith(PRODUCT_HASH_PREFIX)) return "";
    return decodeURIComponent(hash.slice(PRODUCT_HASH_PREFIX.length));
  }

  function clearProductHash() {
    if (!window.location.hash) return;
    history.replaceState("", document.title, window.location.pathname + window.location.search);
  }

  function showHome(scrollToSaved) {
    const homeView = document.getElementById("homePageView");
    const productView = document.getElementById("productPageView");
    const heroSection = document.getElementById("hero-section");
    const header = document.getElementById("mainHeader");

    if (productView) productView.style.display = "none";
    if (homeView) homeView.style.display = "block";
    if (heroSection) heroSection.style.display = "block";
    if (header) header.style.display = "block";
    window.scrollTo(0, scrollToSaved ? lastHomeScrollY || 0 : 0);
  }

  function normaliseLegacyStockFlags() {
    if (typeof DATA === "undefined" || !DATA?.products) return;
    let changed = false;
    DATA.products.forEach((product) => {
      const rawStock = product.stock ?? product.stockCount ?? product.stockQuantity;
      if (product.id === "youtube" && rawStock !== null && rawStock !== "" && rawStock !== undefined) {
        product.stockEnabled = true;
        changed = true;
      }
    });
    if (changed && typeof renderGrid === "function") renderGrid();
  }

  function installHashRouting() {
    if (typeof window.openProductPage !== "function" || typeof DATA === "undefined" || !DATA?.products) return;
    const originalOpenProductPage = window.openProductPage;

    window.openProductPage = function routedOpenProductPage(productId) {
      const product = DATA.products.find((item) => item.id === productId);
      if (!product) {
        clearProductHash();
        showHome(false);
        return;
      }

      const targetHash = `${PRODUCT_HASH_PREFIX}${encodeURIComponent(productId)}`;
      if (window.location.hash !== targetHash) {
        lastHomeScrollY = window.scrollY || 0;
        window.location.hash = targetHash;
        return;
      }

      originalOpenProductPage(productId);
      decorateDetail(productId);
    };

    window.addEventListener("hashchange", () => {
      const productId = productIdFromHash();
      if (productId) {
        window.openProductPage(productId);
      } else {
        showHome(true);
      }
    });

    const initialProductId = productIdFromHash();
    if (initialProductId) {
      setTimeout(() => window.openProductPage(initialProductId), 0);
    }
  }

  function goHome(scrollToSaved) {
    clearProductHash();
    showHome(scrollToSaved);
  }

  function installHomeLinks() {
    document.getElementById("btnBackToHome")?.addEventListener("click", (event) => {
      event.preventDefault();
      goHome(true);
    });

    document.querySelector(".brand")?.addEventListener("click", () => {
      goHome(false);
    });

    document.querySelectorAll("#linkHome, .desktopNavLink[data-nav='home']").forEach((link) => {
      link.addEventListener("click", () => goHome(false));
    });

    document.querySelectorAll("#linkProducts, .desktopNavLink[data-nav='products']").forEach((link) => {
      link.addEventListener("click", () => clearProductHash());
    });
  }

  function installAboutButton() {
    const button = document.getElementById("pp-about-btn");
    if (!button) return;
    button.addEventListener("click", () => {
      document.querySelector(".pp-bottom-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  function adminContentFor(product) {
    if (!product) return {};
    try {
      if (typeof ADMIN_CONTENT !== "undefined") {
        return ADMIN_CONTENT[product.id] || {};
      }
    } catch {
      return {};
    }
    return {};
  }

  function infoTextFor(product) {
    if (!product) return null;
    try {
      if (typeof INFO_TEXTS !== "undefined") {
        return INFO_TEXTS[product.id] || null;
      }
    } catch {
      return null;
    }
    return null;
  }

  function fallbackAbout(product) {
    const info = infoTextFor(product);
    return (info && info.htmlContent)
      ? info.htmlContent
      : `<p>${product.desc || ""}</p><p>Sifariş etmək üçün WhatsApp-a yönləndiriləcəksiniz.</p>`;
  }

  function fallbackRules(product) {
    if (product.id === "netflix" || product.id === "hbomax") {
      return `
        <h3 style="color:#ffd400; margin-top:0;">Mirpanel: ${product.title} Qaydaları</h3>
        <ul style="list-style-type: none; padding-left:0; margin-bottom:15px; line-height: 1.6;">
          <li>✅ Otaq yalnız sizə aiddir.</li>
          <li>✅ Otaq Adını və PIN-i dəyişə bilərsiniz.</li>
          <li>🆘 Eyni anda bir neçə cihazdan istifadə etməyin.</li>
        </ul>
      `;
    }

    return `
      <h3 style="color:#ffd400;margin-top:0;">İstifadə Qaydaları və Şərtlər</h3>
      <p>1. Bütün hesablar rəsmi və qanuni yollarla aktivləşdirilir.</p>
      <p>2. Sifariş verdikdən sonra məlumatlar WhatsApp vasitəsilə sizə təqdim olunacaq.</p>
    `;
  }

  function renderContentTab(product, tabName) {
    const contentBox = document.getElementById("pp-content-box");
    if (!contentBox || !product) return;

    document.querySelectorAll(".pp-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.target === tabName);
    });

    const adminContent = adminContentFor(product);
    if (tabName === "tab-rules") {
      contentBox.innerHTML = adminContent.rulesHtml || fallbackRules(product);
      return;
    }

    contentBox.innerHTML = adminContent.aboutHtml || fallbackAbout(product);
  }

  function installContentTabs(product) {
    const tabs = document.querySelectorAll(".pp-tab");
    if (!tabs.length || !product) return;

    tabs.forEach((tab) => {
      tab.onclick = () => renderContentTab(product, tab.dataset.target || "tab-about");
    });

    const active = document.querySelector(".pp-tab.active");
    renderContentTab(product, active?.dataset.target || "tab-about");
  }

  function decorateDetail(productId) {
    if (typeof DATA === "undefined" || !DATA?.products) return;
    const product = DATA.products.find((item) => item.id === productId);
    if (!product) return;

    const imageBadge = document.querySelector(".pp-avail-badge");
    if (imageBadge) imageBadge.style.display = "none";

    installContentTabs(product);
  }

  function boot() {
    normaliseLegacyStockFlags();
    installHashRouting();
    installHomeLinks();
    installAboutButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

(function () {
  const STORAGE_KEY = "mirpanel_currency";
  const STYLE_ID = "mirpanelCurrencyStyles";
  const CURRENCIES = ["AZN", "USD", "TL", "RUB", "EUR", "PKR"];
  const CURRENCY_RATES = { AZN: 1, USD: 0.59, TL: 24, RUB: 46.5, EUR: 0.54, PKR: 166 };
  const CURRENCY_SYMBOLS = {
    AZN: "\u20bc",
    USD: "$",
    TL: "\u20ba",
    RUB: "\u20bd",
    EUR: "\u20ac",
    PKR: "\u20a8"
  };

  function currentCurrency() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return CURRENCIES.includes(saved) ? saved : "AZN";
  }

  function currentLanguage() {
    if (typeof window.getLanguage === "function") return window.getLanguage();
    return localStorage.getItem("mirpanel_language") || "az";
  }

  function currencyLabel() {
    return ({ az: "Valyuta", en: "Currency", ru: "\u0412\u0430\u043b\u044e\u0442\u0430" })[currentLanguage()] || "Valyuta";
  }

  function convertAmount(amountAZN, currency = currentCurrency()) {
    const amount = Number(amountAZN);
    return (Number.isFinite(amount) ? amount : 0) * (CURRENCY_RATES[currency] || 1);
  }

  function formatConverted(amountAZN, currency = currentCurrency()) {
    const value = convertAmount(amountAZN, currency).toFixed(2);
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    return currency === "AZN" ? `${value} ${symbol}` : `${symbol}${value}`;
  }

  function setText(element, value) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  function setValue(element, value) {
    if (element && element.value !== value) element.value = value;
  }

  function products() {
    if (Array.isArray(window.DATA?.products)) return window.DATA.products;
    try {
      if (typeof DATA !== "undefined" && Array.isArray(DATA.products)) return DATA.products;
    } catch {
      return [];
    }
    return [];
  }

  function productById(id) {
    return products().find((product) => product.id === id);
  }

  function minPrice(product) {
    if (!product) return null;
    if (product.id === "tiktok_jeton") return 10;
    const prices = (product.plans || [])
      .map((plan) => Number(plan.price))
      .filter((price) => Number.isFinite(price) && price > 0);
    return prices.length ? Math.min(...prices) : null;
  }

  function currentProductSafe() {
    try {
      if (typeof currentProduct !== "undefined" && currentProduct) return currentProduct;
    } catch {
      return null;
    }
    return window.currentProduct || null;
  }

  function currentPlanIndexSafe() {
    try {
      if (typeof currentPlanIdx !== "undefined") return Number(currentPlanIdx) || 0;
    } catch {
      return 0;
    }
    return 0;
  }

  function selectedPlan(product = currentProductSafe()) {
    if (!product) return null;
    return product.plans?.[currentPlanIndexSafe()] || product.plans?.[0] || null;
  }

  function productIdFromElement(element) {
    const explicit = element?.dataset?.productId;
    if (explicit) return explicit;
    const onclick = element?.getAttribute?.("onclick") || "";
    return onclick.match(/openProductPage\('([^']+)'\)/)?.[1] || "";
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .currencySwitch{position:relative;display:inline-flex;align-items:center;gap:5px;margin-top:5px;font:800 10px/1 Poppins,system-ui,sans-serif}
      .currencyLabel{color:rgba(255,255,255,.56);white-space:nowrap}
      .currencyButton{height:24px;min-width:60px;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:0 9px;border:1px solid rgba(255,212,0,.72);border-radius:999px;background:linear-gradient(180deg,rgba(255,212,0,.13),rgba(255,255,255,.035));color:#ffd400;box-shadow:0 0 0 1px rgba(255,212,0,.1),0 0 15px rgba(255,212,0,.16);font:900 10px/1 Poppins,system-ui,sans-serif;cursor:pointer}
      .currencyChevron{font-size:9px;color:rgba(255,255,255,.72)}
      .currencyMenu{position:absolute;left:0;top:calc(100% + 6px);z-index:99999;min-width:116px;display:none;padding:6px;border:1px solid rgba(255,212,0,.24);border-radius:14px;background:linear-gradient(180deg,rgba(14,16,22,.98),rgba(3,4,7,.98));box-shadow:0 18px 42px rgba(0,0,0,.46),0 0 20px rgba(255,212,0,.12)}
      .currencySwitch.open .currencyMenu{display:grid;gap:4px}
      .currencyOption{width:100%;height:28px;border:1px solid transparent;border-radius:10px;background:transparent;color:rgba(255,255,255,.78);font:900 11px/1 Poppins,system-ui,sans-serif;cursor:pointer;text-align:left;padding:0 9px}
      .currencyOption:hover,.currencyOption.active{color:#ffd400;border-color:rgba(255,212,0,.38);background:rgba(255,212,0,.08)}
      @media(max-width:850px){.currencySwitch{margin-top:4px;gap:4px;font-size:9px}.currencyButton{min-width:55px;height:21px;padding:0 7px;font-size:9px}.currencyMenu{min-width:104px;top:calc(100% + 5px)}.currencyOption{height:26px;font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function ensureSwitcher() {
    const host = document.querySelector(".brandTxt");
    if (!host || document.getElementById("currencySwitch")) return;
    const switcher = document.createElement("div");
    switcher.id = "currencySwitch";
    switcher.className = "currencySwitch";
    switcher.innerHTML = `
      <span class="currencyLabel"></span>
      <button class="currencyButton" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span class="currencyCurrent"></span><span class="currencyChevron">\u25be</span>
      </button>
      <div class="currencyMenu" role="listbox">
        ${CURRENCIES.map((code) => `<button class="currencyOption" type="button" data-currency="${code}" role="option">${code}</button>`).join("")}
      </div>
    `;
    host.appendChild(switcher);

    const button = switcher.querySelector(".currencyButton");
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = !switcher.classList.contains("open");
      switcher.classList.toggle("open", open);
      button.setAttribute("aria-expanded", String(open));
    });

    switcher.querySelectorAll(".currencyOption").forEach((option) => {
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        setCurrency(option.dataset.currency);
        switcher.classList.remove("open");
        button.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest("#currencySwitch")) {
        switcher.classList.remove("open");
        button.setAttribute("aria-expanded", "false");
      }
    });
  }

  function updateSwitcher() {
    const switcher = document.getElementById("currencySwitch");
    if (!switcher) return;
    setText(switcher.querySelector(".currencyLabel"), `${currencyLabel()}:`);
    setText(switcher.querySelector(".currencyCurrent"), currentCurrency());
    switcher.querySelectorAll(".currencyOption").forEach((button) => {
      const active = button.dataset.currency === currentCurrency();
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  function updateCards() {
    document.querySelectorAll(".card").forEach((card) => {
      const product = productById(productIdFromElement(card));
      const price = minPrice(product);
      const target = card.querySelector(".cornerPrice");
      if (target && price !== null) setText(target, formatConverted(price));
    });
  }

  function updatePlans() {
    const product = currentProductSafe();
    if (!product) return;
    document.querySelectorAll("#pp-plans-container .pp-plan-label").forEach((row, index) => {
      const plan = product.plans?.[index];
      if (!plan) return;
      const price = Number(plan.price);
      const oldPrice = Number(plan.oldPrice || (price * 1.5 + 2));
      const oldTarget = row.querySelector(".pp-old-price");
      const newTarget = row.querySelector(".pp-new-price");
      if (oldTarget && Number.isFinite(oldPrice) && price > 0) setText(oldTarget, formatConverted(oldPrice));
      if (newTarget && Number.isFinite(price) && price > 0) setText(newTarget, formatConverted(price));
    });
  }

  function updateSimilar() {
    document.querySelectorAll(".pp-sim-card").forEach((card) => {
      const product = productById(productIdFromElement(card));
      const price = minPrice(product);
      const target = card.querySelector(".pp-sim-price");
      if (target && price !== null) setText(target, formatConverted(price));
    });
  }

  function updateSearchSuggestions() {
    document.querySelectorAll(".mirpanelSuggestItem").forEach((item) => {
      const product = productById(item.dataset.productId);
      const price = minPrice(product);
      const target = item.querySelector(".mirpanelSuggestPrice");
      if (target && price !== null) setText(target, formatConverted(price));
    });
  }

  function updateModalPrice() {
    const product = currentProductSafe();
    const plan = selectedPlan(product);
    if (!product || !plan) return;
    const price = Number(plan.price);
    if (!Number.isFinite(price) || price <= 0) return;
    const planText = plan.label || (plan.months ? `${plan.months} aylıq` : "");
    const text = planText ? `${planText} / ${formatConverted(price)}` : formatConverted(price);
    const info = document.getElementById("mInfo");
    if (info && document.getElementById("modal")?.classList.contains("show")) setText(info, text);

    const tiktokPrice = document.getElementById("tt_price");
    const coins = Number(document.getElementById("tt_coin")?.value || 0);
    if (tiktokPrice && coins >= 500) setValue(tiktokPrice, formatConverted((coins / 500) * 10));
  }

  function updatePrices() {
    updateSwitcher();
    updateCards();
    updatePlans();
    updateSimilar();
    updateSearchSuggestions();
    updateModalPrice();
  }

  function rerenderKnownViews() {
    try {
      if (typeof window.renderGrid === "function") window.renderGrid();
    } catch {}

    try {
      const product = currentProductSafe();
      if (product && document.getElementById("productPageView")?.style.display !== "none") {
        if (typeof renderProductPlans === "function") renderProductPlans(product);
        if (typeof renderSimilarProducts === "function") renderSimilarProducts(product);
      }
    } catch {}
  }

  function setCurrency(currency) {
    const next = CURRENCIES.includes(currency) ? currency : "AZN";
    localStorage.setItem(STORAGE_KEY, next);
    rerenderKnownViews();
    setTimeout(updatePrices, 0);
    setTimeout(updatePrices, 80);
  }

  function patchWhatsAppOpen() {
    if (window.__mirpanelCurrencyOpenPatched) return;
    window.__mirpanelCurrencyOpenPatched = true;
    const originalOpen = window.open.bind(window);
    window.open = function patchedOpen(url, target, features) {
      let nextUrl = String(url || "");
      if (/wa\.me|whatsapp/i.test(nextUrl) && nextUrl.includes("text=")) {
        try {
          const parsed = new URL(nextUrl, window.location.href);
          const text = parsed.searchParams.get("text") || "";
          const product = currentProductSafe();
          const plan = selectedPlan(product);
          const price = Number(plan?.price);
          if (Number.isFinite(price) && price > 0) {
            const convertedLine = `Qiym\u0259t: ${formatConverted(price)}`;
            const nextText = text.match(/^Qiym.t:/m)
              ? text.replace(/^Qiym.t:.*$/m, convertedLine)
              : `${text}\n${convertedLine}`;
            parsed.searchParams.set("text", nextText);
            nextUrl = parsed.toString();
          }
        } catch {}
      }
      return originalOpen(nextUrl, target, features);
    };
  }

  let pending = 0;
  function scheduleUpdate() {
    clearTimeout(pending);
    pending = setTimeout(updatePrices, 50);
  }

  function boot() {
    injectStyles();
    ensureSwitcher();
    patchWhatsAppOpen();
    updatePrices();

    document.addEventListener("click", (event) => {
      if (event.target.closest(".langBtn")) setTimeout(updateSwitcher, 80);
    }, true);
    document.addEventListener("input", (event) => {
      if (event.target?.id === "tt_coin") setTimeout(updateModalPrice, 0);
    }, true);

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.MIRPANEL_CURRENCIES = { CURRENCY_RATES, CURRENCY_SYMBOLS };
  window.mirpanelFormatPrice = formatConverted;
  window.mirpanelSetCurrency = setCurrency;
  window.mirpanelGetCurrency = currentCurrency;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
