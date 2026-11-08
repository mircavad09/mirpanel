import {createHmac,randomInt,timingSafeEqual} from 'node:crypto';
import {APIError,createAuthEndpoint,getSessionFromCtx} from 'better-auth/api';
import {setSessionCookie} from 'better-auth/cookies';
import {z} from 'zod';
import {requireAllowed} from './group-control.mjs';
import {OWNER_EMAIL} from './owner-auth.mjs';

const validity=10*60_000,cooldown=60_000;
const email=z.string().trim().toLowerCase().email().max(254);
const problem=(status,message)=>new APIError(status,{message});
export function emailConfirmation(pool,config,send,welcome){
 const key=id=>'mirpanel-email-code:'+id;
 const digest=(id,address,otp)=>createHmac('sha256',config.secret).update(JSON.stringify(['email-confirmation',id,address,otp])).digest('hex');
 const set=(client,id,record)=>client.query(`insert into verification(id,identifier,value,"expiresAt") values($1,$1,$2,now()+interval '1 hour') on conflict(id) do update set value=excluded.value,"expiresAt"=excluded."expiresAt","updatedAt"=now()`,[key(id),JSON.stringify(record)]);
 const read=(client,id)=>client.query('select value from verification where id=$1 and "expiresAt">now()',[key(id)]).then(r=>r.rows[0]?JSON.parse(r.rows[0].value):null);
 const show=(u,r)=>({email:r?.email||u.email,codeSent:!!r?.delivered&&r.expires>Date.now(),retryAfter:Math.max(0,Math.ceil(((r?.sent||0)+cooldown-Date.now())/1000))});
 async function locked(ctx,work){
  const session=await getSessionFromCtx(ctx,{disableCookieCache:true,disableRefresh:true});
  const id=session?.user?.id;
  if(!id)throw problem('UNAUTHORIZED','Hesabınıza daxil olun və e-poçtunuzu təsdiqləyin.');
  await requireAllowed(pool,id).catch(()=>{throw problem('FORBIDDEN','Hesabınıza giriş bağlıdır.');});
  const client=await pool.connect();
  try{
   await client.query('begin');
   const u=(await client.query('select * from "user" where id=$1 for update',[id])).rows[0];
   if(!u)throw problem('UNAUTHORIZED','Yenidən daxil olun.');
   const r=await read(client,id)||{email:u.email};
   const result=await work(client,u,r);
   await client.query('commit');return result;
  }catch(e){await client.query('rollback');if(e.code==='23505')throw problem('CONFLICT','Bu ünvanla başqa hesab mövcuddur.');throw e;}finally{client.release();}
 }
 const endpoint=(path,body,run)=>createAuthEndpoint('/confirm-email/'+path,{method:'POST',body},run);
 const pending=(u)=>{if(u.emailVerified)throw problem('CONFLICT','E-poçt artıq təsdiqlənib. Hesabınıza daxil olun.');};
 return {id:'mirpanel-email-confirmation',endpoints:{
  beginMirpanelEmail: endpoint('start',z.object({email,password:z.string().min(1).max(128),createdUserId:z.string().min(1).max(128).optional()}),async ctx=>{
   const user=await ctx.context.internalAdapter.findUserByEmail(ctx.body.email,{includeAccounts:true});
   const password=user?.accounts?.find(a=>a.providerId==='credential')?.password;
   if(!password)await ctx.context.password.hash(ctx.body.password);
   if(!password||!await ctx.context.password.verify({hash:password,password:ctx.body.password}))throw problem('UNAUTHORIZED','E-poçt və ya şifrə düzgün deyil.');
   if(ctx.body.createdUserId&&ctx.body.createdUserId!==user.user.id)throw problem('CONFLICT','Qeydiyyat tamamlanmadı. Hesabınız varsa, daxil olun.');
   await requireAllowed(pool,user.user.id).catch(()=>{throw problem('FORBIDDEN','Hesabınıza giriş bağlıdır.');});
   pending(user.user);
   const current=await getSessionFromCtx(ctx,{disableCookieCache:true,disableRefresh:true});
   if(current&&current.user.id!==user.user.id)throw problem('CONFLICT','Başqa hesab açıqdır. Əvvəlcə həmin hesabdan çıxın.');
   if(!current){
    const session=await ctx.context.internalAdapter.createSession(user.user.id);
    if(!session)throw problem('INTERNAL_SERVER_ERROR','Sessiya açıla bilmədi. Yenidən cəhd edin.');
    await setSessionCookie(ctx,{user:user.user,session},false);
   }
   return ctx.json(show(user.user,await read(pool,user.user.id)));
  }),
  statusMirpanelEmail: endpoint('status',z.object({}),async ctx=>{
   try{return ctx.json(await locked(ctx,(_c,u,r)=>u.emailVerified?{verified:true}:show(u,r)));}
   catch(e){if(e.status==='UNAUTHORIZED'||e.status==='FORBIDDEN')return ctx.json({});throw e;}
  }),
  changeMirpanelEmail: endpoint('change',z.object({email}),async ctx=>ctx.json(await locked(ctx,async(c,u,r)=>{
   pending(u);const address=ctx.body.email;if(address===r.email)return show(u,r);
   if(address===OWNER_EMAIL||(await c.query('select 1 from "user" where email=$1 and id<>$2',[address,u.id])).rowCount)throw problem('CONFLICT','Bu e-poçt ünvanı istifadə edilə bilməz.');
   const next={email:address,sent:r.sent};await set(c,u.id,next);return show(u,next);
  }))),
  sendMirpanelEmail: endpoint('send',z.object({}),async ctx=>{
   const otp=String(randomInt(1_000_000)).padStart(6,'0');
   const request=await locked(ctx,async(c,u,r)=>{
    pending(u);if(show(u,r).retryAfter)throw problem('TOO_MANY_REQUESTS','Təkrar kod göndərmək üçün geri sayımın bitməsini gözləyin.');
    if(r.email===OWNER_EMAIL||(await c.query('select 1 from "user" where email=$1 and id<>$2',[r.email,u.id])).rowCount)throw problem('CONFLICT','Bu e-poçt ünvanı istifadə edilə bilməz.');
    const sent=Date.now(),hash=digest(u.id,r.email,otp);await set(c,u.id,{email:r.email,sent,hash,expires:sent+validity,attempts:0});return {address:r.email,sent,hash};
   });
   try{await send('code',{user:{email:request.address},code:otp});}catch{throw problem('BAD_GATEWAY','Kodun göndərilməsi təsdiqlənmədi. Bir dəqiqə sonra yenidən cəhd edin.');}
   const result=await locked(ctx,async(c,u,r)=>{
    pending(u);if(r.hash!==request.hash||r.sent!==request.sent)throw problem('CONFLICT','E-poçt dəyişib. Yeni kod istəyin.');
    const now=Date.now();r.delivered=true;r.sent=now;r.expires=now+validity;await set(c,u.id,r);return show(u,r);
   });return ctx.json(result);
  }),
  finishMirpanelEmail: endpoint('verify',z.object({code:z.string().regex(/^\d{6}$/)}),async ctx=>{
   const result=await locked(ctx,async(c,u,r)=>{
    const expected=digest(u.id,r.email,ctx.body.code),match=r.hash&&timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(r.hash,'hex'));
    if(u.emailVerified)throw problem('UNAUTHORIZED','E-poçt artıq təsdiqlənib.');
    if(!r.delivered||r.expires<=Date.now()||r.attempts>=5)return {error:'Kodun vaxtı bitib və ya cəhd limiti dolub. Yeni kod istəyin.'};
    if(!match){r.attempts++;await set(c,u.id,r);return{error:'Kod düzgün deyil.'};}
    const updated=(await c.query('update "user" set email=$2,"emailVerified"=true,"updatedAt"=now() where id=$1 returning *',[u.id,r.email])).rows[0];
    await c.query('delete from verification where id=$1',[key(u.id)]);
    return {user:updated};
   });
   if(result.error)throw problem('BAD_REQUEST',result.error);
   await welcome(result.user);
   return ctx.json({verified:true});
  })
 }};
}
