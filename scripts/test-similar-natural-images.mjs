import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const mode=process.argv[2]||'preview',out=path.resolve('outputs/similar-natural-images');await fs.mkdir(out,{recursive:true});
const state=extractAdminState(await fs.readFile('app.js','utf8')),products=state.products.filter(p=>p.active!==false),results=[];
for(const engine of mode==='before'?[chromium]:[chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of [1024,1440,1920]){
  const context=await browser.newContext({viewport:{width,height:1080},serviceWorkers:'block'});
  await context.route('**/*',async r=>{
   const req=r.request(),u=new URL(req.url());
   if(mode==='preview'&&u.pathname==='/product-page.css')return r.fulfill({contentType:'text/css',body:await fs.readFile('product-page.css','utf8')});
   if(!['GET','HEAD'].includes(req.method()))return r.abort();
   if(u.pathname.startsWith('/api/'))return r.fulfill({json:{items:[],products:[],profile:null}});
   return r.continue();
  });
  const page=await context.newPage();
  for(const product of mode==='before'?products.filter(p=>p.id==='netflix'):products){
   await page.goto('https://mirpanel.com/mehsul/'+product.seoSlug,{waitUntil:'domcontentloaded'});
   const images=page.locator('.product-page-similar-image');await images.first().waitFor();
   const data=await images.evaluateAll(async nodes=>{
    await Promise.all(nodes.map(async n=>{n.loading='eager';await n.decode();}));
    return nodes.map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {src:new URL(n.src).pathname,natural:[n.naturalWidth,n.naturalHeight],box:[r.width,r.height],padding:s.padding,background:s.backgroundColor,fit:s.objectFit,radius:s.borderRadius};});
   });
   assert(data.length>0&&data.length<=products.length-1);
   if(mode!=='before')for(const image of data){
    assert(image.natural[0]>0&&image.natural[1]>0);
    assert(Math.abs(image.box[0]/image.box[1]-image.natural[0]/image.natural[1])<.01,JSON.stringify({product:product.id,width,image}));
    assert.equal(image.padding,'0px');assert.equal(image.background,'rgba(0, 0, 0, 0)');assert.equal(image.fit,'contain');assert.equal(image.radius,'9px');
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
   if(product.id==='netflix')await page.locator('.product-page-similar').screenshot({path:path.join(out,`${mode}-${engine.name()}-${width}.png`)});
   results.push({product:product.id,width,engine:engine.name(),images:data});
  }
  console.log('PASS',mode,engine.name(),width);await context.close();
 }}finally{await browser.close();}
}
await fs.writeFile(path.join(out,mode+'.json'),JSON.stringify(results,null,2));
console.log('Read-only image checks:',results.length,'product-page/viewport cases.');
