import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import { createPaymentStore } from "../mirpanel-admin/payment-store.mjs";
import { extractAdminState } from "../mirpanel-admin/core.mjs";

const catalog=extractAdminState(fs.readFileSync("app.js","utf8")).products;
const day=new Date().toISOString();
const row=(n,product_id,product_title,status="reviewing",items)=>({
  id:`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`,order_code:String(n),product_id,product_title,status,
  created_at:day,completed_at:status==="reviewing"?null:day,amount:5,plan_name:"1 aylıq",currency:"AZN",
  cost_price_snapshot:null,profit_snapshot:null,sale_price_snapshot:null,
  checkout_snapshot:items?{cartVersion:2,items}:null
});
const cart=(n,status)=>row(n,"__cart__","Səbət",status,[
  {productId:"netflix",title:"Netflix Şəxsi"},{productId:"spotify",title:"Spotify Premium"},
  {productId:"netflix",title:"Netflix Şəxsi",detailsCipher:"fixture-private"}
]);
const records=[
  row(1,"netflix","Netflix Şəxsi"),row(2,"unknown-old-id","Netflix Şəxsi hesab"),
  row(3,"netflix_sexsi","Netflix Şəxsi (Yeniləmək)"),row(4,"adobe-creative-cloud","Adobe CC"),
  cart(5,"reviewing"),cart(6,"approved"),row(7,"spotify","Spotify Premium","completed"),
  ...Array.from({length:22},(_,i)=>row(20+i,"netflix","Netflix Şəxsi")),
  ...Array.from({length:1030},(_,i)=>row(100+i,"capcut","CapCut Pro"))
];
let maxOffset=0;
const fixture=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://fixture"), q=u.searchParams;
  let data=[],total=0;
  if(u.pathname.endsWith("/payment_orders")) {
    assert.equal(q.has("product_id"),false,"cart orders cannot be found using parent ID equality");
    data=records.filter(r=>{
      if(q.get("status")&&!q.get("status").slice(4,-1).split(",").includes(r.status))return false;
      if(q.get("payment_source")==="eq.card"&&r.payment_source==="wallet")return false;
      if(q.get("payment_confirmed")==="not.is.true"&&r.payment_confirmed===true)return false;
      if(q.has("or")&&!["approved","completed"].includes(r.status)&&r.payment_confirmed!==true)return false;
      if(q.get("id")&&!q.get("id").slice(4,-1).split(",").includes(r.id))return false;
      if(q.get("order_code")&&!r.order_code.includes(q.get("order_code").slice(7,-1)))return false;
      if(q.has("completed_at")&&!r.completed_at)return false;
      return true;
    }).sort((a,b)=>q.get("order")?.includes("id.asc")?Number(a.order_code)-Number(b.order_code):Number(b.order_code)-Number(a.order_code));
    total=data.length;const offset=Number(q.get("offset")||0);maxOffset=Math.max(maxOffset,offset);
    data=data.slice(offset,offset+Number(q.get("limit")||1000));
    if(q.get("select")?.includes("cart_items:")) data=data.map(r=>({...r,cart_items:r.checkout_snapshot?.items}));
  } else if(u.pathname.endsWith("archive_due_payment_monthly_reports")) data=null;
  else if(u.pathname.endsWith("payment_order_profit_statistics_v2")) data={count:0};
  res.writeHead(200,{"content-type":"application/json","content-range":`0-${Math.max(data?.length-1,0)}/${total}`});
  res.end(JSON.stringify(data));
});
await new Promise(resolve=>fixture.listen(0,"127.0.0.1",resolve));
try {
  const store=createPaymentStore({supabaseUrl:`http://127.0.0.1:${fixture.address().port}`,supabaseSecretKey:"fixture"});
  const list=(productId,tab="pending",extra={})=>store.listOrders({productId,tab,period:"all",...extra},catalog);
  const first=await list("netflix"), second=await list("netflix","pending",{page:"2"});
  assert.equal(first.pagination.total,25);
  assert.deepEqual([...first.orders,...second.orders].filter(o=>o.orderCode==="5").map(o=>o.orderCode),["5"]);
  assert.ok(second.orders.some(o=>o.orderCode==="2"));assert.ok(second.orders.some(o=>o.orderCode==="1"));
  assert.ok(!JSON.stringify(second).includes("fixture-private"));
  assert.deepEqual((await list("adobecc")).orders.map(o=>o.orderCode),["4"]);
  assert.deepEqual((await list("spotify")).orders.map(o=>o.orderCode),["5"]);
  assert.deepEqual((await list("netflix_sexsi")).orders.map(o=>o.orderCode),["3"]);
  for(const tab of ["today","all"]){
    assert.deepEqual((await list("netflix",tab)).orders.map(o=>o.orderCode),["6"]);
    assert.deepEqual((await list("spotify",tab)).orders.map(o=>o.orderCode),["7","6"]);
  }
  assert.deepEqual((await list("netflix","pending",{search:"5"})).orders.map(o=>o.orderCode),["35","25","5"]);
  assert.equal((await list("zoom")).pagination.total,0);
  assert.equal((await list("")).pagination.total,1057);
  assert.ok(maxOffset>=1000);
  records.push(...Array.from({length:24},(_,i)=>({...cart(3000+i,"approved"),payment_source:i%2?"wallet":"card",payment_confirmed:true})));
  const pendingDeliveries=async ids=>ids.filter(id=>Number(id.slice(-12))>=3002);
  const delivery=page=>store.listOrders({tab:"pending",pendingStage:"delivery",productId:"netflix",page},catalog,{pendingDeliveries});
  const d1=await delivery(1),d2=await delivery(2);
  assert.equal(d1.pagination.total,22);
  assert.equal(d1.orders.length,20);assert.equal(d2.orders.length,2);
  assert.ok([...d1.orders,...d2.orders].every(o=>o.deliveryPending&&Number(o.orderCode)>=3002));
  const today=await store.listOrders({tab:"today",productId:"netflix"},catalog,{pendingDeliveries});
  assert.deepEqual(today.orders.map(o=>o.orderCode),["3001","3000","6"]);
  assert.deepEqual((await list("spotify","pending",{pendingStage:"payment"})).orders.map(o=>o.orderCode),["5"]);
  await assert.rejects(list("netflix","pending",{pendingStage:"delivery"}),{status:403});
  console.log("PASS: real order store, 1000+ rows, stable ID/legacy alias/title, cart once, search, pending/today/all, empty and all products");
} finally {await new Promise(resolve=>fixture.close(resolve));}
