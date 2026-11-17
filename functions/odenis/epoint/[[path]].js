const headers={
 'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
};
export function onRequest({request}){
 const path=new URL(request.url).pathname;
 const success=path==='/odenis/epoint/ugurlu';
 if(!success&&path!=='/odenis/epoint/ugursuz')return new Response(null,{status:404,headers});
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const title=success?'Ödənişin təsdiqi gözlənilir':'Ödəniş tamamlanmadı';
 const message=success?'Epoint-dən geri qayıtdınız. Ödəniş yalnız server təsdiqindən sonra qeydə alınır. Yekun vəziyyəti ödəniş tarixçənizdə yoxlayın.':'Bu keçid ödənişin yekun statusunu təsdiqləmir. Pul çıxılıbsa, yenidən ödəməzdən əvvəl ödəniş tarixçənizi yoxlayın.';
 const page='<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' — MirPanel</title><style>body{margin:0;background:#111317;color:#f5f5f5;font:16px/1.55 system-ui}main{box-sizing:border-box;width:min(90%,34rem);margin:12vh auto;padding:clamp(1rem,5vw,2rem);border:1px solid #4a4230;border-radius:16px;background:#1a1d21}small,a{color:#ffe068}h1{font-size:1.6rem}a{display:inline-block;margin:.5rem 1rem .5rem 0;padding:.4rem 0}</style><main><small>MirPanel · Epoint</small><h1>'+title+'</h1><p>'+message+'</p><a href="/profil?tab=odenislerim">Ödəniş tarixçəsi</a><a href="/balans">Balansa qayıt</a></main></html>';
 return new Response(request.method==='HEAD'?null:page,{headers});
}
