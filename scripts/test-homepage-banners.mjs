// Isolated browser + repository fixture. No production DB/storage writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHomepageBannersRepository, BANNER_IMAGE_MAX_BYTES} from '../mirpanel-admin/homepage-banners-repository.mjs';
const {chromium}=await import(pathToFileURL(path.join(process.env.MIRPANEL_NODE_MODULES,'playwright/index.mjs')));
const root=process.cwd(), objects=new Map(), db=[], settings={initialized:false};
let origin, failStorage=false, loseComplete=false, uploads=0, signs=0;
class Query {
  constructor(name){this.name=name;this.filters=[];this.action='read';this.orders=[];}
  select(){return this;}
  eq(k,v){this.filters.push([k,v]);return this;}
  order(key){this.orders.push(key);return this;}
  insert(value){this.action='insert';this.value=value;return this;}
  update(value){this.action='update';this.value=value;return this;}
  delete(){this.action='delete';return this;}
  single(){this.singular=true;return this;}
  maybeSingle(){this.singular=true;return this;}
  then(resolve,reject){try{
    let data=this.name==='homepage_banner_settings'?[settings]:db.filter(row=>this.filters.every(([k,v])=>row[k]===v));
    if(this.action==='insert') {if(db.some(row=>row.id===this.value.id)) return Promise.resolve({data:null,error:{message:'unique'}}).then(resolve,reject);const row={...this.value};db.push(row);data=[row];}
    if(this.action==='update') data.forEach(row=>Object.assign(row,this.value));
    if(this.action==='delete') for(const row of data) db.splice(db.indexOf(row),1);
    if(this.orders.length) data=[...data].sort((a,b)=>{for(const k of this.orders){if(a[k]!==b[k])return a[k]<b[k]?-1:1;}return 0;});
    return Promise.resolve({data:this.singular?structuredClone(data[0]||null):structuredClone(data),error:null}).then(resolve,reject);
  }catch(error){return Promise.reject(error).then(resolve,reject);}}
}
const storage={
  async createSignedUploadUrl(key){signs++;return {data:{signedUrl:`${origin}/storage/upload/${key}?signature=${signs}`}};},
  async createSignedUrl(key){return {data:{signedUrl:`${origin}/storage/read/${key}`}};},
  async list(folder,{search}){return {data:[...objects].filter(([key])=>key===`${folder}/${search}`).map(([key,buffer])=>({name:key.split('/').at(-1),metadata:{size:buffer.length}}))};},
  async download(key){return {data:new Blob([objects.get(key)])};},
  async remove(keys){keys.forEach(key=>objects.delete(key));return {data:{}};}
};
const client={from:name=>new Query(name),storage:{from:()=>storage},async rpc(name,{seed,items}){
  if(name==='reorder_homepage_banners') {
    if(items.length!==db.length || items.some(i=>!db.some(r=>r.id===i.id && r.updated_at===i.version))) return {error:{code:'CONFLICT'}};
    items.forEach((i,n)=>Object.assign(db.find(r=>r.id===i.id),{sort_order:n+1,updated_at:new Date(Date.now()+n).toISOString()}));return {data:null};
  }
  assert.equal(name,'initialize_homepage_banners');if(!settings.initialized){db.push(...seed.map(row=>({...row,media_path:null,active:true,updated_at:new Date().toISOString()})));settings.initialized=true;}return {data:null};}};
