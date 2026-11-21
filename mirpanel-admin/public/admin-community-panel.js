import {mountChat} from '/admin-chat-view.js?v=tokens-1';
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/admin-community-panel.css?v=tokens-1';document.head.append(sheet);
const base='/api/admin/community';let stop=()=>{},activeRoot,activeView,activeFilter;
const e=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
const call=(path,data)=>api(base+path,data===undefined?{}:{method:'POST',body:JSON.stringify(data)});
window.addEventListener('admin-community-view',event=>{if(event.detail!==activeView)stop();});window.addEventListener('pagehide',()=>stop());for(const event of ['mirpanel:session-expired','mirpanel:admin-logout'])window.addEventListener(event,()=>stop());
export async function mount(root,view,userFilter){if(root===activeRoot&&view===activeView&&(userFilter===undefined||userFilter===activeFilter))return;stop();activeRoot=root;activeView=view;activeFilter=userFilter;let alive=true,stream;stop=()=>{alive=false;stream?.close();activeRoot=null;activeView=null;};root.replaceChildren(e('p','Yüklənir…'));
 const error=e('p');error.setAttribute('role','alert');
 try{
 if(view==='communityShop'){const {mountShop}=await import('/admin-shop.js?v=admin-receipt-retry-1');const close=await mountShop({root,call,alive:()=>alive});if(!alive)close();else stop=()=>{alive=false;close();activeRoot=null;activeView=null;};return;}
 if(view==='communityUsers'){const {mountUsers}=await import('/admin-wallet-users.js?v=gift-compact-4');const close=await mountUsers({root,call,alive:()=>alive,userFilter});if(!alive)close();else stop=()=>{alive=false;close();activeRoot=null;activeView=null;};return;}
 const state=await call('/state');if(!alive)return;
 const close=await mountChat({root,state,call,alive:()=>alive});if(!alive)close();else stop=()=>{alive=false;close();activeRoot=null;activeView=null;};
 if(alive){const panel=e('section'),label=e('label'),toggle=e('input'),note=e('p');toggle.type='checkbox';toggle.checked=state.settings?.public_open===true;label.append(toggle,document.createTextNode(' İctimai Ümumi qrup söhbəti aktivdir'));note.textContent=toggle.checked?'Müştərilər qrupu görə və yaza bilirlər.':'Qrup söhbəti müvəqqəti bağlıdır. Mesajlar və tarixçə saxlanılır; şəxsi dəstək işləyir.';panel.append(label,note);panel.style.cssText='padding:14px;border:1px solid #806b22;border-radius:12px;margin-bottom:12px';root.prepend(panel);toggle.onchange=async()=>{const value=toggle.checked;if(value&&!confirm('İctimai qrupu bütün müştərilər üçün yenidən açmaq istəyirsiniz?')){toggle.checked=false;return;}toggle.disabled=true;try{const r=await call('/public-group',{open:value,requestId:crypto.randomUUID()});note.textContent=r.message;window.dispatchEvent(new CustomEvent('mirpanel:public-group',{detail:{open:r.open}}));}catch(x){toggle.checked=!value;note.textContent=x.message;}finally{toggle.disabled=false;}};}
 }catch(x){if(alive)root.replaceChildren(error);error.textContent=x.message;}
}
