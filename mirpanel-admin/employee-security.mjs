import crypto from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(crypto.scrypt);
export const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export function text(value,max=500){const v=String(value??'').trim();if(v.length>max||/[<>\u0000-\u0008]/u.test(v))throw fail('Mətn düzgün deyil.');return v;}
export function quantity(v=1){const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>100)throw fail('Miqdar 1–100 arasında olmalıdır.');return n;}
export function customerDetails(input={}){
 const name=text(input.name,120),phone=String(input.phone||'').replace(/[\s()+-]/g,'');
 if(name.length<2||!/^[1-9]\d{7,14}$/.test(phone))throw fail('Ad və ölkə kodu ilə WhatsApp nömrəsi tələb olunur.');
 return {name,phone,quantity:quantity(input.quantity)};
}
export const signature=plan=>crypto.createHash('sha256').update(JSON.stringify([plan.id??null,plan.label||plan.name||'',plan.duration_months??plan.durationMonths??plan.months??null])).digest('hex');
export async function hashPassword(password){if(typeof password!=='string'||password.length<12||password.length>200)throw fail('Şifrə 12–200 simvol olmalıdır.');const salt=crypto.randomBytes(16).toString('hex');return `scrypt:${salt}:${Buffer.from(await scrypt(password,salt,64)).toString('hex')}`;}
export async function verifyPassword(password,hash){if(typeof password!=='string'||password.length>200)return false;const [kind,salt,hex]=String(hash).split(':');if(kind!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hex))return false;return crypto.timingSafeEqual(Buffer.from(await scrypt(password,salt,64)),Buffer.from(hex,'hex'));}
export function createStockCrypto(base64){const base=Buffer.from(base64||'','base64');if(base.length!==32)throw fail('Stok şifrələmə xidməti konfiqurasiya edilməyib.',503);const key=Buffer.from(crypto.hkdfSync('sha256',base,Buffer.from('Mirpanel'),Buffer.from('employee-stock-v1'),32));
 return {fingerprint:value=>crypto.createHmac('sha256',key).update(JSON.stringify(value)).digest('hex'),
 id:(request,index)=>{const h=crypto.createHmac('sha256',key).update(`${request}:${index}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;},
 encrypt:(value,aad)=>{const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(aad));return Buffer.concat([iv,c.update(JSON.stringify(value)),c.final(),c.getAuthTag()]).toString('base64');},
 decrypt:(value,aad)=>{const b=Buffer.from(value,'base64');if(b.length<29)throw fail('Stok məlumatı zədələnib.',409);const d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAAD(Buffer.from(aad));d.setAuthTag(b.subarray(-16));return JSON.parse(Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8'));}};
}
const variables=new Set(['customerName','orderNumber','productName','planName','quantity','email','password','code','inviteLink','instructions']);
export function validateTemplate(value){const v=text(value,12000);for(const m of v.matchAll(/{{\s*(\w+)\s*}}/g))if(!variables.has(m[1]))throw fail('Mesaj şablonunda naməlum dəyişən var.');return v;}
export function renderDelivery(template,order,units){const safe=validateTemplate(template||'Salam {{customerName}}. Sifarişiniz hazırdır ✅\nSifariş №: {{orderNumber}}\nMəhsul: {{productName}}\nPlan: {{planName}}\nE-poçt: {{email}}\nŞifrə: {{password}}\nKod: {{code}}\nDəvət: {{inviteLink}}\n{{instructions}}\nMəlumatları üçüncü şəxslə paylaşmayın. Problem yaranarsa Mirpanel dəstəyə müraciət edin.');return units.map(u=>safe.replace(/{{\s*(\w+)\s*}}/g,(_,k)=>String(({customerName:order.customer_name,orderNumber:order.order_code,productName:order.product_title,planName:order.plan_name,quantity:order.quantity,...u})[k]??''))).join('\n\n────────\n\n');}
export function whatsAppAdapter(phone,message){if(!/^[1-9]\d{7,14}$/.test(phone))throw fail('WhatsApp nömrəsi düzgün deyil.');return {kind:'manual-wa-me',url:`https://wa.me/${phone}?text=${encodeURIComponent(message)}`,automaticallySent:false};}
export const cloudWhatsAppAdapter={send:async()=>{throw fail('WhatsApp Business inteqrasiyası aktiv deyil; mesaj göndərilməyib.',503);}};
