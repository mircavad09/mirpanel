// Explicit maintenance commands. Supplier requests in this script are GET only.
import fs from 'node:fs';
import pg from '../mirpanel-admin/node_modules/pg/lib/index.js';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {supplierRequest} from '../mirpanel-admin/supplier-request.mjs';
import {epinbyPlan} from '../epinby-product.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {adminDeliveryCompletions} from '../mirpanel-admin/community/order-delivery.mjs';
import {reportOrderFinance} from '../mirpanel-admin/payment-order-report.mjs';
import {durationStatistics} from '../mirpanel-admin/payment-order-duration.mjs';
import {epinbyRate,readEpinbyOrderCosts,saveCatalogCost,supplierCost,supplierCharge} from '../mirpanel-admin/epinby-finance.mjs';

const mode=process.argv[2]||'inspect';
if(!['inspect','migrate','repair','verify'].includes(mode))throw Error('Unknown maintenance command');
const renderKey=fs.readFileSync(process.env.USERPROFILE+'/.render/cli.yaml','utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const response=await fetch('https://api.render.com/v1/services/srv-dbse90u1egvs73djpp2g/env-vars?limit=100',{headers:{Authorization:'Bearer '+renderKey},signal:AbortSignal.timeout(15000)});
if(!response.ok)throw Error('Render HTTP '+response.status);
const env=Object.fromEntries((await response.json()).map(x=>[x.envVar.key,x.envVar.value]));
const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},connectionTimeoutMillis:12000});
const rate=epinbyRate(env);
const schema='mirpanel_community.';
const provider='e91bb000-0000-4000-8000-000000000001';
async function readData(){
 const c=await pool.connect();
 try{
  await c.query('begin read only');
  const link=(await c.query(`select api_key_cipher,last_status from ${schema}epinby_connection where id`)).rows[0];
  const units=(await c.query(`select o.order_code,o.product_title,u.id,u.external_id,(d.settings->>'productId')::int product_id,d.settings->>'type' type,
    to_jsonb(u)->'execution_quote' execution_quote,to_jsonb(u)->'supplier_charge' supplier_charge
    from ${schema}epinby_order_units u join ${schema}api_dispatches d on d.id=u.dispatch_id join public.payment_orders o on o.id=d.order_id
    where d.supplier_id=$1 and u.state='delivered' order by o.created_at,u.unit_index`,[provider])).rows;
  await c.query('commit');return {link,units};
 }catch(error){await c.query('rollback');throw error;}finally{c.release();}
}
async function todayReport(){
 const c=await pool.connect();
 try{
  await c.query('begin read only');
  const day=(await c.query("select (now() at time zone 'Asia/Baku')::date::text as report_day")).rows[0].report_day;
  const start=new Date(day+'T00:00:00+04:00'),end=new Date(+start+864e5);
  const matches=(await adminDeliveryCompletions(c,{since:start.toISOString()})).filter(o=>+new Date(o.completedAt)<+end);
  const completions=new Map(matches.map(o=>[o.id,o.completedAt]));
  const rows=(await c.query(`select id,order_code,product_id,product_title,plan_id,plan_name,quantity,amount,status,completed_at,sale_price_snapshot,cost_price_snapshot,
    cost_lines_snapshot,cost_source,fulfillment_cancellation,checkout_snapshot->'items' cart_items from public.payment_orders
    where currency='AZN' and (id=any($1::uuid[]) or (status in ('approved','completed') and completed_at >= $2 and completed_at<$3
      and not exists(select 1 from ${schema}customer_order_deliveries d where d.order_id=payment_orders.id)))`,[[...completions.keys()],start.toISOString(),end.toISOString()])).rows;
  const ids=rows.map(r=>r.id);
  const refunds=new Map((await c.query(`select order_id,cents from ${schema}community_refunds where order_id=any($1::uuid[])`,[ids])).rows.map(r=>[r.order_id,r.cents]));
  const costs=await readEpinbyOrderCosts(c,ids);
  const ready=rows.map(o=>reportOrderFinance({...o,status:'completed',completed_at:completions.get(o.id)||o.completed_at},refunds.get(o.id),costs.get(o.id)));
  const report=durationStatistics(ready,{completeCosts:true});
  console.log(JSON.stringify({day,count:report.count,revenue:report.revenue,cost:report.cost,profit:report.profit,missing:ready.filter(x=>x.cost_price_snapshot==null).map(x=>({order:x.order_code,product:x.product_title,reason:x.costEvidence?.flatMap(l=>l.costs.map(c=>c.reason).filter(Boolean))})),freeFire:report.plans.filter(x=>x.productTitle==='Free Fire')}));
  await c.query('commit');
 }catch(error){await c.query('rollback');throw error;}finally{c.release();}
}
try{
 if(mode==='migrate')await pool.query(fs.readFileSync('supabase/migrations/202611160020_epinby_finance.sql','utf8'));
 else if(mode==='verify')await todayReport();
 else{
  const {link,units}=await readData();
  if(link?.last_status!=='confirmed')throw Error('Epinby connection is not confirmed');
  const security=createPaymentSecurity({encryptionKey:env.PAYMENT_ENCRYPTION_KEY_B64,tokenSecret:env.PAYMENT_TOKEN_SECRET_B64});
  const key=security.decryptSecret(link.api_key_cipher);
  const send=(path,query)=>supplierRequest({base:'https://epinby.com',path:'/api/v1/'+path,query,allowlist:new Set(['https://epinby.com']),key,authHeader:'X-API-Key',jsonResponse:true,maxResponseBytes:524288});
  for(const unit of units){
   let charge=unit.supplier_charge;
   if(!charge&&/^\d+$/.test(unit.external_id||'')){
    try{
     const reply=await send((unit.type==='TELEGRAM_STARS'?'telegram-stars/':'')+'order/'+unit.external_id);
     const d=reply?.data;
     if(reply?.success===true&&String(d?.order_id)===unit.external_id&&d?.client_order_id===unit.id&&
       d.status==='COMPLETED'&&(d.product_id==null||Number(d.product_id)===unit.product_id)&&(d.qty==null||Number(d.qty)===1))
      charge=supplierCharge(d,unit,unit.execution_quote,rate);
    }catch{}
   }
   if(mode==='repair'&&charge&&!unit.supplier_charge)
    await pool.query(`update ${schema}epinby_order_units set supplier_charge=$3 where id=$1 and state='delivered' and external_id=$2 and supplier_charge is null`,[unit.id,unit.external_id,charge]);
   console.log(JSON.stringify({order:unit.order_code,product:unit.product_title,charge,reason:charge?null:'Uğurlu Epinby əməliyyatının qiymət və valyutası təsdiqlənmədi.'}));
  }
  const live=await fetch('https://mirpanel.com/app.js',{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(!live.ok)throw Error('Storefront catalog HTTP '+live.status);
  const catalog=extractAdminState(await live.text());
  const linked=new Set(catalog.products.flatMap(p=>(p.plans||[]).map(plan=>epinbyPlan(p,plan)?.productId).filter(Boolean)));
  if(!linked.size)throw Error('No Epinby mappings in the published catalog; refusing update');
  const found=new Map();
  let scannedPages=0;
  for(let page=1;page<=10000;page++){
   const result=await send('products',{page,per_page:50});
   const last=Number(result?.meta?.last_page);
   if(result?.success!==true||!Array.isArray(result.data)||Number(result.meta?.current_page)!==page||!Number.isSafeInteger(last)||last<0||last>10000)
    throw Error('Epinby catalog page could not be verified: '+page);
   scannedPages=page;
   for(const item of result.data){
    const id=Number(item.id);
    if(linked.has(id))found.set(id,supplierCost(item,{source:'catalog',productId:id,rate}));
   }
   if(found.size===linked.size||page>=last)break;
  }
  for(const id of linked)if(!found.has(id)){
   const cost=supplierCost(null,{source:'catalog',productId:id,rate});cost.reason='Paket Epinby kataloqunda tapılmadı.';found.set(id,cost);
  }
  if(mode==='repair')for(const cost of found.values())await saveCatalogCost(pool,cost);
  console.log(JSON.stringify({mode,scannedPages,linked:linked.size,known:[...found.values()].filter(c=>c.azn!=null).length,
    unknown:[...found.values()].filter(c=>c.azn==null).map(({productId,reason})=>({productId,reason})),rate}));
 }
 if(mode==='migrate')console.log('Epinby finance migration applied');
}catch(error){console.error('Epinby finance maintenance:',error.code||error.name,error.position||'');process.exitCode=1;}
finally{await pool.end();}
