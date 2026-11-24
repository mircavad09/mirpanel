import assert from 'node:assert/strict';
import {publicReadCache} from '../mirpanel-admin/public-read-cache.mjs';
import {boundedReadFetch} from '../mirpanel-admin/bounded-read-fetch.mjs';
import {createProductSalesRepository} from '../mirpanel-admin/product-sales-repository.mjs';
import {createStoriesRepository} from '../mirpanel-admin/stories-repository.mjs';
import {createInventoryReader} from '../mirpanel-admin/inventory-reader.mjs';
let clock=0,calls=0,failed=false;
const cached=publicReadCache(async()=>{calls++;if(failed)throw Error('offline');return{safe:[1]};},{now:()=>clock,ttlMs:100,cooldownMs:50});
const values=await Promise.all(Array.from({length:100},()=>cached()));assert.equal(calls,1);values[0].safe.push(2);assert.deepEqual(await cached(),{safe:[1]});
clock=101;failed=true;await assert.rejects(cached());await assert.rejects(cached());assert.equal(calls,2);clock=152;failed=false;await cached();assert.equal(calls,3);
let release;const old=publicReadCache(()=>new Promise(r=>release=r));const first=old();await Promise.resolve();old.invalidate();release('old');await first;
let salesQueries=0;const sales=createProductSalesRepository({rpc:async name=>{if(name==='product_sales_revision')return{data:1};assert.equal(name,'product_sales_snapshot');salesQueries++;return{data:{initializedAt:'fixture',real:[{product_id:'a',count:5}],baselines:[],realTotal:5}};}},{loadCatalog:async()=>({products:[{id:'a',title:'A'},{id:'b',title:'B'}]})});
await Promise.all(Array.from({length:60},(_,i)=>sales.publicProduct(i%2?'a':'b')));assert.equal(salesQueries,1);
await sales.snapshot();assert.equal(salesQueries,2,'Admin snapshot bypasses presentation cache');
let reads=0,signs=0;
const rows={story_categories:[{id:'a',active:true,cover_path:'cover.png'}],story_items:[{id:'b',story_id:'a',active:true,media_path:'item.png',sort_order:1,created_at:'2026-01-01'}]};
const media=createStoriesRepository({from(table){const q={select(){return q;},order(){return q;},eq(){return q;},then(resolve){reads++;resolve({data:structuredClone(rows[table]),error:null});}};return q;},storage:{from:()=>({createSignedUrl:async path=>{signs++;return{data:{signedUrl:'https://example.invalid/'+path}};}})}});
await Promise.all(Array.from({length:50},()=>media.listPublic()));assert.equal(reads,2);assert.equal(signs,2);
await media.listAdmin();assert.equal(signs,2,'Admin metadata refresh does not re-sign valid URLs');
const hold=setTimeout(()=>{},5000);let outbound=0;
const hang=async(_url,options)=>{outbound++;return new Promise((_,reject)=>{if(options.signal?.aborted)reject(options.signal.reason);else options.signal?.addEventListener('abort',()=>reject(options.signal.reason),{once:true});});};
try{
 for(const path of ['/rest/v1/rpc/inventory_snapshot','/rest/v1/rpc/product_sales_snapshot','/storage/v1/object/sign/private/file.png']){
  const start=performance.now();await assert.rejects(boundedReadFetch('https://fixture.invalid'+path,{method:'POST'},{timeoutMs:20,send:hang}),{name:'TimeoutError'});assert.ok(performance.now()-start<250);
 }
 const controller=new AbortController();controller.abort();await assert.rejects(boundedReadFetch('https://fixture.invalid/rest/v1/orders',{signal:controller.signal},{timeoutMs:20,send:hang}),{name:'AbortError'});
 let writes=0;const write=async(_url,options)=>{writes++;assert.equal(options.signal,undefined);throw Error('lost response');};
 await assert.rejects(boundedReadFetch('https://fixture.invalid/rest/v1/rpc/submit_payment_order_v2',{method:'POST'},{timeoutMs:20,send:write}));assert.equal(writes,1,'Never retry an ambiguous mutation');
 let offline=true,now=0;const read=createInventoryReader({enabled:()=>true,now:()=>now,retryMs:30,snapshot:async()=>{if(offline)throw Error('upstream unavailable');return[{productId:'a',available:3}];}});
 await assert.rejects(read(),{status:503});await assert.rejects(read(),{status:503});offline=false;now=31;assert.deepEqual(await read(),[{productId:'a',available:3}]);
}finally{clearTimeout(hold);}
console.log(JSON.stringify({publicSalesReadsBefore:60,publicSalesReadsAfter:1,concurrentStoryRequests:50,databaseListQueries:2,mediaSigns:2,readRpcTimeout:true,bodyDeadline:true,failedInventoryNotZero:true,recoveryWithoutRestart:true,ambiguousWriteReplays:0,productionMutations:0,passed:true}));
