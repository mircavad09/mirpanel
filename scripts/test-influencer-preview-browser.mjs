import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const records=new Map();let sends=0;
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 if(path==='/api/admin/community/influencer-preview'){
  res.setHeader('content-type','application/json');
  if(req.method==='POST'){
   let raw='';for await(const chunk of req)raw+=chunk;const input=JSON.parse(raw);
   if(input.action==='send'){sends++;if(!records.has(input.clientId))records.set(input.clientId,{id:input.clientId,body:input.body,test:true,createdAt:'2026-11-17T09:30:00Z'});}
   if(input.action==='delete')records.delete(input.id);
  }
  return res.end(JSON.stringify({name:'Çiçək Məmmədova',avatarUrl:'/community-assets/avatar-robot.webp',test:true,items:[...records.values()]}));
 }
 if(path==='/influencer-preview.js'||path==='/influencer-preview.css'){
  res.setHeader('content-type',path.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync('mirpanel-admin/public'+path));
 }
 if(path==='/community-assets/avatar-robot.webp'){res.setHeader('content-type','image/webp');return res.end(fs.readFileSync('mirpanel-admin/community/public/avatar-robot.webp'));}
 res.setHeader('content-type','text/html;charset=utf-8');res.end('<meta name="viewport" content="width=device-width"><body style="background:#111;color:white;font:14px Arial"><h1>Qrup söhbəti</h1><textarea aria-label="Admin qaralaması">Saxlanmış qaralama</textarea><button id="open">Influencer görünüşünü sına</button><script type="module">import {openInfluencerPreview} from "/influencer-preview.js";document.querySelector("#open").onclick=()=>openInfluencerPreview({alive:()=>true,call:async(path,input)=>{const r=await fetch("/api/admin/community"+path,input?{method:"POST",body:JSON.stringify(input)}:{});return r.json();}});</script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of [320,390,1440]){
  records.clear();
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('button',{name:'Influencer görünüşünü sına',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByText('İlk sınaq mesajınızı yazın.').waitFor();
  const texts=['Salam, xoş gördük! 💛','Uzun sınaq mesajı — '.repeat(55),`Birinci sətir
İkinci sətir
Üçüncü sətir 💛`,'<script>alert("x")</script>'];
  for(const body of texts){
   await dialog.getByRole('textbox',{name:'Sınaq mesajı',exact:true}).fill(body);
   const before=sends;await dialog.getByRole('button',{name:'Göndər',exact:true}).dblclick({force:true});
   await dialog.getByText('Sınaq mesajı göndərildi.',{exact:true}).waitFor();assert.equal(sends,before+1);
  }
  assert.deepEqual(await dialog.locator('.influencer-preview-body').allTextContents(),texts);
  assert.equal(await dialog.locator('.influencer-preview-message').count(),4);
  await dialog.locator('.influencer-preview-messages').evaluate(n=>n.scrollTop=0);
  assert.equal(await dialog.evaluate(n=>n.scrollWidth>n.clientWidth),false);
  const first=dialog.locator('.influencer-preview-message').first();
  const position=await first.evaluate(n=>{const h=n.querySelector('.influencer-preview-head').getBoundingClientRect(),b=n.querySelector('.influencer-preview-gift').getBoundingClientRect();return {right:b.right<=h.right+1,top:Math.abs(b.top-h.top)<2};});
  assert.deepEqual(position,{right:true,top:true});
  await page.screenshot({path:'outputs/influencer-preview/local-'+engine.name()+'-'+width+'.png'});
  await dialog.getByRole('button',{name:'Sınaq mesajını sil',exact:true}).nth(3).click();
  await dialog.getByText('Sınaq mesajı silindi.',{exact:true}).waitFor();
  assert.equal(await dialog.locator('.influencer-preview-message').count(),3);
  await dialog.getByRole('button',{name:'Admin görünüşünə qayıt',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await page.getByRole('textbox',{name:'Admin qaralaması'}).inputValue(),'Saxlanmış qaralama');
  await page.getByRole('button',{name:'Influencer görünüşünü sına',exact:true}).click();await page.locator('.influencer-preview-message').nth(2).waitFor();
  await page.evaluate(()=>dispatchEvent(new Event('mirpanel:admin-logout')));
  assert.equal(await page.getByRole('dialog').count(),0);assert.deepEqual(errors,[]);
  await page.close();console.log('PASS preview send/delete/reopen/return/logout, multiline, long text, HTML safe, mobile layout',engine.name(),width);
 }}finally{await browser.close();}
}}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
