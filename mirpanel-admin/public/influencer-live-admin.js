import {chatElement as el,chatButton as button,chatModal} from '/community-assets/chat-components.js?v=gift-layout-3';
import {mountChat} from '/admin-chat-view.js?v=gift-layout-3';
export async function openInfluencerView({call,userId,alive=()=>true}){
 const data=await call('/influencer-view?userId='+encodeURIComponent(userId));if(!alive())return;
 let stop=()=>{},closed=false;
 const modal=chatModal({title:'İnfluencer gözündən bax',onClose:()=>{closed=true;stop();}});modal.box.classList.add('influencer-real-dialog');
 modal.close.textContent='Admin görünüşünə qayıt';
 const banner=el('div',null,'influencer-real-banner');banner.append(el('strong',data.recipient.name+' adından real Ümumi söhbətdə yazırsınız'),el('small','Göndərilən mesajlar bütün iştirakçılara görünür.'));
 const root=el('div',null,'influencer-real-root');modal.body.append(banner,root);
 try{const state=await call('/state');if(closed||!alive())return modal.box.close();stop=await mountChat({root,state,call,alive:()=>!closed&&alive(),represented:userId});if(closed)stop();}
 catch(e){root.replaceChildren(el('p',e.message));}
 const end=()=>modal.box.close();for(const name of ['mirpanel:session-expired','mirpanel:admin-logout'])window.addEventListener(name,end,{once:true});
 modal.box.addEventListener('close',()=>{for(const name of ['mirpanel:session-expired','mirpanel:admin-logout'])window.removeEventListener(name,end);},{once:true});
 return modal;
}
export async function openGiftAdmin({call,alive=()=>true}){
 const modal=chatModal({title:'Influencer hədiyyələri'});let page=1,busy=false;
 const error=el('p');error.setAttribute('role','alert');const list=el('div');modal.body.append(error,list);
 async function load(){if(busy)return;busy=true;try{const data=await call('/influencer-gifts?page='+page);if(!alive()||!modal.box.isConnected)return;list.replaceChildren();
 for(const gift of data.items){const row=el('section',null,'live-gift-admin-row');row.append(el('h3',gift.recipient_name+' üçün hədiyyə'),el('p','№'+gift.order_code+' · '+gift.donor_name),el('p',gift.items.map(x=>x.title+' · '+x.planName).join(', ')),el('strong',Number(gift.amount).toFixed(2).replace('.',',')+' ₼'));
 const cancelled=['cancelled','rejected','expired','refunded'].includes(gift.status),status=el('p',gift.presented_at?'Təqdim edildi':cancelled?'Ləğv edilib':gift.payment_confirmed?'Təqdim gözlənilir':'Ödəniş təsdiqlənməyib');row.append(status);
 if(!gift.presented_at&&!cancelled&&gift.payment_confirmed){const present=button('Təqdim edildi',async()=>{if(!confirm('Bu hədiyyəni təqdim etmisiniz?'))return;present.disabled=true;try{await call('/influencer-gifts',{action:'present',orderId:gift.order_id});await load();}catch(e){error.textContent=e.message;}finally{present.disabled=false;}});row.append(present);}list.append(row);}
 if(!data.items.length)list.append(el('p','Hədiyyə yoxdur.'));const nav=el('nav');if(page>1)nav.append(button('Əvvəlki',()=>{page--;void load();}));if(data.more)nav.append(button('Növbəti',()=>{page++;void load();}));list.append(nav);error.textContent='';
 }catch(e){error.replaceChildren(document.createTextNode(e.message),button('Yenidən cəhd et',load));}finally{busy=false;}}
 await load();return modal;
}
