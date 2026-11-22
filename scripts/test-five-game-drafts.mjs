import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fiveGameDrafts,reviewFiveGamePackage} from './five-game-drafts.mjs';
import {extractAdminState,patchAppSource} from '../mirpanel-admin/core.mjs';
import {inventoryAvailability} from '../inventory-availability.mjs';
import {termsInfo} from '../mirpanel-admin/cart-drafts.mjs';
import {validateDetails} from '../mirpanel-admin/community/public/checkout-fields.js';
import {generateProductPageFiles,generateSitemap} from '../mirpanel-admin/product-pages.mjs';
const source=fs.readFileSync('app.js','utf8'),state=extractAdminState(source);
const base=extractAdminState(execFileSync('git',['-c','safe.directory='+process.cwd(),'show','HEAD:app.js'],{encoding:'utf8'}));
const manifest=JSON.parse(fs.readFileSync('catalog/five-games-20261122.json','utf8'));
const ids=manifest.products.map(p=>p.id),drafts=state.products.filter(p=>ids.includes(p.id));
assert.equal(drafts.length,5);
assert.equal(manifest.packages.length,103);
assert.equal(drafts.flatMap(p=>p.plans).length,17);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(hash(state.products.filter(p=>!ids.includes(p.id))),hash(base.products.filter(p=>!ids.includes(p.id))),'all parallel products, including PUBG/Free Fire, remain identical');
assert.equal(hash(fiveGameDrafts(state.products,manifest).products),hash(state.products),'re-run is a no-op');
const alternate=structuredClone(drafts[0]);alternate.id='existing_ml';alternate.title='Mobile Legends: Bang Bang';
assert.equal(fiveGameDrafts([alternate],manifest).report[0].added,false,'alternate existing product does not duplicate');
const normalized=extractAdminState(patchAppSource(source,state));
for(const p of drafts){
 assert.equal(p.active,false);assert.equal(p.seoIndex,false);assert.equal(p.includeInSitemap,false);
 assert.equal(p.banner.enabled,false);assert.equal(p.category,'games');
 assert.equal(inventoryAvailability(p).canOrder,false);
 assert.equal(normalized.products.find(x=>x.id===p.id).active,false);
 for(const plan of p.plans){
  assert.equal(plan.active,false);assert.equal(normalized.products.find(x=>x.id===p.id).plans.find(x=>x.id===plan.id).active,false);
  const c=manifest.packages.find(c=>c.supplierProductId===plan.supplier.productId);
  assert.equal(plan.price,Number(c.targetPrice));assert.equal(plan.label,c.name);
  const terms=termsInfo(p,plan,0),values={player_id:'000123456'};
  if(c.fields.some(f=>f.key==='server_id'))values.server_id='0001';
  assert.deepEqual(validateDetails(terms.fields,values),values,'leading zeroes survive form validation');
  assert.throws(()=>validateDetails(terms.fields,{...values,player_id:''}));
  const current={id:c.supplierProductId,name:c.name,game_id:c.gameId,category_id:c.categoryId,type:c.type,
   fields:c.fields,price:'0.18',currency:'USD',stock_status:'INFINITE',stock_count:null};
  assert.equal(reviewFiveGamePackage(c,current).ready,false,'dated research never activates a package');
  const evidence={accountCatalog:true,complete:true,regionConfirmed:true,platformConfirmed:true,competitorConfirmed:true,checkedAt:'2026-11-22T16:00:00Z'};
  const checked=reviewFiveGamePackage(c,current,evidence);
  assert.equal(checked.ready,true,JSON.stringify(checked.reasons));
  assert.equal(checked.cost.exchangeRate,'1.73');
  assert.equal(reviewFiveGamePackage(c,{...current,stock_status:'FINITE',stock_count:0},evidence).ready,false);
  assert.equal(reviewFiveGamePackage(c,{...current,price:'9999'},evidence).ready,false);
  assert.equal(reviewFiveGamePackage(c,{...current,currency:'EUR'},evidence).cost.azn,null);
  assert.equal(reviewFiveGamePackage(c,{...current,category_id:9999},evidence).ready,false);
  assert.equal(reviewFiveGamePackage(c,{...current,name:'Different pass'},evidence).ready,false);
  assert.equal(reviewFiveGamePackage(c,current,{...evidence,complete:false}).stock.status,'unknown');
  assert.equal(reviewFiveGamePackage(c,{...current,fields:[{key:'player_id',required:true},{key:'input_2',required:true}]},evidence).ready,false);
 }
}
assert.equal(reviewFiveGamePackage(manifest.packages.find(x=>x.supplierProductId===413),null).cost.azn,null);
assert.equal(drafts.find(p=>p.id==='mobile_legends').plans[0].supplier.gameId,6);
assert(manifest.packages.filter(x=>x.productId==='arena_breakout').every(x=>x.gameId===14&&x.categoryId===33));
assert(manifest.packages.filter(x=>x.productId==='arena_breakout_infinite').every(x=>x.gameId===13&&x.categoryId===34));
assert(manifest.packages.filter(x=>x.productId==='stumble_guys').some(x=>x.name==='120 Tokens'));
const generated=generateProductPageFiles(state.products,state.siteSections,state.cms,state.content);
const sitemap=generateSitemap(state.products,state.siteSections,new Date(),state.cms);
for(const p of drafts){assert(![...generated.keys()].some(k=>k.includes(p.seoSlug)));assert(!sitemap.includes('/mehsul/'+p.seoSlug+'<'));}
console.log('PASS: five inactive drafts, 17 exact targets, 103 scoped candidates, duplicate protection, no zero-price offers, leading-zero inputs, normalization, unknown stock, currencies, 1.73 rate, regions, hidden public pages, unchanged existing catalog');
