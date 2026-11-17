import crypto from 'node:crypto';
import {signature} from '../employee-security.mjs';
const titles={zoom:'Zoom Pro',spotify:'Spotify Premium',capcut:'CapCut Pro',netflix:'Netflix Şəxsi',netflix_umumi:'Netflix Ümumi',chatgpt:'ChatGPT Şəxsi',prime:'Amazon Prime',hbomax:'HBO Max',surfshark:'Surfshark VPN',canva:'Canva Premium',pubg_mobile:'PUBG Mobile',free_fire:'Free Fire',telegram_premium:'Telegram Premium'};
export function giftShortTitle(product){
 if(Object.hasOwn(titles,product.id))return titles[product.id];
 const title=String(product.title||'Məhsul').replace(/\s*\([^)]*\)/gu,'').trim();
 return Array.from(title).length>30?Array.from(title).slice(0,28).join('').trimEnd()+'…':title;
}
export function giftPlanAllowed(product,plan){
 const text=[product.id,product.title,plan.label,plan.name].filter(Boolean).join(' ').normalize('NFKC').toLocaleLowerCase('az-AZ');
 if(!/chatgpt/u.test(text))return true;
 return !/ortaq|ümumi|shared/u.test(text)&&(product.id==='chatgpt'||/şəxsi|personal|private/u.test(text));
}
export function giftPlanLabel(plan){
 return String(plan.label||plan.name||'').trim()||(plan.durationDays?plan.durationDays+' gün':(plan.durationMonths??plan.months)?(plan.durationMonths??plan.months)+' ay':'Paket');
}
export function giftTermsInfo(product,plan,index){
 const terms=[
  'Bu, '+product.title+' — '+giftPlanLabel(plan)+' paketinin influencerə məhsul hədiyyəsi sifarişidir.',
  'Ödəniş hədiyyə verənin MirPanel balansından tutulur. Hədiyyə ödəniş təsdiqləndikdən sonra adminin influencerə təqdim etməsi üçün qeydə alınır.',
  'Hədiyyə verənin e-poçtu, şifrəsi və oyunçu məlumatları tələb olunmur; onun şəxsi hesabında avtomatik aktivləşdirmə aparılmır.',
  'Təqdimat üçün lazım olan məlumatları admin hədiyyə alan influencerlə dəqiqləşdirir.'
 ].join('\n');
 return {fields:[],terms,note:'Hədiyyə admin tərəfindən influencerə təqdim ediləcək.',termsVersion:crypto.createHash('sha256').update(JSON.stringify(['influencer-product-gift-v2',product.id,index,signature(plan),terms])).digest('hex')};
}
