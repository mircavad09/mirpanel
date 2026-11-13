import crypto from 'node:crypto';
import {withReadyAccountHistory} from './ready-stock-management.mjs';
import {bakuDate,safeCalendarDate} from '../payment-order-lifecycle.mjs';
import {readProductMessages} from './ready-stock-product-messages.mjs';
import {roomSalesInstalled} from './netflix-room-sale.mjs';

const T='mirpanel_community.netflix_room_legacy';
export const legacyRoomSource='Əvvəlki satış — admin tərəfindən əlavə edilib';
const fail=(status,message)=>Object.assign(Error(message),{status});
const uuid=v=>typeof v==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v);
export async function legacyInstalled(pool){return !!(await pool.query('select to_regclass($1) present',[T])).rows[0].present;}
export async function assignLegacyRoom(pool,security,catalog,input){
 if(!await legacyInstalled(pool))throw fail(503,'Otaqları müştəriyə bağlamaq üçün baza yeniləməsi lazımdır.');
 const {action,id,userId,paidUntil}=input||{};
 if(action==='search'){
  const q=String(input.q??'').trim().slice(0,160);
  if(!q)return {users:[]};
  const pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
  const {rows}=await pool.query(`select u.id,u.name,u.email,n.member_number as "memberNumber"
   from mirpanel_community."user" u left join mirpanel_community.community_member_numbers n on n.user_id=u.id
   where n.member_number is not null and (u.name ilike $1 or u.email ilike $1 or n.member_number::text=$2)
   order by u.name,u.id limit 20`,[pattern,q.replace(/^#/,'')]);
  return {users:rows};
 }
 if(!uuid(id)||!['open','confirm'].includes(action))throw fail(400,'Otaq sorğusu düzgün deyil.');
 const c=await pool.connect();
 try{
  await c.query('begin');
  if(action==='confirm')await c.query('select pg_advisory_xact_lock(714025001)');
  const room=(await c.query(`select r.*,g.account_cipher,g.id group_id from mirpanel_community.netflix_room_units r
   join mirpanel_community.netflix_room_groups g on g.id=r.group_id where r.id=$1 and to_jsonb(r)->>'deleted_at' is null for update of r`,[id])).rows[0];
  if(!room)throw fail(404,'Otaq tapılmadı.');
  if(action==='confirm'&&await roomSalesInstalled(c)&&(await c.query('select held from mirpanel_community.netflix_room_sale_state where id=$1',[id])).rows[0]?.held)
   throw fail(409,'Otaq aktiv sifariş üçün rezerv edilib.');
  const account=JSON.parse(security.decryptSecret(room.account_cipher)),pin=JSON.parse(security.decryptSecret(room.pin_cipher));
  if(account.id!==room.group_id||pin.id!==room.id||!/^\d{4}$/.test(pin.pin))throw Error('ROOM_REFERENCE_MISMATCH');
  if(action==='open'){await c.query('commit');return {email:account.email,room:room.room_name,pin:pin.pin};}
  if(typeof userId!=='string'||!userId||userId.length>200||typeof paidUntil!=='string'||!safeCalendarDate(paidUntil))throw fail(400,'Müştərini və ödənilmiş müddətin son tarixini seçin.');
  const customer=(await c.query('select user_id from mirpanel_community.community_member_numbers where user_id=$1 for key share',[userId])).rows[0];
  if(!customer)throw fail(404,'Müştəri tapılmadı.');
  const old=(await c.query(`select id,user_id,paid_until::text from ${T} where room_id=$1`,[id])).rows[0];
  if(old){
   if(old.user_id!==userId||old.paid_until!==paidUntil)throw fail(409,'Otaq artıq bağlanıb. Mövcud əlaqə dəyişdirilmədi.');
   await c.query('commit');return {assigned:true,replayed:true,orderCode:'LEG'+old.id.replaceAll('-','')};
  }
  if(paidUntil<bakuDate())throw fail(400,'Ödənilmiş müddətin son tarixi keçib.');
  if(room.delivery_id){
   const existing=(await c.query(`select l.user_id,o.order_code from mirpanel_community.customer_order_deliveries d
    join mirpanel_community.community_order_owners l on l.order_id=d.order_id join public.payment_orders o on o.id=d.order_id where d.id=$1`,[room.delivery_id])).rows[0];
   if(existing?.user_id!==userId)throw fail(409,'Otaq artıq başqa sifarişə ayrılıb.');
   await c.query('commit');return {assigned:true,reused:true,orderCode:String(existing.order_code)};
  }
  // No provider call, wallet movement, payment order or email is created here.
  const owner=(await c.query('select user_id from mirpanel_community.owner_identity where id=true')).rows[0];
  if(!owner)throw fail(403,'Sahib-admin təsdiqi tələb olunur.');
  const product=catalog.products.find(p=>p.id==='netflix');
  if(!product)throw fail(409,'Netflix Şəxsi kataloqda tapılmadı.');
  const assignment=crypto.randomUUID(),message=(await readProductMessages(c,security,['netflix'])).get('netflix')??'';
  await c.query(`insert into ${T}(id,room_id,user_id,paid_until,product_title,image,message_cipher,actor_id)
   values($1,$2,$3,$4,$5,$6,$7,$8)`,[assignment,id,userId,paidUntil,product.title,product.image||'',
    security.encryptSecret(JSON.stringify({id:assignment,order:assignment,line:0,message})),owner.user_id]);
  await c.query('update mirpanel_community.netflix_room_units set legacy_assignment_id=$2 where id=$1 and delivery_id is null',[id,assignment]);
  await c.query(`insert into mirpanel_community.community_audit(actor_id,action,target_id,reason,details)
   values($1,'netflix-room-legacy-bind',$2,$3,$4)`,[owner.user_id,userId,legacyRoomSource,JSON.stringify({roomId:id,assignmentId:assignment,paidUntil})]);
  await c.query('commit');return {assigned:true,orderCode:'LEG'+assignment.replaceAll('-','')};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}

// A historical entitlement is NOT a payment_order. Merge it only into the
// owner's protected history readers, never into revenue/payment/statistics.
export async function legacyOrders(pool,user,{before=null,id=null,ids=null,code=null}={}){
 if(!await legacyInstalled(pool))return [];
 return (await pool.query(`select id,'LEG'||replace(id::text,'-','') order_code,product_title,
  $6::text||' · Ödənilib: '||to_char(paid_until,'DD.MM.YYYY')||'-dək' plan_name,
  'netflix' product_id,1 quantity,null::numeric amount,'AZN' currency,created_at,'completed' status,true payment_confirmed,
  paid_until::text service_expires_on,jsonb_build_object('productId','netflix','image',image,'quantity',1) checkout_snapshot,
  true legacy from ${T} where user_id=$1 and ($2::timestamptz is null or (created_at,id)<($2,$3::uuid))
  and ($4::uuid[] is null or id=any($4)) and ($5::text is null or 'LEG'||replace(id::text,'-','')=$5)
  order by created_at desc,id desc limit 21`,[user,before,id,ids,code,legacyRoomSource])).rows;
}
export function withLegacyHistory(pool,user,scope){
 const load=filter=>legacyOrders(pool,user,filter);
 const sort=(a,b)=>new Date(b.created_at)-new Date(a.created_at)||b.id.localeCompare(a.id);
 return withReadyAccountHistory(pool,user,{...scope,
  page:async(before,id)=>{
   const [orders,legacy]=await Promise.all([scope.page(before,id),load({before,id})]);
   return [...orders,...legacy].sort(sort).slice(0,21);
  },
  owned:async id=>await scope.owned(id)||(await load({ids:[id]}))[0]||null,
  byCode:async code=>await scope.byCode(code)||(await load({code}))[0]||null,
  deliveries:async ids=>[...await scope.deliveries(ids),...(await load({ids})).map(o=>({id:o.id,order_id:o.id,line_index:0,quantity:1,automatic:false}))],
  codes:async id=>{
   const old=await scope.codes(id);
   if(!await legacyInstalled(pool))return old;
   const rows=(await pool.query(`select a.id,a.id order_id,0 line_index,1 quantity,null::timestamptz delivered_at,
    null::timestamptz created_at,'LEG'||replace(a.id::text,'-','') order_code,'netflix' product_id,a.product_title,
    'Ödənilib: '||to_char(a.paid_until,'DD.MM.YYYY')||'-dək' plan_name,1 order_quantity,
    jsonb_build_object('productId','netflix','image',a.image,'quantity',1) checkout_snapshot,
    ${id?'a.message_cipher,r.id room_id,r.room_name,r.pin_cipher,g.id group_id,g.account_cipher,(a.paid_until<public.payment_baku_date()) room_access_ended,':''}true legacy
    from ${T} a join mirpanel_community.netflix_room_units r on r.legacy_assignment_id=a.id
    join mirpanel_community.netflix_room_groups g on g.id=r.group_id
    where a.user_id=$1 ${id?'and a.id=$2::uuid':''} order by a.created_at desc,a.id desc`,id?[user,id]:[user])).rows;
   return [...old,...rows];
  }
 });
}

export async function legacySubscriptions(pool,users,source){
 if(!await legacyInstalled(pool))return [];
 return (await pool.query(`select id,user_id as "userId",id as "orderId",'LEG'||replace(id::text,'-','') as "orderCode",1 as "sourceLine",1 as "sourceUnit",
  'netflix' as "productId",product_title title,'Əvvəlki satış' plan,image,null::text as "planKey",null::int as "lastPurchaseCents",
  paid_until::text as "expiresOn",false estimated,null::text as "startsOn" from ${T} where user_id=any($1::text[]) and ($2::uuid is null or id=$2)`,[users,source])).rows;
}
