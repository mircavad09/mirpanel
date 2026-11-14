const el=(t,text)=>{const n=document.createElement(t);if(text!=null)n.textContent=text;return n;},money=v=>(Number(v)/100).toFixed(2)+' AZN',button=(t,fn)=>{const n=el('button',t);n.type='button';n.className='btn';n.onclick=fn;return n;};
import {renderControlsTab} from '/admin-user-controls.js?v=retained-profile-1';
const ledgerDate=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const ledgerMoney=cents=>cents==null?'—':(Number(cents)/100).toFixed(2).replace('.',',')+' ₼';
const pendingWallet=new Map();
function walletCard(entry,memberNumber){
 const card=el('article'),top=el('div'),meta=el('div'),change=el('div');
 const kind=entry.kind,manual=kind==='admin_credit'||kind==='admin_debit',delta=Number(entry.cents);
 const title={admin_credit:'İnzibati əlavə',admin_debit:'İnzibati çıxılma',topup_credit:'Balans artırma',purchase_debit:'Alış',purchase_refund:'Geri ödəniş'}[kind]||'Əməliyyat';
 const amount=el('strong',(delta>0?'+':'')+ledgerMoney(entry.cents));
 card.className='wu-ledger-card';top.className='wu-ledger-top';meta.className='wu-ledger-meta';change.className='wu-ledger-change';
 amount.className='wu-ledger-amount';amount.dataset.sign=delta>0?'positive':delta<0?'negative':'neutral';
 top.append(el('strong',title),amount);card.append(top);
 const defaultReason=kind==='admin_debit'?'Admin tərəfindən balansdan çıxıldı':'Admin tərəfindən balans əlavə edildi',reason=entry.reason?.trim();
 const description=manual?defaultReason:reason;
 if(description){const p=el('p',description);p.className='wu-ledger-description';card.append(p);}
 if(manual&&reason&&reason!==defaultReason){const note=el('p',reason);note.className='wu-ledger-note';card.append(note);}
 const adminName=(manual||kind==='topup_credit')?entry.actor_name?.trim():null;
 if(adminName)meta.append(el('span','Admin · '+adminName));
 if(memberNumber!=null){const badge=el('span','Üzv #'+memberNumber);badge.className='wu-ledger-member';meta.append(badge);}
 const when=Date.parse(entry.created_at);
 if(Number.isFinite(when)){
  const parts=Object.fromEntries(ledgerDate.formatToParts(when).map(({type,value})=>[type,value]));
  const time=el('time',parts.day+'.'+parts.month+'.'+parts.year+' · '+parts.hour+':'+parts.minute);
  time.dateTime=new Date(when).toISOString();time.title='Bakı vaxtı';meta.append(time);
 }
 if(meta.childNodes.length)card.append(meta);
 const balance=(label,cents)=>{const n=el('span');n.append(el('span',label),el('strong',ledgerMoney(cents)));return n;};
 const arrow=el('span','→');arrow.className='wu-ledger-arrow';arrow.setAttribute('aria-hidden','true');
 change.append(balance('Əvvəlki balans',entry.before_cents),arrow,balance('Yeni balans',entry.after_cents));card.append(change);
 return card;
}
const activityDate=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function activity(u,full=false,now=Date.now()){const seen=Date.parse(u.lastSeen);if(!Number.isFinite(seen))return'Aktivlik qeydə alınmayıb';const m=Math.max(1,Math.floor((now-seen)/60000));return 'Son aktivlik · '+(full?activityDate.format(seen)+' (Bakı vaxtı)':(m<60?m+' dəqiqə':Math.floor(m/60)+' saat')+' əvvəl');}
function avatar(u){const n=el('span');n.className='wu-avatar';if(u.avatarUrl){const img=el('img');img.src=u.avatarUrl;img.alt='';n.append(img);}else n.textContent=['🌙','🌟','🌿','🦁','💎','🦉','🚀','🌊'][u.avatar]||'🌙';return n;}
function icon(kind){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',kind==='cart'?'M3 3h2l3 12h11l2-8H6 M9 20h.01 M18 20h.01':'M10 3h4l1 3 3 1 3 3v4l-3 1-1 3-3 3h-4l-1-3-3-1-3-3v-4l3-1 1-3 3-3Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0');svg.append(p);return svg;}
export async function mountUsers({root,call,alive,userFilter='all'}){
 const css=document.createElement('link');css.rel='stylesheet';css.href='/admin-wallet-users.css?v=wallet-debit-search-1';document.head.append(css);
 let closed=false,page=1,q='',selected,historyPage=1,historyQ='',historyView='history';const valid=()=>!closed&&alive(),errors=el('p'),wrap=el('div'),detail=el('section'),list=el('div'),query=el('input'),pager=el('span');detail.hidden=true;query.placeholder='Ad, e-poçt və üzv ID-si';const safe=fn=>async(...a)=>{try{await fn(...a);}catch(e){errors.textContent=e.message;}};
 const prev=button('Əvvəlki',()=>{page--;load();}),next=button('Növbəti',()=>{page++;load();});
 function userRow(u,now){
  const tr=el('tr'),identity=el('td'),open=button('',safe(()=>show(u.id)));
  identity.className='wu-identity-cell';open.classList.add('wu-identity');
  open.append(avatar(u),el('strong',u.name),el('small',activity(u,false,now)));identity.append(open);
  const moneyCell=(label,value)=>{const td=el('td'),caption=el('small',label),amount=el('span',money(value));td.className='wu-money-cell';caption.className='wu-mobile-label';amount.className='wu-money';td.append(caption,amount);return td;};
  const discount=el('td','—'),referrals=el('td','—');discount.className=referrals.className='wu-desktop-cell';
  tr.append(identity,discount,referrals,moneyCell('Xərclənib',u.spentCents),moneyCell('Balans',u.balanceCents));
  const actions=el('td'),orders=button('',safe(()=>show(u.id,'orders'))),settings=button('',safe(()=>show(u.id)));
  actions.className='wu-desktop-cell';
  for(const [b,k,label] of [[orders,'cart','sifarişlər'],[settings,'gear','ayarlar']]){b.classList.add('wu-icon');b.append(icon(k));b.setAttribute('aria-label',u.name+' — '+label);}
  actions.append(orders,settings);tr.append(actions);
  const cell=el('td'),details=el('details'),extra=el('div'),links=el('div');
  cell.className='wu-mobile-cell';details.className='wu-mobile-details';extra.className='wu-mobile-extra';links.className='wu-mobile-actions';
  if(u.memberNumber)extra.append(el('span','Üzv ID-si · #'+u.memberNumber));
  if(u.email)extra.append(el('span',u.email));
  links.append(button('Profilə bax',safe(()=>show(u.id))),button('Sifarişlər',safe(()=>show(u.id,'orders'))));
  extra.append(links);details.append(el('summary','Ətraflı və əməliyyatlar'),extra);cell.append(details);tr.append(cell);return tr;
 }
 let listRequest=0,searchTimer,showRequest=0,activeTab='balance',profileRead,refreshTimer;const tabsCache=new Map(),reads=new Map();
 const coalesced=path=>{if(reads.has(path))return reads.get(path);const promise=Promise.resolve().then(()=>call(path)).finally(()=>{if(reads.get(path)===promise)reads.delete(path);});reads.set(path,promise);return promise;};
 async function load(){
  const request=++listRequest, requestedPage=page;
  errors.textContent='';list.setAttribute('aria-busy','true');prev.disabled=next.disabled=true;
  try{
   const r=await coalesced('/users?'+new URLSearchParams({q,page:requestedPage,filter:userFilter}));
   if(!valid()||request!==listRequest)return;
   if(requestedPage>1&&!r.users.length){
    page=Math.max(1,Math.ceil(r.total/20));return load();
   }
   const now=Date.parse(r.asOf)||Date.now();
   const table=el('table'),head=el('tr');table.className='wu-user-list';
   for(const label of ['İstifadəçi','Endirim və qiymətlər','Referallar','Xərclənib','Balans',''])head.append(el('th',label));
   table.append(head);for(const u of r.users)table.append(userRow(u,now));list.replaceChildren(table);
   if(!r.users.length)list.append(el('p','İstifadəçi tapılmadı.'));
   pager.textContent=`Səhifə ${requestedPage} · ${r.total}`;prev.disabled=requestedPage===1;next.disabled=!r.hasMore;
  }catch(e){if(valid()&&request===listRequest)errors.replaceChildren(el('span',e.message+' '),button('Yenidən cəhd et',load));}
  finally{if(valid()&&request===listRequest)list.removeAttribute('aria-busy');}
 }
 function searchUsers(delay=0){
  clearTimeout(searchTimer);++listRequest;q=query.value.trim().replace(/^#(?=\d+$)/,'');page=1;
  prev.disabled=next.disabled=true;
  if(delay)searchTimer=setTimeout(load,delay);else void load();
 }
 const content=el('div');let returnY=0;
 function snapshotControls(panel){return {from:panel?.querySelector('[aria-label="Başlanğıc tarix"]')?.value,to:panel?.querySelector('[aria-label="Son tarix"]')?.value};}
 const signature=(tab,data)=>JSON.stringify([...data])+ (tab==='orders'?JSON.stringify(selected.orders):tab==='other'?JSON.stringify([selected.user,selected.profile]):'');
 function editing(entry){return entry.dirty||entry.saving||entry.panel.contains(document.activeElement)&&document.activeElement.matches('input,textarea,select')||document.querySelector('dialog[open],#modal:not(.hidden)');}
 function preservePosition(work){const x=scrollX,y=scrollY,positions=[...detail.querySelectorAll('*')].filter(n=>n.scrollTop||n.scrollLeft).map(n=>[n,n.scrollTop,n.scrollLeft]);work();window.scrollTo(x,y);for(const[n,top,left]of positions){n.scrollTop=top;n.scrollLeft=left;}}
 function updateIdentity(){if(!selected)return;const head=detail.querySelector('.wu-detail-identity');if(head){head.querySelector('h2').textContent=selected.user.name;head.querySelector('small').textContent=activity(selected.user,true);}const stats=detail.querySelector('.wu-detail-stats');if(stats){stats.querySelector('strong').textContent=money(selected.totalCents);stats.querySelector('span').textContent=String(selected.user.orderCount);}}
 async function show(id,tab='balance'){
  if(selected?.user.id===id&&!detail.hidden)return renderTab(tab);
  const run=++showRequest;if(detail.hidden)returnY=window.scrollY;const r=await coalesced('/users/'+encodeURIComponent(id));if(!valid()||run!==showRequest)return;
  for(const entry of tabsCache.values())entry.lease.active=false;tabsCache.clear();selected=r;activeTab=tab;wrap.hidden=true;detail.hidden=false;detail.replaceChildren();content.replaceChildren();
  const header=el('header'),back=button('← Geri',()=>{++showRequest;detail.hidden=true;wrap.hidden=false;window.scrollTo(0,returnY);}),identity=el('div'),stats=el('div');header.className='wu-detail-head';identity.className='wu-detail-identity';identity.append(el('h2',r.user.name),el('small',activity(r.user,true)));stats.className='wu-detail-stats';stats.append(el('strong',money(r.totalCents)),el('small','Ümumi xərclənib'),el('span',String(r.user.orderCount)),el('small','Sifarişlər'));header.append(back,avatar(r.user),identity,stats,button('Yenilə',safe(()=>refreshProfile())));detail.append(header);
  const tabs=el('nav');tabs.className='wu-tabs';for(const[key,label]of [['balance','Balans'],['prices','Xüsusi qiymətlər'],['stats','Statistika'],['referrals','Referallar'],['other','Digər'],['orders','Sifarişlər']]){const b=button(label,safe(()=>renderTab(key)));b.dataset.userTab=key;b.setAttribute('aria-pressed',String(key===tab));tabs.append(b);}detail.append(tabs,content);historyPage=1;await renderTab(tab);
 }
 async function renderTab(tab){
  activeTab=tab;for(const b of detail.querySelectorAll('[data-user-tab]'))b.setAttribute('aria-pressed',String(b.dataset.userTab===tab));
  for(const[key,entry]of tabsCache)entry.panel.hidden=key!==tab;
  if(tabsCache.has(tab))return tabsCache.get(tab).pending;
  const panel=el('div');panel.dataset.userTabPanel=tab;panel.append(el('p','Yüklənir…'));content.append(panel);
  tabsCache.set(tab,{panel,dirty:false,editVersion:0,saving:0,revision:0,lease:{active:true},responses:new Map(),loaded:false});return refreshTab(tab);
 }
 async function refreshTab(tab,{automatic=false,force=false}={}){
  const entry=tabsCache.get(tab);if(!entry||!selected)return;if(entry.pending){if(force){await entry.pending;return refreshTab(tab,{automatic,force});}return entry.pending;}
  const revision=entry.revision,userId=selected.user.id,lease={active:true},stage=el('div'),responses=new Map();stage.dataset.userTabPanel=tab;
  const current=()=>valid()&&selected?.user.id===userId&&tabsCache.get(tab)===entry&&lease.active;
  const read=async(path,body)=>{
   if(body===undefined){const value=await coalesced(path);responses.set(path,value);return value;}
   const version=entry.editVersion;entry.revision++;entry.saving++;try{const result=await call(path,body);reads.clear();if(current()&&version===entry.editVersion)entry.dirty=false;return result;}finally{entry.saving--;}
  };
  const run=Promise.resolve().then(async()=>{try{
   if(tab==='balance')await drawHistory(stage,read);
   else if(['prices','stats','referrals','other'].includes(tab))await renderControlsTab({content:stage,tab,selected,call:read,valid:current,initialState:snapshotControls(entry.panel)});
   else{for(const o of selected.orders)stage.append(el('p',[o.order_code,o.product_title,o.plan_name,o.amount,o.currency,o.status].join(' · ')));if(!selected.orders.length)stage.append(el('p','Hələ sifariş yoxdur.'));}
   if(!current())return;
   if(entry.revision!==revision){lease.active=false;return;}
   if(entry.loaded&&signature(tab,responses)===entry.signature){lease.active=false;return;}
   // Fetch while editing, but never replace a form or an open operation dialog.
   if(entry.loaded&&!force&&editing(entry)){lease.active=false;preservePosition(()=>{errors.textContent='Məlumat arxa planda alındı. Formadakı dəyişiklikləriniz qorunur.';});return;}
   preservePosition(()=>{entry.lease.active=false;entry.lease=lease;stage.hidden=tab!==activeTab;entry.panel.replaceWith(stage);entry.panel=stage;entry.responses=responses;entry.signature=signature(tab,responses);entry.loaded=true;});
   for(const name of ['input','change'])stage.addEventListener(name,()=>{entry.dirty=true;entry.editVersion++;});
  }catch(e){lease.active=false;if(valid()&&selected?.user.id===userId){preservePosition(()=>{errors.textContent=e.message;});if(!entry.loaded)entry.panel.replaceChildren(el('p',e.message),button('Yenidən cəhd et',safe(()=>refreshTab(tab))));}}
  finally{if(entry.pending===run)entry.pending=null;}});entry.pending=run;return run;
 }
 async function history(){return refreshTab('balance',{force:true});}
 async function refreshProfile({automatic=false}={}){
  if(!valid()||detail.hidden||!selected)return;if(profileRead)return profileRead;
  const userId=selected.user.id,runId=showRequest;
  const run=Promise.resolve().then(async()=>{try{const r=await coalesced('/users/'+encodeURIComponent(userId));if(!valid()||selected?.user.id!==userId||runId!==showRequest)return;Object.assign(selected,r);preservePosition(updateIdentity);await Promise.all([...tabsCache.keys()].map(tab=>refreshTab(tab,{automatic})));}catch(e){if(valid())preservePosition(()=>{errors.textContent=e.message;});}finally{if(profileRead===run)profileRead=null;}});profileRead=run;return run;
 }
 async function drawHistory(target,read){const r=await read('/wallet?'+new URLSearchParams({userId:selected.user.id,page:historyPage,q:historyQ,view:historyView}));if(!valid())return;const summary=el('div');summary.className='wu-balance';summary.append(el('strong',money(r.cents)),button('Balansı idarə et',safe(()=>manage(r.cents,r.debitAvailable))));const search=el('input');search.placeholder='Əməliyyat və ya səbəb axtar';search.value=historyQ;const filter=el('select');filter.append(el('option','Hamısı'));const tools=el('div');tools.append(button('Tarix',()=>{historyView='history';historyPage=1;safe(history)();}),button('Ödənişlər',()=>{historyView='payments';historyPage=1;safe(history)();}),search,button('Axtar',()=>{historyQ=search.value;historyPage=1;safe(history)();}),filter);const rows=el('div');rows.className='wu-ledger';for(const x of r.items){rows.append(walletCard(x,selected.user.memberNumber));}if(!r.items.length)rows.append(el('p','Əməliyyat yoxdur.'));const previous=button('Əvvəlki',()=>{historyPage--;safe(history)();}),more=button('Növbəti',()=>{historyPage++;safe(history)();});previous.disabled=historyPage===1;more.disabled=!r.more;target.replaceChildren(summary,tools,rows,previous,more);}
 function manage(cents,debitAvailable){
  const user=selected.user,storageKey='mirpanel.wallet.pending.v1:'+user.id;
  const dialog=el('dialog');dialog.className='wu-dialog';dialog.setAttribute('aria-label','Balansı idarə et');
  const amount=el('input'),error=el('p'),actions=el('div'),confirm=el('div'),description=el('p');
  actions.className='wu-operation-actions';confirm.hidden=true;error.setAttribute('role','alert');
  amount.inputMode='decimal';amount.placeholder='0.00';amount.setAttribute('aria-label','AZN məbləği');
  let busy=false,op;
  const savePending=value=>{
   if(value)pendingWallet.set(storageKey,value);else pendingWallet.delete(storageKey);
   try{if(value)sessionStorage.setItem(storageKey,JSON.stringify(value));else sessionStorage.removeItem(storageKey);}catch{}
  };
  const submit=button('Təsdiqlə',async()=>{
   if(busy||!op)return;
   busy=true;submit.disabled=true;error.textContent='';savePending(op);
   try{
    const result=await call('/wallet/'+op.kind,op.payload);
    if(!result?.id)throw Error('Server əməliyyatın nəticəsini təsdiqləmədi.');
   }catch(e){
    error.textContent=e.message;
    if([400,409].includes(e.status)){savePending(null);submit.hidden=true;error.append(' ',button('Balansı yenilə',()=>{dialog.close();void safe(history)();}));}
    else{submit.textContent='Eyni əməliyyatı təkrar yoxla';error.append(' Eyni əməliyyat açarı saxlanılıb.');}
    return;
   }finally{busy=false;submit.disabled=false;}
   savePending(null);dialog.close();if(valid()){await safe(history)();await load();}
  });
  function preview(value,retry=false){
   op=value;amount.value=value.payload.amount;amount.readOnly=true;actions.hidden=true;confirm.hidden=false;
   const debit=value.kind==='debit',before=value.before,delta=Math.round(Number(value.payload.amount)*100);
   submit.textContent=retry?'Eyni əməliyyatı təkrar yoxla':debit?'Təsdiqlə və çıx':'Təsdiqlə və əlavə et';
   submit.classList.toggle('wu-danger',debit);submit.classList.toggle('wu-primary',!debit);
   description.textContent=(debit?'Çıxılacaq: ':'Əlavə olunacaq: ')+ledgerMoney(delta)+' · '+ledgerMoney(before)+(debit?' − ':' + ')+ledgerMoney(delta)+' = '+ledgerMoney(before+(debit?-delta:delta));
  }
  function prepare(kind){
   const raw=amount.value.trim();
   const value=/^\d{1,7}(?:[.,]\d{1,2})?$/.test(raw)?Math.round(Number(raw.replace(',','.'))*100):0;
   error.textContent='';
   if(value<=0||value>100000000){error.textContent='0-dan böyük, ən çox 1 000 000 ₼ və iki qəpik rəqəmli məbləğ yazın.';amount.focus();return;}
   if(kind==='debit'&&value>cents){error.textContent='Balans kifayət etmir. Cari balans: '+ledgerMoney(cents)+'.';amount.focus();return;}
   preview({kind,before:cents,payload:{userId:user.id,amount:(value/100).toFixed(2),requestId:crypto.randomUUID(),confirmed:true,...(kind==='debit'?{expectedCents:cents}:{})}});
  }
  const credit=button('Əlavə et',()=>prepare('credit')),debit=button('Balansdan çıx',()=>prepare('debit'));
  credit.classList.add('wu-primary');debit.classList.add('wu-danger');debit.disabled=!debitAvailable;
  if(!debitAvailable)debit.title='Balansdan çıxılma hazırda aktiv deyil.';
  actions.append(credit,debit);confirm.append(description,submit);
  const close=button('×',()=>{if(!busy)dialog.close();});close.classList.add('wu-close');close.setAttribute('aria-label','Pəncərəni bağla');
  const who=el('div');who.className='wu-dialog-identity';who.append(avatar(user),el('strong',user.name),el('small','#'+user.memberNumber));
  const field=el('label');field.className='wu-amount';field.append(amount,el('span','AZN'));
  dialog.append(close,el('h2','Balansı idarə et'),who,el('small','Cari balans'),el('strong',money(cents)),field,actions,error,confirm);
  try{
   const stored=pendingWallet.get(storageKey)||JSON.parse(sessionStorage.getItem(storageKey)||'null');
   if(stored?.payload?.userId===user.id&&['credit','debit'].includes(stored.kind)){
    preview(stored,true);error.textContent='Əvvəlki əməliyyatın nəticəsi yoxlanılmayıb. Eyni sorğu ilə yoxlayın.';
   }
  }catch{}
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
 }
 const toolbar=el('div'),filters=el('nav'),search=el('form');toolbar.className='wu-toolbar';filters.className='wu-filters';
 for(const [key,label]of [['all','Hamısı'],['active30','Son 30 dəqiqədə aktiv'],['online','Onlayn'],['banned','Qadağan olunmuş']]){
  const b=button(label,()=>{userFilter=key;for(const n of filters.children)n.setAttribute('aria-pressed',String(n===b));searchUsers();});
  b.setAttribute('aria-pressed',String(key===userFilter));filters.append(b);
 }
 query.type='search';query.maxLength=100;query.setAttribute('aria-label',query.placeholder);
 query.addEventListener('input',()=>searchUsers(250));search.append(query);
 search.onsubmit=event=>{event.preventDefault();searchUsers();};
 toolbar.append(filters,search);wrap.append(el('h1','İstifadəçilər'),toolbar,list,prev,pager,next);
 root.classList.add('wallet-users');root.replaceChildren(errors,wrap,detail);await load();
 const refreshActive=()=>{if(valid()&&detail.hidden&&userFilter==='active30'&&!list.hasAttribute('aria-busy'))void load();};
 refreshTimer=setInterval(()=>{if(valid()&&!document.hidden&&!detail.hidden)void refreshProfile({automatic:true});},600000);
 const refreshButton=document.getElementById('refreshBtn'),manualRefresh=event=>{if(!valid()||root.closest('.hidden'))return;event.stopImmediatePropagation();void safe(()=>detail.hidden?load():refreshProfile())();};refreshButton?.addEventListener('click',manualRefresh,true);
 if(valid())window.addEventListener('admin-topup-poll',refreshActive);
 const target=new URL(location.href).searchParams.get('topupUser');if(userFilter==='all'&&target&&target.length<=160)await safe(()=>show(target))();
 return()=>{closed=true;++showRequest;clearInterval(refreshTimer);refreshButton?.removeEventListener('click',manualRefresh,true);for(const entry of tabsCache.values())entry.lease.active=false;tabsCache.clear();reads.clear();window.removeEventListener('admin-topup-poll',refreshActive);clearTimeout(searchTimer);root.classList.remove('wallet-users');for(const d of document.querySelectorAll('.wu-dialog'))d.remove();};
}
