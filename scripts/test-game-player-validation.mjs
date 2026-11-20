import assert from 'node:assert/strict';
import {createEpinbyOrders} from '../mirpanel-admin/epinby-orders.mjs';
import {epinbyProduct} from '../epinby-product.mjs';
import {validateEpinbyDetails} from '../mirpanel-admin/community/public/checkout-fields.js';
const fields=[{key:'player_id',label:'Player ID',required:true},{key:'server_id',label:'Server / region',required:true,options:['0001','EU']}];
const db={query:async sql=>{assert(sql.startsWith('select * from mirpanel_community.epinby_connection'),'No DB writes in account check');return {rows:[{last_status:'confirmed',api_key_cipher:'encrypted',credential_version:1}]};}};
let checks=0;
async function run(mode,productId='pubg_mobile'){
 const supplier=epinbyProduct({provider:'epinby',productId:90,type:'TOPUP',gameId:7,categoryId:8,fields});
 const p={id:productId,plans:[{id:'epinby_90',supplier}]},calls=[];
 const transport=async input=>{
  calls.push(input);assert.equal(input.key,'private');assert(!/\/order(?:$|\/)/.test(input.path));
  if(input.path.endsWith('/products')){
   if(mode==='network')throw Error('ECONNRESET');
   const page=Number(input.query.page);assert.equal(input.query.game_id,7);assert.equal(input.query.category_id,8);
   if(mode==='bad-page')return {success:true,data:[],meta:{current_page:page,last_page:null}};
   const absent=mode==='missing'||mode==='late'&&page<25;
   return {success:true,data:absent?[]:[{id:90,game_id:mode==='wrong-game'?9:7,category_id:8,type:'TOPUP',fields:mode==='schema'?[...fields,{key:'input_2',label:'Region',required:true}]:fields,supports_player_validation:mode!=='unsupported'}],meta:{current_page:page,last_page:mode==='late'?25:1}};
  }
  assert(input.path.endsWith('/validate-player'));assert.deepEqual(input.body,{product_id:90,player_id:'001',server_id:'0001'});
  if(mode==='invalid')throw Object.assign(Error('bad'),{supplierCode:'PLAYER_NOT_FOUND',supplierStatus:404});
  if(mode==='input')return {success:false,error:{code:'INVALID_INPUT'}};
  if(mode==='lookup-network')throw Error('TIMEOUT');
  return {success:true,data:{nickname_verified:true,player_name:'Synthetic player',...(mode==='mismatch'?{player_id:'999'}:{player_id:'001',server_id:'0001'})}};
 };
 const worker=createEpinbyOrders({security:{decryptSecret:()=> 'private'},transport});
 const result=await worker.check(db,p,p.plans[0],{player_id:'001',server_id:'0001'});checks++;
 return {result,calls,worker,p};
}
for(const game of ['pubg_mobile','free_fire','future_game']){
 const {result}=await run('valid',game);assert.equal(result.state,'verified');assert.equal(result.name,'Synthetic player');assert(result.allowCheckout);
}
const late=await run('late');assert.equal(late.result.state,'verified');assert.equal(late.calls.filter(x=>x.path.endsWith('/products')).length,25);
for(const [mode,state,code] of [['missing','unavailable','EPINBY_PRODUCT_UNAVAILABLE'],['schema','unavailable','EPINBY_SCHEMA_CHANGED'],['wrong-game','unavailable','EPINBY_MAPPING_MISMATCH'],['network','retry','EPINBY_CATALOG_UNAVAILABLE'],['bad-page','retry','EPINBY_CATALOG_UNAVAILABLE'],['input','invalid','EPINBY_PLAYER_INPUT'],['invalid','invalid'],['lookup-network','retry'],['mismatch','retry']]){
 const {result,calls}=await run(mode);assert.equal(result.state,state,mode);assert.equal(result.allowCheckout,false,mode);assert.equal(result.name,undefined,mode);if(code)assert.equal(result.code,code);
 if(['missing','schema','wrong-game','network','bad-page'].includes(mode))assert.equal(calls.filter(x=>x.path.endsWith('/validate-player')).length,0);
}
const optional=await run('unsupported');assert.equal(optional.result.state,'unavailable');assert.equal(optional.result.allowCheckout,true);assert.equal(optional.result.name,undefined);assert.equal(optional.calls.length,1);
const {worker,p}=await run('valid');await assert.rejects(worker.check(db,p,p.plans[0],{player_id:'001'}),/Server/);
await assert.rejects(worker.check(db,p,p.plans[0],{player_id:1,server_id:'0001'}),/düzgün/);
assert.deepEqual(validateEpinbyDetails([{key:'player_id',label:'ID',required:true,maxLength:40}],{player_id:'000000000000000000000000000123'},'pubg_mobile'),{player_id:'000000000000000000000000000123'});
const bounded=epinbyProduct({provider:'epinby',productId:1,type:'TOPUP',fields:[{key:'player_id',label:'ID',required:true,min_length:2,max_length:4}]});
assert.throws(()=>validateEpinbyDetails(bounded.fields,{player_id:'1'}),/ID/);assert.throws(()=>validateEpinbyDetails(bounded.fields,{player_id:'12345'}),/ID/);
assert.equal(validateEpinbyDetails(bounded.fields,{player_id:'001'}).player_id,'001');
console.log('PASS',checks,'supplier checks; package vs player errors, page 25, exact game/region, dynamic fields, string/leading-zero IDs, missing server, unsupported validation, no order or balance writes');
