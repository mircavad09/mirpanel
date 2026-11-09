import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {localEmployeeDatabase} from './employee-local-postgres.mjs';
import {adminPendingDeliveries} from '../mirpanel-admin/community/order-delivery.mjs';

const db=await localEmployeeDatabase();
const pool={query:async(text,args=[])=>({rows:await db.sql.unsafe(text,args)})};
try{
 await db.exec(`
  create schema mirpanel_community;
  create table public.payment_orders(id uuid primary key,status text,payment_confirmed boolean,payment_source text,
    completed_at timestamptz,product_title text,plan_name text,product_id text,checkout_snapshot jsonb,amount numeric,quantity integer);
  create table mirpanel_community.community_order_owners(order_id uuid primary key);
  create table mirpanel_community.customer_order_mail(event_key text primary key);
  create table mirpanel_community.customer_order_deliveries(id uuid primary key,order_id uuid,line_index int,quantity int,delivered_at timestamptz default now(),actor text);
 `);
 async function add(status,payment,completed,source='card',snapshot={}){
  const id=randomUUID();
  await pool.query("insert into public.payment_orders values($1,$2,$3,$4,case when $5::boolean then now() end,'Netflix','1 ay','netflix',$6,5,1)",[id,status,payment,source,completed,snapshot]);
  await pool.query('insert into mirpanel_community.community_order_owners values($1)',[id]);
  await pool.query('insert into mirpanel_community.customer_order_mail values($1)',['payment:'+id]);
  return id;
 }
 const legacy=await Promise.all(Array.from({length:18},()=>add('approved',false,true)));
 const wallet=await add('reviewing',true,false,'wallet');
 const card=await add('approved',true,true,'card',{cartVersion:2,items:[{productId:'netflix',title:'Netflix',quantity:2},{productId:'spotify',title:'Spotify',quantity:1}]});
 await add('completed',true,true);
 await add('rejected',true,true);
 await add('cancelled',true,true);
 await add('reviewing',false,false);
 const delivery=(id,line,qty)=>pool.query("insert into mirpanel_community.customer_order_deliveries(id,order_id,line_index,quantity,actor) values($1,$2,$3,$4,'synthetic')",[randomUUID(),id,line,qty]);
 await delivery(card,0,1);
 const counts=()=>adminPendingDeliveries(pool,undefined,{progress:true});
 const start=await counts();
 assert.equal(start.length,2);
 assert.deepEqual(start.find(o=>o.id===card)?.remaining,[1,1]);
 assert.deepEqual(await adminPendingDeliveries(pool,legacy),[]);
 await delivery(wallet,0,1);
 assert.deepEqual(await counts(),[{id:card,remaining:[1,1]}]);
 assert.equal((await pool.query("select count(*)::int n from public.payment_orders where status='approved' and payment_confirmed is false")).rows[0].n,18);
 console.log('18 historical approvals preserved; delivery queue 2 → 1, partial counted once, terminal statuses excluded.');
}finally{await db.close();}
