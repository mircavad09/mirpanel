import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';
import {extractAdminState,patchAppSource,normalizeAdminPayload} from '../mirpanel-admin/core.mjs';
import {onRequest as proxy} from '../functions/api/payments/[[path]].js';
const source=fs.readFileSync('app.js','utf8'),catalog=extractAdminState(source);
const product=catalog.products.find(p=>p.id==='capcut');
const phone=product.plans[0],other=product.plans[1];
phone.label='Sınaq Telefon';other.label='Sınaq kompüter';
const step=(n)=>({image:'/uploads/synthetic-'+n+'.png',description:'Sınaq addımı '+n});
product.orderGuide={information:'Ümumi sınaq qaydası',tracks:{general:[step(0)],desktopQr:[step(4)]}};
phone.orderGuide={information:'Telefon sınağı',tracks:{phone:[step(2),step(1)],desktopQr:[step(4)]}};
other.orderGuide={tracks:{desktopQr:[step(3)],phone:[{image:'javascript:alert(1)',description:'Invalid'}]}};
const normalized=normalizeAdminPayload(catalog);
const saved=extractAdminState(patchAppSource(source,normalized));
const guide= saved.products.find(p=>p.id==='capcut');
assert.equal(guide.orderGuide.tracks.desktopQr,undefined);
assert.deepEqual(JSON.parse(JSON.stringify(guide.plans[0].orderGuide.tracks.phone)),[step(2),step(1)]);
assert.equal(guide.plans[1].orderGuide.tracks.phone,undefined);
const id='12345678-1234-4234-8234-000000000001',o={id,status:'completed',receipt_path:'private/receipt',receipt_mime:'image/png',checkout_snapshot:{cartVersion:2,items:[phone,other].map((p,i)=>({productId:'capcut',title:'Synthetic',planName:p.label,sourcePlanKey:String(i),quantity:1,unitCents:500}))}};
const service=createAccountOrders({
 security:{decryptSecret:()=>JSON.stringify({id:'unit',order:id,line:0,message:'synthetic delivery'})},
 store:{signedReceipt:async()=> 'https://synthetic.supabase.co/short-lived'},
 resolve:async req=>req.user&&{userId:req.user,owned:async key=>req.user==='owner'&&key===id?o:null,catalog:async()=>saved,codes:async()=>req.user==='owner'?[{id:'unit',order_id:id,line_index:0,message_cipher:'fixture'}]:[]}
});
const owner={user:'owner'},stranger={user:'stranger'};
const a=await service.guide(owner,id,'0');assert.equal(a.information,'Telefon sınağı');assert.equal(a.tracks.desktopQr,undefined);
assert.equal((await service.guide(owner,id,'1')).tracks.desktopQr[0].description,'Sınaq addımı 3');
await assert.rejects(service.guide(owner,id,'2'),{status:404});
await assert.rejects(service.guide({},id,'0'),{status:401});
await assert.rejects(service.guide(stranger,id,'0'),{status:404});
await assert.rejects(service.codes(stranger,'unit'),{status:404});
await assert.rejects(service.receipt(stranger,id),{status:404});
assert.equal((await service.codes(owner,'unit')).text,'synthetic delivery');
assert.equal((await service.receipt(owner,id)).expiresIn,60);
const savedFetch=globalThis.fetch;
try{
 globalThis.fetch=async(url,options)=>{
  assert.equal(url.pathname,'/api/payments/my-orders/'+id+'/guide/0');
  assert.equal(options.headers.get('Cookie'),'mirpanel_owner.session_token=synthetic');
  return Response.json(a);
 };
 const result=await proxy({request:new Request('https://mirpanel.com/api/payments/my-orders/'+id+'/guide/0',{headers:{Cookie:'mirpanel_owner.session_token=synthetic; mirpanel_session=admin'}})});
 assert.equal(result.status,200);assert.match(result.headers.get('Cache-Control'),/no-store/);
}finally{globalThis.fetch=savedFetch;}
console.log('PASS: order guide catalog round-trip and track restrictions; order ownership protects guide, delivery and receipt; no production writes');
