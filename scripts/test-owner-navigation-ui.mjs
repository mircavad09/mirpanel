import fs from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
export async function checkNavigationUI({browser,owner,guest,pool,origin,eq}){
 const out='payment-test-artifacts/owner-navigation';fs.mkdirSync(out,{recursive:true});
 const uid=(await pool.query('select user_id from owner_identity')).rows[0].user_id,other=(await pool.query('select id from "user" where id<>$1',[uid])).rows[0].id;
 await pool.query('insert into community_profiles(user_id,display_name,avatar) values($1,$2,1) on conflict do nothing',[other,'Başqa sintetik']);
 for(const [id,body]of [[other,'Salam'],[uid,'Salam']])await pool.query('insert into community_messages(user_id,client_id,body) values($1,gen_random_uuid(),$2)',[id,body]);
 const old=await browser.newContext();await old.addCookies(await owner.cookies());const before=await old.newPage();await before.route('**/community-assets/**',async route=>{const n=new URL(route.request().url()).pathname.split('/').at(-1);if(/\.(?:js|css)$/.test(n)){try{const code=execFileSync('git',['show','62f257f:mirpanel-admin/community/public/'+n],{encoding:'utf8',stdio:['ignore','pipe','ignore']});return route.fulfill({body:code,contentType:n.endsWith('css')?'text/css':'text/javascript'});}catch{}}await route.continue();});
 await before.setViewportSize({width:390,height:844});await before.goto(origin+'/qrup');await before.locator('.community-message.is-own .community-message-bubble').waitFor();await before.waitForTimeout(250);const beforeOffset=await before.locator('.community-message.is-own').evaluate(e=>{const a=e.querySelector('.community-avatar-frame').getBoundingClientRect(),b=e.querySelector('.community-message-bubble').getBoundingClientRect();return Math.abs(a.y+a.height/2-b.y-b.height/2);});eq(beforeOffset>5,true,'old avatar below bubble regression reproduced');await before.screenshot({path:out+'/before-mobile.png'});await old.close();
 const p=await owner.newPage(),errors=[],missing=[];p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()===404)missing.push(new URL(r.url()).pathname);});
 for(const width of [320,360,390,430,768,1024,1440]){
  await p.setViewportSize({width,height:844});let signature;
  for(const page of ['/profil','/','/mehsul','/qrup','/sifarislerim','/profil']){
   await p.goto(origin+page);await p.locator('.browser-bottom-nav a[href="/profil"]').waitFor({state:'attached'});eq(await p.locator('.browser-bottom-nav').count(),1);eq(await p.locator('.browser-bottom-nav a').count(),5,'same five authenticated links');
   if(width<=850){await p.locator('.browser-bottom-nav').waitFor();const s=await p.locator('.browser-bottom-nav a').first().evaluate(e=>{const c=getComputedStyle(e),i=e.querySelector('svg').getBoundingClientRect();return {font:c.fontSize,line:c.lineHeight,height:e.getBoundingClientRect().height,icon:i.width,nav:e.parentElement.getBoundingClientRect().height};});if(!signature)signature=s;eq(s,signature,'menu geometry stable across pages');eq(s.font,'11px');eq(s.icon,24);eq(s.height>=44,true);}
   eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await p.reload();await p.locator('.browser-bottom-nav a[href="/profil"]').waitFor({state:'attached'});eq(await p.locator('.browser-bottom-nav a').count(),5,'profile survives refresh');
   if(page==='/qrup'){
    for(const kind of ['is-own','is-other']){const e=p.locator('.community-message.'+kind).last();const valid=await e.evaluate(e=>{const a=e.querySelector('.community-avatar-frame').getBoundingClientRect(),b=e.querySelector('.community-message-bubble').getBoundingClientRect();return Math.abs(a.y+a.height/2-b.y-b.height/2)<1&&(e.classList.contains('is-own')?a.left>=b.right:a.right<=b.left);});eq(valid,true,'avatar centred alongside bubble');}
    const menu=p.locator('.community-message.is-own .group-message-menu').last();await menu.locator('summary').click();eq(await menu.locator('button').first().isVisible(),true,'ellipsis still functional');await menu.locator('summary').click();
    if(width===390)await p.screenshot({path:out+'/after-mobile.png'});
    if(width===1440)await p.screenshot({path:out+'/after-desktop.png'});
    await p.locator('.community-message-body').evaluateAll(es=>es.forEach(e=>e.textContent='Uzun mesaj '+('https://example.test/çoxuzunsətir '.repeat(12))));eq(await p.locator('.community-messages').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
    eq(await p.locator('.community-message.is-own').last().evaluate(e=>{const a=e.querySelector('.community-avatar-frame').getBoundingClientRect(),b=e.querySelector('.community-message-bubble').getBoundingClientRect();return Math.abs(a.y+a.height/2-b.y-b.height/2)<1;}),true,'long avatar stays in row');
   }
  }
 }
 // A transient state error cannot make a signed-in menu look signed out.
 await p.goto(origin+'/');await p.locator('[data-browser-nav=profile]').first().waitFor({state:'attached'});await p.route('**/api/community/state',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));await p.evaluate(()=>window.refreshCommunityNav());eq(await p.locator('.browser-bottom-nav [data-browser-nav=profile]').count(),1);await p.unroute('**/api/community/state');
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>document.body.classList.add('paymentCheckoutOpen'));eq(await p.locator('.browser-bottom-nav').isVisible(),false,'checkout still hides menu');await p.evaluate(()=>document.body.classList.remove('paymentCheckoutOpen'));
 const g=await guest.newPage();await g.goto(origin+'/');await g.locator('.browser-bottom-nav').waitFor({state:'attached'});eq(await g.locator('.browser-bottom-nav a').count(),4);eq(await g.locator('[data-browser-nav=profile]').count(),0);
 const signout=await owner.request.post(origin+'/api/auth/sign-out',{headers:{Origin:origin},data:{}});eq(signout.status(),200);await p.goto(origin+'/');await p.locator('.browser-bottom-nav').waitFor({state:'attached'});await p.waitForTimeout(200);eq(await p.locator('.browser-bottom-nav a').count(),4,'sign-out hides profile');eq(errors,[]);
 eq(missing,[]);await p.close();await g.close();
}
