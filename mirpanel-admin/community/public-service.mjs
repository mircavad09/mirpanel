import {withStorefrontHead} from '../../storefront-head.mjs';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {Readable} from 'node:stream';
import {toNodeHandler,fromNodeHeaders} from 'better-auth/node';import {authFormPolicy} from './auth-form-policy.mjs';
import {requireAllowed} from './group-control.mjs';import {saveProfile,uploadProfile,saveProfileSticker} from './public-profile.mjs';
import {tagCount,notifications,markTag,tagMessage} from './bot-tags.mjs';
import {accountPanel,paymentHistory} from './account-panel.mjs';
import {CommunityLive} from './live.mjs';
import {profileCSS,profileShell,profileReturn} from './public/profile-shell.js';
const dir=path.dirname(fileURLToPath(import.meta.url));const fail=(s,m)=>Object.assign(Error(m),{status:s});
export const SITE_PRESENCE_ID = '00000000-0000-0000-0000-000000000001';
export function authReturn(origin,value){const path=typeof value==='string'&&value.startsWith(origin)?value.slice(origin.length):value;if(['/','/profil','/qrup','/mehsul','/sebet','/sifarislerim','/balans','/odenis','/balans?returnTo=%2Fodenis%3Fmode%3Dwallet'].includes(path)||/^\/mehsul\/[a-z0-9-]+$/i.test(path||'')||/^\/profil\?tab=(?:(?:orders|sifarislerim)(?:&order=[A-Za-z0-9-]{1,40})?|(?:payments|odenislerim)(?:&topup=[a-f0-9-]{36})?|profile|profilim|codes|kodlarim|subscriptions|abuneliklerim|expenses|xerclerim)$/.test(path||''))return origin+path;return origin+'/profil';}
export async function handlePublicCommunity({req,res,u,origin,runtime,json,html:sendHtml,body,catalog}){
 const html=(response,markup)=>sendHtml(response,withStorefrontHead(markup));
 const route=u.pathname,{pool,repo,group,auth}=runtime,started=performance.now();
 if(!(await pool.query('select ready from public_community_release where version=1')).rows[0]?.ready)throw fail(503,'Xidmət hazırlanır.');
 const gateMs=performance.now()-started;
 if(route.startsWith('/api/auth/')){
  const allowed=['/api/auth/sign-in/social','/api/auth/callback/google','/api/auth/get-session','/api/auth/sign-out','/api/auth/sign-up/email','/api/auth/sign-in/email','/api/auth/request-password-reset','/api/auth/reset-password'];
  const codeRoute=/^\/api\/auth\/confirm-email\/(start|status|change|send|verify)$/.test(route);
  if(!allowed.includes(route)&&!codeRoute&&!/^\/api\/auth\/reset-password\/[^/]+$/.test(route))throw fail(404,'Tapılmadı.');
  if(codeRoute){if(req.method!=='POST')throw fail(405,'Yalnız POST sorğusuna icazə verilir.');if(req.headers.origin&&req.headers.origin!==origin)throw fail(403,'Sorğu mənbəyinə icazə verilmir.');res.setHeader('Cache-Control','private, no-store');}
  if(req.method==='POST'){
   if(!String(req.headers['content-type']).includes('application/json'))throw fail(415,'JSON tələb olunur.');const b=await body(req);
   if(route==='/api/auth/sign-in/social'&&b.provider!=='google')throw fail(403,'Bu girişə icazə verilmir.');
   if(['sign-in/social','sign-up/email'].some(p=>route.endsWith(p))){b.callbackURL=authReturn(origin,b.callbackURL);b.errorCallbackURL=origin+'/hesab?next='+encodeURIComponent(b.callbackURL.slice(origin.length))+(b.callbackURL===origin+'/sebet'?'&from=cart':'');}
   if(route==='/api/auth/request-password-reset')b.redirectTo=origin+'/hesab?mode=new-password';
   const raw=Buffer.from(JSON.stringify(b)),replacement=Readable.from([raw]);replacement.socket=req.socket;replacement.httpVersionMajor=req.httpVersionMajor;replacement.method=req.method;replacement.url=req.url;replacement.headers={...req.headers,'content-length':String(raw.length)};await toNodeHandler(auth)(replacement,res);
  }else await toNodeHandler(auth)(req,res);
  if(['/api/auth/sign-up/email','/api/auth/callback/google','/api/auth/sign-out'].includes(route))void pool.query("select pg_notify('mirpanel_community_live','{}')").catch(()=>{});return true;
 }
 // Public shells contain no account data. Authenticate the data API, not the HTML shell.
 const publicShell=req.method==='GET'&&['/qrup','/hesab','/sebet','/balans','/odenis'].includes(route);
 const session=publicShell?null:await auth.api.getSession({headers:fromNodeHeaders(req.headers)}),user=session?.user||null;if(user)await requireAllowed(pool,user.id);
 const authMs=performance.now()-started-gateMs;
 res.setHeader('Server-Timing',`release;dur=${gateMs.toFixed(1)}, auth;dur=${authMs.toFixed(1)}`);
 const need=()=>{if(!user)throw fail(401,'Əvvəlcə daxil olun.');return user;};
 if(req.method==='GET'&&['/sebet','/balans','/odenis'].includes(route)){
  const balance=route==='/balans';
  const loading=balance?`<h1>Balansım</h1>
   <div class="shop-wallet-loading" role="status">Balans məlumatı yüklənir…</div>`:'';
  html(res,`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>MirPanel · Səbət və balans</title><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="/community-assets/shop.css?v=checkout-first-paint-2">${balance?'<link rel="stylesheet" href="/customer-footer.css?v=chat-space-20261108" data-shell-persistent data-customer-footer-style>':''}<body class="community-page${balance?' wallet-page-active':''}">${fs.readFileSync(path.resolve(dir,'../../customer-header.html'),'utf8')}<main id="shopApp" class="shop-page${balance?' shop-wallet-page':''}">${loading}</main><script type="module" src="/community-assets/shop-ui.js?v=customer-perf-2"></script><script defer src="/page-navigation.js?v=az-addresses-1" data-page-navigation-loader></script><script src="/site-header.js?v=storefront-identity-1" defer></script></body></html>`);
  return true;
 }
 if(route==='/api/community/events'&&req.method==='GET'){runtime.live??=new CommunityLive(pool,repo,counts);await runtime.live.attach(req,res,session,u);return true;}
 if(route==='/owner-login'){res.writeHead(302,{Location:'/hesab?next='+encodeURIComponent(u.searchParams.get('next')==='/sifarislerim'?'/sifarislerim':'/profil'),'Cache-Control':'private,no-store'});res.end();return true;}
 if(['/qrup','/profil','/hesab'].includes(route)){
  if(route==='/profil'&&!user){res.writeHead(302,{Location:'/hesab?next='+encodeURIComponent(profileReturn(u.search)),'Cache-Control':'private,no-store'});res.end();return true;}
  if(route==='/profil'){
   html(res,`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Profil · MirPanel</title><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/site-header.css"><link rel="stylesheet" href="${profileCSS}" data-shell-persistent><link rel="stylesheet" href="/browser-orders.css?v=code-artwork-1" data-shell-persistent><link rel="modulepreload" href="/community-assets/account-panel.js?v=topups-only-1"><link rel="modulepreload" href="/session-state.js?v=auth-recovery-20261107"><body class="community-page profile-screen">${fs.readFileSync(path.resolve(dir,'../../customer-header.html'),'utf8')}<main id="communityApp" class="community-shell" data-profile-entry>${profileShell(u.search)}</main><script type="module" src="/community-assets/profile-entry.js?v=topups-only-1"></script><script src="/site-header.js?v=storefront-identity-1" defer></script></body></html>`);
   return true;
  }
  html(res,`<!doctype html><html lang="az" class="${route==='/qrup'?'community-chat-screen':''}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>MirPanel</title><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/community-assets/chat-layout.css?v=chat-compose-1"><link rel="stylesheet" href="/community-assets/auth-forms.css?v=email-confirmation-sheet-1"><link rel="stylesheet" href="/community-assets/tag-notifications.css?v=public-community-v1"><link rel="stylesheet" href="/site-header.css?v=public-community-v1"><body class="community-page">${fs.readFileSync(path.resolve(dir,'../../customer-header.html'),'utf8')}<main id="communityApp" class="community-shell"></main><script type="module" src="/community-assets/community.js?v=public-community-v1"></script><script src="/site-header.js?v=storefront-identity-1" defer></script></body></html>`);return true;
 }
 if(route.startsWith('/api/community/media/')&&req.method==='GET'){
  const file=route.slice('/api/community/media/'.length);if(!/^[a-f0-9-]{36}\.webp$/.test(file))throw fail(404,'Şəkil tapılmadı.');
  const row=(await pool.query('select m.bytes from profile_media m join community_profiles p on p.user_id=m.user_id where m.id=$1::uuid and ((m.kind=\'avatar\' and p.avatar_path=$2 and p.blocked=false) or (m.kind=\'cover\' and p.cover_path=$2 and m.user_id=$3))',[file.slice(0,-5),file,user?.id||null])).rows[0];if(!row)throw fail(404,'Şəkil tapılmadı.');res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff','Vary':'Cookie'});res.end(row.bytes);return true;
 }
 if(route==='/api/community/profile-avatar'&&req.method==='POST'){need();const value=await body(req);await repo.ensure(user);await saveProfileSticker(pool,user,value);json(res,200,await repo.profile(user));return true;}
 if(route==='/api/community/profile-media'&&req.method==='POST'){need();let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>5242880)throw fail(413,'Şəkil maksimum 5 MB ola bilər.');chunks.push(c);}await repo.ensure(user);await uploadProfile(pool,user,u.searchParams.get('kind'),Buffer.concat(chunks));json(res,200,await repo.profile(user));return true;}
 const b=req.method==='POST'?await body(req):null;
 if(route==='/api/community/state'&&req.method==='GET'){
  const mode=u.searchParams.get('group'),groupRead=mode==='1'||mode==='messages';
  const lean=mode==='messages';
  const [profile,unreadTags,config,initial,count]=await Promise.all([
   user?repo.profile(user):null,user?tagCount(pool,user.id):0,lean?null:repo.config(),
   groupRead?Promise.all([repo.messages(lean?{includeTiers:true}:undefined),group.settings()]):null,
   mode==='1'?counts(pool):null
  ]);
  res.setHeader('Server-Timing',`release;dur=${gateMs.toFixed(1)}, auth;dur=${authMs.toFixed(1)}, state;dur=${(performance.now()-started-gateMs-authMs).toFixed(1)}`);
  const {tiers,...messages}=initial?.[0]||{};
  json(res,200,{publicCommunity:true,profile,unreadTags,unread:0,tiers:lean?tiers:config.tiers,googleEnabled:true,authFormPolicy,...(initial?{initialMessages:{...messages,settings:initial[1],restrictions:profile}}:{}),...(count?{counts:count}:{})});
 }
 else if(route==='/api/community/messages'&&req.method==='GET'){const [messages,settings,profile]=await Promise.all([repo.messages({before:u.searchParams.get('before'),after:u.searchParams.get('after'),known:u.searchParams.get('known')}),group.settings(),user?repo.profile(user):null]);json(res,200,{...messages,settings,restrictions:profile});}
 else if(route==='/api/community/messages'&&b){need();if(Object.keys(b).some(k=>!['body','clientId'].includes(k)))throw fail(400,'Yalnız mətn göndərmək olar.');const result=await repo.send(user,b.body,b.clientId);json(res,result.blocked?422:201,result);}
 else if(route==='/api/community/read'&&b)json(res,200,{ok:true});
 else if(route==='/api/community/counts'&&req.method==='GET')json(res,200,await counts(pool));
 else if(route==='/api/community/presence'&&b?.site===true){
  need();
  if(req.headers.origin&&req.headers.origin!==origin)throw fail(403,'Sorğu mənbəyinə icazə verilmir.');
  await pool.query(`insert into community_presence(user_id,session_id,tab_id) values($1,$2,$3)
    on conflict(session_id,tab_id) do update set last_seen=clock_timestamp()
    where community_presence.last_seen<clock_timestamp()-interval '1 minute'`,[user.id,session.session.id,SITE_PRESENCE_ID]);
  json(res,200,{ok:true});
 }
 else if(route==='/api/community/presence'&&b){need();if(!/^[a-f0-9-]{36}$/i.test(b.tabId||''))throw fail(400,'Səhifə identifikatoru düzgün deyil.');if(b.leave===true)await pool.query('delete from community_presence where user_id=$1 and session_id=$2 and tab_id=$3',[user.id,session.session.id,b.tabId]);else await pool.query('insert into community_presence(user_id,session_id,tab_id) values($1,$2,$3) on conflict(session_id,tab_id) do update set last_seen=clock_timestamp()',[user.id,session.session.id,b.tabId]);json(res,200,await counts(pool));}
 else if(route==='/api/community/notifications'&&req.method==='GET')json(res,200,await notifications(pool,need().id));
 else if(route==='/api/community/notifications/read'&&b)json(res,200,await markTag(pool,need().id,b.messageId));
 else if(route==='/api/community/tag-message'&&req.method==='GET')json(res,200,await tagMessage(repo,need().id,u.searchParams.get('messageId')));
 else if(route==='/api/community/moderate'&&b)json(res,200,await group.act(need(),b));
 else if(['/api/community/manage','/api/community/audit'].includes(route)&&req.method==='GET')json(res,200,await group.review(need(),{kind:u.searchParams.get('kind')||'audit',page:u.searchParams.get('page')||1}));
 else if(route==='/api/community/reports'&&b)json(res,200,await group.report(need(),b));
 else if(route==='/api/community/profile'&&b){need();await repo.ensure(user);await saveProfile(pool,user,b);json(res,200,await repo.profile(user));}
 else if(route==='/api/community/payment-history'&&req.method==='GET'){need();json(res,200,await paymentHistory(pool,user.id,u.searchParams));}
 else if(route==='/api/community/account-panel'){need();if(!['GET','POST'].includes(req.method))throw fail(405,'İcazə verilmir.');json(res,200,await accountPanel(pool,user.id,catalog,b));}
 else if(route==='/api/community/profile-summary'&&req.method==='GET'){need();const latest=(await pool.query('select o.order_code,o.product_title,o.plan_name,o.amount,o.currency,o.status,o.created_at from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=$1 order by o.created_at desc,o.id desc limit 1',[user.id])).rows[0]||null,count=(await pool.query("select count(*)::int n from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=$1 and o.status in ('approved','completed')",[user.id])).rows[0].n;json(res,200,{latestOrder:latest,subscription:null,orderCount:count,savingsCents:null});}
 else throw fail(404,'Tapılmadı.');return true;
}
export async function counts(pool,{website=false}={}){return (await pool.query(`with members as (select id from "user" where id<>'mirpanel-system-bot-v1' and lower(split_part(email,'@',2)) !~ '(^|\\.)(test|invalid|localhost)$' and lower(split_part(email,'@',2)) not in ('example.com','example.net','example.org')) select (select count(*)::int from members) as members,(select count(distinct p.user_id)::int from community_presence p join members m on m.id=p.user_id join session s on s.id=p.session_id and s."userId"=p.user_id left join community_profiles u on u.user_id=p.user_id where ($1::boolean or p.tab_id<>$2::uuid) and p.last_seen>clock_timestamp()-case when $1 then interval '5 minutes' else interval '45 seconds' end and s."expiresAt">clock_timestamp() and (u.blocked is distinct from true or u.ban_until<=clock_timestamp())) as online`,[website,SITE_PRESENCE_ID])).rows[0];}
