const headers={
 'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
};
export function onRequest({request}){
 const path=new URL(request.url).pathname;
 const success=path==='/odenis/epoint/ugurlu';
 if(!success&&path!=='/odenis/epoint/ugursuz')return new Response(null,{status:404,headers});
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const title=success?'Ödənişin təsdiqi gözlənilir':'Epoint ödənişi üzrə geri qayıtdınız';
 const message=success?'Epoint-dən geri qayıtdınız. Ödəniş yalnız server təsdiqindən sonra qeydə alınır. Yekun vəziyyəti ödəniş tarixçənizdə yoxlayın.':'Bu keçid ödənişin yekun statusunu təsdiqləmir. Pul çıxılıbsa, yenidən ödəməzdən əvvəl ödəniş tarixçənizi yoxlayın.';
 const page='<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' — MirPanel</title><style>body{margin:0;background:#111317;color:#f5f5f5;font:16px/1.55 system-ui}main{box-sizing:border-box;width:min(90%,34rem);margin:12vh auto;padding:clamp(1rem,5vw,2rem);border:1px solid #4a4230;border-radius:16px;background:#1a1d21}small,a{color:#ffe068}h1{font-size:1.6rem}a,button{display:inline-flex;align-items:center;min-height:44px;margin:.25rem 1rem .25rem 0}button{background:#ffe068;color:#131313;border:0;border-radius:8px;padding:.4rem .7rem;font:inherit}[hidden]{display:none!important}</style><main data-epoint-return><small>MirPanel · Epoint</small><div role="status" aria-live="polite"><h1>'+title+'</h1><p data-epoint-balance hidden></p><p data-epoint-message>'+message+'</p></div><button type="button" data-epoint-check hidden>Vəziyyəti yoxla</button><a data-epoint-login hidden>Daxil ol</a><a href="/mehsul" data-epoint-products hidden>Məhsullara bax</a><a href="/profil?tab=odenislerim">Ödənişlərimə bax</a><a href="/balans" data-epoint-back>Balansa qayıt</a></main><script type="module" src="/community-assets/epoint-wallet.js?v=epoint-four-1"></script></html>';
 return new Response(request.method==='HEAD'?null:page,{headers});
}
