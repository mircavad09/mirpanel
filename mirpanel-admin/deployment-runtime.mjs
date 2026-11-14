import crypto from 'node:crypto';

// Standby is deliberately not a second live checkout server. Promotion is an
// explicit configuration change after validation and traffic/worker handover.
export function deploymentRuntime(env=process.env){
 const role=env.MIRPANEL_RUNTIME_ROLE||'active';
 if(!['active','standby'].includes(role))throw Error('INVALID_DEPLOYMENT_ROLE');
 const standby=role==='standby',token=env.MIRPANEL_STANDBY_TOKEN||'';
 if(standby&&token.length<32)throw Error('STANDBY_TOKEN_REQUIRED');
 const reads=new Set(['/api/payments/inventory','/api/homepage-banners','/api/stories','/api/product-sales','/__deployment/probe']);
 function authorized(req){const supplied=Buffer.from(String(req.headers['x-mirpanel-standby']||'')),expected=Buffer.from(token);return supplied.length===expected.length&&crypto.timingSafeEqual(supplied,expected);}
 return {role,standby,workers:!standby,
  guard(req,res){
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(pathname==='/__deployment/health'&&req.method==='GET'){
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex'});res.end(JSON.stringify({ok:true,role,workers:!standby,commit:env.RENDER_GIT_COMMIT||null}));return true;
   }
   if(!standby)return false;
   const allowed=req.method==='GET'&&reads.has(pathname)&&authorized(req);
   if(allowed)return false;
   res.writeHead(authorized(req)?503:404,{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex','Retry-After':'60'});
   res.end(JSON.stringify({error:'Bu server yalnız köçürmə sınağı üçündür. Canlı əməliyyatlar bağlıdır.',code:'DEPLOYMENT_STANDBY'}));return true;
  },
  readOnlyFetch(send){return async(input,init={})=>{
   const url=new URL(typeof input==='string'||input instanceof URL?input:input.url),method=String(init.method||input?.method||'GET').toUpperCase();
   const readRpc=url.origin===new URL(env.SUPABASE_URL).origin&&/^\/rest\/v1\/rpc\/(?:inventory_snapshot|employee_system_ready)$/.test(url.pathname);
   // No mail, supplier orders, Sheets writes, reservations, queue refresh RPC,
   // migrations or storage signing/uploads can escape standby via HTTP.
   if(!['GET','HEAD'].includes(method)&&!(method==='POST'&&readRpc))throw Error('STANDBY_OUTBOUND_WRITE_BLOCKED');
   return send(input,init);
  };}
 };
}
