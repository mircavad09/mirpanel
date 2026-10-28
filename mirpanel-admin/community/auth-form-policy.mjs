export const authFormPolicy={minPasswordLength:6,maxPasswordLength:128,termsUrl:'/sertler',privacyUrl:'/sertler#sertler-10',privacyIsSection:true};
export function registrationDetails(b){
 const name=(v,label,max)=>{if(typeof v!=='string')throw Error(label+' yazın.');const s=v.normalize('NFKC').trim().replace(/\s+/g,' ');if(!s||s.length>max||/[<>\p{C}]/u.test(s))throw Error(label+' düzgün deyil.');return s;};
 const first=name(b.firstName,'Adınızı',40),last=name(b.lastName,'Soyadınızı',50);
 if(b.termsAccepted!==true)throw Error('Davam etmək üçün istifadə şərtlərini qəbul edin.');
 if(!['994','90','995','7','1','44','49'].includes(String(b.countryCode)))throw Error('Ölkə kodunu seçin.');
 if(typeof b.phone!=='string'||!/^[0-9 ()\-.]{5,25}$/.test(b.phone))throw Error('Telefon nömrəsini düzgün yazın.');
 let digits=b.phone.replace(/\D/g,'');if(b.countryCode==='994'&&digits.length===10&&digits.startsWith('0'))digits=digits.slice(1);
 if(b.countryCode==='994'&&digits.length!==9)throw Error('Azərbaycan nömrəsi ölkə kodundan sonra 9 rəqəm olmalıdır.');
 const phone='+'+b.countryCode+digits;if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Telefon nömrəsi düzgün deyil.');
 return{name:first+' '+last,phoneNumber:phone,phoneVerified:false,registrationTermsAcceptedAt:new Date()};
}
