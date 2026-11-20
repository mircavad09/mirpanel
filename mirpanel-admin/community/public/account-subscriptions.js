const svgPaths={
 calendar:'M4 5h16v16H4z M8 3v4m8-4v4M4 10h16M8 15h2m4 0h2',
 wallet:'M3 6h17v13H3z m0 0 14-3v3m3 5h2v4h-5a2 2 0 0 1 0-4z',
 warning:'M12 3 2 21h20ZM12 9v5m0 3h.01',
 refresh:'M20 8a8 8 0 1 0 0 8m0-13v5h-5',
 box:'m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5m-9 5v10'
};
const icon=kind=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg'),p=document.createElementNS(s.namespaceURI,'path');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');p.setAttribute('d',svgPaths[kind]);s.append(p);return s;};
export const urgency=days=>days>=11?'green':days>=8?'orange':days>=4?'amber':'red';
const azMoney=cents=>(cents/100).toFixed(2).replace('.',',')+' ₼';
const knownPrice=cents=>Number.isSafeInteger(cents)&&cents>=0;
const dayLabel=days=>days===0?'Bu gün bitir':days+' gün qaldı';
export function summarize(rows){
 const active=rows.filter(x=>Number.isInteger(x.days)&&x.days>=0);
 const soon=active.filter(x=>x.days<=30);
 let total=0,unpriced=0,estimated=0;
 for(const row of soon){
  if(knownPrice(row.renewalCents))total+=row.renewalCents;
  else if(knownPrice(row.lastPurchaseCents)){total+=row.lastPurchaseCents;estimated++;}
  else unpriced++;
 }
 return {active:active.length,soon:soon.length,week:active.filter(x=>x.days<=7).length,unpriced,estimated,total:soon.length&&unpriced===soon.length?null:total};
}
export function mountSubscriptions({content,el,button,link,api,validate,initial,initialRequest,onData,onUnauthorized,spinner,readOnly=false}){
 const life=new AbortController(),root=el('div',{class:'account-subscriptions'}),count=el('span',{class:'subs-count',hidden:''}),body=el('div',{class:'subs-body'}),notice=el('p',{class:'subs-notice',role:'status'});
 const css='/community-assets/account-subscriptions.css?v=scheduled-renewals-1';
 if(!document.head.querySelector('link[data-subscriptions]'))document.head.append(el('link',{rel:'stylesheet',href:css,'data-subscriptions':'','data-shell-persistent':''}));
 const heading=el('header',{class:'subs-panel'},el('div',{class:'subs-heading'},el('span',{class:'subs-icon'},icon('calendar')),el('h1',{},'Abunəliklərim'),count),el('p',{},'Abunəliklərinizin nə vaxt bitdiyini bir baxışda görün'));
 root.append(heading,notice,body);content.replaceChildren(root);
 const loading=()=>spinner?.()||el('div',{class:'account-skeleton','aria-label':'Abunəliklər yoxlanılır','aria-busy':'true'});
 let running=false,dialog=null,soonOnly=false,deepLinkHandled=false;
 const alive=()=>!life.signal.aborted&&root.isConnected;
 function picker(row){
  return scheduledPicker(row);
 }
 function scheduledPicker(row){
  if(dialog?.open)return;
  const d=el('dialog',{class:'subs-picker','aria-label':'Yenilənməni planlaşdır'});dialog=d;
  const status=el('p',{role:'status'}),options=el('div',{class:'subs-options'}),details=el('div',{class:'subs-renewal-preview'});
  const close=button('×',()=>d.close());close.className='subs-close';close.setAttribute('aria-label','Bağla');
  const mode=el('select',{'aria-label':'Ödəniş üsulu'},el('option',{value:'prepaid'},'İndi balansdan ödə'),el('option',{value:'auto_wallet'},'Müddət bitəndə balansdan ödə'));
  const consent=el('input',{type:'checkbox'}),label=el('label',{},consent,' Göstərilən paketə və məbləğə razıyam. Avtomatik üsul seçsəm, yalnız bu yenilənmə üçün müddət bitəndə balansdan tutulmasına və balans çatmadıqda təkrar yoxlanmasına razılıq verirəm.');
  let selected,q,seq=0,pending=false,requestId=crypto.randomUUID();
  const next=button('Yenilənməni təsdiqlə',async()=>{
   if(!q||!consent.checked||pending)return;pending=true;next.disabled=true;mode.disabled=true;options.inert=true;status.textContent='Yoxlanılır…';
   try{const r=await api('/api/payments/shop/renewal',{sourceId:row.id,planIndex:selected.index,mode:mode.value,consent:true,expectedCents:q.cents,expectedDueAt:q.dueAt,requestId});status.textContent=r.status;d.close();void load(true);}
   catch(e){status.textContent=e.message||'Nəticə təsdiqlənmədi. Eyni seçimlə yenidən cəhd edin.';}
   finally{pending=false;mode.disabled=false;options.inert=false;next.disabled=!consent.checked||!q;}
  });next.disabled=true;
  consent.onchange=()=>next.disabled=!consent.checked||!q||pending;
  mode.onchange=()=>{requestId=crypto.randomUUID();consent.checked=false;next.disabled=true;};
  for(const option of row.options){const choose=button('',async()=>{
   selected=option;q=null;consent.checked=false;requestId=crypto.randomUUID();next.disabled=true;const token=++seq;status.textContent='Paket yoxlanılır…';
   for(const child of options.children)child.setAttribute('aria-pressed',String(child===choose));
   try{const value=await api('/api/payments/shop/renewal',{action:'quote',sourceId:row.id,planIndex:option.index});if(token!==seq||!d.open)return;q=value;details.replaceChildren(el('p',{},value.plan+' · '+azMoney(value.cents)),el('p',{},'Planlaşdırılan başlanğıc: '+new Date(value.dueAt).toLocaleString('az-AZ',{timeZone:'Asia/Baku'})),el('p',{},'Cari xidmət dəyişmir. Yeni müddət faktiki təhvildən başlayır. '+({new_account:'Stokdan yeni hesab təqdim ediləcək.',extend_existing:'Mövcud hesabın müddəti uzadılacaq.',operator:'Operator yeniləməni tamamlayacaq.'}[value.method]||'')));status.textContent='';}
   catch(e){if(token===seq)status.textContent=e.message;}
  });choose.disabled=!option.canRenew;choose.append(el('span',{},option.label),el('strong',{},azMoney(option.cents)));options.append(choose);}
  if(!row.options.length)status.textContent='Hazırda satışda olan paket tapılmadı.';
  if(['reserved','pending','preparing'].includes(row.renewalStatus)){for(const b of options.querySelectorAll('button'))b.disabled=true;status.textContent='Bu abunəlik üçün yeniləmə artıq davam edir.';}
  d.append(el('header',{},el('h2',{},row.title+' — Yenilə'),close),options,details,mode,label,status,el('footer',{},button('Ləğv et',()=>d.close()),next));
  d.addEventListener('close',()=>{seq++;d.remove();if(dialog===d)dialog=null;},{once:true});root.append(d);d.showModal();
 }
 function card(row){
  const photo=el('span',{class:'subs-image'},icon('box'));
  try{const url=new URL(row.image,location.origin);if(row.image&&['https:','http:'].includes(url.protocol)){const img=el('img',{src:url.href,alt:'',loading:'lazy'});img.onerror=()=>img.remove();photo.append(img);}}catch{}
  const known=Number.isInteger(row.days),endingSoon=known&&row.days>=1&&row.days<=7;
  const remaining=el('strong',{class:'subs-days','data-tone':known?urgency(row.days):'unknown'},known?dayLabel(row.days):'Müddət məlum deyil');
  const time=row.expiresOn?el('time',{datetime:row.expiresOn,title:'Bakı vaxtı'},row.expiresOn.split('-').reverse().join('.')):null;
  const rowStatus={reserved:'Ödəniş gözlənilir',pending:'Ödəniş yoxlanılır',preparing:'Hazırlanır',failed:'Son yeniləmə tamamlanmadı'}[row.renewalStatus];
  const expiry=time?el('span',{class:'subs-expiry'},'Bitir: ',time):null;
  const item=el('article',{class:'subs-card','data-ending-soon':endingSoon?'true':undefined},
   el('div',{class:'subs-card-head'},photo,el('div',{class:'subs-product'},el('h2',{},row.title),el('p',{},el('span',{class:'subs-plan'},row.plan),expiry)),remaining));
  if(knownPrice(row.renewalCents))item.append(el('dl',{class:'subs-prices'},el('div',{},el('dt',{},'Cari yeniləmə qiyməti'),el('dd',{},azMoney(row.renewalCents)))));
  if(rowStatus)item.append(el('p',{class:'subs-renew-status'},rowStatus));
  if(known){
   const renew=button('Yenilə',()=>{if(!readOnly)picker(row);});if(readOnly)renew.setAttribute('data-view-disabled','');renew.prepend(icon('refresh'));renew.className='subs-renew';
   if(row.days<=6)renew.dataset.urgent='true';
   const bar=row.progress==null?el('div',{class:'subs-progress subs-progress-unknown','data-tone':urgency(row.days),'aria-hidden':'true'}):el('progress',{class:'subs-progress','aria-label':'Qalan müddət','data-tone':urgency(row.days),max:100,value:row.progress});
   item.append(el('div',{class:'subs-actions'},bar,renew));
  }
  return item;
 }
 function render(rows,renewals=[]){
  const x=summarize(rows);
  count.hidden=false;count.textContent=x.active+' aktiv';
  const list=el('div',{class:'subs-list'}),filterStatus=el('p',{class:'subs-filter-status',role:'status'});
  const toggle=button('Balansı hazırla',()=>{soonOnly=!soonOnly;showRows();});toggle.className='subs-balance';
  function showRows(){
   toggle.setAttribute('aria-pressed',String(soonOnly));
   toggle.textContent=soonOnly?'Hamısını göstər':'Balansı hazırla';
   filterStatus.textContent=soonOnly?'30 gün ərzində bitəcək abunəliklər göstərilir.':'';
   const shown=soonOnly?rows.filter(row=>Number.isInteger(row.days)&&row.days>=0&&row.days<=30):rows;
   list.replaceChildren(...(shown.length?shown.map(card):[el('p',{class:'subs-panel subs-empty'},soonOnly?'30 gün ərzində bitəcək abunəlik yoxdur.':'Aktiv abunəliyiniz yoxdur.')]));
  }
  showRows();
  const summary=el('div',{class:'subs-panel subs-summary'},el('span',{class:'subs-icon'},icon('wallet')),el('div',{},
   el('p',{},'30 gündə yenilənəcək'),el('div',{},el('strong',{},x.total===null?'Qiymət məlum deyil':azMoney(x.total)),el('small',{},' · '+x.soon+' abunəlik')),
   x.unpriced?el('p',{},x.unpriced+' abunəliyin qiyməti məlum deyil; cəmə daxil edilməyib.'):null),toggle);
  const warning=x.week?el('p',{class:'subs-warning'},icon('warning'),x.week+' abunəliyin müddəti bu həftə bitir. Kəsilməməsi üçün indidən yeniləyə bilərsiniz.'):null;
  body.replaceChildren(summary,...(warning?[warning]:[]),filterStatus,list,
   ...(rows.some(row=>row.estimated)?[el('p',{class:'subs-footnote'},'Ayrıca bitmə tarixi saxlanmayıbsa, tarix faktiki təhvil günü və məlum paket müddətindən hesablanır.')]:[]));
  if(renewals.length){const history=el('section',{class:'subs-panel'},el('h2',{},'Yenilənmələr'));for(const r of renewals){const card=el('article',{class:'subs-renewal-history'},el('h3',{},r.title+' · '+r.plan),el('p',{},r.status),el('p',{},'Əvvəlki sifariş № '+r.sourceOrderCode+' · '+azMoney(r.cents)),el('p',{},'Başlanğıc: '+new Date(r.dueAt).toLocaleString('az-AZ',{timeZone:'Asia/Baku'})));if(r.reason)card.append(el('p',{},r.reason));if(r.orderCode)card.append(link('Yeni sifariş № '+r.orderCode,'/profil?tab=sifarislerim&order='+encodeURIComponent(r.orderCode)));if(!readOnly&&!r.orderId&&r.state!=='cancelled'){const cancel=button('Yenilənməni ləğv et',async()=>{if(!confirm('Yenilənmə ləğv edilsin? Ödənilmiş məbləğ balansa qaytarılacaq.'))return;cancel.disabled=true;try{await api('/api/payments/shop/renewal',{action:'cancel',id:r.id});void load(true);}catch(e){notice.textContent=e.message;cancel.disabled=false;}});card.append(cancel);}history.append(card);}body.append(history);}
  const params=new URLSearchParams(location.search),order=params.get('renewOrder');if(!readOnly&&!deepLinkHandled&&order){deepLinkHandled=true;const row=rows.find(r=>r.orderCode===order&&(!params.has('renewLine')||r.sourceLine===Number(params.get('renewLine'))));if(row&&!renewals.some(r=>r.sourceId===row.id&&r.state!=='cancelled'))scheduledPicker(row);else notice.textContent='Uyğun aktiv abunəlik tapılmadı və ya yenilənmə artıq qeydə alınıb.';}
 }
 async function load(background=false,started=null){
  if(running||!alive())return;running=true;
  if(!background){notice.textContent='';body.replaceChildren(loading());}
  try{const result=await(started||api('/api/payments/shop/subscriptions'));if(!alive())return;validate(result);onData?.(result);if(!dialog?.open){render(result.subscriptions,result.renewals);notice.textContent='';}}
  catch(e){if(!alive())return;if(e.status===401&&onUnauthorized){onUnauthorized();return;}
   const retry=button('Yenidən cəhd et',()=>load(background));
   if(!background||[401,403].includes(e.status)){onData?.(null);if(dialog?.open)dialog.close();count.hidden=true;body.replaceChildren(el('div',{class:'subs-panel'},el('p',{},'Abunəliklər alınmadı.'),retry));}
   else notice.replaceChildren('Abunəliklər yenilənmədi. ',retry);
  }
  finally{running=false;}
 }
 const timer=setInterval(()=>{if(!document.hidden&&!dialog?.open)void load(true);},30000);
 if(initial){validate(initial);render(initial.subscriptions,initial.renewals);}
 void load(!!initial,initialRequest);
 return()=>{life.abort();clearInterval(timer);if(dialog?.open)dialog.close();root.remove();};
}
