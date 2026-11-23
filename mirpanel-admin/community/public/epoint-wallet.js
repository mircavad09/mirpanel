const base='/api/payments/epoint/';
const storeKey='mirpanel.epoint.wallet.v1';
const refPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const validRef=value=>typeof value==='string'&&refPattern.test(value);
function readDraft(){
 try{const d=JSON.parse(sessionStorage.getItem(storeKey));return validRef(d?.ref)?d:null;}catch{return null;}
}
function clearDraft(ref){try{if(readDraft()?.ref===ref)sessionStorage.removeItem(storeKey);}catch{}}
const resultPath=ref=>'/odenis/epoint/ugurlu?ref='+encodeURIComponent(ref);
const money=c=>new Intl.NumberFormat('az-AZ',{style:'currency',currency:'AZN'}).format(c/100);
const walletNames={'apple-pay':'Apple Pay','google-pay':'Google Pay',m10:'m10',birbank:'Birbank'};
export async function walletDeviceSupports(method,device=globalThis){
 try{
  if(method==='m10'||method==='birbank')return true;
  if(method==='apple-pay')return device.ApplePaySession?.canMakePayments()===true;
  if(method!=='google-pay'||!device.PaymentRequest)return false;
  // Epoint accepts device tokens only. Google documents CRYPTOGRAM_3DS as
  // Android-only; desktop canMakePayment() may still return a false positive.
  if(!/Android/i.test(device.navigator?.userAgent||'')&&device.navigator?.userAgentData?.platform!=='Android')return false;
  // Capability probe only; the Epoint iframe owns the payment sheet.
  const request=new device.PaymentRequest([{supportedMethods:'https://google.com/pay',data:{apiVersion:2,apiVersionMinor:0,
   allowedPaymentMethods:[{type:'CARD',parameters:{allowedAuthMethods:['CRYPTOGRAM_3DS'],allowedCardNetworks:['VISA','MASTERCARD']}}]}}],
   {total:{label:'MirPanel',amount:{currency:'AZN',value:'1.00'}}});
  // Match Epoint's widget: PAN_ONLY readiness must not advertise a token-only flow.
  // A stalled capability probe must not hide unrelated wallet/card methods.
  let timer;
  try{return await Promise.race([request.canMakePayment(),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),2500);})])===true;}
  finally{clearTimeout(timer);}
 }catch{return false;}
}
async function api(route,options={}){
 const r=await fetch(base+route,{cache:'no-store',credentials:'same-origin',...options});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(data.error||'Epoint xidməti cavab vermədi.'),{status:r.status});
 return data;
}
export async function mountEpointWallet({form,accountId,getCents,signal,back,el,button,link,walletOnly=false,walletTile,showDigital,amountHint,preview=false,fixedRequestId}){
 const draftKey=preview?storeKey+'.preview':storeKey;
 const readDraft=()=>{try{const d=JSON.parse(sessionStorage.getItem(draftKey));return validRef(d?.ref)?d:null;}catch{return null;}};
 const clearDraft=ref=>{try{if(readDraft()?.ref===ref)sessionStorage.removeItem(draftKey);}catch{}};
 const request=(route,options)=>api(route+(preview?(route.includes('?')?'&':'?')+'preview=google':''),options);
 if(!accountId||signal.aborted)return;
 const block=el('div',null,'shop-actions'),notice=el('p',null,'shop-muted');
 notice.hidden=true;
 notice.setAttribute('role','status');
 const active=()=>{const d=readDraft();return d?.accountId===accountId?d:null;};
 const statusLink=()=>{const d=active();return d?link('Epoint ödənişinin vəziyyəti',resultPath(d.ref)):null;};
 let checking=statusLink();
 let config;
 try{config=await request('status',{signal});}catch{}
 const capabilities=await Promise.all(Object.keys(walletNames).filter(m=>config?.methods?.[m]===true).map(async method=>({method,supported:preview&&method==='google-pay'||await walletDeviceSupports(method)})));
 const methods=capabilities.filter(x=>x.supported).map(x=>x.method),unsupported=capabilities.filter(x=>!x.supported).map(x=>x.method);
 const deviceHint=unsupported.map(m=>m==='apple-pay'?'Apple Pay üçün Apple Pay aktiv olan uyğun Apple cihazı və brauzer lazımdır.':'Google Pay üçün Google Cüzdanı aktiv olan uyğun Android cihazı və brauzer lazımdır.').join(' ');
 if(!walletOnly&&config?.enabled===true)methods.push('card');
 if(signal.aborted)return;
 if(!methods.length&&!checking){
  if(!config||config.walletError){
   notice.hidden=false;notice.textContent='Epoint ödəniş üsulları hazırda alınmır. ';
   const retry=button('Yenidən cəhd et',()=>{retry.disabled=true;block.remove();notice.remove();void mountEpointWallet({form,accountId,getCents,signal,back,el,button,link,walletOnly,walletTile,showDigital,amountHint,preview,fixedRequestId});});
   block.append(retry);form.append(notice,block);
  }
  else if(deviceHint){notice.hidden=false;notice.textContent=deviceHint+' Digər ödəniş üsulunu seçə bilərsiniz.';form.append(notice);}
  return;
 }
 if(checking)block.append(checking);
 if(methods.length&&Number.isSafeInteger(amountHint))form.append(el('p','Balansa əlavə ediləcək: '+money(amountHint)+' · Sifarişi ayrıca təsdiqləyəcəksiniz.','shop-muted'));
 form.append(block,notice);
 if(deviceHint){notice.hidden=false;notice.textContent=deviceHint+' Digər ödəniş üsulunu seçə bilərsiniz.';}
 const buttons=new Map();let busy=false,frame=null,timer=null,polls=0,polling=false,close=null,hintAt=0;
 const stopWidget=()=>{clearTimeout(timer);if(frame)showDigital?.(false);frame?.remove();frame=null;close?.remove();close=null;};
 signal.addEventListener('abort',stopWidget,{once:true});
 const say=copy=>{notice.hidden=false;notice.textContent=copy;};
 async function poll(){
  if(signal.aborted||!frame||polling)return;
  clearTimeout(timer);polling=true;const current=frame,d=active();
  if(!d){polling=false;stopWidget();return;}
  try{
   const data=await request('status?ref='+encodeURIComponent(d.ref),{signal:AbortSignal.timeout(8000)});
   if(frame!==current||signal.aborted)return;
   if(data.status==='success'||data.status==='failed'){stopWidget();location.assign(resultPath(d.ref));return;}
  }catch{}finally{polling=false;}
  if(frame!==current||signal.aborted)return;
  if(++polls<60)timer=setTimeout(poll,4000);
  else say('Ödəniş hələ təsdiqlənməyib. Vəziyyəti ayrıca yoxlaya bilərsiniz.');
 }
 function openWidget(value,method){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.port||url.username||url.password||!(url.hostname==='epoint.az'||url.hostname.endsWith('.epoint.az')))throw Error('Vidcet ünvanı düzgün deyil.');
  stopWidget();polls=0;hintAt=0;
  frame=el('iframe',null,'shop-epoint-widget');frame.title=walletNames[method]+' — Epoint təhlükəsiz ödəniş';frame.src=url.href;
  frame.allow='payment '+url.origin;frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.style.cssText='display:block;width:100%;max-width:100%;height:400px;border:0';
  close=button('Ödəniş pəncərəsini bağla',()=>{stopWidget();say('Ödənişin vəziyyətini yoxlaya və ya eyni ödənişə davam edə bilərsiniz.');setLabels();});
  showDigital?.(true);form.append(frame,close);
  say('Epoint ödəniş pəncərəsi açılır…');
  const openedFrame=frame;
  frame.addEventListener('load',()=>{if(frame===openedFrame&&frame.isConnected)say('Seçilmiş üsul: '+walletNames[method]+'. Epoint pəncərəsində bu üsulla davam edin. Düymə görünmürsə, pəncərəni bağlayın və cihazınızdakı cüzdanı yoxlayın. Başqa üsula avtomatik keçilmir. Balans yalnız server təsdiqindən sonra artırılır.');},{once:true});
  frame.scrollIntoView({block:'nearest'});void poll();
 }
 window.addEventListener('message',event=>{
  if(!frame||event.source!==frame.contentWindow||event.origin!==new URL(frame.src).origin||!['success','failed','error'].includes(event.data?.status))return;
  // No transaction, status or amount from the browser is trusted for settlement.
  if(Date.now()-hintAt<3000)return;
  hintAt=Date.now();say('Ödəniş yoxlanılır…');void poll();
 },{signal});
 async function start(method){
  if(busy||frame||signal.aborted||!form.isConnected)return;
  let d=active(),cents;
  const prior=d?.method??'card';
  if(d&&prior!==method)return;
  try{cents=d?.cents??getCents();}catch(e){say(e.message);return;}
  busy=true;setLabels();say('Epoint ödəniş səhifəsi hazırlanır…');
  try{
   if(!d){d={ref:preview?fixedRequestId:crypto.randomUUID(),accountId,cents,method,back:['/qrup','/odenis?mode=wallet','/odenis?mode=wallet&token=1'].includes(back)?back:null};sessionStorage.setItem(draftKey,JSON.stringify(d));}
   const response=await request('start',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:d.ref,amount:(cents/100).toFixed(2),...(method==='card'?{}:{method})})});
   if(signal.aborted)return;
   if(response.state==='ready'&&['apple-pay','google-pay'].includes(method)){openWidget(response.widget,method);return;}
   if(response.state==='ready'){location.assign(response.redirect);return;}
   if(response.state==='credited'){location.assign(resultPath(d.ref));return;}
   if(response.state==='declined'){clearDraft(d.ref);notice.textContent='Epoint ödənişi başlatmadı. Məbləği yoxlayıb yenidən cəhd edə bilərsiniz.';return;}
   notice.textContent='Ödəniş başlatma nəticəsi gözlənilir. Vəziyyəti yoxlayın.';
  }catch(e){
   if(!signal.aborted){
    if([400,415].includes(e.status)&&d)clearDraft(d.ref);
    notice.textContent=e.status?e.message:'Epoint ilə əlaqə alınmadı. Eyni ödənişin vəziyyətini yoxlayın.';
   }
  }finally{
   busy=false;
   if(!signal.aborted){checking?.remove();checking=statusLink();if(checking)block.append(checking);setLabels();}
  }
 }
 function setLabels(){
  const d=active();
  for(const [method,{tile,label}] of buttons){
   const name=walletNames[method];
   tile.disabled=busy||!!frame||!!d&&(d.method??'card')!==method;
   label.textContent=d&&(d.method??'card')===method?(name?name+' · ':'Epoint ödənişinə ')+'davam et · '+money(d.cents):name?name+(walletOnly?' ilə balansı artır':walletTile?'':' ilə ödə'):'Epoint ilə ödə';
  }
 }
 for(const method of methods){
  if(walletTile&&method!=='card')buttons.set(method,walletTile(method,()=>void start(method)));
  else{const b=button('',()=>void start(method),true);buttons.set(method,{tile:b,label:b});block.append(b);}
 }
 setLabels();
}

