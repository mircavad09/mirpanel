// snow.js — Mirpanel snow effect (lightweight)
(function () {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.id = "snowCanvas";
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "25", // header(30) altında, content üstündə
    opacity: "0.85",
  });

  document.body.appendChild(canvas);

  let w = 0, h = 0, dpr = 1;
  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    w = Math.floor(window.innerWidth * dpr);
    h = Math.floor(window.innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
  }
  resize();
  window.addEventListener("resize", resize);

  const COUNT = 140;
  const flakes = Array.from({ length: COUNT }, () => makeFlake(true));

  function makeFlake(randomY) {
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -20 * dpr,
      r: (Math.random() * 2.2 + 0.8) * dpr,
      vx: (Math.random() * 0.6 - 0.3) * dpr,
      vy: (Math.random() * 1.3 + 0.8) * dpr,
      a: Math.random() * Math.PI * 2,
    }; 
  }

  function tick() {
    // modal açıq olanda da qar davam etsin deyirsənsə, bu hissəni silə bilərik
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (const f of flakes) {
      f.a += 0.01;
      f.x += f.vx + Math.sin(f.a) * 0.2 * dpr;
      f.y += f.vy;

      if (f.y > h + 10 * dpr) Object.assign(f, makeFlake(false));
      if (f.x < -20 * dpr) f.x = w + 20 * dpr;
      if (f.x > w + 20 * dpr) f.x = -20 * dpr;

      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }

  // iPhone first paint
  setTimeout(() => requestAnimationFrame(tick), 60);
})();