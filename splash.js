(() => {
  'use strict';
  const splash = document.getElementById('newSplashScreen');
  const status = document.getElementById('splashLoadStatus');
  if (!splash || !status) return;
  let observer, deadline, finishTimer, retryTimer, ready = false, finishing = false, dismissed = false;
  const hide = () => { splash.hidden = true; splash.style.display = 'none'; };
  const showLoading = () => { if (!ready && !dismissed) status.hidden = false; };
  const cleanup = () => {
    observer?.disconnect();
    clearTimeout(deadline); clearTimeout(finishTimer); clearTimeout(retryTimer);
    document.removeEventListener('DOMContentLoaded', check);
    document.removeEventListener('load', check, true);
    window.removeEventListener('error', failOpen, true);
    window.removeEventListener('unhandledrejection', failOpen);
    document.removeEventListener('focusin', dismiss);
    document.removeEventListener('pointerdown', dismiss);
    document.removeEventListener('keydown', dismiss);
  };
  const finish = () => {
    if (finishing || splash.hidden) return;
    finishing = true;
    splash.classList.add('is-finishing');
    finishTimer = setTimeout(hide, 180);
  };
  const dismiss = event => {
    if (status.contains(event.target)) return;
    dismissed = true; hide(); status.hidden = true;
  };
  function check() {
    try {
      // Wait for existing app rendering and header initialization, not remote fonts
      // or offscreen catalogue images. Never fetch data or modify those components.
      const image = document.querySelector('#heroSlider .slide.active img');
      ready = document.readyState !== 'loading'
        && Boolean(document.querySelector('#grid .card'))
        && splash.querySelector('img').complete
        && (!image || image.complete);
      if (!ready) return;
      status.hidden = true;
      finish();
      // Keep the finish timer; everything else can be released immediately.
      const pendingFinish = finishTimer;
      finishTimer = undefined;
      cleanup();
      finishTimer = pendingFinish;
    } catch { failOpen(); }
  }
  function failOpen(event) {
    // A failed image is not a broken animation. Script/runtime failures fail open.
    if (event?.type === 'error' && event.target !== window && event.target?.tagName !== 'SCRIPT') return;
    hide(); showLoading();
    status.dataset.error = 'true';
    status.querySelector('span').textContent = 'Səhifə tam yüklənmədi. Yenidən yoxlaya bilərsiniz.';
    status.querySelector('button').hidden = false;
  }
  try {
    status.querySelector('button').addEventListener('click', () => location.reload());
    let seen = false;
    try { seen = sessionStorage.getItem('mirpanel:splash:seen') === '1'; sessionStorage.setItem('mirpanel:splash:seen', '1'); } catch { /* Storage can be disabled; the deadline still applies. */ }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Install the independent watchdog before making the overlay visible.
    // Leave 50 ms for the next paint; CSS also ends independently at 2.95 s.
    deadline = setTimeout(() => { hide(); showLoading(); }, seen ? 0 : reduced ? 150 : 2950);
    retryTimer = setTimeout(() => {
      if (!ready) { showLoading(); status.querySelector('button').hidden = false; }
    }, 8000);
    window.addEventListener('error', failOpen, true);
    window.addEventListener('unhandledrejection', failOpen);
    for (const type of ['focusin', 'pointerdown', 'keydown']) document.addEventListener(type, dismiss, { once: true });
    observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', check);
    document.addEventListener('load', check, true);
    splash.addEventListener('animationend', event => {
      if (event.target === splash) { hide(); showLoading(); }
    });
    if (!seen && document.readyState === 'loading') { splash.style.display = 'flex'; splash.hidden = false; }
    check();
  } catch { hide(); cleanup(); }
})();
