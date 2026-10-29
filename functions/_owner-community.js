const UPSTREAM='https://mirpanel.onrender.com';
export async function proxyCommunity({request}){
 const u=new URL(request.url);const allowed=['/qrup','/hesab','/profil','/owner-login'].includes(u.pathname)||/^\/api\/(?:auth|community)\/[a-z/-]+$/.test(u.pathname)||/^\/api\/community\/media\/[a-f0-9-]{36}\.webp$/.test(u.pathname)||/^\/community-assets\/[a-z.-]+$/.test(u.pathname);
 if(u.hostname!=='mirpanel.com'){if(request.method==='GET')return Response.redirect('https://mirpanel.com'+u.pathname+u.search,302);return new Response('Forbidden',{status:403});}
 if(!allowed)return new Response('Not found',{status:404});if(!['GET','POST','HEAD','OPTIONS'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(request.headers.has('Origin')&&request.headers.get('Origin')!==u.origin)return new Response('Forbidden',{status:403});
 const headers=new Headers();for(const key of ['Content-Type','Accept','User-Agent'])if(request.headers.has(key))headers.set(key,request.headers.get(key));headers.set('Origin','https://mirpanel.com');headers.set('X-Forwarded-Host','mirpanel.com');headers.set('X-Forwarded-Proto','https');
 const cookie=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>/^(?:__Secure-|__Host-)?mirpanel_owner[._]/.test(s)).join('; ');if(cookie)headers.set('Cookie',cookie);
 try{const r=await fetch(UPSTREAM+u.pathname+u.search,{method:request.method,headers,body:request.method==='POST'?request.body:undefined,redirect:'manual',signal:AbortSignal.timeout(30000)});const out=new Headers(r.headers);out.set('Cache-Control','private,no-store');out.set('Vary','Cookie, Origin');out.set('X-Robots-Tag','noindex,nofollow');return new Response(r.body,{status:r.status,headers:out});}catch{return Response.json({error:'Xidmət cavab vermədi. Yenidən cəhd edin.'},{status:503,headers:{'Cache-Control':'private,no-store'}});}
}
