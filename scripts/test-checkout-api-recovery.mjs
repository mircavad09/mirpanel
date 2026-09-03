import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { createPaymentSystem } from "../mirpanel-admin/payment-api.mjs";
import { createPaymentSecurity } from "../mirpanel-admin/payment-security.mjs";
import { normalizeOrderListParams } from "../mirpanel-admin/payment-order-query.mjs";

const config = {supabaseUrl:"https://fixture.invalid",supabaseSecretKey:"fixture",receiptsBucket:"private",
  encryptionKey:crypto.randomBytes(32).toString("base64"),tokenSecret:crypto.randomBytes(32).toString("base64"),
  allowedOrigins:["https://mirpanel.com"],maxReceiptBytes:5242880,notificationEmail:"fixture@example.invalid",adminBaseUrl:"https://admin.invalid"};
const security = createPaymentSecurity(config);
const method = {id:crypto.randomUUID(),provider_name:"Fixture Bank",display_name:"Fixture Bank",last4:"0000",encrypted_number:security.encryptNumber("0000000000000000"),method_type:"bank_card"};
const reservations = new Map(), orders = new Map(), files = new Set();
let next = 10001, queueCount = 0, uploadFails = false, loseRpcResponse = false;
const store = {
  rateLimit: async () => {},
  rawMethod: async () => method,
  checkoutReservation: async (id,key) => { const r=reservations.get(id); if (!r || r.checkout_key!==key) throw Object.assign(new Error("Sessiya uyğun deyil"),{status:404}); return r; },
  getOrderByReservation: async id => orders.get(id) || null,
  getOrder: async id => [...orders.values()].find(o=>o.id===id),
  uploadReceipt: async path => { if(uploadFails) throw Object.assign(new Error("Çek yüklənmədi"),{status:503}); files.add(path); },
  removeReceipt: async path => files.delete(path),
  submitOrder: async args => {
    const existing=orders.get(args.reservationId); if(existing) return {id:existing.id,idempotent:true};
    const r=reservations.get(args.reservationId);
    if(Date.parse(r.expires_at)<=Date.now()) throw Object.assign(new Error("Rezerv vaxtı bitib"),{status:409});
    const order={id:crypto.randomUUID(),order_code:String(next++),method_id:method.id,product_title:args.productTitle,
      plan_name:args.planName,amount:r.amount,currency:"AZN",status:"reviewing",receipt_path:args.receiptPath,receipt_mime:args.receiptMime,
      method_name_snapshot:method.provider_name,method_last4_snapshot:method.last4};
    orders.set(args.reservationId,order); r.status="reviewing";
    if(loseRpcResponse) {loseRpcResponse=false; throw Object.assign(new Error("Upstream response lost"),{status:500});}
    return {id:order.id,idempotent:false};
  },
  createReviewToken: async()=>{}, getSettings:async()=>({notificationEmail:"fixture@example.invalid"}),
  enqueueEmail:async()=>{queueCount++}, signedReceipt:async()=>"https://private.invalid/short-lived-fixture"
};
const raw = async req => {const parts=[];for await(const part of req)parts.push(part);return Buffer.concat(parts)};
const json = (res,status,body,headers={}) => Object.assign(res,{status,body,headers});
const system=createPaymentSystem({config,store,mailer:{drain:async()=>{}},json,readRawBody:raw,readBody:async req=>JSON.parse((await raw(req)).toString()),
  requireAuth:(req,res)=>{if(req.headers.testadmin)return true;json(res,401,{error:"unauthorized"});return false}, requireMutationAuth:()=>false,
  loadCatalog:async()=>({products:[{id:"fixture",title:"Fixture",plans:[{months:1,price:99}]}]}),actorName:"fixture"});
