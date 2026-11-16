import {signature} from '../employee-security.mjs';
import {planKey} from '../payment-profit.mjs';
import {freeManagementClause} from './ready-stock-management.mjs';
import {epinbyPlan} from '../../epinby-product.mjs';

export async function ensureReadyDeliverySettings(db){
 if(!(await db.query("select to_regclass('mirpanel_community.ready_stock_plans') present")).rows[0].present)return;
 if((await db.query("select exists(select 1 from pg_attribute where attrelid='mirpanel_community.ready_stock_plans'::regclass and attname='allow_waiting' and not attisdropped) present")).rows[0].present)return;
 await db.query('alter table mirpanel_community.ready_stock_plans add column if not exists allow_waiting boolean not null default false');
}

// Public counts only: never read/decrypt credentials. Match the allocator's exact
// SKU and exclude deleted, assigned and reserved units from instant availability.
export async function readyDeliverySnapshot(db,catalog){
 if(!(await db.query("select to_regclass('mirpanel_community.ready_stock_plans') present")).rows[0].present)return new Map();
 const free=await freeManagementClause(db);
 const rows=(await db.query(`select p.product_id,p.plan_key,p.plan_signature,p.auto_wallet,
  coalesce((to_jsonb(p)->>'allow_waiting')::boolean,false) allow_waiting,
  greatest(0,(select count(*) from mirpanel_community.ready_stock_units u
   where (u.product_id,u.plan_key,u.plan_signature)=(p.product_id,p.plan_key,p.plan_signature)
   and u.delivery_id is null${free})-(select count(*) from mirpanel_community.shop_lines l
   join public.payment_reservations r on r.id=l.reservation_id
   where l.product_id=p.product_id and l.snapshot->>'sourcePlanKey'=p.plan_key
   and l.snapshot->>'signature'=p.plan_signature and r.status='reserved'
   and r.expires_at>clock_timestamp()))::int ready
  from mirpanel_community.ready_stock_plans p`)).rows;
 const enabled=(await db.query('select enabled from mirpanel_community.ready_stock_release where id')).rows[0]?.enabled===true;
 const rooms=(await db.query("select to_regclass('mirpanel_community.netflix_room_sellable') present")).rows[0].present;
 const roomCount=rooms?(await db.query('select count(*)::int n from mirpanel_community.netflix_room_sellable')).rows[0].n:null;
 const map=new Map();
 for(const p of catalog.products){
  const plans=(p.plans||[]).map((plan,i)=>{
   if(epinbyPlan(p,plan)||p.supplier?.provider==='epinby'||plan.supplier?.provider==='epinby')return null;
   const setting=rows.find(r=>r.product_id===p.id&&r.plan_key===planKey(plan,i)&&r.plan_signature===signature(plan));
   const netflix=p.id==='netflix'&&roomCount!==null&&!plan.durationDays&&[1,3,6].includes(Number(plan.durationMonths??plan.months));
   return {planKey:String(i),ready:netflix?roomCount:setting?.ready??0,
    automatic:enabled&&(netflix||setting?.auto_wallet===true),allowWaiting:setting?.allow_waiting===true};
  });
  if(plans.some(Boolean))map.set(p.id,plans);
 }
 return map;
}

export async function saveReadyDeliverySettings(pool,catalog,actor,input){
 const {productId,index,planSignature,allowWaiting}=input||{};
 const product=catalog.products.find(p=>p.id===productId),plan=product?.plans?.[index];
 if(!Number.isSafeInteger(index)||!plan||signature(plan)!==planSignature||typeof allowWaiting!=='boolean'||epinbyPlan(product,plan)||product.supplier?.provider==='epinby'||plan.supplier?.provider==='epinby')
  throw Object.assign(Error('Təhvil ayarı üçün uyğun hazır hesab paketini seçin.'),{status:400});
 const c=await pool.connect();
 try{
  await c.query('begin');
  await c.query('insert into mirpanel_community.ready_stock_plans(product_id,plan_key,plan_signature,allow_waiting) values($1,$2,$3,$4) on conflict(product_id,plan_key,plan_signature) do update set allow_waiting=excluded.allow_waiting',
   [productId,planKey(plan,index),planSignature,allowWaiting]);
  await c.query(`insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata)
   values('admin',$1,'ready_stock.delivery_setting','product',$2,$3)`,[actor,productId,{index,allowWaiting}]);
  await c.query('commit');return {saved:true};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
