import { counts } from "./public-service.mjs";

export async function adminDashboard(pool) {
  const [users, orders, wallet] = await Promise.all([
    counts(pool, { website: true }),
    pool.query(`select count(*)::int as total,
      count(*) filter (where status in ('reviewing','new_receipt_requested'))::int as pending
      from public.payment_orders`),
    pool.query("select coalesce(sum(cents),0)::text as cents from wallet_accounts")
  ]);
  return {
    users: users.members,
    online: users.online,
    orders: orders.rows[0].total,
    pendingOrders: orders.rows[0].pending,
    walletCents: wallet.rows[0].cents
  };
}
