(function () {
  "use strict";

  const WEBMCP_READY_DELAY_MS = 120;
  const VALID_LANGUAGES = ["az", "en", "ru"];
  const VALID_CURRENCIES = ["AZN", "USD", "TL", "RUB", "EUR", "PKR"];

  function hasWebMcp() {
    return typeof navigator !== "undefined" &&
      "modelContext" in navigator &&
      navigator.modelContext &&
      typeof navigator.modelContext.provideContext === "function";
  }

  function safeData() {
    try {
      if (typeof DATA !== "undefined" && Array.isArray(DATA.products)) return DATA;
    } catch (_) {}
    try {
      if (window.DATA && Array.isArray(window.DATA.products)) return window.DATA;
    } catch (_) {}
    return { products: [], categories: [] };
  }

  function products() {
    return safeData().products.filter((product) => product && product.active !== false);
  }

  function normalize(value) {
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

  function planText(product) {
    return (product?.plans || []).map((plan) => [
      plan.label,
      plan.name,
      plan.title,
      plan.months,
      plan.price
    ].filter(Boolean).join(" ")).join(" ");
  }

  function searchBlob(product) {
    return [
      product?.title,
      product?.variant,
      product?.badge,
      product?.category,
      product?.desc,
      product?.id,
      planText(product)
    ].filter(Boolean).join(" ");
  }

  function minPrice(product) {
    const prices = (product?.plans || [])
      .map((plan) => Number(plan.price))
      .filter((price) => Number.isFinite(price) && price > 0);
    return prices.length ? Math.min(...prices) : null;
  }

  function stockStatus(product) {
    if (product?.soldOut === true) return "out_of_stock";
    if (product?.stockEnabled === false) return "not_shown";
    const raw = product?.stock ?? product?.stockCount ?? product?.stockQuantity;
    if (raw === null || raw === undefined || raw === "") return "not_shown";
    const stock = Number(raw);
    if (!Number.isFinite(stock)) return "not_shown";
    if (stock <= 0) return "out_of_stock";
    return `in_stock:${stock}`;
  }

  function publicProduct(product) {
    const price = minPrice(product);
    return {
      id: product.id,
      name: product.title,
      title: product.title,
      variant: product.variant || "",
      category: product.category || product.badge || "",
      badge: product.badge || "",
      price: price === null ? null : price,
      currency: product.currency || "₼",
      stockStatus: stockStatus(product),
      description: product.desc || ""
    };
  }

  function productById(productId) {
    const id = normalize(productId);
    return products().find((product) => normalize(product.id) === id || normalize(product.title) === id) || null;
  }

  function setSearchQuery(query) {
    const selectors = [
      "#q",
      "#sideMenuInput",
      ".side-search",
      ".headActions input[type='text']",
      "header input[type='text']"
    ];
    const inputs = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
      .filter((input) => input && input.tagName === "INPUT");
    inputs.forEach((input) => {
      input.value = query;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    try {
      if (typeof renderGrid === "function") renderGrid();
    } catch (_) {}
  }

  function adminContentFor(product) {
    try {
      if (typeof ADMIN_CONTENT !== "undefined") return ADMIN_CONTENT[product.id] || {};
    } catch (_) {}
    try {
      if (window.ADMIN_CONTENT) return window.ADMIN_CONTENT[product.id] || {};
    } catch (_) {}
    return {};
  }

  function productInfo(product) {
    const content = adminContentFor(product);
    return {
      ...publicProduct(product),
      plans: (product.plans || []).map((plan) => ({
        label: plan.label || plan.name || (plan.months ? `${plan.months} ay` : "Plan"),
        months: plan.months ?? null,
        price: Number.isFinite(Number(plan.price)) ? Number(plan.price) : null,
        currency: product.currency || "₼"
      })),
      aboutHtml: content.aboutHtml || product.desc || "",
      rulesHtml: content.rulesHtml || ""
    };
  }

  function updateLanguage(language) {
    const lang = VALID_LANGUAGES.includes(language) ? language : "az";
    if (typeof window.setLanguage === "function") {
      window.setLanguage(lang);
    } else {
      localStorage.setItem("mirpanel_language", lang);
      document.querySelector(`.langBtn[data-lang='${lang}']`)?.click();
    }
    document.dispatchEvent(new CustomEvent("mirpanel:language-change", { detail: { language: lang } }));
    return lang;
  }

  function updateCurrency(currency) {
    const next = VALID_CURRENCIES.includes(currency) ? currency : "AZN";
    if (typeof window.setCurrency === "function") {
      window.setCurrency(next);
    } else if (typeof window.changeCurrency === "function") {
      window.changeCurrency(next);
    } else {
      localStorage.setItem("mirpanel_currency", next);
      const select = document.querySelector("[data-currency-select], #currencySelect, select[name='currency']");
      if (select) {
        select.value = next;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      try {
        if (typeof renderGrid === "function") renderGrid();
      } catch (_) {}
    }
    document.dispatchEvent(new CustomEvent("mirpanel:currency-change", { detail: { currency: next } }));
    return next;
  }

  function scrollToPublicSection(section) {
    const sectionMap = {
      products: "#products-section",
      about: "#about, [data-section='about'], .pp-bottom-section",
      terms: "#terms, [data-section='terms']",
      contact: "#contact, [data-section='contact'], footer"
    };
    const selector = sectionMap[section];
    if (!selector) return { ok: false, error: "Unknown section" };
    const element = document.querySelector(selector);
    if (!element) return { ok: false, error: "Section not found" };
    element.scrollIntoView({ behavior: "smooth", block: "start" });
    return { ok: true, section };
  }

  function tools() {
    return [
      {
        name: "search_products",
        description: "Search public Mirpanel products by query without placing an order.",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"]
        },
        execute: async ({ query }) => {
          const q = String(query || "");
          const nq = normalize(q);
          setSearchQuery(q);
          const matches = nq
            ? products().filter((product) => normalize(searchBlob(product)).includes(nq))
            : products();
          return {
            query: q,
            count: matches.length,
            products: matches.slice(0, 20).map(publicProduct)
          };
        }
      },
      {
        name: "open_product",
        description: "Open a public Mirpanel product detail page by product id.",
        inputSchema: {
          type: "object",
          properties: { productId: { type: "string" } },
          required: ["productId"]
        },
        execute: async ({ productId }) => {
          const product = productById(productId);
          if (!product) return { ok: false, error: "Product not found" };
          if (typeof window.openProductPage === "function") window.openProductPage(product.id);
          else window.location.hash = `product=${encodeURIComponent(product.id)}`;
          return { ok: true, product: publicProduct(product) };
        }
      },
      {
        name: "get_product_info",
        description: "Return public product information, plans, stock status, about text and usage rules.",
        inputSchema: {
          type: "object",
          properties: { productId: { type: "string" } },
          required: ["productId"]
        },
        execute: async ({ productId }) => {
          const product = productById(productId);
          if (!product) return { ok: false, error: "Product not found" };
          return { ok: true, product: productInfo(product) };
        }
      },
      {
        name: "list_products",
        description: "List public Mirpanel products, optionally filtered by category.",
        inputSchema: {
          type: "object",
          properties: { category: { type: "string" } }
        },
        execute: async ({ category } = {}) => {
          const normalizedCategory = normalize(category || "");
          const list = products().filter((product) => {
            if (!normalizedCategory) return true;
            return [product.category, product.badge].some((value) => normalize(value).includes(normalizedCategory));
          });
          return { count: list.length, products: list.map(publicProduct) };
        }
      },
      {
        name: "change_language",
        description: "Change the Mirpanel UI language.",
        inputSchema: {
          type: "object",
          properties: { language: { type: "string", enum: VALID_LANGUAGES } },
          required: ["language"]
        },
        execute: async ({ language }) => ({ ok: true, language: updateLanguage(language) })
      },
      {
        name: "change_currency",
        description: "Change the Mirpanel UI currency.",
        inputSchema: {
          type: "object",
          properties: { currency: { type: "string", enum: VALID_CURRENCIES } },
          required: ["currency"]
        },
        execute: async ({ currency }) => ({ ok: true, currency: updateCurrency(currency) })
      },
      {
        name: "scroll_to_section",
        description: "Scroll to a public Mirpanel page section.",
        inputSchema: {
          type: "object",
          properties: { section: { type: "string", enum: ["products", "about", "terms", "contact"] } },
          required: ["section"]
        },
        execute: async ({ section }) => scrollToPublicSection(section)
      }
    ];
  }

  function registerWebMcp() {
    if (!hasWebMcp()) return;
    try {
      navigator.modelContext.provideContext({
        name: "Mirpanel",
        description: "Public product discovery and navigation tools for Mirpanel.",
        url: "https://mirpanel.com/",
        tools: tools()
      });
    } catch (_) {
      // WebMCP is optional. Never break the public site if a browser implementation differs.
    }
  }

  function boot() {
    setTimeout(registerWebMcp, WEBMCP_READY_DELAY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
