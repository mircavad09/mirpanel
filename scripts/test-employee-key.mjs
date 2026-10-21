import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {createStockCrypto} from '../mirpanel-admin/employee-security.mjs';import {createEmployeeSystem} from '../mirpanel-admin/employee-api.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},key=crypto.randomBytes(32).toString('base64');
for(const bad of [undefined,'',crypto.randomBytes(31).toString('base64'),crypto.randomBytes(33).toString('base64'),key+'!',key.replace(/=$/,'')]){
 assert.throws(()=>createStockCrypto(bad),e=>e.status===503);checks++;
 let response;const system=createEmployeeSystem({client:{},config:{employeeEnabled:true,encryptionKey:bad},json:(_r,status,body)=>response={status,body}});
 eq(system.enabled(),false);await system.handle({url:'/api/employee/capabilities',method:'GET'},{});eq(response.body.enabled,false);
 await system.handle({url:'/api/employee/dashboard',method:'GET'},{});eq(response.status,503);
}
const old=createStockCrypto(key),next=createStockCrypto(crypto.randomBytes(32).toString('base64')),secret={email:'isolated@test.invalid',password:crypto.randomBytes(16).toString('hex')},aad='unit:canonical-product:canonical-plan';
let disabledResponse;
const disabled=createEmployeeSystem({client:{},config:{employeeEnabled:false,encryptionKey:key},isAdmin:()=>false,json:(_r,status,body)=>disabledResponse={status,body}});
for(const url of ['/api/employee/dashboard','/api/employee/session','/api/admin/workforce/accounts']){
 await disabled.handle({url,method:'GET',headers:{}},{});eq(disabledResponse.status,401);
}
await disabled.handle({url:'/api/employee/capabilities',method:'GET',headers:{}},{});eq(disabledResponse.body.enabled,false);
const encrypted=old.encrypt(secret,aad);eq(old.decrypt(encrypted,aad),secret);assert.throws(()=>old.decrypt(encrypted,aad+'wrong'));checks++;
const rotated=next.encrypt(old.decrypt(encrypted,aad),aad);eq(next.decrypt(rotated,aad),secret);assert.throws(()=>old.decrypt(rotated,aad));checks++;
assert.notEqual(next.fingerprint(secret),old.fingerprint(secret));checks++;
console.log(JSON.stringify({ok:true,checks,missingMalformedKeyFailsClosed:true,rotationRoundTrip:true,keysPrinted:0,productionWrites:0},null,2));
