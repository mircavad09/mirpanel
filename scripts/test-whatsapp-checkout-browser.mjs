import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium,webkit}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const id='10001';
const server=http.createServer((req,res)=>{
 if(req.url==='/order-confirmation.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end(fs.readFileSync('order-confirmation.js'));}
 if(req.url!=='/'){res.writeHead(404);return res.end();}
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
 return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><div id="modal"><div class="modalCard"><div id="mForm"></div></div></div>
 <script>window.MirpanelPaymentFlow={recoverSubmitted:async()=>({orderCode:'${id}',statusMessage:'Ödəniş yoxlanılır.',whatsappUrl:'https://wa.me/1234567890?text=fixture',whatsappMessage:'fixture'})};</script>
 <script src="/order-confirmation.js"></script>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
try{
 const engine=process.env.MIRPANEL_BROWSER_ENGINE==='webkit'?webkit:chromium;
 const browser=await engine.launch({headless:true,...(process.env.MIRPANEL_BROWSER_PATH?{executablePath:process.env.MIRPANEL_BROWSER_PATH}:{})});
 try{
  for(const width of [320,390,1440]){
   const page=await browser.newPage({viewport:{width,height:844},isMobile:width<600});
   page.setDefaultTimeout(5000);
   let whatsapp=0,popups=0;
   page.on('popup',()=>popups++);
   await page.route('https://wa.me/**',r=>{whatsapp++;return r.abort();});
   for(const load of [()=>page.goto(origin),()=>page.reload()]){
    await load();
    await page.getByRole('heading',{name:'Sifariş qəbul edildi'}).waitFor();
    await page.getByText('Ödəniş yoxlanılır.',{exact:true}).waitFor();
    assert.equal(await page.getByRole('link',{name:'Sifarişlərimə bax'}).getAttribute('href'),'/profil?tab=orders&order='+id);
    for(const label of ['Məhsullara bax','Ana səhifə'])await page.getByRole('link',{name:label,exact:true}).waitFor();
    assert.equal(new URL(page.url()).origin,origin);assert.equal(whatsapp,0);assert.equal(popups,0);
   }
   await page.close();console.log('PASS '+width+'px — legacy recovery stays on site and links to the matching order');
  }
 }finally{await browser.close();}
}finally{await new Promise(r=>server.close(r));}
