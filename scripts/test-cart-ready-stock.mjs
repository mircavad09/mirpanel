import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {termsInfo} from '../mirpanel-admin/cart-drafts.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const {pool,shop,id,catalog,close}=await shopFixture();
const product=catalog.products.find(p=>p.id==='finite'),plan=product.plans[0];
const ownerA='a'.repeat(64),ownerB='b'.repeat(64),a={user:'a'},b={user:'b'};
const item={productId:product.id,planIndex:0,quantity:1};
const terms=termsInfo(product,plan,0);
try{
 const legacyDraft=await shop.saveDraft(a,ownerA,{
  id:id(),productId:item.productId,planIndex:0,values:{},termsVersion:terms.legacyTermsVersion
 });
 assert.equal(legacyDraft.termsVersion,terms.termsVersion);
 await pool.query('update shop_drafts set terms_version=$2 where id=$1',[legacyDraft.draftId,terms.legacyTermsVersion]);
 const accepted={...item,draftId:legacyDraft.draftId};
 assert.equal((await shop.quote(a,[accepted],ownerA)).items[0].termsMissing,false);
 assert.equal((await shop.getDraft(a,ownerA,legacyDraft.draftId)).termsVersion,terms.termsVersion);
 assert.equal((await shop.quote(b,[accepted],ownerB)).items[0].detailsMissing,true);
 assert.equal((await pool.query('select terms_version from shop_drafts where id=$1',[legacyDraft.draftId])).rows[0].terms_version,terms.termsVersion);
 plan.price=7;
 assert.equal((await shop.quote(a,[accepted],ownerA)).items[0].termsMissing,false);
 plan.terms='Dəyişmiş şərtlər';
 assert.equal((await shop.quote(a,[accepted],ownerA)).items[0].termsMissing,true);
 delete plan.terms;
 for(const req of [a,b])await pool.query("select wallet_credit('owner',$1,1000,'Synthetic credit',$2)",[req.user,id()]);
 const order=items=>({items,mode:'wallet',requestId:id(),consentAccepted:true,expectedTotalCents:700});
 const results=await Promise.allSettled([
  shop.checkout(a,ownerA,order([accepted])),
  shop.checkout(b,ownerB,order([{...item,termsVersion:terms.termsVersion}]))
 ]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 const loser=results.findIndex(result=>result.status==='rejected');
 assert.equal(results[loser].reason.status,409);
 assert.match(results[loser].reason.message,/Synthetic finite stokda yoxdur/);
 const wallets=await Promise.all([shop.wallet(a),shop.wallet(b)]);
 assert.equal(Number(wallets[loser].cents),1000);
 assert.equal(Number(wallets[1-loser].cents),300);
 assert.equal(Number((await pool.query("select count(*) from wallet_ledger where kind='purchase_debit'")).rows[0].count),1);
 console.log('PASS legacy and unchanged terms, changed terms, draft ownership, last-unit race and losing buyer balance');
}finally{await close();}
