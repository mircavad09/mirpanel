import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {signature} from '../employee-security.mjs';
import {planKey} from '../payment-profit.mjs';
import {bakuDate,safeCalendarDate} from '../payment-order-lifecycle.mjs';
import {readProductMessages} from './ready-stock-product-messages.mjs';
const T='mirpanel_community.ready_stock_management',U='mirpanel_community.ready_stock_units';
const fail=(status,message)=>Object.assign(Error(message),{status});
const uuid=v=>typeof v==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(v);
export async function managementInstalled(db){return !!(await db.query('select to_regclass($1) present',[T])).rows[0].present;}
export async function ensureReadyStockManagement(pool){
 if(await managementInstalled(pool)&&(await pool.query("select to_regclass('mirpanel_community.ready_stock_account_revisions') present")).rows[0].present)return;
 if(!(await pool.query('select to_regclass($1) present',[U])).rows[0].present)return;
 await pool.query(await fs.readFile(new URL('./ready-stock-management.sql',import.meta.url),'utf8'));
}
export async function freeManagementClause(db,alias='u'){
 return await managementInstalled(db)?` and not exists(select 1 from ${T} m where m.unit_id=${alias}.id and (m.deleted_at is not null or m.assignment_id is not null))`:'';
}
function decode(security,row){
 const data=JSON.parse(security.decryptSecret(row.message_cipher));
 if(data.id!==row.id||JSON.stringify(data.scope)!==JSON.stringify([row.product_id,row.plan_key,row.plan_signature]))throw Error('READY_STOCK_REFERENCE_MISMATCH');
 return data;
}
function planMatch(catalog,row){
 const p=catalog.products.find(p=>p.id===row.product_id),matches=p?.plans?.map((plan,i)=>({plan,i})).filter(({plan,i})=>planKey(plan,i)===row.plan_key&&signature(plan)===row.plan_signature)||[];
 return {p,match:matches.length===1?matches[0]:null};
}
// Generic units are not reserved by ID. A live reservation for their exact SKU
// protects that ready pool until it is released or fulfilled.
async function held(db,row){
 return !!(await db.query(`select 1 from mirpanel_community.shop_lines l join public.payment_reservations r on r.id=l.reservation_id
  where l.product_id=$1 and l.snapshot->>'sourcePlanKey'=$2 and l.snapshot->>'signature'=$3
  and r.status='reserved' and r.expires_at>clock_timestamp() limit 1`,[row.product_id,row.plan_key,row.plan_signature])).rowCount;
}
export async function readyAccountList(db,security,catalog){
 if(!await managementInstalled(db))return [];
 const rows=(await db.query(`select u.*,m.revision,m.assignment_id,m.user_id,m.paid_until::text,m.assigned_at,
  coalesce(m.user_id,o.user_id) customer_id,coalesce(m.assigned_at,d.delivered_at) linked_at,
  person.name customer_name,n.member_number
  from ${U} u left join ${T} m on m.unit_id=u.id
  left join mirpanel_community.customer_order_deliveries d on d.id=u.delivery_id
  left join mirpanel_community.community_order_owners o on o.order_id=d.order_id
  left join mirpanel_community."user" person on person.id=coalesce(m.user_id,o.user_id)
  left join mirpanel_community.community_member_numbers n on n.user_id=person.id
  where m.deleted_at is null order by u.created_at desc,u.id desc`)).rows;
 return rows.map(row=>{
  const data=decode(security,row),{p,match}=planMatch(catalog,row),sold=!!(row.delivery_id||row.assignment_id);
  return {id:row.id,productId:row.product_id,planKey:row.plan_key,planSignature:row.plan_signature,planName:match?.plan.label||match?.plan.name||row.plan_key,
   email:data.account?.email||'',structured:!!data.account,status:sold?'sold':'ready',revision:row.revision||0,
   customer:sold?{name:row.customer_name||'Müştəri',id:row.member_number,assignedAt:row.linked_at}:null,
   paidUntil:row.paid_until,editable:true,assigned:sold,packageAvailable:!!(p&&match)};
 });
}
export async function manageReadyAccount(pool,security,catalog,actor,input){
 await ensureReadyStockManagement(pool);
 if(!await managementInstalled(pool))throw fail(503,'Hazır hesab idarəetməsi üçün baza yeniləməsi lazımdır.');
 const {action,id}=input||{};
 if(action==='search'){
  const q=String(input.q??'').trim().slice(0,160);if(!q)return {users:[]};
  const pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
  return {users:(await pool.query(`select u.id,u.name,u.email,n.member_number as "memberNumber" from mirpanel_community."user" u join mirpanel_community.community_member_numbers n on n.user_id=u.id where u.name ilike $1 or u.email ilike $1 or n.member_number::text=$2 order by u.name,u.id limit 20`,[pattern,q.replace(/^#/,'')])).rows};
 }
 if(!uuid(id)||!['open','edit','delete','bind'].includes(action))throw fail(400,'Hesab əməliyyatı düzgün deyil.');
 const c=await pool.connect();
 try{
  await c.query('begin');await c.query('select pg_advisory_xact_lock(714025001)');
  const row=(await c.query(`select u.*,m.revision,m.deleted_at,m.assignment_id,m.user_id,m.paid_until::text,m.message_cipher assigned_cipher from ${U} u left join ${T} m on m.unit_id=u.id where u.id=$1 for update of u`,[id])).rows[0];
  if(!row)throw fail(404,'Hesab tapılmadı.');
  if(row.deleted_at){if(action==='delete'){await c.query('commit');return {deleted:true,replayed:true};}throw fail(409,'Hesab artıq silinib.');}
  if(action==='bind'&&row.assignment_id){
   if(row.user_id===input.userId&&row.paid_until===input.paidUntil){await c.query('commit');return {assigned:true,replayed:true};}
   throw fail(409,'Hesab artıq başqa müştəriyə bağlanıb.');
  }
  const sold=!!(row.delivery_id||row.assignment_id);
  if(sold&&!['open','edit'].includes(action))throw fail(409,'Təhvil verilmiş hesab silinə və yenidən bağlana bilməz. Sifariş tarixçəsi qorunur.');
  const data=decode(security,row),{p,match}=planMatch(catalog,row),reserved=!sold&&await held(c,row);
  const delivery=row.delivery_id?(await c.query('select id,order_id,line_index,message_cipher from mirpanel_community.customer_order_deliveries where id=$1 for update',[row.delivery_id])).rows[0]:null;
  const existingCipher=delivery?.message_cipher||row.assigned_cipher;
  const delivered=existingCipher?JSON.parse(security.decryptSecret(existingCipher)):null;
  if(delivered&&(delivery?(delivered.id!==delivery.id||delivered.order!==delivery.order_id||delivered.line!==delivery.line_index):(delivered.id!==row.assignment_id||delivered.order!==row.assignment_id||delivered.line!==0)))throw Error('DELIVERY_REFERENCE_MISMATCH');
  if(action==='open'){await c.query('commit');return {email:delivered?.email??data.account?.email??'',password:delivered?.password??data.account?.password??'',message:delivered?.message??data.message??'',revision:row.revision||0,reserved,planName:match?.plan.label||match?.plan.name||row.plan_key};}
  if(reserved)throw fail(409,'Bu paket aktiv sifariş üçün rezervdədir. Rezerv bitənədək hesab dəyişdirilə, silinə və ya bağlana bilməz.');
  if(input.revision!==(row.revision||0))throw fail(409,'Hesab dəyişib. Yenidən açın.');
  await c.query(`insert into ${T}(unit_id) values($1) on conflict do nothing`,[id]);
  if(action==='delete')await c.query(`update ${T} set deleted_at=clock_timestamp(),revision=revision+1 where unit_id=$1`,[id]);
  if(action==='edit'){
   const {email='',password='',message=''}=input;
   if(typeof message!=='string'||message.length>8000||typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>512||/[\r\n\0]/.test(password)||((email||password)&&(!/^\S+@\S+\.\S+$/.test(email)||!password.trim()))||(!email&&!password&&!message.trim()))throw fail(400,'Hesabın e-poçtunu və şifrəsini, yaxud mövcud hazır mətnini düzgün yazın.');
   const value={...data,...(email?{account:{...data.account,email:email.trim(),password}}:{account:undefined}),message};
   await c.query(`insert into mirpanel_community.ready_stock_account_revisions(unit_id,revision,stock_cipher,delivery_cipher,actor_ref) values($1,$2,$3,$4,$5)`,[id,row.revision||0,row.message_cipher,existingCipher||null,actor]);
   if(delivered){
    const cipher=security.encryptSecret(JSON.stringify({...delivered,email:email.trim()||undefined,password:password||undefined,message}));
    if(delivery)await c.query('update mirpanel_community.customer_order_deliveries set message_cipher=$2 where id=$1',[delivery.id,cipher]);
    else await c.query(`update ${T} set message_cipher=$2 where unit_id=$1`,[id,cipher]);
   }
   await c.query(`update ${U} set message_cipher=$2 where id=$1`,[id,security.encryptSecret(JSON.stringify(value))]);
   await c.query(`update ${T} set revision=revision+1 where unit_id=$1`,[id]);
  }
  if(action==='bind'){
   if(!p||!match||String(input.planSignature)!==row.plan_signature)throw fail(409,'Hesabın saxlanmış paketi kataloqla uyğun deyil.');
   if(typeof input.userId!=='string'||!input.userId||!safeCalendarDate(input.paidUntil)||input.paidUntil<bakuDate())throw fail(400,'Müştərini və ödənilmiş son tarixi düzgün seçin.');
   if(!(await c.query('select user_id from mirpanel_community.community_member_numbers where user_id=$1 for key share',[input.userId])).rowCount)throw fail(404,'Müştəri tapılmadı.');
   const assignment=crypto.randomUUID(),plan=match.plan;
   const message=data.account?[(await readProductMessages(c,security,[p.id])).get(p.id)||'',data.message||''].filter(Boolean).join('\n\n'):data.message;
   const snapshot={productId:p.id,title:p.title,planName:plan.label||plan.name||row.plan_key,sourcePlanKey:row.plan_key,image:p.image||'',quantity:1,unitCents:null,durationMonths:plan.months??plan.durationMonths,durationDays:plan.days??plan.durationDays};
   const cipher=security.encryptSecret(JSON.stringify({id:assignment,order:assignment,line:0,message,...data.account}));
   await c.query(`update ${T} set assignment_id=$2,user_id=$3,paid_until=$4,plan_snapshot=$5,message_cipher=$6,actor_ref=$7,assigned_at=clock_timestamp(),revision=revision+1 where unit_id=$1`,[id,assignment,input.userId,input.paidUntil,snapshot,cipher,actor]);
  }
  // No credentials, arbitrary free text, balance movement or mail enters audit.
  await c.query(`insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata) values('admin',$1,$2,'ready_stock_unit',$3,$4)`,[actor,'ready.account_'+action,id,{productId:row.product_id,planKey:row.plan_key,...(action==='bind'?{userId:input.userId,paidUntil:input.paidUntil}:{})}]);
  await c.query('commit');return action==='delete'?{deleted:true}:action==='bind'?{assigned:true}:{saved:true};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
export async function readyAssignments(pool,user,{before=null,id=null,ids=null,code=null,all=false}={}){
 if(!await managementInstalled(pool))return [];
 return (await pool.query(`select assignment_id id,'RGA'||replace(assignment_id::text,'-','') order_code,plan_snapshot->>'title' product_title,plan_snapshot->>'planName' plan_name,
 plan_snapshot->>'productId' product_id,1 quantity,null::numeric amount,'AZN' currency,assigned_at created_at,'completed' status,true payment_confirmed,paid_until::text service_expires_on,
 jsonb_build_object('cartVersion',2,'items',jsonb_build_array(plan_snapshot)) checkout_snapshot,true legacy
 from ${T} where user_id=$1 and assignment_id is not null and ($2::timestamptz is null or (assigned_at,assignment_id)<($2,$3::uuid)) and ($4::uuid[] is null or assignment_id=any($4)) and ($5::text is null or 'RGA'||replace(assignment_id::text,'-','')=$5) order by assigned_at desc,assignment_id desc ${all?'':'limit 21'}`,[user,before,id,ids,code])).rows;
}
export function withReadyAccountHistory(pool,user,scope){
 const sort=(a,b)=>new Date(b.created_at)-new Date(a.created_at)||b.id.localeCompare(a.id),load=filter=>readyAssignments(pool,user,filter);
 return {...scope,
 page:async(before,id)=>[...await scope.page(before,id),...await load({before,id})].sort(sort).slice(0,21),
 owned:async id=>await scope.owned(id)||(await load({ids:[id]}))[0]||null,
 byCode:async code=>await scope.byCode(code)||(await load({code}))[0]||null,
 deliveries:async ids=>[...await scope.deliveries(ids),...(await load({ids})).map(o=>({id:o.id,order_id:o.id,line_index:0,quantity:1,automatic:false}))],
 codes:async id=>{
  const old=await scope.codes(id);if(!await managementInstalled(pool))return old;
  const orders=await load(id?{ids:[id]}:{all:true});if(!orders.length)return old;
  const rows=(await pool.query(`select assignment_id id,message_cipher from ${T} where user_id=$1 and assignment_id=any($2::uuid[])`,[user,orders.map(o=>o.id)])).rows;
  return [...old,...orders.map(o=>({...o,order_id:o.id,line_index:0,order_quantity:1,delivered_at:o.created_at,message_cipher:rows.find(r=>r.id===o.id)?.message_cipher,legacy:false}))];
 }};
}
export async function readyAssignmentSubscriptions(pool,users,source){
 if(!await managementInstalled(pool))return [];
 return (await pool.query(`select assignment_id id,user_id as "userId",assignment_id as "orderId",'RGA'||replace(assignment_id::text,'-','') as "orderCode",1 as "sourceLine",1 as "sourceUnit",plan_snapshot->>'productId' as "productId",plan_snapshot->>'title' title,plan_snapshot->>'planName' plan,plan_snapshot->>'image' image,plan_snapshot->>'sourcePlanKey' as "planKey",null::int as "lastPurchaseCents",paid_until::text as "expiresOn",false estimated,null::text as "startsOn" from ${T} where user_id=any($1::text[]) and assignment_id is not null and ($2::uuid is null or assignment_id=$2)`,[users,source])).rows;
}
