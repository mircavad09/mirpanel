import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const origin=process.env.SHORTCUT_ORIGIN||'https://mirpanel.com',label=process.argv[2]||'live';
const inspect=()=>({allImages:document.images.length,cards:[...document.querySelectorAll('#grid .img')].map(n=>({alt:n.getAttribute('alt')})),links:[...document.querySelectorAll('#homeQuickLinks a')].map(n=>({product:n.dataset.quickProduct,name:n.textContent.trim(),accessibleLabel:n.getAttribute('aria-label'),href:n.getAttribute('href'),tabIndex:n.tabIndex,duplicate:!!n.closest('.home-quick-group[aria-hidden="true"]'),imageAlt:n.querySelector('img')?.getAttribute('alt'),imageRole:n.querySelector('img')?.getAttribute('role'),logoHidden:n.querySelector('.home-quick-logo')?.getAttribute('aria-hidden')}))});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[];
try{
 const response=await fetch(origin+'/',{signal:AbortSignal.timeout(25000)}),html=await response.text();assert.equal(response.status,200);
 const context=await browser.newContext({javaScriptEnabled:false});const initial=await context.newPage();await initial.setContent(html);results.push({mode:'initial',...await initial.evaluate(inspect),accessibleLinks:await initial.locator('#homeQuickLinks').getByRole('link').count()});await context.close();
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/',{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>!!document.querySelector('#homeQuickLinks a[data-quick-product]'));
  const strip=page.locator('#homeQuickLinks'),snapshot=await page.evaluate(inspect);
  const session=await page.context().newCDPSession(page);const {root}=await session.send('DOM.getDocument');const {nodeId}=await session.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#homeQuickLinks'});
  const ax=await session.send('Accessibility.queryAXTree',{nodeId});const axLinks=ax.nodes.filter(n=>!n.ignored&&n.role?.value==='link').map(n=>n.name?.value);assert.equal(axLinks.length,6);
  await strip.locator('.home-quick-group').first().locator('a').first().focus();const keyboard=[];for(let i=0;i<6;i++){keyboard.push(await page.evaluate(()=>({id:document.activeElement.dataset.quickProduct,duplicate:!!document.activeElement.closest('.home-quick-group[aria-hidden="true"]')})));await page.keyboard.press('Tab');}assert(keyboard.every(n=>!n.duplicate));
  results.push({mode:'hydrated',width,...snapshot,accessibleLinks:await strip.getByRole('link').count(),accessibleImages:await strip.getByRole('img').count(),axLinks,keyboard,errors});assert.deepEqual(errors,[]);await page.close();
 }
 for(const r of results){assert.equal(r.links.length,12);assert.equal(r.accessibleLinks,6);assert(r.links.every(n=>n.imageAlt===''&&n.imageRole==='presentation'&&n.logoHidden==='true'));assert(r.links.slice(6).every(n=>n.duplicate&&n.tabIndex===-1));assert(r.cards.every(n=>n.alt?.trim()));}
 assert.deepEqual(results[0].links,results[1].links);assert.deepEqual(results[0].links,results[2].links);
 fs.mkdirSync('outputs/seo',{recursive:true});fs.writeFileSync('outputs/seo/shortcuts-'+label+'.json',JSON.stringify({at:new Date().toISOString(),origin,results},null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
