import {chatElement as el,chatButton as button,chatModal} from './chat-components.js?v=live-influencers-2';
const key='mirpanel.influencer-gift.v1',money=c=>(Number(c)/100).toFixed(2).replace('.',',')+' ₼';
let open=false;
function read(){try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
function save(draft){try{sessionStorage.setItem(key,JSON.stringify(draft));}catch{}}
async function api(path,data){const c=new AbortController(),timer=setTimeout(()=>c.abort(),25000);try{const r=await fetch(path,{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:c.signal});const v=await r.json();if(!r.ok)throw Object.assign(Error(v.error?.message||v.error||'Sorğu alınmadı. Yenidən cəhd edin.'),{status:r.status});return v;}catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('Bağlantı təsdiqlənmədi. Seçiminiz saxlanılıb; yenidən cəhd edin.');throw e;}finally{clearTimeout(timer);}}
export function resumeInfluencerGift(){const selected=new URLSearchParams(location.search).get('gift');const draft=read();if(selected&&!draft?.attempt){void openLiveGift({id:selected});return;}if(draft?.resume){draft.resume=false;save(draft);void openLiveGift({id:draft.recipientId},draft);}}
export async function openLiveGift(recipient,restored=null){
 if(open)return;open=true;
 let draft=restored||(read()?.attempt?read():null)||{recipientId:recipient.id,requestId:crypto.randomUUID()},data,product,plan,quote,busy=false,closed=false,generation=0;
 const modal=chatModal({title:(recipient.name||'Influencer')+' üçün hədiyyə seç',onClose:()=>{closed=true;generation++;open=false;}}),{body,box}=modal;
 const error=el('p',null,'chat-gift-error');error.setAttribute('role','alert');const screen=el('div');body.append(error,screen);
 const guard=fn=>async()=>{if(busy)return;busy=true;error.textContent='';try{await fn();}catch(e){if(!closed)error.textContent=e.message;}finally{busy=false;}};
 function persist(){save(draft);}
 function leave(href){draft.resume=true;persist();location.assign(href);}
 function list(){screen.replaceChildren(el('h3','Məhsul seçin'));for(const p of data.products){const row=button('',()=>{draft.productId=p.id;delete draft.planIndex;draft.requestId=crypto.randomUUID();persist();product=p;packages();},'live-gift-product');const img=el('img');img.src=p.image;img.alt='';const text=el('span');text.append(el('strong',p.title),el('small',money(Math.min(...p.plans.map(x=>x.cents)))+'-dan başlayır'));row.append(img,text);screen.append(row);}if(!data.products.length)screen.append(el('p','Hədiyyə üçün aktiv məhsul yoxdur.'));}
 function packages(){screen.replaceChildren(button('← Məhsullar',list),el('h3',product.title));for(const p of product.plans){const choose=button(p.label+' · '+money(p.cents),guard(async()=>{draft.planIndex=p.index;draft.requestId=crypto.randomUUID();persist();plan=p;await summary();}),'live-gift-package');choose.disabled=p.available===0;screen.append(choose);} }
 async function summary(){
  const n=++generation;screen.replaceChildren(el('p','Qiymət və balans yoxlanılır…'));
  try{quote=await api('/api/payments/shop/quote',{giftRecipient:draft.recipientId,items:[{productId:product.id,planIndex:plan.index,quantity:1}]});}catch(e){if(!closed&&n===generation){screen.replaceChildren(button('← Paketlər',packages),button('Yenidən cəhd et',guard(summary)));}throw e;}
  if(closed||n!==generation)return;if(draft.attempt&&draft.buyerKey&&draft.buyerKey!==quote.buyerKey){screen.replaceChildren(el('p','Bu hədiyyəni başladığınız hesaba daxil olun.'),button('Daxil ol',()=>leave('/hesab?next=%2Fqrup')));return;}draft.buyerKey=quote.buyerKey;
  if(draft.attempt&&draft.attempt.expectedTotalCents!==quote.totalCents){error.textContent='Əvvəlki ödənişin nəticəsini yoxlamaq üçün eyni sorğu təkrar göndəriləcək.';}
  const item=quote.items[0];screen.replaceChildren(el('h3','Hədiyyə alan — '+data.recipient.name),el('p',product.title+' · '+plan.label),el('strong','Yekun: '+money(quote.totalCents)));
  if(!draft.attempt)screen.append(button('← Paketlər',packages));
  if(item.available===0||item.salesDisabled)screen.append(el('p','Stokda yoxdur. Başqa paket seçin.'));else screen.append(button('Ödə və hədiyyə et',()=>payment()));persist();
  function payment(){
   screen.replaceChildren(el('h3','Hədiyyə alan — '+data.recipient.name),el('p',product.title+' · '+plan.label),el('strong','Cəmi: '+money(draft.attempt?.expectedTotalCents??quote.totalCents)));
   if(quote.balanceCents===null){screen.append(button('Daxil ol',()=>leave('/hesab?next=%2Fqrup')));return;}
   screen.append(el('p','Balansla ödə · '+money(quote.balanceCents)));
   if(quote.balanceCents<quote.totalCents&&!draft.attempt){screen.append(el('p','Balans kifayət etmir'),button('+ Artır',()=>leave('/balans?returnTo=%2Fqrup')));return;}
   const label=el('label'),consent=el('input');consent.type='checkbox';consent.checked=!!draft.attempt;label.append(consent,document.createTextNode(' Sifariş şərtlərini təsdiqləyirəm.'));screen.append(el('p',item.terms||''),label);
   const pay=button((draft.attempt?'Ödənişin nəticəsini yenidən yoxla':'Ödə və hədiyyə et')+' · '+money(draft.attempt?.expectedTotalCents??quote.totalCents),guard(async()=>{
    if(!consent.checked)throw Error('Sifariş şərtlərini təsdiqləyin.');pay.disabled=true;modal.close.disabled=true;
    try{
     draft.attempt??={giftRecipient:draft.recipientId,requestId:draft.requestId,mode:'wallet',consentAccepted:true,expectedTotalCents:quote.totalCents,items:[{productId:product.id,planIndex:plan.index,quantity:1,termsVersion:item.termsVersion}]};persist();
     const result=await api('/api/payments/shop/checkout',draft.attempt);
     if(!result.paymentConfirmed)throw Error('Ödənişin təsdiqi gözlənilir. Eyni sorğu ilə yenidən yoxlayın.');
     sessionStorage.removeItem(key);if(!closed)screen.replaceChildren(el('h3','Hədiyyəniz qeydə alındı 🎁'),el('p','Hədiyyə admin tərəfindən təqdim ediləcək.'));
    }catch(e){if([400,401,403,409,422].includes(e.status)){delete draft.attempt;persist();await summary();}throw e;}finally{pay.disabled=false;modal.close.disabled=false;}
   }),'primary');screen.append(pay);
  }
 }
 async function load(){screen.replaceChildren(el('p','Məhsullar yüklənir…'));if(draft.attempt){const status=await api('/api/payments/shop/gift-status?requestId='+encodeURIComponent(draft.requestId));if(closed)return;if(status.paymentConfirmed){sessionStorage.removeItem(key);screen.replaceChildren(el('h3','Hədiyyəniz qeydə alındı 🎁'),el('p','Hədiyyə admin tərəfindən təqdim ediləcək.'));return;}}data=await api('/api/community/influencer-catalog?recipientId='+encodeURIComponent(draft.recipientId));if(closed)return;box.querySelector('h2').textContent=data.recipient.name+' üçün hədiyyə seç';box.setAttribute('aria-label',data.recipient.name+' üçün hədiyyə seç');product=data.products.find(p=>p.id===draft.productId);plan=product?.plans.find(p=>p.index===draft.planIndex);if(plan)await summary();else if(product)packages();else list();}
 try{await load();}catch(e){if(!closed){error.textContent=e.message;screen.replaceChildren(button('Yenidən cəhd et',guard(load)));}}
 return modal;
}
