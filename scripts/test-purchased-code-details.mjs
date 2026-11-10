import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {adminDelivery,ownerCodes,deliveryRecords} from '../mirpanel-admin/community/order-delivery.mjs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,shop,id}=f;
const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
const orders=createAccountOrders({security,store:{},resolve:async user=>({
 userId:user,codes:code=>ownerCodes(pool,user,code),catalog:async()=>f.catalog,
 page:async()=> (await pool.query('select o.* from payment_orders o join community_order_owners l on l.order_id=o.id where l.user_id=$1 order by o.created_at desc,o.id desc limit 21',[user])).rows,
 byCode:async code=>(await pool.query('select o.* from payment_orders o join community_order_owners l on l.order_id=o.id where l.user_id=$1 and o.order_code::text=$2',[user,code])).rows[0],
 deliveries:ids=>deliveryRecords(pool,ids)
})});
const copyData=new Map();
let fixtures;
const names=['Uzun sınaq otağı adı mobil ekranda öz sütununda növbəti sətrə keçir','İkinci sınaq otağı'];
try{
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',10000)");
 let order;
 for(const [i,productId] of ['netflix','netflix','capcut','capcut'].entries()){
  if(i!==1){
   const product=f.catalog.products.find(p=>p.id==='ordinary');
   product.formFields=productId==='netflix'?[{key:'name',label:'Ad',required:true},{key:'code_4',label:'Otaq kodu',digits:4,required:true}]:[];
   const item={productId:'ordinary',planIndex:0,quantity:i===0?2:1,details:productId==='netflix'?{name:'Müştəri '+i,code_4:i===0?'0408':'0021'}:{}};
   const quote=await shop.quote({user:'a'},[item],'a'.repeat(64));
   item.termsVersion=quote.items[0].termsVersion;
   order=await shop.checkout({user:'a'},'a'.repeat(64),{items:[item],mode:'wallet',requestId:id(),consentAccepted:true});
   const {rows:[saved]}=await pool.query('select checkout_snapshot from payment_orders where id=$1',[order.orderId]);
   const line=saved.checkout_snapshot.items[0];
   line.productId=productId;
   line.title=productId==='netflix'?'Netflix Şəxsi':'CapCut Pro';
   if(productId==='netflix')line.detailsCipher=security.encryptSecret(JSON.stringify(item.details));
   await pool.query('update payment_orders set checkout_snapshot=$2 where id=$1',[order.orderId,saved.checkout_snapshot]);
  }
  const preview=await adminDelivery(pool,security,'test',order.orderId,null);
  const room=productId==='netflix'?{roomName:names[i],roomCode:i===0?'0408':'0007'}:{};
  assert.deepEqual(preview.lines[0].netflixRoom,productId==='netflix'?{name:'Müştəri 0',code:'0408'}:undefined);
  const payload={requestId:id(),line:0,quantity:1,message:productId==='netflix'?'Netflix hesabına giriş təlimatı\n1. Netflix-i açın.\n2. E-poçt və şifrəni daxil edin.\n3. Sizə ayrılmış otağı seçin.':'CapCut Pro hesabına giriş təlimatı\n1. CapCut tətbiqini açın.',...(i===3?{}:{email:'account'+i+'@example.test',password:'Synthetic-'+i}),...room};
  await adminDelivery(pool,security,'test',order.orderId,payload);
  assert.equal((await adminDelivery(pool,security,'test',order.orderId,payload)).replayed,true);
  if(productId==='netflix')await assert.rejects(adminDelivery(pool,security,'test',order.orderId,{...payload,roomCode:'1111'}),{status:409});
  await assert.rejects(orders.codes('b',payload.requestId),{status:404});
  const data=await orders.codes('a',payload.requestId);
  assert.deepEqual(data.netflixRoom,productId==='netflix'?{name:room.roomName,code:room.roomCode}:undefined);
  copyData.set(payload.requestId,data);
 }
 fixtures=(await orders.codes('a')).codes;
 assert.equal(fixtures.length,copyData.size);
 assert.deepEqual((await orders.codes('b')).codes,[]);
 const firstPage=await orders.list('a');
 const firstCompleted=firstPage.orders.find(o=>o.status==='completed');
 assert.deepEqual(Object.keys(firstPage.deliveryDetails),firstCompleted.deliveries.map(d=>d.id));
 for(const record of firstCompleted.deliveries)assert.deepEqual(firstPage.deliveryDetails[record.id],copyData.get(record.id));
 const multi=firstPage.orders.find(o=>o.deliveries.length===2);
 const targeted=await orders.list('a',null,String(multi.orderCode));
 assert.equal(Object.keys(targeted.deliveryDetails).length,2);
 for(const record of multi.deliveries)assert.deepEqual(targeted.deliveryDetails[record.id],copyData.get(record.id));
 assert.deepEqual((await orders.list('b')).deliveryDetails,{});
 await assert.rejects(orders.list(null),{status:401});
 console.log('PASS: owned first completed delivery and targeted multi-account preload; guest and other account isolated');
}finally{await f.close();}


