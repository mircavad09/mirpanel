import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import labels from '../display-labels.js';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {activeProductsWithSlugs} from '../mirpanel-admin/product-pages.mjs';
const {normalizeDisplayLabel:n}=labels,root=process.cwd(),live=process.env.MIRPANEL_TEST_LIVE==='1';
for(const [input,expected] of [['1 Ayliq PRO','1 aylıq PRO'],['3 ayliq','3 aylıq'],['6 Aylıq','6 aylıq'],['Youtube','YouTube'],['Telefon&Kompyuter','Telefon və kompüter'],['Telefon & Kompyuter','Telefon və kompüter'],['Kompyuter','kompüter'],['Qənayət','qənaət'],['mehsul sifaris','məhsul sifariş']]){assert.equal(n(input),expected);assert.equal(n(n(input)),expected);}
const app=live?await(await fetch('https://mirpanel.com/app.js')).text():fs.readFileSync('app.js','utf8');
const state=extractAdminState(app),snapshot=JSON.stringify(state),active=activeProductsWithSlugs(state.products);
assert.equal(active.length,22);
const storyBefore=await(await fetch('https://mirpanel.onrender.com/api/stories')).json();
const storyMedia=new Set(storyBefore.stories.flatMap(s=>[s.coverUrl,...s.items.map(i=>i.mediaUrl)]));
const mediaStatus=await Promise.all([...storyMedia].map(async url=>{const res=await fetch(url,{method:'HEAD'});return res.status;}));
assert.ok(mediaStatus.every(status=>status===200),JSON.stringify(mediaStatus));
const identity=p=>p.stories.map(s=>({id:s.id,title:s.title,items:s.items.map(i=>({id:i.id,type:i.media_type}))}));
let baseline=false,writes=0;const original=new Map(['index.html','stories.css','stories.js'].map(f=>[f,execFileSync('git',['show','HEAD:'+f],{encoding:'utf8'})]));
const server=live?null:http.createServer((req,res)=>{
 if(req.method!=='GET'){writes++;res.writeHead(405);return res.end();}
 let file=decodeURIComponent(new URL(req.url,'http://local').pathname.slice(1))||'index.html';if((file==='mehsul'||file.startsWith('mehsul/'))&&!path.extname(file))file+='.page';
 const name=path.resolve(root,file);if(!name.startsWith(root+path.sep)||!fs.existsSync(name)||!fs.statSync(name).isFile()){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.page':'text/html; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
 res.end(baseline&&original.has(file)?original.get(file):fs.readFileSync(name));
});
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=live?'https://mirpanel.com':`http://127.0.0.1:${server.address().port}`;
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
const errors=[],missing=[],checks=[],visual=process.env.MIRPANEL_VISUAL_DIR;if(visual)fs.mkdirSync(visual,{recursive:true});
const widths=process.env.MIRPANEL_LABEL_QUICK?[390]:[320,360,390,430,768,1024,1366,1440];
const bad=/\b(?:ayliq|Aylıq|Youtube|Kompyuter|Qənayət|mehsul|sifaris)\b|Telefon\s*&\s*Kompyuter/gu;
try{
 const context=await browser.newContext({reducedMotion:'reduce'});
 await context.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/cdn-cgi/rum')return route.fulfill({status:204});
  if(!['GET','HEAD','OPTIONS'].includes(req.method())){writes++;return route.abort();}
  if(!live&&url.pathname==='/api/stories')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(storyBefore)});
  if(!live&&url.pathname==='/api/product-sales')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({initialized:false})});
  if(storyMedia.has(req.url()))return route.continue();
  if(!live&&url.origin!==origin)return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)missing.push(r.status()+' '+new URL(r.url()).pathname);});
 async function open(url,width){await page.setViewportSize({width,height:width===320?568:width<500?844:900});await page.goto(origin+url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>{const s=document.getElementById('newSplashScreen');return !s||s.hidden||getComputedStyle(s).display==='none';});}
 if(!live&&visual){baseline=true;await open('/',390);await page.waitForSelector('.home-story');await page.screenshot({path:path.join(visual,'before-story-390.png')});baseline=false;}
 for(const width of widths){
  await open('/mehsul',width);assert.deepEqual((await page.locator('body').innerText()).match(bad)||[],[],'listing text');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'listing@'+width);
  await open('/',width);await page.waitForSelector('.home-story');
  const shape=await page.locator('.home-story').evaluateAll(items=>items.map(el=>{const c=el.querySelector('.home-story-cover'),i=el.querySelector('img'),t=el.querySelector('.home-story-title'),r=el.getBoundingClientRect(),cr=c.getBoundingClientRect();return {w:r.width,h:r.height,cw:cr.width,ch:cr.height,font:getComputedStyle(t).fontSize,fit:getComputedStyle(i).objectFit,broken:!i.complete||!i.naturalWidth,titleLines:t.scrollHeight/parseFloat(getComputedStyle(t).lineHeight)};}));
  await page.waitForFunction(()=>[...document.querySelectorAll('.home-story img')].every(i=>i.complete&&i.naturalWidth));
  assert.equal(shape.length,storyBefore.stories.length);assert.equal(new Set(shape.map(s=>JSON.stringify([s.w,s.h,s.cw,s.ch,s.font]))).size,1);assert.ok(shape.every(s=>s.w>=44&&s.h>=44&&s.fit==='cover'&&s.titleLines<=2.1));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'home@'+width);
  if(visual)await page.screenshot({path:path.join(visual,`${live?'live':'after'}-story-${width}.png`)});
  await page.locator('.home-story').first().dblclick();assert.equal(await page.locator('.story-viewer:visible').count(),1);
  await page.waitForSelector('#storyMedia img,#storyMedia video');assert.equal(await page.locator('#storyProgress span').count(),storyBefore.stories[0].items.length);
  await page.locator('#storyNext').click();await page.locator('#storyPrev').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#storyViewer').isHidden(),true);
  await page.locator('.home-story').nth(1).click();await page.locator('#storyViewerClose').click();assert.equal(await page.locator('#storyViewer').isHidden(),true);
  for(const {product,slug} of active){
   await open('/mehsul/'+slug,width);await page.waitForSelector('.product-detail-summary');
   const rows=page.locator('#pp-plans-container .pp-plan-label');
   for(let i=0;i<product.plans.length;i++){if(product.plans[i].active===false)continue;await rows.nth(i).click();await page.waitForTimeout(5);assert.equal(await rows.nth(i).locator('.pp-plan-name').textContent(),n(product.plans[i].label||`${product.plans[i].months} aylıq`));}
   const visible=await page.locator('body').innerText();assert.deepEqual(visible.match(bad)||[],[],product.id+'@'+width+' bad text');
   const raw=await page.evaluate(()=>{const p=DATA.products.find(p=>p.id===document.body.dataset.productId);return {id:p.id,slug:p.seoSlug,plans:p.plans};});
   assert.deepEqual(raw,JSON.parse(JSON.stringify({id:product.id,slug:product.seoSlug,plans:product.plans})));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,product.id+'@'+width);
   await page.locator('#pp-main-img').evaluate(i=>i.decode());assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>i.getClientRects().length&&i.complete&&!i.naturalWidth).length),0);
   checks.push({width,id:product.id,plans:product.plans.length});
  }
 }
 // Viewed state persists for existing media but not for a newly added item.
 await page.goto(origin+'/');await page.waitForSelector('.home-story');
 await page.evaluate(stories=>localStorage.setItem('mirpanel-story-viewed-v1',JSON.stringify(stories[0].items.map(i=>`${stories[0].id}:${i.id}:${i.updated_at||''}`))),storyBefore.stories);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('.home-story.is-viewed');assert.equal(await page.locator('.home-story').first().getAttribute('class'),'home-story is-viewed');
 // A text update cannot mutate canonical URLs, data attributes or inputs.
 await page.evaluate(()=>{const card=document.createElement('a');card.className='card';card.href='/mehsul/Youtube';card.dataset.productId='mehsul';card.innerHTML='<span title="Kompyuter">1 Ayliq Telefon&Kompyuter</span><input value="sifaris">';document.body.append(card);});
 await page.waitForFunction(()=>[...document.querySelectorAll('.card')].at(-1).textContent==='1 aylıq Telefon və kompüter');
 assert.deepEqual(await page.locator('.card').last().evaluate(e=>[e.getAttribute('href'),e.dataset.productId,e.querySelector('input').value,e.querySelector('span').title]),['/mehsul/Youtube','mehsul','sifaris','kompüter']);
 assert.equal(writes,0);assert.equal(errors.length,0,errors.join('\n'));assert.equal(missing.length,0,missing.join('\n'));assert.equal(JSON.stringify(state),snapshot);
 const storyAfter=await(await fetch('https://mirpanel.onrender.com/api/stories')).json();assert.deepEqual(identity(storyAfter),identity(storyBefore));
 const report={ok:true,live,products:active.length,plans:active.reduce((s,{product})=>s+product.plans.length,0),widths,checks:checks.length,storyCount:storyBefore.stories.length,mediaCount:storyBefore.stories.reduce((s,v)=>s+v.items.length,0),overflow:0,brokenImages:0,consoleErrors:errors,missing,writes,viewedPersistence:true,canonicalAndRawDataUnchanged:true};
 if(visual)fs.writeFileSync(path.join(visual,live?'live-report.json':'local-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
