import {catalogPlans} from './user-controls.mjs';
export async function customerPrices(pool,user,data){
 const rows=user?(await pool.query(`select product_id,plan_key,plan_signature,cents from mirpanel_community.user_special_prices
 where user_id=$1 and exists(select 1 from mirpanel_community.user_controls_release where id and enabled)
 and exists(select 1 from mirpanel_community.user_seller_settings where user_id=$1 and enabled)`,[user])).rows:[];
 return {accountId:user??null,prices:catalogPlans(data).map(p=>({productId:p.productId,planIndex:p.planIndex,standardCents:p.standard,
  cents:Number(rows.find(r=>r.product_id===p.productId&&r.plan_key===p.planKey&&r.plan_signature===p.signature)?.cents??p.standard)}))};
}
