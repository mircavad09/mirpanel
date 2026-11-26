import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {currentDocumentPolicy,buildOrderDocument} from '../mirpanel-admin/order-document.mjs';
import {checkoutConsentVersion,checkoutConsentStatement} from '../mirpanel-admin/community/public/checkout-consent.js';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,shop,id}=f;let checks=0;
try{
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',5000)");
 const owner='a'.repeat(64),quote=await shop.quote({user:'a'},[{productId:'ordinary',planIndex:0,quantity:1}],owner);
 const body={items:[{productId:'ordinary',planIndex:0,quantity:1,termsVersion:quote.items[0].termsVersion}],mode:'wallet',consentAccepted:true,documentPolicyVersion:currentDocumentPolicy().version,requestId:id(),expectedTotalCents:500};
 const legacy=await shop.checkout({user:'a'},owner,body),old=(await pool.query('select checkout_snapshot from payment_orders where id=$1',[legacy.orderId])).rows[0].checkout_snapshot;
 const next={...body,requestId:id(),checkoutConsentVersion};
 for(const patch of [{consentAccepted:false},{checkoutConsentVersion:'stale-consent'},{documentPolicyVersion:'stale-policy'}]){await assert.rejects(shop.checkout({user:'a'},owner,{...next,...patch}),e=>[400,409].includes(e.status));checks++;}
 assert.equal(Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents),4500);checks++;
 const result=await shop.checkout({user:'a'},owner,next),repeat=await shop.checkout({user:'a'},owner,next);assert.equal(result.id,repeat.id);checks++;
 const order=(await pool.query('select * from payment_orders where id=$1',[result.orderId])).rows[0],consent=order.checkout_snapshot.orderConsent;
 assert.equal(consent.statementVersion,checkoutConsentVersion);assert.equal(consent.statement,checkoutConsentStatement);assert.equal(consent.immediateExecutionConsent,true);assert.ok(Number.isFinite(Date.parse(consent.acceptedAt)));checks+=4;
 const document=buildOrderDocument(order);assert.equal(document.consentVersion,checkoutConsentVersion);assert.ok(document.sections.some(s=>s.paragraphs.includes(checkoutConsentStatement)));checks+=2;
 assert.deepEqual((await pool.query('select checkout_snapshot from payment_orders where id=$1',[legacy.orderId])).rows[0].checkout_snapshot,old);checks++;
 assert.equal(Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents),4000);checks++;
 assert.equal((await pool.query("select count(*)::int n from wallet_ledger where request_id=$1 and kind='purchase_debit'",[result.id])).rows[0].n,1);checks++;
 console.log(JSON.stringify({checks,newConsentRecorded:true,legacyUnchanged:true,staleRejected:true,realPayments:0,realOrders:0}));
}finally{await f.close();}
