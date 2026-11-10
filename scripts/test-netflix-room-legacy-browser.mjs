import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium,webkit}=await import(process.env.MIRPANEL_PLAYWRIGHT_MODULE||'playwright');

const js=fs.readFileSync('mirpanel-admin/public/ready-stock-admin.js','utf8');
const css=fs.readFileSync('mirpanel-admin/public/ready-stock-admin.css','utf8');
const body=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link rel="stylesheet" href="/stock.css"><main></main><script type="module">
import {mountReadyStock} from '/stock.js';
const customer={id:'synthetic-customer',name:'Sınaq Müştəri',email:'customer@example.test',memberNumber:1024};
const room={id:'synthetic-room',name:'1',status:'free',sellable:true,endsOn:'2027-01-20'};
const rows=[room,{id:'synthetic-sale',name:'2',status:'free',sellable:true}, {id:'unmatched',name:'3',status:'review',deliveryId:'historical'}];
function assign(target,values){Object.assign(target,{sellable:false,paidUntil:'2027-01-01',assignedAt:'2026-12-30T10:00:00Z',customer,...values});}
if(sessionStorage.bound)assign(room,{legacyAssignmentId:'synthetic-binding',status:'paid'});
if(sessionStorage.sold)assign(rows[1],{deliveryId:'delivery-2',status:'sold',sheetCustomerId:{deliveryId:'delivery-2',state:'error',message:'Sintetik xəta'}});
window.recordSale=()=>{sessionStorage.sold='1';assign(rows[1],{deliveryId:'delivery-2',status:'sold',sheetCustomerId:{deliveryId:'delivery-2',state:'error',message:'Sintetik xəta'}});};
mountReadyStock(document.querySelector('main'),async (url,req)=>{
 if(!req){
  const count=rows.filter(r=>r.sellable).length;
  return {products:[{id:'netflix',title:'Netflix',message:'',readyTotal:count,plans:[{index:0,title:'1 ay',signature:'test',sales:count,ready:count}]}],netflixRooms:rows};
 }
 const {netflixRoomAssign:data,netflixSheetIdRetry:retry}=JSON.parse(req.body);
 if(retry){window.retried=retry.deliveryId;return {};}
 if(data.action==='open')return {email:'netflix@example.test',room:'1',pin:'0408'};
 if(data.action==='search')return {users:[{id:'synthetic-customer',name:'Sınaq Müştəri',email:'customer@example.test',memberNumber:1024}]};
 window.saved=data;sessionStorage.bound='1';assign(room,{legacyAssignmentId:'synthetic-binding',status:'paid'});
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
   const ready=p.getByRole('region',{name:'Hazır stok',exact:true});
   const sold=p.getByRole('region',{name:'Satılan və müştəriyə bağlanan otaqlar',exact:true});
   const total=p.locator('[data-ready]');
   const roomOne=ready.locator('[data-room-name="1"]');
   await roomOne.getByRole('button',{name:'Müştəriyə bağla',exact:true}).click();
   assert.equal(await total.textContent(),'2');
   await sold.getByText('Müştəri qeydi tapılmadı',{exact:false}).waitFor();
   const d=p.getByRole('dialog');
   await d.getByText('netflix@example.test · Otaq 1 · PIN 0408').waitFor();
   await d.getByLabel('Müştəri axtar').fill('#1024');
   await d.getByRole('button',{name:/Sınaq Müştəri · #1024/}).click();
   await d.getByLabel('Ödənilmiş müddətin bitmə tarixi').fill('1 yanvar');
   await d.getByText('1 yanvar 2027 · 1 gün qalıb').waitFor();
   const box=await d.boundingBox();
   assert.ok(box.x>=0&&box.x+box.width<=width);
   await d.getByRole('button',{name:'Müştəriyə bağla',exact:true}).click();
   await p.getByText('Otaq 1 · Sınaq Müştəri (#1024) hesabına bağlandı.',{exact:true}).waitFor();
   assert.equal(await total.textContent(),'1');
   assert.equal(await roomOne.count(),0);
   const bound=sold.locator('[data-room-name="1"]');
   const customerLink=bound.getByRole('link',{name:'Sınaq Müştəri (#1024)',exact:true});
   assert.equal(await customerLink.getAttribute('href'),'/admin.html?topupUser=synthetic-customer#communityUsers');
   assert.match(await bound.innerText(),/Bağlama tarixi:/);
   assert.match(await bound.innerText(),/Ödənilmiş müddətin sonu: 2027-01-01/);
   assert.equal(await sold.getByRole('button',{name:'Müştəriyə bağla',exact:true}).count(),0);
   await p.locator('.netflixRoomBound').getByText('Müştəriyə bağlı',{exact:true}).waitFor();
   assert.deepEqual(await p.evaluate(()=>window.saved),{action:'confirm',id:'synthetic-room',userId:'synthetic-customer',paidUntil:'2027-01-01'});
   await p.evaluate(()=>window.recordSale());
   const delivered=sold.locator('[data-room-name="2"]');
   await delivered.getByText('Sheets A sütunu · Sintetik xəta',{exact:true}).waitFor();
   assert.equal(await total.textContent(),'0');
   assert.match(await delivered.innerText(),/Təhvil tarixi:/);
   await delivered.getByRole('button',{name:'ID yazısını təkrarla'}).click();
   assert.equal(await p.evaluate(()=>window.retried),'delivery-2');
   await p.reload();
   await customerLink.waitFor();
   await delivered.getByRole('link',{name:'Sınaq Müştəri (#1024)',exact:true}).waitFor();
   assert.equal(await total.textContent(),'0');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.close();
  }
  console.log('PASS: '+engine.name()+' 320/390/1440px, search, preview, Baku year rollover and confirmation');
 }finally{await browser.close();}
}
