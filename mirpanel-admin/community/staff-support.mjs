import fs from 'node:fs/promises';
import {paid,deliveryLines,customerStatus} from './order-delivery.mjs';
import {signature} from '../employee-security.mjs';
import {planKey} from '../payment-profit.mjs';
import {subscriptionPeriod,subscriptionReminderEntries} from './subscriptions.mjs';
import {bakuDate,shiftCalendarDays,addCalendarMonthsMinusDay} from '../payment-order-lifecycle.mjs';
import {warrantyText} from '../public/product-plan-utils.mjs';
import {freeManagementClause} from './ready-stock-management.mjs';
const S='mirpanel_community.',fail=(status,message)=>Object.assign(Error(message),{status});
const uuid=x=>typeof x==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(x);
const setup=new WeakMap();
export function ensureStaffSupport(pool){
 if(!setup.has(pool)){const p=fs.readFile(new URL('./staff-support-migration.sql',import.meta.url),'utf8').then(sql=>pool.query(sql));setup.set(pool,p);p.catch(()=>setup.delete(pool));}return setup.get(pool);
}
export async function requireSupport(c,actor,permission='support'){
 // A row share lock serializes revocation with an in-flight replacement.
 const r=(await c.query(`select active,support,replacement,credentials from ${S}customer_read_staff where user_id=$1 for share`,[actor])).rows[0];
 if(!r?.active||!r.support||!r[permission])throw fail(403,'Bu əməliyyat üçün işçi icazəniz yoxdur və ya ləğv edilib.');return r;
}
function warrantyEnd(plan,start){
 const text=warrantyText(plan);if(!start||!text||text==='Zəmanətsiz')return null;
 const match=/^(\d+)\s*(gün|ay)\s*zəmanət/iu.exec(text);
 if(!match)return null;
 const count=Number(match[1]);if(!Number.isSafeInteger(count)||count<1||count>3650)return null;
 return match[2]==='gün'?shiftCalendarDays(start,count-1):addCalendarMonthsMinusDay(start,count);
}
function catalogMatch(catalog,unit){
 const product=catalog.products.find(p=>p.id===unit?.product_id);
 const matches=product?.plans?.map((plan,i)=>({plan,i})).filter(x=>planKey(x.plan,x.i)===unit.plan_key&&signature(x.plan)===unit.plan_signature)||[];
 return {product,plan:matches.length===1?matches[0].plan:null};
}
function account(security,u){
 const v=JSON.parse(security.decryptSecret(u.message_cipher));
 if(v.id!==u.id||JSON.stringify(v.scope)!==JSON.stringify([u.product_id,u.plan_key,u.plan_signature]))throw Error('READY_STOCK_REFERENCE_MISMATCH');
 return v.account?.email&&v.account?.password?v.account:null;
}
async function eligibility(c,security,catalog,o,d,subscriptions){
 const item=deliveryLines(o)[d.line_index],saved=o.checkout_snapshot?.cartVersion===2?o.checkout_snapshot.items?.[d.line_index]:o.checkout_snapshot;
 const unit=(await c.query(`select * from ${S}ready_stock_units where delivery_id=$1`,[d.id])).rows[0];
 const result={deliveryId:d.id,line:d.line_index,quantity:d.quantity,product:item?.title,package:item?.planName,deliveredAt:d.delivered_at,unitId:unit?.id||null,
  warranty:warrantyText({...saved,label:item?.planName}),serviceUntil:subscriptions.find(x=>x.id===d.id)?.expiresOn||null};
 result.warrantyUntil=warrantyEnd({...saved,label:item?.planName},bakuDate(d.delivered_at));
 const previous=(await c.query(`select id,state,completed_at,created_at from ${S}staff_replacements where delivery_id=$1`,[d.id])).rows[0];
 result.previous=previous||null;
 const {product,plan}=catalogMatch(catalog,unit);
 const policy=unit&&(await c.query(`select enabled,account_type from ${S}staff_replacement_policies where product_id=$1 and plan_key=$2 and plan_signature=$3`,[unit.product_id,unit.plan_key,unit.plan_signature])).rows[0];
 const today=bakuDate();
 result.reason=!paid(o)||o.fulfillment_cancellation?'Sifariş ödənilməyib və ya ləğv edilib.':
  previous?.state==='completed'?'Əvvəlki əvəzləmə tamamlanıb; təkrar müraciət üçün admin baxışı lazımdır.':
  previous?.state==='admin_review'?'Admin baxışı gözlənilir.':
  d.quantity!==1||!unit?'Bu təhvil hazır hesab vahidi deyil.':
  !plan||!product||product.supplier?.provider||plan.supplier?.provider||/pubg|free.?fire|diamond|uc\b/i.test(product.id)?'Bu paket hazır hesab əvəzləməsinə uyğun deyil.':
  (saved?.accountType??null)!==(plan.accountType??null)||JSON.stringify(subscriptionPeriod({...saved,label:item?.planName}))!==JSON.stringify(subscriptionPeriod(plan))?'Hesab növü və ya paket müddəti dəyişib — admin baxışı tələb olunur.':
  !policy?.enabled||policy.account_type!==(plan.accountType||'ready_account')?'Admin bu paketdə işçi əvəzləməsini açmayıb.':
  !account(security,unit)?'Kod və sərbəst təhvil mətni hazır hesab sayılmır.':
  !result.warrantyUntil?'Zəmanət qeyri-müəyyəndir — admin baxışı tələb olunur.':
  result.warrantyUntil<today?'Zəmanət bitib — admin baxışı tələb olunur.':
  !result.serviceUntil||result.serviceUntil<today?'Xidmət müddəti bitib və ya qeyri-müəyyəndir — admin baxışı tələb olunur.':null;
 result.eligible=!result.reason;result.reviewRequired=!!result.reason?.includes('admin baxışı tələb olunur');return {view:result,unit,plan};
}
export async function supportCustomer(pool,security,catalog,actor,id,page=1){
 const c=await pool.connect();try{
  await c.query("begin; set local statement_timeout='10s'");const permissions=await requireSupport(c,actor);
  const orders=(await c.query(`select o.* from public.payment_orders o join ${S}community_order_owners l on l.order_id=o.id where l.user_id=$1 order by o.created_at desc,o.id desc limit 20 offset $2`,[id,(page-1)*20])).rows;
  const subscriptions=await subscriptionReminderEntries(c,[id]);
  const details=[];
  for(const o of orders){
   const records=(await c.query(`select id,line_index,quantity,delivered_at from ${S}customer_order_deliveries where order_id=$1 order by delivered_at,id`,[o.id])).rows;
   const units=[];for(const d of records){const {view}=await eligibility(c,security,catalog,o,d,subscriptions);units.push({...view,canReplace:permissions.replacement&&view.eligible,canReview:permissions.replacement&&view.reviewRequired});}
   details.push({number:String(o.order_code),status:customerStatus(o,records),method:o.payment_source==='wallet'?'MirPanel balansı':o.method_provider||'Kart ödənişi',units});
  }
  const topups=(await c.query(`select t.id,t.created_at,t.requested_cents::text,t.approved_cents::text,t.status,m.display_name as method from ${S}wallet_topups t join public.payment_methods m on m.id=t.method_id where t.user_id=$1 order by t.created_at desc,t.id desc limit 21 offset $2`,[id,(page-1)*20])).rows;
  const ledger=(await c.query(`select id::text,cents::text,kind,created_at from ${S}wallet_ledger where user_id=$1 order by id desc limit 21 offset $2`,[id,(page-1)*20])).rows;
  const history=(await c.query(`select r.id,r.delivery_id,r.order_id,o.order_code::text,r.state,r.reason,r.old_unit_id,r.new_unit_id,r.created_at,r.completed_at,r.service_until::text,r.warranty_until::text,u.name as actor from ${S}staff_replacements r join public.payment_orders o on o.id=r.order_id join ${S}"user" u on u.id=r.actor_id where r.user_id=$1 order by r.created_at desc limit 21 offset $2`,[id,(page-1)*20])).rows;
  const notes=(await c.query(`select n.id,n.body,n.created_at,u.name as actor from ${S}staff_support_notes n join ${S}"user" u on u.id=n.actor_id where n.user_id=$1 order by n.created_at desc limit 21 offset $2`,[id,(page-1)*20])).rows;
  await c.query('commit');return {permissions,details,topups:topups.slice(0,20),ledger:ledger.slice(0,20),history:history.slice(0,20),notes:notes.slice(0,20),historyMore:[topups,ledger,history,notes].some(x=>x.length>20)};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
export async function supportMutation(pool,security,catalog,actor,path,b){
 if(!actor)throw fail(401,'İşçi hesabınızla daxil olun.');
 if(!['/replace','/note','/credentials'].includes(path))throw fail(403,'Bu əməliyyata icazə yoxdur.');
 if(!uuid(b?.requestId)||typeof b.userId!=='string'||b.userId.length>128)throw fail(400,'Müştəri və əməliyyat açarı tələb olunur.');
 const c=await pool.connect();try{
  await c.query('begin');
  if(path==='/replace')await c.query('select pg_advisory_xact_lock(714025001)');
  await requireSupport(c,actor,path==='/replace'?'replacement':path==='/credentials'?'credentials':'support');
  if(path==='/replace'&&!(await c.query(`select 1 from ${S}ready_stock_release where id and enabled`)).rowCount)throw fail(503,'Hazır hesab stoku hazırda bağlıdır.');
  if(!(await c.query(`select 1 from ${S}"user" where id=$1`,[b.userId])).rowCount)throw fail(404,'Müştəri tapılmadı.');
  if(path==='/note'){
   if(typeof b.body!=='string'||b.body.trim().length<3||b.body.length>1000)throw fail(400,'3–1000 simvolluq qeyd yazın. Şifrə və kod yazmayın.');
   const old=(await c.query(`select user_id,actor_id,body from ${S}staff_support_notes where id=$1`,[b.requestId])).rows[0];
   if(old&&(old.user_id!==b.userId||old.actor_id!==actor||old.body!==b.body.trim()))throw fail(409,'Əməliyyat açarı artıq istifadə olunub.');
   await c.query(`insert into ${S}staff_support_notes(id,user_id,actor_id,body) values($1,$2,$3,$4) on conflict do nothing`,[b.requestId,b.userId,actor,b.body.trim()]);
   await c.query('commit');return {saved:true};
  }
  if(!uuid(b.deliveryId))throw fail(400,'Təhvil vahidi seçin.');
  const d=(await c.query(`select d.* from ${S}customer_order_deliveries d join ${S}community_order_owners l on l.order_id=d.order_id where d.id=$1 and l.user_id=$2 for update of d`,[b.deliveryId,b.userId])).rows[0];
  if(!d)throw fail(404,'Bu müştəriyə aid təhvil tapılmadı.');
  const o=(await c.query('select * from public.payment_orders where id=$1 for update',[d.order_id])).rows[0];
  if(path==='/credentials'){
   if(!paid(o))throw fail(409,'Sifariş aktiv deyil.');
   const value=JSON.parse(security.decryptSecret(d.message_cipher));
   if(value.id!==d.id||value.order!==d.order_id||value.line!==d.line_index)throw Error('DELIVERY_REFERENCE_MISMATCH');
   await c.query(`insert into ${S}community_audit(actor_id,action,target_id,reason,details) values($1,'staff-credentials',$2,'Məhsul hesabına baxış',$3)`,[actor,b.userId,{deliveryId:d.id,orderId:d.order_id}]);
   await c.query('commit');return {email:value.email||'',password:value.password||''};
  }
  if(typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>500||b.confirmed!==true)throw fail(400,'Problem səbəbi və təsdiq tələb olunur. Şifrə və kod yazmayın.');
  const old=(await c.query(`select * from ${S}staff_replacements where delivery_id=$1 or id=$2 for update`,[d.id,b.requestId])).rows;
  if(old.some(x=>x.delivery_id!==d.id||x.user_id!==b.userId))throw fail(409,'Əməliyyat açarı artıq istifadə olunub.');
  const previous=old[0];
  if(previous?.state==='completed'||previous?.state==='admin_review'){
   await c.query('commit');return {id:previous.id,state:previous.state,replayed:true};
  }
  const subscriptions=await subscriptionReminderEntries(c,[b.userId]);
  const {view,unit,plan}=await eligibility(c,security,catalog,o,d,subscriptions);
  if(!view.eligible){
   // Only a genuine ready-account warranty/term question can enter review.
   if(!unit||!plan||!view.reason?.includes('admin baxışı'))throw fail(409,view.reason);
   await c.query(`insert into ${S}staff_replacements(id,delivery_id,order_id,user_id,actor_id,reason,state,old_unit_id,service_until,warranty_until) values($1,$2,$3,$4,$5,$6,'admin_review',$7,$8,$9) on conflict(delivery_id) do update set state='admin_review'`,[previous?.id||b.requestId,d.id,o.id,b.userId,actor,b.reason.trim(),unit.id,view.serviceUntil,view.warrantyUntil]);
   await c.query('commit');return {state:'admin_review'};
  }
  const id=previous?.id||b.requestId;
  await c.query(`insert into ${S}staff_replacements(id,delivery_id,order_id,user_id,actor_id,reason,state,old_unit_id,service_until,warranty_until) values($1,$2,$3,$4,$5,$6,'waiting_stock',$7,$8,$9) on conflict(delivery_id) do nothing`,[id,d.id,o.id,b.userId,actor,b.reason.trim(),unit.id,view.serviceUntil,view.warrantyUntil]);
  const args=[unit.product_id,unit.plan_key,unit.plan_signature];
  // Respect paid/reserved purchases before taking a free account for support.
  const held=(await c.query(`select 1 from ${S}shop_lines l join public.payment_reservations r on r.id=l.reservation_id where l.product_id=$1 and l.snapshot->>'sourcePlanKey'=$2 and l.snapshot->>'signature'=$3 and r.status='reserved' and r.expires_at>clock_timestamp() limit 1`,args)).rowCount;
  const free=await freeManagementClause(c);
  const candidates=held?[]:(await c.query(`select u.* from ${S}ready_stock_units u where u.product_id=$1 and u.plan_key=$2 and u.plan_signature=$3 and u.delivery_id is null ${free} order by u.created_at,u.id for update of u`,args)).rows;
  let next,credentials;
  for(const candidate of candidates){const a=account(security,candidate);if(a){next=candidate;credentials=a;break;}}
  if(!next){await c.query('commit');return {id,state:'waiting_stock',message:'Əvəzləmə üçün stok gözlənilir'};}
  const value=JSON.parse(security.decryptSecret(d.message_cipher));
  if(value.id!==d.id||value.order!==o.id||value.line!==d.line_index)throw Error('DELIVERY_REFERENCE_MISMATCH');
  // Keep the original delivery ID, date, order unit, expiry and warranty.
  const cipher=security.encryptSecret(JSON.stringify({...value,message:'Hesabınız əvəzləndi. Mövcud xidmət müddəti və zəmanət dəyişməyib.',email:credentials.email,password:credentials.password}));
  await c.query(`insert into ${S}ready_stock_management(unit_id,deleted_at,actor_ref) values($1,clock_timestamp(),$2) on conflict(unit_id) do update set deleted_at=excluded.deleted_at,actor_ref=excluded.actor_ref`,[unit.id,'staff-replacement:'+id]);
  await c.query(`update ${S}ready_stock_units set delivery_id=null where id=$1`,[unit.id]);
  await c.query(`update ${S}ready_stock_units set delivery_id=$2 where id=$1`,[next.id,d.id]);
  await c.query(`update ${S}customer_order_deliveries set message_cipher=$2,replacement_at=clock_timestamp() where id=$1`,[d.id,cipher]);
  await c.query(`update ${S}staff_replacements set state='completed',old_cipher=$2,new_unit_id=$3,completed_at=clock_timestamp() where id=$1`,[id,d.message_cipher,next.id]);
  await c.query(`insert into ${S}customer_order_mail(event_key,order_id,delivery_id) values($1,$2,$3) on conflict do nothing`,['replacement:'+id,o.id,d.id]);
  await c.query(`insert into ${S}community_audit(actor_id,action,target_id,reason,details) values($1,'staff-replacement',$2,'Hazır hesab əvəzləndi',$3)`,[actor,b.userId,{replacementId:id,orderId:o.id,deliveryId:d.id,oldUnitId:unit.id,newUnitId:next.id,result:'completed'}]);
  await c.query('commit');return {id,state:'completed'};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
export async function replacementPolicies(pool,catalog,actor,input){
 // This function is reached only through the owner-authenticated admin router;
 // independently check the bound owner for direct callers too.
 if(!(await pool.query(`select 1 from ${S}owner_identity where id and user_id=$1`,[actor])).rowCount)throw fail(403,'Yalnız sahib üçün.');
 if(input){
  const product=catalog.products.find(p=>p.id===input.productId),plan=product?.plans?.[input.index];
  if(!plan||signature(plan)!==input.signature||typeof input.enabled!=='boolean'||product.supplier?.provider||plan.supplier?.provider||/pubg|free.?fire/i.test(product.id))throw fail(400,'Hazır hesab paketi seçin.');
  const c=await pool.connect();try{
   await c.query('begin');
   await c.query(`insert into ${S}staff_replacement_policies(product_id,plan_key,plan_signature,enabled,account_type,updated_by) values($1,$2,$3,$4,$5,$6) on conflict(product_id,plan_key,plan_signature) do update set enabled=excluded.enabled,account_type=excluded.account_type,updated_by=excluded.updated_by,updated_at=clock_timestamp()`,[product.id,planKey(plan,input.index),signature(plan),input.enabled,plan.accountType||'ready_account',actor]);
   await c.query(`insert into ${S}community_audit(actor_id,action,target_id,reason,details) values($1,'staff-replacement-policy',$2,'İşçi əvəzləmə qaydası dəyişdi',$3)`,[actor,product.id,{index:input.index,planKey:planKey(plan,input.index),signature:signature(plan),enabled:input.enabled}]);
   await c.query('commit');
  }catch(e){await c.query('rollback');throw e;}finally{c.release();}
 }
 const policies=(await pool.query(`select product_id,plan_key,plan_signature,enabled from ${S}staff_replacement_policies`)).rows;
 const plans=catalog.products.flatMap(p=>(p.plans||[]).map((plan,index)=>({productId:p.id,title:p.title,package:plan.label||plan.name,index,signature:signature(plan),accountType:plan.accountType||'ready_account',eligible:!p.supplier?.provider&&!plan.supplier?.provider&&!/pubg|free.?fire/i.test(p.id),enabled:policies.some(x=>x.product_id===p.id&&x.plan_key===planKey(plan,index)&&x.plan_signature===signature(plan)&&x.enabled)})));
 const history=(await pool.query(`select r.id,r.state,r.reason,r.delivery_id,r.old_unit_id,r.new_unit_id,r.created_at,r.completed_at,r.service_until::text,r.warranty_until::text,o.order_code::text,u.name as customer,a.name as actor from ${S}staff_replacements r join public.payment_orders o on o.id=r.order_id join ${S}"user" u on u.id=r.user_id join ${S}"user" a on a.id=r.actor_id order by r.created_at desc limit 100`)).rows;
 return {plans,history};
}
