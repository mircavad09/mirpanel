import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const mutations=[];
const data={name:'Çiçək Məmmədova',memberNumber:1554,avatarUrl:'/community-assets/avatar-robot.webp',test:true,items:[],products:[
 {id:'zoom',title:'Zoom Pro',image:'/community-assets/avatar-robot.webp',url:'https://mirpanel.com/mehsul/zoom-pro',plans:[{index:0,label:'1 ay',price:9.98},{index:1,label:'3 ay',price:25}]},
 {id:'netflix',title:'Netflix Şəxsi',image:'/community-assets/avatar-robot.webp',url:'https://mirpanel.com/mehsul/netflix',plans:[{index:0,label:'1 ay',price:5.99}]}]};
const server=http.createServer(async(req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 if(req.method!=='GET')mutations.push({method:req.method,path});
 if(path==='/api/admin/community/influencer-preview'){
  res.setHeader('content-type','application/json');if(req.method==='POST'){let raw='';for await(const c of req)raw+=c;assert.deepEqual(JSON.parse(raw),{action:'reset'});}return res.end(JSON.stringify(data));
 }
 if(['/influencer-preview-interactive.js','/influencer-preview-interactive.css'].includes(path)){res.setHeader('content-type',path.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync('mirpanel-admin/public'+path));}
 if(['/admin.css','/admin-community-panel.css'].includes(path)){res.setHeader('content-type','text/css');return res.end(fs.readFileSync('mirpanel-admin/public'+path));}
 if(path.startsWith('/community-assets/')&&/^[a-z.-]+$/.test(path.slice(18))){const file='mirpanel-admin/community/public/'+path.slice(18);if(fs.existsSync(file)){res.setHeader('content-type',path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'image/webp');return res.end(fs.readFileSync(file));}}
 if(path!=='/'){res.writeHead(404);return res.end('not found');}
 res.setHeader('content-type','text/html;charset=utf-8');res.end('<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/admin.css"><link rel="stylesheet" href="/admin-community-panel.css"><body><textarea aria-label="Admin qaralaması">Saxlanmış qaralama</textarea><button id="open">Influencer görünüşünü sına</button><script type="module">import {openInfluencerPreview} from "/influencer-preview-interactive.js";document.querySelector("#open").onclick=()=>openInfluencerPreview({alive:()=>true,call:async(path,input)=>{const r=await fetch("/api/admin/community"+path,input?{method:"POST",body:JSON.stringify(input)}:{});return r.json();}});</script>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));fs.mkdirSync('outputs/influencer-preview',{recursive:true});
const reports=[];
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{for(const width of [320,390,430,1440]){
  const height=width===320?640:900,page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'Influencer görünüşünü sına',exact:true}).click();
  const root=page.getByRole('dialog',{name:'Influencer sınaq görünüşü',exact:true});await root.getByText('Sınaq hazırdır.',{exact:false}).waitFor();
  assert.equal(await root.getByRole('button',{name:'Hədiyyə et',exact:true}).isDisabled(),true);
  await page.screenshot({path:'outputs/influencer-preview/ready-'+engine.name()+'-'+width+'.png'});
  await root.getByRole('button',{name:'Çiçək Məmmədova',exact:true}).click();let modal=page.locator('.chat-component-modal');await modal.getByText('İstifadəçi ID-si: 1554').waitFor();await page.keyboard.press('Escape');await modal.waitFor({state:'detached'});assert.equal(await root.isVisible(),true);
  const texts=['Birinci sətir\nİkinci sətir 💛','Uzun sınaq mesajı '.repeat(60),'<script>alert("x")</script>'];
  for(const body of texts){await root.getByRole('textbox',{name:'Sınaq mesajı',exact:true}).fill(body);await root.getByRole('button',{name:'Göndər',exact:true}).click();}
  assert.equal(await root.locator('.preview-message').count(),4);assert.equal(await root.locator('.preview-message script').count(),0);
  await root.getByRole('button',{name:'Müştəri kimi bax',exact:true}).click();await root.getByRole('textbox',{name:'Sınaq mesajı',exact:true}).fill('Müştərinin mesajı');await page.keyboard.press('Control+Enter');await root.getByText('Müştərinin mesajı',{exact:true}).waitFor();
  const first=root.locator('.preview-message').first();await first.locator('summary').click();await first.getByRole('button',{name:'Sınaq mesajını sil',exact:true}).click();modal=page.locator('.chat-component-modal');await modal.getByRole('button',{name:'Ləğv et',exact:true}).click();assert.equal(await root.getByText('Mesaj silindi',{exact:true}).count(),0);
  await first.getByRole('button',{name:'Sınaq mesajını sil',exact:true}).click();await page.locator('.chat-component-modal').getByRole('button',{name:'Silməni təsdiqlə',exact:true}).click();assert.equal(await root.getByText('Mesaj silindi',{exact:true}).count(),1);assert.equal(await root.locator('.preview-message').count(),5);
  const openGift=async()=>{await root.getByRole('button',{name:'Hədiyyə et',exact:true}).first().click();return page.getByRole('dialog',{name:'Hədiyyə et',exact:true});};
  await root.getByRole('spinbutton',{name:'Sınaq balansı — ₼',exact:true}).fill('0');modal=await openGift();await modal.getByLabel('Hədiyyə məhsulu',{exact:true}).selectOption('netflix');await modal.getByRole('button',{name:'Növbəti',exact:true}).click();await modal.getByText('Qiymət: 5,99 ₼',{exact:true}).waitFor();
  await modal.getByRole('button',{name:'Geri',exact:true}).click();assert.equal(await modal.getByLabel('Hədiyyə məhsulu',{exact:true}).inputValue(),'netflix');await modal.getByRole('button',{name:'Növbəti',exact:true}).click();await modal.getByRole('button',{name:'Sınaq hədiyyəsini təsdiqlə',exact:true}).click();await modal.getByText('Balans çatışmır',{exact:true}).waitFor();
  await modal.getByRole('button',{name:'Balansı artır',exact:true}).click();await modal.getByRole('button',{name:'Geri',exact:true}).click();await modal.getByRole('button',{name:'Sınaq hədiyyəsini təsdiqlə',exact:true}).click();await modal.getByRole('button',{name:'Balansı artır',exact:true}).click();await modal.getByRole('spinbutton',{name:'Əlavə ediləcək sınaq məbləği',exact:true}).fill('20');await modal.getByRole('button',{name:'Sınaq balansına əlavə et',exact:true}).click();await modal.getByRole('button',{name:'Sınaq hədiyyəsini təsdiqlə',exact:true}).click();await modal.getByText('Sınaq hədiyyəsi uğurludur',{exact:true}).waitFor();await modal.getByRole('button',{name:'Tamam',exact:true}).click();
  assert.equal(await root.getByLabel('Sınaq balansı — ₼',{exact:true}).inputValue(),'14.01');await root.getByText('Sınaq hədiyyələri (1)',{exact:true}).waitFor();
  for(const [scenario,error] of [['stock','stoku bitib'],['error','müvəqqəti xəta']]){await root.getByLabel('Hədiyyə ssenarisi',{exact:true}).selectOption(scenario);modal=await openGift();await modal.getByRole('button',{name:'Növbəti',exact:true}).click();await modal.getByRole('button',{name:'Sınaq hədiyyəsini təsdiqlə',exact:true}).click();await modal.getByRole('alert').filter({hasText:error}).waitFor();await modal.getByRole('button',{name:'Sınaq hədiyyəsini təsdiqlə',exact:true}).click();await modal.getByRole('button',{name:'Ləğv et',exact:true}).click();assert.equal(await root.getByLabel('Sınaq balansı — ₼',{exact:true}).inputValue(),'14.01');}
  await root.getByLabel('Hədiyyə ssenarisi',{exact:true}).selectOption('success');modal=await openGift();await modal.getByRole('button',{name:'Növbəti',exact:true}).click();await modal.getByRole('button',{name:'Sınaq hədiyyəsini təsdiqlə',exact:true}).evaluate(n=>{n.click();n.click();});await modal.getByText('Sınaq hədiyyəsi uğurludur',{exact:true}).waitFor();await page.screenshot({path:'outputs/influencer-preview/gift-'+engine.name()+'-'+width+'.png'});await modal.getByRole('button',{name:'Tamam',exact:true}).click();await root.getByText('Sınaq hədiyyələri (2)',{exact:true}).waitFor();assert.equal(await root.getByLabel('Sınaq balansı — ₼',{exact:true}).inputValue(),'4.03');
  await root.getByLabel('Banner məhsulu',{exact:true}).selectOption('netflix');await root.getByRole('button',{name:'Bu məhsulu əldə et',exact:true}).click();modal=page.locator('.chat-component-modal');assert.equal(await modal.getByRole('link',{name:'Məhsul səhifəsini aç'}).getAttribute('href'),'https://mirpanel.com/mehsul/netflix');await page.keyboard.press('Escape');await root.getByRole('button',{name:'Banneri bağla',exact:true}).click();assert.equal(await root.locator('.preview-banner').isVisible(),false);await root.getByLabel('Reklam bannerini göstər',{exact:true}).check();
  assert.equal(await root.evaluate(n=>n.scrollWidth>n.clientWidth),false);const rect=await root.boundingBox();assert(rect.x>=0&&rect.y>=0&&rect.width<=width&&rect.height<=height);
  await root.locator('.preview-messages').evaluate(n=>n.scrollTop=0);await page.screenshot({path:'outputs/influencer-preview/interactive-'+engine.name()+'-'+width+'.png'});
  await root.getByRole('button',{name:'Sınağı sıfırla',exact:true}).click();await page.locator('.chat-component-modal').getByRole('button',{name:'Sınaq məlumatlarını təmizlə',exact:true}).click();await root.getByText('İlk sınaq mesajınızı yazın.',{exact:true}).waitFor();await root.getByText('Sınaq hədiyyələri (0)',{exact:true}).waitFor();assert.equal(await root.getByLabel('Sınaq balansı — ₼',{exact:true}).inputValue(),'20.00');
  await root.getByRole('button',{name:'Admin görünüşünə qayıt',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByLabel('Admin qaralaması').inputValue(),'Saxlanmış qaralama');
  await page.getByRole('button',{name:'Influencer görünüşünü sına',exact:true}).click();await root.getByText('Sınaq hazırdır.',{exact:false}).waitFor();await page.evaluate(()=>dispatchEvent(new Event('mirpanel:admin-logout')));await root.waitFor({state:'detached'});
  assert.deepEqual(errors,[]);reports.push({engine:engine.name(),width,status:'PASS'});await page.close();
 }}finally{await browser.close();}
}
 assert(mutations.every(r=>r.path==='/api/admin/community/influencer-preview'&&r.method==='POST'));assert.equal(mutations.length,8);console.log(JSON.stringify({reports,mutations:'Only 8 scoped test resets. No live message, wallet, stock, order or notification writes.'},null,2));
}finally{server.close();}
