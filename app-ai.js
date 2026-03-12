/* app-ai.js — Mirpanel AI (FINAL SALES VERSION)
   ✅ Bütün mövcud məhsullar daxil edildi
   ✅ Spotify 3 aylıq / 8.99₼ / yeni gmail + şifrə uyğunlaşdırıldı
   ✅ Surfshark VPN əlavə edildi
   ✅ TikTok Jeton əlavə edildi
   ✅ Google AI Pro / Ultra, Captions, Netflix, Zoom, Prime, Duolingo, Canva, CapCut, ChatGPT, Adobe, YouTube daxil edildi
   ✅ Şəxsi plan / Ümumi plan fərqi əlavə edildi
   ✅ Müştəriyə daha yumşaq, normal və emojili cavab verir
   ✅ Salam yazanda normal qarşılayır
   ✅ Topic + intent varsa lokal cavab
   ✅ Topic yazılsa intent olmasa belə lokal tam info verir
   ✅ Follow-up son məhsula bağlanır
   ✅ Satış yönümlü CTA əlavə edildi
   ✅ Müştəri qərarsız qalanda uyğun məhsul tövsiyə edir
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
    "Məs: Netflix fərqi nədir? / Spotify necə sifariş olunur? / Surfshark nə üçündür? / TikTok jeton necə hesablanır?";

  /* =========================
     STATE
     ========================= */
  const LS_KEY = "mirpanel_ai_state_v3";

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
      return {
        hasSpoken: false,
        state: { helloSent: false, noteSent: false, lastTopic: "" },
      };
    }
  }

  function saveState(store) {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  }

  let store = loadState();
  let isOpen = false;
  let isSending = false;

  /* =========================
     WORD LISTS
     ========================= */
  const GREET_WORDS = [
    "salam",
    "salamlar",
    "salam aleykum",
    "salam əleykum",
    "aleykum salam",
    "hi",
    "hey",
    "sa",
  ];

  const TOPICS = [
    { key: "plan_ferqi", words: ["sexsi ile umumi ferqi", "şəxsi ilə ümumi fərqi", "umumi sexsi ferqi", "ümumi şəxsi fərqi", "plan ferqi", "plan fərqi", "sexsi umumi", "şəxsi ümumi"] },
    { key: "plan_umumi", words: ["umumi plan", "ümumi plan"] },
    { key: "plan_sexsi", words: ["sexsi plan", "şəxsi plan"] },

    { key: "netflix_umumi", words: ["umumi netflix", "ümumi netflix", "netflix umumi", "netflix ümumi"] },
    { key: "netflix_sexsi", words: ["sexsi netflix", "şəxsi netflix", "netflix sexsi", "netflix şəxsi"] },
    { key: "netflix", words: ["netflix", "netfliix", "netflx"] },

    { key: "capcut", words: ["capcut", "cap cut"] },
    { key: "zoom", words: ["zoom", "zoom pro"] },
    { key: "youtube", words: ["youtube", "yutub", "yt", "you tube"] },

    { key: "spotify", words: ["spotify", "spotfiy", "spoti"] },
    { key: "surfshark", words: ["surfshark", "surf shark", "vpn", "surfshark vpn"] },
    { key: "tiktok_jeton", words: ["tiktok", "tik tok", "jeton", "tiktok jeton", "tik tok jeton", "coin", "coins"] },

    { key: "google_ai_ultra", words: ["google ai ultra", "gemini ultra", "ultra", "google ultra"] },
    { key: "google_ai", words: ["google ai pro", "google ai", "gemini", "veo 3", "veo3", "google pro"] },
    { key: "captions", words: ["captions", "captions ai", "caption ai"] },
    { key: "grok_supergrok", words: ["grok", "supergrok", "grok ai"] },
    { key: "claude_ai", words: ["claude", "claude ai"] },
    { key: "chatgpt", words: ["chatgpt", "chat gpt", "gpt", "chatgpt plus"] },

    { key: "prime", words: ["prime", "amazon prime", "prime video", "amazon prime video"] },
    { key: "duolingo", words: ["duolingo"] },
    { key: "canva", words: ["canva"] },
    { key: "adobecc", words: ["adobe", "adobe cc", "adobe creative cloud", "creative cloud", "adobecc"] },
  ];

  const FOLLOW_UP = [
    "qiymet", "qiymət", "qiyməti", "nece", "necə", "necedi", "neçədir", "nece qeder", "neçə",
    "stok", "stokda", "varmi", "varmı", "movcud", "mövcud",
    "ferq", "fərq", "ferqi", "fərqi",
    "sifaris", "sifariş", "almaq", "alım", "alim",
    "nedir", "nədir", "haqqinda", "haqqında", "melumat", "məlumat", "info",
    "nece sifaris", "necə sifariş",
    "hansi", "hansı", "hansini", "hansını", "tovsiyye", "tövsiyə", "meslehet", "məsləhət"
  ];

  const PRODUCT_LIST_TEXT =
