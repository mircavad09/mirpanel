const base='/api/payments/epoint/';
const storeKey='mirpanel.epoint.wallet.v1';
const appleStoreKey=storeKey+'.apple';
const refPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const validRef=value=>typeof value==='string'&&refPattern.test(value);
function readDraft(){
 try{const d=JSON.parse(sessionStorage.getItem(storeKey));return validRef(d?.ref)?d:null;}catch{return null;}
}
function appleDraft(){try{const d=JSON.parse(sessionStorage.getItem(appleStoreKey));return validRef(d?.ref)?d:null;}catch{return null;}}
function clearDraft(ref){try{if(readDraft()?.ref===ref)sessionStorage.removeItem(storeKey);if(appleDraft()?.ref===ref)sessionStorage.removeItem(appleStoreKey);const key=storeKey+'.selection',choice=JSON.parse(sessionStorage.getItem(key)||'null');if(choice?.attempts){for(const [k,d] of Object.entries(choice.attempts))if(d?.ref===ref)delete choice.attempts[k];sessionStorage.setItem(key,JSON.stringify(choice));}}catch{}}
const resultPath=ref=>'/odenis/epoint/ugurlu?ref='+encodeURIComponent(ref);
const money=c=>new Intl.NumberFormat('az-AZ',{style:'currency',currency:'AZN'}).format(c/100);
export const appleMoney=c=>(c/100).toFixed(2).replace('.',',')+' ₼';
const walletNames={'apple-pay':'Apple Pay','google-pay':'Google Pay',m10:'m10',birbank:'Birbank'};
export async function walletDeviceSupports(method,device=globalThis){
 try{
  if(method==='card')return true;
  if(method==='m10'||method==='birbank')return true;
  if(/WhatsApp|FBAN|FBAV|Instagram|\bwv\b/i.test(device.navigator?.userAgent||''))return false;
  // Owner policy is iPhone-only, AND Apple capability must be available.
  // The Epoint widget still performs the final active-Wallet check.
  if(method==='apple-pay')return /\biPhone\b/i.test(device.navigator?.userAgent||'')&&device.ApplePaySession?.canMakePayments()===true;
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
export async function mountEpointWallet(options){
 // Public balance cards are selectors only. Keep the existing owner-only
 // diagnostic preview and non-card checkout controls on their legacy path.
 if(options.walletTile&&!options.preview){const m=await import('./wallet-selection.js?v=googlepay-attempt-2');return m.mountWalletSelection({...options,request:api,deviceSupports:walletDeviceSupports});}
 return mountLegacyEpoint(options);
}
async function mountLegacyEpoint({form,accountId,getCents,signal,back,el,button,link,walletOnly=false,walletTile,showDigital,amountHint,preview=false,fixedRequestId,appleFlow}){
 const draftKey=preview?storeKey+'.preview':storeKey;
 const readDraft=()=>{try{const d=JSON.parse(sessionStorage.getItem(draftKey));return validRef(d?.ref)?d:null;}catch{return null;}};
 const clearDraft=ref=>{try{if(readDraft()?.ref===ref)sessionStorage.removeItem(draftKey);}catch{}};
 const request=(route,options)=>api(route+(preview?(route.includes('?')?'&':'?')+'preview=google':''),options);
 if(!accountId||signal.aborted)return;
 // Keep pending Apple payments independent from the other existing methods.
 const legacy=readDraft();if(!preview&&legacy?.accountId===accountId&&legacy.method==='apple-pay'){sessionStorage.setItem(appleStoreKey,JSON.stringify(legacy));sessionStorage.removeItem(draftKey);}
 const activeApple=()=>{const d=appleDraft();return d?.accountId===accountId?d:null;};
 const block=el('div',null,'shop-actions'),notice=el('p',null,'shop-muted');
 notice.hidden=true;
 notice.setAttribute('role','status');
 const active=()=>{const d=readDraft();return d?.accountId===accountId?d:null;};
 const statusLink=()=>{const d=active()||activeApple();return d?link('Epoint ödənişinin vəziyyəti',resultPath(d.ref)):null;};
 let checking=statusLink();
 let config;
 try{config=await request('status',{signal});}catch{}
 const capabilities=await Promise.all(Object.keys(walletNames).filter(m=>config?.methods?.[m]===true).map(async method=>({method,supported:preview&&method==='google-pay'||await walletDeviceSupports(method)})));
 const methods=capabilities.filter(x=>x.supported).map(x=>x.method),unsupported=capabilities.filter(x=>!x.supported).map(x=>x.method);
 const deviceHint=unsupported.map(m=>m==='apple-pay'?'Apple Pay yalnız dəstəklənən iPhone-da istifadə olunur.':'Google Pay üçün Google Cüzdanı aktiv olan uyğun Android cihazı və brauzer lazımdır.').join(' ');
 if(!walletOnly&&config?.enabled===true)methods.push('card');
 if(signal.aborted)return;
 if(!methods.length&&!checking){
  if(!config||config.walletError){
   notice.hidden=false;notice.textContent='Epoint ödəniş üsulları hazırda alınmır. ';
   const retry=button('Yenidən cəhd et',()=>{retry.disabled=true;block.remove();notice.remove();void mountEpointWallet({form,accountId,getCents,signal,back,el,button,link,walletOnly,walletTile,showDigital,amountHint,preview,fixedRequestId,appleFlow});});
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
 let appleSelected=false,appleVisited=false,appleActions=null,appleSubmit=null,appleDialog=null;
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
  let d=method==='apple-pay'?activeApple():active(),cents;
  const prior=d?.method??'card';
  if(d&&prior!==method)return;
  try{cents=d?.cents??getCents();}catch(e){say(e.message);return;}
  busy=true;setLabels();say('Epoint ödəniş səhifəsi hazırlanır…');
  try{
   if(!d){d={ref:preview?fixedRequestId:crypto.randomUUID(),accountId,cents,method,back:['/qrup','/odenis?mode=wallet','/odenis?mode=wallet&token=1'].includes(back)?back:null};sessionStorage.setItem(method==='apple-pay'?appleStoreKey:draftKey,JSON.stringify(d));}
   const response=await request('start',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:d.ref,amount:(cents/100).toFixed(2),...(method==='card'?{}:{method})})});
   if(signal.aborted)return;
   if(response.state==='ready'&&method==='apple-pay'){location.assign('/odenis/epoint/apple-pay?ref='+encodeURIComponent(d.ref));return;}
   if(response.state==='ready'&&method==='google-pay'){openWidget(response.widget,method);return;}
   if(response.state==='ready'){location.assign(response.redirect);return;}
   if(response.state==='credited'){location.assign(resultPath(d.ref));return;}
   if(response.state==='declined'){if(method==='apple-pay')sessionStorage.removeItem(appleStoreKey);else clearDraft(d.ref);notice.textContent='Epoint ödənişi başlatmadı. Məbləği yoxlayıb yenidən cəhd edə bilərsiniz.';return;}
   notice.textContent='Ödəniş başlatma nəticəsi gözlənilir. Vəziyyəti yoxlayın.';
  }catch(e){
   if(!signal.aborted){
    if([400,415].includes(e.status)&&d){if(method==='apple-pay')sessionStorage.removeItem(appleStoreKey);else clearDraft(d.ref);}
    notice.textContent=e.status?e.message:'Epoint ilə əlaqə alınmadı. Eyni ödənişin vəziyyətini yoxlayın.';
   }
  }finally{
   busy=false;
   if(!signal.aborted){checking?.remove();checking=statusLink();if(checking)block.append(checking);setLabels();}
  }
 }
 function setLabels(){
  for(const [method,{tile,label}] of buttons){
   const d=method==='apple-pay'?activeApple():active();
   const name=walletNames[method];
   tile.disabled=busy||!!frame||!!d&&(d.method??'card')!==method;
   label.textContent=method==='apple-pay'?'Apple Pay':d&&(d.method??'card')===method?(name?name+' · ':'Epoint ödənişinə ')+'davam et · '+money(d.cents):name?name+(walletOnly?' ilə balansı artır':walletTile?'':' ilə ödə'):'Epoint ilə ödə';
  }
  refreshApple();
 }
 function appleCents(){const cents=activeApple()?.cents??getCents(),limits=config?.limits;if(!Number.isSafeInteger(cents)||!Number.isSafeInteger(limits?.minCents)||!Number.isSafeInteger(limits?.maxCents)||cents<limits.minCents||cents>limits.maxCents)throw Error('Etibarlı məbləğ seçin.');return cents;}
 function refreshApple(){if(!appleSubmit)return;let cents;try{cents=appleCents();}catch{}appleSubmit.textContent=cents===undefined?'Balansa əlavə et':'Balansa '+appleMoney(cents)+' əlavə et';appleSubmit.disabled=!appleSelected||busy||cents===undefined;appleFlow?.lockAmount?.(appleSelected&&!!activeApple());}
 function selectApple(){appleSelected=true;appleFlow?.select?.();if(activeApple())appleFlow?.restoreCents?.(activeApple().cents);else if(!appleVisited)appleFlow?.resetAmount?.();appleVisited=true;appleActions.hidden=false;refreshApple();}
 function confirmApple(){
  let cents;try{cents=appleCents();}catch{return;}if(busy||appleDialog?.open)return;
  const dialog=el('dialog',null,'apple-topup-confirm'),title=el('h2','Balans artımını təsdiqləyin'),copy=el('p','Balansınıza '+appleMoney(cents)+' əlavə etmək istəyirsiniz?'),method=el('p','Ödəniş üsulu: Apple Pay'),actions=el('div',null,'shop-actions');
  title.id='appleTopupConfirmTitle';dialog.setAttribute('aria-labelledby',title.id);
  const backButton=button('Geri',()=>dialog.close()),confirm=button('Təsdiq et',()=>{if(busy||confirm.disabled)return;let current;try{current=appleCents();}catch{}if(current!==cents){dialog.close();say('Məbləğ dəyişib. Yenidən təsdiqləyin.');return;}confirm.disabled=true;dialog.close();void start('apple-pay');},true);
  actions.append(backButton,confirm);dialog.append(title,copy,method,el('p','Bu təsdiq ödəniş və ya balans artımı deyil. Son təsdiq Apple Pay-də verilir.','shop-muted'),actions);document.body.append(dialog);appleDialog=dialog;
  dialog.addEventListener('close',()=>{dialog.remove();appleDialog=null;appleSubmit?.focus();},{once:true});dialog.showModal();
 }
 for(const method of methods){
  const handler=method==='apple-pay'?selectApple:()=>void start(method);
  if(walletTile&&method!=='card')buttons.set(method,walletTile(method,handler));
  else{const b=button('',handler,true);buttons.set(method,{tile:b,label:b});block.append(b);}
 }
 if(methods.includes('apple-pay')){
  appleActions=el('div',null,'apple-topup-actions');appleActions.hidden=true;appleSubmit=button('Balansa əlavə et',confirmApple,true);appleActions.append(appleSubmit);(appleFlow?.amountElement||form).append(appleActions);
  if(appleFlow){appleFlow.amountElement.before(appleFlow.methodElement);appleFlow.amountElement.addEventListener('wallet-amount-change',refreshApple,{signal});appleFlow.methodElement.addEventListener('wallet-method-change',e=>{appleSelected=e.detail?.method==='apple-pay';appleActions.hidden=!appleSelected;refreshApple();},{signal});}
  signal.addEventListener('abort',()=>{appleDialog?.remove();appleActions.remove();},{once:true});
  if(activeApple())selectApple();
 }
 setLabels();
}

export {showEpointReturn} from './epoint-return.js?v=payment-resume-20261124';
if(typeof document!=='undefined'&&document.querySelector('[data-epoint-return]'))void import('./epoint-return.js?v=payment-resume-20261124').then(m=>m.showEpointReturn());
