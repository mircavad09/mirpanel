import {betterAuth} from 'better-auth';import {APIError,createAuthMiddleware} from 'better-auth/api';
import {authFormPolicy,registrationDetails} from './auth-form-policy.mjs';
import {safeName,BOT_ID} from './bot-policy.mjs';import {requireAllowed} from './group-control.mjs';
import {bindOwner,isOwner,OWNER_EMAIL,verifiedOwnerProfile} from './owner-auth.mjs';
import {emailConfirmation} from './email-confirmation.mjs';
import {createWelcomeDelivery} from './welcome-delivery.mjs';
import {setSessionCookie} from 'better-auth/cookies';
export function makePublicAuth(pool,c,send,delivery=createWelcomeDelivery(pool,send)){const fail=(message,code)=>new APIError('BAD_REQUEST',{message,...(code?{code}:{})});
 const welcome=delivery.enqueue;
 return betterAuth({appName:'MirPanel',database:pool,baseURL:c.origin,secret:c.secret,trustedOrigins:[c.origin],logger:{disabled:true},
  emailAndPassword:{enabled:true,requireEmailVerification:true,minPasswordLength:authFormPolicy.minPasswordLength,maxPasswordLength:authFormPolicy.maxPasswordLength,revokeSessionsOnPasswordReset:true,sendResetPassword:v=>send('reset',v)},
  plugins:[emailConfirmation(pool,c,send,welcome)],
  hooks:{after:createAuthMiddleware(async ctx=>{
   if(ctx.path!=='/sign-up/email')return;
   const result=ctx.context.returned,user=result?.user;
   if(!user?.id||!user.email)return;
   // With verification required, Better Auth can return a synthetic 200
   // user for a duplicate. Only acknowledge an actual linked credential.
   const existing=await ctx.context.internalAdapter.findUserByEmail(user.email,{includeAccounts:true});
   const providers=existing?.accounts||[];
   const credential=providers.some(a=>a.providerId==='credential');
   if(existing?.user.id===user.id&&credential){
    const session=await ctx.context.internalAdapter.createSession(user.id);
    if(!session)throw new APIError('INTERNAL_SERVER_ERROR',{code:'REGISTRATION_SESSION_FAILED',message:'Hesabınız yaradılıb. Daxil olaraq davam edin.'});
    await setSessionCookie(ctx,{session,user:existing.user},false);
    return ctx.json({...result,registrationCreated:true});
   }
   if(!existing)throw new APIError('CONFLICT',{code:'REGISTRATION_UNCONFIRMED',message:'Hesabın yaradılması təsdiqlənmədi. Yenidən cəhd edin.'});
   if(!credential&&providers.some(a=>a.providerId==='google'))throw new APIError('CONFLICT',{code:'REGISTRATION_GOOGLE_ONLY',message:'Bu e-poçt Google hesabına bağlıdır. Google ilə davam edin.'});
   throw new APIError('CONFLICT',{code:'REGISTRATION_EMAIL_EXISTS',message:'Bu e-poçt artıq qeydiyyatlıdır. Hesabınıza daxil olun və ya təsdiqə davam edin.'});
  })},
  emailVerification:{sendOnSignUp:false,sendOnSignIn:false},
  user:{validateUserInfo:({user,source})=>source.method==='oauth'&&(source.oauth?.providerId!=='google'||user.emailVerified!==true)?{error:'unverified_identity',errorDescription:'Təsdiqlənmiş Google hesabı tələb olunur.'}:undefined,additionalFields:{phoneNumber:{type:'string',required:false,input:false,fieldName:'phone_number'},phoneVerified:{type:'boolean',required:false,input:false,defaultValue:false,fieldName:'phone_verified'},registrationTermsAcceptedAt:{type:'date',required:false,input:false,fieldName:'registration_terms_accepted_at'}}},
  account:{encryptOAuthTokens:true,accountLinking:{enabled:true,requireLocalEmailVerified:true,allowDifferentEmails:false,trustedProviders:[]}},
  session:{expiresIn:30*86400,updateAge:86400,cookieCache:{enabled:false}},advanced:{cookiePrefix:'mirpanel_owner',useSecureCookies:c.origin.startsWith('https:')},rateLimit:{enabled:true,window:60,max:20},
  socialProviders:{google:{clientId:c.clientId,clientSecret:c.clientSecret}},onAPIError:{errorURL:c.origin+'/hesab'},
  // The only public path creating an already verified user is Google's
  // validated callback. Linking or signing in never runs this create hook.
  databaseHooks:{user:{create:{before:async(u,ctx)=>{try{let details={phoneVerified:false};if(ctx?.path==='/sign-up/email'){if(String(u.email).toLowerCase()===OWNER_EMAIL)throw Object.assign(Error('Sahib hesabı üçün Google girişindən istifadə edin.'),{code:'REGISTRATION_FIELD_EMAIL'});details=registrationDetails(ctx.body);}else safeName(u.name);return{data:{...u,...details}};}catch(e){throw fail(e.message,e.code);}},after:async u=>{if(u.emailVerified===true)await welcome(u);}},update:{before:async u=>{if(u.name!==undefined)try{safeName(u.name);}catch(e){throw fail(e.message);}return{data:u};}}},
   account:{create:{before:async a=>{if(a.userId===BOT_ID||!['google','credential'].includes(a.providerId))throw fail('Bu girişə icazə verilmir.');return{data:a};},after:async a=>{if(a.providerId==='google'){const u=(await pool.query('select * from "user" where id=$1',[a.userId])).rows[0];if(verifiedOwnerProfile(u))await bindOwner(pool,a);}}}},
   session:{create:{before:async s=>{if(s.userId===BOT_ID)throw fail('Sistem hesabı ilə giriş bağlıdır.');await requireAllowed(pool,s.userId);const u=(await pool.query('select * from "user" where id=$1',[s.userId])).rows[0];if(String(u?.email).toLowerCase()===OWNER_EMAIL&&!await isOwner(pool,u))throw fail('Sahib hesabının kimliyi təsdiqlənmədi.');return{data:s};}}}
  }
 });
}
