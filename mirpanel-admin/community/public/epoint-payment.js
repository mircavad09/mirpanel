import {walletDeviceSupports,appleMoney as money} from './epoint-wallet.js?v=payment-return-1';
import {paymentSelectionURL} from './payment-return-selection.js?v=1';
const names={card:'Bank kartı — Visa / Mastercard','apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10'};
const validRef=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value);
export async function showEpointPayment(doc=document){
 const main=doc.querySelector('[data-epoint-payment],[data-apple-payment]');if(!main)return;
 const ref=new URLSearchParams(location.search).get('ref'),status=main.querySelector('[data-apple-status]'),amount=main.querySelector('[data-apple-amount]'),host=main.querySelector('[data-apple-widget]'),retry=main.querySelector('[data-apple-retry]'),result=main.querySelector('[data-apple-result]'),login=main.querySelector('[data-apple-login]');
 if(!validRef(ref)){status.textContent='Ödəniş nömrəsi düzgün deyil. Balansa qayıdın.';return;}
 try{sessionStorage.setItem('mirpanel.epoint.return.v1',JSON.stringify({ref,at:Date.now()}));}catch{}
 const resultURL='/odenis/epoint/ugurlu?ref='+encodeURIComponent(ref);result.href=resultURL;result.hidden=false;login.href='/hesab?next='+encodeURIComponent('/odenis/epoint/odeme?ref='+ref);
 let running=false,frame=null,timer=null,frameTimer=null,count=0,hintAt=0,stopped=false,walletOpened=false,lastPurpose='topup',apple=false,leaving=false;
 const copy=(normal,compact)=>apple?compact:normal;
 const back=main.querySelector('[data-payment-back]');
 back?.addEventListener('click',async event=>{if(!apple&&lastPurpose!=='purchase')return;event.preventDefault();if(leaving)return;leaving=true;back.setAttribute('aria-disabled','true');stopped=true;clearTimeout(timer);clearTimeout(frameTimer);try{await fetch('/api/payments/epoint/leave',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref}),signal:AbortSignal.timeout(8000)});}catch{}location.assign(paymentSelectionURL(ref,lastPurpose));});
 async function refresh(){
  if(running||stopped)return;clearTimeout(timer);running=true;retry.disabled=true;retry.hidden=true;login.hidden=true;
  try{
   const r=await fetch('/api/payments/epoint/checkout?ref='+encodeURIComponent(ref),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)}),data=await r.json().catch(()=>({}));
   if(!r.ok)throw Object.assign(Error(data.error||'Ödəniş məlumatı alınmadı.'),{status:r.status});
   const name=names[data.method];if(!name||!Number.isSafeInteger(data.cents)||data.cents<=0)throw Error('Ödəniş məlumatı uyğun deyil.');
   const purchase=data.purpose==='purchase';

   lastPurpose=data.purpose;apple=data.method==='apple-pay';main.dataset.method=data.method;const mark=main.querySelector('[data-payment-mark]'),fee=main.querySelector('[data-payment-fee]');if(mark)mark.hidden=!apple;if(fee)fee.hidden=!apple;result.hidden=apple;
   const backLink=main.querySelector('a[href="/balans"],[data-payment-back]');if(backLink){backLink.dataset.paymentBack='';backLink.href=paymentSelectionURL(ref,data.purpose);if(!apple)backLink.textContent='Geri — Ödəniş üsulunu seç';}
   if(data.status==='success'){stopped=true;location.replace('/odenis/epoint/ugurlu?ref='+encodeURIComponent(data.settledCheckoutId||ref));return;}
   if(data.status==='failed'||data.attemptAbandoned){stopped=true;location.replace(paymentSelectionURL(ref,data.purpose));return;}

   main.querySelector('h1').textContent=name+(purchase?' ilə sifariş ödənişi':' ilə balans artırma');doc.title=name+' — MirPanel';const method=main.querySelector('[data-payment-method]');if(method)method.textContent=name;
   amount.textContent=(purchase?'Sifariş məbləği: ':'Balansa əlavə ediləcək: ')+(apple?(data.cents/100).toFixed(2).replace('.',',')+' AZN':money(data.cents));
   if(purchase){const back=main.querySelector('a[href="/balans"]');if(back){back.href='/odenis?completed='+encodeURIComponent(data.checkoutId);back.textContent='Geri — Sifarişə qayıt';}}
   if(data.openingExpired||data.openingFailed){status.textContent=data.openingExpired?'Ödəniş səhifəsi açıla bilmədi: keçidin müddəti bitib. Bank təsdiqi alınmayıb.':'Ödəniş səhifəsi açıla bilmədi. Provayder ödəniş səhifəsini yaratmadı; bank təsdiqi alınmayıb.';host.replaceChildren();const back=main.querySelector('a[href^="/odenis?completed="]');if(back){back.href='/odenis';back.textContent='Sifarişə qayıt';}try{const key='mirpanel.cart.checkout.v1';if(JSON.parse(localStorage.getItem(key)||'null')?.id===ref)localStorage.removeItem(key);}catch{}stopped=true;return;}
   if(data.openingIssue){status.textContent='Bu üsulla ödəniş səhifəsi açılmadı. Əvvəlki cəhdin vəziyyətini yoxlayın.';retry.hidden=false;return;}
   if(!await walletDeviceSupports(data.method)){status.textContent=data.method==='apple-pay'?'Apple Pay üçün Safari-də açın. Ödənişə başlamazdan əvvəl bank kartını da seçə bilərsiniz.':'Google Pay üçün uyğun Android telefonda Chrome-da açın. Ödənişə başlamazdan əvvəl bank kartını da seçə bilərsiniz.';return;}
   if(['card','birbank','m10'].includes(data.method)&&data.redirect&&!walletOpened){walletOpened=true;
    const target=new URL(data.redirect);if(target.protocol!=='https:'||target.username||target.password||target.port)throw Error('Ödəniş keçidi düzgün deyil.');
    status.textContent=name+' ödəniş səhifəsi açılır…';stopped=true;location.replace(target.href);return;
   }
   if(walletOpened&&data.redirect){status.textContent=data.providerStatus==='new'?'Ödəniş tamamlanmayıb. Mövcud Birbank əməliyyatı ilə davam edə bilərsiniz.':'Ödənişin nəticəsi yoxlanılır. Yeni ödəniş yaratmayın.';const a=doc.createElement('a');a.textContent='Ödənişə davam et';a.href=data.redirect;host.replaceChildren(a);retry.hidden=false;}
   else if(!data.widget){status.textContent='Ödəniş yoxlanılır… Yeni ödəniş yaratmadan vəziyyəti yenidən yoxlayın.';retry.hidden=false;}
   else if(!frame){
    const url=new URL(data.widget);if(url.protocol!=='https:'||url.port||url.username||url.password||!(url.hostname==='epoint.az'||url.hostname.endsWith('.epoint.az')))throw Error('Ödəniş keçidi düzgün deyil.');
    frame=doc.createElement('iframe');frame.title=name+' — Epoint təhlükəsiz ödəniş';frame.allow='payment '+url.origin;frame.referrerPolicy='strict-origin-when-cross-origin';const nextFrame=frame;
    frame.addEventListener('load',()=>{clearTimeout(frameTimer);if(frame!==nextFrame)return;status.textContent=copy('Rəsmi '+name+' düyməsi ilə davam edin. '+(purchase?'Sifariş server təsdiqindən sonra ödənilmiş sayılacaq.':'Balans ödəniş təsdiqləndikdən sonra artırılacaq.'),'Düyməyə klik edərək ödənişi tamamlayın.');retry.hidden=false;},{once:true});
    frame.addEventListener('error',()=>{clearTimeout(frameTimer);if(frame!==nextFrame)return;status.textContent=copy('Ödəniş ekranı yüklənmədi. Yenidən cəhd edin.','Ödəniş ekranı açıla bilmədi. Geri qayıdaraq seçiminizi yoxlaya bilərsiniz.');retry.hidden=false;},{once:true});
    frame.src=url.href;host.replaceChildren(frame);status.textContent='Ödəniş ekranı açılır…';frameTimer=setTimeout(()=>{if(frame===nextFrame&&frame.isConnected){status.textContent=copy('Ödəniş ekranı gecikir. Yenidən cəhd edin.','Ödəniş ekranı gecikir. Əməliyyatın nəticəsi yoxlanılır…');retry.hidden=false;}},12000);
   }

  }catch(e){status.textContent=e.status===401?'Ödənişi başladığınız hesabla daxil olun.':e.status===404?'Bu hesab üçün ödəniş tapılmadı.':'Ödəniş səhifəsi açıla bilmədi. Mövcud əməliyyatın vəziyyətini yenidən yoxlayın.';login.hidden=e.status!==401;retry.hidden=false;}
  finally{running=false;retry.disabled=false;if(apple){retry.hidden=true;result.hidden=true;}if(!stopped&&++count<45)timer=setTimeout(refresh,Math.min(12000,4000+Math.floor(count/10)*2000));}
 }
 retry.addEventListener('click',()=>{count=0;clearTimeout(frameTimer);if(frame){frame.remove();frame=null;}void refresh();});
 window.addEventListener('message',event=>{if(!frame||event.source!==frame.contentWindow||event.origin!==new URL(frame.src).origin||!['success','failed','error'].includes(event.data?.status)||Date.now()-hintAt<3000)return;hintAt=Date.now();status.textContent='Ödəniş yoxlanılır…';void refresh();});
 window.addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(frameTimer);});window.addEventListener('pageshow',event=>{if(event.persisted){location.replace(paymentSelectionURL(ref,lastPurpose));}});window.addEventListener('focus',()=>{if(!stopped)void refresh();});doc.addEventListener('visibilitychange',()=>{if(!doc.hidden&&!stopped)void refresh();});await refresh();
}
if(typeof document!=='undefined')void showEpointPayment();
