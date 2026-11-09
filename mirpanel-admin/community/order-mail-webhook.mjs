import {createHmac,timingSafeEqual} from 'node:crypto';

const types=new Map([
  ['email.delivered','RESEND_DELIVERED'],['email.delivery_delayed','RESEND_DELIVERY_DELAYED'],
  ['email.bounced','RESEND_BOUNCED'],['email.failed','RESEND_FAILED'],['email.suppressed','RESEND_SUPPRESSED'],
]);
const bad=status=>Object.assign(new Error('ORDER_MAIL_WEBHOOK_INVALID'),{status});
const b64=/^[A-Za-z0-9+/]+={0,2}$/;
const providerId=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function verifyOrderMailWebhook(raw,headers,secret,now=Date.now()){
  if(!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret||''))throw bad(503);
  const key=Buffer.from(secret.slice(6),'base64');
  if(key.length<16)throw bad(503);
  const id=headers['svix-id'],timestamp=headers['svix-timestamp'],signatures=headers['svix-signature'];
  if(typeof id!=='string'||!/^msg_[A-Za-z0-9]+$/.test(id)||typeof timestamp!=='string'||!/^\d{1,12}$/.test(timestamp)||
    Math.abs(now/1000-Number(timestamp))>300||typeof signatures!=='string'||signatures.length>1024)throw bad(401);
  const expected=createHmac('sha256',key).update(`${id}.${timestamp}.`).update(raw).digest();
  if(!signatures.split(' ').some(signature=>{
    const value=signature.startsWith('v1,')&&signature.slice(3);
    if(!value||!b64.test(value))return false;
    const digest=Buffer.from(value,'base64');
    return digest.length===expected.length&&timingSafeEqual(digest,expected);
  }))throw bad(401);
  let body;
  try{body=JSON.parse(raw.toString('utf8'));}catch{throw bad(400);}
  const reason=types.get(body?.type);
  if(!reason)return null;
  const data=body?.data;
  if(!providerId.test(data?.email_id||''))throw bad(400);
  if(['MirPanel — Ödəniş qəbziniz qəbul edildi','MirPanel — Ödənişiniz təsdiqləndi'].includes(data.subject))
    return {providerId:data.email_id,reason,topup:true};
  const code=/^Sifarişiniz təsdiqləndi — Sifariş №([A-Za-z0-9-]{1,40})$/u.exec(data.subject||'')?.[1];
  return code?{providerId:data.email_id,reason,code}:null;
}

export async function readOrderMailWebhook(req,secret){
  let size=0;const chunks=[];
  for await(const chunk of req){
    const bytes=Buffer.from(chunk);size+=bytes.length;
    if(size>65536)throw bad(413);
    chunks.push(bytes);
  }
  return verifyOrderMailWebhook(Buffer.concat(chunks),req.headers,secret);
}
