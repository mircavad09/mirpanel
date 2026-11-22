// Isolated PostgreSQL + synthetic provider only. Never uses a real supplier key.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {createShop} from '../mirpanel-admin/shop.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';
import {createEpinbyOrders} from '../mirpanel-admin/epinby-orders.mjs';
import {epinbyProduct} from '../epinby-product.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const manifest=JSON.parse(fs.readFileSync('catalog/five-games-20261122.json','utf8'));
const drafts=extractAdminState(fs.readFileSync('app.js','utf8')).products.filter(p=>manifest.products.some(d=>d.id===p.id));
const fixture=await shopFixture(),{pool,db,catalog,id,rpc}=fixture;
const config={encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')},security=createPaymentSecurity(config);
const selected=drafts.map(p=>({p,c:manifest.packages.find(c=>c.productId===p.id&&c.targetPrice!=null)||manifest.packages.find(c=>c.productId===p.id)}));
let sends=0,mode='available';const supplierOrders=new Map();
const transport=async req=>{
 assert.equal(req.key,'isolated-five-games');
 if(req.path.endsWith('/products')){
  if(mode==='network')throw Error('SYNTHETIC_NETWORK_FAILURE');
  const rows=selected.filter(({c})=>!req.query?.game_id||c.gameId===req.query.game_id).map(({c})=>({
   id:c.supplierProductId,name:c.name,game_id:c.gameId,category_id:c.categoryId,type:c.type,fields:c.fields,
   price:'0.10',currency:'USD',stock_status:mode==='out'?'FINITE':'INFINITE',stock_count:mode==='out'?0:null,supports_player_validation:false,
  }));
  return {success:true,data:rows,meta:{current_page:1,last_page:1,total:rows.length}};
 }
 if(req.path.endsWith('/order')){
  assert.equal(req.idempotencyHeader,'X-Idempotency-Key');
  assert.equal(req.body.player_id,'000123456');
  const c=selected.find(({c})=>c.supplierProductId===req.body.product_id)?.c;assert(c);
  assert.equal(req.body.server_id,c.fields.some(f=>f.key==='server_id')?'0001':undefined);
  sends++;const result={order_id:90000+sends,client_order_id:req.reference,product_id:c.supplierProductId,status:'COMPLETED',price:'0.10',currency:'USD'};
  supplierOrders.set(req.reference,result);
  throw Error('SYNTHETIC_LOST_RESPONSE');
 }
 if(req.path.endsWith('/orders'))return {success:true,data:[...supplierOrders.values()]};
 if(/\/order\/\d+$/.test(req.path))return {success:true,data:[...supplierOrders.values()].find(x=>String(x.order_id)===req.path.split('/').at(-1))};
 throw Error('Unexpected synthetic endpoint '+req.path);
};
const shop=createShop({context:async req=>({pool,user:req.user}),catalog:async()=>catalog,snapshot:()=>rpc('inventory_snapshot'),store:fixture.store,config,epinbyTransport:transport});
const worker=()=>createEpinbyOrders({pool:async()=>pool,security,loadCatalog:async()=>catalog,callbackUrl:'https://synthetic.invalid/webhook',transport});
try{
 for(const file of ['product-sales-delivery.sql','product-sales-baselines.sql'])await db.exec(db.read('mirpanel-admin/community/'+file));
 for(const file of ['202611090901_api_integrations','202611090902_api_integration_drafts','202611090903_epinby_connection','202611110002_epinby_execution','202611160020_epinby_finance'])await db.exec(db.read('supabase/migrations/'+file+'.sql'));
 await db.exec(db.read('supabase/migrations/202611090911_fulfillment_cancellation.sql'));
 await db.exec(db.read('mirpanel-admin/community/ready-stock-migration.sql'));
 await db.exec(db.read('mirpanel-admin/community/ready-stock-product-messages-migration.sql'));
 await pool.query("update epinby_connection set api_key_cipher=$1,webhook_secret_cipher=$2,last_status='confirmed',currency='USD'",[security.encryptSecret('isolated-five-games'),security.encryptSecret('synthetic-webhook')]);
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',100000)");
 catalog.products.push(...structuredClone(drafts));
 for(const {p} of selected)await assert.rejects(shop.quote({user:'a'},[{productId:p.id,planIndex:0,quantity:1}]),{status:409});
 // Three games have no approved sale price; synthetic 1 AZN fixture prices stay
 // exclusively in memory and are never persisted to the real catalog.
 for(const {p,c} of selected){
  const target=catalog.products.find(x=>x.id===p.id);target.active=true;
  target.plans=[{id:'epinby_'+c.supplierProductId,label:c.name,price:1,active:true,
   supplier:epinbyProduct({provider:'epinby',productId:c.supplierProductId,type:c.type,gameId:c.gameId,categoryId:c.categoryId,fields:c.fields})}];
 }
 await worker().synchronize(pool);
 const buy=async(p,c,requestId,quantity=1)=>{
  const details={player_id:'000123456',...(c.fields.some(f=>f.key==='server_id')?{server_id:'0001'}:{})};
  const item={productId:p.id,planIndex:0,quantity,details};
  const q=await shop.quote({user:'a'},[item],'a'.repeat(64));
  return shop.checkout({user:'a'},'a'.repeat(64),{mode:'wallet',items:[{...item,termsVersion:q.items[0].termsVersion}],requestId,consentAccepted:true});
 };
 const initial=Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents);
 const first=selected[0];
 for(const failure of ['out','network']){mode=failure;await assert.rejects(buy(first.p,first.c,id()));}
 assert.equal(sends,0);assert.equal(Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents),initial);
 mode='available';const orders=[];
 for(const [i,{p,c}] of selected.entries()){
  const key=id(),quantity=i===0?2:1;
  const [one,two]=await Promise.all([buy(p,c,key,quantity),buy(p,c,key,quantity)]);
  assert.equal(one.orderId,two.orderId);orders.push({orderId:one.orderId,quantity,product:p.id});
 }
 assert.equal(sends,0,'checkout does not send an unprocessed supplier order');
 for(let i=0;i<24;i++){
  await pool.query("update epinby_order_units set next_at=next_at-interval '61 seconds'");
  await Promise.all([worker().drain(),worker().drain()]);
 }
 assert.equal(sends,6,'five products/six units each submitted once despite response loss and worker recreation');
 for(const order of orders){
  const deliveries=await pool.query('select count(*)::int n from customer_order_deliveries where order_id=$1',[order.orderId]);
  const units=(await pool.query('select u.state,u.reason from epinby_order_units u join api_dispatches d on d.id=u.dispatch_id where d.order_id=$1',[order.orderId])).rows;
  assert.equal(deliveries.rows[0].n,order.quantity,order.product+' '+JSON.stringify(units));
  assert.equal((await pool.query('select user_id from community_order_owners where order_id=$1',[order.orderId])).rows[0].user_id,'a');
  const snapshot=(await pool.query('select checkout_snapshot from public.payment_orders where id=$1',[order.orderId])).rows[0].checkout_snapshot;
  assert.equal(snapshot.items[0].productId,order.product);
 }
 assert.equal(Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents),initial-600);
 console.log('PASS five-game isolated orders: inactive drafts denied; package/ID/server/leading zeroes; stock out/network no debit; per-customer history; six units; duplicate checkout; parallel workers; lost response/restart without duplicate purchase or wallet debit. All provider responses synthetic.');
}finally{await fixture.close();}
