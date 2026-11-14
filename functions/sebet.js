import {withStorefrontHead} from '../storefront-head.mjs';
import {proxyCommunity} from './_owner-community.js';

export async function onRequest(context){
 return shopShell(context);
}
export async function shopShell(context,{balance=false}={}){
 const {request}=context,url=new URL(request.url);
 if(request.method!=='GET'||url.hostname!=='mirpanel.com'||(!balance&&url.search)||
    request.headers.has('Origin')&&request.headers.get('Origin')!==url.origin)return proxyCommunity(context);
 // The cart shell contains neither cart data nor session information. The
 // quote and checkout APIs remain the only price, stock and account authority.
 try{
  const asset=new URL('/customer-header.html',url);
  const header=await context.next(new Request(asset));
  if(!header.ok||!(header.headers.get('Content-Type')||'').startsWith('text/html'))return proxyCommunity(context);
  const markup=await header.text();
  if(!/^\s*<header\b/i.test(markup)||!markup.includes('id="mainHeader"'))return proxyCommunity(context);
  const loading=balance?'<h1>Balansım</h1><div class="shop-wallet-loading" role="status">Balans məlumatı yüklənir…</div>':'';
  return new Response(withStorefrontHead(`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>MirPanel · Səbət və balans</title><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="/community-assets/shop.css?v=checkout-first-paint-2">${balance?'<link rel="stylesheet" href="/customer-footer.css?v=chat-space-20261108" data-shell-persistent data-customer-footer-style>':''}<body class="community-page${balance?' wallet-page-active':''}">${markup}<main id="shopApp" class="shop-page${balance?' shop-wallet-page':''}">${loading}</main><script type="module" src="/community-assets/shop-ui.js?v=customer-perf-2"></script><script defer src="/page-navigation.js?v=az-addresses-1" data-page-navigation-loader></script><script defer src="/site-header.js?v=cart-ready-now-1"></script></body></html>`),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff','Server-Timing':(balance?'wallet':'cart')+'-shell;desc="edge"'}});
 }catch{return proxyCommunity(context);}
}
