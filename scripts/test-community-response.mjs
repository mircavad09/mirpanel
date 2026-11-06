import assert from 'node:assert/strict';
import {proxyCommunity} from '../functions/_owner-community.js';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};const original=fetch;
const request=path=>new Request('https://mirpanel.com'+path);
try{
 for(const path of ['/hesab?next=%2Fprofil','/api/community/state','/api/auth/get-session','/community-assets/auth-forms.js','/community-assets/auth-forms.css']){
  globalThis.fetch=async()=>new Response('<!doctype html><html><body><h1>Synthetic security check</h1></body></html>',{headers:{'Content-Type':'text/html'}});
  const r=await proxyCommunity({request:request(path)});eq(r.status,503);eq(r.headers.get('Content-Type').includes('application/json'),true);eq((await r.json()).code,'COMMUNITY_UPSTREAM_RESPONSE');
 }
 for(const [path,type,body] of [['/hesab','text/html','<main id="communityApp"></main>'],['/balans','text/html','<main id="shopApp"></main>'],['/api/community/state','application/json','{"profile":null}'],['/api/auth/get-session','application/json','null'],['/community-assets/auth-forms.js','text/javascript','export const a=1;'],['/community-assets/auth-forms.css','text/css','.auth-screen{}'],['/community-assets/google-g.png','image/png','synthetic image'],['/api/community/media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp','image/webp','private synthetic image']]){
  globalThis.fetch=async()=>new Response(body,{headers:{'Content-Type':type}});const r=await proxyCommunity({request:request(path)});eq(r.status,200);eq(await r.text(),body);
 }
 globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://mirpanel.onrender.com/hesab?next=%2Fprofil'}});
 let r=await proxyCommunity({request:request('/profil')});eq(r.status,302);eq(r.headers.get('Location'),'https://mirpanel.com/hesab?next=%2Fprofil');
 globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'/hesab?error=INVALID_TOKEN'}});
 r=await proxyCommunity({request:request('/api/auth/verify-email?token=synthetic')});eq(r.headers.get('Location'),'https://mirpanel.com/hesab?error=INVALID_TOKEN');
 globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://accounts.google.com/o/oauth2/v2/auth?synthetic=true'}});
 r=await proxyCommunity({request:request('/api/auth/sign-in/social')});eq(r.headers.get('Location'),'https://accounts.google.com/o/oauth2/v2/auth?synthetic=true');
 globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://mirpanel.onrender.com/admin.html'}});
 eq((await proxyCommunity({request:request('/hesab')})).status,503);
 let received;globalThis.fetch=async(url)=>{received=url;return new Response(null,{status:302,headers:{Location:'https://mirpanel.com/hesab?mode=new-password&token=synthetic'}});};
 r=await proxyCommunity({request:request('/api/auth/reset-password/synthetic_Token-001')});eq(r.status,302);eq(received,'https://mirpanel.onrender.com/api/auth/reset-password/synthetic_Token-001');
 eq((await proxyCommunity({request:request('/api/auth/reset-password/invalid%2Fpath')})).status,404);
 globalThis.fetch=async()=>new Response('{"error":"Invalid email or password"}',{status:401,headers:{'Content-Type':'application/json'}});
 eq((await proxyCommunity({request:request('/api/auth/sign-in/email')})).status,401);
 console.log(JSON.stringify({checks,unexpectedHtmlBlocked:true,firstPartyRedirects:true,resetRoute:true,productionRequests:0}));
}finally{globalThis.fetch=original;}
