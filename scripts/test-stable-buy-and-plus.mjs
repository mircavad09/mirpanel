import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';
const root=path.resolve(import.meta.dirname,'..'),live=process.argv.includes('--live'),before=process.argv.includes('--before');
const state=extractAdminState(await fs.readFile(path.join(root,'app.js'),'utf8'));
const pages=generateProductPageFiles(state.products,state.siteSections,state.cms,state.content);
const out=path.join(root,'outputs/stable-buy-plus');await fs.mkdir(out,{recursive:true});
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://local');let file=u.pathname==='/'?'index.html':u.pathname==='/mehsul'?'mehsul.page':u.pathname.slice(1);
 const page=pages.get(file+'.page');if(page){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(page);}
 if(file.startsWith('community-assets/'))file='mirpanel-admin/community/public/'+file.slice(17);
 const name=path.resolve(root,file);if(!name.startsWith(root+path.sep))throw Error();
 res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.page':'text/html; charset=utf-8','.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'})[path.extname(name)]||'application/octet-stream');res.end(await fs.readFile(name));
 }catch{res.writeHead(404);res.end();}});
if(!live)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=live?'https://mirpanel.com':`http://127.0.0.1:${server.address().port}`,results=[];
try{for(const engine of before?[chromium]:[chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of before?[390,1440]:[320,390,430,1440]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',...(width===390&&engine===chromium?{recordVideo:{dir:out,size:{width:390,height:900}}}:{})});
  const quotes=[],errors=[];
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.pathname==='/api/payments/inventory'){await new Promise(r=>setTimeout(r,800));return route.fulfill({json:{products:state.products.map(p=>({productId:p.id,scope:'product',salePaused:false,unlimited:true,available:20,canOrder:true,plans:p.plans.map((v,i)=>({planKey:String(i),available:20,canOrder:true,tracked:false}))}))}});}
   if(u.pathname==='/api/payments/shop/quote'){
    const item=req.postDataJSON().items[0],p=state.products.find(p=>p.id===item.productId),plan=p.plans[item.planIndex];quotes.push(item);
    return route.fulfill({json:{items:[{...item,terms:'Sintetik istifadə qaydası',termsVersion:'test-v1',fields:[],planName:plan.label,unitCents:Math.round(plan.price*100)}]}});
   }
   if(u.pathname==='/api/product-sales')return route.fulfill({json:{initialized:false}});
   if(u.pathname.startsWith('/api/'))return route.fulfill({json:{items:[],products:[],profile:null}});
   if(!['GET','HEAD'].includes(req.method()))return route.abort();
   if(u.origin!==origin)return route.abort();
   // Deliberately expose the HTML first frame, before deferred JS and API replies.
   if(req.resourceType()==='script')await new Promise(r=>setTimeout(r,250));
   return route.continue();
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
   window.buyFrames=[];const read=()=>{const b=document.getElementById('pp-order-btn');if(b){const t=b.textContent.trim();if(window.buyFrames.at(-1)!==t)window.buyFrames.push(t);}};
   new MutationObserver(read).observe(document,{subtree:true,childList:true,characterData:true});
  });
  for(const id of process.argv.includes('--cards-only')?[]:['telegram_premium','capcut','netflix','spotify']){
   const product=state.products.find(p=>p.id===id)||state.products.find(p=>id==='telegram_premium'&&/telegram/i.test(p.title));if(!product)throw Error('Missing '+id);
   for(const visit of ['cold','repeat']){
    await p.goto(origin+'/mehsul/'+product.seoSlug,{waitUntil:'commit'});
    await p.locator('#pp-order-btn').waitFor({state:'attached'});
    await p.waitForFunction(()=>{const e=document.querySelector('#pp-order-btn');return e&&getComputedStyle(e).borderRadius!=='0px';});
    const initial=await p.locator('#pp-plans-container .pp-plan-label, [data-static-product-plans] > div').evaluateAll(rows=>rows.map(e=>({height:e.getBoundingClientRect().height,name:e.textContent.trim(),html:e.outerHTML,style:getComputedStyle(e).cssText,font:getComputedStyle(e).font,notes:e.querySelector('.product-detail-plan-notes')?.getBoundingClientRect().height})));
    await p.waitForFunction(()=>document.getElementById('productPageView')?.dataset.detailEnhanced==='true');
    await p.waitForTimeout(1200);
    const frames=await p.evaluate(()=>window.buyFrames),final=await p.locator('#pp-plans-container .pp-plan-label').evaluateAll(rows=>rows.map(e=>({height:e.getBoundingClientRect().height,name:e.textContent.trim(),html:e.outerHTML,font:getComputedStyle(e).font,notes:e.querySelector('.product-detail-plan-notes')?.getBoundingClientRect().height})));
    if(initial.some((r,i)=>Math.abs(r.height-(final[i]?.height||0))>=2))await fs.writeFile(path.join(out,'layout-debug.json'),JSON.stringify({initial,final,state:await p.evaluate(()=>window.MirpanelInventory?.productState(currentProduct))},null,2));
    if(!before){assert.deepEqual(frames,['İndi al'],`${id} ${width} ${visit}`);assert.equal(initial.length,final.length);initial.forEach((row,i)=>assert(Math.abs(row.height-final[i].height)<2,`${id} initial/final row ${i}: ${row.height} -> ${final[i].height}`));}
    const rows=p.locator('#pp-plans-container .pp-plan-label');
    const index=Math.max(0,product.plans.findLastIndex(plan=>plan.active!==false));await rows.nth(index).click();
    if(!before)assert.equal(await p.locator('#pp-order-btn').innerText(),'İndi al');
    await p.evaluate(()=>window.dispatchEvent(new Event('focus')));
    if(!before&&await p.locator('#pp-order-btn').isEnabled()){
     await p.locator('#pp-order-btn').click();await p.waitForTimeout(400);
     const request=quotes.filter(q=>q.productId===product.id).at(-1);assert.equal(request?.planIndex,index,'selected plan sent to quote');
     await p.keyboard.press('Escape');
    }
    results.push({engine:engine.name(),width,id,visit,frames,initial:initial.map(r=>r.height),final:final.map(r=>r.height)});
   }
  }
  if(width<768){for(const url of ['/','/mehsul']){
   await p.goto(origin+url,{waitUntil:'domcontentloaded'});await p.locator('.homeProductCard').first().waitFor();await p.waitForTimeout(900);
   const data=await p.locator('.homeProductCard').evaluateAll(cards=>cards.slice(0,8).map(card=>{
    const b=card.querySelector('.homeCardAdd')||card.querySelector('.homeCardOrder'),s=b.querySelector('span'),r=b.getBoundingClientRect(),v=s.getBoundingClientRect(),price=card.querySelector('.homeCardPrices').getBoundingClientRect();
    return {touch:[r.width,r.height],visible:[v.width,v.height],font:getComputedStyle(s).fontSize,overlap:price.right>r.left+1};
   }));
   if(!before)for(const row of data){assert(row.touch[0]>=44&&row.touch[1]>=44);assert.deepEqual(row.visible,[36,36]);assert.equal(row.font,'22px');assert(!row.overlap);}
   if(!before){
    const card=p.locator('.homeProductCard').first();
    await card.locator('.title').evaluate(e=>e.textContent='Uzun məhsul adı — Premium ailə abunəliyi');
    await card.locator('.homeCardPrices strong').evaluate(e=>e.textContent='9 999,99 ₼');
    const fits=await card.evaluate(c=>{const p=c.querySelector('.homeCardPrices strong').getBoundingClientRect(),b=(c.querySelector('.homeCardAdd')||c.querySelector('.homeCardOrder')).getBoundingClientRect();return p.right<=b.left+1&&c.scrollWidth<=c.clientWidth;});assert(fits,'long name / large price');
   }
   await p.locator('.homeProductCard').first().evaluate(e=>window.scrollTo({top:scrollY+e.getBoundingClientRect().top-125,behavior:'instant'}));
   await p.screenshot({path:path.join(out,`${before?'before':live?'live':'local'}-${engine.name()}-${width}-${url==='/'?'home':'catalog'}.png`)});
  }}
  assert.deepEqual(errors.filter(e=>!e.startsWith('ResizeObserver loop completed')),[]);await context.close();
  console.log('PASS',live?'live':'local',engine.name(),width);
 }}finally{await browser.close();}
}}finally{if(!live)await new Promise(r=>server.close(r));}
await fs.writeFile(path.join(out,(before?'before':live?'live':'local')+'.json'),JSON.stringify(results,null,2));
console.log('No real orders, reservations or payments. API responses are isolated fixtures.');
