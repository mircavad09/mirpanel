import {accountLabels,accountTab,accountMenu,ordersLoader} from './profile-shell.js?v=completed-badge-1';
const sessionKey=Symbol.for('mirpanel.profile.session-lists');
const sessionLists=window[sessionKey]??={uid:null,entries:new Map(),views:new Map(),listening:false};
const setOwner=uid=>{if(uid!==sessionLists.uid){sessionLists.entries.clear();sessionLists.views.clear();sessionLists.uid=uid;}};
if(!sessionLists.listening){
 sessionLists.listening=true;
 window.addEventListener('mirpanel:account',e=>setOwner(e.detail?.user_id||null));
 window.addEventListener('storage',e=>{if(e.key==='mirpanel.auth.signedOut')setOwner(null);});
 window.addEventListener('pagehide',()=>sessionLists.entries.clear());
}
export function renderAccountPanel(ctx){
 document.body.classList.add('profile-screen');
 const {app,state,api,el,button,link,money}=ctx;
 if(!app.isConnected||location.pathname!=='/profil'&&!ctx.readOnly)return;
 const life=new AbortController(),moduleRetries=new Map();let stopped=false,disposeChild=null,load=0,verified=null,observedOwner,first=ctx.firstSession||Promise.resolve(state.profile),selected='profile',view=null;
 const spinner=()=>el('div',{class:'account-tab-spinner',role:'status','aria-label':'Məlumat hazırlanır'});
 const ordersPlaceholder=()=>{const n=el('div');n.innerHTML=ordersLoader;return n.firstElementChild;};
 const initialScroll=history.state?.profileScroll;
 function rememberScroll(persist=false){
  if(!view||!verified||sessionLists.uid!==verified)return;
  view.scroll=scrollY;
  if(persist&&location.pathname==='/profil'&&selected===accountTab(location.search))try{history.replaceState({...history.state,profileScroll:scrollY},'');}catch{/* Browser may already be closing the document. */}
 }
 window.addEventListener('pagehide',()=>rememberScroll(true),{capture:true,signal:life.signal});
 const dispose=()=>{if(stopped)return;rememberScroll();stopped=true;load++;life.abort();if(window.mirpanelAccountNavigate===navigate)window.mirpanelAccountNavigate=null;disposeChild?.();app.replaceChildren();};
 const nav=el('nav',{class:'account-tabs','aria-label':'Hesab bölmələri'}),identity=el('section',{class:'account-sidebar-card','aria-label':'Hesab məlumatları'}),sidebar=el('aside',{class:'account-sidebar'},identity,nav),content=el('section',{class:'account-tab-content','aria-live':'polite'}),shell=el('div',{class:'account-panel'},sidebar,content);app.replaceChildren(shell);
 nav.innerHTML=accountMenu(accountTab(location.search));
 let pressed=null;
 const releasePress=()=>{pressed?.removeAttribute('data-pressed');pressed=null;};
 nav.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch')return;
  releasePress();pressed=e.target.closest('.account-tab');pressed?.setAttribute('data-pressed','');
 },{signal:life.signal});
 nav.addEventListener('pointermove',releasePress,{signal:life.signal});
 nav.addEventListener('scroll',releasePress,{signal:life.signal});
 window.addEventListener('pointerup',releasePress,{signal:life.signal});
 window.addEventListener('pointercancel',releasePress,{signal:life.signal});
 window.addEventListener('blur',releasePress,{signal:life.signal});
 const logout=nav.querySelector('.account-menu-logout'),logoutStatus=nav.querySelector('.account-menu-status');
 logout.addEventListener('click',async()=>{
  logout.disabled=true;logoutStatus.textContent='';
  try{
   await api('/api/auth/sign-out',{});
   try{localStorage.setItem('mirpanel.auth.signedOut',String(Date.now()));}catch{}
   window.mirpanelAccountProfile=null;
   window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:null}));
   await window.refreshCommunityNav?.();
   if(window.MirpanelNavigation)await window.MirpanelNavigation.go('/qrup');else location.assign('/qrup');
  }catch(e){logoutStatus.textContent=e.message;logout.disabled=false;}
 },{signal:life.signal});
 const empty=(title,text='Bu hesab üçün hələ qeyd yoxdur.')=>el('section',{class:'account-empty'},el('h2',{},title),el('p',{},text));
 const safeImage=url=>{try{const u=new URL(url,location.origin);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
 function identityCard(p){const photo=el('span',{class:'account-sidebar-avatar'});if(p.avatarUrl&&safeImage(p.avatarUrl))photo.append(el('img',{src:safeImage(p.avatarUrl),alt:''}));else photo.textContent=ctx.avatars[p.avatar]||ctx.avatars[0];const copied=el('span',{class:'account-copy-status',role:'status'}),copy=button('Kopyala',async()=>{try{await navigator.clipboard.writeText(String(p.member_number));copied.textContent='Kopyalandı';}catch{copied.textContent='Kopyalama alınmadı';}});copy.disabled=!p.member_number;const wallet=link('Balansı artır','/balans','account-sidebar-topup');identity.replaceChildren(el('div',{class:'account-sidebar-person'},photo,el('div',{},el('strong',{},p.display_name),el('span',{},p.email||'—'))),el('div',{class:'account-sidebar-id'},el('span',{},'# ID: '+(p.member_number||'—')),copy),copied,el('div',{class:'account-sidebar-balance'},el('strong',{},Number.isSafeInteger(p.balanceCents)?money(p.balanceCents):'—'),wallet));}
 identity.classList.add('account-identity-pending');
 window.addEventListener('mirpanel:profile-updated',e=>{if(e.detail?.user_id===verified)identityCard(e.detail);},{signal:life.signal});
 function productCard(p,saved,onChange){const a=el('article',{class:'account-product'}),url='/mehsul/'+encodeURIComponent(p.id),view=link('',url,'account-product-link');if(safeImage(p.image))view.append(el('img',{src:safeImage(p.image),alt:'',loading:'lazy'}));view.append(el('strong',{},p.title),el('span',{},p.price===null?'Qiymətə bax':p.price.toFixed(2).replace('.',',')+' ₼-dən başlayır'));a.append(view);return a;}
 let summaryCache=null,summaryPending=null;
 const accountData=()=>{
  if(summaryPending)return summaryPending;
  const uid=verified,request=api('/api/community/account-panel').then(d=>{if(!stopped&&verified===uid&&summaryPending===request)summaryCache=d;return d;}).finally(()=>{if(summaryPending===request)summaryPending=null;});
  return summaryPending=request;
 };
 const navigate=u=>show(accountTab(new URL(u,location.href).search));window.mirpanelAccountNavigate=navigate;
 let dragging=false,startX=0,startScroll=0;nav.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;dragging=true;startX=e.clientX;startScroll=nav.scrollLeft;nav.dataset.dragging='false';},{signal:life.signal});nav.addEventListener('pointermove',e=>{if(!dragging)return;if(Math.abs(e.clientX-startX)>5){nav.dataset.dragging='true';nav.setPointerCapture(e.pointerId);nav.scrollLeft=startScroll+startX-e.clientX;}},{signal:life.signal});const endDrag=()=>{dragging=false;setTimeout(()=>nav.dataset.dragging='false',0);};nav.addEventListener('pointerup',endDrag,{signal:life.signal});nav.addEventListener('pointercancel',endDrag,{signal:life.signal});nav.addEventListener('wheel',e=>{if(nav.scrollWidth<=nav.clientWidth)return;const before=nav.scrollLeft;nav.scrollLeft+=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(nav.scrollLeft!==before)e.preventDefault();},{passive:false,signal:life.signal});
 async function recommendations(target,run){const d=await accountData();if(stopped||run!==load||!target.isConnected||target.querySelector('.account-recommendations'))return;const box=el('section',{class:'account-recommendations'},el('h2',{},'Məhsul təklifləri')),grid=el('div',{class:'account-products'});for(const p of d.products.slice(0,4))grid.append(productCard(p,d.wishlist.includes(p.id),()=>show('orders')));box.append(grid);target.append(box);}
 async function show(id){rememberScroll();selected=id;const run=++load;disposeChild?.();disposeChild=null;view=null;
 const label=accountLabels[id];content.replaceChildren(el('h1',{},label),id==='orders'?ordersPlaceholder():spinner());
 for(const a of nav.children){if(a.dataset.accountTab===id){a.setAttribute('aria-current','page');const r=a.getBoundingClientRect(),n=nav.getBoundingClientRect();if(r.left<n.left)nav.scrollLeft+=r.left-n.left;else if(r.right>n.right)nav.scrollLeft+=r.right-n.right;}else a.removeAttribute('aria-current');}document.title=label+' · MirPanel';
 const code=new URLSearchParams(location.search).get('order'),suffix=/^[A-Za-z0-9-]{1,40}$/.test(code||'')?'?order='+encodeURIComponent(code):'';
 const viewKey=id+(id==='orders'?suffix:'');
 const prior=verified&&sessionLists.uid===verified?sessionLists.views.get(viewKey):null;
 const paymentPath=(status='all',page=1)=>'/api/community/payment-history?status='+status+'&page='+page;
 const listPath=id==='orders'?'/api/payments/my-orders'+suffix:id==='codes'?'/api/payments/my-orders/codes':id==='payments'?paymentPath(prior?.status,prior?.page):id==='subscriptions'?'/api/payments/shop/subscriptions':null;
 const readList=async()=>{const data=await api(listPath);return data;};
 const pending=listPath?(ctx.initialOrdersRequest?.path===listPath?ctx.initialOrdersRequest.promise:readList()):null;
 if(ctx.initialOrdersRequest?.path===listPath)ctx.initialOrdersRequest=null;void pending?.catch(()=>{});
 const url={profile:'./profile.js?v=read-navigation-2',orders:'/browser-orders.js?v=completed-badge-1',codes:'./account-codes.js?v=purchased-code-details-1',payments:'./account-payments.js?v=read-navigation-3',subscriptions:'./account-subscriptions.js?v=netflix-room-renewal-1'}[id];
 const retry=moduleRetries.get(id)||0,module=url?import(url+(retry?'&retry='+retry:'')):null;
 let timeout;
 const tabModule=module&&Promise.race([module,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Bölmə gec açılır.')),12000);})]).catch(e=>{moduleRetries.set(id,Math.max(retry+1,moduleRetries.get(id)||0));throw e;}).finally(()=>clearTimeout(timeout));
 void tabModule?.catch(()=>{});
 try{
 if(!verified){
  const profile=await first;if(stopped||run!==load||!profile)return;
  if(observedOwner!==undefined&&observedOwner!==profile.user_id)throw Error('Hesab dəyişib. Yenidən cəhd edin.');
  verified=profile.user_id;setOwner(verified);identity.classList.remove('account-identity-pending');identityCard(profile);
 }
 const ui=sessionLists.views.get(viewKey)||{};sessionLists.views.delete(viewKey);sessionLists.views.set(viewKey,ui);
 if(sessionLists.views.size>16)sessionLists.views.delete(sessionLists.views.keys().next().value);
 view=ui;
 const restoreAt=ui.scroll??(run===1?initialScroll:undefined);let restored=false;
 const restore=()=>{if(!restored&&Number.isFinite(restoreAt)){restored=true;requestAnimationFrame(()=>{if(run===load&&!stopped)window.scrollTo(0,restoreAt);});}};
 const ownData=d=>{if(!stopped&&run===load&&d?.accountId&&d.accountId!==verified)recheck(d.accountId);if(stopped||run!==load||!d||d.accountId!==verified||sessionLists.uid!==verified)throw Error('Hesab məlumatı yenilənib. Yenidən cəhd edin.');return d;};
 const unauthorized=()=>{if(!stopped&&run===load)window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:null}));};
 const cache=(d,path=listPath)=>{if(!stopped&&run===load&&sessionLists.uid===verified){if(!d)sessionLists.entries.delete(path);else if(d.accountId===verified){sessionLists.entries.delete(path);sessionLists.entries.set(path,d);if(sessionLists.entries.size>12)sessionLists.entries.delete(sessionLists.entries.keys().next().value);restore();}}};
 if(id==='profile'){const {renderProfile}=await tabModule;if(stopped||run!==load)return;const uid=verified,profileApi=async(...args)=>{try{const data=await api(...args);if(stopped||run!==load||uid!==verified)throw Error('Bölmə dəyişib.');return data;}catch(e){if(e.status===401)unauthorized();throw e;}};const rendered=renderProfile({...ctx,app:content,api:profileApi});disposeChild=window.mirpanelProfileDispose;window.mirpanelProfileDispose=null;await rendered;restore();return;}
 if(id==='orders'){
  await tabModule;if(stopped||run!==load)return;
  const list=el('div',{id:'browserOrders'},ordersPlaceholder()),error=el('p',{id:'browserOrdersError',hidden:true,role:'alert'}),more=button('Daha çox göstər',()=>{}),dialog=el('dialog',{id:'browserReceipt',class:'browser-receipt-dialog'},button('Bağla',()=>{}),el('div',{id:'browserReceiptContent'}));more.id='browserOrdersMore';more.hidden=true;dialog.querySelector('button').id='browserReceiptClose';content.replaceChildren(el('h1',{},'Sifarişlərim'),list,error,more,dialog);
  const communityDispose=window.mirpanelPageDispose,initial=sessionLists.entries.get(listPath);
  const onLoaded=e=>{if(!e.detail.empty)content.querySelector('.account-recommendations')?.remove();if(e.detail.empty&&!content.querySelector('.account-recommendations'))void recommendations(content,run).catch(()=>{});};
  window.addEventListener('mirpanel:orders-loaded',onLoaded,{signal:life.signal});
  disposeChild=window.mountBrowserOrders({initial,initialRequest:pending,ui,validate:ownData,onData:cache,onUnauthorized:unauthorized,profile:true,...(ctx.readOnly?{api:path=>api('/api/payments/'+path)}:{})});window.mirpanelPageDispose=communityDispose;
  const child=disposeChild;disposeChild=()=>{window.removeEventListener('mirpanel:orders-loaded',onLoaded);child?.();};return;
 }
 const options={content,api,el,button,link,validate:ownData,initial:sessionLists.entries.get(listPath),initialRequest:pending,onData:cache,onUnauthorized:unauthorized,spinner,ui,readOnly:!!ctx.readOnly};
 if(id==='payments'){const {mountPayments}=await tabModule;if(!stopped&&run===load)disposeChild=mountPayments({...options,initial:sessionLists.entries.get(paymentPath(ui.status,ui.page)),initialRequest:listPath===paymentPath(ui.status,ui.page)?pending:null,getCached:(s,p)=>sessionLists.entries.get(paymentPath(s,p)),onData:(d,s,p)=>cache(d,paymentPath(s,p))});return;}
 if(id==='codes'){const {mountCodes}=await tabModule;if(!stopped&&run===load)disposeChild=mountCodes(options);return;}
 if(id==='subscriptions'){const {mountSubscriptions}=await tabModule;if(!stopped&&run===load)disposeChild=mountSubscriptions(options);return;}
 content.replaceChildren(el('section',{class:'account-empty'},el('h1',{},'Xərclərim'),el('strong',{class:'account-expenses'},summaryCache?money(summaryCache.expensesCents):'—')));
 const d=await accountData();if(stopped||run!==load)return;
 if(id==='expenses')content.replaceChildren(el('section',{class:'account-empty'},el('h1',{},'Xərclərim'),el('strong',{class:'account-expenses'},money(d.expensesCents)),el('p',{},d.completedOrders+' təsdiqlənmiş alış · AZN'),el('p',{},'Balans əlavələri xərc sayılmır. Qaytarılmış məbləğlər çıxılıb.')));
 else content.replaceChildren(empty(id==='codes'?'Hələ kodunuz yoxdur':'Aktiv abunəliyiniz yoxdur',id==='codes'?'Hesabınıza bağlı kod qeydi yoxdur.':'Hesabınıza bağlı aktiv abunəlik qeydi yoxdur.'));
 }catch(e){if(!stopped&&run===load){if(e.status===401){window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:null}));return;}content.replaceChildren(el('h1',{},label),empty('Məlumat yüklənmədi','Yenidən cəhd edin.'),button('Yenidən cəhd et',()=>{if(!verified&&ctx.session){first=ctx.session(true);void first.catch(()=>{});}void show(id);}));}}}
 function recheck(uid){observedOwner=uid;if(uid===verified&&uid)return;if(!verified&&uid)return;setOwner(uid);load++;disposeChild?.();disposeChild=null;view=null;verified=null;identity.replaceChildren();identity.classList.add('account-identity-pending');summaryCache=summaryPending=null;if(!uid){content.replaceChildren();ctx.goLogin?.();return;}if(ctx.session){first=ctx.session(true);void first.catch(()=>{});void show(selected);}else dispose();}
 window.addEventListener('mirpanel:account',e=>recheck(e.detail?.user_id||null),{signal:life.signal});
 window.addEventListener('storage',e=>{if(e.key==='mirpanel.auth.signedOut')recheck(null);},{signal:life.signal});
 let checking=false;
 async function checkSession(){if(checking||!verified||document.hidden||stopped||!ctx.session)return;checking=true;try{const p=await ctx.session();if(!stopped&&p&&p.user_id!==verified)recheck(p.user_id);}catch{/* Retain current data on a temporary network error. */}finally{checking=false;}}
 document.addEventListener('visibilitychange',checkSession,{signal:life.signal});
 window.addEventListener('pageshow',e=>{if(e.persisted)void checkSession();},{signal:life.signal});
 const timer=setInterval(checkSession,30000);life.signal.addEventListener('abort',()=>clearInterval(timer),{once:true});
 void show(accountTab(location.search));return dispose;
}
