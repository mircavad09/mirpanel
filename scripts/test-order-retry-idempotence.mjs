import assert from 'node:assert/strict';import {shopFixture} from './shop-test-fixture.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';const f=await shopFixture(),{pool,shop,catalog,id}=f;const owner='a'.repeat(64),buyer={user:'a'};
try{
 catalog.products.push({id:'spotify',title:'Spotify — sintetik',active:true,plans:[{label:'1 ay',price:5,months:1}],formFields:[{key:'email',label:'E-poçt',type:'email',required:true},{key:'password',label:'Şifrə',type:'password',required:true}]});
 const q=(await shop.quote(buyer,[{productId:'spotify',planIndex:0,quantity:1}],owner)).items[0];assert.equal(q.fields.length,2);
 const input={id:id(),productId:'spotify',planIndex:0,termsVersion:q.termsVersion,values:{email:'numune@example.com',password:'Synthetic-only'}};
 const saved=await shop.saveDraft(buyer,owner,input),retried=await shop.saveDraft(buyer,owner,input);assert.equal(saved.draftId,retried.draftId);assert.deepEqual((await shop.getDraft(buyer,owner,saved.draftId)).values,input.values);
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',2000)");
 const args={items:[{productId:'spotify',planIndex:0,quantity:1,draftId:saved.draftId,lineId:saved.lineId,termsVersion:saved.termsVersion}],mode:'wallet',requestId:id(),consentAccepted:true};
 const [a,b]=await Promise.all([shop.checkout(buyer,owner,args),shop.checkout(buyer,owner,args)]);const c=await shop.checkout(buyer,owner,args);assert.equal(a.orderId,b.orderId);assert.equal(a.orderId,c.orderId);
 assert.equal((await pool.query("select cents::text from wallet_accounts where user_id='a'")).rows[0].cents,'1500');assert.equal((await pool.query("select count(*)::int n from wallet_ledger where user_id='a' and kind='purchase_debit'")).rows[0].n,1);assert.equal((await pool.query('select count(*)::int n from payment_orders')).rows[0].n,1);
 console.log('PASS real PostgreSQL: repeated draft, parallel and repeated checkout; one order, one 5.00 debit, preserved Spotify details. Synthetic only.');
}finally{await f.close();}
