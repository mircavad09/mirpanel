import {sheetCustomerIdStates,retrySheetCustomerId} from './netflix-sheet-customer-id.mjs';
import {updateRoomPassword} from './netflix-room-password.mjs';
import crypto from 'node:crypto';
import {signature} from '../employee-security.mjs';
import {planKey} from '../payment-profit.mjs';
import {adminPendingDeliveries,recordDelivery} from './order-delivery.mjs';

import {readProductMessages} from './ready-stock-product-messages.mjs';
import {assignLegacyRoom} from './netflix-room-legacy.mjs';
import {roomSalesInstalled,releaseNetflixReview} from './netflix-room-sale.mjs';
import {netflixRooms,restockNetflixRoom,saveNetflixRooms,saveNetflixRoomCards,deleteNetflixRoom,editNetflixRoom,netflixRoomPassword} from './netflix-room-stock.mjs';

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
  const roomStockInstalled=(await c.query("select to_regclass('mirpanel_community.netflix_room_units') is not null present")).rows[0].present;
  result.netflixRooms=roomStockInstalled?(await netflixRooms(c,security)).rooms:null;
  if(roomStockInstalled){
   const {rooms:states,manual}=await sheetCustomerIdStates(c);
   result.netflixSheetManual=manual;
   for(const room of result.netflixRooms){
    const state=states.get(room.id);
    if(state&&state.deliveryId===room.deliveryId)room.sheetCustomerId=state;
   }
  }
  const netflix=result.products.find(p=>p.id==='netflix');
  if(netflix&&await roomSalesInstalled(c)){
   const ready=(await c.query('select count(*)::int ready from mirpanel_community.netflix_room_sellable')).rows[0].ready;
   netflix.readyTotal=ready;
   for(const plan of netflix.plans){plan.ready=ready;plan.sales=ready;}
  }
  await c.query('commit');return result;
 }catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
export async function saveReadyStock(pool,security,secret,catalog,actor,input){
 if(input?.netflixRoomCards)return saveNetflixRoomCards(pool,security,secret,actor,input.netflixRoomCards);
 if(input?.netflixRoomDelete)return deleteNetflixRoom(pool,actor,input.netflixRoomDelete.id);
 if(input?.netflixSheetIdRetry)return retrySheetCustomerId(pool,input.netflixSheetIdRetry.deliveryId);
 if(input?.netflixRoomsReady)return releaseNetflixReview(pool,actor,input.netflixRoomsReady);
 if(input?.netflixRoomAssign)return assignLegacyRoom(pool,security,catalog,input.netflixRoomAssign);
 if(input?.netflixAccountPassword)return updateRoomPassword(pool,security,actor,input.netflixAccountPassword);
 if(input?.restockNetflixRoom)return restockNetflixRoom(pool,{...input.restockNetflixRoom,actor});
 if(input?.netflixRooms||input?.netflixRoomEdit){
  if(!(await pool.query("select to_regclass('mirpanel_community.netflix_room_units') is not null present")).rows[0].present)throw fail(503,'Netflix otaq stoku üçün baza yeniləməsi lazımdır.');
  if(input.netflixRoomEdit?.action==='password')return netflixRoomPassword(pool,security,input.netflixRoomEdit.id);
  return input.netflixRoomEdit?editNetflixRoom(pool,security,input.netflixRoomEdit,actor):saveNetflixRooms(pool,security,secret,actor,input.netflixRooms);
 }
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
 if(!await enabled(c)){
  if(items.some(item=>item.roomStock))throw fail(503,'Netflix otaqlarının avtomatik təhvili hazırda əlçatan deyil.');
  return;
 }
 let security;
 for(const [line,item] of items.entries()){
  if(item.renewal||!item.sourcePlanKey||!item.signature)continue;
  if(item.productId==='netflix'&&(await c.query("select to_regclass('mirpanel_community.netflix_room_units') present")).rows[0].present){
   if(![1,3,6].includes(item.durationMonths??item.duration)||item.durationDays)continue;
   const managed=await roomSalesInstalled(c);
   const rooms=item.roomStock?(await c.query(`select r.id,r.room_name,r.pin_cipher,g.id group_id,g.account_cipher
    from mirpanel_community.shop_lines l join mirpanel_community.netflix_room_units r on r.sale_reservation_id=l.reservation_id
    join mirpanel_community.netflix_room_groups g on g.id=r.group_id
    join mirpanel_community.netflix_room_sale_state s on s.id=r.id
    where l.order_id=$1 and coalesce(l.snapshot->>'lineId',l.product_id||':'||l.plan_id)=$2
     and not s.assigned and not s.synthetic and s.unexpired and s.availability='available'
    order by l.position for update of r`,[orderId,item.lineId])).rows:(await c.query(`select r.id,r.room_name,r.pin_cipher,g.id group_id,g.account_cipher
    from mirpanel_community.netflix_room_units r join mirpanel_community.netflix_room_groups g on g.id=r.group_id
    where r.delivery_id is null and to_jsonb(r)->>'legacy_assignment_id' is null and coalesce(to_jsonb(r)->>'availability','available')='available' and coalesce(r.stock_ends_on,g.ends_on)>public.payment_baku_date()
     and g.created_by not like 'synthetic:%'
     ${managed?'and exists(select 1 from mirpanel_community.netflix_room_sellable s where s.id=r.id)':''}
    order by g.created_at,r.room_key,r.id limit $1 for update of r skip locked`,[item.quantity])).rows;
   security??=securityFactory();
   const message=(await readProductMessages(c,security,[item.productId])).get(item.productId)??'';
   if(item.roomStock&&rooms.length!==item.quantity)throw fail(409,'Rezerv edilmiş Netflix otağı təhvilə hazır deyil. Ödəniş təsdiqi saxlanmadı.');
   for(const room of rooms){
    const account=JSON.parse(security.decryptSecret(room.account_cipher));
    const pin=JSON.parse(security.decryptSecret(room.pin_cipher));
    if(account.id!==room.group_id||pin.id!==room.id||!/^\d{4}$/.test(pin.pin))throw Error('ROOM_STOCK_REFERENCE_MISMATCH');
    const id=crypto.randomUUID();
    await recordDelivery(c,security,actor,orderId,id,line,1,message,
     {email:account.email,password:account.password,roomName:room.room_name,roomCode:pin.pin});
    await c.query('update mirpanel_community.netflix_room_units set delivery_id=$2'+(managed?',sale_reservation_id=null':'')+' where id=$1',[room.id,id]);
   }
   continue;
  }
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
  await c.query('select pg_advisory_xact_lock(714025001)');
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
   if(order){
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
