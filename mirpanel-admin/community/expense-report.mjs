const integer=v=>v!==null&&v!==undefined&&v!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;

const key=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit'}).format(d):null;};
function distribute(total,weights){const sum=weights.reduce((a,b)=>a+b,0);if(!sum)return weights.map((_,i)=>i===0?total:0);const values=weights.map(w=>Math.floor(total*w/sum));let remainder=total-values.reduce((a,b)=>a+b,0);for(const {i}of weights.map((w,i)=>({i,r:total*w/sum-values[i]})).sort((a,b)=>b.r-a.r||a.i-b.i)){if(!remainder)break;values[i]++;remainder--;}return values;}
function category(product,data,line){const source=line.categoryName||product?.categoryName||line.category||product?.category||product?.categoryId;const id=typeof source==='object'?source?.id:source;const found=(data.categories||[]).find(x=>String(x.id)===String(id));return found?.title||found?.name||(typeof source==='object'?source?.name||source?.title:typeof source==='string'&&!/^\d+$/.test(source)?source:null)||'Digər';}
// A pure projection. No financial, stock, delivery or catalog records are changed.
export function buildExpenseReport(rows,data={},now=new Date()){
 const current=key(now),[year,month]=current.split('-').map(Number),months=Array.from({length:12},(_,i)=>{const d=new Date(Date.UTC(year,month-12+i,1));return {key:d.toISOString().slice(0,7),cents:0,orders:0};});
 const orders=[],groups=new Map(),top=new Map();let total=0,discount=0,discountKnown=0,discountMissing=0,fee=0,feeKnown=0,feeMissing=0,feeEstimated=false;
 for(const o of rows){
  if(o.currency!=='AZN'||(o.snapshot?.epointPayment?.excessPayment===true||o.snapshot?.epointPayment?.excessPayment==='true')||o.snapshot?.epointPayment?.state==='awaiting_payment'&&!o.payment_confirmed||!o.payment_confirmed&&!['approved','completed'].includes(o.status))continue;
  const gross=integer(o.amountCents);if(gross===null)continue;const refund=Math.min(gross,Math.max(integer(o.refundCents)||0,integer(o.walletRefundCents)||0));
  const net=gross-refund;if(net===0&&gross>0)continue;
  const snapshot=o.snapshot||{},raw=snapshot.cartVersion===2&&Array.isArray(snapshot.items)&&snapshot.items.length?snapshot.items:[{productId:o.product_id,title:o.product_title,planName:o.plan_name,quantity:o.quantity||1,unitCents:Math.round(gross/(o.quantity||1)),sourcePlanKey:snapshot.sourcePlanKey,planIndex:o.plan_id,...(snapshot.oldUnitCents!=null?{oldUnitCents:snapshot.oldUnitCents}:{})}];
  const lines=raw.map((x,index)=>{const quantity=integer(x.quantity)||1,unit=integer(x.unitCents),saved=(o.lineSnapshots||[]).filter(s=>String(s.product_id)===String(x.productId)&&String(s.plan_id)===String(x.planIndex??o.plan_id));const historical=saved.find(s=>s.snapshot?.lineId&&s.snapshot.lineId===x.lineId)||saved[0];const old=integer(x.oldUnitCents)??integer(historical?.snapshot?.oldUnitCents);const product=(data.products||[]).find(p=>String(p.id)===String(x.productId));const planKey=x.sourcePlanKey||historical?.snapshot?.sourcePlanKey;let planIndex=planKey?product?.plans?.findIndex(p=>[p.id,p.key,p.planKey].some(k=>k!=null&&String(k)===String(planKey))):-1;
   if(planIndex<0)planIndex=product?.plans?.findIndex(p=>[p.label,p.name].includes(x.planName))??-1;
   return {index,productId:String(x.productId||''),title:x.title||o.product_title||'Məhsul',plan:x.planName||o.plan_name||'',quantity,weight:unit===null?0:unit*quantity,old,unit,category:category(product,data,x),buyUrl:product&&product.active!==false&&product.plans?.some(p=>p.active!==false)&&(planIndex<0||product.plans[planIndex]?.active!==false)?'/mehsul/'+encodeURIComponent(product.slug||product.id)+(planIndex>=0?'?plan='+planIndex:''):null};});
  const amounts=distribute(gross,lines.map(x=>x.weight));const cancellation=o.cancellation,knownLineRefunds=Array.isArray(cancellation?.lines)&&integer(cancellation.refundCents)===refund&&refund>0?lines.map(x=>{const r=cancellation.lines.find(r=>Number(r.index)===x.index);return Math.min(amounts[x.index],(integer(r?.quantity)||0)*(x.unit||0));}):null;
  const refunds=knownLineRefunds&&knownLineRefunds.reduce((a,b)=>a+b,0)===refund?knownLineRefunds:distribute(refund,amounts);
  const date=o.paidAt||o.created_at,bucket=key(date);if(!bucket)continue;
  const countedProducts=new Set();let orderDiscount=0;for(const line of lines){line.cents=amounts[line.index]-refunds[line.index];line.refundedCents=refunds[line.index];delete line.weight;const retained=amounts[line.index]?line.cents/amounts[line.index]:1;
   if(line.cents>0||gross===0){if(line.old!==null&&line.unit!==null&&line.unit*line.quantity===amounts[line.index]){discountKnown++;orderDiscount+=Math.round(Math.max(0,line.old-line.unit)*line.quantity*retained);}else discountMissing++;
    groups.set(line.category,(groups.get(line.category)||0)+line.cents);const id=JSON.stringify([line.productId,line.title,line.plan]);const t=top.get(id)||{productId:line.productId,title:line.title,plan:line.plan,cents:0,count:0,buyUrl:line.buyUrl};t.cents+=line.cents;if(!countedProducts.has(id)){t.count++;countedProducts.add(id);}top.set(id,t);
   }delete line.old;delete line.unit;
  }
  discount+=orderDiscount;const savedFee=integer(o.feeCents);if(savedFee!==null&&o.feeSource){feeKnown++;fee+=Math.round(savedFee*(gross?net/gross:1));if(!['provider','provider_confirmed','settlement'].includes(o.feeSource))feeEstimated=true;}else feeMissing++;
  total+=net;const bar=months.find(x=>x.key===bucket);if(bar){bar.cents+=net;bar.orders++;}
  orders.push({code:String(o.order_code),date,month:bucket,cents:net,refundCents:refund,lines:lines.map(({index,...x})=>x),url:'/profil?tab=sifarislerim&order='+encodeURIComponent(o.order_code)});
 }
 orders.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)||b.code.localeCompare(a.code));
 const categories=[...groups].map(([name,cents])=>({name,cents,percent:total?cents*100/total:0})).sort((a,b)=>b.cents-a.cents);
 return {timeZone:'Asia/Baku',generatedAt:new Date(now).toISOString(),totalCents:total,orderCount:orders.length,averageCents:orders.length?Math.round(total/orders.length):0,monthCents:months.at(-1).cents,months,orders,categories,topProducts:[...top.values()].sort((a,b)=>b.count-a.count||b.cents-a.cents),savings:{discountCents:discountKnown?discount:null,discountKnown,discountMissing,bankFeeCents:feeKnown?fee:null,feeKnown,feeMissing,feeEstimated,totalCents:discountKnown||feeKnown?discount+fee:null},basis:'confirmed purchases, recorded refunds; fully refunded purchases excluded; current catalog prices never used'};
}
export async function expenseReport(pool,userId,catalog,{now=new Date()}={}){
 if(!userId)throw Object.assign(Error('Hesaba daxil olun.'),{status:401});
 const tables=(await pool.query("select to_regclass('mirpanel_community.shop_lines') lines,to_regclass('mirpanel_community.wallet_ledger') ledger,to_regclass('mirpanel_community.epoint_purchases') purchases")).rows[0];
 const rows=(await pool.query(`select o.id,o.order_code,o.product_title,o.plan_name,to_jsonb(o)->>'product_id' product_id,to_jsonb(o)->>'plan_id' plan_id,coalesce((to_jsonb(o)->>'quantity')::int,1) quantity,o.status,o.currency,o.created_at,coalesce((to_jsonb(o)->>'payment_confirmed')::boolean,false) payment_confirmed,to_jsonb(o)->'checkout_snapshot' snapshot,to_jsonb(o)->'fulfillment_cancellation' cancellation,round(o.amount*100)::bigint::text "amountCents",coalesce((select max(r.cents) from mirpanel_community.community_refunds r where r.order_id=o.id),0)::text "refundCents",
 ${tables.ledger?`coalesce((select sum(w.cents) from mirpanel_community.wallet_ledger w where w.user_id=$1 and w.request_id::text=o.id::text and w.kind='purchase_refund'),0)::text`:'null'} "walletRefundCents",
 ${tables.lines?`(select jsonb_agg(jsonb_build_object('product_id',s.product_id,'plan_id',s.plan_id,'snapshot',jsonb_build_object('lineId',s.snapshot->'lineId','oldUnitCents',s.snapshot->'oldUnitCents','sourcePlanKey',s.snapshot->'sourcePlanKey'))) from mirpanel_community.shop_lines s where s.order_id=o.id)`:'null'} "lineSnapshots",
 ${tables.purchases?`(select p.paid_at from mirpanel_community.epoint_purchases p where p.order_id=o.id and p.user_id=$1)`:'null'} "paidAt",
 case when o.checkout_snapshot->'epointPayment'->>'paid'='true' then o.checkout_snapshot->'epointPayment'->>'feeCents' end "feeCents",case when o.checkout_snapshot->'epointPayment'->>'paid'='true' then o.checkout_snapshot->'epointPayment'->>'feeSource' end "feeSource"
 from public.payment_orders o where exists(select 1 from mirpanel_community.community_order_owners l where l.order_id=o.id and l.user_id=$1)`,[userId])).rows;
 return {accountId:userId,...buildExpenseReport(rows,await catalog(),now)};
}
