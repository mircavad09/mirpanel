// Read-only business verification; only authentication login/logout may write.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const key=fs.readFileSync(path.join(process.env.USERPROFILE,'.render/cli.yaml'),'utf8').match(/^\s*key:\s*(.+)$/m)[1].trim().replace(/^['"]|['"]$/g,'');
const response=await fetch('https://api.render.com/v1/services/srv-d8ead74m0tmc73emhsvg/env-vars?limit=100',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});
assert(response.ok,'Render read access required');
const config=Object.fromEntries((await response.json()).map(x=>[x.envVar.key,x.envVar.value]));
assert(config.ADMIN_USERNAME&&config.ADMIN_PASSWORD,'Admin login unavailable');
const base='https://mirpanel.onrender.com';
const request=(p,options={})=>fetch(base+p,{...options,signal:AbortSignal.timeout(60000),redirect:'manual'});
let cookie,csrf,browser;
try{
 const login=await request('/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:config.ADMIN_USERNAME,password:config.ADMIN_PASSWORD})});
 config.ADMIN_PASSWORD='';assert.equal(login.status,200,'Admin login must succeed');
 cookie=login.headers.get('set-cookie').split(';')[0];
 const session=await(await request('/api/session',{headers:{Cookie:cookie}})).json();csrf=session.csrfToken;
 const started=Date.now();
 const gamesResult=await(await request('/api/admin/api-integrations?view=epinby-catalog&gamesOnly=true',{headers:{Cookie:cookie}})).json();
 const gamesMs=Date.now()-started;assert(!gamesResult.error,gamesResult.error||'Games response failed');assert(gamesResult.games.length>0);
 const result=await request('/api/admin/api-integrations?view=epinby-catalog&page=1',{headers:{Cookie:cookie}});
 assert.equal(result.status,200);
 const data=await result.json();
 assert(!data.error,data.error||'');
 assert.equal(data.connection.lastStatus,'confirmed');
 assert.equal(data.connection.currency,'USD');
 assert(data.products.length>0,'Real catalog must contain products');
 assert(data.meta.lastPage>0);assert(data.meta.total>=data.products.length);
 const game=gamesResult.games[0];
 const categories=await(await request('/api/admin/api-integrations?view=epinby-categories&gameId='+game.id,{headers:{Cookie:cookie}})).json();
 assert(!categories.error,categories.error||'');
 assert(Array.isArray(categories.categories));
 console.log(JSON.stringify({realCatalog:true,loadedProducts:data.products.length,total:data.meta.total,pages:data.meta.lastPage,games:gamesResult.games.length,gamesMs,categories:categories.categories.length,currency:'USD',businessWrites:0}));
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:950}});
  const [name,value]=cookie.split('=');
  await context.addCookies([{name,value,url:base,httpOnly:true,secure:true,sameSite:'Strict'}]);
  const page=await context.newPage();
  await page.route('**/*',r=>r.request().method()==='GET'?r.continue():r.abort());
  await page.goto(base+'/admin.html#gameProducts');
  await page.locator('#gameCatalogProducts .gameCatalogProduct').first().waitFor({timeout:60000});
  assert(await page.locator('#gameProductsView').isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#gameCatalogFilters [name=search]').fill(data.products[0].name);
  assert(await page.locator('#gameCatalogProducts .gameCatalogProduct:visible').count()>0);
  await page.locator('#gameCatalogFilters button[type=reset]').click();
  fs.mkdirSync('outputs/game-products-live',{recursive:true});
  await page.screenshot({path:'outputs/game-products-live/catalog-'+width+'.png',fullPage:width===390});
  console.log(JSON.stringify({width,authenticatedAdmin:true,realCatalogVisible:true,search:true,writes:0}));
  await context.close();
 }
}finally{
 if(browser)await browser.close();
 if(cookie&&csrf)await request('/api/logout',{method:'POST',headers:{Cookie:cookie,Origin:base,'X-CSRF-Token':csrf}});
}
