import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
const f=await shopFixture(),{shop,pool}=f;
try{
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',1234),('b',5678)");
 assert.deepEqual(await shop.wallet({user:'a'},{summary:'1'}),{accountId:'a',cents:1234});
 assert.deepEqual(await shop.wallet({user:'b'},{summary:'1'}),{accountId:'b',cents:5678});
 await assert.rejects(shop.wallet({},{summary:'1'}),e=>e.status===401);
 const history=await shop.wallet({user:'a'});assert.equal(history.cents,1234);assert.deepEqual(history.items,[]);assert.deepEqual(history.topups,[]);
 await pool.query('update wallet_release set enabled=false where id');
 await assert.rejects(shop.wallet({user:'a'},{summary:'1'}),e=>e.status===503);
 console.log('PASS wallet summary: server-authenticated owner, balance, guest denial, release gate; history unchanged. Synthetic PostgreSQL only.');
}finally{await f.close();}
