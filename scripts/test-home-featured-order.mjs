import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createHomeFeatured} from '../mirpanel-admin/home-featured.mjs';import {extractAdminState,patchAppSource} from '../mirpanel-admin/core.mjs';
let source=fs.readFileSync('app.js','utf8'),version=0,failed=false,race=false;
const original=extractAdminState(source);const data=structuredClone(original);data.products.slice(0,8).forEach(p=>p.bestSeller=true);source=patchAppSource(source,data);
const service=createHomeFeatured({read:async()=>({source,sha:String(version)}),head:async()=>({commitSha:String(version)}),readAt:async f=>({source:f==='app.js'?source:'',sha:String(version)}),extract:extractAdminState,patch:patchAppSource,patchHome:s=>s,bump:s=>s,commit:async({parent,files})=>{if(failed)throw Error('offline');if(race){race=false;const d=extractAdminState(source);d.products[0].desc='Parallel published text';source=patchAppSource(source,d);version++;throw Object.assign(Error(),{code:'EDITOR_REF_MOVED'});}assert.equal(parent.commitSha,String(version));source=files.get('app.js');version++;return {commitSha:String(version),blobs:new Map([['app.js',String(version)]])};}});
const all=extractAdminState(source).products,prime=all.find(p=>/Amazon Prime/.test(p.title)),hbo=all.find(p=>/HBO Max/.test(p.title)),netflix=all.find(p=>p.title==='Netflix Şəxsi');
for(const p of [prime,hbo,netflix])await service.save(p.id,true);
await service.move(netflix.id,all[0].id,false);await service.move(hbo.id,netflix.id,false);race=true;await service.move(prime.id,hbo.id,false);
assert.deepEqual((await service.snapshot(true)).ids.slice(0,3),[prime.id,hbo.id,netflix.id]);assert.ok((await service.snapshot()).ids.length>4);
let after=extractAdminState(source);assert.ok(after.products.some(p=>p.desc==='Parallel published text'));
for(const p of after.products){const old=data.products.find(x=>x.id===p.id);for(const k of ['price','plans','active','stock','title'])assert.deepEqual(JSON.parse(JSON.stringify(p[k]??null)),JSON.parse(JSON.stringify(old[k]??null)));}
await Promise.all([service.move(prime.id,netflix.id,true),service.move(prime.id,hbo.id,false)]);assert.deepEqual((await service.snapshot(true)).ids.slice(0,3),[prime.id,hbo.id,netflix.id]);
const before=source;failed=true;await assert.rejects(service.move(prime.id,null,false));assert.equal(source,before);failed=false;
const sandbox={module:{exports:{}},globalThis:null};sandbox.globalThis=sandbox;vm.runInNewContext(fs.readFileSync('home-sections.js','utf8'),sandbox);const render=sandbox.module.exports.render;
const products=extractAdminState(source).products;sandbox.MirpanelHomeFeaturedIds=(await service.snapshot()).ids;
const html=render([...products].reverse(),[],p=>'<article data-id="'+p.id+'"></article>');const featured=html.split('home-featured">')[1].split('</div>')[0];assert.ok(featured.indexOf(prime.id)<featured.indexOf(hbo.id)&&featured.indexOf(hbo.id)<featured.indexOf(netflix.id));
assert.equal(new Set(products.map(p=>p.order)).size,products.length);
console.log('PASS: existing order IDs, Prime/HBO/Netflix, >4, serialized moves, concurrent Git retry, failure, other fields unchanged, reversed input renders admin order');
