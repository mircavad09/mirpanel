// Anonymous read-only live checks. No carts, orders, reservations or payments.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='outputs/instant-category-filter';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),report=[];
try{for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(30000);
 for(const route of ['/?delivery=instant','/mehsul?delivery=instant']){
  await page.goto('https://mirpanel.com'+route,{waitUntil:'domcontentloaded'});
  const selector=route.startsWith('/?')?'#grid':'.catalog-grid';
  await page.waitForFunction(s=>{const n=document.querySelector(s);return n?.querySelector('[data-instant-plan]')||n?.textContent.includes('Hazırda anında təhvil verilən hesab yoxdur');},selector);
  const cards=await page.locator(selector+' [data-instant-plan]').evaluateAll(ns=>ns.map(n=>({product:n.dataset.productId,plan:Number(n.dataset.instantPlan),title:n.querySelector('.title').textContent,price:n.querySelector('.homeCardPrices strong').textContent,href:n.querySelector('.homeCardOrder').getAttribute('href')})));
  for(const card of cards){assert(card.href.endsWith('?plan='+card.plan));assert(card.title.includes(' — '));assert(!/undefined|null/.test(card.title));}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const filter=page.locator(route.startsWith('/?')?'.home-filter-tabs':'.catalog-filter-tabs');await filter.scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/live-${route.startsWith('/?')?'home':'listing'}-${width}.png`});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(s=>{const n=document.querySelector(s);return n?.querySelector('[data-instant-plan]')||n?.textContent.includes('Hazırda anında təhvil verilən hesab yoxdur');},selector);
  assert.equal(new URL(page.url()).searchParams.get('delivery'),'instant');
  report.push({width,route,cards,refreshed:true,overflow:false});
 }
 await page.goto('https://mirpanel.com/');const tabs=page.locator('.home-filter-tabs');await tabs.getByText('Hamısı',{exact:true}).waitFor();
 const category=tabs.locator('[data-home-filter="design"]');if(await category.count()){await category.click();await page.waitForFunction(()=>[...document.querySelectorAll('#grid [data-product-id]')].every(n=>['capcut','canva'].includes(n.dataset.productId)));}
 await page.close();
}console.log(JSON.stringify(report,null,2));fs.writeFileSync(out+'/live-report.json',JSON.stringify(report,null,2));}
finally{await browser.close();}
