import assert from "node:assert/strict";
import { createPaymentStore } from "../mirpanel-admin/payment-store.mjs";
import { expiryStatus } from "../mirpanel-admin/payment-order-lifecycle.mjs";

const now = new Date("2026-10-01T12:00:00+04:00");
assert.equal(expiryStatus("2026-10-10", new Date("2026-10-08T12:00:00+04:00")).due, false);
assert.equal(expiryStatus("2026-10-10", new Date("2026-10-09T12:00:00+04:00")).code, "tomorrow");
assert.equal(expiryStatus("2026-10-10", new Date("2026-10-10T12:00:00+04:00")).code, "expired");

const ids = Array.from({ length: 6 }, (_, index) => `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`);
const rows = new Map(ids.map((id, index) => [id, {
  id,
  order_code: `TEST-${index + 1}`,
  status: "completed",
  contacted_at: null,
  expiry_notification_on: index === 5 ? null : index % 2 ? "2026-09-30" : "2026-10-01"
}]));
const store = createPaymentStore({ supabaseUrl: "https://example.supabase.co", supabaseSecretKey: "test", receiptsBucket: "test" });
store.getOrder = async (id) => ({ ...rows.get(id) });
store.contactOrder = async (id) => {
  const row = rows.get(id);
  if (row.contacted_at) return { idempotent: true };
  row.contacted_at = now.toISOString();
  return { idempotent: false };
};

const first = await store.contactExpiringOrders(ids, "test-admin", now);
assert.equal(first.completed.length, 5);
assert.equal(first.skipped.length, 1);
assert.equal(first.skipped[0].reason, "Bitmə tarixi müəyyən edilməyib.");

const repeated = await store.contactExpiringOrders(ids.slice(0, 5), "test-admin", now);
assert.equal(repeated.completed.length, 0);
assert.equal(repeated.skipped.length, 5);
assert.ok(repeated.skipped.every((item) => item.reason === "Sifariş artıq bitən məhsullar siyahısına uyğun deyil."));

console.log(JSON.stringify({ ok: true, octoberWindow: { oct8: false, oct9: true, oct10: true }, batchCompleted: 5, duplicateCompleted: 0 }, null, 2));
