// Narrow public payment proxy. Never forwards admin/employee authorization.
const UPSTREAM='https://mirpanel.onrender.com';
export async function onRequest({request}){
 const u=new URL(request.url),path=u.pathname;
 const receipt=request.method==='POST'&&['/api/payments/receipts','/api/payments/orders'].includes(path),incoming=request.headers.get('X-Upload-Trace'),traceId=receipt?(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incoming||'')?incoming:crypto.randomUUID()):null;
 const allowed=/^\/api\/payments\/(?:backgrounds(?:\/(?:wallet-card))?|bank-backgrounds\/(?:kapital|m10|abb|leo)|health|methods|inventory|reservations(?:\/cancel)?|checkout\/resume|receipts(?:\/discard)?|orders|my-orders(?:\/[0-9a-f-]{36}\/receipt)?|reservations\/[0-9a-f-]{36}\/cancel|shop\/(?:quote|checkout|cancel|submit|receipt|method|wallet|topup(?:\/submit)?))$/.test(path);
 const fail=(s,e,code)=>{if(traceId)console.info('Receipt proxy',JSON.stringify({traceId,stage:'proxy',status:s,code:code||'RECEIPT_PROXY_REJECTED'}));return Response.json({error:e,...(code?{code}:{}),...(traceId?{traceId}:{})},{status:s,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Origin',...(traceId?{'X-Upload-Trace':traceId}:{})}});};
 if(!allowed||!['GET','POST','OPTIONS'].includes(request.method))return fail(404,'Tapılmadı.','PAYMENT_PROXY_ROUTE_NOT_FOUND');
 const origin=request.headers.get('Origin');if(origin&&origin!==u.origin)return fail(403,'Sorğunun mənbəyi icazəli deyil.');
 const decorative=request.method==='GET'&&/^\/api\/payments\/(?:bank-backgrounds\/(?:kapital|m10|abb|leo)|backgrounds\/(?:wallet-card))$/.test(path);
 if(request.headers.get('Sec-Fetch-Site')==='cross-site')return fail(403,'Sorğunun mənbəyi icazəli deyil.');
 const headers=new Headers();for(const name of['Content-Type','Accept','X-Idempotency-Key','Sec-Fetch-Site',...(decorative?['If-None-Match']:[])])if(request.headers.has(name))headers.set(name,request.headers.get(name));
 headers.set('Origin',u.origin);
 if(traceId)headers.set('X-Upload-Trace',traceId);
 const history=path.startsWith('/api/payments/my-orders')||path==='/api/payments/orders';
 const cookie=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('__Host-mirpanel_orders=')||/^(?:__Secure-)?mirpanel_owner\.session_token=/.test(s)).join('; ');if(cookie&&!decorative)headers.set('Cookie',cookie);
 try{const target=new URL(path+u.search,UPSTREAM),r=await fetch(target,{method:request.method,headers,body:request.method==='POST'?request.body:undefined,redirect:'manual',signal:AbortSignal.timeout(125000)}),out=new Headers(r.headers);
  const cacheImage=decorative&&[200,304].includes(r.status)&&r.headers.get('Content-Type')==='image/webp';
  if(traceId){out.set('X-Upload-Trace',traceId);console.info('Receipt proxy',JSON.stringify({traceId,stage:'upstream_response',status:r.status,code:r.ok?'RECEIPT_UPSTREAM_OK':'RECEIPT_UPSTREAM_REJECTED'}));}
  out.set('Cache-Control',cacheImage?'public, max-age=3600':'private, no-store, max-age=0');
  if(cacheImage){out.delete('Pragma');out.delete('Set-Cookie');out.delete('Vary');}else{out.set('Pragma','no-cache');out.set('Vary','Cookie, Origin');}
  out.set('Referrer-Policy','no-referrer');out.delete('Access-Control-Allow-Origin');out.delete('Access-Control-Allow-Credentials');return new Response(r.body,{status:r.status,headers:out});
 }catch{return fail(503,receipt?'Serverlə əlaqə alınmadı. Seçilmiş fayl qorunub, yenidən cəhd edin.':'Ödəniş xidməti cavab vermədi. Yenidən cəhd edin.',receipt?'RECEIPT_PROXY_UNAVAILABLE':'PAYMENT_PROXY_UNAVAILABLE');}
}
