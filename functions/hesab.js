import {proxyCommunity} from './_owner-community.js';
export async function onRequest(context){
 const {request,env}=context,u=new URL(request.url);
 if(u.hostname!=='mirpanel.com'||!['GET','HEAD'].includes(request.method)||!env.ASSETS)return proxyCommunity(context);
 const header=await env.ASSETS.fetch(new Request(new URL('/customer-header',u))),markup=header.ok?await header.text():'';
 if(!/^\s*<header\b[^>]*site-header/.test(markup))return proxyCommunity(context);
 return new Response(request.method==='HEAD'?null:`<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Hesab · MirPanel</title><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="/community-assets/auth-forms.css?v=signup-manual-code-20261108" data-shell-persistent></head><body class="community-page auth-screen">${markup}<main id="authApp" class="community-shell"></main><script type="module" src="/community-assets/auth-forms.js?v=order-delivery-20261108"></script><script defer src="/site-header.js?v=profile-start-20261108"></script></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow'}});
}
