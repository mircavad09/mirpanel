import {parseMoneyCents,centsToDecimal} from './payment-profit.mjs';
import {epinbyPlan} from '../epinby-product.mjs';
// Runs inside the package-cost save transaction. Only missing snapshots are filled.
export async function reconcileMissingPackageCosts(c,items,catalog,actor){
 const saved=new Map(items.filter(x=>x.cost!==null).map(x=>[x.productId+':'+x.planId,x]));
 if(!saved.size)return{updatedOrders:0,updatedUnits:0,unmatched:[]};
 const products=new Map((catalog.products||[]).map(p=>[p.id,p]));
 const rows=(await c.query(`select * from public.payment_orders o where cost_price_snapshot is null and currency='AZN'
 and status not in ('rejected','expired','cancelled') and (payment_confirmed or status in ('approved','completed'))
 and (product_id=any($1::text[]) or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(checkout_snapshot->'items')='array' then checkout_snapshot->'items' else '[]'::jsonb end) x where x->>'productId'=any($1::text[]))) order by id for update`,[[...new Set(items.map(x=>x.productId))]])).rows;
 const supplierTable=(await c.query("select to_regclass('mirpanel_community.api_dispatches') present")).rows[0].present;
 const now=(await c.query('select clock_timestamp()::text at')).rows[0].at;
 const result={updatedOrders:0,updatedUnits:0,unmatched:[]};
 for(const o of rows){
  const lines=o.product_id==='__cart__'?o.checkout_snapshot?.items||[]:[{productId:o.product_id,sourcePlanKey:o.checkout_snapshot?.sourcePlanKey??o.plan_id,quantity:o.quantity||1}];
  const previous=o.cost_lines_snapshot||[],next=structuredClone(previous);let changed=false,units=0;
  for(let i=0;i<lines.length;i++){
   const line=lines[i];if(previous[i]?.unitCost!=null)continue;
   const product=products.get(line.productId),key=line.sourcePlanKey,entry=saved.get(line.productId+':'+key);
   if(!items.some(x=>x.productId===line.productId))continue;
   const plan=key!=null?product?.plans?.find(p=>p.id!=null&&String(p.id)===String(key)):null;
   if(plan&&!entry)continue;
   if(!plan||!entry){result.unmatched.push({orderCode:o.order_code,lineIndex:i,productId:line.productId,planId:key??null,reason:key==null?'Sabit paket ID-si saxlanmayıb':'Saxlanmış paket ID-si bu maya ilə uyğun deyil'});continue;}
   if(line.pricingId&&plan.pricingId&&line.pricingId!==plan.pricingId){result.unmatched.push({orderCode:o.order_code,lineIndex:i,planId:key,reason:'Sabit qiymət identifikatoru uyğun deyil'});continue;}
   const supplierEvidence=supplierTable&&(await c.query("select 1 from mirpanel_community.api_dispatches where order_id=$1 and line_index=$2 and settings->>'provider'='epinby' limit 1",[o.id,i])).rowCount;
   if(supplierEvidence||line.supplier?.provider==='epinby'||epinbyPlan(product,plan)){result.unmatched.push({orderCode:o.order_code,lineIndex:i,reason:'Epinby faktiki xərc mənbəyi qorundu'});continue;}
   const quantity=Number(line.quantity||1);if(!Number.isSafeInteger(quantity)||quantity<1)throw Error('ORDER_COST_QUANTITY_INVALID');
   next[i]={...(previous[i]||{}),quantity,unitCost:entry.cost,source:'estimate',providedAt:now,providedBy:actor,providedReason:'admin_cost_save_missing_only',productId:line.productId,planId:String(key)};
   changed=true;units+=quantity;
  }
  if(!changed)continue;
  for(let i=0;i<lines.length;i++)next[i]??={quantity:Number(lines[i].quantity||1),unitCost:null,source:null};
  const total=next.every(x=>x.unitCost!=null)?next.reduce((n,x)=>n+parseMoneyCents(x.unitCost)*Number(x.quantity),0):null;
  if(total!==null&&!Number.isSafeInteger(total))throw Error('ORDER_COST_TOTAL_INVALID');
  const sale=parseMoneyCents(o.sale_price_snapshot??o.amount),profit=total===null?null:sale-total;
  await c.query(`update public.payment_orders set cost_lines_snapshot=$2,cost_price_snapshot=$3,sale_price_snapshot=coalesce(sale_price_snapshot,amount),profit_snapshot=$4,profit_margin_snapshot=$5,cost_source=case when $3::numeric is null then cost_source else 'backfilled_current_cost' end,cost_backfilled_at=clock_timestamp() where id=$1 and cost_price_snapshot is null`,[o.id,JSON.stringify(next),centsToDecimal(total),centsToDecimal(profit),sale&&profit!=null&&Math.abs(profit*100/sale)<99999?Math.round(profit*10000/sale)/100:null]);
  await c.query(`insert into public.payment_audit_log(actor_type,actor_ref,action,entity_type,entity_id,metadata) values('admin',$1,'order.cost_completed_after_admin_save','order',$2,$3)`,[actor,o.id,JSON.stringify({at:now,source:'admin_supplied_estimate',before:{lines:o.cost_lines_snapshot,cost:o.cost_price_snapshot,source:o.cost_source},after:{lines:next,cost:centsToDecimal(total)},units})]);
  result.updatedOrders++;result.updatedUnits+=units;
 }
 return result;
}
