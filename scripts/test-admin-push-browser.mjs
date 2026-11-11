import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import crypto from 'node:crypto';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import webpush from '../mirpanel-admin/node_modules/web-push/src/index.js';

const ids=[],sounded=[],submissions=[];
const key=webpush.generateVAPIDKeys().publicKey;
const files={'/admin-topup-notification.js':'mirpanel-admin/public/admin-topup-notification.js','/admin-push-worker.js':'mirpanel-admin/public/admin-push-worker.js','/10-mirpanel-imzasi.wav':'mirpanel-admin/public/10-mirpanel-imzasi.wav'};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const json=value=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 if(url.pathname==='/api/session')return json({csrfToken:'synthetic'});
 if(url.pathname==='/api/admin/push'){
  if(req.method==='GET')return json({publicKey:key});
  let raw='';for await(const chunk of req)raw+=chunk;submissions.push(JSON.parse(raw));return json({ok:true});
 }
 if(url.pathname==='/api/admin/community/shop')return json({pending:ids.length,ids,recentIds:ids});
 if(files[url.pathname]){
  res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'text/javascript':'audio/wav'});
  return res.end(await fs.readFile(files[url.pathname]));
 }
 res.writeHead(200,{'Content-Type':'text/html'});
 res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><header class="topbar"></header><p>Admin sınağı</p><script src="/admin-topup-notification.js" data-auto-start></script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 const ctx=await browser.newContext({permissions:['notifications']});
 await ctx.exposeBinding('recordSound',()=>sounded.push(Date.now()));
 // Subscription transport is simulated. The worker, IndexedDB and audio run normally.
 await ctx.addInitScript(()=>{
  let sub;
  PushManager.prototype.getSubscription=async function(){return sub||null;};
  PushManager.prototype.subscribe=async function(){
   sub={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-browser',toJSON(){return{endpoint:this.endpoint,keys:{p256dh:'synthetic',auth:'synthetic'}};},async unsubscribe(){sub=null;return true;}};
   return sub;
  };
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){if(this.buffer?.duration>.1)void window.recordSound();return start.apply(this,args);};
 });
 const first=await ctx.newPage();ids.push(crypto.randomUUID());
 await first.goto(origin+'/admin.html');
 await first.locator('.admin-notification-settings').waitFor();
 await first.getByText('Admin sınağı',{exact:true}).click();
 await first.waitForFunction(()=>document.querySelector('.admin-notification-settings [role=status]')?.textContent.includes('hazır'));

 assert.ok(submissions.length>=1);
 const sw=ctx.serviceWorkers()[0];
 assert.ok(sw);
 // Headless Windows has no OS notification tray. Record only calls to the display API.
 await sw.evaluate(()=>{
  self.testNotifications=[];
  self.registration.showNotification=async(title,options)=>{
   const row={title,data:options.data,close(){self.testNotifications=self.testNotifications.filter(n=>n!==row);}};
   self.testNotifications.push(row);
  };
  self.registration.getNotifications=async()=>self.testNotifications;
 });
 const push=async id=>{
  await sw.evaluate(async data=>{
   let pending;
   const event=new PushEvent('push',{data:JSON.stringify(data)});
   event.waitUntil=promise=>{pending=promise;};
   self.dispatchEvent(event);await pending;
  },{id,title:'Yeni balans müraciəti · 20,00 ₼',body:'Sınaq müştəri · #1042',createdAt:Date.now()});
 };
 await first.waitForTimeout(400);
 assert.equal(sounded.length,0);
 const one=crypto.randomUUID();ids.push(one);await push(one);
 await first.waitForFunction(()=>false,{},{timeout:200}).catch(()=>{});
 assert.equal(sounded.length,1);
 await push(one);await first.evaluate(()=>refreshAdminTopups());assert.equal(sounded.length,1);
 const second=await ctx.newPage();await second.goto(origin+'/admin.html#communityShop');
 await second.locator('.admin-notification-settings').waitFor();
 await second.getByText('Admin sınağı').click();
 await second.evaluate(()=>refreshAdminTopups());
 const two=crypto.randomUUID();ids.push(two);await push(two);
 await second.waitForTimeout(250);
 assert.equal(sounded.length,2);
 const third=await ctx.newPage();await third.goto(origin+'/other');
 await third.getByText('Admin sınağı').click();
 const three=crypto.randomUUID();ids.push(three);await push(three);
 await third.waitForTimeout(250);
 assert.equal(sounded.length,3);
 await first.reload();await first.getByText('Admin sınağı').click();await first.evaluate(()=>refreshAdminTopups());await push(three);
 await first.waitForTimeout(250);assert.equal(sounded.length,3);
 const shown=await sw.evaluate(async()=>{const n=await self.registration.getNotifications();return n.map(x=>({title:x.title,data:x.data}));});
 assert.equal(shown.length,3);
 const clickId=three;
 await sw.evaluate(async id=>{
  const notification=(await self.registration.getNotifications()).find(n=>n.data.topup===id);
  let pending;
  const event=new Event('notificationclick');event.notification=notification;
  event.waitUntil=promise=>{pending=promise;};
  self.dispatchEvent(event);await pending;
 },clickId);
 const destination=ctx.pages().find(p=>p.url().includes('topup='+clickId+'&topupAction=approve'));
 assert.ok(destination);
 await destination.getByText('Balans bildirişləri',{exact:true}).click();
 await destination.getByRole('button',{name:'Bu brauzerdə dayandır'}).click();
 await destination.getByText('Bu brauzerin bildirişləri və səsi dayandırılıb.',{exact:true}).waitFor();
 await push(crypto.randomUUID());await first.waitForTimeout(250);
 assert.equal(sounded.length,3);
 assert.equal(await sw.evaluate(async()=>(await self.registration.getNotifications()).length),2);
 // Logout suspends the listener, but its opt-in survives the next login.
 const opted=await browser.newContext({permissions:['notifications']});
 const optedPage=await opted.newPage();
 await optedPage.addInitScript(()=>{
  localStorage.setItem('mirpanel.admin.notifications.enabled','true');
  PushManager.prototype.getSubscription=async()=>({
   endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-opted',
   toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'synthetic',auth:'synthetic'}};},
   async unsubscribe(){return true;}
  });
 });
 await optedPage.goto(origin+'/admin.html');
 await optedPage.locator('.admin-notification-settings').waitFor();
 await optedPage.getByText('Admin sınağı',{exact:true}).click();
 await optedPage.evaluate(()=>window.dispatchEvent(new Event('mirpanel:session-expired')));
 await optedPage.waitForFunction(()=>document.querySelector('.admin-notification-settings [role=status]').textContent.includes('dayandırılıb'));
 assert.equal(await optedPage.evaluate(()=>localStorage.getItem('mirpanel.admin.notifications.enabled')),'true');
 await optedPage.getByText('Balans bildirişləri',{exact:true}).click();
 await optedPage.getByRole('button',{name:'Bildiriş ayarlarını yenilə'}).click();
 await optedPage.waitForFunction(()=>document.querySelector('.admin-notification-settings [role=status]').textContent.includes('Web Push abunəliyi aktivdir'));
 assert.equal(await optedPage.evaluate(()=>localStorage.getItem('mirpanel.admin.notifications.enabled')),'true');
 await opted.close();
 const denied=await browser.newContext();
 await denied.addInitScript(()=>{
  localStorage.setItem('mirpanel.admin.notifications.enabled','true');
  Object.defineProperty(Notification,'permission',{get:()=> 'denied'});
 });
 const deniedPage=await denied.newPage();await deniedPage.goto(origin+'/admin.html');
 await deniedPage.getByText('Balans bildirişləri',{exact:true}).click();
 await deniedPage.locator('.admin-notification-settings [role=status]').getByText(/bloklanıb/).waitFor();
 await denied.close();
 console.log(JSON.stringify({transport:'simulated',worker:'real',audioStarts:sounded.length,notifications:3,duplicate:false,reload:false,notificationClick:true,disabled:true,deviceDeliveryVerified:false,systemDisplay:'simulated'}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
