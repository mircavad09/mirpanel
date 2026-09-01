import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 10081);
const completedAt = new Date("2026-08-09T12:00:00+04:00").toISOString();

const order = (index, status = "completed") => ({
  id: `00000000-0000-4000-9000-${String(index).padStart(12, "0")}`,
  orderCode: `MP-${index.toString(16).toUpperCase().padStart(6, "0")}`,
  productId: index % 2 ? "capcut" : "netflix", productTitle: index % 2 ? "CapCut Pro" : "Netflix Şəxsi",
  planId: "0", planName: index % 3 ? "1 aylıq" : "3 aylıq", amount: index % 2 ? 5.99 : 7.99, currency: "AZN", status,
  reservationStatus: status === "reviewing" ? "reviewing" : "completed", createdAt: completedAt,
  completedAt: status === "completed" ? completedAt : null, expiresOn: "2026-09-08", expiry: { code: "tomorrow", label: "Sabah bitir" },
  salePriceSnapshot: index % 2 ? 5.99 : 7.99, costPriceSnapshot: index % 5 ? 3.25 : null,
  profitSnapshot: index % 5 ? Number(((index % 2 ? 5.99 : 7.99) - 3.25).toFixed(2)) : null, profitMarginSnapshot: index % 5 ? 45.74 : null,
  contactedAt: null, receiptAvailable: true, paymentMethodLabel: "LeoBank •••• 4419",
  auditHistory: [{ action: "order.submitted", created_at: completedAt }]
});

