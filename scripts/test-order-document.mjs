import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {shopFixture} from './shop-test-fixture.mjs';import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';
import {captureOrderConsent,currentDocumentPolicy,buildOrderDocument} from '../mirpanel-admin/order-document.mjs';import {orderDocumentPDF} from '../mirpanel-admin/order-document-pdf.mjs';
import {receiptFixture} from './receipt-gate-fixture.mjs';import {createPaymentSystem} from '../mirpanel-admin/payment-api.mjs';
import {onRequest as paymentProxy} from '../functions/api/payments/[[path]].js';
process.env.MIRPANEL_CART_V2_TEST='1';const f=await shopFixture(),{pool,shop,id,catalog}=f,out=path.resolve('../../outputs/order-document-20261126');fs.mkdirSync(out,{recursive:true});
try{
 await pool.query('update cart_v2_release set enabled=true');await pool.query("insert into wallet_accounts(user_id,cents) values('a',10000) on conflict(user_id) do update set cents=10000");
 catalog.products[0].plans[0].terms='Bu sınaq paketinin qəbul edilmiş şərtləridir. Ə, ə, Ğ, ğ, İ, ı, Ö, ö, Ş, ş, Ü, ü.';catalog.products[0].plans[0].warrantyDuration=28;catalog.products[0].plans[0].warrantyUnit='day';catalog.products[0].plans[0].warrantyMode='guaranteed';
 const owner='a'.repeat(64),policy=currentDocumentPolicy();
 const q=await shop.quote({user:'a'},[{productId:'ordinary',planIndex:0,quantity:3}],owner),item={productId:'ordinary',planIndex:0,quantity:3,termsVersion:q.items[0].termsVersion};
 const input={items:[item],mode:'wallet',requestId:id(),consentAccepted:true,documentPolicyVersion:policy.version};
 const balanceBefore=(await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents;
 await assert.rejects(()=>shop.checkout({user:'a'},owner,{...input,requestId:id(),documentPolicyVersion:'stale-policy'}),e=>e.status===409);
 assert.equal((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents,balanceBefore);
 const result=await shop.checkout({user:'a'},owner,input),replay=await shop.checkout({user:'a'},owner,input);assert.equal(result.id,replay.id);
 const order=(await pool.query('select * from public.payment_orders where id=$1',[result.orderId])).rows[0];assert(order.checkout_snapshot.orderConsent.acceptedAt);assert.equal(order.checkout_snapshot.orderConsent.items[0].quantity,3);assert.equal(order.checkout_snapshot.orderConsent.customer.email,'a***@example.test');
 const resolve=async req=>({userId:req.user,customer:{name:'Sintetik Müştəri',email:'a@example.test'},owned:async key=>(await pool.query('select o.* from public.payment_orders o join community_order_owners l on l.order_id=o.id where o.id=$1 and l.user_id=$2',[key,req.user])).rows[0]});
 const api=createAccountOrders({resolve,security:{},store:{}}),data=await api.document({user:'a'},order.id);
 assert.equal(data.totalCents,1500);assert.equal(data.paymentMethod,'MirPanel balansı');assert.equal(data.lines[0].totalCents,1500);assert(data.historyAvailable);assert(!data.lines[0].startAt);assert(!JSON.stringify(data).includes('detailsCipher'));
 assert.equal(data.lines[0].warranty,'28 gün zəmanət');
 await assert.rejects(()=>api.document({user:'b'},order.id),e=>e.status===404);await assert.rejects(()=>createAccountOrders({resolve:async()=>null}).document({},order.id),e=>e.status===401);
 const http=await receiptFixture({createSystem:opts=>{opts.config.allowedOrigins.push('https://mirpanel.com');return createPaymentSystem({...opts,requireAuth:(req,res)=>{if(req.headers['x-synthetic-role'])return true;res.writeHead(401);res.end();return false;},readyStockAllowed:req=>req.headers['x-synthetic-role']==='admin',accountHistory:async req=>{const user=req.headers['x-synthetic-user']||(/mirpanel_owner.session_token=synthetic-a/.test(req.headers.cookie||'')?'a':null);return user?resolve({user}):null;}});}});
 http.store.getOrder=async key=>(await pool.query('select * from public.payment_orders where id=$1',[key])).rows[0];
 http.config.allowedOrigins.push('https://mirpanel.com');
 try{
  const endpoint=http.origin+'/api/payments/my-orders/'+order.id+'/document';
  assert.equal((await fetch(endpoint)).status,401);assert.equal((await fetch(endpoint,{headers:{'x-synthetic-user':'b'}})).status,404);
  assert.equal((await fetch(endpoint,{headers:{'x-synthetic-user':'a','sec-fetch-site':'cross-site'}})).status,403);
  const json=await fetch(endpoint,{headers:{'x-synthetic-user':'a'}});assert.equal(json.status,200);assert.match(json.headers.get('cache-control'),/no-store/);assert.equal((await json.json()).orderId,order.id);
  const pdf=await fetch(endpoint+'.pdf',{headers:{'x-synthetic-user':'a'}});assert.equal(pdf.status,200);assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.match(pdf.headers.get('content-disposition'),new RegExp('MirPanel-sifaris-'+order.order_code));assert(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString()==='%PDF-');
  const admin=http.origin+'/api/admin/payment-orders/'+order.id+'/document.pdf';assert.equal((await fetch(admin)).status,401);assert.equal((await fetch(admin,{headers:{'x-synthetic-role':'employee'}})).status,403);assert.equal((await fetch(admin,{headers:{'x-synthetic-role':'admin'}})).status,200);
  const nativeFetch=globalThis.fetch;let proxied=0;
  try{globalThis.fetch=async(url,opts)=>{assert.equal(new URL(url).origin,'https://mirpanel-frankfurt.onrender.com');assert.equal(opts.headers.get('Authorization'),null);proxied++;return nativeFetch(http.origin+new URL(url).pathname,opts);};
   for(const suffix of ['/document','/document.pdf']){const r=await paymentProxy({request:new Request('https://mirpanel.com/api/payments/my-orders/'+order.id+suffix,{headers:{Cookie:'mirpanel_owner.session_token=synthetic-a',Authorization:'must-not-forward'}})});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);if(suffix.endsWith('pdf'))assert(Buffer.from(await r.arrayBuffer()).subarray(0,5).toString()==='%PDF-');else assert.equal((await r.json()).orderId,order.id);}
   assert.equal(proxied,2);const blocked=await paymentProxy({request:new Request('https://mirpanel.com/api/payments/my-orders/'+order.id+'/document',{method:'POST'})});assert.equal(blocked.status,404);assert.equal(proxied,2);
  }finally{globalThis.fetch=nativeFetch;}
  const unchanged=(await pool.query('select status,payment_confirmed,amount from public.payment_orders where id=$1',[order.id])).rows[0];assert.equal(unchanged.status,order.status);assert.equal(unchanged.amount,order.amount);assert.equal(unchanged.payment_confirmed,order.payment_confirmed);
 }finally{await new Promise(r=>http.server.close(r));}
 const before=JSON.stringify(data);catalog.products[0].title='Dəyişmiş ad';catalog.products[0].plans[0].price=99;catalog.products[0].plans[0].terms='Yeni qaydalar';assert.equal(JSON.stringify(await api.document({user:'a'},order.id)),before);
 const old={...order,id:id(),checkout_snapshot:{},product_title:'Köhnə sifariş',plan_name:'1 ay'};const oldDoc=buildOrderDocument(old);assert.equal(oldDoc.historyAvailable,false);assert.equal(oldDoc.acceptedAt,null);assert(!JSON.stringify(oldDoc).includes(policy.sections[0].text));
 await assert.rejects(async()=>buildOrderDocument({...old,payment_confirmed:false,status:'reviewing'}),e=>e.status===409);
 const sampleOrder={...order,created_at:'2026-11-25T19:20:01Z',order_code:'DEMO-13399',product_title:'CapCut Pro + Spotify Premium',amount:10.48,checkout_snapshot:{...order.checkout_snapshot,epointPayment:{method:'apple-pay'},orderConsent:captureOrderConsent({name:'Sınaq Müştərisi',email:'sample@example.test'},[{...q.items[0],title:'CapCut Pro',planName:'7 gün',quantity:1,unitCents:499,duration:null,durationDays:7},{...q.items[0],title:'Spotify Premium',planName:'1 ay',quantity:1,unitCents:549}],new Date('2026-11-25T19:20:00Z'))}};
 sampleOrder.checkout_snapshot.items[0].detailsCipher='NEVER-EXPORT-PASSWORD';
 const sample=buildOrderDocument(sampleOrder),bytes=await orderDocumentPDF(sample);assert(bytes.subarray(0,5).toString()==='%PDF-');fs.writeFileSync(out+'/MirPanel-sifaris-DEMO-13399.pdf',bytes);fs.writeFileSync(out+'/sample.json',JSON.stringify(sample,null,2));
 for(const status of ['reviewing','approved','completed']){const d=buildOrderDocument({...sampleOrder,status,payment_confirmed:true});assert.equal(d.number,sample.number);assert.equal(d.acceptedAt,sample.acceptedAt);}
 const long=structuredClone(sample);long.sections[1].paragraphs=Array.from({length:45},(_,i)=>'Sınaq bəndi '+(i+1)+'. '+sample.sections[1].paragraphs[0]);fs.writeFileSync(out+'/long-document.pdf',await orderDocumentPDF(long));fs.writeFileSync(out+'/legacy-document.pdf',await orderDocumentPDF(oldDoc));
 const unknownPrice=buildOrderDocument({...old,quantity:3});assert.equal(unknownPrice.lines[0].unitCents,null);
 assert(!JSON.stringify(sample).includes('NEVER-EXPORT-PASSWORD'));assert(!JSON.stringify(sample).includes('BASED'));
 console.log(JSON.stringify({snapshotSaved:true,replayPreserved:true,priceAndTermsChangesDoNotRewrite:true,unauthorizedRejected:true,paidOnly:true,multiUnit:true,multiProduct:true,legacyMissingExplicit:true,noCredentials:true,pdfBytes:bytes.length,out,realOrders:0,realPayments:0}));
}finally{await f.close();}
