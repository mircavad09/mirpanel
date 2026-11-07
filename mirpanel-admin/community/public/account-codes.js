export function mountCodes({content,el,button,initial,initialRequest,validate,onData}){
 const life=new AbortController(),status=el('p',{role:'status'}),list=el('div',{class:'browser-orders-list'}),heading=el('h1',{},'Kodlarım');
 content.replaceChildren(heading,status,list);
 if(!initial)list.append(el('div',{class:'account-skeleton','aria-busy':'true','aria-label':'Kod məlumatı'}));
 async function read(id=''){
  const r=await fetch('/api/payments/my-orders/codes'+(id?'/'+encodeURIComponent(id):''),{cache:'no-store',signal:life.signal});
  if(!r.ok)throw Object.assign(Error('Məlumatı açmaq mümkün olmadı.'),{status:r.status});
  return r.json();
 }
 function make(row){
  const item=el('article',{class:'browser-order account-code'}),head=el('div',{class:'browser-order-header'}),text=el('pre',{class:'account-code-text',hidden:true}),photo=el('span',{class:'browser-order-image'}),feedback=el('span',{role:'status'});
  try{const u=new URL(row.image,location.origin);if(row.image&&['http:','https:'].includes(u.protocol)){const image=el('img',{src:u.href,alt:'',loading:'lazy'});image.onerror=()=>image.remove();photo.append(image);}}catch{}
  const day=row.deliveredAt?new Intl.DateTimeFormat('az-AZ',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Baku'}).format(new Date(row.deliveredAt)):'';
  head.append(photo,el('div',{},el('strong',{},row.title),el('p',{},[row.plan,row.quantity>1?row.quantity+' ədəd':'',day].filter(Boolean).join(' · '))));
  const toggle=button('Göstər',async()=>{
   feedback.textContent='';
   if(!text.hidden){hide();return;}
   toggle.disabled=true;
   try{const result=await read(row.id);if(!item.isConnected||document.hidden||life.signal.aborted)return;text.textContent=result.text;text.hidden=false;toggle.textContent='Gizlət';toggle.setAttribute('aria-expanded','true');text.scrollIntoView({block:'nearest'});}
   catch{if(!life.signal.aborted)feedback.textContent='Təhvil məlumatını açmaq mümkün olmadı.';}finally{toggle.disabled=false;}
  });toggle.setAttribute('aria-expanded','false');
  const hide=()=>{text.textContent='';text.hidden=true;toggle.textContent='Göstər';toggle.setAttribute('aria-expanded','false');};
  const copy=button('Kopyala',async()=>{
   copy.disabled=true;feedback.textContent='';
   try{
    const clipboard=navigator.clipboard;
    const getText=async()=>{const result=await read(row.id);if(!item.isConnected||document.hidden||life.signal.aborted||typeof result.text!=='string')throw Error();return result.text;};
    if(clipboard?.write&&typeof ClipboardItem==='function'){
     // Start the write inside the actual click (required by WebKit). The
     // protected response supplies the text later, without a client cache.
     const blob=getText().then(text=>new Blob([text],{type:'text/plain'}));
     void blob.catch(()=>{});
     await clipboard.write([new ClipboardItem({'text/plain':blob})]);
    }else if(clipboard?.writeText)await clipboard.writeText(await getText());
    else throw Error();
    feedback.textContent='Məlumat kopyalandı';
   }
   catch{if(!life.signal.aborted)feedback.textContent='Kopyalama alınmadı.';}finally{copy.disabled=false;}
  });
  item.append(head,el('div',{class:'browser-order-actions'},toggle,copy,feedback),text);
  return {item,hide};
 }
 let cards=[],fingerprint=null;
 const hide=()=>{for(const c of cards)c.hide();};
 function paint(data){
  validate?.(data);
  const {codes}=data,next=JSON.stringify(codes);status.replaceChildren(document.createTextNode(codes.length?codes.length+' təhvil qeydi':'Hələ kodunuz yoxdur.'));
  if(next!==fingerprint){fingerprint=next;hide();cards=codes.map(make);list.replaceChildren(...cards.map(c=>c.item));}
  onData?.(data);
 }
 async function load(started=null){
  try{
   const data=await(started||read());if(life.signal.aborted)return;paint(data);
  }catch(e){if(!life.signal.aborted){
   if(fingerprint===null||e.status===401||e.status===403){hide();cards=[];fingerprint=null;list.replaceChildren();onData?.(null);}
   status.replaceChildren(document.createTextNode('Kodları yükləmək mümkün olmadı. '),button('Yenidən cəhd et',()=>load()));
  }}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();},{signal:life.signal});
 window.addEventListener('pagehide',hide,{signal:life.signal});
 if(initial)paint(initial);void load(initialRequest);
 return()=>{life.abort();hide();};
}
