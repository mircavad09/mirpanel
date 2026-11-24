const headers={
 'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
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
</style><main data-apple-payment data-epoint-payment><small>MirPanel · Epoint</small>
<h1>Balans artırma ödənişi</h1><p>Ödəniş üsulu: <strong data-payment-method>Yoxlanılır…</strong></p>
<p data-apple-amount>Məbləğ yoxlanılır…</p><p role="status" data-apple-status>Ödəniş məlumatı yüklənir…</p>
<div data-apple-widget></div><button type="button" data-apple-retry hidden>Yenidən cəhd et</button>
<a href="/balans">Geri — Balansa qayıt</a><a data-apple-result hidden>Ödənişin vəziyyəti</a><a data-apple-login hidden>Daxil ol</a>
</main><script type="module" src="/community-assets/epoint-payment.js?v=selection-1"></script></html>`;
  return new Response(request.method==='HEAD'?null:html,{headers:h});
 }
 const success=path==='/odenis/epoint/ugurlu';
 if(!success&&path!=='/odenis/epoint/ugursuz')return new Response(null,{status:404,headers});
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const page=`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ödənişin nəticəsi — MirPanel</title>
<link rel="stylesheet" href="/community-assets/shop.css?v=orders-success-shine-1">
<style>body{margin:0;background:#08090b;color:#fafafa;font:16px/1.55 system-ui,-apple-system,sans-serif}.shop-page{padding:24px 12px}.shop-result-reference{overflow-wrap:anywhere}.shop-result-badge svg{fill:none;stroke:currentColor;stroke-width:2}.shop-result button{font:inherit;min-height:44px;background:#ffda00;color:#111;border:0;border-radius:9px;padding:10px 16px}.shop-result a:not([class]){color:#ffda00}.shop-result [data-epoint-choices]{display:grid;gap:10px;margin:12px 0}[hidden]{display:none!important}</style>
<body><main class="shop-page"><section class="shop-result" data-result="reviewing" data-epoint-return>
<div class="shop-result-badge" aria-hidden="true" data-epoint-badge><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
<div class="shop-result-message" role="status" aria-live="polite"><h1>Ödənişin nəticəsi yoxlanılır…</h1><p data-epoint-message>Əməliyyatın server nəticəsi yoxlanılır. Yenidən ödəniş etməyin.</p><p class="shop-result-reference" data-epoint-reference hidden></p><p data-epoint-balance hidden></p></div>
<div data-epoint-choices></div><button type="button" data-epoint-check hidden>Vəziyyəti yoxla</button><a data-epoint-login hidden>Daxil ol</a>
<nav class="shop-result-actions" aria-label="Ödənişdən sonra keçidlər">
<a class="shop-result-action--orders" data-epoint-orders hidden><span>Sifarişlərimə bax</span></a>
<a class="shop-result-action--products" href="/mehsul" data-epoint-products hidden>Məhsullara bax</a>
<a class="shop-result-action--products" href="/profil?tab=odenislerim" data-epoint-history hidden>Ödənişlərimə bax</a>
<a class="shop-result-action--home" href="/balans" data-epoint-back hidden>Balansa qayıt</a>
<a class="shop-result-action--home" href="/">Ana səhifə</a></nav></section></main>
<script type="module" src="/community-assets/epoint-return.js?v=payment-resume-20261124"></script></body></html>`;
 return new Response(request.method==='HEAD'?null:page,{headers});
}
