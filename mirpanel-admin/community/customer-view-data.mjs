import {customerPrices} from './customer-pricing.mjs';
import {inventoryAvailability} from '../../inventory-availability.mjs';
import {productSeoSlug} from '../product-pages.mjs';
import {walletHistory} from './wallet.mjs';
import {Repository} from './repository.mjs';
import {accountPanel,paymentHistory} from './account-panel.mjs';
import {customerSubscriptions} from './subscriptions.mjs';
import {createAccountOrders} from '../account-orders.mjs';
import {deliveryRecords,ownerCodes} from './order-delivery.mjs';
import {withLegacyHistory} from './netflix-room-legacy.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});

// Never creates a customer session. Even accidental writes in a reused reader
// fail at the database boundary; presence and authentication hooks are not run.
export async function readCustomerView(pool,userId,path,{catalog,security,store}){
 const c=await pool.connect();
 try{
  await c.query('begin isolation level repeatable read read only');
  await c.query("set local statement_timeout='10s'");
  const user=(await c.query('select id,name,email,"emailVerified" from "user" where id=$1',[userId])).rows[0];
  if(!user)throw fail(404,'Müştəri tapılmadı.');
  const u=new URL(path,'http://view.invalid'),p=u.pathname;
  const fields="to_jsonb(o)->>'product_id' as product_id,to_jsonb(o)->>'plan_id' as plan_id,(to_jsonb(o)->>'duration_months')::integer as duration_months,to_jsonb(o)->>'service_expires_on' as service_expires_on,o.id,o.checkout_snapshot,o.order_code,o.product_title,o.plan_name,o.amount,o.currency,o.created_at,o.status,to_jsonb(o)->'fulfillment_cancellation' as fulfillment_cancellation,(to_jsonb(o)->>'payment_confirmed')::boolean as payment_confirmed,(to_jsonb(o)->>'quantity')::integer as quantity,o.receipt_path,o.receipt_mime,o.receipt_deleted_at";
  const base=`select ${fields} from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=$1`;
  const scope={userId,catalog,
   topups:async()=>(await c.query("select id,requested_cents::text,approved_cents::text,status,created_at from wallet_topups where user_id=$1 and status<>'draft' order by created_at desc,id desc limit 30",[userId])).rows,
   page:async(before,id)=>(await c.query(base+' and ($2::timestamptz is null or (o.created_at,o.id)<($2::timestamptz,$3::uuid)) order by o.created_at desc,o.id desc limit 21',[userId,before,id])).rows,
   owned:async id=>(await c.query(base+' and o.id=$2::uuid',[userId,id])).rows[0]||null,
   byCode:async code=>(await c.query(base+' and o.order_code::text=$2',[userId,code])).rows[0]||null,
   deliveries:ids=>deliveryRecords(c,ids),codes:id=>ownerCodes(c,userId,id)};
  const orders=createAccountOrders({security,store,resolve:async()=>withLegacyHistory(c,userId,scope)});
  let result;
  if(p==='/api/community/state')result={profile:await new Repository(c).profile(user,{readOnly:true}),unread:0,readOnly:true};
  else if(p==='/api/community/profile-summary'){
   const latest=(await c.query('select o.order_code,o.product_title,o.plan_name,o.amount,o.currency,o.status,o.created_at from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=$1 order by o.created_at desc,o.id desc limit 1',[userId])).rows[0]||null;
   const count=(await c.query("select count(distinct o.id)::int n from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=$1 and o.status in ('approved','completed')",[userId])).rows[0].n;
   result={latestOrder:latest,subscription:null,orderCount:count,savingsCents:null};
  }else if(p==='/api/community/account-panel')result=await accountPanel(c,userId,catalog);
  else if(p==='/api/payments/shop/wallet'){
   const history=await walletHistory(c,userId,{page:u.searchParams.get('page')||'1'});
   result={...history,items:history.items.map(({cents,reason,created_at})=>({cents,reason,created_at}))};
  }
  else if(p==='/api/community/payment-history')result=await paymentHistory(c,userId,u.searchParams);
  else if(p==='/api/payments/shop/prices')result=await customerPrices(c,userId,await catalog());
  else if(p==='/api/payments/shop/subscriptions')result=await customerSubscriptions(c,userId,catalog,()=>store.inventorySnapshot());
  else if(p==='/api/payments/storefront'){
   const [data,stock]=await Promise.all([catalog(),store.inventorySnapshot()]);
   const inventory=new Map(stock.map(row=>[row.productId,row]));
   result={products:data.products.filter(p=>p.active!==false).map(p=>{
    const availability=inventoryAvailability(p,inventory.get(p.id));
    return {id:p.id,title:p.title,image:p.image,description:p.desc,slug:productSeoSlug(p),category:p.category,currency:p.currency||'₼',
     plans:(p.plans||[]).flatMap((plan,index)=>plan.active===false?[]:[{index,label:plan.label||plan.name||'Paket',price:plan.price,
      regularPrice:plan.regularPrice,...availability.plans[index]}])};
   })};
  }
  else if(p==='/api/payments/my-orders')result=await orders.list(null,u.searchParams.get('cursor'),u.searchParams.get('order'));
  else if(p==='/api/payments/my-orders/codes')result=await orders.codes(null);
  else if(/^\/api\/payments\/my-orders\/codes\/[a-f0-9-]{36}$/.test(p))result=await orders.codes(null,p.split('/').at(-1));
  else if(/^\/api\/payments\/my-orders\/[a-f0-9-]{36}\/guide(?:\/\d+)?$/.test(p)){
   const parts=p.split('/'),guide=parts.indexOf('guide');
   result=await orders.guide(null,parts[guide-1],parts[guide+1]??u.searchParams.get('line'));
  }
  else if(/^\/api\/payments\/my-orders\/[a-f0-9-]{36}\/receipt$/.test(p))result=await orders.receipt(null,p.split('/').at(-2));
  else if(p==='/api/payments/shop/topup/receipt'){
   const row=(await c.query('select receipt,receipt_deleted_at from wallet_topups where id=$1::uuid and user_id=$2 and status<>\'draft\'',[u.searchParams.get('id'),userId])).rows[0];
   if(!row?.receipt?.path||row.receipt_deleted_at)throw fail(404,'Qəbz tapılmadı.');
   result={url:await store.signedReceipt(row.receipt.path,60,'owner-view',u.searchParams.get('id')),mime:row.receipt.mimeType};
  }else if(/^\/api\/community\/media\/[a-f0-9-]{36}\.webp$/.test(p)){
   const media=(await c.query('select bytes from profile_media where id=$1::uuid and user_id=$2',[p.split('/').at(-1).slice(0,-5),userId])).rows[0];
   if(!media)throw fail(404,'Şəkil tapılmadı.');result={media:media.bytes};
  }else throw fail(403,'Bu rejim yalnız müştəri hesabına baxış üçündür.');
  await c.query('commit');return result;
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
