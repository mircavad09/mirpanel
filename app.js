/* =========================================================
   app.js — Mirpanel (FINAL v12) — AI YOXDUR
   - Kataloq / filter / search
   - Modal + plan seçimi + WhatsApp yönləndirmə
   - InfoBox (modalın içində)
   - Music player (header)
   - iPhone modal scroll lock fix
   ========================================================= */

const PHONE_WA = "https://wa.me/994515243545"; // 0515243545

const DATA = {
  brand: "Mirpanel",
  categories: [
    { key: "all", label: "Hamısı" },
    { key: "film", label: "Film" },
    { key: "musiqi", label: "Musiqi" },
    { key: "dizayn", label: "Dizayn" },
    { key: "video", label: "Video Edit" },
    { key: "ai", label: "Süni intellekt" },
    { key: "dil", label: "Xarici Dil" },

    // ✅ Zoom category-nin tabda çıxması üçün əlavə olundu
    { key: "meeting", label: "Görüş" },
  ],
  products: [
    {
      id: "capcut",
      category: "video",
      title: "CapCut Pro",
      variant: "Pro",
      image: "assets/capcut.png",
      badge: "Video",
      desc: "Premium effektlər, export, template-lər.",
      note: "Müddəti seçən kimi WhatsApp açılacaq.",
      currency: "₼",
      plans: [
        { months: 1, label: "1 aylıq", price: 4.99 },
        { months: 6, label: "6 aylıq", price: 22.99 },
      ],
    },

    {
      id: "netflix",
      category: "film",
      title: "Netflix Premium Şəxsi",
      variant: "Şəxsi",
      image: "assets/netflix.png",
      badge: "Film",
      desc: "Filmlər, seriallar, yüksək keyfiyyət.",
      note: "Netflix Şəxsi otaq: Plan seç → Ad və 4 rəqəmli kod yaz → WhatsApp-a göndər.",
      currency: "₼",
      plans: [
        { months: 1, label: "1 aylıq", price: 5.99 },
        { months: 3, label: "3 aylıq", price: 16.49 },
        { months: 6, label: "6 aylıq", price: 29.99 },
      ],
    },

    {
      id: "netflix_umumi",
      category: "film",
      title: "Netflix Premium Ümumi",
      variant: "Ümumi hesab",
      image: "assets/netflix.png",
      badge: "Film",
      desc: "Ümumi hesab (paylaşılan).",
      note: "Netflix Ümumi: Plan seçən kimi WhatsApp açılacaq (ad/kod istəmir).",
      currency: "₼",
      plans: [{ months: 1, label: "1 aylıq", price: 3.99 }],
    },

    // ✅ ZOOM PRO (1 aylıq)
    {
      id: "zoom",
      category: "meeting",
      title: "Zoom Pro",
      variant: "Pro",
      image: "assets/zoom.png",
      badge: "Görüş",
      desc: "Peşəkar onlayn görüşlər üçün ideal seçim.",
      note: "Müddəti seçən kimi avtomatik WhatsApp-a yönləndiriləcəksiniz. Hesap aktiv və hazır şəkildə təqdim olunur.",
      currency: "₼",
      plans: [{ months: 1, label: "1 aylıq", price: 9.99 }],
    },

    {
      id: "youtube",
      category: "musiqi",
      title: "YouTube Premium",
      variant: "Premium",
      image: "assets/youtube.png",
      badge: "Video",
      desc: "Reklamsız YouTube, background play, offline.",
      note: "Hazırda YouTube Premium satılmır (stokta yoxdur).",
      currency: "₼",
      plans: [{ months: 1, label: "Stokta yoxdur", price: 0 }],
    },

    // ✅ GOOGLE AI PRO
    {
      id: "google_ai",
      category: "ai",
      title: "Google AI Pro + VEO 3 + GEMINI",
      variant: "Pro",
      image: "assets/google-ai.png",
      badge: "AI",
      desc: "Google AI alətləri ilə ağıllı mətn, analiz və məhsuldarlıq.",
      note: "Sifariş etdikdə avtomatik WhatsApp açılacaq.",
      currency: "₼",
      plans: [{ months: 1, label: "1 aylıq Pro", price: 9.99 }],
    },

    // ✅ GOOGLE AI ULTRA
    {
      id: "google_ai_ultra",
      category: "ai",
      title: "Google AI Ultra + VEO 3 + GEMINI",
      variant: "Ultra",
      image: "assets/google-ai-ultra.png",
      badge: "AI",
      desc: "Ən yüksək səviyyəli Google AI imkanları — peşəkar istifadə üçün.",
      note: "Sifariş etdikdə avtomatik WhatsApp açılacaq.",
      currency: "₼",
      plans: [{ months: 1, label: "1 aylıq Ultra", price: 19.99 }],
    },

    {
      id: "spotify",
      category: "musiqi",
      title: "Spotify Premium",
      variant: "Şəxsi",
      image: "assets/spotify.png",
      badge: "Musiqi",
      desc: "Reklamsız musiqi, offline dinləmə.",
      note: "Plan seç → Gmail və Spotify şifrənizi yazın → WhatsApp-a göndər.",
      currency: "₼",
      plans: [
        { months: 1, label: "1 aylıq", price: 4.49 },
        { months: 3, label: "3 aylıq", price: 12.99 },
        { months: 6, label: "6 aylıq", price: 23.99 },
      ],
    },

    // ✅ CAPTIONS AI (PRO / MAX)
    {
      id: "captions",
      category: "ai",
      title: "Captions AI",
      variant: "Şəxsi Hesab",
      image: "assets/captions.png",
      badge: "AI",
      desc: "Videolar üçün avtomatik caption, subtitle və AI mətn generasiyası.",
      note: "Müddəti seçən kimi avtomatik WhatsApp açılacaq. Hesap biz tərəfdən hazır şəkildə verilir.",
      currency: "₼",
      plans: [
        { months: 1, label: "1 aylıq PRO", price: 11.99 },
        { months: 1, label: "1 aylıq MAX", price: 19.99 },
      ],
    },

    {
      id: "prime",
      category: "film",
      title: "Amazon Prime Video",
      variant: "Premium",
      image: "assets/prime.png",
      badge: "Film",
      desc: "Prime Video filmlər və seriallar.",
      note: "Plan seç → Ad və 5 rəqəmli kod yaz (məs: 12345) → WhatsApp-a göndər.",
      currency: "₼",
      plans: [
        { months: 1, label: "1 aylıq", price: 4.49 },
        { months: 6, label: "6 aylıq", price: 17.99 },
      ],
    },

    {
      id: "duolingo",
      category: "dil",
      title: "Duolingo Super",
      variant: "Super",
      image: "assets/duolingo.png",
      badge: "Dil",
      desc: "Xarici dil öyrənmək üçün premium imkanlar.",
      note: "Plan seç → Gmail yaz → WhatsApp-a göndər.",
      currency: "₼",
      plans: [{ months: 1, label: "1 aylıq", price: 3.99 }],
    },

    {
      id: "canva",
      category: "dizayn",
      title: "Canva Premium",
      variant: "Pro",
      image: "assets/canva.png",
      badge: "Dizayn",
      desc: "Premium template, element, eksport imkanları.",
      note: "Plan seç → Gmail yaz → WhatsApp-a göndər.",
      currency: "₼",
      plans: [
        { months: 1, label: "1 aylıq", price: 1.49 },
        { months: 12, label: "12 aylıq", price: 2.99 },
      ],
    },

    {
      id: "chatgpt",
      category: "ai",
      title: "ChatGPT Plus",
      variant: "Plus",
      image: "assets/chatgpt.png",
      badge: "AI",
      desc: "Daha güclü model, fayl/şəkil imkanları.",
      note: "Plan seç → Gmail yaz → WhatsApp-a göndər.",
      currency: "₼",
      plans: [{ months: 1, label: "1 aylıq", price: 11.99 }],
    },

    {
      id: "adobecc",
      category: "dizayn",
      title: "Adobe Creative Cloud",
      variant: "Premium",
      image: "assets/adobe.png",
      badge: "Dizayn",
      desc: "Photoshop, Illustrator və digər Adobe proqramları.",
      note: "Plan seçən kimi WhatsApp açılacaq.",
      currency: "₼",
      plans: [
        { months: 1, label: "1 aylıq", price: 9.99 },
        { months: 4, label: "4 aylıq", price: 22.99 },
      ],
    },
  ],
};

