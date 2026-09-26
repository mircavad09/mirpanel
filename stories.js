(() => {
  const API_BASE = window.MIRPANEL_ADMIN_BASE || "https://mirpanel.onrender.com";
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const section = document.getElementById("homeStories");
  const track = document.getElementById("homeStoriesTrack");
  const viewer = document.getElementById("storyViewer");
  if (!section || !track || !viewer) return;

  let stories = [];
  let storyIndex = 0;
  let itemIndex = 0;
  let timer = 0;
  let touchX = 0;
  let returnFocus = null;
  const media = document.getElementById("storyMedia");
  const progress = document.getElementById("storyProgress");
  const caption = document.getElementById("storyCaption");
  const playButton = document.getElementById("storyPlay");

  function stopCurrent() {
    clearTimeout(timer);
    timer = 0;
    const video = media.querySelector("video");
    if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
  }

  function closeViewer() {
    stopCurrent();
    viewer.hidden = true;
    document.documentElement.classList.remove("story-viewer-open");
    document.body.classList.remove("story-viewer-open");
    returnFocus?.focus?.({ preventScroll: true });
  }

  function move(step) {
    const story = stories[storyIndex];
    const next = itemIndex + step;
    if (next >= 0 && next < story.items.length) { itemIndex = next; return showItem(); }
    const nextStory = storyIndex + (step > 0 ? 1 : -1);
    if (nextStory < 0) return showItem();
    if (nextStory >= stories.length) return closeViewer();
    storyIndex = nextStory;
    itemIndex = step > 0 ? 0 : stories[storyIndex].items.length - 1;
    showItem();
  }

  function setProgress(story, duration) {
    progress.replaceChildren(...story.items.map((_, index) => {
      const bar = document.createElement("span");
      if (index < itemIndex) bar.className = "done";
      if (index === itemIndex) { bar.className = "active"; bar.style.setProperty("--story-duration", `${duration}ms`); }
      return bar;
    }));
  }

  function fallback(message, allowPlay = false) {
    media.innerHTML = `<div class="story-placeholder">${message}</div>`;
    playButton.hidden = !allowPlay;
  }

  function showItem() {
    stopCurrent();
    playButton.hidden = true;
    const story = stories[storyIndex];
    const item = story.items[itemIndex];
    document.getElementById("storyViewerTitle").textContent = story.title;
    const cover = document.getElementById("storyViewerCover");
    cover.src = story.coverUrl;
    cover.alt = story.title;
    caption.textContent = item.caption || "";
    caption.hidden = !item.caption;

    if (item.media_type === "video") {
      setProgress(story, 60000);
      const video = document.createElement("video");
      video.muted = true; video.autoplay = true; video.playsInline = true; video.preload = "metadata";
      video.src = item.mediaUrl;
      video.addEventListener("loadedmetadata", () => setProgress(story, Math.max(1000, video.duration * 1000)), { once: true });
      video.addEventListener("ended", () => move(1), { once: true });
      video.addEventListener("error", () => fallback("Video yüklənmədi.", true), { once: true });
      media.replaceChildren(video);
      const play = () => video.play().catch(() => { fallback("Video avtomatik başlamadı.", true); playButton.onclick = () => { media.replaceChildren(video); playButton.hidden = true; video.play(); }; });
      play();
      return;
    }

    setProgress(story, 5000);
    const image = new Image();
    image.alt = item.caption || story.title;
    image.decoding = "async";
    image.addEventListener("error", () => fallback("Şəkil yüklənmədi."), { once: true });
    image.src = item.mediaUrl;
    media.replaceChildren(image);
    if (!reducedMotion) timer = window.setTimeout(() => move(1), 5000);
  }

  function openViewer(index, button) {
    storyIndex = index; itemIndex = 0; returnFocus = button;
    viewer.hidden = false;
    document.documentElement.classList.add("story-viewer-open");
    document.body.classList.add("story-viewer-open");
    document.getElementById("storyViewerClose").focus({ preventScroll: true });
    showItem();
  }

  function render() {
    track.replaceChildren(...stories.map((story, index) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "home-story";
      button.setAttribute("aria-label", `${story.title} story-sinə bax`);
      const cover = document.createElement("span"); cover.className = "home-story-cover";
      const inner = document.createElement("span"); inner.className = "home-story-cover-inner";
      const image = new Image(); image.alt = ""; image.loading = "lazy"; image.decoding = "async"; image.src = story.coverUrl;
      image.addEventListener("error", () => image.classList.add("is-broken"), { once: true });
      const title = document.createElement("span"); title.className = "home-story-title"; title.textContent = story.title;
      inner.append(image); cover.append(inner); button.append(cover, title);
      button.addEventListener("click", () => openViewer(index, button));
      return button;
    }));
    section.hidden = !stories.length;
  }

  async function load() {
    try {
      const response = await fetch(`${API_BASE}/api/stories`, { mode: "cors", credentials: "omit", cache: "no-store" });
      if (!response.ok) throw new Error("Stories cavabı uğursuzdur.");
      const payload = await response.json();
      stories = (payload.stories || []).filter((story) => story.active !== false && story.coverUrl && Array.isArray(story.items) && story.items.length);
      render();
    } catch { section.hidden = true; }
  }

  document.getElementById("storyViewerClose").addEventListener("click", closeViewer);
  document.getElementById("storyPrev").addEventListener("click", () => move(-1));
  document.getElementById("storyNext").addEventListener("click", () => move(1));
  viewer.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeViewer();
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  });
  viewer.addEventListener("touchstart", (event) => { touchX = event.touches[0]?.clientX || 0; }, { passive: true });
  viewer.addEventListener("touchend", (event) => { const distance = (event.changedTouches[0]?.clientX || touchX) - touchX; if (Math.abs(distance) > 50) move(distance < 0 ? 1 : -1); }, { passive: true });
  load();
})();
