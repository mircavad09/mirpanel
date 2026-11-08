(function () {
  function products() {
    try {
      if (typeof DATA !== "undefined" && Array.isArray(DATA.products)) return DATA.products;
    } catch {}
    return [];
  }

  function productPath(product) {
    const slug = String(product?.seoSlug || "")
      .replace(/^\/+|\/+$/g, "")
      .replace(/-almaq$/, "")
      .replace(/(^|-)hesab0(?=-|$)/g, "$1hesab");
    return slug ? `/mehsul/${slug}` : "";
  }

  function productIdFromCard(card) {
    if (card?.dataset?.productId) return card.dataset.productId;
    const onclick = card?.getAttribute?.("onclick") || "";
    return onclick.match(/openProductPage\('([^']+)'\)/)?.[1] || "";
  }

  function installCardNavigation() {
    document.addEventListener("click", (event) => {
      if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.target.closest('a,button,input,select,textarea'))return;
      const card = event.target.closest?.(".card");
      if (!card) return;
      const product = products().find((item) => item.id === productIdFromCard(card));
      const path = productPath(product);
      if (!path) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(window.MirpanelNavigation)void window.MirpanelNavigation.go(path);
      else window.location.assign(path);
    }, true);
  }

  function installProductNavigation() {
    installCardNavigation();
    if (typeof window.openProductPage !== "function") return;
    const originalOpenProductPage = window.openProductPage;

    window.openProductPage = function openStandaloneProductPage(productId) {
      if(document.body.dataset.productId===productId&&document.querySelector('main.product-page-root'))return originalOpenProductPage(productId);
      const product = products().find((item) => item.id === productId);
      const path = productPath(product);
      if (!path) return originalOpenProductPage(productId);
      if(window.MirpanelNavigation)void window.MirpanelNavigation.go(path);
      else window.location.assign(path);
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installProductNavigation, { once: true });
  } else {
    installProductNavigation();
  }
})();