const $ = (id) => document.getElementById(id);
let activeCat = "all";

/* =========================
   🎵 PLAYER
   ========================= */
const PLAYLIST = [
  { title: "Mutlu Bir Son", artist: "Adil Kulalı", src: "assets/music.mp3" },
  { title: "Alkışlar", artist: "Erdem Kinay / Sibel Can", src: "assets/music1.mp3" },
];

let trackIndex = 0;
let isPlaying = false;

function initPlayer() {
  const audio = $("bgAudio");
  const playBtn = $("playBtn");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const titleEl = $("trackTitle");
  const subEl = $("trackSub");
  const countEl = $("trackCount");
  const ui = $("playerUI");

  if (!audio || !playBtn || !prevBtn || !nextBtn || !titleEl || !subEl || !countEl || !ui) return;

  function loadTrack(i) {
    const t = PLAYLIST[i];
    if (!t) return;
    audio.src = t.src || "";
    titleEl.textContent = t.title || "—";
    subEl.textContent = t.artist || "";
    countEl.textContent = `${i + 1}/${PLAYLIST.length}`;
  }

  function setUI(on) {
    isPlaying = !!on;
    playBtn.textContent = isPlaying ? "⏸" : "▶️";
    ui.classList.toggle("playing", isPlaying);
  }

  async function togglePlay() {
    try {
      if (!isPlaying) {
        await audio.play();
        setUI(true);
      } else {
        audio.pause();
        setUI(false);
      }
    } catch (e) {
      alert("Musiqi açılmadı. iPhone bəzən ilk klikdən sonra icazə verir.");
    }
  }

  function prev() {
    if (PLAYLIST.length <= 1) return;
    trackIndex = (trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    loadTrack(trackIndex);
    if (isPlaying) audio.play().catch(() => {});
  }

  function next() {
    if (PLAYLIST.length <= 1) return;
    trackIndex = (trackIndex + 1) % PLAYLIST.length;
    loadTrack(trackIndex);
    if (isPlaying) audio.play().catch(() => {});
  }

  playBtn.addEventListener("click", togglePlay);
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  audio.addEventListener("ended", () => {
    if (PLAYLIST.length > 1) next();
    else setUI(false);
  });

  loadTrack(trackIndex);
  setUI(false);

  if (PLAYLIST.length <= 1) {
    prevBtn.style.opacity = ".45";
    nextBtn.style.opacity = ".45";
  }
}

/* =========================
   MODAL SCROLL LOCK ✅ (iPhone fix)
   ========================= */
let savedScrollY = 0;

function lockBodyScroll() {
  savedScrollY = window.scrollY || 0;
  document.documentElement.classList.add("modalOpen");
  document.body.classList.add("modalOpen");

  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockBodyScroll() {
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";

  document.documentElement.classList.remove("modalOpen");
  document.body.classList.remove("modalOpen");

  window.scrollTo(0, savedScrollY);
}

/* =========================
   ✅ INFO BOX CONTENT (modal)
   ========================= */
const INFO_TEXTS = {
  capcut: {
    title: "🎬 CapCut Pro (Premium)",
    lines: [
      "✨ Premium effektlər, filtrlər, template-lər",
      "✅ Watermark olmadan export + HD/4K keyfiyyət",
      "📌 Hesab biz tərəfdən hazır verilir",
      "👤 1 nəfər üçün nəzərdə tutulub",
    ],
  },

  zoom: {
    title: "🎥 Zoom Pro (Premium)",
    lines: [
      "⏱ Limitsiz görüş vaxtı (40 dəqiqə limiti yoxdur)",
      "👥 100 nəfərə qədər iştirakçı",
      "☁️ Cloud recording (buludda yaddaş)",
      "🎥 HD video və yüksək səs keyfiyyəti",
      "🧑‍💼 Host nəzarəti və görüş planlama imkanları",
      "📌 Hesab biz tərəfdən hazır şəkildə verilir",
    ],
  },

  captions: {
    title: "🎙 Captions AI (Şəxsi Hesab)",
    lines: [
      "🤖 AI ilə avtomatik subtitr (caption)",
      "🎬 Video montaj və əsas AI alətlər",
      "📱 Reels / TikTok üçün uyğun",
      "✅ Hesab biz tərəfdən hazır şəkildə verilir",
      "🚀 Max plan: əlavə AI effektlər + daha sürətli emal və üstün keyfiyyət",
    ],
  },

  google_ai: {
    title: "🤖 Google AI Pro (Veo 3 + Gemini)",
    lines: [
      "🤖 Gemini AI – mətn yazma, analiz, tərcümə və ideya yaradılması",
      "🎥 Veo 3 – AI ilə video kontent yaradılması",
      "⚡ Sürətli və stabil AI performansı",
      "📧 Sizin şəxsi Gmail hesabınızda aktivləşdirilir",
      "🔐 Hesab tam sizə məxsus olur (paylaşılan deyil)",
    ],
  },

  google_ai_ultra: {
    title: "🚀 Google AI Ultra (Veo 3 + Gemini Ultra)",
    lines: [
      "🤖 Gemini AI (Ultra) – inkişaf etmiş mətn yazma, dərin analiz, tərcümə və kod dəstəyi",
      "🎥 Veo 3 – AI ilə yüksək keyfiyyətli video yaradılması",
      "⚡ Ultra səviyyəli performans və prioritet emal",
      "📧 Sizin şəxsi Gmail hesabınızda aktivləşdirilir",
      "🔐 Hesab tam sizə məxsusdur, paylaşılan deyil",
      "🚀 Pro planın bütün imkanları + əlavə premium funksiyalar (Ultra plan)",
    ],
  },

  chatgpt: {
    title: "🤖 ChatGPT Plus (Son Versiya)",
    lines: [
      "✨ Premium özəlliklər",
      "✅ Ən güclü və son AI modellərə çıxış",
      "🚀 Daha sürətli və stabil istifadə",
      "📌 Hesabınıza dəvət göndəririk, qəbul edib Plus-a keçirsiniz",
    ],
  },

  canva: {
    title: "🎨 Canva Premium",
    lines: [
      "✅ Premium dizaynlar, şablonlar və elementlər açıq olur",
      "📌 Hesabınıza dəvət göndərilir, qəbul edib Premium-a keçirsiniz",
    ],
  },

  duolingo: {
    title: "📚 Duolingo Super",
    lines: [
      "✅ Reklamsız istifadə",
      "✅ Limitsiz can (hearts)",
      "✅ Səhvləri sərbəst düzəltmə (mistake review)",
      "✅ Daha rahat və sürətli öyrənmə rejimi",
      "📌 Link göndərilir, linklə rəsmi şəkildə qoşulursunuz",
    ],
  },

  adobecc: {
    title: "🎨 Adobe Creative Cloud",
    lines: [
      "🎨 Dizayn | Video | Foto | Web — hamısı bir yerdə!",
      "☁️ Cloud yaddaş: 100 GB",
      "⚡ Firefly kredit: 4000",
      "♾️ Limitsiz istifadə",
      "✅ Orijinal və etibarlı",
      "📌 Hesab biz tərəfdən hazır şəkildə təqdim edilir",
    ],
  },

  netflix: {
    title: "Netflix — Şəxsi Otaq",
    lines: [
      "• Otaq tamamilə sizə aiddir, yalnız siz istifadə edirsiniz.",
      "• Adı və şifrəni sərbəst dəyişə bilərsiniz.",
      "• Telefon, TV, noutbuk və s. istədiyiniz cihazda izləyə bilərsiniz.",
    ],
  },

  netflix_umumi: {
    title: "Netflix — Ümumi Otaq",
    lines: [
      "• Otaqda sizinlə birlikdə başqa müştərilər də olur.",
      "• Otağın adı və şifrəsini dəyişmək olmaz.",
      "• Yalnız 1 cihazda istifadə etmək mümkündür.",
    ],
  },

  prime: {
    title: "Amazon Prime Video",
    lines: [
      "✨ Tam fərdi hesab — sürətli, təhlükəsiz və limitsiz izləmə imkanı!",
      "🧩 Otaq yalnız sənə məxsusdur — paylaşım yoxdur.",
    ],
  },

  spotify: {
    title: "Spotify Premium",
    lines: [
      "🎶 Limitsiz musiqi — reklamsız dinləmə və offline istifadə!",
      "✨ Şəxsi hesabınızda aktivləşdirilir.",
    ],
  },
};

function renderInfoBox(p) {
  const box = $("mInfoBox");
  if (!box) return;

  const info = INFO_TEXTS[p.id];
  if (!info) {
    box.innerHTML = "";
    box.style.display = "none";
    return;
  }

  const title = esc(info.title || "");
  const items = (info.lines || []).map((x) => `<div class="mInfoLine">${esc(x)}</div>`).join("");

  box.innerHTML = `
    <div class="mInfoHead">${title}</div>
    <div class="mInfoBody">${items}</div>
  `;
  box.style.display = "block";
}

/* =========================
   APP
   ========================= */
function boot() {
  initPlayer();
  buildTabs();
  renderGrid();

  $("q")?.addEventListener("input", renderGrid);
  $("closeModal")?.addEventListener("click", closeModal);

  $("modal")?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "modal") closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function buildTabs() {
  const tabs = $("tabs");
  if (!tabs) return;
  tabs.innerHTML = "";

  DATA.categories.forEach((c) => {
    const el = document.createElement("div");
    el.className = "tab" + (c.key === activeCat ? " active" : "");
    el.textContent = c.label;

    el.onclick = () => {
      activeCat = c.key;
      [...tabs.children].forEach((x) => x.classList.remove("active"));
      el.classList.add("active");
      renderGrid();
    };

    tabs.appendChild(el);
  });
}

function renderGrid() {
  const grid = $("grid");
  if (!grid) return;

  const q = ($("q")?.value || "").trim().toLowerCase();

  const list = DATA.products
    .filter((p) => (activeCat === "all" ? true : p.category === activeCat))
    .filter((p) => {
      if (!q) return true;
      const blob = [p.title, p.desc, p.badge, p.category, p.variant].join(" ").toLowerCase();
      return blob.includes(q);
    });

  grid.innerHTML = list.map((p, idx) => cardHTML(p, idx)).join("");

  grid.querySelectorAll("[data-order]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-order");
      const p = DATA.products.find((x) => x.id === id);
      if (p) openModal(p);
    });
  });
}

