import {startEpointCheckout,readEpointCheckout} from './epoint-checkout.mjs';
import {reconcileEpoint} from './epoint-reconcile.mjs';
import {createHash} from 'node:crypto';
export function googlePreviewRef(user){const h=createHash('sha256').update('google-opening-preview-20261119:'+user).digest('hex').slice(0,32);return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
const fail=(status,message)=>Object.assign(Error(message),{status});
export async function previewOwner(context,request){
 const user=await context.checkoutAccount(request,{verified:true});
 if(!user)throw fail(401,'Əvvəl sahib hesabınızla MirPanel-ə daxil olun.');
 if(user!==await context.verifiedOwnerId())throw fail(403,'Bu yoxlama yalnız sahib hesabına açıqdır.');
 return user;
}
export async function startGooglePreview(pool,user,input,options={}){
 if(input?.method!=='google-pay'||Number(input.amount)!==1)throw fail(400,'Yalnız Google Pay üçün 1 ₼-lik yoxlama icazəlidir.');
 if(input.requestId!==googlePreviewRef(user))throw fail(400,'Yalnız ayrılmış bir yoxlama sorğusu icazəlidir.');
 // Owner authorization is performed by the route, never by a client flag.
 // All normal idempotency, owner/amount checks and signed settlement remain intact.
 return startEpointCheckout(pool,user,{requestId:input.requestId,method:'google-pay',amount:'1.00'},
  {...options,env:{...(options.env||process.env),EPOINT_TOKEN_WIDGET_ENABLED:'true',EPOINT_GOOGLE_PAY_ENABLED:'true'}});
}
export async function readGooglePreview(pool,user,ref,options={}){
 const row=(await pool.query('select method from mirpanel_community.epoint_checkout_requests where id=$1 and user_id=$2',[ref,user])).rows[0];
 if(row?.method!=='google-pay')throw fail(404,'Yoxlama tapılmadı.');
 const current=await readEpointCheckout(pool,user,ref);
 if(current.status!=='success')await reconcileEpoint(pool,ref,{...options,user}).catch(()=>{});
 return readEpointCheckout(pool,user,ref);
}
export const googlePreviewHTML='<!doctype html><html lang="az"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Pay — məhdud yoxlama</title><style>body{background:#111317;color:#eee;font:16px/1.6 system-ui;margin:0}main{max-width:36rem;margin:24px auto;padding:16px}button,a{min-height:44px;padding:8px 14px;display:inline-flex;align-items:center}button{background:#ffd900;border:0;border-radius:10px;font:inherit}iframe{background:white}strong{color:#ffc868}</style><main><h1>Google Pay — yalnız sahib üçün yoxlama</h1><p><strong>Məbləğ: 1,00 ₼. Bu canlı Epoint vidcetidir. Ödənişi təsdiqləməyin.</strong></p><p>Google Cüzdanı aktiv olan uyğun Android telefonda açın. Məqsəd Google Pay düyməsini və ödəniş ekranını görməkdir. Kart/cüzdan təsdiqi mərhələsində dayanın.</p><form data-google-preview></form><p><a href="/balans">Balansa qayıt</a></p></main><script type="module" src="/community-assets/epoint-preview.js?v=1"></script></html>';
