const headers={
 'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
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
</main><script type="module" src="/community-assets/epoint-payment.js?v=payment-resume-20261124"></script></html>`;
  return new Response(request.method==='HEAD'?null:html,{headers:h});
 }
 const success=path==='/odenis/epoint/ugurlu';
 if(!success&&path!=='/odenis/epoint/ugursuz')return new Response(null,{status:404,headers});
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const title=success?'Ödənişin təsdiqi gözlənilir':'Epoint ödənişi üzrə geri qayıtdınız';
 const message=success?'Epoint-dən geri qayıtdınız. Ödəniş yalnız server təsdiqindən sonra qeydə alınır. Yekun vəziyyəti ödəniş tarixçənizdə yoxlayın.':'Bu keçid ödənişin yekun statusunu təsdiqləmir. Pul çıxılıbsa, yenidən ödəməzdən əvvəl ödəniş tarixçənizi yoxlayın.';
 const page='<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' — MirPanel</title><style>body{margin:0;background:#111317;color:#f5f5f5;font:16px/1.55 system-ui}main{box-sizing:border-box;width:min(90%,34rem);margin:12vh auto;padding:clamp(1rem,5vw,2rem);border:1px solid #4a4230;border-radius:16px;background:#1a1d21}small,a{color:#ffe068}h1{font-size:1.6rem}a,button{display:inline-flex;align-items:center;min-height:44px;margin:.25rem 1rem .25rem 0}button{background:#ffe068;color:#131313;border:0;border-radius:8px;padding:.4rem .7rem;font:inherit}[hidden]{display:none!important}</style><main data-epoint-return><small>MirPanel · Epoint</small><div role="status" aria-live="polite"><h1>'+title+'</h1><p data-epoint-balance hidden></p><p data-epoint-message>'+message+'</p></div><button type="button" data-epoint-check hidden>Vəziyyəti yoxla</button><a data-epoint-login hidden>Daxil ol</a><a href="/mehsul" data-epoint-products hidden>Məhsullara bax</a><a href="/profil?tab=odenislerim">Ödənişlərimə bax</a><a href="/balans" data-epoint-back>Balansa qayıt</a></main><script type="module" src="/community-assets/epoint-wallet.js?v=payment-resume-20261124"></script></html>';
 return new Response(request.method==='HEAD'?null:page,{headers});
}