function cardHTML(p, idx) {
  const min = getMinPrice(p);
  const cur = p.currency || "₼";
  const showPrice = min != null ? `${formatPrice(min)} ${cur}` : "—";

  return `
    <div class="card" style="animation-delay:${Math.min(idx * 0.03, 0.25)}s">
      <div class="imgWrap">
        <img class="img" src="${esc(p.image)}" alt="" onerror="this.style.opacity='.2'">
        <div class="cornerPrice">${esc(showPrice)}</div>
      </div>

      <div class="pad">
        <div class="topline">
          <h3 class="title">${esc(p.title)}</h3>
          <div class="badge">${esc(p.badge || "Premium")}</div>
        </div>
        <div class="meta">${esc(p.desc || "")}</div>

        <div class="priceRow">
          <button class="btn primary" data-order="${esc(p.id)}" type="button">Sifariş et</button>
        </div>
      </div>
    </div>
  `;
}

function openModal(p) {
  const fullName = p.variant ? `${p.title} (${p.variant})` : p.title;

  $("mTitle").textContent = fullName;
  $("mDesc").textContent = p.desc || "";
  $("mInfo").textContent = p.note || "";

  renderInfoBox(p);

  $("mForm").innerHTML = "";
  $("mPlans").innerHTML = "";

  const img = $("mImg");
  img.src = p.image || "";
  img.onerror = () => (img.style.opacity = ".2");

  const box = $("mPlans");
  const plans = Array.isArray(p.plans) ? p.plans : [];

  if (!plans.length) {
    box.innerHTML = `<div class="meta">Plan yoxdur (WhatsApp-da dəqiqləşdirilir).</div>`;
  } else {
    plans.forEach((pl) => {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "plan";
      d.innerHTML = `
        <div class="planT">${esc(pl.label || (pl.months + " aylıq"))}</div>
        <div class="planP">${esc(formatPrice(pl.price))} ${esc(p.currency || "₼")}</div>
      `;

      d.addEventListener("click", () => {
        box.querySelectorAll(".plan").forEach((x) => x.classList.remove("active"));
        d.classList.add("active");
        $("mForm").innerHTML = "";

        if (p.id === "youtube") return showOutOfStock();
        if (p.id === "netflix") return showNameCodeForm(p, pl, 4);
        if (p.id === "prime") return showNameCodeForm(p, pl, 5);
        if (p.id === "spotify") return showSpotifyForm(p, pl);
        if (p.id === "duolingo") return openWhatsApp(p, pl);
        if (p.id === "canva") return showEmailOnlyForm(p, pl);
        if (p.id === "chatgpt") return showEmailOnlyForm(p, pl);

        // ✅ digərləri birbaşa WhatsApp-a
        openWhatsApp(p, pl);
      });

      box.appendChild(d);
    });
  }

  $("modal").classList.add("show");
  $("modal").setAttribute("aria-hidden", "false");
  lockBodyScroll();
}

