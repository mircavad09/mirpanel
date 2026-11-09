import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {shopFixture} from './shop-test-fixture.mjs';
import {adminDelivery,ownerCodes} from '../mirpanel-admin/community/order-delivery.mjs';
import {createAccountOrders} from '../mirpanel-admin/account-orders.mjs';
import {createPaymentSecurity} from '../mirpanel-admin/payment-security.mjs';

process.env.MIRPANEL_CART_V2_TEST='1';
const f=await shopFixture(),{pool,shop,id}=f;
const security=createPaymentSecurity({encryptionKey:crypto.randomBytes(32).toString('base64'),tokenSecret:crypto.randomBytes(32).toString('base64')});
const orders=createAccountOrders({security,store:{},resolve:async user=>({userId:user,codes:code=>ownerCodes(pool,user,code)})});
const copyData=new Map(),fixtures=[];
const names=['Uzun sınaq otağı adı mobil ekranda öz sütununda növbəti sətrə keçir','İkinci sınaq otağı'];
try{
 await pool.query("insert into wallet_accounts(user_id,cents) values('a',10000)");
 for(const [i,productId] of ['netflix','netflix','capcut'].entries()){
  const product=f.catalog.products.find(p=>p.id==='ordinary');
  product.formFields=productId==='netflix'?[{key:'name',label:'Ad',required:true},{key:'code_4',label:'Otaq kodu',digits:4,required:true}]:[];
  const item={productId:'ordinary',planIndex:0,quantity:1,details:productId==='netflix'?{name:'Müştəri '+i,code_4:i===0?'0408':'0021'}:{}};
  const quote=await shop.quote({user:'a'},[item],'a'.repeat(64));
  item.termsVersion=quote.items[0].termsVersion;
  const order=await shop.checkout({user:'a'},'a'.repeat(64),{items:[item],mode:'wallet',requestId:id(),consentAccepted:true});
  const {rows:[saved]}=await pool.query('select checkout_snapshot from payment_orders where id=$1',[order.orderId]);
  const line=saved.checkout_snapshot.items[0];
  line.productId=productId;
  if(productId==='netflix')line.detailsCipher=security.encryptSecret(JSON.stringify(item.details));
  await pool.query('update payment_orders set checkout_snapshot=$2 where id=$1',[order.orderId,saved.checkout_snapshot]);
  const preview=await adminDelivery(pool,security,'test',order.orderId,null);
  const room=productId==='netflix'?{roomName:names[i],roomCode:i===0?'0408':'0007'}:{};
  assert.deepEqual(preview.lines[0].netflixRoom,productId==='netflix'?{name:'Müştəri '+i,code:i===0?'0408':'0021'}:undefined);
  const payload={requestId:id(),line:0,quantity:1,message:productId==='netflix'?'Netflix hesabına giriş təlimatı\n1. Netflix-i açın.\n2. E-poçt və şifrəni daxil edin.\n3. Sizə ayrılmış otağı seçin.':'CapCut Pro hesabına giriş təlimatı\n1. CapCut tətbiqini açın.',email:'account'+i+'@example.test',password:'Synthetic-'+i,...room};
  await adminDelivery(pool,security,'test',order.orderId,payload);
  assert.equal((await adminDelivery(pool,security,'test',order.orderId,payload)).replayed,true);
  if(productId==='netflix')await assert.rejects(adminDelivery(pool,security,'test',order.orderId,{...payload,roomCode:'1111'}),{status:409});
  await assert.rejects(orders.codes('b',payload.requestId),{status:404});
  const data=await orders.codes('a',payload.requestId);
  assert.deepEqual(data.netflixRoom,productId==='netflix'?{name:room.roomName,code:room.roomCode}:undefined);
  copyData.set(payload.requestId,data);
  const title=productId==='netflix'?'Netflix Şəxsi':'CapCut Pro';
  fixtures.push({id:order.orderId,orderCode:order.orderCode,product:title,status:'completed',amount:5,
   createdAt:new Date().toISOString(),items:[{productId,title,planName:'1 aylıq',quantity:1,unitCents:500}],
   deliveries:[{id:payload.requestId,line:0,quantity:1}]});
 }
}finally{await f.close();}

