import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPaymentStore } from "../mirpanel-admin/payment-store.mjs";
import { durationOptions, durationStatistics, orderDuration } from "../mirpanel-admin/payment-order-duration.mjs";
import { normalizeOrderListParams } from "../mirpanel-admin/payment-order-query.mjs";
import { bakuDate } from "../mirpanel-admin/payment-order-lifecycle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const names = ["1 aylıq", "1 Ayliq PRO", "1 Aylıq (0-500 AI krediti) endirim",
  "1 aylıq (1600 AI krediti) (Telefon&Kompyuter)", "1 aylıq (20 gün zəmanətli)",
  "3 aylıq (hər ay 0-1200 AI krediti)", "6 aylıq", "12 aylıq", "18 aylıq", "Müddətsiz"];
assert.deepEqual(names.map((plan_name) => orderDuration({ plan_name })), ["1", "1", "1", "1", "1", "3", "6", "12", "18", "other"]);
assert.equal(orderDuration({ plan_name: "PRO — 1 ay (Telefon)" }), "1");
assert.equal(orderDuration({ plan_name: "Premium 12 AYLIQ" }), "12");
assert.equal(orderDuration({ plan_name: "1600 AI krediti" }), "other");
assert.equal(orderDuration({ plan_name: "1 aylıq", duration_months: 18 }), "18");
assert.equal(orderDuration({ plan_name: "1 aylıq", durationMonths: "3" }), "3");
const options = durationOptions(names.map((plan_name) => ({ plan_name })));
assert.deepEqual(options.map((item) => item.value), ["1", "3", "6", "12", "18", "other"]);
assert.equal(new Set(options.map((item) => item.value)).size, options.length);
assert.deepEqual(durationOptions([1, 2, 3, 4, 5, 6, 12, 18].reverse().map((duration_months) => ({ duration_months }))).map((item) => item.value), ["1", "2", "3", "4", "5", "6", "12", "18"]);
assert.equal(durationOptions([{ plan_name: "3 aylıq" }]).some((item) => item.value === "other"), false);
assert.equal(normalizeOrderListParams({ planName: "1 aylıq PRO" }).durationMonths, "1");

// Entire database is synthetic and lives only in memory. No credentials, real
// database, order action, checkout, reservation or payment endpoint is used.
const today = bakuDate();
const stamp = `${today}T12:00:00+04:00`;
const methodId = "00000000-0000-4000-8000-000000000001";
const methods = [{ id: methodId, provider_name: "Test bank", display_name: "Test bank", last4: "1234", archived: false }];
const makeRow = (id, plan_name, status = "completed", extra = {}) => ({
  id: `00000000-0000-4000-9000-${String(id).padStart(12, "0")}`, order_code: String(10000 + id),
  product_id: "capcut", product_title: "CapCut Pro", plan_id: String(id), plan_name, duration_months: null,
  amount: "5.99", sale_price_snapshot: "5.99", cost_price_snapshot: "2.00", profit_snapshot: "3.99", profit_margin_snapshot: "66.61",
  currency: "AZN", status, created_at: stamp, updated_at: stamp, approved_at: stamp,
  completed_at: status === "reviewing" ? null : stamp,
  expiry_notification_on: today, service_expires_on: today, contacted_at: null,
  receipt_deleted_at: null, method_id: methodId, method_name_snapshot: "Test bank", method_last4_snapshot: "1234",
  payment_methods: methods[0], payment_reservations: { status: status === "reviewing" ? "reviewing" : "completed" }, ...extra
});
const rows = [];
for (const status of ["reviewing", "completed"]) for (let repeat = 0; repeat < 5; repeat++) for (const name of names) rows.push(makeRow(rows.length + 1, name, status));
rows.push(makeRow(101, "1 aylıq PRO", "completed", { product_id: "spotify", product_title: "Spotify", duration_months: 3 }));
rows.push(makeRow(102, "1 aylıq", "reviewing", { product_id: "spotify", product_title: "Spotify", duration_months: 3 }));
rows.push(makeRow(103, "2 aylıq", "rejected"));
rows.push(makeRow(104, "4 aylıq", "cancelled"));
const original = JSON.stringify(rows);
const requests = [];
const apiCalls = [];
let store;
let dataRows = rows;
let origin;

