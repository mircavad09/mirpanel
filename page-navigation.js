(()=>{'use strict';if(window.mirpanelPageNavigation)return;window.mirpanelPageNavigation=true;
 document.addEventListener('click',e=>{if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;const a=e.target.closest('a[href]');if(!a||a.hasAttribute('download'))return;let u;try{u=new URL(a.href,location.href);}catch{return;}if(u.origin!==location.origin||!/^https?:$/.test(u.protocol))return;if(a.target==='_blank')a.target='_self';if(u.href===location.href&&!u.hash)e.preventDefault();});
})();