if(process.env.MIRPANEL_API_ONLY==='1'||process.argv.includes('--api-only'))process.exit(0);
const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT);
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_CHROME});
const live=process.argv.includes('--live');
const origin=live?'https://mirpanel.com':'http://mirpanel.test';
const output=path.resolve('../../'+(live?'outputs/purchased-code-details':'work/purchased-code-preview'));
await fs.mkdir(output,{recursive:true});
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  await context.addInitScript(()=>{
   window.copied='';
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text;}}});
  });
  const base='/community-assets/account-codes';
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url()),p=url.pathname;
   if(url.origin!==origin)return route.abort();
   if(p==='/api/payments/my-orders/codes')return route.fulfill({json:{accountId:'a',codes:fixtures}});
   if(p.startsWith('/api/payments/my-orders/codes/'))return route.fulfill({json:copyData.get(p.split('/').at(-1))});
   if(p==='/profil')return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="background:#0e1113;color:#fff"><main class="account-panel" style="max-width:960px;margin:16px auto;font:14px system-ui,sans-serif"><p>Sınaq məlumatı</p><section id="content"></section></main><script type="module">
    import {mountCodes} from '${base}.js?v=purchased-code-details-1';
    const el=(tag,attrs={},...children)=>{const n=document.createElement(tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);n.append(...children.filter(x=>x!=null));return n;};
    const button=(text,fn)=>{const n=el('button',{type:'button'},text);n.onclick=fn;return n;};
    mountCodes({content:document.getElementById('content'),el,button});
   </script></body></html>`});
   if(live)return route.continue();
   if(p===base+'.js'||p===base+'.css'){
    return route.fulfill({body:await fs.readFile('mirpanel-admin/community/public/'+p.split('/').at(-1)),
      contentType:p.endsWith('.css')?'text/css':'text/javascript'});
   }
   return route.fulfill({status:404});
  });
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(origin+'/profil?tab=codes');
  const cards=page.locator('.codes-card');
  await cards.nth(3).waitFor();
  for(const [i,fixture] of fixtures.entries()){
   const card=cards.nth(i),data=copyData.get(fixture.id),details=card.locator('.codes-details');
   assert.ok(await details.isHidden());
   assert.equal(await card.locator('.codes-credential').count(),0);
   await card.getByRole('button',{name:'Göstər',exact:true}).click();
   await details.waitFor({state:'visible'});
   assert.deepEqual(await card.locator('.codes-credential strong').allTextContents(),
     [data.email,data.password,data.netflixRoom?.name,data.netflixRoom?.code].filter(Boolean));
   assert.equal(await card.locator('.codes-text').textContent(),data.text);
   await card.getByRole('button',{name:'Kopyala',exact:true}).click();
   await page.waitForFunction(message=>window.copied===message,data.text);
   await card.getByRole('button',{name:'Gizlət',exact:true}).click();
   assert.ok(await details.isHidden());
   assert.equal(await card.locator('.codes-credential').count(),0);
   assert.equal(await card.locator('.codes-text').textContent(),'');
   await card.getByRole('button',{name:'Göstər',exact:true}).click();
   await details.waitFor({state:'visible'});
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(output,width===390?'kodlarim-mobil.png':'kodlarim-komputer.png'),fullPage:true});
  console.log('PASS '+width+'px: isolated credentials, leading zeros, legacy card, reveal, hide and message-only copy.');
  await context.close();
 }
}finally{await browser.close();}