const fixtureScript = `
window.__fixtureState={pending:[${JSON.stringify(order(1, "reviewing"))},${JSON.stringify(order(2, "reviewing"))}],all:${JSON.stringify(Array.from({length:26},(_,i)=>order(i+10)))},expiring:[${JSON.stringify(order(40))},${JSON.stringify(order(41))}],costs:[{productId:"capcut",productTitle:"CapCut Pro",productActive:true,category:"video",planId:"0",planName:"1 aylıq",durationMonths:1,salePrice:"5.99",costAmount:"3.25",profit:"2.74",margin:45.74,updatedAt:"2026-08-09T12:00:00Z"},{productId:"netflix",productTitle:"Netflix Şəxsi",productActive:true,category:"film",planId:"0",planName:"1 aylıq",durationMonths:1,salePrice:"7.99",costAmount:null,profit:null,margin:null,updatedAt:null}],methods:[{id:"00000000-0000-4000-8000-000000004419",displayName:"LeoBank",providerName:"LeoBank",holderName:"Test",adminMaskedNumber:"•••• •••• •••• 4419",maskedNumber:"•••• •••• •••• 4419",type:"bank_card",color:"#111111",icon:"card",theme:"leo",active:true,archived:false,status:"active",order:1,dailyLimit:5,limitMode:"limited",confirmedToday:2,activeReservations:1,reviewingReceipts:1,occupiedToday:4,pendingReservations:2,remaining:1,available:true,hasNumber:true,adminNote:"",lastResetAt:"2026-09-01T00:00:00+04:00",nextResetAt:"2026-09-02T00:00:00+04:00"}],calls:[],toasts:[]};
window.toast=(message)=>window.__fixtureState.toasts.push(message);
document.addEventListener("click",event=>{const button=event.target.closest(".navBtn[data-view]");if(!button)return;document.querySelectorAll("main>section").forEach(section=>section.classList.add("hidden"));document.getElementById(button.dataset.view+"View")?.classList.remove("hidden");});
window.api=async(path,options={})=>{
 const state=window.__fixtureState; state.calls.push({path,method:options.method||"GET"}); const parsed=new URL(path,location.origin);
 const orderParts=parsed.pathname.split("/"); const isOrderAction=orderParts[1]==="api"&&orderParts[2]==="admin"&&orderParts[3]==="payment-orders"&&["approve","reject","contacted"].includes(orderParts[5]);
 if(isOrderAction){const id=orderParts[4],type=orderParts[5]; const pending=state.pending.findIndex(item=>item.id===id); if(type==="approve"){if(pending<0)return {idempotent:true,status:"completed"};const item=state.pending.splice(pending,1)[0];item.status="completed";item.completedAt=new Date().toISOString();state.all.unshift(item);return {idempotent:false,status:"completed"};}if(type==="reject"){if(pending<0)return {idempotent:true,status:"rejected"};state.pending.splice(pending,1);return {idempotent:false,status:"rejected"};}const expiring=state.expiring.findIndex(item=>item.id===id);if(expiring<0)return {idempotent:true};const item=state.expiring.splice(expiring,1)[0];item.contactedAt=new Date().toISOString();return {idempotent:false,contactedAt:item.contactedAt};}
 if(parsed.pathname==="/api/admin/payment-orders"){
  const tab=parsed.searchParams.get("tab")||"pending",page=Number(parsed.searchParams.get("page")||1),pageSize=20;
  let rows=tab==="pending"?state.pending:tab==="today"?state.all.slice(0,3):tab==="expiring"?state.expiring:state.all;
  const search=(parsed.searchParams.get("search")||"").toUpperCase();if(search)rows=rows.filter(item=>item.orderCode.includes(search));
  const total=rows.length,start=(page-1)*pageSize,statsRows=tab==="pending"?[]:rows;
  return {orders:rows.slice(start,start+pageSize),counts:{pending:state.pending.length,today:3,all:state.all.length,expiring:state.expiring.length},statistics:{count:statsRows.length,revenue:Number(statsRows.reduce((sum,item)=>sum+item.amount,0).toFixed(2)),cost:65,profit:50,profitMargin:43.48,missingCostCount:2,topProduct:statsRows.length?"CapCut Pro":"—",topProfitProduct:"CapCut Pro",products:[{title:"CapCut Pro",count:Math.ceil(statsRows.length/2),revenue:80,cost:40,profit:40,margin:50,missingCostCount:1}],plans:[{productTitle:"CapCut Pro",planName:"1 aylıq",count:10,revenue:59.9,cost:32.5,profit:27.4,missingCostCount:0}],days:[{date:"2026-08-09",count:statsRows.length,revenue:Number(statsRows.reduce((sum,item)=>sum+item.amount,0).toFixed(2)),cost:65,profit:50,missingCostCount:2}]},pagination:{page,pageSize,total,totalPages:Math.max(1,Math.ceil(total/pageSize))},filters:{products:[{id:"capcut",title:"CapCut Pro"},{id:"netflix",title:"Netflix Şəxsi"}],plans:["1 aylıq","3 aylıq"],methods:[{id:"00000000-0000-4000-8000-000000004419",label:"LeoBank •••• 4419"}]}};
 }
 if(parsed.pathname==="/api/admin/payment-costs"){if((options.method||"GET")==="POST"){const body=JSON.parse(options.body);for(const change of body.items){const row=state.costs.find(item=>item.productId===change.productId&&item.planId===change.planId);if(row){row.costAmount=change.cost;row.updatedAt=new Date().toISOString();}}return {changed:body.items.length,idempotent:false,rows:state.costs};}return {rows:state.costs,productCount:2,planCount:2,categories:["film","video"]};}
 if(parsed.pathname==="/api/admin/payment-cost-backfill-preview")return {preview:{missingCount:2,matchedCount:1,unmatchedCount:1,digest:"0123456789abcdef0123456789abcdef",cost:3.25,profit:2.74,items:[{orderCode:"MP-000010",productTitle:"CapCut Pro",planName:"1 aylıq",sale:5.99,cost:3.25,profit:2.74,matched:true},{orderCode:"MP-000011",productTitle:"Netflix Şəxsi",planName:"3 aylıq",sale:7.99,cost:null,profit:null,matched:false}]}};
 if(parsed.pathname==="/api/admin/payment-cost-backfill")return {result:{changed:1,idempotent:false},preview:{missingCount:1,matchedCount:0,unmatchedCount:1,digest:"d41d8cd98f00b204e9800998ecf8427e",cost:0,profit:0,items:[{orderCode:"MP-000011",productTitle:"Netflix Şəxsi",planName:"3 aylıq",sale:7.99,cost:null,profit:null,matched:false}]}};
 const methodParts=parsed.pathname.split("/");const actionName=methodParts[5];const isMethodAction=methodParts[1]==="api"&&methodParts[2]==="admin"&&methodParts[3]==="payment-methods"&&["activate","deactivate","delete","restore"].includes(actionName);if(isMethodAction){const method=state.methods.find(item=>item.id===methodParts[4]);if(actionName==="delete"){method.status="deleted";method.archived=true;method.active=false;method.available=false;}if(actionName==="restore"){method.status="inactive";method.archived=false;method.active=false;}if(actionName==="activate"){method.status="active";method.active=true;method.available=true;}if(actionName==="deactivate"){method.status="inactive";method.active=false;method.available=false;}return {ok:true};}
 if(parsed.pathname==="/api/admin/payment-methods")return {methods:state.methods};
 if(parsed.pathname==="/api/admin/payment-settings")return {settings:{notificationEmail:"admin@example.test",receiptRetentionDays:90},health:{}};
 if(parsed.pathname==="/api/admin/payment-emails")return {emails:[]};
 if(parsed.pathname.includes("/receipt"))return {url:"about:blank"};return {ok:true};
};`;

