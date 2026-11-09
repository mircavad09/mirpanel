import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import pg from 'pg';import {toNodeHandler,fromNodeHeaders} from 'better-auth/node';import {Repository,displayName} from './repository.mjs';import {GroupControl} from './group-control.mjs';import {makeOwnerAuth,isOwner} from './owner-auth.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
import {saveProfile} from './profile-details.mjs';
import {uploadProfileMedia,saveProfileSticker} from './profile-media.mjs';
import {Repository as OwnerRepository} from './owner-repository.mjs';
import {makePublicAuth} from './public-auth.mjs';import {createAuthMailer} from './auth-mail.mjs';import {handlePublicCommunity} from './public-service.mjs';
import {requireAllowed} from './group-control.mjs';
import {adminDirectory} from './admin-directory.mjs';
import {adminDashboard} from './admin-dashboard.mjs';
import {CommunityLive} from './live.mjs';
import {counts} from './public-service.mjs';
import {walletHistory,creditWallet} from './wallet.mjs';
import {userStatistics} from './user-statistics.mjs';
import {userControls,saveUserControls} from './user-controls.mjs';
import {createWelcomeDelivery} from './welcome-delivery.mjs';
import {adminDelivery,adminDeliveryCompletions,adminOrderCustomers,adminPendingDeliveries,createCustomerOrderMailer,deliveryRecords,ownerCodes} from './order-delivery.mjs';
import {createOrderMailTransport} from './order-mail-transport.mjs';
import {readOrderMailWebhook} from './order-mail-webhook.mjs';
import {approveCardWithReadyStock,readyStockView,saveReadyStock} from './ready-stock.mjs';
import {saveProductMessage} from './ready-stock-product-messages.mjs';
export function createOwnerCommunity(env=process.env,options={}){
 const publicEnabled=env.COMMUNITY_PUBLIC_ENABLED==='true';
 const enabled=env.COMMUNITY_OWNER_ENABLED==='true',origin=env.COMMUNITY_ORIGIN||'https://mirpanel.com';let runtime;
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie, Origin','X-Robots-Tag':'noindex,nofollow'});res.end(JSON.stringify(value));};
 const html=(res,text)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff'});res.end(text.replace(/(src=")\/community-assets\/(owner-entry|community|shop-ui)\.js(?:\?[^" ]*)?"/g,(_,prefix,name)=>prefix+'/community-assets/'+name+'.js?v='+(name==='shop-ui'?'wallet-only-1':name==='community'?'topup-mail-1':publicEnabled?'account-trim-20261106':'account-history-20261031')+'"').replace(/(href=")\/community-assets\/shop\.css(?:\?[^" ]*)?"/g,'$1/community-assets/shop.css?v=wallet-only-1"').replace(/(src=")\/site-header\.js(?:\?[^" ]*)?"/g,'$1/site-header.js?v=product-transition-1"'));};
 const entry=(signup=false,login=false)=>`<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MirPanel · Qrup</title><link rel="stylesheet" href="/community-assets/community.css"><body class="community-page"><main class="community-shell"><section class="community-panel"><h1>${signup?'Qeydiyyat tezliklə açılacaq':login?'Sahib girişi':'Qrup tezliklə istifadəyə veriləcək'}</h1><p>İctimai qeydiyyat və qrupa giriş hazırda bağlıdır.</p>${login?`<button id="ownerGoogle" ${enabled?'':'disabled'}>Google ilə davam edin</button><p id="entryError" role="alert">${enabled?'Giriş yalnız icazəli sahib hesabına açıqdır.':'Sahib girişi hazırlanır.'}</p><script type="module" src="/community-assets/owner-entry.js"></script>`:'<a href="/owner-login">Giriş</a>'}<p><a href="/">Ana səhifəyə qayıt</a></p></section></main></body></html>`;
 async function init(){if(runtime)return runtime;if(!enabled)throw Object.assign(Error('Qrup tezliklə açılacaq.'),{status:503});for(const key of ['COMMUNITY_DATABASE_URL','COMMUNITY_AUTH_SECRET','COMMUNITY_GOOGLE_CLIENT_ID','COMMUNITY_GOOGLE_CLIENT_SECRET'])if(!env[key])throw Object.assign(Error('Sahib girişi hazırlanır.'),{status:503});if(env.COMMUNITY_AUTH_SECRET.length<32)throw Error('OWNER_AUTH_SECRET_TOO_SHORT');if(!['https://mirpanel.com','http://127.0.0.1:55464'].includes(origin))throw Error('INVALID_OWNER_ORIGIN');const pool=new pg.Pool({connectionString:env.COMMUNITY_DATABASE_URL,max:5,options:'-c search_path=mirpanel_community,public',ssl:env.COMMUNITY_TEST==='true'?false:{rejectUnauthorized:true,ca:env.COMMUNITY_DATABASE_CA},connectionTimeoutMillis:15000});const repo=publicEnabled?new Repository(pool):new OwnerRepository(pool),group=new GroupControl(repo),authConfig={origin,secret:env.COMMUNITY_AUTH_SECRET,clientId:env.COMMUNITY_GOOGLE_CLIENT_ID,clientSecret:env.COMMUNITY_GOOGLE_CLIENT_SECRET};
  const send=publicEnabled&&(options.sendAuthEmail||createAuthMailer(env)),welcome=publicEnabled&&createWelcomeDelivery(pool,send);
  const orderMailer=publicEnabled&&createCustomerOrderMailer(pool,options.sendAuthEmail||createOrderMailTransport(env,send),origin,{loadCatalog:options.loadCatalog,requireDeliveryNotice:env.ORDER_MAIL_PROVIDER==='resend'});
  const auth=publicEnabled?makePublicAuth(pool,authConfig,send,welcome):makeOwnerAuth(pool,authConfig);runtime={pool,repo,group,auth,welcome,orderMailer};return runtime;}
 async function body(req){let n=0,parts=[];for await(const b of req){n+=b.length;if(n>16384)throw Object.assign(Error('Sorğu çox böyükdür.'),{status:413});parts.push(b);}try{return JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{throw Object.assign(Error('Sorğu düzgün deyil.'),{status:400});}}
 return {async integrationPool(){return (await init()).pool;},async approveCardWithReadyStock(security,id,duration,actor,employeeEnabled){const r=await init();const result=await approveCardWithReadyStock(r.pool,security,id,duration,actor,employeeEnabled);void r.orderMailer?.wake();return result;},async readyStock(catalog,inventory,security){return readyStockView((await init()).pool,catalog,inventory,security);},async saveProductMessage(security,catalog,input){return saveProductMessage((await init()).pool,security,catalog,input);},async saveReadyStock(security,secret,catalog,actor,input){return saveReadyStock((await init()).pool,security,secret,catalog,actor,input);},async pendingDeliveries(ids,opts){return adminPendingDeliveries((await init()).pool,ids,opts);},async deliveryCompletions(filter){return adminDeliveryCompletions((await init()).pool,filter);},async orderCustomers(ids){return adminOrderCustomers((await init()).pool,ids);},async startWelcomeDelivery(){if(enabled&&publicEnabled){const r=await init();r.welcome.start();if((await r.pool.query("select to_regclass('mirpanel_community.customer_order_mail') as available")).rows[0]?.available)r.orderMailer.start();}},async adminDelivery(security,actor,id,input){const r=await init();const result=await adminDelivery(r.pool,security,actor,id,input,{productMessage:true});if(input)void r.orderMailer?.wake();return result;},async verifiedOwnerId(){const r=await init(),owner=(await r.pool.query('select u.* from owner_identity o join "user" u on u.id=o.user_id where o.id=true')).rows[0];return await isOwner(r.pool,owner)?owner.id:null;},async adminHandle(req,res,{json,body}){
  const r=await init(),u=new URL(req.url,origin),part=u.pathname.slice('/api/admin/community'.length);
  // Resolve the previously bound Google subject and verified owner, never request identity.
  const owner=(await r.pool.query('select u.* from owner_identity o join "user" u on u.id=o.user_id where o.id=true')).rows[0];
  if(!await isOwner(r.pool,owner))throw Object.assign(Error('Təsdiqlənmiş sahib hesabı tapılmadı.'),{status:403});
  if(req.method==='GET'){
   if(part==='/dashboard')return json(res,200,await adminDashboard(r.pool));
   if(part==='/user-controls')return json(res,200,await userControls(r.pool,r.repo,u.searchParams.get('userId'),await options.loadCatalog()));
   if(part==='/user-statistics')return json(res,200,await userStatistics(r.pool,u.searchParams.get('userId'),Object.fromEntries(u.searchParams)));
   if(part==='/shop'){const only=u.searchParams.get('only');return json(res,200,await options.shopAdmin(r.pool,owner,{action:only==='topup-count'?'topup-count':only==='topups'?'topups':'list'}));}
   if(part==='/wallet')return json(res,200,await walletHistory(r.pool,u.searchParams.get('userId'),Object.fromEntries(u.searchParams)));
   if(part==='/users'||part.startsWith('/users/'))return json(res,200,await adminDirectory(r.pool,r.repo,{...Object.fromEntries(u.searchParams),id:part.startsWith('/users/')?decodeURIComponent(part.slice(7)):null}));
   if(part==='/state')return json(res,200,{profile:await r.repo.profile(owner),settings:await r.group.settings()});
   if(part==='/messages')return json(res,200,await r.repo.messages(Object.fromEntries(u.searchParams)));
   if(part==='/manage')return json(res,200,await r.group.review(owner,Object.fromEntries(u.searchParams)));
   if(part==='/events'){r.live??=new CommunityLive(r.pool,r.repo,counts);return r.live.attach(req,res,null,u);}
  }
  if(req.method==='POST'){
   const b=await body(req);
   if(part==='/shop')return json(res,200,await options.shopAdmin(r.pool,owner,b));
   if(part==='/user-controls')return json(res,200,await saveUserControls(r.pool,owner,b,await options.loadCatalog()));
   if(part==='/reset-user-password'){const user=(await r.pool.query('select id,email,"emailVerified" from "user" where id=$1',[b.userId])).rows[0];if(!user?.emailVerified)throw Object.assign(Error('Təsdiqlənmiş e-poçt tələb olunur.'),{status:400});const password=(await r.pool.query('select 1 from account where "userId"=$1 and "providerId"=\'credential\'',[user.id])).rowCount;if(!password)return json(res,200,{sent:false,message:'Bu hesab Google ilə daxil olur. Şifrə Google hesabında idarə edilir.'});await r.auth.api.requestPasswordReset({body:{email:user.email,redirectTo:origin+'/hesab?mode=new-password'}});return json(res,200,{sent:true});}
   if(part==='/wallet/credit')return json(res,200,await creditWallet(r.pool,owner,{...b,reason:b.reason??'Admin tərəfindən balans əlavə edildi'}));
   if(part==='/messages')return json(res,201,await r.repo.send(owner,b.body,b.clientId));
   if(part==='/moderate')return json(res,200,await r.group.act(owner,b));
  }
  return json(res,404,{error:'Endpoint tapılmadı.'});
 },async shopContext(req){const {pool}=await init();return{pool,user:await this.checkoutAccount(req,{verified:false})};
 },async accountReserve(req,a){const id=await this.checkoutAccount(req);if(!id)return null;const {pool}=await init();return(await pool.query('select reserve_user_price_v1($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) value',[id,a.methodId,a.productId,a.planId,a.planKey,a.signature,a.amount,a.idempotencyKey,a.checkoutKey,a.previousReservationId,a.minutes,a.requireStock])).rows[0].value;
 },async reservedPrice(req,id){const {pool}=await init();const p=(await pool.query('select user_id,effective_cents from user_reservation_prices where reservation_id=$1',[id])).rows[0];if(!p)return null;if(await this.checkoutAccount(req)!==p.user_id)throw Object.assign(Error('Rezerv hesabı uyğun deyil. Hesabınıza daxil olun.'),{status:403});return Number(p.effective_cents)/100;
 },async close(){await runtime?.live?.close();if(runtime?.orderMailer)await runtime.orderMailer.stop();await runtime?.pool.end();},async checkoutAccount(req,{verified=true}={}){
  if(!publicEnabled||!/(?:__Secure-)?mirpanel_owner\.session_token=/.test(req.headers.cookie||''))return null;
  const {pool,auth}=await init(),session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)});if(!session?.user)return null;await requireAllowed(pool,session.user.id);if(verified&&session.user.emailVerified!==true)throw Object.assign(Error('Sifarişinizi tamamlamaq üçün e-poçtunuzu təsdiqləyin'),{status:403,code:'CHECKOUT_EMAIL_UNVERIFIED'});return session.user.id;
 },async orderHistory(req){
  if(!enabled)throw Object.assign(Error('Hesabınıza daxil olun.'),{status:401});
  const {pool,auth}=await init(),session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)}),user=session?.user;
  if(!user)throw Object.assign(Error('Hesabınıza daxil olun.'),{status:401});
  if(publicEnabled){await requireAllowed(pool,user.id);}else if(!await isOwner(pool,user))throw Object.assign(Error('Bu hesaba giriş bağlıdır.'),{status:403});
  const fields="to_jsonb(o)->>'product_id' as product_id,to_jsonb(o)->>'plan_id' as plan_id,(to_jsonb(o)->>'duration_months')::integer as duration_months,to_jsonb(o)->>'service_expires_on' as service_expires_on,o.id,o.checkout_snapshot,o.order_code,o.product_title,o.plan_name,o.amount,o.currency,o.created_at,o.status,(to_jsonb(o)->>'payment_confirmed')::boolean as payment_confirmed,(to_jsonb(o)->>'quantity')::integer as quantity,o.receipt_path,o.receipt_mime,o.receipt_deleted_at";
  const base=`select ${fields} from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=$1`;
  return {userId:user.id,catalog:options.loadCatalog,topups:async()=>{try{return (await pool.query("select id,requested_cents::text,approved_cents::text,status,created_at from mirpanel_community.wallet_topups where user_id=$1 and status<>'draft' order by created_at desc,id desc limit 30",[user.id])).rows;}catch(e){if(e.code==='42P01')return [];throw e;}},page:async(before,id)=>(await pool.query(base+' and ($2::timestamptz is null or (o.created_at,o.id)<($2::timestamptz,$3::uuid)) order by o.created_at desc,o.id desc limit 21',[user.id,before,id])).rows,owned:async id=>(await pool.query(base+' and o.id=$2::uuid',[user.id,id])).rows[0]||null,byCode:async code=>(await pool.query(base+' and o.order_code::text=$2',[user.id,code])).rows[0]||null,...(publicEnabled?{deliveries:ids=>deliveryRecords(pool,ids),codes:id=>ownerCodes(pool,user.id,id)}:{})};
 },async handle(req,res){const u=new URL(req.url,origin),route=u.pathname;if(!['/qrup','/hesab','/profil','/owner-login','/sebet','/balans','/odenis'].includes(route)&&!route.startsWith('/api/community/')&&!route.startsWith('/api/auth/')&&!route.startsWith('/community-assets/'))return false;
 try{
 if(route.startsWith('/community-assets/')){const n=route.slice(18);if(!/^[a-z.-]+$/.test(n))return json(res,404,{error:'Tapılmadı.'}),true;const f=path.join(dir,'public',n);if(!fs.existsSync(f))return json(res,404,{error:'Tapılmadı.'}),true;res.writeHead(200,{'Content-Type':n.endsWith('.css')?'text/css':n.endsWith('.js')?'text/javascript':n.endsWith('.png')?'image/png':n.endsWith('.svg')?'image/svg+xml':n.endsWith('.webp')?'image/webp':'application/octet-stream','Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(f));return true;}
 if(!publicEnabled){if(route==='/hesab'){html(res,entry(true));return true;}if(route==='/owner-login'){html(res,entry(false,true));return true;}}
 if(!enabled){if(route==='/qrup'||route==='/profil')html(res,entry());else json(res,503,{error:'Qrup tezliklə açılacaq.'});return true;}
 if(route==='/api/community/order-mail-webhook'){
  if(!publicEnabled||env.ORDER_MAIL_PROVIDER!=='resend')return json(res,404,{ok:false}),true;
  if(req.method!=='POST')return json(res,405,{ok:false}),true;
  let event;
  try{event=await readOrderMailWebhook(req,env.ORDER_MAIL_RESEND_WEBHOOK_SECRET);}
  catch(error){return json(res,error.status||400,{ok:false}),true;}
  try{const handled=!event||await (await init()).orderMailer.notice(event);return json(res,handled?200:503,{ok:handled}),true;}
  catch{console.warn('ORDER_MAIL_WEBHOOK_STORAGE_ERROR');return json(res,503,{ok:false}),true;}
 }
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==origin){json(res,403,{error:'Mənşə yoxlaması keçmədi.'});return true;}
 const {pool,repo,group,auth}=await init();
 if(publicEnabled)return await handlePublicCommunity({req,res,u,origin,runtime,json,html,body,catalog:options.loadCatalog});
 if(route.startsWith('/api/auth/')){const allow=['/api/auth/sign-in/social','/api/auth/callback/google','/api/auth/get-session','/api/auth/sign-out'];if(!allow.includes(route)){json(res,403,{error:'Qeydiyyat tezliklə açılacaq.'});return true;}if(route==='/api/auth/sign-in/social'){const b=await body(req);if(b.provider!=='google'){json(res,403,{error:'Giriş bağlıdır.'});return true;}const orders=b.callbackURL===origin+'/sifarislerim';req.body={provider:'google',callbackURL:origin+(orders?'/sifarislerim':'/profil'),errorCallbackURL:origin+'/owner-login'+(orders?'?next=%2Fsifarislerim':'')};const {Readable}=await import('node:stream');const replacement=Readable.from([Buffer.from(JSON.stringify(req.body))]);replacement.socket=req.socket;replacement.httpVersionMajor=req.httpVersionMajor;replacement.method=req.method;replacement.url=req.url;replacement.headers={...req.headers,'content-length':String(Buffer.byteLength(JSON.stringify(req.body)))};await toNodeHandler(auth)(replacement,res);}else await toNodeHandler(auth)(req,res);return true;}
 const session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)}),user=session?.user;if(!await isOwner(pool,user)){if(route==='/qrup'||route==='/profil')html(res,entry());else json(res,user?403:401,{error:'Giriş yalnız sahib hesabına açıqdır.'});return true;}
 if(route==='/qrup'||route==='/profil'){html(res,`<!doctype html><html lang="az" class="${route==='/qrup'?'community-chat-screen':''}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>MirPanel</title><link rel="stylesheet" href="/community-assets/community.css"><link rel="stylesheet" href="/community-assets/chat-layout.css"><link rel="stylesheet" href="/site-header.css?v=page-navigation-20261031"><body class="community-page">${fs.readFileSync(path.resolve(dir,'../../customer-header.html'),'utf8')}<main id="communityApp" class="community-shell"></main><script type="module" src="/community-assets/community.js?v=page-navigation-20261031"></script><script src="/site-header.js?v=page-navigation-20261031" defer></script></body></html>`);return true;}
 if(route==='/api/community/profile-avatar'&&req.method==='POST'){const value=await body(req);await repo.ensure(user);await saveProfileSticker(pool,user,value);json(res,200,await repo.profile(user));return true;}
 if(route==='/api/community/profile-media'&&req.method==='POST'){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>5242880)throw Object.assign(Error('Şəkil maksimum 5 MB ola bilər.'),{status:413});chunks.push(chunk);}await repo.ensure(user);await uploadProfileMedia(pool,user,u.searchParams.get('kind'),Buffer.concat(chunks));json(res,200,await repo.profile(user));return true;}
 if(route.startsWith('/api/community/media/')&&req.method==='GET'){const id=route.slice('/api/community/media/'.length);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/.test(id)){json(res,404,{error:'Şəkil tapılmadı.'});return true;}const media=(await pool.query('select bytes from profile_media where id=$1 and user_id=$2',[id.slice(0,-5),user.id])).rows[0];if(!media){json(res,404,{error:'Şəkil tapılmadı.'});return true;}res.writeHead(200,{'Content-Type':'image/webp','Content-Length':media.bytes.length,'Cache-Control':'private,no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow'});res.end(media.bytes);return true;}
 const b=req.method==='POST'?await body(req):null;
 if(route==='/api/community/state'&&req.method==='GET')json(res,200,{profile:await repo.profile(user),unread:0,tiers:(await repo.config()).tiers,googleEnabled:true});
 else if(route==='/api/community/messages'&&req.method==='GET')json(res,200,{...await repo.messages({before:u.searchParams.get('before'),after:u.searchParams.get('after')}),settings:await group.settings()});
 else if(route==='/api/community/messages'&&b)json(res,201,await repo.send(user,b.body,b.clientId));
 else if(route==='/api/community/read'&&b)json(res,200,{ok:true});
 else if(route==='/api/community/moderate'&&b)json(res,200,await group.act(user,b));
 else if(['/api/community/manage','/api/community/audit'].includes(route)&&req.method==='GET')json(res,200,await group.review(user,{kind:u.searchParams.get('kind')||'audit',page:u.searchParams.get('page')||1}));
 else if(route==='/api/community/profile'&&b){await repo.ensure(user);await saveProfile(pool,user,b);json(res,200,await repo.profile(user));}
 else if(route==='/api/community/profile-summary'&&req.method==='GET'){const latest=(await pool.query('select o.order_code,o.product_title,o.plan_name,o.amount,o.currency,o.status,o.created_at from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=$1 order by o.created_at desc limit 1',[user.id])).rows[0]||null;const count=(await pool.query("select count(*)::int n from community_order_owners l join public.payment_orders o on o.id=l.order_id where l.user_id=$1 and o.status in ('approved','completed')",[user.id])).rows[0].n;json(res,200,{latestOrder:latest,subscription:null,orderCount:count,savingsCents:null});}
 else json(res,404,{error:'Tapılmadı.'});return true;
 }catch(e){console.error('OWNER_COMMUNITY_REQUEST_FAILED',e.code||e.status||e.name);if(!res.headersSent)json(res,e.status||503,{error:e.status?e.message:'Xidmət cavab vermədi. Yenidən cəhd edin.'});else res.end();return true;}}
 };
}
