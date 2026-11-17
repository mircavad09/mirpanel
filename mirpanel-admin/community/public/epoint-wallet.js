const base='/api/payments/epoint/';
const storeKey='mirpanel.epoint.wallet.v1';
const refPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const validRef=value=>typeof value==='string'&&refPattern.test(value);
function readDraft(){
 try{const d=JSON.parse(sessionStorage.getItem(storeKey));return validRef(d?.ref)?d:null;}catch{return null;}
}
function clearDraft(ref){try{if(readDraft()?.ref===ref)sessionStorage.removeItem(storeKey);}catch{}}
const resultPath=ref=>'/odenis/epoint/ugurlu?ref='+encodeURIComponent(ref);
async function api(route,options={}){
 const r=await fetch(base+route,{cache:'no-store',credentials:'same-origin',...options});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(data.error||'Epoint xidməti cavab vermədi.'),{status:r.status});
 return data;
}
export async function mountEpointWallet({form,accountId,getCents,signal,back,el,button,link}){
 const block=el('div',null,'shop-actions'),notice=el('p',null,'shop-muted');
 notice.setAttribute('role','status');
 const active=()=>{const d=readDraft();return d?.accountId===accountId?d:null;};
 const statusLink=()=>{const d=active();return d?link('Epoint ödənişinin vəziyyəti',resultPath(d.ref)):null;};
 let checking=statusLink();if(checking)block.append(checking);
 form.append(block,notice);
 let enabled=false;
 try{enabled=(await api('status',{signal})).enabled===true;}catch{}
 if(signal.aborted||!enabled)return;
 const start=button('Epoint ilə ödə',async()=>{
  if(start.disabled||signal.aborted)return;
  let d=active(),cents;
  try{cents=d?.cents??getCents();}catch(e){notice.textContent=e.message;return;}
  start.disabled=true;notice.textContent='Epoint ödəniş səhifəsi hazırlanır…';
  try{
   if(!d){d={ref:crypto.randomUUID(),accountId,cents,back:back==='/qrup'?back:null};sessionStorage.setItem(storeKey,JSON.stringify(d));}
   const response=await api('start',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:d.ref,amount:(cents/100).toFixed(2)})});
   if(signal.aborted)return;
   if(response.state==='ready'){location.assign(response.redirect);return;}
   if(response.state==='credited'){location.assign(resultPath(d.ref));return;}
   if(response.state==='declined'){clearDraft(d.ref);notice.textContent='Epoint ödənişi başlatmadı. Məbləği yoxlayıb yenidən cəhd edə bilərsiniz.';return;}
   notice.textContent='Ödəniş başlatma nəticəsi gözlənilir. Vəziyyəti yoxlayın.';
  }catch(e){
   if(!signal.aborted){
    if([400,415].includes(e.status)&&d)clearDraft(d.ref);
    notice.textContent=e.status?e.message:'Epoint ilə əlaqə alınmadı. Eyni ödənişin vəziyyətini yoxlayın.';
   }
  }finally{
   if(!signal.aborted){checking?.remove();checking=statusLink();if(checking)block.append(checking);setLabel();start.disabled=false;}
  }
 },true);
 function setLabel(){
  const d=active();
  start.textContent=d?'Epoint ödənişinə davam et · '+(d.cents/100).toFixed(2).replace('.',',')+' ₼':'Epoint ilə ödə';
 }
 setLabel();
 block.prepend(start);
}

export async function showEpointReturn(doc=document){
 const main=doc.querySelector('[data-epoint-return]');
 if(!main)return;
 const title=main.querySelector('h1'),message=main.querySelector('[data-epoint-message]'),check=main.querySelector('[data-epoint-check]'),login=main.querySelector('[data-epoint-login]');
 const supplied=new URLSearchParams(location.search).get('ref'),draft=readDraft(),ref=supplied===null?draft?.ref:supplied;
 if(!validRef(ref))return;
 const back=main.querySelector('[data-epoint-back]');
 if(draft?.ref===ref&&draft.back==='/qrup'){back.href='/qrup';back.textContent='Hədiyyəyə qayıt';}
 login.href='/hesab?next='+encodeURIComponent(resultPath(ref));
 const finish=(heading,copy)=>{title.textContent=heading;message.textContent=copy;doc.title=heading+' — MirPanel';};
 let stopped=false,running=false,timer=null,count=0;
 async function refresh(){
  if(stopped||running)return;
  clearTimeout(timer);running=true;check.disabled=true;login.hidden=true;
  try{
   const data=await api('status?ref='+encodeURIComponent(ref),{signal:AbortSignal.timeout(8000)});
   if(data.status==='success'&&Number.isSafeInteger(data.cents)&&data.cents>0){
    clearDraft(ref);stopped=true;check.hidden=true;
    finish('Balansınız uğurla artırıldı',new Intl.NumberFormat('az-AZ',{style:'currency',currency:'AZN'}).format(data.cents/100)+' balansınıza əlavə edildi.');
   }else if(data.status==='failed'){
    clearDraft(ref);stopped=true;check.hidden=true;
    finish('Ödəniş tamamlanmadı','Bu əməliyyat üzrə balans artırılmadı. Vəsait çıxılıbsa, yenidən ödəməzdən əvvəl dəstəyə müraciət edin.');
   }else{
    finish('Ödənişin təsdiqi gözlənilir','Ödəniş hələ balansınıza əlavə edilməyib. Vəziyyəti yenidən yoxlaya bilərsiniz.');
    if(++count<6)timer=setTimeout(refresh,4000);
   }
  }catch(e){
   if(e.status===401){login.hidden=false;finish('Ödəniş vəziyyətini yoxlayın','Nəticəni görmək üçün ödənişi başladığınız hesabla daxil olun.');}
   else if(e.status===404)finish('Ödəniş tapılmadı','Ödənişi başladığınız hesabla daxil olduğunuzu yoxlayın.');
   else finish('Ödəniş vəziyyəti alınmadı','Vəziyyəti yenidən yoxlayın. Təkrar ödəniş etməyə tələsməyin.');
  }finally{running=false;check.disabled=false;}
 }
 check.hidden=false;check.addEventListener('click',()=>{count=0;void refresh();});
 window.addEventListener('pagehide',()=>clearTimeout(timer),{once:true});
 await refresh();
}
if(typeof document!=='undefined'&&document.querySelector('[data-epoint-return]'))void showEpointReturn();
