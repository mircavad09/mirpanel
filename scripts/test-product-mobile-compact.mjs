import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const root=process.cwd(), catalog=extractAdminState(fs.readFileSync('app.js','utf8'));
const before=execFileSync('git',['show','a4fd3e4:product-page.css'],{encoding:'utf8'});
const artifact=process.env.MIRPANEL_VISUAL_DIR;
if(artifact)fs.mkdirSync(artifact,{recursive:true});
let baseline=false,writes=0;const missing=new Set();
const server=http.createServer((req,res)=>{
 if(req.method!=='GET'){writes++;res.writeHead(403);return res.end();}
 const u=new URL(req.url,'http://local');
 let name=path.resolve(root,'.'+decodeURIComponent(u.pathname));
 if(u.pathname.startsWith('/mehsul/')&&!path.extname(name))name+='.page';
 if(!name.startsWith(root+path.sep)||!fs.existsSync(name)||!fs.statSync(name).isFile()){missing.add(u.pathname);res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',({'.page':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(name)]||'application/octet-stream');
 res.end(baseline&&u.pathname==='/product-page.css'?before:fs.readFileSync(name));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
const errors=[],checks=[],comparison=[],inheritedAsset404s=new Set();
// Existing broken similar-product URLs are not changed by a mobile-only CSS task.
const inheritedMissing=new Set(['adobe-express','picsart','lightroom','linkedin','semrush','notion','blink'].map(n=>`/assets/${n}.png`));
const widths=[[320,568],[320,640],[360,800],[390,844],[430,932],[768,900],[1440,900]];
const required=['spotify','capcut','netflix','prime','google_ai','canva','chatgpt','youtube'];
try{
 const context=await browser.newContext({reducedMotion:'reduce'});
 await context.route('**/*',route=>{
  const req=route.request(),u=new URL(req.url());
  if(!['GET','HEAD'].includes(req.method())||/wa\.me|\/api\/(payment|order|receipt)/.test(req.url())){writes++;return route.abort();}
  if(u.origin===origin)return route.continue();
  if(u.pathname==='/api/product-sales')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({initialized:true,productId:u.searchParams.get('productId'),productTotal:1500,siteTotal:10005})});
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{
  if(m.type()!=='error')return;
  const location=m.location().url;
  if(location&&inheritedMissing.has(new URL(location).pathname)&&m.text().includes('404')){inheritedAsset404s.add(new URL(location).pathname);return;}
  errors.push(m.text());
 });
 async function open(id,w,h){
  await page.setViewportSize({width:w,height:h});
  const product=catalog.products.find(p=>p.id===id);
  await page.goto(`${origin}/mehsul/${product.seoSlug}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('productPageView')?.dataset.detailEnhanced==='true');
  await page.waitForFunction(()=>!document.querySelector('.product-detail-sales').hidden);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>document.getElementById('pp-main-img').complete);
 }
 async function geometry(){return page.evaluate(()=>{
  const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
  return {media:box('.product-page-media'),title:box('.product-page-title'),sales:box('.product-detail-sales'),summary:box('.product-detail-summary'),delivery:box('.product-page-delivery'),plans:box('#pp-plans-container'),actions:box('.product-page-actions'),trust:box('.product-detail-trust'),imageFit:getComputedStyle(document.getElementById('pp-main-img')).objectFit,overflow:document.documentElement.scrollWidth-innerWidth,scale:visualViewport.scale};
 });}
 for(const id of ['capcut','spotify'])for(const [w,h] of [[390,844],[768,900],[1440,900]]){
  baseline=true;await open(id,w,h);const old=await geometry();
  if(artifact)await page.screenshot({path:path.join(artifact,`before-${id}-${w}.png`),fullPage:true});
  baseline=false;await open(id,w,h);const next=await geometry();
  if(w>=768)assert.deepEqual(next,old,'tablet/desktop geometry changed');
  else assert.ok(next.actions.y<old.actions.y,'mobile order button not moved upwards');
  comparison.push({id,width:w,beforeImage:old.media.height,afterImage:next.media.height,beforeAction:old.actions.y,afterAction:next.actions.y});
 }
 baseline=false;
 for(const [w,h] of widths)for(const p of catalog.products.filter(p=>p.active!==false && (w===390||required.includes(p.id)))){
  await open(p.id,w,h);const g=await geometry();assert.equal(g.overflow,0,`${p.id} ${w} overflow`);assert.equal(g.scale,1);
  assert.equal(g.imageFit,'contain');
  if(w<768){
   assert.ok(g.media.height>=160&&g.media.height<=190);
   assert.ok(g.title.y>=g.media.bottom-1&&g.sales.y>=g.title.bottom-1);
   assert.ok(g.summary.y>=g.sales.bottom-1&&g.delivery.y>=g.summary.bottom-1);
   assert.ok(g.trust.y>=g.actions.bottom-1);
   assert.ok(await page.locator('.product-page-title').evaluate(e=>e.scrollHeight<=parseFloat(getComputedStyle(e).lineHeight)*2+1),'title exceeds two lines');
  }
  for(const row of await page.locator('#pp-plans-container .pp-plan-label:visible').all()){
   await row.click();assert.ok(await row.evaluate(e=>e.getBoundingClientRect().height>=44&&e.scrollWidth<=e.clientWidth+1));
   assert.equal(await row.getAttribute('aria-checked'),'true');
   const price=await row.locator('.pp-new-price').textContent();assert.ok((await page.locator('.product-detail-summary').textContent()).includes(price));
  }
  assert.ok(await page.locator('#pp-order-btn').evaluate(e=>e.getBoundingClientRect().height>=44));
  if(artifact && required.includes(p.id)&&[320,390,1440].includes(w))await page.screenshot({path:path.join(artifact,`after-${p.id}-${w}-${h}.png`),fullPage:true});
  checks.push({id:p.id,viewport:`${w}x${h}`,imageHeight:g.media.height,orderButtonTop:g.actions.y,overflow:0,scale:1});
 }
 if(missing.size)console.log('MISSING_LOCAL_ASSETS',JSON.stringify([...missing]));
 assert.equal(writes,0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({comparison,checks,productsAt390:22,newConsoleErrors:errors,inheritedAsset404s:[...inheritedAsset404s],productionWrites:writes},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