function matches(row, field, expression) {
  const value = row[field];
  if (expression === "is.null") return value === null || value === undefined;
  if (expression === "not.is.null") return value !== null && value !== undefined;
  const [operator, ...rest] = expression.split("."); const wanted = rest.join(".");
  if (operator === "in") return wanted.slice(1, -1).split(",").map((item) => item.replace(/^"|"$/g, "")).includes(String(value));
  if (operator === "eq") return String(value) === wanted;
  if (operator === "ilike") return String(value).toLowerCase().includes(wanted.replace(/[%*]/g, "").toLowerCase());
  if (value === null || value === undefined) return false;
  const left = field.endsWith("_at") ? new Date(value).getTime() : value;
  const right = field.endsWith("_at") ? new Date(wanted).getTime() : wanted;
  if (operator === "gte") return left >= right;
  if (operator === "lte") return left <= right;
  if (operator === "lt") return left < right;
  throw new Error(`Unexpected fixture filter: ${field} ${expression}`);
}
function queryRows(params, source = dataRows) {
  let found = source.filter((row) => [...params].every(([key, value]) => ["select", "order", "offset", "limit"].includes(key) || matches(row, key, value)));
  const sorting = (params.get("order") || "").split(",").filter(Boolean);
  found.sort((a, b) => {
    for (const sort of sorting) { const [field, direction] = sort.split("."); const diff = String(a[field] || "").localeCompare(String(b[field] || "")); if (diff) return direction === "desc" ? -diff : diff; }
    return 0;
  });
  return found;
}
const json = (res, body, status = 200, headers = {}) => { res.writeHead(status, { "Content-Type": "application/json", ...headers }); res.end(JSON.stringify(body)); };
const fixtureHtml = fs.readFileSync(path.join(root, "scripts/payment-orders-browser-fixture.mjs"), "utf8").match(/const html = `([\s\S]*?)`;/)[1];
const harness = `window.__calls=[];window.__toasts=[];window.toast=(text)=>__toasts.push(text);window.api=async(path,options={})=>{__calls.push({path,method:options.method||'GET'});const response=await fetch(path,options);const data=await response.json();if(!response.ok)throw new Error(data.error||'Fixture API failed');return data;};`;
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin || "http://127.0.0.1");
    if (url.pathname.startsWith("/rest/v1/")) {
      requests.push({ path: url.pathname, query: [...url.searchParams], method: req.method });
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const args = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        if (url.pathname.endsWith("/archive_due_payment_monthly_reports")) return json(res, null);
        assert.ok(url.pathname.endsWith("/payment_order_profit_statistics_v2"), "No business/action RPC may be called");
        const params = new URLSearchParams({ status: "in.(approved,completed)" });
        if (args.p_product_id) params.set("product_id", `eq.${args.p_product_id}`);
        if (args.p_method_id) params.set("method_id", `eq.${args.p_method_id}`);
        if (args.p_search) params.set("order_code", `ilike.*${args.p_search}*`);
        let found = queryRows(params).filter((row) => row.completed_at);
        if (args.p_date_from) found = found.filter((row) => bakuDate(row.completed_at) >= args.p_date_from);
        if (args.p_date_to) found = found.filter((row) => bakuDate(row.completed_at) <= args.p_date_to);
        if (args.p_tab === "today") found = found.filter((row) => bakuDate(row.completed_at) === args.p_today);
        if (args.p_tab === "expiring") found = found.filter((row) => !row.contacted_at && row.expiry_notification_on <= args.p_today);
        return json(res, durationStatistics(found));
      }
      assert.ok(["GET", "HEAD"].includes(req.method), "No table mutation is allowed");
      if (url.pathname.endsWith("/payment_audit_log")) return json(res, []);
      const found = url.pathname.endsWith("/payment_methods") ? methods : queryRows(url.searchParams);
      const offset = Number(url.searchParams.get("offset") || 0);
      const limit = Number(url.searchParams.get("limit") || 1000);
      const page = found.slice(offset, offset + Math.min(limit, 1000));
      const range = `${page.length ? `${offset}-${offset + page.length - 1}` : "*"}/${found.length}`;
      return json(res, req.method === "HEAD" ? null : page, 200, { "Content-Range": range });
    }
    if (url.pathname === "/api/admin/payment-orders") {
      apiCalls.push(url.search);
      const result = await store.listOrders(Object.fromEntries(url.searchParams));
      // Same catalogue override as the production admin API.
      result.filters.products = [{ id: "capcut", title: "CapCut Pro" }, { id: "spotify", title: "Spotify" }];
      if (url.searchParams.get("productId") === "spotify" && !url.searchParams.get("durationMonths")) await new Promise((resolve) => setTimeout(resolve, 160));
      return json(res, result);
    }
    if (url.pathname === "/api/admin/payment-monthly-reports") return json(res, { current: null, archives: [] });
    if (url.pathname.startsWith("/api/")) throw new Error(`Unexpected API request ${req.method} ${url.pathname}`);
    if (url.pathname === "/fixture-state.js") { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(harness); }
    if (["/payment-admin.js", "/admin.css"].includes(url.pathname)) { res.writeHead(200, { "Content-Type": url.pathname.endsWith(".css") ? "text/css" : "application/javascript" }); return res.end(fs.readFileSync(path.join(root, "mirpanel-admin/public", url.pathname.slice(1)))); }
    if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(fixtureHtml);
  } catch (error) { console.error(error); json(res, { error: error.message }, 500); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
origin = `http://127.0.0.1:${server.address().port}`;
store = createPaymentStore({ supabaseUrl: origin, supabaseSecretKey: "fixture-only-not-a-secret" });
let browser;
try {
  for (const tab of ["pending", "today", "all", "expiring"]) {
    const base = { tab, period: "all" };
    const result = await store.listOrders(base);
    assert.deepEqual(result.filters.durations, options, `${tab}: durations from all matching results`);
    assert.equal(result.orders.length, 20);
    assert.equal(result.pagination.total, 51);
    const one = await store.listOrders({ ...base, durationMonths: "1" });
    assert.equal(one.pagination.total, 25, `${tab}: all five 1-month variants`);
    assert.equal(one.orders.every((row) => orderDuration(row) === "1"), true);
    assert.equal(one.orders.some((row) => row.planName === names[3]), true, "Full plan labels are unchanged");
    if (tab !== "pending") { assert.equal(one.statistics.count, 25); assert.equal(one.statistics.revenue, "149.75"); assert.equal(one.statistics.cost, "50.00"); }
    const next = await store.listOrders({ ...base, durationMonths: "1", page: 2 });
    assert.equal(next.orders.length, 5); assert.equal(next.pagination.total, 25);
    assert.equal(new Set([...one.orders, ...next.orders].map((row) => row.id)).size, 25);
    const spotify = await store.listOrders({ ...base, productId: "spotify", durationMonths: "1", page: 3 });
    assert.deepEqual(spotify.filters.durations, [{ value: "3", label: "3 aylıq" }]);
    assert.equal(spotify.appliedFilters.durationMonths, ""); assert.equal(spotify.pagination.page, 1); assert.equal(spotify.orders.length, 1);
    const other = await store.listOrders({ ...base, durationMonths: "other" });
    assert.equal(other.pagination.total, 5);
    assert.equal(other.orders.every((row) => row.planName === "Müddətsiz"), true);
    const combined = await store.listOrders({ ...base, productId: "capcut", methodId, period: "custom", dateFrom: today, dateTo: today, search: "10001", sort: "oldest" });
    assert.deepEqual(combined.filters.durations, tab === "pending" ? [{ value: "1", label: "1 aylıq" }] : []);
    if (tab === "expiring") {
      assert.equal(one.selection.total, 25); assert.equal(one.selection.ids.length, 25);
      assert.deepEqual(new Set(one.selection.ids), new Set([...one.orders, ...next.orders].map((row) => row.id)));
      assert.equal(one.counts.expiring, 25);
    }
  }
  // PostgREST's row cap is simulated. A duration occurring after row 1000 must
  // still be offered, paginated and included in select-all.
  dataRows = Array.from({ length: 1005 }, (_, i) => makeRow(2000 + i, i === 1004 ? "18 aylıq" : "1 aylıq"));
  const large = await store.listOrders({ tab: "expiring", period: "all", sort: "oldest" });
  assert.deepEqual(large.filters.durations.map((item) => item.value), ["1", "18"]);
  assert.equal(large.pagination.total, 1005); assert.equal(large.selection.total, 1005);
  const lastDuration = await store.listOrders({ tab: "expiring", period: "all", durationMonths: "18", sort: "oldest" });
  assert.equal(lastDuration.pagination.total, 1); assert.equal(lastDuration.orders[0].planName, "18 aylıq");
  dataRows = rows;
  assert.equal(JSON.stringify(rows), original, "All order/reservation/status/finance data remain unchanged");
  console.log("API/parser: 10 labels → 6 groups; all 4 tabs, structured precedence, dynamic 2/4/5, product/bank/date/ID/sort, pagination, statistics and batch ID consistency PASS; 1005-row facets PASS.");

  if (process.env.MIRPANEL_NODE_MODULES && process.env.MIRPANEL_BROWSER_PATH) {
    const { chromium } = await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES, "playwright/index.mjs")));
    browser = await chromium.launch({ headless: true, executablePath: process.env.MIRPANEL_BROWSER_PATH });
    const errors = [];
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: width < 500 ? 844 : 900 } });
      page.on("pageerror", (error) => errors.push(`${width}: ${error.message}`));
      page.on("console", (message) => { if (message.type() === "error") errors.push(`${width}: ${message.text()}`); });
      await page.goto(origin);
      await page.click('.navBtn[data-view="paymentOrders"]');
      const ready = () => page.waitForFunction(() => document.querySelector("#paymentOrdersStatus")?.textContent.includes("nəticə göstərilir") && !document.querySelector("#paymentOrdersList")?.hasAttribute("aria-busy"));
      await ready();
      for (const tab of ["pending", "today", "all", "expiring"]) {
        await page.click(`[data-payment-order-tab="${tab}"]`); await ready();
        const shown = await page.locator("#paymentOrderPlan option").allTextContents();
        assert.deepEqual(shown, ["Bütün müddətlər", ...options.map((item) => item.label)]);
        await page.selectOption("#paymentOrderPlan", "1"); await ready();
        assert.equal(await page.locator(".paymentOrderAdminCard").count(), 20);
        assert.match(await page.locator("#paymentOrdersStatus").textContent(), /25 nəticə/);
        await page.click("#paymentOrdersNext"); await ready();
        assert.equal(await page.locator(".paymentOrderAdminCard").count(), 5);
        if (tab === "expiring") {
          await page.click("#paymentSelectAllFiltered");
          assert.equal(await page.locator("#paymentConfirmSelected").textContent(), "25 sifarişi təsdiqlə");
        }
        await page.selectOption("#paymentOrderProduct", "spotify"); await ready();
        assert.deepEqual(await page.locator("#paymentOrderPlan option").allTextContents(), ["Bütün müddətlər", "3 aylıq"]);
        assert.equal(await page.locator("#paymentOrderPlan").inputValue(), "");
        assert.equal(await page.locator(".paymentOrderAdminCard").count(), 1);
        assert.match(await page.locator("#paymentOrdersPageInfo").textContent(), /1 \/ 1/);
        if (tab === "expiring") assert.equal(await page.locator("#paymentConfirmSelected").isDisabled(), true);
      }
      await page.click('[data-payment-order-tab="all"]'); await ready();
      // Two genuinely concurrent filter responses: an older delayed Spotify
      // response must not replace the newer CapCut response.
      await page.evaluate(() => {
        const field = document.getElementById("paymentOrderProduct"); field.value = "spotify"; field.dispatchEvent(new Event("change", { bubbles: true }));
        setTimeout(() => { field.value = "capcut"; field.dispatchEvent(new Event("change", { bubbles: true })); }, 20);
      });
      await page.waitForFunction(() => document.querySelector("#paymentOrderProduct")?.value === "capcut" && document.querySelector("#paymentOrdersStatus")?.textContent.includes("50 nəticə"));
      await new Promise((resolve) => setTimeout(resolve, 250));
      assert.equal(await page.locator("#paymentOrderProduct").inputValue(), "capcut");
      assert.deepEqual(await page.locator("#paymentOrderPlan option").allTextContents(), ["Bütün müddətlər", ...options.map((item) => item.label)]);
      const geometry = await page.locator("#paymentOrderPlan").evaluate((element) => {
        const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, width: box.width, height: box.height, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      assert.ok(geometry.left >= 0 && geometry.right <= width, `${width}: dropdown must fit viewport`);
      assert.equal(geometry.overflow, 0, `${width}: horizontal overflow`);
      await page.locator("#paymentOrderPlan").scrollIntoViewIfNeeded();
      await page.locator("#paymentOrderPlan").focus(); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); await ready();
      if (process.env.MIRPANEL_TEST_SCREENSHOTS) {
        fs.mkdirSync(process.env.MIRPANEL_TEST_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: path.join(process.env.MIRPANEL_TEST_SCREENSHOTS, `duration-${width}.png`) });
      }
      assert.equal(await page.evaluate(() => __calls.some((call) => call.method !== "GET")), false, "UI never submits an order/status/action");
      console.log(`Browser ${width}px: all four tabs, duration/reset/pagination/select-all/race, keyboard dropdown and overflow=0 PASS (${Math.round(geometry.width)}×${Math.round(geometry.height)}px).`);
      await page.close();
    }
    assert.deepEqual(errors, [], "Console errors must be zero");
    console.log("Console errors=0; real orders/reservations/card/status changes=0.");
  } else console.log("Browser checks NOT RUN (runtime environment missing).");
  assert.equal(JSON.stringify(rows), original);
  assert.equal(requests.filter((request) => !["GET", "HEAD"].includes(request.method) && !request.path.includes("/rpc/")).length, 0);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
