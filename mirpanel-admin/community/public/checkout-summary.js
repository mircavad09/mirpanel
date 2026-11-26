// Wait for the summary shell once, then perform one scroll with the real sticky-header offset.
export async function scrollCheckoutTarget(id){
 let target=document.getElementById(id);
 if(!target)target=await new Promise(resolve=>{const observer=new MutationObserver(()=>{const n=document.getElementById(id);if(n){observer.disconnect();clearTimeout(timer);resolve(n);}}),timer=setTimeout(()=>{observer.disconnect();resolve(null);},2000);observer.observe(document.body,{childList:true,subtree:true});});
 if(!target)return;
 await Promise.all([...document.querySelectorAll('link[data-checkout-summary-style],link[data-checkout-unified-style],link[data-cart-upper-style]')].map(link=>link.sheet?null:new Promise(resolve=>{const done=()=>{clearTimeout(timer);resolve();};const timer=setTimeout(done,1500);link.addEventListener('load',done,{once:true});link.addEventListener('error',done,{once:true});})));
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 target=document.getElementById(id);if(!target)return;
 const header=document.querySelector('.site-header'),fixed=header&&['fixed','sticky'].includes(getComputedStyle(header).position),offset=fixed?Math.ceil(header.getBoundingClientRect().height)+12:12;
 window.scrollTo({top:Math.max(0,scrollY+target.getBoundingClientRect().top-offset),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
}
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const money=c=>Number.isSafeInteger(c)?(c/100).toFixed(2).replace('.',',')+' ₼':'—';
function artwork(item){
 const box=node('span',null,'order-summary-art'),img=node('img');img.alt='';img.width=56;img.height=40;
 const fallback=()=>box.replaceChildren(node('span','□','order-summary-placeholder'));
 try{const url=new URL(item.image,location.origin);if(!item.image||!['https:','http:'].includes(url.protocol))throw Error();img.src=url.href;img.onerror=fallback;box.append(img);}catch{fallback();}return box;
}
function warranty(item){
 if(item.warrantyMode==='none')return '';
 if(item.warrantyMode==='guaranteed')return item.warrantyText|| (Number.isSafeInteger(item.warrantyDuration)&&item.warrantyDuration>0?item.warrantyDuration+' '+(item.warrantyUnit==='day'?'gün':'ay')+' zəmanət':'');
 return /zəmanətsiz/iu.test(item.planName||'')?'':(/\d+\s*(?:gün|ay)\s*zəmanət(?:li)?/iu.exec(item.planName||'')?.[0]||'');
}
// Quote is the same verified object used by the cart and existing checkout.
// Reference prices explain a genuine discount; payable totals are never recomputed.
export function renderCheckoutSummary(quote,{onEdit,confirmed=true}={}){
 if(!document.querySelector('link[data-checkout-summary-style]')){const css=node('link');css.rel='stylesheet';css.href='/community-assets/checkout-summary.css?v=compact-scroll-3';css.dataset.checkoutSummaryStyle='';document.head.append(css);}
 const section=node('section',null,'shop-card order-summary');section.id='mirpanel-order-summary';section.tabIndex=-1;
 const head=node('header'),count=quote.items.reduce((n,x)=>n+x.quantity,0),edit=node('a','Dəyiş ↑','order-summary-edit');edit.href='#mirpanel-cart-edit';
 edit.onclick=e=>{const target=document.getElementById('mirpanel-cart-edit')||document.querySelector('.shop-checkout-cart');if(onEdit||target){e.preventDefault();if(onEdit)onEdit();else void scrollCheckoutTarget('mirpanel-cart-edit');}};
 head.append(node('h2','Sifarişiniz · '+count+' məhsul'),edit);section.append(head);
 const list=node('div',null,'order-summary-items');
 for(const item of quote.items){const row=node('article',null,'order-summary-item'),info=node('div',null,'order-summary-info');
  info.append(node('strong',item.title||item.productId),node('small',(item.planName||item.plan_name||'')+(item.quantity>1?' · '+item.quantity+' ədəd':'')));
  const guarantee=warranty(item);if(guarantee)info.append(node('small',guarantee+' · təhvildən sonra','order-summary-warranty'));
  row.append(artwork(item),info,node('strong',Number.isSafeInteger(item.unitCents)?money(item.unitCents*item.quantity):'—','order-summary-price'));list.append(row);
 }
 section.append(list);const totals=node('dl',null,'order-summary-totals');
 const saving=confirmed?quote.items.reduce((n,x)=>n+(Number.isSafeInteger(x.oldUnitCents)&&Number.isSafeInteger(x.unitCents)&&x.oldUnitCents>x.unitCents?(x.oldUnitCents-x.unitCents)*x.quantity:0),0):0;
 const add=(label,value,cls)=>{const row=node('div',null,cls);const term=node('dt',label),amount=node('dd');if(cls==='order-summary-reference')amount.append(node('del',value));else amount.textContent=value;if(cls==='order-summary-discount'){const icon=node('span',null,'order-summary-discount-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m7 17 10-10"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>';term.prepend(icon);}row.append(term,amount);totals.append(row);};
 add('Məhsulların qiyməti',money(Number.isSafeInteger(quote.totalCents)?quote.totalCents+saving:null),saving>0?'order-summary-reference':'order-summary-base');
 if(saving>0)add('Endirim','−'+money(saving),'order-summary-discount');
 add('Cəmi',money(quote.totalCents),'order-summary-total');section.append(totals);return section;
}
