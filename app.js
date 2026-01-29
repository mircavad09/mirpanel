/* app.js (FINAL) */

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
    { key: "dil", label: "Xarici Dil" }
  ],
  products: [
    {
      id: "capcut",
      category: "video",
      title: "CapCut Premium",
      variant: "Pro",
      image: "assets/capcut.png",
      badge: "Video",
      desc: "Premium effektlər, export, template-lər.",
      note: "Müddəti seçən kimi WhatsApp açılacaq.",
      currency: "₼",
      plans: [
        { months: 1, label: "1 aylıq", price: 4.99 },
        { months: 6, label: "6 aylıq", price: 22.99 }
      ]
    },
    {
      id: "netflix",
      category: "film",
      title: "Netflix Premium",
      variant: "Şəxsi",
      image: "assets/netflix.png",
      badge: "Film",
      desc: "Filmlər, seriallar, yüksək keyfiyyət.",
      note: "Netflix Şəxsi otaq: Plan seç → Ad və 4 rəqəmli kod yaz → WhatsApp-a göndər.",
      currency: "₼",
      plans: [
        { months: 1, label: "1 aylıq", price: 5.99 },
        { months: 3, label: "3 aylıq", price: 13.99 },
        { months: 6, label: "6 aylıq", price: 32.99 }
      ]
    },
    {
      id: "netflix_umumi",
      category: "film",
      title: "Netflix Premium",
      variant: "Ümumi hesab",
      image: "assets/netflix.png",
      badge: "Film",
      desc: "Ümumi hesab (paylaşılan).",
      note: "Netflix Ümumi: Plan seçən kimi WhatsApp açılacaq (ad/kod istəmir).",
      currency: "₼",
      plans: [{ months: 1, label: "1 aylıq", price: 3.99 }]
    },
    {
      id: "youtube",
      category: "video",
      title: "YouTube Premium",
      variant: "Premium",
      image: "assets/youtube.png",
      badge: "Video",
      desc: "Reklamsız YouTube, background play, offline.",
      note: "Hazırda YouTube Premium satılmır (stokta yoxdur).",
      currency: "₼",
      plans: [{ months: 1, label: "Stokta yoxdur", price: 0 }]
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
        { months: 3, label: "3 aylıq", price: 12.8 },
        { months: 6, label: "6 aylıq", price: 23.9 }
      ]
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
        { months: 6, label: "6 aylıq", price: 17.99 }
      ]
    },
    {
      id: "duolingo",
      category: "dil",
      title: "Duolingo Premium",
      variant: "Plus",
      image: "assets/duolingo.png",
      badge: "Dil",
      desc: "Xarici dil öyrənmək üçün premium imkanlar.",
      note: "Plan seç → Gmail yaz → WhatsApp-a göndər.",
      currency: "₼",
      plans: [{ months: 1, label: "1 aylıq", price: 3.99 }]
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
        { months: 12, label: "12 aylıq", price: 2.99 }
      ]
    },
    {
      id: "chatgpt",
      category: "ai",
      title: "ChatGPT Premium",
      variant: "Plus",
      image: "assets/chatgpt.png",
      badge: "AI",
      desc: "Daha güclü model, fayl/şəkil imkanları.",
      note: "Plan seç → Gmail yaz → WhatsApp-a göndər.",
      currency: "₼",
      plans: [{ months: 1, label: "1 aylıq", price: 11.99 }]
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
        { months: 4, label: "4 aylıq", price: 22.99 }
      ]
    }
  ]
};

const $ = (id) => document.getElementById(id);
let activeCat = "all";

/* =========================
   🎵 PLAYER
   ========================= */
const PLAYLIST = [
  { title: "Mutlu Bir Son", artist: "Adil Kulalı", src: "assets/music.mp3" }
  // { title:"Track 2", artist:"X", src:"assets/track2.mp3" }
];

let trackIndex = 0;
let isPlaying = false;

