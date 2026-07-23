Exit code: 0
Wall time: 0.4 seconds
Output:
(function () {
  function productIdFromElement(element) {
    const explicit = element?.dataset?.productId;
    if (explicit) return explicit;
    const onclick = element?.getAttribute?.("onclick") || "";
    return onclick.match(/openProductPage\('([^']+)'\)/)?.[1] || "";
  }

  function productPath(productId) {
    let products = [];
    try {
      if (typeof DATA !== "undefined" && Array.isArray(DATA.products)) products = DATA.products;
    } catch {}
    const product = products.find((item) => item.id === productId);
    const slug = String(product?.seoSlug || "").replace(/^\/+|\/+$/g, "");
    return slug ? `/${slug}/` : "/";
  }

  function rootRelativeImage(value) {
    const source = String(value || "").trim();
    if (!source) return "";
    if (/^https?:\/\//i.test(source)) {
      try {
        const url = new URL(source);
        if (url.hostname === location.hostname || url.hostname === "mirpanel.com") {
          return `${url.pathname}${url.search}`;
        }
      } catch {}
      return source;
    }
    return source.startsWith("/") ? source : `/${source.replace(/^\.?\//, "")}`;
  }

  function normalizeProductImages(product) {
    const mainImage = document.getElementById("pp-main-img");
    if (mainImage && product?.image) mainImage.src = rootRelativeImage(product.image);
    document.querySelectorAll(".product-page-root img").forEach((image) => {
      const source = image.getAttribute("src");
      if (source) image.setAttribute("src", rootRelativeImage(source));
    });
  }

  function convertSimilarCardsToLinks() {
    document.querySelectorAll("#pp-similar-list .pp-sim-card").forEach((card) => {
      if (card.tagName === "A") return;
      const productId = productIdFromElement(card);
      if (!productId) return;
      const link = document.createElement("a");
      for (const attribute of card.attributes) {
        if (attribute.name !== "onclick") link.setAttribute(attribute.name, attribute.value);
      }
      link.href = productPath(productId);
      link.innerHTML = card.innerHTML;
      card.replaceWith(link);
    });
  }

  function initializeContentTabs() {
    const tabs = [...document.querySelectorAll(".product-page-tab[data-product-tab]")];
    const panels = [...document.querySelectorAll(".product-page-panel[data-product-panel]")];
    const showPanel = (name) => {
      tabs.forEach((tab) => {
        const active = tab.dataset.productTab === name;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.productPanel !== name;
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => showPanel(tab.dataset.productTab));
    });
    showPanel("about");

    document.querySelector(".product-page-action.is-about")?.addEventListener("click", (event) => {
      event.preventDefault();
      showPanel("about");
      document.getElementById("product-about")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  function initializeProductPage() {
    const productId = document.body?.dataset?.productId;
    if (!productId || typeof window.openProductPage !== "function") return;
    const staticSimilarMarkup = document.getElementById("pp-similar-list")?.innerHTML || "";
    window.openProductPage(productId);
    const similarList = document.getElementById("pp-similar-list");
    if (similarList && staticSimilarMarkup) similarList.innerHTML = staticSimilarMarkup;
    document.querySelector("[data-static-product-plans]")?.setAttribute("hidden", "");
    document.getElementById("pp-plans-container")?.removeAttribute("hidden");
    let product = null;
    try {
      if (typeof DATA !== "undefined" && Array.isArray(DATA.products)) {
        product = DATA.products.find((item) => item.id === productId) || null;
      }
    } catch {}
    document.querySelectorAll("#pp-plans-container .pp-plan-label").forEach((row, index) => {
      const plan = product?.plans?.[index] || {};
      if (!plan.oldPrice) row.querySelector(".pp-old-price")?.remove();
      if (!plan.discount) row.querySelector(".pp-plan-disc-badge")?.remove();
    });
    normalizeProductImages(product);
    convertSimilarCardsToLinks();
    initializeContentTabs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeProductPage, { once: true });
  } else {
    initializeProductPage();
  }
})();