const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT);
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_CHROME});
const live=process.argv.includes('--live'),origin=live?'https://mirpanel.com':'http://mirpanel.test';
const output=path.resolve('../../'+(live?'outputs/netflix-delivery':'work/netflix-preview'));
await fs.mkdir(output,{recursive:true});
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  await context.addInitScript(()=>{
   window.clipboardWrites=[];
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>window.clipboardWrites.push(value),write:async ([item])=>window.clipboardWrites.push(await (await item.getType('text/plain')).text())}});
  });
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url()),p=u.pathname;
   if(u.origin!==origin)return route.abort();
   if(p==='/api/payments/my-orders')return route.fulfill({json:{accountId:'synthetic',orders:fixtures,nextCursor:null}});
   if(p.startsWith('/api/payments/my-orders/codes/'))return route.fulfill({json:copyData.get(p.split('/').at(-1))});
   if(p.startsWith('/api/'))return route.fulfill({json:{}});
   if(p==='/profil')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/browser-orders.css?v=netflix-room-1"><body style="background:#0e1113;color:#fff"><main class="account-panel" style="max-width:960px;margin:16px auto;font:14px system-ui,sans-serif"><h1>Sifarişlərim · Sınaq məlumatı</h1><div id="browserOrders"></div><p id="browserOrdersError" hidden></p><button id="browserOrdersMore" hidden>Daha çox</button><dialog id="browserReceipt"><button id="browserReceiptClose">Bağla</button><div id="browserReceiptContent"></div></dialog></main><script src="/browser-orders.js?v=netflix-room-1"></script></body></html>'});
   if(live)return route.continue();
   if(['/browser-orders.js','/browser-orders.css'].includes(p))return route.fulfill({body:await fs.readFile(p.slice(1)),contentType:p.endsWith('.css')?'text/css':'text/javascript'});
   return route.fulfill({status:404});
  });
  const page=await context.newPage();
  await page.goto(origin+'/profil?tab=orders');
  page.setDefaultTimeout(10000);
  for(const [i,fixture] of fixtures.entries()){
   const order=page.locator('[data-order-id="'+fixture.id+'"]');
   if(await order.getAttribute('open')===null)await order.locator('summary').click();
   const box=order.locator('[data-delivery]');
   const data=copyData.get(fixture.deliveries[0].id);
   await box.getByText(data.email,{exact:true}).waitFor();
   assert.deepEqual(await box.locator('[data-copy-delivery-field]').evaluateAll(nodes=>nodes.map(n=>n.dataset.copyDeliveryField)),['email','password']);
   const room=box.locator('.browser-netflix-room');
   if(i<2){
    assert.deepEqual(await room.locator('strong').allTextContents(),[data.netflixRoom.name,data.netflixRoom.code]);
    const cells=await room.locator(':scope > div').evaluateAll(nodes=>nodes.map(n=>({left:n.offsetLeft,top:n.offsetTop,right:n.offsetLeft+n.offsetWidth})));
    assert.ok(cells[0].right<=cells[1].left&&cells[0].top===cells[1].top);
   }else assert.equal(await room.count(),0);
   await box.locator('[data-copy-delivery-field=email]').click();
   await box.locator('[data-copy-delivery-field=password]').click();
   await box.locator('[data-copy-delivery]').click();
   await page.waitForFunction(()=>window.clipboardWrites.length===3);
   const copied=await page.evaluate(()=>window.clipboardWrites.splice(0));
   assert.deepEqual(copied,[data.email,data.password,'E-poçt: '+data.email+'\nŞifrə: '+data.password+'\n\n'+data.text]);
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(output,width===390?'netflix-mobil.png':'netflix-komputer.png'),fullPage:true});
  console.log('PASS '+width+'px: two Netflix orders, 0408/0007, field and full copying, CapCut control');
  await context.close();
 }
}finally{await browser.close();}
