import crypto from 'node:crypto';
import {signature} from '../employee-security.mjs';
import {planKey} from '../payment-profit.mjs';
import {adminPendingDeliveries,recordDelivery} from './order-delivery.mjs';

import {readProductMessages} from './ready-stock-product-messages.mjs';

const S='mirpanel_community.ready_stock_';
const fail=(status,message)=>Object.assign(Error(message),{status});
const key=(p,k,s)=>JSON.stringify([p,k,s]);
const validId=x=>typeof x==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(x);
async function enabled(c){
 if(!(await c.query("select to_regclass('mirpanel_community.ready_stock_release') as name")).rows[0]?.name)return false;
 return (await c.query('select enabled from '+S+'release where id for share')).rows[0]?.enabled===true;
}
export async function readyStockView(pool,catalog,inventory,security){
 const c=await pool.connect();
 try{
  await c.query('begin');
  if(!await enabled(c))throw fail(503,'Hazır hesab stoku hazırda bağlıdır.');
  const settings=(await c.query('select p.product_id,p.plan_key,p.plan_signature,p.auto_wallet,count(u.id)::int as ready from '+S+'plans p left join '+S+'units u on (p.product_id,p.plan_key,p.plan_signature)=(u.product_id,u.plan_key,u.plan_signature) and u.delivery_id is null group by p.product_id,p.plan_key,p.plan_signature,p.auto_wallet')).rows;
  const records=new Map(settings.map(x=>[key(x.product_id,x.plan_key,x.plan_signature),x]));
  const availability=new Map(inventory.map(x=>[x.productId,x]));
  const messages=security?await readProductMessages(c,security,catalog.products.map(p=>p.id)):new Map();
  const result={products:catalog.products.filter(p=>p.active!==false&&p.plans?.length).map(p=>{
   const stock=availability.get(p.id);
   const counted=new Set();let readyTotal=0;
   const plans=p.plans.map((plan,i)=>{
    const sig=signature(plan),sku=key(p.id,planKey(plan,i),sig),config=records.get(sku),inv=stock?.plans.find(x=>x.planKey===String(i));
    if(!counted.has(sku)){counted.add(sku);readyTotal+=config?.ready??0;}
    return {index:i,title:plan.label||plan.name||(plan.months?plan.months+' aylıq':'Paket '+(i+1)),signature:sig,sales:inv?.available??null,tracked:inv?.tracked??false,active:inv?.active??false,ready:config?.ready??0,autoWallet:config?.auto_wallet??false};
   });
   return {id:p.id,title:p.title,message:messages.get(p.id)??'',image:typeof p.image==='string'?p.image:'',readyTotal,scope:stock?.scope||'none',version:stock?.version??0,plans};
  })};
  await c.query('commit');return result;
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
export async function saveReadyStock(pool,security,secret,catalog,actor,input){
 const {productId,index,planSignature,requestId,messages=[],accounts,autoWallet}=input||{};
 const structured=accounts!==undefined;
 if(structured&&(!Array.isArray(accounts)||accounts.length>20||messages.length||accounts.some(a=>
  !a||typeof a.email!=='string'||a.email.length>254||!/^\S+@\S+\.\S+$/.test(a.email)||
  typeof a.password!=='string'||!a.password.trim()||a.password.length>512||/[\r\n\0]/.test(a.password)
 )))throw fail(400,'Hər hesab üçün etibarlı e-poçt və şifrə yazın.');
 const units=structured?accounts:messages;
 if(!validId(requestId)||!Number.isSafeInteger(index)||index<0||typeof productId!=='string'||typeof planSignature!=='string'||(autoWallet!==undefined&&typeof autoWallet!=='boolean')||!Array.isArray(messages)||messages.length>20||(!units.length&&autoWallet===undefined)||messages.some(m=>typeof m!=='string'||!m.trim()||m.length>8000))throw fail(400,'Paket, hazır mətnlər və ya təhvil seçimi düzgün deyil.');
 const digest=crypto.createHmac('sha256',secret).update(JSON.stringify([productId,index,planSignature,autoWallet,structured?accounts:messages])).digest('hex');
 const c=await pool.connect();
 try{
  await c.query('begin');
  if(!await enabled(c))throw fail(503,'Hazır hesab stoku hazırda bağlıdır.');
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['ready-stock:'+requestId]);
  const old=(await c.query('select fingerprint,units from '+S+'batches where id=$1',[requestId])).rows[0];
  if(old){
   if(old.fingerprint!==digest)throw fail(409,'Təkrar sorğunun məlumatı fərqlidir.');
   await c.query('commit');return {added:old.units,replayed:true};
  }
  const p=catalog.products.find(p=>p.id===productId&&p.active!==false),plan=p?.plans?.[index];
  if(!plan||signature(plan)!==planSignature)throw fail(409,'Kataloq dəyişib. Paketi yenidən seçin.');
  if(structured&&accounts.length&&!(await readProductMessages(c,security,[productId])).has(productId))throw fail(409,'Əvvəl məhsulun hazır mesajını saxlayın.');
  const args=[productId,planKey(plan,index),planSignature];
  await c.query('insert into '+S+'plans(product_id,plan_key,plan_signature) values($1,$2,$3) on conflict do nothing',args);
  if(autoWallet!==undefined)await c.query('update '+S+'plans set auto_wallet=$4 where product_id=$1 and plan_key=$2 and plan_signature=$3',[...args,autoWallet]);
  await c.query('insert into '+S+'batches(id,fingerprint,actor,units) values($1,$2,$3,$4)',[requestId,digest,actor,units.length]);
  for(const unit of units){
   const id=crypto.randomUUID();
   await c.query('insert into '+S+'units(id,product_id,plan_key,plan_signature,batch_id,message_cipher) values($1,$2,$3,$4,$5,$6)',[id,...args,requestId,security.encryptSecret(JSON.stringify({id,scope:args,...(structured?{account:{email:unit.email,password:unit.password}}:{message:unit})}))]);
  }
  await c.query('commit');return {added:units.length};
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
// Runs on the caller's transaction after confirmed payment.
export async function allocateReadyStock(c,securityFactory,orderId,items,actor='wallet:auto'){
 if(!await enabled(c))return;
 let security;
 for(const [line,item] of items.entries()){
  if(item.renewal||!item.sourcePlanKey||!item.signature)continue;
  const args=[item.productId,item.sourcePlanKey,item.signature];
  const setting=(await c.query('select auto_wallet from '+S+'plans where product_id=$1 and plan_key=$2 and plan_signature=$3 for share',args)).rows[0];
  if(!setting?.auto_wallet)continue;
  const units=(await c.query('select id,message_cipher from '+S+'units where product_id=$1 and plan_key=$2 and plan_signature=$3 and delivery_id is null order by created_at,id limit $4 for update',[...args,item.quantity])).rows;
  let productMessage;
  for(const unit of units){
   security??=securityFactory();
   const value=JSON.parse(security.decryptSecret(unit.message_cipher));
   if(value.id!==unit.id||JSON.stringify(value.scope)!==JSON.stringify(args)||(typeof value.message!=='string'&&(!value.account?.email||!value.account?.password)))throw Error('READY_STOCK_REFERENCE_MISMATCH');
   if(value.account&&productMessage===undefined)productMessage=(await readProductMessages(c,security,[item.productId])).get(item.productId)??null;
   if(value.account&&productMessage===null)break;
   const id=crypto.randomUUID();
   await recordDelivery(c,security,actor,orderId,id,line,1,value.account?productMessage:value.message,value.account);
   await c.query('update '+S+'units set delivery_id=$2 where id=$1',[unit.id,id]);
  }
 }
}

export async function approveCardWithReadyStock(pool,security,orderId,duration,actor,employeeEnabled){
 const c=await pool.connect();
 try{
  await c.query('begin');
  // Call the same approval RPC as before. It owns the existing card/stock locks
  // and rechecks receipt/approval constraints before anything is allocated.
  const rpc=employeeEnabled?'employee_approve_direct':'approve_payment_order_v7';
  const result=(await c.query('select public.'+rpc+'($1,$2,$3) value',[orderId,duration,actor])).rows[0].value;
  if(!result.idempotent&&result.status==='approved'){
   const order=(await c.query(`select o.checkout_snapshot,o.quantity from public.payment_orders o
     where o.id=$1 and o.payment_source='card'
       and exists(select 1 from mirpanel_community.community_order_owners u where u.order_id=o.id)`,[orderId])).rows[0];
   // Approval timestamps are also used by historical card orders. Mark new
   // account-bound payments explicitly so manual delivery remains in the queue.
   if(order)await c.query('update public.payment_orders set payment_confirmed=true where id=$1 and payment_confirmed is not true',[orderId]);
   if(order&&await enabled(c)){
    const snap=order.checkout_snapshot||{};
    const saved=(await c.query('select product_id,snapshot from mirpanel_community.shop_lines where order_id=$1 order by position',[orderId])).rows;
    const items=snap.cartVersion===2&&Array.isArray(snap.items)?snap.items.map(line=>{
     const source=saved.find(x=>x.product_id===line.productId&&(x.snapshot.lineId||x.product_id+':'+x.snapshot.planIndex)===(line.lineId||line.productId+':'+line.planIndex))?.snapshot;
     return {...line,signature:source?.signature,renewal:!!line.renewalOrderCode};
    }):saved.length===1?[{...saved[0].snapshot,productId:saved[0].product_id,quantity:order.quantity,renewal:!!saved[0].snapshot.renewal}]:[];
    await allocateReadyStock(c,()=>security,orderId,items,'card:auto');
   }
  }
  const deliveryPending=result.status==='approved'&&(await adminPendingDeliveries(c,[orderId])).length>0;
  await c.query('commit');
  return {...result,deliveryPending};
 }catch(error){await c.query('rollback');throw error;}finally{c.release();}
}
