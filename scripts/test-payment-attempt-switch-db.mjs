import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';import {createShop} from '../mirpanel-admin/shop.mjs';
import {startEpointCheckout,requireResolvedEpoint,readEpointPayment,leaveEpointPayment} from '../mirpanel-admin/epoint-checkout.mjs';
import {abandonPurchaseAttempt} from '../mirpanel-admin/epoint-attempt-switch.mjs';
import {acceptEpointResult,reconcileEpoint} from '../mirpanel-admin/epoint-reconcile.mjs';
import {drainEpointPurchases} from '../mirpanel-admin/epoint-purchase.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const env={EPOINT_PRODUCT_CARD_ENABLED:'true',EPOINT_CHECKOUT_ENABLED:'true',EPOINT_PUBLIC_KEY:'synthetic',EPOINT_PRIVATE_KEY:'synthetic',EPOINT_TOKEN_WIDGET_ENABLED:'true',EPOINT_APPLE_DOMAIN_VERIFIED:'true',EPOINT_APPLE_PAY_ENABLED:'true',EPOINT_GOOGLE_PAY_ENABLED:'true',EPOINT_BIRBANK_ENABLED:'true',EPOINT_M10_ENABLED:'true',EPOINT_PRODUCT_PURCHASES_ENABLED:'true'};Object.assign(process.env,env);
const config={epointProductPaymentsEnabled:true,encryptionKey:randomBytes(32).toString('base64'),tokenSecret:randomBytes(32).toString('base64')};
const f=await shopFixture({paymentConfig:config}),{pool,id}=f,owner='a'.repeat(64),req={user:'a'};let creates=0,checks=0,states=new Map(),outage=false;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const send=async(url,options)=>{if(outage)throw Error('Synthetic connection failure');const p=JSON.parse(Buffer.from(options.body.get('data'),'base64'));if(url.endsWith('wallet/status'))return Response.json({'9':'m10','10':'Birbank'});const ref=p.order_id?.slice(6)||p.transaction?.slice(3);if(url.endsWith('get-status')){const s=states.get(ref)||'new';return Response.json({transaction:'tx_'+ref,order_id:'mp_ep_'+ref,status:s,code:s==='success'?'000':s==='error'?'canceled':s==='failed'?'005':null,amount:5,currency:'AZN'});}creates++;states.set(ref,'new');return Response.json({status:'success',transaction:'tx_'+ref,widget_url:'https://epoint.az/test',redirect_url:'https://epoint.az/test',payment:{merchant_order_id:p.order_id,total:5,transaction:'tx_'+ref,widget_url:'https://epoint.az/test'}});};
const shop=createShop({context:async r=>({pool,user:r.user}),catalog:async()=>f.catalog,snapshot:()=>f.rpc('inventory_snapshot'),store:f.store,config,epointTransport:send});
try{
 const item={productId:'ordinary',planIndex:0,quantity:1,termsVersion:(await shop.quote(req,[{productId:'ordinary',planIndex:0,quantity:1}],owner)).items[0].termsVersion};
 const body=()=>({items:[item],epointMethod:'apple-pay',requestId:id(),consentAccepted:true,expectedTotalCents:500});
 const make=async(method='birbank',issue=true)=>{const g=await shop.checkout(req,owner,{...body(),mode:'epoint',epointMethod:method});if(issue)await startEpointCheckout(pool,'a',{requestId:g.id,method},{env,send,purchaseId:g.id});return g;};
 const finite={productId:'finite',planIndex:0,quantity:1,termsVersion:(await shop.quote(req,[{productId:'finite',planIndex:0,quantity:1}],owner)).items[0].termsVersion};
 const reserved=await shop.checkout(req,owner,{items:[finite],mode:'epoint',epointMethod:'birbank',requestId:id(),expectedTotalCents:600,consentAccepted:true});
 eq((await shop.quote(req,[finite],owner)).items[0].available,0);await shop.abandonPayment(req,owner,reserved.id);eq((await shop.quote(req,[finite],owner)).items[0].available,1);
 // No provider claim: safe terminal closure, no outbound request, ownership enforced.
 const local=await make('card',false),before=creates;
 await assert.rejects(shop.abandonPayment({user:'b'},owner,local.id),e=>e.status===404);checks++;
 eq((await shop.abandonPayment(req,owner,local.id)).closed,true);eq(creates,before);
 eq((await shop.paymentSelection(req,owner,local.id)).attemptClosed,true);
 // Terminal statuses remain distinct, not inferred from browser back.
 for(const state of ['failed','error','expired','canceled','returned']){const g=await make();states.set(g.id,state);const a=await shop.abandonPayment(req,owner,g.id);eq(a.closed,true);eq((await shop.paymentSelection(req,owner,g.id)).canSwitch,true);}
 // A real open Birbank link: nonfinancial abandonment, preserved provider new.
 const old=await make(),n=creates;eq((await shop.abandonPayment(req,owner,old.id)).closed,false);
 eq((await pool.query('select result_status from epoint_checkout_requests where id=$1',[old.id])).rows[0].result_status,'new');
 await assert.rejects(shop.checkout(req,owner,{...body(),mode:'wallet',previousPayment:old.id}),e=>e.code==='PAYMENT_PREVIOUS_PENDING');checks++;
 const b={...body(),previousPayment:old.id},next=await shop.startProductPayment(req,owner,b);eq(next.method,'apple-pay');eq(creates,n+1);assert.notEqual(next.id,old.id);checks++;
 eq((await pool.query('select attempt_family from epoint_checkout_requests where id=$1',[next.id])).rows[0].attempt_family,old.id);
 eq((await shop.startProductPayment(req,owner,b)).id,next.id);eq(creates,n+1);

 // Closed request IDs cannot reissue a provider link, including a stale tab/API replay.
 const hidden=await readEpointPayment(pool,'a',old.id,{env});eq(hidden.widget,undefined);eq(hidden.redirect,undefined);
 await assert.rejects(startEpointCheckout(pool,'a',{requestId:old.id,method:'birbank'},{env,send,purchaseId:old.id}),e=>e.code==='PAYMENT_ATTEMPT_CLOSED');checks++;
 // Apple → Back → Card and an explicit retry of that same Card method.
 f.catalog.products.push({...f.catalog.products[0],id:'switch-only'});const swap={productId:'switch-only',planIndex:0,quantity:1},sq=await shop.quote(req,[swap],owner);swap.termsVersion=sq.items[0].termsVersion;
 const apple=await shop.checkout(req,owner,{...body(),items:[swap],mode:'epoint',epointMethod:'apple-pay'});await startEpointCheckout(pool,'a',{requestId:apple.id,method:'apple-pay'},{env,send,purchaseId:apple.id});await leaveEpointPayment(pool,'a',apple.id,{env,send});
 eq(!!(await pool.query('select customer_left_at from epoint_checkout_requests where id=$1',[apple.id])).rows[0].customer_left_at,true);
 const card=await shop.startProductPayment(req,owner,{...body(),items:[swap],epointMethod:'card',previousPayment:apple.id});eq(card.method,'card');assert.notEqual(card.id,apple.id);checks++;
 await leaveEpointPayment(pool,'a',card.id,{env,send});
 const again=await shop.startProductPayment(req,owner,{...body(),items:[swap],epointMethod:'card',previousPayment:card.id});eq(again.method,'card');assert.notEqual(again.id,card.id);checks++;
 eq((await pool.query('select attempt_family from epoint_checkout_requests where id=$1',[again.id])).rows[0].attempt_family,apple.id);
 await assert.rejects(startEpointCheckout(pool,'a',{requestId:card.id,method:'card'},{env,send,purchaseId:card.id}),e=>e.code==='PAYMENT_ATTEMPT_CLOSED');checks++;
 // Success arrives late on both attempts, parallel and duplicate callbacks.
 states.set(old.id,'success');states.set(next.id,'success');
 const callback=ref=>acceptEpointResult(pool,{id:ref,status:'success',transaction:'tx_'+ref,cents:500,operationCode:'100'},{env,send});
 await Promise.all([callback(old.id),callback(next.id),callback(old.id)]);
 const excess=(await pool.query('select * from epoint_excess_payments where family_id=$1',[old.id])).rows;eq(excess.length,1);eq(Number(excess[0].cents),500);
 eq((await pool.query('select count(*)::int n from fulfillment_holds where order_id=$1 and released_at is null',[excess[0].order_id])).rows[0].n,1);
 eq((await pool.query("select count(*)::int n from wallet_ledger where kind in ('topup_credit','purchase_debit')")).rows[0].n,0);
 const excessOrder=(await pool.query('select * from payment_orders where id=$1',[excess[0].order_id])).rows[0];eq(excessOrder.checkout_snapshot.epointPayment.excessPayment,true);eq(excessOrder.checkout_snapshot.epointPayment.fulfillmentHold,true);
 await drainEpointPurchases(pool,config);eq((await pool.query('select count(*)::int n from customer_order_deliveries where order_id=$1',[excess[0].order_id])).rows[0].n,0);
 const linked=await readEpointPayment(pool,'a',excess[0].payment_id,{env});eq(linked.orderId,excess[0].winner_order_id);eq(linked.cents,500);
 await callback(next.id);eq((await pool.query('select count(*)::int n from epoint_excess_payments where family_id=$1',[old.id])).rows[0].n,1);
 await assert.rejects(requireResolvedEpoint(pool,'a',old.id,{env,send,allowSwitch:true}),e=>e.code==='PAYMENT_ALREADY_PAID');checks++;
 // Re-instantiating services (restart) preserves every decision in Postgres.
 const fresh=createShop({context:async r=>({pool,user:r.user}),catalog:async()=>f.catalog,snapshot:()=>f.rpc('inventory_snapshot'),store:f.store,config,epointTransport:send});eq((await fresh.paymentSelection(req,owner,old.id)).status,'success');
 await pool.query("update shop_checkouts set created_at=now()-interval '1 minute' where id in (select id from epoint_purchases where paid_at is not null)");
 execFileSync(process.execPath,['scripts/test-payment-attempt-switch-restart.mjs'],{input:JSON.stringify({connection:f.connection,callback:{id:next.id,status:'success',transaction:'tx_'+next.id,cents:500,operationCode:'100'},config}),encoding:'utf8'});eq((await pool.query('select count(*)::int n from epoint_excess_payments where family_id=$1',[old.id])).rows[0].n,1);eq((await pool.query('select count(*)::int n from customer_order_deliveries where order_id=$1',[excess[0].order_id])).rows[0].n,0);
 // Browser with lost return context: explicit different method still links family.
 const lost=await make('card');const switched=await shop.startProductPayment(req,owner,{...body(),epointMethod:'google-pay'});eq(switched.method,'google-pay');eq((await pool.query('select previous_attempt from epoint_checkout_requests where id=$1',[switched.id])).rows[0].previous_attempt,lost.id);
 states.set(lost.id,'failed');states.set(switched.id,'failed');await reconcileEpoint(pool,switched.id,{env,send,user:'a',force:true});
 // Pending lookup outage is not a failure. Mark UI abandoned and allow electronic successor.
 const unknown=await make('card');outage=true;eq((await shop.abandonPayment(req,owner,unknown.id)).closed,false);outage=false;
 const r=await shop.startProductPayment(req,owner,{...body(),previousPayment:unknown.id});eq(r.method,'apple-pay');
 states.set(r.id,'failed');await reconcileEpoint(pool,r.id,{env,send,user:'a',force:true});
 // Two tabs race for the same successor: only one payable request can be issued.
 const two=await make();await shop.abandonPayment(req,owner,two.id);const count=creates;
 const results=await Promise.allSettled([1,2].map(()=>shop.startProductPayment(req,owner,{...body(),previousPayment:two.id})));
 assert.ok(results.some(r=>r.status==='fulfilled'));checks++;eq(creates,count+1);eq((await pool.query('select count(*)::int n from epoint_checkout_requests where previous_attempt=$1',[two.id])).rows[0].n,1);
 // An interrupted API claim is financially unknown, not the no-provider case.
 const creating=await make('card',false);await pool.query("insert into epoint_checkout_requests(id,user_id,cents,method,purpose) values($1,'a',500,'card','purchase')",[creating.id]);
 eq((await shop.abandonPayment(req,owner,creating.id)).closed,false);await assert.rejects(startEpointCheckout(pool,'a',{requestId:creating.id,method:'card'},{env,send,purchaseId:creating.id}),e=>e.code==='PAYMENT_ATTEMPT_CLOSED');checks++;await reconcileEpoint(pool,creating.id,{env,send,user:'a',force:true});eq((await pool.query('select candidate_transaction from epoint_checkout_requests where id=$1',[creating.id])).rows[0].candidate_transaction,'tx_'+creating.id);
 await pool.query("update epoint_checkout_requests set status_checks=20,check_failures=10,next_check_at=now()-interval '1 second' where id=$1",[creating.id]);states.set(creating.id,'failed');await reconcileEpoint(pool,creating.id,{env,send,user:'a'});eq((await pool.query('select result_status from epoint_checkout_requests where id=$1',[creating.id])).rows[0].result_status,'failed');
 // The fulfillment trigger rejects a duplicate even if another delivery caller tries.
 await assert.rejects(pool.query('insert into customer_order_deliveries(order_id,line_index,quantity) values($1,0,1)',[excess[0].order_id]),/FULFILLMENT_ON_HOLD/);checks++;
 // Existing retry chains from older deployments get the same family protection.
 const ancestor=await make('card');states.set(ancestor.id,'failed');await reconcileEpoint(pool,ancestor.id,{env,send,user:'a',force:true});
 const child=await shop.checkout(req,owner,{...body(),mode:'epoint',epointMethod:'birbank',previousPayment:ancestor.id});await startEpointCheckout(pool,'a',{requestId:child.id,method:'birbank',previousPayment:ancestor.id},{env,send,purchaseId:child.id});await pool.query('update epoint_checkout_requests set attempt_family=null where id=any($1::uuid[])',[[ancestor.id,child.id]]);
 await shop.abandonPayment(req,owner,child.id);eq((await pool.query('select attempt_family from epoint_checkout_requests where id=$1',[child.id])).rows[0].attempt_family,ancestor.id);
 states.set(ancestor.id,'success');states.set(child.id,'success');await Promise.all([callback(ancestor.id),callback(child.id)]);eq((await pool.query('select count(*)::int n from epoint_excess_payments where family_id=$1',[ancestor.id])).rows[0].n,1);
 await assert.rejects(shop.startProductPayment(req,owner,{...body(),items:[{...item,quantity:2}],expectedTotalCents:1000,previousPayment:old.id}),/Əvvəlki cəhd bu səbətlə uyğun deyil/);checks++;
 // Credentials stay in existing encrypted drafts; restoring reference never copies raw secrets.
 f.catalog.products[0].formFields=[{key:'email',label:'E-poçt',type:'email',required:true},{key:'password',label:'Şifrə',type:'password',required:true}];
 const fq=await shop.quote(req,[{productId:'ordinary',planIndex:0,quantity:1}],owner),draft=await shop.saveDraft(req,owner,{id:id(),productId:'ordinary',planIndex:0,termsVersion:fq.items[0].termsVersion,values:{email:'synthetic@example.test',password:'SYNTHETIC-ONLY'}});
 const g=await shop.checkout(req,owner,{...body(),items:[{...item,draftId:draft.draftId,lineId:draft.lineId,termsVersion:draft.termsVersion}],mode:'epoint',epointMethod:'card'});await startEpointCheckout(pool,'a',{requestId:g.id,method:'card'},{env,send,purchaseId:g.id});await shop.abandonPayment(req,owner,g.id);
 const selection=await shop.paymentSelection(req,owner,g.id);eq(selection.items[0].draftId,draft.draftId);eq(JSON.stringify(selection).includes('SYNTHETIC-ONLY'),false);f.catalog.products[0].plans[0].price=6;eq((await shop.paymentSelection(req,owner,g.id)).consentAccepted,false);
 console.log(JSON.stringify({checks,creates,realPayments:0,realProviderCalls:0,excessPayments:1,duplicateDelivery:0,balanceWrites:0}));
}finally{await f.close();}
