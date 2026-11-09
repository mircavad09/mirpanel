import {bakuDate,safeCalendarDate,shiftCalendarDays,addCalendarMonthsMinusDay,structuredDurationMonths} from '../payment-order-lifecycle.mjs';
import {parseMoneyCents,planKey} from '../payment-profit.mjs';
import {userPriceSignature} from './user-price-key.mjs';
import {inventoryAvailability} from '../../inventory-availability.mjs';
import {draftUuid} from '../cart-drafts.mjs';

const R='mirpanel_community.subscription_renewals';
const fail=(status,message)=>Object.assign(Error(message),{status});
const whole=(value,max)=>Number.isInteger(Number(value))&&Number(value)>=1&&Number(value)<=max?Number(value):null;
const same=(a,b)=>String(a??'').normalize('NFC').trim().toLocaleLowerCase('az')===String(b??'').normalize('NFC').trim().toLocaleLowerCase('az');
const dayDiff=(start,end)=>Math.round((Date.parse(end)-Date.parse(start))/86400000);
export function subscriptionPeriod(plan){
 const days=whole(plan?.durationDays??plan?.days,3650);
 if(days)return {unit:'days',count:days};
 const months=structuredDurationMonths(plan);
 if(months)return {unit:'months',count:months};
 // Older catalogs can have a day-based package label but no structured duration.
 const match=String(plan?.label??plan?.name??'').trim().match(/^(\d{1,3})\s*(?:günlük|gün)(?=$|\s*[(·–—-])/iu);
 return match&&whole(match[1],3650)?{unit:'days',count:Number(match[1])}:null;
}
function expiration(start,period){
 if(!start||!period)return null;
 return (period.unit==='days'?shiftCalendarDays(start,period.count-1):addCalendarMonthsMinusDay(start,period.count))||null;
}
function savedUnitCents(line,total=null,quantity=1){
 const cents=line?.unitCents;
 if(cents!=null&&/^\d+$/.test(String(cents))&&Number.isSafeInteger(Number(cents)))return Number(cents);
 try{
  const unit=parseMoneyCents(line?.unitPrice);
  if(unit!==null)return unit;
  const sum=parseMoneyCents(total);
  const count=whole(quantity,Number.MAX_SAFE_INTEGER);
  return sum!==null&&count&&sum%count===0?sum/count:null;
 }catch{return null;}
}
async function bases(pool,user,source=null){
 const rows=(await pool.query(`
  select o.order_code,o.product_id,o.product_title,o.plan_name,o.checkout_snapshot,o.amount::text,o.currency,o.quantity,
   o.service_expires_on::text, o.duration_months,o.completed_at,d.line_index,d.delivered_at,
   case when d.quantity>1 then md5(d.id::text||':'||unit.n)::uuid else coalesce(d.id,o.id) end as id,
   unit.n+coalesce((select sum(prior.quantity)::int from mirpanel_community.customer_order_deliveries prior
    where prior.order_id=d.order_id and prior.line_index=d.line_index and (prior.delivered_at,prior.id)<(d.delivered_at,d.id)),0) as unit
  from mirpanel_community.community_order_owners l join public.payment_orders o on o.id=l.order_id
  left join mirpanel_community.customer_order_deliveries d on d.order_id=o.id
  cross join lateral generate_series(1,coalesce(d.quantity,1)) as unit(n)
  where l.user_id=$1 and (o.payment_confirmed or o.status in ('approved','completed'))
   and o.status not in ('rejected','cancelled','expired')
   and (d.id is not null or (o.status='completed' and o.service_expires_on is not null and coalesce(o.quantity,1)=1))
   and ($2::uuid is null or case when d.quantity>1 then md5(d.id::text||':'||unit.n)::uuid else coalesce(d.id,o.id) end=$2)
   and not exists(select 1 from ${R} r where r.order_id=o.id and r.line_index=coalesce(d.line_index,0))
 `,[user,source])).rows;
 const entries=rows.flatMap(r=>{
  const items=r.checkout_snapshot?.items;
  const line=Array.isArray(items)?items[r.line_index??0]:null;
  if(Array.isArray(items)&&!line)return [];
  const productId=line?.productId??r.product_id;
  if(!productId||productId==='__cart__')return [];
  const label=line?.planName??r.plan_name;
  const period=subscriptionPeriod({durationMonths:line?.durationMonths??r.duration_months,label});
  const startsOn=(r.delivered_at||r.completed_at)?bakuDate(r.delivered_at||r.completed_at):null;
  const stored=(!items||items.length===1)&&Number(line?.quantity??1)===1?safeCalendarDate(r.service_expires_on):'';
  const lastPurchaseCents=r.currency==='AZN'?savedUnitCents(line??r.checkout_snapshot,line&&items.length!==1?null:r.amount,line?.quantity??r.quantity??1):null;
  return [{id:r.id,orderCode:String(r.order_code),sourceLine:(r.line_index??0)+1,sourceUnit:r.unit,productId,title:line?.title??r.product_title,plan:label,
   image:line?.image??r.checkout_snapshot?.image??'',planKey:line?.sourcePlanKey??r.checkout_snapshot?.sourcePlanKey??null,lastPurchaseCents,
   expiresOn:stored||expiration(startsOn,period),estimated:!stored&&!!period&&!!startsOn,startsOn}];
 });
 if(!entries.length)return entries;
 const events=(await pool.query(`
  select r.source_id,r.base_expires_on::text,r.expires_on::text,
   (o.checkout_snapshot->'items'->r.line_index) as plan, g.state,g.expires_at,o.status,o.payment_confirmed,
   g.created_at
  from ${R} r join mirpanel_community.shop_checkouts g on g.id=r.checkout_id
  left join public.payment_orders o on o.id=r.order_id
  where r.user_id=$1 and r.source_id=any($2::uuid[])
  order by g.created_at desc
 `,[user,entries.map(x=>x.id)])).rows;
 const today=bakuDate();
 return entries.map(entry=>{
  const attempts=events.filter(e=>e.source_id===entry.id);
  const applied=attempts.filter(e=>e.expires_on&&!['cancelled','rejected','expired'].includes(e.status)).sort((a,b)=>b.expires_on.localeCompare(a.expires_on))[0];
  if(applied){
   entry.expiresOn=applied.expires_on;entry.estimated=false;
   if(applied.plan){entry.plan=applied.plan.planName??entry.plan;entry.planKey=applied.plan.sourcePlanKey??null;entry.lastPurchaseCents=savedUnitCents(applied.plan);}
  }
  const current=attempts.filter(e=>e.base_expires_on===entry.expiresOn&&!e.expires_on);
  const pending=current.find(e=>e.state==='reserved'&&Date.parse(e.expires_at)>Date.now()||e.state==='submitted'&&!['cancelled','rejected','expired'].includes(e.status));
  const failed=current.find(e=>['cancelled','rejected','expired'].includes(e.status)||e.state==='cancelled'||e.state==='expired'||e.state==='reserved'&&Date.parse(e.expires_at)<=Date.now());
  entry.renewalStatus=pending?(pending.state==='reserved'?'reserved':pending.payment_confirmed||['approved','completed'].includes(pending.status)?'preparing':'pending'):failed?'failed':null;
  entry.days=entry.expiresOn?dayDiff(today,entry.expiresOn):null;
  entry.progress=entry.startsOn&&entry.days!==null?Math.min(100,Math.max(0,(entry.days+1)*100/Math.max(1,dayDiff(entry.startsOn,entry.expiresOn)+1))):null;
  return entry;
 });
}
export async function verifyRenewal(pool,user,id,productId,expected){
 if(!user||!draftUuid(id))throw fail(404,'Abunəlik tapılmadı.');
 const x=(await bases(pool,user,id))[0];
 if(!x||x.productId!==productId)throw fail(404,'Abunəlik tapılmadı.');
 if(x.days===null||x.days<0||expected&&x.expiresOn!==expected)throw fail(409,'Abunəliyin müddəti dəyişib. Siyahını yeniləyin.');
 if(['preparing','pending','reserved'].includes(x.renewalStatus))throw fail(409,'Bu abunəlik üçün yeniləmə artıq davam edir.');
 return {id:x.id,expiresOn:x.expiresOn,orderCode:x.orderCode,sourceLine:x.sourceLine,sourceUnit:x.sourceUnit};
}
export async function customerSubscriptions(pool,user,catalog,snapshot){
 const entries=await bases(pool,user);
 const visible=entries.filter(x=>x.days===null||x.days>=0);
 if(!visible.length)return {accountId:user,subscriptions:[]};
 // Expiry data remains useful if catalog or inventory is temporarily unavailable.
 const [data,stock,special]=await Promise.all([
  Promise.resolve().then(catalog).catch(()=>null),Promise.resolve().then(snapshot).catch(()=>null),
  pool.query('select product_id,plan_key,plan_signature,cents from mirpanel_community.user_special_prices where user_id=$1 and exists(select 1 from mirpanel_community.user_controls_release where id and enabled)',[user])
 ]);
 const products=new Map((data?.products||[]).map(p=>[p.id,p])),inventory=new Map((stock||[]).map(r=>[r.productId,r]));
 const prices=new Map(special.rows.map(p=>[JSON.stringify([p.product_id,p.plan_key,p.plan_signature]),Number(p.cents)]));
 const options=new Map();
 for(const x of visible){
  const p=products.get(x.productId);
  if(!options.has(x.productId)){
   const availability=p&&stock&&inventoryAvailability(p,inventory.get(p.id));
   options.set(x.productId,availability?(p.plans||[]).flatMap((plan,index)=>{
    if(!availability.plans[index]?.canOrder)return [];
    let price;try{price=parseMoneyCents(plan.price,{allowEmpty:false});}catch{return [];}
    const key=planKey(plan,index),cents=prices.get(JSON.stringify([p.id,key,userPriceSignature(plan)]))??price;
    if(cents<=0)return [];
    const period=subscriptionPeriod(plan);
    return [{index,key,label:plan.label||plan.name||(plan.months?plan.months+' aylıq':'Plan'),cents,canRenew:!!period}];
   }):[]);
  }
  x.options=options.get(x.productId);x.image||=p?.image||'';
  const exact=x.options.filter(a=>a.canRenew&&same(a.label,x.plan));
  const stable=x.planKey!=null&&!/^\d+$/.test(String(x.planKey));
  const matched=stable?x.options.find(a=>a.canRenew&&a.key===String(x.planKey)):exact.find(a=>a.key===String(x.planKey))||(exact.length===1?exact[0]:null);
  x.renewalCents=matched?.cents??null;
 }
 return {accountId:user,subscriptions:visible.sort((a,b)=>(a.days??Infinity)-(b.days??Infinity)||a.title.localeCompare(b.title,'az'))};
}
export async function reserveRenewals(c,user,checkout,items){
 for(const [line,item] of items.entries())if(item.renewal){
  const {id,expiresOn,period}=item.renewal;
  await c.query(`insert into ${R}(checkout_id,source_id,user_id,line_index,base_expires_on,period_unit,period_count) values($1,$2,$3,$4,$5,$6,$7)`,[checkout,id,user,line,expiresOn,period.unit,period.count]);
 }
}
export async function linkRenewals(c,checkout,order){await c.query(`update ${R} set order_id=$2 where checkout_id=$1`,[checkout,order]);}
