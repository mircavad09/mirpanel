import assert from 'node:assert/strict';import fs from 'node:fs';import {inventoryAvailability as resolve} from '../inventory-availability.mjs';import {extractAdminState} from '../mirpanel-admin/core.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},p={id:'future-product',title:'Do not infer stock from this name',stock:999,stockEnabled:true,plans:[{price:5},{price:8},{price:9,active:false}]};
for(const n of [1,0,1]){const s=resolve(p,{scope:'product',available:n});eq(s.canOrder,n>0);eq(s.available,n);}
const partial=resolve(p,{scope:'plan',plans:[{planKey:'0',tracked:true,available:0},{planKey:'1',tracked:true,available:2}]});eq(partial.canOrder,true);eq(partial.available,null);eq(partial.plans.map(p=>p.canOrder),[false,true,false]);eq(partial.plans.findIndex(p=>p.canOrder),1);
eq(resolve(p,{scope:'plan',plans:[{planKey:'0',tracked:true,available:0},{planKey:'1',tracked:true,available:0}]}).canOrder,false);
eq(resolve(p,{scope:'plan',plans:[{planKey:'0',tracked:true,available:0}]}).plans[1].canOrder,false);
eq(resolve(p,{scope:'plan',plans:[{planKey:'0',tracked:true,available:0},{planKey:'1',tracked:false}]}).plans[1].canOrder,true);
eq(resolve({...p,stockEnabled:false,stock:0}).canOrder,true);eq(resolve({...p,stockEnabled:false,title:'Stokda yoxdur'}).canOrder,true);eq(resolve({...p,stockEnabled:false,soldOut:true}).canOrder,false);eq(resolve({...p,stockEnabled:false,flow:'out_of_stock'}).canOrder,false);
eq(resolve({...p,soldOut:true,flow:'out_of_stock'},{scope:'product',available:1}).canOrder,true);eq(resolve(p).needsSetup,true);eq(resolve(p).canOrder,false);
const catalog=extractAdminState(fs.readFileSync('app.js','utf8')).products.filter(p=>p.active!==false);eq(catalog.length,22);
for(const product of catalog){const original=JSON.stringify(product);for(const n of [0,1]){const s=resolve(product,{scope:'product',available:n});eq(s.canOrder,n>0&&product.plans.some(p=>p.active!==false&&Number(p.price)>0));}eq(JSON.stringify(product),original);}
console.log(JSON.stringify({ok:true,checks,products:catalog.map(p=>p.id),dynamicFutureProduct:true,namesPricesPlansUnchanged:true,productionWrites:0}));
