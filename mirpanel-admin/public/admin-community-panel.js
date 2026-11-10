import {mountChat} from '/admin-chat-view.js?v=polish-20261102';
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/admin-community-panel.css?v=bubbles-20261102';document.head.append(sheet);
const base='/api/admin/community';let stop=()=>{};
const e=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
const call=(path,data)=>api(base+path,data===undefined?{}:{method:'POST',body:JSON.stringify(data)});
window.addEventListener('admin-community-view',()=>stop());window.addEventListener('pagehide',()=>stop());
export async function mount(root,view,userFilter){stop();let alive=true,stream;stop=()=>{alive=false;stream?.close();};root.replaceChildren(e('p','Yüklənir…'));
 const error=e('p');error.setAttribute('role','alert');
 try{
 if(view==='communityShop'){const {mountShop}=await import('/admin-shop.js?v=admin-receipt-retry-1');const close=await mountShop({root,call,alive:()=>alive});if(!alive)close();else stop=()=>{alive=false;close();};return;}
 if(view==='communityUsers'){const {mountUsers}=await import('/admin-wallet-users.js?v=admin-audit-1');const close=await mountUsers({root,call,alive:()=>alive,userFilter});if(!alive)close();else stop=()=>{alive=false;close();};return;}
 const state=await call('/state');if(!alive)return;
 const close=await mountChat({root,state,call,alive:()=>alive});if(!alive)close();else stop=()=>{alive=false;close();};
 }catch(x){if(alive)root.replaceChildren(error);error.textContent=x.message;}
}
