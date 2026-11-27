// Full local product pages; inventory responses are fixtures. No external writes.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';
import {extractAdminState,patchAppSource} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const state=extractAdminState(fs.readFileSync('app.js','utf8')),base=state.products.find(p=>p.id==='capcut');
const fixtures=[1,4,5,14].map(n=>({...structuredClone(base),id:'fixture_'+n,title:n+' paket · Sınaq məhsulu',seoSlug:'fixture-'+n,active:true,flow:'whatsapp',soldOut:false,stockEnabled:true,plans:Array.from({length:n},(_,i)=>({id:'fixture-plan-'+i,label:i===1?'Uzun paket adı — fərqli imkanları və əlavə istifadə seçimlərini əhatə edən şəxsi paket':(i+1)+' aylıq',months:i+1,price:+(1.23+i*7.12).toFixed(2),...(i===0?{regularPrice:12.23}:{}),...(i%2===0?{warrantyMode:'guaranteed',warrantyUnit:'day',warrantyDuration:6}:{}),active:true}))}));
state.products.push(...fixtures);const cases=[...fixtures,...['capcut','free_fire','mobile_legends'].map(id=>state.products.find(p=>p.id===id))];
const pages=generateProductPageFiles(state.products,state.siteSections,state.cms,state.content),app=patchAppSource(fs.readFileSync('app.js','utf8'),state),out='../../outputs/product-plan-scroll-20261127';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local');let file=u.pathname.slice(1);if(file.startsWith('mehsul/')&&!path.extname(file))file+='.page';if(file.startsWith('community-assets/'))file='mirpanel-admin/community/public/'+file.slice(17);try{const body=file==='app.js'?app:pages.get(file)??fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.page')?'text/html; charset=utf-8':/\.(m?js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(body);}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let checks=0,writes=0;const results=[],eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
try{for(const [engineName,engine]of [['chrome',chromium],['webkit',webkit]].filter(([name])=>!process.env.PLAN_TEST_ENGINE||process.env.PLAN_TEST_ENGINE===name)){const browser=await engine.launch(engineName==='chrome'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});try{for(const width of [320,390,430,1440].filter(w=>!process.env.PLAN_TEST_WIDTH||Number(process.env.PLAN_TEST_WIDTH)===w))for(const product of cases.filter(p=>!process.env.PLAN_TEST_PRODUCT||process.env.PLAN_TEST_PRODUCT===p.id)){
 const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<768}),page=await context.newPage(),errors=[];page.setDefaultTimeout(18000);page.on('pageerror',e=>{if(!e.message.includes('ResizeObserver loop'))errors.push(e.message);});
 await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.pathname==='/api/payments/shop/quote')return route.fulfill({json:{}});if(!['GET','HEAD'].includes(r.method())){writes++;return route.abort();}if(u.pathname==='/api/payments/inventory')return route.fulfill({json:{products:cases.map(p=>({productId:p.id,scope:'plan',plans:p.plans.map((_,i)=>({planKey:String(i),tracked:true,available:p.id.startsWith('fixture_')&&i===2?0:25}))}))}});if(u.pathname.startsWith('/api/'))return route.fulfill({json:{}});if(u.origin!==origin)return route.abort();return route.continue();});
 await page.goto(origin+'/mehsul/'+product.seoSlug);await page.locator('#pp-plans-container[data-plan-scroll]').waitFor();await page.waitForTimeout(250);
 const rows=page.locator('#pp-plans-container .pp-plan-label'),box=page.locator('#pp-plans-container'),shell=page.locator('.product-plan-scroll'),count=product.plans.filter(p=>p.active!==false).length;
 const original=await page.evaluate(()=>JSON.stringify(currentProduct.plans));eq(await rows.count(),product.plans.length);eq(await shell.evaluate(n=>n.classList.contains('has-overflow')),count>4);eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 eq(await page.locator('.product-page-actions').evaluate(n=>!n.closest('.product-plan-scroll')),true);
 const orderBefore=await page.evaluate(()=>currentPlanIdx);await rows.last().hover({force:true});eq(await page.evaluate(()=>currentPlanIdx),orderBefore,'hover must not select');
 const beforeHeight=await shell.evaluate(n=>n.getBoundingClientRect().height);
 if(count>4){
  eq(await page.locator('.product-plan-thumb').isVisible(),true,'persistent gold scrollbar');
  await box.evaluate(n=>{n.scrollTop=0;});await page.waitForFunction(()=>{const n=document.querySelector('#pp-plans-container'),b=n.getBoundingClientRect().bottom,below=[...n.children].filter(r=>!r.hidden&&r.getBoundingClientRect().bottom>b+2).length,more=document.querySelector('.product-plan-more');return more.textContent===`Daha ${below} paket ↓`&&getComputedStyle(more).visibility===(below?'visible':'hidden');});
  const expected=await box.evaluate(n=>{const bottom=n.getBoundingClientRect().bottom;return [...n.children].filter(r=>!r.hidden&&r.getBoundingClientRect().bottom>bottom+2).length;});eq(await page.locator('.product-plan-more').innerText(),`Daha ${expected} paket ↓`);
  await page.locator('.product-plan-more').click();await page.waitForTimeout(350);eq(await box.evaluate(n=>n.scrollTop>0),true);eq(await page.evaluate(()=>currentPlanIdx),orderBefore,'scroll control must not select');
  eq(Math.abs(await shell.evaluate(n=>n.getBoundingClientRect().height)-beforeHeight)<2,true,'viewport must stay compact');
 }else eq(await page.locator('.product-plan-more').isVisible(),false);
 const lastIndex=product.plans.map((p,i)=>({p,i})).filter(x=>x.p.active!==false).at(-1).i;await rows.nth(lastIndex).click();await page.waitForTimeout(230);eq(await page.evaluate(()=>currentPlanIdx),lastIndex);
 eq(await rows.locator('.pp-plan-meta:visible').count()<=1,true);eq(await rows.filter({has:page.locator('.pp-plan-meta:visible')}).count()<=1,true);
 eq(await page.locator('.product-detail-summary').innerText().then(t=>t.includes(Number(product.plans[lastIndex].price).toFixed(2).replace('.',','))),true,'summary must match selected package');
 const layout=await rows.nth(lastIndex).evaluate(n=>{const name=n.querySelector('.pp-plan-name').getBoundingClientRect(),price=n.querySelector('.pp-plan-right').getBoundingClientRect();return {nameRight:name.right,priceLeft:price.left,overflow:n.scrollWidth>n.clientWidth};});eq(layout.overflow,false);eq(layout.nameRight<=layout.priceLeft+1,true);
 if(product.id.startsWith('fixture_')&&count>1){
  await rows.nth(1).click();eq(await rows.nth(1).locator('.plan-fact-warranty').count(),0,'no invented warranty');
  if(count>=4){eq(await rows.nth(2).getAttribute('aria-disabled'),'true');const selected=await page.evaluate(()=>currentPlanIdx);await rows.nth(2).click({force:true});eq(await page.evaluate(()=>currentPlanIdx),selected,'out-of-stock row must not select');}
 }
 const selectable=await rows.evaluateAll(ns=>ns.map((n,i)=>({i,ok:!n.hidden&&n.getAttribute('aria-disabled')!=='true'})).filter(x=>x.ok).map(x=>x.i));const selected=page.locator('#pp-plans-container .pp-plan-label.active');await selected.focus();await page.keyboard.press('End');eq(await page.evaluate(()=>currentPlanIdx),selectable.at(-1));await page.keyboard.press('Home');eq(await page.evaluate(()=>currentPlanIdx),selectable[0]);await page.keyboard.press('ArrowDown');eq(await page.evaluate(()=>currentPlanIdx),selectable[1]??selectable[0]);
 eq(await page.evaluate(()=>document.activeElement?.matches('.pp-plan-label')),true);
 if(count>4){
  await page.waitForTimeout(250);await box.evaluate(n=>{n.scrollTop=n.scrollHeight;});await page.waitForFunction(()=>{const n=document.querySelector('#pp-plans-container');return n.scrollTop+n.clientHeight>=n.scrollHeight-2&&document.querySelector('.product-plan-scroll-controls button:last-child').disabled;});eq(await page.locator('.product-plan-scroll-controls button').last().isDisabled(),true);eq(await page.locator('.product-plan-more').evaluate(n=>getComputedStyle(n).visibility),'hidden');
  await page.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='1000px';spacer.dataset.testScrollRoom='';document.body.append(spacer);});
  await box.evaluate(n=>scrollTo({top:scrollY+n.getBoundingClientRect().top-130,behavior:'instant'}));await page.waitForTimeout(250);
  await page.mouse.move(...await box.evaluate(n=>{const r=n.getBoundingClientRect();return [r.x+20,r.y+40];}));const y=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,450);await page.waitForTimeout(350);
  // A final fractional pixel may consume the first wheel tick; another native
  // gesture at the boundary must chain to the page, without custom wheel logic.
  if(await page.evaluate(()=>scrollY)<=y){await page.waitForTimeout(150);await page.mouse.wheel(0,450);await page.waitForTimeout(350);}
  eq(await page.evaluate(()=>scrollY)>y,true,'page must scroll after package-list end');
  if(engineName==='chrome'&&width===390&&product.id==='fixture_14'){
   await box.scrollIntoViewIfNeeded();await box.evaluate(n=>n.scrollTop=0);const cdp=await context.newCDPSession(page),r=await box.boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+80,y:r.y+170}]});for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+80,y:r.y+170-i*20}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(180);eq(await box.evaluate(n=>n.scrollTop>0),true,'native emulated touch pan');
  }
 }
 await page.emulateMedia({reducedMotion:'reduce'});eq(await box.evaluate(n=>getComputedStyle(n).scrollBehavior),'auto');eq(await page.evaluate(()=>JSON.stringify(currentProduct.plans)),original);eq(errors,[]);
 if(product.id==='fixture_14'&&(width===390||width===1440)){await box.evaluate(n=>n.scrollTop=0);await rows.first().click();await shell.evaluate(n=>scrollBy(0,n.getBoundingClientRect().top-110));await page.waitForTimeout(220);await page.screenshot({path:out+'/'+engineName+'-fixture-'+width+'.png'});await shell.screenshot({path:out+'/'+engineName+'-packages-'+width+'.png'});}
 results.push({engine:engineName,width,product:product.id,count,passed:true});await context.close();console.log('PASS',engineName,width,product.id);
 }}finally{await browser.close();}}
 eq(writes,0);fs.writeFileSync(out+'/test-results.json',JSON.stringify({checks,writes,results},null,2));console.log(JSON.stringify({checks,writes,cases:results.length}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
