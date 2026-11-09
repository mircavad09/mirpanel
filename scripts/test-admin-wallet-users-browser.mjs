import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const assets='mirpanel-admin/public/',out='outputs/admin-wallet-users',origin='http://localhost:45935';
fs.mkdirSync(out,{recursive:true});
const user={id:'synthetic',name:'Nümunə Müştəri',email:'synthetic@example.test',memberNumber:1069,balanceCents:4890,spentCents:0,orderCount:0};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
for(const [engine,launcher] of [['chrome',chromium],['webkit',webkit]]){
 const browser=await launcher.launch(engine==='chrome'?{channel:'chrome'}:{});
 try{
  for(const width of [320,390,430,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   let cents=4890,lost=true,entries=[],searches=[],writes=[],saved=new Map();
   const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
   await page.route(origin+'/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    const json=(body,status=200)=>route.fulfill({json:body,status});
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/admin.css"><main id="root" style="margin:12px"></main><script type="module">import{mountUsers}from"/admin-wallet-users.js";mountUsers({root:document.querySelector("#root"),alive:()=>true,call:async(p,data)=>{const r=await fetch("/test"+p,data===undefined?{}:{method:"POST",body:JSON.stringify(data)});const v=await r.json();if(!r.ok)throw Object.assign(Error(v.error),{status:r.status});return v}})</script>'});
    if(path==='/test/users'){
     const q=url.searchParams.get('q'),filter=url.searchParams.get('filter');searches.push({q,filter,page:url.searchParams.get('page')});
     if(q==='old')await delay(420);
     return json({users:[{...user,name:q==='old'?'Gec nəticə':q==='new'?'Yeni nəticə':user.name,balanceCents:cents}],total:21,hasMore:true});
    }
    if(path==='/test/users/synthetic')return json({user,totalCents:0,orders:[]});
    if(path==='/test/wallet')return json({cents,debitAvailable:true,items:entries,more:false});
    if(path==='/test/wallet/debit'||path==='/test/wallet/credit'){
     const body=req.postDataJSON(),debit=path.endsWith('debit');writes.push({path,body});
     if(saved.has(body.requestId))return json(saved.get(body.requestId));
     const delta=Math.round(Number(body.amount)*100)*(debit?-1:1);
     const row={id:String(entries.length+1),kind:debit?'admin_debit':'admin_credit',cents:delta,before_cents:cents,after_cents:cents+delta,actor_name:'Sınaq Admini',created_at:'2026-11-09T12:09:00Z'};
     cents+=delta;entries.unshift(row);saved.set(body.requestId,row);
     if(debit&&lost){lost=false;return route.abort();}
     return json(row);
    }
    const name=path.slice(1);
    if(!/^[\w-]+\.(js|css)$/.test(name)||!fs.existsSync(assets+name))return route.fulfill({status:404});
    return route.fulfill({path:assets+name,contentType:name.endsWith('.js')?'text/javascript':'text/css'});
   });
   await page.goto(origin);
   const search=page.getByRole('searchbox');
   await page.getByText('Səhifə 1 · 21').waitFor();
   await page.getByRole('button',{name:'Onlayn',exact:true}).click();
   await page.getByRole('button',{name:'Növbəti',exact:true}).click();
   await page.getByText('Səhifə 2 · 21').waitFor();
   await search.fill('o');await search.fill('ol');await search.fill('old');
   await page.waitForRequest(r=>r.url().includes('q=old'));
   assert.equal(searches.some(x=>['o','ol'].includes(x.q)),false);
   await search.fill('new');
   await page.getByText('Yeni nəticə',{exact:true}).waitFor();
   await delay(230);
   assert.equal(await page.getByText('Gec nəticə',{exact:true}).count(),0);
   assert.deepEqual(searches.at(-1),{q:'new',filter:'online',page:'1'});
   if(engine==='chrome'&&[390,1440].includes(width))await page.screenshot({path:out+'/axtaris-'+width+'.png'});
   await search.fill('');
   await page.getByText(user.name,{exact:true}).waitFor();
   assert.deepEqual(searches.at(-1),{q:'',filter:'online',page:'1'});
   await page.getByRole('button',{name:/Nümunə Müştəri/}).first().click();
   await page.getByRole('button',{name:'Balansı idarə et'}).click();
   const amount=page.getByRole('textbox',{name:'AZN məbləği'}),dialog=page.getByRole('dialog');
   await amount.fill('48,91');await dialog.getByRole('button',{name:'Balansdan çıx'}).click();
   await dialog.getByText(/Balans kifayət etmir/).waitFor();assert.equal(writes.length,0);
   await amount.fill('10,50');await dialog.getByRole('button',{name:'Balansdan çıx'}).click();
   await dialog.getByText(/48,90 ₼ − 10,50 ₼ = 38,40 ₼/).waitFor();
   assert.equal(await dialog.evaluate(n=>n.getBoundingClientRect().right<=innerWidth),true);
   if(engine==='chrome'&&[390,1440].includes(width))await page.screenshot({path:out+'/cixilma-'+width+'.png'});
   await dialog.getByRole('button',{name:'Təsdiqlə və çıx'}).evaluate(n=>{n.click();n.click();});
   await dialog.getByRole('button',{name:'Eyni əməliyyatı təkrar yoxla'}).waitFor();assert.equal(writes.length,1);
   await page.reload();await page.getByRole('button',{name:/Nümunə Müştəri/}).first().click();
   await page.getByRole('button',{name:'Balansı idarə et'}).click();
   await dialog.getByRole('button',{name:'Eyni əməliyyatı təkrar yoxla'}).click();
   await page.getByText('İnzibati çıxılma',{exact:true}).waitFor();
   assert.deepEqual(writes[0],writes[1]);assert.equal(entries.length,1);
   await page.getByText('09.11.2026 · 16:09',{exact:true}).waitFor();
   await page.getByText('Admin · Sınaq Admini',{exact:true}).waitFor();
   await page.getByRole('button',{name:'Balansı idarə et'}).click();
   await amount.fill('1.50');await dialog.getByRole('button',{name:'Əlavə et',exact:true}).click();
   await dialog.getByRole('button',{name:'Təsdiqlə və əlavə et'}).click();
   await page.getByText('İnzibati əlavə',{exact:true}).waitFor();
   assert.equal(cents,3990);
   if(engine==='chrome'&&[390,1440].includes(width))await page.screenshot({path:out+'/tarixce-'+width+'.png'});
   assert.deepEqual(pageErrors,[]);
   await page.close();console.log(engine,width,'passed');
  }
 }finally{await browser.close();}
}
