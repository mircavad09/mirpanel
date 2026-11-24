import {walletDeviceSupports,appleMoney as money} from './epoint-wallet.js?v=selection-1';
const names={'apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10'};
const validRef=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value);
export async function showEpointPayment(doc=document){
 const main=doc.querySelector('[data-epoint-payment],[data-apple-payment]');if(!main)return;
 const ref=new URLSearchParams(location.search).get('ref'),status=main.querySelector('[data-apple-status]'),amount=main.querySelector('[data-apple-amount]'),host=main.querySelector('[data-apple-widget]'),retry=main.querySelector('[data-apple-retry]'),result=main.querySelector('[data-apple-result]'),login=main.querySelector('[data-apple-login]');
 if(!validRef(ref)){status.textContent='Ödəniş nömrəsi düzgün deyil. Balansa qayıdın.';return;}
 const resultURL='/odenis/epoint/ugurlu?ref='+encodeURIComponent(ref);result.href=resultURL;result.hidden=false;login.href='/hesab?next='+encodeURIComponent('/odenis/epoint/odeme?ref='+ref);
 let running=false,frame=null,timer=null,frameTimer=null,count=0,hintAt=0,stopped=false;
 async function refresh(){
  if(running||stopped)return;clearTimeout(timer);running=true;retry.disabled=true;retry.hidden=true;login.hidden=true;
  try{
   const r=await fetch('/api/payments/epoint/checkout?ref='+encodeURIComponent(ref),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)}),data=await r.json().catch(()=>({}));
   if(!r.ok)throw Object.assign(Error(data.error||'Ödəniş məlumatı alınmadı.'),{status:r.status});
   const name=names[data.method];if(!name||!Number.isSafeInteger(data.cents)||data.cents<=0)throw Error('Ödəniş məlumatı uyğun deyil.');
   const purchase=data.purpose==='purchase';
   main.querySelector('h1').textContent=name+(purchase?' ilə sifariş ödənişi':' ilə balans artırma');doc.title=name+' — MirPanel';const method=main.querySelector('[data-payment-method]');if(method)method.textContent=name;
   amount.textContent=(purchase?'Sifariş məbləği: ':'Balansa əlavə ediləcək: ')+money(data.cents);
   if(purchase){const back=main.querySelector('a[href="/balans"]');if(back){back.href='/odenis?completed='+encodeURIComponent(data.checkoutId);back.textContent='Geri — Sifarişə qayıt';}}
   if(data.status==='success'||data.status==='failed'){stopped=true;location.replace(resultURL);return;}
   if(data.openingIssue){status.textContent=[data.openingMessage,data.providerTransaction?'Əməliyyat: '+data.providerTransaction:'',data.providerTrace?'İzləmə: '+data.providerTrace:''].filter(Boolean).join(' · ');retry.hidden=false;return;}
   if(!await walletDeviceSupports(data.method)){status.textContent='Bu cihazda '+name+' açılmır. '+(purchase?'Sifarişə qayıdıb':'Balansa qayıdıb')+' başqa üsul seçin.';return;}
   if(['birbank','m10'].includes(data.method)&&data.redirect){
    const target=new URL(data.redirect);if(target.protocol!=='https:'||target.username||target.password||target.port)throw Error('Ödəniş keçidi düzgün deyil.');
    status.textContent=name+' ödəniş səhifəsi açılır…';stopped=true;location.replace(target.href);return;
   }
   if(!data.widget){status.textContent='Ödəniş yoxlanılır… Yeni ödəniş yaratmadan vəziyyəti yenidən yoxlayın.';retry.hidden=false;}
   else if(!frame){
    const url=new URL(data.widget);if(url.protocol!=='https:'||url.port||url.username||url.password||!(url.hostname==='epoint.az'||url.hostname.endsWith('.epoint.az')))throw Error('Ödəniş keçidi düzgün deyil.');
    frame=doc.createElement('iframe');frame.title=name+' — Epoint təhlükəsiz ödəniş';frame.allow='payment '+url.origin;frame.referrerPolicy='strict-origin-when-cross-origin';const nextFrame=frame;
    frame.addEventListener('load',()=>{clearTimeout(frameTimer);if(frame!==nextFrame)return;status.textContent='Rəsmi '+name+' düyməsi ilə davam edin. '+(purchase?'Sifariş server təsdiqindən sonra ödənilmiş sayılacaq.':'Balans ödəniş təsdiqləndikdən sonra artırılacaq.');retry.hidden=false;},{once:true});
    frame.addEventListener('error',()=>{clearTimeout(frameTimer);if(frame!==nextFrame)return;status.textContent='Ödəniş ekranı yüklənmədi. Yenidən cəhd edin.';retry.hidden=false;},{once:true});
    frame.src=url.href;host.replaceChildren(frame);status.textContent='Ödəniş ekranı açılır…';frameTimer=setTimeout(()=>{if(frame===nextFrame&&frame.isConnected){status.textContent='Ödəniş ekranı gecikir. Yenidən cəhd edin.';retry.hidden=false;}},12000);
   }
   if(++count<45)timer=setTimeout(refresh,4000);else{status.textContent='Ödəniş yoxlanılır… Vəziyyəti ayrıca yoxlaya bilərsiniz.';retry.hidden=false;}
  }catch(e){status.textContent=e.status===401?'Ödənişi başladığınız hesabla daxil olun.':e.status===404?'Bu hesab üçün ödəniş tapılmadı.':e.message;login.hidden=e.status!==401;retry.hidden=false;}
  finally{running=false;retry.disabled=false;}
 }
 retry.addEventListener('click',()=>{count=0;clearTimeout(frameTimer);if(frame){frame.remove();frame=null;}void refresh();});
 window.addEventListener('message',event=>{if(!frame||event.source!==frame.contentWindow||event.origin!==new URL(frame.src).origin||!['success','failed','error'].includes(event.data?.status)||Date.now()-hintAt<3000)return;hintAt=Date.now();status.textContent='Ödəniş yoxlanılır…';void refresh();});
 window.addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(frameTimer);});window.addEventListener('pageshow',event=>{if(event.persisted&&!stopped){count=0;void refresh();}});await refresh();
}
if(typeof document!=='undefined')void showEpointPayment();
