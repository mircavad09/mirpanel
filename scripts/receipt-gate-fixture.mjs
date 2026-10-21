import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
export async function receiptFixture({employeeEnabled=false}={}){
 const config={supabaseUrl:'https://test.invalid',supabaseSecretKey:'test-only',receiptsBucket:'private-test',encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64'),allowedOrigins:[],maxReceiptBytes:5*1024*1024,notificationEmail:'test@example.invalid',adminBaseUrl:'https://admin.invalid',whatsappPhone:'994515243545'};
 const security=createPaymentSecurity(config),methodId=crypto.randomUUID(),reservations=new Map(),orders=new Map(),files=new Map();
 config.employeeEnabled=employeeEnabled;
 const state={uploadCalls:0,orderCalls:0,reservationCalls:0,failures:0,failureStatus:503,delay:0,uploadKeys:[],removed:0};
 const method={id:methodId,provider_name:'ABB',display_name:'ABB',holder_name:'TEST ONLY',method_type:'bank_card',encrypted_number:security.encryptNumber('4169000000004655'),color:'#174f91',theme:'abb',last4:'4655'};
 const store={
  rateLimit:async()=>({allowed:true}),
  publicMethods:async()=>[{id:methodId,providerName:'ABB',type:'card',last4:'4655',available:true,status:'active',resolvedTheme:'abb'}],
  rawMethod:async()=>method,
  reserve:async args=>{state.reservationCalls++;const id=crypto.randomUUID(),expiresAt=new Date(Date.now()+600000).toISOString();reservations.set(id,{id,checkout_key:args.checkoutKey,product_id:args.productId,plan_id:args.planId,status:'reserved',expires_at:expiresAt,method_id:methodId});return{id,expiresAt};},
  checkoutReservation:async(id,key)=>{const r=reservations.get(id);if(!r||r.checkout_key!==key)throw Object.assign(new Error('Sessiya uyğun deyil'),{status:404});return r;},
  getOrderByReservation:async id=>orders.get(id)||null,
  uploadReceipt:async(path,receipt)=>{state.uploadCalls++;if(state.delay)await new Promise(r=>setTimeout(r,state.delay));if(state.failures){state.failures--;throw Object.assign(new Error('Test storage temporary'),{status:state.failureStatus,code:'RECEIPT_STORAGE_TEMPORARY'});}files.set(path,{...receipt,size:receipt.buffer.length});},
  verifyUploadedReceipt:async(path,size)=>{if(files.get(path)?.size!==size)throw Object.assign(new Error('Çek yoxdur'),{status:409,code:'RECEIPT_CONFIRMATION_INVALID'});},
  removeReceipt:async path=>{files.delete(path);state.removed++;},
  submitOrder:async args=>{state.orderCalls++;const existing=orders.get(args.reservationId);if(existing)return{id:existing.id,idempotent:true};const r=reservations.get(args.reservationId);if(r.status!=='reserved')throw Object.assign(new Error('Rezerv bitib'),{status:409});const o={id:crypto.randomUUID(),order_code:String(10001+orders.size),status:'reviewing',method_id:methodId,product_title:args.productTitle,plan_name:args.planName,amount:5.99,currency:'AZN',receipt_path:args.receiptPath,receipt_size:args.receiptSize,receipt_deleted_at:null};orders.set(args.reservationId,o);r.status='reviewing';return{id:o.id,idempotent:false};},
  getOrder:async id=>[...orders.values()].find(o=>o.id===id),
  createReviewToken:async()=>{},getSettings:async()=>({notificationEmail:config.notificationEmail}),enqueueEmail:async()=>{},
  cancelCustomerReservation:async(id)=>{reservations.get(id).status='cancelled';return{ok:true};}
 };
 const raw=async(req,limit)=>{const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>limit)throw Object.assign(new Error('Too large'),{status:413});chunks.push(c);}return Buffer.concat(chunks);};
 const json=(res,status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(value));};
 let api;
 const baselineJs=execFileSync('git',['show','1a999c5:payment-flow.js'],{encoding:'utf8'}),baselineCss=execFileSync('git',['show','1a999c5:payment-flow.css'],{encoding:'utf8'});
 const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://local');
  if(u.pathname==='/'){
   const origin=`http://127.0.0.1:${server.address().port}`;
   const old=u.searchParams.has('before');
   res.writeHead(200,{'Content-Type':'text/html'});return res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/payment-flow.css${old?'?before':''}"><style>body{margin:0;background:#070707;color:#fff;font-family:Arial}.modal{position:fixed;inset:0;display:grid;place-items:center;background:#000b}.modalCard{width:min(620px,calc(100vw - 28px));max-height:calc(100dvh - 20px);overflow:auto;background:#111;border-radius:16px;padding:14px}.hidden{display:none}</style></head><body><div id="modal" class="modal"><div class="modalCard"><div id="mForm"></div></div></div><script>window.MIRPANEL_PAYMENT_API='${origin}';window.__navigations=[];</script><script src="/payment-flow.js${old?'?before':''}"></script><script>MirpanelPaymentFlow.start({product:{id:'test',title:'Test məhsul'},plan:{label:'1 aylıq',price:5.99},planIndex:0}).then(o=>{window.__paymentOrder=o;if(o)window.__navigations.push(o.whatsappUrl)});</script></body></html>`);
  }
  if(['/payment-flow.js','/payment-flow.css'].includes(u.pathname)){res.writeHead(200,{'Content-Type':u.pathname.endsWith('.js')?'text/javascript':'text/css'});return res.end(u.searchParams.has('before')?(u.pathname.endsWith('.js')?baselineJs:baselineCss):fs.readFileSync('.'+u.pathname));}
  if(req.url==='/favicon.ico'){res.writeHead(204);return res.end();}
  if(u.pathname==='/api/payments/receipts'&&req.method==='POST')state.uploadKeys.push(req.headers['x-idempotency-key']);
  if(await api.handle(req,res))return;res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;config.allowedOrigins.push(origin);
 api=createPaymentSystem({config,store,mailer:{start(){},async drain(){}},json,readRawBody:raw,readBody:async(req,limit)=>JSON.parse((await raw(req,limit)).toString()||'{}'),requireAuth:()=>false,requireMutationAuth:()=>false,loadCatalog:async()=>({products:[{id:'test',title:'Test məhsul',plans:[{label:'1 aylıq',price:5.99,months:1}]}]}),actorName:'test'});
 return {server,origin,state,orders,files,reservations,security,methodId,config,json};
}
