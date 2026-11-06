import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {shopFixture} from './shop-test-fixture.mjs';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';
const baseline=process.argv.includes('--baseline'),f=await shopFixture(),{pool,shop,id,method,catalog}=f,owner='d'.repeat(64),guest={};let checks=0,browser,server;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
catalog.products.push({id:'capcut',title:'CapCut Pro',active:true,plans:[{label:'1 aylıq (0–500 AI kredit, Telefon)',price:4.99,formFields:[]}]},{id:'netflix',title:'Netflix Şəxsi',active:true,plans:[{label:'1 aylıq',price:5.99,formFields:[{key:'room',label:'Otaq adı',required:true},{key:'pin',label:'Otaq kodu',digits:4,required:true}]}]},{id:'spotify',title:'Spotify',active:true,formFields:[{key:'email',label:'E-poçt',type:'email',required:true},{key:'password',label:'Şifrə',type:'password',required:true}],plans:[{label:'1 aylıq',price:5}]});
const save=async(productId,values={},draftId=id())=>{const q=await shop.quote(guest,[{productId,planIndex:0,quantity:1}],owner),d=await shop.saveDraft(guest,owner,{id:draftId,productId,planIndex:0,values,termsVersion:q.items[0].termsVersion});return{d,meta:{productId,planIndex:0,quantity:1}};};
try{
 const cap1=await save('capcut'),cap2=await save('capcut'),net=await save('netflix',{room:'Sintetik otaq',pin:'0012'});
 const source=baseline?execFileSync('git',['show','120afc9:cart-store.js'],{encoding:'utf8'}):fs.readFileSync('cart-store.js','utf8');
 server=http.createServer(async(req,res)=>{if(req.url==='/cart-store.js'){res.setHeader('Content-Type','text/javascript');return res.end(source);}if(req.url==='/api/payments/shop/drafts'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(await shop.listDrafts(guest,owner)));}res.setHeader('Content-Type','text/html');res.end('<!doctype html><body>'+(req.url==='/restore'?'':'<script>window.MirpanelCart={open(){}};</script>')+'<script src="/cart-store.js"></script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const ctx=await browser.newContext(),p=await ctx.newPage();await p.goto(origin);
 const commit=async(x,edit=false)=>p.evaluate(({x,edit})=>MirpanelCart.commitDraft(x.d,{...x.meta,edit}),{x,edit});
 await commit(cap1);await commit(cap2);
 if(baseline){eq(await p.evaluate(()=>MirpanelCart.read().length),2);}else{eq(await p.evaluate(()=>MirpanelCart.read().length),1);eq(await p.evaluate(()=>MirpanelCart.read()[0].quantity),2);await commit(cap2);eq(await p.evaluate(()=>MirpanelCart.read()[0].quantity),2);}
 await commit(net);await p.reload();
 const lines=await p.evaluate(()=>MirpanelCart.read());const n=lines.find(x=>x.productId==='netflix');eq((await shop.getDraft(guest,owner,n.draftId)).values.pin,'0012');
 eq(await p.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('0012')),false);
 const checkout=await shop.checkout(guest,owner,{items:lines,mode:'card',methodId:method,requestId:id(),consentAccepted:true});
 const receipt={path:'cart/'+checkout.id+'/synthetic.png',mimeType:'image/png',size:3,sha256:crypto.createHash('sha256').update('abc').digest('hex')};f.files.set(receipt.path,Buffer.from('abc'));await shop.savedReceipt(guest,owner,'cart',checkout.id,receipt);
 const submitted=await shop.submit(guest,owner,checkout.id),message=new URL(submitted.whatsappUrl,'https://synthetic.invalid').searchParams.get('text')||'';
 if(baseline){eq(message.includes('0012'),false);console.log(JSON.stringify({baseline:true,duplicateCartRows:true,whatsappOmittedSavedFields:true,persistenceAlreadyWorks:true,productionWrites:0}));}
 else{
  eq(submitted.items.length,2);eq(message.includes('Otaq kodu: 0012'),true);eq(message.includes('Otaq adı: Sintetik otaq'),true);eq(message.includes('Say: 2 ədəd'),true);eq(message.includes('Məbləğ: 9.98 AZN'),true);eq(message.includes('Ödəniş üsulu: ABB •••• 1234'),true);eq(message.match(/Sifariş nömrəsi:/g)?.length,1);
  const restored=await shop.get(guest,owner,checkout.id);eq(restored.whatsappUrl.startsWith('/api/payments/shop/whatsapp?id='),true);eq(JSON.stringify(restored).includes('0012'),false);eq(new URL(await shop.whatsapp(guest,owner,checkout.id)).searchParams.get('text'),message);
  await assert.rejects(shop.whatsapp(guest,'e'.repeat(64),checkout.id),e=>e.status===404);checks++;
  eq((await pool.query('select count(*)::int n from payment_orders')).rows[0].n,1);eq((await pool.query('select count(*)::int n from payment_reservations where not capacity_shadow')).rows[0].n,1);eq((await pool.query('select count(*)::int n from payment_reservations where capacity_shadow')).rows[0].n,3);
  const snap=(await pool.query('select checkout_snapshot from payment_orders where id=$1',[submitted.orderId])).rows[0].checkout_snapshot;eq(snap.items.find(x=>x.productId==='netflix').fields[1].label,'Otaq kodu');eq(JSON.stringify(snap).includes('0012'),false);
  const other=await save('netflix',{room:'Başqa sintetik otaq',pin:'0099'});await commit(other);eq(await p.evaluate(()=>MirpanelCart.read().filter(x=>x.productId==='netflix').length),2);
  const same=await save('netflix',{room:'Sintetik otaq',pin:'0012'});await commit(same);eq(await p.evaluate(id=>MirpanelCart.read().find(x=>x.draftId===id).quantity,n.draftId),2);
  await assert.rejects(shop.getDraft(guest,'e'.repeat(64),n.draftId),e=>e.status===404);checks++;
  const spot=await save('spotify',{email:'synthetic@example.invalid',password:'Synthetic-only-password'});await commit(spot);const spot2=await save('spotify',{email:'other@example.invalid',password:'Synthetic-only-password'});await commit(spot2);eq(await p.evaluate(()=>MirpanelCart.read().filter(x=>x.productId==='spotify').length),2);
  const edited=await save('netflix',{room:'Dəyişmiş sintetik otaq',pin:'0007'},n.draftId);edited.meta.quantity=2;await commit(edited,true);eq((await shop.getDraft(guest,owner,n.draftId)).values.pin,'0007');eq(await p.evaluate(id=>MirpanelCart.read().find(x=>x.draftId===id).quantity,n.draftId),2);
  // Upgrade an existing pre-hotfix cart: opaque references retain their data.
  await p.evaluate(x=>localStorage.setItem('mirpanel.cart.v1',JSON.stringify([{...x.meta,draftId:x.d.draftId,lineId:x.d.lineId,termsVersion:x.d.termsVersion}])),spot);
  const spot3=await save('spotify',{email:'synthetic@example.invalid',password:'Synthetic-only-password'});await commit(spot3);eq(await p.evaluate(()=>MirpanelCart.read().length),1);eq(await p.evaluate(()=>MirpanelCart.read()[0].quantity),2);
  eq(await p.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('Synthetic-only-password')),false);
  // Old separate lines are grouped on server-draft restoration, without inputs in storage.
  const legacy=[spot,spot3].map(x=>({...x.meta,draftId:x.d.draftId,lineId:x.d.lineId,termsVersion:x.d.termsVersion}));
  await p.evaluate(x=>{localStorage.setItem('mirpanel.cart.v1',JSON.stringify(x));},legacy);
  // Isolate the restore list to these still-owned drafts, as a separate browser cart.
  const all=(await shop.listDrafts(guest,owner)).items;await shop.removeDrafts(guest,owner,all.filter(x=>!legacy.some(l=>l.draftId===x.draftId)).map(x=>x.draftId));
  await p.goto(origin+'/restore');await p.waitForFunction(()=>MirpanelCart.read().length===1&&MirpanelCart.read()[0].quantity===2);
  eq((await shop.getDraft(guest,owner,(await p.evaluate(()=>MirpanelCart.read()[0])).draftId)).values.email,'synthetic@example.invalid');
  await p.reload();await p.waitForFunction(()=>MirpanelCart.read().length===1);eq(await p.evaluate(()=>MirpanelCart.read()[0].quantity),2);
  fs.mkdirSync('payment-test-artifacts/shop-browser',{recursive:true});fs.writeFileSync('payment-test-artifacts/shop-browser/synthetic-whatsapp-example.txt',message);
  console.log(JSON.stringify({checks,protectedPersistence:true,groupedIdentical:true,separateDifferent:true,oneOrderReceiptSlot:true,productionWrites:0}));
 }
}finally{await browser?.close();await new Promise(r=>server?server.close(r):r());await f.close();}
