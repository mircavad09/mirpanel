const element=(tag,text,className)=>{
 const node=document.createElement(tag);
 if(text!==undefined)node.textContent=text;
 if(className)node.className=className;
 return node;
};
let active;
export async function openInfluencerPreview({call,alive}){
 if(active?.open){active.focus();return;}
 if(!document.querySelector('[data-influencer-preview-style]')){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/influencer-preview.css?v=1';css.dataset.influencerPreviewStyle='';document.head.append(css);
 }
 const dialog=element('dialog',undefined,'influencer-preview');active=dialog;
 dialog.setAttribute('aria-label','Influencer sınaq görünüşü');
 const header=element('header'),heading=element('div'),back=element('button','Admin görünüşünə qayıt');back.type='button';
 heading.append(element('strong','Influencer sınaq görünüşü'),element('small','Yalnız adminə görünən sınaq mesajları'));header.append(heading,back);
 const messages=element('section',undefined,'influencer-preview-messages');messages.setAttribute('aria-label','Sınaq mesajları');
 const status=element('p','','influencer-preview-status');status.setAttribute('role','status');
 const form=element('form'),input=element('textarea'),send=element('button','Göndər');
 input.rows=2;input.maxLength=2000;input.placeholder='Sınaq mesajınızı yazın…';input.setAttribute('aria-label','Sınaq mesajı');send.type='submit';form.append(input,send);
 dialog.append(header,element('h2','Ümumi söhbət'),messages,status,form);document.body.append(dialog);
 let closed=false,busy=false,clientId=null,lastBody=null,profile;
 const available=()=>!closed&&alive()&&dialog.isConnected;
 function paint(data){
  profile=data;messages.replaceChildren();
  if(!data.items.length)messages.append(element('p','İlk sınaq mesajınızı yazın.','influencer-preview-empty'));
  for(const item of data.items){
   const row=element('article',undefined,'influencer-preview-message'),avatar=element('img');
   avatar.src=data.avatarUrl||'/community-assets/avatar-robot.webp';avatar.alt=data.name;avatar.className='influencer-preview-avatar';
   const content=element('div',undefined,'influencer-preview-content'),head=element('div',undefined,'influencer-preview-head');
   const gift=element('button','🎁 Hədiyyə et','influencer-preview-gift');gift.type='button';gift.onclick=()=>{status.textContent='Sınaq görünüşündə hədiyyə düyməsi dizayn üçün göstərilir.';};
   head.append(element('strong','♛ '+data.name),element('span','Influencer','influencer-preview-badge'),gift);
   const footer=element('footer'),remove=element('button','Sil');remove.type='button';remove.setAttribute('aria-label','Sınaq mesajını sil');
   const time=new Intl.DateTimeFormat('az-AZ',{timeZone:'Asia/Baku',hour:'2-digit',minute:'2-digit'}).format(new Date(item.createdAt));
   remove.onclick=async()=>{
    if(busy)return;busy=true;remove.disabled=true;
    try{const data=await call('/influencer-preview',{action:'delete',id:item.id});if(available()){paint(data);status.textContent='Sınaq mesajı silindi.';}}
    catch(error){if(available())status.textContent=error.message;}
    finally{busy=false;if(available())remove.disabled=false;}
   };
   footer.append(element('small','Sınaq mesajı · '+time),remove);
   content.append(head,element('p',item.body,'influencer-preview-body'),footer);row.append(avatar,content);messages.append(row);
  }
 }
 async function load(){
  status.textContent='Sınaq görünüşü yüklənir…';
  try{const data=await call('/influencer-preview');if(available()){paint(data);status.textContent='';}}
  catch(error){if(available()){status.replaceChildren(element('span',error.message+' '));const retry=element('button','Yenidən cəhd et');retry.type='button';retry.onclick=load;status.append(retry);}}
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!profile||!input.value.trim())return;
  const body=input.value;if(body!==lastBody){lastBody=body;clientId=crypto.randomUUID();}
  busy=true;send.disabled=true;status.textContent='Göndərilir…';
  try{const data=await call('/influencer-preview',{action:'send',body,clientId});if(available()){paint(data);if(input.value===body)input.value='';lastBody=null;clientId=null;status.textContent='Sınaq mesajı göndərildi.';messages.scrollTop=messages.scrollHeight;}}
  catch(error){if(available())status.textContent=error.message;}
  finally{busy=false;if(available())send.disabled=false;}
 };
 back.onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{closed=true;dialog.remove();if(active===dialog)active=null;},{once:true});
 const end=()=>dialog.close();
 for(const name of ['mirpanel:session-expired','mirpanel:admin-logout','pagehide'])window.addEventListener(name,end,{once:true});
 dialog.addEventListener('close',()=>{for(const name of ['mirpanel:session-expired','mirpanel:admin-logout','pagehide'])window.removeEventListener(name,end);},{once:true});
 const onView=()=>{if(!alive())dialog.close();};window.addEventListener('admin-community-view',onView);
 dialog.addEventListener('close',()=>window.removeEventListener('admin-community-view',onView),{once:true});
 dialog.showModal();await load();
}
