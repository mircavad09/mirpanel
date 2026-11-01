import {betterAuth} from 'better-auth';import {APIError} from 'better-auth/api';
import {authFormPolicy,registrationDetails} from './auth-form-policy.mjs';
import {safeName,BOT_ID} from './bot-policy.mjs';import {requireAllowed} from './group-control.mjs';
import {bindOwner,isOwner,OWNER_EMAIL,verifiedOwnerProfile} from './owner-auth.mjs';
export function makePublicAuth(pool,c,send){const fail=m=>new APIError('BAD_REQUEST',{message:m});
 return betterAuth({appName:'MirPanel',database:pool,baseURL:c.origin,secret:c.secret,trustedOrigins:[c.origin],logger:{disabled:true},
  emailAndPassword:{enabled:true,requireEmailVerification:true,minPasswordLength:authFormPolicy.minPasswordLength,maxPasswordLength:authFormPolicy.maxPasswordLength,revokeSessionsOnPasswordReset:true,sendResetPassword:v=>send('reset',v)},
  emailVerification:{sendOnSignUp:true,autoSignInAfterVerification:true,sendVerificationEmail:v=>send('verify',v)},
  user:{validateUserInfo:({user,source})=>source.method==='oauth'&&(source.oauth?.providerId!=='google'||user.emailVerified!==true)?{error:'unverified_identity',errorDescription:'Təsdiqlənmiş Google hesabı tələb olunur.'}:undefined,additionalFields:{phoneNumber:{type:'string',required:false,input:false,fieldName:'phone_number'},phoneVerified:{type:'boolean',required:false,input:false,defaultValue:false,fieldName:'phone_verified'},registrationTermsAcceptedAt:{type:'date',required:false,input:false,fieldName:'registration_terms_accepted_at'}}},
  account:{encryptOAuthTokens:true,accountLinking:{enabled:true,requireLocalEmailVerified:true,allowDifferentEmails:false,trustedProviders:[]}},
  session:{expiresIn:30*86400,updateAge:86400,cookieCache:{enabled:false}},advanced:{cookiePrefix:'mirpanel_owner',useSecureCookies:c.origin.startsWith('https:')},rateLimit:{enabled:true,window:60,max:20},
  socialProviders:{google:{clientId:c.clientId,clientSecret:c.clientSecret}},onAPIError:{errorURL:c.origin+'/hesab'},
  databaseHooks:{user:{create:{before:async(u,ctx)=>{try{safeName(u.name);let details={phoneVerified:false};if(ctx?.path==='/sign-up/email'){if(String(u.email).toLowerCase()===OWNER_EMAIL)throw Error('Sahib hesabı üçün Google girişindən istifadə edin.');details=registrationDetails(ctx.body);}return{data:{...u,...details}};}catch(e){throw fail(e.message);}}},update:{before:async u=>{if(u.name!==undefined)try{safeName(u.name);}catch(e){throw fail(e.message);}return{data:u};}}},
   account:{create:{before:async a=>{if(a.userId===BOT_ID||!['google','credential'].includes(a.providerId))throw fail('Bu girişə icazə verilmir.');return{data:a};},after:async a=>{if(a.providerId==='google'){const u=(await pool.query('select * from "user" where id=$1',[a.userId])).rows[0];if(verifiedOwnerProfile(u))await bindOwner(pool,a);}}}},
   session:{create:{before:async s=>{if(s.userId===BOT_ID)throw fail('Sistem hesabı ilə giriş bağlıdır.');await requireAllowed(pool,s.userId);const u=(await pool.query('select * from "user" where id=$1',[s.userId])).rows[0];if(String(u?.email).toLowerCase()===OWNER_EMAIL&&!await isOwner(pool,u))throw fail('Sahib hesabının kimliyi təsdiqlənmədi.');return{data:s};}}}
  }
 });
}
