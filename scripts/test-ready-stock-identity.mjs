import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extractAdminState,normalizeAdminPayload,patchAppSource} from '../mirpanel-admin/core.mjs';
import {signature} from '../mirpanel-admin/employee-security.mjs';
import {planKey} from '../mirpanel-admin/payment-profit.mjs';
import {readyAccountPackage} from '../mirpanel-admin/community/ready-stock-management.mjs';
const source=fs.readFileSync('app.js','utf8');
const raw=vm.runInNewContext('('+source.slice(source.indexOf('{',source.indexOf('const DATA')),source.indexOf('/*',source.indexOf('const DATA'))).replace(/;\s*$/,'')+')');
const catalog=extractAdminState(source);
let matched=0;
for(const product of raw.products){
 const current=catalog.products.find(p=>p.id===product.id);
 for(const [i,plan]of product.plans.entries()){
  assert.equal(signature(current.plans[i]),signature(plan),`${product.id}/${i}: normalization must retain existing fulfillment signature`);
  assert.equal(planKey(current.plans[i],i),planKey(plan,i));matched++;
 }
}
const p=catalog.products.find(p=>p.id==='capcut'),legacy=raw.products.find(p=>p.id==='capcut');
const row={product_id:p.id,plan_key:'0',plan_signature:signature(legacy.plans[0])};
assert.equal(readyAccountPackage(catalog,row).packageAvailable,true);
const reordered=structuredClone(catalog);
const target=reordered.products.find(x=>x.id==='capcut');target.plans.reverse();
const roundtrip=extractAdminState(patchAppSource(source,reordered));
const found=roundtrip.products.find(x=>x.id==='capcut').plans.find(x=>x.id===p.plans[0].id);
assert.equal(signature(found),row.plan_signature);assert.equal(readyAccountPackage(roundtrip,row).packageAvailable,true);
const renamed=structuredClone(roundtrip);const rp=renamed.products.find(x=>x.id==='capcut').plans.find(x=>x.id===p.plans[0].id);rp.label='Dəyişmiş ad';rp.price=123.45;
const renamedPublished=extractAdminState(patchAppSource(source,renamed));assert.equal(readyAccountPackage(renamedPublished,row).packageAvailable,true,'Name and price changes must not orphan stored accounts');
assert.equal(signature(renamedPublished.products.find(x=>x.id==='capcut').plans.find(x=>x.id===p.plans[0].id)),row.plan_signature);
const modified=structuredClone(renamedPublished);modified.products.find(x=>x.id==='capcut').plans.find(x=>x.id===p.plans[0].id).durationDays=15;
const modifiedPublished=extractAdminState(patchAppSource(source,modified));assert.notEqual(signature(modifiedPublished.products.find(x=>x.id==='capcut').plans.find(x=>x.id===p.plans[0].id)),row.plan_signature,'Actual duration change needs separate stock scope');
const repeat=extractAdminState(patchAppSource(patchAppSource(source,renamed),renamedPublished));assert.equal(readyAccountPackage(repeat,row).packageAvailable,true,'Repeated publication must not change identity');
const changed=structuredClone(roundtrip);changed.products.find(x=>x.id==='capcut').plans.find(x=>x.id===p.plans[0].id).months=99;
assert.equal(readyAccountPackage(changed,row).packageAvailable,false,'genuine SKU changes must remain isolated');
const explicit={...legacy.plans[0],id:'real-stable-id'};
assert.equal(signature(normalizeAdminPayload({...catalog,products:[{...p,plans:[explicit]}]}).products[0].plans[0]),signature(explicit));
console.log(JSON.stringify({existingPackageSignaturesPreserved:matched,costKeysUnchanged:true,reorderAndPublishStable:true,realSkuChangesIsolated:true,productionWrites:0}));
