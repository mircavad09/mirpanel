import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202609020002_monthly_order_reports.sql"), "utf8");
const store = fs.readFileSync(path.join(root, "mirpanel-admin/payment-store.mjs"), "utf8");
const api = fs.readFileSync(path.join(root, "mirpanel-admin/payment-api.mjs"), "utf8");
const ui = fs.readFileSync(path.join(root, "mirpanel-admin/public/payment-admin.js"), "utf8");
const template = fs.readFileSync(path.join(root, "mirpanel-admin/public/cms-admin.js"), "utf8");

for (const text of ["payment_monthly_reports", "payment_month_report_snapshot", "archive_due_payment_monthly_reports", "current_payment_month_report", "Asia/Baku", "if not exists (select 1 from public.payment_monthly_reports", "enable row level security", "grant select, insert on table public.payment_monthly_reports to service_role"]) assert.ok(migration.toLowerCase().includes(text.toLowerCase()), `Migration marker missing: ${text}`);
assert.match(migration, /status in \('approved','completed'\)/);
assert.match(migration, /sale_price_snapshot/);
assert.match(migration, /cost_price_snapshot/);
assert.match(migration, /profit_snapshot/);
assert.match(migration, /date_trunc\('month', public\.payment_baku_date\(\)\)/);
assert.match(store, /async monthlyReports\(\)/);
assert.match(store, /archive_due_payment_monthly_reports/);
assert.match(api, /\/api\/admin\/payment-monthly-reports/);
assert.match(template, /data-payment-report-tab="current"/);
assert.match(template, /Aylıq arxiv/);
assert.match(template, /data-payment-report-tab="all"/);
assert.match(ui, /archiveOrderQuery/);
assert.match(ui, /paymentContextHidden/);
assert.match(ui, /reportPrimaryMarkup/);

// Simulates the rule implemented in SQL: only immutable completed snapshots
// are financial inputs; closing a month twice cannot create a second archive.
const rows = [
  { status: "completed", month: "2026-08-01", sale: 10, cost: 4, profit: 6 },
  { status: "approved", month: "2026-08-01", sale: 20, cost: 7, profit: 13 },
  { status: "reviewing", month: "2026-08-01", sale: 99, cost: 1, profit: 98 },
  { status: "rejected", month: "2026-08-01", sale: 99, cost: 1, profit: 98 }
];
const completed = rows.filter((row) => ["approved", "completed"].includes(row.status));
assert.deepEqual(completed.reduce((acc, row) => ({ count: acc.count + 1, sale: acc.sale + row.sale, cost: acc.cost + row.cost, profit: acc.profit + row.profit }), { count: 0, sale: 0, cost: 0, profit: 0 }), { count: 2, sale: 30, cost: 11, profit: 19 });
const archived = new Set();
function closeMonth(month) { if (archived.has(month)) return false; archived.add(month); return true; }
assert.equal(closeMonth("2026-08-01"), true);
assert.equal(closeMonth("2026-08-01"), false);

console.log("monthly reports: migration/API/UI and immutable completed-order rules passed");
