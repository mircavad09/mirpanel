import assert from 'node:assert/strict';
import fs from 'node:fs';
import {onRequest as cartShell} from '../functions/sebet.js';
import {onRequest as clientAsset} from '../functions/community-assets/[[path]].js';
import {handlePublicCommunity} from '../mirpanel-admin/community/public-service.mjs';

const header=fs.readFileSync('customer-header.html','utf8');
const read=async req=>{
 assert.equal(new URL(req.url).pathname,'/customer-header.html');
 assert.equal(req.headers.has('Cookie'),false);
 return new Response(header,{headers:{'Content-Type':'text/html; charset=utf-8'}});
};
const cart=await cartShell({request:new Request('https://mirpanel.com/sebet',{headers:{Cookie:'mirpanel_owner.session_token=synthetic'}}),next:read});
assert.equal(cart.status,200);
assert.match(cart.headers.get('Server-Timing'),/cart-shell/);
assert.match(cart.headers.get('Cache-Control'),/no-store/);
assert.match(await cart.text(),/<main id="shopApp" class="shop-page"><\/main>/);
const wrongOrigin=await cartShell({request:new Request('https://mirpanel.com/sebet',{headers:{Origin:'https://other.invalid'}}),next:()=>assert.fail('must not serve shell')});
assert.equal(wrongOrigin.status,403);
for(const filename of ['shop-ui.js','topup-amount.js','wallet-topup.js']){
 const asset=await clientAsset({request:new Request('https://mirpanel.com/community-assets/'+filename+'?v=synthetic',{headers:{Cookie:'private=synthetic'}}),env:{ASSETS:{fetch:async request=>{
  assert.equal(new URL(request.url).pathname,'/mirpanel-admin/community/public/'+filename);
  assert.equal(request.headers.has('Cookie'),false);
  return new Response('/* public browser code */',{headers:{'Content-Type':'text/javascript'}});
 }}}});
 assert.equal(asset.status,200);
 assert.equal(await asset.text(),'/* public browser code */');
}

let countCalls=0,reads=0,profileReads=0,blocked=false,released=true,activeUser=null;
async function state(mode){
 const u=new URL('https://mirpanel.com/api/community/state?group='+mode),req={method:'GET',headers:{}};
 const runtime={
  pool:{async query(sql){
   if(sql.includes('public_community_release'))return {rows:[{ready:released}]};
   if(sql.includes('select blocked'))return {rows:[{blocked}]};
   if(sql.includes('with members')){countCalls++;return {rows:[{members:7,online:1}]};}
   throw Error('Unexpected query');
  }},
  auth:{api:{getSession:async()=>activeUser?{user:activeUser}:null}},
  repo:{config:async()=>({tiers:[]}),messages:async()=>{reads++;return {items:[{id:'1',body:'Synthetic message'}]};},profile:async()=>{profileReads++;return null;}},
  group:{settings:async()=>({muted:false})}
 };
 let result;
 await handlePublicCommunity({req,res:{setHeader(){}},u,origin:u.origin,runtime,json:(_res,code,body)=>{assert.equal(code,200);result=body;}});
 return result;
}
const first=await state('messages');
assert.equal(first.initialMessages.items[0].body,'Synthetic message');
assert.equal(countCalls,0);
assert.equal(first.counts,undefined);
assert.equal((await state('1')).counts.members,7);
assert.equal(countCalls,1);
activeUser={id:'blocked-synthetic'};blocked=true;
await assert.rejects(state('messages'),{status:403});
assert.equal(profileReads,0);
assert.equal(reads,2);
released=false;activeUser=null;
await assert.rejects(state('messages'),{status:503});
assert.equal(reads,2);
console.log('PASS: cart shell excludes credentials; initial messages do not wait for counts; legacy counts, ban and release gates preserved');
