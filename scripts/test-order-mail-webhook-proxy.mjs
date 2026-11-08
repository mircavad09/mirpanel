import assert from 'node:assert/strict';
import {proxyCommunity} from '../functions/_owner-community.js';

const path='/api/community/order-mail-webhook';
const raw=' {"type":"email.delivered","data":{"subject":"Sifarişiniz təsdiqləndi"}}\n';
const signed={'svix-id':'msg_Synthetic','svix-timestamp':'1234567890','svix-signature':'v1,example='};
const headers={...signed,Cookie:'mirpanel_owner.session_token=synthetic','Content-Type':'application/json'};
const fetcher=globalThis.fetch;
try{
 globalThis.fetch=async(url,options)=>{
  const webhook=url.endsWith(path);
  for(const [key,value] of Object.entries(signed))assert.equal(options.headers.get(key),webhook?value:null);
  assert.equal(options.headers.get('Cookie'),webhook?null:'mirpanel_owner.session_token=synthetic');
  assert.equal(await new Response(options.body).text(),raw);
  return Response.json({ok:true});
 };
 for(const route of [path,'/api/community/messages']){
  const res=await proxyCommunity({request:new Request('https://mirpanel.com'+route,{method:'POST',body:raw,headers})});
  assert.equal(res.status,200);
 }
 console.log('Webhook proxy preserves signed bytes and limits signature headers to the callback.');
}finally{globalThis.fetch=fetcher;}
