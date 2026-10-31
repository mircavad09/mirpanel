import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

// Exact production splash markup/styles/scripts, isolated navigation documents.
// No external services, sessions, checkout requests or production data.
const {chromium}=await import(pathToFileURL('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const old=execFileSync('git',['show','43065e7:splash.js'],{encoding:'utf8'});
const markup=fs.readFileSync('index.html','utf8').split('<div id="newSplashScreen"')[1].split('<header')[0];
let backgroundRequests=0;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://local');
 if(req.method!=='GET'){res.writeHead(405);return res.end();}
 if(url.pathname==='/background'){backgroundRequests++;res.setHeader('Content-Type','application/json');return res.end('{}');}
 if(url.pathname==='/splash.js'){res.setHeader('Content-Type','text/javascript');return res.end(url.searchParams.has('before')?old:fs.readFileSync('splash.js'));}
 if(['/style.css','/splash.css','/assets/logo.png'].includes(url.pathname)){
  res.setHeader('Content-Type',url.pathname.endsWith('.css')?'text/css':'image/png');return res.end(fs.readFileSync('.'+url.pathname));
 }
 const splash='<div id="newSplashScreen"'+markup.replace('splash.js?v=intro-session-20261031','/splash.js'+(url.searchParams.has('before')?'?before=1':''));
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/splash.css"></head><body>'+splash+'<main id="content">MirPanel</main><script>fetch("/background").then(()=>document.body.dataset.loaded="true")</script></body></html>');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};const rows=[];
const hidden=p=>p.locator('#newSplashScreen').evaluate(e=>e.hidden||getComputedStyle(e).visibility==='hidden');
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),p=await context.newPage();
  await p.goto(origin+'/?before=1');
  await p.evaluate(()=>window.dispatchEvent(new ErrorEvent('error',{message:'synthetic unrelated background error'})));
  eq(await hidden(p),true,'regression: old global error handler truncates first intro');await context.close();

  const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage();
  await ctx.addInitScript(()=>{window.introStart=null;window.introEnd=null;new MutationObserver(()=>{const e=document.querySelector('#newSplashScreen');if(!e)return;if(!e.hidden&&window.introStart===null)window.introStart=performance.now();if(e.hidden&&window.introStart!==null&&window.introEnd===null)window.introEnd=performance.now();}).observe(document,{subtree:true,attributes:true,childList:true});});
  await page.goto(origin+'/');eq(await hidden(page),false,'first intro visible');
  eq(await page.evaluate(()=>document.body.dataset.loaded),'true','background request finishes during intro');
  await page.evaluate(()=>window.dispatchEvent(new ErrorEvent('error',{message:'synthetic unrelated background error'})));
  await page.waitForTimeout(300);eq(await hidden(page),false,'background error does not truncate intro');
  await page.waitForTimeout(1000);fs.mkdirSync('payment-test-artifacts/intro-session',{recursive:true});await page.screenshot({path:`payment-test-artifacts/intro-session/intro-${width}.png`});
  await page.waitForFunction(()=>document.querySelector('#newSplashScreen').hidden);
  const duration=await page.evaluate(()=>Math.round(window.introEnd-window.introStart));
  eq(duration>=2850&&duration<=3200,true,'independent three-second deadline');
  for(const route of ['/mehsul','/mehsul/test','/profil','/sifarislerim','/qrup','/']){
   await page.goto(origin+route);eq(await hidden(page),true,'internal navigation skips intro '+route);
  }
  await page.reload();eq(await hidden(page),true,'reload skips intro');
  await page.goBack();eq(await hidden(page),true,'back skips intro');
  await page.goForward();eq(await hidden(page),true,'forward skips intro');
  const second=await ctx.newPage();await second.goto(origin+'/');eq(await hidden(second),true,'session cookie covers a new tab');
  // A future video element must fail open; no video is invented or downloaded.
  const media=await browser.newContext();const m=await media.newPage();
  await m.route('**/splash.js',r=>r.fulfill({contentType:'text/javascript',body:'const video=document.createElement("video");document.getElementById("newSplashScreen").append(video);video.play=()=>Promise.reject(new Error("synthetic media failure"));'+fs.readFileSync('splash.js','utf8')}));
  await m.goto(origin+'/');eq(await hidden(m),true,'video failure fails open');await media.close();
  rows.push({width,firstMs:duration,reloadReplay:0,internalReplay:0,backForwardReplay:0});await ctx.close();
 }
 eq(backgroundRequests>0,true);
 console.log(JSON.stringify({checks,failures:0,rows,scope:'isolated exact intro component; navigation documents are synthetic',productionWrites:0}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
