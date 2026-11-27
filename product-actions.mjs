// Canonical public product action markup, shared by generated and edge HTML.
export const productActionsHTML=`<button class="product-page-action is-order" id="pp-order-btn" type="button" disabled>İndi al</button><button class="product-page-action is-cart cart-add-product" id="cartAddProduct" type="button" disabled><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h2l3 13h11l3-9H6 M10 21h.01 M18 21h.01"/></svg><span>Səbətə əlavə et</span></button>`;
export function stableProductActionsHTML(html){
 const sheets=['/cart-store.css?v=product-actions-20261127','/desktop-header.css?v=mobile-anthracite-20261031','/account-header.css?v=mobile-wallet-inline-3','/browser-nav.css?v=seven-chat-panel-1','/site-header-menu.css?v=dropdown-20261106'];
 if(html.includes('product-page-root'))for(const href of sheets)if(!html.includes('href="'+href+'"'))html=html.replace('</head>','<link rel="stylesheet" data-shell-persistent href="'+href+'"></head>');
 return html.replace(/(<div class="product-page-actions"[^>]*>)[\s\S]*?(<\/div>)/g,(_,open,end)=>open+productActionsHTML+end)
 .replace(/product-page\.css\?v=[^"']+/g,'product-page.css?v=stable-actions-20261127-v2')
 .replace(/i18n\.js\?v=[^"']+/g,'i18n.js?v=stable-actions-20261127')
 .replace(/stock-display-fix\.js\?v=[^"']+/g,'stock-display-fix.js?v=stable-actions-20261127')
 .replace(/product-page\.js\?v=[^"']+/g,'product-page.js?v=stable-actions-20261127')
 .replace(/order-confirmation\.js\?v=[^"']+/g,'order-confirmation.js?v=stable-actions-20261127')
 .replace(/cart-ready\.js\?v=[^"']+/g,'cart-ready.js?v=stable-actions-20261127');
}
