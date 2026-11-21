import assert from 'node:assert/strict';import {proxyCommunity} from '../functions/_owner-community.js';
const previous=globalThis.fetch;
try{
 globalThis.fetch=async()=>Response.json({error:'Qrup söhbəti müvəqqəti bağlıdır'},{status:403});
 const closed=await proxyCommunity({request:new Request('https://mirpanel.com/api/community/events')});assert.equal(closed.status,403);assert.equal((await closed.json()).error,'Qrup söhbəti müvəqqəti bağlıdır');
 globalThis.fetch=async()=>new Response('<main id="communityApp"><h1>Qrup söhbəti müvəqqəti bağlıdır</h1><a href="/elaqe">Şəxsi dəstək</a></main>',{headers:{'Content-Type':'text/html'}});
 const page=await proxyCommunity({request:new Request('https://mirpanel.com/qrup')});assert.equal(page.status,200);assert((await page.text()).includes('Şəxsi dəstək'));
 globalThis.fetch=async()=>new Response('<h1>Bad Gateway</h1>',{status:502,headers:{'Content-Type':'text/html'}});assert.equal((await proxyCommunity({request:new Request('https://mirpanel.com/api/community/events')})).status,503);
 console.log('PASS: explicit closed-stream JSON and closed HTML page forwarded; invalid gateway HTML still rejected');
}finally{globalThis.fetch=previous;}
