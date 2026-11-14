import {mountChat} from '/admin-chat-view.js?v=polish-20261102';
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/admin-community-panel.css?v=bubbles-20261102';document.head.append(sheet);
const base='/api/admin/community';let stop=()=>{},activeRoot,activeView,activeFilter;
const e=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
const call=(path,data)=>api(base+path,data===undefined?{}:{method:'POST',body:JSON.stringify(data)});
window.addEventListener('admin-community-view',event=>{if(event.detail!==activeView)stop();});window.addEventListener('pagehide',()=>stop());for(const event of ['mirpanel:session-expired','mirpanel:admin-logout'])window.addEventListener(event,()=>stop());
export async function mount(root,view,userFilter){if(root===activeRoot&&view===activeView&&(userFilter===undefined||userFilter===activeFilter))return;stop();activeRoot=root;activeView=view;activeFilter=userFilter;let alive=true,stream;stop=()=>{alive=false;stream?.close();activeRoot=null;activeView=null;};root.replaceChildren(e('p','Yüklənir…'));
 const error=e('p');error.setAttribute('role','alert');
 try{
 if(view==='communityShop'){const {mountShop}=await import('/admin-shop.js?v=admin-receipt-retry-1');const close=await mountShop({root,call,alive:()=>alive});if(!alive)close();else stop=()=>{alive=false;close();activeRoot=null;activeView=null;};return;}
 if(view==='communityUsers'){const {mountUsers}=await import('/admin-wallet-users.js?v=retained-profile-1');const close=await mountUsers({root,call,alive:()=>alive,userFilter});if(!alive)close();else stop=()=>{alive=false;close();activeRoot=null;activeView=null;};return;}
 const state=await call('/state');if(!alive)return;
 const close=await mountChat({root,state,call,alive:()=>alive});if(!alive)close();else stop=()=>{alive=false;close();activeRoot=null;activeView=null;};
 }catch(x){if(alive)root.replaceChildren(error);error.textContent=x.message;}
}
