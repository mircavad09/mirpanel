import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import vm from 'node:vm';
import cards from '../catalog-card.js';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
import {generateProductPageFiles} from '../mirpanel-admin/product-pages.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const source=fs.readFileSync('app.js','utf8'),state=extractAdminState(source);
assert.equal(cards.imageAlt({imageAlt:'   ',title:'Netflix Şəxsi'}),'Netflix Şəxsi');
assert.equal(cards.imageAlt({imageAlt:'Zoom Pro görüş hesabı',title:'Zoom'}),'Zoom Pro görüş hesabı');
assert.equal(cards.imageAlt({title:''}),'Məhsul');
assert(cards.render({id:'x',image:'x',imageAlt:'Şəkil "A"',plans:[]},0,'/x','A',5,'5 ₼').includes('alt="Şəkil &quot;A&quot;"'));
const ctx={window:{MirpanelCatalogCard:{}},publicProductTitle:v=>String(v||'').replace(/\s+almaq\s*$/i,'').trim()};vm.createContext(ctx);
vm.runInContext(source.match(/function productImageAlt\(product\) \{[\s\S]*?\n\}/)[0],ctx);
assert.equal(ctx.productImageAlt({title:'CapCut Pro almaq'}),'CapCut Pro');
ctx.mainImg={};const update=source.split('\n').find(l=>l.includes('if(mainImg) { mainImg.alt'));
for(const title of ['Zoom Pro','Netflix Şəxsi']){ctx.p={title,image:'/x'};vm.runInContext(update,ctx);assert.equal(ctx.mainImg.alt,title);}
ctx.img={};const confirm=fs.readFileSync('order-confirmation.js','utf8').split('\n').find(l=>l.includes('if (img) { img.alt'));
for(const title of ['Spotify Premium','CapCut Pro']){ctx.product={title,image:'/x'};vm.runInContext(confirm,ctx);assert.equal(ctx.img.alt,title);}
const checkHtml=(name,html)=>{const images=[...html.matchAll(/<img\b[^>]*>/gi)].map(m=>m[0]);assert(images.length,name);assert(images.every(tag=>/\balt\s*=\s*["']/.test(tag)),name+' missing alt');return images.length;};
const home=fs.readFileSync('index.html','utf8');checkHtml('Home initial HTML',home);
for(const [name,html]of generateProductPageFiles(state.products,state.siteSections,state.cms,state.content))checkHtml(name,html);
const banners=[{id:'netflix',title:'Mirpanel ana səhifə banneri',productTitle:'Netflix Şəxsi',url:'/mehsul/netflix-sexsi'},
 {id:'zoom',title:'Mirpanel ana səhifə banneri',productTitle:'Zoom Pro',url:'/mehsul/zoom-pro'},
 {id:'support',title:'Canlı Dəstək',url:'https://wa.me/994000000000',placement:'side'},
 {id:'custom',title:'CapCut Pro video redaktəsi',url:'/mehsul/capcut-pro'},
 {id:'decorative',title:'',url:''}].map(b=>({...b,active:true,image:'/image.png'}));
const payload={managed:true,banners};
const server=http.createServer((req,res)=>{
 if(req.url.startsWith('/cms-site.js')){res.setHeader('content-type','text/javascript');return res.end(fs.readFileSync('cms-site.js'));}
 if(req.url==='/image.png'){res.setHeader('content-type','image/png');return res.end(fs.readFileSync('assets/logo.png'));}
 res.setHeader('content-type','text/html;charset=utf-8');res.end('<section id="homeHero" class="home-banner-layout"><div id="heroSlider"></div><div id="homeSideBanners"></div></section><script>window.UI={};window.CMS_CONTENT={};window.mirpanelHomeMedia={cached:()=>('+JSON.stringify(payload)+'),subscribe(){},request:async()=>('+JSON.stringify(payload)+')};</script><script src="/cms-site.js"></script>');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{for(const engine of [chromium,webkit]){const browser=await engine.launch(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});try{for(const width of [390,1440]){const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);assert.deepEqual(errors,[]);await page.locator('[data-banner-id=netflix] img').waitFor({state:'attached',timeout:5000}).catch(async e=>{throw Error(JSON.stringify({errors,body:await page.locator('body').innerHTML()}));});
 assert.equal(await page.locator('[data-banner-id=netflix] img').getAttribute('alt'),'Netflix Şəxsi — paketlərə baxın');
 assert.equal(await page.locator('[data-banner-id=zoom] img').getAttribute('alt'),'Zoom Pro — paketlərə baxın');
 assert.equal(await page.locator('[data-banner-id=support] img').getAttribute('alt'),'Canlı Dəstək — operatorla əlaqə');
 assert.equal(await page.locator('[data-banner-id=custom] img').getAttribute('alt'),'CapCut Pro video redaktəsi');
 assert.equal(await page.locator('[data-banner-id=decorative] img').getAttribute('alt'),'');
 assert.equal(await page.locator('img:not([alt])').count(),0);assert.deepEqual(errors,[]);console.log(JSON.stringify({engine:engine.name(),width,bannerAlts:true,decorativeEmpty:true}));await page.close();}}finally{await browser.close();}}}finally{server.close();}
console.log('PASS: initial home + 13 product HTML documents, shared catalog escaping/whitespace, legacy cache fallback, product/modal alt updates and contextual banners.');
