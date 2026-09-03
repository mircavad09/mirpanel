import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {activeProductsWithSlugs,generateProductPageFiles,generateProductPageHtml} from '../mirpanel-admin/product-pages.mjs';

// Capture --baseline from HEAD's CSS, then run without it for working-CSS comparison.
// All pages/data are local fixtures; external requests and writes are blocked.

const root=path.resolve(import.meta.dirname,'..');
const baseline=process.argv.includes('--baseline');
const baselineCss=baseline?execFileSync('git',['show',`${process.env.MIRPANEL_PLAN_BASELINE_REF||'HEAD'}:product-page.css`],{cwd:root}):null;
const out=path.join(root,'payment-test-artifacts/plan-visuals');
fs.mkdirSync(out,{recursive:true});
const state=extractAdminState(fs.readFileSync(path.join(root,'app.js'),'utf8'));
const products=activeProductsWithSlugs(state.products);
const pages=generateProductPageFiles(state.products,state.siteSections,state.cms,state.content);
const planless={...products[0].product,id:'fixture_no_plans',plans:[]};
pages.set('mehsul/fixture-no-plans.page',generateProductPageHtml(planless,'fixture-no-plans',products,state.siteSections,state.cms,state.content));
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
let writes=0;
const server=http.createServer((req,res)=>{
  if(req.method!=='GET'){writes++;res.writeHead(405);return res.end();}
  const url=new URL(req.url,'http://localhost');
  if(baselineCss&&url.pathname==='/product-page.css'){res.setHeader('Content-Type','text/css');return res.end(baselineCss);}
  const html=pages.get(url.pathname.slice(1)+'.page');
  if(html){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}
  const file=path.resolve(root,'.'+url.pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.MIRPANEL_BROWSER_PATH});
const results={},errors=[];
const previous=baseline?null:JSON.parse(fs.readFileSync(path.join(out,'baseline.json'),'utf8'));
try{
  for(const width of [320,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<769});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    for(const {product,slug} of products){
      await page.goto(origin+'/mehsul/'+slug,{waitUntil:'load'});
      const key=`${width}-${slug}`;
      const metrics=await page.evaluate(()=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
        const stable={};
        for(const s of ['.product-page-header','.product-page-breadcrumb','.product-page-media','.product-page-title','.product-page-eyebrow','.product-page-description','.product-page-delivery']){
          const e=document.querySelector(s);if(e)stable[s]={rect:rect(e),text:e.textContent};
        }
        const rows=[...document.querySelectorAll('#pp-plans-container .pp-plan-label')].map(e=>({
          text:e.textContent.replace(/\s+/g,' ').trim(),rect:rect(e),scroll:e.scrollWidth,client:e.clientWidth,
          parts:['.pp-radio-circle','.pp-plan-name','.pp-plan-disc-badge','.pp-plan-right','.pp-new-price'].map(s=>{const p=e.querySelector(s);return p?{s,rect:rect(p),weight:getComputedStyle(p).fontWeight,scroll:p.scrollWidth,client:p.clientWidth}:null;}).filter(Boolean)
        }));
        const button=document.querySelector('#pp-order-btn');
        return {stable,rows,scrollY,overflow:document.documentElement.scrollWidth>innerWidth,button:{text:button.textContent,disabled:button.disabled},protectedText:[...document.querySelectorAll('.product-page-similar,.product-page-content,.product-page-actions')].map(e=>e.textContent)};
      });
      results[key]=metrics;
      assert.equal(metrics.rows.length,(product.plans||[]).length,key+' plan count');
      assert.equal(metrics.overflow,false,key+' horizontal overflow');
      assert.equal(metrics.scrollY,0,key+' initial scroll');
      if(!baseline){
        assert.deepEqual(metrics.stable,previous[key].stable,key+' protected upper layout');
        assert.deepEqual(metrics.protectedText,previous[key].protectedText,key+' protected content');
        assert.deepEqual(metrics.button,previous[key].button,key+' order button');
        assert.deepEqual(metrics.rows.map(r=>r.text),previous[key].rows.map(r=>r.text),key+' plan data');
        for(const row of metrics.rows){
          assert.ok(row.rect.h>=60,key+' touch height');
          assert.ok(row.scroll<=row.client+1,key+' row overflow');
          const part=s=>row.parts.find(p=>p.s===s);
          const radio=part('.pp-radio-circle'),name=part('.pp-plan-name'),badge=part('.pp-plan-disc-badge'),prices=part('.pp-plan-right');
          assert.ok(Number(name.weight)<=500,key+' name weight');
          assert.ok(radio.rect.right<=name.rect.x+1,key+' radio/name overlap');
          assert.ok(name.rect.right<=(badge||prices).rect.x+1,key+' name/price overlap');
          if(badge)assert.ok(badge.rect.right<=prices.rect.x+1,key+' discount/price overlap');
          for(const p of row.parts){assert.ok(p.scroll<=p.client+1,key+' text clipping '+p.s);assert.ok(p.rect.right<=row.rect.right+1,key+' edge clipping');}
        }
        const rightEdges=metrics.rows.map(r=>r.parts.find(p=>p.s==='.pp-new-price').rect.right);
        if(rightEdges.length)assert.ok(Math.max(...rightEdges)-Math.min(...rightEdges)<1,key+' price right alignment');
      }
      await page.screenshot({path:path.join(out,`${baseline?'before':'after'}-${key}.png`),fullPage:true});
      if(metrics.rows.length){
        const target=metrics.rows.length-1;
        const row=page.locator('#pp-plans-container .pp-plan-label').nth(target);
        if(width<769)await row.tap();else await row.click();
        assert.equal(await page.locator('#pp-plans-container .pp-plan-label.active').count(),1,key+' selection');
        assert.ok(await page.locator('#pp-plans-container .pp-plan-label').nth(target).evaluate(e=>e.classList.contains('active')),key+' selected plan');
      }
    }
    await context.close();
  }
  for(const width of [320,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:false});
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    const page=await context.newPage();
    for(const slug of ['capcut-pro','fixture-no-plans']){
      await page.goto(origin+'/mehsul/'+slug,{waitUntil:'load'});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,slug+' static overflow');
      const expected=slug==='capcut-pro'?(products.find(p=>p.slug===slug).product.plans||[]).length:0;
      assert.equal(await page.locator('.product-page-static-plan').count(),expected,slug+' static plans');
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);assert.equal(writes,0);
  fs.writeFileSync(path.join(out,baseline?'baseline.json':'after.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({ok:true,phase:baseline?'before':'after',products:products.length,viewports:[320,390,768,1440],pages: Object.keys(results).length,screenshots:Object.keys(results).length,staticAndPlanlessChecks:8,protectedLayout:!baseline,planDataUnchanged:!baseline,selection:true,writes,consoleErrors:errors.length}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
