import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
const {chromium}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const files={'/ready-stock-admin.js':'mirpanel-admin/public/ready-stock-admin.js','/ready-stock-admin.css':'mirpanel-admin/public/ready-stock-admin.css','/admin.css':'mirpanel-admin/public/admin.css'};
const server=http.createServer((req,res)=>{
 if(files[req.url]){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(files[req.url]));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/admin.css"><link rel="stylesheet" href="/ready-stock-admin.css"><main style="margin:12px"><div id="stock"></div></main><script type="module">import {mountReadyStock} from '/ready-stock-admin.js';mountReadyStock(document.querySelector('#stock'),async(url,options)=>{const r=await fetch(url,options);if(!r.ok)throw Error('Synthetic error');return r.json();});</script>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of [390,1360]){
  const page=await browser.newPage({viewport:{width,height:900}});let date='2027-01-15',writes=0,editedName='4',removedFive=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const groupId='00000000-0000-4000-8000-000000000001';
  const saved=[];
  const manualDeliveryId='00000000-0000-4000-8000-000000000099';
  let manualSheetJob={deliveryId:manualDeliveryId,orderCode:'99',state:'blocked',message:'Uyğun sətrin A xanasında başqa dəyər var.'};

  await page.route('**/api/admin/payment-ready-stock',async route=>{
   const input=route.request().method()==='POST'?route.request().postDataJSON():null;
   if(input?.netflixSheetIdRetry){
    assert.equal(input.netflixSheetIdRetry.deliveryId,manualDeliveryId);
    manualSheetJob={...manualSheetJob,state:'pending',message:undefined};
    return route.fulfill({json:{queued:true}});
   }
   if(input?.netflixRoomCards){
    assert.equal(input.netflixRoomCards.length,2);
    for(const [index,card] of input.netflixRoomCards.entries()){
     assert.equal(card.name,'Synthetic '+(index+1));assert.equal(card.pin,'0408');
     assert.deepEqual(Object.keys(card).sort(),['email','name','password','pin','requestId']);
     saved.push({id:card.requestId,groupId:card.requestId,accountEmail:card.email,name:card.name,canDelete:true,status:'free',sellable:true});
    }
    return route.fulfill({json:{added:2}});
   }
   if(input?.netflixRoomEdit){
    const edit=input.netflixRoomEdit;
    assert.equal(edit.id,groupId.slice(0,-1)+'4');
    if(edit.action==='open')return route.fulfill({json:{name:editedName,pin:'0408',editable:true}});
    if(edit.action==='password')return route.fulfill({json:{password:'Synthetic-original'}});
    assert.equal(edit.action,'save');assert.equal(edit.name,'6');assert.equal(edit.pin,'0123');
    editedName=edit.name;return route.fulfill({json:{name:editedName}});
   }
   if(input?.netflixRoomDelete){
    if(input.netflixRoomDelete.id===groupId.slice(0,-1)+'5'){
     removedFive=true;return route.fulfill({json:{deleted:true}});
    }
    const index=saved.findIndex(r=>r.id===input.netflixRoomDelete.id);assert.equal(index,0);
    saved.splice(index,1);return route.fulfill({json:{deleted:true}});
   }
   if(input?.netflixAccountPassword){const x=input.netflixAccountPassword;assert.equal(x.groupId,groupId);
    if(x.action==='preview')return route.fulfill({json:{email:'synthetic@example.test',activeRooms:2,activeCustomers:2,revision:'synthetic-revision'}});
    assert.equal(x.action,'rotate');assert.equal(x.password,'Example-new');assert.equal(x.expectedRevision,'synthetic-revision');writes++;return route.fulfill({json:{changed:true}});
   }
   return route.fulfill({json:{products:[{id:'netflix',title:'Netflix Şəxsi',message:'',plans:[{index:0,title:'1 ay',signature:'test',sales:10,ready:0}]}],netflixSheetManual:[manualSheetJob],netflixRooms:[...saved,...[5,2,10,1,4,3].filter(n=>n!==5||!removedFive).map(n=>({id:groupId.slice(0,-1)+n,groupId,accountEmail:'synthetic@example.test',name:n===4?editedName:String(n),endsOn:date,canDelete:n===5,sellable:n===5,deliveryId:n===5?null:'example-'+n,status:[2,3,10].includes(n)?'paid':'expired',active:[2,3].includes(n),statusLabel:[2,3].includes(n)?'Ödəniş edib, ödənilmiş müddəti davam edir':'Müddəti bitib, yenilənməyib'}))]}});
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  const release=page.getByRole('button',{name:'Boşalt və satışa qaytar',exact:true});await release.first().waitFor();
  assert.equal(await release.count(),2);assert.equal(await release.first().isEnabled(),true);
  const sheet=page.locator('[data-sheet-manual]');
  await sheet.getByText(/Sifariş №99.*başqa dəyər/).waitFor();
  await sheet.getByRole('button',{name:'ID yazısını təkrarla'}).click();
  await sheet.getByText(/Yazı növbədədir/).waitFor();
  const ready=page.getByRole('region',{name:'Hazır stok',exact:true});
  const sold=page.getByRole('region',{name:'Satılan və müştəriyə bağlanan otaqlar',exact:true});
  const account=sold.locator('.netflixAccountGroup').filter({hasText:'synthetic@example.test'});
  const roomNames=()=>account.locator('[data-room-name]').evaluateAll(nodes=>nodes.map(node=>node.dataset.roomName));
  assert.deepEqual(await roomNames(),['1','2','3','4','10']);
  const room=account.locator('[data-room-name="4"]');
  await room.getByRole('button',{name:'Redaktə et',exact:true}).click();
  const editor=room.locator('.netflixRoomEdit');
  await editor.getByLabel('Otaq adı').fill('6');
  await editor.getByLabel('Otaq kodu (PIN)').fill('0123');
  await editor.getByRole('button',{name:'Dəyişikliyi saxla',exact:true}).click();
  await page.getByText('Otaq yeniləndi.',{exact:true}).waitFor();
  assert.deepEqual(await roomNames(),['1','2','3','6','10']);
  page.once('dialog',async dialog=>{assert.match(dialog.message(),/Otaq 5/);await dialog.accept();});
  await ready.locator('[data-room-name="5"]').getByRole('button',{name:/^Sil/}).click();
  await page.getByText('Otaq satış stokundan silindi.').waitFor();
  assert.equal(await ready.locator('[data-room-name="5"]').count(),0);
  assert.deepEqual(await roomNames(),['1','2','3','6','10']);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const minHeight=width<760?44:32;
  for(const button of await account.locator('.netflixAccountHeader .btn,.netflixRoomActions .btn').all())assert.ok((await button.boundingBox()).height>=minHeight);

  assert.equal(await page.locator('.netflixAccountGroup').getByLabel('Hesabın e-poçtu').count(),0);
  assert.equal(await page.getByRole('button',{name:'+ Yeni hesab əlavə et',exact:true}).isVisible(),true);
  assert.equal(await page.getByLabel('Müştəriyə təqdim ediləcək hazır mesaj').isVisible(),true);
  assert.equal(await page.getByText('Netflix Şəxsi — hazır otaq stoku',{exact:true}).count(),0);
  const formCards=page.locator('[data-messages] .readyStockAccount');
  await page.getByRole('button',{name:'+ Yeni hesab əlavə et',exact:true}).click();
  assert.deepEqual(await formCards.locator('h4').allTextContents(),['Hesab 1','Hesab 2']);
  for(const [index,card] of (await formCards.all()).entries()){
   assert.equal(await card.locator('input').count(),4);
   await card.getByLabel('Hesabın e-poçtu').fill('form@example.test');
   await card.getByLabel('Hesabın şifrəsi').fill('Synthetic-password');
   await card.getByLabel('Otaq adı').fill('Synthetic '+(index+1));
   await card.getByLabel('Otaq kodu (PIN)').fill('0408');
  }
  await page.getByRole('button',{name:'Hesabları və təhvil ayarını saxla',exact:true}).click();
  await page.getByText('2 hazır hesab saxlanıldı.',{exact:true}).waitFor();
  await page.reload();
  const remove=page.getByRole('button',{name:'Sil · Otaq Synthetic 1 · form@example.test',exact:true});
  await remove.waitFor();
  page.once('dialog',async dialog=>{assert.match(dialog.message(),/Otaq Synthetic 1/);await dialog.accept();});
  await remove.click();await page.getByText('Otaq satış stokundan silindi.').waitFor();
  assert.equal(await remove.count(),0);
  assert.equal(await page.getByRole('button',{name:'Sil · Otaq Synthetic 2 · form@example.test',exact:true}).count(),1);
  await account.getByRole('button',{name:'Şifrəni yenilə',exact:true}).click();
  const form=page.locator('.netflixPasswordForm');await form.getByText('synthetic@example.test · Təsirlənəcək aktiv otaqlar: 2 · Müştərilər: 2').waitFor();
  assert.equal(await form.locator('input').getAttribute('type'),'text');await form.locator('input').fill('Example-new');
  await form.getByRole('button',{name:'Şifrəni saxla',exact:true}).click();
  await page.getByText('Şifrə yeniləndi. Bildirişlər növbəyə əlavə edildi.').waitFor();
  assert.equal(writes,1);assert.deepEqual(errors,[]);
  assert.ok(await page.locator('.netflixAccountGroup').last().evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
  console.log('PASS '+width+'px — numeric sorting, edit and delete target, mobile hit area, add and rotate');await page.close();
 }
}finally{await browser.close();server.close();}
