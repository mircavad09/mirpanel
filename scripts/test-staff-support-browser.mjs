import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import {makePublicAuth} from '../mirpanel-admin/community/public-auth.mjs';
import {hashPassword} from '../mirpanel-admin/node_modules/better-auth/dist/crypto/password.mjs';
import {staffRead,staffRequest,staffHTML,setStaffRole} from '../mirpanel-admin/community/staff-readonly.mjs';
import {supportCustomer,supportMutation} from '../mirpanel-admin/community/staff-support.mjs';
export async function runStaffBrowser({f,security}){
 const {pool,catalog}=f;let browser,server,auth;
 await setStaffRole(pool,'owner',{userId:'a',enabled:true,support:true,replacement:true});
 await pool.query(`insert into account(id,"accountId","providerId","userId",password,"createdAt","updatedAt") values('staff-credential','a','credential','a',$1,now(),now())`,[await hashPassword('Synthetic-Staff-729!')]);
 const body=async req=>{let s='';for await(const b of req)s+=b;return JSON.parse(s||'{}');};
 const context={staffRead:async(req,path,q)=>{const s=await auth.api.getSession({headers:new Headers(req.headers)}),actor=s?.user?.id,d=await staffRead(pool,actor,path,q);if(path==='/customer')Object.assign(d,await supportCustomer(pool,security,catalog,actor,q.get('id'),Number(q.get('page')||1)));return d;},staffWrite:async(req,path)=>{const s=await auth.api.getSession({headers:new Headers(req.headers)});return supportMutation(pool,security,catalog,s?.user?.id,path,await body(req));}};
 try{
  server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:55464');const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};try{
   if(u.pathname==='/api/auth/sign-in/email'){const r=await auth.api.signInEmail({body:await body(req),headers:new Headers(req.headers),asResponse:true});res.writeHead(r.status,Object.fromEntries(r.headers));return res.end(await r.text());}
   if(u.pathname.startsWith('/api/community/staff/'))return send(200,await staffRequest(context,req,u));
   if(u.pathname==='/isci'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(staffHTML);}
   const name=u.pathname.slice('/community-assets/'.length);if(u.pathname.startsWith('/community-assets/')&&['staff-reader.js','staff-support.js','staff-reader.css'].includes(name)){res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':'text/css'});return res.end(fs.readFileSync('mirpanel-admin/community/public/'+name));}
   return send(403,{error:'Denied'});
  }catch(e){send(e.status||503,{error:e.message});}});
  await new Promise(r=>server.listen(55464,'127.0.0.1',r));const origin='http://127.0.0.1:55464';
  auth=makePublicAuth(pool,{origin,secret:crypto.randomBytes(48).toString('base64url'),clientId:'synthetic',clientSecret:'synthetic'},async()=>{}, {enqueue:async()=>{}});
  const {chromium}=await import('file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});fs.mkdirSync('outputs/staff-support',{recursive:true});
  for(const width of [320,390,430,1440]){
   const ctx=await browser.newContext({viewport:{width,height:900},hasTouch:width<500}),page=await ctx.newPage();
   await page.goto(origin+'/isci');await page.getByLabel('E-poçt',{exact:true}).fill('a@example.test');await page.getByLabel('Şifrə',{exact:true}).fill('Synthetic-Staff-729!');await page.getByRole('button',{name:'İşçi hesabı ilə daxil ol'}).click();
   await page.getByPlaceholder('Ad, müştəri ID-si və ya e-poçt').fill('b@example.test');await page.getByRole('button',{name:'Axtar',exact:true}).click();await page.getByRole('button',{name:'Reader B',exact:true}).click();
   await page.getByRole('heading',{name:'Dəstək qeydləri'}).waitFor();assert(!await page.getByRole('button',{name:'Məhsul hesabına bax'}).count());
   if(width===320){await page.getByRole('button',{name:'Əvəzlə',exact:true}).filter({visible:true}).all().then(async buttons=>{for(const b of buttons)if(await b.isEnabled()){await b.click();break;}});const dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.getByRole('button',{name:'Əvəzləməni təsdiqlə'}).click();assert(await dialog.isVisible(),'Required reason prevents submission');await dialog.getByRole('textbox').fill('Synthetic browser login failure');await page.screenshot({path:'outputs/staff-support/confirmation-320.png',fullPage:true});await dialog.getByRole('button',{name:'Əvəzləməni təsdiqlə'}).click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#staffError')?.textContent==='Əvəzləmə tamamlandı');}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const note=page.getByRole('textbox',{name:'Dəstək qeydi (şifrə və kod yazmayın)'});await note.fill('Synthetic support note '+width);await page.getByRole('button',{name:'Qeydi saxla'}).click();await page.getByText('Synthetic support note '+width,{exact:true}).waitFor({timeout:6000}).catch(async e=>{console.log('SYNTHETIC_UI_ERROR',await page.locator('#staffError').innerText(),await page.locator('form').last().innerText());throw e;});
   await page.screenshot({path:'outputs/staff-support/mobile-'+width+'.png',fullPage:true});
   if(width===1440){await setStaffRole(pool,'owner',{userId:'a',enabled:false});await page.getByText('İşçi icazəniz yoxdur və ya ləğv edilib.',{exact:false}).waitFor({timeout:14000});assert.equal(await page.getByRole('heading',{name:'Dəstək qeydləri'}).count(),0);await setStaffRole(pool,'owner',{userId:'a',enabled:true,support:true,replacement:true});}
   await ctx.close();
  }
  const noticeContext=await browser.newContext(),noticePage=await noticeContext.newPage(),noticeId='replacement:'+crypto.randomUUID();
  await noticePage.route('**/api/community/notifications',r=>r.fulfill({json:{unread:1,items:[{messageId:noticeId,createdAt:new Date().toISOString(),readAt:null,text:'Hesabınız əvəzləndi',href:'/profil?tab=sifarislerim&order=975'}]}}));
  await noticePage.route('**/api/community/notifications/read',r=>r.fulfill({json:{ok:true}}));
  await noticePage.route('**/community-notices.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('community-notices.js','utf8')}));
  await noticePage.route('**/notice-fixture',r=>r.fulfill({contentType:'text/html',body:'<button class="account-bell">Bildirişlər</button><div id="accountNotifications"></div><script>window.mirpanelAccountProfile={user_id:"synthetic-customer"}</script><script src="/community-notices.js"></script>'}));
  await noticePage.goto(origin+'/notice-fixture');const noticeLink=noticePage.getByRole('link',{name:'Hesabınız əvəzləndi',exact:true});await noticeLink.waitFor();assert.equal(await noticeLink.getAttribute('href'),'/profil?tab=sifarislerim&order=975');const [marked]=await Promise.all([noticePage.waitForRequest(r=>r.url().endsWith('/notifications/read')),noticeLink.click()]);assert.equal(marked.postDataJSON().messageId,noticeId);await noticeContext.close();
  console.log('PASS browser own-account login, customer search, safe support history, note submission, mobile 320/390/430 and desktop 1440 no overflow, credentials hidden, live role revocation clears UI, existing notification bell opens order and marks only owned replacement notice.');
 }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));}
}
