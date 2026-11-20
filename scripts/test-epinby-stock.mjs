import assert from 'node:assert/strict';
import {createEpinbyStock,epinbyStockState} from '../mirpanel-admin/epinby-stock.mjs';
import {inventoryAvailability} from '../inventory-availability.mjs';
const binding=(id,gameId,categoryId)=>({id:'epinby_'+id,price:2,supplier:{provider:'epinby',productId:id,type:'TOPUP',gameId,categoryId,fields:[{key:'player_id',required:true}]}});
const pubg={id:'pubg_mobile',active:true,plans:[binding(3436,4,223),binding(3437,4,223),{...binding(3438,4,223),active:false}]};
const free={id:'free_fire',active:true,plans:[binding(682,5,20)]},data={products:[pubg,free]};
let time=100000,mode='missing',calls=0,version='v1';const perGroup=new Map();
const row=(id,g,c,count=null)=>({id,game_id:g,category_id:c,stock_status:count===null?'INFINITE':'FINITE',stock_count:count});
const transport=async req=>{
 assert.equal(req.path,'/api/v1/products');assert(!req.body);calls++;const g=req.query.game_id,page=req.query.page;perGroup.set(g,(perGroup.get(g)||0)+1);
 if(g===5)return {success:true,data:[row(682,5,20,5)],meta:{current_page:1,last_page:1,total:1}};
 if(mode==='network')throw Error('NETWORK');
 if(mode==='rate')throw Object.assign(Error('RATE'),{supplierStatus:429});
 if(mode==='partial'&&page===2)throw Error('BROKEN_PAGE');
 const rows=[...(mode==='missing'?[]:[row(3436,4,223)]),row(3437,4,223),row(3438,4,223)];
 return {success:true,data:page===1?rows.slice(0,1):rows.slice(1),meta:{current_page:page,last_page:2,total:mode==='bad-total'?999:rows.length}};
};
const sync=createEpinbyStock({catalog:async()=>data,pool:async()=>({query:async sql=>{assert(sql.startsWith('select '));return {rows:[{api_key_cipher:'cipher',last_status:'confirmed',credential_version:version}]};}}),security:{decryptSecret:()=> 'secret'},transport,now:()=>time});
const raw=[{productId:'pubg_mobile',scope:'plan',salePaused:false,plans:[{planKey:'0',tracked:false},{planKey:'1',tracked:false},{planKey:'2',tracked:false}]}];
const state=p=>inventoryAvailability(p,sync.decorate(data,raw).find(r=>r.productId===p.id));
assert.equal(state(pubg).plans[0].supplierStock.status,'unknown');assert(!state(pubg).plans[0].canOrder);
await Promise.all([sync.refresh(),sync.refresh(),sync.refresh()]);assert.equal(calls,3); // 2 PUBG pages + 1 Free Fire page.
let s=state(pubg);assert.equal(s.plans[0].supplierStock.status,'out');assert.equal(s.plans[0].available,0);assert(!s.plans[0].canOrder);assert(s.plans[1].canOrder);assert(!s.plans[2].canOrder);assert.equal(s.plans[1].available,null);
assert.equal(state(free).plans[0].available,5);assert.equal(raw[0].plans[0].supplierStock,undefined);
const count=calls;await sync.refresh();assert.equal(calls,count,'no extra supplier request within 60 seconds');
time+=60001;mode='back';await sync.refresh();assert(state(pubg).plans[0].canOrder);assert.equal(state(pubg).plans[0].available,null);assert(!state(pubg).plans[2].canOrder);
pubg.active=false;assert(!state(pubg).canOrder);pubg.active=true;raw[0].salePaused=true;assert(!state(pubg).canOrder);raw[0].salePaused=false;
for(const failure of ['partial','network','rate','bad-total']){
 mode=failure;time+=300001;await sync.refresh();s=state(pubg);assert.equal(s.plans[0].supplierStock.status,'unknown');assert(!s.plans[0].canOrder);assert.equal(s.plans[0].supplierStock.count,null);assert(state(free).plans[0].canOrder);
 const before=calls;await sync.refresh();assert.equal(calls,before,'failed/rate-limited scopes respect backoff');
}
mode='back';time+=300001;await sync.refresh();assert(state(pubg).plans[0].canOrder);
time+=90001;assert.equal(state(pubg).plans[0].supplierStock.status,'unknown');
version='v2';await sync.refresh();assert(state(pubg).plans[0].canOrder);
const localOnly={id:'local',stockEnabled:true,plans:[{price:2}]};assert.deepEqual(sync.decorate({products:[localOnly]},[]),[]);
const missingLocal={...pubg,stockEnabled:true};assert(!inventoryAvailability(missingLocal,sync.decorate({products:[missingLocal]},[])[0]).canOrder,'supplier availability never bypasses missing local ledger');
for(const [value,status,count]of [[null,'out',0],[{stock_status:'FINITE',stock_count:0},'out',0],[{stock_status:'FINITE',stock_count:12},'available',12],[{stock_status:'FINITE',stock_count:null},'unknown',null],[{stock_status:'INFINITE'},'available',null],[{active:false,stock_status:'INFINITE'},'out',0],[{stock_status:'unexpected'},'unknown',null]]){
 const got=epinbyStockState(value);assert.equal(got.status,status);assert.equal(got.count,count);
}
assert.equal(sync.intervalMs,60000);sync.stop();
console.log('PASS automatic stock cache: complete pagination, missing 60 UC, return to stock, finite/infinite counts, single flight, 60s interval, backoff/429, partial/network/invalid catalog, stale data, admin pause/disabled package, no local stock writes');
