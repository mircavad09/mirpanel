import {createHmac,timingSafeEqual} from 'node:crypto';
import {supplierRequest} from './supplier-request.mjs';
import {epinbyProduct} from '../epinby-product.mjs';
import {planKey} from './payment-profit.mjs';
import {adminDelivery,paid} from './community/order-delivery.mjs';
import {validateDetails} from './community/public/checkout-fields.js';
const S='mirpanel_community.',U=S+'epinby_order_units',D=S+'api_dispatches';
const providerId='e91bb000-0000-4000-8000-000000000001';
const fail=(status,message)=>Object.assign(Error(message),{status});
const allowed=new Set(['https://epinby.com']);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
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
 async function credentials(db){return (await db.query('select * from '+S+'epinby_connection where id=true')).rows[0];}
 const send=(row,path,extra={})=>transport({base:'https://epinby.com',path:'/api/v1/'+path,allowlist:allowed,
  key:security.decryptSecret(row.api_key_cipher),authHeader:'X-API-Key',jsonResponse:true,maxResponseBytes:524288,...extra});
 async function configure(db,row,products){
  await db.query(`insert into ${S}api_suppliers(id,name,base_url,key_cipher,test_path) values($1,'Epinby','https://epinby.com',$2,'/api/v1/getMe')
   on conflict(id) do update set key_cipher=excluded.key_cipher`,[providerId,row.api_key_cipher]);
  for(const p of products){
   const supplier=epinbyProduct(p.supplier,p.id);if(!supplier)continue;
   for(const [i,plan] of (p.plans||[]).entries())await db.query(`insert into ${S}api_mappings(product_id,plan_key,supplier_id,settings,active) values($1,$2,$3,$4,$5)
    on conflict(product_id,plan_key) do update set settings=excluded.settings,active=excluded.active,supplier_id=excluded.supplier_id`,
    [p.id,planKey(plan,i),providerId,{provider:'epinby',...supplier},p.active!==false&&plan.active!==false&&p.soldOut!==true]);
  }
 }
 async function synchronize(db){
  if(!(await db.query("select to_regclass('"+U+"') n")).rows[0].n)return false;
  const row=await credentials(db);if(row?.last_status!=='confirmed'||!row.webhook_secret_cipher)return false;
  await configure(db,row,(await loadCatalog()).products);return true;
 }
 async function preflight(db,p,plan,quantity,values,index=0){
  const supplier=epinbyProduct(p.supplier,p.id);
  if(!supplier)throw fail(409,'Epinby sifariş sazlaması hazır deyil.');
  validateDetails(supplier.fields,values);
  const row=await credentials(db);
  if(row?.last_status!=='confirmed'||!row.webhook_secret_cipher||!(await db.query("select to_regclass('"+U+"') n")).rows[0].n)throw fail(503,'Epinby sifariş xidməti hazır deyil.');
  await configure(db,row,[p]);
  const mapping=(await db.query('select settings from '+S+'api_mappings where product_id=$1 and plan_key=$2 and active and supplier_id=$3 for share',[p.id,planKey(plan,index),providerId])).rows[0];
  if(!mapping||JSON.stringify(epinbyProduct(mapping.settings,p.id)?.fields)!==JSON.stringify(supplier.fields))throw fail(409,'Paketin sifariş sazlaması yenilənir. Yenidən yoxlayın.');
  // The live API ignores undocumented ID filters. Search only the exact game/category,
  // validating every page and the stable product ID before any wallet debit.
  let product;
  for(let page=1;page<=20;page++){
   const query={page,per_page:100,...(supplier.gameId?{game_id:supplier.gameId}:{}),...(supplier.categoryId?{category_id:supplier.categoryId}:{})};
   let response;try{response=await send(row,'products',{query});}catch{throw fail(503,'Təchizatçı stoku yoxlanılmadı. Balans tutulmadı; yenidən cəhd edin.');}
   if(response?.success!==true||!Array.isArray(response.data)||Number(response.meta?.current_page)!==page)throw fail(503,'Təchizatçı stoku yoxlanılmadı. Yenidən cəhd edin.');
   product=response.data.find(x=>Number(x.id)===supplier.productId);
   if(product||page>=Number(response.meta.last_page))break;
  }
  if(!product)throw fail(409,'Təchizatçı məhsulu təsdiqləyə bilmədi.');
  const live=epinbyProduct({provider:'epinby',productId:product.id,type:String(product.type).toUpperCase(),fields:product.fields||[]},p.id);
  if(!live||JSON.stringify(live.fields)!==JSON.stringify(supplier.fields))throw fail(409,'Məhsulun tələb etdiyi sahələr dəyişib. Sifariş formasını yenidən açın.');
  if(!['FINITE','INFINITE','UNLIMITED'].includes(product.stock_status)||product.stock_status==='FINITE'&&(!Number.isSafeInteger(Number(product.stock_count))||Number(product.stock_count)<quantity))throw fail(409,'Təchizatçıda kifayət qədər təsdiqlənmiş stok yoxdur.');
  if(product.supports_player_validation===true){
   let validation;try{validation=await send(row,'validate-player',{body:{product_id:supplier.productId,...values}});}catch{throw fail(503,'Oyunçu məlumatı yoxlanılmadı. Balans tutulmadı.');}
   if(validation?.success!==true)throw fail(409,'Oyunçu məlumatını yoxlayın. Balans tutulmadı.');
  }
 }
 async function prepare(db){
  const c=await db.connect();
  try{
   await c.query('begin');await c.query('select pg_advisory_xact_lock(714025001)');
   const jobs=(await c.query(`select d.*,o.checkout_snapshot,o.status,o.payment_confirmed,o.fulfillment_cancellation from ${D} d join public.payment_orders o on o.id=d.order_id
    where d.supplier_id=$1 and d.state='queued' order by o.created_at,d.line_index for update of d,o skip locked limit 20`,[providerId])).rows;
   for(const job of jobs){
    if(!paid(job)||job.fulfillment_cancellation){await c.query("update "+D+" set state='skipped' where id=$1",[job.id]);continue;}
    const line=job.checkout_snapshot?.items?.[job.line_index];
    const done=(await c.query(`select 1 from ${S}customer_order_deliveries where order_id=$1 and line_index=$2 limit 1`,[job.order_id,job.line_index])).rowCount;
    if(done||!line||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>100){await c.query("update "+D+" set state='failed' where id=$1",[job.id]);continue;}
    let values={};try{if(line.detailsCipher)values=JSON.parse(security.decryptSecret(line.detailsCipher));}catch{throw Error('EPINBY_DETAILS_UNAVAILABLE');}
    const body={product_id:job.settings.productId,qty:1,callback_url:callbackUrl,callback_mode:'events'};
    for(const f of job.settings.fields||[]){if(f.required&&!values[f.key])throw Error('EPINBY_FIELD_MISSING');if(values[f.key])body[f.key]=String(values[f.key]);}
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
  const message=unit.type==='VOUCHER'?Array.isArray(data.delivery)?data.delivery.filter(x=>typeof x==='string').join('\n'):null:'Oyun hesabına yükləmə təchizatçı tərəfindən təsdiqləndi.';
  if(state==='COMPLETED'&&message){next='succeeded';reason=null;}
  else if(state==='COMPLETED')reason='Təchizatçı təhvili təsdiqlədi; kod məlumatı gözlənilir.';
  else if(['FAILED','CANCELED'].includes(state)){next='failed';reason='Təchizatçı sifarişi rədd etdi. Admin araşdırması tələb olunur.';}
  await db.query(`update ${U} set external_id=coalesce(external_id,$2),state=$3,result_cipher=case when $3='succeeded' then $4 else result_cipher end,reason=$5,next_at=case when $3='succeeded' then now() else now()+interval '20 seconds' end
   where id=$1 and state in ('queued','checking')`,[unit.id,external,next,message?security.encryptSecret(message):null,reason]);
 }
 async function drain(){
  const db=await pool();
  if(!(await db.query("select to_regclass('"+U+"') n")).rows[0].n)return;
  const credentialsRow=await credentials(db);if(credentialsRow?.last_status!=='confirmed'||!credentialsRow.webhook_secret_cipher)return;
  if(Date.now()-synchronizedAt>=60000){synchronizedAt=Date.now();try{await synchronize(db);}catch{console.warn('EPINBY_MAPPING_REFRESH_RETRY');}}
  await prepare(db);
  const c=await db.connect();let unit;
  try{
   await c.query('begin');
   unit=(await c.query(`select u.*,d.order_id,d.line_index,d.settings->>'type' type,(d.settings->>'productId')::int product_id
    from ${U} u join ${D} d on d.id=u.dispatch_id where u.state in ('queued','checking','succeeded') and u.next_at<=now()
    order by u.next_at,u.created_at,u.unit_index limit 1 for update of u skip locked`)).rows[0];
   if(unit)await c.query(`update ${U} set state=case when state='queued' then 'checking' else state end,reason=case when state='queued' then 'Göndəriş başlanıb; nəticə təsdiqi gözlənilir.' else reason end,next_at=now()+interval '1 minute' where id=$1`,[unit.id]);
   await c.query('commit');
  }catch(e){await c.query('rollback');throw e;}finally{c.release();}
  if(!unit)return;
  const row=await credentials(db);
  if(unit.state==='succeeded'){
   await adminDelivery(db,security,'supplier:auto',unit.order_id,{requestId:unit.id,line:unit.line_index,quantity:1,message:security.decryptSecret(unit.result_cipher)});
   await db.query("update "+U+" set state='delivered',reason=null where id=$1",[unit.id]);
  }else{
   try{
    let result;
    if(unit.state==='queued')result=await send(row,'order',{body:JSON.parse(security.decryptSecret(unit.body_cipher)),reference:unit.id,idempotencyHeader:'X-Idempotency-Key'});
    else if(unit.external_id)result=await send(row,'order/'+unit.external_id);
    else{
     const orders=await send(row,'orders');const found=Array.isArray(orders.data)&&orders.data.find(x=>x.client_order_id===unit.id);
     if(found)result={success:true,data:found};
    }
    if(result?.success===true&&result.data)await record(db,unit,result.data);
    else if(unit.state==='queued'&&result?.success===false&&['VALIDATION_ERROR','INSUFFICIENT_FUNDS','VALIDATION_REQUIRED','PRODUCT_NOT_FOUND'].includes(result.error?.code))await db.query(`update ${U} set state='failed',reason=$2 where id=$1 and state='checking'`,[unit.id,'Təchizatçı sifarişi qəbul etmədi: '+result.error.code]);
    else await db.query(`update ${U} set reason=$2 where id=$1 and state='checking'`,[unit.id,'Nəticə qeyri-müəyyəndir. Status yoxlanılır; yeni alış göndərilmir.']);
   }catch(error){await db.query(`update ${U} set state=$3,reason=$2 where id=$1 and state='checking'`,[unit.id,'Təchizatçı cavabı alınmadı. Status yoxlanılır; təkrar alış edilmir.',unit.state==='queued'&&[400,401,402,403,422].includes(error.supplierStatus)?'failed':'checking']);}
  }
  await db.query(`update ${D} d set state=case when not exists(select 1 from ${U} u where u.dispatch_id=d.id and u.state<>'delivered') then 'delivered'
   when not exists(select 1 from ${U} u where u.dispatch_id=d.id and u.state not in ('failed','delivered')) then 'failed' else 'checking' end
   where d.id=$1`,[unit.dispatch_id]);
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
 return {drain,webhook,preflight,synchronize};
}
