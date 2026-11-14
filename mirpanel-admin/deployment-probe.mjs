import pg from 'pg';
import {extractAdminState} from './core.mjs';
let pool;
export async function readOnlyDeploymentProbe(env,loadCatalog){
 pool??=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,max:1,ssl:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},connectionTimeoutMillis:15000,options:'-c default_transaction_read_only=on -c statement_timeout=15000 -c search_path=mirpanel_community,public'});
 const started=performance.now(),c=await pool.connect();
 try{
  await c.query('begin read only');
  const times=[];for(let i=0;i<5;i++){const at=performance.now();await c.query('select 1');times.push(Math.round((performance.now()-at)*10)/10);}
  const state=(await c.query(`select current_setting('transaction_read_only')='on' read_only,
   (select count(*)::int from public.payment_orders where status not in ('cancelled','rejected','expired','completed')) active_orders,
   (select count(*)::int from mirpanel_community.customer_order_deliveries) deliveries,
   (select count(*)::int from storage.buckets) storage_buckets`)).rows[0];
  await c.query('rollback');
  const at=performance.now(),catalog=extractAdminState((await loadCatalog()).source);
  return {ok:true,database:state,queryMs:times,dbTotalMs:Math.round(performance.now()-started),catalogMs:Math.round(performance.now()-at),catalogProducts:catalog.products?.length||0};
 }finally{await c.query('rollback').catch(()=>{});c.release();}
}
