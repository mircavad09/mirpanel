import fs from 'node:fs';import http from 'node:http';import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {Repository} from '../mirpanel-admin/community/repository.mjs';
import {GroupControl} from '../mirpanel-admin/community/group-control.mjs';
import {ensureInfluencers} from '../mirpanel-admin/community/influencers.mjs';
import {ensureTokens} from '../mirpanel-admin/community/tokens.mjs';
import {ensurePublicGroup,publicGroupOpen,requirePublicGroup,setPublicGroup} from '../mirpanel-admin/community/public-group.mjs';
import {handlePublicCommunity,counts} from '../mirpanel-admin/community/public-service.mjs';
import {CommunityLive} from '../mirpanel-admin/community/live.mjs';
import {chromium,webkit} from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
process.env.MIRPANEL_CART_V2_TEST='1';const f=await shopFixture(),{pool,id}=f,repo=new Repository(pool),group=new GroupControl(repo),owner=(await pool.query('select * from "user" where id=\'owner\'')).rows[0],a=(await pool.query('select * from "user" where id=\'a\'')).rows[0];
const runtime={pool,repo,group,auth:{api:{getSession:async({headers})=>headers.get('cookie')?.includes('synthetic=a')?{user:a,session:{id:'group-test-session'}}:null}}};
const toggle=open=>setPublicGroup(repo,owner,{open,requestId:id()});let server,origin,browser;
try{
 await ensureInfluencers(pool);await ensureTokens(pool);await ensurePublicGroup(pool);
 await pool.query('update community_config set enabled=true where id=true');await pool.query('insert into public_community_release(version,ready) values(1,true) on conflict(version) do update set ready=true');
 await repo.ensure(a);await pool.query('insert into session(id,token,"userId","expiresAt","updatedAt") values(\'group-test-session\',\'synthetic-only\',\'a\',clock_timestamp()+interval \'1 day\',clock_timestamp())');
 assert.equal(await publicGroupOpen(pool),false);await assert.rejects(requirePublicGroup(pool),e=>e.status===403);
 await assert.rejects(pool.query('insert into community_messages(user_id,client_id,body) values(\'a\',$1,\'Blocked synthetic message\')',[id()]),e=>e.code==='42501');
 await assert.rejects(setPublicGroup(repo,a,{open:true,requestId:id()}),e=>e.status===403);
 await toggle(true);await pool.query(fs.readFileSync('mirpanel-admin/community/public-group.sql','utf8'));assert.equal(await publicGroupOpen(pool),true,'restarting migration must preserve an explicit owner reopening');
 await repo.send(a,'Synthetic public group history',id());const before=(await pool.query('select id::text,body from community_messages order by id')).rows;
 server=http.createServer(async(req,res)=>{const u=new URL(req.url,origin),json=(r,s,data)=>{r.writeHead(s,{'Content-Type':'application/json','Cache-Control':'private,no-store'});r.end(JSON.stringify(data));};try{
  if(u.pathname.startsWith('/api/community/')||u.pathname==='/qrup')return await handlePublicCommunity({req,res,u,origin,runtime,json,html:(r,s)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(s);},body:async r=>{const parts=[];for await(const p of r)parts.push(p);return JSON.parse(Buffer.concat(parts).toString()||'{}');},catalog:async()=>f.catalog,inventory:async()=>[]});
  if(u.pathname==='/')return res.end('<!doctype html><html lang="az"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/site-header.css"><body><nav><a href="/qrup">Qrup/Söhbət</a><a href="/mehsul">Məhsullar</a></nav><aside><a href="https://mirpanel.com/qrup?tag=1">Qrup</a><a href="/elaqe">Şəxsi dəstək</a><a href="https://wa.me/994514113545">WhatsApp</a></aside><script src="/site-header.js" defer></script></body></html>');
  const file=u.pathname.startsWith('/community-assets/')?'mirpanel-admin/community/public/'+u.pathname.slice(18):u.pathname.slice(1);
  if(!file.includes('..')&&fs.existsSync(file)&&fs.statSync(file).isFile()){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'image/svg+xml');return res.end(fs.readFileSync(file));}res.writeHead(404);res.end();
 }catch(e){json(res,e.status||500,{error:e.message,code:e.code});}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 const api=(p,body)=>fetch(origin+p,{method:body?'POST':'GET',headers:{Cookie:'synthetic=a','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const stream=await api('/api/community/events');assert.equal(stream.status,200);const reader=stream.body.getReader();await reader.read();
 const key=id();await setPublicGroup(repo,owner,{open:false,requestId:key});await setPublicGroup(repo,owner,{open:false,requestId:key});
 let event='';for(let n=0;n<8&&!event.includes('event: group-closed');n++){const value=await Promise.race([reader.read(),new Promise((_,reject)=>setTimeout(()=>reject(Error('SSE close timeout')),5000))]);if(value.done)break;event+=Buffer.from(value.value).toString();}assert(event.includes('event: group-closed'));await reader.cancel();
 assert.equal((await api('/api/community/messages')).status,403);assert.equal((await api('/api/community/messages',{body:'Must never be written',clientId:id()})).status,403);assert.equal((await api('/api/community/events')).status,403);assert.equal((await api('/api/community/tag-message?messageId=1')).status,403);
 const state=await(await api('/api/community/state?group=1')).json();assert.equal(state.groupClosed,true);assert.equal(state.initialMessages,undefined);assert.equal(state.unreadTags,0);assert.equal((await api('/api/community/state')).status,200);
 assert.deepEqual(await(await api('/api/community/notifications')).json(),{items:[],unread:0});
 const pageHTML=await(await api('/qrup')).text();assert(pageHTML.includes('Qrup söhbəti müvəqqəti bağlıdır'));assert(!pageHTML.includes('src="/community-assets/community.js'));assert(pageHTML.includes('href="/elaqe"'));
 assert.deepEqual((await pool.query('select id::text,body from community_messages order by id')).rows,before);assert((await repo.messages()).items.length>0,'admin repository must retain history');
 await pool.query(fs.readFileSync('mirpanel-admin/community/public-group.sql','utf8'));assert.equal(await publicGroupOpen(pool),false);
 for(const engine of [chromium,webkit]){browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});for(const width of [320,390,430,1440]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width<600,hasTouch:width<600});await context.addCookies([{name:'synthetic',value:'a',url:origin}]);const page=await context.newPage();
  await toggle(false);await page.goto(origin+'/');await page.waitForFunction(()=>window.MirpanelPublicGroup);assert.equal(await page.locator('a[href*="qrup"]:visible').count(),0);assert(await page.getByRole('link',{name:'WhatsApp',exact:true}).isVisible());assert(await page.locator('a[href="/elaqe"]').count()>0);
  await page.goto(origin+'/qrup');await page.getByRole('heading',{name:'Qrup söhbəti müvəqqəti bağlıdır'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Mesaj',exact:true}).count(),0);assert(await page.getByRole('link',{name:'Şəxsi dəstəyə yaz',exact:true}).isVisible());
  await toggle(true);await page.goto(origin+'/qrup');await page.getByRole('textbox',{name:'Mesaj',exact:true}).waitFor();await page.getByRole('textbox',{name:'Mesaj',exact:true}).fill('Unsent synthetic text');await toggle(false);await page.getByRole('heading',{name:'Qrup söhbəti müvəqqəti bağlıdır'}).waitFor();assert.equal(await page.locator('.community-messages').count(),0);assert.equal(await page.getByRole('button',{name:'Göndər',exact:true}).count(),0);
  fs.mkdirSync('outputs/public-group-paused',{recursive:true});if(engine===chromium&&[390,1440].includes(width))await page.screenshot({path:'outputs/public-group-paused/closed-'+width+'.png'});
  await context.close();console.log('PASS '+engine.name()+' '+width+'px: hidden group links, private support retained, direct URL closed, already-open chat cleared');
 }await browser.close();browser=null;}
 assert.equal(await publicGroupOpen(pool),false);console.log('PASS: read/send/tag/event guards, DB insertion guard, owner-only persistent switch, idempotent audit, SSE cutoff and preserved history');
}finally{await browser?.close();await runtime.live?.close();if(server)await new Promise(r=>server.close(r));await f.close();}
