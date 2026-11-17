import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import shortcuts from '../home-shortcuts.js';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {patchHomeCatalog} from '../mirpanel-admin/product-pages.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const app=fs.readFileSync('app.js','utf8'),state=extractAdminState(app),home=patchHomeCatalog(fs.readFileSync('index.html','utf8'),state.products);
const nav=home.match(/<nav class="home-quick-links"[\s\S]*?<\/nav>/)[0];
const runtime=app.slice(app.indexOf('function productSlugForHome('),app.indexOf('function buildTabs('));
const expected=[...state.products.filter(p=>p.active!==false)].sort((a,b)=>{
 const ids=['youtube','netflix','capcut','spotify'],rank=p=>ids.includes(p.id)?ids.indexOf(p.id):100;
 return rank(a)-rank(b);
}).slice(0,6);
assert.equal(shortcuts.presentation({id:'netflix_umumi',title:'Netflix Ümumi',image:'/x'}).title,'Netflix Ümumi');
const server=http.createServer((req,res)=>{
 if(req.url.startsWith('/home-shortcuts.js')){res.setHeader('content-type','text/javascript');return res.end(fs.readFileSync('home-shortcuts.js'));}
 if(req.url.startsWith('/assets/')||req.url.startsWith('/uploads/')){res.setHeader('content-type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10"/></svg>');}
 res.setHeader('content-type','text/html;charset=utf-8');
 if(req.url.startsWith('/mehsul/'))return res.end('<h1>Product navigation fixture</h1>');
 res.end('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>.home-quick-group{display:flex;gap:8px}.home-quick-link{display:flex;align-items:center;min-height:44px}.home-quick-link img{width:24px;height:24px}</style><button id="before">Əvvəl</button>'+nav+'<button id="after">Sonra</button>'+(req.url==='/runtime'?'<script src="/home-shortcuts.js"></script><script>const DATA='+JSON.stringify(state)+';'+runtime+'renderHomeDiscovery();</script>':''));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const pairs=[];
try{for(const engine of [chromium,webkit]){const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});try{for(const width of [390,1440]){
 const snapshots=[];
 for(const mode of ['initial','runtime']){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/'+mode);
  const strip=page.locator('#homeQuickLinks');assert.equal(await strip.locator('img').count(),12);
  // Role/name checks inspect the accessibility representation, not just presence of alt.
  assert.equal(await strip.getByRole('link').count(),6);assert.equal(await strip.getByRole('link',{includeHidden:true}).count(),12);assert.equal(await strip.getByRole('img').count(),0);
  assert.equal(await strip.locator('img:not([alt=""])').count(),0);assert.equal(await strip.locator('img:not([role="presentation"])').count(),0);
  for(const p of expected){const name=shortcuts.presentation(p).title;await strip.getByRole('link',{name,exact:true}).waitFor({state:'attached'});}
  const snapshot=await strip.locator('a').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.quickProduct,href:n.getAttribute('href'),name:n.textContent.trim(),label:n.getAttribute('aria-label'),logo:n.querySelector('img')?.getAttribute('src'),alt:n.querySelector('img')?.getAttribute('alt'),role:n.querySelector('img')?.getAttribute('role'),hidden:Boolean(n.closest('[aria-hidden="true"]')),tab:n.tabIndex})));
  assert(snapshot.slice(0,6).every(n=>!n.hidden&&n.tab===0));assert(snapshot.slice(6).every(n=>n.hidden&&n.tab===-1));
  await page.locator('#before').focus();for(const p of expected){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.quickProduct),p.id,JSON.stringify({engine:engine.name(),width,mode,active:await page.evaluate(()=>document.activeElement.outerHTML)}));}
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'after');
  // The visual duplicate remains a working pointer link; it is not made inert.
  const target=snapshot[6].href;await strip.locator('.home-quick-group[aria-hidden="true"] a').first().click();await page.waitForURL('**'+target);assert.equal(new URL(page.url()).pathname,target);
  assert.deepEqual(errors,[]);snapshots.push(snapshot);await page.close();
 }
 assert.deepEqual(snapshots[0],snapshots[1]);pairs.push({engine:engine.name(),width,images:12,accessibleLinks:6,accessibleImages:0,keyboardDuplicates:0,initialMatchesRuntime:true,duplicatePointerLink:true});
}}finally{await browser.close();}}}finally{server.close();}
console.log(JSON.stringify(pairs,null,2));
