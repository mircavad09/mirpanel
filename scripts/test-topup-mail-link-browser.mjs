import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const {chromium}=await import(process.env.MIRPANEL_PLAYWRIGHT);
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_CHROME});
const origin='http://mirpanel.test',topup='12345678-1234-4234-8234-000000000001';
const target='/profil?tab=payments&topup='+topup;
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});
  let loggedIn=false,focused=false;
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/api/auth/sign-in/email'){loggedIn=true;return route.fulfill({json:{user:{id:'test'}}});}
   if(u.pathname==='/api/community/payment-history'){
    assert.equal(loggedIn,true);assert.equal(u.searchParams.get('topup'),topup);focused=true;
    return route.fulfill({json:{items:[{kind:'topup',id:topup,number:'7',cents:'450',status:'rejected',submitted_at:'2026-11-09T12:00:00Z',rejection_reason:'Sınaq: qəbz oxunmur.'}],balance:'0',all:1,approved:0,reviewing:0,rejected:1,total:'0',month:'0',rejectedCents:'450'}});
   }
   if(u.pathname==='/hesab')return route.fulfill({contentType:'text/html',body:'<html><body><main id="authApp"></main><script type="module" src="/community-assets/auth-forms.js"></script></body></html>'});
   if(u.pathname==='/profil')return route.fulfill({contentType:'text/html',body:`<html><body><main id="content"></main><script type="module">
    import {mountPayments} from '/community-assets/account-payments.js';
    const el=(tag,attrs={},...children)=>{const n=document.createElement(tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);n.append(...children.filter(x=>x!=null));return n;};
    const button=(text,fn)=>{const n=el('button',{},text);n.onclick=fn;return n;};
    mountPayments({content:document.querySelector('main'),api:async url=>(await fetch(url)).json(),el,button,link:(text,href)=>el('a',{href},text)});
   </script></body></html>`});
   if(u.pathname.startsWith('/community-assets/')){
    try{return route.fulfill({body:await fs.readFile('mirpanel-admin/community/public/'+u.pathname.split('/').at(-1)),contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript'});}catch{}
   }
   return route.fulfill({status:404});
  });
  const page=await context.newPage();
  await page.goto(origin+'/hesab?next='+encodeURIComponent(target));
  await page.getByLabel('E-poçt',{exact:true}).fill('synthetic@example.test');
  await page.getByLabel('Şifrə',{exact:true}).fill('synthetic-test');
  await page.getByRole('button',{name:'Daxil ol',exact:true}).click();
  await page.waitForURL(origin+target);
  await page.getByText('Balans yükləmə №7',{exact:true}).waitFor();
  await page.getByText('Səbəb — Sınaq: qəbz oxunmur.',{exact:true}).waitFor();
  assert.ok(focused);
  assert.equal(await page.locator('.account-payment-row').count(),1);
  console.log('PASS '+width+'px login returns to the selected payment request');
  await context.close();
 }
}finally{await browser.close();}
