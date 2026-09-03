import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/202609010001_payment_method_activation_policy.sql");
const noRestoreMigration = read("supabase/migrations/202609020001_disable_payment_method_restore.sql");
const statusQueueMigration = read("supabase/migrations/202609030002_payment_method_status_queue_regression.sql");
const store = read("mirpanel-admin/payment-store.mjs");
const api = read("mirpanel-admin/payment-api.mjs");
const admin = read("mirpanel-admin/public/payment-admin.js");

for (const value of [
  "manual_disabled boolean not null default false", "auto_priority integer not null default 1000",
  "payment_method_activation_days", "payment_method_auto_promotions", "payment_baku_date()",
  "refresh_payment_method_automation", "set_payment_method_active_admin", "restore_payment_method_safely",
  "reserve_payment_method_v3", "approve_payment_order_v6", "update_payment_method_admin", "on conflict do nothing"
]) assert.ok(migration.includes(value), `activation migration missing ${value}`);

assert.match(migration, /when r\.provider_group = 'm10'.*then 1[\s\S]*kapital'.*then 2[\s\S]*abb'.*then 3[\s\S]*leo'.*then 4/i);
assert.match(migration, /m\.manual_disabled = false[\s\S]*m\.active = false[\s\S]*m\.auto_priority > v_source\.auto_priority/i);
assert.match(migration, /primary key \(usage_day, source_method_id\)/i);
assert.match(migration, /deleted_at is null[\s\S]*archived = false/i);
assert.match(migration, /manual_disabled = not p_active/i);
assert.equal(/delete from public\.payment_methods/i.test(migration), false);
assert.match(store, /rpc\("payment_method_queue_snapshot"/);
assert.ok(store.includes('rpc("reserve_payment_method_v3"'));
assert.ok(store.includes('rpc("approve_payment_order_v6"'));
assert.match(api, /archive\|delete\|activate\|deactivate\|reset-counter/);
for (const value of ["Aktiv", "Deaktiv", "Gözləmədə", "Limit dolub", "Silinib", "data-toggle-payment-method", "data-delete-payment-method", "Növbəti sıfırlanma"]) assert.ok(admin.includes(value), `admin UI missing ${value}`);
assert.equal(admin.includes("data-restore-payment-method"), false, "Silinmiş kart üçün bərpa düyməsi olmamalıdır");
assert.equal(api.includes("|restore|"), false, "Kart bərpa endpoint-i olmamalıdır");
assert.match(noRestoreMigration, /revoke execute on function public\.restore_payment_method_safely/i);
assert.match(statusQueueMigration, /not exists[\s\S]*payment_reservations[\s\S]*status='reviewing'/i);
assert.match(statusQueueMigration, /when q\.active[\s\S]*then 0[\s\S]*when q\.active[\s\S]*then 1[\s\S]*confirmed_count>=q\.daily_limit then 2/i);
assert.match(statusQueueMigration, /pg_advisory_xact_lock\(714025001\)/i);

function simulate(day, methods, saturatedIds) {
  const seeded = methods.map((item) => ({ ...item, active: !item.manualDisabled && item.priority <= 4 }));
  const promotions = new Set();
  for (const source of seeded.filter((item) => item.active && saturatedIds.has(item.id)).sort((a, b) => a.priority - b.priority)) {
    source.active = false;
    if (promotions.has(`${day}:${source.id}`)) continue;
    promotions.add(`${day}:${source.id}`);
    const next = seeded.filter((item) => !item.active && !item.manualDisabled && !item.deleted && item.priority > source.priority && !saturatedIds.has(item.id)).sort((a, b) => a.priority - b.priority)[0];
    if (next) next.active = true;
  }
  return seeded;
}

const cards = [
  { id: "m10", priority: 1 }, { id: "kapital", priority: 2 }, { id: "abb", priority: 3 }, { id: "leo", priority: 4 },
  { id: "backup-1", priority: 101 }, { id: "backup-2", priority: 102 }, { id: "manual-off", priority: 103, manualDisabled: true }, { id: "deleted", priority: 104, deleted: true }
];
let result = simulate("2026-09-01", cards, new Set());
assert.deepEqual(result.filter((item) => item.active).map((item) => item.id), ["m10", "kapital", "abb", "leo"]);
result = simulate("2026-09-01", cards, new Set(["leo"]));
assert.equal(result.find((item) => item.id === "backup-1").active, true);
assert.equal(result.find((item) => item.id === "backup-2").active, false);
result = simulate("2026-09-01", cards, new Set(["leo", "backup-1"]));
assert.equal(result.find((item) => item.id === "backup-2").active, true);
assert.equal(result.find((item) => item.id === "manual-off").active, false);
assert.equal(result.find((item) => item.id === "deleted").active, false);

console.log("PASS: payment method activation, fallback, soft-delete, Baku reset and checkout guards.");
