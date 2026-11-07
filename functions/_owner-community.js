const UPSTREAM='https://mirpanel.onrender.com';
const pagePaths=['/qrup','/hesab','/profil','/owner-login','/sebet','/balans','/odenis'];
const allowedPath=p=>pagePaths.includes(p)||/^\/api\/(?:auth|community)\/[a-z/-]+$/.test(p)||/^\/api\/auth\/reset-password\/[A-Za-z0-9_-]{1,256}$/.test(p)||/^\/api\/community\/media\/[a-f0-9-]{36}\.webp$/.test(p)||/^\/community-assets\/[a-z.-]+$/.test(p);
const unavailable=()=>Response.json({error:'Hesab xidməti müvəqqəti açıla bilmir. Yenidən cəhd edin.',code:'COMMUNITY_UPSTREAM_RESPONSE'},{status:503,headers:{'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}});
export async function proxyCommunity({request}){
 const u=new URL(request.url);const allowed=allowedPath(u.pathname);
 if(u.hostname!=='mirpanel.com'){if(request.method==='GET')return Response.redirect('https://mirpanel.com'+u.pathname+u.search,302);return new Response('Forbidden',{status:403});}
 if(!allowed)return new Response('Not found',{status:404});if(!['GET','POST','HEAD','OPTIONS'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(request.headers.has('Origin')&&request.headers.get('Origin')!==u.origin)return new Response('Forbidden',{status:403});
 const headers=new Headers();for(const key of ['Content-Type','Accept','User-Agent'])if(request.headers.has(key))headers.set(key,request.headers.get(key));headers.set('Origin','https://mirpanel.com');headers.set('X-Forwarded-Host','mirpanel.com');headers.set('X-Forwarded-Proto','https');
 const confirmation=/^\/api\/auth\/confirm-email\/(?:status|change|send|verify)$/.test(u.pathname);
 const cookie=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>/^(?:__Secure-|__Host-)?mirpanel_owner[._]/.test(s)||confirmation&&s.startsWith('mirpanel_email_pending=')).join('; ');if(cookie)headers.set('Cookie',cookie);
 const stream=u.pathname==='/api/community/events'&&request.method==='GET',controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);let streaming=false;request.signal?.addEventListener('abort',()=>controller.abort(),{once:true});
 try{const r=await fetch(UPSTREAM+u.pathname+u.search,{method:request.method,headers,body:request.method==='POST'?request.body:undefined,redirect:'manual',signal:controller.signal});const out=new Headers(r.headers),redirect=r.status>=300&&r.status<400;
  if(redirect&&out.has('Location')){const target=new URL(out.get('Location'),UPSTREAM);if(target.origin===UPSTREAM){if(!allowedPath(target.pathname))return unavailable();out.set('Location',u.origin+target.pathname+target.search+target.hash);}}
  if(!redirect&&r.status!==204&&request.method!=='HEAD'){
   const type=(r.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase(),asset=u.pathname.startsWith('/community-assets/'),media=u.pathname.startsWith('/api/community/media/');
   const expected=stream?'text/event-stream':media?'image/webp':asset?(u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.js')?'javascript':u.pathname.endsWith('.png')?'image/png':u.pathname.endsWith('.svg')?'image/svg+xml':null):u.pathname.startsWith('/api/')?'json':'text/html';
   const matches=expected==='javascript'?/^(?:text|application)\/(?:java|ecma)script$/.test(type):expected==='json'?/^application\/(?:[\w.-]+\+)?json$/.test(type):type===expected;
   if(!matches)return unavailable();
   if(r.ok&&pagePaths.includes(u.pathname)&&!/<main\b[^>]*\bid=["'](?:communityApp|shopApp)["']/i.test(await r.clone().text()))return unavailable();
  }
  if(stream){clearTimeout(timeout);streaming=true;}out.set('Cache-Control',stream?'private,no-store,no-transform':'private,no-store');out.set('Vary','Cookie, Origin');out.set('X-Robots-Tag','noindex,nofollow');return new Response(r.body,{status:r.status,headers:out});}catch{clearTimeout(timeout);return unavailable();}finally{if(!streaming)clearTimeout(timeout);}
}
