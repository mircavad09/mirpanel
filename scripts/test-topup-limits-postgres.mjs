import assert from 'node:assert/strict';import {shopFixture} from './shop-test-fixture.mjs';
const f=await shopFixture(),{shop,pool,id,method}=f,a={user:'a'};let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{for(const amount of ['0','0.99','500.01','-1','5.123','5,123','1e2','']){await assert.rejects(shop.topup(a,{amount,methodId:method,requestId:id()}),e=>e.status===400);checks++;}
 eq((await pool.query('select count(*)::int n from wallet_topups')).rows[0].n,0);
 for(const [amount,cents]of [['1',100],['500',50000],['12,34',1234],['0'.repeat(3)+'5.01',501]]){const requestId=id(),args={amount,methodId:method,requestId},r=await shop.topup(a,args),again=await shop.topup(a,{...args,amount:amount.replace(',','.')});eq(r.id,again.id);eq(Number((await pool.query('select requested_cents from wallet_topups where id=$1',[r.id])).rows[0].requested_cents),cents);}
 eq((await pool.query('select count(*)::int n from wallet_topups')).rows[0].n,4);eq((await shop.wallet(a)).cents,0);eq((await pool.query('select count(*)::int n from wallet_ledger')).rows[0].n,0);eq((await pool.query('select count(*)::int n from payment_orders')).rows[0].n,0);
 await assert.rejects(shop.topup({},{amount:'5',methodId:method,requestId:id()}),e=>e.status===401);checks++;
 console.log(JSON.stringify({checks,realPostgreSQL:true,productionWrites:0,balanceCredits:0,orders:0}));
}finally{await f.close();}
