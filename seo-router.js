(function () {
  function products() {
    try {
      if (typeof DATA !== "undefined" && Array.isArray(DATA.products)) return DATA.products;
    } catch {}
    return [];
  }

  function productPath(product) {
    const slug = String(product?.seoSlug || "").replace(/^\/+|\/+$/g, "");
    return slug ? `/${slug}/` : "";
  }

  function productIdFromCard(card) {
    const onclick = card?.getAttribute?.("onclick") || "";
    return onclick.match(/openProductPage\('([^']+)'\)/)?.[1] || "";
  }

  function installCardNavigation() {
    document.addEventListener("click", (event) => {
      const card = event.target.closest?.(".card");
      if (!card) return;
      const product = products().find((item) => item.id === productIdFromCard(card));
      const path = productPath(product);
      if (!path) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign(path);
    }, true);
  }

  function installProductNavigation() {
    installCardNavigation();
    if (typeof window.openProductPage !== "function") return;
    const originalOpenProductPage = window.openProductPage;

    window.openProductPage = function openStandaloneProductPage(productId) {
      const product = products().find((item) => item.id === productId);
      const path = productPath(product);
      if (!path) return originalOpenProductPage(productId);
      window.location.assign(path);
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installProductNavigation, { once: true });
  } else {
    installProductNavigation();
  }
})();
