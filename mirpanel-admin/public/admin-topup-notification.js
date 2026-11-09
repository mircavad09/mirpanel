(() => {
  const soundPath = '/10-mirpanel-imzasi.wav';
  const waiting = new Set();
  const observed = new Set();
  let baseline = false;
  let audio, sound, database, playing, reading, timer;

  // A unique key in the origin's shared database makes the playback claim
  // atomic across tabs and persistent across reloads.
  function claim(id) {
    database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('mirpanel-admin-topup-notifications', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('played');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return database.then(db => new Promise(resolve => {
      const tx = db.transaction('played', 'readwrite');
      tx.objectStore('played').add(true, id);
      tx.oncomplete = () => resolve(true);
      tx.onabort = () => resolve(false);
    }));
  }

  async function playWaiting() {
    if (!waiting.size || !sound || audio.state !== 'running' || playing || document.hidden) return;
    playing = true;
    try {
      const buffer = await sound;
      if (!buffer) return;
      for (const id of waiting) {
        if (document.hidden || audio.state !== 'running') break;
        waiting.delete(id);
        if (!await claim(id)) continue;
        await new Promise(resolve => {
          const source = audio.createBufferSource();
          source.buffer = buffer;
          source.connect(audio.destination);
          source.onended = () => { source.disconnect(); resolve(); };
          source.start();
        });
      }
    } catch {
      // Audio or storage may be disabled. Leave the request count usable.
    } finally {
      playing = false;
    }
  }

  function prepareAudio(event) {
    if (!event.isTrusted) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      audio ??= new Context();
      // Resume in the browser's actual gesture, even if the file loads later.
      void audio.resume().then(playWaiting).catch(() => {});
      sound ??= fetch(soundPath).then(response => {
        if (!response.ok) throw Error('Sound unavailable');
        return response.arrayBuffer();
      }).then(bytes => audio.decodeAudioData(bytes)).catch(() => { sound = null; return null; });
    } catch {}
  }

  function refresh() {
    if (reading) return reading;
    reading = (async () => {
      try {
        const response = await fetch('/api/admin/community/shop?only=topup-count', {
          credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw Error('Topup count unavailable');
        const {pending, ids} = await response.json();
        if (!Number.isSafeInteger(pending) || pending < 0) throw Error('Invalid count');
        if (Array.isArray(ids)) {
          for (const id of ids) {
            if (typeof id !== 'string' || observed.has(id)) continue;
            observed.add(id);
            if (baseline) waiting.add(id);
          }
          baseline = true;
          void playWaiting();
        }
        window.dispatchEvent(new CustomEvent('admin-topup-count', {detail: pending}));
      } catch {
        window.dispatchEvent(new CustomEvent('admin-topup-count', {detail: false}));
      } finally {
        reading = null;
      }
    })();
    return reading;
  }

  function poll() {
    if (document.hidden) return;
    void refresh();
    window.dispatchEvent(new Event('admin-topup-poll'));
  }

  window.refreshAdminTopups = refresh;
  for (const type of ['pointerup', 'click', 'keydown']) {
    window.addEventListener(type, prepareAudio, {capture: true, passive: true});
  }
  document.addEventListener('visibilitychange', poll);
  window.addEventListener('admin-topup-changed', refresh);
  window.addEventListener('pagehide', event => { if (!event.persisted) clearInterval(timer); });
  timer = setInterval(poll, 30000);
  if (document.currentScript?.hasAttribute('data-auto-start')) void refresh();
})();