`✨ Hazırda bunlar mövcuddur:

• CapCut Pro
• Netflix Premium Şəxsi
• Netflix Premium Ümumi
• Zoom Pro
• YouTube Premium
• Spotify Premium (3 ay)
• Surfshark VPN
• TikTok Jeton
• Google AI Pro
• Google AI Ultra
• Captions AI
• Grok AI
• Claude AI
• Amazon Prime Video
• Duolingo Super
• Canva Premium
• ChatGPT Plus
• Adobe Creative Cloud

İstədiyiniz məhsulun adını yazın, mən sizə qiymətini, fərqini və sifariş qaydasını yazım 😊`;

  /* =========================
     LOCAL KNOWLEDGE
     ========================= */
  const KB = {
    plan_umumi: {
      name: "👥 Ümumi Plan",
      about:
`Ümumi plan daha sərfəli premium istifadə variantıdır 😊

• Adətən paylaşım əsaslı olur
• Daha münasib qiymətə təqdim olunur
• Premium funksiyalara daha sərfəli giriş verir
• Büdcəyə uyğun seçim axtaranlar üçün uyğundur`,
      price: "💰 Qiymət məhsula görə dəyişir.",
      order: "🛒 Məhsulu seçirsiniz, ümumi planı seçirsiniz və sifarişi davam etdirirsiniz.",
      diff: "✨ Ümumi plan daha sərfəlidir, amma bəzi məhsullarda paylaşım tipli olur.",
      stock: "✅ Mövcud məhsullarda ümumi plan olan variantlar təqdim olunur.",
      recommend: "💡 Əgər sizin üçün əsas məsələ münasib qiymətdirsə, ümumi plan daha uyğun seçim olur."
    },

    plan_sexsi: {
      name: "🔐 Şəxsi Plan",
      about:
`Şəxsi plan daha fərdi və rahat istifadə üçündür 👌

• Hesab və ya istifadə daha fərdi olur
• Daha rahat və stabil istifadə verir
• Şəxsi rahatlığa üstünlük verənlər üçün uyğundur
• Tək istifadə üçün daha yaxşı seçim sayılır`,
      price: "💰 Qiymət məhsula görə dəyişir.",
      order: "🛒 Məhsulu seçirsiniz, şəxsi planı seçirsiniz və sifarişi davam etdirirsiniz.",
      diff: "✨ Şəxsi plan daha rahat və fərdi istifadə üçündür.",
      stock: "✅ Mövcud məhsullarda şəxsi plan olan variantlar təqdim olunur.",
      recommend: "💡 Əgər rahatlıq və şəxsi istifadə istəyirsinizsə, şəxsi plan daha yaxşı seçimdir."
    },

    plan_ferqi: {
      name: "⚖️ Şəxsi Plan və Ümumi Plan fərqi",
      about:
`Şəxsi plan və ümumi plan arasında əsas fərq istifadə formasındadır 😊

• Şəxsi plan daha fərdi istifadə üçündür
• Ümumi plan isə daha sərfəli qiymətə premium istifadə imkanı verir
• Şəxsi plan rahatlığa üstünlük verənlər üçün daha uyğundur
• Ümumi plan isə büdcəyə uyğun seçim axtaranlar üçün daha əlverişlidir

Əgər əsas məqsədiniz daha rahat və fərdi istifadədirsə, şəxsi plan daha yaxşıdır.
Əgər əsas məqsədiniz münasib qiymətə premium istifadədirsə, ümumi plan daha sərfəlidir.`,
      price: "💰 Qiymət məhsula görə dəyişir.",
      order: "🛒 Hansı məhsulu istədiyinizi yazın, ona uyğun şəxsi və ya ümumi variantı seçə bilərsiniz.",
      diff: "✨ Şəxsi plan daha fərdi, ümumi plan isə daha sərfəli seçimdir.",
      stock: "✅ Məhsula görə şəxsi və ya ümumi plan mövcuddur.",
      recommend: "💡 İstəsəniz məhsulun adını yazın, sizə hansının daha uyğun olduğunu da deyim."
    },

    capcut: {
      name: "🎬 CapCut Pro",
      about:
`CapCut Pro premium video edit hesabıdır 😊

• Premium effektlər, filtrlər və template-lər açıq olur
• Watermark olmadan export etmək olur
• HD / 4K keyfiyyət dəstəyi var
• Hesab hazır şəkildə təqdim olunur`,
      price: "💰 Qiymətlər:\n• 1 aylıq — 4.99₼\n• 3 aylıq — 12.99₼\n• 6 aylıq — 23.99₼",
      order: "🛒 Sifariş üçün saytda CapCut Pro seçirsiniz, müddəti seçirsiniz və sonra WhatsApp açılır.",
      diff: "✨ Free versiyadan fərqi odur ki, premium effektlər və watermark-sız export açıq olur.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Video edit edirsinizsə, CapCut Pro çox sərfəli və rahat seçimdir."
    },

    netflix_sexsi: {
      name: "🎞️ Netflix Premium Şəxsi",
      about:
`Netflix Şəxsi otaqda hesab daha rahat istifadə olunur 👌

• Otaq yalnız sizə aid olur
• Ad və şifrəni dəyişmək mümkündür
• İstədiyiniz cihazda istifadə edə bilərsiniz`,
      price: "💰 Qiymətlər:\n• 1 aylıq — 5.99₼\n• 3 aylıq — 16.49₼\n• 6 aylıq — 29.99₼",
      order: "🛒 Sifariş üçün Netflix Şəxsi seçirsiniz, planı seçirsiniz, sonra ad və 4 rəqəmli kod yazıb WhatsApp-a göndərirsiniz.",
      diff: "✨ Şəxsi otaqda hesab yalnız sizdə olur, Ümumi otaqda isə paylaşım olur.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Əgər Netflix-i rahat və tam şəxsi istifadə etmək istəyirsinizsə, bu variant daha uyğundur."
    },

    netflix_umumi: {
      name: "🎞️ Netflix Premium Ümumi",
      about:
`Netflix Ümumi hesab daha sərfəli variantdır 🙂

• Paylaşılan hesabdır
• Ad və şifrə dəyişmir
• Əsasən 1 cihaz üçün uyğundur`,
      price: "💰 Qiymət:\n• 1 aylıq — 3.99₼",
      order: "🛒 Sifariş üçün Netflix Ümumi seçirsiniz, 1 aylıq planı seçirsiniz və WhatsApp açılır.",
      diff: "✨ Ümumi hesab daha sərfəlidir, amma paylaşılır. Şəxsi hesab isə yalnız sizə aid olur.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Əgər əsas məqsədiniz daha uyğun qiymətə Netflix almaqdırsa, Ümumi plan yaxşı seçimdir."
    },

    netflix: {
      name: "🎞️ Netflix Premium",
      about:
`Netflix üçün 2 variant var 😊

• Şəxsi
• Ümumi

İstəsəniz ikisinin fərqini də ayrıca yaza bilərəm.`,
      price: "💰 Qiymətlər:\n• Şəxsi: 1 ay 5.99₼ • 3 ay 16.49₼ • 6 ay 29.99₼\n• Ümumi: 1 ay 3.99₼",
      order: "🛒 Saytda Netflix seçirsiniz, sonra Şəxsi və ya Ümumi planı seçib sifariş edirsiniz.",
      diff: "✨ Şəxsi hesab sizə aid olur, Ümumi hesab isə paylaşılır.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Rahatlıq istəyirsinizsə Şəxsi, qiymət önəmlidirsə Ümumi plan daha uyğundur."
    },

    zoom: {
      name: "🎥 Zoom Pro",
      about:
`Zoom Pro onlayn dərs və görüşlər üçün çox rahat seçimdir 👍

• 40 dəqiqə limiti yoxdur
• 100 nəfərə qədər iştirakçı olur
• Cloud recording var
• HD görüntü və yüksək səs keyfiyyəti var`,
      price: "💰 Qiymət:\n• 1 aylıq — 9.99₼",
      order: "🛒 Zoom Pro seçirsiniz, 1 aylıq planı seçirsiniz və WhatsApp açılır.",
      diff: "✨ Free Zoom-dan fərqi limitsiz görüş vaxtı və əlavə pro funksiyalardır.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Dərs, iş görüşü və webinar üçün Zoom Pro çox rahat seçimdir."
    },

    youtube: {
      name: "▶️ YouTube Premium",
      about:
`YouTube Premium üçün:

• Reklamsız izləmə
• Arxa fonda işləmə
• Offline yükləmə
• YouTube Music daxildir`,
      price: "💰 Qiymət:\n• 1 aylıq — 2.99₼",
      order: "🛒 Sifariş üçün saytda YouTube Premium seçirsiniz, planı seçirsiniz, Gmail yazırsınız və WhatsApp-a göndərirsiniz.",
      diff: "✨ Adi versiyadan fərqi reklamsız və arxa fonda işləməsidir.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Hər gün YouTube istifadə edirsinizsə, bu məhsul çox sərfəli seçimdir."
    },

    spotify: {
      name: "🎵 Spotify Premium (3 AY)",
      about:
`Spotify üçün hazırda yalnız 3 aylıq plan mövcuddur 😊

• Reklamsız musiqi
• Offline dinləmə
• Yeni gmail ilə sifariş edilir
• Şifrə də qeyd olunur`,
      price: "💰 Qiymət:\n• 3 aylıq — 8.99₼",
      order: "🛒 Saytda Spotify seçirsiniz, 3 aylıq planı seçirsiniz, sonra yeni gmail ünvanını və şifrəni yazıb WhatsApp-a göndərirsiniz.",
      diff: "✨ Adi Spotify-dan fərqi reklamsız və offline istifadədir.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Musiqiyə çox qulaq asırsınızsa, 3 aylıq Spotify Premium çox sərfəli olur."
    },

    surfshark: {
      name: "🛡️ Surfshark VPN",
      about:
`Surfshark VPN çox rahat və faydalı VPN xidmətidir 🌍

• IP gizlətmə
• Güclü şifrələmə
• Reklam və virus bloklama
• Amazon Prime və digər region məhdudiyyətli servislərə giriş imkanı
• Hesab hazır şəkildə verilir`,
      price: "💰 Qiymət:\n• 1 aylıq — 3.99₼",
      order: "🛒 Saytda Surfshark VPN seçirsiniz, 1 aylıq planı seçirsiniz və WhatsApp açılır.",
      diff: "✨ Region bloklarını açmaq və təhlükəsiz istifadə üçün uyğundur.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Təhlükəsizlik və region girişləri sizin üçün önəmlidirsə, Surfshark yaxşı seçimdir."
    },

    tiktok_jeton: {
      name: "🪙 TikTok Jeton",
      about:
`TikTok Jeton sifarişi avtomatik hesablanır 😊

• Minimum sifariş: 500 jeton
• 500 jeton = 10 ₼
• Jeton sayı daxil ediləndə qiymət avtomatik hesablanır
• TikTok istifadəçi adı və profil linki / qeyd yazılır`,
      price: "💰 Hesablama qaydası:\n• 500 jeton = 10 ₼\n• Məsələn, 1000 jeton = 20 ₼",
      order: "🛒 Saytda TikTok Jeton seçirsiniz, sonra jeton sayını yazırsınız, TikTok istifadəçi adını və profil linkini qeyd edib WhatsApp-a göndərirsiniz.",
      diff: "✨ Burada qiymət sabit planla yox, yazdığınız jeton sayına görə hesablanır.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 TikTok üçün jeton lazımdırsa, sayını yazın, qiyməti sizə dərhal hesablaya bilərəm."
    },

    google_ai: {
      name: "🤖 Google AI Pro + VEO 3 + GEMINI",
      about:
`Google AI Pro məhsuldarlıq və AI üçün çox güclü seçimdir ✨

• Gemini AI
• Veo 3
• Mətn yazma, analiz, tərcümə və ideya yaratmaq üçün uyğundur
• Şəxsi Gmail hesabınızda aktivləşdirilir`,
      price: "💰 Qiymət:\n• 1 illik — 22.99₼",
      order: "🛒 Saytda Google AI Pro seçirsiniz, planı seçirsiniz və WhatsApp açılır.",
      diff: "✨ Ultra plan daha güclü və daha üst səviyyə istifadə üçündür.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 AI alətləri ilə işləyirsinizsə, Google AI Pro çox güclü seçimdir."
    },

    google_ai_ultra: {
      name: "🚀 Google AI Ultra + VEO 3 + GEMINI",
      about:
`Google AI Ultra ən üst səviyyə variantdır 👑

• Daha güclü imkanlar
• Daha peşəkar istifadə üçün uyğundur`,
      price: "💰 Hazırda qiymət göstərilmir.",
      order: "🛒 Hazırda sifariş mümkün deyil.",
      diff: "✨ Ultra plan Pro-dan daha yüksək səviyyə üçündür.",
      stock: "⚠️ Hazırda stokda yoxdur.",
      recommend: "💡 Hazırda mövcud variant kimi Google AI Pro seçə bilərsiniz."
    },

    captions: {
      name: "🎙️ Captions AI",
      about:
`Captions AI video creatorlar üçün çox faydalıdır 🎬

• Avtomatik subtitr
• AI video alətləri
• Reels / TikTok üçün uyğundur
• Hesab hazır şəkildə verilir`,
      price: "💰 Qiymətlər:\n• 1 aylıq PRO — 11.99₼\n• 1 aylıq MAX — 19.99₼",
      order: "🛒 Saytda Captions AI seçirsiniz, PRO və ya MAX planı seçirsiniz və WhatsApp açılır.",
      diff: "✨ MAX plan daha geniş və daha güclü imkanlar verir.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Reels, TikTok və qısa videolar hazırlayırsınızsa, Captions AI çox faydalıdır."
    },

    grok_supergrok: {
      name: "⚡ Grok AI",
      about:
`Grok AI güclü AI alətidir 🤖

• Güclü model
• Şəkil analizi
• Fayl və məlumat analizi
• Real vaxt çıxışı`,
      price: "💰 Qiymət:\n• 1 aylıq SuperGrok — 14.99₼",
      order: "🛒 Saytda Grok AI seçirsiniz, planı seçirsiniz və WhatsApp açılır.",
      diff: "✨ Real vaxt məlumat və güclü analiz üçün uyğundur.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Güclü AI və sürətli analiz istəyirsinizsə, Grok AI yaxşı seçimdir."
    },

    claude_ai: {
      name: "🧠 Claude AI",
      about:
`Claude AI yazı və analiz üçün çox yaxşı seçimdir ✍️

• Uzun mətn təhlili
• Məqalə və email yazmaq
• Kod və planlama`,
      price: "💰 Qiymət:\n• 1 illik — 59.99₼",
      order: "🛒 Saytda Claude AI seçirsiniz, planı seçirsiniz və WhatsApp açılır.",
      diff: "✨ Uzun mətn və sənəd analizi üçün çox rahatdır.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Yazı, analiz və sənəd üzərində işləyirsinizsə, Claude AI çox güclü seçimdir."
    },

    prime: {
      name: "📺 Amazon Prime Video",
      about:
`Amazon Prime Video film və serial üçün yaxşı seçimdir 🎬`,
      price: "💰 Qiymətlər:\n• 1 aylıq — 3.99₼\n• 6 aylıq — 17.99₼",
      order: "🛒 Prime seçirsiniz, planı seçirsiniz, sonra ad və 5 rəqəmli kod yazıb WhatsApp-a göndərirsiniz.",
      diff: "✨ Sifariş üçün ad və 5 rəqəmli kod tələb olunur.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Alternativ film-platforma istəyirsinizsə, Prime Video yaxşı seçimdir."
    },

    duolingo: {
      name: "📚 Duolingo Super",
      about:
`Duolingo Super dil öyrənmək üçün premium variantdır 🌍

• Reklamsız istifadə
• Limitsiz hearts
• Səhvləri düzəltmə imkanı`,
      price: "💰 Qiymət:\n• 1 aylıq — 3.99₼",
      order: "🛒 Saytda Duolingo seçirsiniz, planı seçirsiniz və WhatsApp açılır.",
      diff: "✨ Adi versiyadan fərqi reklamsız və limitsiz istifadəsidir.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Dil öyrənirsinizsə, Duolingo Super çox rahat və sərfəli seçimdir."
    },

    canva: {
      name: "🎨 Canva Premium",
      about:
`Canva Premium dizayn üçün çox rahat seçimdir ✨

• Premium şablonlar
• Premium elementlər
• Dəvət ilə aktivləşir`,
      price: "💰 Qiymətlər:\n• 1 aylıq — 1.49₼\n• 12 aylıq — 2.99₼",
      order: "🛒 Saytda Canva seçirsiniz, planı seçirsiniz, Gmail yazırsınız və WhatsApp-a göndərirsiniz.",
      diff: "✨ Premium elementlər və şablonlar açıq olur.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Dizayn edirsinizsə, Canva Premium ən sərfəli məhsullardan biridir."
    },

    chatgpt: {
      name: "🤖 ChatGPT Plus",
      about:
`ChatGPT Plus daha güclü AI istifadə etmək üçündür ✨

• Güclü modellər
• Daha stabil istifadə
• Gmail ilə sifariş olunur`,
      price: "💰 Qiymət:\n• 1 aylıq — 11.99₼",
      order: "🛒 Saytda ChatGPT Plus seçirsiniz, planı seçirsiniz, Gmail yazırsınız və WhatsApp-a göndərirsiniz.",
      diff: "✨ Free versiyadan daha güclü və daha rahatdır.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 AI ilə gündəlik işləyirsinizsə, ChatGPT Plus çox faydalı seçimdir."
    },

    adobecc: {
      name: "🎨 Adobe Creative Cloud",
      about:
`Adobe Creative Cloud dizayn və video üçün premium paketdir 👌

• Photoshop
• Illustrator
• Digər Adobe proqramları`,
      price: "💰 Qiymətlər:\n• 1 aylıq — 9.99₼\n• 4 aylıq — 22.99₼",
      order: "🛒 Saytda Adobe Creative Cloud seçirsiniz, planı seçirsiniz və WhatsApp açılır.",
      diff: "✨ Premium Adobe alətlərinə çıxış verir.",
      stock: "✅ Hazırda mövcuddur.",
      recommend: "💡 Professional dizayn və edit üçün Adobe CC çox yaxşı seçimdir."
    },
  };

  /* =========================
     UI
     ========================= */
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
      role === "err" ? "msg err" :
      "msg bot";
    div.innerHTML = esc(text).replace(/\n/g, "<br>");
    ui.msgs.appendChild(div);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
  }

  function setOpen(open) {
    isOpen = !!open;
    ui.box.classList.toggle("open", isOpen);
    ui.box.setAttribute("aria-hidden", isOpen ? "false" : "true");

    if (isOpen) {
      setTimeout(() => ui.input.focus(), 80);

      if (!store.hasSpoken && ui.msgs.children.length === 0) {
        addMsg("bot", "Salam 😊 Mən Mirpanel AI-yam. Məhsulun adını yazın, sizə qiyməti, fərqi və sifariş qaydasını rahat şəkildə deyim.");
        store.hasSpoken = true;
        saveState(store);
      }
    }
  }

  ui.fab.addEventListener("click", () => setOpen(!isOpen));
  ui.close.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });

  ui.send.addEventListener("click", send);
  ui.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      ui.send.click();
    }
  });

  /* =========================
     TEXT HELPERS
     ========================= */
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
    a = a || "";
    b = b || "";
    const m = a.length;
    const n = b.length;
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
    return parts.some((p) => levenshtein(p, t) <= maxD);
  }

  function isGreetingOnly(raw) {
    const t = normalize(raw);
    if (!t) return false;
    const hasTopic = !!detectTopic(raw);
    if (hasTopic) return false;
    return GREET_WORDS.some((g) => t === normalize(g));
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
    if (parts.length > 4) return false;
    return parts.every(
      (p) => FOLLOW_UP.includes(p) || FOLLOW_UP.some((k) => p.includes(k))
    );
  }

  function detectIntent(text) {
    const t = normalize(text);

    if (t.includes("sifaris") || t.includes("almaq") || t.includes("nece al") || t.includes("nece sifaris")) return "order";
    if (t.includes("qiym")) return "price";
    if (t.includes("stok") || t.includes("varmi") || t.includes("movcud")) return "stock";
    if (t.includes("ferq")) return "diff";
    if (t.includes("hansi") || t.includes("hansini") || t.includes("tovsiyye") || t.includes("meslehet")) return "recommend";
    if (t.includes("nedir") || t.includes("haqqinda") || t.includes("melumat") || t.includes("info")) return "about";

    return "";
  }

  function buildCTA(topic, intent) {
    const item = KB[topic];
    if (!item) return "\n\n🛒 İstəsəniz sifariş üçün sizə kömək edim.";

    if (intent === "price") return "\n\n🛒 Uyğundursa, sifariş üçün məhsulu seçib davam edə bilərsiniz.";
    if (intent === "order") return "\n\n✅ Hazırsınızsa, həmin addımlarla sifarişi rahat şəkildə tamamlaya bilərsiniz.";
    if (intent === "stock") return "\n\n🛒 İstəsəniz indi sifariş qaydasını da yaza bilərəm.";
    if (intent === "diff") return "\n\n💬 Hansının sizə uyğun olduğunu istəyirsinizsə, mən qısa şəkildə tövsiyə də edim.";
    if (intent === "recommend") return "\n\n🛒 Uyğun variantı seçdikdən sonra sifarişi rahat şəkildə verə bilərsiniz.";

    return "\n\n🛒 İstəsəniz bunu indi sifariş etmək üçün qaydanı da yaza bilərəm.";
  }

  function replyFromKB(topic, intent) {
    const item = KB[topic];
    if (!item) return "";

    if (intent === "price") return `${item.name}\n\n${item.price}${buildCTA(topic, intent)}`;
    if (intent === "order") return `${item.name}\n\n${item.order}${buildCTA(topic, intent)}`;
    if (intent === "stock") return `${item.name}\n\n${item.stock}${buildCTA(topic, intent)}`;
    if (intent === "diff") return `${item.name}\n\n${item.diff}${buildCTA(topic, intent)}`;
    if (intent === "about") return `${item.name}\n\n${item.about}\n\n${item.recommend || ""}${buildCTA(topic, intent)}`;
    if (intent === "recommend") return `${item.name}\n\n${item.recommend || item.about}${buildCTA(topic, intent)}`;

    return `${item.name}\n\n${item.about}\n\n${item.price}\n\n${item.recommend || ""}\n\n${item.order}`;
  }

  function getTopicForMessage(raw) {
    const t = detectTopic(raw);
    if (t) {
      store.state.lastTopic = t;
      return t;
    }
    return store.state.lastTopic || "";
  }

  function getSmartRecommendation(raw) {
    const t = normalize(raw);

    if (t.includes("film") || t.includes("serial")) {
      return "🎬 Film və serial üçün sizə Netflix və ya Prime Video uyğun ola bilər. Netflix daha populyardır, daha fərdi rahatlıq istəyirsinizsə Netflix Şəxsi yaxşı seçimdir.";
    }

    if (t.includes("musiqi")) {
      return "🎵 Musiqi üçün ən uyğun seçim Spotify Premium-dur. Reklamsız və offline istifadə üçün çox rahatdır.";
    }

    if (t.includes("dizayn")) {
      return "🎨 Dizayn üçün Canva Premium və Adobe Creative Cloud yaxşı seçimdir. Sadə və sürətli dizayn üçün Canva, professional iş üçün Adobe daha uyğundur.";
    }

    if (t.includes("ai") || t.includes("suni intellekt") || t.includes("süni intellekt")) {
      return "🤖 AI üçün istifadə məqsədinizə görə seçim dəyişir: gündəlik istifadə üçün ChatGPT Plus, yazı və analiz üçün Claude AI, daha geniş AI alətləri üçün Google AI Pro yaxşı seçimdir.";
    }

    if (t.includes("video")) {
      return "🎬 Video üçün CapCut Pro və Captions AI yaxşı seçimdir. Edit üçün CapCut, subtitr və creator işləri üçün Captions daha uyğundur.";
    }

    if (t.includes("vpn") || t.includes("tehlukesizlik") || t.includes("təhlükəsizlik")) {
      return "🛡️ Təhlükəsizlik və region blokları üçün Surfshark VPN daha uyğun seçimdir.";
    }

    if (t.includes("dil")) {
      return "📚 Dil öyrənmək üçün Duolingo Super ən uyğun seçimdir.";
    }

    return "";
  }

  /* =========================
     REMOTE AI
     ========================= */
  async function callAI(message) {
    const loading = document.createElement("div");
    loading.className = "msg bot";
    loading.textContent = "Bir saniyə, yazıram... 😊";
    ui.msgs.appendChild(loading);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;

    try {
      const res = await fetch(AI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, state: store.state }),
      });

      loading.remove();

      if (!res.ok) {
        addMsg("err", "Hazırda AI cavab vermədi 🙏 Bir az sonra yenə yoxlaya bilərsiniz.");
        return;
      }

      const data = await res.json().catch(() => null);
      const reply =
        (data && (data.reply || data.answer || data.text)) ||
        "Hazırda cavab alınmadı 🙏 Bir az sonra yenidən yaza bilərsiniz.";

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
      addMsg("err", "Bağlantıda problem oldu 🙏 Bir az sonra yenidən yoxlaya bilərsiniz.");
      console.warn(e);
    }
  }

  /* =========================
     MAIN SEND
     ========================= */
  async function send() {
    const raw = (ui.input.value || "").trim();
    if (!raw || isSending) return;

    isSending = true;
    ui.input.value = "";
    addMsg("user", raw);

    const nraw = normalize(raw);

    if (isGreetingOnly(raw)) {
      addMsg("bot", "Salam 😊 Xoş gəlmisiniz. İstədiyiniz məhsulun adını yazın, mən sizə qiyməti, fərqi və sifariş qaydasını deyim.");
      isSending = false;
      return;
    }

    if (
      (nraw.includes("mehsullar") || nraw.includes("neler var") || nraw.includes("ne var") || nraw.includes("movcud mehsullar")) &&
      !detectTopic(raw)
    ) {
      addMsg("bot", PRODUCT_LIST_TEXT);
      store.hasSpoken = true;
      saveState(store);
      isSending = false;
      return;
    }

    const smartRec = getSmartRecommendation(raw);
    if (smartRec && !detectTopic(raw) && !isFollowUpOnly(raw)) {
      addMsg("bot", `${smartRec}\n\n🛒 İstəsəniz uyğun məhsulun adını yazın, qiymətini və sifariş qaydasını da deyim.`);
      store.hasSpoken = true;
      saveState(store);
      isSending = false;
      return;
    }

    const topic = getTopicForMessage(raw);
    const intent = detectIntent(raw);

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

    const onlyOrder =
      isFollowUpOnly(nraw) &&
      (nraw.includes("sifaris") || nraw.includes("nece") || nraw.includes("almaq"));

    if (onlyOrder && !store.state.lastTopic) {
      addMsg("bot", PRODUCT_LIST_TEXT);
      store.hasSpoken = true;
      saveState(store);
      isSending = false;
      return;
    }

    const hint = topic
      ? `\n\nQAYDA: YALNIZ "${KB[topic]?.name || topic}" haqqında yumşaq, normal, satış yönümlü və qısa cavab ver. Başqa məhsulları qarışdırma. Emojili və mehriban ton istifadə et. Müştərini sıxmadan sifarişə yönləndir.\nMƏLUMAT:\n${replyFromKB(topic, "")}`
      : `\n\nQAYDA: Cavabları yumşaq, normal, qısa, emojili və satış yönümlü ver. Müştəri ilə nəzakətli danış. Uyğun olduqda məhsul tövsiyə et və sifarişə yumşaq keçid et.`;

    await callAI(raw + hint);
    isSending = false;
  }
})();