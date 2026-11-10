import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {orderGuideFor} from '../mirpanel-admin/order-guide.mjs';
const {chromium,webkit}=await import(process.env.MIRPANEL_PLAYWRIGHT);
const live=process.argv.includes('--live'),out=path.resolve('../../outputs/spotify-phone-guide');
fs.mkdirSync(out,{recursive:true});
const id='11111111-1111-4111-8111-111111111111';
const guide=orderGuideFor({id:'spotify',orderGuide:{information:'Sintetik məlumat'}},{},'1 aylıq');
assert.equal(guide.tracks.phone.length,5);
assert.equal(orderGuideFor({id:'other'},{},'').tracks.phone,undefined);
const files=new Map();
for(const name of ['browser-orders.js','browser-orders.css']){
 const local=fs.readFileSync(name,'utf8');
 if(!live){files.set('/'+name,local);continue;}
 const response=await fetch('https://mirpanel.com/'+name+'?v=spotify-phone-1');
 assert.equal(response.status,200);
 const published=await response.text();
 assert.equal(published.replaceAll('\r\n','\n'),local.replaceAll('\r\n','\n'));
 files.set('/'+name,published);
}
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://fixture'),json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
 if(url.pathname==='/api/payments/my-orders')return json({orders:[{id,orderCode:'SINAQ-1',product:'Spotify Premium',status:'completed',amount:5.49,items:[{productId:'spotify',title:'Spotify Premium',planName:'1 aylıq',quantity:1,unitCents:549}]}]});
 if(url.pathname.endsWith('/guide/0'))return json(guide);
 if(files.has(url.pathname)){
  res.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css':'text/javascript');
  return res.end(files.get(url.pathname));
 }
 if(url.pathname==='/'){
  res.setHeader('Content-Type','text/html; charset=utf-8');
  return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser-orders.css"><body style="background:#080a0d;color:white;font-family:Arial"><section class="account-panel"><main id="browserOrders"></main></section><p id="browserOrdersError"></p><button id="browserOrdersMore" hidden></button><dialog id="browserReceipt"><button id="browserReceiptClose"></button><div id="browserReceiptContent"></div></dialog><script src="/browser-orders.js"></script>');
 }
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
try{
 for(const [engine,width]of live?[[chromium,390]]:[[chromium,320],[chromium,390],[chromium,1440],[webkit,390],[webkit,1440]]){
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.MIRPANEL_CHROME}:{})});
  try{
   const video=engine===chromium&&width===390&&!live;
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600,
    ...(video?{recordVideo:{dir:path.join(out,'recording'),size:{width:390,height:900}}}:{})});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin);
   await page.getByRole('button',{name:'Məlumat və təlimat',exact:true}).click();
   const dialog=page.locator('.browser-order-guide');
   await dialog.getByText('Sintetik məlumat').waitFor();
   await dialog.getByRole('button',{name:'Təlimat',exact:true}).click();
   await dialog.getByRole('button',{name:'Telefonla giriş',exact:true}).waitFor();
   const phone=dialog.locator('.spotify-handset'),scene=phone.locator('.spotify-demo');
   const dots=dialog.locator('.browser-guide-dots button'),next=dialog.getByRole('button',{name:'Növbəti',exact:true}),back=dialog.getByRole('button',{name:'Əvvəlki',exact:true});
   assert.equal(await dots.count(),5);assert.equal(await back.isDisabled(),true);
   const first=await phone.boundingBox();
   for(const [i,step] of guide.tracks.phone.entries()){
    if(i)await (i%2?next:dots.nth(i)).click();
    assert.equal(await scene.getAttribute('data-scene'),step.animation);
    assert.equal(await dots.nth(i).getAttribute('aria-current'),'step');
    for(const [key,value] of Object.entries(await phone.boundingBox()))assert.ok(Math.abs(value-first[key])<2,key);
    assert.equal(await scene.locator('.netflix-target').textContent(),['Oturum aç','Devam et','Parola ile oturum aç','Oturum aç','Bireysel'][i]);
    if(i===0)assert.ok(await scene.getByText('Ücretsiz kaydol',{exact:true}).count());
    if(i===1||i===3){
     const glyphs=scene.locator('.netflix-typing span');
     assert.equal(await scene.locator('.netflix-typing').textContent(),i===1?'hesab@example.com':'••••••••');
     await page.waitForFunction(()=>[...document.querySelectorAll('.spotify-demo .netflix-typing span')].every(n=>getComputedStyle(n).visibility==='visible'));
     await page.waitForFunction(()=>getComputedStyle(document.querySelector('.spotify-demo .netflix-target')).outlineColor==='rgb(229, 191, 82)');
    }
    if(i===2){
     const cells=scene.locator('.spotify-code-box');
     assert.equal(await cells.count(),6);assert.deepEqual(await cells.allTextContents(),Array(6).fill(''));
     assert.equal(await cells.evaluateAll(nodes=>new Set(nodes.map(n=>n.getBoundingClientRect().top)).size),1);
     assert.ok((await scene.getByText('Kodu yeniden gönder',{exact:false}).boundingBox()).y<(await scene.getByText('Parola ile oturum aç',{exact:true}).boundingBox()).y);
    }
    if(i===4){
     const label=scene.getByText('Premium üyeliğin',{exact:true}),badge=scene.getByText('Bireysel',{exact:true});
     const a=await label.boundingBox(),b=await badge.boundingBox();
     assert.ok(b.x>a.x+a.width&&Math.abs(a.y+a.height/2-b.y-b.height/2)<1);
     assert.equal(await badge.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(30, 215, 96)');
    }
    if(engine===chromium&&[390,1440].includes(width)&&!live)
     await page.screenshot({path:path.join(out,(width===390?'mobile':'desktop')+'-'+(i+1)+'.png')});
   }
   assert.equal(await next.isDisabled(),true);await back.click();
   assert.equal(await scene.getAttribute('data-scene'),'spotify-password');
   if(video){
    await dots.nth(0).click();
    await dialog.getByRole('button',{name:'Avtomatik göstər',exact:false}).click();
    await page.waitForFunction(()=>document.querySelector('.spotify-demo')?.dataset.scene==='spotify-premium',{},{timeout:23000});
    await dialog.getByRole('button',{name:'Avtomatik göstər',exact:false}).waitFor();
   }
   assert.deepEqual(errors,[]);
   const recording=page.video();await context.close();
   if(recording){await recording.saveAs(path.join(out,'spotify-telefonla-giris.webm'));await recording.delete();}
   console.log(engine.name(),width,'PASS');
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
