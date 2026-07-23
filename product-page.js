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

  function initializeProductPage() {
    const productId = document.body?.dataset?.productId;
    if (!productId || typeof window.openProductPage !== "function") return;
    window.openProductPage(productId);
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
    convertSimilarCardsToLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeProductPage, { once: true });
  } else {
    initializeProductPage();
  }
})();
