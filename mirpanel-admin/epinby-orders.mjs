import {createHmac,timingSafeEqual} from 'node:crypto';
import {supplierRequest} from './supplier-request.mjs';
import {epinbyPlan,epinbyProduct} from '../epinby-product.mjs';
import {readProductMessages} from './community/ready-stock-product-messages.mjs';
import {planKey} from './payment-profit.mjs';
import {adminDelivery,paid} from './community/order-delivery.mjs';
import {validateEpinbyDetails} from './community/public/checkout-fields.js';
import {supplierCost,supplierCharge} from './epinby-finance.mjs';
import {epinbyStockState} from './epinby-stock.mjs';
const S='mirpanel_community.',U=S+'epinby_order_units',D=S+'api_dispatches';
const providerId='e91bb000-0000-4000-8000-000000000001';
const fail=(status,message,code)=>Object.assign(Error(message),{status,...(code?{code}:{})});
const allowed=new Set(['https://epinby.com']);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const unavailable=(message='Bu paketdə hesab adı yoxlanmır.',allowCheckout=true)=>({state:'unavailable',message,allowCheckout});
const invalid=()=>({state:'invalid',message:'Hesab tapılmadı. Daxil etdiyiniz məlumatı yoxlayın.',allowCheckout:false});
const retry=()=>({state:'retry',message:'Hesab yoxlanmadı. Bir az sonra yenidən cəhd edin.',allowCheckout:false});
const displayName=value=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,120):'';
function validationError(error,stars){
 const code=error?.supplierCode||error?.error?.code;
 if(code==='SUBSCRIPTION_REQUIRED'||code==='GAME_NOT_SUPPORTED'||code==='VALIDATION_NOT_SUPPORTED')return unavailable(code==='SUBSCRIPTION_REQUIRED'?'Təchizatçı ad yoxlamasına giriş vermədi. Hesab adı təsdiqlənməyib.':undefined,!stars);
 if(['INVALID_INPUT','VALIDATION_ERROR'].includes(code))return {state:'invalid',code:'EPINBY_PLAYER_INPUT',message:'Oyunçu ID-si, server və ya region məlumatlarını yoxlayın.',allowCheckout:false};
 if(['PLAYER_NOT_FOUND','RECIPIENT_NOT_FOUND','TELEGRAM_USER_NOT_FOUND','USERNAME_NOT_FOUND','INVALID_USERNAME'].includes(code)||error?.supplierStatus===404&&!code)return invalid();
 return retry();
}
export function verifyEpinbyWebhook(raw,headers,secret){
 const signature=headers['x-gamex-signature'];
 if(typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/i.test(signature))throw fail(401,'İmza düzgün deyil.');
 const expected=createHmac('sha256',secret).update(raw).digest();
 if(!timingSafeEqual(Buffer.from(signature.slice(7),'hex'),expected))throw fail(401,'İmza düzgün deyil.');
 let body;try{body=JSON.parse(raw);}catch{throw fail(400,'Bildiriş düzgün deyil.');}
 if(!uuid(body.event_id)||headers['x-gamex-event-id']!==body.event_id||headers['x-gamex-timestamp']!==body.timestamp||!Number.isFinite(Date.parse(body.timestamp)))throw fail(400,'Bildiriş başlığı uyğun deyil.');
 return body;
}
export function createEpinbyOrders({pool,security,loadCatalog,callbackUrl,transport=supplierRequest}){
 let synchronizedAt=0;
 const productChecks=new Map();
 async function credentials(db){return (await db.query('select * from '+S+'epinby_connection where id=true')).rows[0];}
 const send=(row,path,extra={})=>transport({base:'https://epinby.com',path:'/api/v1/'+path,allowlist:allowed,
  key:security.decryptSecret(row.api_key_cipher),authHeader:'X-API-Key',jsonResponse:true,maxResponseBytes:524288,includeErrorCode:true,...extra});
 async function playerName(db,supplier,values){
  const row=await credentials(db);
  if(row?.last_status!=='confirmed'||!row.api_key_cipher)return {verified:false};
  try{
   const response=await send(row,'validate-player',{body:{product_id:supplier.productId,...values}});
   const data=response?.data,rawName=data?.player_name||data?.nickname,name=typeof rawName==='string'?rawName.trim():'';
   if(response?.success===true&&data?.nickname_verified===true&&name)return {verified:true,name:name.slice(0,120)};
  }catch{}
  return {verified:false};
 }
 async function configure(db,row,products){
  await db.query(`insert into ${S}api_suppliers(id,name,base_url,key_cipher,test_path) values($1,'Epinby','https://epinby.com',$2,'/api/v1/getMe')
   on conflict(id) do update set key_cipher=excluded.key_cipher`,[providerId,row.api_key_cipher]);
  for(const p of products){
   for(const [i,plan] of (p.plans||[]).entries()){
    const supplier=epinbyPlan(p,plan);if(!supplier)continue;
    await db.query(`insert into ${S}api_mappings(product_id,plan_key,supplier_id,settings,active) values($1,$2,$3,$4,$5)
    on conflict(product_id,plan_key) do update set settings=excluded.settings,active=excluded.active,supplier_id=excluded.supplier_id`,
    [p.id,planKey(plan,i),providerId,{provider:'epinby',...supplier},p.active!==false&&plan.active!==false&&p.soldOut!==true]);
   }
  }
 }
 async function synchronize(db){
  if(!(await db.query("select to_regclass('"+U+"') n")).rows[0].n)return false;
  const row=await credentials(db);if(row?.last_status!=='confirmed'||!row.webhook_secret_cipher)return false;
  await configure(db,row,(await loadCatalog()).products);return true;
 }
 async function preflight(db,p,plan,quantity,values,index=0){
  const supplier=epinbyPlan(p,plan);
  if(!supplier)throw fail(409,'Epinby sifariş sazlaması hazır deyil.');
  try{validateEpinbyDetails(supplier.fields,values,p.id);}catch(e){throw fail(400,e.message);}
  const row=await credentials(db);
  if(row?.last_status!=='confirmed'||!row.webhook_secret_cipher||!(await db.query("select to_regclass('"+U+"') n")).rows[0].n)throw fail(503,'Epinby sifariş xidməti hazır deyil.');
  await configure(db,row,[p]);
  const mapping=(await db.query('select settings from '+S+'api_mappings where product_id=$1 and plan_key=$2 and active and supplier_id=$3 for share',[p.id,planKey(plan,index),providerId])).rows[0];
  const mapped=epinbyProduct(mapping?.settings);
  if(!mapped||mapped.productId!==supplier.productId||mapped.type!==supplier.type||mapped.starsAmount!==supplier.starsAmount||JSON.stringify(mapped.fields)!==JSON.stringify(supplier.fields))throw fail(409,'Paketin sifariş sazlaması yenilənir. Yenidən yoxlayın.');
  if(supplier.type==='TELEGRAM_STARS'){
   const config=await send(row,'telegram-stars/config');
   const limit=config?.data;
   if(config?.success!==true||limit?.enabled!==true||limit.service_online!==true||limit.custom_amount_enabled!==true||
    !Number.isInteger(limit.min_stars)||!Number.isInteger(limit.max_stars)||supplier.starsAmount<limit.min_stars||supplier.starsAmount>limit.max_stars)
    throw fail(409,'Bu Telegram Stars paketi təchizatçıda əlçatan deyil.');
   const check=await checkRecipient(row,supplier,values);
   if(!check.allowCheckout)throw fail(check.state==='retry'?503:409,check.message);
   const quoted=await send(row,'telegram-stars/quote',{body:{stars_amount:supplier.starsAmount}});
   if(quoted?.success!==true||Number(quoted.data?.stars_amount)!==supplier.starsAmount)throw fail(503,'Telegram Stars paketi təchizatçıda təsdiqlənmədi.');
   return check;
  }
  const product=await providerProduct(row,supplier);
  const stock=epinbyStockState(product);
  if(stock.status==='unknown')throw fail(503,'Stok yoxlanıla bilmir. Yenidən cəhd edin.','EPINBY_STOCK_UNKNOWN');
  if(stock.status==='out'||stock.count!==null&&stock.count<quantity)throw fail(409,'Stokda bitib və ya seçilmiş sayda əlçatan deyil.','EPINBY_OUT_OF_STOCK');
  const check=await checkRecipient(row,supplier,values,product);
  if(!check.allowCheckout)throw fail(check.state==='retry'?503:409,check.message);
  return check;
 }
 async function providerProduct(row,supplier){
  // The live API ignores undocumented ID filters. Search only the exact game/category,
  // validating every page and the stable product ID before any wallet debit.
  let product;
  for(let page=1;;page++){
   const query={page,per_page:100,...(supplier.gameId?{game_id:supplier.gameId}:{}),...(supplier.categoryId?{category_id:supplier.categoryId}:{})};
   let response;try{response=await send(row,'products',{query});}catch{throw fail(503,'Təchizatçı ilə bağlantı alınmadı. Yenidən cəhd edin.','EPINBY_CATALOG_UNAVAILABLE');}
   const last=Number(response?.meta?.last_page);
   if(response?.success!==true||!Array.isArray(response.data)||Number(response.meta?.current_page)!==page||!Number.isSafeInteger(last)||last<1||last>10000)throw fail(503,'Təchizatçı kataloqu yoxlanılmadı. Yenidən cəhd edin.','EPINBY_CATALOG_UNAVAILABLE');
   product=response.data.find(x=>Number(x.id)===supplier.productId);
   if(product||page>=last)break;
  }
  if(!product)throw fail(409,'Seçilmiş paket hazırda təchizatçının aktiv kataloqunda yoxdur. Başqa paket seçin və ya dəstəyə yazın.','EPINBY_PRODUCT_UNAVAILABLE');
  const live=epinbyProduct({provider:'epinby',productId:product.id,type:String(product.type).toUpperCase(),fields:product.fields||[]});
  if(!live||live.type!==supplier.type||JSON.stringify(live.fields)!==JSON.stringify(supplier.fields))throw fail(409,'Paketin təchizatçı uyğunluğu və ya tələb olunan sahələri dəyişib. Formanı yenidən açın; problem qalarsa dəstəyə yazın.','EPINBY_SCHEMA_CHANGED');
  if(supplier.gameId&&Number(product.game_id)!==supplier.gameId||supplier.categoryId&&Number(product.category_id)!==supplier.categoryId)throw fail(409,'Seçilmiş paketin oyun və ya region uyğunluğu təsdiqlənmədi. Dəstəyə yazın.','EPINBY_MAPPING_MISMATCH');
  return product;

 }
 async function checkRecipient(row,supplier,values,product){
  const stars=supplier.type==='TELEGRAM_STARS';
  if(!stars&&(supplier.type!=='TOPUP'||product?.supports_player_validation!==true))return unavailable();
  let response;
  try{
   response=await send(row,stars?'telegram-stars/recipient':'validate-player',{
    includeErrorCode:true,
    body:stars?{telegram_username:values.telegram_username}:{product_id:supplier.productId,...values}
   });
  }catch(error){return validationError(error,stars);}
  if(response?.success!==true)return validationError(response,stars);
  const data=response.data;
  if(!data||typeof data!=='object')return retry();
  if(!stars&&['player_id','server_id',...supplier.fields.map(f=>f.key)].some(key=>data[key]!=null&&values[key]!=null&&String(data[key])!==values[key]))return {state:'retry',message:'Təchizatçının cavabı daxil etdiyiniz hesaba uyğun deyil. Yenidən cəhd edin.',allowCheckout:false};
  if(data.found===false||data.valid===false||data.exists===false)return invalid();
  const recipient=data.recipient||data;
  if(stars){
   if(recipient.found===false||recipient.exists===false||recipient.valid===false||recipient.can_receive===false||recipient.can_receive_stars===false)return invalid();
   const name=displayName(recipient.display_name||recipient.full_name||recipient.name||[recipient.first_name,recipient.last_name].filter(Boolean).join(' '));
   const returned=recipient.telegram_username||recipient.username;
   if(typeof returned==='string'&&returned.replace(/^@/,'').toLowerCase()!==values.telegram_username.replace(/^@/,'').toLowerCase())return invalid();
   if(name)return {state:'verified',name,allowCheckout:true};
   return returned||recipient.id||recipient.telegram_user_id||recipient.found===true
    ?unavailable('Alıcı tapıldı. Təchizatçı hesab adını göstərmir.'):retry();
  }
  const name=displayName(data.player_name||data.nickname);
  if(data.nickname_verified===true&&name)return {state:'verified',name,allowCheckout:true};
  if(data.validation_optional===true)return unavailable();
  return data.nickname_verified===false?invalid():retry();
 }
 async function sendStockCheckedOrder(row,unit){
  const settings=epinbyProduct(unit.settings);
  if(!settings)throw fail(409,'Paketin təchizatçı uyğunluğu təsdiqlənmədi.','EPINBY_SCHEMA_CHANGED');
  const product=await providerProduct(row,settings),stock=epinbyStockState(product);
  if(stock.status==='out')throw fail(409,'Təchizatçıda stokda bitib; stok yenilənməsi gözlənilir.','EPINBY_OUT_OF_STOCK');
  if(stock.status!=='available')throw fail(503,'Təchizatçı stoku yoxlanıla bilmir.','EPINBY_STOCK_UNKNOWN');
  return send(row,'order',{body:JSON.parse(security.decryptSecret(unit.body_cipher)),reference:unit.id,idempotencyHeader:'X-Idempotency-Key'});
 }
 function productForCheck(row,supplier){
  const key=JSON.stringify([row.credential_version,supplier]);
  const cached=productChecks.get(key),now=Date.now();
  if(cached&&cached.until>now)return cached.request;
  const entry={until:now+45000,request:providerProduct(row,supplier)};
  productChecks.set(key,entry);
  if(productChecks.size>48)productChecks.delete(productChecks.keys().next().value);
  void entry.request.catch(()=>{if(productChecks.get(key)===entry)productChecks.delete(key);});
  return entry.request;
 }
 async function check(db,p,plan,raw){
  const supplier=epinbyPlan(p,plan);
  if(!supplier?.fields.length)throw fail(400,'Bu paket hesab məlumatı tələb etmir.');
  let values;try{values=validateEpinbyDetails(supplier.fields,raw,p.id);}catch(e){throw fail(400,e.message);}
  const row=await credentials(db);
  if(row?.last_status!=='confirmed'||!row.api_key_cipher)return retry();
  const stars=supplier.type==='TELEGRAM_STARS';
  try{return await checkRecipient(row,supplier,values,stars?null:await productForCheck(row,supplier));}
  catch(e){return e.status===409?{state:'unavailable',code:e.code||'EPINBY_MAPPING_UNAVAILABLE',message:e.message,allowCheckout:false}:e.code?{state:'retry',code:e.code,message:e.message,allowCheckout:false}:retry();}
 }
 async function prepare(db){
  const c=await db.connect();
  try{
   await c.query('begin');await c.query('select pg_advisory_xact_lock(714025001)');
   const jobs=(await c.query(`select d.*,o.checkout_snapshot,o.status,o.payment_confirmed,o.fulfillment_cancellation from ${D} d join public.payment_orders o on o.id=d.order_id
    where d.supplier_id=$1 and d.state='queued' and exists(select 1 from mirpanel_community.community_order_owners owner where owner.order_id=o.id) order by o.created_at,d.line_index for update of d,o skip locked limit 20`,[providerId])).rows;
   for(const job of jobs){
    if(job.checkout_snapshot?.epointPayment&&!['queued','ready'].includes(job.checkout_snapshot.epointPayment.state))continue;
    if(!paid(job)||job.fulfillment_cancellation){await c.query("update "+D+" set state='skipped' where id=$1",[job.id]);continue;}
    const line=job.checkout_snapshot?.items?.[job.line_index];
    const done=(await c.query(`select 1 from ${S}customer_order_deliveries where order_id=$1 and line_index=$2 limit 1`,[job.order_id,job.line_index])).rowCount;
    if(done||!line||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>100){await c.query("update "+D+" set state='failed' where id=$1",[job.id]);continue;}
    let values={};try{if(line.detailsCipher)values=JSON.parse(security.decryptSecret(line.detailsCipher));}catch{values=null;}
    const body=job.settings.type==='TELEGRAM_STARS'?{stars_amount:job.settings.starsAmount}:{product_id:job.settings.productId,qty:1,callback_url:callbackUrl,callback_mode:'events'};
    for(const f of job.settings.fields||[]){if(values===null)break;if(f.required&&!values[f.key]){values=null;break;}if(values[f.key])body[f.key]=String(values[f.key]);}
    if(values===null){await c.query(`insert into ${U}(dispatch_id,unit_index,body_cipher,state,reason) values($1,0,$2,'failed','Epinby yoxlama tələb edir · Alıcı məlumatları oxunmadı və ya tələb olunan sahə yoxdur.') on conflict do nothing`,[job.id,security.encryptSecret(JSON.stringify(body))]);await c.query("update "+D+" set state='failed' where id=$1",[job.id]);continue;}
    for(let unit=0;unit<line.quantity;unit++)await c.query(`insert into ${U}(dispatch_id,unit_index,body_cipher) values($1,$2,$3) on conflict do nothing`,[job.id,unit,security.encryptSecret(JSON.stringify(body))]);
    await c.query("update "+D+" set state='checking' where id=$1",[job.id]);
   }
   await c.query('commit');
  }catch(e){await c.query('rollback');throw e;}finally{c.release();}
 }
 async function record(db,unit,data){
  if(String(data.order_id)!==String(unit.external_id)&&unit.external_id)return;
  if(data.client_order_id&&data.client_order_id!==unit.id)return;
  const state=String(data.status).toUpperCase(),external=String(data.order_id||'');
  if(!/^\d+$/.test(external))return;
  if(data.product_id!=null&&Number(data.product_id)!==unit.product_id)return;
  if(data.qty!=null&&Number(data.qty)!==1)return;
  let next='checking',reason='Təchizatçı nəticəsi gözlənilir.';
  const message=unit.type==='VOUCHER'?Array.isArray(data.delivery)?data.delivery.filter(x=>typeof x==='string').join('\n'):null:unit.type==='TELEGRAM_STARS'?'Telegram Stars göndərişi təchizatçı tərəfindən təsdiqləndi.':'Oyun hesabına yükləmə təchizatçı tərəfindən təsdiqləndi.';
  if(state==='COMPLETED'&&message){next='succeeded';reason=null;}
  else if(state==='COMPLETED')reason='Təchizatçı təhvili təsdiqlədi; kod məlumatı gözlənilir.';
  else if(['FAILED','CANCELED','CANCELLED'].includes(state)){next='failed';reason='Təchizatçı sifarişi rədd etdi. Admin araşdırması tələb olunur.';}
  const charge=state==='COMPLETED'?supplierCharge(data,unit,unit.execution_quote):null;
  await db.query(`update ${U} set external_id=coalesce(external_id,$2),state=$3,result_cipher=case when $3='succeeded' then $4 else result_cipher end,reason=$5,next_at=case when $3='succeeded' then now() else now()+interval '20 seconds' end,
   supplier_charge=coalesce(supplier_charge,$6)
   where id=$1 and state in ('queued','checking') and (external_id is null or external_id=$2)`,[unit.id,external,next,message?security.encryptSecret(message):null,reason,charge]);
 }
 async function snapshotQuote(db,row,unit){
  if(unit.execution_quote||unit.state!=='queued'||unit.external_id)return;
  let raw;
  try{
   const settings=epinbyProduct(unit.settings);
   if(!settings)throw Error('EPINBY_QUOTE_MAPPING_INVALID');
   if(unit.type==='TELEGRAM_STARS'){
    const quoted=await send(row,'telegram-stars/quote',{body:{stars_amount:settings.starsAmount}});
    if(quoted?.success===true&&Number(quoted.data?.stars_amount)===settings.starsAmount)raw=quoted.data;
   }else raw=await providerProduct(row,settings);
  }catch{}
  const quote=supplierCost(raw,{source:'execution_quote',productId:unit.product_id});
  if(!raw)quote.reason='İcradan əvvəl təchizatçı qiyməti yoxlanmadı.';
  unit.execution_quote=(await db.query(`update ${U} set execution_quote=coalesce(execution_quote,$2) where id=$1 and external_id is null returning execution_quote`,[unit.id,quote])).rows[0]?.execution_quote;
 }
 async function readFinalCharge(db,row,unit){
  if(unit.supplier_charge||!unit.external_id)return;
  try{
   const result=await send(row,(unit.type==='TELEGRAM_STARS'?'telegram-stars/':'')+'order/'+unit.external_id);
   const data=result?.data;
   if(result?.success!==true||String(data?.order_id)!==String(unit.external_id)||
     (data.client_order_id&&data.client_order_id!==unit.id)||String(data.status).toUpperCase()!=='COMPLETED'||
     (data.product_id!=null&&Number(data.product_id)!==unit.product_id)||(data.qty!=null&&Number(data.qty)!==1))return;
   const charge=supplierCharge(data,unit,unit.execution_quote);
   if(charge)await db.query(`update ${U} set supplier_charge=$3 where id=$1 and external_id=$2 and state='succeeded' and supplier_charge is null`,[unit.id,unit.external_id,charge]);
  }catch{console.warn('EPINBY_CHARGE_READ_UNAVAILABLE');}
 }
 async function reconcileEvents(db){
  const events=(await db.query(`select e.event_id,e.payload_cipher,u.*,d.settings->>'type' type,(d.settings->>'productId')::int product_id
   from mirpanel_community.epinby_events e join ${U} u on u.id=e.unit_id join ${D} d on d.id=u.dispatch_id
   where u.state in ('queued','checking') order by e.received_at limit 100`)).rows;
  for(const event of events)await record(db,event,JSON.parse(security.decryptSecret(event.payload_cipher)));
 }
 async function run(db){
  if(!(await db.query("select to_regclass('"+U+"') n")).rows[0].n)return;
  const credentialsRow=await credentials(db);if(credentialsRow?.last_status!=='confirmed'||!credentialsRow.webhook_secret_cipher)return;
  if(Date.now()-synchronizedAt>=60000){synchronizedAt=Date.now();try{await synchronize(db);}catch{console.warn('EPINBY_MAPPING_REFRESH_RETRY');}}
  await reconcileEvents(db);
  await prepare(db);
  const c=await db.connect();let unit;
  try{
   await c.query('begin');await c.query('select pg_advisory_xact_lock(714025001)');
   unit=(await c.query(`select u.*,d.order_id,d.line_index,d.settings,d.settings->>'type' type,(d.settings->>'productId')::int product_id
    from ${U} u join ${D} d on d.id=u.dispatch_id join public.payment_orders o on o.id=d.order_id where exists(select 1 from mirpanel_community.community_order_owners owner where owner.order_id=o.id) and coalesce(o.checkout_snapshot->'epointPayment'->>'state','ready') in ('queued','ready') and (o.payment_confirmed=true or o.status='approved') and o.status not in ('cancelled','rejected','expired','completed') and o.fulfillment_cancellation is null and u.state in ('queued','checking','succeeded') and u.next_at<=now() and (u.external_id is not null or u.state='succeeded' or not exists(select 1 from ${U} waiting where waiting.state='queued' and waiting.reason like 'Epinby balansı%' and waiting.next_at>now()))
    order by case when u.external_id is not null or u.state='succeeded' then 0 when u.state='queued' then 1 else 2 end,u.next_at,o.created_at,d.line_index,u.unit_index limit 1 for update of u,d,o skip locked`)).rows[0];
   if(unit)await c.query(`update ${U} set state=case when state='queued' then 'checking' else state end,reason=case when state='queued' then 'Göndəriş başlanıb; nəticə təsdiqi gözlənilir.' else reason end,next_at=now()+interval '1 minute' where id=$1`,[unit.id]);
   if(unit)await c.query("update "+D+" set state='checking' where id=$1",[unit.dispatch_id]);
   await c.query('commit');
  }catch(e){await c.query('rollback');throw e;}finally{c.release();}
  if(!unit)return;
  const row=await credentials(db);
  if(unit.state==='succeeded'){
   await readFinalCharge(db,row,unit);
   await adminDelivery(db,security,'supplier:auto',unit.order_id,{requestId:unit.id,line:unit.line_index,quantity:1,message:await deliveryMessage(db,unit)});
   await db.query("update "+U+" set state='delivered',reason=null where id=$1",[unit.id]);
  }else{
   try{
    await snapshotQuote(db,row,unit);
    let result;
    if(unit.state!=='queued'&&!unit.external_id){
     const orders=await send(row,'orders');
     const found=Array.isArray(orders.data)&&orders.data.find(x=>x.client_order_id===unit.id);
     if(found)result={success:true,data:found};
    }else if(unit.type==='TELEGRAM_STARS'){
     result=unit.external_id?await send(row,'telegram-stars/order/'+unit.external_id)
      :await send(row,'telegram-stars/order',{body:JSON.parse(security.decryptSecret(unit.body_cipher)),reference:unit.id,idempotencyHeader:'X-Idempotency-Key'});
    }else if(unit.state==='queued')result=await sendStockCheckedOrder(row,unit);
    else if(unit.external_id)result=await send(row,'order/'+unit.external_id);
    // Absence from a partial or delayed list never authorizes another purchase.
    if(result?.success===false&&result.error?.code)throw Object.assign(Error('SUPPLIER_REJECTED'),{supplierCode:result.error.code});
    if(result?.success===true&&result.data)await record(db,unit,result.data);

    else await db.query(`update ${U} set reason=$2 where id=$1 and state='checking'`,[unit.id,'Yoxlama gözləyir · Nəticə qeyri-müəyyəndir; yeni alış göndərilmir.']);
   }catch(error){
    const code=error.supplierCode;
    const balance=['INSUFFICIENT_FUNDS','INSUFFICIENT_BALANCE','BALANCE_NOT_ENOUGH'].includes(code);
    const blocked=['VALIDATION_ERROR','INVALID_INPUT','PLAYER_NOT_FOUND','PRODUCT_NOT_FOUND','VALIDATION_REQUIRED','IDEMPOTENCY_CONFLICT'].includes(code)||[400,401,403,422].includes(error.supplierStatus);
    const stockWaiting=['EPINBY_OUT_OF_STOCK','EPINBY_STOCK_UNKNOWN','EPINBY_PRODUCT_UNAVAILABLE','EPINBY_CATALOG_UNAVAILABLE','EPINBY_SCHEMA_CHANGED','EPINBY_MAPPING_MISMATCH'].includes(error.code);
    const state=unit.state==='queued'&&(balance||stockWaiting)?'queued':unit.state==='queued'&&blocked?'failed':'checking';
    const reason=unit.state!=='queued'?'Yoxlama gözləyir · Əvvəlki göndərişin nəticəsi təsdiqlənməyib; təkrar alış və avtomatik geri ödəniş edilmir.':stockWaiting?'Təchizatçı stoku gözlənilir · '+error.message:balance?'Epinby balansı gözlənilir · '+code:blocked?'Epinby yoxlama tələb edir · '+(code||'HTTP_'+error.supplierStatus):'Yoxlama gözləyir · Nəticə qeyri-müəyyəndir; yalnız mövcud göndəriş yoxlanılır.';
    await db.query(`update ${U} set state=$3,reason=$2,next_at=now()+interval '60 seconds' where id=$1 and state='checking'`,[unit.id,reason,state]);
   }
  }
  await db.query(`update ${D} d set state=case when not exists(select 1 from ${U} u where u.dispatch_id=d.id and u.state<>'delivered') then 'delivered'
   when exists(select 1 from ${U} u where u.dispatch_id=d.id and u.state='queued' and u.reason like 'Epinby balansı%') then 'waiting_balance' when not exists(select 1 from ${U} u where u.dispatch_id=d.id and u.state not in ('failed','delivered')) then 'failed' else 'checking' end
   where d.id=$1`,[unit.dispatch_id]);
 }
 async function deliveryMessage(db,unit){
  let message=security.decryptSecret(unit.result_cipher);
  if((await db.query("select to_regclass('mirpanel_community.ready_stock_product_messages') n")).rows[0].n){
   const order=(await db.query('select checkout_snapshot from public.payment_orders where id=$1',[unit.order_id])).rows[0];
   const productId=order?.checkout_snapshot?.items?.[unit.line_index]?.productId;
   const template=productId?(await readProductMessages(db,security,[productId])).get(productId):null;
   if(template?.trim())message=[message,template].join('\n\n').slice(0,8000);
  }return message;
 }
 async function drain(){
  const db=await pool(),lock=await db.connect();let acquired=false;
  try{
   acquired=(await lock.query('select pg_try_advisory_lock(714025099) acquired')).rows[0].acquired;
   if(acquired)await run(db);
  }finally{try{if(acquired)await lock.query('select pg_advisory_unlock(714025099)');}finally{lock.release();}}
 }
 async function webhook(raw,headers){
  const db=await pool(),row=await credentials(db);if(!row?.webhook_secret_cipher)throw fail(503,'Bildiriş xidməti hazır deyil.');
  const body=verifyEpinbyWebhook(raw,headers,security.decryptSecret(row.webhook_secret_cipher));
  if(!uuid(body.client_order_id))throw fail(400,'Sifariş identifikatoru düzgün deyil.');
  const unit=(await db.query(`select u.*,d.settings->>'type' type,(d.settings->>'productId')::int product_id from ${U} u join ${D} d on d.id=u.dispatch_id where u.id=$1`,[body.client_order_id])).rows[0];
  if(!unit)throw fail(404,'Sifariş tapılmadı.');
  // Persist the signed event before acknowledging. Replay also reconciles after a crash.
  await db.query(`insert into ${S}epinby_events(event_id,unit_id,payload_cipher) values($1,$2,$3) on conflict do nothing`,[body.event_id,unit.id,security.encryptSecret(JSON.stringify(body))]);
  await record(db,unit,body);await db.query('update '+U+" set next_at=now() where id=$1 and state='succeeded'",[unit.id]);
  return {ok:true};
 }
 return {drain,webhook,preflight,synchronize,check,playerName};
}
