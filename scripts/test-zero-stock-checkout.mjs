import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {termsInfo} from '../mirpanel-admin/cart-drafts.mjs';
import {inventoryAvailability} from '../inventory-availability.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,shop,catalog,rpc,id}=f;
const p=catalog.products.find(p=>p.id==='finite'),item={productId:p.id,planIndex:0,quantity:1},owner='a'.repeat(64),user={user:'a'};
const snapshot=async()=>(await rpc('inventory_snapshot')).find(r=>r.productId===p.id);
const set=async n=>rpc('inventory_set_nullable_quantity',[p.id,n,'synthetic',id(),(await snapshot())?.version??0,null]);
try{
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',10000) on conflict(user_id) do update set cents=10000");
 const draft=await shop.saveDraft(user,owner,{id:id(),productId:p.id,planIndex:0,values:{},termsVersion:termsInfo(p,p.plans[0],0).termsVersion});
 const accepted={...item,draftId:draft.draftId};
 const balance=async()=>Number((await pool.query("select cents from wallet_accounts where user_id='a'")).rows[0].cents);
 const initial=await balance();
 for(const n of [null,0,3,0,null]){
  await set(n);const row=await snapshot(),state=inventoryAvailability(p,row);
  assert.equal(row.unlimited,n===null);assert.equal(row.available,n);
  assert.equal(state.plans[0].canOrder,n!==0);
  const q=await shop.quote(user,[accepted],owner);
  assert.equal(q.items[0].available,n);
  if(n===0){
   await assert.rejects(()=>shop.checkout(user,owner,{items:[accepted],mode:'wallet',requestId:id(),consentAccepted:true}),/stok|Stok/);
   assert.equal(await balance(),initial);
  }
 }
 await set(0);
 assert.equal(Number((await pool.query('select count(*) n from public.payment_orders')).rows[0].n),0);
 assert.equal(await balance(),initial);
 console.log(JSON.stringify({sequence:['empty',0,3,0,'empty'],persisted:true,quote:true,oldDraftBlockedAtZero:true,zeroOrders:true,balanceUnchanged:true,syntheticOnly:true}));
}finally{await f.close();}
