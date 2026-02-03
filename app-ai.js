/* app-ai.js — Mirpanel AI (FINAL v5)
   - Typo tolerant topic detect (netfliix -> netflix)
   - Follow-up sözlərini lastTopic-a bağlayır
   - YouTube: AI-ə getmədən “xidmət yoxdur”
   - localStorage state: (helloSent / noteSent / lastTopic) + hasSpoken
   - Worker state-ni saxlayır və geri göndərir
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

  ui.input.placeholder = "Məs: Netflix qiyməti? / Spotify stokda var? / Netflix şəxsi-ümumi fərqi?";

  // ---------- Persisted State ----------
  const LS_KEY = "mirpanel_ai_state_v1";
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      return {
        // frontend flags
        hasSpoken: !!s.hasSpoken,

        // worker state (important)
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

  let store = loadState(); // {hasSpoken, state:{helloSent,noteSent,lastTopic}}
  let isOpen = false;
  let isSending = false;

  // ---------- YouTube block ----------
  const YT_WORDS = ["youtube", "yutub", "yt", "you tube"];

  // ---------- Topics ----------
  const TOPICS = [
    { key: "netflix_umumi", words: ["umumi netflix", "ümumi netflix", "netflix umumi", "netflix ümumi"] },
    { key: "netflix_sexsi", words: ["sexsi netflix", "şəxsi netflix", "netflix sexsi", "netflix şəxsi"] },
    { key: "netflix", words: ["netflix"] },

    { key: "spotify", words: ["spotify"] },
    { key: "prime", words: ["amazon prime", "prime video", "prime"] },
    { key: "duolingo", words: ["duolingo"] },
    { key: "canva", words: ["canva"] },
    { key: "capcut", words: ["capcut", "cap cut"] },
    { key: "chatgpt", words: ["chatgpt", "gpt"] },
    { key: "adobe", words: ["adobe", "creative cloud"] },
  ];

  const FOLLOW_UP = [
    "qiymet", "qiymət", "qiyməti",
    "stok", "stokda", "varmi", "varmı", "movcud",
    "fərq", "ferq", "fərqi", "ferqi", "şəxsi", "sexsi", "ümumi", "umumi",
    "necə", "nece", "sifariş", "sifaris", "almaq", "alım", "alim",
    "cihaz", "2", "iki", "tv", "telefon", "noutbuk", "pc"
  ];

  const PRODUCT_LIST_TEXT =
`Mövcud paketlər:
• Netflix (Şəxsi / Ümumi otaq)
• Spotify Premium
• Amazon Prime Video
• Duolingo Super
• Canva Premium
• CapCut Pro
• ChatGPT Plus
• Adobe Creative Cloud`;

  // ---------- Helpers ----------
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
    if (isOpen) setTimeout(() => ui.input.focus(), 50);
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

  // Levenshtein typo tolerant
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

  function detectTopic(text) {
    const txt = normalize(text);

    for (const t of TOPICS) {
      for (const w of t.words) {
        const ww = normalize(w);

        // multiword: includes
        if (txt.includes(ww)) return t.key;

        // single word: typo tolerant
        if (ww.split(" ").length === 1 && fuzzyHasWord(txt, ww)) return t.key;
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

  function topicPretty(t) {
    const map = {
      netflix: "Netflix",
      netflix_sexsi: "Netflix Şəxsi",
      netflix_umumi: "Netflix Ümumi",
      spotify: "Spotify",
      prime: "Amazon Prime Video",
      duolingo: "Duolingo",
      canva: "Canva",
      capcut: "CapCut",
      chatgpt: "ChatGPT",
      adobe: "Adobe Creative Cloud",
    };
    return map[t] || t;
  }

  // Expand follow-up to a full question (helps model accuracy)
  function expandWithTopic(q) {
    const lower = normalize(q);

    // topic update: store.state.lastTopic
    const t = detectTopic(lower);
    if (t) store.state.lastTopic = t;

    const lastTopic = store.state.lastTopic;

    if (lastTopic && isFollowUpOnly(lower)) {
      const n = topicPretty(lastTopic);

      if (lastTopic.startsWith("netflix")) {
        if (lower.includes("ferq") || lower.includes("fərq")) return "Netflix şəxsi otaq ilə ümumi otağın fərqi nədir? (cihaz, şifrə dəyişmək, paylaşım)";
        if (lower.includes("qiym")) return "Netflix şəxsi və ümumi otağın qiymətləri neçədir? (1/3/6 ay)";
        if (lower.includes("stok") || lower.includes("varmi") || lower.includes("movcud")) return "Netflix otaqlar stokda var? Şəxsi və Ümumi ayrı yaz.";
        if (lower.includes("sifaris") || lower.includes("sifariş") || lower.includes("nece") || lower.includes("necə") || lower.includes("almaq"))
          return "Netflix otağı saytdan necə sifariş edə bilərəm? Addım-addım.";
        if (lower.includes("cihaz") || lower.includes("tv") || lower.includes("telefon") || lower.includes("noutbuk") || lower.includes("pc") || lower.includes("2") || lower.includes("iki"))
          return "Netflix otağını neçə cihazda istifadə edə bilərəm? Şəxsi və Ümumi ayrı yaz.";
      }

      if (lower.includes("qiym")) return `${n} qiyməti neçədir?`;
      if (lower.includes("stok") || lower.includes("varmi") || lower.includes("movcud")) return `${n} stokda var? Hə/Yox de.`;
      if (lower.includes("sifaris") || lower.includes("sifariş") || lower.includes("nece") || lower.includes("necə") || lower.includes("almaq"))
        return `${n} saytdan necə sifariş edə bilərəm? Addım-addım.`;

      return `${n} barədə məlumat: qiymət / stok / necə sifariş`;
    }

    return q;
  }

  async function send() {
    const raw = (ui.input.value || "").trim();
    if (!raw || isSending) return;

    isSending = true;
    ui.input.value = "";
    addMsg("user", raw);

    const nraw = normalize(raw);

    // ✅ YouTube -> AI-ə getmə (tam blok)
    if (containsAny(nraw, YT_WORDS)) {
      addMsg("bot", "YouTube Premium hazırda stokda yoxdur (problem olduğu üçün müvəqqəti satılmır)");
      store.hasSpoken = true;
      saveState(store);
      isSending = false;
      return;
    }

    const q = expandWithTopic(raw);

    // “necə sifariş” deyib məhsul demirsə -> siyahı ver
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

    const loading = document.createElement("div");
    loading.className = "msg bot";
    loading.textContent = "Yazıram...";
    ui.msgs.appendChild(loading);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;

    try {
      const res = await fetch(AI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          // ✅ Worker FINAL state göndəririk (salam/qeyd/lastTopic idarə olunsun)
          state: store.state,
        }),
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

      // ✅ Worker state-ni saxla
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