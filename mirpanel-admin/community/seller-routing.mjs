import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {deliveryLines,adminDelivery} from './order-delivery.mjs';
import {checkoutFields} from './public/checkout-fields.js';
import {planKey} from '../payment-profit.mjs';
import {signature} from '../employee-security.mjs';
import {epinbyPlan} from '../../epinby-product.mjs';
const S='mirpanel_community.',fail=(status,message)=>Object.assign(Error(message),{status});
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n&&!/[\x00-\x1f]/.test(v);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function ensureSellerRouting(pool){const c=await pool.connect();try{await c.query('begin;select pg_advisory_xact_lock(714025119)');await c.query(await fs.readFile(new URL('./seller-routing.sql',import.meta.url),'utf8'));await c.query('commit');}catch(e){await c.query('rollback');throw e;}finally{c.release();}}
export function createSellerRouting({pool,security,loadCatalog,send,origin,roomStockSecret,onDelivered=()=>{},pollMs=15000,idempotentMail=false}){
 let timer,running,stopped=false;
 async function transaction(fn){const c=await pool.connect();try{await c.query('begin;select pg_advisory_xact_lock(714025001)');const result=await fn(c);await c.query('commit');return result;}catch(e){await c.query('rollback');throw e;}finally{c.release();}}
 async function actor(db,user){if(!user?.id||user.emailVerified!==true)throw fail(user?403:401,'Verified seller account required.');
  const seller=(await db.query(`select s.* from ${S}routing_sellers s join ${S}"user" u on u.id=s.user_id where s.user_id=$1 and s.active and u."emailVerified" is true and lower(u.email)=s.email for share of s`,[user.id])).rows[0];
  if(!seller)throw fail(403,'Seller access is disabled or has not been accepted.');return seller;
 }
 async function has(db,table){return !!(await db.query('select to_regclass($1) present',[S+table])).rows[0].present;}
 async function competing(db,product,key,line,orderId){
  if(orderId&&(await db.query("select to_regclass('public.employee_order_assignments') present")).rows[0].present)if((await db.query('select 1 from public.employee_order_assignments where order_id=$1',[orderId])).rowCount)return 'Assigned to existing employee flow';
  if(await has(db,'api_mappings'))if((await db.query(`select 1 from ${S}api_mappings where product_id=$1 and plan_key=$2 and active`,[product,key])).rowCount)return 'API integration active';
  if(await has(db,'api_dispatches'))if((await db.query(`select 1 from ${S}api_dispatches where order_id=$1 and line_index=$2 and state<>'skipped'`,[orderId,line])).rowCount)return 'Supplier activation pending';
  if(await has(db,'ready_stock_plans'))if((await db.query(`select 1 from ${S}ready_stock_plans p where product_id=$1 and plan_key=$2 and auto_wallet`,[product,key])).rowCount)return 'Ready account automatic delivery enabled';
  return null;
 }
 async function audit(c,task,who,action,reason=null,request=null){await c.query(`insert into ${S}seller_task_audit(task_id,actor,action,reason,request_id) values($1,$2,$3,$4,$5)`,[task,who,action,reason,request]);}
 async function routes(){const catalog=await loadCatalog();return (catalog.products||[]).filter(p=>p.active!==false).map(p=>({id:p.id,title:p.title,plans:(p.plans||[]).map((pl,i)=>({key:planKey(pl,i),name:pl.label||`${pl.months} aylıq`,signature:signature(pl),unsupported:p.id==='netflix'||!!epinbyPlan(p,pl)||p.supplier?.provider==='epinby'||pl.supplier?.provider==='epinby'}))}));}
 async function admin(input,who){
  if(!input){const [sellers,rules,members,tasks,history,mail,catalog]=await Promise.all([
   pool.query(`select id,name,email,user_id,active,created_at from ${S}routing_sellers order by created_at`),pool.query(`select * from ${S}seller_routes`),pool.query(`select * from ${S}seller_route_members`),
   pool.query(`select t.*,o.order_code,s.name seller_name,now()-coalesce(t.claimed_at,t.created_at)>interval '30 minutes' as delayed from ${S}seller_tasks t join public.payment_orders o on o.id=t.order_id left join ${S}routing_sellers s on s.id=t.seller_id order by t.created_at desc limit 500`),
   pool.query(`select a.*,s.name seller_name from ${S}seller_task_audit a left join ${S}routing_sellers s on s.id::text=a.actor order by a.at desc limit 500`),pool.query(`select event_key,state,attempts,reason,provider_id,updated_at from ${S}seller_mail order by updated_at desc limit 100`),routes()]);
   return {sellers:sellers.rows,routes:rules.rows,members:members.rows,tasks:tasks.rows,history:history.rows,mail:mail.rows,catalog,entry:origin+'/satici'};
  }
  return transaction(async c=>{
   if(input.action==='invite'){
    const email=String(input.email||'').toLowerCase().trim();if(!text(input.name,120)||!/^[-a-z0-9._+]+@gmail\.com$/.test(email)||!uuid(input.requestId))throw fail(400,'Ad, Gmail ünvanı və əməliyyat açarı tələb olunur.');
    const previous=(await c.query(`select 1 from ${S}seller_invitations where id=$1`,[input.requestId])).rowCount;if(previous)return {queued:true};
    let seller=(await c.query(`select * from ${S}routing_sellers where email=$1 for update`,[email])).rows[0];if(seller?.user_id)throw fail(409,'Satıcı artıq dəvəti qəbul edib.');
    if(!seller)seller=(await c.query(`insert into ${S}routing_sellers(id,name,email) values($1,$2,$3) returning *`,[crypto.randomUUID(),input.name.trim(),email])).rows[0];
    const token=crypto.randomBytes(32).toString('hex');await c.query(`update ${S}seller_invitations set expires_at=now() where seller_id=$1 and accepted_at is null`,[seller.id]);
    await c.query(`insert into ${S}seller_invitations(id,seller_id,token_hash,token_cipher,expires_at) values($1,$2,$3,$4,now()+interval '48 hours')`,[input.requestId,seller.id,digest(token),security.encryptSecret(token)]);
    await c.query(`insert into ${S}seller_mail(event_key,seller_id,invitation_id) values($1,$2,$3)`,['seller-invite:'+input.requestId,seller.id,input.requestId]);await audit(c,null,who,'invite',null,input.requestId);return {queued:true};
   }
   if(input.action==='seller'){
    if(!uuid(input.id)||typeof input.active!=='boolean')throw fail(400,'Satıcı seçin.');
    const seller=(await c.query(`update ${S}routing_sellers set active=$2 where id=$1 and (not $2 or user_id is not null) returning id`,[input.id,input.active])).rows[0];if(!seller)throw fail(409,'Əvvəl dəvət qəbul edilməlidir.');
    if(!input.active)await c.query(`update ${S}seller_tasks set state='needs_review' where seller_id=$1 and state='claimed'`,[input.id]);await audit(c,null,who,input.active?'seller-enabled':'seller-disabled');return {ok:true};
   }
   if(input.action==='route'){
    const catalog=await routes(),product=catalog.find(p=>p.id===input.productId),plan=product?.plans.find(p=>p.key===input.planKey);
    if(!plan||typeof input.enabled!=='boolean'||!Array.isArray(input.sellers)||input.sellers.length>30||input.sellers.some(x=>!uuid(x)))throw fail(400,'Məhsul, paket və satıcıları seçin.');
    if(input.enabled){if(plan.unsupported)throw fail(409,'Bu paket hazır hesab və ya təchizatçı axınına aiddir. Satıcıya yönləndirmə bağlıdır.');const conflict=await competing(c,product.id,plan.key,-1,null);if(conflict)throw fail(409,conflict);if(!input.sellers.length)throw fail(400,'Ən azı bir satıcı seçin.');}
    const selected=await c.query(`select id from ${S}routing_sellers where id=any($1::uuid[]) and user_id is not null and active for share`,[input.sellers]);if(input.enabled&&selected.rowCount!==new Set(input.sellers).size)throw fail(409,'Seçilmiş satıcılar aktiv olmalıdır.');
    await c.query(`insert into ${S}seller_routes(product_id,plan_key,plan_signature,enabled) values($1,$2,$3,$4) on conflict(product_id,plan_key) do update set plan_signature=excluded.plan_signature,enabled=excluded.enabled,enabled_at=case when excluded.enabled and (not seller_routes.enabled or seller_routes.plan_signature<>excluded.plan_signature) then now() else seller_routes.enabled_at end`,[product.id,plan.key,plan.signature,input.enabled]);
    await c.query(`delete from ${S}seller_route_members where product_id=$1 and plan_key=$2`,[product.id,plan.key]);for(const id of new Set(input.sellers))await c.query(`insert into ${S}seller_route_members values($1,$2,$3)`,[product.id,plan.key,id]);
    await c.query(`update ${S}seller_tasks t set state=case when state='claimed' then 'needs_review' else 'closed' end where product_id=$1 and plan_key=$2 and state in('open','claimed') and (not $3 or state='claimed' and not exists(select 1 from ${S}seller_route_members m where m.product_id=t.product_id and m.plan_key=t.plan_key and m.seller_id=t.seller_id))`,[product.id,plan.key,input.enabled]);
    await audit(c,null,who,'route-updated');return {ok:true};
   }
   if(input.action==='release'){
    if(!uuid(input.id)||input.safeToReassign!==true||!text(input.reason,400))throw fail(400,'Xarici təhvilin başlanmadığını yoxlayın və səbəb yazın.');
    const task=(await c.query(`select * from ${S}seller_tasks where id=$1 for update`,[input.id])).rows[0];if(!task||!['claimed','needs_review'].includes(task.state))throw fail(409,'Yoxlanacaq iş tapılmadı.');
    await c.query(`update ${S}seller_tasks set state=case when exists(select 1 from ${S}seller_routes r where r.product_id=seller_tasks.product_id and r.plan_key=seller_tasks.plan_key and r.enabled) then 'open' else 'closed' end,seller_id=null,claim_id=null,claimed_at=null where id=$1`,[task.id]);await audit(c,task.id,who,'admin-safe-release',input.reason);return {ok:true};
   }
   throw fail(400,'Əməliyyat tanınmadı.');
  });
 }
 async function sync(){const catalog=await loadCatalog();return transaction(async c=>{
  await c.query(`update ${S}seller_tasks t set state='closed' from public.payment_orders o where o.id=t.order_id and t.state in('open','claimed','needs_review') and (not o.payment_confirmed or o.status in('cancelled','rejected','expired') or to_jsonb(o)->>'fulfillment_cancellation' is not null)`);
  const pending=(await c.query(`select t.*,o.checkout_snapshot,o.quantity as order_quantity,o.product_title,o.plan_name as order_plan_name,o.product_id as order_product_id from ${S}seller_tasks t join public.payment_orders o on o.id=t.order_id where t.state in('open','claimed','needs_review') order by t.created_at limit 500`)).rows;
  for(const task of pending){const snapshot=task.checkout_snapshot,line=deliveryLines({checkout_snapshot:snapshot,quantity:task.order_quantity,product_title:task.product_title,plan_name:task.order_plan_name,product_id:task.order_product_id})[task.line_index],done=Number((await c.query(`select coalesce(sum(quantity),0) n from ${S}customer_order_deliveries where order_id=$1 and line_index=$2`,[task.order_id,task.line_index])).rows[0].n);if(!line||done>=line.quantity)await c.query(`update ${S}seller_tasks set state='closed' where id=$1`,[task.id]);}
  await c.query(`insert into ${S}seller_task_audience(task_id,seller_id) select t.id,m.seller_id from ${S}seller_tasks t join ${S}seller_routes r using(product_id,plan_key) join ${S}seller_route_members m using(product_id,plan_key) join ${S}routing_sellers s on s.id=m.seller_id where t.state='open' and r.enabled and s.active on conflict do nothing`);
  await c.query(`insert into ${S}seller_mail(event_key,seller_id,task_id) select 'seller-task:'||a.task_id||':'||a.seller_id,a.seller_id,a.task_id from ${S}seller_task_audience a join ${S}seller_tasks t on t.id=a.task_id where t.state='open' and not a.passed on conflict do nothing`);
  const rules=(await c.query(`select * from ${S}seller_routes where enabled`)).rows;if(!rules.length)return {created:0};
  const earliest=rules.reduce((at,r)=>at<r.enabled_at?at:r.enabled_at,rules[0].enabled_at);
  const orders=(await c.query(`select o.* from public.payment_orders o join ${S}community_order_owners ow on ow.order_id=o.id where o.created_at>=$1 and coalesce(o.checkout_snapshot->'epointPayment'->>'state','ready') not in ('awaiting_payment','awaiting_stock') and o.payment_confirmed is true and o.status not in('rejected','cancelled','expired') and to_jsonb(o)->>'fulfillment_cancellation' is null and o.checkout_snapshot->>'tokenPurchaseCount' is null and exists(
    select 1 from jsonb_array_elements(case when o.checkout_snapshot->>'cartVersion'='2' then o.checkout_snapshot->'items' else jsonb_build_array(coalesce(o.checkout_snapshot,'{}'::jsonb)||jsonb_build_object('productId',o.product_id,'quantity',o.quantity)) end) with ordinality entry(item,position)
    join ${S}seller_routes sr on sr.product_id=entry.item->>'productId' and sr.plan_key=coalesce(entry.item->>'sourcePlanKey',entry.item->>'planId',o.plan_id::text) and sr.enabled and o.created_at>=sr.enabled_at
    join ${S}seller_route_members rm on rm.product_id=sr.product_id and rm.plan_key=sr.plan_key join ${S}routing_sellers rs on rs.id=rm.seller_id and rs.active and rs.user_id is not null
    where not exists(select 1 from ${S}seller_tasks st where st.order_id=o.id and st.line_index=entry.position-1)
    and (select coalesce(sum(d.quantity),0) from ${S}customer_order_deliveries d where d.order_id=o.id and d.line_index=entry.position-1)<coalesce((entry.item->>'quantity')::int,1)
    and not(entry.item ?| array['roomStock','readyStock','renewalId','renewalOrderCode','supplier'])
   ) order by o.created_at limit 200`,[earliest])).rows;
  let created=0;for(const o of orders){for(const [index,line] of deliveryLines(o).entries()){
   const snapshot=o.checkout_snapshot?.cartVersion===2?o.checkout_snapshot.items[index]:o.checkout_snapshot;
   const key=String(snapshot?.sourcePlanKey??snapshot?.planId??o.plan_id??''),rule=rules.find(r=>r.product_id===line.productId&&r.plan_key===key&&new Date(o.created_at)>=new Date(r.enabled_at));if(!rule)continue;
   const product=catalog.products?.find(p=>p.id===line.productId),plan=product?.plans?.find((p,i)=>planKey(p,i)===key);if(!plan||product.active===false||plan.active===false||signature(plan)!==rule.plan_signature||product.id==='netflix'||epinbyPlan(product,plan)||product.supplier?.provider==='epinby'||plan.supplier?.provider==='epinby')continue;
   if(await competing(c,line.productId,key,index,o.id))continue;
   if(snapshot?.roomStock||snapshot?.readyStock||snapshot?.renewalId||snapshot?.renewalOrderCode||snapshot?.supplier)continue;
   if(await has(c,'influencer_gifts'))if((await c.query(`select 1 from ${S}influencer_gifts where order_id=$1`,[o.id])).rowCount)continue;
   const done=Number((await c.query(`select coalesce(sum(quantity),0) n from ${S}customer_order_deliveries where order_id=$1 and line_index=$2`,[o.id,index])).rows[0].n),remaining=line.quantity-done;if(remaining<=0){await c.query(`update ${S}seller_tasks set state='closed' where order_id=$1 and line_index=$2 and state in('open','claimed','needs_review')`,[o.id,index]);continue;}
   const members=(await c.query(`select s.id from ${S}seller_route_members m join ${S}routing_sellers s on s.id=m.seller_id where m.product_id=$1 and m.plan_key=$2 and s.active and s.user_id is not null`,[line.productId,key])).rows;if(!members.length)continue;
   const task=(await c.query(`insert into ${S}seller_tasks(id,order_id,line_index,product_id,plan_key,title,plan_name,quantity) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(order_id,line_index) do update set quantity=excluded.quantity where seller_tasks.state='open' returning *`,[crypto.randomUUID(),o.id,index,line.productId,key,line.title,line.planName,remaining])).rows[0];if(!task)continue;
   created++;for(const seller of members){await c.query(`insert into ${S}seller_task_audience(task_id,seller_id) values($1,$2) on conflict do nothing`,[task.id,seller.id]);await c.query(`insert into ${S}seller_mail(event_key,seller_id,task_id) values($1,$2,$3) on conflict do nothing`,['seller-task:'+task.id+':'+seller.id,seller.id,task.id]);}
  }}return {created};
 });}
 async function accept(user,token){if(!user?.id||user.emailVerified!==true)throw fail(user?403:401,'Sign in with the invited, verified Gmail account.');if(!/^[a-f0-9]{64}$/.test(token||''))throw fail(400,'Invalid invitation.');return transaction(async c=>{
  const invite=(await c.query(`select i.*,s.email from ${S}seller_invitations i join ${S}routing_sellers s on s.id=i.seller_id where token_hash=$1 for update of i,s`,[digest(token)])).rows[0];
  if(!invite||invite.accepted_at||new Date(invite.expires_at)<=new Date())throw fail(410,'Invitation expired or already used.');if(user.email.toLowerCase()!==invite.email)throw fail(403,'Use the Gmail address that received this invitation.');
  await c.query(`update ${S}routing_sellers set user_id=$2,active=true where id=$1`,[invite.seller_id,user.id]);await c.query(`update ${S}seller_invitations set accepted_at=now(),token_cipher='' where id=$1`,[invite.id]);await audit(c,null,invite.seller_id,'invitation-accepted');return {ok:true};
 });}
 async function member(c,seller,task,{assigned=false}={}){
  const t=(await c.query(`select t.*,o.order_code,to_jsonb(o) as order_data,o.checkout_snapshot,o.payment_confirmed,o.status as order_status,to_jsonb(o)->'fulfillment_cancellation' as cancellation from ${S}seller_tasks t join public.payment_orders o on o.id=t.order_id join ${S}seller_task_audience a on a.task_id=t.id and a.seller_id=$2 where t.id=$1 for update of t,o`,[task,seller.id])).rows[0];
  if(!t)throw fail(404,'Order not available.');
  const allowed=(await c.query(`select 1 from ${S}seller_route_members m join ${S}seller_routes r using(product_id,plan_key) where m.product_id=$1 and m.plan_key=$2 and m.seller_id=$3 and r.enabled`,[t.product_id,t.plan_key,seller.id])).rowCount;
  const catalog=await loadCatalog(),product=catalog.products?.find(p=>p.id===t.product_id),plan=product?.plans?.find((p,i)=>planKey(p,i)===t.plan_key);
  const route=(await c.query(`select plan_signature from ${S}seller_routes where product_id=$1 and plan_key=$2`,[t.product_id,t.plan_key])).rows[0];
  if(!plan||product.active===false||plan.active===false||signature(plan)!==route?.plan_signature||epinbyPlan(product,plan)||product.supplier?.provider==='epinby'||plan.supplier?.provider==='epinby')throw fail(409,'Package changed. Admin review required.');
  if(['awaiting_payment','awaiting_stock'].includes(t.checkout_snapshot?.epointPayment?.state)||!allowed||!t.payment_confirmed||['rejected','cancelled','expired'].includes(t.order_status)||t.cancellation)throw fail(403,'Order access has been revoked.');
  if(assigned&&(t.seller_id!==seller.id||t.state!=='claimed'))throw fail(403,'Only the current claiming seller can access this order.');
  if(await competing(c,t.product_id,t.plan_key,t.line_index,t.order_id))throw fail(409,'Another fulfillment mechanism is active. Needs review.');return t;
 }
 async function list(user){const c=await pool.connect();try{await c.query('begin');const seller=await actor(c,user);
  const items=(await c.query(`select t.id,t.order_id,t.line_index,t.title,t.plan_name,t.quantity,t.state,case when t.seller_id=$1 then t.claim_id end claim_id,t.claimed_at,t.completed_at,t.created_at,o.order_code,s.name as seller_name,t.seller_id=$1 as mine,a.passed,
   exists(select 1 from ${S}seller_routes r join ${S}seller_route_members m using(product_id,plan_key) where r.product_id=t.product_id and r.plan_key=t.plan_key and r.enabled and m.seller_id=$1) as eligible
   from ${S}seller_tasks t join ${S}seller_task_audience a on a.task_id=t.id and a.seller_id=$1 join public.payment_orders o on o.id=t.order_id left join ${S}routing_sellers s on s.id=t.seller_id order by t.created_at desc limit 300`,[seller.id])).rows;
  await c.query('commit');return {seller:{name:seller.name,id:seller.id},items};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}}
 async function action(user,input){if(!uuid(input.id)||!uuid(input.requestId))throw fail(400,'Operation key required.');return transaction(async c=>{
  const seller=await actor(c,user),t=await member(c,seller,input.id),own=t.seller_id===seller.id;
  const previous=(await c.query(`select * from ${S}seller_task_audit where request_id=$1`,[input.requestId])).rows[0];if(previous){if(previous.task_id!==t.id||previous.actor!==seller.id||previous.action!==input.action)throw fail(409,'Operation key conflict.');return {ok:true,replayed:true};}
  if(input.action==='claim'){
   if(own&&t.state==='claimed')return {ok:true,claimId:t.claim_id};if(t.state!=='open')throw fail(409,'This order is already claimed.');
   if((await c.query(`select passed from ${S}seller_task_audience where task_id=$1 and seller_id=$2`,[t.id,seller.id])).rows[0].passed)throw fail(409,'You passed this order.');
   const claim=crypto.randomUUID();await c.query(`update ${S}seller_tasks set state='claimed',seller_id=$2,claim_id=$3,claimed_at=now() where id=$1`,[t.id,seller.id,claim]);await audit(c,t.id,seller.id,'claim',null,input.requestId);return {ok:true,claimId:claim};
  }
  if(input.action==='pass'){
   if(!text(input.reason,400)||!['open','claimed'].includes(t.state)||t.state==='claimed'&&!own)throw fail(409,'Pass is not available. A reason is required.');
   if(own&&input.claimId!==t.claim_id)throw fail(409,'Claim changed. Refresh the panel.');
   const review=own&&input.started!==false;if(own)await c.query(`update ${S}seller_tasks set state=$2,seller_id=case when $2='open' then null else seller_id end,claim_id=case when $2='open' then null else claim_id end,claimed_at=case when $2='open' then null else claimed_at end where id=$1`,[t.id,review?'needs_review':'open']);
   await c.query(`update ${S}seller_task_audience set passed=true where task_id=$1 and seller_id=$2`,[t.id,seller.id]);await audit(c,t.id,seller.id,'pass',input.reason,input.requestId);return {ok:true,needsReview:review};
  }
  if(input.action==='complete'){
   await member(c,seller,t.id,{assigned:true});if(input.claimId!==t.claim_id||input.confirmed!==true)throw fail(409,'Confirm completion for the current claim.');
   // Delegate validation, per-line quantity, encryption and customer mail to the
   // existing delivery transaction. Its writes and this state commit together.
   const result=await adminDelivery(pool,security,'seller:'+seller.id,t.order_id,{...input.delivery,requestId:input.requestId,line:t.line_index,quantity:1},{transaction:c,roomStockSecret});
   const done=Number((await c.query(`select coalesce(sum(quantity),0) n from ${S}customer_order_deliveries where order_id=$1 and line_index=$2`,[t.order_id,t.line_index])).rows[0].n);
   const line=deliveryLines(t.order_data)[t.line_index];
   if(done>=line.quantity)await c.query(`update ${S}seller_tasks set state='completed',completed_at=now() where id=$1`,[t.id]);await audit(c,t.id,seller.id,'complete',null,input.requestId);return {ok:true,remaining:Math.max(0,line.quantity-done),status:result.status};
  }
  throw fail(400,'Unknown action.');
 });}
 async function details(user,id){if(!uuid(id))throw fail(400,'Invalid order.');return transaction(async c=>{
  const seller=await actor(c,user),t=await member(c,seller,id,{assigned:true});const snapshot=t.checkout_snapshot?.cartVersion===2?t.checkout_snapshot.items[t.line_index]:t.checkout_snapshot;
  const catalog=await loadCatalog(),p=catalog.products.find(p=>p.id===t.product_id),pl=p?.plans?.find((x,i)=>planKey(x,i)===t.plan_key);if(!p||!pl)throw fail(409,'Package changed. Contact admin.');
  const values=snapshot?.detailsCipher?JSON.parse(security.decryptSecret(snapshot.detailsCipher)):{};
  const fields=(Array.isArray(snapshot?.fields)&&snapshot.fields.length?snapshot.fields:checkoutFields(p,pl)).filter(f=>typeof values[f.key]==='string'&&values[f.key]).map(f=>({key:f.key,label:f.label,value:values[f.key],sensitive:f.sensitive===true||f.type==='password'||/password|şifrə|sifre/i.test(f.key+' '+f.label)}));
  const progress=await adminDelivery(pool,security,'seller:'+seller.id,t.order_id,null,{transaction:c});return {claimId:t.claim_id,fields,remaining:progress.lines.find(x=>x.index===t.line_index)?.remaining||0,renewal:!!snapshot?.renewalOrderCode};
 });}
 async function drainMail(){
  // A provider idempotency key is reused across restarts for <24h. Beyond the
  // provider retention window an unknown result is reviewed, never resent.
  await pool.query(`update ${S}seller_mail set state=case when coalesce(first_attempt_at,updated_at)>now()-interval '20 hours' then 'queued' else 'uncertain' end,reason='STALE_SENDING' where state='sending' and updated_at<now()-interval '2 minutes'`);
  for(let i=0;i<4;i++){
   const job=(await pool.query(`with due as(select event_key from ${S}seller_mail where state='queued' and next_at<=now() order by next_at for update skip locked limit 1) update ${S}seller_mail m set state='sending',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),updated_at=now() from due where due.event_key=m.event_key returning m.*`)).rows[0];if(!job)return;
   if(job.uncertain_at&&new Date(job.first_attempt_at)<new Date(Date.now()-20*3600000)){await pool.query(`update ${S}seller_mail set state='uncertain',reason='IDEMPOTENCY_WINDOW_EXPIRED' where event_key=$1`,[job.event_key]);continue;}
   const seller=(await pool.query(`select * from ${S}routing_sellers where id=$1`,[job.seller_id])).rows[0];let subject,textBody,url;
   if(job.invitation_id){const invite=(await pool.query(`select * from ${S}seller_invitations where id=$1`,[job.invitation_id])).rows[0];if(invite.accepted_at||new Date(invite.expires_at)<=new Date()){await pool.query(`update ${S}seller_mail set state='cancelled' where event_key=$1`,[job.event_key]);continue;}url=origin+'/satici#invite='+security.decryptSecret(invite.token_cipher);subject='You are invited to become a MirPanel seller';textBody=`Hello ${seller.name},\n\nYou have been invited to the MirPanel seller panel. Sign in or create your account using this Gmail address, then accept the invitation. This single-use invitation expires in 48 hours. It does not grant administrator access.\n\n${url}\n\nIf you did not expect this invitation, ignore it.`;
   }else{const task=(await pool.query(`select t.*,o.order_code from ${S}seller_tasks t join public.payment_orders o on o.id=t.order_id where t.id=$1`,[job.task_id])).rows[0];if(!seller.active){await pool.query(`update ${S}seller_mail set state='cancelled' where event_key=$1`,[job.event_key]);continue;}url=origin+'/satici?task='+task.id;subject='New order — '+task.title;textBody=`Hello ${seller.name},\n\nOrder ${task.order_code}\nProduct: ${task.title}\nPackage: ${task.plan_name}\nQuantity: ${task.quantity}\n\nSign in to view the current status and claim this order:\n${url}\n\nOnly the first eligible seller to claim can fulfill this order.`;}
   const htmlBody=`<div style="font:16px/1.5 Arial;color:#111;background:#fff;padding:24px"><h2>${esc(subject)}</h2><p>${esc(textBody).replaceAll('\n','<br>')}</p><a href="${esc(url)}">Open secure seller panel</a></div>`;
   try{const result=await send('order',{user:{email:seller.email},subject,textBody,htmlBody,idempotencyKey:job.event_key});if(!result?.id)throw Object.assign(Error(),{deliveryDisposition:'uncertain'});await pool.query(`update ${S}seller_mail set state='accepted',provider_id=$2,reason=null,updated_at=now() where event_key=$1`,[job.event_key,result.id]);}
   catch(e){const retry=job.attempts<6&&(e.deliveryDisposition==='retry'||idempotentMail&&e.deliveryDisposition==='uncertain');const delay=Math.max(Number(e.retryAfterMs)||0,Math.min(3600000,1000*3**job.attempts));await pool.query(`update ${S}seller_mail set state=$2,reason=$3,next_at=now()+($4::bigint*interval '1 millisecond'),updated_at=now(),uncertain_at=case when $5 then coalesce(uncertain_at,now()) else uncertain_at end where event_key=$1`,[job.event_key,retry?'queued':e.deliveryDisposition==='uncertain'?'uncertain':'failed',e.deliveryCode||'SELLER_MAIL_FAILED',delay,e.deliveryDisposition==='uncertain']);}
  }
 }
 async function tick(){if(stopped)return;if(running)return running;running=(async()=>{await sync();await drainMail();})().catch(()=>console.warn('SELLER_ROUTING_RETRY')).finally(()=>{running=null;});return running;}
 return {admin,accept,list,details,action,sync,drainMail,async perform(user,input){const result=await action(user,input);if(input.action==='complete')void Promise.resolve(onDelivered()).catch(()=>{});return result;},start(){if(timer)return;void tick();timer=setInterval(()=>void tick(),pollMs);timer.unref?.();},async stop(){stopped=true;clearInterval(timer);await running;}};
}