export async function showEpointReturn(doc=document){
 const main=doc.querySelector('[data-epoint-return]');
 if(!main)return;
 const title=main.querySelector('h1'),message=main.querySelector('[data-epoint-message]'),check=main.querySelector('[data-epoint-check]'),login=main.querySelector('[data-epoint-login]');
 const supplied=new URLSearchParams(location.search).get('ref'),draft=readDraft(),ref=supplied===null?draft?.ref:supplied;
 if(!validRef(ref))return;
 const back=main.querySelector('[data-epoint-back]');
 if(draft?.ref===ref&&['/qrup','/odenis?mode=wallet','/odenis?mode=wallet&token=1'].includes(draft.back)){back.href=draft.back;back.textContent=draft.back==='/qrup'?'Hədiyyəyə qayıt':'Alışa qayıt';}
 login.href='/hesab?next='+encodeURIComponent(resultPath(ref));
 const finish=(heading,copy)=>{title.textContent=heading;message.textContent=copy;doc.title=heading+' — MirPanel';};
 let stopped=false,running=false,timer=null,count=0;
 async function refresh(){
  if(stopped||running)return;
  clearTimeout(timer);running=true;check.disabled=true;login.hidden=true;
  try{
   const data=await api('status?ref='+encodeURIComponent(ref),{signal:AbortSignal.timeout(8000)});
   if(data.status==='success'&&Number.isSafeInteger(data.cents)&&data.cents>0){
    clearDraft(ref);stopped=true;check.hidden=true;
    finish('Balansınız uğurla artırıldı',money(data.cents)+' balansınıza əlavə edildi.');
    const balance=main.querySelector('[data-epoint-balance]'),products=main.querySelector('[data-epoint-products]');
    if(balance&&Number.isSafeInteger(data.balanceCents)){balance.textContent='Yeni balans: '+money(data.balanceCents);balance.hidden=false;}
    if(products)products.hidden=false;
   }else if(data.status==='failed'){
    clearDraft(ref);stopped=true;check.hidden=true;
    finish(data.cancelled===true?'Ödəniş ləğv edildi':data.providerStatus==='returned'?'Ödəniş geri qaytarıldı':'Ödəniş tamamlanmadı','Bu əməliyyat üzrə balans artırılmadı. Vəsait çıxılıbsa, yenidən ödəməzdən əvvəl dəstəyə müraciət edin.');
   }else{
    finish('Ödəniş yoxlanılır…','Ödəniş hələ balansınıza əlavə edilməyib. Vəziyyəti yenidən yoxlaya bilərsiniz.');
    if(++count<45)timer=setTimeout(refresh,4000);
   }
  }catch(e){
   if(e.status===401){login.hidden=false;finish('Ödəniş vəziyyətini yoxlayın','Nəticəni görmək üçün ödənişi başladığınız hesabla daxil olun.');}
   else if(e.status===404)finish('Ödəniş tapılmadı','Ödənişi başladığınız hesabla daxil olduğunuzu yoxlayın.');
   else finish('Ödəniş vəziyyəti alınmadı','Vəziyyəti yenidən yoxlayın. Təkrar ödəniş etməyə tələsməyin.');
  }finally{running=false;check.disabled=false;}
 }
 check.hidden=false;check.addEventListener('click',()=>{count=0;void refresh();});
 window.addEventListener('pagehide',()=>clearTimeout(timer),{once:true});
 await refresh();
}
if(typeof document!=='undefined'&&document.querySelector('[data-epoint-return]'))void showEpointReturn();
