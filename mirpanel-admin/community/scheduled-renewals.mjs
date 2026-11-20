import fs from 'node:fs';
import crypto from 'node:crypto';
import {subscriptionReminderEntries,subscriptionPeriod} from './subscriptions.mjs';
import {planKey,parseMoneyCents} from '../payment-profit.mjs';
import {signature} from '../employee-security.mjs';
import {userPriceSignature} from './user-price-key.mjs';
import {postLedger} from '../shop.mjs';
import {drainReadyStock} from './ready-stock.mjs';
import {inventoryAvailability} from '../../inventory-availability.mjs';
const T='mirpanel_community.scheduled_renewals',BALANCE='635fc131-b9a4-4c93-9dc3-9fd25bfd25e0';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const fail=(status,message)=>Object.assign(Error(message),{status});
const installed=new WeakMap();
export function ensureScheduledRenewals(pool){
 if(!installed.has(pool)){const p=(async()=>{const c=await pool.connect();try{await c.query(fs.readFileSync(new URL('./scheduled-renewals.sql',import.meta.url),'utf8'));}catch(e){await c.query('rollback');throw e;}finally{c.release();}})().catch(e=>{installed.delete(pool);throw e;});installed.set(pool,p);}return installed.get(pool);
}
async function transaction(pool,fn){const c=await pool.connect();try{await c.query('begin');await c.query('select pg_advisory_xact_lock(714025001)');const v=await fn(c);await c.query('commit');return v;}catch(e){await c.query('rollback');throw e;}finally{c.release();}}
export const renewalLabels={authorized:'Balansdan avtomatik yenilənməyə razılıq verilib',paid_waiting:'Ödənilib — yenilənmə tarixi gözlənilir',needs_funds:'Balans kifayət etmir',awaiting_delivery:'Ödənilib — hesab təhvili gözlənilir',delivered:'Yeniləndi',cancelled:'Ləğv edilib',blocked:'Operator yoxlaması tələb olunur'};
const defaultMethod=p=>/capcut/i.test(p.id)?'new_account':p.id==='netflix'?'extend_existing':'operator';
async function planEnabled(c,p,index){
 const rows=(await c.query('select public.inventory_snapshot() inventory')).rows[0].inventory;
 const available=inventoryAvailability(p,rows.find(r=>r.productId===p.id));
 // Paid future work is allowed to wait for stock, not to bypass an admin pause.
 return !available.salesDisabled&&available.plans[index]?.active===true;
}
const publicRow=r=>({id:r.id,sourceId:r.source_id,sourceOrderCode:r.source_order_code,productId:r.product_id,title:r.snapshot.title,plan:r.snapshot.planName,cents:Number(r.cents),dueAt:r.due_at,expiresAt:r.expires_at,state:r.state,status:r.state==='delivered'&&r.method==='new_account'?r.snapshot.title+' üçün yeni '+r.snapshot.planName+' hesab təqdim edildi':renewalLabels[r.state],reason:r.reason,mode:r.mode,method:r.method,orderId:r.new_order_id,orderCode:r.new_order_code,deliveredAt:r.delivered_at});
async function event(c,r,type,message){await c.query('insert into mirpanel_community.renewal_events(renewal_id,event,message) values($1,$2,$3) on conflict do nothing',[r.id,type,message]);}
export async function renewalMethod(c,p,plan,index){
 const key=planKey(plan,index),rows=(await c.query("select method,plan_key from mirpanel_community.renewal_policies where product_id=$1 and plan_key in ($2,'*') order by (plan_key='*')",[p.id,key])).rows;
 return rows[0]?.method||defaultMethod(p);
}
export async function renewalQuote(c,user,catalog,input){
 if(!uuid(input.sourceId)||!Number.isInteger(input.planIndex))throw fail(400,'Abunəlik və paket seçin.');
 const source=(await subscriptionReminderEntries(c,[user],input.sourceId))[0];
 if(!source?.expiresOn||!source.orderId||source.days<0)throw fail(409,'Abunəlik artıq bitib və ya müddəti müəyyən edilməyib.');
 if(['reserved','pending','preparing'].includes(source.renewalStatus))throw fail(409,'Bu abunəlik üçün yeniləmə artıq davam edir.');
 const p=catalog.products.find(p=>p.id===source.productId&&p.active!==false),plan=p?.plans?.[input.planIndex];
 if(!plan||plan.active===false||!await planEnabled(c,p,input.planIndex))throw fail(409,'Paket hazırda aktiv deyil.');
 const period=subscriptionPeriod(plan),method=await renewalMethod(c,p,plan,input.planIndex);
 if(!period||method==='disabled')throw fail(409,'Bu paket üçün yenilənmə bağlıdır.');
 let cents=parseMoneyCents(plan.price,{allowEmpty:false});
 const special=(await c.query('select cents from mirpanel_community.user_special_prices where user_id=$1 and product_id=$2 and plan_key=$3 and plan_signature=$4 and exists(select 1 from mirpanel_community.user_controls_release where id and enabled) and exists(select 1 from mirpanel_community.user_seller_settings where user_id=$1 and enabled)',[user,p.id,planKey(plan,input.planIndex),userPriceSignature(plan)])).rows[0];
 if(special)cents=Number(special.cents);if(!Number.isSafeInteger(cents)||cents<=0)throw fail(409,'Yenilənmə qiyməti əlçatan deyil.');
 // Newly delivered scheduled services have exact timestamps. Legacy sources keep
 // their saved Baku calendar expiry; never rewrite historical entitlements.
 const previous=(await c.query(`select expires_at from ${T} where (new_order_id=$1 or source_id=$2 and method='extend_existing') and state='delivered' order by expires_at desc limit 1`,[source.orderId,source.id])).rows[0];
 const dueAt=previous?.expires_at||new Date(Date.parse(source.expiresOn+'T00:00:00+04:00')+86400000).toISOString();
 return {source,p,plan,period,method,cents,dueAt,key:planKey(plan,input.planIndex),signature:signature(plan)};
}
async function charge(c,r){
 if(r.checkout_id)return;
 const checkout=crypto.randomUUID(),hash=crypto.createHash('sha256').update('scheduled:'+r.user_id).digest('hex');
 await c.query(`insert into mirpanel_community.shop_checkouts(id,owner_hash,user_id,request_id,mode,method_id,input,total_cents,state,expires_at,submitted_at,model_version) values($1,$2,$3,$4,'wallet',$5,$6,$7,'submitted',clock_timestamp()+interval '10 years',clock_timestamp(),2)`,[checkout,hash,r.user_id,r.id,BALANCE,{scheduledRenewalId:r.id},r.cents]);
 await postLedger(c,{actor:r.user_id,user:r.user_id,key:checkout,cents:-Number(r.cents),kind:'purchase_debit',reason:'Müddət bitəndə icra ediləcək yenilənmə üçün ödəniş'});
 await c.query(`update ${T} set checkout_id=$2,paid_at=clock_timestamp(),state='paid_waiting',reason=null where id=$1`,[r.id,checkout]);r.checkout_id=checkout;r.state='paid_waiting';
 await event(c,r,'paid',renewalLabels.paid_waiting);
}
export async function scheduleRenewal(pool,user,catalog,input){
 await ensureScheduledRenewals(pool);
 if(!uuid(input.requestId)||!['prepaid','auto_wallet'].includes(input.mode)||input.consent!==true)throw fail(400,'Yenilənmə üsulunu və razılığınızı təsdiqləyin.');
 return transaction(pool,async c=>{
  const old=(await c.query(`select * from ${T} where user_id=$1 and request_id=$2`,[user,input.requestId])).rows[0];
  if(old){if(old.source_id!==input.sourceId||old.plan_index!==input.planIndex||old.mode!==input.mode||Number(old.cents)!==input.expectedCents)throw fail(409,'Təkrar sorğunun məlumatları uyğun deyil.');return publicRow(old);}
  if(!(await c.query('select enabled from mirpanel_community.shop_release where id')).rows[0]?.enabled)throw fail(503,'Balans xidməti hazırda əlçatan deyil.');
  const q=await renewalQuote(c,user,catalog,input);
  if(q.cents!==input.expectedCents||String(input.expectedDueAt)!==new Date(q.dueAt).toISOString())throw fail(409,'Qiymət və ya başlanğıc tarixi dəyişib. Yenidən yoxlayın.');
  if((await c.query(`select 1 from ${T} where source_id=$1 and base_expires_on=$2 and state<>'cancelled'`,[input.sourceId,q.source.expiresOn])).rowCount)throw fail(409,'Bu müddət üçün yenilənmə artıq qeydə alınıb.');
  const snap={title:q.p.title,planName:q.plan.label||q.plan.name||(q.period.count+(q.period.unit==='days'?' gün':' ay')),image:q.p.image||'',unitCents:q.cents,sourcePlanKey:q.key,duration:q.period.unit==='months'?q.period.count:null,durationMonths:q.period.unit==='months'?q.period.count:null,...(q.period.unit==='days'?{durationDays:q.period.count}:{}),quantity:1,productId:q.p.id,planIndex:input.planIndex};
  // LEG/RGA assignments are proven entitlements but not payment_orders rows.
  // Keep their real source identity/code, without inventing an old sale.
  const sourceOrder=(await c.query('select id from public.payment_orders where id=$1',[q.source.orderId])).rows[0]?.id||null;
  const r=(await c.query(`insert into ${T}(id,user_id,request_id,source_id,source_order_id,source_order_code,source_line,source_unit,base_expires_on,due_at,product_id,plan_key,plan_index,plan_signature,snapshot,period_unit,period_count,method,mode,cents,consent_at,state) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,clock_timestamp(),'authorized') returning *`,[crypto.randomUUID(),user,input.requestId,input.sourceId,sourceOrder,q.source.orderCode,q.source.sourceLine||1,q.source.sourceUnit||1,q.source.expiresOn,q.dueAt,q.p.id,q.key,input.planIndex,q.signature,snap,q.period.unit,q.period.count,q.method,input.mode,q.cents])).rows[0];
  await event(c,r,'authorized',input.mode==='auto_wallet'?'Müştəri yalnız bu yenilənmə üçün göstərilən məbləğin müddət bitəndə balansdan tutulmasına razılıq verdi.':'Müştəri əvvəlcədən ödənişi təsdiqlədi.');
  if(input.mode==='prepaid')await charge(c,r);
  return publicRow(r);
 });
}
export async function listScheduledRenewals(pool,user){await ensureScheduledRenewals(pool);return (await pool.query(`select r.*,o.order_code new_order_code from ${T} r left join public.payment_orders o on o.id=r.new_order_id where r.user_id=$1 order by r.created_at desc limit 200`,[user])).rows.map(publicRow);}
export async function cancelScheduledRenewal(pool,user,id){
 await ensureScheduledRenewals(pool);if(!uuid(id))throw fail(400,'Yenilənmə seçin.');
 return transaction(pool,async c=>{const r=(await c.query(`select * from ${T} where id=$1 and user_id=$2 for update`,[id,user])).rows[0];if(!r)throw fail(404,'Yenilənmə tapılmadı.');if(r.state==='cancelled')return publicRow(r);if(r.new_order_id)throw fail(409,'Sifariş artıq yaradılıb. Qalan təhvil üçün operatorun mövcud ləğv qaydasından istifadə edin.');
 if(r.checkout_id){await postLedger(c,{actor:user,user,key:r.id,cents:Number(r.cents),kind:'purchase_refund',reason:'Planlaşdırılmış yenilənmənin ləğvi'});await c.query("update mirpanel_community.shop_checkouts set state='cancelled' where id=$1",[r.checkout_id]);}
 await c.query(`update ${T} set state='cancelled',reason=null where id=$1`,[id]);await event(c,r,'cancelled','Yenilənmə ləğv edildi; tutulmuş məbləğ varsa balansa qaytarıldı.');r.state='cancelled';return publicRow(r);});
}
async function createOrder(c,r){
 const checkout=r.checkout_id,order=crypto.randomUUID(),key=crypto.randomUUID();
 const code=(await c.query('update public.payment_order_number_counter set last_number=last_number+1 where id=true returning last_number::text n')).rows[0]?.n;if(!code)throw Error('RENEWAL_ORDER_NUMBER_UNAVAILABLE');
 const parent=(await c.query("insert into public.payment_reservations(method_id,product_id,plan_id,amount,currency,idempotency_key,checkout_key,expires_at) values($1,'__cart__','cart',$2,'AZN',$3,$4,clock_timestamp()+interval '20 minutes') returning id,expires_at",[BALANCE,Number(r.cents)/100,crypto.randomUUID(),key])).rows[0];
 await c.query("update mirpanel_community.shop_checkouts set state='reserved',main_reservation_id=$2,main_checkout_key=$3,expires_at=$4 where id=$1",[checkout,parent.id,key,parent.expires_at]);
 await c.query("select set_config('mirpanel.inventory_required','',true)");
 const childKey=crypto.randomUUID(),child=(await c.query("insert into public.payment_reservations(method_id,product_id,plan_id,amount,currency,idempotency_key,checkout_key,expires_at,capacity_shadow,cart_parent_reservation_id) values($1,$2,$3,$4,'AZN',$5,$6,(select expires_at from public.payment_reservations where id=$7),true,$7) returning id",[BALANCE,r.product_id,String(r.plan_index),Number(r.cents)/100,crypto.randomUUID(),childKey,parent.id])).rows[0].id;
 const item={...r.snapshot,renewalScheduleId:r.id,previousOrderCode:r.source_order_code,...(r.method==='extend_existing'?{renewalOrderCode:r.source_order_code,renewalSourceLine:r.source_line,renewalSourceUnit:r.source_unit}:{})};
 // Manual/operator work must never be silently fulfilled from ready stock.
 if(r.method!=='new_account')delete item.sourcePlanKey;
 await c.query('insert into mirpanel_community.shop_lines(checkout_id,position,reservation_id,checkout_key,product_id,plan_id,title,plan_name,image,unit_cents,snapshot) values($1,0,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[checkout,child,childKey,r.product_id,String(r.plan_index),item.title,item.planName,item.image,r.cents,{...item,signature:r.plan_signature}]);
 await c.query("insert into public.payment_orders(id,order_code,reservation_id,method_id,product_id,product_title,plan_id,plan_name,amount,currency,consent_accepted,payment_source,payment_confirmed,quantity,checkout_snapshot) values($1,$2,$3,$4,'__cart__',$5,'cart',$6,$7,'AZN',true,'wallet',true,1,$8)",[order,code,parent.id,BALANCE,item.title,item.planName,Number(r.cents)/100,{cartVersion:2,cartGroupId:checkout,scheduledRenewalId:r.id,previousOrderCode:r.source_order_code,items:[item]}]);
 await c.query('insert into mirpanel_community.community_order_owners(order_id,user_id) values($1,$2)',[order,r.user_id]);
 const hash=(await c.query('select owner_hash from mirpanel_community.shop_checkouts where id=$1',[checkout])).rows[0].owner_hash;
 await c.query('insert into public.browser_order_owners(order_id,token_hash) values($1,$2)',[order,hash]);
 await c.query('update mirpanel_community.shop_lines set order_id=$2 where checkout_id=$1',[checkout,order]);
 await c.query("update public.payment_reservations set status='reviewing' where id=any($1::uuid[])",[[parent.id,child]]);
 await c.query("update mirpanel_community.shop_checkouts set state='submitted',order_id=$2 where id=$1",[checkout,order]);
 await c.query(`update ${T} set new_order_id=$2,state='awaiting_delivery',reason=null where id=$1`,[r.id,order]);
 if(r.method==='extend_existing')await c.query('insert into mirpanel_community.subscription_renewals(checkout_id,source_id,user_id,order_id,line_index,base_expires_on,period_unit,period_count) values($1,$2,$3,$4,0,$5,$6,$7)',[checkout,r.source_id,r.user_id,order,r.base_expires_on,r.period_unit,r.period_count]);
 await event(c,r,'order_created','Ödənilib — hesab təhvili gözlənilir. Yeni sifariş № '+code);
 await c.query("insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata) values('system','scheduled-renewal','renewal.order_created','order',$1,$2)",[order,{renewalId:r.id,previousOrderCode:r.source_order_code}]);
 return {order,item};
}
export function createScheduledRenewalWorker(pool,loadCatalog,securityFactory,{onWork=()=>{},onError=()=>{},pollMs=30000}={}){
 let timer,running,stopped=false;
 async function run(){await ensureScheduledRenewals(pool);const catalog=await loadCatalog();
  const ids=(await pool.query(`select id from ${T} where state in ('authorized','paid_waiting','needs_funds') and due_at<=clock_timestamp() order by due_at,created_at limit 50`)).rows;
  let orders=0,errors=0;
  for(const {id} of ids){try{const created=await transaction(pool,async c=>{
   const r=(await c.query(`select * from ${T} where id=$1 for update`,[id])).rows[0];if(!r||r.new_order_id||!['authorized','paid_waiting','needs_funds'].includes(r.state))return;
   const allowed=(await c.query('select u."emailVerified",coalesce(p.blocked,false) and (p.ban_until is null or p.ban_until>clock_timestamp()) blocked from mirpanel_community."user" u left join mirpanel_community.community_profiles p on p.user_id=u.id where u.id=$1',[r.user_id])).rows[0];
   if(!allowed?.emailVerified||allowed.blocked){await c.query(`update ${T} set reason='Hesabın giriş icazəsi yoxlanmalıdır' where id=$1`,[id]);return;}
   const p=catalog.products.find(p=>p.id===r.product_id&&p.active!==false),index=p?.plans?.findIndex((plan,i)=>planKey(plan,i)===r.plan_key&&signature(plan)===r.plan_signature),plan=index>=0?p.plans[index]:null;
   if(!plan||!await planEnabled(c,p,index)||await renewalMethod(c,p,plan,index)==='disabled'){await c.query(`update ${T} set reason='Məhsul/paket dəyişib və ya yenilənmə bağlıdır' where id=$1`,[id]);await event(c,r,'configuration','Paket sazlaması dəyişib. Operator yoxlaması lazımdır; əlavə pul tutulmayıb.');return;}
   r.plan_index=index;
   if(!r.checkout_id){const balance=Number((await c.query('select cents from mirpanel_community.wallet_accounts where user_id=$1 for update',[r.user_id])).rows[0]?.cents||0);if(balance<Number(r.cents)){await c.query(`update ${T} set state='needs_funds',reason='Balans kifayət etmir' where id=$1`,[id]);await event(c,r,'needs_funds','Yenilənmə üçün balans kifayət etmir. Balansı artırın və ya yenilənməni ləğv edin.');return;}await charge(c,r);}
   const {order,item}=await createOrder(c,r);
   if(r.method==='new_account')await drainReadyStock(c,securityFactory);
   return true;
  });if(created)orders++;}catch(e){errors++;onError(e);console.warn('SCHEDULED_RENEWAL_RETRY');}}
  if(orders)void Promise.resolve(onWork()).catch(()=>{});return {orders,errors,checked:ids.length};
 }
 function wake(){if(stopped)return Promise.resolve();if(running)return running;return running=run().finally(()=>{running=null;});}
 return {wake,start(){if(timer)return;stopped=false;void wake().catch(()=>console.warn('SCHEDULED_RENEWAL_RETRY'));timer=setInterval(()=>void wake().catch(()=>console.warn('SCHEDULED_RENEWAL_RETRY')),pollMs);timer.unref?.();},async stop(){stopped=true;clearInterval(timer);timer=null;await running;}};
}
export async function adminScheduledRenewals(pool,catalog,input={},actor){
 await ensureScheduledRenewals(pool);
 if(input.action==='policy'){
  const p=catalog.products.find(p=>p.id===input.productId),plan=input.planIndex==null?null:p?.plans?.[input.planIndex];
  if(!p||input.planIndex!=null&&!plan||!['new_account','extend_existing','operator','disabled'].includes(input.method))throw fail(400,'Məhsul, paket və yenilənmə üsulunu seçin.');
  await pool.query('insert into mirpanel_community.renewal_policies(product_id,plan_key,method,updated_by) values($1,$2,$3,$4) on conflict(product_id,plan_key) do update set method=excluded.method,updated_by=excluded.updated_by,updated_at=clock_timestamp()',[p.id,plan?planKey(plan,input.planIndex):'*',input.method,actor]);
 }
 const page=Math.max(1,Math.min(100000,Number(input.page)||1)),filter=['waiting','renewed','unrenewed','delivery'].includes(input.filter)?input.filter:'waiting';
 const condition={waiting:"r.state in ('authorized','paid_waiting','needs_funds','blocked')",renewed:"r.state='delivered'",delivery:"r.state='awaiting_delivery'",unrenewed:"r.state='cancelled' and r.due_at<=clock_timestamp()"}[filter];
 let rows=(await pool.query(`select r.*,o.order_code new_order_code,u.name customer,p.member_number from ${T} r join mirpanel_community."user" u on u.id=r.user_id left join mirpanel_community.community_member_numbers p on p.user_id=r.user_id left join public.payment_orders o on o.id=r.new_order_id where ${condition} order by r.due_at desc,r.id limit 20 offset $1`,[(page-1)*20])).rows.map(r=>({...publicRow(r),customer:r.customer,customerId:r.member_number}));
 let total=Number((await pool.query(`select count(*) n from ${T} r where ${condition}`)).rows[0].n);
 if(filter==='unrenewed'){
  const history=[];let after='';
  do{const users=(await pool.query('select u.id,u.name,n.member_number from mirpanel_community."user" u left join mirpanel_community.community_member_numbers n on n.user_id=u.id where u.id>$1 and exists(select 1 from mirpanel_community.community_order_owners o where o.user_id=u.id) order by u.id limit 100',[after])).rows;if(!users.length)break;
   const pending=new Set((await pool.query(`select source_id from ${T} where user_id=any($1::text[]) and state<>'cancelled'`,[users.map(u=>u.id)])).rows.map(r=>r.source_id));
   const entries=await subscriptionReminderEntries(pool,users.map(u=>u.id));const identities=new Map(users.map(u=>[u.id,u]));
   for(const x of entries)if(x.days!==null&&x.days<0&&!pending.has(x.id)&&!['pending','preparing','reserved'].includes(x.renewalStatus)){const u=identities.get(x.userId);history.push({id:x.id,sourceId:x.id,sourceOrderCode:x.orderCode,productId:x.productId,title:x.title,plan:x.plan,dueAt:new Date(Date.parse(x.expiresOn+'T00:00:00+04:00')+86400000).toISOString(),state:'unrenewed',status:'Müddəti bitib — yenilənməyib',customer:u.name,customerId:u.member_number});}
   if(users.length<100)break;after=users.at(-1).id;
  }while(true);
  history.sort((a,b)=>Date.parse(b.dueAt)-Date.parse(a.dueAt)||a.id.localeCompare(b.id));total=history.length;rows=history.slice((page-1)*20,page*20);
 }
 const configured=new Map((await pool.query('select product_id,plan_key,method from mirpanel_community.renewal_policies')).rows.map(r=>[JSON.stringify([r.product_id,r.plan_key]),r.method]));
 const policies=[];for(const p of catalog.products.filter(p=>p.active!==false))for(const [i,plan]of(p.plans||[]).entries())if(subscriptionPeriod(plan))policies.push({productId:p.id,title:p.title,planIndex:i,plan:plan.label||plan.name,method:configured.get(JSON.stringify([p.id,planKey(plan,i)]))||configured.get(JSON.stringify([p.id,'*']))||defaultMethod(p)});
 return {rows,page,total,pages:Math.max(1,Math.ceil(total/20)),filter,policies,pollSeconds:30};
}
