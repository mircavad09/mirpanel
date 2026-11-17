// Production observation only. No credentials, customer fields or delivery messages are printed.
import fs from 'node:fs';
import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const key=fs.readFileSync(process.env.USERPROFILE+'/.render/cli.yaml','utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const response=await fetch('https://api.render.com/v1/services/srv-dbse90u1egvs73djpp2g/env-vars?limit=100',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('Configuration HTTP '+response.status);
const env=Object.fromEntries((await response.json()).map(x=>[x.envVar.key,x.envVar.value]));
const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},max:1,connectionTimeoutMillis:15000,options:'-c default_transaction_read_only=on -c statement_timeout=20000'});
try{
 const snap=(await pool.query('select public.product_sales_snapshot() v')).rows[0].v;
 const catalog=extractAdminState(fs.readFileSync('app.js','utf8'));
 const titles=new Map(catalog.products.map(p=>[p.id,p.title]));
 const rule=(await pool.query("select pg_get_functiondef('public.product_sales_snapshot()'::regprocedure) definition")).rows[0].definition;
 const audit=(await pool.query(`select changed_at,operation,version,
 (select jsonb_agg(x) from jsonb_array_elements(after_values) x where (x->>'count')::int between 1 and 7) small_baselines
 from public.product_sales_audit order by changed_at desc limit 6`)).rows;
 const yesterday=(await pool.query(`select (now() at time zone 'Asia/Baku')::date::text today,((now() at time zone 'Asia/Baku')::date-1)::text yesterday`)).rows[0];
 const deliveries=(await pool.query(`select o.order_code,o.product_id,o.product_title,o.plan_name,o.status,o.payment_confirmed,
  o.quantity,o.checkout_snapshot->'items' cart_items,d.line_index,sum(d.quantity)::int delivered,min(d.delivered_at) first_delivery,max(d.delivered_at) last_delivery,
  coalesce((select sum(s.quantity)::int from public.product_sales_delivered_units s where s.order_id=o.id and s.line_index=d.line_index),0) counted
 from mirpanel_community.customer_order_deliveries d join public.payment_orders o on o.id=d.order_id
 where d.delivered_at>=(($1::date-1)::timestamp at time zone 'Asia/Baku')
 group by o.id,d.line_index order by last_delivery desc`,[yesterday.today])).rows;
 const baseline=snap.baselines||[],real=new Map((snap.real||[]).map(r=>[r.product_id,Number(r.count)]));
 const small=baseline.filter(r=>Number(r.count)<=7&&Number(r.count)>0).map(r=>({id:r.product_id,title:titles.get(r.product_id),baseline:Number(r.count),real:real.get(r.product_id)||0,total:Number(r.count)+(real.get(r.product_id)||0)}));
 const games=(await pool.query(`select o.order_code,o.product_id,o.product_title,o.plan_name,o.status,o.payment_confirmed,o.quantity,o.created_at,o.completed_at,
 (select coalesce(sum(d.quantity),0)::int from mirpanel_community.customer_order_deliveries d where d.order_id=o.id) delivered,
 (select coalesce(sum(s.quantity),0)::int from public.product_sales_delivered_units s where s.order_id=o.id) counted,
 (select jsonb_agg(jsonb_build_object('state',u.state,'unit',u.unit_index)) from mirpanel_community.epinby_order_units u join mirpanel_community.api_dispatches a on a.id=u.dispatch_id where a.order_id=o.id) supplier_units
 from public.payment_orders o where (o.product_id in ('free_fire','pubg_mobile','epinby_3436') or o.product_title ilike '%Free Fire%') order by o.created_at desc limit 15`)).rows;
 console.log(JSON.stringify({dates:yesterday,countingRule:snap.countingRule,installedRuleIsDelivery:rule.includes('product_sales_delivered_units'),legacyCutover:snap.legacyCutover,smallBaselines:small,audit,recentDeliveries:deliveries.filter(d=>Number(baseline.find(b=>b.product_id===d.product_id)?.count)<=7||d.counted<d.delivered),gameOrders:games},null,2));
}finally{await pool.end();}
