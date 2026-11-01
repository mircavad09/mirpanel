import fs from 'node:fs';import assert from 'node:assert/strict';
const {proxyCommunity}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('functions/_owner-community.js','utf8')).toString('base64'));
const originalFetch=globalThis.fetch,originalTimer=globalThis.setTimeout;let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
try{
 globalThis.setTimeout=(fn,ms,...args)=>originalTimer(fn,ms===30000?30:ms,...args);
 let upstream;
 globalThis.fetch=async(url,options)=>{upstream=options;return new Response(new ReadableStream({start(c){originalTimer(()=>{if(options.signal.aborted)c.error(Error('unexpected deadline'));else{c.enqueue(new TextEncoder().encode('event: counts\ndata: {"members":1,"online":0}\n\n'));c.close();}},80);}}),{headers:{'Content-Type':'text/event-stream'}});};
 const controller=new AbortController(),response=await proxyCommunity({request:new Request('https://mirpanel.com/api/community/events',{headers:{Cookie:'unrelated=secret; mirpanel_owner.session_token=synthetic',Accept:'text/event-stream'},signal:controller.signal})});eq(response.status,200);eq(response.headers.get('cache-control'),'private,no-store,no-transform');eq(upstream.headers.get('cookie'),'mirpanel_owner.session_token=synthetic');eq((await response.text()).includes('event: counts'),true);eq(upstream.signal.aborted,false);controller.abort();eq(upstream.signal.aborted,true);
 eq((await proxyCommunity({request:new Request('https://mirpanel.com/api/community/events',{headers:{Origin:'https://invalid.example'}})})).status,403);
 globalThis.fetch=async(_u,o)=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Error('timeout'))));eq((await proxyCommunity({request:new Request('https://mirpanel.com/api/community/events')})).status,503);
 console.log(JSON.stringify({checks,failures:0,headersDeadlineKept:true,streamNotCutAtDeadline:true,downstreamAbortPropagated:true,productionRequests:0}));
}finally{globalThis.fetch=originalFetch;globalThis.setTimeout=originalTimer;}
