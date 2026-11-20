// Public GET-only observation. Never creates a cart, payment or supplier order.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {epinbyPlan} from '../epinby-product.mjs';
const mode=process.argv[2]||'first';assert(['baseline','first','second'].includes(mode));
const out='outputs/epinby-stock';fs.mkdirSync(out,{recursive:true});
const source=await fetch('https://mirpanel.com/app.js?epinby-stock-observation=1',{signal:AbortSignal.timeout(20000)}).then(r=>r.text());
const catalog=extractAdminState(source),bound=catalog.products.filter(p=>p.active!==false).flatMap(p=>(p.plans||[]).map((plan,index)=>({product:p.id,label:plan.label,index,active:plan.active!==false,supplier:epinbyPlan(p,plan)}))).filter(x=>x.supplier&&x.supplier.type!=='TELEGRAM_STARS');
let rows;
for(let attempt=0;attempt<8;attempt++){
 const r=await fetch('https://mirpanel.com/api/payments/inventory',{cache:'no-store',signal:AbortSignal.timeout(25000)});if(r.ok){rows=(await r.json()).products;if(mode==='baseline'||bound.every(x=>rows?.find(p=>p.productId===x.product)?.plans[x.index]?.supplierStock?.checkedAt))break;}
 await new Promise(r=>setTimeout(r,5000));
}
assert(Array.isArray(rows));
const sample={observedAt:new Date().toISOString(),packages:bound.map(b=>{
 const p=rows.find(p=>p.productId===b.product)?.plans[b.index];
 assert(p,'missing public plan '+b.product+':'+b.index);
 if(mode!=='baseline'){
  assert.equal(p.supplierStock?.provider,'epinby');assert.equal(p.supplierStock.intervalMs,60000);assert(p.supplierStock.checkedAt);
  if(p.supplierStock.status==='out'||p.supplierStock.status==='unknown'||!b.active)assert.equal(p.canOrder,false);
  if(p.supplierStock.status==='available'&&p.supplierStock.count===null)assert.equal(p.supplierStock.count,null);
 }
 return {product:b.product,package:b.label,supplierProductId:b.supplier.productId,canOrder:p.canOrder,available:p.available,supplierStock:p.supplierStock};
})};
if(mode==='second'){
 const first=JSON.parse(fs.readFileSync(out+'/live-first.json','utf8'));let updated=0;
 for(const p of sample.packages){const old=first.packages.find(x=>x.product===p.product&&x.supplierProductId===p.supplierProductId);if(old?.supplierStock?.checkedAt&&Date.parse(p.supplierStock.checkedAt)>Date.parse(old.supplierStock.checkedAt))updated++;}
 assert(updated>0,'No server stock refresh observed yet');sample.updatedPackages=updated;sample.elapsedSeconds=(Date.parse(sample.observedAt)-Date.parse(first.observedAt))/1000;
}
fs.writeFileSync(out+'/live-'+mode+'.json',JSON.stringify(sample,null,2));console.log(JSON.stringify(sample,null,2));
