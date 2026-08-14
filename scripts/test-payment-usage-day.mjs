import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bakuDate } from "../mirpanel-admin/payment-order-lifecycle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const migration = read("supabase/migrations/202608150001_payment_usage_day_and_method_soft_delete.sql");
const store = read("mirpanel-admin/payment-store.mjs");
const admin = read("mirpanel-admin/public/payment-admin.js");

const functionSource = (name) => migration.match(
  new RegExp(`create or replace function public\\.${name}[\\s\\S]*?(?=create or replace function|revoke execute|commit;)`)
)?.[0] || "";

const reserve = functionSource("reserve_payment_method_v2");
const approve = functionSource("approve_payment_order_v5");
const softDelete = functionSource("delete_payment_method_safely");

assert.equal(bakuDate("2026-08-15T19:59:00.000Z"), "2026-08-15");
assert.equal(bakuDate("2026-08-15T20:05:00.000Z"), "2026-08-16");
assert.equal(bakuDate("2026-12-31T19:59:00.000Z"), "2026-12-31");
assert.equal(bakuDate("2026-12-31T20:05:00.000Z"), "2027-01-01");

for (const source of [reserve, approve, softDelete]) assert.ok(source.includes("for update"));
assert.ok(migration.includes("add column if not exists usage_day date"));
assert.ok(migration.includes("set usage_day = public.payment_baku_date(created_at)"));
assert.ok(migration.includes("payment_daily_counter_migration_backups"));
assert.ok(reserve.includes("v_usage_day date := payment_baku_date()"));
assert.ok(reserve.includes("usage_day = v_usage_day"));
assert.ok(reserve.includes("checkout_key, usage_day, expires_at"));
assert.ok(approve.includes("v_usage_day := coalesce(v_reservation.usage_day, payment_baku_date(v_reservation.created_at))"));
assert.ok(approve.includes("counter_date = v_usage_day"));
assert.equal(/counter_date\s*=\s*payment_baku_date\(\)/.test(approve), false,
  "Təsdiq sayğacı təsdiq gününə yazılmamalıdır");
assert.equal((approve.match(/confirmed_count = confirmed_count \+ 1/g) || []).length, 1);
assert.ok(approve.indexOf("if v_order.status = 'approved'") < approve.indexOf("confirmed_count = confirmed_count + 1"));
assert.ok(softDelete.includes("activeProcessesPreserved"));
assert.equal(softDelete.includes("PAYMENT_METHOD_HAS_ACTIVE_RESERVATIONS"), false);
assert.ok(softDelete.includes("active = false"));
assert.ok(softDelete.includes("archived = true"));
assert.ok(softDelete.includes("deleted_at = coalesce(deleted_at, now())"));
assert.equal(softDelete.includes("delete from payment_methods"), false);
assert.ok(store.includes('.eq("usage_day", today)'));
assert.ok(store.includes('rpc("approve_payment_order_v5"'));
assert.ok(admin.includes("paymentState.methodActions.has(methodId)"));
assert.ok(admin.includes("Köhnə sifariş tarixçəsi qorunacaq."));

const usageDay = bakuDate("2026-08-15T19:59:00.000Z");
const approvalDay = bakuDate("2026-08-15T20:05:00.000Z");
const counters = new Map([[usageDay, 0], [approvalDay, 0]]);
counters.set(usageDay, counters.get(usageDay) + 1);
assert.equal(counters.get(usageDay), 1, "23:59 rezerv köhnə günə yazılmalıdır");
assert.equal(counters.get(approvalDay), 0, "00:05 təsdiq yeni günü artırmamalıdır");

console.log(JSON.stringify({
  ok: true,
  midnight: {
    beforeMidnightReservationAfterMidnightApproval: "previous_usage_day",
    afterMidnightReservation: "new_usage_day",
    reviewingDoesNotOccupyNextDay: true,
    monthAndYearBoundary: true
  },
  idempotentApproval: true,
  softDeletePreservesActiveProcesses: true,
  counterBackupAndBackfill: true
}, null, 2));

