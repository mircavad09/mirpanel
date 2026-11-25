const headers={
 'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
};
export function onRequest({request}){
 const path=new URL(request.url).pathname;
 if(['/odenis/epoint/apple-pay','/odenis/epoint/odeme'].includes(path)){
  const h={...headers,'Permissions-Policy':'payment=(self "https://epoint.az")','Content-Security-Policy':headers['Content-Security-Policy']+"; frame-src https://epoint.az https://*.epoint.az"};
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...h,Allow:'GET, HEAD'}});
  const html=`<!doctype html><html lang="az"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Balans artırma ödənişi — MirPanel</title><style>
body{margin:0;background:#08090b;color:#f5f5f5;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{box-sizing:border-box;width:min(calc(100% - 24px),38rem);margin:24px auto;padding:20px;border:1px solid #554622;border-radius:18px;background:#131518}
h1{font-size:1.4rem}strong{color:#ffda00}a{color:#ffe068}
a,button{display:inline-flex;align-items:center;min-height:44px;margin:4px 12px 4px 0}
button{background:#ffda00;color:#101010;border:0;border-radius:9px;padding:8px 14px;font:inherit}
iframe{display:block;width:100%;height:400px;border:0;border-radius:12px;max-width:100%;background:#fff}
[hidden]{display:none!important}[role=status]{overflow-wrap:anywhere}
[data-payment-mark]{display:block;width:76px;height:40px;object-fit:contain;margin:16px auto 8px;filter:invert(1)}
main[data-method="apple-pay"]{padding:20px;max-width:32rem}main[data-method="apple-pay"] h1{margin:12px 0 18px;font-size:1.35rem;line-height:1.35}
main[data-method="apple-pay"] [data-payment-info]{padding:12px 14px;background:#fff;color:#151515;border-radius:12px;font-size:14px}
main[data-method="apple-pay"] [data-payment-info] p{margin:2px 0}main[data-method="apple-pay"] iframe{height:112px;border-radius:10px}
main[data-method="apple-pay"] [data-apple-status]{text-align:center;font-size:14px;margin:10px 0 16px;color:#fff}
main[data-method="apple-pay"] [data-payment-method-row],main[data-method="apple-pay"] [data-apple-retry],main[data-method="apple-pay"] [data-apple-result]{display:none!important}
[data-payment-back]{text-decoration:none;gap:8px}[data-payment-back] svg{width:20px;height:20px}a:focus-visible,button:focus-visible{outline:2px solid #ffda00;outline-offset:4px}
@media(max-width:360px){main[data-method="apple-pay"]{padding:16px}main[data-method="apple-pay"] h1{font-size:1.2rem}}

</style><main data-apple-payment data-epoint-payment><small>MirPanel · Epoint</small>

<h1>Balans artırma ödənişi</h1><p data-payment-method-row>Ödəniş üsulu: <strong data-payment-method>Yoxlanılır…</strong></p>
<div data-payment-info><p data-apple-amount>Məbləğ yoxlanılır…</p><p data-payment-fee hidden>Əlavə komissiya: 0,00 AZN</p></div><img data-payment-mark src="/assets/wallet/methods/apple-pay-mark.svg" alt="Apple Pay" hidden>
<div data-apple-widget></div><p role="status" data-apple-status>Ödəniş məlumatı yüklənir…</p><button type="button" data-apple-retry hidden>Yenidən cəhd et</button>
<a href="/balans" data-payment-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h13"/></svg><span>Geri</span></a><a data-apple-result hidden>Ödənişin vəziyyəti</a><a data-apple-login hidden>Daxil ol</a>
</main><script type="module" src="/community-assets/epoint-payment.js?v=attempt-switch-20261126"></script></html>`;

  return new Response(request.method==='HEAD'?null:html,{headers:h});
 }
 const success=path==='/odenis/epoint/ugurlu';
 if(!success&&path!=='/odenis/epoint/ugursuz')return new Response(null,{status:404,headers});
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const icon=paths=>`<span class="checkout-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span>`;
 const page=`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ödənişin nəticəsi — MirPanel</title>
<link rel="stylesheet" href="/community-assets/shop.css?v=orders-success-shine-1">
<style>body{margin:0;background:#08090b;color:#fafafa;font:16px/1.55 system-ui,-apple-system,sans-serif}.shop-page{padding:24px 12px}.shop-result-reference{overflow-wrap:anywhere}.shop-result-badge svg{fill:none;stroke:currentColor;stroke-width:2}.shop-result button{font:inherit;min-height:44px;background:#ffda00;color:#111;border:0;border-radius:9px;padding:10px 16px}.shop-result a:not([class]){color:#ffda00}.shop-result [data-epoint-choices]{display:grid;gap:10px;margin:12px 0}[hidden]{display:none!important}</style>
<body><main class="shop-page"><section class="shop-result" data-result="reviewing" data-epoint-return>
<div class="shop-result-badge" aria-hidden="true" data-epoint-badge><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
<div class="shop-result-message" role="status" aria-live="polite"><h1>Ödənişin nəticəsi yoxlanılır…</h1><p data-epoint-message>Əməliyyatın server nəticəsi yoxlanılır. Yenidən ödəniş etməyin.</p><p class="shop-result-reference" data-epoint-reference hidden></p><p data-epoint-balance hidden></p></div>
<div data-epoint-choices></div><button type="button" data-epoint-check hidden>Vəziyyəti yoxla</button><a data-epoint-login hidden>Daxil ol</a>
<nav class="shop-result-actions" aria-label="Ödənişdən sonra keçidlər">
<a class="shop-result-action--codes shop-result-primary" data-epoint-codes hidden>${icon('<path d="M14.5 3a5.5 5.5 0 0 0-5.1 7.6L3 17v4h4v-3h3v-3l2.4-2.4A5.5 5.5 0 1 0 14.5 3Z"/><path d="M16 8h.01"/>')}<span>Kodlarım</span></a>
<a class="shop-result-action--orders shop-result-primary" data-epoint-orders hidden>${icon('<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z M3 8l9 5 9-5m-9 5v8M7.5 5.5l9 5"/>')}<span>Sifarişlərimə bax</span></a>
<a class="shop-result-action--products" href="/mehsul" data-epoint-products hidden>${icon('<path d="M5 7h14l1 14H4L5 7Z M9 7V5a3 3 0 0 1 6 0v2"/>')}<span>Məhsullara bax</span></a>
<a class="shop-result-action--products" href="/profil?tab=odenislerim" data-epoint-history hidden>Ödənişlərimə bax</a>
<a class="shop-result-action--home" href="/balans" data-epoint-back hidden>Balansa qayıt</a>
<a class="shop-result-action--home" href="/">${icon('<path d="m3 10 9-7 9 7v10H4V10 M9 21v-8h6v8"/>')}<span>Ana səhifə</span></a></nav></section></main>
<script type="module" src="/community-assets/epoint-return.js?v=attempt-switch-20261126"></script></body></html>`;
 return new Response(request.method==='HEAD'?null:page,{headers});
}
