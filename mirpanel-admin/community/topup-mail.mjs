const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>{
 const cents=BigInt(value);
 return (cents/100n).toString()+','+(cents%100n).toString().padStart(2,'0')+' ₼';
};
export function topupMail(job,user,origin){
 const approved=job.event_key.startsWith('topup-approved:');
 const snapshot=job.topup_snapshot;
 const url=new URL('/profil?tab=payments&topup='+encodeURIComponent(job.topup_id),origin).href;
 const subject=approved?'MirPanel — Ödənişiniz təsdiqləndi':'MirPanel — Ödəniş qəbziniz qəbul edildi';
 const paragraphs=approved?[
  'Salam, '+user.name+'!',
  'Ödənişiniz təsdiqləndi və balansınıza '+money(snapshot.cents)+' əlavə edildi.',
  'Əməliyyatdan sonrakı balansınız '+money(snapshot.balance)+'.',
  'Alış-veriş etmək üçün MirPanel hesabınıza daxil olun.',
  'Bizi seçdiyiniz üçün təşəkkür edirik!'
 ]:[
  'Salam, '+user.name+'!',
  money(snapshot.cents)+' məbləğində ödəniş qəbziniz uğurla əlavə edildi. Ödənişiniz yoxlanılır. Təsdiq edilməsini gözləyin.',
  'Müraciət № '+snapshot.number,
  'Nəticəni Ödənişlərim bölməsində izləyə bilərsiniz.'
 ];
 const links=[...(approved?[['Məhsullara bax',new URL('/mehsul',origin).href]]:[]),['Ödənişlərimə bax',url]];
 return {user:{email:user.email},subject,idempotencyKey:job.event_key,
  textBody:[...paragraphs,...links.map(([label,href])=>label+' — '+href)].join('\n\n'),
  htmlBody:'<div lang="az" style="max-width:560px;margin:auto;padding:20px;color:#202124;font:15px/1.5 Arial,sans-serif"><p style="color:#665014;font-weight:bold">MIRPANEL</p><h1 style="font-size:23px">'+escape(subject.replace('MirPanel — ',''))+'</h1>'+
   paragraphs.map(p=>'<p>'+escape(p)+'</p>').join('')+links.map(([label,href])=>'<p><a style="display:inline-block;background:#ffcf33;color:#222;padding:11px 18px;border-radius:8px;text-decoration:none" href="'+escape(href)+'">'+escape(label)+'</a></p>').join('')+'</div>'};
}
