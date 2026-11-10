import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium,webkit}=await import(process.env.MIRPANEL_PLAYWRIGHT_MODULE||'playwright');

const js=fs.readFileSync('mirpanel-admin/public/ready-stock-admin.js','utf8');
const css=fs.readFileSync('mirpanel-admin/public/ready-stock-admin.css','utf8');
const body=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link rel="stylesheet" href="/stock.css"><main></main><script type="module">
import {mountReadyStock} from '/stock.js';
const room={id:'synthetic-room',name:'1',status:'free',endsOn:'2027-01-20'};
mountReadyStock(document.querySelector('main'),async (url,req)=>{
 if(!req)return {products:[],netflixRooms:[room]};
 const data=JSON.parse(req.body).netflixRoomAssign;
 if(data.action==='open')return {email:'netflix@example.test',room:'1',pin:'0408'};
 if(data.action==='search')return {users:[{id:'synthetic-customer',name:'Sınaq Müştəri',email:'customer@example.test',memberNumber:1024}]};
 window.saved=data;room.legacyAssignmentId='synthetic-binding';
 return {assigned:true};
});
</script>`;
for(const [engine,options] of [[chromium,{executablePath:process.env.MIRPANEL_CHROME_PATH}],[webkit,{}]]){
 const browser=await engine.launch(options);
 try{
  for(const width of [320,390,1440]){
   const p=await browser.newPage({viewport:{width,height:800}});
   await p.clock.setFixedTime(new Date('2026-12-31T19:59:00Z'));
   await p.route('**/*',r=>{
    const path=new URL(r.request().url()).pathname;
    return r.fulfill(path==='/stock.js'?{contentType:'text/javascript',body:js}:path==='/stock.css'?{contentType:'text/css',body:css}:{contentType:'text/html',body});
   });
   await p.goto('http://localhost/');
   await p.getByRole('button',{name:'Müştəriyə bağla',exact:true}).click();
   const d=p.getByRole('dialog');
   await d.getByText('netflix@example.test · Otaq 1 · PIN 0408').waitFor();
   await d.getByLabel('Müştəri axtar').fill('#1024');
   await d.getByRole('button',{name:/Sınaq Müştəri · #1024/}).click();
   await d.getByLabel('Ödənilmiş müddətin bitmə tarixi').fill('1 yanvar');
   await d.getByText('1 yanvar 2027 · 1 gün qalıb').waitFor();
   const box=await d.boundingBox();
   assert.ok(box.x>=0&&box.x+box.width<=width);
   await d.getByRole('button',{name:'Müştəriyə bağla',exact:true}).click();
   await p.getByText('Otaq müştəriyə bağlandı.').waitFor();
   assert.deepEqual(await p.evaluate(()=>window.saved),{action:'confirm',id:'synthetic-room',userId:'synthetic-customer',paidUntil:'2027-01-01'});
   await p.close();
  }
  console.log('PASS: '+engine.name()+' 320/390/1440px, search, preview, Baku year rollover and confirmation');
 }finally{await browser.close();}
}
