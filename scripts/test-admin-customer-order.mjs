import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';import {adminCustomerOrder,adminOrderSummary}from'../mirpanel-admin/community/admin-customer-order.mjs';import{recordDelivery}from'../mirpanel-admin/community/order-delivery.mjs';import{adminDirectory}from'../mirpanel-admin/community/admin-directory.mjs';import{setStaffRole,staffRead}from'../mirpanel-admin/community/staff-readonly.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';const f=await shopFixture(),{pool}=f;const config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')},security=createPaymentSecurity(config);let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{
 await f.db.exec(f.db.read('supabase/migrations/202611090911_fulfillment_cancellation.sql'));
 await f.db.exec(f.db.read('mirpanel-admin/community/customer-activity-migration.sql'));
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',100000)");
 await f.rpc('inventory_set_nullable_quantity',['ordinary',100,'synthetic',f.id(),0,null]);
 await f.rpc('inventory_set_nullable_quantity',['finite',100,'synthetic',f.id(),(await f.rpc('inventory_snapshot')).find(x=>x.productId==='finite').version,null]);
 const sample=async({status='reviewing',paid=true,quantity=2,multi=false}={})=>{
  const items=[{productId:'ordinary',planIndex:0,quantity},...(multi?[{productId:'finite',planIndex:0,quantity:1}]:[])];
  const quote=await f.shop.quote({user:'a'},items,'a'.repeat(64));
  const purchase=await f.shop.checkout({user:'a'},'a'.repeat(64),{mode:'wallet',items:items.map((i,n)=>({...i,termsVersion:quote.items.find(x=>x.productId===i.productId).termsVersion})),requestId:f.id(),consentAccepted:true});
  const id=purchase.orderId,snapshot=(await pool.query('select checkout_snapshot from public.payment_orders where id=$1',[id])).rows[0].checkout_snapshot;
  snapshot.items.sort((a,b)=>a.productId==='ordinary'?-1:b.productId==='ordinary'?1:0);
  Object.assign(snapshot.items[0],{title:'Tarixi məhsul',planName:'Tarixi paket',fields:[{key:'email',label:'Müştəri e-poçtu',type:'email'},{key:'password',label:'Məhsul şifrəsi',type:'password'},{key:'player_id',label:'Oyunçu ID-si',type:'text'},{key:'phone',label:'Telefon',type:'tel'}],detailsCipher:security.encryptSecret(JSON.stringify({email:'buyer@example.test',password:'CUSTOMER-SYNTHETIC',player_id:'0012',phone:'00001122'}))});
  if(multi)Object.assign(snapshot.items[1],{title:'İkinci məhsul',planName:'3 ay'});
  await pool.query("update public.payment_orders set status=$2,payment_confirmed=$3,payment_source='card',checkout_snapshot=$4,receipt_bucket='synthetic',receipt_path='test.png',receipt_mime='image/png',receipt_size=3,receipt_sha256=$5,method_name_snapshot='Tarixi bank',method_last4_snapshot='0012',approved_at=case when $3 then clock_timestamp() end where id=$1",[id,status,paid,snapshot,'a'.repeat(64)]);
  return id;
 };
 const deliver=async(id,line=0,quantity=1)=>recordDelivery(pool,security,'synthetic',id,f.id(),line,quantity,'Tarixi təlimat [https://example.test/help].\n<script>never-run</script>',{email:'delivered@example.test',password:'DELIVERED-SYNTHETIC',roomName:'Otaq 2',roomCode:'0012'});
 const open=await sample({paid:false}),waiting=await sample(),partial=await sample();await deliver(partial);
 const completed=await sample({quantity:1});await deliver(completed);
 const multi=await sample({quantity:2,multi:true});await deliver(multi,0,2);await deliver(multi,1,1);
 const cancelled=await sample({status:'cancelled'});await pool.query('update public.payment_orders set fulfillment_cancellation=$2 where id=$1',[cancelled,{full:true,at:'2026-11-22T10:00:00Z',reason:'Sınaq ləğvi',refundCents:1000,refundStatus:'card_pending',lines:[{index:0,quantity:2}]}]);
 const partialCancel=await sample();await deliver(partialCancel);await pool.query('update public.payment_orders set fulfillment_cancellation=$2 where id=$1',[partialCancel,{full:false,at:'2026-11-22T10:00:00Z',reason:'Qismən sınaq',refundCents:500,refundStatus:'wallet_refunded',lines:[{index:0,quantity:1}]}]);await pool.query('insert into community_refunds(order_id,cents) values($1,500)',[partialCancel]);
 const before=(await pool.query('select id,status,amount,checkout_snapshot,fulfillment_cancellation from public.payment_orders order by id')).rows;
 for(const [id,status]of[[open,'reviewing'],[waiting,'preparing'],[partial,'preparing'],[completed,'completed'],[multi,'completed'],[cancelled,'cancelled'],[partialCancel,'completed']])eq((await adminCustomerOrder(pool,security,'a',id)).status,status);
 const detail=await adminCustomerOrder(pool,security,'a',completed);eq(detail.customerFields[0].fields.find(f=>f.label==='Məhsul şifrəsi').value,'CUSTOMER-SYNTHETIC');eq(detail.deliveries[0].fields.find(f=>f.label==='Şifrə').value,'DELIVERED-SYNTHETIC');eq(detail.deliveries[0].fields.find(f=>f.label==='Otaq kodu (PIN)').value,'0012');eq(detail.customerFields[0].fields.find(f=>f.label==='Oyunçu ID-si').value,'0012');
 eq((await adminCustomerOrder(pool,security,'a',cancelled)).refundedCents,0);eq((await adminCustomerOrder(pool,security,'a',partialCancel)).refundedCents,500);
 const multiple=await adminCustomerOrder(pool,security,'a',multi);eq(multiple.items.map(x=>[x.package,x.quantity,x.delivered]),[['Tarixi paket',2,2],['3 ay',1,1]]);
 const directory=await adminDirectory(pool,{total:async()=>0,config:async()=>({tiers:[]})},{id:'a'});assert(!JSON.stringify(directory).includes('SYNTHETIC'));checks++;assert(!JSON.stringify(directory).includes('detailsCipher'));checks++;
 // Changing current catalogue/stock must not modify any old snapshot output.
 f.catalog.products[0].title='Yeni məhsul adı';f.catalog.products[0].plans[0].label='Yeni paket';eq((await adminCustomerOrder(pool,security,'a',completed)).items[0].product,'Tarixi məhsul');
 await assert.rejects(adminCustomerOrder(pool,security,'b',completed),{status:404});checks++;
 await setStaffRole(pool,'owner',{userId:'b',enabled:true});await assert.rejects(staffRead(pool,'b','/users/a/orders/'+completed),{status:404});checks++;
 eq((await pool.query('select id,status,amount,checkout_snapshot,fulfillment_cancellation from public.payment_orders order by id')).rows,before);
 console.log(JSON.stringify({checks,readOnly:true,statusCases:7,multiProduct:true,separateSecrets:true,leadingZero:true,wrongCustomerDenied:true,staffDenied:true,snapshotOnly:true}));
}finally{await f.close();}
