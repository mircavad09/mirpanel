import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 10081);
const now = new Date("2026-08-08T12:00:00+04:00").toISOString();

const baseOrder = (id, code, status, index = 1) => ({
  id, orderCode: code, productId: index % 2 ? "capcut" : "netflix", productTitle: index % 2 ? "CapCut Pro" : "Netflix Şəxsi",
  planId: "0", planName: "1 aylıq", amount: 5.99, currency: "AZN", status,
  reservationStatus: status === "reviewing" ? "reviewing" : (status === "completed" ? "completed" : "rejected"),
  createdAt: now, completedAt: status === "completed" ? now : null, receiptAvailable: true,
  paymentMethodLabel: "LeoBank •••• 4419", auditHistory: [{ action: "order.submitted", created_at: now }]
});
const completedOrders = Array.from({ length: 25 }, (_, index) => baseOrder(
  `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`,
  `MP-${String(index + 1).padStart(6, "0")}`,
  "completed",
  index + 1
));

const html = `<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/admin.css"></head><body>
<nav class="nav"><button class="navBtn" data-view="paymentOrders">Sifarişlər</button><button class="navBtn" data-view="paymentReviews">Ödəniş yoxlamaları</button></nav>
<main class="main"><section id="paymentOrdersView" class="workspace"><div class="panel editorPanel cmsPanel">
<div class="paymentOrderToolbar"><div class="paymentOrderTabs" role="tablist"><button class="paymentOrderTab active" type="button" data-payment-order-tab="pending">Gözləyən sifarişlər (<span id="paymentPendingCount">0</span>)</button><button class="paymentOrderTab" type="button" data-payment-order-tab="completed">Tamamlanmış sifarişlər (<span id="paymentCompletedCount">0</span>)</button></div><button class="btn" id="paymentOrdersRefresh" type="button">Yenilə</button></div>
<form id="paymentOrderFilters" class="paymentOrderFilters"><label>Sifariş ID-si<input id="paymentOrderSearch"></label><label>Məhsul<select id="paymentOrderProduct"><option value="">Bütün məhsullar</option></select></label><label>Status<select id="paymentOrderStatus"><option value="">Seçilmiş tab</option><option value="reviewing">Yoxlanılır</option><option value="completed">Tamamlandı</option><option value="rejected">Rədd edilib</option><option value="expired">Vaxtı bitib</option></select></label><label>Bank<select id="paymentOrderMethod"><option value="">Bütün banklar</option></select></label><label>Başlanğıc<input id="paymentOrderDateFrom" type="date"></label><label>Son<input id="paymentOrderDateTo" type="date"></label><label>Sıralama<select id="paymentOrderSort"><option value="newest">Ən yeni</option><option value="oldest">Ən köhnə</option></select></label><div class="paymentOrderFilterActions"><button class="btn primary" type="submit">Tətbiq et</button><button class="btn" id="paymentOrderFiltersClear" type="button">Təmizlə</button></div></form>
<div id="paymentOrdersStatus"></div><div id="paymentOrdersList" class="paymentOrdersAdminList"></div><nav class="paymentOrderPagination"><button class="btn" id="paymentOrdersPrevious" type="button">Əvvəlki</button><span id="paymentOrdersPageInfo"></span><button class="btn" id="paymentOrdersNext" type="button">Növbəti</button></nav></div></section>
<section id="paymentReviewsView" class="hidden"><button id="paymentReviewsRefresh"></button><div id="paymentEmailsList"></div></section></main>
<script>
window.__fixtureState={
 pending:[${JSON.stringify(baseOrder("00000000-0000-4000-8000-000000000001", "MP-A1B2C3", "reviewing", 1))},${JSON.stringify(baseOrder("00000000-0000-4000-8000-000000000002", "MP-D4E5F6", "reviewing", 2))}],
 completed:${JSON.stringify(completedOrders)},
 rejected:[${JSON.stringify(baseOrder("00000000-0000-4000-8000-000000000003", "MP-ABC123", "rejected", 3))}], calls:[], toasts:[]
};
window.toast=(message)=>window.__fixtureState.toasts.push(message);
window.api=async(path,options={})=>{
 const state=window.__fixtureState; state.calls.push({path,method:options.method||"GET"});
 const parsed=new URL(path,location.origin);
 const action=parsed.pathname.match(/^\\/api\\/admin\\/payment-orders\\/([^/]+)\\/(approve|reject)$/);
 if(action){const [_,id,type]=action; const index=state.pending.findIndex(item=>item.id===id); if(index<0)return {idempotent:true,status:type==="approve"?"completed":"rejected"}; const order=state.pending.splice(index,1)[0]; order.status=type==="approve"?"completed":"rejected"; order.reservationStatus=order.status; if(type==="approve")state.completed.unshift(order);else state.rejected.unshift(order);return {idempotent:false,status:order.status};}
 if(parsed.pathname==="/api/admin/payment-orders"){
  const tab=parsed.searchParams.get("tab")||"pending"; const status=parsed.searchParams.get("status")||""; const search=(parsed.searchParams.get("search")||"").toUpperCase(); const page=Number(parsed.searchParams.get("page")||1);
  let rows=status==="rejected"?state.rejected:status==="completed"?state.completed:status==="reviewing"?state.pending:(tab==="completed"?state.completed:tab==="rejected"?state.rejected:state.pending);
  if(search)rows=rows.filter(item=>item.orderCode.includes(search)); const pageSize=20; const total=rows.length; const start=(page-1)*pageSize;
  return {orders:rows.slice(start,start+pageSize),counts:{pending:state.pending.length,completed:state.completed.length,rejected:state.rejected.length},pagination:{page,pageSize,total,totalPages:Math.max(1,Math.ceil(total/pageSize))},filters:{products:[{id:"capcut",title:"CapCut Pro"},{id:"netflix",title:"Netflix Şəxsi"}],methods:[{id:"00000000-0000-4000-8000-000000000010",label:"LeoBank •••• 4419"}]}};
 }
 if(parsed.pathname==="/api/admin/payment-emails")return {emails:[]};
 if(parsed.pathname==="/api/admin/payment-methods")return {methods:[]};
 if(parsed.pathname==="/api/admin/payment-settings")return {settings:{},health:{}};
 if(parsed.pathname.includes("/receipt"))return {url:"about:blank"};
 return {};
};
</script><script src="/payment-admin.js"></script></body></html>`;
const inlineFixtureMatch = html.match(/<script>([\s\S]*?)<\/script><script src="\/payment-admin\.js">/);
if (!inlineFixtureMatch) throw new Error("Fixture skripti ayrılmadı.");
const fixtureScript = inlineFixtureMatch[1];
const fixtureHtml = html.replace(inlineFixtureMatch[0], '<script src="/fixture-state.js"></script><script src="/payment-admin.js">');

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/payment-admin.js") {
    response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    response.end(fs.readFileSync(path.join(root, "mirpanel-admin/public/payment-admin.js")));
    return;
  }
  if (pathname === "/admin.css") {
    response.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
    response.end(fs.readFileSync(path.join(root, "mirpanel-admin/public/admin.css")));
    return;
  }
  if (pathname === "/fixture-state.js") {
    response.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
    response.end(fixtureScript);
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(fixtureHtml);
});

server.listen(port, "127.0.0.1", () => console.log(`Payment orders fixture: http://127.0.0.1:${port}`));
