import {chatElement as el,chatButton as btn,messageBubble,chatModal,openChatProfile,decorateInfluencer} from '/community-assets/chat-components.js?v=live-influencers-2';
import {openGiftDialog} from '/community-assets/gift-dialog.js?v=interactive-preview-1';
let active;
const money=c=>(c/100).toFixed(2).replace('.',',')+' ₼';
export async function openInfluencerPreview({call,alive=()=>true}){
 active?.close();
 if(!document.querySelector('[data-interactive-preview-style]')){const l=el('link');l.rel='stylesheet';l.href='/influencer-preview-interactive.css?v=3';l.dataset.interactivePreviewStyle='';document.head.append(l);}
 const root=el('dialog',null,'interactive-preview');root.setAttribute('aria-label','Influencer sınaq görünüşü');active=root;
 let profile,products=[],records=[],gifts=[],mode='influencer',balance=2000,scenario='success',generation=0;
 const children=new Set(),results=new Map(),track=m=>{children.add(m.box);m.box.addEventListener('close',()=>children.delete(m.box));return m;};
 const closeChildren=()=>{for(const d of children)d.close();children.clear();};
 const header=el('header');header.append(el('h2','Influencer sınaq görünüşü'),btn('Admin görünüşünə qayıt',()=>root.close()));
 const notice=el('p','SINAQ REJİMİ · Real söhbət, balans, sifariş, stok və bildirişlər dəyişmir.','chat-test-label');
 const controls=el('section',null,'preview-controls'),status=el('p');status.setAttribute('role','status');
 const influencer=btn('Influencer kimi bax',()=>setMode('influencer')),customer=btn('Müştəri kimi bax',()=>setMode('customer'));
 const balanceInput=el('input');Object.assign(balanceInput,{type:'number',min:'0',max:'100000',step:'0.01',value:'20.00'});balanceInput.setAttribute('aria-label','Sınaq balansı — ₼');
 balanceInput.oninput=()=>{const n=Number(balanceInput.value);if(Number.isFinite(n)&&n>=0&&n<=100000)balance=Math.round(n*100);};
 const balanceLabel=el('label','Sınaq balansı — ₼');balanceLabel.append(balanceInput);
 const scenarioInput=el('select');scenarioInput.setAttribute('aria-label','Hədiyyə ssenarisi');for(const [v,t] of [['success','Uğurlu hədiyyə'],['stock','Stok bitib'],['error','Müvəqqəti xəta']])scenarioInput.add(new Option(t,v));scenarioInput.onchange=()=>scenario=scenarioInput.value;
 const scenarioLabel=el('label','Hədiyyə ssenarisi');scenarioLabel.append(scenarioInput);
 const toggle=el('input');toggle.type='checkbox';toggle.checked=true;toggle.setAttribute('aria-label','Reklam bannerini göstər');const toggleLabel=el('label','Reklam bannerini göstər');toggleLabel.prepend(toggle);toggle.onchange=paintBanner;
 const bannerProduct=el('select');bannerProduct.setAttribute('aria-label','Banner məhsulu');bannerProduct.onchange=paintBanner;
 controls.append(influencer,customer,balanceLabel,scenarioLabel,toggleLabel,bannerProduct,btn('Sınağı sıfırla',reset));
 const banner=el('aside',null,'preview-banner'),messages=el('section',null,'preview-messages'),history=el('details',null,'preview-history');messages.setAttribute('aria-label','Sınaq söhbəti');
 const composer=el('form',null,'preview-composer'),draft=el('textarea');Object.assign(draft,{rows:2,maxLength:4000,placeholder:'Sınaq mesajı yazın…'});draft.setAttribute('aria-label','Sınaq mesajı');const send=btn('Göndər',()=>{});send.type='submit';composer.append(draft,send);
 composer.onsubmit=e=>{e.preventDefault();const body=draft.value.trim();if(!body||!profile)return;records.push({id:crypto.randomUUID(),author:mode,body,createdAt:new Date().toISOString()});draft.value='';paint();messages.scrollTop=messages.scrollHeight;status.textContent='Sınaq mesajı göndərildi.';};
 draft.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();composer.requestSubmit();}};
 root.append(header,notice,controls,status,banner,messages,history,composer);document.body.append(root);root.showModal();
 const valid=()=>root.open&&alive();
 function identity(kind){return kind==='influencer'?{name:profile.name,memberNumber:1554,avatarUrl:profile.avatarUrl,influencer:true}:{name:'Sınaq müştərisi',memberNumber:'SINAQ',influencer:false};}
 function showProfile(author){track(openChatProfile(author,{test:true}));}
 function setMode(value){mode=value;closeChildren();paint();}
 function paint(){
  if(!profile)return;influencer.setAttribute('aria-pressed',String(mode==='influencer'));customer.setAttribute('aria-pressed',String(mode==='customer'));
  messages.replaceChildren();for(const r of records){
   const a=identity(r.author),row=el('article',null,'community-message preview-message'+(r.author===mode?' is-own':''));row.dataset.messageId=r.id;
   const avatar=btn('',()=>showProfile(a),'chat-author-button'),image=el('img');image.src=a.avatarUrl||'/community-assets/avatar-robot.webp';image.alt=a.name;image.width=36;image.height=36;avatar.setAttribute('aria-label',a.name+' — profil');avatar.append(image);
   const content=el('div',null,'community-message-content'),head=el('div',null,'community-message-head');head.append(el('strong',a.name));
   const menu=el('details',null,'preview-menu'),summary=el('summary','⋯');summary.setAttribute('aria-label','Mesaj əməliyyatları');menu.append(summary,btn('Profilə bax',()=>showProfile(a)));if(!r.deleted)menu.append(btn('Sınaq mesajını sil',()=>deleteMessage(r)));
   content.append(head,messageBubble(r));row.append(avatar,content,menu);decorateInfluencer(row,a,{own:mode==='influencer',onProfile:()=>showProfile(a),onGift:r.deleted?undefined:()=>gift(a)});
   if(!a.influencer)head.querySelector('strong').replaceWith(btn(a.name,()=>showProfile(a),'chat-author-button'));messages.append(row);
  }
  if(!records.length)messages.append(el('p','İlk sınaq mesajınızı yazın.'));
  history.replaceChildren(el('summary','Sınaq hədiyyələri ('+gifts.length+')'));for(const g of gifts)history.append(el('p',g.id+' · '+g.title+' · '+money(g.unitCents)+' → #1554'));
 }
 function deleteMessage(r){const m=track(chatModal({title:'Sınaq mesajını sil?',test:true}));m.body.append(el('p',r.body),el('p','Yalnız seçilmiş sınaq mesajı silinəcək.'),btn('Ləğv et',()=>m.box.close()),btn('Silməni təsdiqlə',()=>{r.deleted=true;paint();m.box.close();status.textContent='Sınaq mesajı silindi.';}));}
 function gift(recipient){const epoch=generation;track(openGiftDialog({products,recipient,test:true,getBalance:()=>balance,addBalance:c=>{balance+=c;balanceInput.value=(balance/100).toFixed(2);},submit:async request=>{
  if(!valid()||epoch!==generation)throw new Error('Sınaq bağlanıb.');if(results.has(request.requestId))return results.get(request.requestId);
  if(scenario==='stock')throw new Error('Sınaq: seçilmiş paketin stoku bitib. Başqa paket seçin.');if(scenario==='error')throw new Error('Sınaq: müvəqqəti xəta. Balans tutulmayıb. Yenidən cəhd edə bilərsiniz.');
  const p=products.find(p=>p.id===request.productId),plan=p?.plans.find(p=>p.index===request.planIndex);if(!plan||Math.round(plan.price*100)!==request.unitCents)throw new Error('Paket qiyməti uyğun gəlmir.');
  if(balance<request.unitCents){const e=new Error('Balans çatışmır');e.code='BALANCE';throw e;}
  balance-=request.unitCents;balanceInput.value=(balance/100).toFixed(2);const result={...request,id:'SINAQ-'+(gifts.length+1),title:p.title+' · '+plan.label};results.set(request.requestId,result);gifts.push(result);paint();return result;
 }}));}
 function paintBanner(){banner.replaceChildren();banner.hidden=!toggle.checked||!products.length;if(banner.hidden)return;
  const p=products.find(p=>p.id===bannerProduct.value)||products[0],image=el('img');image.src=p.image||'/community-assets/avatar-robot.webp';image.alt=p.title;
  const info=el('div');info.append(el('strong',p.title),el('p','Sınaq reklam banneri'),btn('Bu məhsulu əldə et',()=>{const m=track(chatModal({title:p.title,test:true}));m.body.append(el('p','Bu məhsulun paketləri:'));for(const plan of p.plans)m.body.append(el('p',plan.label+' — '+money(Math.round(plan.price*100))));const link=el('a','Məhsul səhifəsini aç');link.href=p.url;link.target='_blank';link.rel='noopener';m.body.append(el('p','Keçid real məhsul səhifəsini yeni tabda açır. Alış avtomatik edilmir.'),link);}));banner.append(image,info,btn('Banneri bağla',()=>{toggle.checked=false;paintBanner();}));
 }
 function reset(){const m=track(chatModal({title:'Sınağı sıfırla?',test:true})),error=el('p');error.setAttribute('role','alert');const confirm=btn('Sınaq məlumatlarını təmizlə',async()=>{confirm.disabled=true;try{await call('/influencer-preview',{action:'reset'});if(!valid())return;generation++;records=[];gifts=[];results.clear();draft.value='';balance=2000;balanceInput.value='20.00';scenario='success';scenarioInput.value=scenario;paint();m.box.close();status.textContent='Sınaq sıfırlandı.';}catch(e){error.textContent='Sınaq sıfırlanmadı. Yenidən cəhd edin.';confirm.disabled=false;}});m.body.append(el('p','Yalnız sizə aid sınaq mesajları və hədiyyələri təmizlənəcək.'),error,btn('Ləğv et',()=>m.box.close()),confirm);}
 async function load(){status.textContent='Sınaq yüklənir…';try{const data=await call('/influencer-preview');if(!valid())return;if(!data.test||data.memberNumber!==1554)throw new Error('Yanlış sınaq profili');profile=data;products=(data.products||[]).filter(p=>p.plans?.length);records=(data.items||[]).map(r=>({...r,author:'influencer'}));if(!records.length)records=[{id:crypto.randomUUID(),author:'influencer',body:'Salam! Bu, Çiçəyin sınaq mesajıdır. 💛',createdAt:new Date().toISOString()}];bannerProduct.replaceChildren();for(const p of products)bannerProduct.add(new Option(p.title,p.id));status.textContent='Sınaq hazırdır. Mesajlar və hədiyyələr yalnız bu sınaqdadır.';paint();paintBanner();}catch(e){if(valid())status.replaceChildren(el('span','Sınaq yüklənmədi. '),btn('Yenidən cəhd et',load));}}
 const leave=()=>root.close(),events=['mirpanel:admin-logout','mirpanel:admin-session-expired','mirpanel:session-expired','pagehide'],view=()=>{if(!alive())root.close();};for(const e of events)window.addEventListener(e,leave);window.addEventListener('admin-community-view',view);
 root.addEventListener('close',()=>{generation++;closeChildren();records=[];gifts=[];results.clear();draft.value='';for(const e of events)window.removeEventListener(e,leave);window.removeEventListener('admin-community-view',view);root.remove();if(active===root)active=null;},{once:true});await load();return root;
}
