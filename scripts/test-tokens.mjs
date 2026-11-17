import assert from 'node:assert/strict';import crypto from 'node:crypto';import {shopFixture} from './shop-test-fixture.mjs';
import {Repository} from '../mirpanel-admin/community/repository.mjs';
import {ensureInfluencers,setInfluencer} from '../mirpanel-admin/community/influencers.mjs';
import {ensureTokens,tokenCount,recordTokenPurchase,sendTokenGift,tokenWallet,tokenAdmin} from '../mirpanel-admin/community/tokens.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';const f=await shopFixture(),{pool,shop,id,catalog,rpc}=f,repo=new Repository(pool),actor={id:'owner'},buyer={id:'a',name:'Alıcı',emailVerified:true},owner='a'.repeat(64);
try{
 await ensureInfluencers(pool);await ensureTokens(pool);await ensureTokens(pool);await setInfluencer(repo,actor,{userId:'b',enabled:true});await repo.ensure(buyer);await repo.ensure({id:'b',name:'Influencer'});
 catalog.products.push({id:'mirpanel-token',title:'Mirpanel Token',active:true,image:'/assets/tokens/mirpanel-token.webp',plans:[{label:'50 token',price:1}]});
 await f.db.exec(f.db.read('supabase/migrations/202611090901_api_integrations.sql'));const supplier=id();await pool.query("insert into api_suppliers(id,name,base_url,key_cipher,test_path) values($1,'Synthetic','https://invalid.local','synthetic','/test')",[supplier]);await pool.query("insert into api_mappings values('mirpanel-token','0',$1,'{}',true)",[supplier]);
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',100000)");
 const purchase=async(n,requestId=id())=>{const q=await shop.quote({user:'a'},[{productId:'mirpanel-token',planIndex:0,quantity:1}],owner,null,n);assert.equal(q.totalCents,n*2);const input={mode:'wallet',requestId,consentAccepted:true,tokenCount:n,expectedTotalCents:n*2,items:[{productId:'mirpanel-token',planIndex:0,quantity:1,termsVersion:q.items[0].termsVersion}]};return{input,result:await shop.checkout({user:'a'},owner,input)};};
 for(const n of [null,'55',49,5001,0,-1,50.5,Infinity,NaN])assert.throws(()=>tokenCount(n),{status:400});
 await assert.rejects(shop.quote({user:'a'},[{productId:'mirpanel-token',planIndex:0,quantity:1}],owner),{status:400});
 const first=await purchase(50);assert.equal(first.result.paymentConfirmed,true);assert.equal(first.result.deliveryStatus,'completed');
 const retry=await Promise.all([shop.checkout({user:'a'},'b'.repeat(64),first.input),shop.checkout({user:'a'},owner,first.input)]);assert(retry.every(x=>x.orderId===first.result.orderId));assert.equal((await tokenWallet(pool,'a')).balance,50);
 await pool.query('update payment_orders set payment_confirmed=true where id=$1',[first.result.orderId]);await pool.query('select sync_token_purchase($1)',[first.result.orderId]);assert.equal((await tokenWallet(pool,'a')).balance,50);
 await assert.rejects(shop.checkout({user:'a'},owner,{...first.input,tokenCount:55}),{status:409});
 const fiftyFive=await purchase(55),large=await purchase(5000);assert.equal((await tokenWallet(pool,'a')).balance,5105);
 assert.equal((await pool.query('select count(*)::int n from api_dispatches')).rows[0].n,0);assert.equal((await pool.query('select count(*)::int n from community_order_owners')).rows[0].n,0);
 await assert.rejects(shop.checkout({user:'a'},owner,{...first.input,requestId:id(),expectedTotalCents:1}),{status:409});
 await pool.query("update payment_orders set status='rejected' where id=$1",[large.result.orderId]);await pool.query("update payment_orders set status='rejected' where id=$1",[large.result.orderId]);assert.equal((await tokenWallet(pool,'a')).balance,105);
 // Pending/card confirmation and repeated notices cannot mint early or twice.
 const beforePending=(await tokenWallet(pool,'a')).balance;
 const ordinaryQuote=await shop.quote({user:'a'},[{productId:'ordinary',planIndex:0,quantity:1}],owner);const pending=await shop.checkout({user:'a'},owner,{mode:'card',methodId:f.method,requestId:id(),consentAccepted:true,items:[{productId:'ordinary',planIndex:0,quantity:1,termsVersion:ordinaryQuote.items[0].termsVersion}]});
 const receipt={path:'cart/'+pending.id+'/synthetic.png',mimeType:'image/png',size:3,sha256:crypto.createHash('sha256').update('abc').digest('hex')};f.files.set(receipt.path,Buffer.from('abc'));await shop.savedReceipt({user:'a'},owner,'cart',pending.id,receipt);const submitted=await shop.submit({user:'a'},owner,pending.id);
 await recordTokenPurchase(pool,submitted.orderId,'a',250);assert.equal((await tokenWallet(pool,'a')).balance,beforePending);
 await pool.query('update payment_orders set payment_confirmed=true where id=$1',[submitted.orderId]);await pool.query('update payment_orders set payment_confirmed=true where id=$1',[submitted.orderId]);assert.equal((await tokenWallet(pool,'a')).balance,beforePending+250);
 await f.db.exec(f.db.read('mirpanel-admin/community/tokens.sql'));await pool.query('select sync_token_purchase($1)',[submitted.orderId]);assert.equal((await tokenWallet(pool,'a')).balance,beforePending+250);
 await pool.query("update payment_orders set status='rejected' where id=$1",[submitted.orderId]);assert.equal((await tokenWallet(pool,'a')).balance,beforePending);
 const moneyRow=(await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0];await pool.query("update wallet_accounts set cents=0 where user_id='a'");const purchaseRows=(await pool.query('select count(*)::int n from token_purchases')).rows[0].n;await assert.rejects(purchase(100),/Balans kifayət/);assert.equal((await pool.query('select count(*)::int n from token_purchases')).rows[0].n,purchaseRows);assert.equal((await tokenWallet(pool,'a')).balance,beforePending);await pool.query("update wallet_accounts set cents=$1 where user_id='a'",[moneyRow.cents]);
 const rose={recipientId:'b',kind:'rose',requestId:id()},sent=await Promise.all([sendTokenGift(repo,buyer,rose),sendTokenGift(repo,buyer,rose)]);assert.equal(sent[0].id,sent[1].id);assert.equal((await tokenWallet(pool,'a')).balance,104);
 await sendTokenGift(repo,buyer,{recipientId:'b',kind:'heart',requestId:id()});assert.equal((await tokenWallet(pool,'a')).balance,99);
 const messages=await repo.messages();assert.equal(messages.items.length,2);assert.equal(messages.items[0].tokenGift.kind,'rose');assert.equal(messages.items[1].tokenGift.cost,5);assert.equal(JSON.stringify(messages).includes('balance_after'),false);
 await assert.rejects(sendTokenGift(repo,buyer,{...rose,kind:'heart'}),{status:409});await assert.rejects(sendTokenGift(repo,{...buyer,emailVerified:false},{...rose,requestId:id()}),{status:403});
 // A refund must roll back the money refund too when the purchased tokens have been spent.
 const moneyBefore=(await pool.query("select cents::text from wallet_accounts where user_id='a'")).rows[0].cents;
 await pool.query("update token_accounts set balance=0 where user_id='a'");await assert.rejects(pool.query("update payment_orders set status='rejected' where id=$1",[first.result.orderId]),/İstifadə edilmiş/);assert.equal((await pool.query("select cents::text from wallet_accounts where user_id='a'")).rows[0].cents,moneyBefore);
 await pool.query("update token_accounts set balance=1 where user_id='a'");const last=await Promise.allSettled([sendTokenGift(repo,buyer,{...rose,requestId:id()}),sendTokenGift(repo,buyer,{...rose,requestId:id()})]);assert.equal(last.filter(x=>x.status==='fulfilled').length,1);assert.equal((await tokenWallet(pool,'a')).balance,0);
 const before=(await pool.query('select count(*)::int n from token_gifts')).rows[0].n;await assert.rejects(sendTokenGift(repo,buyer,{recipientId:'b',kind:'heart',requestId:id()}),{status:409});assert.equal((await pool.query('select count(*)::int n from token_gifts')).rows[0].n,before);
 await setInfluencer(repo,actor,{userId:'b',enabled:false});assert.equal((await sendTokenGift(repo,buyer,rose)).id,sent[0].id);await assert.rejects(sendTokenGift(repo,buyer,{...rose,requestId:id()}),{status:409});
 await assert.rejects(tokenAdmin(pool,buyer),{status:403});const stats=await tokenAdmin(pool,actor);assert.equal(stats.totals[0].roses,2);assert.equal(stats.totals[0].hearts,1);assert.equal(stats.totals[0].tokens,'7');
 for(const table of ['token_accounts','token_purchases','token_gifts','token_ledger'])assert.equal((await pool.query("select has_table_privilege('anon',$1,'SELECT') exposed",['mirpanel_community.'+table])).rows[0].exposed,false);
 console.log('PASS tokens isolated: 50/55/5000 arithmetic, invalid counts, one purchase/debit/credit across retries and payment notifications, automatic completion, no fulfillment/provider queue, refund once/spent refund rollback, rose/heart events, parallel last token, revoked recipients, private admin totals.');
}finally{await f.close();}
