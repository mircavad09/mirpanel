// Read-only production observation. Prints totals only, never customer data.
import fs from 'node:fs';import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
const key=fs.readFileSync(process.env.USERPROFILE+'/.render/cli.yaml','utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const r=await fetch('https://api.render.com/v1/services/srv-dbse90u1egvs73djpp2g/env-vars?limit=100',{headers:{Authorization:'Bearer '+key}});if(!r.ok)throw Error('CONFIG_READ_'+r.status);
const env=Object.fromEntries((await r.json()).map(x=>[x.envVar.key,x.envVar.value]));
const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},max:1,options:'-c search_path=mirpanel_community,public -c default_transaction_read_only=on -c statement_timeout=15000'});
try{
 const {rows}=await pool.query(`with recent as (
  select o.id,o.status,o.fulfillment_cancellation,o.checkout_snapshot from payment_orders o
  where o.checkout_snapshot->>'cartVersion'='2' and o.status not in ('cancelled','rejected','expired')
   and (o.payment_confirmed or o.status in ('approved','completed'))
   and exists(select 1 from jsonb_array_elements(o.checkout_snapshot->'items') x where x->>'productId'='netflix')
   and exists(select 1 from jsonb_array_elements(o.checkout_snapshot->'items') x where x->>'productId'='prime')
  order by o.created_at desc limit 20
 ), lines as (
  select o.id,o.fulfillment_cancellation,x.value->>'productId' product,(x.value->>'quantity')::int quantity,
   coalesce((select sum(d.quantity)::int from customer_order_deliveries d where d.order_id=o.id and d.line_index=x.ordinality-1),0) delivered
  from recent o cross join lateral jsonb_array_elements(o.checkout_snapshot->'items') with ordinality x
 ), orders as (select id,bool_and(delivered>=quantity) complete,bool_or(delivered>0) some_delivered from lines group by id)
 select (select count(*)::int from orders) observed_orders,
 (select count(*)::int from orders where some_delivered and not complete) partial_orders,
 (select count(*)::int from orders where complete) completed_orders,
 (select count(*)::int from orders where not some_delivered) not_yet_delivered,
 (select count(*)::int from lines n where n.product='netflix' and n.delivered>0 and exists(select 1 from lines p where p.id=n.id and p.product='prime' and p.delivered<p.quantity)) netflix_delivered_while_prime_waiting`);
 console.log(JSON.stringify({scope:'production read-only, latest 20 matching paid orders',...rows[0],productionWrites:0}));
}finally{await pool.end();}
