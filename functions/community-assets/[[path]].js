import {proxyCommunity} from '../_owner-community.js';
export async function onRequest(context){
 const {request,env}=context,u=new URL(request.url);
 const sticker=/^\/community-assets\/avatar-(?:robot|pisik|bayqus|ayi|pinqvin)\.webp$/.test(u.pathname);
 const shopAsset=/^\/community-assets\/(?:shop-ui|topup-amount|wallet-topup)\.js$/.test(u.pathname);
 // These exact files are public client code, not account or payment API data.
 if(u.hostname==='mirpanel.com'&&['GET','HEAD'].includes(request.method)&&env?.ASSETS&&
    (!request.headers.has('Origin')||request.headers.get('Origin')===u.origin)&&
    (sticker||shopAsset||/^\/community-assets\/(auth-forms\.(?:css|js)|google-g\.png)$/.test(u.pathname))){
  const r=await env.ASSETS.fetch(new Request(new URL('/mirpanel-admin/community/public/'+u.pathname.split('/').pop()+u.search,u),{method:request.method}));
  const type=(r.headers.get('Content-Type')||'').split(';')[0].trim();
  if(r.ok&&(u.pathname.endsWith('.js')?/^(text|application)\/javascript$/.test(type):type===(u.pathname.endsWith('.css')?'text/css':sticker?'image/webp':'image/png'))){
   if(!shopAsset)return r;
   const headers=new Headers(r.headers);headers.append('Server-Timing','shop-asset;desc="edge"');
   if(u.pathname==='/community-assets/shop-ui.js'){headers.set('Cache-Control','private, no-cache, no-store, must-revalidate');headers.set('Cloudflare-CDN-Cache-Control','no-store');}
   return new Response(r.body,{status:r.status,headers});
  }
 }
 return proxyCommunity(context);
}