function closeModal() {
  $("modal")?.classList.remove("show");
  $("modal")?.setAttribute("aria-hidden", "true");

  $("mInfo") && ($("mInfo").textContent = "");
  $("mForm") && ($("mForm").innerHTML = "");
  $("mPlans")?.querySelectorAll(".plan")?.forEach((x) => x.classList.remove("active"));

  const infoBox = $("mInfoBox");
  if (infoBox) {
    infoBox.innerHTML = "";
    infoBox.style.display = "none";
  }

  unlockBodyScroll();
}

function showOutOfStock() {
  $("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">Stokta yoxdur</div>
      <div class="mpHint">Hazırda YouTube Premium satılmır.</div>
    </div>
  `;
}

function showNameCodeForm(p, plan, digits) {
  const { fullName, duration, priceText } = pack(p, plan);

  $("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">Məlumatları daxil et</div>

      <div class="mpGrid2">
        <div>
          <div class="mpLabel">Ad</div>
          <input id="x_name" class="mpInput" placeholder="Məs: Mələk">
        </div>
        <div>
          <div class="mpLabel">${digits} rəqəmli kod</div>
          <input id="x_code" class="mpInput" inputmode="numeric" maxlength="${digits}"
                 placeholder="Məs: ${digits === 5 ? "12345" : "2255"}">
        </div>
      </div>

      <button id="x_send" type="button" class="mpBtn">WhatsApp-a göndər</button>
    </div>
  `;

  $("x_send").onclick = () => {
    const name = ($("x_name")?.value || "").trim();
    const code = ($("x_code")?.value || "").trim();

    if (!name) return alert("Ad yaz.");
    const re = digits === 5 ? /^\d{5}$/ : /^\d{4}$/;
    if (!re.test(code)) return alert(`${digits} rəqəmli kod yaz.`);

    const text =
`Salam, ${fullName} sifariş etmək istəyirəm.
Müddət: ${duration}
Qiymət: ${priceText}
Ad: ${name}
Kod: ${code}`;

    window.open(PHONE_WA + "?text=" + encodeURIComponent(text), "_blank");
  };
}

function showEmailOnlyForm(p, plan) {
  const { fullName, duration, priceText } = pack(p, plan);

  $("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">Gmail ünvanınızı yazın</div>

      <div>
        <div class="mpLabel">Gmail</div>
        <input id="e_email" class="mpInput" placeholder="misal@gmail.com">
      </div>

      <button id="e_send" type="button" class="mpBtn">WhatsApp-a göndər</button>
    </div>
  `;

  $("e_send").onclick = () => {
    const email = ($("e_email")?.value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert("Düzgün Gmail yaz.");

    const text =
`Salam, ${fullName} sifariş etmək istəyirəm.
Müddət: ${duration}
Qiymət: ${priceText}
Gmail: ${email}`;

    window.open(PHONE_WA + "?text=" + encodeURIComponent(text), "_blank");
  };
}

function showSpotifyForm(p, plan) {
  const { fullName, duration, priceText } = pack(p, plan);

  $("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">Spotify məlumatları</div>

      <div class="mpGrid2">
        <div>
          <div class="mpLabel">Gmail ünvanı</div>
          <input id="sp_email" class="mpInput" placeholder="misal@gmail.com">
        </div>

        <div>
          <div class="mpLabelRow">
            <div class="mpLabel">Spotify şifrəniz</div>
            <a class="mpMiniLink" href="https://accounts.spotify.com/az/password-reset" target="_blank" rel="noopener">
              Şifrənizi bilmirsiniz? Klik edin şifrənizi dəyişin
            </a>
          </div>
          <input id="sp_pass" class="mpInput" placeholder="məs: mirpanel1909">
        </div>
      </div>

      <button id="sp_send" type="button" class="mpBtn">WhatsApp-a göndər</button>
    </div>
  `;

  $("sp_send").onclick = () => {
    const email = ($("sp_email")?.value || "").trim();
    const pass = ($("sp_pass")?.value || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert("Düzgün Gmail yaz.");
    if (pass.length < 3) return alert("Spotify şifrənizi yaz.");

    const text =
`Salam, ${fullName} sifariş etmək istəyirəm.
Müddət: ${duration}
Qiymət: ${priceText}
Gmail: ${email}
Spotify şifrə: ${pass}`;

    window.open(PHONE_WA + "?text=" + encodeURIComponent(text), "_blank");
  };
}

function openWhatsApp(p, plan) {
  const { fullName, duration, priceText } = pack(p, plan);

  const text =
`Salam, ${fullName} sifariş etmək istəyirəm.
Müddət: ${duration}
Qiymət: ${priceText}`;

  window.open(PHONE_WA + "?text=" + encodeURIComponent(text), "_blank");
}

function pack(p, plan) {
  const cur = p.currency || "₼";
  const fullName = p.variant ? `${p.title} (${p.variant})` : p.title;
  const duration = plan?.label || (plan?.months ? `${plan.months} aylıq` : "—");
  const priceText = plan?.price != null ? `${formatPrice(plan.price)} ${cur}` : `— ${cur}`;
  return { fullName, duration, priceText };
}

function getMinPrice(p) {
  const plans = Array.isArray(p.plans) ? p.plans : [];
  const nums = plans.map((x) => Number(x.price)).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  return Math.min(...nums);
}

function formatPrice(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return num.toFixed(2);
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/* START */
boot();