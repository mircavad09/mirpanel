import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {orderGuideFor} from '../mirpanel-admin/order-guide.mjs';

const {chromium,webkit}=await import(process.env.MIRPANEL_PLAYWRIGHT);
const live=process.argv.includes('--live'),output=path.resolve('../../outputs/capcut-desktop-guide');
fs.mkdirSync(output,{recursive:true});
const id='11111111-1111-4111-8111-111111111111';
const guide=orderGuideFor({id:'capcut',orderGuide:{information:'Sintetik məlumat'}},{orderGuide:{tracks:{
 phone:[{image:'/uploads/guide.png',description:'Telefon addımı'}],
 desktopQr:[{image:'/uploads/old.png',description:'Köhnə QR'}]
}}},'1 aylıq');
assert.equal(guide.tracks.desktop.length,3);
assert.equal(guide.tracks.desktopQr,undefined);
assert.equal(guide.tracks.phone.length,1);
assert.equal(orderGuideFor({id:'netflix'},{},'').tracks.desktop.length,5);

const files=new Map();
for(const file of ['browser-orders.js','browser-orders.css']){
 const local=fs.readFileSync(file,'utf8');
 if(!live){files.set('/'+file,local);continue;}
 const response=await fetch('https://mirpanel.com/'+file+'?v=capcut-desktop-1');
 assert.equal(response.status,200);
 const published=await response.text();
 assert.equal(published.replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));
 files.set('/'+file,published);
}
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://fixture');
 const json=value=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify(value));};
 if(url.pathname==='/api/payments/my-orders')return json({orders:[{
  id,orderCode:'SINAQ-1',product:'CapCut Pro',status:'completed',amount:4.99,
  items:[{productId:'capcut',title:'CapCut Pro',planName:'1 aylıq',quantity:1,unitCents:499}]
 }]});
 if(url.pathname.endsWith('/guide/0'))return json(guide);
 if(files.has(url.pathname)){
  response.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css':'text/javascript');
  return response.end(files.get(url.pathname));
 }
 if(url.pathname==='/'){
  response.setHeader('Content-Type','text/html; charset=utf-8');
  return response.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser-orders.css"><body style="background:#080a0d;color:white;font-family:Arial"><section class="account-panel"><main id="browserOrders"></main></section><p id="browserOrdersError"></p><button id="browserOrdersMore" hidden></button><dialog id="browserReceipt"><button id="browserReceiptClose"></button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script>');
 }
 response.writeHead(404);response.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 for(const [engine,width] of live?[[chromium,390]]:[[chromium,320],[chromium,390],[chromium,1440],[webkit,390],[webkit,1440]]){
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.MIRPANEL_CHROME}:{})});
  try{
   const video=engine===chromium&&width===390&&!live;
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,
    ...(video?{recordVideo:{dir:path.join(output,'recording'),size:{width:390,height:900}}}:{})});
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.getByRole('button',{name:'Məlumat və təlimat',exact:true}).click();
   const dialog=page.locator('.browser-order-guide');
   await dialog.getByText('Sintetik məlumat').waitFor();
   await dialog.getByRole('button',{name:'Təlimat',exact:true}).click();
   await dialog.getByRole('button',{name:'Kompüterlə giriş',exact:true}).click();
   const laptop=dialog.locator('.netflix-laptop'),stage=dialog.locator('.capcut-pc-stage');
   const dots=dialog.locator('.browser-guide-dots button'),next=dialog.getByRole('button',{name:'Növbəti',exact:true}),back=dialog.getByRole('button',{name:'Əvvəlki',exact:true});
   assert.equal(await dots.count(),3);assert.equal(await back.isDisabled(),true);
   assert.equal(await dialog.getByRole('button',{name:'Kompüterdə QR ilə giriş',exact:true}).count(),0);
   assert.ok(await laptop.locator('.netflix-laptop-keyboard i').count()>20);
   assert.ok(await laptop.locator('.netflix-laptop-touchpad').isVisible());
   const first=await laptop.boundingBox();
   const capture=async name=>{
    if(engine===chromium&&[390,1440].includes(width)&&!live)
     await page.screenshot({path:path.join(output,(width===390?'mobile':'desktop')+'-'+name+'.png')});
   };
   for(const [i,scene] of ['open','choose','scan'].entries()){
    if(i)await (i===1?next:dots.nth(i)).click();
    assert.equal(await stage.getAttribute('data-scene'),scene);
    assert.equal(await dots.nth(i).getAttribute('aria-current'),'step');
    for(const [key,value] of Object.entries(await laptop.boundingBox()))assert.ok(Math.abs(value-first[key])<2,key+' '+scene);
    const frame=await stage.boundingBox();
    assert.ok(frame.x>=0&&frame.x+frame.width<=width);
    if(i===0){
     await laptop.getByText('Sxematik görünüş').waitFor();
     assert.match(await laptop.locator('.capcut-pc-target').textContent(),/Sign Up/);
     await page.waitForTimeout(700);
    }
    if(i===1){
     assert.match(await laptop.locator('.capcut-pc-target').textContent(),/Use QR code/);
     await capture('2');
     await laptop.getByText('Nümunə',{exact:true}).waitFor();
     await laptop.locator('.capcut-pc-login').waitFor({state:'hidden'});
     await capture('2-qr');
     continue;
    }
    if(i===2){
     const phone=stage.locator('.capcut-pc-phone');
     assert.ok(await phone.getByText('Ben',{exact:true}).isVisible());
     await page.waitForTimeout(1750);
     assert.ok(await phone.getByText('▣ Scan',{exact:true}).isVisible());
     await capture('3-scan');
     await phone.locator('.capcut-pc-scan-frame').waitFor();
     assert.ok(await laptop.getByText('Nümunə',{exact:true}).isVisible());
     const phoneBox=await phone.boundingBox();
     assert.ok(phoneBox.x>first.x+first.width&&phoneBox.x+phoneBox.width<=width);
     assert.equal(await laptop.locator('.capcut-pc-mosaic').evaluate(n=>n.tagName),'DIV');
     await page.waitForTimeout(700);
    }
    await capture(String(i+1));
   }
   assert.equal(await next.isDisabled(),true);await back.click();
   assert.equal(await stage.getAttribute('data-scene'),'choose');
   if(video){
    await dots.nth(0).click();
    await dialog.getByRole('button',{name:'Avtomatik göstər',exact:false}).click();
    await page.waitForFunction(()=>document.querySelector('.capcut-pc-stage')?.dataset.scene==='scan',{},{timeout:13000});
    await dialog.getByRole('button',{name:'Avtomatik göstər',exact:false}).waitFor();
    await page.waitForTimeout(3900);
   }
   assert.deepEqual(errors,[]);
   const recording=page.video();await context.close();
   if(recording){await recording.saveAs(path.join(output,'capcut-komputerle-giris.webm'));await recording.delete();}
   console.log(engine.name(),width,'PASS');
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
