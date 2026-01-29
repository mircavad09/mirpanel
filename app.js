/* =========================
   MIRPANEL — app.js (FINAL)
   - TAB: Hamısı / Film / Musiqi / Dizayn / Video Edit / Süni intellekt / Xarici Dil
   - Modalda “haqqında” mətni üçün AYRI yer: #mInfo
   - Formların çıxması üçün yer: #mForm
   - Netflix Şəxsi: Ad + 4 rəqəmli kod (2255)
   - Netflix Ümumi: 1 ay 3.99₼, FORM YOX (birbaşa WhatsApp)
   - YouTube: “Stokta yoxdur” mesajı (WhatsApp açılmır)
   - Prime Video: 1 ay 4.49₼, 6 ay 17.99₼ + Ad + 5 rəqəmli kod (12345)
   - Duolingo: 1 ay 3.99₼ + Gmail
   - ChatGPT Plus: 1 ay 11.99₼ + Gmail
   - Adobe Creative Cloud: 1 ay 9.99₼ / 4 ay 22.99₼ — FORM YOX (birbaşa WhatsApp)
   - Plan seçəndə plan “active” işıqlanır
   ========================= */

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
    // CAPCUT (plan seçən kimi WhatsApp)
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

    // NETFLIX ŞƏXSİ (Ad + 4 rəqəmli kod)
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
        { months: 1, label: "1 aylıq", price: 7.99 },
        { months: 3, label: "3 aylıq", price: 19.99 },
        { months: 6, label: "6 aylıq", price: 31.99 }
      ]
    },

    // NETFLIX ÜMUMİ (FORM YOX) — 1 aylıq 3.99₼
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

    // YOUTUBE (SATILMIR → stokta yoxdur)
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

    // SPOTIFY (Gmail + Spotify şifrə)
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

    // PRIME (Ad + 5 rəqəmli kod)
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

    // DUOLINGO (Gmail) — 1 aylıq 3.99₼
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

    // CANVA (Gmail)
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

    // CHATGPT (Gmail) — 1 aylıq 11.99₼
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

    // ADOBE CREATIVE CLOUD (FORM YOX) — plan seçən kimi WhatsApp
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

