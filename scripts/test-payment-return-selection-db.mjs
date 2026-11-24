import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';import {createShop} from '../mirpanel-admin/shop.mjs';
import {startEpointCheckout,requireResolvedEpoint} from '../mirpanel-admin/epoint-checkout.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const env={EPOINT_PRODUCT_CARD_ENABLED:'true',EPOINT_CHECKOUT_ENABLED:'true',EPOINT_PUBLIC_KEY:'synthetic',EPOINT_PRIVATE_KEY:'synthetic',EPOINT_TOKEN_WIDGET_ENABLED:'true',EPOINT_APPLE_DOMAIN_VERIFIED:'true',EPOINT_APPLE_PAY_ENABLED:'true',EPOINT_GOOGLE_PAY_ENABLED:'true',EPOINT_BIRBANK_ENABLED:'true',EPOINT_M10_ENABLED:'true',EPOINT_PRODUCT_PURCHASES_ENABLED:'true'};Object.assign(process.env,env);
const config={epointProductPaymentsEnabled:true,encryptionKey:randomBytes(32).toString('base64'),tokenSecret:randomBytes(32).toString('base64')};
const f=await shopFixture({paymentConfig:config}),{pool,id}=f,owner='a'.repeat(64),req={user:'a'};let creates=0,checks=0,states=new Map(),outage=false;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const send=async(url,options)=>{if(outage)throw Error('Synthetic connection failure');const p=JSON.parse(Buffer.from(options.body.get('data'),'base64'));if(url.endsWith('wallet/status'))return Response.json({'9':'m10','10':'Birbank'});const ref=p.order_id?.slice(6)||p.transaction?.slice(3);if(url.endsWith('get-status')){const s=states.get(ref)||'new';return Response.json({transaction:'tx_'+ref,order_id:'mp_ep_'+ref,status:s,code:s==='success'?'000':s==='error'?'canceled':s==='failed'?'005':null,amount:5,currency:'AZN'});}creates++;states.set(ref,'new');return Response.json({status:'success',transaction:'tx_'+ref,widget_url:'https://epoint.az/test',redirect_url:'https://epoint.az/test',payment:{merchant_order_id:p.order_id,total:5,transaction:'tx_'+ref,widget_url:'https://epoint.az/test'}});};
const shop=createShop({context:async r=>({pool,user:r.user}),catalog:async()=>f.catalog,snapshot:()=>f.rpc('inventory_snapshot'),store:f.store,config,epointTransport:send});
try{
 const q=await shop.quote(req,[{productId:'ordinary',planIndex:0,quantity:1}],owner),item={productId:'ordinary',planIndex:0,quantity:1,termsVersion:q.items[0].termsVersion};
 for(const method of ['card','apple-pay','google-pay','birbank','m10']){
  const g=await shop.checkout(req,owner,{items:[item],mode:'epoint',epointMethod:method,requestId:id(),expectedTotalCents:500,consentAccepted:true});
  await startEpointCheckout(pool,'a',{requestId:g.id,method},{env,send,purchaseId:g.id});
  const before=creates,r=await shop.paymentSelection(req,owner,g.id);eq(r.status,'pending');eq(r.items,[item]);eq(r.quote.balanceCents,0);eq(r.consentAccepted,true);eq(creates,before);
  await assert.rejects(shop.paymentSelection({user:'b'},owner,g.id),e=>e.status===404);checks++;
  await assert.rejects(requireResolvedEpoint(pool,'a',g.id,{env,send}),e=>e.code==='PAYMENT_PREVIOUS_PENDING');checks++;
  outage=true;await assert.rejects(requireResolvedEpoint(pool,'a',g.id,{env,send}),e=>e.code==='PAYMENT_PREVIOUS_PENDING');checks++;outage=false;
  states.set(g.id,'failed');await requireResolvedEpoint(pool,'a',g.id,{env,send});eq((await shop.paymentSelection(req,owner,g.id)).status,'failed');
  f.catalog.products[0].plans[0].price=5.5;eq((await shop.paymentSelection(req,owner,g.id)).consentAccepted,false);f.catalog.products[0].plans[0].price=5;
 }
 const old=await shop.checkout(req,owner,{items:[item],mode:'epoint',epointMethod:'card',requestId:id(),expectedTotalCents:500,consentAccepted:true});await startEpointCheckout(pool,'a',{requestId:old.id,method:'card'},{env,send,purchaseId:old.id});
 await assert.rejects(shop.startProductPayment(req,owner,{items:[item],epointMethod:'birbank',requestId:id(),consentAccepted:true,expectedTotalCents:500,previousPayment:old.id}),e=>e.code==='PAYMENT_PREVIOUS_PENDING');checks++;
 states.set(old.id,'failed');const again={items:[item],epointMethod:'birbank',requestId:id(),consentAccepted:true,expectedTotalCents:500,previousPayment:old.id},priorCreates=creates;
 const renewed=await shop.startProductPayment(req,owner,again);eq(creates,priorCreates+1);const repeated=await shop.startProductPayment(req,owner,{...again,requestId:id()});eq(renewed.id,repeated.id);eq(creates,priorCreates+1);
 states.set(renewed.id,'success');await assert.rejects(requireResolvedEpoint(pool,'a',renewed.id,{env,send}),e=>e.code==='PAYMENT_ALREADY_PAID');checks++;
 f.catalog.products[0].formFields=[{key:'email',label:'Hesabın e-poçtu',type:'email',required:true},{key:'password',label:'Hesabın şifrəsi',type:'password',required:true}];
 const fq=await shop.quote(req,[{productId:'ordinary',planIndex:0,quantity:1}],owner),draft=await shop.saveDraft(req,owner,{id:id(),productId:'ordinary',planIndex:0,termsVersion:fq.items[0].termsVersion,values:{email:'synthetic@example.test',password:'TEST-PRIVATE-ONLY'}});
 const secretItem={productId:'ordinary',planIndex:0,quantity:2,draftId:draft.draftId,lineId:draft.lineId,termsVersion:draft.termsVersion},sg=await shop.checkout(req,owner,{items:[secretItem],mode:'epoint',epointMethod:'card',requestId:id(),expectedTotalCents:1000,consentAccepted:true});
 await startEpointCheckout(pool,'a',{requestId:sg.id,method:'card'},{env,send,purchaseId:sg.id});const restored=await shop.paymentSelection(req,owner,sg.id);eq(restored.items[0].draftId,draft.draftId);eq(restored.items[0].quantity,2);eq(JSON.stringify(restored).includes('TEST-PRIVATE-ONLY'),false);eq((await shop.getDraft(req,owner,draft.draftId)).values.password,'TEST-PRIVATE-ONLY');delete f.catalog.products[0].formFields;
 const top=id();await startEpointCheckout(pool,'a',{requestId:top,amount:'5',method:'birbank'},{env,send});const before=creates;
 await assert.rejects(startEpointCheckout(pool,'a',{requestId:id(),amount:'5',method:'google-pay',previousPayment:top},{env,send}),e=>e.code==='PAYMENT_PREVIOUS_PENDING');eq(creates,before);
 states.set(top,'error');
 const a=id(),b=id(),results=await Promise.allSettled([a,b].map(requestId=>startEpointCheckout(pool,'a',{requestId,amount:'5',method:'google-pay',previousPayment:top},{env,send})));
 eq(results.filter(x=>x.status==='fulfilled').length,1);eq(creates,before+1);eq((await pool.query('select count(*)::int n from epoint_checkout_requests where previous_attempt=$1',[top])).rows[0].n,1);
 const win=results.findIndex(x=>x.status==='fulfilled')===0?a:b;states.set(win,'success');await assert.rejects(requireResolvedEpoint(pool,'a',win,{env,send,purpose:'topup'}),e=>e.code==='PAYMENT_ALREADY_PAID');checks++;
 eq((await pool.query("select count(*)::int n from wallet_ledger where kind='topup_credit'")).rows[0].n,1);
 console.log(JSON.stringify({checks,realPayments:0,realProviderCalls:0,syntheticSuccessCredits:1}));
}finally{await f.close();}
