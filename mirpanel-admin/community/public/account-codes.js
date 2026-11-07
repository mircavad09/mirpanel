export function mountCodes({content,el,button}){
 const life=new AbortController(),status=el('p',{role:'status'}),list=el('div',{class:'browser-orders-list'}),heading=el('h1',{},'Kodlarım');
 content.replaceChildren(heading,status,list);
 async function read(id=''){
  const r=await fetch('/api/payments/my-orders/codes'+(id?'/'+encodeURIComponent(id):''),{cache:'no-store',signal:life.signal});
  if(!r.ok)throw Error('Məlumatı açmaq mümkün olmadı.');
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
   try{const result=await read(row.id);if(!item.isConnected||document.hidden||life.signal.aborted)return;await navigator.clipboard.writeText(result.text);feedback.textContent='Məlumat kopyalandı';}
   catch{if(!life.signal.aborted)feedback.textContent='Kopyalama alınmadı.';}finally{copy.disabled=false;}
  });
  item.append(head,el('div',{class:'browser-order-actions'},toggle,copy,feedback),text);
  return {item,hide};
 }
 let cards=[];
 const hide=()=>{for(const c of cards)c.hide();};
 async function load(){
  try{
   const {codes}=await read();if(life.signal.aborted)return;
   status.textContent=codes.length?codes.length+' təhvil qeydi':'Hələ kodunuz yoxdur.';
   cards=codes.map(make);list.replaceChildren(...cards.map(c=>c.item));
  }catch{if(!life.signal.aborted){status.textContent='Kodları yükləmək mümkün olmadı.';list.replaceChildren(button('Yenidən cəhd et',load));}}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();},{signal:life.signal});
 window.addEventListener('pagehide',hide,{signal:life.signal});
 void load();
 return()=>{life.abort();hide();};
}
