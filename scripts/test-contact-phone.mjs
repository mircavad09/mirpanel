import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const live=process.argv.includes('--live');
const data=extractAdminState(fs.readFileSync('app.js','utf8'));
assert.equal(data.cms.site.whatsappNumber,'994514113545');
assert.equal(data.cms.site.phoneDisplay,'051 411 35 45');
assert.equal(data.cms.footer.whatsapp,'994514113545');
const server=live?null:http.createServer((req,res)=>{
 const url=new URL(req.url,'http://test');
 if(url.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({products:[],banners:[],stories:[],open:false,managed:true}));}
 const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
 if(!file.includes('..')&&fs.existsSync(file)&&fs.statSync(file).isFile()){
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html; charset=utf-8');return res.end(fs.readFileSync(file));}
 res.writeHead(404);res.end();
});
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=live?'https://mirpanel.com':`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  if(!live)await page.route('https://**/*',r=>r.abort());
  for(const route of ['/','/elaqe']){
   await page.goto(origin+route,{waitUntil:'domcontentloaded'});
   await page.locator('#customerFooter a[href="tel:+994514113545"]').waitFor();
   await page.locator('#waFab[href^="https://wa.me/994514113545"]').waitFor();
   const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')).filter(h=>/wa.me|tel:/.test(h)));
   assert(links.some(h=>h==='tel:+994514113545'));
   assert(links.filter(h=>h.includes('wa.me')).every(h=>new URL(h).pathname==='/994514113545'),JSON.stringify(links));
   assert(!/524\s*35\s*45/.test(await page.locator('body').innerText()));
   if(route==='/'){
    const schema=await page.locator('script[type="application/ld+json"]').allTextContents();
    assert(schema.some(s=>s.includes('"telephone":"+994514113545"')));
   }
   results.push({width,route,links:links.length,ok:true});
  }
  await page.close();
 }
 console.log(JSON.stringify({live,results}));
}finally{await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
