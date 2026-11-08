import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {createOwnerCommunity} from '../mirpanel-admin/community/service.mjs';
import {avatarSource,avatarStickers,stickerUrl} from '../mirpanel-admin/community/public/avatar-stickers.js';
import {shopFixture} from './shop-test-fixture.mjs';

const port=Number(process.env.MIRPANEL_SHOP_TEST_PORT);
assert(port>=1024&&port<=65535,'Use an isolated local PostgreSQL port');
const fixture=await shopFixture(),{pool,database}=fixture;
const origin='http://127.0.0.1:55464',secret=crypto.randomBytes(48).toString('base64url');
const app=createOwnerCommunity({
 COMMUNITY_OWNER_ENABLED:'true',COMMUNITY_PUBLIC_ENABLED:'true',COMMUNITY_TEST:'true',COMMUNITY_ORIGIN:origin,
 COMMUNITY_DATABASE_URL:'postgres://shop_test@127.0.0.1:'+port+'/'+database,
 COMMUNITY_AUTH_SECRET:secret,COMMUNITY_GOOGLE_CLIENT_ID:'synthetic.apps.googleusercontent.com',COMMUNITY_GOOGLE_CLIENT_SECRET:'synthetic'
},{sendAuthEmail:async()=>{throw Error('No email may be sent in this test');}});
const files=path.resolve('.'),mime={js:'text/javascript',css:'text/css',webp:'image/webp',png:'image/png',svg:'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 if(await app.handle(req,res))return;
 const url=new URL(req.url,origin),file=path.resolve('.'+url.pathname);
 if(!file.startsWith(files+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file).slice(1)]||'application/octet-stream'});res.end(fs.readFileSync(file));
});
const sharp=createRequire(import.meta.url)('../receipt-worker/node_modules/sharp');
const png=await sharp({create:{width:420,height:330,channels:3,background:'#224466'}}).png().toBuffer();
async function session(uid){
 const token=crypto.randomBytes(24).toString('hex');
 await pool.query('insert into session(id,"userId",token,"expiresAt","updatedAt") values($1,$2,$3,clock_timestamp()+interval \'1 day\',clock_timestamp())',[crypto.randomUUID(),uid,token]);
 return {name:'mirpanel_owner.session_token',value:encodeURIComponent(token+'.'+crypto.createHmac('sha256',secret).update(token).digest('base64')),url:origin,httpOnly:true,sameSite:'Lax'};
}
const send=(endpoint,auth,body,contentType='application/json',sender=origin)=>fetch(origin+endpoint,{method:'POST',headers:{Origin:sender,'Content-Type':contentType,...(auth?{Cookie:auth.name+'='+auth.value}:{})},body});
const sticker='/api/community/profile-avatar';
try{
 await pool.query(fs.readFileSync('mirpanel-admin/community/customer-activity-migration.sql','utf8'));
 await new Promise(r=>server.listen(55464,'127.0.0.1',r));
 const b=await session('b'),a=await session('a');
 assert.equal((await send(sticker,null,'{"sticker":"robot"}')).status,401);
 assert.equal((await send(sticker,a,'{"sticker":"robot"}','application/json','https://invalid.example')).status,403);
 for(const payload of [{sticker:'https://invalid.example'},{sticker:'__proto__'},{sticker:'robot',userId:'b'}])assert.equal((await send(sticker,a,JSON.stringify(payload))).status,400);
 const uploaded=await send('/api/community/profile-media?kind=avatar',b,png,'application/octet-stream');
 assert.equal(uploaded.status,200);const custom=(await uploaded.json()).avatarUrl;
 assert.match(custom,/^\/api\/community\/media\//);
 assert.equal(avatarSource({avatar:5}),null);assert.equal(avatarSource({avatar:0}),stickerUrl('robot'));
 assert.equal(avatarSource({avatar:0,avatar_path:custom.split('/').at(-1)}),custom);
 let bytes=0;
 for(const id of Object.keys(avatarStickers)){
  const r=await fetch(origin+stickerUrl(id));assert.equal(r.headers.get('content-type'),'image/webp');
  const image=Buffer.from(await r.arrayBuffer());bytes+=image.length;
  const {width,height,format}=await sharp(image).metadata();assert.deepEqual([width,height,format],[256,256,'webp']);
 }
 assert(bytes<30000);
 for(const [engine,width] of [[chromium,320],[webkit,390],[chromium,1440],[webkit,1440]]){
  await pool.query("update community_profiles set avatar=0,avatar_path=null where user_id='a'");
  const browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});
  try{
   const ctx=await browser.newContext({viewport:{width,height:760},hasTouch:width<1000,isMobile:width<1000});
   await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   await ctx.addCookies([await session('a')]);const p=await ctx.newPage();p.setDefaultTimeout(12000);
   await p.goto(origin+'/profil');
   const hero='.profile-avatar-photo img',head='.account-toggle .account-avatar img';
   const assertAvatar=async url=>{for(const selector of [hero,head])await p.waitForFunction(([s,u])=>{const img=document.querySelector(s);return img?.getAttribute('src')===u&&img.naturalWidth>0;},[selector,url]);};
   await assertAvatar(stickerUrl('robot'));
   await p.getByRole('button',{name:'Avatar şəklini dəyiş'}).click();
   await p.getByRole('button',{name:'MirPanel stikerləri'}).click();
   const dialog=p.getByRole('dialog',{name:'Profil şəkli'});
   assert.equal(await dialog.getByRole('radio').count(),5);
   await p.waitForFunction(()=>[...document.querySelectorAll('.profile-avatar-options img')].every(img=>img.naturalWidth>0));
   assert(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth));
   await dialog.getByRole('radio',{name:'Bayquş'}).check();
   await dialog.getByRole('button',{name:'Yadda saxla'}).click();
   await assertAvatar(stickerUrl('bayqus'));
   await p.reload();await assertAvatar(stickerUrl('bayqus'));
   await ctx.clearCookies();await ctx.addCookies([await session('a')]);await p.reload();await assertAvatar(stickerUrl('bayqus'));
   await p.locator('.profile-camera').click();
   const chooser=p.waitForEvent('filechooser');
   await dialog.getByRole('button',{name:'Qalereyadan seç'}).click();
   await (await chooser).setFiles({name:'synthetic-avatar.png',mimeType:'image/png',buffer:png});
   await p.waitForFunction(()=>document.querySelector('.profile-avatar-photo img')?.getAttribute('src')?.startsWith('/api/community/media/'));
   const next=await p.locator(hero).getAttribute('src');await assertAvatar(next);
   await p.reload();await assertAvatar(next);
   const state=await (await fetch(origin+'/api/community/state',{headers:{Cookie:b.name+'='+b.value}})).json();assert.equal(state.profile.avatarUrl,custom);
   await ctx.close();
   console.log(JSON.stringify({engine:engine.name(),width,defaultRobot:true,stickers:5,newSession:true,gallery:true,headerSynced:true,otherUploadUnchanged:true}));
  }finally{await browser.close();}
 }
 console.log(JSON.stringify({bytes,productionWrites:0}));
}finally{await app.close();if(server.listening)await new Promise(r=>server.close(r));await fixture.close();}
