import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractAdminState } from "../mirpanel-admin/core.mjs";
import { aggregateProfitSnapshots, catalogCostRows, moneyMetrics, parseMoneyCents } from "../mirpanel-admin/payment-profit.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const catalog = extractAdminState(read("app.js"));
const rows = catalogCostRows(catalog, []);

assert.equal(catalog.products.length, 30);
assert.equal(rows.length, catalog.products.reduce((sum, product) => sum + (product.plans?.length || 0), 0));
assert.equal(rows.length, 39);
assert.equal(rows.filter((row) => row.costAmount === null).length, 39);
const expanded = structuredClone(catalog);
expanded.products.push({ id: "future", title: "Gələcək məhsul", active: true, category: "ai", plans: [{ months: 1, price: 9.99 }, { months: 12, price: 99.99 }] });
assert.equal(catalogCostRows(expanded, []).length, 41, "Yeni məhsul və planlar avtomatik görünməlidir");

assert.equal(parseMoneyCents("5,25"), 525);
assert.equal(parseMoneyCents("5.2"), 520);
assert.equal(parseMoneyCents(""), null);
for (const invalid of ["-1", "NaN", "Infinity", "1.234", "abc", "10000000"]) assert.throws(() => parseMoneyCents(invalid));
assert.deepEqual(moneyMetrics("10.00", "6.25"), { sale: "10.00", cost: "6.25", profit: "3.75", margin: 37.5 });
assert.deepEqual(moneyMetrics("5.00", "7.00"), { sale: "5.00", cost: "7.00", profit: "-2.00", margin: -40 });
assert.equal(moneyMetrics("5.00", "").profit, null, "Boş maya 0 qəbul edilməməlidir");

assert.deepEqual(aggregateProfitSnapshots([
  { status: "approved", amount: 10, sale_price_snapshot: 10, cost_price_snapshot: 6, profit_snapshot: 4 },
  { status: "completed", amount: 5, sale_price_snapshot: 5, cost_price_snapshot: null, profit_snapshot: null },
  { status: "reviewing", amount: 100, cost_price_snapshot: 1, profit_snapshot: 99 },
  { status: "rejected", amount: 100, cost_price_snapshot: 1, profit_snapshot: 99 }
]), { count: 2, revenue: 15, cost: 6, profit: 4, margin: 40, missingCostCount: 1 });

const migration = read("supabase/migrations/202608090002_payment_costs_and_profit.sql");
const store = read("mirpanel-admin/payment-store.mjs");
const api = read("mirpanel-admin/payment-api.mjs");
const admin = read("mirpanel-admin/public/payment-admin.js");
const cms = read("mirpanel-admin/public/cms-admin.js");
for (const value of ["payment_plan_costs", "sale_price_snapshot", "cost_price_snapshot", "profit_snapshot", "profit_margin_snapshot", "approve_payment_order_v3", "payment_order_profit_statistics"]) assert.ok(migration.includes(value));
assert.ok(migration.includes("if v_order.status = 'approved'"));
assert.ok(migration.includes("for update"));
assert.equal(/update public\.payment_orders[\s\S]*cost_price_snapshot[\s\S]*where cost_price_snapshot is null/i.test(migration), false, "Köhnə sifarişlər avtomatik backfill edilməməlidir");
assert.ok(migration.includes("revoke all on table public.payment_plan_costs from public, anon, authenticated"));
assert.ok(store.includes('rpc("approve_payment_order_v3"'));
assert.ok(store.includes('rpc("payment_order_profit_statistics"'));
assert.ok(api.includes('url.pathname === "/api/admin/payment-costs"'));
assert.ok(cms.includes("Maya dəyəri və mənfəət"));
assert.ok(admin.includes("Tarixi maya dəyəri mövcud deyil"));
assert.equal(read("index.html").includes("payment_plan_costs"), false);
assert.equal(read("app.js").includes("cost_price_snapshot"), false);

console.log(JSON.stringify({ ok: true, products: 30, plans: rows.length, emptyCostsRemainNull: true, snapshotImmutable: true, adminOnly: true }, null, 2));
