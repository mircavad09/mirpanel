(() => {
  'use strict';
  const splash = document.getElementById('newSplashScreen');
  const status = document.getElementById('splashLoadStatus');
  if (!splash || !status) return;
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
    status.querySelector('button').addEventListener('click', () => location.reload());
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Every full document load gets the premium sequence. The watchdog and CSS
    // both reveal the site by three seconds, regardless of network readiness.
    deadline = setTimeout(() => { hide(); status.hidden = true; cleanup(); }, reduced ? 150 : 2950);
    window.addEventListener('error', failOpen, true);
    window.addEventListener('unhandledrejection', failOpen);
    splash.addEventListener('animationend', event => {
      if (event.target === splash) { hide(); status.hidden = true; cleanup(); }
    });
    if (document.readyState === 'loading') { splash.style.display = 'flex'; splash.hidden = false; }
  } catch { hide(); cleanup(); }
})();
