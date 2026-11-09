import {createGroupAdmin} from '/community-assets/group-admin.js';
import {tierLabel} from '/community-assets/tier-labels.js';
import {mountChat} from '/admin-chat-view.js?v=polish-20261102';
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/admin-community-panel.css?v=bubbles-20261102';document.head.append(sheet);
const base='/api/admin/community';let stop=()=>{};
const e=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
const btn=(text,fn)=>{const n=e('button',text);n.className='btn';n.type='button';n.onclick=fn;return n;};
const call=(path,data)=>api(base+path,data===undefined?{}:{method:'POST',body:JSON.stringify(data)});
const date=v=>v?new Date(v).toLocaleString('az-AZ'):'Məlumat yoxdur';
window.addEventListener('admin-community-view',()=>stop());window.addEventListener('pagehide',()=>stop());
export async function mount(root,view,userFilter){stop();let alive=true,stream;stop=()=>{alive=false;stream?.close();};root.replaceChildren(e('p','Yüklənir…'));
 const error=e('p');error.setAttribute('role','alert');
 const guarded=fn=>async(...args)=>{try{await fn(...args);}catch(x){error.textContent=x.message;}};
 try{
 if(view==='communityShop'){const {mountShop}=await import('/admin-shop.js?v=topup-rejection-1');const close=await mountShop({root,call,alive:()=>alive});if(!alive)close();else stop=()=>{alive=false;close();};return;}
 if(view==='communityUsers'){const {mountUsers}=await import('/admin-wallet-users.js?v=customer-view-1');const close=await mountUsers({root,call,alive:()=>alive,userFilter});if(!alive)close();else stop=()=>{alive=false;close();};return;}
 if(view==='communityUsers'){
  let page=1,q='';const input=e('input');input.placeholder='Ad, e-poçt, üzv ID-si';const list=e('div'),detail=e('section'),label=e('span');
  const show=guarded(async id=>{const r=await call('/users/'+encodeURIComponent(id));if(!alive)return;detail.replaceChildren(e('h2',r.user.name));
   const p=r.profile||{};if(p.avatarUrl){const img=e('img');img.src=p.avatarUrl;img.width=64;img.alt='Avatar';detail.append(img);}else detail.append(e('span',['🌙','🌟','🌿','🦁','💎','🦉','🚀','🌊'][p.avatar]||'🌙'));
   const labels={id:'Daxili ID',memberNumber:'Üzv ID-si',name:'Ad və soyad',email:'E-poçt',emailVerified:'E-poçt təsdiqi',createdAt:'Qeydiyyat',firstName:'Ad',lastName:'Soyad',blocked:'Ban işarəsi',banUntil:'Ban müddəti',mutedPermanent:'Daimi susdurma',mutedUntil:'Susdurma müddəti',online:'Onlayn',display_name:'Görünən ad',first_name:'Ad',last_name:'Soyad',phone:'Telefon (təsdiqlənməyib)',whatsapp:'WhatsApp (təsdiqlənməyib)',social_links:'Sosial hesablar'};
   for(const [k,v]of Object.entries({...r.user,...p}))if(labels[k])detail.append(e('p',labels[k]+': '+(v==null?'Məlumat yoxdur':typeof v==='boolean'?v?'Bəli':'Xeyr':typeof v==='object'?JSON.stringify(v):v)));
   detail.append(e('p','Səviyyə: '+tierLabel(r.tier.id)));
   detail.append(e('h3','Hesaba bağlı sifarişlər'));for(const o of r.orders)detail.append(e('p',[o.order_code,o.product_title,o.plan_name,o.amount,o.currency,o.status].join(' · ')));if(!r.orders.length)detail.append(e('p','Hələ yoxdur'));
  });
  const load=guarded(async()=>{const r=await call('/users?'+new URLSearchParams({page,q}));if(!alive)return;list.replaceChildren();for(const u of r.users){const n=e('article');n.className='panel';n.append(btn('#'+(u.memberNumber||'—')+' · '+u.name,()=>show(u.id)),e('p',u.email),e('p','Qeydiyyat: '+date(u.createdAt)),e('p','Hesab: '+(u.blocked&&(!u.banUntil||Date.parse(u.banUntil)>Date.now())?'Ban edilib':u.emailVerified?'Aktiv':'Təsdiq gözləyir')+' · '+(u.online?'Onlayn':'Oflayn')),e('p','Susdurma: '+(u.mutedPermanent?'Daimi':date(u.mutedUntil))));list.append(n);}if(!r.users.length)list.append(e('p','İstifadəçi tapılmadı.'));label.textContent=`Səhifə ${page} · ${r.total}`;next.disabled=!r.hasMore;prev.disabled=page===1;});
  const prev=btn('Əvvəlki',()=>{page--;load();}),next=btn('Növbəti',()=>{page++;load();});root.replaceChildren(e('h1','İstifadəçilər'),input,btn('Axtar',()=>{q=input.value.trim();page=1;load();}),error,list,prev,label,next,detail);await load();return;
 }
 const state=await call('/state');if(!alive)return;
 const close=await mountChat({root,state,call,alive:()=>alive});if(!alive)close();else stop=()=>{alive=false;close();};
 }catch(x){if(alive)root.replaceChildren(error);error.textContent=x.message;}
}
