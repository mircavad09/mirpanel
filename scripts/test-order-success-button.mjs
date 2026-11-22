import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out=path.resolve('../../outputs/order-success-button-20261122');fs.mkdirSync(out,{recursive:true});
const id='90000000-0000-4000-8000-000000000003';
let paid=false,rejected=false,delivered=false,token=false,writes=0;
let css=fs.readFileSync('mirpanel-admin/community/public/shop.css','utf8');
if(process.argv.includes('--live-assets')){
 const r=await fetch('https://mirpanel.com/community-assets/shop.css?v=orders-success-shine-1');assert.equal(r.status,200);
 const live=await r.text();assert.equal(live.replaceAll('\r\n','\n'),css.replaceAll('\r\n','\n'));css=live;
 const html=await (await fetch('https://mirpanel.com/odenis')).text();assert(html.includes('shop.css?v=orders-success-shine-1'));
}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://fixture.test'),p=url.pathname;
 const json=data=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(data));};
 if(p.startsWith('/api/')&&req.method!=='GET'){writes++;res.writeHead(405);return res.end();}
 if(p==='/api/community/state')return json({profile:{id:'synthetic',balanceCents:0}});
 if(p==='/api/payments/shop/checkout')return json({id,state:'submitted',mode:'card',orderCode:'DEMO-13223',totalCents:1649,paymentConfirmed:paid,deliveryStatus:delivered?'completed':'preparing',...(token?{tokenCount:50}:{}),items:[{status:rejected?'rejected':'submitted'}]});
 if(p.startsWith('/api/'))return json({items:[],methods:[]});
 if(p==='/odenis'){
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
  return res.end('<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/community-assets/shop.css"><body class="community-page"><main id="shopApp" class="shop-page"></main><script type="module" src="/community-assets/shop-ui.js"></script></html>');
 }
 if(p==='/profil'){res.writeHead(200,{'content-type':'text/html'});return res.end('<h1>Isolated order destination</h1>');}
 if(p==='/community-assets/shop.css'){res.writeHead(200,{'content-type':'text/css'});return res.end(css);}
 const file=p.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+p.slice(18):p.slice(1);
 const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.wav':'audio/wav'};
 if(!file.includes('..')&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});return res.end(fs.readFileSync(file));}
 res.writeHead(404);res.end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const target='.shop-result-action--orders';
try{
 for(const [name,engine] of [['Chrome',chromium],['WebKit',webkit]]){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{for(const width of [320,390,430,1440]){
   const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600});
   await context.addInitScript(()=>{const timeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>timeout(fn,ms===12000?100:ms,...args);});
   const page=await context.newPage();
   paid=false;rejected=false;delivered=false;token=false;
   await page.goto(origin+'/odenis?completed='+id);
   const link=page.locator(target);await link.waitFor();
   assert.equal(await page.locator('.shop-result').getAttribute('data-result'),'reviewing');
   assert.equal(await link.evaluate(a=>getComputedStyle(a,'::before').content),'none');
   const before=await link.boundingBox();
   paid=true;await page.locator('.shop-result[data-result=paid]').waitFor();
   assert.equal(await link.innerText(),'Sifarişlərimə bax');
   const href=await link.getAttribute('href');assert.match(href,/^\/profil\?tab=(orders|sifarislerim)&order=DEMO-13223$/);
   const after=await link.boundingBox();assert.equal(after.width,before.width);assert.equal(after.height,before.height);
   const unstyled=await link.evaluate(a=>{const host=a.closest('.shop-result');host.dataset.result='reviewing';const b=a.getBoundingClientRect();const box={x:b.x,y:b.y,width:b.width,height:b.height};host.dataset.result='paid';return box;});
   assert.deepEqual(after,unstyled,'CSS effect does not shift the same result content');
   const styles=await link.evaluate(a=>({background:getComputedStyle(a).backgroundColor,color:getComputedStyle(a).color,overflow:getComputedStyle(a).overflow,
    layers:['::before','::after'].map(p=>{const s=getComputedStyle(a,p);return {name:s.animationName,duration:s.animationDuration,pointer:s.pointerEvents};}),
    children:[...a.children].map(c=>getComputedStyle(c).zIndex)}));
   assert.equal(styles.background,'rgb(255, 182, 0)');assert.equal(styles.color,'rgb(17, 17, 17)');assert.equal(styles.overflow,'hidden');
   assert(styles.layers.every(x=>x.duration==='3s'&&x.pointer==='none'));assert(styles.children.every(x=>x==='1'));
   for(const t of [0,900,1800,2900]){
    await link.evaluate((a,t)=>a.getAnimations({subtree:true}).forEach(x=>{x.pause();x.currentTime=t;}),t);
    assert.deepEqual(await link.boundingBox(),after);
    assert(await link.evaluate(a=>{const b=a.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2).closest('a')===a;}));
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const edge=await link.evaluate(async a=>{
    const animation=a.getAnimations({subtree:true}).find(x=>x.animationName==='orders-success-edge');
    animation.currentTime=0;await new Promise(requestAnimationFrame);const first=getComputedStyle(a,'::after').getPropertyValue('--orders-success-edge-angle');
    animation.currentTime=1500;await new Promise(requestAnimationFrame);return [first,getComputedStyle(a,'::after').getPropertyValue('--orders-success-edge-angle')];
   });assert.notEqual(edge[0],edge[1],'the border light actually moves in this engine');
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await link.evaluate(a=>a.getAnimations({subtree:true}).length),0);
   assert.match(await link.evaluate(a=>getComputedStyle(a).borderTopColor),/rgba?\(255, 255, 255/);
   assert.deepEqual(await link.boundingBox(),after);
   await page.emulateMedia({reducedMotion:'no-preference'});
   await link.evaluate(a=>a.getAnimations({subtree:true}).forEach(x=>{x.pause();x.currentTime=1350;}));
   if(name==='Chrome'&&[390,1440].includes(width))await page.screenshot({path:path.join(out,'orders-success-'+width+'.png')});
   await link.click();await page.waitForURL(origin+href);assert.equal(writes,0);
   // Token, pending and rejected results keep their existing non-animated links.
   for(const variant of ['rejected','token']){
    rejected=variant==='rejected';paid=variant==='token';token=variant==='token';
    await page.goto(origin+'/odenis?completed='+id+(token?'&token=1':''));await link.waitFor();
    assert.equal(await link.evaluate(a=>getComputedStyle(a,'::before').content),'none');
   }
   await context.close();console.log('PASS '+name+' '+width+': confirmed-only, 3s sheen/moving border, stable size, no overflow, reduced motion, order deep-link, zero writes');
  }
   if(name==='Chrome'&&process.argv.includes('--record')){
    paid=true;rejected=false;delivered=true;token=false;
    const recording=await browser.newContext({viewport:{width:390,height:700},isMobile:true,hasTouch:true,recordVideo:{dir:out,size:{width:390,height:700}}});
    const screen=await recording.newPage();
    await screen.goto(origin+'/odenis?completed='+id);await screen.locator('.shop-result[data-result=paid]').waitFor();
    await screen.waitForTimeout(3300);
    const video=screen.video();await recording.close();
    fs.renameSync(await video.path(),path.join(out,'orders-success-mobile.webm'));
   }
  }finally{await browser.close();}
 }
 assert.equal(writes,0);
}finally{await new Promise(r=>server.close(r));}
