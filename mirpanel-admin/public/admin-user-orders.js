const node=(tag,text)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;return e;};
const missing='Məlumat saxlanmayıb';
const date=value=>{const n=Date.parse(value);return Number.isFinite(n)?new Intl.DateTimeFormat('az-AZ',{timeZone:'Asia/Baku',dateStyle:'short',timeStyle:'short'}).format(n)+' (Bakı vaxtı)':missing;};
const money=(value,currency='AZN')=>value==null?missing:Number(value).toFixed(2).replace('.',',')+' '+(currency==='AZN'?'₼':currency);
const labels={completed:'Tamamlandı',preparing:'Təhvil gözlənilir',reviewing:'Ödəniş yoxlanılır',cancelled:'Ləğv edildi',rejected:'Rədd edildi',expired:'Vaxtı bitdi',approved:'Ödəniş təsdiqləndi',new_receipt_requested:'Yeni çek gözlənilir'};
const btn=(text,fn)=>{const b=node('button',text);b.type='button';b.className='btn';b.onclick=fn;return b;};
function icon(kind){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',kind==='copy'?'M8 8h12v13H8z M16 8V3H3v13h5':kind==='hide'?'M3 3l18 18 M9 5c6-2 11 7 11 7s-2 4-5 6 M6 6c-3 2-4 6-4 6s5 8 12 7':'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0');s.append(p);return s;}
function links(pre,text){
 let cursor=0;for(const m of text.matchAll(/https?:\/\/[^\s<>"'`]+/giu)){
  let href=m[0];while(/[.,!?;:…]$/.test(href)||/[)\]}]$/.test(href)&&href.split(href.at(-1)).length>href.split({')':'(',']':'[','}':'{'}[href.at(-1)]).length)href=href.slice(0,-1);
  try{const url=new URL(href);if(!['https:','http:'].includes(url.protocol))continue;}catch{continue;}
  pre.append(text.slice(cursor,m.index));const a=node('a',href);a.href=href;a.target='_blank';a.rel='noopener noreferrer';pre.append(a);cursor=m.index+href.length;
 }pre.append(text.slice(cursor));
}
async function copy(text,status){try{await navigator.clipboard.writeText(text);status.textContent='Kopyalandı';}catch{status.textContent='Kopyalama alınmadı. Yenidən cəhd edin.';}}
function fieldRow(field,status){
 const row=node('div'),label=node('strong',field.label),value=node('input');row.className='wu-order-field';value.readOnly=true;value.value=field.value??'';value.type=field.sensitive?'password':'text';value.setAttribute('aria-label',field.label);value.autocomplete='off';
 row.append(label,value);if(field.sensitive){let shown=false;const toggle=btn('',()=>{shown=!shown;value.type=shown?'text':'password';toggle.replaceChildren(icon(shown?'hide':'eye'));toggle.setAttribute('aria-label',field.label+(shown?' gizlət':' göstər'));});toggle.append(icon('eye'));toggle.setAttribute('aria-label',field.label+' göstər');row.append(toggle);}
 const clipboard=btn('',()=>copy(field.value,status));clipboard.append(icon('copy'));clipboard.setAttribute('aria-label',field.label+' kopyala');row.append(clipboard);return row;
}
function section(title){const s=node('section');s.className='wu-order-section';s.append(node('h3',title));return s;}
export function renderUserOrders({target,orders,user,call,valid,initialState={}}){
 const tools=node('div'),search=node('input'),filter=node('select'),list=node('div');tools.className='wu-order-tools';list.className='wu-order-list';search.type='search';search.placeholder='Sifariş nömrəsi və məhsul';search.setAttribute('aria-label',search.placeholder);search.dataset.orderSearch='';search.value=initialState.orderSearch||'';filter.dataset.orderStatus='';filter.setAttribute('aria-label','Sifariş statusu');
 for(const [value,title]of [['','Bütün statuslar'],...Object.entries(labels)]){const option=node('option',title);option.value=value;filter.append(option);}filter.value=initialState.orderStatus||'';
 function draw(){list.replaceChildren();for(const o of orders){if(filter.value&&o.status!==filter.value)continue;const lines=o.items?.length?o.items:[{product:o.product_title,package:o.plan_name,quantity:o.quantity}];if(search.value&&!JSON.stringify([o.order_code,...lines.map(l=>[l.product,l.package])]).toLocaleLowerCase('az').includes(search.value.toLocaleLowerCase('az')))continue;
  const b=btn('',()=>openOrder(o));b.className='wu-order-card';const top=node('div'),items=node('div'),bottom=node('div');top.append(node('strong','№ '+o.order_code),node('span',o.statusLabel||labels[o.status]||'Vəziyyət qeydə alınmayıb'));
  for(const line of lines)items.append(node('p',(line.product||missing)+' · '+(line.package||missing)+' · '+(line.quantity??'—')+' ədəd'));
  bottom.append(node('time',date(o.created_at)),node('strong',money(o.amount,o.currency)));b.append(top,items,bottom);list.append(b);
 }if(!list.childNodes.length)list.append(node('p','Sifariş tapılmadı.'));}
 search.oninput=draw;filter.onchange=draw;tools.append(search,filter);target.append(tools,list);draw();
 async function openOrder(order){
  if(!order.id)return;const dialog=node('dialog');dialog.className='wu-dialog wu-order-dialog';dialog.setAttribute('aria-label','Sifariş № '+order.order_code);const body=node('div'),notice=node('p'),header=node('header'),close=btn('← Sifarişlərə qayıt',()=>{dialog.close();cleanup();});notice.setAttribute('role','status');header.append(node('h2','Sifariş № '+order.order_code),close);dialog.append(header,notice,body);document.body.append(dialog);
  const y=scrollY;let active=true;
  function cleanup(){if(!active)return;active=false;dialog.replaceChildren();dialog.remove();window.scrollTo(0,y);orderButton()?.focus({preventScroll:true});}
  dialog.addEventListener('close',cleanup,{once:true});
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();cleanup();});
  function orderButton(){return [...list.querySelectorAll('button')].find(b=>b.textContent.startsWith('№ '+order.order_code));}
  const current=()=>active&&dialog.isConnected&&valid();dialog.showModal();
  async function read(){body.replaceChildren(node('p','Yüklənir…'));try{const data=await call('/users/'+encodeURIComponent(user.id)+'/orders/'+encodeURIComponent(order.id));if(!current())return;body.replaceChildren();
   const facts=section('Sifariş və ödəniş');facts.append(node('p',(data.customer.name||missing)+' · Müştəri ID-si · '+(data.customer.memberNumber?'#'+data.customer.memberNumber:missing)),node('p',data.statusLabel),node('p','Ödəniş üsulu: '+(data.payment.method||missing)+(data.payment.last4?' · •••• '+data.payment.last4:'')),node('p',data.payment.status),node('p','Cəmi: '+money(data.amount,data.currency)));body.append(facts);
   const products=section('Sifariş məhsulları');for(const line of data.items){const card=node('div');card.className='wu-order-item';card.append(node('strong',line.product||missing),node('p',line.package||missing),node('p',(line.quantity??'—')+' ədəd · Vahid qiyməti: '+money(line.unitCents==null?null:line.unitCents/100,data.currency)),node('p','Məhsul cəmi: '+money(line.unitCents==null||line.quantity==null?null:line.unitCents*line.quantity/100,data.currency)),node('p','Təhvil verilib: '+line.delivered+' · Ləğv edilib: '+(line.cancelled??0)));products.append(card);}body.append(products);
   const dates=section('Tarixlər');for(const [key,label] of [['created','Yaradılıb'],['confirmed','Ödəniş təsdiqlənib'],['delivered','Son təhvil'],['completed','Tamamlanıb'],['cancelled','Ləğv / rədd edilib']])dates.append(node('p',label+': '+date(data.dates[key])));body.append(dates);
   const inputs=section('Müştərinin sifariş zamanı yazdığı məlumatlar');let count=0;for(const line of data.customerFields){inputs.append(node('h4',data.items[line.index]?.product||'Məhsul'));if(!line.fields.length)inputs.append(node('p',missing));for(const field of line.fields){inputs.append(fieldRow(field,notice));count++;}}if(!data.customerFields.length)inputs.append(node('p',missing));body.append(inputs);
   const delivery=section('Müştəriyə faktiki təhvil verilən məlumatlar');if(!data.deliveries.length)delivery.append(node('p',missing));for(const item of data.deliveries){const card=node('article');card.className='wu-order-item';card.append(node('h4',data.items[item.line]?.product||'Məhsul'),node('p',item.quantity+' ədəd · '+date(item.at)));if(item.unavailable)card.append(node('p','Təhvil məlumatı açıla bilmədi.'));else{for(const field of item.fields)card.append(fieldRow(field,notice));if(item.message){const pre=node('pre'),show=btn('Mesaj və təlimatı göstər',()=>{pre.hidden=!pre.hidden;show.textContent=pre.hidden?'Mesaj və təlimatı göstər':'Mesaj və təlimatı gizlət';});pre.hidden=true;links(pre,item.message);card.append(show,btn('Mesajı kopyala',()=>copy(item.message,notice)),pre);}else card.append(node('p','Mesaj: '+missing));}delivery.append(card);}body.append(delivery);
   const cancelled=section('Ləğv və geri ödəniş');cancelled.append(node('p','Səbəb: '+(data.cancellation?.reason||missing)),node('p','Faktiki geri qaytarılıb: '+money(data.refundedCents/100,data.currency)));if(data.cancellation?.refundStatus==='card_pending')cancelled.append(node('p','Kart üzrə geri ödəniş gözlənilir; geri qaytarılmış sayılmır.'));body.append(cancelled);
  }catch(e){if(current())body.replaceChildren(node('p',e.message),btn('Yenidən cəhd et',read));}}
  await read();
 }
}
