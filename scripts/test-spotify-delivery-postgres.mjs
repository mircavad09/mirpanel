import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {adminDelivery,ownerCodes} from '../mirpanel-admin/community/order-delivery.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')},security=createPaymentSecurity(config),f=await shopFixture({paymentConfig:config});
try{
 f.catalog.products.push({id:'spotify',title:'Spotify Premium',active:true,plans:[{price:5,months:1,label:'Öz hesabınızda aktivləşdirmə'}],formFields:[{key:'email',type:'email',label:'E-poçt',required:true},{key:'password',type:'password',label:'Şifrə',required:true}]});
 const orders=[];
 for(const [user,email,password] of [['a','first@example.test','first-synthetic'],['b','second@example.test','second-synthetic']]){
  const req={user},owner=user.repeat(64),item={productId:'spotify',planIndex:0,quantity:1};
  const quote=await f.shop.quote(req,[item],owner),draft=await f.shop.saveDraft(req,owner,{id:f.id(),productId:item.productId,planIndex:item.planIndex,termsVersion:quote.items[0].termsVersion,values:{email,password}});
  await f.pool.query('insert into wallet_accounts(user_id,cents) values($1,2000) on conflict(user_id) do update set cents=2000',[user]);
  const order=await f.shop.checkout(req,owner,{items:[{...item,draftId:draft.draftId,lineId:draft.lineId,termsVersion:draft.termsVersion}],mode:'wallet',requestId:f.id(),consentAccepted:true});
  const preview=await adminDelivery(f.pool,security,'synthetic-admin',order.orderId,null);
  assert.deepEqual(preview.lines[0].customerAccount,{email,password});orders.push(order);
 }
 const input={requestId:f.id(),line:0,quantity:1,email:'admin-edited@example.test',password:'admin-edited-synthetic',message:'Sintetik hazır mesaj\nİkinci sətir'};
 const result=await adminDelivery(f.pool,security,'synthetic-admin',orders[0].orderId,input);
 assert.equal(result.status,'completed');assert(!result.lines.some(x=>Object.hasOwn(x,'customerAccount')));
 assert.equal((await adminDelivery(f.pool,security,'synthetic-admin',orders[0].orderId,input)).replayed,true);
 const own=await ownerCodes(f.pool,'a',input.requestId),other=await ownerCodes(f.pool,'b',input.requestId);
 assert.equal(own.length,1);assert.equal(other.length,0);
 const saved=JSON.parse(security.decryptSecret(own[0].message_cipher));assert.equal(saved.email,input.email);assert.equal(saved.password,input.password);assert.equal(saved.message,input.message);
 assert(!own[0].message_cipher.includes(input.password));
 const mail=await f.pool.query("select count(*)::int n from mirpanel_community.customer_order_mail where event_key=$1",['delivery:'+input.requestId]);assert.equal(mail.rows[0].n,1);
 console.log(JSON.stringify({twoOrderPrefills:true,editedCredentialsDelivered:true,ownerOnly:true,encryptedAtRest:true,retrySingleDeliveryAndMail:true,realEmails:0,productionWrites:0}));
}finally{await f.close();}
