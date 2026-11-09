import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture();
const {pool,shop,rpc,method,id}=f,owner='a'.repeat(64),buyer={user:'a'};
const eq=assert.deepEqual,reject=assert.rejects;
try{
 const save=async productId=>{
  const line={productId,planIndex:0,quantity:1};
  const q=await shop.quote(buyer,[line],owner);
  const draft=await shop.saveDraft(buyer,owner,{id:id(),productId,planIndex:0,termsVersion:q.items[0].termsVersion,values:{}});
  return {...line,draftId:draft.draftId,lineId:draft.lineId,termsVersion:draft.termsVersion};
 };
 const ordinary=await save('ordinary'),unlimited=await save('unlimited');
 const args={mode:'card',methodId:method,consentAccepted:true};
 const receipt={mimeType:'image/png',size:3,sha256:crypto.createHash('sha256').update('abc').digest('hex')};
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',2000)");
 const migration=f.db.read('supabase/migrations/202611090902_product_sale_overrides.sql');
 await f.db.exec(migration);await f.db.exec(migration);
 const beforeOrders=(await pool.query('select count(*)::int n from payment_orders')).rows[0].n;
 const beforeBalance=(await pool.query("select cents::text from wallet_accounts where user_id='a'")).rows[0].cents;
 const warm=await shop.checkout(buyer,owner,{...args,requestId:id(),items:[ordinary,unlimited]});
 const warmReceipt={...receipt,path:'cart/'+warm.id+'/synthetic.png'};
 f.files.set(warmReceipt.path,Buffer.from('abc'));
 await shop.savedReceipt(buyer,owner,'cart',warm.id,warmReceipt);
 await rpc('inventory_set_sale_paused',['unlimited',true]);
 const paused=await shop.quote(buyer,[ordinary,unlimited],owner);
 eq(paused.items.map(x=>[x.salesDisabled,x.available]),[[false,null],[true,0]]);
 await reject(shop.checkout(buyer,owner,{mode:'wallet',requestId:id(),consentAccepted:true,items:[ordinary,unlimited]}),e=>e.status===409&&/stokda yoxdur/.test(e.message));
 await reject(shop.submit(buyer,owner,warm.id),/PRODUCT_SALE_PAUSED/);
 eq((await pool.query('select count(*)::int n from payment_orders')).rows[0].n,beforeOrders);
 eq((await pool.query("select cents::text from wallet_accounts where user_id='a'")).rows[0].cents,beforeBalance);
 await rpc('inventory_set_sale_paused',['unlimited',false]);
 eq((await shop.submit(buyer,owner,warm.id)).items.length,2);
 await rpc('inventory_set_sale_paused',['unlimited',true]);
 const pausedStock=(await rpc('inventory_snapshot')).find(x=>x.productId==='unlimited');
 eq([pausedStock.salePaused,pausedStock.unlimited,pausedStock.available],[true,true,null]);
 await rpc('inventory_set_sale_paused',['unlimited',false]);
 const reopened=(await rpc('inventory_snapshot')).find(x=>x.productId==='unlimited');
 eq([reopened.salePaused,reopened.unlimited,reopened.available],[false,true,null]);
 console.log(JSON.stringify({ok:true,staleCardCheckoutBlocked:true,pausedWalletNotDebited:true,unlimitedPreserved:true,productionWrites:0}));
}finally{await f.close();}
