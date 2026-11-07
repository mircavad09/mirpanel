import {proxyCommunity} from '../_owner-community.js';
export async function onRequest(context){
 const {request,env}=context,u=new URL(request.url);
 if(u.hostname==='mirpanel.com'&&['GET','HEAD'].includes(request.method)&&env.ASSETS&&/^\/community-assets\/(auth-forms\.(?:css|js)|google-g\.png)$/.test(u.pathname)){
  const r=await env.ASSETS.fetch(new Request(new URL('/mirpanel-admin/community/public/'+u.pathname.split('/').pop()+u.search,u),{method:request.method}));
  const type=(r.headers.get('Content-Type')||'').split(';')[0].trim();
  if(r.ok&&(u.pathname.endsWith('.js')?/^(text|application)\/javascript$/.test(type):type===(u.pathname.endsWith('.css')?'text/css':'image/png')))return r;
 }
 return proxyCommunity(context);
}
