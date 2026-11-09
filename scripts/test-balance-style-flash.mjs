import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT);
const live=process.argv.includes('--live');
const origin='https://mirpanel.com';
const output=path.resolve('../../outputs/balance-style-check');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_CHROME});
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},recordVideo:{dir:output,size:{width,height:900}},serviceWorkers:'block'});
  await context.addInitScript(()=>{
   window.balanceFrames=[];
   const tick=()=>{
    const main=document.querySelector('#shopApp,.site-route-loading');
    if(location.pathname==='/balans'&&main){
     const body=getComputedStyle(document.body),style=getComputedStyle(main);
     window.balanceFrames.push({bg:body.backgroundColor,font:style.fontFamily,width:main.offsetWidth,min:style.minHeight,loading:main.classList.contains('site-route-loading')});
    }
    requestAnimationFrame(tick);
   };requestAnimationFrame(tick);
  });
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.origin!==origin)return route.abort();
   if(u.pathname==='/api/community/state')return route.fulfill({json:{profile:{id:'style-test',name:'Test'},balanceCents:4890}});
   if(u.pathname==='/api/payments/shop/wallet'){
    await new Promise(r=>setTimeout(r,1200));
    return route.fulfill({json:{cents:4890,items:[],topups:[],more:false}});
   }
   if(u.pathname==='/api/payments/methods')return route.fulfill({json:{methods:[{id:'test',displayName:'Sınaq',available:true}]}});
   if(u.pathname.startsWith('/api/'))return route.fulfill({json:{}});
   if(u.pathname.startsWith('/community-assets/')&&u.pathname.endsWith('.css'))await new Promise(r=>setTimeout(r,800));
   if(!live&&u.pathname==='/page-navigation.js')return route.fulfill({body:await fs.readFile('page-navigation.js'),contentType:'text/javascript'});
   return route.continue();
  });
  const page=await context.newPage();
  const video=page.video();
  await page.goto(origin+'/mehsul',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.MirpanelNavigation);
  const open=async()=>{
   // Exercise the normal delegated link handler through a visible balance link.
   const link=width===1440?page.locator('.desktop-balance'):page.locator('.browser-bottom-nav a[href="/balans"]');
   await link.click();
   await page.getByRole('textbox',{name:'AZN məbləği'}).waitFor();
   await page.waitForFunction(()=>!window.MirpanelNavigation.pending);
  };
  const check=async label=>{
   const frames=await page.evaluate(()=>window.balanceFrames);
   assert.ok(frames.length>0);
   const bad=frames.filter(f=>f.bg==='rgb(255, 255, 255)'||!/(system-ui|sans-serif|Arial)/i.test(f.font));
   assert.deepEqual(bad,[],label+' contained unstyled frames');
   console.log(JSON.stringify({width,label,frames:frames.length,backgrounds:[...new Set(frames.map(f=>f.bg))]}));
   await page.evaluate(()=>{window.balanceFrames=[];});
  };
  await open();await check('first click, cold cache, slow CSS and data');
  await page.evaluate(()=>window.MirpanelNavigation.go('/mehsul'));

  await open();await check('repeat click');
  await page.reload({waitUntil:'commit'});
  await page.getByRole('textbox',{name:'AZN məbləği'}).waitFor();
  await check('reload');
  await page.goto(origin+'/balans',{waitUntil:'commit'});
  await page.getByRole('textbox',{name:'AZN məbləği'}).waitFor();
  await check('direct');
  await context.close();
  await video.saveAs(path.join(output,(live?'live':'preview')+'-'+width+'.webm'));
 }
}finally{await browser.close();}
