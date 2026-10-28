// Shared display-only decorator. Identity and tier are supplied by the server renderer.
const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/community-assets/tier-png-frames.css';document.head.append(sheet);
export function applyPngTier(root,tier){
 if(!['bronze','silver','gold','vip','admin'].includes(tier))return;
 root.classList.add('png-tier');root.dataset.pngTier=tier;
 const parts={'.community-avatar-frame,.avatar-shell':'pt-avatar','.community-avatar,.avatar-photo':'pt-photo','.community-message-content,.message-content':'pt-content','.community-message-head,.name-line':'pt-head','.community-badge,.level-badge':'pt-badge','.community-message-bubble,.message-bubble':'pt-bubble','.community-message-body,[data-body]':'pt-body'};
 for(const [selector,name]of Object.entries(parts))root.querySelector(selector)?.classList.add(name);
 root.querySelectorAll('.community-avatar-ornament,.community-bubble-ornament,.corner,.sparkle,.avatar-art,.png-message-frame').forEach(e=>e.remove());
 const asset={bronze:'secilmis',silver:'elit',gold:'gold',vip:'vip',admin:'admin'}[tier];
 const avatar=document.createElement('img');avatar.className='pt-art';avatar.src='/community-assets/'+asset+'-avatar.png';avatar.alt='';avatar.setAttribute('aria-hidden','true');root.querySelector('.pt-avatar').append(avatar);
 const frame=document.createElement('span');frame.className='png-message-frame';frame.setAttribute('aria-hidden','true');root.querySelector('.pt-bubble').prepend(frame);
}
