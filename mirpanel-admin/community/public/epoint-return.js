import {paymentSelectionURL} from './payment-return-selection.js?v=1';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(v);
const money=c=>(c/100).toFixed(2).replace('.',',')+' ₼';
const attempts=[1000,2000,3000,5000,8000,13000,20000,30000];
const mounted=new WeakMap();
export function showEpointReturn(doc=document){
 const main=doc.querySelector('[data-epoint-return]');if(!main)return;
 if(mounted.has(main))return mounted.get(main);
 const task=mount(main,doc);mounted.set(main,task);return task;
}
async function mount(main,doc){
 const find=s=>main.querySelector(s),title=find('h1'),message=find('[data-epoint-message]'),check=find('[data-epoint-check]'),login=find('[data-epoint-login]'),back=find('[data-epoint-back]'),orders=find('[data-epoint-orders]'),history=find('[data-epoint-history]'),products=find('[data-epoint-products]'),reference=find('[data-epoint-reference]'),balance=find('[data-epoint-balance]'),choices=find('[data-epoint-choices]');
 let ref=null,stopped=false,running=false,paused=false,timer=null,count=0,controller=null;
 const codes=find('[data-epoint-codes]');
 const finish=(heading,copy,state='reviewing')=>{title.textContent=heading;message.textContent=copy;main.dataset.result=state;doc.title=heading+' — MirPanel';const path=state==='paid'?'m8 12 3 3 5-6':state==='rejected'?'m9 9 6 6m0-6-6 6':'M12 7v5l3 2';find('[data-epoint-badge] path').setAttribute('d',path);};
 const get=async path=>{controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);try{const r=await fetch('/api/payments/epoint/'+path,{credentials:'same-origin',cache:'no-store',signal:controller.signal});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error('Ödəniş vəziyyəti alınmadı.'),{status:r.status});return d;}finally{clearTimeout(timeout);}};
 const read=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}};
 function setRef(value){ref=value;const url=new URL(location.href);url.searchParams.set('ref',ref);window.history.replaceState(window.history.state,'',url.pathname+url.search);reference.hidden=false;reference.textContent='Əməliyyat istinadı: '+ref;login.href='/hesab?next='+encodeURIComponent('/odenis/epoint/ugurlu?ref='+ref);}
 function localRef(){
  const recent=read(sessionStorage,'mirpanel.epoint.return.v1');if(uuid(recent?.ref)&&Date.now()-recent.at<86400000)return recent.ref;
  const candidates=[...['mirpanel.cart.checkout.v1','mirpanel.cart.token-checkout.v1'].map(k=>read(localStorage,k)?.id),...['mirpanel.epoint.wallet.v1.apple','mirpanel.epoint.wallet.v1'].map(k=>read(sessionStorage,k)?.ref)].filter(uuid);
  const refs=[...new Set(candidates)];return refs.length===1?refs[0]:null;
 }
 async function resolve(){
  const supplied=new URLSearchParams(location.search).get('ref');
  if(supplied!==null){if(!uuid(supplied))throw Object.assign(Error(),{status:400});setRef(supplied);return true;}
  const saved=localRef();if(saved){setRef(saved);return true;}
  const d=await get('return');if(paused)return false;
  const rows=(d.candidates||[]).filter(r=>uuid(r.ref));
  if(rows.length===1){setRef(rows[0].ref);return true;}
  finish(rows.length?'Ödəniş əməliyyatını seçin':'Ödəniş istinadı tapılmadı',rows.length?'Bir neçə əməliyyat var. Yoxlamaq istədiyiniz əməliyyatı seçin.':'Ödənişi başladığınız hesabla daxil olun və tarixçəni yoxlayın. Yenidən ödəniş etməyin.');history.hidden=false;
  for(const row of rows){const b=doc.createElement('button');b.type='button';const date=new Intl.DateTimeFormat('az-AZ',{timeZone:'Asia/Baku',dateStyle:'short',timeStyle:'short'}).format(new Date(row.createdAt));b.textContent=(row.purpose==='purchase'?'Sifariş':'Balans artırma')+' · '+money(row.cents)+' · '+date;b.onclick=()=>{choices.replaceChildren();setRef(row.ref);void refresh();};choices.append(b);}
  return false;
 }
 function schedule(){if(stopped||paused||doc.hidden)return;if(count<attempts.length)timer=setTimeout(()=>void refresh(),attempts[count++]);else if(main.dataset.result==='paid')timer=setTimeout(()=>void refresh(),60000);else{message.textContent='Yoxlama uzanır. Yenidən ödəniş etməyin. Nəticəni uyğun tarixçədə izləyin; serverdə bərpa yoxlaması davam edir.';history.hidden=!orders.hidden;}}
 function error(e){
  // A delivery refresh failure does not undo an already confirmed payment.
  if(main.dataset.result==='paid'&&![400,401,404].includes(e.status)){schedule();return;}
  if(e.status===401){login.hidden=false;login.href='/hesab?next='+encodeURIComponent(location.pathname+location.search);finish('Ödəniş vəziyyətini yoxlayın','Nəticəni görmək üçün ödənişi başladığınız hesabla daxil olun.');}
  else if(e.status===404||e.status===400){finish('Ödəniş tapılmadı','Əməliyyat istinadını və ödənişi başladığınız hesabı yoxlayın. Yenidən ödəniş etməyin.');history.hidden=false;}
  else{finish('Ödənişin nəticəsi yoxlanılır…','Bağlantı müvəqqəti alınmadı. Mövcud əməliyyat yenidən yoxlanılacaq; yenidən ödəniş etməyin.');schedule();}
 }
 async function refresh(){
  if(stopped||paused||running)return;clearTimeout(timer);running=true;check.disabled=true;login.hidden=true;
  try{
   if(!ref&&!await resolve())return;
   const d=await get('status?ref='+encodeURIComponent(ref));if(paused)return;
   if(d.status!=='success'){stopped=true;location.replace(paymentSelectionURL(ref,d.purpose));return;}
   const purchase=d.purpose==='purchase',orderURL='/profil?tab=sifarislerim'+(d.orderCode?'&order='+encodeURIComponent(d.orderCode):'');
   main.classList.toggle('product-payment-result',purchase);
   orders.hidden=!purchase;orders.href=orderURL;history.hidden=purchase;back.hidden=purchase;products.hidden=false;
   if(purchase){history.hidden=true;reference.textContent=(d.orderCode?'Sifariş № '+d.orderCode+' · ':'Əməliyyat: '+ref+' · ')+(Number.isSafeInteger(d.cents)?money(d.cents):'');}
   if(d.status==='success'&&Number.isSafeInteger(d.cents)&&d.cents>0&&(!purchase||uuid(d.orderId)&&d.orderCode)){
    if(!purchase&&!Number.isSafeInteger(d.balanceCents))throw Error('Committed balance missing');
    stopped=!purchase||d.deliveryStatus==='completed';check.hidden=true;check.remove();
    if(codes){codes.hidden=!purchase||!stopped;codes.href='/profil?tab=kodlarim&order='+encodeURIComponent(d.orderCode||'');}
    finish(purchase?'Ödənişiniz uğurla tamamlandı!':'Balansınız uğurla artırıldı',purchase?(d.deliveryStatus==='completed'?'Hesab məlumatlarınız hazırdır — Kodlarım bölməsində görə bilərsiniz.':'Sifarişiniz qəbul edildi. Təhvil vəziyyətini Sifarişlərim bölməsində izləyə bilərsiniz.'):money(d.cents)+' balansınıza əlavə edildi.','paid');
    if(purchase&&!stopped)schedule();
    if(!purchase){balance.textContent='Cari balans: '+money(d.balanceCents);balance.hidden=false;reference.textContent='Əlavə olunan: '+money(d.cents);}
    try{sessionStorage.removeItem('mirpanel.epoint.return.v1');for(const key of ['mirpanel.epoint.wallet.v1','mirpanel.epoint.wallet.v1.apple'])if(read(sessionStorage,key)?.ref===ref)sessionStorage.removeItem(key);}catch{}
    window.dispatchEvent(new Event('mirpanel:balance-refresh'));void window.refreshCommunityNav?.();
    try{const key='mirpanel.epoint.wallet.v1.selection',choice=read(sessionStorage,key);if(choice?.attempts){for(const [k,v]of Object.entries(choice.attempts))if(v.ref===ref)delete choice.attempts[k];sessionStorage.setItem(key,JSON.stringify(choice));}}catch{}
   }else if(d.status==='failed'){
    stopped=true;check.hidden=true;
    finish((d.openingExpired||d.openingFailed)?'Ödəniş səhifəsi açıla bilmədi':d.cancelled?'Ödəniş ləğv edildi':d.providerStatus==='returned'?'Ödəniş geri qaytarıldı':'Ödəniş tamamlanmadı',purchase?'Sifariş üçün uğurlu ödəniş təsdiqlənməyib. Vəsait çıxılıbsa dəstəyə müraciət edin.':'Bu əməliyyat üzrə balans artırılmadı. Vəsait çıxılıbsa dəstəyə müraciət edin.','rejected');
    if(purchase&&(d.cancelled||d.openingExpired)){
     try{const key='mirpanel.cart.checkout.v1';if(read(localStorage,key)?.id===ref)localStorage.removeItem(key);}catch{}
     back.hidden=false;back.href='/odenis';back.textContent='Başqa üsulla ödə';
    }
   }else{if(purchase&&d.providerStatus==='new'){finish('Ödəniş tamamlanmayıb','Mövcud əməliyyatla davam etmək üçün sifarişə qayıdın. Bu əməliyyat balans artırması deyil.');back.href='/odenis?completed='+encodeURIComponent(d.checkoutId);back.textContent='Ödənişə davam et';back.hidden=false;schedule();return;}finish('Ödənişin nəticəsi yoxlanılır…',d.openingIssue?d.openingMessage:'Mövcud əməliyyat serverdə yoxlanılır. Yenidən ödəniş etməyin.');schedule();}
  }catch(e){if(!paused)error(e);}finally{running=false;check.disabled=false;}
 }
 check.hidden=false;check.addEventListener('click',()=>{count=0;choices.replaceChildren();void refresh();});
 window.addEventListener('pagehide',()=>{paused=true;clearTimeout(timer);controller?.abort();});
 window.addEventListener('pageshow',e=>{if(e.persisted&&!stopped){paused=false;count=0;void refresh();}});
 window.addEventListener('focus',()=>{if(!stopped&&!doc.hidden){count=0;void refresh();}});doc.addEventListener('visibilitychange',()=>{if(!doc.hidden&&!stopped){paused=false;count=0;void refresh();}});
 await refresh();
}
if(typeof document!=='undefined'&&document.querySelector('[data-epoint-return]'))void showEpointReturn();
