import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {readyStockOrderItems} from '../mirpanel-admin/community/ready-stock.mjs';
import {Repository} from '../mirpanel-admin/community/repository.mjs';
import {ensureInfluencers,setInfluencer,influencerRecipient,giftAdmin,influencerCatalog} from '../mirpanel-admin/community/influencers.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,shop,catalog,id,rpc}=f,repo=new Repository(pool),owner={id:'owner'},reader={id:'a',name:'Reader A',emailVerified:true},target={id:'b',name:'Reader B',emailVerified:false},token='a'.repeat(64);
try{
 await ensureInfluencers(pool);await ensureInfluencers(pool);await f.db.exec(f.db.read('supabase/migrations/202611090901_api_integrations.sql'));const supplier=id();await pool.query("insert into api_suppliers(id,name,base_url,key_cipher,test_path) values($1,'Synthetic','https://invalid.local','synthetic','/test')",[supplier]);await pool.query("insert into api_mappings(product_id,plan_key,supplier_id,settings,active) values('finite','0',$1,'{}',true)",[supplier]);
 await assert.rejects(setInfluencer(repo,reader,{userId:'b',enabled:true}),{status:403});
 await setInfluencer(repo,owner,{userId:'b',enabled:true});await repo.ensure(target);
 assert.equal((await influencerRecipient(pool,'b')).name,'Reader B');
 const request=id(),body='Nəzarət olunan sınaq\nİkinci sətir 💛';
 const [a,b]=await Promise.all([repo.send(target,body,request,{asActor:owner}),repo.send(target,body,request,{asActor:owner})]);assert.equal(a.id,b.id);
 assert.equal((await pool.query('select count(*)::int n from chat_message_actors')).rows[0].n,1);
 assert.deepEqual((await pool.query('select actor_id,represented_id from chat_message_actors')).rows[0],{actor_id:'owner',represented_id:'b'});
 const messages=await repo.messages();assert.equal(messages.items[0].author.influencer,true);assert.equal(messages.items[0].author.name,'Reader B');assert.equal(JSON.stringify(messages).includes('actor_id'),false);
 await assert.rejects(repo.send(target,'Girişsiz yazı',id()),{status:403});await assert.rejects(repo.send(target,'İcazəsiz yazı',id(),{asActor:reader}),{status:403});
 await assert.rejects(repo.send(target,'Dəyişmiş mətn',request,{asActor:owner}),{status:409});
 await setInfluencer(repo,owner,{userId:'b',enabled:false});
 const changed=await repo.messages({after:a.id,known:a.id});assert.deepEqual(changed.authorFlags,[{user_id:'b',influencer:false}]);
 await assert.rejects(repo.send(target,'Status yoxdur',id(),{asActor:owner}),{status:409});
 await setInfluencer(repo,owner,{userId:'b',enabled:true});
 await repo.moderate(owner,{action:'delete',targetId:a.id,reason:'İzolyasiya edilmiş sınaq',requestId:id()});assert.deepEqual((await repo.messages({known:a.id})).removed,[a.id]);
 const projection=await influencerCatalog(pool,'b',catalog,await rpc('inventory_snapshot'));assert(projection.products.every(x=>!('supplier'in x)));assert.equal(projection.products.length,4);
 catalog.products.find(x=>x.id==='finite').formFields=[{key:'secret',label:'Şifrə',type:'password',required:true}];
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',5000)");
 const q=await shop.quote({user:'a'},[{productId:'finite',planIndex:0,quantity:1}],token,'b');assert.equal(q.items[0].detailsMissing,false);
 const input={giftRecipient:'b',mode:'wallet',requestId:id(),consentAccepted:true,expectedTotalCents:q.totalCents,items:[{productId:'finite',planIndex:0,quantity:1,termsVersion:q.items[0].termsVersion}]};
 const gifts=await Promise.all([shop.checkout({user:'a'},token,input),shop.checkout({user:'a'},'c'.repeat(64),input)]);assert.equal(gifts[0].orderId,gifts[1].orderId);assert.equal(gifts[0].paymentConfirmed,true);
 assert.equal((await pool.query('select count(*)::int n from influencer_gifts')).rows[0].n,1);assert.equal((await pool.query("select count(*)::int n from wallet_ledger where kind='purchase_debit'")).rows[0].n,1);
 assert.equal(Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents),4400);
 assert.equal((await pool.query('select count(*)::int n from community_order_owners')).rows[0].n,0);assert.equal((await pool.query('select count(*)::int n from browser_order_owners')).rows[0].n,0);
 const snap=(await pool.query('select checkout_snapshot from payment_orders where id=$1',[gifts[0].orderId])).rows[0].checkout_snapshot;assert.equal(snap.influencerGift,true);assert.equal(snap.items[0].sourcePlanKey,undefined);assert.equal((await pool.query('select count(*)::int n from api_dispatches')).rows[0].n,0);assert.deepEqual(await readyStockOrderItems(pool,{id:gifts[0].orderId,checkout_snapshot:snap},[]),[]);
 assert.equal((await rpc('inventory_snapshot')).find(x=>x.productId==='finite').available,0);
 await assert.rejects(shop.checkout({user:'a'},token,{...input,giftRecipient:'a'}),{status:409});
 await assert.rejects(shop.checkout({user:'a'},token,{...input,items:[{...input.items[0],productId:'ordinary'}]}),{status:409});
 await assert.rejects(giftAdmin(repo,reader),{status:403});assert.equal((await giftAdmin(repo,owner)).items.length,1);
 const presented=await Promise.all([giftAdmin(repo,owner,{action:'present',orderId:gifts[0].orderId}),giftAdmin(repo,owner,{action:'present',orderId:gifts[0].orderId})]);assert(presented.some(x=>x.idempotent));
 assert.equal((await pool.query("select count(*)::int n from community_audit where action='influencer-gift-presented'")).rows[0].n,1);
 assert.equal((await shop.giftStatus({user:'a'},input.requestId)).paymentConfirmed,true);assert.equal((await shop.giftStatus({user:'b'},input.requestId)).paymentConfirmed,false);await setInfluencer(repo,owner,{userId:'b',enabled:false});assert.equal((await shop.checkout({user:'a'},token,input)).orderId,gifts[0].orderId);
 await assert.rejects(shop.quote({user:'a'},input.items,token,'b'),{status:409});
 // Ordinary purchases retain validation, ownership, stock and wallet behavior.
 const normal=await shop.quote({user:'a'},[{productId:'ordinary',planIndex:0,quantity:1}],token);
 const order=await shop.checkout({user:'a'},token,{mode:'wallet',consentAccepted:true,requestId:id(),items:[{productId:'ordinary',planIndex:0,quantity:1,termsVersion:normal.items[0].termsVersion}]});assert(order.paymentConfirmed);
 assert.equal((await pool.query('select count(*)::int n from community_order_owners')).rows[0].n,1);
 for(const table of ['chat_influencers','chat_message_actors','influencer_gifts']){const permissions=(await pool.query("select has_table_privilege('anon',$1,'SELECT') exposed,has_table_privilege('authenticated',$1,'SELECT') auth_exposed",['mirpanel_community.'+table])).rows[0];assert.deepEqual(permissions,{exposed:false,auth_exposed:false});}
 console.log('PASS isolated live influencers: grant/revoke, owner enforcement, real messages + actor audit, parallel send once, removal, public flags, staged catalog, gift one order/debit across browser tokens, manual gift queue, presentation once, normal purchases preserved.');
}finally{await f.close();}