async function call(url,body,headers={}) {
  const request=new Request(`https://fixture.invalid${url}`,{method:"POST",body:body instanceof FormData?body:JSON.stringify(body)});
  const input=Readable.from([Buffer.from(await request.arrayBuffer())]);
  Object.assign(input,{method:"POST",url,headers:{...Object.fromEntries(request.headers),origin:"https://mirpanel.com",...headers}});
  const response={}; await system.handle(input,response); return response;
}
function reserve() {
  const r={id:crypto.randomUUID(),checkout_key:crypto.randomUUID(),method_id:method.id,product_id:"fixture",plan_id:"0",amount:5.99,currency:"AZN",status:"reserved",expires_at:new Date(Date.now()+600000).toISOString()};
  reservations.set(r.id,r);return r;
}
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=","base64");
function form(r,bytes=png,mime="image/png",key=r.checkout_key) {
  const data=new FormData(); for(const [k,v] of Object.entries({reservationId:r.id,checkoutKey:key,productId:"fixture",planIndex:"0",consentAccepted:"true"})) data.append(k,v);
  data.append("receipt",new Blob([bytes],{type:mime}),"receipt.png");return data;
}
let checks=0; const equal=(a,b)=>{assert.deepEqual(a,b);checks++};
const originalError=console.error; console.error=()=>{};
try {
  const r=reserve(), key=crypto.randomUUID();
  equal((await call("/api/payments/orders",form(r,png,"image/png",crypto.randomUUID()),{"x-idempotency-key":key})).status,404);
  equal(files.size,0);
  const results=await Promise.all(Array.from({length:8},()=>call("/api/payments/orders",form(r),{"x-idempotency-key":key})));
  equal(new Set(results.map(r=>r.body.orderCode)).size,1); equal(results[0].body.orderCode,"10001");
  equal(orders.size,1);equal(files.size,1);equal(queueCount,1);
  equal(results[0].body.amount,5.99); // reserved price, not changed catalog price 99
  equal(results[0].body.paymentMethod,"Fixture Bank •••• 0000");
  equal(JSON.stringify(results[0].body).includes("0000000000000000"),false);
  const resumed=await call("/api/payments/checkout/resume",{reservationId:r.id,checkoutKey:r.checkout_key});
  equal(resumed.body.state,"submitted");equal(resumed.body.order.orderCode,"10001");equal(resumed.headers["Cache-Control"],"no-store");
  equal(JSON.stringify(resumed.body).includes("receipt_path"),false);equal(JSON.stringify(resumed.body).includes("0000000000000000"),false);
  const lost=reserve();loseRpcResponse=true;
  const reconciled=await call("/api/payments/orders",form(lost),{"x-idempotency-key":crypto.randomUUID()});
  equal(reconciled.status,200);equal(files.has(orders.get(lost.id).receipt_path),true);
  const pending=reserve();uploadFails=true;
  equal((await call("/api/payments/orders",form(pending),{"x-idempotency-key":key})).status,503);
  equal(orders.has(pending.id),false);equal(pending.status,"reserved"); uploadFails=false;
  for(const [bytes,mime,status] of [[Buffer.alloc(5242881),"image/png",413],[Buffer.from("<html>bad</html>"),"image/png",400]]) {
    equal((await call("/api/payments/orders",form(pending,bytes,mime),{"x-idempotency-key":key})).status,status);
  }
  const mismatched=reserve();
  equal((await call("/api/payments/orders",form(mismatched,png,"image/jpeg"),{"x-idempotency-key":crypto.randomUUID()})).status,201);
  equal(orders.get(mismatched.id).receipt_mime,"image/png");
  equal((await call("/api/payments/orders",form(pending),{"x-idempotency-key":key,origin:"https://evil.invalid"})).status,403);
  const out={};await system.handle({method:"GET",url:`/api/admin/payment-orders/${results[0].body.orderId}/receipt`,headers:{}},out);equal(out.status,401);
  const allowed={};await system.handle({method:"GET",url:`/api/admin/payment-orders/${results[0].body.orderId}/receipt`,headers:{testadmin:true}},allowed);equal(allowed.status,200);equal(allowed.body.expiresIn,300);
  equal(normalizeOrderListParams({search:"10001"}).search,"10001");equal(normalizeOrderListParams({search:"MP-ABC123"}).search,"MP-ABC123");
  equal(normalizeOrderListParams({search:"971"}).search,"971");
  console.log(JSON.stringify({ok:true,checks,realApiHandler:true,isolatedStore:true,duplicateOrders:0,linkedReceiptPreserved:true,legacySearch:true,liveDataTouched:false}));
} finally {console.error=originalError;}
