(()=>{'use strict';
 if(document.getElementById('supportWidget'))return;
 const VERSION='private-support-chat-20261127';
 const icon=(name)=>{const paths={mic:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',headset:'M4 14v-3a8 8 0 0 1 16 0v3M4 12H2v7h5v-7H4Zm16 0h2v7h-5v-7h3Zm0 7c0 3-3 3-6 3',arrow:'m9 5 7 7-7 7',send:'m3 3 19 9-19 9 4-9-4-9Zm4 9h15',close:'m6 6 12 12M18 6 6 18'};return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;};
 const chatIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H9l-5 4V4Z"/></svg>';
 const waIcon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M20.5 3.5A11.8 11.8 0 0 0 2 17.7L.4 23.6l6-1.6A11.8 11.8 0 0 0 20.5 3.5ZM12 21a9 9 0 0 1-4.6-1.3l-.3-.2-3.5.9.9-3.4-.2-.3A9 9 0 1 1 12 21Zm5-6.7c-.3-.1-1.6-.8-1.8-.9-.3-.1-.5-.1-.7.2l-.8 1c-.1.2-.3.2-.5.1a7.4 7.4 0 0 1-3.6-3.1c-.3-.5.3-.5.8-1.5.1-.2 0-.3 0-.5l-.8-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.8.9-.8 2.2s.9 2.6 1.1 2.8c.1.2 1.8 2.9 4.5 4 1.7.8 2.4.8 3.2.7.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.4Z"/></svg>';
 const existing=document.getElementById('waFab');
 const source=existing||document.querySelector('a[href^="https://wa.me/"]');
 const href=source?.getAttribute('href')||'https://wa.me/994514113545';
 const style=document.createElement('link');style.rel='stylesheet';style.href='/support-widget.css?v='+VERSION;document.head.append(style);
 const host=document.createElement('div');host.id='supportWidget';
 const wa=existing||document.createElement('a');wa.id='waFab';wa.className='waFab support-fab support-whatsapp';wa.href=href;wa.target=source?.target||'_blank';wa.rel='noopener noreferrer';wa.setAttribute('aria-label','WhatsApp dəstəyi');wa.innerHTML=waIcon;host.append(wa);
 host.insertAdjacentHTML('beforeend',`<button id="aiSupportToggle" class="support-fab support-ai" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="aiSupportPanel">${chatIcon}<span>Söhbət</span></button><div id="supportBackdrop" hidden></div><section id="aiSupportPanel" role="dialog" aria-modal="true" aria-labelledby="aiSupportTitle" hidden><header><div class="support-heading"><div><h2 id="aiSupportTitle">MirPanel köməkçisi</h2><small id="supportLiveState">Bot · MirPanel köməkçisi</small></div></div><button id="aiSupportMinimize" type="button" aria-label="Söhbəti kiçilt">−</button><button id="aiSupportMaximize" type="button" aria-label="Söhbəti böyüt" aria-pressed="false">⤢</button><button id="aiSupportClose" type="button" aria-label="Söhbəti bağla">${icon('close')}</button></header><div class="support-messages" tabindex="0" aria-label="Şəxsi dəstək yazışması"><div id="supportFaqList" class="support-faq"></div></div><div class="support-operator"><a id="supportOperator" target="_blank" rel="noopener noreferrer">${waIcon}<span>WhatsApp dəstəyi</span>${icon('arrow')}</a></div></section>`);
 document.body.append(host);document.getElementById('supportOperator').href=href;
 const questions=[],answers=[];
 const toggle=document.getElementById('aiSupportToggle'),panel=document.getElementById('aiSupportPanel'),close=document.getElementById('aiSupportClose'),backdrop=document.getElementById('supportBackdrop');
 let opened=false,timer,previousFocus,previousOverflow;
 const mobileProfile=matchMedia('(max-width: 767px)');
 function dockProfile(slot=document.querySelector('.profile-support-slot')){
  const target=mobileProfile.matches&&slot?.isConnected?slot:document.body;
  if(host.parentElement!==target)target.append(host);
 }
 dockProfile();
 mobileProfile.addEventListener('change',()=>dockProfile());
 window.addEventListener('mirpanel:profile-support-slot',e=>dockProfile(e.detail));
 function viewport(){const vv=window.visualViewport;if(!vv)return;const keyboard=Math.max(0,innerHeight-vv.height-vv.offsetTop);panel.style.setProperty('--support-keyboard-bottom',keyboard>100?(keyboard+8)+'px':'');panel.style.setProperty('--support-panel-limit',Math.max(180,vv.height-parseFloat(getComputedStyle(panel).bottom)-16)+'px');}
 function finishClose(){panel.hidden=true;backdrop.hidden=true;panel.classList.remove('is-open');document.body.style.overflow=previousOverflow||'';if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
 function setOpen(value){if(value===opened)return;opened=value;window.dispatchEvent(new CustomEvent('mirpanel:support-open',{detail:value}));clearTimeout(timer);toggle.setAttribute('aria-expanded',String(value));
  if(value){if(panel.hidden){previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;}questions.forEach(q=>q.setAttribute('aria-expanded','false'));answers.forEach(a=>a.hidden=true);panel.hidden=false;backdrop.hidden=false;document.body.style.overflow='hidden';viewport();requestAnimationFrame(()=>{if(opened)panel.classList.add('is-open');});close.focus({preventScroll:true});}
  else{panel.classList.remove('is-open');if(matchMedia('(prefers-reduced-motion: reduce)').matches)finishClose();else timer=setTimeout(finishClose,220);}}
 document.getElementById('aiSupportMinimize').onclick=()=>setOpen(false);document.getElementById('aiSupportMaximize').onclick=e=>{const expanded=panel.classList.toggle('is-maximized');e.currentTarget.setAttribute('aria-pressed',String(expanded));e.currentTarget.setAttribute('aria-label',expanded?'Əvvəlki ölçü':'Söhbəti böyüt');};
 toggle.addEventListener('click',()=>setOpen(!opened));close.addEventListener('click',()=>setOpen(false));backdrop.addEventListener('click',()=>setOpen(false));
 window.addEventListener('mirpanel:route-leave',()=>{if(opened){opened=false;window.dispatchEvent(new CustomEvent('mirpanel:support-open',{detail:false}));clearTimeout(timer);toggle.setAttribute('aria-expanded','false');finishClose();}});
 panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);}if(e.key==='Tab'){const items=[...panel.querySelectorAll('button:not(:disabled),a[href],textarea,[tabindex="0"]')],first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);
 const loadPrivate=()=>import('/community-assets/private-support-customer.js?v=delivery-20261127').then(m=>m.mountPrivateSupport(host)).catch(()=>{const area=panel.querySelector('.support-messages');area.textContent='Dəstək yüklənmədi. ';const retry=document.createElement('button');retry.type='button';retry.textContent='Yenidən cəhd et';retry.onclick=()=>void loadPrivate();area.append(retry);});void loadPrivate();
})();
