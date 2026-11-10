import crypto from 'node:crypto';
const fail=(status,message)=>Object.assign(Error(message),{status});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const CUSTOMER_VIEW_TTL=10*60*1000;
export function createCustomerView({authorize,mutation,sessionBinding,open,read,json,now=Date.now}){
 const grants=new Map();
 return async function handle(req,res){
  const u=new URL(req.url,'http://admin.invalid'),p=u.pathname;
  const start=p==='/api/admin/community/customer-view';
  const match=/^\/(api\/admin\/customer-view|admin\/customer-view)\/([a-f0-9-]{36})$/.exec(p);
  if(!start&&!match)return false;
  try{
   const owner=await authorize(req);
   if(!owner)throw Object.assign(fail(403,'Yalnız sahib-admin üçün icazə verilir.'),match?{code:'CUSTOMER_VIEW_EXPIRED'}:{});
   const binding=sessionBinding(req);
   if(!binding)throw fail(401,'Admin sessiyası bitib.');
   for(const [id,g]of grants)if(g.expires<=now())grants.delete(id);
   if(start){
    if(req.method!=='POST')throw fail(405,'İcazə verilmir.');
    if(!mutation(req,res))return true;
    let body='',size=0;for await(const b of req){size+=b.length;if(size>2048)throw fail(413,'Sorğu çox böyükdür.');body+=b;}
    let value;try{value=JSON.parse(body);}catch{throw fail(400,'Sorğu düzgün deyil.');}
    if(typeof value.userId!=='string'||value.userId.length>200)throw fail(400,'Müştəri düzgün deyil.');
    const identity=await open(owner,value.userId),id=crypto.randomUUID(),expires=now()+CUSTOMER_VIEW_TTL;
    // A selector, not a bearer token: the original live admin session and owner
    // authority are required on EVERY request. A new customer revokes old views.
    for(const [key,g]of grants)if(g.binding===binding)grants.delete(key);
    if(grants.size>=500)throw fail(429,'Çox sayda baxış açılıb.');
    grants.set(id,{binding,owner,userId:value.userId,identity,expires});
    json(res,200,{url:'/admin/customer-view/'+id,expiresAt:new Date(expires).toISOString()});return true;
   }
   const g=grants.get(match[2]);
   if(!g||g.expires<=now()||g.binding!==binding||g.owner!==owner)throw Object.assign(fail(403,'Baxış icazəsi bitib. Admin panelindən yenidən açın.'),{code:'CUSTOMER_VIEW_EXPIRED'});
   if(req.method!=='GET')throw fail(403,'Bu rejim yalnız baxış üçündür.');
   if(match[1]==='api/admin/customer-view'){
    const target=u.searchParams.get('path');
    if(!target?.startsWith('/api/'))throw fail(403,'Bu keçid baxış üçün açıq deyil.');
    const result=await read(g.userId,target);
    if(result?.media){res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'});res.end(result.media);}
    else json(res,200,result);return true;
   }
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private,no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Robots-Tag':'noindex,nofollow','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-src https:; object-src 'none'; base-uri 'none'; form-action 'none'"});
   res.end(`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="customer-view-expires" content="${g.expires}"><title>Müştəri görünüşü · MirPanel</title><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/community-assets/account-panel.css?v=profile-menu-2"><link rel="stylesheet" href="/community-assets/profile.css?v=compact-profile-editor-1"><link rel="stylesheet" href="/browser-orders.css?v=prime-phone-1"><link rel="stylesheet" href="/community-assets/customer-view.css?v=read-navigation-2"><body class="community-page profile-screen customer-view"><header class="customer-view-banner"><strong>${esc(g.identity.name)} · #${esc(g.identity.memberNumber||'—')} istifadəçisinin gözündən baxırsınız</strong><span>Yalnız baxış · 10 dəqiqə</span><a href="/admin/customer-view/${match[2]}?page=products" data-view-products>Məhsullar</a><a href="/admin.html#communityUsers">Admin panelinə qayıt</a></header><main id="communityApp" class="community-shell"></main><script type="module" src="/community-assets/customer-view.js?v=prime-phone-1"></script></body></html>`);return true;
  }catch(e){json(res,e.status||503,{error:e.status?e.message:'Baxış açıla bilmədi. Yenidən cəhd edin.',...(e.code?{code:e.code}:{})});return true;}
 };
}
