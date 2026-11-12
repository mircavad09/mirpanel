import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {createShop} from '../mirpanel-admin/shop.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {createEpinbyOrders,verifyEpinbyWebhook} from '../mirpanel-admin/epinby-orders.mjs';
import {createEpinbyConnection} from '../mirpanel-admin/epinby-connection.mjs';
import {epinbyProduct} from '../epinby-product.mjs';
import {ownerCodes} from '../mirpanel-admin/community/order-delivery.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,db,catalog,id,rpc}=f;
const config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')},security=createPaymentSecurity(config);
let nameMode='verified',mode='success',lookupMode='found',starsCreates=0,creates=0,external=700,failPage=false,catCalls=[];const supplierOrders=new Map();
const fields=[{key:'player_id',label:'Player ID',required:true},{key:'server_id',label:'Server',required:false}];
const product={id:'epinby_91',title:'Synthetic game',active:true,plans:[{label:'60 UC',price:3.49}],formFields:fields,
 supplier:epinbyProduct({provider:'epinby',productId:91,type:'TOPUP',fields},'epinby_91')};catalog.products.push(product);
catalog.products.push({id:'synthetic_game_group',title:'Synthetic grouped game',active:true,plans:[{label:'Other package',price:2},{id:'epinby_92',label:'Gift code',price:5,supplier:epinbyProduct({provider:'epinby',productId:92,type:'VOUCHER',fields:[]},'epinby_92')}]});
const pubg={id:'pubg_mobile',title:'PUBG Mobile',active:true,plans:[{id:'epinby_93',label:'60 UC',price:3.49,supplier:{provider:'epinby',productId:93,type:'TOPUP',fields:[fields[0]]}}]};
const free={id:'free_fire',title:'Free Fire',active:true,plans:[{id:'epinby_94',label:'100 Diamonds',price:2.50,supplier:{provider:'epinby',productId:94,type:'TOPUP',fields}}]};
const stars={id:'telegram_premium',title:'Telegram Premium',active:true,plans:[{id:'epinby_95',label:'100 Stars',price:2.49,supplier:{provider:'epinby',productId:95,type:'TELEGRAM_STARS',starsAmount:100}}]};
const transport=async input=>{
 assert.equal(input.key,'synthetic-key');assert.equal(input.authHeader,'X-API-Key');
 if(input.path.endsWith('/getMe'))return {success:true,data:{currency:'USD',balance:'100'}};
 if(input.path.endsWith('/games')){assert.equal(input.maxResponseBytes,524288);catCalls.push('games');return {success:true,data:[{id:4,name:'Test game'}]};}
 if(input.path.endsWith('/categories'))return {success:true,data:[{id:7,name:'Packs'}]};
 if(input.path.endsWith('/products')){
  catCalls.push(input.query);if(failPage&&Number(input.query.page)===2)throw Error('NETWORK');
  if(input.query.game_id===100)return {success:true,data:[
   {id:93,type:'TOPUP',fields:[fields[0]],supports_player_validation:true,stock_status:'INFINITE'},
   {id:94,type:'TOPUP',fields,supports_player_validation:true,stock_status:'INFINITE'}
  ],meta:{current_page:1,last_page:1}};
  return {success:true,data:[{id:91,name:'60 UC',price:'1.00',stock_status:'INFINITE',type:'TOPUP',fields},{id:92,name:'Gift code',price:'2.00',stock_status:'FINITE',stock_count:10,type:'VOUCHER',fields:[]}],meta:{current_page:Number(input.query.page)||1,last_page:122,total:6086}};
 }
 if(input.path.endsWith('/validate-player')&&input.body.product_id===91){
  assert.deepEqual(input.body,{product_id:91,player_id:'000123',server_id:'0001'});
  if(nameMode==='unavailable')throw Error('NETWORK');
  return {success:true,data:{player_name:'Synthetic player',nickname_verified:nameMode==='verified'}};
 }
 if(input.path.endsWith('/validate-player')){
  assert.ok([93,94].includes(input.body.product_id));
  assert.equal(input.body.player_id,'000123');
  if(input.body.product_id===94)assert.equal(input.body.server_id,'0001');
  if(lookupMode==='missing')throw Object.assign(Error('not found'),{supplierStatus:404,supplierCode:'PLAYER_NOT_FOUND'});
  if(lookupMode==='offline')throw Error('NETWORK');
  if(lookupMode==='subscription')throw Object.assign(Error('requires subscription'),{supplierStatus:403,supplierCode:'SUBSCRIPTION_REQUIRED'});
  return {success:true,data:{nickname_verified:true,player_name:'Synthetic Player'}};
 }
 if(input.path.endsWith('/telegram-stars/recipient')){
  assert.deepEqual(input.body,{telegram_username:'@synthetic_player'});
  if(lookupMode==='missing')return {success:false,error:{code:'RECIPIENT_NOT_FOUND'}};
  return {success:true,data:{recipient:{username:'synthetic_player',first_name:'Synthetic Telegram'}}};
 }
 if(input.path.endsWith('/telegram-stars/config'))return {success:true,data:{enabled:true,service_online:true,custom_amount_enabled:true,min_stars:50,max_stars:10000}};
 if(input.path.endsWith('/telegram-stars/quote')){
  assert.deepEqual(input.body,{stars_amount:100});
  return {success:true,data:{stars_amount:100}};
 }
 if(input.path.endsWith('/telegram-stars/order')){
  assert.deepEqual(input.body,{stars_amount:100,telegram_username:'@synthetic_player'});
  assert.equal(input.idempotencyHeader,'X-Idempotency-Key');assert(input.reference);
  if(!supplierOrders.has(input.reference)){
   starsCreates++;
   supplierOrders.set(input.reference,{order_id:++external,client_order_id:input.reference,status:'COMPLETED'});
   throw Error('Lost Stars response');
  }
  return {success:true,data:supplierOrders.get(input.reference)};
 }
 if(input.path.endsWith('/order')){
  creates++;assert.equal(input.idempotencyHeader,'X-Idempotency-Key');assert.equal(input.body.qty,1);
  if(input.body.product_id===91){assert.equal(input.body.player_id,'000123');assert.equal(input.body.server_id,'0001');}else assert.equal(input.body.player_id,undefined);
  if(mode==='reject')return {success:false,error:{code:'INSUFFICIENT_FUNDS'}};
  const data={order_id:++external,client_order_id:input.reference,product_id:input.body.product_id,status:mode==='pending'?'PENDING':'COMPLETED',...(input.body.product_id===92?{delivery:['SYNTHETIC-CODE-'+input.reference]}:{})};supplierOrders.set(input.reference,data);
  if(mode==='unknown'){supplierOrders.delete(input.reference);throw Error('ECONNRESET');}
  if(mode==='lost')throw Error('ECONNRESET');return {success:true,data};
 }
 if(input.path.endsWith('/orders'))return {success:true,data:[...supplierOrders.values()]};
 if(/\/order\/\d+$/.test(input.path))return {success:true,data:[...supplierOrders.values()].find(x=>String(x.order_id)===input.path.split('/').at(-1))};
 throw Error('UNEXPECTED_ENDPOINT');
};
const makeWorker=()=>createEpinbyOrders({pool:async()=>pool,security,loadCatalog:async()=>catalog,callbackUrl:'https://test.invalid/api/webhooks/epinby',transport});
const shop=createShop({context:async req=>({pool,user:req.user}),catalog:async()=>catalog,snapshot:()=>rpc('inventory_snapshot'),store:f.store,config,epinbyTransport:transport});
const items=[{productId:product.id,quantity:1,planIndex:0,details:{player_id:'000123',server_id:'0001'}}];
const buy=async(requestId=id(),chosen=items)=>{const quote=await shop.quote({user:'a'},chosen,'a'.repeat(64));return shop.checkout({user:'a'},'a'.repeat(64),{mode:'wallet',items:chosen.map((x,i)=>({...x,termsVersion:quote.items[i].termsVersion})),requestId,consentAccepted:true});};
const tick=async(worker,n=1)=>{for(let i=0;i<n;i++){await pool.query("update epinby_order_units set next_at=next_at-interval '61 seconds'");await worker.drain();}};
try{
 for(const file of ['202611090901_api_integrations','202611090902_api_integration_drafts','202611090903_epinby_connection','202611110002_epinby_execution'])await db.exec(db.read('supabase/migrations/'+file+'.sql'));
 await db.exec(db.read('mirpanel-admin/community/ready-stock-migration.sql'));
 await db.exec(db.read('supabase/migrations/202611090911_fulfillment_cancellation.sql'));
 await pool.query("update epinby_connection set api_key_cipher=$1,webhook_secret_cipher=$2,last_status='confirmed',currency='USD'",[security.encryptSecret('synthetic-key'),security.encryptSecret('synthetic-webhook')]);
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',100000),('b',0)");
 let worker=makeWorker();await worker.synchronize(pool);
 const api=createEpinbyConnection({pool:async()=>pool,security,transport});
 const games=await api({action:'epinby-catalog',gamesOnly:true});assert.equal(games.games.length,1);assert.deepEqual(catCalls,['games']);
 const page=await api({action:'epinby-catalog',page:1,gameId:4,categoryId:7});assert.equal(page.products.length,2);assert.equal(page.meta.lastPage,122);assert.equal(page.complete,false);assert.equal(catCalls.at(-1).category_id,7);
 failPage=true;assert((await api({action:'epinby-catalog',page:2})).error);assert.equal(page.products.length,2);failPage=false;
 const [{gameTerms,termsVersion}]=(await shop.quote({},items)).items;
 assert.equal(gameTerms.rules.length,6);
 const lookup={productId:product.id,planIndex:0,values:items[0].details,termsVersion};
 assert.deepEqual(await shop.playerName({},lookup),{verified:true,name:'Synthetic player'});
 for(const state of ['unverified','unavailable']){nameMode=state;assert.deepEqual(await shop.playerName({},lookup),{verified:false});}
 await assert.rejects(shop.playerName({}, {...lookup,termsVersion:'expired'}),{status:409});
 await assert.rejects(shop.playerName({}, {...lookup,values:{player_id:'000123',password:'blocked'}}),{status:400});
 const [voucherQuote]=(await shop.quote({},[{productId:'synthetic_game_group',planIndex:1,quantity:1}])).items;
 assert.equal(voucherQuote.gameTerms,undefined);
 await assert.rejects(shop.playerName({}, {...lookup,productId:voucherQuote.productId,planIndex:1,termsVersion:voucherQuote.termsVersion}),{status:409});
 assert.equal(creates,0);
 const requestId=id(),before=Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents);
 const [bought,replayed]=await Promise.all([buy(requestId),buy(requestId)]);assert.equal(bought.orderId,replayed.orderId);
 assert.equal(Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents),before-349);
 await Promise.all([worker.drain(),makeWorker().drain()]);await tick(worker,3);assert.equal(creates,1);
 let deliveries=(await pool.query('select * from customer_order_deliveries where order_id=$1',[bought.orderId])).rows;assert.equal(deliveries.length,1);
 assert.equal((await ownerCodes(pool,'b',deliveries[0].id)).length,0);
 mode='lost';const lost=await buy();await tick(worker);const lostCreates=creates;worker=makeWorker();await tick(worker,3);assert.equal(creates,lostCreates);assert.equal((await pool.query('select count(*)::int n from customer_order_deliveries where order_id=$1',[lost.orderId])).rows[0].n,1);
 mode='pending';const pending=await buy();await tick(worker);
 const unit=(await pool.query('select u.* from epinby_order_units u join api_dispatches d on d.id=u.dispatch_id where d.order_id=$1',[pending.orderId])).rows[0];
 const data={...supplierOrders.get(unit.id),status:'COMPLETED',event_id:id(),timestamp:new Date().toISOString()};
 const raw=Buffer.from(JSON.stringify(data)),headers={'x-gamex-event-id':data.event_id,'x-gamex-timestamp':data.timestamp,'x-gamex-signature':'sha256='+crypto.createHmac('sha256','synthetic-webhook').update(raw).digest('hex')};
 assert.throws(()=>verifyEpinbyWebhook(raw,{...headers,'x-gamex-signature':'sha256='+'0'.repeat(64)},'synthetic-webhook'),{status:401});
 await Promise.all([worker.webhook(raw,headers),worker.webhook(raw,headers)]);await tick(worker,2);
 assert.equal((await pool.query('select count(*)::int n from epinby_events')).rows[0].n,1);
 assert.equal((await pool.query('select count(*)::int n from customer_order_deliveries where order_id=$1',[pending.orderId])).rows[0].n,1);
 await worker.webhook(raw,headers);await tick(worker);assert.equal((await pool.query('select count(*)::int n from customer_order_deliveries where order_id=$1',[pending.orderId])).rows[0].n,1);
 mode='reject';const rejected=await buy();await tick(worker,2);assert.equal((await pool.query('select state from api_dispatches where order_id=$1',[rejected.orderId])).rows[0].state,'failed');
 assert.equal((await pool.query('select count(*)::int n from customer_order_deliveries where order_id=$1',[rejected.orderId])).rows[0].n,0);
 mode='unknown';const unknown=await buy();await tick(worker);const sent=creates;await tick(makeWorker(),3);assert.equal(creates,sent);assert.equal((await pool.query('select state from api_dispatches where order_id=$1',[unknown.orderId])).rows[0].state,'checking');
 // Insufficient customer funds must neither charge nor enqueue a supplier order.
 const quote=await shop.quote({user:'b'},items,'b'.repeat(64));
 await assert.rejects(shop.checkout({user:'b'},'b'.repeat(64),{mode:'wallet',items:items.map((x,i)=>({...x,termsVersion:quote.items[i].termsVersion})),requestId:id(),consentAccepted:true}));
 assert.equal(Number((await pool.query("select cents from wallet_accounts where user_id='b'")).rows[0].cents),0);
 mode='success';
 const twoItems=[{...items[0],quantity:2,termsVersion:(await shop.quote({user:'a'},items,'a'.repeat(64))).items[0].termsVersion}];
 const multi=await shop.checkout({user:'a'},'a'.repeat(64),{mode:'wallet',items:twoItems,requestId:id(),consentAccepted:true});
 await tick(worker,12);assert.equal((await pool.query('select count(*)::int n from customer_order_deliveries where order_id=$1',[multi.orderId])).rows[0].n,2);
 const beforeGrouped=Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents);
 const voucher=await buy(id(),[{productId:'synthetic_game_group',planIndex:1,quantity:1}]);await tick(worker,8);
 assert.equal(Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents),beforeGrouped-500);
 const code=(await pool.query('select id from customer_order_deliveries where order_id=$1',[voucher.orderId])).rows[0];
 assert(code);assert(security.decryptSecret((await ownerCodes(pool,'a',code.id))[0].message_cipher).includes('SYNTHETIC-CODE'));assert.equal((await ownerCodes(pool,'b',code.id)).length,0);
 const mails=(await pool.query('select event_key,count(*)::int n from customer_order_mail group by event_key')).rows;assert(mails.every(x=>x.n===1));
 pubg.plans[0].supplier.gameId=100;free.plans[0].supplier.gameId=100;
 catalog.products.push(pubg,free,stars);
 const verify=async(product,values)=>{
  const selection={productId:product.id,planIndex:0};
  const q=(await shop.quote({user:'a'},[{...selection,quantity:1}])).items[0];
  assert.equal(q.accountCheck,true);
  return shop.checkEpinbyAccount({user:'a'},{...selection,termsVersion:q.termsVersion,values});
 };
 const player={player_id:'000123'},freePlayer={...player,server_id:'0001'},telegram={telegram_username:'@synthetic_player'};
 assert.equal((await verify(pubg,player)).name,'Synthetic Player');
 assert.equal((await verify(free,freePlayer)).name,'Synthetic Player');
 assert.equal((await verify(stars,telegram)).name,'Synthetic Telegram');
 await assert.rejects(verify(pubg,{player_id:'words'}),{status:400});
 lookupMode='missing';
 assert.equal((await verify(pubg,player)).state,'invalid');
 assert.equal((await verify(stars,telegram)).state,'invalid');
 const beforeInvalid=Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents);
 const starsLine={productId:stars.id,planIndex:0,quantity:1,details:telegram};
 await assert.rejects(buy(id(),[starsLine]),{status:409});
 assert.equal(Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents),beforeInvalid);
 lookupMode='offline';assert.equal((await verify(free,freePlayer)).state,'retry');
 lookupMode='subscription';const unavailable=await verify(free,freePlayer);
 assert.equal(unavailable.state,'unavailable');assert.equal(unavailable.allowCheckout,true);assert.equal(unavailable.name,undefined);
 lookupMode='found';
 const starOrder=await buy(id(),[starsLine]);await tick(worker,12);
 assert.equal(starsCreates,1);
 assert.equal(Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents),beforeInvalid-249);
 assert.equal((await pool.query('select count(*)::int n from customer_order_deliveries where order_id=$1',[starOrder.orderId])).rows[0].n,1);
 console.log('PASS: Epinby account checks, unavailable/retry, invalid Stars no debit, Stars dedicated idempotent fulfillment.');
 console.log('PASS: separate games; >40 pages; page failure; dynamic fields/leading zeros; wallet replay; parallel worker; lost response/restart without repurchase; signed duplicate webhook; provider rejection; private delivery; mail idempotence. No real supplier order.');
}finally{await f.close();}
