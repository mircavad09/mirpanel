import { epinbyPlan } from '../epinby-product.mjs';

const schema='mirpanel_community.';
const decimal=/^\d{1,15}(?:\.\d{1,8})?$/;
const digits=16, scale=10n**BigInt(digits);
export function exactMoney(value){
 const [whole,fraction='']=String(value??'0').split('.');
 return BigInt(whole)*scale+BigInt((fraction+'0'.repeat(digits)).slice(0,digits))*(whole.startsWith('-')?-1n:1n);
}
export function exactDecimal(value){
 const magnitude=value<0n?-value:value;
 const fraction=String(magnitude%scale).padStart(digits,'0').replace(/0+$/,'');
 return (value<0n?'-':'')+String(magnitude/scale)+(fraction?'.'+fraction:'');
}
export function displayMoney(value){
 const centsPer=scale/100n;
 const magnitude=value<0n?-value:value;
 const cents=(magnitude+centsPer/2n)/centsPer;
 return (value<0n&&cents?'-':'')+(cents/100n)+'.'+String(cents%100n).padStart(2,'0');
}
export function epinbyRate(env=process.env){
 const rate=String(env.EPINBY_USD_AZN_RATE??'1.70').trim();
 return decimal.test(rate)&&Number(rate)>0?rate:null;
}
export function supplierCost(data,{source,productId,rate=epinbyRate(),checkedAt=new Date().toISOString()}){
 const raw=String(data?.price??'').trim(),currency=String(data?.currency??'').trim().toUpperCase();
 const amount=decimal.test(raw)?raw:null;
 const exchangeRate=currency==='AZN'?'1':currency==='USD'?rate:null;
 const reason=amount===null?'Təchizatçı qiymət göndərməyib və ya qiymət formatı yanlışdır.'
  :!currency?'Təchizatçı valyutanı göstərməyib.'
  :!exchangeRate?(currency==='USD'?'USD → AZN məzənnəsi düzgün sazlanmayıb.':'Dəstəklənməyən valyuta: '+currency):null;
 return {provider:'epinby',productId,amount,currency:currency||null,exchangeRate,
  azn:reason?null:exactDecimal(exactMoney(amount)*exactMoney(exchangeRate)/scale),source,checkedAt,reason};
}
export function supplierCharge(data,unit,quote,rate=epinbyRate()){
 const latest=supplierCost(data,{source:'supplier_charge',productId:unit.product_id,rate:quote?.currency==='USD'?quote.exchangeRate:rate});
 if(latest.azn==null)return null;
 const differenceAzn=quote?.azn!=null?exactDecimal(exactMoney(latest.azn)-exactMoney(quote.azn)):null;
 return {...latest,externalId:String(data.order_id),differenceAzn};
}
export async function findEpinbyCostProduct(send,supplier){
 let page=1;
 for(;;page++){
  const result=await send({page,per_page:50,...(supplier.gameId?{game_id:supplier.gameId}:{}),...(supplier.categoryId?{category_id:supplier.categoryId}:{})});
  const last=Number(result?.meta?.last_page);
  if(result?.success!==true||!Array.isArray(result.data)||Number(result.meta?.current_page)!==page||
    !Number.isSafeInteger(last)||last<0||last>10000)throw Error('Epinby kataloq səhifəsi təsdiqlənmədi.');
  const product=result.data.find(item=>Number(item.id)===supplier.productId);
  if(product||page>=last)return product;
 }
}
export async function saveCatalogCost(db,cost){
 await db.query(`insert into ${schema}epinby_catalog_costs as c(supplier_product_id,cost) values($1,$2)
  on conflict(supplier_product_id) do update set cost=excluded.cost
  where c.cost->>'checkedAt' <= excluded.cost->>'checkedAt'`,[cost.productId,cost]);
}
export async function readCatalogCosts(db,catalog){
 const ids=[...new Set((catalog?.products||[]).flatMap(p=>(p.plans||[]).map(plan=>epinbyPlan(p,plan)?.productId).filter(Boolean)))];
 if(!ids.length||!(await db.query("select to_regclass('mirpanel_community.epinby_catalog_costs') n")).rows[0].n)return new Map();
 return new Map((await db.query(`select supplier_product_id,cost from ${schema}epinby_catalog_costs where supplier_product_id=any($1::bigint[])`,[ids])).rows.map(r=>[Number(r.supplier_product_id),r.cost]));
}
export async function readEpinbyOrderCosts(db,ids){
 if(!ids.length||!(await db.query(`select exists(select 1 from pg_attribute where attrelid=to_regclass('mirpanel_community.epinby_order_units') and attname='supplier_charge' and not attisdropped) n`)).rows[0].n)return new Map();
 const rows=(await db.query(`select d.order_id,d.line_index,u.unit_index,u.state,u.execution_quote,u.supplier_charge
  from ${schema}api_dispatches d left join ${schema}epinby_order_units u on u.dispatch_id=d.id
  where d.order_id=any($1::uuid[]) and d.supplier_id='e91bb000-0000-4000-8000-000000000001' order by d.line_index,u.unit_index`,[ids])).rows;
 const orders=new Map();
 for(const row of rows){
  if(!orders.has(row.order_id))orders.set(row.order_id,new Map());
  const lines=orders.get(row.order_id);
  if(!lines.has(row.line_index))lines.set(row.line_index,[]);
  if(row.unit_index!=null)lines.get(row.line_index).push(row);
 }
 return orders;
}
