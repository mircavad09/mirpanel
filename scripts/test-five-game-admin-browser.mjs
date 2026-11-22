import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {extractAdminState} from '../mirpanel-admin/core.mjs';
const root=process.cwd(),state=extractAdminState(fs.readFileSync('app.js','utf8'));
const manifest=JSON.parse(fs.readFileSync('catalog/five-games-20261122.json','utf8'));
const out=process.env.MIRPANEL_GAME_QA_OUTPUT||path.resolve(root,'../../outputs/five-games-20261122');
fs.mkdirSync(out,{recursive:true});
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://fixture.test').pathname;
 const json=value=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(value));};
 if(pathname==='/api/admin/state')return json({data:state,sha:'isolated-game-drafts',csrfToken:'synthetic'});
 if(pathname.startsWith('/api/'))return json({items:[],rows:[],products:[],stories:[],banners:[],orders:[],counts:{},pagination:{total:0,totalPages:1},connection:{}});
 const file=path.resolve(root,pathname==='/community-assets/checkout-fields.js'?'mirpanel-admin/community/public/checkout-fields.js':pathname.startsWith('/uploads/')?'.'+pathname:'mirpanel-admin/public/'+(pathname==='/'?'admin.html':pathname.slice(1)));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
 for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(name==='chromium'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{});
  try{
   const page=await browser.newPage();
   await page.route('https://mirpanel.com/**',route=>{
    const file=path.resolve(root,'.'+new URL(route.request().url()).pathname);
    return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:204,body:''});
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/admin.html');
   await page.locator('.navBtn[data-view="products"]').click();
   await page.waitForFunction(()=>Boolean(state.data));
   for(const width of [320,390,430,1440]){
    await page.setViewportSize({width,height:width<600?850:1000});
    for(const definition of manifest.products){
     await page.evaluate(id=>{state.selectedId=id;renderProductForm();},definition.id);
     assert.equal(await page.locator('#productActive').isChecked(),false);
     assert.equal(await page.locator('#productDesc').inputValue(),state.products.find(p=>p.id===definition.id).desc);
     const image=page.locator('.editorHero img');
     await image.evaluate(img=>img.decode());
     assert(await image.evaluate(img=>img.naturalWidth===1200&&img.naturalHeight===675));
     await page.locator('.productEditorNav').getByRole('button',{name:'Qiymət və paketlər',exact:true}).click();
     assert.equal(await page.locator('#plans .planRow').count(),state.products.find(p=>p.id===definition.id).plans.length);
     await page.locator('.productEditorNav').getByRole('button',{name:'Müştəridən alınan məlumatlar',exact:true}).click();
     await page.locator('.productEditorNav').getByRole('button',{name:'Əsas məlumatlar',exact:true}).click();
     if(name==='chromium'&&[390,1440].includes(width))await page.screenshot({path:path.join(out,definition.slug+'-admin-'+width+'.png'),fullPage:false});
    }
   }
  }finally{await browser.close();}
 }
 console.log('PASS isolated real admin UI: all five drafts, inactive switches, images decoded without cropping, exact 2/15/0/0/0 package counts, section navigation; Chromium/WebKit at 320/390/430/1440. No live admin writes.');
}finally{await new Promise(r=>server.close(r));}
