/* app-ai.js — Mirpanel AI (FINAL v10)
   ✅ Yeni məhsullar: Zoom Pro, Google AI Pro/Ultra, Captions AI (PRO/MAX)
   ✅ Topic adı yazılanda (zoom pro) intent olmasa belə lokaldan cavab verir
   ✅ Follow-up lastTopic-a bağlanır (capcut -> fərq -> capcut fərqi)
   ✅ YouTube lokaldan “stokda yoxdur”
   ✅ Typo tolerant topic detect
   ✅ localStorage state + worker state
*/

(() => {
  const AI_API_URL = "https://mirpanel-ai.mircavad09.workers.dev/chat";

  const $ = (id) => document.getElementById(id);
  const ui = {
    fab: $("aiFab"),
    box: $("aiBox"),
    close: $("aiClose"),
    msgs: $("aiMsgs"),
    input: $("aiText"),
    send: $("aiSend"),
  };
  if (!ui.fab || !ui.box || !ui.close || !ui.msgs || !ui.input || !ui.send) return;

  ui.input.placeholder =
    "Məs: Zoom Pro qiyməti? / Google AI Ultra nədir? / Captions fərqi? / CapCut qiyməti?";

  // ---------- Persisted State ----------
  const LS_KEY = "mirpanel_ai_state_v1";
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      return {
        hasSpoken: !!s.hasSpoken,
        state: {
          helloSent: !!s?.state?.helloSent,
          noteSent: !!s?.state?.noteSent,
          lastTopic: String(s?.state?.lastTopic || ""),
        },
      };
    } catch {
      return { hasSpoken: false, state: { helloSent: false, noteSent: false, lastTopic: "" } };
    }
  }
  function saveState(store) {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  }

  let store = loadState();
  let isOpen = false;
  let isSending = false;

  // ---------- Greeting words ----------
  const GREET_WORDS = ["salam", "sa", "salamlar", "salam aleykum", "salam əleykum", "hey", "hi"];

  // ---------- YouTube block ----------
  const YT_WORDS = ["youtube", "yutub", "yt", "you tube"];

  // ---------- Topics (site product ID-ləri ilə uyğun) ----------
  const TOPICS = [
    // Netflix
    { key: "netflix_umumi", words: ["umumi netflix", "ümumi netflix", "netflix umumi", "netflix ümumi"] },
    { key: "netflix_sexsi", words: ["sexsi netflix", "şəxsi netflix", "netflix sexsi", "netflix şəxsi"] },
    { key: "netflix", words: ["netflix"] },

    // New / AI
    { key: "google_ai_ultra", words: ["google ai ultra", "gemini ultra", "ultra plan", "google ultra"] },
    { key: "google_ai", words: ["google ai pro", "google ai", "gemini", "veo 3", "veo3", "google pro"] },
    { key: "captions", words: ["captions", "captions ai", "caption ai", "subtitle ai"] },

    // Other
    { key: "chatgpt", words: ["chatgpt", "gpt", "chat gpt"] },
    { key: "capcut", words: ["capcut", "cap cut"] },
    { key: "zoom", words: ["zoom pro", "zoom"] }, // ✅ zoom pro mütləq burda var

    { key: "spotify", words: ["spotify"] },
    { key: "prime", words: ["amazon prime", "prime video", "prime"] },
    { key: "duolingo", words: ["duolingo"] },
    { key: "canva", words: ["canva"] },
    { key: "adobecc", words: ["adobe", "creative cloud", "adobe cc", "adobecc"] },

    { key: "youtube", words: ["youtube", "yutub", "yt", "you tube"] },
  ];

  // Follow-up sözləri
  const FOLLOW_UP = [
    "qiymet", "qiymət", "qiyməti", "nece qeder", "neçədir", "necedi", "neçiyə",
    "stok", "stokda", "varmi", "varmı", "movcud", "mövcud",
    "fərq", "ferq", "fərqi", "ferqi",
    "necə", "nece", "sifariş", "sifaris", "almaq", "alım", "alim",
    "nedir", "nədir", "haqqinda", "məlumat", "info"
  ];

  const PRODUCT_LIST_TEXT =
