const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const money=c=>Number.isSafeInteger(c)?(c/100).toFixed(2).replace('.',',')+' ₼':'—';
const svg=path=>{const n=node('span');n.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';return n;};
export function cartWarranty(x){
 if(x.warrantyMode==='none')return '';
 if(x.warrantyMode==='guaranteed')return x.warrantyText||(Number.isSafeInteger(x.warrantyDuration)&&x.warrantyDuration>0?x.warrantyDuration+' '+(x.warrantyUnit==='day'?'gün':'ay')+' zəmanət':'');
 return /zəmanətsiz/iu.test(x.planName||'')?'':(/\d+\s*(?:gün|ay)\s*zəmanət(?:li)?/iu.exec(x.planName||'')?.[0]||'');
}
// Presentation only: all edits use the existing cart callbacks; quote totals
// remain authoritative. No order/payment request is made by this component.
export function renderCartUpper(quote,{confirmed=true,onQuantity,onRemove,onPayment}={}){
 if(!document.querySelector('link[data-cart-upper-style]')){const c=node('link');c.rel='stylesheet';c.href='/community-assets/cart-upper.css?v=design-20261126';c.dataset.cartUpperStyle='';document.head.append(c);}
 const root=node('section',null,'cart-upper'),head=node('header',null,'cart-upper-head'),count=quote.items.reduce((n,x)=>n+x.quantity,0),jump=node('button',null,'cart-upper-jump');
 const jumpLabel=node('span','Ödənişə keç · ');jumpLabel.append(node('span',money(quote.totalCents),'cart-upper-jump-amount'));
 jump.type='button';jump.append(jumpLabel,node('span',null,'cart-upper-arrow'));jump.disabled=!confirmed||!quote.items.length||!Number.isSafeInteger(quote.totalCents);jump.onclick=()=>onPayment?.();
 jump.lastChild.append(svg('<path d="M12 5v14m-6-6 6 6 6-6"/>'));
 jump.lastChild.setAttribute('aria-hidden','true');
 const title=node('h2');title.append(node('span','Səbət','cart-upper-title'),node('span',' · '+count+' məhsul','cart-upper-count'));head.append(title,jump);root.append(head);
 for(const [index,x]of quote.items.entries()){
  const card=node('article',null,'cart-upper-item'),top=node('div',null,'cart-upper-top'),image=node('img'),info=node('div',null,'cart-upper-info'),price=node('div',null,'cart-upper-price'),foot=node('footer',null,'cart-upper-foot'),controls=node('div',null,'cart-upper-controls');
  image.src=x.image||'/favicon.ico';image.alt=x.title||x.productId;image.width=88;image.height=62;
  const name=node('h3',x.title||x.productId);name.title=x.title||x.productId;
  info.append(name,node('p',x.planName||x.plan_name||'Seçilmiş paket','cart-upper-plan'));
  const warranty=cartWarranty(x);if(warranty){const w=node('small',null,'cart-upper-warranty');w.append(svg('<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>'),node('span',warranty));info.append(w);}
  price.append(node('strong',money(Number.isSafeInteger(x.unitCents)?x.unitCents*x.quantity:null)));
  const discounted=confirmed&&Number.isSafeInteger(x.oldUnitCents)&&Number.isSafeInteger(x.unitCents)&&x.oldUnitCents>x.unitCents;
  if(discounted){price.append(node('del',money(x.oldUnitCents*x.quantity)));foot.append(node('span',money((x.oldUnitCents-x.unitCents)*x.quantity)+' qənaət','cart-upper-saving'));}
  const remove=node('button',null,'cart-upper-remove');remove.type='button';remove.setAttribute('aria-label','Sil: '+(x.title||x.productId));remove.append(svg('<path d="M3 6h18M9 6V3h6v3m-9 0 1 15h10l1-15M10 10v7m4-7v7"/>'));remove.disabled=!confirmed;remove.onclick=()=>onRemove?.(x,index);controls.append(remove);
  if(x.productId!=='mirpanel-token'){
   const qty=node('div',null,'cart-upper-qty'),minus=node('button','−'),plus=node('button','+');
   for(const [button,label,value]of [[minus,'Azalt',x.quantity-1],[plus,'Artır',x.quantity+1]]){button.type='button';button.setAttribute('aria-label',label+': '+(x.title||x.productId));button.onclick=()=>onQuantity?.(x,value,index);}
   minus.disabled=!confirmed||x.quantity<=1;plus.disabled=!confirmed||x.renewalOnly===true||x.quantity>=20||x.available!=null&&x.quantity>=x.available;
   qty.append(minus,node('span',x.quantity),plus);controls.append(qty);
  }
  foot.append(controls);top.append(image,info,price);card.append(top,foot);root.append(card);
 }
 return root;
}