const repository=createHomepageBannersRepository(client,{bucket:'private-test',loadCatalog:async()=>({products:[{title:'Existing',active:true,image:'/assets/capcut.png',banner:{enabled:true,desktopImage:'/assets/capcut.png',order:1,url:'/mehsul/capcut-pro',mobileImage:'/assets/capcut.png'}}]})});
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'), route=url.pathname;
  const chunks=[];for await(const chunk of req) chunks.push(chunk);const body=Buffer.concat(chunks);
  if(route==='/api/homepage-banners') return json(res,200,await repository.list());
  if(route==='/api/stories') return json(res,200,{stories:[]});
  if(route.startsWith('/api/admin/homepage-banners')) {
    if(req.headers['x-csrf-token']!=='test') return json(res,401,{error:'Sessiya tələb olunur.'});
    const payload=body.length?JSON.parse(body):{};
    if(route.endsWith('/reorder')) return json(res,200,await repository.reorder(payload.items));
    if(route.endsWith('/uploads')) return json(res,200,await repository.begin(payload,'test'));
    if(route.endsWith('/complete')) {
      const banner=await repository.complete(route.split('/').at(-2),'test');
      if(loseComplete){loseComplete=false;return json(res,503,{error:'Cavab itkisi sınağı'});}
      return json(res,200,{banner});
    }
    if(req.method==='GET') return json(res,200,await repository.list(true));
    const id=route.split('/').at(-1);
    if(req.method==='PATCH') return json(res,200,{banner:await repository.update(id,payload)});
    await repository.remove(id,payload.version);return json(res,200,{ok:true});
  }
  if(route.startsWith('/storage/upload/')) {
    if(failStorage){failStorage=false;return json(res,503,{error:'Temporary storage failure'});}
    const boundary=/boundary=(.+)$/.exec(req.headers['content-type'])[1];
    const fileAt=body.indexOf(Buffer.from('filename="'));
    assert.ok(fileAt>0);assert.ok(body.includes(Buffer.from('name="cacheControl"')));
    const start=body.indexOf(Buffer.from('\r\n\r\n'),fileAt)+4;
    const end=body.indexOf(Buffer.from(`\r\n--${boundary}`),start);
    objects.set(route.slice('/storage/upload/'.length),body.subarray(start,end));uploads++;return json(res,200,{ok:true});
  }
  if(route.startsWith('/storage/read/')) {const data=objects.get(route.slice('/storage/read/'.length));if(!data)return json(res,404,{});res.writeHead(200,{'Content-Type':'image/png'});return res.end(data);}
  if(route==='/banner-admin-test') {
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(`<meta charset="utf-8"><link rel="stylesheet" href="/mirpanel-admin/public/admin.css"><main style="padding:16px;max-width:100%"><div id="host"></div></main><script>async function api(path,options={}){const r=await fetch(path,{...options,headers:{'Content-Type':'application/json','X-CSRF-Token':'test'}});const b=await r.json();if(!r.ok)throw new Error(b.error);return b;}function toast(message){window.lastToast=message;}</script><script src="/mirpanel-admin/public/homepage-banners-admin.js"></script><script>MirpanelHomepageBanners.mount(document.getElementById('host'));</script>`);
  }
  let file=route==='/'?'index.html':route.slice(1);file=path.join(root,file);
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return json(res,404,{});
  const type=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'image/jpeg';
  res.writeHead(200,{'Content-Type':type});res.end(fs.readFileSync(file));
}catch(error){json(res,error.status||500,{error:error.message,code:error.code});}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.MIRPANEL_BROWSER_PATH,headless:true});
const errors=[], results=[];const visual=process.env.MIRPANEL_VISUAL_DIR;if(visual)fs.mkdirSync(visual,{recursive:true});
try {
  assert.equal((await repository.list()).managed,false);
  assert.equal((await fetch(`${origin}/api/admin/homepage-banners/uploads`,{method:'POST',body:'{}'})).status,401);
  const admin=await browser.newPage({viewport:{width:390,height:844}});admin.on('pageerror',e=>errors.push(e.message));
  await admin.goto(`${origin}/banner-admin-test`);await admin.waitForFunction(()=>document.querySelectorAll('[data-banner-id]').length===1);
  const first=db[0]; first.legacy_image=`${origin}/assets/capcut.png`;
  const home=await browser.newPage({viewport:{width:390,height:844}});home.on('pageerror',e=>errors.push(e.message));
  await home.addInitScript(base=>{window.MIRPANEL_ADMIN_BASE=base;},origin);
  await home.goto(origin,{waitUntil:'networkidle'});await home.waitForTimeout(3200);
  const unchanged=await home.evaluate(()=>({products:document.getElementById('grid').innerHTML,stories:document.getElementById('homeStories').innerHTML}));
  const png=Buffer.from(await admin.evaluate(()=>{const c=document.createElement('canvas');c.width=3840;c.height=2160;const x=c.getContext('2d');x.fillStyle='#132933';x.fillRect(0,0,c.width,c.height);x.fillStyle='#ffd400';x.font='120px sans-serif';x.fillText('4K banner test • 3840 × 2160',150,220);for(const [a,b] of [[0,0],[3720,0],[0,2040],[3720,2040]]){x.fillStyle='#ff3535';x.fillRect(a,b,120,120);}return c.toDataURL('image/png').split(',')[1];}),'base64');
  const image={name:'4k-banner.png',mimeType:'image/png',buffer:png};
  const start=Date.now();await admin.locator('[data-banner-file]').setInputFiles(image);
  // Trigger the actual picker selection handler without opening a native chooser.
  await admin.evaluate(()=>{const file=document.querySelector('[data-banner-file]');if(!file.onchange){document.querySelector('[data-banner-add]').click();}});
  await admin.locator('[data-banner-file]').setInputFiles(image);
  await admin.waitForFunction(()=>document.querySelectorAll('[data-banner-id]').length===2);
  assert.equal(db.length,2);assert.equal(objects.size,1);assert.equal(await admin.locator('[data-banner-message]').textContent().then(t=>t.includes('yayımlandı')),true);
  assert.equal(await admin.locator('.homepageBannerJob').count(),0);
  const uploaded=db.find(row=>row.media_path);
  await home.waitForFunction(()=>document.querySelectorAll('#heroSlider .slide').length===2);
  results.push({upload:'4K PNG verified and auto-published in isolated fixture',visibleAfterMs:Date.now()-start});
  await home.waitForTimeout(5200);assert.equal(await home.evaluate(()=>currentSlide),1);
  await home.waitForTimeout(5200);assert.equal(await home.evaluate(()=>currentSlide),0);
  await home.locator('.next-arrow').click();await home.waitForTimeout(600);
  assert.equal(await home.evaluate(()=>currentSlide),1);
  assert.deepEqual(await home.evaluate(()=>({products:document.getElementById('grid').innerHTML,stories:document.getElementById('homeStories').innerHTML})),unchanged);
  for(const width of [320,390,1440]) {
    await home.setViewportSize({width,height:width<500?844:900});await home.waitForTimeout(100);
    const measure=await home.evaluate(()=>{const s=document.getElementById('heroSlider'),i=s.querySelector('.slide.active img'),r=s.getBoundingClientRect();return {width:r.width,height:r.height,fit:getComputedStyle(i).objectFit,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.equal(measure.fit,'contain');assert.equal(measure.overflow,false);results.push({viewport:width,...measure});
    if(visual)await home.screenshot({path:path.join(visual,`home-${width}.png`)});
    await admin.setViewportSize({width,height:width<500?844:900});
    assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(visual)await admin.screenshot({path:path.join(visual,`admin-${width}.png`)});
  }
  const uploadedCard=admin.locator(`[data-banner-id="${uploaded.id}"]`);
  await uploadedCard.locator('[data-banner-up]').click();
  await admin.waitForFunction(id=>document.querySelector('[data-banner-id]').dataset.bannerId===id && !document.querySelector('[data-banner-active]').disabled,uploaded.id);
  assert.equal((await repository.list(true)).banners.find(b=>b.id!==uploaded.id).url,'/mehsul/capcut-pro');
  assert.equal(db.find(r=>r.id!==uploaded.id).options.mobileImage,'/assets/capcut.png');
  await uploadedCard.locator('[data-banner-active]').uncheck();
  await home.waitForFunction(()=>document.querySelectorAll('#heroSlider .slide').length===1);
  let record=db.find(r=>r.id===uploaded.id);
  await admin.waitForFunction(id=>document.querySelector(`[data-banner-id="${id}"] [data-banner-active]`).disabled===false,uploaded.id);
  await uploadedCard.locator('[data-banner-active]').check();
  await home.waitForFunction(()=>document.querySelectorAll('#heroSlider .slide').length===2);
  // Failed replacement preserves the live row; retry re-signs the same object.
  await admin.reload();await admin.waitForFunction(()=>document.querySelectorAll('[data-banner-id]').length===2);
  const oldPath=record.media_path;failStorage=true;
  await admin.locator(`[data-banner-id="${uploaded.id}"] [data-banner-replace]`).click();
  await admin.locator('[data-banner-file]').setInputFiles(image);
  await admin.locator('.homepageBannerJob button').waitFor({state:'visible'});
  assert.equal(record.media_path,oldPath);
  const oldSigns=signs;await admin.locator('.homepageBannerJob button').click();
  await admin.waitForFunction(()=>!document.querySelector('.homepageBannerJob') && document.querySelector('[data-banner-message]').textContent.includes('yayımlandı'));
  assert.ok(signs>oldSigns);assert.equal(db.length,2);assert.equal(objects.size,1);
  // A response lost AFTER commit cannot create a second banner on retry.
  loseComplete=true;
  await admin.locator('[data-banner-add]').click();await admin.locator('[data-banner-file]').setInputFiles(image);
  await admin.locator('.homepageBannerJob').last().locator('button').waitFor({state:'visible'});
  assert.equal(db.length,3);
  await admin.locator('.homepageBannerJob').last().locator('button').click();
  await admin.waitForFunction(()=>document.querySelectorAll('[data-banner-id]').length===3);assert.equal(db.length,3);
  assert.equal(BANNER_IMAGE_MAX_BYTES,20*1024*1024);
  await assert.rejects(repository.begin({operationId:crypto.randomUUID(),size:BANNER_IMAGE_MAX_BYTES+1,fileName:'big.png'},'test'),/20 MiB/);
  const formatResults=[];
  for(const [extension,mime] of [['jpg','image/jpeg'],['webp','image/webp']]) {
    const data=Buffer.from(await admin.evaluate(mime=>{const c=document.createElement('canvas');c.width=3840;c.height=2160;return c.toDataURL(mime).split(',')[1];},mime),'base64');
    const key=crypto.randomUUID(), prepared=await repository.begin({operationId:key,fileName:`4k.${extension}`,size:data.length},'test');
    const form=new FormData();form.append('cacheControl','3600');form.append('',new File([data],`4k.${extension}`,{type:mime}));
    assert.equal((await fetch(prepared.signedUrl,{method:'PUT',body:form})).status,200);
    const banner=await repository.complete(key,'test');assert.ok(banner.image);
    await repository.remove(banner.id,banner.version);formatResults.push(`${extension}: 3840×2160 verified`);
  }
  // Only selected banner records are removed; no fallback returns when empty.
  for(const row of [...db]) await repository.remove(row.id,row.updated_at);
  await home.waitForFunction(()=>document.querySelector('.home-banner-layout').hidden);
  assert.equal((await repository.list()).managed,true);assert.equal(objects.size,0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({results,formats:formatResults,slider:'5s advance and loop passed',retry:'fresh signature, no duplicate, old image retained',activeAndDeletion:'passed',javascriptErrors:errors.length,storage:'isolated in-memory Supabase protocol fixture; NOT real Supabase/PostgreSQL'},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));objects.clear();db.length=0;}
