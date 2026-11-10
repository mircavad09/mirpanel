import {renderAccountPanel} from './account-panel.js?v=delivery-stable-2';
import {renderViewCatalog} from './customer-view-catalog.js?v=read-navigation-2';
const app=document.getElementById('communityApp'),base=location.pathname,apiBase=base.replace('/admin/','/api/admin/'),state={};
const el=(tag,attrs={},...children)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(v!==undefined)n.setAttribute(k,String(v));}for(const c of children.flat())if(c!=null)n.append(c);return n;};
const button=(text,fn,primary=false)=>el('button',{type:'button',class:primary?'primary':'',onclick:fn},text);
const link=(text,href,cls='button')=>el('a',{href,class:cls},text);
// Admin and storefront have different origins and URL depths. Catalog and
// guide artwork belongs to the storefront, never the protected view path.
function publicImages(value){
 if(Array.isArray(value))return value.map(publicImages);
 if(value&&typeof value==='object')for(const key of Object.keys(value)){
  if(key==='image'&&typeof value[key]==='string'&&value[key]){try{value[key]=new URL(value[key],'https://mirpanel.com/').href;}catch{value[key]='';}}
  else value[key]=publicImages(value[key]);
 }
 return value;
}
let stopped=false,dispose,routeVersion=0;const requests=new Set();
const readOnlyMessage='Bu rejim yalnız baxış üçündür.';
const notice=el('p',{class:'customer-view-notice',role:'status',hidden:true});
document.body.append(notice);
let noticeTimer;
function notify(){notice.hidden=false;notice.textContent=readOnlyMessage;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.hidden=true,3000);}
function clear(message){stopped=true;dispose?.();for(const c of requests)c.abort();requests.clear();state.profile=null;window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:null}));app.replaceChildren(el('section',{class:'account-empty'},el('h1',{},'Baxış bağlandı'),el('p',{},message)));}
async function api(path,data){
 if(data!==undefined){notify();throw Object.assign(Error(readOnlyMessage),{status:403});}
 if(stopped)throw Error('Baxış bağlanıb.');
 const controller=new AbortController();requests.add(controller);const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch(apiBase+'?'+new URLSearchParams({path}),{credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
  const value=await r.json();
  if(!r.ok){if(r.status===401||value.code==='CUSTOMER_VIEW_EXPIRED')clear(value.error);throw Object.assign(Error(value.error||'Məlumat alınmadı.'),{status:r.status});}
  return publicImages(value);
 }finally{clearTimeout(timer);requests.delete(controller);}
}
function media(p){for(const key of ['avatarUrl','coverUrl'])if(p[key]?.startsWith('/api/community/media/'))p[key]=apiBase+'?'+new URLSearchParams({path:p[key]});return p;}
async function session(){const value=await api('/api/community/state');state.profile=media(value.profile);return state.profile;}
const denied='.account-menu-logout,.profile-logout,.profile-avatar,.profile-camera,.profile-hero-actions button,.profile-edit-trigger,.profile-cover-edit,.profile-cover-button,.profile-balance button,.profile-actions button,[data-buy-again],.subs-renew,.subscription-renew,.subscriptions-renew,.subscription-options,.account-sidebar-topup,.pay-topup,[data-view-disabled]';
function viewUrl(href){
 const u=new URL(href,location.href);
 if(u.origin===location.origin&&u.pathname===base)return u;
 if(u.origin!==location.origin&&u.origin!=='https://mirpanel.com')return null;
 if(u.pathname==='/profil')return new URL(base+u.search,location.origin);
 if(u.pathname==='/sifarislerim')return new URL(base+'?tab=orders'+(u.search?'&'+u.search.slice(1):''),location.origin);
 if(u.pathname==='/mehsul'||u.pathname==='/')return new URL(base+'?page=products',location.origin);
 if(u.pathname.startsWith('/mehsul/'))return new URL(base+'?'+new URLSearchParams({page:'products',product:u.pathname.slice(8)}),location.origin);
 return null;
}
function protect(){
 app.querySelectorAll(denied).forEach(n=>{
  n.setAttribute('data-view-disabled','');n.setAttribute('aria-disabled','true');
  if(n.tagName==='BUTTON')n.disabled=false;
  if(n.tagName==='A'){n.removeAttribute('href');n.setAttribute('role','button');n.tabIndex=0;}
 });
 app.querySelectorAll('a[href]:not([data-delivery-guide])').forEach(a=>{const u=viewUrl(a.getAttribute('href'));if(u)a.href=u.href;});
 app.querySelectorAll('input[type="file"]').forEach(n=>n.disabled=true);
}
document.addEventListener('click',e=>{
 if(!e.target.closest('#communityApp,.customer-view-banner'))return;
 if(e.target.closest(denied)){e.preventDefault();e.stopImmediatePropagation();notify();return;}
 const a=e.target.closest('a');if(!a)return;
 if(a.matches('.browser-order-delivery a[data-delivery-guide][href="#teslim-telimat"]')){e.preventDefault();return;}
 if(a.getAttribute('href')==='/admin.html#communityUsers')return;
 const u=viewUrl(a.getAttribute('href'));
 if(u){e.preventDefault();e.stopImmediatePropagation();void navigate(u.href);return;}
 const external=new URL(a.href,location.href);
 if(a.closest('dialog')&&external.protocol==='https:'&&external.hostname.endsWith('.supabase.co'))return;
 e.preventDefault();e.stopImmediatePropagation();notify();
},true);
app.addEventListener('keydown',e=>{
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('a[data-view-disabled]')){e.preventDefault();notify();}
},true);
app.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();notify();},true);
async function navigate(href,push=true){
 if(stopped)return;
 const u=viewUrl(href);if(!u){notify();return;}
 if(push&&u.href!==location.href)history.pushState({},'',u.href);
 const run=++routeVersion;
 if(u.searchParams.get('page')==='products'){
  dispose?.();dispose=null;
  dispose=renderViewCatalog({app,api,el,button,link,navigate,notify,search:u.searchParams,valid:()=>!stopped&&run===routeVersion});
 }else if(window.mirpanelAccountNavigate){window.mirpanelAccountNavigate(u.href);}
 else mount();
}
function mount(){
 dispose=renderAccountPanel({app,state,api,el,button,link,alert:()=>el('p',{role:'status'}),avatars:['🤖','🌟','🌿','🦁','💎','🦉','🚀','🌊'],money:n=>(n/100).toFixed(2).replace('.',',')+' ₼',firstSession:Promise.resolve(state.profile),session,readOnly:true,goLogin:()=>clear('Admin panelindən baxışı yenidən açın.')});
 protect();
}
window.MirpanelNavigation={go:href=>navigate(href)};
const observer=new MutationObserver(protect);observer.observe(app,{childList:true,subtree:true});
window.addEventListener('popstate',()=>void navigate(location.href,false));
const channel=new BroadcastChannel('mirpanel-admin-customer-view');
channel.onmessage=e=>{if(e.data!==base)clear('Başqa müştərinin baxışı açılıb.');};channel.postMessage(base);
const expires=Number(document.querySelector('meta[name="customer-view-expires"]')?.content)||Date.now()+10*60*1000;
const expiry=setTimeout(()=>clear('Baxış icazəsi bitib. Admin panelindən yenidən açın.'),Math.max(0,expires-Date.now()));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!stopped)void session().catch(()=>{});});
window.addEventListener('pagehide',()=>{observer.disconnect();clearTimeout(expiry);channel.close();clear('Baxış sessiyası bağlandı.');},{once:true});
try{
 await session();
 await navigate(location.href,false);
}catch(e){if(!stopped)app.replaceChildren(el('section',{class:'account-empty'},el('h1',{},'Baxış açıla bilmədi'),el('p',{},e.message),button('Yenidən cəhd et',()=>location.reload())));}
