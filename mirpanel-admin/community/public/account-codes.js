import {linkDeliveryMessage} from '/delivery-message.mjs?v=account-delivery-blue-1';
const paths={
 key:'M14.5 3a5.5 5.5 0 0 0-5.1 7.6L3 17v4h4v-3h3v-3l2.4-2.4A5.5 5.5 0 1 0 14.5 3Z M16 8h.01',
 search:'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM16 16l4 4',
 eye:'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
 hide:'M3 3l18 18M10 6.2c.6-.1 1.3-.2 2-.2 6.5 0 10 6 10 6a16 16 0 0 1-3 3.5M6 7.5A17 17 0 0 0 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.9-.8',
 copy:'M8 8h12v12H8z M16 8V4H4v12h4',
 box:'m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5m-9 5v10'
};
const date=new Intl.DateTimeFormat('az-AZ',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Baku'});
const normalize=value=>String(value||'').normalize('NFC').toLocaleLowerCase('az').replace(/ı/g,'i').trim();
function icon(name){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),p=document.createElementNS(svg.namespaceURI,'path');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');p.setAttribute('d',paths[name]);svg.append(p);return svg;
}
// Prefer the structured delivery fields. Keep labeled lines readable on older records.
// The copy action never uses the extracted values.
function credentialRows(delivery){
 const rows=new Map();
 for(const line of delivery.text.split(/\r?\n/)){
  const m=line.match(/^\s*(e[ -]?poçt|e[ -]?mail|mail|şifrə|parol|password)\s*:\s*(\S+.*?)\s*$/iu);
  if(m){const key=/^(e|m)/i.test(m[1])?'E-poçt':'Şifrə';if(!rows.has(key))rows.set(key,m[2]);}
 }
 const fields=[
  ['E-poçt',delivery.email||rows.get('E-poçt')],
  ['Şifrə',delivery.password||rows.get('Şifrə')],
  ['Otaq adı',delivery.netflixRoom?.name],
  ['Otaq kodu',delivery.netflixRoom?.code]
 ];
 return fields.filter(([,value])=>typeof value==='string'&&value.trim());
}
export function mountCodes({content,el,button,initial,initialRequest,validate,onData,onUnauthorized,api,spinner,ui={}}){
 const css='/community-assets/account-codes.css?v=account-delivery-blue-1';
 if(!document.head.querySelector('link[data-account-codes]'))document.head.append(el('link',{rel:'stylesheet',href:css,'data-account-codes':''}));
 const life=new AbortController(),root=el('div',{class:'account-codes'}),status=el('p',{class:'codes-status',role:'status'}),list=el('div',{class:'codes-list'}),count=el('span',{class:'codes-count',hidden:''});
 const search=el('input',{type:'search',placeholder:'Məhsul adına görə axtar…','aria-label':'Məhsul adına görə axtar',autocomplete:'off'});
 const filters=el('div',{class:'codes-filters',role:'group','aria-label':'Məhsul kateqoriyaları'});
 const tools=el('div',{class:'codes-tools',hidden:''},el('label',{class:'codes-search'},icon('search'),search),filters);
 root.append(el('header',{class:'codes-intro'},el('div',{class:'codes-heading'},el('span',{class:'codes-key'},icon('key')),el('h1',{},'Kodlarım'),count),el('p',{},'Aldığınız bütün kodlar və hesab məlumatları bir yerdə')),tools,status,list);
 content.replaceChildren(root);
 const loading=()=>spinner?.()||el('div',{class:'account-skeleton','aria-busy':'true','aria-label':'Kod məlumatı'});
 if(!initial)list.append(loading());
 async function read(id=''){
  if(api)return api('/api/payments/my-orders/codes'+(id?'/'+encodeURIComponent(id):''));
  const r=await fetch('/api/payments/my-orders/codes'+(id?'/'+encodeURIComponent(id):''),{cache:'no-store',signal:life.signal});
  if(!r.ok)throw Object.assign(Error('Məlumatı açmaq mümkün olmadı.'),{status:r.status});
  return r.json();
 }
 const deliveries=new Map(),pending=new Map();
 let deliveryGeneration=0;
 const clearDeliveries=()=>{deliveryGeneration++;deliveries.clear();pending.clear();};
 function readDelivery(id){
  if(deliveries.has(id))return Promise.resolve(deliveries.get(id));
  if(pending.has(id))return pending.get(id);
  const generation=deliveryGeneration;
  const request=read(id).then(result=>{
   if(life.signal.aborted||generation!==deliveryGeneration||typeof result?.text!=='string')throw Error();
   deliveries.set(id,result);return result;
  }).catch(e=>{
   if(!life.signal.aborted&&generation===deliveryGeneration&&(e.status===401||e.status===403)){
    clearDeliveries();hide();
    if(e.status===401)onUnauthorized?.();
   }
   throw e;
  }).finally(()=>{if(pending.get(id)===request)pending.delete(id);});
  pending.set(id,request);return request;
 }
 function make(row,i){
  const item=el('article',{class:'account-code codes-card'}),text=el('pre',{class:'codes-text'}),credentials=el('div',{class:'codes-credentials'}),photo=el('span',{class:'codes-image'},icon('box')),feedback=el('span',{class:'codes-feedback',role:'status'});
  const details=el('div',{class:'codes-details',id:'codes-details-'+i,hidden:''},credentials,text);
  try{const u=new URL(row.image,location.origin);if(row.image&&['http:','https:'].includes(u.protocol)){const image=el('img',{src:u.href,alt:'',loading:'lazy'});image.onerror=()=>image.remove();photo.append(image);}}catch{}
  const stamp=Date.parse(row.purchasedAt);
  const meta=el('p',{class:'codes-meta'},row.plan||'');
  if(Number.isFinite(stamp))meta.append(row.plan?' · ':'',el('time',{datetime:new Date(stamp).toISOString(),title:'Alış tarixi · Bakı vaxtı'},date.format(stamp)));
  if(row.quantity>1)meta.append(' · '+row.quantity+' ədəd');
  let revision=0;
  const active=()=>item.isConnected&&!item.hidden&&!document.hidden&&!life.signal.aborted;
  const toggleLabel=show=>{toggle.replaceChildren(icon(show?'hide':'eye'),show?'Gizlət':'Göstər');toggle.setAttribute('aria-expanded',String(show));};
  const hide=()=>{revision++;text.textContent='';credentials.replaceChildren();details.hidden=true;feedback.textContent='';toggle.removeAttribute('aria-busy');toggle.disabled=false;toggleLabel(false);};
  const getDelivery=async()=>{const result=await readDelivery(row.id);if(!active()||deliveries.get(row.id)!==result)throw Error();return result;};
  const reveal=delivery=>{
   text.textContent=delivery.text;
   linkDeliveryMessage(text);
   credentials.replaceChildren(...credentialRows(delivery).map(([label,value])=>el('div',{class:'codes-credential'},el('span',{},label),el('strong',{},value))));
   details.hidden=false;toggleLabel(true);
   if(matchMedia('(max-width: 600px)').matches)details.scrollIntoView({block:'nearest'});
  };
  const toggle=button('Göstər',async()=>{
   feedback.textContent='';
   if(!details.hidden){hide();return;}
   if(!active())return;
   const ready=deliveries.get(row.id);
   if(ready){reveal(ready);return;}
   const run=++revision;toggle.disabled=true;toggle.setAttribute('aria-busy','true');
   feedback.append(el('span',{class:'codes-loading','aria-hidden':'true'}),' Hesab məlumatı hazırlanır…');
   try{
    const delivery=await getDelivery();if(run!==revision)return;
    feedback.textContent='';reveal(delivery);
   }catch{if(active()&&run===revision)feedback.textContent='Təhvil məlumatını açmaq mümkün olmadı. Yenidən cəhd edin.';}
   finally{if(run===revision){toggle.disabled=false;toggle.removeAttribute('aria-busy');}}
  });
  toggle.setAttribute('aria-controls',details.id);toggleLabel(false);
  const copy=button('Kopyala',async()=>{
   copy.disabled=true;feedback.textContent='';
   try{
    const clipboard=navigator.clipboard;
    if(clipboard?.write&&typeof ClipboardItem==='function'){
     // Begin inside the click so WebKit preserves clipboard activation.
     const blob=getDelivery().then(({text})=>new Blob([text],{type:'text/plain'}));
     void blob.catch(()=>{});
     await clipboard.write([new ClipboardItem({'text/plain':blob})]);
    }else if(clipboard?.writeText)await clipboard.writeText((await getDelivery()).text);
    else throw Error();
    if(active())feedback.textContent='Məlumat kopyalandı';
   }catch{if(active())feedback.textContent='Kopyalama alınmadı.';}finally{copy.disabled=false;}
  });copy.classList.add('codes-copy');copy.prepend(icon('copy'));
  item.append(el('div',{class:'codes-product'},photo,el('div',{},el('h2',{},row.title),meta)),el('div',{class:'codes-actions'},toggle,copy),feedback,details);
  return {item,row,hide};
 }
 let cards=[],fingerprint=null,category=ui.category??null,running=false,warmed=false;
 search.value=ui.search||'';
 const hide=()=>{for(const c of cards)c.hide();};
 const empty=el('p',{class:'codes-empty',hidden:''});root.append(empty);
 function filter(){
  ui.search=search.value;ui.category=category;
  const query=normalize(search.value);
  let matches=0;
  for(const c of cards){
   const visible=(!category||c.row.category?.key===category)&&normalize(c.row.title).includes(query);
   if(!visible&&!c.item.hidden)c.hide();
   c.item.hidden=!visible;if(visible)matches++;
  }
  for(const b of filters.children)b.setAttribute('aria-pressed',String((b.dataset.category||null)===category));
  empty.textContent=cards.length?'Axtarışa uyğun məhsul tapılmadı.':'Hələ kodunuz yoxdur.';
  empty.hidden=matches>0;
 }
 function paint(data,fresh=false){
  validate?.(data);
  const {codes}=data,next=JSON.stringify(codes);status.textContent='';
  count.textContent=codes.length+' ədəd';count.hidden=false;tools.hidden=false;
  if(next!==fingerprint){
   if(fingerprint!==null)clearDeliveries();
   fingerprint=next;hide();cards=codes.map(make);list.replaceChildren(...cards.map(c=>c.item));
   const groups=new Map();
   for(const {category:c} of codes)if(c?.key&&c.label){
    const group=groups.get(c.key)||{label:c.label,count:0};group.count++;groups.set(c.key,group);
   }
   if(category&&!groups.has(category))category=null;
   const chip=(key,label,n)=>{const b=button(label+' '+n,()=>{category=key;filter();});if(key)b.dataset.category=key;return b;};
   filters.replaceChildren(chip(null,'Hamısı',codes.length),...[...groups].sort((a,b)=>a[1].label.localeCompare(b[1].label,'az')).map(([key,g])=>chip(key,g.label,g.count)));
  }
  filter();onData?.(data);
  // Prepare only the first visible card, after a fresh owner-validated list.
  // Do not block the list or download every account's credentials in advance.
  const first=cards.find(c=>!c.item.hidden);
  if(fresh&&!warmed&&first&&!document.hidden){warmed=true;void readDelivery(first.row.id).catch(()=>{});}
 }
 search.addEventListener('input',filter,{signal:life.signal});
 async function load(started=null){
  if(running||life.signal.aborted)return;running=true;
  if(fingerprint===null){status.replaceChildren();list.replaceChildren(loading());}
  try{const data=await(started||read());if(!life.signal.aborted)paint(data,true);}
  catch(e){if(!life.signal.aborted){
   if(e.status===401&&onUnauthorized){onUnauthorized();return;}
   if(fingerprint===null||e.status===401||e.status===403){clearDeliveries();hide();cards=[];fingerprint=null;list.replaceChildren();count.hidden=tools.hidden=empty.hidden=true;onData?.(null);}
   status.replaceChildren(document.createTextNode('Kodları yükləmək mümkün olmadı. '),button('Yenidən cəhd et',()=>load()));
  }}finally{running=false;}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();},{signal:life.signal});
 window.addEventListener('pagehide',()=>{clearDeliveries();hide();},{signal:life.signal});
 if(initial)paint(initial);void load(initialRequest);
 return()=>{life.abort();clearDeliveries();hide();root.remove();};
}
