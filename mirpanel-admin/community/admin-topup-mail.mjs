import {escape,money} from './topup-mail.mjs';

const adminEmail='mircavad09@gmail.com';
const dateFormat=new Intl.DateTimeFormat('az-AZ',{timeZone:'Asia/Baku',dateStyle:'short',timeStyle:'short'});

export function adminTopupMail(job,origin,preview,{test=false}={}){
 const {cents,member,bank,last4,submittedAt}=job.topup_snapshot;
 const memberLabel=member?'#'+member:'Qeydə alınmayıb';
 const subject=(test?'[SINAQ] ':'')+'Balans artımı · '+money(cents)+' · '+memberLabel;
 const url=action=>new URL('/admin.html?'+new URLSearchParams({topup:job.topup_id,topupAction:action}),origin).href;
 const card=bank&&/^\d{4}$/.test(last4)?bank+' •••• '+last4:'Qeydə alınmayıb';
 const fields=[['👤 Müştəri №',memberLabel],['💳 Ödəniş kartı',card],['🕒 Müraciət vaxtı',dateFormat.format(new Date(submittedAt))+' (Bakı)']];
 const button=(action,label,color)=>'<a href="'+escape(url(action))+'" style="display:inline-block;margin:0 6px 6px 0;padding:12px 17px;border-radius:8px;background:'+color+';color:#fff;text-decoration:none;font-weight:bold">'+label+'</a>';
 const receipt='<a href="'+escape(url('receipt'))+'" style="color:#184e93">'+(preview?
  '<img src="cid:topup-receipt" alt="Qəbzin tam ölçüsünü aç" style="display:block;max-width:100%;max-height:190px;border:1px solid #d8dde2;border-radius:8px">':'Qəbzi admin panelində aç')+'</a>';
 return {user:{email:adminEmail},subject,idempotencyKey:job.event_key,
  attachments:preview?[{filename:'qebz.jpg',content:preview.toString('base64'),content_id:'topup-receipt'}]:undefined,
  textBody:[subject,...fields.map(([label,value])=>label+' — '+value),'Qəbz — '+url('receipt'),'Ödənişi tamamla','Təsdiqlə — '+url('approve'),'Ləğv et — '+url('reject')].join('\n'),
  htmlBody:'<div lang="az" style="max-width:400px;margin:0 auto;padding:16px;border:1px solid #d8dde2;border-radius:12px;background:#fff;color:#202124;font:15px/1.45 Arial,sans-serif">'+
   '<h1 style="font-size:20px;margin:0 0 12px">'+escape(subject)+'</h1>'+
   fields.map(([label,value])=>'<p style="margin:0 0 6px"><strong>'+label+'</strong> — '+escape(value)+'</p>').join('')+
   '<p style="margin:12px 0 4px"><strong>Qəbz</strong></p>'+receipt+
   '<p style="margin:12px 0 6px"><strong>Ödənişi tamamla</strong></p>'+button('approve','Təsdiqlə','#14653f')+button('reject','Ləğv et','#ad2535')+'</div>'};
}