function initPlayer(){
  const audio = $("bgAudio");
  const playBtn = $("playBtn");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const titleEl = $("trackTitle");
  const subEl = $("trackSub");
  const countEl = $("trackCount");
  const ui = $("playerUI");

  if(!audio || !playBtn || !prevBtn || !nextBtn || !titleEl || !subEl || !countEl || !ui) return;

  function loadTrack(i){
    const t = PLAYLIST[i];
    if(!t) return;
    audio.src = t.src || "";
    titleEl.textContent = t.title || "—";
    subEl.textContent = t.artist || "";
    countEl.textContent = `${i+1}/${PLAYLIST.length}`;
  }

  function setUI(on){
    isPlaying = !!on;
    playBtn.textContent = isPlaying ? "⏸" : "▶️";
    ui.classList.toggle("playing", isPlaying);
  }

  async function togglePlay(){
    try{
      if(!isPlaying){
        await audio.play();
        setUI(true);
      }else{
        audio.pause();
        setUI(false);
      }
    }catch(e){
      alert("Musiqi açılmadı. iPhone bəzən ilk klikdən sonra icazə verir.");
    }
  }

  function prev(){
    if(PLAYLIST.length <= 1) return;
    trackIndex = (trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    loadTrack(trackIndex);
    if(isPlaying) audio.play().catch(()=>{});
  }

  function next(){
    if(PLAYLIST.length <= 1) return;
    trackIndex = (trackIndex + 1) % PLAYLIST.length;
    loadTrack(trackIndex);
    if(isPlaying) audio.play().catch(()=>{});
  }

  playBtn.addEventListener("click", togglePlay);
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  audio.addEventListener("ended", ()=>{
    if(PLAYLIST.length > 1) next();
    else setUI(false);
  });

  // init
  loadTrack(trackIndex);
  setUI(false);

  if(PLAYLIST.length <= 1){
    prevBtn.style.opacity = ".45";
    nextBtn.style.opacity = ".45";
  }
}

/* =========================
   MODAL SCROLL LOCK ✅ (iPhone fix)
   ========================= */
let savedScrollY = 0;

function lockBodyScroll(){
  savedScrollY = window.scrollY || 0;

  // ✅ həm JS lock, həm CSS class (daha stabil)
  document.documentElement.classList.add("modalOpen");
  document.body.classList.add("modalOpen");

  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockBodyScroll(){
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
   APP
   ========================= */
function boot(){
  initPlayer();
  buildTabs();
  renderGrid();

  $("q")?.addEventListener("input", renderGrid);
  $("closeModal")?.addEventListener("click", closeModal);

  $("modal")?.addEventListener("click", (e)=>{
    if(e.target && e.target.id==="modal") closeModal();
  });

  document.addEventListener("keydown", (e)=>{
    if(e.key==="Escape") closeModal();
  });
}

function buildTabs(){
  const tabs = $("tabs");
  if(!tabs) return;
  tabs.innerHTML = "";

  DATA.categories.forEach((c)=>{
    const el = document.createElement("div");
    el.className = "tab" + (c.key===activeCat ? " active" : "");
    el.textContent = c.label;

    el.onclick = ()=>{
      activeCat = c.key;
      [...tabs.children].forEach(x=>x.classList.remove("active"));
      el.classList.add("active");
      renderGrid();
    };

    tabs.appendChild(el);
  });
}

function renderGrid(){
  const grid = $("grid");
  if(!grid) return;

  const q = ($("q")?.value || "").trim().toLowerCase();

  const list = DATA.products
    .filter(p => (activeCat==="all" ? true : p.category===activeCat))
    .filter(p=>{
      if(!q) return true;
      const blob = [p.title,p.desc,p.badge,p.category,p.variant].join(" ").toLowerCase();
      return blob.includes(q);
    });

  grid.innerHTML = list.map((p,idx)=>cardHTML(p,idx)).join("");

  grid.querySelectorAll("[data-order]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-order");
      const p = DATA.products.find(x=>x.id===id);
      if(p) openModal(p);
    });
  });
}

