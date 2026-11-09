import {renderAccountPanel} from './account-panel.js?v=customer-view-1';
const app=document.getElementById('communityApp'),base=location.pathname,apiBase=base.replace('/admin/','/api/admin/'),state={};
const el=(tag,attrs={},...children)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(v!==undefined)n.setAttribute(k,String(v));}for(const c of children.flat())if(c!=null)n.append(c);return n;};
const button=(text,fn,primary=false)=>el('button',{type:'button',class:primary?'primary':'',onclick:fn},text);
const link=(text,href,cls='button')=>el('a',{href,class:cls},text);
let stopped=false,dispose;const requests=new Set();
function clear(message){stopped=true;dispose?.();for(const c of requests)c.abort();requests.clear();state.profile=null;window.dispatchEvent(new CustomEvent('mirpanel:account',{detail:null}));app.replaceChildren(el('section',{class:'account-empty'},el('h1',{},'Baxış bağlandı'),el('p',{},message)));}
async function api(path,data){
 if(data!==undefined)throw Error('Bu rejimdə yalnız baxış mümkündür.');
 if(stopped)throw Error('Baxış bağlanıb.');
 const controller=new AbortController();requests.add(controller);const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const r=await fetch(apiBase+'?'+new URLSearchParams({path}),{credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});
  const value=await r.json();
  if(!r.ok){if(r.status===401||r.status===403)clear(value.error);throw Object.assign(Error(value.error||'Məlumat alınmadı.'),{status:r.status});}
  return value;
 }finally{clearTimeout(timer);requests.delete(controller);}
}
function media(p){for(const key of ['avatarUrl','coverUrl'])if(p[key]?.startsWith('/api/community/media/'))p[key]=apiBase+'?'+new URLSearchParams({path:p[key]});return p;}
async function session(){const value=await api('/api/community/state');state.profile=media(value.profile);return state.profile;}
const denied='.account-menu-logout,.profile-logout,.profile-avatar,.profile-camera,.profile-hero-actions button,.profile-edit-trigger,.profile-cover-edit,.profile-editor,.profile-cover-button,.profile-balance button,.profile-actions button,[data-buy-again],.subs-renew,.subscription-renew,.subscriptions-renew,.subscription-options,.account-sidebar-topup,.pay-topup';
function protect(){
 app.querySelectorAll(denied).forEach(n=>{n.setAttribute('data-view-disabled','');n.setAttribute('aria-disabled','true');if(n.tagName==='BUTTON'||n.tagName==='INPUT')n.disabled=true;});
 // The shared widgets create navigation links and media lazily.
 app.querySelectorAll('a[href^="/profil"],a[href="/sifarislerim"]').forEach(a=>{const u=new URL(a.href);a.href=base+(u.pathname==='/sifarislerim'?'?tab=orders':u.search);});
 app.querySelectorAll('input,textarea,select').forEach(n=>{if(n.type==='search'||n.closest('.codes-tools,.pay-history-tools'))return;n.disabled=true;});
}
app.addEventListener('click',e=>{
 const disabled=e.target.closest(denied+', [data-view-disabled]');
 const a=e.target.closest('a');
 if(disabled){e.preventDefault();e.stopImmediatePropagation();return;}
 if(a){const u=new URL(a.href);if(u.origin===location.origin&&u.pathname===base){e.preventDefault();history.pushState({},'',u.pathname+u.search);window.mirpanelAccountNavigate?.(location.href);return;}
 e.preventDefault();e.stopImmediatePropagation();}
},true);
// Profile actions that use direct navigation rather than API calls are also
// disabled. Copy, filters, receipt previews and delivered-data toggles remain live.
app.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
const observer=new MutationObserver(protect);observer.observe(app,{childList:true,subtree:true});
window.addEventListener('popstate',()=>window.mirpanelAccountNavigate?.(location.href));
const channel=new BroadcastChannel('mirpanel-admin-customer-view');
channel.onmessage=e=>{if(e.data!==base)clear('Başqa müştərinin baxışı açılıb.');};channel.postMessage(base);
const expiry=setTimeout(()=>clear('Baxış icazəsi bitib. Admin panelindən yenidən açın.'),10*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!stopped)void session().catch(()=>{});});
window.addEventListener('pagehide',()=>{observer.disconnect();clearTimeout(expiry);channel.close();clear('Baxış sessiyası bağlandı.');},{once:true});
try{
 const p=await session();
 dispose=renderAccountPanel({app,state,api,el,button,link,alert:()=>el('p',{role:'status'}),avatars:['🤖','🌟','🌿','🦁','💎','🦉','🚀','🌊'],money:n=>(n/100).toFixed(2).replace('.',',')+' ₼',firstSession:Promise.resolve(p),session,readOnly:true,goLogin:()=>clear('Admin panelindən baxışı yenidən açın.')});
 protect();
}catch(e){if(!stopped)app.replaceChildren(el('section',{class:'account-empty'},el('h1',{},'Baxış açıla bilmədi'),el('p',{},e.message),button('Yenidən cəhd et',()=>location.reload())));}