`Mövcud paketlər:
• Netflix (Şəxsi / Ümumi otaq)
• Spotify Premium
• Amazon Prime Video
• Duolingo Super
• Canva Premium
• CapCut Pro
• YouTube Premium (hazırda satılmır)
• Google AI Pro (Gemini + Veo 3)
• Google AI Ultra (Gemini Ultra + Veo 3)
• Captions AI (PRO / MAX)
• Zoom Pro
• ChatGPT Plus
• Adobe Creative Cloud`;

  // ---------- LOCAL KNOWLEDGE (SƏNİN MƏHSULLARIN) ----------
  const KB = {
    // Netflix
    netflix_sexsi: {
      name: "Netflix Premium Şəxsi",
      about:
`Netflix Premium Şəxsi:
• Otaq yalnız sizdə olur (paylaşılan deyil)
• Ad/şifrə dəyişmək olur
• İstədiyiniz cihazda istifadə edə bilərsiniz`,
      price: "Qiymət: 1 ay — 5.99₼ • 3 ay — 16.99₼ • 6 ay — 32.99₼",
      order: "Sifariş: Netflix Şəxsi seç → müddəti seç → ad + 4 rəqəmli kod yaz → WhatsApp-a göndər.",
      diff: "Fərq: Şəxsi otaq yalnız sizdə olur, ad/şifrə dəyişmək olur, cihaz sərbəstdir.",
      stock: "Stok: var.",
    },
    netflix_umumi: {
      name: "Netflix Premium Ümumi",
      about:
`Netflix Premium Ümumi:
• Otaq paylaşılandır
• Ad/şifrə dəyişmək olmur
• Adətən 1 cihaz üçün uyğundur`,
      price: "Qiymət: 1 ay — 3.99₼",
      order: "Sifariş: Netflix Ümumi seç → planı seç → WhatsApp açılır.",
      diff: "Fərq: Ümumi otaq paylaşılandır, ad/şifrə dəyişmir, 1 cihaz üçün uyğundur.",
      stock: "Stok: var.",
    },
    netflix: {
      name: "Netflix (Şəxsi / Ümumi)",
      about: "Netflix üçün 2 variant var: Şəxsi və Ümumi. Hansını istəyirsiniz?",
      price: "Qiymətlər:\n• Şəxsi: 1 ay 5.99₼ • 3 ay 16.99₼ • 6 ay 32.99₼\n• Ümumi: 1 ay 3.99₼",
      order: "Sifariş: Saytda Netflix seç → Şəxsi və ya Ümumi seç → plan seç → WhatsApp-a keç.",
      diff: "Fərq: Şəxsi (yalnız siz, ad/şifrə dəyişir) • Ümumi (paylaşılan, ad/şifrə dəyişmir, 1 cihaz).",
      stock: "Stok: var.",
    },

    capcut: {
      name: "CapCut Pro",
      about:
`CapCut Pro (Premium):
• Premium effektlər/filtrlər/template-lər
• Watermark olmadan export + HD/4K
• Hesab biz tərəfdən hazır verilir
• 1 nəfər üçün nəzərdə tutulub`,
      price: "Qiymət: 1 ay — 4.99₼ • 6 ay — 22.99₼",
      order: "Sifariş: CapCut seç → müddəti seç → WhatsApp açılır.",
      diff: "Fərq: Free-də watermark/limit ola bilər, Pro-da premium alətlər açıq olur.",
      stock: "Stok: var.",
    },

    zoom: {
      name: "Zoom Pro",
      about:
`Zoom Pro:
• Limitsiz görüş vaxtı (40 dəq limiti yoxdur)
• 100 nəfərə qədər iştirakçı
• Cloud recording (buludda yaddaş)
• HD video və yüksək səs keyfiyyəti
• Host nəzarəti və görüş planlama
• Hesab biz tərəfdən hazır şəkildə verilir
Uyğundur: dərslər, biznes görüşləri, komanda iclasları`,
      price: "Qiymət: 1 ay — 9.99₼",
      order: "Sifariş: Zoom Pro seç → 1 aylıq planı seç → WhatsApp avtomatik açılır.",
      diff: "Fərq: Free Zoom-da 40 dəq limit var, Pro-da limit yoxdur + əlavə imkanlar var.",
      stock: "Stok: var.",
    },

    captions: {
      name: "Captions AI (Şəxsi hesab)",
      about:
`Captions AI:
• AI ilə avtomatik subtitr (caption)
• Video montaj və əsas AI alətlər
• Reels / TikTok üçün uyğun
• Hesab biz tərəfdən hazır şəkildə verilir`,
      price: "Qiymət: PRO (1 ay) — 11.99₼ • MAX (1 ay) — 19.99₼",
      order: "Sifariş: Captions AI seç → PRO və ya MAX seç → WhatsApp açılır.",
      diff:
`PRO vs MAX:
• PRO: caption + əsas AI alətlər
• MAX: PRO + əlavə AI effektlər/premium funksiyalar + daha sürətli emal və üstün keyfiyyət`,
      stock: "Stok: var.",
    },

    google_ai: {
      name: "Google AI Pro (Gemini + Veo 3)",
      about:
`Google AI Pro — Google-un rəsmi süni intellekt paketidir:
• Gemini AI – mətn yazma, analiz, tərcümə, ideya
• Veo 3 – AI ilə video kontent yaradılması
• Sürətli və stabil performans
• Şəxsi Gmail hesabınızda aktivləşdirilir
• Hesab tam sizə məxsus olur (paylaşılan deyil)`,
      price: "Qiymət: 1 ay — 9.99₼",
      order: "Sifariş: Google AI Pro seç → 1 aylıq planı seç → WhatsApp açılır.",
      diff: "Fərq: Ultra plan daha güclüdür (prioritet emal + əlavə premium imkanlar).",
      stock: "Stok: var.",
    },

    google_ai_ultra: {
      name: "Google AI Ultra (Gemini Ultra + Veo 3)",
      about:
`Google AI Ultra — ən üst səviyyəli Google AI paketidir:
• Gemini Ultra – dərin analiz, tərcümə, kod dəstəyi
• Veo 3 – yüksək keyfiyyətli video yaradılması
• Ultra performans və prioritet emal
• Şəxsi Gmail hesabınızda aktivləşdirilir
• Pro planın hamısı + əlavə premium funksiyalar
Uyğundur: kontent creatorlar, marketinq, freelancerlər, peşəkar AI istifadəçiləri`,
      price: "Qiymət: 1 ay — 19.99₼",
      order: "Sifariş: Google AI Ultra seç → 1 aylıq planı seç → WhatsApp açılır.",
      diff:
`Pro vs Ultra:
• Pro: Gemini + Veo 3
• Ultra: Pro + Gemini Ultra, prioritet emal, əlavə premium funksiyalar`,
      stock: "Stok: var.",
    },

    spotify: {
      name: "Spotify Premium",
      about: "Spotify Premium: reklamsız musiqi, offline dinləmə. Şəxsi hesabınızda aktivləşdirilir.",
      price: "Qiymət: 1 ay — 4.49₼ • 3 ay — 12.80₼ • 6 ay — 23.90₼",
      order: "Sifariş: Spotify seç → plan seç → Gmail + Spotify şifrənizi yaz → WhatsApp-a göndər.",
      diff: "Fərq: Premium-da reklamsız + offline olur.",
      stock: "Stok: var.",
    },
    prime: {
      name: "Amazon Prime Video",
      about: "Prime Video: filmlər/seriallar. Aktivləşmə üçün ad + 5 rəqəmli kod yazılır.",
      price: "Qiymət: 1 ay — 4.49₼ • 6 ay — 17.99₼",
      order: "Sifariş: Prime Video seç → plan seç → ad + 5 rəqəmli kod yaz → WhatsApp-a göndər.",
      diff: "Fərq: Prime üçün ad+5 rəqəmli kod tələb olunur.",
      stock: "Stok: var.",
    },
    duolingo: {
      name: "Duolingo Super",
      about: "Duolingo Super: reklamsız, limitsiz hearts, mistake review. Linklə rəsmi qoşulursunuz.",
      price: "Qiymət: 1 ay — 3.99₼",
      order: "Sifariş: Duolingo seç → plan seç → Gmail yaz → WhatsApp-a göndər.",
      diff: "Fərq: Super-da reklam yoxdur və hearts limit olmur.",
      stock: "Stok: var.",
    },
    canva: {
      name: "Canva Premium",
      about: "Canva Premium: premium şablonlar/elementlər açıq olur. Dəvət ilə aktivləşir.",
      price: "Qiymət: 1 ay — 1.49₼ • 12 ay — 2.99₼",
      order: "Sifariş: Canva seç → plan seç → Gmail yaz → WhatsApp-a göndər.",
      diff: "Fərq: Premium-da premium elementlər açıq olur.",
      stock: "Stok: var.",
    },
    chatgpt: {
      name: "ChatGPT Plus",
      about: "ChatGPT Plus: daha güclü model + stabil istifadə. Dəvət ilə hesabınızda aktivləşir.",
      price: "Qiymət: 1 ay — 11.99₼",
      order: "Sifariş: ChatGPT Plus seç → plan seç → Gmail yaz → WhatsApp-a göndər.",
      diff: "Fərq: Plus daha çox imkan verir, free-də limit olur.",
      stock: "Stok: var.",
    },
    adobecc: {
      name: "Adobe Creative Cloud",
      about: "Adobe CC: Photoshop, Illustrator, Premiere Pro və s. Hesab hazır təqdim edilir.",
      price: "Qiymət: 1 ay — 9.99₼ • 4 ay — 22.99₼",
      order: "Sifariş: Adobe CC seç → plan seç → WhatsApp açılır.",
      diff: "Fərq: Premium paketdə Adobe proqramları açıq olur.",
      stock: "Stok: var.",
    },
    youtube: {
      name: "YouTube Premium",
      about: "YouTube Premium hazırda stokda yoxdur (problem olduğu üçün müvəqqəti satılmır).",
      price: "Stokda deyil.",
      order: "Stokda deyil.",
      diff: "—",
      stock: "Stok: YOX.",
    },
  };

  // ---------- UI helpers ----------
  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function addMsg(role, text) {
    const div = document.createElement("div");
    div.className =
      role === "user" ? "msg user" :
      role === "hint" ? "msg hint" :
      role === "err"  ? "msg err"  :
      "msg bot";
    div.innerHTML = esc(text);
    ui.msgs.appendChild(div);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
  }

  function setOpen(open) {
    isOpen = !!open;
    ui.box.classList.toggle("open", isOpen);
    ui.box.setAttribute("aria-hidden", isOpen ? "false" : "true");
    if (isOpen) setTimeout(() => ui.input.focus(), 80);
  }

  ui.fab.addEventListener("click", () => setOpen(!isOpen));
  ui.close.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  ui.send.addEventListener("click", send);
  ui.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); ui.send.click(); }
  });

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/ə/g, "e")
      .replace(/ı/g, "i")
      .replace(/ö/g, "o")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ç/g, "c")
      .replace(/ğ/g, "g")
      .replace(/[^\p{L}\p{N}\s?]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function levenshtein(a, b) {
    a = a || ""; b = b || "";
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
        prev = tmp;
      }
    }
    return dp[n];
  }

  function fuzzyHasWord(text, target) {
    const t = normalize(target);
    const parts = normalize(text).split(/\s+/).filter(Boolean);
    if (normalize(text).includes(t)) return true;
    const maxD = t.length <= 5 ? 1 : 2;
    return parts.some(p => levenshtein(p, t) <= maxD);
  }

  function containsAny(text, arr) {
    return arr.some(w => fuzzyHasWord(text, w));
  }

  function isGreeting(raw) {
    const t = normalize(raw);
    if (!t) return false;
    const parts = t.split(/\s+/).filter(Boolean);
    if (parts.length > 4) return false;
    return parts.some(p => GREET_WORDS.includes(p)) || GREET_WORDS.some(g => t === g);
  }

  function detectTopic(text) {
    const txt = normalize(text);
    for (const t of TOPICS) {
      for (const w of t.words) {
        const ww = normalize(w);
        if (!ww) continue;
        if (ww.includes(" ")) {
          if (txt.includes(ww)) return t.key;
        } else {
          if (fuzzyHasWord(txt, ww)) return t.key;
        }
      }
    }
    return "";
  }

  function isFollowUpOnly(text) {
    const cleaned = normalize(text);
    if (!cleaned) return true;
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length > 3) return false;
    return parts.every(p => FOLLOW_UP.includes(p) || FOLLOW_UP.some(k => p.includes(k)));
  }

  function detectIntent(text) {
    const t = normalize(text);

    if (t.includes("sifaris") || t.includes("sifariş") || t.includes("almaq") || t.includes("nece al") || t.includes("necə al"))
      return "order";

    if (t.includes("qiym") || t.includes("nece qeder") || t.includes("neçədir") || t.includes("necedi") || t.includes("neçiyə"))
      return "price";

    if (t.includes("stok") || t.includes("varmi") || t.includes("varmı") || t.includes("movcud") || t.includes("mövcud"))
      return "stock";

    if (t.includes("ferq") || t.includes("fərq") || t.includes("fərqi") || t.includes("ferqi"))
      return "diff";

    if (t.includes("nedir") || t.includes("nədir") || t.includes("haqqinda") || t.includes("məlumat") || t.includes("info"))
      return "about";

    return "";
  }

  function replyFromKB(topic, intent) {
    const item = KB[topic];
    if (!item) return "";

    if (intent === "price") return `${item.name}\n${item.price}`;
    if (intent === "order") return `${item.name}\n${item.order}`;
    if (intent === "stock") return `${item.name}\n${item.stock}`;
    if (intent === "diff") return `${item.name}\n${item.diff}`;
    if (intent === "about") return `${item.name}\n${item.about}`;
    // default
    return `${item.name}\n${item.about}\n\n${item.price}\n\n${item.order}`;
  }

  function getTopicForMessage(raw) {
    if (isGreeting(raw)) return "";
    const t = detectTopic(raw);
    if (t) {
      store.state.lastTopic = t;
      return t;
    }
    return store.state.lastTopic || "";
  }

  async function send() {
    const raw = (ui.input.value || "").trim();
    if (!raw || isSending) return;

    isSending = true;
    ui.input.value = "";
    addMsg("user", raw);

    const nraw = normalize(raw);

    // ✅ salam: AI-ə getməsin
    if (isGreeting(raw)) {
      addMsg(
        "bot",
        "Salam! 😊 Hansı paket barədə kömək edim?\nMəs: Zoom Pro, Google AI Pro/Ultra, Captions AI, CapCut, Netflix..."
      );
      store.hasSpoken = true;
      saveState(store);
      isSending = false;
      return;
    }

    // ✅ YouTube: lokaldan blok
    if (containsAny(nraw, YT_WORDS)) {
      addMsg("bot", replyFromKB("youtube", "about"));
      store.hasSpoken = true;
      saveState(store);
      isSending = false;
      return;
    }

    const topic = getTopicForMessage(raw);
    const intent = detectIntent(raw);

    // ✅ ƏSAS FIX: topic varsa intent olmasa belə LOKAL cavab ver
    // məsələn: "zoom pro" yazanda birbaşa lokaldan məlumat + qiymət + sifariş qaydası versin
    if (topic && !intent) {
      const local = replyFromKB(topic, "");
      if (local) {
        addMsg("bot", local);
        store.hasSpoken = true;
        saveState(store);
        isSending = false;
        return;
      }
    }

    // Topic + intent -> lokaldan cavab
    if (topic && intent) {
      const local = replyFromKB(topic, intent);
      if (local) {
        addMsg("bot", local);
        store.hasSpoken = true;
        saveState(store);
        isSending = false;
        return;
      }
    }

    // “necə sifariş” deyib məhsul demirsə -> siyahı
    const onlyOrder =
      isFollowUpOnly(nraw) &&
      (nraw.includes("sifaris") || nraw.includes("sifariş") || nraw.includes("nece") || nraw.includes("necə") || nraw.includes("almaq"));

    if (onlyOrder && !store.state.lastTopic) {
      addMsg("bot", PRODUCT_LIST_TEXT);
      store.hasSpoken = true;
      saveState(store);
      isSending = false;
      return;
    }

    // Əks halda AI-a get (topic varsa qarışdırmasın deyə hint)
    const loading = document.createElement("div");
    loading.className = "msg bot";
    loading.textContent = "Yazıram...";
    ui.msgs.appendChild(loading);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;

    const hint = topic
      ? `\n\nQAYDA: YALNIZ "${KB[topic]?.name || topic}" haqqında cavab ver. Başqa məhsulları qarışdırma.`
      : "";
    const messageToAI = raw + hint;

    try {
      const res = await fetch(AI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageToAI, state: store.state }),
      });

      loading.remove();

      if (!res.ok) {
        addMsg("err", "Server xətası oldu. Bir az sonra yenə yoxlayın.");
        return;
      }

      const data = await res.json().catch(() => null);
      const reply =
        (data && (data.reply || data.answer || data.text)) ||
        "Cavab alınmadı. Bir az sonra yenə yoxlayın.";

      addMsg("bot", reply);

      if (data && data.state) {
        store.state = {
          helloSent: !!data.state.helloSent,
          noteSent: !!data.state.noteSent,
          lastTopic: String(data.state.lastTopic || store.state.lastTopic || ""),
        };
      }

      store.hasSpoken = true;
      saveState(store);
    } catch (e) {
      loading.remove();
      addMsg("err", "İnternet/URL problemi ola bilər. Bir az sonra yenə yoxlayın.");
      console.warn(e);
    } finally {
      isSending = false;
    }
  }
})();