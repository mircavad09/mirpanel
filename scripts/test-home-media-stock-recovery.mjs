import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const before=process.argv.includes('--before'),out='outputs/home-recovery';fs.mkdirSync(out,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6WQAAAABJRU5ErkJggg==','base64');
let origin,scenario='retry',calls={},apiRevision=1,writes=0,appDelay=2500;
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),root=process.cwd();
const inventory=()=>({products:['capcut','spotify','netflix','chatgpt','chatgpt_hazir','amazon','surfshark','zoom'].map(productId=>({productId,scope:'product',available:apiRevision===1?8:9,plans:[]}))});
const source=file=>before?execFileSync('git',['-c','safe.directory=*','show','e805695:'+file],{encoding:'utf8',stdio:['ignore','pipe','ignore']}):fs.readFileSync(file,'utf8');
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://local'),p=u.pathname;calls[p]=(calls[p]||0)+1;
 if(req.method!=='GET'){writes++;res.writeHead(405);res.end();return;}
 const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 if(['/api/homepage-banners','/api/stories','/api/payments/inventory'].includes(p)){
  await sleep(120);
  if(scenario==='failed'||scenario==='retry'&&calls[p]===1)return json({error:'Synthetic transient failure'},503);
  if(p.endsWith('inventory'))return json(inventory());
  if(p.endsWith('stories'))return json({stories:[1,2].map(i=>({id:'story'+i,title:'Sintetik story '+i,active:true,coverUrl:origin+'/fixture/story'+i+'.png',items:[{id:'item'+i,media_type:'image',mediaUrl:origin+'/fixture/image.png'}]}))});
  return json({managed:true,banners:[{id:'banner1',placement:'main',active:true,order:1,image:origin+'/fixture/banner.png',url:'/mehsul/capcut-pro'},{id:'side1',placement:'side',active:true,order:2,image:origin+'/fixture/side1.png',url:'/'},{id:'side2',placement:'side',active:true,order:3,image:origin+'/fixture/side2.png',url:'/'}]});
 }
 if(p==='/api/community/state'){await sleep(6500);return json({profile:null,unread:0});}
 if(p.startsWith('/api/'))return json({items:[],products:[],initialized:false});
 if(/\.(?:png|jpe?g|svg|webp|ico)$/.test(p)){res.writeHead(200,{'Content-Type':'image/png'});res.end(png);return;}
 const file=p==='/'?'index.html':p.slice(1),absolute=path.resolve(file);
 if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){res.writeHead(404);res.end();return;}
 if(file==='app.js')await sleep(appDelay);
 let body=source(file).replaceAll('https://mirpanel.onrender.com',origin);if(file==='index.html')body=body.replace(/<link[^>]+href="https:\/\/fonts[^>]*>/g,'');
 res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
const results=[];
try{for(const [engine,width] of before?[[chromium,390]]:process.argv.includes('--webkit')?[[webkit,390],[webkit,1440]]:[[chromium,390],[chromium,1440]]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  const iterations=before?1:engine===webkit?2:10;
  for(let iteration=0;iteration<iterations;iteration++){
   calls={};scenario=before?'failed':'retry';apiRevision=1;appDelay=iteration===0?2500:0;
   const record=engine===chromium&&width===390&&iteration===0,context=await browser.newContext({viewport:{width,height:850},...(record?{recordVideo:{dir:out,size:{width,height:850}}}:{})});
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   await context.addInitScript(()=>{sessionStorage.setItem('mirpanel.intro.seen.v1','1');window.mediaFrames=[];const tick=()=>{const hero=document.querySelector('#homeHero');if(hero)mediaFrames.push({at:performance.now(),hidden:hero.hidden,height:hero.getBoundingClientRect().height});requestAnimationFrame(tick);};requestAnimationFrame(tick);});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/',{waitUntil:'commit'});
   if(before){await page.waitForTimeout(4300);const state=await page.evaluate(()=>({heroHidden:document.querySelector('#homeHero').hidden,storiesHidden:document.querySelector('#homeStories').hidden,notice:document.querySelector('#inventoryServiceStatus')?.textContent,mediaStart:performance.getEntriesByType('resource').filter(r=>/api\/(homepage-banners|stories)/.test(r.name)).map(r=>({path:new URL(r.name).pathname,start:r.startTime}))}));assert.equal(state.heroHidden,true);assert.equal(state.storiesHidden,true);console.log('REPRODUCED',JSON.stringify(state));fs.writeFileSync(out+'/before-controlled.json',JSON.stringify(state,null,2));await page.screenshot({path:out+'/before-controlled.png'});await context.close();continue;}
   await page.waitForFunction(()=>{const b=document.querySelector('#heroSlider .active img'),s=document.querySelector('.home-story img');return b?.complete&&b.naturalWidth&&s?.complete&&s.naturalWidth;},{timeout:9000});
   if(iteration===0){
    const timings=await page.evaluate(()=>({media:performance.now(),app:performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname==='/app.js')?.responseEnd||null,session:performance.getEntriesByType('resource').some(r=>r.name.includes('/api/community/state'))}));assert.equal(timings.app,null,'media does not wait for product runtime');assert.equal(timings.session,false,'media does not wait for session');
   }
   await page.waitForFunction(()=>window.MirpanelInventory?.productState(DATA.products.find(p=>p.id==='capcut')).available===8);
   assert.equal(await page.locator('#inventoryServiceStatus').count(),0);assert.ok(calls['/api/payments/inventory']>=2);assert.ok(calls['/api/homepage-banners']>=2);assert.ok(calls['/api/stories']>=2);
   const heights=await page.evaluate(()=>mediaFrames.filter(f=>!f.hidden&&f.height>0).map(f=>f.height));assert.ok(Math.max(...heights)-Math.min(...heights)<=3,'reserved hero geometry');
   // Failure with a previous successful snapshot preserves availability; manual retry clears notice.
   scenario='failed';await page.evaluate(()=>MirpanelInventory.refresh());await page.locator('#inventoryServiceStatus button').waitFor();
   assert.equal(await page.evaluate(()=>MirpanelInventory.productState(DATA.products.find(p=>p.id==='capcut')).available),8);
   scenario='success';await page.locator('#inventoryServiceStatus button').click();await page.locator('#inventoryServiceStatus').waitFor({state:'detached'});
   // A superseded slow request must not overwrite the successful newer snapshot.
   await page.route('**/api/payments/inventory',async route=>{await sleep(1000);await route.fulfill({status:503,json:{error:'Late old failure'}}).catch(()=>{});},{times:1});
   await page.evaluate(()=>{void MirpanelInventory.refresh();});await sleep(30);apiRevision=2;await page.evaluate(()=>MirpanelInventory.refresh({force:true}));await sleep(1100);
   assert.equal(await page.evaluate(()=>MirpanelInventory.productState(DATA.products.find(p=>p.id==='capcut')).available),9);assert.equal(await page.locator('#inventoryServiceStatus').count(),0);
   const count=calls['/api/payments/inventory'];await page.evaluate(()=>Promise.all([MirpanelInventory.refresh(),MirpanelInventory.refresh(),MirpanelInventory.refresh()]));assert.equal(calls['/api/payments/inventory']-count,1,'requests coalesced');
   // Route cancellation is not a service failure; restore in the same document.
   await page.evaluate(()=>{window.dispatchEvent(new Event('mirpanel:route-leave'));window.dispatchEvent(new CustomEvent('mirpanel:route-ready',{detail:{path:'/'}}));});
   await page.waitForTimeout(180);assert.equal(await page.locator('#inventoryServiceStatus').count(),0);
   const tab=await context.newPage();await tab.goto('about:blank');await tab.bringToFront();await page.bringToFront();await tab.close();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
   if(record){await page.screenshot({path:out+'/after-controlled-390.png'});await page.waitForTimeout(350);}
   results.push({engine:engine.name(),width,iteration:iteration+1,banner:true,stories:true,recovered:true,oldResponseIgnored:true});console.log('PASS',engine.name(),width,iteration+1);
   const video=page.video();await context.close();if(video)fs.renameSync(await video.path(),out+'/recovery-demo.webm');
  }
 }finally{await browser.close();}
}assert.equal(writes,0);fs.writeFileSync(out+'/'+(before?'before':process.argv.includes('--webkit')?'webkit':'after')+'-controlled-results.json',JSON.stringify({results,writes},null,2));}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
