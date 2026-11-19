import assert from 'node:assert/strict';
import {previewOwner,startGooglePreview,googlePreviewRef,googlePreviewHTML} from '../mirpanel-admin/epoint-preview.mjs';
import {shopFixture} from './shop-test-fixture.mjs';
await assert.rejects(previewOwner({checkoutAccount:async()=>null},{}),{status:401});
await assert.rejects(previewOwner({checkoutAccount:async()=>'b',verifiedOwnerId:async()=>'a'},{}),{status:403});
assert.equal(await previewOwner({checkoutAccount:async()=>'a',verifiedOwnerId:async()=>'a'},{}),'a');
await assert.rejects(startGooglePreview(null,'a',{method:'m10',amount:1}),{status:400});
await assert.rejects(startGooglePreview(null,'a',{method:'google-pay',amount:2}),{status:400});
await assert.rejects(startGooglePreview(null,'a',{method:'google-pay',amount:1,requestId:googlePreviewRef('b')}),{status:400});
assert(googlePreviewHTML.includes('Ödənişi təsdiqləməyin'));
const f=await shopFixture();
try{
 const env={EPOINT_PUBLIC_KEY:'synthetic',EPOINT_PRIVATE_KEY:'synthetic-private',EPOINT_GOOGLE_PAY_ENABLED:'false',EPOINT_TOKEN_WIDGET_ENABLED:'false'};
 let calls=0;
 const send=async(url,o)=>{calls++;assert.equal(url,'https://epoint.az/api/1/token/widget');const p=JSON.parse(Buffer.from(o.body.get('data'),'base64'));assert.equal(p.amount,1);assert.equal(p.order_id,'mp_ep_'+googlePreviewRef('a'));return Response.json({status:'success',widget_url:'https://epoint.az/api/1/token/widget/test'});};
 const body={method:'google-pay',amount:1,requestId:googlePreviewRef('a')};
 assert.equal((await startGooglePreview(f.pool,'a',body,{env,send})).state,'ready');
 assert.equal((await startGooglePreview(f.pool,'a',body,{env,send})).state,'ready');
 assert.equal(calls,1);assert.equal(env.EPOINT_GOOGLE_PAY_ENABLED,'false');
 assert.equal((await f.pool.query("select count(*)::int n from mirpanel_community.wallet_ledger where kind='topup_credit'")).rows[0].n,0);
 console.log('PASS owner-only preview, anonymous/non-owner denial, fixed 1 AZN and method, one upstream creation on repeat, global gates unchanged, no credit');
}finally{await f.close();}
