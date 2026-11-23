import {supportView} from './staff-support.js?v=1';
const content=document.querySelector('#staffContent'),error=document.querySelector('#staffError');
const el=(t,text)=>{const n=document.createElement(t);if(text!=null)n.textContent=text;return n;};
const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=()=>void run(fn);return b;};
const money=v=>(Number(v)/100).toLocaleString('az-AZ',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₼';
let page=1,q='',selected=null,orderPage=1,revision=0,blocked=false;
async function call(route,body){const r=await fetch('/api/community/staff'+route,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok){if([401,403].includes(r.status)){blocked=true;revision++;document.querySelectorAll('dialog').forEach(n=>n.remove());content.replaceChildren();if(r.status===401)login();}throw Error(d.error||'Yükləmə alınmadı.');}return d;}
function login(){
 const form=el('form'),email=el('input'),password=el('input'),submit=el('button','İşçi hesabı ilə daxil ol');email.type='email';email.autocomplete='username';email.placeholder='İşçinin e-poçtu';email.required=true;email.setAttribute('aria-label','E-poçt');password.type='password';password.autocomplete='current-password';password.placeholder='Şifrə';password.required=true;password.setAttribute('aria-label','Şifrə');submit.type='submit';form.append(email,password,submit);form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;error.textContent='';try{const r=await fetch('/api/auth/sign-in/email',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value,password:password.value})});if(!r.ok)throw Error('Giriş alınmadı. Hesab məlumatlarınızı yoxlayın.');password.value='';location.reload();}catch(e){error.textContent=e.message;}finally{submit.disabled=false;}};content.append(el('h2','İşçi girişi'),form,el('p','Google hesabı ilə giriş üçün yuxarıdakı “Öz hesabımla daxil ol” keçidindən istifadə edin, sonra bu ünvana qayıdın.'));
}
async function run(fn){try{error.textContent='';await fn();}catch(e){error.textContent=e.message;if(!blocked)error.append(' ',button('Yenidən cəhd et',fn));}}
function identity(u){const card=el('article');card.append(el('h2',u.name),el('p','Müştəri ID-si: '+(u.memberNumber||'—')),el('p',u.email));const b=el('p','Mövcud balans: '+money(u.balanceCents));b.className='balance';card.append(b);return card;}
function pager(current,more,previous,next){const p=el('div');p.className='pager';const a=button('Əvvəlki',previous),b=button('Növbəti',next);a.disabled=current===1;b.disabled=!more;p.append(a,el('span','Səhifə '+current),b);return p;}
async function list(){
 const rev=++revision;selected=null;const d=await call('/users?'+new URLSearchParams({q,page}));if(blocked||rev!==revision)return;
 const form=el('form'),search=el('input');search.placeholder='Ad, müştəri ID-si və ya e-poçt';search.setAttribute('aria-label',search.placeholder);search.value=q;
 const submit=el('button','Axtar');submit.type='submit';form.append(search,submit);form.onsubmit=e=>{e.preventDefault();q=search.value.trim();page=1;void run(list);};content.replaceChildren(form);
 for(const u of d.users){const card=el('article');card.append(button(u.name,()=>detail(u.id)),el('p','#'+(u.memberNumber||'—')+' · '+u.email));content.append(card);}
 if(!d.users.length)content.append(el('p','İstifadəçi tapılmadı.'));
 content.append(pager(page,d.more,()=>{page--;return list();},()=>{page++;return list();}));
}
const statusName={completed:'Tamamlandı',approved:'Ödəniş təsdiqlənib',reviewing:'Yoxlanılır',pending:'Gözləyir',preparing:'Hazırlanır',rejected:'Rədd edildi',cancelled:'Ləğv edildi',canceled:'Ləğv edildi',expired:'Müddəti bitib',partial:'Qismən təhvil verildi'};
async function detail(id,view=false){
 const rev=++revision;const d=await call('/customer?'+new URLSearchParams({id,page:orderPage}));if(blocked||rev!==revision)return;selected=id;
 content.replaceChildren(button('← İşçi panelinə qayıt',()=>{orderPage=1;return list();}),identity(d.user));
 if(!view&&!d.permissions?.support){content.append(button('İstifadəçi gözündən bax',()=>{orderPage=1;return detail(id,true);}));return;}
 const notice=el('p','Baxılan müştəri: '+d.user.name+' · #'+d.user.memberNumber+(d.permissions?.support?' — müştəri dəstəyi. Müştəri sessiyası açılmır.':' — yalnız oxuma. Şifrə, kod və təhvil hesabları göstərilmir.'));notice.className='readonly';content.append(notice,el('h2','Sifarişlər'));const cards=new Map();
 for(const o of d.orders){const card=el('article');card.append(el('strong','Sifariş № '+o.number));
  if(o.lines?.length){for(const line of o.lines)card.append(el('p',line.product),el('p','Paket: '+line.package+' · '+line.quantity+' ədəd'));}
  else card.append(el('p',o.product),el('p','Paket: '+o.package));
  const state=d.details?.find(x=>x.number===o.number)?.status||o.status;card.append(el('p',new Date(o.date).toLocaleString('az-AZ',{timeZone:'Asia/Baku'})),el('p',o.amount+' '+o.currency),el('p','Status: '+(statusName[state]||state)));content.append(card);cards.set(o.number,card);}
 if(!d.orders.length)content.append(el('p','Sifariş yoxdur.'));
 if(d.permissions?.support)supportView(content,d,{call,button,cards,reload:()=>detail(id,true)});
 content.append(pager(orderPage,d.more||d.historyMore,()=>{orderPage--;return detail(id,true);},()=>{orderPage++;return detail(id,true);}));
}
document.querySelector('#staffLogout').onclick=()=>void run(async()=>{const r=await fetch('/api/auth/sign-out',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error('Çıxış alınmadı.');blocked=true;revision++;content.replaceChildren();location.assign('/hesab');});
// No personal data is persisted; role revocation clears open content within 10s.
let checking=false;const timer=setInterval(async()=>{if(checking||blocked)return;checking=true;try{await call('/session');}catch(e){error.textContent=e.message;}finally{checking=false;}},10000);
window.addEventListener('pagehide',()=>{clearInterval(timer);blocked=true;revision++;content.replaceChildren();},{once:true});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!blocked)void run(async()=>{await call('/session');});});
void run(async()=>{await call('/session');return list();});