function cardHTML(p, idx){
  const min = getMinPrice(p);
  const cur = p.currency || "₼";
  const showPrice = min!=null ? `${formatPrice(min)} ${cur}` : "—";

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

function openModal(p){
  const fullName = p.variant ? `${p.title} (${p.variant})` : p.title;

  $("mTitle").textContent = fullName;
  $("mDesc").textContent = p.desc || "";
  $("mInfo").textContent = p.note || "";

  $("mForm").innerHTML = "";
  $("mPlans").innerHTML = "";

  const img = $("mImg");
  img.src = p.image || "";
  img.onerror = ()=> (img.style.opacity = ".2");

  const chips = $("mChips");
  chips.innerHTML = "";
  [p.badge ? `Kateqoriya: ${p.badge}` : null, p.variant ? `Tip: ${p.variant}` : null]
    .filter(Boolean)
    .forEach(t=>{
      const c = document.createElement("div");
      c.className = "chip";
      c.textContent = t;
      chips.appendChild(c);
    });

  const box = $("mPlans");
  const plans = Array.isArray(p.plans) ? p.plans : [];

  if(!plans.length){
    box.innerHTML = `<div class="meta">Plan yoxdur (WhatsApp-da dəqiqləşdirilir).</div>`;
  }else{
    plans.forEach(pl=>{
      const d = document.createElement("button");
      d.type = "button";
      d.className = "plan";
      d.innerHTML = `
        <div class="planT">${esc(pl.label || (pl.months + " aylıq"))}</div>
        <div class="planP">${esc(formatPrice(pl.price))} ${esc(p.currency || "₼")}</div>
      `;

      d.addEventListener("click", ()=>{
        box.querySelectorAll(".plan").forEach(x=>x.classList.remove("active"));
        d.classList.add("active");
        $("mForm").innerHTML = "";

        if(p.id==="youtube") return showOutOfStock();
        if(p.id==="netflix") return showNameCodeForm(p, pl, 4);
        if(p.id==="prime") return showNameCodeForm(p, pl, 5);
        if(p.id==="spotify") return showSpotifyForm(p, pl);
        if(p.id==="duolingo") return showEmailOnlyForm(p, pl);
        if(p.id==="canva") return showEmailOnlyForm(p, pl);
        if(p.id==="chatgpt") return showEmailOnlyForm(p, pl);

        openWhatsApp(p, pl);
      });

      box.appendChild(d);
    });
  }

  $("modal").classList.add("show");
  $("modal").setAttribute("aria-hidden","false");

  lockBodyScroll(); // ✅ FIX
}

function closeModal(){
  $("modal")?.classList.remove("show");
  $("modal")?.setAttribute("aria-hidden","true");

  $("mInfo") && ($("mInfo").textContent = "");
  $("mForm") && ($("mForm").innerHTML = "");
  $("mPlans")?.querySelectorAll(".plan")?.forEach(x=>x.classList.remove("active"));

  unlockBodyScroll(); // ✅ FIX
}

function showOutOfStock(){
  $("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">Stokta yoxdur</div>
      <div class="mpHint">Hazırda YouTube Premium satılmır.</div>
    </div>
  `;
}

function showNameCodeForm(p, plan, digits){
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

  $("x_send").onclick = ()=>{
    const name = ($("x_name")?.value || "").trim();
    const code = ($("x_code")?.value || "").trim();

    if(!name) return alert("Ad yaz.");
    const re = digits === 5 ? /^\d{5}$/ : /^\d{4}$/;
    if(!re.test(code)) return alert(`${digits} rəqəmli kod yaz.`);

    const text =
`Salam, ${fullName} sifariş etmək istəyirəm.
Müddət: ${duration}
Qiymət: ${priceText}
Ad: ${name}
Kod: ${code}`;

    window.open(PHONE_WA + "?text=" + encodeURIComponent(text), "_blank");
  };
}

function showEmailOnlyForm(p, plan){
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

  $("e_send").onclick = ()=>{
    const email = ($("e_email")?.value || "").trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert("Düzgün Gmail yaz.");

    const text =
`Salam, ${fullName} sifariş etmək istəyirəm.
Müddət: ${duration}
Qiymət: ${priceText}
Gmail: ${email}`;

    window.open(PHONE_WA + "?text=" + encodeURIComponent(text), "_blank");
  };
}

function showSpotifyForm(p, plan){
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
          <div class="mpLabel">Spotify şifrəniz</div>
          <input id="sp_pass" class="mpInput" placeholder="məs: mirpanel1909">
        </div>
      </div>

      <button id="sp_send" type="button" class="mpBtn">WhatsApp-a göndər</button>
    </div>
  `;

  $("sp_send").onclick = ()=>{
    const email = ($("sp_email")?.value || "").trim();
    const pass = ($("sp_pass")?.value || "").trim();

    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert("Düzgün Gmail yaz.");
    if(pass.length < 3) return alert("Spotify şifrənizi yaz.");

    const text =
`Salam, ${fullName} sifariş etmək istəyirəm.
Müddət: ${duration}
Qiymət: ${priceText}
Gmail: ${email}
Spotify şifrə: ${pass}`;

    window.open(PHONE_WA + "?text=" + encodeURIComponent(text), "_blank");
  };
}

function openWhatsApp(p, plan){
  const { fullName, duration, priceText } = pack(p, plan);

  const text =
`Salam, ${fullName} sifariş etmək istəyirəm.
Müddət: ${duration}
Qiymət: ${priceText}`;

  window.open(PHONE_WA + "?text=" + encodeURIComponent(text), "_blank");
}

function pack(p, plan){
  const cur = p.currency || "₼";
  const fullName = p.variant ? `${p.title} (${p.variant})` : p.title;
  const duration = plan?.label || (plan?.months ? `${plan.months} aylıq` : "—");
  const priceText = plan?.price != null ? `${formatPrice(plan.price)} ${cur}` : `— ${cur}`;
  return { fullName, duration, priceText };
}

function getMinPrice(p){
  const plans = Array.isArray(p.plans) ? p.plans : [];
  const nums = plans.map(x => Number(x.price)).filter(n => Number.isFinite(n));
  if(!nums.length) return null;
  return Math.min(...nums);
}

function formatPrice(n){
  const num = Number(n);
  if(!Number.isFinite(num)) return "—";
  return num.toFixed(2);
}

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

boot();