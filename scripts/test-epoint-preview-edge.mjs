import assert from 'node:assert/strict';
import {googlePreviewHTML} from '../mirpanel-admin/epoint-preview.mjs';
import {proxyCommunity} from '../functions/_owner-community.js';
const original=globalThis.fetch;
try{
 globalThis.fetch=async()=>new Response(googlePreviewHTML.replace('<main>','<main id="shopApp">'),{headers:{'Content-Type':'text/html; charset=utf-8'}});
 const response=await proxyCommunity({request:new Request('https://mirpanel.com/balans?google-pay-preview=1')});
 assert.equal(response.status,200);
 assert((await response.text()).includes('data-google-preview'));
 console.log('PASS restricted preview satisfies existing edge shell validation without weakening proxy checks');
}finally{globalThis.fetch=original;}
