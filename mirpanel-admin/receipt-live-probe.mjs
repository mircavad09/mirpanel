// Disabled by default. Synthetic DB gateway + isolated Storage namespace only.
// Never supplies a production database client, catalog, mailer, stock or account.
import {randomUUID} from 'node:crypto';
import {createPaymentSystem} from './payment-api.mjs';
import {createPaymentStore} from './payment-store.mjs';
import {createPaymentSecurity} from './payment-security.mjs';
import {createBrowserOrders} from './browser-orders.mjs';
export function createReceiptLiveProbe({config,env=process.env,json,readBody,readRawBody,requireMutationAuth,getSession}){
 const name='__Host-mirpanel_receipt_probe',gateway=env.RECEIPT_PROBE_GATEWAY||'',secret=env.RECEIPT_PROBE_KEY||'',until=Date.parse(env.RECEIPT_PROBE_UNTIL||'');
 const enabled=()=>/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(gateway)&&secret.length>=40&&Number.isFinite(until)&&until>Date.now()&&until<Date.now()+2*3600000;
 let security;try{security=createPaymentSecurity(config);}catch{return{async handle(req,res){if(req.url.startsWith('/api/payments/diagnostics/')||req.url==='/api/admin/receipt-probe'){json(res,503,{code:'PROBE_DISABLED'});return true;}return false;}};}
 const contexts=new Map(),redeemed=new Map();
 const error=(s,c)=>Object.assign(Error('Qapalı çek sınağı əlçatan deyil.'),{status:s,code:c});
 async function call(op,args=[]){const r=await fetch(gateway+'/rpc',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify({op,args}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw error(503,'PROBE_DATABASE_UNAVAILABLE');return (await r.json()).value;}
 function session(req){const c=String(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));if(c.length!==1)throw error(403,'PROBE_SESSION_REQUIRED');let p;try{p=JSON.parse(security.decryptSecret(c[0].slice(name.length+1)));}catch{throw error(403,'PROBE_SESSION_INVALID');}if(p.purpose!=='receipt-probe-session'||!/^\w{8}-[\w-]{27}$/.test(p.run||'')||p.expires<Date.now())throw error(403,'PROBE_SESSION_INVALID');return p;}
 function context(run){if(contexts.has(run))return contexts.get(run);
  const pc={...config,employeeEnabled:false,inventoryEnabled:false,browserOrdersEnabled:true,receiptShapeEnabled:false,receiptValidationEnabled:false,notificationEmail:'',whatsappPhone:'994000000000'};
  // Storage uses the exact deployed production adapter and bucket, but every
  // object path is forced below a disjoint diagnostics/run UUID prefix.
  const media=createPaymentStore(pc),prefix='diagnostics/'+run+'/';
  const checked=p=>{if(!/^pending\/[0-9a-f-]{36}\/[0-9a-f]{64}\.(jpg|png|pdf)$/.test(p))throw error(400,'PROBE_PATH_INVALID');return prefix+p;};
  const store={
   rateLimit:async()=>({allowed:true}),inventorySnapshot:async()=>[],
   publicMethods:()=>call('publicMethods'),rawMethod:async id=>({...await call('rawMethod',[id]),encrypted_number:security.encryptNumber('4169000000000000')}),
   reserve:a=>call('reserve',[a]),checkoutReservation:(id,key)=>call('reservation',[id,key]),getOrderByReservation:id=>call('orderByReservation',[id]),getOrder:id=>call('order',[id]),submitOrder:a=>call('submit',[a]),
   browserOrdersReady:()=>call('ready'),browserOrderPage:(h,t,id)=>call('page',[h,t,id]),browserOwnedOrder:(h,id)=>call('owned',[h,id]),
   uploadReceipt:(p,r)=>media.uploadReceipt(checked(p),r),verifyUploadedReceipt:(p,s)=>media.verifyUploadedReceipt(checked(p),s),removeReceipt:p=>media.removeReceipt(checked(p)),
   getSettings:async()=>({notificationEmail:'synthetic@example.invalid'}),createReviewToken:async()=>{},enqueueEmail:async()=>{},
  };
  const owners=createBrowserOrders({security,store,enabled:true});
  const api=createPaymentSystem({config:pc,store,json,readBody,readRawBody,requireAuth:()=>false,requireMutationAuth:()=>false,actorName:'synthetic-probe',mailer:{start(){},async drain(){}},loadCatalog:async()=>({products:[{id:'receipt-live-synthetic',title:'İzolyasiya edilmiş çek sınağı',active:true,plans:[{label:'Sintetik plan',price:5.99,months:1}]}]}),accountHistory:async req=>({userId:run,page:(t,id)=>store.browserOrderPage(owners.read(req),t,id),owned:id=>store.browserOwnedOrder(owners.read(req),id)})});
  const ctx={api,store,checked,media};contexts.set(run,ctx);return ctx;
 }
 return {async handle(req,res){const p=new URL(req.url,'http://local').pathname,isProbe=p.startsWith('/api/payments/diagnostics/'),hasCookie=String(req.headers.cookie||'').split(';').some(s=>s.trim().startsWith(name+'='));
  if(p!=='/api/admin/receipt-probe'&&!isProbe&&!(hasCookie&&p.startsWith('/api/payments/')))return false;
  try{
   if(!enabled())throw error(503,'PROBE_DISABLED');
   if(p==='/api/admin/receipt-probe'){
    if(req.method!=='POST')throw error(405,'PROBE_METHOD');if(!requireMutationAuth(req,res))return true;if(getSession(req)?.role!=='admin')throw error(403,'PROBE_ADMIN_REQUIRED');
    const meta=await call('meta');const run=meta.run;const expires=Math.min(until,Date.now()+20*60000);const ticket=security.encryptSecret(JSON.stringify({purpose:'receipt-probe-ticket',run,expires,nonce:randomUUID()}));json(res,200,{ticket,expires});return true;
   }
   if(p==='/api/payments/diagnostics/start'){
    if(req.method!=='POST'||!config.allowedOrigins.includes(String(req.headers.origin||'')))throw error(403,'PROBE_ORIGIN');const b=await readBody(req,4096);let t;try{t=JSON.parse(security.decryptSecret(b.ticket));}catch{throw error(403,'PROBE_TICKET');}if(t.purpose!=='receipt-probe-ticket'||t.expires<Date.now()||t.expires>until)throw error(403,'PROBE_TICKET');
    for(const[n,e]of redeemed)if(e<Date.now())redeemed.delete(n);if(redeemed.has(t.nonce))throw error(403,'PROBE_TICKET_USED');redeemed.set(t.nonce,t.expires);
    // A short-lived separate test session is not a customer/admin login.
    const token=security.encryptSecret(JSON.stringify({purpose:'receipt-probe-session',run:t.run,expires:t.expires}));res.setHeader('Set-Cookie',`${name}=${token}; Path=/; Max-Age=${Math.floor((t.expires-Date.now())/1000)}; Secure; HttpOnly; SameSite=Strict`);json(res,200,{ok:true,synthetic:true});return true;
   }
   const s=session(req);const ctx=context(s.run);
   if(p==='/api/payments/diagnostics/fault'&&req.method==='POST'){
    if(!config.allowedOrigins.includes(String(req.headers.origin||'')))throw error(403,'PROBE_ORIGIN');const b=await readBody(req,4096);
    if(b.mode==='expire_reservation'){await call('expire',[b.reservationId]);}
    else if(b.mode==='expire_session'){const token=security.encryptSecret(JSON.stringify({...s,expires:Date.now()-1000}));res.setHeader('Set-Cookie',`${name}=${token}; Path=/; Max-Age=600; Secure; HttpOnly; SameSite=Strict`);}
    else if(['drop_receipt_response','drop_order_response','delay_reply','clear'].includes(b.mode)){ctx.fault=b.mode==='clear'?null:b.mode;}
    else throw error(400,'PROBE_FAULT');json(res,200,{ok:true});return true;
   }
   if(p==='/api/payments/diagnostics/view'&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'",'X-Robots-Tag':'noindex,nofollow'});
    res.end(`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/payment-flow.css"><body style="background:#111;color:white;font:16px system-ui"><h1>Qapalı sintetik çek sınağı</h1><p>Real sifariş, stok, balans və bildiriş yaratmır.</p><script src="/payment-flow.js"></script><script>window.__probeOrder=null;MirpanelPaymentFlow.start({product:{id:'receipt-live-synthetic',title:'Sintetik sınaq'},plan:{label:'Sintetik plan',price:5.99},planIndex:0}).then(o=>{window.__probeOrder=o;});</script></body></html>`);return true;
   }
   if(p==='/api/payments/diagnostics/evidence'&&req.method==='GET'){
    const owners=createBrowserOrders({security,store:ctx.store,enabled:true}),hash=owners.read(req),orders=hash?await ctx.store.browserOrderPage(hash,null,null):[],evidence=[];
    for(const o of orders){await ctx.store.verifyUploadedReceipt(o.receipt_path,o.receipt_size);const file=await ctx.media.client.storage.from(config.receiptsBucket).download(ctx.checked(o.receipt_path));if(file.error)throw error(503,'PROBE_READBACK_FAILED');const bytes=Buffer.from(await file.data.arrayBuffer());const{createHash}=await import('node:crypto');evidence.push({id:o.id,status:o.status,size:bytes.length,hashMatches:createHash('sha256').update(bytes).digest('hex')===o.receipt_sha256});}
    json(res,200,{synthetic:true,orders:evidence,notifications:0,productionStockUsed:false});return true;
   }
   if(isProbe)throw error(404,'PROBE_ROUTE');
   if(ctx.fault==='delay_reply')await new Promise(r=>setTimeout(r,2000));
   if((ctx.fault==='drop_receipt_response'&&p==='/api/payments/receipts'||ctx.fault==='drop_order_response'&&p==='/api/payments/orders')&&req.method==='POST'){
    const end=res.end.bind(res);res.end=(...args)=>{if(res.statusCode>=200&&res.statusCode<300){ctx.fault=null;res.destroy();return res;}return end(...args);};
   }
   return await ctx.api.handle(req,res);
  }catch(e){json(res,Number(e.status)||503,{error:'Qapalı çek sınağı əlçatan deyil.',code:/^[A-Z_]+$/.test(e.code||'')?e.code:'PROBE_UNAVAILABLE'});return true;}
 }};
}
