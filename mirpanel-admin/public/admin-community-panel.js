import {createGroupAdmin} from '/community-assets/group-admin.js';
import {tierLabel} from '/community-assets/tier-labels.js';
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/admin-community-panel.css?v=20261102';document.head.append(sheet);
const base='/api/admin/community';let stop=()=>{};
const e=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
const btn=(text,fn)=>{const n=e('button',text);n.className='btn';n.type='button';n.onclick=fn;return n;};
const call=(path,data)=>api(base+path,data===undefined?{}:{method:'POST',body:JSON.stringify(data)});
const date=v=>v?new Date(v).toLocaleString('az-AZ'):'Məlumat yoxdur';
window.addEventListener('admin-community-view',()=>stop());window.addEventListener('pagehide',()=>stop());
export async function mount(root,view){stop();let alive=true,stream;stop=()=>{alive=false;stream?.close();};root.replaceChildren(e('p','Yüklənir…'));
 const error=e('p');error.setAttribute('role','alert');
 const guarded=fn=>async(...args)=>{try{await fn(...args);}catch(x){error.textContent=x.message;}};
 try{
 if(view==='communityUsers'){
  let page=1,q='';const input=e('input');input.placeholder='Ad, e-poçt, üzv ID-si';const list=e('div'),detail=e('section'),label=e('span');
  const show=guarded(async id=>{const r=await call('/users/'+encodeURIComponent(id));if(!alive)return;detail.replaceChildren(e('h2',r.user.name));
   const p=r.profile||{};if(p.avatar_path){const img=e('img');img.src='/api/community/media/'+p.avatar_path;img.width=64;img.alt='Avatar';detail.append(img);}else detail.append(e('span',['🌙','🌟','🌿','🦁','💎','🦉','🚀','🌊'][p.avatar]||'🌙'));
   const labels={id:'Daxili ID',memberNumber:'Üzv ID-si',name:'Ad və soyad',email:'E-poçt',emailVerified:'E-poçt təsdiqi',createdAt:'Qeydiyyat',firstName:'Ad',lastName:'Soyad',blocked:'Ban işarəsi',banUntil:'Ban müddəti',mutedPermanent:'Daimi susdurma',mutedUntil:'Susdurma müddəti',online:'Onlayn',display_name:'Görünən ad',first_name:'Ad',last_name:'Soyad',phone:'Telefon (təsdiqlənməyib)',whatsapp:'WhatsApp (təsdiqlənməyib)',social_links:'Sosial hesablar'};
   for(const [k,v]of Object.entries({...r.user,...p}))if(labels[k])detail.append(e('p',labels[k]+': '+(v==null?'Məlumat yoxdur':typeof v==='boolean'?v?'Bəli':'Xeyr':typeof v==='object'?JSON.stringify(v):v)));
   detail.append(e('p','Səviyyə: '+tierLabel(r.tier.id)));
   detail.append(e('h3','Hesaba bağlı sifarişlər'));for(const o of r.orders)detail.append(e('p',[o.order_code,o.product_title,o.plan_name,o.amount,o.currency,o.status].join(' · ')));if(!r.orders.length)detail.append(e('p','Hələ yoxdur'));
  });
  const load=guarded(async()=>{const r=await call('/users?'+new URLSearchParams({page,q}));if(!alive)return;list.replaceChildren();for(const u of r.users){const n=e('article');n.className='panel';n.append(btn('#'+(u.memberNumber||'—')+' · '+u.name,()=>show(u.id)),e('p',u.email),e('p','Qeydiyyat: '+date(u.createdAt)),e('p','Hesab: '+(u.blocked&&(!u.banUntil||Date.parse(u.banUntil)>Date.now())?'Ban edilib':u.emailVerified?'Aktiv':'Təsdiq gözləyir')+' · '+(u.online?'Onlayn':'Oflayn')),e('p','Susdurma: '+(u.mutedPermanent?'Daimi':date(u.mutedUntil))));list.append(n);}if(!r.users.length)list.append(e('p','İstifadəçi tapılmadı.'));label.textContent=`Səhifə ${page} · ${r.total}`;next.disabled=!r.hasMore;prev.disabled=page===1;});
  const prev=btn('Əvvəlki',()=>{page--;load();}),next=btn('Növbəti',()=>{page++;load();});root.replaceChildren(e('h1','İstifadəçilər'),input,btn('Axtar',()=>{q=input.value.trim();page=1;load();}),error,list,prev,label,next,detail);await load();return;
 }
 const state=await call('/state');if(!alive)return;const list=e('div'),input=e('textarea'),send=btn('Göndər',guarded(async()=>{if(send.disabled)return;send.disabled=true;try{const body=input.value;const result=await call('/messages',{body,clientId:draftId});if(result.blocked)throw Error(result.warning);input.value='';draftId=crypto.randomUUID();await refresh();}finally{send.disabled=false;}}));let draftId=crypto.randomUUID();
 input.placeholder='Mesajınızı yazın…';input.maxLength=2000;input.addEventListener('input',()=>{draftId=crypto.randomUUID();});
 const el=(tag,attrs={},...children)=>{const n=e(tag);for(const[k,v]of Object.entries(attrs))if(k==='class')n.className=v;else n.setAttribute(k,v);for(const c of children.flat())if(c!=null)n.append(typeof c==='string'?document.createTextNode(c):c);return n;};
 const controls=createGroupAdmin({state,api:(url,data)=>call(url.replace('/api/community',''),data),el,button:btn,onChange:async()=>{const s=await call('/state');controls.updateSettings(s.settings);await refresh();}});controls.updateSettings(state.settings);
 let messages=new Map();function paint(){list.replaceChildren();for(const m of [...messages.values()].sort((a,b)=>Number(a.id)-Number(b.id))){const row=e('article');row.className='panel';if(m.author?.avatarUrl){const img=e('img');img.src=m.author.avatarUrl;img.alt='';img.width=32;row.append(img);}row.append(e('strong',m.author?.name||'İştirakçı'),e('small',m.author?.role==='admin'?' Admin':''),e('p',m.body),e('small',date(m.createdAt)));const menu=controls.messageMenu(m);if(menu)row.append(menu);list.append(row);}}
 async function refresh(){const r=await call('/messages');if(!alive)return;messages=new Map(r.items.map(m=>[m.id,m]));paint();}
 list.className='admin-community-messages';input.setAttribute('aria-label','Qrup mesajı');send.classList.add('primary');
 root.replaceChildren(e('h1','Qrup söhbət'),controls.settingsButton,error,list,input,send);await refresh();if(!alive)return;
 stream=new EventSource(base+'/events?after='+Math.max(0,...[...messages.keys()].map(Number))+'&known='+[...messages.keys()].join(','));stream.addEventListener('messages',x=>{if(!alive)return;const r=JSON.parse(x.data);for(const id of r.removed||[])messages.delete(id);for(const m of r.items)messages.set(m.id,m);paint();});stream.onerror=()=>{error.textContent='Bağlantı bərpa olunur.';};stream.onopen=()=>{error.textContent='';};
 }catch(x){if(alive)root.replaceChildren(error);error.textContent=x.message;}
}