function boot() {
  const waTop = $("waTop");
  waTop.href = PHONE_WA;
  waTop.textContent = "WhatsApp: 051 524 35 45";

  buildTabs();
  renderGrid();

  $("q").addEventListener("input", renderGrid);

  $("closeModal").onclick = closeModal;
  $("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function buildTabs() {
  const tabs = $("tabs");
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
  const q = ($("q").value || "").trim().toLowerCase();

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
      if (!p) return;
      openModal(p);
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
          <button class="btn primary" data-order="${esc(p.id)}">Sifariş et</button>
        </div>
      </div>
    </div>
  `;
}

function openModal(p) {
  const fullName = p.variant ? `${p.title} (${p.variant})` : p.title;

  $("mTitle").textContent = fullName;
  $("mDesc").textContent = p.desc || "";

  // “Haqqında” mətni
  const mInfo = $("mInfo");
  if (mInfo) mInfo.textContent = p.note || "";

  // form sahəsini boşalt
  const mForm = $("mForm");
  if (mForm) mForm.innerHTML = "";

  const img = $("mImg");
  img.src = p.image || "";
  img.onerror = () => (img.style.opacity = ".2");

  // chips
  const chips = $("mChips");
  chips.innerHTML = "";
  [p.badge ? `Kateqoriya: ${p.badge}` : null, p.variant ? `Tip: ${p.variant}` : null]
    .filter(Boolean)
    .forEach((t) => {
      const c = document.createElement("div");
      c.className = "chip";
      c.textContent = t;
      chips.appendChild(c);
    });

  // plans
  const box = $("mPlans");
  const plans = Array.isArray(p.plans) ? p.plans : [];
  box.innerHTML = "";

  if (!plans.length) {
    box.innerHTML = `<div class="meta">Plan yoxdur (WhatsApp-da dəqiqləşdirilir).</div>`;
  } else {
    plans.forEach((pl) => {
      const d = document.createElement("div");
      d.className = "plan";
      d.innerHTML = `
        <div class="planT">${esc(pl.label || pl.months + " aylıq")}</div>
        <div class="planP">${esc(formatPrice(pl.price))} ${esc(p.currency || "₼")}</div>
      `;

      d.onclick = () => {
        // plan seçiləndə active işıqlansın
        box.querySelectorAll(".plan").forEach((x) => x.classList.remove("active"));
        d.classList.add("active");

        // YouTube satılmır
        if (p.id === "youtube") return showOutOfStock();

        // Netflix Şəxsi: 4 rəqəm kod
        if (p.id === "netflix") return showNameCodeForm(p, pl, 4);

        // Prime: 5 rəqəm kod
        if (p.id === "prime") return showNameCodeForm(p, pl, 5);

        // Spotify: Gmail + şifrə
        if (p.id === "spotify") return showSpotifyForm(p, pl);

        // Gmail istəyənlər
        if (p.id === "duolingo") return showEmailOnlyForm(p, pl);
        if (p.id === "canva") return showEmailOnlyForm(p, pl);
        if (p.id === "chatgpt") return showEmailOnlyForm(p, pl);

        // Adobe + Netflix Ümumi + CapCut və s.: FORM YOX → birbaşa WhatsApp
        openWhatsApp(p, pl);
      };

      box.appendChild(d);
    });
  }

  $("modal").classList.add("show");
  $("modal").setAttribute("aria-hidden", "false");
}

/* ====== FORM / MESAJ ====== */

function showOutOfStock() {
  const mForm = $("mForm");
  if (!mForm) return;

  mForm.innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">Stokta yoxdur</div>
      <div class="mpHint">Hazırda YouTube Premium satılmır.</div>
    </div>
  `;
}

function showNameCodeForm(p, plan, digits) {
  const { fullName, duration, priceText } = pack(p, plan);
  const mForm = $("mForm");
  if (!mForm) return;

  mForm.innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">Məlumatları daxil et</div>

      <div class="mpGrid2">
        <div>
          <div class="mpLabel">Ad</div>
          <input id="x_name" class="mpInput" placeholder="Məs: Mələk">
        </div>

        <div>
          <div class="mpLabel">${digits} rəqəmli kod</div>
          <input id="x_code" class="mpInput" inputmode="numeric" maxlength="${digits}" placeholder="Məs: ${digits === 5 ? "12345" : "2255"}">
        </div>
      </div>

      <button id="x_send" class="mpBtn">WhatsApp-a göndər</button>
    </div>
  `;

  document.getElementById("x_send").onclick = () => {
    const name = (document.getElementById("x_name")?.value || "").trim();
    const code = (document.getElementById("x_code")?.value || "").trim();

    if (!name) return alert("Ad yaz.");
    const re = digits === 5 ? /^\d{5}$/ : /^\d{4}$/;
    if (!re.test(code)) return alert(`${digits} rəqəmli kod yaz (məs: ${digits === 5 ? "12345" : "2255"}).`);

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
  const mForm = $("mForm");
  if (!mForm) return;

  mForm.innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">Gmail ünvanınızı yazın</div>

      <div>
        <div class="mpLabel">Gmail</div>
        <input id="e_email" class="mpInput" placeholder="misal@gmail.com">
      </div>

      <button id="e_send" class="mpBtn">WhatsApp-a göndər</button>
    </div>
  `;

  document.getElementById("e_send").onclick = () => {
    const email = (document.getElementById("e_email")?.value || "").trim();
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
  const mForm = $("mForm");
  if (!mForm) return;

  mForm.innerHTML = `
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

      <button id="sp_send" class="mpBtn">WhatsApp-a göndər</button>
    </div>
  `;

  document.getElementById("sp_send").onclick = () => {
    const email = (document.getElementById("sp_email")?.value || "").trim();
    const pass = (document.getElementById("sp_pass")?.value || "").trim();

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

/* ====== ÜMUMİ ====== */

function closeModal() {
  $("modal").classList.remove("show");
  $("modal").setAttribute("aria-hidden", "true");

  const mInfo = $("mInfo");
  if (mInfo) mInfo.textContent = "";

  const mForm = $("mForm");
  if (mForm) mForm.innerHTML = "";
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

boot();