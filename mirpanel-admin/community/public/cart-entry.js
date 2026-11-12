import {validateDetails,validateEpinbyDetails} from './checkout-fields.js?v=epinby-account-1';
import {ensureCart} from '/cart-ready.js?v=cart-ready-now-1';
import {ensureEntryStyles} from './entry-styles.js?v=player-gold-seal-1';
let current=null;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
function playerResultCard(name,id){
 const card=el('div',null,'player-result-card');
 const seal=el('span',null,'player-result-seal');seal.setAttribute('aria-hidden','true');
 seal.innerHTML='<svg viewBox="0 0 64 64" focusable="false" aria-hidden="true"><defs><linearGradient id="playerSealGold" x2=".8" y2="1"><stop stop-color="#fff2af"/><stop offset=".43" stop-color="#e8b84c"/><stop offset=".65" stop-color="#bd8020"/><stop offset="1" stop-color="#f4ce71"/></linearGradient></defs><path d="M27 5q5-4 10 0l3 2q2 2 5 1h4q6 0 7 6l1 4q0 3 3 5l2 3q3 5 0 10l-2 3q-2 2-2 6l-1 4q-1 6-7 7h-4q-3 0-6 3l-3 2q-5 3-10 0l-3-2q-3-3-6-3h-4q-6-1-7-7l-1-4q0-4-2-6l-2-3q-3-5 0-10l2-3q3-2 3-5l1-4q1-6 7-6h4q3 1 5-1Z" fill="url(#playerSealGold)" stroke="#ffe095" stroke-width="1.1"/><path d="m19 33 9 9 17-18" fill="none" stroke="#1b150c" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 const content=el('div',null,'player-result-content');
 const identifier=el('small','Oyunçu ID-si: ','player-result-id');
 identifier.append(el('bdi',id));
 content.append(el('span','Oyunçu tapıldı','player-result-title'),el('bdi',name,'player-result-name'),identifier);
 card.append(seal,content);
 return card;
}
const amount=cents=>Number.isSafeInteger(cents)?(cents/100).toFixed(2).replace('.',',')+' ₼':'';
function appendTermsText(node,text){
 for(const [i,part] of text.split('**').entries())node.append(el(i%2?'strong':'span',part));
}
const quotes=new Map(),lifetime=30000;
let quoteSession;
window.addEventListener('mirpanel:account',event=>{
 const key=event.detail?.user_id??event.detail?.id??null;
 if(quoteSession!==undefined&&key!==quoteSession){quotes.clear();current?.close();}
 quoteSession=key;
});
function preparedQuote(productId,index,{fresh=false,edit=false}={}){
 const key=JSON.stringify([productId,index]),old=quotes.get(key);
 if(!fresh&&!edit&&old&&(!old.readyAt||Date.now()-old.readyAt<lifetime))return old;
 const entry={readyAt:0};
 const request=(async()=>{
  const r=await fetch('/api/payments/shop/quote',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{productId,planIndex:index,quantity:1}]}),signal:AbortSignal.timeout(12000)});
  if(!/^application\/json\b/i.test(r.headers.get('Content-Type')||''))throw Error('Sifariş xidməti düzgün cavab vermədi.');
  const d=await r.json(),q=d.items?.[0];
  if(!r.ok)throw Object.assign(Error(d.error||'Sifariş şərtləri tapılmadı.'),{status:r.status});
  if(q?.productId!==productId||q.planIndex!==index||typeof q.terms!=='string'||!q.termsVersion||!Array.isArray(q.fields))throw Error('Sifariş şərtləri tapılmadı.');
  entry.readyAt=Date.now();
  return d;
 })();
 entry.request=request;
 if(!edit){
  quotes.delete(key);quotes.set(key,entry);
  if(quotes.size>8)quotes.delete(quotes.keys().next().value);
  void request.catch(()=>{if(quotes.get(key)===entry)quotes.delete(key);});
 }
 return entry;
}
export async function prepareCartEntry(product,plan){
 const index=product.plans.indexOf(plan);if(index<0)return;
 await Promise.all([preparedQuote(product.id,index).request,ensureEntryStyles(),ensureCart()]);
}
function loading(body){
 body.className='cart-entry-loading';
 const status=el('div',null,'cart-entry-skeleton');status.setAttribute('role','status');status.setAttribute('aria-label','Qaydalar hazırlanır');status.setAttribute('aria-busy','true');
 body.replaceChildren(status);
}
export async function startCartEntry(product,plan,{editLine=null,loginOnGuest=false,loadingDialog=null,onReady,repeatPlanName=null,repeatPlanKey=null,renewal=null}={}){
 if(current?.open){current.focus();return;}
 const index=product.plans.indexOf(plan);if(index<0)return;
 const initial=preparedQuote(product.id,index,{edit:!!editLine,fresh:repeatPlanName!==null});void initial.request.catch(()=>{});
 // The warning is read-only. Cart initialization must not gate its display.
 // The existing commit path still awaits and capability-checks the cart.
 void ensureCart().catch(()=>{});await ensureEntryStyles();if(current?.open){current.focus();return;}
 if(loadingDialog&&!loadingDialog.open)return;
 const life=new AbortController(),dialog=loadingDialog||el('dialog',null,'cart-entry'),head=el('header'),title=el('h2','Diqqət!'),close=el('button','×'),body=el('div'),error=el('p','','cart-entry-error');current=dialog;close.type='button';close.setAttribute('aria-label','Bağla');head.append(title,close);error.setAttribute('role','alert');dialog.replaceChildren(head,body,error);
 if(loadingDialog){dialog.removeAttribute('style');onReady?.();}
 else{document.body.append(dialog);dialog.showModal();}
 document.body.classList.add('orderConfirmationActive');
 const before=e=>{if(dialog.open){e.preventDefault();error.textContent='Məlumatları tamamlayın və ya pəncərəni bağlayın.';}};window.addEventListener('mirpanel:before-navigate',before,{signal:life.signal});
 let working=false,activeQuote=null,guest=false,values={},draftId=editLine?.draftId||crypto.randomUUID();
 const api=async(path,data,signal)=>{
  const signals=[life.signal,AbortSignal.timeout(signal?18000:12000)];if(signal)signals.push(signal);
  const r=await fetch('/api/payments/shop'+path,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.any(signals)});
  if(!/^application\/json\b/i.test(r.headers.get('Content-Type')||''))throw Error('Sifariş xidməti düzgün cavab vermədi.');
  const d=await r.json();
  if(!r.ok)throw Object.assign(Error(d.error||'Saxlama təsdiqlənmədi. Yenidən cəhd edin.'),{status:r.status,code:d.code});
  return d;
 };
 close.onclick=()=>{if(!working)dialog.close();};dialog.addEventListener('cancel',e=>{if(working)e.preventDefault();});dialog.addEventListener('close',()=>{life.abort();document.body.classList.remove('orderConfirmationActive');body.replaceChildren();values={};dialog.remove();if(current===dialog)current=null;},{once:true});
 const button=(text,fn,primary=false)=>{const b=el('button',text,primary?'cart-entry-primary':'');b.type='button';b.onclick=fn;return b;};
 async function commit(v){
  if(working)return;working=true;error.textContent='';const enabled=[...body.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')];enabled.forEach(control=>control.disabled=true);
  let ready;
  try{ready=await ensureCart();const saved=await api('/draft',{id:draftId,productId:product.id,planIndex:index,values:v,termsVersion:activeQuote.termsVersion,...(renewal?{renewalId:renewal.id,renewalExpiresOn:renewal.expiresOn}:{})});ready.commitDraft({...saved,termsVersion:saved.termsVersion||activeQuote.termsVersion},{productId:product.id,planIndex:index,quantity:editLine?.quantity||1,edit:!!editLine||!!renewal&&ready.read().some(x=>x.draftId===saved.draftId)});}
  catch(e){if(!life.signal.aborted){
   if(e.code==='CART_TERMS_CHANGED'||(e.status===409&&e.message==='Paketin şərtləri dəyişib. Yenidən təsdiqləyin.')){
    values=v;activeQuote=null;working=false;await loadTerms(null,true);return;
   }
   error.textContent=e.message;enabled.forEach(control=>control.disabled=false);
  }return;}
  finally{working=false;}
  dialog.close();
  if(!editLine&&loginOnGuest&&activeQuote.accountCheck){
   const target=guest?'/hesab?next=%2Fodenis&from=cart':'/odenis';
   location.assign(target);
  }else if(!editLine&&loginOnGuest&&guest){
   const target='/hesab?next=%2Fsebet&from=cart';
   if(window.MirpanelNavigation)void window.MirpanelNavigation.go(target);
   else location.assign(target);
  }else ready.open();
 }
 function fields(){
  const fs=activeQuote.fields||[];
  if(!fs.length)return commit({});
  const quote=activeQuote,checksAccount=quote.accountCheck===true;
  dialog.classList.remove('cart-entry-warning');head.replaceChildren(title,close);body.className='';title.textContent=quote.gameTerms?'Oyunçu ID-ni daxil et':'Sifariş məlumatları';
  const form=el('form',null,'cart-entry-fields'),controls=new Map();
  const intro=el('p',product.title+' · '+quote.planName,'cart-entry-note');
  form.append(intro);
  let indicator,checkInput;
  const identifier=fs.find(f=>['player_id','telegram_username'].includes(f.key))?.key||fs[0].key;
  for(const f of fs){
   const label=el('label'),caption=el('span',f.label+(f.required?' *':''));
   let input;
   if(f.type==='select'){
    input=el('select');input.append(el('option',''));
    for(const option of f.options){const x=el('option',option);x.value=option;input.append(x);}
   }else input=el(f.type==='textarea'?'textarea':'input');
   if(input.tagName==='INPUT')input.type=['password','email','tel'].includes(f.type)?f.type:'text';
   input.value=values[f.key]||'';input.required=f.required;input.autocomplete='off';input.spellcheck=false;
   input.maxLength=f.digits||f.maxLength;input.minLength=f.minLength;input.placeholder=f.placeholder||f.label;input.setAttribute('aria-label',f.label);
   if(f.digits){input.inputMode='numeric';input.pattern='[0-9]{'+f.digits+'}';input.addEventListener('input',()=>input.value=input.value.replace(/\D/g,'').slice(0,f.digits));}
   if(checksAccount&&f.key==='player_id'&&['pubg_mobile','pubg-mobile','free_fire','free-fire'].includes(product.id))input.inputMode='numeric';
   controls.set(f.key,input);label.append(caption);
   if(checksAccount&&f.key===identifier){
    checkInput=el('span',null,'cart-entry-check-input');
    indicator=el('span',null,'cart-entry-check-icon');indicator.setAttribute('aria-hidden','true');
    checkInput.append(input,indicator);label.append(checkInput);
   }else label.append(input);
   if(f.description&&!checksAccount)label.append(el('small',f.description));
   form.append(label);
  }
  const feedback=el('div',null,'cart-entry-check-feedback');feedback.setAttribute('role','status');feedback.hidden=true;
  if(checksAccount)form.append(feedback);
  const action=editLine?'Yadda saxla':loginOnGuest?'Ödənişə keç':'Səbətə at';
  const priced=cents=>action+(amount(cents)?' · '+amount(cents):'');
  const next=el('button',checksAccount?priced(quote.unitCents):'Davam et','cart-entry-primary');next.type='submit';form.append(next);
  let timer,request,turn=0,accepted=null;
  const read=()=>Object.fromEntries([...controls].map(([key,input])=>[key,input.value]));
  function showCheck(state,message=''){
   feedback.dataset.state=state;checkInput.dataset.state=state;
   checkInput.setAttribute('aria-busy',String(state==='loading'));
   indicator.textContent=state==='verified'?'✓':'';
   feedback.replaceChildren();
   if(message)feedback.append(el('p',message));
   feedback.hidden=!message;
  }
  function schedule(delay=450){
   clearTimeout(timer);request?.abort();
   const run=++turn;accepted=null;next.disabled=true;error.textContent='';showCheck('');
   const raw=read();
   if(fs.some(f=>f.required&&!raw[f.key]?.trim()))return;
   let clean;try{clean=validateEpinbyDetails(fs,raw,product.id);}catch(e){showCheck('invalid',e.message);return;}
   timer=setTimeout(async()=>{
    if(!form.isConnected||life.signal.aborted)return;
    request=new AbortController();showCheck('loading','Hesab yoxlanılır…');
    let result;
    try{result=await api('/epinby-account',{productId:product.id,planIndex:index,termsVersion:quote.termsVersion,values:clean},request.signal);}
    catch(e){result=e.status===400||e.status===409?{state:'invalid',message:e.message}:{state:'retry',message:'Hesab yoxlanmadı. Yenidən cəhd edin.'};}
    if(run!==turn||life.signal.aborted||!form.isConnected)return;
    if(result.state==='verified'&&result.name){
     showCheck('verified');
     if(identifier==='player_id')feedback.append(playerResultCard(result.name,clean[identifier]));
     else feedback.append(el('strong','Hesab təsdiqləndi'),el('b',result.name),el('small',clean[identifier]));
     feedback.hidden=false;
    }else{
     showCheck(result.state,result.message||'Hesab yoxlanmadı.');
     if(result.state==='retry')feedback.append(button('Yenidən cəhd et',()=>schedule(0)));
    }
    if(result.allowCheckout===true&&(result.state==='unavailable'||result.state==='verified'&&result.name)){
     if(Number.isSafeInteger(result.unitCents))next.textContent=priced(result.unitCents);
     accepted=JSON.stringify(clean);next.disabled=false;
    }
   },delay);
  }
  if(checksAccount){
   form.addEventListener('input',()=>schedule(),{signal:life.signal});
   life.signal.addEventListener('abort',()=>{clearTimeout(timer);request?.abort();},{once:true});
  }
  form.onsubmit=e=>{
   e.preventDefault();if(!form.reportValidity())return;
   try{
    const nextValues=checksAccount?validateEpinbyDetails(fs,read(),product.id):validateDetails(fs,read());
    if(checksAccount&&JSON.stringify(nextValues)!==accepted)return;
    values=nextValues;void commit(values);
   }catch(e){error.textContent=e.message;}
  };
  body.replaceChildren(form);if(checksAccount)schedule();
  if(quote.gameTerms){title.tabIndex=-1;title.focus();dialog.scrollTop=0;}
 }
 function terms(display){
  const game=display.gameTerms;
  dialog.classList.add('cart-entry-warning');dialog.classList.toggle('cart-game-entry',!!game);body.className='cart-warning-body';title.textContent=game?'Sifariş şərtləri':'Diqqət!';
  title.id='cartEntryTitle';dialog.removeAttribute('aria-label');dialog.setAttribute('aria-labelledby',title.id);
  const icon=el('span',null,'cart-warning-icon');icon.innerHTML='<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m10.3 4-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/></svg>';
  const heading=el('div',null,'cart-warning-heading');
  const planName=display.planName||plan.label||plan.name||(plan.months?plan.months+' ay':'Seçilmiş paket');
  heading.append(title,el('p',[product.title,planName,game&&amount(display.unitCents)].filter(Boolean).join(' · '),'cart-warning-product'));head.replaceChildren(icon,heading,close);
  const text=el('div',null,'cart-entry-terms');text.tabIndex=0;text.setAttribute('aria-label',game?'Məhsulun sifariş qaydaları':'Məhsul xəbərdarlığı');
  if(game){
   const rules=el('ul',null,'cart-game-rules');rules.setAttribute('role','list');
   for(const rule of game.rules){const li=el('li'),mark=el('span','✓','cart-game-check'),copy=el('span');mark.setAttribute('aria-hidden','true');appendTermsText(copy,rule);li.append(mark,copy);rules.append(li);}
   text.append(el('p',game.warning,'cart-game-warning'),rules);
  }
  const content=String(display.terms||(!game?'Bu məhsul üçün ümumi istifadə və sifariş şərtləri tətbiq olunur.':''));
  let list=null;
  for(const line of content.split('\n')){if(!line.trim())continue;const bullet=/^\s*[-*•]\s+/.test(line);if(bullet&&!list){list=el('ul');text.append(list);}if(!bullet)list=null;const p=el(bullet?'li':'p');appendTermsText(p,line.replace(/^\s*[-*•]\s+/,''));(list||text).append(p);}
  if(display.note)text.append(el('p',display.note));
  const footer=el('footer',null,'cart-warning-footer'),label=el('label',null,'cart-entry-consent'),check=el('input');check.type='checkbox';
  label.append(check,el('span',game?'Oxudum və təsdiqlədim':'Xəbərdarlığı oxudum və qəbul edirəm'));
  const cancel=button('Ləğv et',()=>{if(!working)dialog.close();}),next=button(game?'Növbəti':'Təsdiqləyirəm',async()=>{
   if(!check.checked||working)return;working=true;next.disabled=cancel.disabled=true;error.textContent='';
   try{activeQuote=display;working=false;await fields();}
   finally{working=false;next.disabled=!check.checked;cancel.disabled=false;}
  },true);
  next.disabled=true;check.onchange=()=>next.disabled=!check.checked||working;
  const actions=el('div',null,'cart-warning-actions');actions.append(cancel,next);footer.append(label,actions);body.replaceChildren(text,footer);
 }
 async function loadTerms(prepared,reaccept=false){
  error.textContent='';
  const quote=prepared||preparedQuote(product.id,index,{fresh:true,edit:!!editLine});
  if(!quote.readyAt||reaccept||editLine)loading(body);
  try{const d=await quote.request,q=d.items[0];if(life.signal.aborted)return;
   const soldOut=q.available===0&&!(renewal&&product.id==='netflix'&&!q.salesDisabled);
   if(repeatPlanName!==null&&(q.planName!==repeatPlanName||(repeatPlanKey!==null&&q.sourcePlanKey!==repeatPlanKey)||soldOut)){
    error.textContent=q.available===0?'Bu paket hazırda stokda yoxdur.':'Paket dəyişib. Sifarişlərim səhifəsini yenidən açın və təkrar yoxlayın.';
    body.replaceChildren(button('Yenidən cəhd et',()=>loadTerms(null,reaccept)));return;
   }
   if(editLine?.draftId&&!reaccept){const saved=await api('/draft?id='+encodeURIComponent(editLine.draftId));if(life.signal.aborted)return;values=saved.values;activeQuote=q;if(saved.termsVersion===q.termsVersion){title.id='cartEntryTitle';dialog.setAttribute('aria-labelledby',title.id);fields();return;}}
   guest=d.balanceCents===null;terms(q);
   if(reaccept)error.textContent='Paketin şərtləri dəyişib. Yeni şərtləri oxuyub yenidən təsdiqləyin.';
  }catch(e){if(!life.signal.aborted){error.textContent=repeatPlanName!==null&&e.status===409?e.message:'Sifariş şərtlərini almaq mümkün olmadı.';body.replaceChildren(button('Yenidən cəhd et',()=>loadTerms(null,reaccept)));}}
 }
 await loadTerms(initial);
}
export async function editCartLine(line){const saved=await fetch('/api/payments/shop/draft?id='+encodeURIComponent(line.draftId),{credentials:'same-origin',cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Qaralama tapılmadı.');return d;});const q=await fetch('/api/payments/shop/quote',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[line]})}).then(r=>r.json());const x=q.items?.[0];if(!x)throw Error('Məhsul məlumatı yüklənmədi.');const plans=Array.from({length:saved.planIndex+1},()=>({}));plans[saved.planIndex]={terms:x.terms};return startCartEntry({id:line.productId,title:x.title,note:x.note,plans},plans[saved.planIndex],{editLine:line});}
