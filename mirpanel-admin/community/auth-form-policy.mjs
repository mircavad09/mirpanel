import {safeName} from './bot-policy.mjs';
export const authFormPolicy={minPasswordLength:6,maxPasswordLength:128,termsUrl:'/sertler',privacyUrl:'/sertler#sertler-10',privacyIsSection:true};
const fieldError=(code,message)=>Object.assign(Error(message),{code:'REGISTRATION_FIELD_'+code});
export function registrationDetails(b){
 const name=(v,label,max,code)=>{if(typeof v!=='string')throw fieldError(code,label+' yazın.');const s=v.normalize('NFKC').trim().replace(/\s+/g,' ');if(!s||s.length>max||/[<>\p{C}]/u.test(s))throw fieldError(code,label+' düzgün deyil.');try{safeName(s);}catch(e){throw fieldError(code,e.message);}return s;};
 const first=name(b.firstName,'Adınızı',40,'FIRST_NAME'),last=name(b.lastName,'Soyadınızı',50,'LAST_NAME');
 if((first+' '+last).length>80)throw fieldError('LAST_NAME','Ad və soyad birlikdə 80 simvoldan uzun ola bilməz.');
 try{safeName(first+' '+last);}catch(e){throw fieldError('FIRST_NAME',e.message);}
 if(b.termsAccepted!==true)throw fieldError('TERMS','Davam etmək üçün istifadə şərtlərini qəbul edin.');
 if(!['994','90','995','7','1','44','49'].includes(String(b.countryCode)))throw fieldError('COUNTRY','Ölkə kodunu seçin.');
 if(typeof b.phone!=='string'||!/^[0-9 ()\-.]{5,25}$/.test(b.phone))throw fieldError('PHONE','Telefon nömrəsini düzgün yazın.');
 let digits=b.phone.replace(/\D/g,'');if(b.countryCode==='994'&&digits.length===10&&digits.startsWith('0'))digits=digits.slice(1);
 if(b.countryCode==='994'&&digits.length!==9)throw fieldError('PHONE','Azərbaycan nömrəsi ölkə kodundan sonra 9 rəqəm olmalıdır.');
 const phone='+'+b.countryCode+digits;if(!/^\+[1-9]\d{7,14}$/.test(phone))throw fieldError('PHONE','Telefon nömrəsi düzgün deyil.');
 return{name:first+' '+last,phoneNumber:phone,phoneVerified:false,registrationTermsAcceptedAt:new Date()};
}
