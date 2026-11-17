import {chatElement as el,chatButton as button,chatModal} from './chat-components.js?v=gift-layout-3';
const key='mirpanel.influencer-gift.v1',money=c=>(Number(c)/100).toFixed(2).replace('.',',')+' ₼';
let open=false,activeGift=null;
function read(){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
function save(draft){try{sessionStorage.setItem(key,JSON.stringify(draft));}catch{}}
async function api(path,data){const c=new AbortController(),timer=setTimeout(()=>c.abort(),25000);try{const r=await fetch(path,{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:c.signal});const v=await r.json();if(!r.ok)throw Object.assign(Error(v.error?.message||v.error||'Sorğu alınmadı. Yenidən cəhd edin.'),{status:r.status});return v;}catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('Bağlantı təsdiqlənmədi. Seçiminiz saxlanılıb; yenidən cəhd edin.');throw e;}finally{clearTimeout(timer);}}
export function resumeInfluencerGift(){const selected=new URLSearchParams(location.search).get('gift');const draft=read();if(selected&&!draft?.attempt){void openLiveGift({id:selected});return;}if(draft?.resume){draft.resume=false;save(draft);void openLiveGift({id:draft.recipientId},draft);}}
window.addEventListener('pageshow',event=>{if(event.persisted&&read()?.resume){if(activeGift?.box.open){activeGift.box.addEventListener('close',resumeInfluencerGift,{once:true});activeGift.box.close();}else{open=false;resumeInfluencerGift();}}});
window.addEventListener('mirpanel:route-leave',()=>activeGift?.box.close());
export async function openLiveGift(recipient,restored=null){
 if(open)return;open=true;
 let draft=restored||(read()?.attempt?read():null)||{recipientId:recipient.id,requestId:crypto.randomUUID()},data,product,plan,quote,busy=false,closed=false,generation=0;
 const modal=chatModal({title:(recipient.name||'Influencer')+' üçün hədiyyə seç',onClose:()=>{closed=true;generation++;if(activeGift?.box===box){activeGift=null;open=false;}}}),{body,box}=modal;activeGift=modal;box.classList.add('live-gift-dialog');
 const error=el('p',null,'chat-gift-error');error.setAttribute('role','alert');const screen=el('div',null,'live-gift-screen');body.append(error,screen);
 const guard=fn=>async()=>{if(busy)return;busy=true;error.textContent='';try{await fn();}catch(e){if(!closed)error.textContent=e.message;}finally{busy=false;}};
 function persist(){save(draft);}
 function leave(href){draft.resume=true;persist();location.assign(href);}
 function toolbar(label,action){const n=el('div',null,'live-gift-toolbar');n.append(button(label,action,'live-gift-back'));return n;}
 function hero(){const n=el('div',null,'live-gift-hero'),image=el('img');image.src=product.image;image.alt='';const text=el('div');text.append(el('h3',product.title));if(plan)text.append(el('p',plan.label));n.append(image,text);return n;}
 function recipientLine(){const n=el('div',null,'live-gift-recipient');n.append(el('small','Hədiyyə alan'),el('strong',data.recipient.name));return n;}
 function totalLine(){const n=el('div',null,'live-gift-total');n.append(el('span','Yekun məbləğ'),el('strong',money(draft.attempt?.expectedTotalCents??quote.totalCents)));return n;}
 function list(){
  generation++;draft.stage='products';screen.replaceChildren(el('h3','Məhsul seçin'));
  const grid=el('div',null,'live-gift-grid');
  for(const p of data.products){
   const row=button('',()=>{draft.productId=p.id;delete draft.planIndex;draft.requestId=crypto.randomUUID();persist();product=p;plan=null;packages();},'live-gift-product');row.title=p.title;
   const img=el('img');img.src=p.image;img.alt='';img.loading='lazy';const text=el('span');text.append(el('strong',p.title),el('small',money(Math.min(...p.plans.map(x=>x.cents)))));row.append(img,text);grid.append(row);
  }
  screen.append(grid);if(!data.products.length)screen.append(el('p','Hədiyyə üçün aktiv məhsul yoxdur.'));
 }
 function packages(){
  generation++;draft.stage='packages';screen.replaceChildren(toolbar('← Məhsullar',list),hero(),el('h3','Paket seçin'));
  const options=el('div',null,'live-gift-packages');
  for(const p of product.plans){
   const selected=draft.planIndex===p.index,choose=button('',guard(async()=>{draft.planIndex=p.index;draft.stage='summary';draft.requestId=crypto.randomUUID();persist();plan=p;await summary();}),'live-gift-package'+(selected?' is-selected':''));
   choose.setAttribute('aria-pressed',String(selected));const tick=el('span',selected?'✓':'','live-gift-radio');tick.setAttribute('aria-hidden','true');
   choose.append(tick,el('span',p.label,'live-gift-package-name'),el('strong',money(p.cents),'live-gift-price'));choose.disabled=p.available===0;options.append(choose);
  }
  screen.append(options);
 }
 function shortfall(){
  const panel=el('section',null,'live-gift-shortfall'),wallet=el('span',null,'live-gift-wallet');wallet.setAttribute('aria-hidden','true');
  wallet.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M17 12h4v5h-4a2.5 2.5 0 0 1 0-5ZM4 6V4h14v2"/></svg>';
  const text=el('div',null,'live-gift-shortfall-text');text.append(el('strong','Balans kifayət etmir'),el('span',money(quote.balanceCents)+' var · '+money(Math.max(0,quote.totalCents-quote.balanceCents))+' çatmır'));
  const add=button('+ Artır',()=>{draft.stage='payment';leave('/balans?returnTo=%2Fqrup&flow=gift#balansi-artir');},'primary');
  panel.append(wallet,text,add,el('p','Balansını artır, sonra qayıdıb hədiyyəni tamamla.','live-gift-shortfall-note'));return panel;
 }
 function payment(item){
  draft.stage='payment';persist();
  screen.replaceChildren(...(!draft.attempt?[toolbar('← Paketlər',packages)]:[]),recipientLine(),hero(),totalLine());
  if(quote.balanceCents===null){screen.append(button('Daxil ol',()=>leave('/hesab?next=%2Fqrup'),'primary live-gift-submit'));return;}
  if(quote.balanceCents<quote.totalCents&&!draft.attempt){screen.append(shortfall());return;}
  screen.append(el('p','Balansla ödə · '+money(quote.balanceCents),'live-gift-balance'));
  const label=el('label',null,'live-gift-consent'),consent=el('input');consent.type='checkbox';consent.checked=!!draft.attempt;label.append(consent,el('span','Sifariş şərtlərini təsdiqləyirəm.'));
  const terms=el('p',item.terms||'','live-gift-terms');screen.append(terms,label);
  const pay=button((draft.attempt?'Ödənişin nəticəsini yenidən yoxla':'Ödə və hədiyyə et')+' · '+money(draft.attempt?.expectedTotalCents??quote.totalCents),guard(async()=>{
   if(!consent.checked)throw Error('Sifariş şərtlərini təsdiqləyin.');pay.disabled=true;modal.close.disabled=true;
   try{
    draft.attempt??={giftRecipient:draft.recipientId,requestId:draft.requestId,mode:'wallet',consentAccepted:true,expectedTotalCents:quote.totalCents,items:[{productId:product.id,planIndex:plan.index,quantity:1,termsVersion:item.termsVersion}]};persist();
    const result=await api('/api/payments/shop/checkout',draft.attempt);
    if(!result.paymentConfirmed)throw Error('Ödənişin təsdiqi gözlənilir. Eyni sorğu ilə yenidən yoxlayın.');
    sessionStorage.removeItem(key);if(!closed)screen.replaceChildren(el('h3','Hədiyyəniz qeydə alındı 🎁'),el('p','Hədiyyə admin tərəfindən təqdim ediləcək.'));
   }catch(e){if([400,401,403,409,422].includes(e.status)){delete draft.attempt;persist();await summary();}throw e;}finally{pay.disabled=false;modal.close.disabled=false;}
  }),'primary live-gift-submit');screen.append(pay);
 }
 async function summary(){
  const n=++generation;screen.replaceChildren(el('p','Qiymət və balans yoxlanılır…'));
  try{quote=await api('/api/payments/shop/quote',{giftRecipient:draft.recipientId,items:[{productId:product.id,planIndex:plan.index,quantity:1}]});}catch(e){if(!closed&&n===generation)screen.replaceChildren(toolbar('← Paketlər',packages),button('Yenidən cəhd et',guard(summary)));throw e;}
  if(closed||n!==generation)return;
  if(draft.attempt&&draft.buyerKey&&draft.buyerKey!==quote.buyerKey){screen.replaceChildren(el('p','Bu hədiyyəni başladığınız hesaba daxil olun.'),button('Daxil ol',()=>leave('/hesab?next=%2Fqrup')));return;}draft.buyerKey=quote.buyerKey;
  if(draft.attempt&&draft.attempt.expectedTotalCents!==quote.totalCents)error.textContent='Əvvəlki ödənişin nəticəsini yoxlamaq üçün eyni sorğu təkrar göndəriləcək.';
  const item=quote.items[0];
  if((item.available===0||item.salesDisabled)&&!draft.attempt){screen.replaceChildren(toolbar('← Paketlər',packages),hero(),el('p','Stokda yoxdur. Başqa paket seçin.'));return;}
  if(draft.stage==='payment'){payment(item);return;}
  screen.replaceChildren(...(!draft.attempt?[toolbar('← Paketlər',packages)]:[]),recipientLine(),hero(),totalLine(),button('Ödə və hədiyyə et',()=>payment(item),'primary live-gift-submit'));persist();
 }
 async function load(){
  screen.replaceChildren(el('p','Məhsullar yüklənir…'));
  if(draft.attempt){const status=await api('/api/payments/shop/gift-status?requestId='+encodeURIComponent(draft.requestId));if(closed)return;if(status.paymentConfirmed){sessionStorage.removeItem(key);screen.replaceChildren(el('h3','Hədiyyəniz qeydə alındı 🎁'),el('p','Hədiyyə admin tərəfindən təqdim ediləcək.'));return;}}
  data=await api('/api/community/influencer-catalog?recipientId='+encodeURIComponent(draft.recipientId));if(closed)return;
  box.querySelector('h2').textContent=data.recipient.name+' üçün hədiyyə seç';box.setAttribute('aria-label',data.recipient.name+' üçün hədiyyə seç');
  product=data.products.find(p=>p.id===draft.productId);plan=product?.plans.find(p=>p.index===draft.planIndex);
  if(plan)await summary();else if(product)packages();else list();
 }
 try{await load();}catch(e){if(!closed){error.textContent=e.message;screen.replaceChildren(button('Yenidən cəhd et',guard(load)));}}
 return modal;
}
