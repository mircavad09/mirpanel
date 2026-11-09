import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handlePublicCommunity} from '../mirpanel-admin/community/public-service.mjs';

const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT || 'playwright');
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_CHROME});
const live=process.argv.includes('--live');
const origin=live?'https://mirpanel.com':'http://mirpanel.test';
const repo=new URL('../',import.meta.url);
const mime={html:'text/html',css:'text/css',js:'text/javascript',mjs:'text/javascript',png:'image/png',svg:'image/svg+xml',webp:'image/webp'};
async function shell(pathname){
  let html;
  await handlePublicCommunity({
    req:{method:'GET'},res:{setHeader(){}},u:new URL(pathname,origin),origin,
    runtime:{pool:{query:async()=>({rows:[{ready:true}]})}},
    html:(_response,markup)=>{html=markup;}
  });
  return html;
}
const wallet={cents:4890,items:[],topups:[],more:false};
const delays=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
    await context.addInitScript(()=>{
      window.footerFrames=[];
      const frame=()=>{
        const footer=document.querySelector('#customerFooter'),main=document.querySelector('#shopApp');
        if(main&&footer){
          window.footerFrames.push({top:footer.getBoundingClientRect().top+scrollY,
            loaded:!!main.querySelector('.wallet-payment-method'),position:getComputedStyle(footer).position});
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    let slow=true, releaseWallet;
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin)return route.abort();
      const p=url.pathname;
      if(p==='/api/payments/shop/wallet'){
        if(slow)await new Promise(resolve=>{releaseWallet=resolve;});
        return route.fulfill({json:wallet});
      }
      if(p==='/api/community/state')return route.fulfill({json:{profile:{id:'wallet-test',name:'Test'},balanceCents:wallet.cents}});
      if(p==='/api/payments/methods')return route.fulfill({json:{methods:[{id:'test',displayName:'Sınaq',available:true}]}});
      if(p.startsWith('/api/'))return route.fulfill({json:{}});
      if(slow&&p==='/community-assets/shop-ui.js')await delays(650);
      if(live)return route.continue();
      if(['/balans','/sebet'].includes(p))return route.fulfill({body:await shell(p),contentType:mime.html});
      if(!/^\/[a-z0-9_./-]+$/i.test(p)||p.includes('..'))return route.fulfill({status:404});
      const rel=p.replace(/^\/community-assets\//,'/mirpanel-admin/community/public/').slice(1);
      try{
        return route.fulfill({body:await readFile(new URL(rel,repo)),contentType:mime[p.split('.').at(-1)]});
      }catch{return route.fulfill({status:404});}
    });
    const page=await context.newPage();
    const form=page.getByRole('textbox',{name:'AZN məbləği'});
    const footer=page.locator('#customerFooter');
    const metrics=async (mode)=>{
      await page.locator('.shop-wallet-loading').getByText('Balans məlumatı yüklənir…').waitFor();
      await footer.getByRole('heading',{name:/Sualınız var/}).waitFor();
      await page.waitForFunction(()=>window.footerFrames.length>=4);
      for(let i=0;!releaseWallet&&i<100;i++)await delays(50);
      assert.ok(releaseWallet,'Wallet request did not start');
      assert.equal(await form.count(),0);
      releaseWallet();
      releaseWallet=null;
      await form.waitFor();
      await page.waitForFunction(()=>window.footerFrames.some(x=>x.loaded));
      const frames=await page.evaluate(()=>window.footerFrames);
      const before=frames.filter(x=>!x.loaded);
      const after=frames.find(x=>x.loaded);
      const min=Math.min(...before.map(x=>x.top)),max=Math.max(...before.map(x=>x.top));
      const gap=await footer.evaluate(node=>node.getBoundingClientRect().top-document.querySelector('#shopApp').getBoundingClientRect().bottom);
      console.log(JSON.stringify({width,mode,beforeMin:min,beforeMax:max,loaded:after.top,gap,position:after.position}));
      assert.equal(after.position,'static');
      assert.ok(gap>=16&&gap<=65);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      if(width===1440){
        assert.ok(max-min<=4,'Footer moved during loading');
        assert.ok(Math.abs(after.top-min)<=8,'Footer moved when the balance form opened');
      }
      return after.top;
    };
    await page.goto(origin+'/balans',{waitUntil:'commit'});
    const direct=await metrics('slow direct');
    if(width===1440){
      await page.reload({waitUntil:'commit'});
      assert.ok(Math.abs(await metrics('slow reload')-direct)<=8);
      slow=false;
      await page.reload({waitUntil:'commit'});
      await form.waitFor();
      await footer.getByRole('heading',{name:/Sualınız var/}).waitFor();
      const normal=await footer.evaluate(node=>node.getBoundingClientRect().top+scrollY);
      assert.ok(Math.abs(normal-direct)<=8,'Normal reload changed the finished layout');
      console.log(JSON.stringify({width,mode:'normal reload',loaded:normal}));
    }
    await context.close();
  }
}finally{await browser.close();}
