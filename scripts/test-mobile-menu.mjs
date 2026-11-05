import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const header=fs.readFileSync('customer-header.html','utf8'),out='payment-test-artifacts/mobile-menu';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://local'),file=u.pathname.slice(1);
 if(u.pathname==='/api/community/state'){res.setHeader('Content-Type','application/json');return res.end('{"profile":null}');}
 if(['/','/mehsul','/haqqimizda','/sertler','/elaqe'].includes(u.pathname)){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-header.css"><style>body{margin:0;background:#101112;color:#eee;font:16px system-ui}main{height:2000px;padding:20px}</style>'+header+'<main><h1>'+ (u.pathname==='/'?'Ana səhifə':'Məhsullar')+'</h1></main><script src="/site-header.js"></script>');}
 if(!file.includes('..')&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'image/png');return res.end(fs.readFileSync(file));}
 res.writeHead(404);res.end();
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of [320,360,390,430]){
 const ctx=await b.newContext({viewport:{width,height:844},hasTouch:true}),p=await ctx.newPage();let docs=0;
 p.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===p.mainFrame())docs++;});
 await p.goto(origin+'/');await p.waitForFunction(()=>document.querySelector('link[data-mobile-menu-style]')?.sheet);
 const toggle=p.locator('.site-header-menu-button'),menu=p.locator('.site-header-drawer'),x=p.locator('.site-header-menu-close');
 const closed=async()=>{assert.equal(await toggle.getAttribute('aria-expanded'),'false');await p.waitForFunction(()=>getComputedStyle(document.querySelector('.site-header-drawer')).visibility==='hidden');assert.equal(await menu.evaluate(n=>n.inert),true);};
 await toggle.tap();await menu.waitFor();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
 const rect=await p.evaluate(()=>{const a=document.querySelector('.site-header-menu-button').getBoundingClientRect(),m=document.querySelector('.site-header-drawer').getBoundingClientRect();return {left:Math.abs(a.left-m.left),below:m.top>=a.bottom,overflow:document.documentElement.scrollWidth>innerWidth};});assert.ok(rect.left<2);assert.ok(rect.below);assert.equal(rect.overflow,false);
 assert.equal(await p.locator('#supportWidget .support-whatsapp').isVisible(),false);
 await toggle.tap();await closed();await toggle.tap();await x.tap();await closed();assert.equal(await toggle.evaluate(n=>document.activeElement===n),true);
 await toggle.tap();await p.keyboard.press('Escape');await closed();
 await toggle.tap();await p.locator('.site-header-overlay').tap({position:{x:width-3,y:20}});await closed();
 await p.setViewportSize({width,height:430});await toggle.tap();const scroll=await menu.locator('nav').evaluate(n=>{n.scrollTop=n.scrollHeight;return {scroll:n.scrollTop>0,visible:n.getBoundingClientRect().height>0};});assert.equal(scroll.scroll,true);assert.equal(scroll.visible,true);
 await p.setViewportSize({width,height:844});await x.tap();await toggle.tap();await menu.getByRole('link',{name:'Məhsullar',exact:true}).tap();await p.waitForURL(origin+'/mehsul');await closed();assert.equal(docs,1);assert.equal(await menu.locator('a[href="/mehsul"]').getAttribute('aria-current'),'page');
 for(const path of ['/haqqimizda','/sertler','/elaqe']){await toggle.tap();await menu.locator('a[href="'+path+'"]').tap();await p.waitForURL(origin+path);await closed();}assert.equal(docs,1);
 await p.emulateMedia({reducedMotion:'reduce'});await toggle.tap();assert.equal(await menu.evaluate(n=>getComputedStyle(n).transitionDuration),'0s');await p.keyboard.press('Escape');await closed();
 await ctx.close();console.log(JSON.stringify({width,toggle:true,close:true,outside:true,escape:true,scroll:true,reducedMotion:true,documentRequests:docs}));
 }
}finally{await b.close();await new Promise(r=>server.close(r));}
