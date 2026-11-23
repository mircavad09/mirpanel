import {walletDeviceSupports,appleMoney as money,rememberWidgetTransaction,recoverWidgetPayment} from './epoint-wallet.js?v=apple-iphone-flow-1';
const validRef=value=>typeof value==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value);
export async function showApplePayment(doc=document){
 const main=doc.querySelector('[data-apple-payment]');if(!main)return;
 const ref=new URLSearchParams(location.search).get('ref'),status=main.querySelector('[data-apple-status]'),amount=main.querySelector('[data-apple-amount]'),host=main.querySelector('[data-apple-widget]'),retry=main.querySelector('[data-apple-retry]'),result=main.querySelector('[data-apple-result]'),login=main.querySelector('[data-apple-login]');
 if(!validRef(ref)){status.textContent='Ödəniş nömrəsi düzgün deyil. Balans səhifəsinə qayıdın.';return;}
 const resultURL='/odenis/epoint/ugurlu?ref='+encodeURIComponent(ref);
 result.href=resultURL;result.hidden=false;login.href='/hesab?next='+encodeURIComponent('/odenis/epoint/apple-pay?ref='+ref);
 let running=false,frame=null,timer=null,frameTimer=null,count=0,hintAt=0,stopped=false;
 async function refresh(){
  if(running||stopped)return;clearTimeout(timer);running=true;retry.disabled=true;retry.hidden=true;login.hidden=true;
  try{
   await recoverWidgetPayment(ref);
   const r=await fetch('/api/payments/epoint/apple-checkout?ref='+encodeURIComponent(ref),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)}),data=await r.json().catch(()=>({}));
   if(!r.ok)throw Object.assign(Error(data.error||'Ödəniş məlumatı alınmadı.'),{status:r.status});
   if(data.method!=='apple-pay'||!Number.isSafeInteger(data.cents)||data.cents<=0)throw Error('Ödəniş məlumatı uyğun deyil.');
   amount.textContent='Balansa əlavə ediləcək: '+money(data.cents);
   if(data.status==='success'||data.status==='failed'){stopped=true;location.replace(resultURL);return;}
   if(!await walletDeviceSupports('apple-pay')){status.textContent='Apple Pay yalnız Apple Pay dəstəyi olan iPhone-da açılır. Balansa qayıdıb başqa ödəniş üsulu seçə bilərsiniz.';return;}
   if(!data.widget){status.textContent='Ödəniş yoxlanılır… Yeni əməliyyat yaratmadan vəziyyəti yenidən yoxlayın.';retry.hidden=false;}
   else if(!frame){
    const url=new URL(data.widget);if(url.protocol!=='https:'||url.port||url.username||url.password||!(url.hostname==='epoint.az'||url.hostname.endsWith('.epoint.az')))throw Error('Vidcet ünvanı düzgün deyil.');
    frame=doc.createElement('iframe');frame.title='Apple Pay — Epoint təhlükəsiz ödəniş';frame.allow='payment '+url.origin;frame.referrerPolicy='strict-origin-when-cross-origin';
    const nextFrame=frame;
    frame.addEventListener('load',()=>{clearTimeout(frameTimer);if(frame!==nextFrame)return;status.textContent='Epoint-in rəsmi Apple Pay düyməsinə toxunun. Son maliyyə təsdiqini cihazınızda verirsiniz. Balans yalnız server təsdiqindən sonra artırılır.';retry.hidden=false;},{once:true});
    frame.addEventListener('error',()=>{clearTimeout(frameTimer);if(frame!==nextFrame)return;status.textContent='Ödəniş ekranı yüklənmədi. Eyni əməliyyatla yenidən cəhd edə bilərsiniz.';retry.hidden=false;},{once:true});
    frame.src=url.href;host.replaceChildren(frame);status.textContent='Apple Pay ödəniş ekranı açılır…';
    frameTimer=setTimeout(()=>{if(frame===nextFrame&&frame.isConnected){status.textContent='Ödəniş ekranı gecikir. Eyni əməliyyatla yenidən cəhd edə bilərsiniz.';retry.hidden=false;}},12000);
   }
   if(++count<45)timer=setTimeout(refresh,4000);
   else{status.textContent='Ödəniş yoxlanılır… Vəziyyəti ayrıca yoxlaya bilərsiniz. Təkrar ödəniş etməyin.';retry.hidden=false;}
  }catch(e){status.textContent=e.status===401?'Ödənişi başladığınız hesabla daxil olun.':e.status===404?'Bu hesab üçün Apple Pay ödənişi tapılmadı.':e.message;login.hidden=e.status!==401;retry.hidden=false;}
  finally{running=false;retry.disabled=false;}
 }
 retry.addEventListener('click',()=>{count=0;clearTimeout(frameTimer);if(frame){frame.remove();frame=null;}void refresh();});
 window.addEventListener('message',event=>{
  if(!frame||event.source!==frame.contentWindow||event.origin!==new URL(frame.src).origin||!['success','failed','error'].includes(event.data?.status)||Date.now()-hintAt<3000)return;
  hintAt=Date.now();rememberWidgetTransaction(ref,event.data);status.textContent='Ödəniş yoxlanılır…';void refresh();
 });
 window.addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(frameTimer);});
 window.addEventListener('pageshow',event=>{if(event.persisted&&!stopped){count=0;void refresh();}});
 await refresh();
}
if(typeof document!=='undefined')void showApplePayment();
