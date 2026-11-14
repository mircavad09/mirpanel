import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {spotifyDeliveryPrefill} from '../mirpanel-admin/community/spotify-delivery-prefill.mjs';
import {adminDelivery} from '../mirpanel-admin/community/order-delivery.mjs';
const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
const values={email:'first@example.test',password:' synthetic-only '};
const line={productId:'spotify',title:'Spotify Premium',planName:'Öz hesabınızda aktivləşdirmə',quantity:1,unitCents:549};
const item=(data=values,extra={})=>({...line,detailsCipher:security.encryptSecret(JSON.stringify(data)),...extra});
const order=(items=[item()])=>({id:crypto.randomUUID(),status:'approved',payment_confirmed:true,checkout_snapshot:{cartVersion:2,items},customer_email:'profile-must-not-be-used@example.test'});
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
let o=order();eq(spotifyDeliveryPrefill(o,line,0,security),values);
for(const [emailKey,passwordKey] of [['spotifyEmail','spotifyPassword'],['spotify_email','spotify_password'],['E-poçt','Şifrə'],['gmail','parola'],['account_email','account_password']]){
 o=order([item({[emailKey]:values.email,[passwordKey]:values.password,password_confirm:'not-the-password'})]);eq(spotifyDeliveryPrefill(o,line,0,security),values);
}
o=order([item({customMail:values.email,customSecret:values.password},{fields:[{key:'customMail',type:'email'},{key:'customSecret',type:'password'}]})]);eq(spotifyDeliveryPrefill(o,line,0,security),values);
o=order([item({password_confirm:'not-an-account-password'})]);eq(spotifyDeliveryPrefill(o,line,0,security),{email:'',password:''});
o=order([{...line}]);eq(spotifyDeliveryPrefill(o,line,0,security),{email:'',password:''});
o=order([item({email:values.email})]);eq(spotifyDeliveryPrefill(o,line,0,security),{email:values.email,password:''});
o=order([item({password:values.password})]);eq(spotifyDeliveryPrefill(o,line,0,security),{email:'',password:values.password});
o={product_id:'spotify',checkout_snapshot:item({spotifyEmail:values.email,spotifyPassword:values.password})};eq(spotifyDeliveryPrefill(o,line,0,security),values);
o=order([item(values,{productId:'capcut'})]);eq(spotifyDeliveryPrefill(o,{...line,productId:'capcut',title:'CapCut Pro',planName:'1 ay'},0,security),null);
o=order([item(values,{planName:'Hazır şəxsi hesab'})]);eq(spotifyDeliveryPrefill(o,{...line,planName:'Hazır şəxsi hesab'},0,security),null);
o=order([item(),item({email:'second@example.test',password:'second-synthetic'})]);eq(spotifyDeliveryPrefill(o,line,1,security),{email:'second@example.test',password:'second-synthetic'});
// Exercise the real GET delivery projection using a read-only synthetic database adapter.
const calls=[],pool={async connect(){return {async query(sql,args){calls.push(sql);if(sql.startsWith('select o.*'))return {rows:[o]};if(sql.includes('from mirpanel_community.customer_order_deliveries'))return {rows:[]};return {rows:[]};},release(){}};}};
const preview=await adminDelivery(pool,security,'synthetic-admin',o.id,null);
eq(preview.lines[0].customerAccount,values);eq(preview.lines[1].customerAccount,{email:'second@example.test',password:'second-synthetic'});
eq(calls.some(sql=>/insert|update|delete/i.test(sql)),false);
o=order([item(values,{detailsCipher:'corrupt-synthetic-cipher'})]);
await assert.rejects(()=>adminDelivery(pool,security,'synthetic-admin',o.id,null),e=>e.status===503&&!e.message.includes(values.password));checks++;
console.log(JSON.stringify({checks,legacyKeys:true,multiProductIsolation:true,profileFallback:false,readOnlyPreview:true,productionWrites:0}));
