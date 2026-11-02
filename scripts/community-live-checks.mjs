import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Repository} from '../mirpanel-admin/community/repository.mjs';
import {GroupControl} from '../mirpanel-admin/community/group-control.mjs';
export async function liveChecks({pool,origin,cookie,uid,owner,post,eq,browser}){
 const streams=[],contexts=[];
 async function open(auth,after=0,known=''){
  const controller=new AbortController(),events=[];const r=await fetch(origin+'/api/community/events?after='+after+'&known='+known,{headers:auth?{Cookie:auth}:{},signal:controller.signal});eq(r.status,200);eq(r.headers.get('content-type').startsWith('text/event-stream'),true);
  const x={events,controller,wait:async(fn)=>{const start=Date.now();while(Date.now()-start<5000){const e=events.find(fn);if(e)return e;await new Promise(r=>setTimeout(r,10));}throw Error('SSE_EVENT_TIMEOUT');}};streams.push(x);
  x.task=(async()=>{let buffer='';const decoder=new TextDecoder();for await(const bytes of r.body){buffer+=decoder.decode(bytes,{stream:true});let end;while((end=buffer.indexOf('\n\n'))>=0){const part=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=part.match(/^data: (.*)$/m),type=part.match(/^event: (.*)$/m);if(data&&type)events.push({type:type[1],data:JSON.parse(data[1]),time:performance.now()});}}})().catch(e=>{if(e.name!=='AbortError')throw e;});return x;
 }
 try{
  // A second independently authenticated synthetic account, no production identity.
  const email='live-'+Date.now()+'@example.test';eq((await post('/api/auth/sign-up/email',{name:'Second Reader',firstName:'Second',lastName:'Reader',email,password:'abc123',countryCode:'994',phone:'501234568',termsAccepted:true,registrationForm:true})).r.status,200);
  await pool.query('update "user" set "emailVerified"=true where email=$1',[email]);
  // Earlier authentication regressions deliberately exhaust attempts. Respect the
  // production limiter; use a fresh window rather than weakening its settings.
  await new Promise(r=>setTimeout(r,61000));
  const login=await post('/api/auth/sign-in/email',{email,password:'abc123'});eq(login.r.status,200);const second=login.r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
  const pages=[];for(const [auth,width] of [[cookie,390],[second,1440]]){const context=await browser.newContext({viewport:{width,height:900}});contexts.push(context);await context.addCookies(auth.split('; ').map(v=>({name:v.slice(0,v.indexOf('=')),value:v.slice(v.indexOf('=')+1),url:origin})));await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const page=await context.newPage();pages.push(page);await page.goto(origin+'/qrup');await page.locator('.community-compose textarea').waitFor();}
  const a=await open(cookie),b=await open(second),tab=await open(cookie);await a.wait(e=>e.type==='messages');await b.wait(e=>e.type==='messages');
  eq((await pool.query('select count(distinct user_id)::int n from community_presence where session_id in (select id from session where "userId"=$1)',[uid])).rows[0].n,1,'multiple tabs counted once');
  const times=[];let last;
  for(let i=0;i<6;i++){
   await new Promise(r=>setTimeout(r,2100));const started=performance.now(),key=crypto.randomUUID();const sent=await post('/api/community/messages',{body:'Synthetic realtime sample '+i,clientId:key},cookie);eq(sent.r.status,201);last=sent.d.id;
   const event=await b.wait(e=>e.type==='messages'&&e.data.items.some(m=>m.id===last));await pages[1].locator('[data-message-id="'+last+'"]').waitFor();times.push(Math.round(performance.now()-started));eq(times.at(-1)<1000,true,'local HTTP through browser-rendered delivery target');
   eq((await post('/api/community/messages',{body:'Synthetic realtime sample '+i,clientId:key},cookie)).d.idempotent,true);
   eq(b.events.filter(e=>e.type==='messages').flatMap(e=>e.data.items).filter(m=>m.id===last).length,1,'no duplicate SSE delivery');
  }
  b.controller.abort();await b.task;await new Promise(r=>setTimeout(r,2100));const missed=await post('/api/community/messages',{body:'Synthetic reconnect message',clientId:crypto.randomUUID()},cookie);eq(missed.r.status,201);const resumed=await open(second,last,last);await resumed.wait(e=>e.type==='messages'&&e.data.items.some(m=>m.id===missed.d.id));
  const group=new GroupControl(new Repository(pool));await group.act({id:owner},{action:'hide',targetId:missed.d.id,reason:'Synthetic deletion test',requestId:crypto.randomUUID()});await resumed.wait(e=>e.type==='messages'&&e.data.removed.includes(missed.d.id));
  await pages[0].locator('[data-message-id="'+missed.d.id+'"]').waitFor({state:'detached'});eq((await(await fetch(origin+'/api/community/messages')).json()).items.some(m=>m.id===missed.d.id),false,'hidden message absent');eq((await pool.query('select hidden from community_messages where id=$1',[missed.d.id])).rows[0].hidden,true,'audit retention, no hard deletion');
  const tag=(await pool.query('select message_id::text from community_bot_tags where recipient_id=$1 limit 1',[uid])).rows[0];if(tag){await group.act({id:owner},{action:'hide',targetId:tag.message_id,reason:'Synthetic hidden tag test',requestId:crypto.randomUUID()});eq((await fetch(origin+'/api/community/tag-message?messageId='+tag.message_id,{headers:{Cookie:cookie}})).status,404);eq((await(await fetch(origin+'/api/community/notifications',{headers:{Cookie:cookie}})).json()).items.some(n=>n.messageId===tag.message_id),false);}
  // Finish the previous moderation scenario before measuring fresh navigation.
  await pages[0].goto(origin+'/profil');await pages[0].locator('.profile-hero').waitFor();
  let streamRequests=0,messagePolls=0;const count=r=>{const u=new URL(r.url()),p=u.pathname;if(p==='/api/community/events')streamRequests++;if(p==='/api/community/messages'&&r.method()==='GET'&&!u.searchParams.has('before'))messagePolls++;};pages[0].on('request',count);
  for(const route of ['/profil','/qrup','/profil','/qrup']){await pages[0].goto(origin+route);await pages[0].locator(route==='/qrup'?'.community-compose':'.profile-hero').waitFor();eq(await pages[0].locator('.browser-bottom-nav [data-browser-nav=profile]').count(),1);}
  await pages[0].waitForTimeout(4500);eq(streamRequests,2,'exactly one stream per group visit');eq(messagePolls,0,'no primary message polling');pages[0].off('request',count);
  for(let i=0;i<pages.length;i++){eq(await pages[i].evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await pages[i].screenshot({path:'payment-test-artifacts/public-community/realtime-'+(i?'desktop':'mobile')+'.png'});}
  const old=execFileSync('git',['show','ab9ecd66b59f26ffd7e769785be660a2d0e0900c:mirpanel-admin/community/public/community.js'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});await pages[1].route('**/community-assets/community.js*',r=>r.fulfill({contentType:'text/javascript',body:old}));await pages[1].reload();await pages[1].locator('.community-message').first().waitFor();const before=[];
  for(let i=0;i<6;i++){await new Promise(r=>setTimeout(r,2100));const at=performance.now(),sent=await post('/api/community/messages',{body:'Synthetic baseline sample '+i,clientId:crypto.randomUUID()},cookie);eq(sent.r.status,201);await pages[1].locator('[data-message-id="'+sent.d.id+'"]').waitFor();before.push(Math.round(performance.now()-at));}
  console.log(JSON.stringify({scope:'same isolated local browser/server, old production JavaScript polling baseline',beforeDeliveryMs:before,medianMs:(before.toSorted((a,b)=>a-b)[2]+before.toSorted((a,b)=>a-b)[3])/2,p95Ms:Math.max(...before)}));
  const sorted=times.toSorted((a,b)=>a-b);console.log(JSON.stringify({scope:'isolated localhost HTTP + real PostgreSQL LISTEN/NOTIFY; not live internet',deliverySamplesMs:times,medianMs:(sorted[2]+sorted[3])/2,p95Ms:sorted.at(-1),streams:3,messagePolling:0}));
 }finally{for(const x of streams)x.controller.abort();await Promise.all(streams.map(x=>x.task));for(const c of contexts)await c.close();}
}