const html = `<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/admin.css"></head><body>
<nav class="nav"><button class="navBtn" data-view="paymentOrders">Sifarişlər</button><button class="navBtn" data-view="paymentMethods">Ödəniş üsulları</button><button class="navBtn" data-view="paymentCosts">Maya dəyəri və mənfəət</button><button class="navBtn" data-view="paymentReviews">Ödəniş yoxlamaları</button></nav><main class="main">
<section id="paymentOrdersView" class="workspace"><div class="panel editorPanel cmsPanel"><div class="paymentOrderToolbar"><div class="paymentOrderTabs" role="tablist">
<button class="paymentOrderTab active" data-payment-order-tab="pending">Gözləyən sifarişlər (<span id="paymentPendingCount">0</span>)</button><button class="paymentOrderTab" data-payment-order-tab="today">Bu gün tamamlananlar (<span id="paymentTodayCount">0</span>)</button><button class="paymentOrderTab" data-payment-order-tab="all">Ümumi sifarişlər (<span id="paymentAllCount">0</span>)</button><button class="paymentOrderTab" data-payment-order-tab="expiring">Bitən məhsullar (<span id="paymentExpiringCount">0</span>)</button></div><button class="btn" id="paymentOrdersRefresh">Yenilə</button></div>
<div id="paymentOrderStatistics" class="paymentOrderStatistics"></div><form id="paymentOrderFilters" class="paymentOrderFilters"><label>Sifariş ID-si<input id="paymentOrderSearch"></label><label>Məhsul<select id="paymentOrderProduct"></select></label><label>Plan<select id="paymentOrderPlan"></select></label><label>Bank<select id="paymentOrderMethod"></select></label><label>Müddət<select id="paymentOrderPeriod"><option value="">Bütün tarixçə</option><option value="7d">Son 7 gün</option><option value="custom">Xüsusi tarix</option></select></label><label class="paymentCustomDate">Başlanğıc<input id="paymentOrderDateFrom" type="date"></label><label class="paymentCustomDate">Son<input id="paymentOrderDateTo" type="date"></label><label>Sıralama<select id="paymentOrderSort"><option value="newest">Ən yeni</option><option value="oldest">Ən köhnə</option></select></label><div class="paymentOrderFilterActions"><button class="btn primary" type="submit">Tətbiq et</button><button class="btn" id="paymentOrderFiltersClear" type="button">Təmizlə</button></div></form>
<div id="paymentOrdersStatus"></div><div id="paymentOrdersList" class="paymentOrdersAdminList"></div><nav class="paymentOrderPagination"><button class="btn" id="paymentOrdersPrevious">Əvvəlki</button><span id="paymentOrdersPageInfo"></span><button class="btn" id="paymentOrdersNext">Növbəti</button></nav></div></section>
<section id="paymentMethodsView" class="hidden"><button id="paymentMethodAdd"></button><div id="paymentMethodsList"></div><div id="paymentMethodEditor"></div><input id="paymentNotificationEmail"><input id="paymentReceiptRetentionDays"></section>
<section id="paymentCostsView" class="hidden"><div class="paymentCostToolbar"><form id="paymentCostFilters" class="paymentCostFilters"><label>Axtarış<input id="paymentCostSearch"></label><label>Vəziyyət<select id="paymentCostActive"><option value="">Hamısı</option><option value="active">Aktiv</option><option value="inactive">Deaktiv</option></select></label><label>Kateqoriya<select id="paymentCostCategory"></select></label><label class="checkLabel"><input id="paymentCostMissing" type="checkbox"> Qeyd edilməyənlər</label></form><button id="paymentCostsSaveAll" class="btn primary" disabled>Hamısını yadda saxla</button></div><div id="paymentCostsStatus"></div><div id="paymentCostsList" class="paymentCostsList"></div><details class="paymentBackfillPanel"><summary>Köhnə sifarişlərin maya snapshot-u</summary><button id="paymentCostBackfillPreview">Preview yarat</button><button id="paymentCostBackfillApply" disabled>Tətbiq et</button><div id="paymentCostBackfillResult"></div></details></section>
<section id="paymentReviewsView" class="hidden"><button id="paymentReviewsRefresh"></button><div id="paymentEmailsList"></div></section></main>
<script src="/fixture-state.js"></script><script src="/payment-admin.js"></script></body></html>`;

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/payment-admin.js") { response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" }); return response.end(fs.readFileSync(path.join(root, "mirpanel-admin/public/payment-admin.js"))); }
  if (pathname === "/admin.css") { response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" }); return response.end(fs.readFileSync(path.join(root, "mirpanel-admin/public/admin.css"))); }
  if (pathname === "/fixture-state.js") { response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" }); return response.end(fixtureScript); }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(html);
});

server.listen(port, "127.0.0.1", () => console.log(`Payment orders fixture: http://127.0.0.1:${port}`));
