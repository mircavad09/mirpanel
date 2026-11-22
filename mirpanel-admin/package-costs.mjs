import {parseMoneyCents,centsToDecimal,planKey} from './payment-profit.mjs';
import {epinbyPlan} from '../epinby-product.mjs';

// Both admin views write the existing cost table through its existing audited RPC.
// Locking also serializes an older server's RPC during rolling deployments.
export async function savePackageCosts(pool,items,catalog,actor='admin'){
  if(!Array.isArray(items)||!items.length||items.length>500)throw Object.assign(Error('Maya siyahısı düzgün deyil.'),{status:400});
  const plans=new Map((catalog.products||[]).flatMap(p=>(p.plans||[]).map((plan,i)=>[`${p.id}:${planKey(plan,i)}`,{p,plan}])));
  const seen=new Set();
  const normalized=items.map(item=>{
    const productId=String(item.productId||''),planId=String(item.planId??''),key=`${productId}:${planId}`,entry=plans.get(key);
    if(!entry||seen.has(key))throw Object.assign(Error('Paket dəyişib və ya təkrarlanıb. Maya məlumatını yenidən yükləyin.'),{status:409});
    seen.add(key);
    if(epinbyPlan(entry.p,entry.plan))throw Object.assign(Error('Epinby faktiki mayası əl ilə dəyişdirilə bilməz.'),{status:409});
    if(!Object.hasOwn(item,'expectedUpdatedAt'))throw Object.assign(Error('Maya məlumatını yenidən yükləyin və təkrar saxlayın.'),{status:409});
    return {productId,planId,cost:centsToDecimal(parseMoneyCents(item.cost)),expectedUpdatedAt:item.expectedUpdatedAt};
  });
  const c=await pool.connect();
  try{
    await c.query('begin');
    await c.query("set local lock_timeout='5s'");
    await c.query('lock table public.payment_plan_costs in share row exclusive mode');
    for(const item of normalized){
      const row=(await c.query('select updated_at::text as updated_at from public.payment_plan_costs where product_id=$1 and plan_id=$2',[item.productId,item.planId])).rows[0];
      // Compare timestamp in Postgres to preserve microseconds lost by JS Date.
      const same=(await c.query('select $1::timestamptz is not distinct from $2::timestamptz as same',[row?.updated_at??null,item.expectedUpdatedAt??null])).rows[0].same;
      if(!same)throw Object.assign(Error('Maya başqa görünüşdə dəyişdirilib. Yeni dəyəri yükləyib yenidən yoxlayın; yazdığınız məbləğ saxlanılmayıb.'),{status:409});
    }
    const result=(await c.query('select public.save_payment_plan_costs($1::jsonb,$2) as result',[JSON.stringify(normalized),actor])).rows[0].result;
    await c.query('commit');return result;
  }catch(error){await c.query('rollback');throw error;}finally{c.release();}
}
