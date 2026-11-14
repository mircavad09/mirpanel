import assert from'node:assert/strict';import{createDeploymentRelay}from'../mirpanel-admin/deployment-relay.mjs';
let calls=0,seen;const relay=createDeploymentRelay({target:'https://synthetic.example',send:async(u,o)=>{calls++;seen={u:String(u),...o,body:o.body?await new Response(o.body).text():null};return new Response('ok',{headers:{'Set-Cookie':'synthetic=kept; HttpOnly','Content-Type':'text/plain'}});}});
await new Promise(r=>relay.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+relay.address().port;
try{
 assert.equal((await(await fetch(base+'/__deployment/health')).json()).workers,false);assert.equal(calls,0);
 const raw=' {"event":"synthetic"}\n';const r=await fetch(base+'/api/webhooks/epinby?x=1',{method:'POST',body:raw,headers:{'svix-signature':'synthetic-signature','x-signature':'other-signature',cookie:'synthetic=private','content-type':'application/json'}});
 assert.equal(await r.text(),'ok');assert.equal(seen.body,raw);assert.equal(seen.headers.get('svix-signature'),'synthetic-signature');assert.equal(seen.headers.get('cookie'),'synthetic=private');assert.equal(seen.u,'https://synthetic.example/api/webhooks/epinby?x=1');assert.equal(calls,1);assert.match(r.headers.get('set-cookie'),/synthetic=kept/);
 const loop=await fetch(base+'/api/webhooks/epinby',{headers:{'x-mirpanel-relay-hop':'1'}});assert.equal(loop.status,508);assert.equal(calls,1);
 const external=await fetch(base+'//external.invalid/private');assert.equal(external.status,400);assert.equal(calls,1);
 console.log('PASS: legacy region runs no business workers; webhook bytes/signatures, cookies, path/query preserved; no POST replay; relay loop blocked');
}finally{await new Promise(r=>relay.close(r));}
