import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const mode=process.argv[2]||'after',origin=process.argv[3]||'https://mirpanel.com';
const out='outputs/mobile-catalog-layout';
await fs.mkdir(out,{recursive:true});
const products=['spotify','capcut','netflix','chatgpt'];
const paths=[['home','/','#grid'],['products','/mehsul','.catalog-grid']];
for(const engine of mode==='before'?[chromium]:[chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
 try{
  for(const width of [320,390,430]){
   const page=await browser.newPage({viewport:{width,height:900},isMobile:true,hasTouch:true,ignoreHTTPSErrors:true});
   if(mode==='preview')await page.route('**/catalog-card.css*',route=>route.fulfill({contentType:'text/css',path:'catalog-card.css'}));
   for(const [name,path,selector] of paths){
    await page.goto(origin+path,{waitUntil:'domcontentloaded'});
    const grid=page.locator(selector);
    await grid.locator('.homeProductCard').first().waitFor();
    await grid.locator('.homeProductCard').first().evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
    await page.waitForTimeout(900);
    const data=await grid.evaluate(async(grid,ids)=>{
     const first=[...grid.querySelectorAll('.homeProductCard')].filter(el=>el.getClientRects().length).slice(0,4);
     const cards=ids.map(id=>[...grid.querySelectorAll('.homeProductCard')].find(c=>c.dataset.productId===id)).filter(Boolean);
     const rect=node=>{if(!node||!node.getClientRects().length)return null;const {x,y,width,height,top,bottom,left,right}=node.getBoundingClientRect();return {x,y,width,height,top,bottom,left,right};};
     const read=card=>{
      const find=s=>card.querySelector(s),style=getComputedStyle(card),pad=getComputedStyle(find('.pad')),title=find('.title');
      const old=find('del'),price=find('.homeCardPrices strong'),action=find('.homeCardAdd')||find('.homeCardOrder');
      return {id:card.dataset.productId,card:rect(card),image:rect(find('.imgWrap')),title:rect(title),titleFits:title.scrollHeight<=title.clientHeight+1,
       action:rect(action),price:rect(price),old:rect(old),sales:rect(find('.homeCardSales')),stock:rect(find('.cardStockBadge')),
       stockLine:rect(find('.cardStockLine')),pad:rect(find('.pad')),padding:pad.padding,rowGap:pad.rowGap,minHeight:style.minHeight,rows:pad.gridTemplateRows};
     };
     await Promise.all(first.map(c=>{const img=c.querySelector('img');img.loading='eager';return img.decode().catch(()=>{});}));
     return {gap:getComputedStyle(grid).gap,first:first.map(read),cards:cards.map(read)};
    },products);
    if(mode==='before')await fs.writeFile(out+'/'+name+'-'+width+'-baseline.json',JSON.stringify(data,null,2));
    else{
     const baseline=JSON.parse(await fs.readFile(out+'/'+name+'-'+width+'-baseline.json','utf8'));
     assert.equal(data.gap,'8px');
     assert.equal(data.cards.length,4,JSON.stringify(data.cards.map(c=>c.id)));
     for(const card of data.cards){
      const previous=baseline.cards.find(c=>c.id===card.id);
      assert.equal(card.padding,'8px');
      assert.equal(card.minHeight,'0px');
      assert(card.titleFits,JSON.stringify(card));
      assert(card.price.right<=card.action.left+1,JSON.stringify(card));
      assert(Math.abs(card.price.top+card.price.height/2-card.action.top-card.action.height/2)<=8,JSON.stringify(card));
      assert(card.action.width>=44&&card.action.height>=44,JSON.stringify(card));
      if(card.old)assert(card.old.right<=card.action.left+1&&card.old.top<card.price.bottom,JSON.stringify(card));
      if(card.stock)assert(card.stock.right<=card.pad.right-7&&card.stock.bottom<=card.pad.bottom-7,JSON.stringify(card));
      assert(Math.abs(card.image.width/card.image.height-previous.image.width/previous.image.height)<.025,JSON.stringify({card,previous}));
     }
     for(let i=0;i<data.first.length;i+=2){
      const a=data.first[i],b=data.first[i+1];if(!b)break;
      assert(Math.abs(a.card.top-b.card.top)<1&&Math.abs(a.card.bottom-b.card.bottom)<1);
      assert(Math.abs(b.card.left-a.card.right-8)<1);
     }
    }
    if(engine===chromium&&width===390){
     const first=grid.locator('.homeProductCard').first();
     await first.evaluate(n=>window.scrollTo({top:scrollY+n.getBoundingClientRect().top-155,behavior:'instant'}));
     await page.waitForTimeout(1300);
     const box=await grid.evaluate(grid=>{
      const c=[...grid.querySelectorAll('.homeProductCard')].filter(el=>el.getClientRects().length).slice(0,4).map(el=>el.getBoundingClientRect());
      const left=Math.floor(Math.min(...c.map(r=>r.left))),top=Math.floor(Math.min(...c.map(r=>r.top)));
      return {x:left,y:top,width:Math.ceil(Math.max(...c.map(r=>r.right)))-left,height:Math.ceil(Math.max(...c.map(r=>r.bottom)))-top};
     });
     await page.screenshot({path:out+'/'+name+'-'+mode+'.png',clip:box,animations:'disabled'});
    }
    if(mode!=='before')await grid.evaluate(grid=>{
     const card=grid.querySelector('[data-product-id="chatgpt"]'),body=card.querySelector('.pad');
     const sales=body.querySelector('.homeCardSales'),original=body.querySelector('.cardStockLine');
     const line=document.createElement('div'),badge=document.createElement('span');
     line.className='cardStockLine';badge.className='mpStockBadge cardStockBadge low';
     badge.textContent='Son 2 ədəd';line.append(badge);
     if(original)original.replaceWith(line);else body.append(line);
     const count=()=>getComputedStyle(body).gridTemplateRows.split(' ').length;
     const check=(ok,message)=>{if(!ok)throw Error(message);};
     check(['inline-flex','flex'].includes(getComputedStyle(badge).display),'Stock should be displayed as a badge: '+getComputedStyle(badge).display);
     for(const hidden of [false,true]){
      sales.hidden=hidden;
      if(!hidden)sales.textContent='≈ 99+ satılıb';
      const box=badge.getBoundingClientRect(),bounds=body.getBoundingClientRect();
      check(box.width>0&&box.right<=bounds.right-7&&box.bottom<=bounds.bottom-7,'Stock badge clipped');
      if(!hidden)check(sales.getBoundingClientRect().bottom<=box.top,'Stock and sales overlap');
      check(count()===(hidden?3:4),'Unexpected occupied stock or sales rows');
     }
     line.remove();
     check(count()===2,'Missing stock still reserves a row');
    });
    console.log(JSON.stringify({mode,browser:engine.name(),width,page:name,gap:data.gap,products:data.cards.map(c=>c.id)}));
   }
   await page.close();
  }
 }finally{await browser.close();}
}

if(mode!=='before'){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:810,height:1050}});
  const pairs=await Promise.all(paths.map(async([name])=>Promise.all(['before',mode].map(async v=>(await fs.readFile(out+'/'+name+'-'+v+'.png')).toString('base64')))));
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#101114;color:#f5f5f5;font:15px system-ui}main{display:grid;gap:18px;padding:14px}h2,p{margin:0 0 8px}section>div{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{display:block;max-width:100%;height:auto;border-radius:8px}</style><main>${pairs.map((images,i)=>`<section><h2>${i?'Məhsullar':'Ana səhifə'} · 390 px</h2><div>${images.map((src,j)=>`<article><p>${j?'Sonra':'Əvvəl'}</p><img src="data:image/png;base64,${src}"></article>`).join('')}</div></section>`).join('')}</main>`);
  await page.locator('main').screenshot({path:out+'/evvel-sonra-'+mode+'.png'});
 }finally{await browser.close();}
}
