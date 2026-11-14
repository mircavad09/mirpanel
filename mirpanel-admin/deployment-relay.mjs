import http from 'node:http';import {Readable}from'node:stream';import {pipeline}from'node:stream/promises';
const hop=new Set(['host','connection','keep-alive','transfer-encoding','upgrade','proxy-authorization','proxy-authenticate','te','trailer']);
export function createDeploymentRelay({target,send=fetch}){
 const upstream=new URL(target);
 if(upstream.username||upstream.password||upstream.pathname!=='/'||upstream.search||upstream.hash)throw Error('INVALID_RELAY_TARGET');
 return http.createServer(async(req,res)=>{
  if(!req.url.startsWith('/')||req.url.startsWith('//')){res.writeHead(400);return res.end();}
  if(req.url==='/__deployment/health'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({ok:true,role:'relay',workers:false,target:upstream.hostname}));}
  if(req.headers['x-mirpanel-relay-hop']){res.writeHead(508);return res.end();}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  req.once('aborted',()=>controller.abort());res.once('close',()=>{if(!res.writableFinished)controller.abort();});
  try{
   const headers=new Headers();for(const [name,value]of Object.entries(req.headers))if(!hop.has(name)&&value!==undefined)headers.set(name,Array.isArray(value)?value.join(', '):value);
   const oldOrigin='https://'+req.headers.host;
   if(headers.get('origin')===oldOrigin)headers.set('origin',upstream.origin);
   if(headers.get('referer')?.startsWith(oldOrigin+'/'))headers.set('referer',upstream.origin+headers.get('referer').slice(oldOrigin.length));
   headers.set('x-mirpanel-relay-hop','1');
   const r=await send(new URL(req.url,upstream),{method:req.method,headers,redirect:'manual',signal:controller.signal,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
   clearTimeout(timer);for(const [name,value]of r.headers)if(!hop.has(name)&&name!=='set-cookie'&&name!=='content-encoding'&&name!=='content-length')res.setHeader(name,value);
   const cookies=r.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
   res.setHeader('X-Mirpanel-Region','frankfurt-via-legacy');res.statusCode=r.status;
   if(req.method==='HEAD'||!r.body)return res.end();await pipeline(Readable.fromWeb(r.body),res);
  }catch{if(!res.headersSent){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store','Retry-After':'5'});res.end(JSON.stringify({error:'Xidmətə bağlantı alınmadı. Yenidən cəhd edin.',code:'REGION_UPSTREAM_UNAVAILABLE'}));}else res.destroy();}
  finally{clearTimeout(timer);}
 });
}
