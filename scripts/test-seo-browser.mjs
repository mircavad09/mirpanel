import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const state=extractAdminState(fs.readFileSync('app.js','utf8')),products=state.products.filter(p=>p.active!==false);
const pages=generateProductPageFiles(state.products,state.siteSections,state.cms,state.content),live=process.argv.includes('--live');
const out='outputs/seo';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 try{
  const u=new URL(req.url,'http://local');let file=u.pathname==='/'?'index.html':u.pathname==='/mehsul'?'mehsul.page':u.pathname.slice(1);
  if(file.startsWith('community-assets/'))file='mirpanel-admin/community/public/'+file.slice(17);
  const name=path.resolve(file);if(!name.startsWith(process.cwd()+path.sep))throw Error();
  const generated=pages.get(file+'.page');
  res.setHeader('Content-Type',generated?'text/html; charset=utf-8':({'.html':'text/html','.page':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(name)]||'application/octet-stream');
  res.end(generated??fs.readFileSync(name));
 }catch{res.writeHead(404).end();}
});
if(!live)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=live?'https://mirpanel.com':'http://127.0.0.1:'+server.address().port;
const results=[];
try{
 for(const engine of [chromium,webkit]){
  const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   for(const width of live?[390,1440]:engine===webkit?[390,1440]:[320,390,430,1440]){
    const context=await browser.newContext({viewport:{width,height:950},serviceWorkers:'block'});
    let quote,writes=0;
    await context.route('**/*',async route=>{
     const req=route.request(),u=new URL(req.url());
     if(u.pathname==='/api/payments/shop/quote'){
      const data=req.postDataJSON();quote=data.items?.[0];
      const p=products.find(p=>p.id===quote.productId),plan=p.plans[quote.planIndex];
      return route.fulfill({json:{items:[{...quote,terms:'İzolyasiya edilmiş sınaq şərtləri',termsVersion:'test-seo',fields:[],planName:plan.label,unitCents:Math.round(plan.price*100)}]}});
     }
     if(!['GET','HEAD'].includes(req.method())){writes++;return route.abort();}
     if(!live&&u.pathname==='/api/payments/inventory')return route.fulfill({json:{products:products.map(p=>({productId:p.id,scope:'product',unlimited:true,canOrder:true,available:100,plans:p.plans.map((plan,i)=>({planKey:String(i),tracked:false,available:100,canOrder:true}))}))}});
     if(!live&&u.pathname.startsWith('/api/'))return route.fulfill({json:{products:[],items:[],profile:null}});
     if(!live&&u.origin!==origin)return route.abort();
     return route.continue();
    });
    const page=await context.newPage();page.setDefaultTimeout(15000);
    for(const p of products){
     const started=performance.now();quote=null;
     await page.goto(origin+'/mehsul/'+p.seoSlug,{waitUntil:'domcontentloaded'});
     const title=await page.title();
     await page.locator('#productPageView[data-detail-enhanced]').waitFor();
     assert.equal(await page.title(),title,'Metadata must survive JS hydration');
     assert.equal(await page.locator('h1').count(),1);
     assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),'https://mirpanel.com/mehsul/'+p.seoSlug);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,p.id+' horizontal overflow');
     const plans=page.locator('#pp-plans-container .pp-plan-label');
     const index=p.plans.findLastIndex(p=>p.active!==false);
     await plans.nth(index).click();
     assert.equal(await page.evaluate(()=>currentPlanIdx),index);
     await page.getByText('Giriş və təhvil qaydası',{exact:true}).waitFor();
     let selected=false;
     const button=page.locator('#pp-order-btn');
     assert.equal((await button.textContent()).trim(),'İndi al');
     if(!live||await button.isEnabled()){
      await button.click();await page.waitForTimeout(350);
      if(quote){assert.equal(quote.productId,p.id);assert.equal(quote.planIndex,index);selected=true;}
      await page.keyboard.press('Escape');
     }
     results.push({engine:engine.name(),width,product:p.id,ms:Math.round(performance.now()-started),seo:true,planSelection:true,quoteSelected:selected,mode:live?'live GET / synthetic quote':'isolated'});
     if(width===390&&engine===chromium&&p.id==='netflix'){
      await page.screenshot({path:out+'/'+(live?'live':'local')+'-mobile.png',fullPage:true});
     }
     if(width===1440&&engine===chromium&&p.id==='pubg_mobile')await page.screenshot({path:out+'/'+(live?'live':'local')+'-desktop.png',fullPage:true});
    }
    assert.equal(writes,0,'No purchase or account writes');
    await context.close();console.log(JSON.stringify({engine:engine.name(),width,passed:products.length,realPurchases:0}));
   }
  }finally{await browser.close();}
 }
}finally{if(!live)await new Promise(r=>server.close(r));fs.writeFileSync(out+'/'+(live?'live':'local')+'-browser.json',JSON.stringify(results,null,2));}
