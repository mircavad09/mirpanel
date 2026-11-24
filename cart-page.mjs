export const cartPageContent = `<main id="shopApp" class="shop-page" data-cart-page>
 <dialog open class="mir-cart-drawer" data-cart-loading aria-label="Səbət">
  <header><strong>Səbət</strong><a href="/mehsul" aria-label="Səbəti bağla">×</a></header>
  <div class="mir-cart-body"><p role="status">Səbət yüklənir…</p><a href="/sebet">Yenidən cəhd et</a></div>
  <footer><div class="mir-cart-sum"><span>Cəmi</span><strong>—</strong></div><button type="button" class="mir-cart-next" disabled>Ödənişə keç</button></footer>
 </dialog>
</main>`;
export const cartPageStyle = '<link rel="stylesheet" href="/cart-store.css?v=cart-upper-20261125">';
export const cartPageScript = '<script defer src="/cart-store.js?v=cart-upper-20261125"></script><link rel="stylesheet" href="/community-assets/shop.css?v=order-summary-1"><script type="module" src="/community-assets/shop-ui.js?v=cart-upper-20261125"></script>';
