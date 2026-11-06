import {validateDetails} from './checkout-fields.js';
import {ensureCart} from '/cart-ready.js?v=login-gate-20261107b';
import {ensureEntryStyles} from './entry-styles.js?v=checkout-recovery-20261106';
let current=null;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
export async function startCartEntry(product,plan,{editLine=null}={}){
 if(current?.open){current.focus();return;}
 const [cart]=await Promise.all([ensureCart(),ensureEntryStyles()]);if(current?.open){current.focus();return;}
 const index=product.plans.indexOf(plan);if(index<0)return;
 const life=new AbortController(),dialog=el('dialog',null,'cart-entry'),head=el('header'),title=el('h2','Diqqət!'),close=el('button','×'),body=el('div'),error=el('p','','cart-entry-error');current=dialog;close.type='button';close.setAttribute('aria-label','Bağla');head.append(title,close);error.setAttribute('role','alert');dialog.append(head,body,error);document.body.append(dialog);dialog.showModal();document.body.classList.add('orderConfirmationActive');
 const before=e=>{if(dialog.open){e.preventDefault();error.textContent='Məlumatları tamamlayın və ya pəncərəni bağlayın.';}};window.addEventListener('mirpanel:before-navigate',before,{signal:life.signal});
 let working=false,activeQuote=null,values={},draftId=editLine?.draftId||crypto.randomUUID();
 const api=async(path,data)=>{const r=await fetch('/api/payments/shop'+path,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:life.signal});const d=await r.json();if(!r.ok)throw Error(d.error||'Saxlama təsdiqlənmədi. Yenidən cəhd edin.');return d;};
 let pending=api('/quote',{items:[{productId:product.id,planIndex:index,quantity:1}]}).then(d=>d.items[0]);pending.catch(()=>{});
 close.onclick=()=>{if(!working)dialog.close();};dialog.addEventListener('cancel',e=>{if(working)e.preventDefault();});dialog.addEventListener('close',()=>{life.abort();document.body.classList.remove('orderConfirmationActive');body.replaceChildren();values={};dialog.remove();if(current===dialog)current=null;},{once:true});
 const button=(text,fn,primary=false)=>{const b=el('button',text,primary?'cart-entry-primary':'');b.type='button';b.onclick=fn;return b;};
 async function commit(v){if(working)return;working=true;error.textContent='';body.querySelectorAll('button').forEach(b=>b.disabled=true);try{const ready=await ensureCart();const saved=await api('/draft',{id:draftId,productId:product.id,planIndex:index,values:v,termsVersion:activeQuote.termsVersion});ready.commitDraft(saved,{productId:product.id,planIndex:index,quantity:editLine?.quantity||1,edit:!!editLine});working=false;dialog.close();ready.open();}catch(e){if(!life.signal.aborted){error.textContent=e.message;body.querySelectorAll('button').forEach(b=>b.disabled=false);}}finally{working=false;}}
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
   try{const q=await pending;if(life.signal.aborted)return;
    if(q.terms!==display.terms||q.note!==display.note){terms(q);error.textContent='Xəbərdarlıq yeniləndi. Yenidən təsdiqləyin.';return;}
    activeQuote=q;working=false;await fields();
   }catch(e){if(!life.signal.aborted){error.textContent=e.message;pending=api('/quote',{items:[{productId:product.id,planIndex:index,quantity:1}]}).then(d=>d.items[0]);pending.catch(()=>{});}}
   finally{working=false;next.disabled=!check.checked;cancel.disabled=false;}
  },true);
  next.disabled=true;check.onchange=()=>next.disabled=!check.checked||working;
  const actions=el('div',null,'cart-warning-actions');actions.append(cancel,next);footer.append(label,actions);body.replaceChildren(text,footer);
 }
 if(editLine?.draftId){try{const [saved,q]=await Promise.all([api('/draft?id='+encodeURIComponent(editLine.draftId)),pending]);if(life.signal.aborted)return;values=saved.values;activeQuote=q;if(saved.termsVersion===q.termsVersion){fields();return;}}catch(e){error.textContent=e.message;}}
 terms({terms:String(plan.terms||(product.confirmationModal||product.orderConfirmation)?.description||''),note:String(product.note||'')});
}
export async function editCartLine(line){const saved=await fetch('/api/payments/shop/draft?id='+encodeURIComponent(line.draftId),{credentials:'same-origin',cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Qaralama tapılmadı.');return d;});const q=await fetch('/api/payments/shop/quote',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[line]})}).then(r=>r.json());const x=q.items?.[0];if(!x)throw Error('Məhsul məlumatı yüklənmədi.');const plans=Array.from({length:saved.planIndex+1},()=>({}));plans[saved.planIndex]={terms:x.terms};return startCartEntry({id:line.productId,title:x.title,note:x.note,plans},plans[saved.planIndex],{editLine:line});}
