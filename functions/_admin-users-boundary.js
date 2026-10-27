// Static files must not bypass the session checks on the Render admin host.
export function adminUsersBoundary(request){
 let p=new URL(request.url).pathname;
 try{for(let i=0;i<4;i++){const decoded=decodeURIComponent(p);if(decoded===p)break;p=decoded;}p=new URL(p.replace(/\/+/g,'/'),'https://local.invalid').pathname.toLowerCase();}catch{return null;}
 if(p==='/admin/users'||p==='/admin/users/'){
  if(['GET','HEAD'].includes(request.method))return Response.redirect('https://mirpanel.onrender.com/admin/users',302);
  return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD','Cache-Control':'no-store'}});
 }
 if(/^\/api\/admin\/users(?:\/|$)/.test(p)||/^\/(?:admin-users(?:\.(?:html|js|css))?|mirpanel-admin\/(?:public\/admin-users(?:\.(?:html|js|css))?|admin-users-repository\.mjs))\/?$/.test(p))return new Response('Not found',{status:404,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
 return null;
}
