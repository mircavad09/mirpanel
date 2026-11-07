import {accountTab,profileCSS,profileShell} from './profile-shell.js?v=profile-start-20261108';
import {getCommunityState,invalidateCommunityState,communityJson} from '/session-state.js?v=auth-recovery-20261107';

export function mountProfile(app,verifiedState){
 const life=new AbortController(),signal=life.signal,state={...verifiedState},avatars=['🌙','🌟','🌿','🦁','💎','🦉','🚀','🌊'];
 let cleanup,stopped=false;
 document.body.classList.add('profile-screen');
 function style(href){
  let n=[...document.querySelectorAll('link[rel=stylesheet]')].find(x=>x.href===new URL(href,location.origin).href);
  if(!n){n=document.createElement('link');n.rel='stylesheet';n.href=href;document.head.append(n);}
  n.dataset.shellPersistent='';n.disabled=false;n.media='all';
 }
 style('/community-assets/community.css');
 style(profileCSS);
 style('/community-assets/profile.css?v=profile-stats-20261030');
 style('/browser-orders.css?v=order-cards-20261108');
 if(!app.querySelector('.account-panel'))app.innerHTML=profileShell(location.search);
 const el=(tag,attrs={},...children)=>{const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(v!==undefined)n.setAttribute(k,String(v));}for(const c of children.flat())if(c!=null)n.append(c);return n;};
 const button=(text,fn,primary=false)=>el('button',{type:'button',class:primary?'primary':'',onclick:fn},text);
 const link=(text,href,cls='button')=>el('a',{href,class:cls},text);
 const alert=()=>el('p',{class:'community-alert',role:'status','aria-live':'polite'});
 const money=n=>(n/100).toFixed(2)+' ₼';
 async function api(url,data,method='POST'){
  const controller=new AbortController(),abort=()=>controller.abort();
  if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,12000);
  try{
   const r=await fetch(url,{method:data===undefined?'GET':method,credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store',signal:controller.signal});
   const value=await communityJson(r);
   if(!r.ok)throw Object.assign(Error(value.error||'Məlumat alınmadı.'),{status:r.status});
   return value;
  }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
 }
 function goLogin(){
  const q=new URLSearchParams(location.search),code=q.get('order'),tab=accountTab(location.search);
  const next=tab==='orders'?(/^[A-Za-z0-9-]{1,40}$/.test(code||'')?'/profil?tab=orders&order='+code:'/sifarislerim'):null;
  const href='/hesab'+(next?'?next='+encodeURIComponent(next):'');
  if(window.MirpanelNavigation)void window.MirpanelNavigation.go(href);else location.replace(href);
 }
 async function session(fresh=false){
  if(fresh)invalidateCommunityState();
  const r=await getCommunityState();
  if(stopped)return null;
  if(r.status===401||r.ok&&!r.data.profile){goLogin();return null;}
  if(!r.ok)throw Error(r.data.error||'Hesab məlumatı alınmadı.');
  Object.assign(state,r.data);return state.profile;
 }
 const firstSession=verifiedState?.profile?Promise.resolve(verifiedState.profile):session();void firstSession.catch(()=>{});
 const boot=async()=>{try{
  const {renderAccountPanel}=await import('./account-panel.js?v=order-cards-20261108');
  if(stopped||!app.isConnected)return;
  cleanup=renderAccountPanel({app,state,api,el,button,link,alert,avatars,money,firstSession,session,goLogin});
 }catch{
  if(!stopped)app.querySelector('.account-tab-content')?.append(el('p',{role:'alert'},'Profil görünüşü açıla bilmədi.'),button('Yenidən cəhd et',()=>location.reload()));
 }};
 const dispose=()=>{if(stopped)return;stopped=true;life.abort();cleanup?.();document.body.classList.remove('profile-screen');};
 window.addEventListener('pagehide',dispose,{signal});
 window.mirpanelPageDispose=dispose;void boot();return dispose;
}
if(document.getElementById('communityApp')?.hasAttribute('data-profile-entry')&&!window.mirpanelNavigationMounting)mountProfile(document.getElementById('communityApp'));
