(function(){
  const HASH_PREFIX = '#product=';
  let opening = false;

  function products(){
    try { if (typeof DATA !== 'undefined' && Array.isArray(DATA.products)) return DATA.products; } catch {}
    return Array.isArray(window.DATA?.products) ? window.DATA.products : [];
  }

  function productById(id){ return products().find((product) => product.id === id); }
  function productIdFromHash(){
    const hash = String(window.location.hash || '');
    return hash.startsWith(HASH_PREFIX) ? decodeURIComponent(hash.slice(HASH_PREFIX.length)) : '';
  }
  function productIdFromPath(){
    try { return window.MirpanelSEO?.productIdFromPath?.(window.location.pathname) || ''; } catch { return ''; }
  }

  function showHome(){
    const productView = document.getElementById('productPageView');
    const homeView = document.getElementById('homePageView');
    const hero = document.getElementById('hero-section');
    const header = document.getElementById('mainHeader');
    if (productView) productView.style.display = 'none';
    if (homeView) homeView.style.display = 'block';
    if (hero) hero.style.display = 'block';
    if (header) header.style.display = 'block';
    window.MirpanelSEO?.applyHomeSEO?.();
  }

  function syncPath(product){
    const path = window.MirpanelSEO?.productPath?.(product);
    if (!path) return;
    if (window.location.pathname !== path || window.location.hash) {
      history.replaceState({ productId: product.id }, '', path);
    }
    window.MirpanelSEO?.applyProductSEO?.(product);
  }

  function openSeoProduct(productId, push){
    const product = productById(productId);
    if (!product || typeof window.openProductPage !== 'function') return false;
    const path = window.MirpanelSEO?.productPath?.(product);
    opening = true;
    if (push && path && window.location.pathname !== path) history.pushState({ productId }, '', path);
    const targetHash = HASH_PREFIX + encodeURIComponent(productId);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
      setTimeout(() => { syncPath(product); opening = false; }, 80);
    } else {
      window.openProductPage(productId);
      setTimeout(() => { syncPath(product); opening = false; }, 0);
    }
    return true;
  }

  function install(){
    if (!window.MirpanelSEO || typeof window.openProductPage !== 'function') return;
    const routedOpen = window.openProductPage;
    window.openProductPage = function(productId){
      if (opening) return routedOpen(productId);
      const product = productById(productId);
      if (!product) return routedOpen(productId);
      return openSeoProduct(productId, true) || routedOpen(productId);
    };

    window.addEventListener('hashchange', () => {
      const productId = productIdFromHash();
      const product = productById(productId);
      if (product) setTimeout(() => syncPath(product), 60);
    });

    window.addEventListener('popstate', () => {
      const productId = productIdFromPath() || productIdFromHash();
      if (productId) openSeoProduct(productId, false);
      else showHome();
    });

    document.getElementById('btnBackToHome')?.addEventListener('click', () => {
      history.pushState({}, '', '/');
      showHome();
    });

    document.querySelector('.brand')?.addEventListener('click', () => {
      history.pushState({}, '', '/');
      showHome();
    });

    const initial = productIdFromPath();
    if (initial) setTimeout(() => openSeoProduct(initial, false), 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
