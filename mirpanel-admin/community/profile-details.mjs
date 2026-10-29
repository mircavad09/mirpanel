import {fail,displayName} from './repository.mjs';
export function profileDetails(b){
 const allowed=['name','avatar','firstName','lastName','phone','whatsapp','socialLinks'];
 if(!b||Object.keys(b).some(k=>!allowed.includes(k)))throw fail(403,'Bu sahəni dəyişmək olmaz.');
 const name=displayName(b.firstName!==undefined?[b.firstName,b.lastName].filter(Boolean).join(' '):b.name);
 const phone=v=>{if(!v)return null;const s=String(v).replace(/[\s()-]/g,'');if(!/^\+[1-9]\d{7,14}$/.test(s))throw fail(400,'Telefon nömrəsini ölkə kodu ilə yazın.');return s;};
 const links={};for(const [key,value]of Object.entries(b.socialLinks||{})){const domains={instagram:['instagram.com','www.instagram.com'],facebook:['facebook.com','www.facebook.com'],tiktok:['tiktok.com','www.tiktok.com']};if(!domains[key])throw fail(400,'Sosial keçid düzgün deyil.');if(!value)continue;let u;try{u=new URL(value);}catch{throw fail(400,'Sosial keçidi https:// ilə yazın.');}if(u.protocol!=='https:'||!domains[key].includes(u.hostname)||u.username||u.password||u.port||value.length>300)throw fail(400,'Təhlükəsiz sosial keçid daxil edin.');links[key]=u.href;}
 if(b.avatar!==undefined&&(!Number.isInteger(b.avatar)||b.avatar<0||b.avatar>7))throw fail(400,'Avatar düzgün deyil.');
 return{name,first:String(b.firstName??name.split(' ')[0]).trim().slice(0,40),last:String(b.lastName??name.split(' ').slice(1).join(' ')).trim().slice(0,40),phone:phone(b.phone),whatsapp:phone(b.whatsapp),links,avatar:b.avatar};
}
export async function saveProfile(pool,user,b){const p=profileDetails(b);await pool.query('update community_profiles set display_name=$2,first_name=$3,last_name=$4,phone=case when $9 then $5 else phone end,whatsapp=case when $10 then $6 else whatsapp end,social_links=case when $11 then $7 else social_links end,avatar=coalesce($8,avatar) where user_id=$1',[user.id,p.name,p.first,p.last,p.phone,p.whatsapp,p.links,p.avatar??null,Object.hasOwn(b,'phone'),Object.hasOwn(b,'whatsapp'),Object.hasOwn(b,'socialLinks')]);}
