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

  function decorateDetail(productId) {
    if (typeof DATA === "undefined" || !DATA?.products) return;
    const product = DATA.products.find((item) => item.id === productId);
    if (!product) return;

    const imageBadge = document.querySelector(".pp-avail-badge");
    if (imageBadge) imageBadge.style.display = "none";
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
