// Shared display-only primitives. No API, storage, balance or order access.
const existingChatStyle=document.querySelector('[data-chat-components-style]');if(existingChatStyle)existingChatStyle.href='/community-assets/chat-components.css?v=tokens-1';
if(!existingChatStyle){
 const link=document.createElement('link');link.rel='stylesheet';link.href='/community-assets/chat-components.css?v=tokens-1';link.dataset.chatComponentsStyle='';document.head.append(link);
}
export function chatElement(tag,text,className){
 const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;
}
export function chatButton(text,action,className){
 const n=chatElement('button',text,className);n.type='button';n.onclick=action;return n;
}
export function messageBubble(message){
 const bubble=chatElement('div',null,'community-message-bubble');
 const body=chatElement('p',message.deleted?'Mesaj silindi':message.body,'community-message-body');
 if(message.deleted){body.classList.add('is-deleted');body.setAttribute('aria-label','Silinmiş mesaj');}
 const time=chatElement('time',new Date(message.createdAt).toLocaleTimeString('az-AZ',{hour:'2-digit',minute:'2-digit'}));
 time.dateTime=message.createdAt;if(message.tokenGift&&!message.deleted){const gift=chatElement('img',null,'token-gift-event-image');gift.src=message.tokenGift.image;gift.alt=message.tokenGift.name;gift.width=96;gift.height=96;bubble.append(gift);}bubble.append(body,time);return bubble;
}
export function chatModal({title,parent=document.body,test=false,onClose}){
 const box=chatElement('dialog',null,'chat-component-modal'+(test?' is-test':''));
 box.setAttribute('aria-label',title);const head=chatElement('header'),heading=chatElement('h2',title);
 const close=chatButton('Bağla',()=>box.close());head.append(heading,close);
 const body=chatElement('section',null,'chat-component-modal-body');
 if(test)body.append(chatElement('p','SINAQ REJİMİ · Real əməliyyat aparılmır','chat-test-label'));
 box.append(head,body);parent.append(box);
 box.addEventListener('click',event=>{if(event.target===box){const r=box.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)box.close();}});
 box.addEventListener('close',()=>{box.remove();onClose?.();},{once:true});box.showModal();return {box,body,close};
}
export function openChatProfile(author,{test=false,parent,onClose}={}){
 const modal=chatModal({title:'İstifadəçi profili',test,parent,onClose});
 const avatar=chatElement('img');avatar.src=author.avatarUrl||'/community-assets/avatar-robot.webp';avatar.alt=author.name;avatar.width=72;avatar.height=72;avatar.className='chat-profile-avatar';
 modal.body.append(avatar,chatElement('h3',author.name),chatElement('p','İstifadəçi ID-si: '+(author.memberNumber||'—')));
 if(author.influencer)modal.body.append(chatElement('span','Influencer','chat-influencer-badge'));
 return modal;
}
export function decorateInfluencer(row,author,{onProfile,onGift,own=false}={}){
 if(!author.influencer)return;
 row.classList.add('chat-influencer-message');
 const head=row.querySelector('.community-message-head');
 if(!head)return;
 head.append(chatElement('span','Influencer','chat-influencer-badge'));
 if(onGift){
  const gift=chatButton('',onGift,'chat-gift-button');gift.setAttribute('aria-label','Hədiyyə et');const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d','M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z');icon.append(path);gift.append(icon);
  gift.disabled=own;gift.title=own?'Özünüzə hədiyyə göndərmək olmaz':author.name+' üçün hədiyyə seç';
  head.append(gift);
 }
 if(onProfile){
  const name=head.querySelector('strong');if(name){const button=chatButton(name.textContent,onProfile,'chat-author-button');name.replaceWith(button);}
 }
}
