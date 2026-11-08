import {validateDetails} from './checkout-fields.js';
import {ensureCart} from '/cart-ready.js?v=checkout-sounds-20261108';
import {ensureEntryStyles} from './entry-styles.js?v=terms-preload-20261108';
let current=null;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const quotes=new Map(),lifetime=30000;
let quoteSession;
window.addEventListener('mirpanel:account',event=>{
 const key=event.detail?.user_id??event.detail?.id??null;
 if(quoteSession!==undefined&&key!==quoteSession)quotes.clear();
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
 await Promise.all([ensureCart(),ensureEntryStyles()]);if(current?.open){current.focus();return;}
 if(loadingDialog&&!loadingDialog.open)return;
 const life=new AbortController(),dialog=loadingDialog||el('dialog',null,'cart-entry'),head=el('header'),title=el('h2','Diqqət!'),close=el('button','×'),body=el('div'),error=el('p','','cart-entry-error');current=dialog;close.type='button';close.setAttribute('aria-label','Bağla');head.append(title,close);error.setAttribute('role','alert');dialog.replaceChildren(head,body,error);
 if(loadingDialog){dialog.removeAttribute('style');onReady?.();}
 else{document.body.append(dialog);dialog.showModal();}
 document.body.classList.add('orderConfirmationActive');
 const before=e=>{if(dialog.open){e.preventDefault();error.textContent='Məlumatları tamamlayın və ya pəncərəni bağlayın.';}};window.addEventListener('mirpanel:before-navigate',before,{signal:life.signal});
 let working=false,activeQuote=null,guest=false,values={},draftId=editLine?.draftId||crypto.randomUUID();
 const api=async(path,data)=>{const request=new AbortController(),abort=()=>request.abort();life.signal.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,12000);try{const r=await fetch('/api/payments/shop'+path,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:request.signal});if(!/^application\/json\b/i.test(r.headers.get('Content-Type')||''))throw Error('Sifariş xidməti düzgün cavab vermədi.');const d=await r.json();if(!r.ok)throw Object.assign(Error(d.error||'Saxlama təsdiqlənmədi. Yenidən cəhd edin.'),{status:r.status,code:d.code});return d;}finally{clearTimeout(timer);life.signal.removeEventListener('abort',abort);}};
 close.onclick=()=>{if(!working)dialog.close();};dialog.addEventListener('cancel',e=>{if(working)e.preventDefault();});dialog.addEventListener('close',()=>{life.abort();document.body.classList.remove('orderConfirmationActive');body.replaceChildren();values={};dialog.remove();if(current===dialog)current=null;},{once:true});
 const button=(text,fn,primary=false)=>{const b=el('button',text,primary?'cart-entry-primary':'');b.type='button';b.onclick=fn;return b;};
 async function commit(v){
  if(working)return;working=true;error.textContent='';body.querySelectorAll('button').forEach(b=>b.disabled=true);
  let ready;
  try{ready=await ensureCart();const saved=await api('/draft',{id:draftId,productId:product.id,planIndex:index,values:v,termsVersion:activeQuote.termsVersion,...(renewal?{renewalId:renewal.id,renewalExpiresOn:renewal.expiresOn}:{})});ready.commitDraft(saved,{productId:product.id,planIndex:index,quantity:editLine?.quantity||1,edit:!!editLine||!!renewal&&ready.read().some(x=>x.draftId===saved.draftId)});}
  catch(e){if(!life.signal.aborted){
   if(e.code==='CART_TERMS_CHANGED'||(e.status===409&&e.message==='Paketin şərtləri dəyişib. Yenidən təsdiqləyin.')){
    values=v;activeQuote=null;working=false;await loadTerms(null,true);return;
   }
   error.textContent=e.message;body.querySelectorAll('button').forEach(b=>b.disabled=false);
  }return;}
  finally{working=false;}
  dialog.close();
  if(!editLine&&loginOnGuest&&guest){
   const target='/hesab?next=%2Fsebet&from=cart';
   if(window.MirpanelNavigation)void window.MirpanelNavigation.go(target);
   else location.assign(target);
  }else ready.open();
 }
 function fields(){const fs=activeQuote.fields||[];if(!fs.length)return commit({});dialog.classList.remove('cart-entry-warning');head.replaceChildren(title,close);body.className='';title.textContent='Sifariş məlumatları';const form=el('form'),intro=el('p',product.title+' · '+activeQuote.planName,'cart-entry-note'),controls=new Map();form.append(intro);for(const f of fs){const label=el('label'),caption=el('span',f.label+(f.required?' *':''));let input;if(f.type==='select'){input=el('select');input.append(el('option',''));for(const option of f.options){const x=el('option',option);x.value=option;input.append(x);}}else input=el(f.type==='textarea'?'textarea':'input');if(input.tagName==='INPUT')input.type=f.type==='password'?'password':f.type==='email'?'email':'text';input.value=values[f.key]||'';input.required=f.required;input.autocomplete='off';input.spellcheck=false;input.maxLength=f.digits||f.maxLength;input.minLength=f.minLength;input.placeholder=f.placeholder||f.label;input.setAttribute('aria-label',f.label);if(f.digits){input.inputMode='numeric';input.pattern='[0-9]{'+f.digits+'}';input.addEventListener('input',()=>input.value=input.value.replace(/\D/g,'').slice(0,f.digits));}controls.set(f.key,input);label.append(caption,input);if(f.description)label.append(el('small',f.description));form.append(label);}const next=el('button','Davam et','cart-entry-primary');next.type='submit';form.append(next);form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;try{values=validateDetails(fs,Object.fromEntries([...controls].map(([k,n])=>[k,n.value])));void commit(values);}catch(e){error.textContent=e.message;}};body.replaceChildren(form);}
 function terms(display){
  dialog.classList.add('cart-entry-warning');body.className='cart-warning-body';title.textContent='Diqqət!';
  const icon=el('span',null,'cart-warning-icon');icon.innerHTML='<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m10.3 4-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/></svg>';
  const heading=el('div',null,'cart-warning-heading');
  const planName=display.planName||plan.label||plan.name||(plan.months?plan.months+' ay':'Seçilmiş paket');
  heading.append(title,el('p',product.title+' · '+planName,'cart-warning-product'));head.replaceChildren(icon,heading,close);
  const text=el('div',null,'cart-entry-terms');text.tabIndex=0;text.setAttribute('aria-label','Məhsul xəbərdarlığı');
  const content=String(display.terms||'Bu məhsul üçün ümumi istifadə və sifariş şərtləri tətbiq olunur.');
  let list=null;
  for(const line of content.split('\n')){const bullet=/^\s*[-*•]\s+/.test(line);if(bullet&&!list){list=el('ul');text.append(list);}if(!bullet)list=null;const p=el(bullet?'li':'p');for(const [i,part]of line.replace(/^\s*[-*•]\s+/,'').split('**').entries())p.append(el(i%2?'strong':'span',part));(list||text).append(p);}
  if(display.note)text.append(el('p',display.note));
  const footer=el('footer',null,'cart-warning-footer'),label=el('label',null,'cart-entry-consent'),check=el('input');check.type='checkbox';
  label.append(check,el('span','Xəbərdarlığı oxudum və qəbul edirəm'));
  const cancel=button('Ləğv et',()=>{if(!working)dialog.close();}),next=button('Təsdiqləyirəm',async()=>{
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
   if(repeatPlanName!==null&&(q.planName!==repeatPlanName||(repeatPlanKey!==null&&q.sourcePlanKey!==repeatPlanKey)||q.available===0)){
    error.textContent=q.available===0?'Bu paket hazırda stokda yoxdur.':'Paket dəyişib. Sifarişlərim səhifəsini yenidən açın və təkrar yoxlayın.';
    body.replaceChildren(button('Yenidən cəhd et',()=>loadTerms(null,reaccept)));return;
   }
   if(editLine?.draftId&&!reaccept){const saved=await api('/draft?id='+encodeURIComponent(editLine.draftId));if(life.signal.aborted)return;values=saved.values;activeQuote=q;if(saved.termsVersion===q.termsVersion&&q.fields.length){fields();return;}}
   guest=d.balanceCents===null;terms(q);
   if(reaccept)error.textContent='Paketin şərtləri dəyişib. Yeni şərtləri oxuyub yenidən təsdiqləyin.';
  }catch(e){if(!life.signal.aborted){error.textContent=repeatPlanName!==null&&e.status===409?e.message:'Sifariş şərtlərini almaq mümkün olmadı.';body.replaceChildren(button('Yenidən cəhd et',()=>loadTerms(null,reaccept)));}}
 }
 await loadTerms(initial);
}
export async function editCartLine(line){const saved=await fetch('/api/payments/shop/draft?id='+encodeURIComponent(line.draftId),{credentials:'same-origin',cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Qaralama tapılmadı.');return d;});const q=await fetch('/api/payments/shop/quote',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[line]})}).then(r=>r.json());const x=q.items?.[0];if(!x)throw Error('Məhsul məlumatı yüklənmədi.');const plans=Array.from({length:saved.planIndex+1},()=>({}));plans[saved.planIndex]={terms:x.terms};return startCartEntry({id:line.productId,title:x.title,note:x.note,plans},plans[saved.planIndex],{editLine:line});}
