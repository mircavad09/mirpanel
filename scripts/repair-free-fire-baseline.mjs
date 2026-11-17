// Explicit owner-authorized baseline edit only. Never creates a sale/delivery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
const apply=process.argv.includes('--apply');
const key=fs.readFileSync(process.env.USERPROFILE+'/.render/cli.yaml','utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const response=await fetch('https://api.render.com/v1/services/srv-dbse90u1egvs73djpp2g/env-vars?limit=100',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('Configuration HTTP '+response.status);
const env=Object.fromEntries((await response.json()).map(x=>[x.envVar.key,x.envVar.value]));
const target=new URL(env.COMMUNITY_DATABASE_URL);
if(!decodeURIComponent(target.username).endsWith('.sidgtcgyqkdplgfabmmp')&&target.hostname!=='db.sidgtcgyqkdplgfabmmp.supabase.co')throw Error('Wrong database project');
const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},max:1,connectionTimeoutMillis:15000,options:'-c statement_timeout=20000 -c lock_timeout=5000'+(apply?'':' -c default_transaction_read_only=on')});
const c=await pool.connect();
async function evidence(){
 const order=(await c.query(`select o.id,o.order_code,o.payment_confirmed,o.status,
 (select min(d.delivered_at) from mirpanel_community.customer_order_deliveries d where d.order_id=o.id) delivered_at,
 (select coalesce(sum(quantity),0)::int from public.product_sales_delivered_units s where s.order_id=o.id and s.product_id='free_fire') counted,
 (select count(*)::int from mirpanel_community.epinby_order_units u join mirpanel_community.api_dispatches a on a.id=u.dispatch_id where a.order_id=o.id and u.state='delivered') supplier_delivered
 from public.payment_orders o where o.order_code::text='12919' and o.product_title='Free Fire'`)).rows;
 assert.equal(order.length,1);assert.equal(order[0].payment_confirmed,true);assert.equal(order[0].counted,1);assert.equal(order[0].supplier_delivered,1);
 return {order:'12919',product:'Free Fire',deliveredAt:order[0].delivered_at,verifiedUnits:1,alreadyCounted:1};
}
try{
 const proof=await evidence();
 const before=(await c.query('select public.product_sales_snapshot() v')).rows[0].v;
 const baseline=before.baselines.find(p=>p.product_id==='free_fire').count;
 assert.ok([3,4].includes(baseline),'Baseline changed since approval; do not overwrite');
 if(!apply){console.log(JSON.stringify({mode:'read-only',...proof,baseline,real:before.real.find(p=>p.product_id==='free_fire')?.count||0,proposedBaseline:4}));}
 else{
  const backup=path.join('outputs','sales-counter','before-'+Date.now()+'.json');fs.mkdirSync(path.dirname(backup),{recursive:true});
  const tables={};for(const name of ['product_sales_settings','product_sales_baselines','product_sales_audit','product_sales_legacy_units'])tables[name]=(await c.query('select * from public.'+name)).rows;
  const definitions=(await c.query("select p.proname,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('product_sales_save','product_sales_check_total','product_sales_snapshot')")).rows;
  fs.writeFileSync(backup,JSON.stringify({capturedAt:new Date().toISOString(),snapshot:before,tables,definitions},null,2));
  await c.query(fs.readFileSync('mirpanel-admin/community/product-sales-baselines.sql','utf8'));
  await c.query('begin');
  try{
   await c.query('select id from public.product_sales_settings where id=1 for update');
   const current=(await c.query('select public.product_sales_snapshot() v')).rows[0].v;
   assert.ok([3,4].includes(current.baselines.find(p=>p.product_id==='free_fire').count));await evidence();
   const items=current.baselines.map(p=>({...p,count:p.product_id==='free_fire'?4:p.count}));
   const changed=(await c.query('select public.product_sales_save($1,$2,$3) changed',[JSON.stringify(items),'maintenance:owner-authorized-free-fire-baseline-20261117',current.version])).rows[0].changed;
   const after=(await c.query('select public.product_sales_snapshot() v')).rows[0].v;
   assert.deepEqual(after.baselines.filter(p=>p.product_id!=='free_fire'),current.baselines.filter(p=>p.product_id!=='free_fire'));
   assert.deepEqual(after.real,current.real,'Do not insert a second sale');
   assert.equal(after.baselines.find(p=>p.product_id==='free_fire').count,4);
   await c.query('commit');
   console.log(JSON.stringify({changed,...proof,beforeBaseline:baseline,afterBaseline:4,real:after.real.find(p=>p.product_id==='free_fire').count,total:4+after.real.find(p=>p.product_id==='free_fire').count,otherBaselinesUnchanged:true,salesLedgerUnchanged:true,backup}));
  }catch(error){await c.query('rollback');throw error;}
 }
}finally{c.release();await pool.end();}
