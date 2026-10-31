(() => {
  'use strict';
  const splash = document.getElementById('newSplashScreen');
  const status = document.getElementById('splashLoadStatus');
  if (!splash || !status) return;
  const key='mirpanel.intro.seen.v1';
  let seen=false;
  try { seen=sessionStorage.getItem(key)==='1'; } catch {}
  seen=seen||document.cookie.split(';').some(v=>v.trim()==='mirpanel_intro_seen=1');
  if(seen){splash.hidden=true;splash.style.display='none';status.hidden=true;return;}
  // Mark before playback: reload/back during the animation must not replay it.
  try { sessionStorage.setItem(key,'1'); } catch {}
  document.cookie='mirpanel_intro_seen=1; Path=/; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
  let deadline;
  const hide = () => { splash.hidden = true; splash.style.display = 'none'; };
  const cleanup = () => {
    clearTimeout(deadline);
    window.removeEventListener('error', failOpen, true);
    window.removeEventListener('unhandledrejection', failOpen);
  };
  function failOpen(event) {
    // A failed image is not a broken animation. Script/runtime failures fail open.
    if (event?.type === 'error' && event.target !== window && event.target?.tagName !== 'SCRIPT') return;
    hide();
    status.dataset.error = 'true';
    status.querySelector('span').textContent = 'Səhifə tam yüklənmədi. Yenidən yoxlaya bilərsiniz.';
    status.querySelector('button').hidden = false;
  }
  try {
    window.addEventListener('pagehide',()=>{hide();status.hidden=true;cleanup();},{once:true});
    window.addEventListener('pageshow',e=>{if(e.persisted){hide();status.hidden=true;cleanup();}});
    status.querySelector('button').addEventListener('click', () => location.reload());
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The first visit alone gets the sequence, with an unconditional fail-open.
    deadline = setTimeout(() => { hide(); status.hidden = true; cleanup(); }, reduced ? 150 : 2950);
    window.addEventListener('error', failOpen, true);
    window.addEventListener('unhandledrejection', failOpen);
    splash.addEventListener('animationend', event => {
      if (event.target === splash) { hide(); status.hidden = true; cleanup(); }
    });
    const video=splash.querySelector('video');
    if(video){video.addEventListener('error',()=>{hide();status.hidden=true;cleanup();},{once:true});video.addEventListener('ended',()=>{hide();status.hidden=true;cleanup();},{once:true});video.play()?.catch(()=>{hide();status.hidden=true;cleanup();});}
    splash.style.display = 'flex';
    splash.hidden = false;
  } catch { hide(); cleanup(); }
})();
