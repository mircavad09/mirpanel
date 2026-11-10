import {topupAmountText} from '/community-assets/topup-amount.js?v=topup-20261104';
export const topupReviewTime='5–10 dəqiqə';
const name=m=>m.providerName||m.provider||String(m.displayName||'Bank kartı').replace(/\s+[•*].*$/,'').trim();
const last4=m=>String(m.last4||m.maskedNumber||'').replace(/\D/g,'').slice(-4);
const bank=m=>String(m.backgroundUrl||'').match(/^\/api\/payments\/bank-backgrounds\/(kapital|m10|abb|leo)\?/)?.[1]||(/m10/i.test(name(m))?'m10':['kapital','abb','leo'].includes(m.theme)?m.theme:'neutral');
const fallback=(el,m)=>el('strong',name(m),'wallet-bank-name');
const paymentMethods=[
 ['Kartdan karta','Kart nömrəsinə köçürmə','<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18m-14 5h4"/>'],
 ['Apple Pay','Apple Wallet','<path d="M15 4c.6-.8 1-1.8.9-2.8-1 .1-2 .7-2.6 1.4-.6.7-1 1.6-.9 2.5M19 9c-1.7.9-2.3 2.8-1.7 4.3.4 1.1 1.1 1.8 2.2 2.2-.5 1.7-2 4.5-3.8 4.5-1.2 0-2-.7-3.4-.7s-2.2.7-3.4.7C6.8 20 4 15.3 4 11.8c0-3 1.8-5 4.2-5 1.4 0 2.6.7 3.6.7 1.2 0 2.2-.7 3.6-.7 1.5 0 2.7.7 3.6 2.2Z"/>'],
 ['Google Pay','Google Wallet','<path d="M18.4 6A8 8 0 1 0 20 12h-8"/>'],
 ['M10','Elektron pulqabı','<path d="M6 8v8m0-8 4 5 4-5v8m4-6 2-2v8"/>'],
 ['Bank kartı','Kartla ödəniş','<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 11h4v3H7zm8 4h2"/>'],
 ['Hesaba köçürmə','IBAN','<path d="m3 8 9-5 9 5H3Zm1 12h16M7 11v6m5-6v6m5-6v6"/>']
];
function background(el,n,m){const u=String(m.backgroundUrl||'');if(!/^\/api\/payments\/bank-backgrounds\/(kapital|m10|abb|leo)\?v=[a-zA-Z0-9%_.:-]+$/.test(u))return;const img=el('img');img.src=u;img.alt='';img.className='wallet-bank-image';img.decoding='async';img.onload=()=>n.classList.add('has-bank-art');img.onerror=()=>{n.classList.remove('has-bank-art');img.remove();};n.prepend(img);}
export function drawBankChoices({el,button,grid,methods,selected='',onSelect}){
 grid.replaceChildren();
 for(const m of methods){
  const b=button('',()=>{for(const node of grid.children)node.setAttribute('aria-pressed',String(node===b));onSelect(m.id);});
  const digits=last4(m);b.className='wallet-bank-choice bank-'+bank(m);b.setAttribute('aria-label',name(m)+', son dörd rəqəm '+digits);b.setAttribute('aria-pressed',String(selected===m.id));b.append(fallback(el,m));
  background(el,b,m);const info=el('span',null,'wallet-bank-choice-info');info.append(el('span',m.type==='wallet'?'Elektron cüzdan':'Bank kartı'));if(digits)info.append(el('span','•••• '+digits));b.append(info,el('span','✓','wallet-bank-check'));grid.append(b);
 }
 if(!methods.length)grid.append(el('p','Hazırda aktiv ödəniş kartı yoxdur.','shop-muted'));
}
export function orderBankDetail({el,button,method,amount,onChange,onCopy}){
 const panel=el('article',null,'wallet-bank-detail bank-'+bank(method)),head=el('div',null,'wallet-bank-head'),change=button('Kartı dəyiş',onChange);
 head.append(fallback(el,method),change);panel.append(head);background(el,panel,method);
 const fields=el('div',null,'wallet-bank-fields'),holder=el('div'),total=el('div');holder.append(el('small','Sahib'),el('strong',method.holder||'Göstərilməyib'));total.append(el('small','Köçürüləcək məbləğ'),el('strong',amount));fields.append(holder,total);
 const number=el('div',null,'wallet-bank-number'),copy=button('Kopyala',()=>onCopy(method.number,copy));number.append(el('span',method.number),copy);panel.append(fields,number);
 return {panel,change};
}
export function createWalletTopup({el,button,api,run,money,methods,profile,getCents,onComplete,onBusy,restoreCents,signal,isClosed}){
 document.body.classList.remove('wallet-topup-active');signal.addEventListener('abort',()=>document.body.classList.remove('wallet-topup-active'),{once:true});
 const root=el('section',null,'shop-card wallet-topup'),title=el('h2','Ödəniş üsulu'),tiles=el('div',null,'wallet-method-tiles'),open=button('',()=>{selection.hidden=false;open.setAttribute('aria-expanded','true');document.body.classList.add('wallet-topup-active');}),selection=el('div',null,'wallet-bank-selection'),grid=el('div',null,'wallet-bank-grid'),stage=el('div'),notice=el('p','','shop-error');
 paymentMethods.forEach(([label,description,path],i)=>{
  const tile=i?button('',null):open,icon=el('span',null,'checkout-icon');
  icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
  tile.className='wallet-method-tile'+(i?'':' wallet-payment-method');
  tile.append(icon,el('strong',label),el('small',description));
  if(i){tile.disabled=true;tile.append(el('span','Tezliklə','wallet-method-badge'));}
  else{
   tile.setAttribute('aria-label',label);tile.setAttribute('aria-description',description);
   const check=el('span','✓','wallet-method-check');check.setAttribute('aria-hidden','true');tile.append(check);
  }
  tiles.append(tile);
 });
 let selected='',draft=null,preparing=false,uploading=false,sending=false,file=null,attempt=null,objectUrl=null,receiptReady=false,releasePhoto=()=>{}; let available=methods,loadingCards=false;
 const uid=profile?.user_id||profile?.id,key='mirpanel.topup.v2.'+uid;
 const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}},remember=v=>{try{localStorage.setItem(key,JSON.stringify(v));}catch{}},forget=()=>{try{localStorage.removeItem(key);}catch{}},alive=()=>!signal.aborted&&!isClosed();
 const proceed=button('Bu kartla davam et · —',()=>run(async()=>{notice.textContent='';const cents=getCents();if(!selected)throw Error('Ödəniş kartını seçin.');preparing=true;proceed.disabled=open.disabled=true;for(const b of grid.children)b.disabled=true;onBusy(true);try{const input=topupAmountText(cents)+':'+selected,old=read(),requestId=old?.input===input?old.requestId:crypto.randomUUID();remember({input,requestId,cents,methodId:selected});const d=await api('/topup',{amount:topupAmountText(cents),methodId:selected,requestId,allowFallback:true});remember({input,requestId,cents,methodId:selected,id:d.id});if(!alive())return;if(d.status!=='draft'){await completed(d);return;}if(draft?.id!==d.id){file=null;attempt=null;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=null;}draft=await api('/topup?id='+d.id);selected=draft.methodId;receiptReady=draft.receiptUploaded;await detail();}catch(e){if(e.code==='TOPUP_CARD_EXPIRED'){forget();draft=null;}if(['TOPUP_CARD_UNAVAILABLE','TOPUP_CARD_EXPIRED'].includes(e.code))void refreshCards();throw e;}finally{preparing=false;open.disabled=false;for(const b of grid.children)b.disabled=false;onBusy(false);updateAmount();}}),true);
 function updateAmount(){let cents;try{cents=getCents();}catch{}proceed.textContent='Bu kartla davam et · '+(cents===undefined?'—':money(cents));proceed.disabled=cents===undefined||!selected||loadingCards||preparing||uploading||sending;if(draft&&!stage.hidden&&stage.children.length&&cents!==draft.cents&&!preparing&&!uploading&&!sending){stage.hidden=true;selection.hidden=false;tiles.hidden=false;open.setAttribute('aria-expanded','true');}}
 async function refreshCards(){
  if(loadingCards)return;loadingCards=true;grid.setAttribute('aria-busy','true');const loading=el('p','Kartlar yoxlanılır…','shop-muted');loading.setAttribute('role','status');grid.replaceChildren(loading);proceed.disabled=true;
  try{const result=await api('/topup/methods');if(!alive())return;available=result.methods||[];if(!available.some(m=>m.id===selected))selected=available[0]?.id||'';drawCards();}
  catch(e){if(alive()){available=[];selected='';grid.replaceChildren(el('p',e.message,'shop-error'),button('Kartları yenidən yoxla',()=>void refreshCards()));}}
  finally{loadingCards=false;grid.removeAttribute('aria-busy');if(alive())updateAmount();}
 }
 function drawCards(){
  if(!available.length){grid.replaceChildren(el('p','Hazırda limiti boş olan aktiv ödəniş kartı yoxdur.','shop-muted'),button('Kartları yenidən yoxla',()=>void refreshCards()));return;}
  drawBankChoices({el,button,grid,methods:available,selected,onSelect:id=>{selected=id;updateAmount();}});
 }
 open.setAttribute('aria-expanded','true');open.setAttribute('aria-pressed','true');selection.hidden=false;selection.append(grid,proceed);root.append(title,tiles,selection,stage,notice);updateAmount();
 async function completed(d){const saved=await api('/topup?id='+encodeURIComponent(d.id));if(!saved.receiptUploaded)throw Error('Çekin saxlanması təsdiqlənmədi. Yenidən cəhd edin.');if(!['reviewing','approved'].includes(saved.status))throw Error('Bu müraciətin vəziyyəti dəyişib. Tarixçəni yoxlayın.');await onComplete(saved);forget();releasePhoto();file=null;attempt=null;document.body.classList.remove('wallet-topup-active');}
 async function detail(){const id=draft.id,cents=draft.cents,d=await api('/method?'+new URLSearchParams({id:draft.methodId,topup:id})),listed=available.find(x=>x.id===draft.methodId),m={...listed,...d,backgroundUrl:d.backgroundUrl||listed?.backgroundUrl};if(!alive())return;releasePhoto();document.body.classList.add('wallet-topup-active');selection.hidden=true;tiles.hidden=true;stage.replaceChildren();
  const panel=el('article',null,'wallet-bank-detail bank-'+bank(m)),head=el('div',null,'wallet-bank-head'),change=button('Kartı dəyiş',()=>{if(uploading||sending)return;stage.hidden=true;selection.hidden=false;tiles.hidden=false;open.setAttribute('aria-expanded','true');updateAmount();});head.append(fallback(el,m),change);panel.append(head);background(el,panel,m);
  const fields=el('div',null,'wallet-bank-fields'),holder=el('div'),total=el('div');holder.append(el('small','Sahib'),el('strong',d.holder||'Göstərilməyib'));total.append(el('small','Köçürüləcək məbləğ'),el('strong',money(cents)));fields.append(holder,total);panel.append(fields);
  const number=el('div',null,'wallet-bank-number'),copy=button('Kopyala',async()=>{try{await navigator.clipboard.writeText(d.number);copy.textContent='Kopyalandı';}catch{notice.textContent='Kopyalama alınmadı. Kart nömrəsini seçib kopyalayın.';}});number.append(el('span',d.number),copy);panel.append(number);
  const steps=el('section',null,'wallet-topup-steps'),list=el('ol');steps.append(el('h3','Addımlar'),list);for(const t of ['Yuxarıdakı kart nömrəsini kopyalayın.','Seçdiyiniz məbləği həmin karta köçürün.','“Qalereyadan çek seç” düyməsinə basın.','Ödəniş çekini seçib yükləyin, sonra “Balans əlavə et” düyməsinə basın.','Operator müraciətinizi yoxlayacaq. Təsdiq adətən '+topupReviewTime+' çəkir.'])list.append(el('li',t));
  const box=el('section',null,'wallet-receipt'),input=el('input'),pick=button('Qalereyadan çek seç',()=>input.click(),true),info=el('p','','shop-muted'),preview=el('div',null,'wallet-receipt-preview'),retry=button('Yenidən cəhd et',()=>void upload()),remove=button('Sil',()=>void clearReceipt()),replace=button('Dəyiş',()=>input.click()),controls=el('div',null,'wallet-receipt-actions');
  input.type='file';input.accept='image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf';input.hidden=true;input.setAttribute('aria-label','Çek faylı');retry.hidden=true;controls.append(replace,remove,retry);box.append(pick,input,el('p','JPG/JPEG, PNG və PDF · maksimum 5 MB','shop-muted'),preview,controls,info);info.setAttribute('role','status');notice.setAttribute('role','alert');
  const send=button('Balans əlavə et',()=>run(async()=>{if(!receiptReady||uploading||sending)return;sending=true;setBusy(true);try{let r;try{r=await api('/topup/submit',{id});}catch(e){try{const saved=await api('/topup?id='+id);if(['reviewing','approved'].includes(saved.status))r=saved;}catch{}if(!r)throw Error(e.message+' Eyni müraciəti yenidən göndərmək üçün “Balans əlavə et” düyməsinə basın.');}await completed(r);}finally{sending=false;setBusy(false);}}),true);send.disabled=!receiptReady;stage.hidden=false;stage.append(panel,steps,box,send,el('p','Balans yalnız operator təsdiqindən sonra artırılır. Göstərilən vaxt təxminidir.','shop-muted'));
  function revoke(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}}
  function show(){preview.replaceChildren();if(file){if(file.type.startsWith('image/')){revoke();objectUrl=URL.createObjectURL(file);const img=el('img');img.src=objectUrl;img.alt='Seçilmiş çekin önizləməsi';preview.append(img);}preview.append(el('span',file.name));}else if(receiptReady)preview.append(el('span','Əvvəl yüklənmiş çek'));controls.hidden=!file&&!receiptReady;info.textContent=receiptReady?'Çek uğurla yükləndi':'';send.disabled=!receiptReady;}
  function setBusy(b){uploading=b;onBusy(b);input.disabled=pick.disabled=replace.disabled=remove.disabled=retry.disabled=change.disabled=b;send.disabled=b||!receiptReady;updateAmount();}
  async function clearReceipt(){if(uploading||sending)return;setBusy(true);try{await api('/topup/receipt/remove',{id});receiptReady=false;file=null;attempt=null;input.value='';revoke();retry.hidden=true;show();}catch(e){info.textContent=e.message;}finally{setBusy(false);}}
  async function upload(){if(uploading||sending||!file)return;receiptReady=false;send.disabled=true;retry.hidden=true;if(file.size>5242880){info.textContent='Fayl maksimum 5 MB ola bilər.';return;}setBusy(true);info.textContent='Çek yüklənir…';try{const r=await api('/receipt?kind=topup&id='+id+'&attempt='+attempt,undefined,{file,timeout:105000});if(!r.receiptUploaded)throw Error('Çekin saxlanması təsdiqlənmədi.');if(alive()){receiptReady=true;info.textContent='Çek uğurla yükləndi';}}catch(e){if(!alive())return;try{const s=await api('/topup?id='+id);receiptReady=s.receiptUploaded&&s.receiptRequestId===attempt;}catch{}info.textContent=receiptReady?'Çek uğurla yükləndi':e.status?e.message:'Çek yüklənmədi. Bağlantını yoxlayın və yenidən cəhd edin.';retry.hidden=receiptReady;}finally{if(alive())setBusy(false);}}
  input.onchange=()=>{const next=input.files[0];if(!next||uploading||sending)return;file=next;attempt=crypto.randomUUID();receiptReady=false;show();void upload();};show();signal.addEventListener('abort',revoke,{once:true});releasePhoto=()=>{signal.removeEventListener('abort',revoke);revoke();};
 }
 async function resume(){
  const old=read();if(!old?.id&&!old?.requestId){await refreshCards();return;}
  open.disabled=true;onBusy(true);
  try{
   let id=old.id;
   if(!id){
    const recovered=await api('/topup',{amount:topupAmountText(old.cents),methodId:old.methodId,requestId:old.requestId,allowFallback:true});
    id=recovered.id;remember({...old,id});
   }
   const s=await api('/topup?id='+encodeURIComponent(id));if(!alive())return;
   if(s.status!=='draft'){if(['reviewing','approved'].includes(s.status))await completed(s);else forget();return;}
   restoreCents(s.cents);draft=s;selected=s.methodId;receiptReady=s.receiptUploaded;await detail();
  }catch(e){
   if(e.status===404||e.code==='TOPUP_CARD_EXPIRED')forget();
   if(e.status!==404&&alive())notice.textContent='Əvvəlki müraciət: '+e.message;
  }finally{if(alive()){open.disabled=false;onBusy(false);if(root.isConnected)await refreshCards();}}
 }
 return{element:root,updateAmount,resume};
}
