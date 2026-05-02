/* =========================================================
   app.js — Mirpanel (TAM FINAL: BÜTÜN YENİ QAYDALAR + AĞILLI FORMLAR)
   ========================================================= */

const PHONE_WA = "https://wa.me/994515243545";

/* =========================
   UI MƏTNLƏRİ (YALNIZ AZ)
   ========================= */
const UI = {
  brandSub: "Premium Hesablar • Etibarlı Aktivləşmə",
  bannerText: "Diqqət! Saytımızda ödəniş sistemi yoxdur. Sifariş etdiyiniz zaman sayt sizi avtomatik WhatsApp-a yönləndirir.",
  heroTitle: "Premium Hesablar — Sürətli və Etibarlı",
  heroHint: "Netflix, ChatGPT Plus, Google AI, CapCut Pro və daha çox. Plan seç → məlumatları yaz → WhatsApp avtomatik açılır.",
  footRights: "©️ 2026 Mirpanel • Bütün hüquqlar qorunur",
  modalClose: "Bağla ✕",
  modalPlan: "Plan seçin",
  modalWait: "Sifariş etdikdə WhatsApp avtomatik açılacaq.",
  chatTitle: "Mirpanel AI",
  chatSub: "Məhsullar haqqında sual verin",
  chatBtn: "Göndər",
  search: "Məhsul axtar... (məs: Netflix, Zoom)",
  month: "aylıq",
  orderBtn: "Sifariş et",
  noPlan: "Plan yoxdur (WhatsApp-da dəqiqləşdirilir).",
  formTitle: "Məlumatları daxil et",
  stokOut: "Stokta yoxdur",
  nameLabel: "Ad",
  codeLabel: "rəqəmli kod",
  emailLabel: "Gmail ünvanı",
  passLabel: "Şifrə",
  sendWa: "WhatsApp-a göndər",
  ttCoin: "Jeton sayı",
  ttPrice: "Qiymət",
  ttUser: "TikTok istifadəçi adı",
  ttRule: "Minimum 500 jeton. 500 jeton = 10 ₼",
  minCoin: "Minimum",
  spNote: "Şəxsi hesabınızda aktiv edirik.",
  reqName: "Zəhmət olmasa, adınızı yazın.",
  reqCode: "Zəhmət olmasa, kodu düzgün yazın.",
  reqEmail: "Zəhmət olmasa, e-poçt ünvanını düzgün yazın.",
  reqPass: "Zəhmət olmasa, şifrəni və ya istifadəçi adını qeyd edin.",
  reqCoin: "Minimum 500 jeton daxil et.",
  namePlace: "Məs: Mələk",
  codePlace: " rəqəmli kod", 
  emailPlace: "məs: misal@gmail.com",
  passPlace: "Şifrəni yazın...",
  ttUserPlace: "@istifadeci_adi",
  bundleBtn: "Paket Yarat", 
  bmTitle: "XÜSUSİ PAKET (ENDİRİMLİ)", 
  bmSub: "İstədiyiniz məhsulları seçin və 5% paket endirimi qazanın! Bütün paketlər 1 aylıq hesablanır.", 
  bmTotal: "Ümumi Qiymət:", 
  bmDisc: "Paket Endirimi (5%):",
  bmFinal: "Yekun Qiymət:",
  bmName: "Ad",
  bmEmail: "Gmail",
  bmNxCode: "Netflix Kodu (4 rəqəm)",
  bmPrCode: "Prime Kodu (5 rəqəm)",
  bmSpPass: "Spotify Şifrəsi",
  bmTtUser: "TikTok İstifadəçi adı",
  bmTtPass: "TikTok Şifrəsi",
  bmSend: "WhatsApp-a göndər",
  bmClose: "Bağla ✕",
  available: "Mövcuddur",
  deliveryFast: "7/24, dərhal təqdim olunur ✅⚡",
  similarProds: "Oxşar Məhsullar",
  tabAbout: "Məhsul Haqqında",
  tabRules: "İstifadə Qaydaları",
  searchTitle: "AXTARIŞ ET, <span class='highlight'>İSTƏDİYİNİ TAP!</span>",
  searchDesc: "Bütün məlumatlar saytda mövcuddur. Axtarış bölməsindən istədiyiniz məhsulu rahatlıqla tapa bilərsiniz.",
  buyNow: "İndi al",
  addCart: "🛒 Səbətə At",
  gameMainBtn: "Əylən & Oyna",
  gameSelTitle: "ARCADE OYUNLARI",
  gameSelSub: "Asudə vaxtını əyləncəli keçir. Öz rekordunu qır!",
  game1Title: "Flappy Kosmos",
  game1Desc: "15 xalı keç, yuxarı-aşağı hərəkət edən borulara diqqət et!",
  game2Title: "Tort Qülləsi",
  game2Desc: "İpdən sallanan tort təbəqələrini tam üst-üstə diz!",
  gameStart: "Oyuna Başla",
  gameRetry: "Yenidən Oyna",
  gameBack: "Geri Qayıt",
  gameWin: "ƏLA NƏTİCƏ 🎉",
  gameLose: "OYUN BİTDİ 💥",
  flappyRule: "Maneələrə dəymədən ekrana basaraq quşu uçurun. Maksimum rekordunuzu qırın!",
  tapperRule: "Yuxarıdan sallanan tortları tam üst-üstə düzün. İpi kəsmək üçün toxunun. Rekord qırın!",
  gameWinTxt: "Sənin topladığın xal: {score}. Əla nəticədir!",
  gameLoseTxt: "Sənin topladığın xal: {score}. Növbəti dəfə daha yaxşı olar!"
};

/* =========================
   MƏHSUL BAZASI (DATA)
   ========================= */
const DATA = {
  brand: "Mirpanel",
  categories: [
    { key: "all", name: "Hamısı" },
    { key: "film", name: "Film" },
    { key: "musiqi", name: "Musiqi" },
    { key: "dizayn", name: "Dizayn" },
    { key: "video", name: "Video Edit" },
    { key: "ai", name: "Süni intellekt" },
    { key: "dil", name: "Xarici Dil" },
    { key: "meeting", name: "Görüş" },
  ],
  products: [
    {
      id: "capcut", category: "video", image: "assets/capcut.png", currency: "₼",
      title: "CapCut Pro", variant: "Pro", badge: "Video",
      desc: "Premium effektlər, export, template-lər.",
      note: "Hesab hazır verilir. Sifarişi təsdiqləyin.",
      plans: [{ months: 1, price: 4.99 }, { months: 3, price: 12.99 }, { months: 6, price: 23.99 }],
    },
    {
      id: "netflix", category: "film", image: "assets/netflix.png", currency: "₼",
      title: "Netflix Şəxsi", variant: "Premium", badge: "Film",
      desc: "Filmlər, seriallar, yüksək keyfiyyət.",
      note: "Netflix Şəxsi otaq: Plan seç → Ad və 4 rəqəmli kod yaz.",
      plans: [{ months: 1, price: 5.99 }, { months: 3, price: 16.49 }, { months: 6, price: 29.99 }],
    },
    {
      id: "netflix_umumi", category: "film", image: "assets/netflix.png", currency: "₼",
      title: "Netflix Ümumi", variant: "Premium", badge: "Film",
      desc: "Ümumi hesab (paylaşılan).",
      note: "Hazır hesab verilir. Sifarişi təsdiqləyin.",
      plans: [{ months: 1, price: 3.99 }],
    },
    {
      id: "zoom", category: "meeting", image: "assets/zoom.png", currency: "₼",
      title: "Zoom Pro", variant: "Pro", badge: "Görüş",
      desc: "Peşəkar onlayn görüşlər.",
      note: "Hesab aktiv və hazır şəkildə təqdim olunur.",
      plans: [{ months: 1, price: 9.99 }],
    },
    {
      id: "youtube", category: "musiqi", image: "assets/youtube.png", currency: "₼",
      title: "YouTube Premium", variant: "Gmail", badge: "Video",
      desc: "Reklamsız izləmə, YouTube Music daxil.",
      note: "Aktivləşmə üçün Gmailinizi qeyd edin.",
      plans: [{ months: 1, price: 3.49 }],
    },
    {
      id: "spotify", category: "musiqi", image: "assets/spotify.png", currency: "₼",
      title: "Spotify Premium", variant: "Şəxsi hesab", badge: "Musiqi",
      desc: "Reklamsız musiqi, offline.",
      note: "Gmailinizi və Spotify şifrənizi qeyd edin.",
      plans: [{ months: 1, price: 0 }],
    },
    {
      id: "surfshark", category: "video", image: "assets/surfshark.png", currency: "₼",
      title: "Surfshark VPN", variant: "VPN", badge: "VPN",
      desc: "IP gizlətmə, güclü şifrələmə.",
      note: "Hesab hazır şəkildə verilir.",
      plans: [{ months: 1, price: 0 }],
    },
    {
      id: "tiktok_jeton", category: "video", image: "assets/tiktok.png", currency: "₼",
      title: "TikTok Jeton", variant: "500+", badge: "TikTok",
      desc: "Minimum 500 jeton.",
      note: "500 jeton = 10 ₼. İstifadəçi adı və şifrə qeyd olunur.",
      plans: [{ months: 1, price: 10.00, label: "Jeton sayını daxil et" }],
    },
    {
      id: "google_ai", category: "ai", image: "assets/google-ai.png", currency: "₼",
      title: "Google AI Pro + VEO 3", variant: "Pro", badge: "AI",
      desc: "Ağıllı mətn, analiz və məhsuldarlıq.",
      note: "Aktivləşmə sizin Gmail hesabınız üzərindən edilir.",
      plans: [{ months: 4, price: 15.99 }],
    },
    {
      id: "google_ai_ultra", category: "ai", image: "assets/google-ai-ultra.png", currency: "₼",
      title: "Google AI Ultra + VEO 3", variant: "Ultra", badge: "AI",
      desc: "Peşəkar istifadə üçün ən yüksək AI.",
      note: "Stokta yoxdur.",
      plans: [{ months: 1, price: 0, label: "Stokta yoxdur" }],
    },
    {
      id: "captions", category: "ai", image: "assets/captions.png", currency: "₼",
      title: "Captions AI", variant: "Şəxsi", badge: "AI",
      desc: "Videolar üçün avtomatik caption.",
      note: "Hesab biz tərəfdən hazır verilir.",
      plans: [{ months: 1, price: 11.99, label: "1 aylıq PRO" }, { months: 1, price: 0 , label: "stokta yoxdur" }],
    },
    {
      id: "grok_supergrok", category: "ai", image: "assets/grok.png", currency: "₼",
      title: "Grok AI", variant: "SuperGrok", badge: "AI",
      desc: "Güclü model + şəkil/fayl analizi.",
      note: "Hesab hazır şəkildə təqdim olunur.",
      plans: [{ months: 1, price: 17.99 }],
    },
    {
      id: "claude_ai", category: "ai", image: "assets/claude.png", currency: "₼",
      title: "Claude AI", variant: "1 illik", badge: "AI",
      desc: "Mətn, kod, yazı üçün güclü AI.",
      note: "Stokta yoxdur.",
      plans: [{ months: 12, price: 0, label: "Stokta yoxdur" }],
    },
    {
      id: "prime", category: "film", image: "assets/prime.png", currency: "₼",
      title: "Amazon Prime Video", variant: "Premium", badge: "Film",
      desc: "Prime Video filmlər və seriallar.",
      note: "Plan seç → Ad və 5 rəqəmli kod yaz.",
      plans: [{ months: 1, price: 3.99 }, { months: 6, price: 17.99 }],
    },
    {
      id: "duolingo", category: "dil", image: "assets/duolingo.png", currency: "₼",
      title: "Duolingo Super", variant: "Super", badge: "Dil",
      desc: "Xarici dil öyrənmək üçün premium imkanlar.",
      note: "Hazır hesab kimi təqdim edilir.",
      plans: [{ months: 1, price: 3.99 }],
    },
    {
      id: "canva", category: "dizayn", image: "assets/canva.png", currency: "₼",
      title: "Canva Premium", variant: "Pro", badge: "Dizayn",
      desc: "Premium template, elementlər.",
      note: "Aktivləşmə üçün Gmail qeyd edin.",
      plans: [{ months: 1, price: 1.49 }, { months: 12, price: 2.99 }],
    },
    {
      id: "chatgpt", category: "ai", image: "assets/chatgpt.png", currency: "₼",
      title: "ChatGPT Plus", variant: "Plus", badge: "AI",
      desc: "Daha güclü model, fayl/şəkil imkanları.",
      note: "Hesabınızın Email və Şifrəsini qeyd edin.",
      plans: [{ months: 1, price: 0, label: "stokta yoxdur" }],
    },
    {
      id: "adobecc", category: "dizayn", image: "assets/adobe.png", currency: "₼",
      title: "Adobe Creative Cloud", variant: "Premium", badge: "Dizayn",
      desc: "Photoshop, Illustrator və digərləri.",
      note: "Hesab hazır şəkildə təqdim edilir.",
      plans: [{ months: 1, price: 9.99 }, { months: 4, price: 22.99 }],
    }
  ]
};

/* =========================
   MƏHSUL HAQQINDA BÖLMƏSİ (INFO_TEXTS)
   ========================= */
const INFO_TEXTS = {
  capcut: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">CapCut PRO - Peşəkar Video Montaj və AI Əsaslı Premium Redaktə Həlli</h3>
      <p>CapCut PRO hesabı, qısa və uzun formatlı videoların daha sürətli, keyfiyyətli və limitsiz şəkildə hazırlanması üçün nəzərdə tutulmuş premium video montaj proqramıdır. Xüsusilə TikTok, Instagram Reels, YouTube Shorts və digər sosial media platformaları üçün kontent istehsal edən content creator-lar, SMM mütəxəssisləri və peşəkar video editorlar üçün ideal seçimdir.</p>
      <p>CapCut premium abunə istifadəçiyə watermark olmadan video eksport, AI əsaslı redaktə funksiyaları və geniş PRO effekt kitabxanasına çıxış imkanı yaradır. Əgər standart versiyanın limitləri sizi məhdudlaşdırırsa, CapCut PRO aktivləşdirmə ilə daha sərbəst və professional video editing təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Videoları su nişanı (watermark) olmadan eksport etmə</li>
        <li>Premium effektlər, filtrlər və keçidlərə tam çıxış</li>
        <li>PRO şablonlar və hazır dizayn paketləri</li>
        <li>Yüksək keyfiyyətli HD, 2K və 4K video export imkanları</li>
        <li>AI powered video editor funksiyaları</li>
        <li>Avtomatik altyazı (auto caption) və fon silmə (background remove)</li>
        <li>Orta hesabla 1200-2000 AI kredit imkanı (rəsmi platformadakı standart limitlərdən daha geniş istifadə rahatlığı)</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>TikTok və Instagram kontent istehsalçıları</li>
        <li>YouTube Shorts kanalları</li>
        <li>Reklam və SMM agentlikləri</li>
        <li>Dropshipping və e-commerce video marketinq komandaları</li>
        <li>AI əsaslı avtomatlaşdırılmış video layihələri quranlar</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  zoom: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Zoom Pro - Peşəkar Video Konfrans və Onlayn Görüş Həlli</h3>
      <p>Zoom Pro hesabı, onlayn görüşlərin, vebinarların və distant dərslərin kəsintisiz, yüksək keyfiyyətli və limitsiz şəkildə həyata keçirilməsi üçün nəzərdə tutulmuş premium video konfrans platformasıdır. Xüsusilə onlayn təhsil verən müəllimlər, korporativ şirkətlər, distant işləyən komandalar və fərdi konsultasiya verən mütəxəssislər üçün ideal seçimdir.</p>
      <p>Zoom premium abunə istifadəçiyə 40 dəqiqəlik zaman limitini aradan qaldırmağa, 100-ə qədər iştirakçı ilə uzunmüddətli görüşlər keçirməyə və bulud (cloud) yaddaşında qeydlər aparmağa imkan yaradır. Əgər standart versiyanın kəsintiləri və limitləri sizi məhdudlaşdırırsa, Zoom Pro aktivləşdirmə ilə daha sərbəst və professional onlayn ünsiyyət təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>40 dəqiqəlik zaman limitinin aradan qaldırılması (30 saata qədər kəsintisiz görüş)</li>
        <li>Hər bir görüş üçün 100 nəfərə qədər iştirakçı qəbulu</li>
        <li>Görüşlərin birbaşa bulud (Cloud) yaddaşına yazılması və asan paylaşımı (5 GB yaddaş)</li>
        <li>Sosial media platformalarında (YouTube, Facebook) birbaşa canlı yayım inteqrasiyası</li>
        <li>İştirakçıların geniş idarə edilməsi (Co-host təyini, mikrofon/video nəzarəti)</li>
        <li>Qrup otaqları (Breakout rooms), virtual lövhə (Whiteboard) və ekran paylaşımı</li>
        <li>Görüş hesabatları və iştirakçıların qeydiyyat statistikası</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Onlayn dərs keçən müəllimlər və repetitorlar</li>
        <li>Distant (məsafədən) işləyən komandalar və layihə rəhbərləri</li>
        <li>Vebinar, seminar və təlimlər təşkil edən mütəxəssislər</li>
        <li>Korporativ şirkətlər, İK (HR) menecerləri və idarəçilər</li>
        <li>Onlayn konsultasiya verən psixoloqlar, hüquqşünaslar və frilanserlər</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  netflix: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Netflix Premium (Şəxsi Otaq) - 4K Ultra HD Kino Təcrübəsi</h3>
      <p>Netflix Premium hesabı, dünyanın ən populyar film və seriallarını ən yüksək keyfiyyətdə, reklamsız izləmək üçün rəqəmsal yayım platformasıdır.</p>
      <p>Sizə təqdim edilən "Şəxsi Otaq" paketi vasitəsilə ümumi Premium hesab daxilində <b>yalnız sizə aid olan, PIN kodla qorunan xüsusi profilə</b> sahib olursunuz. Bu paket büdcənizə qənaət edərək yüksək keyfiyyətli məzmundan fərdi şəkildə zövq almaq üçün ən ideal seçimdir.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Məzmunu tamamilə reklamsız və kəsintisiz izləmə imkanı</li>
        <li>Ən yüksək 4K Ultra HD, HDR və Spatial Audio səs keyfiyyəti</li>
        <li>Yalnız sizə aid olan, <b>PIN kod ilə qorunan fərdi otaq (profil)</b></li>
        <li>İstənilən cihazda (Smart TV, telefon, PC), lakin eyni anda <b>yalnız 1 ekranda</b> istifadə imkanı</li>
        <li>Ən yeni qlobal trendlərə, eksklüziv Netflix Original layihələrinə limitsiz çıxış</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Büdcəsinə qənaət edərək fərdi Premium xidmətlərdən yararlanmaq istəyənlər</li>
        <li>Böyük ekranlarda (Smart TV) və ya noutbukda 4K keyfiyyət axtaranlar</li>
        <li>Öz izləmə tarixçəsini, siyahısını və alqoritmini başqalarından gizli saxlamaq istəyənlər</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  netflix_umumi: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Netflix Premium (Ümumi Otaq) - Ən Yüksək Keyfiyyət, Sərfəli Qiymət</h3>
      <p>Netflix Ümumi Otaq hesabı, Netflix-in zəngin film və serial bazasına ən münasib qiymətlə çıxış əldə etmək istəyənlər üçün nəzərdə tutulub. Siz hesabda digər müştərilərlə birgə olursunuz, lakin bütün premium xüsusiyyətlərdən (4K, UHD) tam faydalanırsınız.</p>
      <p>Bu paket büdcəsinə qənaət edərək, sadəcə bir cihazdan film və seriallardan həzz almaq istəyən şəxslər üçün ən ideal və sürətli həlldir.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Otaqda sizinlə birlikdə başqa müştərilər də olur</li>
        <li>Otağın adı və şifrəsini dəyişmək qəti qadağandır</li>
        <li>Yalnız 1 cihazda (eyni anda) istifadə etmək mümkündür</li>
        <li>Məzmunu tamamilə reklamsız və kəsintisiz izləmə imkanı</li>
        <li>4K Ultra HD və HDR keyfiyyətində izləmə imkanı</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
      </ul>
    `
  },
  youtube: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">YouTube Premium - Reklamsız İzləmə və Arxa Fonda Limitsiz Musiqi Təcrübəsi</h3>
      <p>YouTube Premium hesabı, dünyanın ən böyük video platformasındakı məzmunları və milyonlarla musiqini reklamsız, kəsintisiz və arxa fonda izləmək/dinləmək üçün nəzərdə tutulmuş rəqəmsal abunəlik xidmətidir. Xüsusilə aktiv musiqi dinləyiciləri, podkast həvəskarları, tələbələr və daim hərəkətdə olan istifadəçilər üçün ideal seçimdir.</p>
      <p>YouTube premium abunə istifadəçiyə videoları reklamsız izləmə, YouTube Music platformasına tam çıxış və məzmunları oflayn rejimdə (internetsiz) izləmək üçün cihazlara yükləmə imkanı yaradır. Əgər standart versiyanın sıxıcı reklamları və arxa fonda oxutma məhdudiyyətləri sizi məhdudlaşdırırsa, YouTube Premium aktivləşdirmə ilə daha sərbəst və professional əyləncə təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Bütün video və musiqi məzmunlarını tamamilə reklamsız (ad-free) izləmə</li>
        <li>Videoları və musiqiləri mobil cihazlarda arxa fonda (ekran bağlı ikən və ya digər tətbiqlərdə olanda) oxutma</li>
        <li>İnternet olmayan yerlərdə izləmək üçün cihazın yaddaşına oflayn yükləmə (download) imkanı</li>
        <li>YouTube Music Premium xidmətinə limitsiz və pulsuz giriş</li>
        <li>Orijinal məzmunlara (YouTube Originals) və daha yüksək 1080p Premium video keyfiyyətinə çıxış</li>
        <li>Eyni hesab üzərindən fərqli cihazlarda (Smart TV, PC, mobil, planşet) kəsintisiz sinxronizasiya</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Videonun ən maraqlı yerində çıxan sıxıcı reklamlardan qurtulmaq istəyən aktiv YouTube izləyiciləri</li>
        <li>Mahnıları, müsahibələri və podkastları arxa fonda (ekran sönülü) dinləmək istəyənlər</li>
        <li>Oflayn (internetsiz) izləmək üçün videoları yükləməyə ehtiyacı olan səyahətçilər</li>
        <li>Digər musiqi platformalarına əlavə ödəniş etmədən YouTube Music istifadə etmək istəyən musiqisevərlər</li>
        <li>Dərs, iş və ya istirahət zamanı kəsintisiz konsentrasiya axtaranlar</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  spotify: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Spotify Premium - Reklamsız, Kəsintisiz və Yüksək Keyfiyyətli Musiqi Təcrübəsi</h3>
      <p>Spotify Premium hesabı, dünyanın ən böyük musiqi və podkast arxivinə ən yüksək səs keyfiyyətində, reklamsız və kəsintisiz çıxış əldə etmək üçün nəzərdə tutulmuş rəqəmsal yayım platformasıdır. Xüsusilə musiqisevərlər, podkast dinləyiciləri, idmançılar və daim hərəkətdə olan istifadəçilər üçün ideal seçimdir.</p>
      <p>Spotify premium abunə istifadəçiyə musiqiləri reklamsız dinləmə, istənilən mahnını sərbəst seçmə və məzmunu oflayn rejimdə (internetsiz) dinləmək üçün cihazlara yükləmə imkanı yaradır. Əgər standart versiyanın sıxıcı reklamları və mahnı atlama (skip) limitləri sizi məhdudlaşdırırsa, Spotify Premium aktivləşdirmə ilə daha sərbəst və professional səs təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Bütün musiqi və podkastları tamamilə reklamsız (ad-free) dinləmə</li>
        <li>İstənilən mahnını sərbəst seçmə və limitsiz atlama (skip) imkanı</li>
        <li>İnternet olmayan yerlərdə dinləmək üçün oflayn yükləmə (download) funksiyası</li>
        <li>Daha yüksək səs keyfiyyəti (320 kbps-ə qədər)</li>
        <li>Fərdiləşdirilmiş çalğı siyahıları (playlist) və ağıllı musiqi kəşfi (Discover Weekly, Release Radar)</li>
        <li>Çoxlu cihaz dəstəyi (mobil, noutbuk, Smart TV, avtomobil, ağıllı saatlar və s.)</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Musiqini reklam fasiləsi olmadan, kəsintisiz dinləmək istəyənlər</li>
        <li>İnternet bağlantısı olmadan oflayn rejimdə mahnı dinləməyə ehtiyacı olanlar</li>
        <li>Yüksək səs keyfiyyətinə önəm verən audiofillər</li>
        <li>Günlük rutinlərində (idman, iş, dərs) motivasiya və fokus axtaranlar</li>
        <li>Dünyaca məşhur podkastları və eksklüziv audio məzmunları izləyənlər</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  surfshark: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Surfshark VPN - Təhlükəsiz İnternet, Gizlilik və Limitsiz Çıxış Həlli</h3>
      <p>Surfshark VPN hesabı, internetdə tam anonim, təhlükəsiz və məhdudiyyətsiz şəkildə gəzinmək üçün nəzərdə tutulmuş premium virtual özəl şəbəkə xidmətidir. Xüsusilə şəxsi məlumatlarının təhlükəsizliyinə önəm verən istifadəçilər, səyahətçilər, frilanserlər və bloklanmış saytlara/məzmunlara giriş əldə etmək istəyənlər üçün ideal seçimdir.</p>
      <p>Surfshark premium abunə istifadəçiyə limitsiz sayda cihazda eyni anda bağlantı, yüksək sürətli serverlər və qlobal streaming məzmuna (Netflix, Hulu və s.) coğrafi məhdudiyyətsiz çıxış imkanı yaradır. Əgər internet provayderlərinin izləməsi və ya regional bloklamalar sizi məhdudlaşdırırsa, Surfshark VPN aktivləşdirmə ilə daha sərbəst və professional onlayn təhlükəsizlik təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Bir hesab ilə limitsiz sayda cihazda (mobil, PC, Smart TV, router) eyni anda aktiv istifadə</li>
        <li>100-dən çox ölkədə 3200-dən artıq yüksək sürətli serverə çıxış</li>
        <li>Ciddi qeydiyyatsızlıq (No-Logs) siyasəti və hərbi səviyyəli (AES-256) şifrələmə</li>
        <li>Zərərli proqramları, reklamları və izləyiciləri bloklayan CleanWeb funksiyası</li>
        <li>Coğrafi məhdudiyyətləri aşaraq qlobal məzmunlara və oyun serverlərinə asan çıxış</li>
        <li>İnternet bağlantısı kəsildikdə məlumat sızmasının qarşısını alan Kill Switch xüsusiyyəti</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Şəxsi məlumatlarını, axtarış tarixçəsini və onlayn fəaliyyətini gizli saxlamaq istəyən istifadəçilər</li>
        <li>Coğrafi olaraq bloklanmış saytlara və streaming tətbiqlərinə giriş axtaranlar</li>
        <li>İctimai Wi-Fi şəbəkələrindən mütəmadi istifadə edən səyahətçilər və rəqəmsal köçərilər (digital nomads)</li>
        <li>Onlayn oyunlarda (gaming) ping-i azaltmaq və kiber hücumlardan qorunmaq istəyən geymerlər</li>
        <li>Bütün ailə cihazlarını sadəcə bir abunəliklə təhlükəsizliyə almaq istəyənlər</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  tiktok_jeton: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">TikTok Jeton - Sürətli Yükləmə və Rəsmi Təqdimat</h3>
      <p>TikTok Jeton, canlı yayımlarda dəstək olmaq və istədiyiniz məzmun yaradıcılarına hədiyyə göndərmək üçün istifadə olunan rəsmi virtual valyutadır.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Minimum sifariş miqdarı: 500 jeton</li>
        <li>Sürətli və etibarlı yükləmə</li>
        <li>Qiymət: 500 jeton = 10 ₼</li>
        <li>Yükləmə prosesi üçün istifadəçi adı və şifrə tələb olunur</li>
      </ul>
    `
  },
  google_ai: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Google AI Pro + VEO 3 (Gemini) - Peşəkar Süni İntellekt və Video Yaradıcılığı Həlli</h3>
      <p>Google AI Pro + VEO 3 (Gemini) hesabı, mürəkkəb mətn tapşırıqlarının, qabaqcıl kodlaşdırmanın və yüksək keyfiyyətli səsli videoların süni intellekt vasitəsilə daha sürətli, dəqiq və professional şəkildə hazırlanması üçün nəzərdə tutulmuş premium platformadır. Xüsusilə məzmun yaradıcıları (content creators), rəqəmsal marketoloqlar, proqramçılar və vizual layihələr üzərində işləyən mütəxəssislər üçün ideal seçimdir.</p>
      <p>Bu premium abunə istifadəçiyə Google-un ən inkişaf etmiş Gemini AI modelinə çıxışla yanaşı, VEO texnologiyası vasitəsilə mətn əsasında (text-to-video) yüksək dəqiqlikli, orijinal səsli videolar yaratmaq imkanı yaradır. Əgər standart AI versiyalarının limitləri və ya ənənəvi video çəkilişlərinin çətinlikləri sizi məhdudlaşdırırsa, bu paketlə daha sərbəst və professional yaradıcılıq təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Qabaqcıl Gemini süni intellekt modeli ilə mürəkkəb tapşırıqların, kodların və mətnlərin dərin analizi</li>
        <li>VEO texnologiyası ilə mətndən yüksək keyfiyyətli (high-fidelity) videoların generasiyası</li>
        <li>Yaradılan videolara avtomatik uyğunlaşan təbii səs və audio detalların əlavə edilməsi</li>
        <li>Mətn, şəkil, səs və video daxil olmaqla tam multimodal (çoxfunksiyalı) işləmə qabiliyyəti</li>
        <li>Mövcud videoların genişləndirilməsi və referans şəkillər əsasında yeni kadrların yaradılması</li>
        <li>İstənilən ilk və son kadrlar arasında axıcı video keçidlərinin generasiyası</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Qeyri-adi və innovativ vizual məzmunlar hazırlayan kontent istehsalçıları</li>
        <li>Mətndən səsli video yaradaraq kampaniyalar edən SMM və reklam agentlikləri</li>
        <li>Mürəkkəb kod yazan, mətn analizləri edən proqramçılar və tədqiqatçılar</li>
        <li>Ssenariləri və ideyaları anında vizuallaşdırmaq istəyən ssenaristlər və rejissorlar</li>
        <li>Gündəlik işlərini və məzmun yaradıcılığını süni intellektlə tam avtomatlaşdıran mütəxəssislər</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  google_ai_ultra: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Google AI Ultra + VEO 3 (Gemini) - Ən Üst Səviyyə Süni İntellekt və Multimodal Yaradıcılıq Həlli</h3>
      <p>Google AI Ultra + VEO 3 (Gemini) hesabı, ən mürəkkəb mətn, dərin kodlaşdırma, irihəcmli data analizi və yüksək keyfiyyətli səsli video generasiyası tapşırıqlarını maksimum peşəkarlıqla həyata keçirmək üçün nəzərdə tutulmuş ən güclü (Ultra səviyyə) premium platformadır. Xüsusilə peşəkar məzmun yaradıcıları, kinorejissorlar, senior proqramçılar, rəqəmsal marketinq agentlikləri və multimodal layihələr üzərində işləyən mütəxəssislər üçün ideal seçimdir.</p>
      <p>Bu premium abunə istifadəçiyə Google-un ən qabaqcıl "Ultra" AI modelinə çıxışla yanaşı, VEO texnologiyası vasitəsilə mətn əsasında (text-to-video) yüksək dəqiqlikli, orijinal səsli videolar yaratmaq imkanı yaradır. Eyni zamanda Nano Banana 2 və Lyria 3 modelləri ilə vizual və audio dünyasının qapılarını açır. Əgər standart Pro versiyalarının limitləri sizi məhdudlaşdırırsa, bu paketlə sərhədsiz və ən üst səviyyə professional yaradıcılıq təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Google-un ən güclü və mürəkkəb süni intellekt modelinə (Gemini Ultra) eksklüziv çıxış</li>
        <li>VEO texnologiyası ilə mətndən yüksək keyfiyyətli (high-fidelity) və orijinal səsli (natively generated audio) videoların generasiyası</li>
        <li>Ultra abunəçilərinə özəl olaraq gündəlik 5 VEO video generasiyası kvotası, mövcud videoların genişləndirilməsi və ilk/son kadrlar arası axıcı keçidlər</li>
        <li>Nano Banana 2 (Gemini 3 Flash Image) texnologiyası ilə gündəlik 1000-ə qədər unikal şəkil generasiyası, redaktəsi və Nano Banana Pro versiyasına çıxış</li>
        <li>Lyria 3 texnologiyası ilə 30 saniyəlik peşəkar səs, musiqi və avtomatlaşdırılmış vokal/söz (text-to-music) generasiyası</li>
        <li>Mətn, şəkil, səs və video daxil olmaqla tam və ən sürətli multimodal (çoxfunksiyalı) işləmə qabiliyyəti</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Peşəkar kino, reklam və klip sahəsində çalışan rejissor və prodüserlər</li>
        <li>Mürəkkəb kodlaşdırma və nəhəng məlumat bazaları ilə işləyən senior mühəndislər və data analitikləri</li>
        <li>Yüksək keyfiyyətli, səsli video və musiqi kampaniyaları hazırlayan qlobal SMM və rəqəmsal agentliklər</li>
        <li>Həm mətn, həm şəkil (gündəlik 1000 limitlə), həm də video yaradıcılığını bir platformada birləşdirən ekspertlər</li>
        <li>Gündəlik işlərini ən üst səviyyə (Ultra) süni intellektlə tam avtomatlaşdıran rəhbər şəxslər</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  captions: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Captions AI Pro & Max - Süni İntellekt Əsaslı Peşəkar Altyazı və Video Redaktə Həlli</h3>
      <p>Captions AI Pro və Max hesabları, videolarınız üçün avtomatik, dinamik altyazılar yaratmaq, səsi fərqli dillərə tərcümə etmək və süni intellektlə vizual redaktələr etmək üçün nəzərdə tutulmuş premium video montaj platformasıdır. Xüsusilə TikTok, Instagram Reels, YouTube Shorts və podkastlar üçün kontent istehsal edən content creator-lar, SMM mütəxəssisləri və beynəlxalq auditoriyaya çıxış etmək istəyənlər üçün ideal seçimdir.</p>
      <p>Captions premium abunə istifadəçiyə dəqiqliklə işləyən dinamik altyazılar (trend üslublarda), "göz təması" (eye-contact) süni intellekti və videoları dodaq sinxronizasiyası ilə (lip-sync) onlarla dilə tərcümə etmək imkanı yaradır. Əgər videolarınızı qlobal trendlərə uyğunlaşdırmaq və vaxt aparan redaktə prosesləri sizi məhdudlaşdırırsa, Captions AI Pro və ya Max aktivləşdirmə ilə daha sərbəst və professional kontent istehsalı təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Avtomatik, yüksək dəqiqlikli və trend dizaynlı (dinamik animasiyalı) altyazıların yaradılması</li>
        <li>Videoların onlarla fərqli dilə təbii səs və dodaq sinxronizasiyası (AI Dubbing & Lip-sync) ilə tərcüməsi</li>
        <li>Süni intellekt vasitəsilə göz təmasının (Eye Contact) avtomatik kameraya yönəldilməsi</li>
        <li>Səs-küyün silinməsi (AI Audio Denoise) və studiya keyfiyyətində səsin optimallaşdırılması</li>
        <li>Avtomatik ssenari (script) yazılışı və lazımsız pauzaların/sözlərin (AI Trim) avtomatik kəsilməsi</li>
        <li>Max versiyasında daha uzun video eksportu, limitsiz AI alətləri istifadəsi və prioritet render imkanı</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>TikTok, Instagram və YouTube Shorts kontent istehsalçıları (vlogerlər, ekspertlər)</li>
        <li>Videolarını fərqli dillərə dublyaj edərək qlobal auditoriyaya çıxmaq istəyənlər</li>
        <li>Uzun podkastları və müsahibələri qısa, dinamik altyazılı videolara çevirənlər</li>
        <li>Reklam və SMM agentlikləri, rəqəmsal marketoloqlar</li>
        <li>Kamera qarşısında danışarkən ssenariyə baxan və göz təmasını qorumaqda çətinlik çəkən spikerlər</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  grok_supergrok: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Grok AI Super - Real-Time Məlumat və Limitsiz Süni İntellekt Həlli</h3>
      <p>Grok AI Super hesabı, xAI tərəfindən yaradılmış və X (Twitter) platformasının real-time məlumat bazasına birbaşa çıxışı olan premium süni intellekt köməkçisidir. Xüsusilə ən son xəbərləri izləyən tədqiqatçılar, məzmun yaradıcıları, kripto treyderləri və senzurasız məlumat axtarışında olan istifadəçilər üçün ideal seçimdir.</p>
      <p>Grok premium abunə istifadəçiyə qabaqcıl düşünmə, kodlaşdırma və "Fun Mode" (yumoristik/əyləncəli) rejimdə suallara cavab almaq imkanı yaradır. Əgər standart AI modellərinin məhdudiyyətləri, köhnə məlumat bazaları və sərt senzuraları sizi məhdudlaşdırırsa, Grok AI Super aktivləşdirmə ilə daha sərbəst, operativ və limitsiz axtarış təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>X (Twitter) şəbəkəsindəki ən son məlumatlara anında (real-time) çıxış və analiz</li>
        <li>Mürəkkəb kodlaşdırma, riyazi məsələlərin həlli və dərin analitik düşünmə bacarığı</li>
        <li>Senzurasız və daha az məhdudiyyətli, sərbəst dialoq qura bilmə imkanı</li>
        <li>Suallara həm rəsmi, həm də "Fun Mode" (yumoristik və üsyankar) formatında cavab vermə</li>
        <li>Mətn əsasında yüksək keyfiyyətli vizual (şəkil) generasiyası imkanları</li>
        <li>Ən son qlobal trendlər, xəbərlər və maliyyə/kripto bazarı haqqında anında məlumat</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Qlobal xəbərləri və trendləri ilk öyrənmək istəyən kontent yaradıcıları</li>
        <li>Real-time məlumatlarla işləyən kriptovalyuta və birja treyderləri</li>
        <li>Standart AI modellərinin senzura və məhdudiyyətlərindən sıxılan istifadəçilər</li>
        <li>Mürəkkəb proqramlaşdırma və kodlaşdırma tapşırıqları icra edən mühəndislər</li>
        <li>Fərqli, əyləncəli və daha təbii süni intellekt təcrübəsi axtaranlar</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  claude_ai: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Claude AI (Pro) - Dərin Analiz və Peşəkar Mətn Yaradıcılığı Həlli</h3>
      <p>Claude AI hesabı, Anthropic tərəfindən inkişaf etdirilmiş, mürəkkəb mətnlərin yazılması, böyük həcmli məlumatların analizi və təhlükəsiz süni intellekt təcrübəsi üçün nəzərdə tutulmuş premium platformadır. Xüsusilə yazıçılar, tədqiqatçılar, proqramçılar və dəqiq, təbii dildə mətnlərə ehtiyacı olan peşəkarlar üçün ideal seçimdir.</p>
      <p>Claude premium abunə istifadəçiyə ən qabaqcıl modellərə (Claude 3 Opus/Sonnet), daha böyük kontekst pəncərəsinə və sənədlərin eyni vaxtda dərindən analiz edilməsi imkanına çıxış yaradır. Əgər digər AI modellərinin "robotik" dili və qısa yaddaş limitləri sizi məhdudlaşdırırsa, Claude AI aktivləşdirmə ilə daha sərbəst və professional iş təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Ən inkişaf etmiş Claude modellərinə (Opus, Sonnet və s.) prioritet və limitsiz çıxış</li>
        <li>Nəhəng kontekst pəncərəsi (təqribən 150.000 söz və ya 500 səhifəlik kitaba bərabər məlumatı eyni anda anlama qabiliyyəti)</li>
        <li>Çoxsaylı PDF, Word, TXT və CSV sənədlərinin eyni vaxtda yüklənməsi və detallı analizi</li>
        <li>Daha təbii, axıcı və "insanvari" mətn yazma qabiliyyəti (kopyraytinq və hekayə üçün ideal)</li>
        <li>Qabaqcıl kodlaşdırma, sazlama (debugging) və mürəkkəb məntiqi məsələlərin həlli</li>
        <li>Təhlükəsizlik və etik çərçivələrə daha ciddi riayət edən etibarlı AI alqoritmi</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>İrihəcmli məqalələr, ssenarilər və kitablar yazan məzmun yaradıcıları (copywriters, müəlliflər)</li>
        <li>Eyni anda onlarla sənədi və PDF faylını analiz etməyə ehtiyacı olan tədqiqatçılar və tələbələr</li>
        <li>Təbii və axıcı dildə tərcümələr edən və mətnləri redaktə edən mütəxəssislər</li>
        <li>Təmiz kod yazmaq və arxitektura qurmaq istəyən proqram təminatı mühəndisləri</li>
        <li>Daha dəqiq, məntiqi xətası az olan və təhlükəsiz məlumat axtarışında olan rəhbər şəxslər</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  prime: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Amazon Prime Video - Eksklüziv Məzmunlar və Yüksək Keyfiyyətli Kino Təcrübəsi</h3>
      <p>Amazon Prime Video hesabı, minlərlə populyar film, serial və eksklüziv "Amazon Originals" məzmunlarını ən yüksək keyfiyyətdə, reklamsız və kəsintisiz izləmək üçün nəzərdə tutulmuş qlobal rəqəmsal yayım platformasıdır. Xüsusilə fərqli və orijinal layihələrə baxmaq istəyən kinomanlar, ailələr və vizual keyfiyyətə önəm verən istifadəçilər üçün ideal seçimdir.</p>
      <p>Amazon Prime abunə istifadəçiyə 4K Ultra HD və HDR keyfiyyətində baxış, eyni anda fərqli cihazlardan izləmə və məzmunu oflayn rejimdə (internetsiz) izləmək üçün cihazlara yükləmə imkanı yaradır. Əgər standart televiziya məzmunları və ya digər platformaların limitləri sizi məhdudlaşdırırsa, Amazon Prime Video aktivləşdirmə ilə daha sərbəst və professional əyləncə təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Bütün film və serialları tamamilə reklamsız və kəsintisiz izləmə imkanı</li>
        <li>Ən yüksək 4K Ultra HD və HDR görüntü keyfiyyəti</li>
        <li>Eyni anda 3 fərqli cihazda (Smart TV, noutbuk, planşet, smartfon) aktiv istifadə</li>
        <li>İnternet olmayan yerlərdə izləmək üçün oflayn yükləmə (download) imkanı</li>
        <li>Çoxsaylı profillərin, o cümlədən uşaqlar üçün xüsusi və təhlükəsiz Kids profillərinin yaradılması</li>
        <li>"The Boys", "The Lord of the Rings: The Rings of Power" kimi qlobal trendlərə və eksklüziv Amazon Originals layihələrinə limitsiz çıxış</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Dünyanın ən çox izlənən film və eksklüziv seriallarını qaçırmaq istəməyən kinomanlar</li>
        <li>Böyük ekranlarda (Smart TV) ən üstün vizual (4K/HDR) keyfiyyət axtaranlar</li>
        <li>Eyni anda fərqli cihazlarda izləmə edən geniş ailələr və dost qrupları</li>
        <li>Çox səyahət edən və oflayn (internetsiz) məzmun izləməyə ehtiyacı olanlar</li>
        <li>Uşaqları üçün təhlükəsiz və yalnız yaşa uyğun məzmun təqdim edən platforma axtaran valideynlər</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  duolingo: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Duolingo Super - Limitsiz və Effektiv Xarici Dil Öyrənmə Həlli</h3>
      <p>Duolingo Super hesabı, xarici dil öyrənmək prosesini daha sürətli, əyləncəli və limitsiz şəkildə həyata keçirmək üçün nəzərdə tutulmuş premium təhsil platformasıdır. Xüsusilə yeni dil öyrənməyə başlayanlar, tələbələr, səyahətçilər və qısa müddətdə xarici dil bacarıqlarını inkişaf etdirmək istəyən istifadəçilər üçün ideal seçimdir.</p>
      <p>Duolingo premium abunə istifadəçiyə reklamsız dərslər, limitsiz can (hearts) funksiyası və səhvlər üzərində fərdi məşq imkanı yaradır. Əgər standart versiyanın sıxıcı reklamları və səhv etdikdə bitən can limitləri sizi məhdudlaşdırırsa, Duolingo Super aktivləşdirmə ilə daha sərbəst və professional öyrənmə təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Bütün dərsləri və məşqləri tamamilə reklamsız (ad-free) şəkildə icra etmə</li>
        <li>Səhv etməkdən qorxmadan limitsiz can (unlimited hearts) ilə kəsintisiz öyrənmə</li>
        <li>Əvvəlki səhvlərə əsaslanan fərdiləşdirilmiş məşq (Personalized Practice) modulu</li>
        <li>Əlavə xal (gem) xərcləmədən Əfsanəvi (Legendary) səviyyə testlərinə limitsiz giriş</li>
        <li>Tərəqqini izləmək üçün genişləndirilmiş statistika və bacarıq analizi</li>
        <li>İstənilən vaxt və yerdə sərbəst şəkildə müxtəlif dilləri eyni anda öyrənmə imkanı</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sıfırdan yeni xarici dil öyrənməyə başlayan həvəskarlar</li>
        <li>Can (heart) bitməsi və reklam fasilələri olmadan kəsintisiz oxumaq istəyənlər</li>
        <li>Dil biliklərini inkişaf etdirmək və söz ehtiyatını artırmaq istəyən tələbələr</li>
        <li>Xarici ölkələrə səyahət edən və gündəlik ünsiyyət qurmaq istəyən turistlər</li>
        <li>Səhvləri üzərində daha çox işləyərək qrammatikanı mükəmməlləşdirən istifadəçilər</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  canva: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Canva Premium (Pro) - Peşəkar Dizayn və Limitsiz Qrafik Yaradıcılıq Həlli</h3>
      <p>Canva Premium (Pro) hesabı, istənilən növ qrafik dizayn, təqdimat, sosial media postu və video materialların daha sürətli, keyfiyyətli və limitsiz şəkildə hazırlanması üçün nəzərdə tutulmuş qabaqcıl dizayn platformasıdır. Xüsusilə SMM mütəxəssisləri, dizaynerlər, kiçik və orta biznes sahibləri, tələbələr və rəqəmsal marketinqlə məşğul olan şəxslər üçün ideal seçimdir.</p>
      <p>Canva premium abunə istifadəçiyə milyonlarla premium şablon, şəkil və qrafik elementlərə tam çıxış, bir kliklə arxa fon silmə (background remover) və süni intellekt əsaslı redaktə funksiyaları (Magic Studio) imkanı yaradır. Əgər standart versiyanın limitli arxivləri, su nişanlı şəkilləri və təməl alətləri sizi məhdudlaşdırırsa, Canva Pro aktivləşdirmə ilə daha sərbəst və professional dizayn təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>100 milyondan çox premium şəkil, video, audio və qrafik elementə limitsiz çıxış</li>
        <li>Hər cür ehtiyac üçün 610.000-dən artıq peşəkar və hazır dizayn şablonu</li>
        <li>Bir kliklə şəkillərin və videoların arxa fonunu mükəmməl silən (Background Remover) funksiyası</li>
        <li>Dizaynların ölçüsünü müxtəlif platformalara (Instagram, Facebook, TikTok) uyğun anında dəyişən "Magic Switch" aləti</li>
        <li>Mətn və şəkillər yaratmaq, silmək və redaktə etmək üçün süni intellekt dəstəkli (Magic Studio) alətlər</li>
        <li>Brendin rənglərini, şriftlərini və loqolarını yadda saxlamaq üçün "Brand Kit" yaradılması</li>
        <li>Komanda ilə ortaq işləmək üçün genişləndirilmiş 1 TB (1000 GB) bulud (cloud) yaddaşı</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Instagram, Facebook və digər platformalar üçün cəlbedici postlar hazırlayan SMM mütəxəssisləri</li>
        <li>Tez və peşəkar görünüşlü reklam materiallarına, loqolara ehtiyacı olan biznes sahibləri</li>
        <li>Çoxsaylı təqdimatlar, hesabatlar və qrafiklər hazırlayan tələbələr və ofis işçiləri</li>
        <li>İş prosesini sürətləndirmək və hazır arxivlərdən istifadə etmək istəyən qrafik dizaynerlər</li>
        <li>Eyni layihə üzərində eyni anda çalışan dizayn və marketinq komandaları</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  chatgpt: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">ChatGPT Plus - Qabaqcıl Süni İntellekt və Məhsuldarlıq Həlli</h3>
      <p>ChatGPT Plus hesabı, mürəkkəb mətnlərin yazılması, kodlaşdırma proseslərinin, məlumat analizinin və yaradıcı tapşırıqların daha sürətli, dəqiq və effektiv şəkildə həyata keçirilməsi üçün nəzərdə tutulmuş premium süni intellekt platformasıdır. Xüsusilə proqramçılar, məzmun yaradıcıları (copywriters), tədqiqatçılar, rəqəmsal marketoloqlar və biznes sahibləri üçün ideal seçimdir.</p>
      <p>ChatGPT premium abunə istifadəçiyə OpenAI-nin ən qabaqcıl modellərinə (GPT-4 və GPT-4o), yüksək cavabvermə sürətinə, pik saatlarda kəsintisiz girişə və DALL-E 3 ilə şəkil yaratma imkanına çıxış yaradır. Əgər standart pulsuz versiyanın limitləri, yavaş sürəti və ya məhdud funksionallığı sizi məhdudlaşdırırsa, ChatGPT Plus aktivləşdirmə ilə daha sərbəst və professional iş təcrübəsi əldə edə bilərsiniz.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Ən güclü süni intellekt modellərinə (GPT-4, GPT-4o) prioritet və genişləndirilmiş çıxış</li>
        <li>Pik saatlarda belə növbə gözləmədən kəsintisiz və sürətli sistemə giriş</li>
        <li>DALL-E 3 texnologiyası vasitəsilə mətn əsasında yüksək keyfiyyətli şəkillərin generasiyası</li>
        <li>Qabaqcıl məlumat analizi (Advanced Data Analysis) və mürəkkəb qrafiklərin oxunması</li>
        <li>İstənilən sənədlərin (PDF, Word, Excel) və şəkillərin yüklənərək dərindən analizi</li>
        <li>Fərdiləşdirilmiş "Custom GPTs" yaratmaq və digər istifadəçilərin GPT modellərindən istifadə etmək imkanı</li>
        <li>İnternetə birbaşa çıxışla (Web Browsing) ən son və aktual məlumatların axtarışı</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Mürəkkəb proqramlaşdırma dillərində kod yazan və arxitektura quran mühəndislər</li>
        <li>Genişhəcmli məqalələr, SEO mətnlər və ssenarilər hazırlayan məzmun yaradıcıları</li>
        <li>Məlumat təhlili, bazar araşdırması və vizual hesabatlar hazırlayan analitiklər</li>
        <li>Gündəlik ofis işlərini, e-poçt idarəetməsini və tərcümələri avtomatlaşdıran ofis işçiləri və rəhbərlər</li>
        <li>Fərdi GPT köməkçiləri (Custom GPT) yaradaraq öz iş axınını optimallaşdırmaq istəyənlər</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  },
  adobecc: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Adobe Creative Cloud - Bütün Yaradıcı Alətlər və Peşəkar Dizayn Həlli</h3>
      <p>Adobe Creative Cloud (CC) hesabı, qrafik dizayn, video montaj, foto redaktə, veb dizayn və 3D modelləşdirmə layihələrinin daha sürətli, keyfiyyətli və peşəkar şəkildə hazırlanması üçün nəzərdə tutulmuş qabaqcıl proqramlar toplusudur. Xüsusilə qrafik dizaynerlər, video editorlar, fotoqraflar, UX/UI mütəxəssisləri və rəqəmsal incəsənət sahəsində fəaliyyət göstərən peşəkarlar üçün ideal seçimdir.</p>
      <p>Adobe CC premium abunə istifadəçiyə Photoshop, Illustrator, Premiere Pro, After Effects və onlarla digər dünya səviyyəli proqrama tam və qanuni çıxış, bulud yaddaşı və Adobe Fonts kimi əlavə xidmətlər imkanı yaradır. Əgər pirat versiyaların (crack) yaratdığı virus təhlükəsi, donmalar və sistem məhdudiyyətləri sizi məhdudlaşdırırsa, rəsmi Adobe Creative Cloud aktivləşdirmə ilə daha sərbəst, təhlükəsiz və professional iş təcrübəsi əldə edə bilərsiniz.</p>
      <p>Bu paket həm fərdi frilanserlər, həm də komanda səviyyəsində irihəcmli vizual layihələr (production) aparan rəqəmsal agentliklər üçün effektiv və stabil həll təqdim edir.</p>
      <h4 style="color:#00ff99; margin-bottom:5px;">Məhsul haqqında:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Photoshop, Illustrator, InDesign, Premiere Pro, After Effects daxil olmaqla 20+ peşəkar tətbiqə tam çıxış</li>
        <li>Layihələri hər yerdən idarə etmək və saxlamaq üçün 100 GB bulud (cloud) yaddaşı</li>
        <li>Adobe Fonts vasitəsilə minlərlə lisenziyalı və peşəkar şriftlərə limitsiz giriş</li>
        <li>Proqramların ən son yenilənmələrini (updates və yeni funksiyaları) anında və rəsmi şəkildə əldə etmə</li>
        <li>Süni intellektlə (Adobe Firefly) gücləndirilmiş yeni nəsil redaktə alətlərinə (Generative Fill, Generative Expand) çıxış</li>
        <li>Adobe Portfolio, Behance və digər yaradıcı ekosistem tətbiqləri ilə tam və sürətli inteqrasiya</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Kimlər üçün uyğundur?</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Peşəkar qrafik dizaynerlər və illüstratorlar</li>
        <li>Film, reklam və YouTube üçün video montaj edən və animasiya quranlar (Motion dizaynerlər)</li>
        <li>Professional fotoqraflar və şəkilləri retuş edənlər</li>
        <li>Veb və mobil tətbiq interfeysi (UX/UI) hazırlayan rəqəmsal dizaynerlər</li>
        <li>Memarlar, 3D rəssamlar və bütün növ vizual məzmun yaradıcıları</li>
      </ul>
      <h4 style="color:#00ff99; margin-bottom:5px;">Üstünlüklər:</h4>
      <ul style="padding-left:20px; margin-bottom:15px;">
        <li>Sürətli və problemsiz təqdimat</li>
        <li>Aktivləşdirməyə hazır hesab formatı</li>
        <li>Texniki dəstək xidməti</li>
        <li>Təhlükəsiz və stabil istifadə</li>
        <li>Rəqəmsal məhsul üzrə zəmanətli təqdimat</li>
      </ul>
    `
  }
};

/* =========================
   MƏHSUL SƏHİFƏSİ ROUTING VƏ TABS (QAYDALAR BURADA İDARƏ OLUNUR)
   ========================= */
let currentProduct = null;
let currentPlanIdx = 0;

window.openProductPage = (id) => {
  const p = DATA.products.find(x => x.id === id);
  if(!p) return;
  currentProduct = p;
  currentPlanIdx = 0;

  const homeView = document.getElementById("homePageView");
  const productView = document.getElementById("productPageView");
  if(homeView) homeView.style.display = "none";
  if(productView) productView.style.display = "block";
  window.scrollTo(0, 0);

  const mainImg = document.getElementById("pp-main-img");
  if(mainImg) mainImg.src = p.image;
  
  const titleEl = document.getElementById("pp-main-title");
  if(titleEl) titleEl.textContent = p.variant ? `${p.title} - (${p.variant})` : p.title;

  renderProductPlans(p);
  renderSimilarProducts(p);
  renderProductTabs(p);
};

document.getElementById("btnBackToHome")?.addEventListener("click", () => {
  document.getElementById("productPageView").style.display = "none";
  document.getElementById("homePageView").style.display = "block";
  window.scrollTo(0, savedScrollY || 0);
});

document.querySelector(".brand")?.addEventListener("click", () => {
  document.getElementById("productPageView").style.display = "none";
  document.getElementById("homePageView").style.display = "block";
  window.scrollTo(0, 0);
});

function renderProductPlans(p) {
  const container = document.getElementById("pp-plans-container");
  if(!container) return;
  container.innerHTML = "";

  const plans = p.plans || [];
  if(!plans.length) {
    container.innerHTML = `<div style="color:red;">Mövcud plan yoxdur</div>`;
    return;
  }

  plans.forEach((pl, idx) => {
    let price = pl.price;
    let oldPrice = (price * 1.5 + 2).toFixed(2); 
    let discount = Math.round((1 - (price/oldPrice)) * 100);

    const isStockOut = price <= 0;
    if(isStockOut) { oldPrice = 0; discount = 0; }

    const labelName = pl.label ? pl.label : `${pl.months} ${UI.month}`;

    const div = document.createElement("div");
    div.className = `pp-plan-label ${idx === currentPlanIdx ? 'active' : ''}`;
    div.innerHTML = `
      <div class="pp-plan-left">
         <div class="pp-radio-circle"></div>
         <div class="pp-plan-name">${labelName}</div>
         ${discount > 0 ? `<div class="pp-plan-disc-badge">🚩 -${discount}%</div>` : ''}
      </div>
      <div class="pp-plan-right">
         ${discount > 0 ? `<div class="pp-old-price">${oldPrice} ₼</div>` : ''}
         <div class="pp-new-price">${isStockOut ? pl.label : price.toFixed(2) + ' ₼'}</div>
      </div>
    `;

    div.onclick = () => {
      currentPlanIdx = idx;
      renderProductPlans(p); 
    };

    container.appendChild(div);
  });
}

function renderSimilarProducts(p) {
  const container = document.getElementById("pp-similar-list");
  if(!container) return;
  
  let similar = DATA.products.filter(x => x.id !== p.id && x.category === p.category);
  if(similar.length < 3) similar = DATA.products.filter(x => x.id !== p.id);
  
  similar = similar.slice(0, 5);

  container.innerHTML = similar.map(sp => {
    const minP = getMinPrice(sp);
    return `
      <div class="pp-sim-card" onclick="window.openProductPage('${sp.id}')">
        <img src="${sp.image}" class="pp-sim-img" alt="">
        <div class="pp-sim-info">
           <div class="pp-sim-title">${sp.title}</div>
           <div class="pp-sim-price">${minP > 0 ? minP.toFixed(2) + ' ₼' : UI.stokOut}</div>
        </div>
      </div>
    `;
  }).join("");
}

function renderProductTabs(p) {
  const cBox = document.getElementById("pp-content-box");
  const tabs = document.querySelectorAll(".pp-tab");
  
  const showTab = (tabName) => {
    tabs.forEach(t => t.classList.remove("active"));
    document.querySelector(`.pp-tab[data-target="${tabName}"]`)?.classList.add("active");

    if (tabName === "tab-about") {
      const info = INFO_TEXTS[p.id];
      cBox.innerHTML = (info && info.htmlContent) ? info.htmlContent : `<p>${p.desc}</p><p>${p.note}</p>`;
    } 
    else if (tabName === "tab-rules") {
      
      // ==================================
      // XÜSUSİ QAYDALAR BÖLMƏSİ
      // ==================================

      if (p.id === "google_ai" || p.id === "google_ai_ultra") {
        const isUltra = p.id === "google_ai_ultra";
        const titleText = isUltra ? "Google AI ULTRA" : "Google AI Pro";
        const funcsText = isUltra ? "Google AI ULTRA-nın ən qabaqcıl funksiyalarına (Gemini Ultra, NotebookLM, Veo 2.5 / 3.0 və s.)" : "Google AI Pro-nun qabaqcıl funksiyaları (Gemini AI alətləri, NotebookLM və digər premium AI xidmətləri) ilə yanaşı";
        const extraWarranty = isUltra ? `
          <h4 style="color:#00ff99; margin-bottom:5px;">Zəmanət Öhdəliyi, Texniki Dəstək və Təlimatlar</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>20 Günlük Zəmanət:</b> Bu paketə xüsusi olaraq 20 günlük zəmanət təqdim olunur. Zəmanət müddəti ərzində texniki giriş və ya aktivlik problemləri yaranarsa, Mirpanel Canlı Dəstək komandası operativ şəkildə texniki yardım göstərir.</li>
            <li><b>Zəmanət Xarici Hallar:</b> Rəsmi Google tərəfindən qəbul edilən qlobal siyasət dəyişiklikləri, limit tətbiqləri və ya fərdi hesab qərarları xidmətin zəmanət çərçivəsinə daxil edilmir.</li>
            <li><b>Mütləq Oxu Təlimatı:</b> Sifariş tamamlandıqdan sonra bütün detallı məlumatlar və texniki təlimatlar saytın “Sifarişlərim” → “Mütləq Oxu” bölməsində yerləşdirilir. Zəhmət olmasa, hesabdan istifadəyə başlamazdan əvvəl bu bölmə ilə mütləq tanış olun.</li>
          </ul>
          <p><i>Qeyd: Hər hansı əlavə sualınız və ya texniki çətinliyiniz yaranarsa, sayt üzərindən Canlı Dəstək komandamıza müraciət edərək rəsmi, sürətli və zəmanətli xidmətimizdən dərhal faydalana bilərsiniz. ✅</i></p>
        ` : `
          <h4 style="color:#00ff99; margin-bottom:5px;">Zəmanət Öhdəliyi və Texniki Dəstək</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Operativ Yardım:</b> Zəmanət müddəti ərzində hesaba daxil olarkən hər hansı texniki giriş problemi yaranarsa, Mirpanel Canlı Dəstək komandası operativ şəkildə texniki yardım göstərməyə zəmanət verir.</li>
            <li><b>Zəmanət Xarici Hallar:</b> Rəsmi Google tərəfindən qəbul edilən qlobal siyasət dəyişiklikləri, platforma qərarları və ya istifadəçinin kobud qayda pozuntusu (və ya şübhəli aktivliyi) səbəbindən yaranan məhdudiyyətlər xidmətin zəmanət çərçivəsinə daxil edilmir.</li>
          </ul>
        `;

        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">${titleText} – Xidmət Sazişi, Hesab Təqdimatı və İstismar Qaydaları</h3>
          <p>${titleText} xidməti Mirpanel platforması tərəfindən tam istifadəyə hazır, fərdi Google hesabı formatında təqdim edilir. Xidmətin kəsintisiz və təhlükəsiz fəaliyyəti üçün aşağıdakı reqlamentlə tanış olmağınız tələb edilir.</p>
          
          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və Hesabın Təhvil Verilməsi</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Hazır Hesab Təminatı:</b> Xidmət çərçivəsində istifadəçiyə əvvəlcədən hazırlanmış, ${isUltra ? 'ULTRA' : 'Premium'} statuslu Google hesabının giriş məlumatları (elektron poçt və şifrə) tam şəkildə təhvil verilir.</li>
            <li><b>Operativ İstismar:</b> Hesab təqdim edildiyi anda tam aktiv vəziyyətdə olur. Heç bir əlavə və ya manual aktivləşdirmə prosesinə ehtiyac duyulmur.</li>
            <li><b>Genişləndirilmiş Ekosistem:</b> Abunəlik daxilində ${funcsText} 2 TB həcmində Google Drive bulud yaddaşı da istifadəçinin tam ixtiyarına verilir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Vacib Şərt – Fərdi İstifadə və Təhlükəsizlik Öhdəlikləri</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Mütləq Fərdilik:</b> Hesab müstəsna olaraq yalnız bir (1) istifadəçi üçün nəzərdə tutulmuşdur. Profilin ortaq istifadəsi və ya giriş məlumatlarının kənar şəxslərlə paylaşılması qəti qadağandır.</li>
            <li><b>Şəxsi Məsuliyyət:</b> Sistemə ilk giriş tamamlandıqdan sonra hesab şifrəsinin dəyişdirilməsi, təhlükəsizlik parametrlərinin fərdiləşdirilməsi və iki addımlı təsdiqləmə (2FA) sisteminin aktivləşdirilməsi birbaşa istifadəçinin şəxsi məsuliyyətindədir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Platforma Qaydaları və Məhdudiyyətlər</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            ${!isUltra ? `<li><b>Təyinatlı İstifadə:</b> Hesabdan yalnız standart, qeyri-kütləvi və fərdi ehtiyaclar üçün istifadə edilməsi şiddətlə tövsiyə olunur.</li>` : ''}
            <li><b>Bloklanma Riski:</b> Eyni anda çoxsaylı fərqli cihazlardan, müxtəlif IP ünvanlardan sistemə giriş cəhdləri və ya qeyri-təbii (bot/spam) fəaliyyətlər hesabın qlobal Google alqoritmləri tərəfindən məhdudlaşdırılmasına (bloklanmasına) səbəb ola bilər.</li>
            <li><b>Sistem Qərarları:</b> Qlobal Google platforması tərəfindən tətbiq edilən daxili siyasət qaydaları, gündəlik/saatlıq AI limitləri və texniki dəyişikliklər Mirpanel rəhbərliyinin nəzarəti xaricindədir.</li>
            <li><b>Qayda Pozuntusu:</b> Platformanın rəsmi istifadəçi şərtlərinin pozulması hesabın qalıcı olaraq bağlanması və ya məhdudlaşdırılması ilə nəticələnə bilər.</li>
          </ul>
          ${extraWarranty}
        `;
      }
      else if (p.id === "captions") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">Captions AI – Xidmət Sazişi, Hesab Təqdimatı və İstismar Qaydaları</h3>
          <p>Captions AI xidməti Mirpanel platforması tərəfindən istifadəyə hazır hesab və ya birbaşa şəxsi profilinizə inteqrasiya formatında təqdim edilir. Xidmətin kəsintisiz və təhlükəsiz fəaliyyəti üçün aşağıdakı reqlamentlə tanış olmağınız tələb edilir.</p>
          
          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və Hesabın Təhvil Verilməsi</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Giriş Məlumatları:</b> Hesab təqdim edildikdən sonra Captions AI tətbiqinə sizə verilən xüsusi elektron poçt və giriş şifrəsi vasitəsilə daxil olmalısınız.</li>
            <li><b>Şəxsi Hesaba İnteqrasiya:</b> İstəyə uyğun olaraq, Premium paket birbaşa sizin şəxsi Captions AI hesabınıza da tətbiq edilə bilər. Bunun üçün sifariş rəsmiləşdirilməzdən əvvəl məlumat verməyiniz kifayətdir.</li>
            <li><b>Şəxsi Təhlükəsizlik:</b> Sistemə ilk giriş tamamlandıqdan sonra hesab şifrəsinin və təhlükəsizlik parametrlərinin yenilənməsi şiddətlə tövsiyə olunur.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Vacib Şərt – Fərdi İstifadə və Limit Qaydaları</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Mütləq Fərdilik:</b> Hesab müstəsna olaraq yalnız bir (1) istifadəçi üçün nəzərdə tutulmuşdur. Profilin digər şəxslərlə paylaşılması və ya ortaq istifadəsi qəti qadağandır.</li>
            <li><b>IP və Cihaz Təhlükəsizliyi:</b> Təhlükəsizlik alqoritmlərinin işə düşməməsi üçün eyni anda çoxsaylı fərqli cihazlardan və müxtəlif IP ünvanlardan sistemə giriş tövsiyə edilmir.</li>
            <li><b>Fərdi Hüquqlar:</b> Hesaba təhkim olunmuş bütün süni intellekt (AI) limitləri və premium istifadə hüquqları müstəsna olaraq yalnız sizə aiddir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Platforma Qaydaları və Məhdudiyyətlər</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Təyinatlı İstifadə:</b> Captions AI hesabı yalnız video altyazıların yaradılması, dublyaj və vizual kontent istehsalı məqsədləri üçün istifadə edilməlidir.</li>
            <li><b>Bloklanma Riski:</b> Platformanın daxili təhlükəsizlik siyasətinin, istifadəçi şərtlərinin pozulması hesabın məhdudlaşdırılmasına və ya qalıcı olaraq bağlanmasına (ban) səbəb ola bilər.</li>
            <li><b>Sistem Qərarları:</b> Rəsmi platforma tərəfindən tətbiq edilən qlobal yeniliklər, limit dəyişiklikləri və texniki qərarlar Mirpanel rəhbərliyinin nəzarəti xaricindədir.</li>
            <li><b>Zəmanət Xarici Hallar:</b> İstifadəçi tərəfindən platforma qaydalarının kobud şəkildə pozulmasından qaynaqlanan məhdudiyyətlərə və bloklanmalara zəmanət verilmir.</li>
          </ul>
          <p><i>Qeyd: Hər hansı sual və ya texniki çətinlik yaranarsa, sayt üzərindən Canlı Dəstək komandamıza müraciət edə bilərsiniz. ✅</i></p>
        `;
      }
      else if (p.id === "grok_supergrok") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">GROK AI Super (Supergrok) – Xidmət Sazişi və İstismar Qaydaları</h3>
          <p>GROK AI xidməti Mirpanel platforması tərəfindən istifadəyə hazır hesab və ya birbaşa şəxsi profilinizə inteqrasiya formatında təqdim edilir. Xidmətin kəsintisiz və təhlükəsiz fəaliyyəti üçün aşağıdakı reqlamentlə tanış olmağınız tələb edilir.</p>
          
          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və Hesabın Təhvil Verilməsi</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Giriş Məlumatları:</b> Hesab təqdim edildikdən sonra GROK AI platformasına sizə verilən xüsusi elektron poçt və giriş şifrəsi vasitəsilə daxil olmalısınız.</li>
            <li><b>Şəxsi Hesaba İnteqrasiya:</b> İstəyə uyğun olaraq, paket birbaşa sizin öz şəxsi hesabınıza da yüklənə bilər. Bunun üçün sifariş rəsmiləşdirilməzdən əvvəl bu barədə bizə məlumat verməyiniz kifayətdir.</li>
            <li><b>Şəxsi Təhlükəsizlik:</b> Sistemə ilk giriş tamamlandıqdan sonra hesab şifrəsinin və təhlükəsizlik parametrlərinin yenilənməsi şiddətlə tövsiyə olunur.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Vacib Şərt – Fərdi İstifadə və Limit Qaydaları</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Mütləq Fərdilik:</b> Hesab müstəsna olaraq yalnız bir (1) istifadəçi üçün nəzərdə tutulmuşdur. Profilin digər şəxslərlə paylaşılması və ya ortaq istifadəsi halında xidmətə heç bir zəmanət verilmir.</li>
            <li><b>IP və Cihaz Təhlükəsizliyi:</b> Təhlükəsizlik alqoritmlərinin hesabı şübhəli kimi qeydə almaması üçün eyni anda çoxsaylı fərqli cihazlardan və müxtəlif IP ünvanlardan sistemə giriş tövsiyə edilmir.</li>
            <li><b>Fərdi Hüquqlar:</b> Hesaba təhkim olunmuş bütün süni intellekt (AI) limitləri və sorğu sayı müstəsna olaraq yalnız sizə aiddir və tam fərdi istifadənizdə olur.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Platforma Qaydaları, Məhdudiyyətlər və Zəmanət</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Bloklanma Riski:</b> Platformanın daxili təhlükəsizlik siyasətinin, istifadəçi şərtlərinin pozulması hesabın məhdudlaşdırılmasına və ya qalıcı olaraq bağlanmasına səbəb ola bilər.</li>
            <li><b>Sistem Qərarları:</b> Rəsmi platforma tərəfindən tətbiq edilən qlobal yeniliklər, limit dəyişiklikləri və texniki qərarlar Mirpanel rəhbərliyinin nəzarəti xaricindədir.</li>
            <li><b>Texniki Dəstək və Zəmanət:</b> İstifadə zamanı qarşılaşa biləcəyiniz mümkün texniki çətinliklərə qarşı xidmətə müvafiq zəmanət təqdim olunur. Hər hansı əlavə sual və ya çətinlik yaranarsa, aktiv fəaliyyət göstərən Mirpanel Canlı Dəstək xəttinə müraciət edərək operativ kömək ala bilərsiniz. ✅</li>
          </ul>
        `;
      }
      else if (p.id === "claude_ai") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">Claude AI PRO – Xidmət Sazişi, Hesab Təqdimatı və İstismar Qaydaları</h3>
          <p>Claude AI PRO xidməti Mirpanel platforması tərəfindən istifadəyə hazır hesab formatında təqdim edilir. Xidmətin kəsintisiz və təhlükəsiz fəaliyyəti üçün aşağıdakı reqlamentlə tanış olmağınız tələb edilir.</p>
          
          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və Hesabın Təhvil Verilməsi</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Giriş Məlumatları:</b> Hesab təqdim edildikdən sonra Claude AI platformasına sizə verilən xüsusi elektron poçt və OTP (Birdəfəlik giriş kodu) vasitəsilə daxil olmalısınız.</li>
            <li><b>Şəxsi Təhlükəsizlik:</b> Hesabın təhlükəsizliyi baxımından giriş məlumatlarının məxfiliyini qorumaq sizin məsuliyyətinizdədir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Vacib Şərt – Fərdi İstifadə və Limit Qaydaları</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Mütləq Fərdilik:</b> Hesab müstəsna olaraq yalnız bir (1) istifadəçi üçün nəzərdə tutulmuşdur. Profilin digər şəxslərlə paylaşılması və ya ortaq istifadəsi qətiyyən yolverilməzdir. Belə hallarda xidmətə heç bir zəmanət verilmir.</li>
            <li><b>IP və Cihaz Təhlükəsizliyi:</b> Təhlükəsizlik alqoritmlərinin hesabı şübhəli kimi qeydə almaması üçün eyni anda çoxsaylı fərqli cihazlardan və müxtəlif IP ünvanlardan sistemə giriş tövsiyə edilmir.</li>
            <li><b>Fərdi Hüquqlar:</b> Hesaba təhkim olunmuş bütün süni intellekt (AI) limitləri, model istifadəsi və sorğu sayı müstəsna olaraq yalnız sizə aiddir və tam fərdi istifadənizdə olur.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Platforma Qaydaları, Məhdudiyyətlər və Zəmanət</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Bloklanma Riski:</b> Platformanın daxili təhlükəsizlik siyasətinin, istifadəçi şərtlərinin pozulması hesabın məhdudlaşdırılmasına və ya qalıcı olaraq bağlanmasına səbəb ola bilər.</li>
            <li><b>Sistem Qərarları:</b> Rəsmi platforma tərəfindən tətbiq edilən qlobal yeniliklər, limit dəyişiklikləri və dinamik texniki qərarlar Mirpanel rəhbərliyinin nəzarəti xaricindədir.</li>
            <li><b>Texniki Dəstək:</b> İstifadə zamanı hər hansı texniki çətinliklə qarşılaşarsınızsa, daimi aktiv fəaliyyət göstərən Mirpanel Canlı Dəstək xəttinə müraciət edərək operativ kömək ala bilərsiniz. ✅</li>
          </ul>
        `;
      }
      else if (p.id === "prime") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">Amazon Prime Video – Xidmət Sazişi, Hesab Təqdimatı və İstismar Qaydaları</h3>
          <p>Amazon Prime Video premium abunəliyi Mirpanel platforması tərəfindən istifadəçilərə rəsmi, sürətli və zəmanətli şəkildə təqdim olunur. Xidmət tamamilə istifadəyə hazır hesab formatında təhvil verilir və platformanın qabaqcıl imkanlarından dərhal yararlanmağa imkan yaradır.</p>
          
          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və Hesabın Təhvil Verilməsi</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Giriş Məlumatları:</b> Hesab istifadəçiyə xüsusi elektron poçt (e-mail) və giriş şifrəsi vasitəsilə təqdim olunur.</li>
            <li><b>Operativ İstismar:</b> Məlumatları əldə etdikdən sonra sadəcə Amazon Prime Video platformasına daxil olmağınız kifayətdir. Sistemə giriş tamamlandıqdan dərhal sonra bütün premium funksiyalar avtomatik olaraq aktivləşir.</li>
            <li><b>Şəxsi Təhlükəsizlik:</b> Təqdim olunan giriş məlumatlarının məxfiliyinin və hesabın təhlükəsizliyinin qorunması birbaşa istifadəçinin şəxsi məsuliyyətindədir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Vacib Şərt – Fərdi İstifadə və Regional Qaydalar</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Mütləq Fərdilik:</b> Təqdim edilən profil müstəsna olaraq tam sizə məxsusdur. Hesabın kənar və ya üçüncü şəxslərlə paylaşılması, ortaq istifadəsi qəti şəkildə qadağandır.</li>
            <li><b>Region Siyasəti:</b> Amazon platformasının daxili qlobal qaydalarına əsasən, VPN xidmətlərindən istifadə edərək hesabın mövcud regionunu dəyişdirmək mümkün deyil.</li>
            <li><b>Məzmun Məhdudiyyətləri:</b> Platformadakı müəyyən lisenziyalı film, serial və eksklüziv məzmunlar coğrafi məhdudiyyətlərə tabedir və yalnız aid olduqları region daxilində izlənilə bilər.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Platforma Qaydaları, Məhdudiyyətlər və Zəmanət</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Deaktivasiya Riski:</b> Platformanın təhlükəsizlik siyasətinin və yuxarıda qeyd olunan istismar qaydalarının pozulması (hesab məlumatlarının paylaşılması, qeyri-normal/şübhəli istifadə və s.) profilin avtomatik deaktivasiyasına (bloklanmasına) və zəmanətin ləğvinə səbəb ola bilər.</li>
            <li><b>Sistem Qərarları:</b> Rəsmi Amazon tərəfindən tətbiq edilən qlobal yeniliklər, regional izləmə məhdudiyyətləri və texniki qərarlar Mirpanel rəhbərliyinin nəzarəti xaricindədir.</li>
            <li><b>Texniki Dəstək:</b> Xidmət müddətində hər hansı sistem xətası və ya giriş problemi ilə qarşılaşarsınızsa, daimi aktiv fəaliyyət göstərən Mirpanel Canlı Dəstək komandasına müraciət edərək operativ kömək ala bilərsiniz. ✅</li>
          </ul>
        `;
      }
      else if (p.id === "duolingo") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">Duolingo Super – Xidmət Sazişi, Aktivləşdirmə Reqlamenti və İstismar Qaydaları</h3>
          <p>Duolingo Super premium abunəliyi Mirpanel platforması tərəfindən birbaşa istifadəçinin mövcud profili üzərinə rəsmi dəvət metodu ilə tətbiq edilir. Xidmətin kəsintisiz və təhlükəsiz fəaliyyəti üçün aşağıdakı reqlamentlə tanış olmağınız tələb edilir.</p>
          
          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və Aktivləşdirmə Mərhələləri</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Dəvət Metodologiyası:</b> Paketin aktivləşdirilməsi istifadəçinin şəxsi hesabına "Ailə" (Family) qrupu dəvətinin göndərilməsi yolu ilə həyata keçirilir.</li>
            <li><b>Qoşulma Prosesi:</b> Sifarişiniz təsdiqləndikdən sonra sizə xüsusi dəvət keçidi (link) təqdim olunur. Aktivləşdirməni tamamlamaq üçün həmin linkə klikləyərək mövcud Duolingo hesabınızla qrupa qoşulmağınız kifayətdir.</li>
            <li><b>Operativ İstismar:</b> Dəvəti qəbul etdikdən dərhal sonra tətbiqə daxil olaraq Duolingo Super-in bütün premium funksiyalarından (reklamsız dərs, limitsiz can, fərdiləşdirilmiş məşq və s.) tam istifadə etməyə başlaya bilərsiniz.</li>
            <li><b>Məlumat Sabitliyi:</b> Əməliyyat yalnız dəvət linki vasitəsilə icra olunduğu üçün hesabınızın şifrəsi qətiyyən tələb olunmur və əvvəlki öyrənmə tarixçəniz (tərəqqi xətti) olduğu kimi qorunur.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Vacib Şərt – Fərdi İstifadə və Təhlükəsizlik Öhdəlikləri</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Mütləq Fərdilik:</b> Təqdim edilən premium imkanlar, qrup daxilindəki yeriniz və istifadə hüquqları müstəsna olaraq yalnız sizə (hesab sahibinə) aiddir.</li>
            <li><b>Şəxsi Məsuliyyət:</b> Profilin təhlükəsizliyinin qorunması, eləcə də hesab məlumatlarının məxfiliyi birbaşa istifadəçinin şəxsi məsuliyyətindədir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Platforma Qaydaları, Məhdudiyyətlər və Zəmanət</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Bloklanma Riski:</b> Duolingo platformasının daxili siyasətinin və qlobal istifadəçi qaydalarının pozulması hesabın məhdudlaşdırılmasına və ya premium qrupdan xaric edilməsinə səbəb ola bilər.</li>
            <li><b>Sistem Qərarları:</b> Rəsmi platforma tərəfindən tətbiq edilən qlobal yeniliklər, tədris alqoritminin yenilənməsi və texniki qərarlar Mirpanel rəhbərliyinin nəzarəti xaricindədir.</li>
            <li><b>Texniki Dəstək:</b> Aktivləşdirmə prosesi və ya istifadə zamanı hər hansı texniki sual, çətinlik yaranarsa, daimi aktiv fəaliyyət göstərən Mirpanel Canlı Dəstək komandasına müraciət edərək operativ kömək ala bilərsiniz. ✅</li>
          </ul>
        `;
      }
      else if (p.id === "canva") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">Canva Pro (1 Aylıq / 1 İllik) – Xidmət Sazişi, Aktivləşdirmə Reqlamenti və İstismar Qaydaları</h3>
          <p>Canva Pro premium abunəliyi Mirpanel platforması tərəfindən birbaşa istifadəçinin şəxsi profili üzərinə rəsmi elektron poçt dəvəti (invite) vasitəsilə tətbiq edilir. Bu xidmət istifadəçiyə seçilmiş paketdən asılı olaraq (1 ay və ya 1 il müddətində) qabaqcıl Pro imkanlarından yararlanmaq imkanı verir. Hesabınız daxilində hazırladığınız bütün dizaynlar, layihələr və arxiv faylları tamamilə məxfi qalır və qrupdakı heç bir kənar şəxs tərəfindən görülə bilməz.</p>
          
          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və Aktivləşdirmə Mərhələləri</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Məlumat Təqdimatı:</b> Sifariş rəsmiləşdirilərkən mövcud Canva hesabınıza bağlı olan elektron poçt (e-mail) ünvanını sistemə daxil etməyiniz tələb olunur. Hesab şifrəsinə qətiyyən ehtiyac yoxdur.</li>
            <li><b>Dəvətin Göndərilməsi:</b> Qısa müddət ərzində təqdim etdiyiniz həmin ünvana Canva platforması tərəfindən rəsmi Pro komandasına qoşulma dəvəti göndərilir.</li>
            <li><b>Təsdiq Proseduru:</b> Elektron poçtunuza daxil olaraq dəvət keçidinə (linkinə) klikləyib qəbul etdikdən dərhal sonra hesabınız avtomatik olaraq Canva Pro statusuna keçid edir.</li>
            <li><b>Operativ İstismar:</b> Aktivasiya tamamlandıqdan sonra seçdiyiniz paketin müddətinə (1 ay və ya 1 il) uyğun olaraq milyonlarla şablon, qrafik element, şəkil və qabaqcıl Pro redaktə funksiyalarından limitsiz istifadə edə bilərsiniz.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Vacib Şərt – Xidmət Müddəti və Texniki Məhdudiyyətlər</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Paket Müddətinin İdarə Edilməsi:</b> Abunəlik müddəti (1 ay və ya 1 il) başa çatdıqdan sonra status avtomatik yenilənmir və əvvəlki paket istifadəyə bağlanır. Pro funksiyalarına davam etmək üçün Mirpanel vasitəsilə yeni paketə (yeni komandaya) qoşulmağınız tələb olunur.</li>
            <li><b>İstisna Funksiyalar:</b> Təhlükəsizlik və komanda idarəetməsi siyasəti çərçivəsində qrup daxilində admin (idarəçi) icazəsi tələb edən bəzi spesifik xüsusiyyətlər, xüsusilə də "Brand Kit" (Marka Kiti) aktiv olmaya bilər. Lakin digər bütün qrafik dizayn, yükləmə və redaktə alətləri tam istifadənizdə olacaqdır.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Platforma Qaydaları, Zəmanət Öhdəliyi və Dəstək</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Mütləq Məxfilik:</b> Şəxsi işlərinizə, yüklədiyiniz vizuallara və layihələrinizə tam məxfilik təmin edilir; məlumatlarınıza kənar müdaxilə qeyri-mümkündür.</li>
            <li><b>Sistem Qərarları:</b> Rəsmi Canva platforması tərəfindən tətbiq edilən qlobal yeniliklər, interfeys dəyişiklikləri və daxili siyasət qərarları Mirpanel rəhbərliyinin nəzarəti xaricindədir.</li>
            <li><b>Zəmanətin Ləğvi:</b> Platformanın rəsmi istifadəçi şərtlərinin kobud şəkildə pozulması və ya qeyri-təbii istismar halları xidmətin zəmanət çərçivəsindən çıxarılmasına (zəmanətin qüvvədən düşməsinə) səbəb ola bilər.</li>
            <li><b>Texniki Dəstək:</b> Aktivləşdirmə prosesində və ya istifadə zamanı hər hansı texniki çətinlik yaranarsa, daimi aktiv fəaliyyət göstərən Mirpanel Canlı Dəstək xəttinə müraciət edərək operativ yardım ala bilərsiniz. ✅</li>
          </ul>
        `;
      }
      else if (p.id === "adobecc") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">Adobe Creative Cloud (Hazır Hesab) – Xidmət Sazişi, Hesab Təqdimatı və İstismar Qaydaları</h3>
          <p>Adobe Creative Cloud xidməti Mirpanel platforması tərəfindən istifadəyə tam hazır hesab formatında təqdim edilir. Bu paket istifadəçiyə Adobe ekosistemindəki bütün proqramlara lisenziyalı və qeyri-məhdud giriş imkanı yaradır. Xidmətin kəsintisiz və təhlükəsiz fəaliyyəti üçün aşağıdakı reqlamentlə tanış olmağınız tələb edilir.</p>
          
          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və Hesabın Təhvil Verilməsi</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Tam Təchizatlı Hesab:</b> Sifariş təsdiqləndikdən sonra istifadəçiyə xüsusi elektron poçt (e-mail) və giriş şifrəsi formatında hazır Adobe hesabı təqdim olunur.</li>
            <li><b>Lisenziyalı Çıxış:</b> Təqdim edilən hesab vasitəsilə Adobe Creative Cloud platformasındakı bütün tətbiqlərə (Photoshop, Illustrator, Premiere Pro, After Effects və s.) tam qanuni və lisenziyalı giriş təmin edilir.</li>
            <li><b>Qabaqcıl Funksionallıq:</b> Bütün proqramlar, daxili tətbiq elementləri və xüsusilə Süni İntellekt (AI) dəstəkli alətlər (Generative Fill, Generative Expand və s.) tam aktiv və qüsursuz vəziyyətdə çalışır.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Vacib Şərt – Mütləq Fərdilik və Məlumatların İdarə Edilməsi</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Şəxsi Mülkiyyət:</b> Təhvil verilən hesab tam şəkildə və müstəsna olaraq istifadəçiyə məxsusdur.</li>
            <li><b>Sərbəst İdarəetmə:</b> İstifadəçi istədiyi zaman hesabın mövcud elektron poçt ünvanını öz şəxsi e-mail ünvanı ilə əvəz etmək və ya profili tamamilə bağlamaq (ləğv etmək) hüququna malikdir.</li>
            <li><b>Məxfi İstismar:</b> Xidmətdən yararlanmaq üçün sadəcə təqdim edilən məlumatlarla sistemə daxil olmaq, ehtiyac duyduğunuz proqramları cihazınıza yükləmək və tam şəxsi konfidensiallıq şəraitində fərdi qaydada istifadə etmək kifayətdir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Cihaz Limitləri və Texniki Tövsiyələr</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Cihaz Sayı:</b> Hesabın bir neçə fərqli cihazda aktiv edilməsi texniki cəhətdən mümkün olsa da, hesabın təhlükəsizliyi və stabil fəaliyyəti üçün proqramların maksimum 2 (iki) cihazda istifadə edilməsi şiddətlə tövsiyə olunur. Qlobal məhdudiyyətlərlə qarşılaşmamaq üçün bu limitin nəzərə alınması xahiş edilir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Zəmanət Öhdəliyi, Bərpa Proseduru və Təlimatlar</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Operativ Bərpa:</b> Texniki səbəblərdən (sistem yenilənmələri və s.) hesabın deaktiv olması halı baş verərsə, paket gün ərzində (maksimum 72 saat müddətində) Mirpanel tərəfindən yenidən bərpa edilərək aktivləşdirilir.</li>
            <li><b>Müvəqqəti Əvəzləmə:</b> Əgər texniki bərpa prosesi qeyd olunan müddət ərzində yekunlaşmazsa, istifadəçinin iş prosesinin yarımçıq qalmaması məqsədilə dərhal keçici (müvəqqəti) hazır hesab təqdim edilir.</li>
            <li><b>Mütləq Oxu Təlimatı:</b> Sifariş tamamlandıqdan sonra bütün detallı məlumatlar və texniki təlimatlar saytın “Sifarişlərim” → “Mütləq Oxu” bölməsində yerləşdirilir. Zəhmət olmasa, hesabdan istifadəyə başlamazdan əvvəl bu bölmə ilə mütləq şəkildə tanış olun. ✅</li>
          </ul>
        `;
      }
      else if (p.id === "youtube") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">YouTube Premium (Şəxsi Hesab) – Xidmət Sazişi, Aktivləşdirmə Reqlamenti və İstismar Qaydaları</h3>
          <p>YouTube Premium xidmətinin şəxsi hesab üzrə aktivləşdirilməsi istifadəçinin mövcud Google / YouTube profilinə "Family Premium" (Ailə qrupu) dəvətinin göndərilməsi metodu ilə həyata keçirilir. Bu prosedur zamanı profilinizə heç bir kənar giriş (login) edilmir və bütün əməliyyat müstəsna olaraq YouTube platformasının rəsmi dəvət sistemi üzərindən icra olunur.</p>
          <p>Xidmətin kəsintisiz və düzgün fəaliyyəti üçün aşağıdakı reqlamentlə tanış olmağınız şiddətlə tövsiyə edilir.</p>

          <h4 style="color:#00ff99; margin-bottom:5px;">Aktivləşdirmə Prosedurunun Gedişatı</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li>Sifarişin rəsmiləşdirilməsi zamanı YouTube / Google profilinizə birbaşa bağlı olan Gmail ünvanını sistemə daxil etməyiniz tələb olunur.</li>
            <li>Sifariş təsdiqləndikdən sonra qeyd etdiyiniz elektron poçt ünvanına rəsmi YouTube Premium Family dəvət keçidi (link) göndərilir.</li>
            <li>Dəvət istifadəçi tərəfindən qəbul edildiyi anda YouTube Premium statusu hesabınızda avtomatik olaraq aktivləşir.</li>
            <li><b>Təhlükəsizlik təminatı:</b> Bu prosedur zamanı hesabınızın şifrəsi qətiyyən tələb olunmur və sistemə kənar giriş həyata keçirilmir! Lakin hesabın fəaliyyət regionunun Azərbaycan olması mütləq şəkildə tələb edilir.</li>
            <li>Aktivləşdirmə prosesi adətən ən qısa zaman kəsiyində, operativ olaraq tamamlanır.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">İstismar və Funksional Qaydalar</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li>Təqdim olunan dəvət keçidi yalnız sifariş mərhələsində qeydiyyata alınan spesifik Gmail ünvanı üçün keçərlidir.</li>
            <li>Aktivasiyanın tamamlanması üçün göndərilən dəvət mütləq şəkildə istifadəçi tərəfindən təsdiqlənməlidir; əks halda Premium statusu tətbiq edilməyəcəkdir.</li>
            <li>Aktivləşən Premium statusu həm YouTube, həm də YouTube Music platformalarında avtomatik olaraq sinxronlaşır.</li>
            <li>Status tətbiq edildikdən sonra istifadəçi reklamsız baxış, arxa fonda (ekran bağlı ikən) oxutma və oflayn (internetsiz) izləmək üçün yükləmə funksiyalarından tam istifadə hüququ əldə edir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Vacib Qeydlər və Məhdudiyyətlər</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li>Xidmətin icrası YouTube-un "Family" (Ailə) planı infrastrukturuna əsaslanır.</li>
            <li>Mövcud Premium planı texniki olaraq yalnız Azərbaycan və ya Türkiyə regionlarına aid hesablarda fəaliyyət göstərə bilir.</li>
            <li>YouTube platformasının rəsmi siyasətinə əsasən, bir hesab 12 ay (1 il) ərzində yalnız 1 dəfə "Family" qrupuna daxil ola bilər.</li>
            <li>Qlobal platforma tərəfindən tətbiq edilən texniki yeniliklər və ya regional siyasət dəyişiklikləri xidmətin gedişatına təsir göstərə bilər.</li>
            <li>İstifadəçi YouTube-un daxili istifadəçi qaydalarına qeyd-şərtsiz riayət etməyə borcludur.</li>
            <li>YouTube platformasının daxili alqoritm dəyişiklikləri və qərarları Mirpanel rəhbərliyinin nəzarəti xaricindədir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Zəmanət Öhdəliyi və Texniki Dəstək</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li>Aktivləşdirmə mərhələsində yarana biləcək hər hansı texniki ləngimə və ya problem zamanı Mirpanel Canlı Dəstək komandası operativ yardım göstərir.</li>
            <li>Xidmət müddəti ərzində qarşılaşılan sistem nasazlıqları zəmanət çərçivəsində maksimum səviyyədə aradan qaldırılır.</li>
            <li>İstifadəçi tərəfindən rəsmi platforma qaydalarının kobud şəkildə pozulması və ya YouTube tərəfindən icra edilən qlobal sistem dəyişiklikləri yaranarsa, bu hallar zəmanət çərçivəsinə daxil edilməyə bilər.</li>
          </ul>
        `;
      }
      else if (p.id === "surfshark") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">Surfshark VPN – Xidmət Sazişi, Aktivləşdirmə Reqlamenti və İstismar Qaydaları</h3>
          <p>Surfshark VPN premium lisenziyasının Mirpanel platforması tərəfindən təmin edilməsi istifadəçiyə yüksək sürətli, tam təhlükəsiz və qlobal məhdudiyyətsiz internet təcrübəsi təqdim etmək məqsədi daşıyır. Xidmətin kəsintisiz və düzgün fəaliyyəti üçün aşağıdakı reqlamentlə tanış olmağınız tələb edilir.</p>

          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və Aktivləşdirmə Mərhələləri</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Rəsmi Lisenziya Təminatı:</b> Mirpanel tərəfindən istifadəçiyə seçilmiş paket müddətinə uyğun, tam aktiv və qanuni Surfshark VPN lisenziyası (giriş məlumatları) təqdim olunur.</li>
            <li><b>Operativ İstismar:</b> Giriş məlumatları təhvil verildikdən dərhal sonra hesabınız tam istifadəyə hazır vəziyyətdə olur. Heç bir gözləmə müddətinə ehtiyac yoxdur; tətbiqə daxil olaraq premium serverlərə anında qoşula bilərsiniz.</li>
            <li><b>Sadələşdirilmiş Quraşdırma:</b> Xidmətin interfeysi və istifadəsi tamamilə istifadəçi yönümlüdür. Qoşulmaq üçün heç bir əlavə proqramlaşdırma bacarığı, mürəkkəb texniki bilik və ya xüsusi konfiqurasiya (ayarlama) tələb olunmur.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Vacib Şərt – Fərdi İstifadə və 1 Cihaz Qaydası</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Cihaz Limiti:</b> Təqdim edilən Surfshark VPN lisenziyası müstəsna olaraq yalnız 1 (bir) cihazda (smartfon, fərdi kompüter, planşet və ya Smart TV) istifadə edilmək üçün nəzərdə tutulmuşdur.</li>
            <li><b>Paralel Giriş Qadağası:</b> Təhlükəsizlik və stabil sürət standartlarını qorumaq məqsədilə eyni hesabın eyni anda birdən çox cihazda aktivləşdirilməsi qəti şəkildə qadağandır.</li>
            <li><b style="color:#ff4757;">Məsuliyyət və Deaktivasiya:</b> Lisenziya məlumatlarının digər şəxslərlə paylaşılması və ya icazə verilən cihaz limitinin (1 cihaz) aşılması hesabın qlobal sistem tərəfindən avtomatik bloklanmasına (deaktivasiya) və zəmanət hüququnun dərhal ləğvinə səbəb olacaqdır.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Məxfilik Siyasəti və Texniki Dəstək</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Məlumat Sabitliyi:</b> Sistemin və zəmanətin qorunması məqsədilə təqdim edilən hesabın əsas qeydiyyat məlumatlarının (elektron poçt ünvanı, şifrə və s.) dəyişdirilməsinə cəhd edilməməlidir.</li>
            <li><b>Daimi Nəzarət və Zəmanət:</b> Aktiv paket müddəti ərzində bağlantı stabilliyi və hesabın fəaliyyəti tam zəmanət altındadır.</li>
            <li><b>Operativ Həll:</b> Tətbiqin quraşdırılması və ya serverlərə qoşulma zamanı hər hansı sual və ya çətinlik yaranarsa, Mirpanel Canlı Dəstək komandasına müraciət edərək texniki yardım əldə edə bilərsiniz.</li>
          </ul>
        `;
      }
      else if (p.id === "zoom") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">Zoom Pro – Xidmət Sazişi, Aktivləşdirmə Reqlamenti və İstismar Qaydaları</h3>
          <p>Zoom Pro abunəliyinin Mirpanel platforması tərəfindən təmin edilməsi istifadəçiyə tam təchizatlı və istifadəyə hazır hesab formatında təqdim olunur. Bu xidmət vasitəsilə onlayn görüşlərinizi, dərslərinizi və vebinarlarınızı heç bir vaxt məhdudiyyəti olmadan, tam peşəkar səviyyədə idarə edə bilərsiniz.</p>

          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və Aktivləşdirmə Mərhələləri</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Hesab Təqdimatı:</b> Sifariş təsdiqləndikdən dərhal sonra istifadəçiyə Zoom hesabının, eləcə də həmin hesaba bağlı elektron poçt ünvanının (mail) giriş məlumatları (şifrələri ilə birlikdə) tam şəkildə təhvil verilir.</li>
            <li><b>Platforma Quraşdırılması:</b> Xidmətdən yararlanmaq üçün Zoom tətbiqini rəsmi veb-saytdan (zoom.us) və ya mobil platformaların mağazalarından (App Store, Play Store) cihazınıza (kompüter, smartfon və ya planşet) yükləməyiniz tələb olunur.</li>
            <li><b>Sistemə Giriş:</b> Quraşdırma tamamlandıqdan sonra, yalnız təqdim edilən eksklüziv Zoom Pro hesab məlumatları vasitəsilə sistemə daxil olmalısınız.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Görüşlərin İdarə Edilməsi və Funksional Qaydalar</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Görüşlərin Planlaşdırılması:</b> Sistemə daxil olduqdan sonra “New Meeting” (Yeni Görüş) düyməsi ilə dərhal iclasa başlaya və ya “Schedule” (Planlaşdır) funksiyası vasitəsilə gələcək dərslərinizi və onlayn görüşlərinizi təqvimə əlavə edə bilərsiniz.</li>
            <li><b>İştirakçıların Dəvət Edilməsi:</b> Yaradılmış görüşün xüsusi keçid linkini və ya "Meeting ID" (Görüş İdentifikatoru) kodunu iştirakçılara göndərərək onların birbaşa onlayn otağa qoşulmasını təmin edə bilərsiniz.</li>
            <li><b>Peşəkar Alətlərin İstismarı:</b> Tədris və təqdimat prosesini daha effektiv etmək üçün "Share Screen" (Ekran Paylaşımı), interaktiv "Whiteboard" (Virtual Lövhə) və iştirakçıları qruplara bölmək üçün "Breakout Rooms" (Qrup Otaqları) funksiyalarından məhdudiyyətsiz istifadə edə bilərsiniz.</li>
            <li><b>Qeydiyyat və Yaddaş (Recording):</b> İclas və dərslərinizi gələcək istinadlar üçün qeydə ala, onları həm cihazınızın daxili yaddaşında (Local Recording), həm də sistemin təqdim etdiyi bulud (Cloud) yaddaşında təhlükəsiz şəkildə saxlaya bilərsiniz.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Texniki Dəstək və Zəmanət Öhdəliyi</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Daimi Nəzarət:</b> Xidmət müddəti ərzində hesabın stabil və kəsintisiz fəaliyyəti tam zəmanət altındadır.</li>
            <li><b>Operativ Həll:</b> Hesabın istifadəsi, quraşdırılması və ya idarə edilməsi zamanı hər hansı sual, texniki nasazlıq və ya çətinlik yaranarsa, vaxt itirmədən Mirpanel Canlı Dəstək komandasına müraciət edərək problemi operativ şəkildə həll edə bilərsiniz. ✅</li>
          </ul>
        `;
      }
      else if (p.id === "capcut") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">CapCut PRO – Xidmət Sazişi, Şəxsi Hesaba Aktivləşdirmə Reqlamenti və İstismar Qaydaları</h3>
          <p>CapCut PRO abunəliyi Mirpanel platforması tərəfindən tamamilə şəxsi (fərdi) hesab formatında təqdim olunur. Hesab istifadəyə tam hazır vəziyyətdə təhvil verilir və müvafiq təhlükəsizlik qaydalarına əsasən yalnız 1 ədəd cihazda istifadə üçün optimallaşdırılmışdır.</p>

          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və İcra Şərtləri</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Hesab Təqdimatı:</b> CapCut PRO hesabı istifadəçiyə xüsusi ayrılmış elektron poçt (e-mail) və giriş şifrəsi vasitəsilə təhvil verilir.</li>
            <li><b>Platforma Dəstəyi:</b> Profilə həm mobil tətbiq (iOS/Android), həm də masaüstü (Desktop) versiya üzərindən daxil olmaq mümkündür.</li>
            <li><b>Giriş Metodları:</b> Kompüter üzərindən QR kod vasitəsilə rahat giriş dəstəklənir (Qeyd: brauzer/veb versiyada bəzi funksiyalar məhdudlaşdırıla bilər).</li>
            <li><b>Avtomatik Aktivasiya:</b> Sistemə giriş tamamlandıqdan dərhal sonra bütün Premium/PRO funksiyalar avtomatik olaraq aktivləşir.</li>
            <li><b>Zəmanət və Dəstək:</b> Abunəlik müddəti ərzində Mirpanel tərəfindən istifadəçiyə kəsintisiz texniki dəstək təmin olunur.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Vacib Şərt – Şəxsi İstifadə və 1 Cihaz Qaydası</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Cihaz Limiti:</b> Hesab müstəsna olaraq şəxsi istifadə üçündür və yalnız 1 cihazda aktiv istifadə edilməlidir.</li>
            <li><b>Paralel Giriş:</b> Eyni anda bir neçə fərqli cihazdan paralel olaraq sistemə daxil olmaq qəti qadağandır.</li>
            <li><b>Cihaz Dəyişimi:</b> İstifadə edilən cihaz dəyişdiriləcəyi təqdirdə, yeni cihaza daxil olmazdan əvvəl köhnə cihazdakı profildən tamamilə çıxış (log out) edilməsi zəruridir.</li>
            <li><b style="color:#ff4757;">Qayda Pozuntusu:</b> Göstərilən reqlamentə riayət olunmaması hesabın avtomatik deaktivasiyasına və zəmanət hüququnun ləğvinə səbəb ola bilər.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Aktivləşdirmə Prosedurunun Gedişatı</h4>
          <p>Sifariş təsdiqləndikdən və giriş məlumatları istifadəçiyə təhvil verildikdən sonra, birbaşa CapCut tətbiqinə daxil olaraq PRO alətlərdən dərhal istifadəyə başlamaq mümkündür. Proses hər hansı əlavə SMS təsdiqi kodu və ya manual (əl ilə) aktivləşdirmə mərhələsi tələb etmir.</p>

          <h4 style="color:#00ff99; margin-bottom:5px;">Konfidensiallıq və Profilin Təhlükəsizlik Siyasəti</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Fərdi Təyinat:</b> Hesab tamamilə şəxsi sistem üzərindən idarə olunur və kənar şəxslərlə paylaşılmamalıdır.</li>
            <li><b>Məlumat Sabitliyi:</b> Sistemin və zəmanətin qorunması məqsədilə hesabın əsas qeydiyyat məlumatlarının (elektron poçt ünvanı, şifrə və s.) dəyişdirilməsi qadağandır.</li>
            <li><b>Deaktivasiya Riski:</b> Hesabın digər şəxslərlə paylaşılması və ya qeyri-normal (kütləvi) istifadəsi profilin bloklanma riskini artırır.</li>
            <li><b>Şəxsi Məsuliyyət:</b> Təqdim olunan giriş detallarının məxfiliyinin qorunması və təhlükəsizliyi birbaşa istifadəçinin şəxsi məsuliyyətindədir.</li>
          </ul>
        `;
      }
      else if (p.id === "chatgpt") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">ChatGPT Plus – Xidmət Sazişi, Şəxsi Hesaba Aktivləşdirmə Reqlamenti və Təhlükəsizlik Qaydaları</h3>
          <p>ChatGPT Plus abunəliyinin Mirpanel platforması tərəfindən təmin edilməsi birbaşa istifadəçinin şəxsi hesabı üzərindən həyata keçirilir. Bu üsulla hesab tamamilə fərdi istifadədə qalır və digər istifadəçilərlə (ortaq hesab kimi) paylaşılmır. Premium status birbaşa mövcud profilinizə inteqrasiya olunur və məlumatların yüksək məxfiliyi təmin edilir.</p>
          
          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və İcra Şərtləri</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Abunəlik Kateqoriyası:</b> Xidmət istifadəçiyə məxsus hesaba inteqrasiya edilərək OpenAI tərəfindən təqdim olunan ən son və qabaqcıl ChatGPT Plus abunəliyini aktivləşdirir.</li>
            <li><b>Tələb Edilən Məlumatlar:</b> Texniki əməliyyatın icrası üçün chatgpt.com platformasına aid elektron poçt ünvanı və giriş şifrəsinin təmin edilməsi mütləqdir.</li>
            <li><b>İcra Qrafiki:</b> Aktivləşdirmə proseduru ən qısa müddət ərzində, operativ şəkildə sistemə tətbiq olunur.</li>
            <li><b>Zəmanət və Dəstək:</b> Xidmət müddəti ərzində istifadəçiyə kəsintisiz texniki nəzarət və mütəmadi dəstək xidməti təqdim edilir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Təyinat Qrupu (Bu format kimlər üçün nəzərdə tutulub?)</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li>Hesabı və yazışmaları üzərində tam və təkbaşına nəzarətə malik olmaq istəyən istifadəçilər</li>
            <li>Fərdi məlumatlarının, layihələrinin və arxivinin gizliliyini qorumaq istəyən mütəxəssislər</li>
            <li>Ortaq hesabların yaratdığı sual limitlərindən və sistem məhdudiyyətlərindən azad olmaq istəyənlər</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">ChatGPT Plus Paketinin Əsas Üstünlükləri</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Ən Yeni Texnologiyaya Çıxış:</b> OpenAI tərəfindən təqdim edilən ən son və aktual GPT modelinə tam giriş hüququ.</li>
            <li><b>Prioritet və Sürətli Sistem:</b> Pik saatlarda belə növbə gözləmədən, daha sürətli cavabvermə və kəsintisiz platforma istifadəsi.</li>
            <li><b>Multimodal Funksionallıq:</b> Sənəd (fayl) yükləmə, vizual şəkillərin analizi və generasiyası, səsli dialoq və internetə birbaşa (Web Browsing) çıxış.</li>
            <li><b>Genişləndirilmiş İcra Potensialı:</b> Mürəkkəb kod yazma, peşəkar mətn yaradılması, dərin data analizi və bütün yaradıcı tapşırıqlar üçün məhdudiyyətsiz imkanlar.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Konfidensiallıq və Profilin Təhlükəsizlik Siyasəti</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Tam Fərdilik:</b> Hesab yalnız sifarişçiyə aiddir, hər hansı üçüncü şəxsin və ya kənar istifadəçinin profilə müdaxiləsi qeyri-mümkündür.</li>
            <li><b>Məhdud İstifadə:</b> Təqdim olunan giriş məlumatları müstəsna olaraq aktivləşdirmə prosesinin icrası üçün nəzərdə tutulub. Proses başa çatdıqdan sonra məlumatlar güvənli şəkildə idarə olunur.</li>
            <li><b>Məlumat Məxfiliyi:</b> Təhlükəsizlik standartlarını maksimum səviyyədə saxlamaq məqsədilə heç bir məlumat üçüncü tərəflərə ötürülmür. Fərdi təhlükəsizlik tədbiri olaraq, aktivasiya yekunlaşdıqdan sonra istifadəçiyə hesab şifrəsini yeniləmək tövsiyə olunur.</li>
          </ul>
        `;
      }
      else if (p.id === "netflix") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">Mirpanel: Netflix Premium (Şəxsi Otaq) Qaydaları</h3>
          
          <h4 style="color:#00ff99; margin-bottom:5px;">🔴 Vacib Qaydalar (Şəxsi Hesab):</h4>
          <ul style="list-style-type: none; padding-left:0; margin-bottom:15px; line-height: 1.6;">
            <li>✅ Hesab yalnız sizə aiddir.</li>
            <li>✅ Adı və PIN-i dəyişə bilərsiniz.</li>
            <li>✅ Telefonda, TV-də, noutbukda sərbəst istifadə edə bilərsiniz.</li>
            <li>🆘 Eyni anda bir neçə cihazdan istifadə etməyin — problem yarada bilər.</li>
            <li>➤ Cihaz dəyişəndə əvvəlkindən proqramı bağlayın (hesabdan çıxmayın).</li>
          </ul>

          <h4 style="color:#ff4757; margin-bottom:5px;">🚫 Qadağalar:</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li>Hesapın Şifrəsini dəyişmək qadağandır!</li>
            <li>Eyni anda 2 cihazdan baxmaq</li>
            <li>Şübhəli fəaliyyət</li>
            <li>Başqa otaqlara daxil olmaq</li>
          </ul>
        `;
      }
      else if (p.id === "spotify") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">Spotify Premium – Xidmət Sazişi, Aktivləşdirmə Reqlamenti və Təhlükəsizlik Qaydaları</h3>
          <p>Spotify Premium abunəliyinin Mirpanel platforması tərəfindən təmin edilməsi birbaşa istifadəçinin mövcud profili bazasında həyata keçirilir. Sistemə yeni hesabın əlavə edilməsinə ehtiyac yaranmır; Premium status cari profilə inteqrasiya olunur və bütün əvvəlki fərdi məlumatlar toxunulmaz qalır.</p>

          <h4 style="color:#00ff99; margin-bottom:5px;">Xidmətin Spesifikasiyaları və İcra Şərtləri</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Abunəlik Kateqoriyası:</b> Xidmət tamamilə istifadəçinin şəxsi profilinə yönəldilir və "Fərdi Premium" (Individual Premium) statusu olaraq sistemə tətbiq edilir.</li>
            <li><b>Tələb Edilən Məlumatlar:</b> Texniki əməliyyatın icrası üçün profilə aid düzgün elektron poçt ünvanı və giriş şifrəsinin təmin edilməsi mütləqdir.</li>
            <li><b>İcra Qrafiki:</b> Aktivləşdirmə proseduru standart rejimdə 10-15 dəqiqə ərzində həyata keçirilir. Sistemin iş yükündən asılı olaraq bu müddət maksimum 3 saata qədər uzana bilər.</li>
            <li><b>Məlumat Dəqiqliyi:</b> Təqdim edilən giriş detallarında hər hansı yanlışlıq və ya uyğunsuzluq olarsa, xidmətin təhvil verilmə müddətində gecikmələr yaşanacaqdır.</li>
            <li><b>Zəmanət və Dəstək:</b> Abunəlik müddəti tam şəkildə zəmanət altındadır və istifadəçiyə kəsintisiz texniki dəstək göstərilir.</li>
          </ul>

          <h4 style="color:#00ff99; margin-bottom:5px;">Aktivləşdirmə Prosedurunun Gedişatı</h4>
          <p>Sifariş zamanı təqdim olunan profil məlumatları yalnız abunəliyin təsdiqlənməsi və aktivləşdirilməsi prosesinin icrası üçün emal edilir. Proses uğurla yekunlaşdıqdan dərhal sonra həmin məlumatlar əməliyyat bazasından tamamilə silinir. İstifadəçinin əvvəlcədən formalaşdırdığı musiqi siyahıları (pleylistlər), bəyəndiyi treklər, izlədiyi podkastlar və hesabın ümumi alqoritm tarixçəsi tamamilə dəyişməz olaraq fəaliyyətinə davam edir.</p>
          <p style="color:#ff4757;"><b>Vacib Xatırlatma:</b> Sifarişin operativ və qüsursuz yerinə yetirilməsi üçün məlumatları daxil edərkən onların doğruluğunu mütləq şəkildə yoxlamağınız tələb olunur. Əks təqdirdə, prosesin ləngiməsi qaçılmazdır.</p>

          <h4 style="color:#00ff99; margin-bottom:5px;">Konfidensiallıq və Profilin Təhlükəsizlik Siyasəti</h4>
          <ul style="padding-left:20px; margin-bottom:15px;">
            <li><b>Məhdud İstifadə:</b> Təqdim olunan giriş məlumatları müstəsna olaraq aktivləşdirmə prosesinin texniki icrası üçün istifadə edilir.</li>
            <li><b>İnformasiya Məxfiliyi:</b> İstifadəçiyə aid heç bir fərdi məlumat və ya giriş detalı üçüncü tərəflərə ötürülmür, kommersiya məqsədləri üçün istifadə edilmir.</li>
            <li><b>Bazada Saxlanılmama Şərti:</b> Aktivasiya yekunlaşan kimi, profil məlumatları sistemin yaddaşından qalıcı olaraq ləğv edilir.</li>
            <li><b>Əlavə Təhlükəsizlik:</b> Şəxsi təhlükəsizlik standartlarını maksimum səviyyədə saxlamaq məqsədilə, xidmət təhvil verildikdən sonra istifadəçiyə hesab şifrəsini yeniləmək şiddətlə tövsiyə olunur.</li>
          </ul>
        `;
      }
      else {
        cBox.innerHTML = `
          <h3 style="color:#ffd400;margin-top:0;">İstifadə Qaydaları və Şərtlər</h3>
          <p>1. Bütün hesablar rəsmi və qanuni yollarla aktivləşdirilir.</p>
          <p>2. Sifariş verdikdən sonra 15-30 dəqiqə ərzində məlumatlar WhatsApp vasitəsilə sizə təqdim olunacaq.</p>
          <p>3. Şəxsi hesablarda şifrə dəyişmək sərbəstdir, lakin "Ümumi" (Shared) hesablarda şifrə və ya profil adını dəyişdirmək qəti qadağandır.</p>
          <p>4. Hər hansı texniki problem yaşanarsa, 7/24 Canlı Dəstək xidmətimizə müraciət edə bilərsiniz.</p>
        `;
      }
    }
  };

  tabs.forEach(t => t.onclick = () => showTab(t.getAttribute("data-target")));
  showTab("tab-about"); 
}

/* =========================
   SİFARİŞ FORMLARI VƏ YÖNLƏNDİRMƏ (AĞILLI SİSTEM + XƏBƏRDARLIQLAR)
   ========================= */
document.getElementById("pp-order-btn")?.addEventListener("click", () => {
  if(!currentProduct) return;
  const plan = currentProduct.plans[currentPlanIdx];
  if(plan.price <= 0) return alert(UI.stokOut);
  
  document.getElementById("modal").classList.add("show");
  lockBodyScroll();
  
  const id = currentProduct.id;

  if (id === "tiktok_jeton") {
      showTikTokJetonForm(currentProduct, plan);
  } else if (id === "netflix" || id === "prime") {
      showNameCodeForm(currentProduct, plan, id === "netflix" ? 4 : 5);
  } else if (id === "spotify") {
      showSpotifyWarning(currentProduct, plan);
  } else if (id === "chatgpt") {
      showChatGPTWarning(currentProduct, plan);
  } else if (id === "youtube") {
      // YENİ ƏLAVƏ EDİLƏN YOUTUBE XƏBƏRDARLIĞI
      showYoutubeWarningForm(currentProduct, plan);
  } else if (id === "canva" || id === "google_ai" || id === "google_ai_ultra" || id === "captions" || id === "grok_supergrok" || id === "claude_ai" || id === "adobecc" || id === "duolingo") {
      showEmailOnlyForm(currentProduct, plan);
  } else {
      showConfirmOnlyForm(currentProduct, plan);
  }
});

function showSpotifyWarning(p, plan) {
  document.getElementById("mForm").innerHTML = `
    <div class="mpForm" style="text-align:left;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom: 15px;">
        <div style="background:#332b00; padding:8px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffd400" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        </div>
        <span class="mpFormTitle" style="margin:0;">Diqqət!</span>
      </div>
      <div style="color:#d1d5db; font-size:14px; line-height: 1.6; margin-bottom:15px;">
        Şəxsi hesabınızda rəsmi <b>Spotify Premium</b> paketi aktivləşdirilir. Platforma öz qaydalarına əsasən abunəliyi dayandıra bilər, lakin bu çox nadir hallarda baş verir və ödəniş geri qaytarılmır.
      </div>
      <div style="color:#d1d5db; font-size:14px; line-height: 1.6; margin-bottom:25px;">
        Hesab məlumatlarını düzgün qeyd etdiyinizdən əmin olun. Şifrəni unutmusunuzsa, buradan yeniləyə bilərsiniz: <a href="https://www.spotify.com/password-reset/" target="_blank" style="color:#60a5fa; text-decoration:underline;">password-reset</a>
      </div>
      <div style="display:flex; gap:10px;">
        <button id="sp_cancel" class="mpBtn" style="background:#374151; color:#fff; flex:1;">Ləğv et</button>
        <button id="sp_confirm" class="mpBtn" style="background:#f3f4f6; color:#000; flex:1;">Təsdiqləyirəm</button>
      </div>
    </div>
  `;

  document.getElementById("sp_cancel").onclick = () => { closeModal(); };
  document.getElementById("sp_confirm").onclick = () => { showEmailPassForm(p, plan); };
}

function showChatGPTWarning(p, plan) {
  document.getElementById("mForm").innerHTML = `
    <div class="mpForm" style="text-align:left;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom: 15px;">
        <div style="background:#00331a; padding:8px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ff99" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        </div>
        <span class="mpFormTitle" style="margin:0;">Təhlükəsizlik Bildirişi</span>
      </div>
      <div style="color:#d1d5db; font-size:14px; line-height: 1.6; margin-bottom:15px;">
        <b>ChatGPT Plus</b> birbaşa sizin şəxsi hesabınızda aktivləşdiriləcəkdir. Hesabınızın məxfiliyi tam olaraq qorunur.
      </div>
      <div style="color:#d1d5db; font-size:14px; line-height: 1.6; margin-bottom:25px;">
        Aktivləşdirmə tamamlandıqdan sonra şəxsi təhlükəsizliyiniz üçün şifrənizi dəyişdirməyiniz tövsiyə olunur.
      </div>
      <div style="display:flex; gap:10px;">
        <button id="cg_cancel" class="mpBtn" style="background:#374151; color:#fff; flex:1;">Ləğv et</button>
        <button id="cg_confirm" class="mpBtn" style="background:#f3f4f6; color:#000; flex:1;">Davam et</button>
      </div>
    </div>
  `;

  document.getElementById("cg_cancel").onclick = () => { closeModal(); };
  document.getElementById("cg_confirm").onclick = () => { showEmailPassForm(p, plan); };
}

function showYoutubeWarningForm(p, plan) {
  document.getElementById("mForm").innerHTML = `
    <div class="mpForm" style="text-align:left;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom: 15px;">
        <div style="background:#330000; padding:8px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff4757" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <span class="mpFormTitle" style="margin:0; color:#ff4757;">Diqqət!</span>
      </div>
      <div style="color:#d1d5db; font-size:14px; line-height: 1.6; margin-bottom:15px;">
        Təqdim edilən hesab <b>yeni Gmail</b> olmalı və heç bir ailə planına qoşulmamalıdır.
      </div>
      <div style="color:#d1d5db; font-size:14px; line-height: 1.6; margin-bottom:15px;">
        Şəxsi hesabınızda rəsmi <b>YouTube Premium</b> paketi aktivləşdirilir.
      </div>
      <div style="color:#d1d5db; font-size:14px; line-height: 1.6; margin-bottom:25px;">
        Hesab məlumatlarını düzgün qeyd etdiyinizdən əmin olun.
      </div>
      <div style="display:flex; gap:10px;">
        <button id="yt_cancel" class="mpBtn" style="background:#374151; color:#fff; flex:1;">Ləğv et</button>
        <button id="yt_confirm" class="mpBtn" style="background:#f3f4f6; color:#000; flex:1;">Təsdiq edirəm</button>
      </div>
    </div>
  `;

  document.getElementById("yt_cancel").onclick = () => { closeModal(); };
  
  // Təsdiq edildikdən sonra sisteminizdə artıq hazır olan "Sadecə Gmail İstəmə" (showEmailOnlyForm) formuna keçid edir
  document.getElementById("yt_confirm").onclick = () => { showEmailOnlyForm(p, plan); };
}

function showConfirmOnlyForm(p, plan) {
  document.getElementById("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle" style="margin-bottom: 10px;">Sifarişi Təsdiqlə</div>
      <div style="text-align:center; color:#ccc; font-size:14px; margin-bottom:20px; line-height: 1.5;">
         Siz <b>${p.title}</b> (${plan.label || plan.months + ' aylıq'}) sifariş edirsiniz.<br><br>
         Bu məhsul <b>Hazır Hesab (Login/Şifrə)</b> şəklində təqdim edilir. Sifarişi təsdiqləyərək hesabı WhatsApp-dan təhvil ala bilərsiniz.
      </div>
      <button id="c_send" class="mpBtn">Sifarişi Təsdiqlə</button>
    </div>
  `;
  document.getElementById("c_send").onclick = () => {
    sendWA(p, plan, "");
    closeModal();
  };
}

function showEmailPassForm(p, plan) {
  document.getElementById("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">${UI.formTitle}</div>
      <div>
        <div class="mpLabel">${UI.emailLabel}</div>
        <input id="ep_email" class="mpInput" placeholder="misal@gmail.com">
      </div>
      <div style="margin-top:10px">
        <div class="mpLabel">${UI.passLabel}</div>
        <input id="ep_pass" class="mpInput" type="text" placeholder="Hesabınızın şifrəsi">
      </div>
      <button id="ep_send" class="mpBtn">${UI.sendWa}</button>
    </div>
  `;
  document.getElementById("ep_send").onclick = () => {
    const email = document.getElementById("ep_email").value.trim(), pass = document.getElementById("ep_pass").value.trim();
    if(!email || !pass) return alert("Zəhmət olmasa bütün məlumatları daxil edin.");
    sendWA(p, plan, `Hesab (E-poçt): ${email}\nŞifrə: ${pass}`);
    closeModal();
  };
}

function showNameCodeForm(p, plan, digits) {
  let cpLabel = digits + UI.codePlace; 
  document.getElementById("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">${UI.formTitle}</div>
      <div class="mpGrid2">
        <div><div class="mpLabel">${UI.nameLabel}</div><input id="x_name" class="mpInput" placeholder="${UI.namePlace}"></div>
        <div><div class="mpLabel">${cpLabel}</div><input id="x_code" class="mpInput" type="number" placeholder="${cpLabel}"></div>
      </div>
      <button id="x_send" class="mpBtn">${UI.sendWa}</button>
    </div>`;
  document.getElementById("x_send").onclick = () => {
    const name = document.getElementById("x_name").value.trim(), code = document.getElementById("x_code").value.trim();
    if(!name) return alert(UI.reqName);
    if(code.length !== digits) return alert(UI.reqCode);
    sendWA(p, plan, `Profil Adı: ${name}\nPIN Kod: ${code}`);
    closeModal();
  };
}

function showEmailOnlyForm(p, plan) {
  document.getElementById("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">${UI.formTitle}</div>
      <div>
        <div class="mpLabel">${UI.emailLabel} (Aktivləşmə üçün)</div>
        <input id="e_email" class="mpInput" placeholder="misal@gmail.com">
      </div>
      <button id="e_send" class="mpBtn">${UI.sendWa}</button>
    </div>`;
  document.getElementById("e_send").onclick = () => {
    const email = document.getElementById("e_email").value.trim();
    if(!email.includes("@")) return alert(UI.reqEmail);
    sendWA(p, plan, `Aktivləşdiriləcək Gmail: ${email}`);
    closeModal();
  };
}

function showTikTokJetonForm(p, plan) {
  document.getElementById("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">TikTok Jeton</div>
      <div class="mpGrid2">
        <div><div class="mpLabel">${UI.ttCoin}</div><input id="tt_coin" class="mpInput" type="number" value="500"></div>
        <div><div class="mpLabel">${UI.ttPrice}</div><input id="tt_price" class="mpInput" value="10.00 ₼" readonly></div>
      </div>
      <div style="margin-top:10px">
        <div class="mpLabel">${UI.ttUser}</div>
        <input id="tt_user" class="mpInput" placeholder="${UI.ttUserPlace}">
      </div>
      <div style="margin-top:10px">
        <div class="mpLabel">${UI.passLabel}</div>
        <input id="tt_pass" class="mpInput" placeholder="TikTok Şifrəniz">
      </div>
      <button id="tt_send" class="mpBtn">${UI.sendWa}</button>
    </div>`;
  
  const coinEl = document.getElementById("tt_coin"), priceEl = document.getElementById("tt_price");
  coinEl.oninput = () => { 
      const c = Number(coinEl.value); 
      priceEl.value = c < 500 ? "Min 500" : ((c / 500) * 10).toFixed(2) + " ₼"; 
  };
  
  document.getElementById("tt_send").onclick = () => {
    const c = Number(coinEl.value), user = document.getElementById("tt_user").value.trim(), pass = document.getElementById("tt_pass").value.trim();
    if(c < 500 || !user || !pass) return alert("Zəhmət olmasa bütün məlumatları doldurun və minimum 500 jeton seçin.");
    window.open(PHONE_WA + "?text=" + encodeURIComponent(`Salam.\nMəhsul: TikTok Jeton\nSay: ${c}\nQiymət: ${((c/500)*10).toFixed(2)} ₼\nİstifadəçi: ${user}\nŞifrə: ${pass}`), "_blank");
    closeModal();
  };
}

/* =========================
   SİFARİŞ FORMLARI VƏ YÖNLƏNDİRMƏ BÖLMƏSİNDƏKİ ƏSAS YÖNLƏNDİRMƏ FUNKSİYASI
   ========================= */
function sendWA(p, plan, extra) {
  const tPlan = plan.label ? plan.label : `${plan.months} aylıq`;
  
  // 1. Təsadüfi və unikal 5 rəqəmli Sifariş Nömrəsi yaradırıq (məs: 58392)
  const orderId = Math.floor(10000 + Math.random() * 90000);

  // 2. SİZİN GOOGLE SCRIPT LİNKİNİZ (Bura kopyaladığınız linki yapışdırdıq)
  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw8eRhDxBhq5Kf68eVQBAnqf9llgo1bQWKgdwpBa0utRgVwn6rKd9YUCP6e70iPbHTMOg/exec";

  // 3. Cədvələ göndəriləcək məlumatları paketləyirik
  const formData = new FormData();
  formData.append('orderId', orderId); // Sifariş nömrəsini cədvələ göndəririk
  formData.append('product', p.title);
  formData.append('plan', tPlan);
  formData.append('price', plan.price + ' ' + p.currency);
  formData.append('extra', extra); // E-poçt, şifrə və s. F sütununa düşəcək

  // 4. Arxa fonda məlumatı Google Sheets-ə göndəririk
  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    body: formData
  }).catch(err => {
    console.error("Cədvələ yazılmada xəta:", err);
  });

  // 5. WhatsApp mesajını hazırlayırıq (Sifariş nömrəsi ilə birlikdə)
  const waMessage = `Salam, sifariş etmək istəyirəm.\n\nSifariş №: ${orderId}\nMəhsul: ${p.title}\nMüddət: ${tPlan}\nQiymət: ${plan.price} ${p.currency}\n\n${extra}`;
  
  // 6. WhatsApp-ı açırıq
  window.open(PHONE_WA + "?text=" + encodeURIComponent(waMessage), "_blank");
}
function closeModal() {
  const mod = document.getElementById("modal");
  if(mod) mod.classList.remove("show");
  unlockBodyScroll();
}

function getMinPrice(p) { return Math.min(...(p.plans||[]).filter(x => x.price > 0).map(x => x.price)); }
function formatPrice(n) { return Number(n).toFixed(2); }
function esc(s) { return String(s ?? "").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }

/* =========================
   SLAYDER (CAROUSEL)
   ========================= */
let currentSlide = 0;
let slideInterval;

function initSlider() {
  const slides = document.querySelectorAll('.slide');
  const dots = document.querySelectorAll('.dot');
  const nextBtn = document.querySelector('.next-arrow');
  const prevBtn = document.querySelector('.prev-arrow');

  if (!slides.length) return;

  function showSlide(n) {
    slides.forEach(s => s.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));
    
    currentSlide = (n + slides.length) % slides.length;
    slides[currentSlide].classList.add('active');
    if (dots[currentSlide]) dots[currentSlide].classList.add('active');
  }

  function nextSlide() { showSlide(currentSlide + 1); }
  function prevSlide() { showSlide(currentSlide - 1); }

  if (nextBtn) nextBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); nextSlide(); resetTimer(); };
  if (prevBtn) prevBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); prevSlide(); resetTimer(); };

  dots.forEach((dot, idx) => {
    dot.onclick = (e) => { e.preventDefault(); e.stopPropagation(); showSlide(idx); resetTimer(); };
  });

  slides.forEach(slide => {
    slide.addEventListener('click', (e) => {
      if (e.target.classList.contains('slider-arrow') || e.target.closest('.slider-arrow')) return;
      if (e.target.classList.contains('dot') || e.target.closest('.slider-dots')) return;

      const targetId = slide.getAttribute('data-target');
      if (targetId) window.openProductPage(targetId);
    });
  });

  function startTimer() {
    clearInterval(slideInterval);
    slideInterval = setInterval(nextSlide, 3000);
  }
  function resetTimer() { startTimer(); }
  startTimer();
}

/* =========================
   SAYTIN AÇILIŞI VƏ GRID
   ========================= */
const $ = (id) => document.getElementById(id);
let activeCat = "all";

function setupUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if(UI[key]) {
       if (el.tagName.toLowerCase() === 'input' && el.hasAttribute('placeholder')) {
           el.placeholder = UI[key];
       } else {
           el.innerHTML = UI[key]; 
       }
    }
  });
  
  const searchInp = document.getElementById("q");
  if(searchInp) searchInp.placeholder = UI.search;

  buildTabs();
  renderGrid();
  renderBundleModal(); 
}

function buildTabs() {
  const tabs = document.getElementById("tabs");
  if (!tabs) return;
  tabs.innerHTML = "";
  DATA.categories.forEach((c) => {
    const el = document.createElement("div");
    el.className = "tab" + (c.key === activeCat ? " active" : "");
    el.textContent = c.name;
    el.onclick = () => { activeCat = c.key; [...tabs.children].forEach((x) => x.classList.remove("active")); el.classList.add("active"); renderGrid(); };
    tabs.appendChild(el);
  });
}

function renderGrid() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  const searchInp = document.getElementById("q");
  const q = (searchInp?.value || "").trim().toLowerCase();
  
  const list = DATA.products.filter((p) => (activeCat === "all" ? true : p.category === activeCat)).filter((p) => {
    if (!q) return true;
    const blob = [p.title, p.desc, p.category, p.variant].join(" ").toLowerCase();
    return blob.includes(q);
  });
  
  grid.innerHTML = list.map((p, idx) => cardHTML(p, idx)).join("");
}

function cardHTML(p, idx) {
  const min = getMinPrice(p);
  const showPrice = p.id === "tiktok_jeton" ? `10.00 ${p.currency}` : (min != null && min !== Infinity && min !== 0 ? `${formatPrice(min)} ${p.currency}` : "—");
  return `
    <div class="card" onclick="window.openProductPage('${p.id}')" style="animation-delay:${Math.min(idx * 0.03, 0.25)}s">
      <div class="imgWrap"><img class="img" src="${p.image}" alt=""><div class="cornerPrice">${showPrice}</div></div>
      <div class="pad">
        <div class="topline"><h3 class="title">${esc(p.title)}</h3><div class="badge">${esc(p.badge)}</div></div>
        <div class="meta">${esc(p.desc)}</div>
        <div class="priceRow"><button class="btn primary" type="button">${UI.orderBtn}</button></div>
      </div>
    </div>
  `;
}

/* =========================
   BUNDLE (PAKET YARAT) MƏNTİQİ
   ========================= */
let selectedBundle = []; 

function renderBundleModal() {
  const grid = document.getElementById("bmGrid");
  if (!grid) return;
  grid.innerHTML = "";
  
  DATA.products.forEach(p => {
    const minPrice = getMinPrice(p);
    const isOut = minPrice === Infinity || minPrice === 0;
    const isTikTok = p.id === "tiktok_jeton";
    const priceToShow = isTikTok ? 10.00 : (isOut ? 0 : minPrice);
    
    const el = document.createElement("div");
    el.className = `bmItem ${isOut && !isTikTok ? "disabled" : ""} ${selectedBundle.includes(p.id) ? "active" : ""}`;
    
    const priceText = isOut && !isTikTok ? UI.outStock : `${priceToShow.toFixed(2)} ₼`;

    el.innerHTML = `
      <img src="${p.image}" alt="">
      <div class="bmItemName">${p.title}</div>
      <div class="bmItemPrice">${priceText}</div>
    `;

    if (!isOut || isTikTok) {
      el.addEventListener("click", () => {
        if (selectedBundle.includes(p.id)) {
          selectedBundle = selectedBundle.filter(id => id !== p.id); 
          el.classList.remove("active");
        } else {
          selectedBundle.push(p.id); 
          el.classList.add("active");
        }
        calcBundleModalTotal();
      });
    }
    grid.appendChild(el);
  });
  calcBundleModalTotal(); 
}

function renderBundleForm() {
  const formEl = document.querySelector(".bmForm");
  if (!formEl) return;

  if (selectedBundle.length === 0) {
    formEl.innerHTML = "";
    return;
  }

  const currentValues = {
    name: document.getElementById("bm_name")?.value || "",
    email: document.getElementById("bm_email")?.value || "",
    nxCode: document.getElementById("bm_nx_code")?.value || "",
    prCode: document.getElementById("bm_pr_code")?.value || "",
    spPass: document.getElementById("bm_sp_pass")?.value || "",
    ttUser: document.getElementById("bm_tt_user")?.value || "",
    ttPass: document.getElementById("bm_tt_pass")?.value || ""
  };

  let req = { email: false, nxCode: false, prCode: false, spPass: false, ttUser: false, ttPass: false };

  selectedBundle.forEach(id => {
    if (['spotify', 'canva', 'chatgpt', 'youtube', 'google_ai'].includes(id)) req.email = true;
    if (id === 'netflix') req.nxCode = true;
    if (id === 'prime') req.prCode = true;
    if (id === 'spotify') req.spPass = true;
    if (id === 'tiktok_jeton') { req.ttUser = true; req.ttPass = true; }
  });

  let html = `<div class="bmInputGrp"><label>${UI.bmName}</label><input type="text" id="bm_name" placeholder="..."></div>`;

  if (req.email) html += `<div class="bmInputGrp"><label>${UI.bmEmail}</label><input type="text" id="bm_email" placeholder="misal@gmail.com"></div>`;
  if (req.nxCode) html += `<div class="bmInputGrp"><label>${UI.bmNxCode}</label><input type="number" id="bm_nx_code" placeholder="****"></div>`;
  if (req.prCode) html += `<div class="bmInputGrp"><label>${UI.bmPrCode}</label><input type="number" id="bm_pr_code" placeholder="*****"></div>`;
  if (req.spPass) html += `<div class="bmInputGrp"><label>${UI.bmSpPass}</label><input type="text" id="bm_sp_pass" placeholder="Şifrəniz..."></div>`;
  if (req.ttUser) html += `<div class="bmInputGrp"><label>${UI.bmTtUser}</label><input type="text" id="bm_tt_user" placeholder="@istifadeci"></div>`;
  if (req.ttPass) html += `<div class="bmInputGrp"><label>${UI.bmTtPass}</label><input type="text" id="bm_tt_pass" placeholder="Şifrəniz..."></div>`;

  formEl.innerHTML = html;

  if (document.getElementById("bm_name")) document.getElementById("bm_name").value = currentValues.name;
  if (document.getElementById("bm_email")) document.getElementById("bm_email").value = currentValues.email;
  if (document.getElementById("bm_nx_code")) document.getElementById("bm_nx_code").value = currentValues.nxCode;
  if (document.getElementById("bm_pr_code")) document.getElementById("bm_pr_code").value = currentValues.prCode;
  if (document.getElementById("bm_sp_pass")) document.getElementById("bm_sp_pass").value = currentValues.spPass;
  if (document.getElementById("bm_tt_user")) document.getElementById("bm_tt_user").value = currentValues.ttUser;
  if (document.getElementById("bm_tt_pass")) document.getElementById("bm_tt_pass").value = currentValues.ttPass;
}

function calcBundleModalTotal() {
  let total = 0;
  selectedBundle.forEach(id => {
    const p = DATA.products.find(x => x.id === id);
    if (p) {
      if (p.id === "tiktok_jeton") total += 10.00; 
      else total += getMinPrice(p);
    }
  });

  const discount = total > 0 ? total * 0.05 : 0;
  const finalPrice = total - discount;

  document.getElementById("bmTotal").textContent = `${total.toFixed(2)} ₼`;
  document.getElementById("bmDiscount").textContent = `-${discount.toFixed(2)} ₼`;
  document.getElementById("bmFinal").textContent = `${finalPrice.toFixed(2)} ₼`;

  renderBundleForm();
}

document.getElementById("bmSubmit")?.addEventListener("click", () => {
  if (selectedBundle.length === 0) return alert("Paket boşdur");
  
  const nameEl = document.getElementById("bm_name");
  const emailEl = document.getElementById("bm_email");
  const nxCodeEl = document.getElementById("bm_nx_code");
  const prCodeEl = document.getElementById("bm_pr_code");
  const spPassEl = document.getElementById("bm_sp_pass");
  const ttUserEl = document.getElementById("bm_tt_user");
  const ttPassEl = document.getElementById("bm_tt_pass");
  
  if (nameEl && !nameEl.value.trim()) return alert(UI.reqName);
  if (emailEl && !emailEl.value.trim().includes("@")) return alert(UI.reqEmail);
  if (nxCodeEl && nxCodeEl.value.trim().length !== 4) return alert("Netflix kodunu 4 rəqəmli daxil edin.");
  if (prCodeEl && prCodeEl.value.trim().length !== 5) return alert("Prime kodunu 5 rəqəmli daxil edin.");
  if (spPassEl && !spPassEl.value.trim()) return alert("Şifrəni daxil edin.");
  if (ttUserEl && !ttUserEl.value.trim()) return alert("TikTok istifadəçi adını yazın");
  if (ttPassEl && !ttPassEl.value.trim()) return alert("TikTok şifrəsini yazın");
  
  let total = 0;
  let itemsText = "";
  
  selectedBundle.forEach((id, idx) => {
    const p = DATA.products.find(x => x.id === id);
    let price = p.id === "tiktok_jeton" ? 10.00 : getMinPrice(p);
    total += price;
    itemsText += `${idx + 1}. ${p.title} (${price.toFixed(2)} ₼)\n`;
  });
  
  const discount = total * 0.05;
  const finalPrice = total - discount;

  let msg = `🎁 Salam, mən Xüsusi Paket yaratdım!\n\n`;
  if (nameEl) msg += `Ad: ${nameEl.value.trim()}\n`;
  if (emailEl) msg += `Gmail: ${emailEl.value.trim()}\n`;
  if (nxCodeEl) msg += `Netflix Kodu: ${nxCodeEl.value.trim()}\n`;
  if (prCodeEl) msg += `Prime Kodu: ${prCodeEl.value.trim()}\n`;
  if (spPassEl) msg += `Spotify Şifrəsi: ${spPassEl.value.trim()}\n`;
  if (ttUserEl) msg += `TikTok İstifadəçi: ${ttUserEl.value.trim()}\n`;
  if (ttPassEl) msg += `TikTok Şifrə: ${ttPassEl.value.trim()}\n`;

  msg += `\nSifarişlərim:\n${itemsText}\nCəmi: ${total.toFixed(2)} ₼\nEndirim (5%): -${discount.toFixed(2)} ₼\nÖdəniləcək Məbləğ: *${finalPrice.toFixed(2)} ₼*`;
  
  window.open(PHONE_WA + "?text=" + encodeURIComponent(msg), "_blank");
});

document.getElementById("bundleFab")?.addEventListener("click", () => {
  document.getElementById("bundleModal").classList.add("show");
  lockBodyScroll();
  renderBundleModal();
});

document.getElementById("bundleClose")?.addEventListener("click", () => {
  document.getElementById("bundleModal").classList.remove("show");
  unlockBodyScroll();
});

/* =========================
   MÜZİK VƏ SPLASH
   ========================= */
function initPlayer() {
  const PLAYLIST = [{ title: "Mutlu Bir Son", artist: "Adil Kulalı", src: "assets/music.mp3" }, { title: "Alkışlar", artist: "Erdem Kinay", src: "assets/music1.mp3" }];
  let trackIndex = 0, isPlaying = false;
  const audio = document.getElementById("bgAudio");
  const playBtn = document.getElementById("playBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const ui = document.getElementById("playerUI");
  
  if (!audio) return;
  function loadTrack(i) {
    audio.src = PLAYLIST[i].src; 
    document.getElementById("trackTitle").textContent = PLAYLIST[i].title; 
    document.getElementById("trackSub").textContent = PLAYLIST[i].artist; 
    document.getElementById("trackCount").textContent = `${i + 1}/${PLAYLIST.length}`;
  }
  function setUI(on) { isPlaying = on; playBtn.textContent = on ? "⏸" : "▶️"; ui.classList.toggle("playing", on); }
  playBtn.onclick = async () => { try { if (!isPlaying) { await audio.play(); setUI(true); } else { audio.pause(); setUI(false); } } catch(e){} };
  prevBtn.onclick = () => { trackIndex = (trackIndex - 1 + PLAYLIST.length) % PLAYLIST.length; loadTrack(trackIndex); if(isPlaying) audio.play(); };
  nextBtn.onclick = () => { trackIndex = (trackIndex + 1) % PLAYLIST.length; loadTrack(trackIndex); if(isPlaying) audio.play(); };
  audio.onended = () => nextBtn.onclick();
  loadTrack(0);
}

let savedScrollY = 0;
function lockBodyScroll() { savedScrollY = window.scrollY || 0; document.documentElement.classList.add("modalOpen"); document.body.classList.add("modalOpen"); document.body.style.position = "fixed"; document.body.style.top = `-${savedScrollY}px`; document.body.style.width = "100%"; }
function unlockBodyScroll() { document.body.style.position = ""; document.body.style.top = ""; document.body.style.width = ""; document.documentElement.classList.remove("modalOpen"); document.body.classList.remove("modalOpen"); window.scrollTo(0, savedScrollY); }

function initSplash() {
  const splash = document.getElementById('newSplashScreen');
  if (splash) {
    setTimeout(() => { splash.style.opacity = '0'; splash.style.visibility = 'hidden'; splash.style.pointerEvents = 'none'; }, 1500); 
  }
}

function boot() {
  initSplash();
  setupUI();
  initPlayer();
  initSlider(); 
  document.getElementById("q")?.addEventListener("input", renderGrid);
  document.getElementById("closeModal")?.addEventListener("click", closeModal);
  document.getElementById("modal")?.addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
}

/* =========================
   SONSUZ LÜKS OYUN MƏRKƏZİ
   ========================= */
const gBtnOpen = document.getElementById("gameBtnOpen");
const gSelectModal = document.getElementById("gameSelectModal");
const gSelectClose = document.getElementById("gameSelectClose");

const gPlayModal = document.getElementById("gamePlayModal");
const gPlayClose = document.getElementById("gamePlayClose");
const activeGameTitle = document.getElementById("activeGameTitle");
const activeGameSub = document.getElementById("activeGameSub");

const flappyArea = document.getElementById("flappyArea");
const towerArea = document.getElementById("towerArea");
const gStartScr = document.getElementById("gmStartScreen");
const gResultScr = document.getElementById("gmResultScreen");
const gStartBtn = document.getElementById("gmStartBtn");
const gRetryBtn = document.getElementById("gmRetryBtn");
const gmBackMenuBtn = document.getElementById("gmBackMenuBtn");

let currentGame = ""; 

gBtnOpen?.addEventListener("click", () => { gSelectModal.classList.add("show"); lockBodyScroll(); });
gSelectClose?.addEventListener("click", () => { gSelectModal.classList.remove("show"); unlockBodyScroll(); });
gPlayClose?.addEventListener("click", () => { gPlayModal.classList.remove("show"); unlockBodyScroll(); stopCurrentGame(); });
gmBackMenuBtn?.addEventListener("click", () => { gPlayModal.classList.remove("show"); gSelectModal.classList.add("show"); stopCurrentGame(); });

document.querySelectorAll('.gameOptCard').forEach(card => {
  card.addEventListener('click', () => {
    currentGame = card.getAttribute('data-game');
    gSelectModal.classList.remove("show");
    gPlayModal.classList.add("show");
    prepareGameScreen();
  });
});

function prepareGameScreen() {
  stopCurrentGame(); 
  gResultScr.style.display = "none";
  gStartScr.style.display = "flex";

  if (currentGame === "flappy") {
    activeGameTitle.textContent = UI.game1Title;
    activeGameSub.textContent = UI.game1Desc;
    document.getElementById("gmStartRule").textContent = UI.flappyRule;
    document.getElementById("gmStartIcon").textContent = "🦅";
    flappyArea.style.display = "block";
    towerArea.style.display = "none";
    initFlappy();
  } else if (currentGame === "tower") {
    activeGameTitle.textContent = UI.game2Title;
    activeGameSub.textContent = UI.game2Desc;
    document.getElementById("gmStartRule").textContent = UI.tapperRule;
    document.getElementById("gmStartIcon").textContent = "🍰";
    flappyArea.style.display = "none";
    towerArea.style.display = "block";
    initTower();
  }
}

gStartBtn?.addEventListener("click", () => {
  gStartScr.style.display = "none";
  if (currentGame === "flappy") startFlappy();
  if (currentGame === "tower") startTower();
});

gRetryBtn?.addEventListener("click", () => {
  gResultScr.style.display = "none";
  if (currentGame === "flappy") startFlappy();
  if (currentGame === "tower") startTower();
});

function stopCurrentGame() {
  stopFlappy();
  stopTower();
}

function endGameGlobal(gameType, finalScore) {
  if (gameType === "flappy") stopFlappy();
  if (gameType === "tower") stopTower();

  gResultScr.style.display = "flex";
  document.getElementById("gmResultTitle").textContent = UI.gameLose; 
  document.getElementById("gmResultTitle").style.color = "#ffd400";
  document.getElementById("gmResultText").textContent = `Sənin xalın: ${finalScore}. Əla nəticədir!`;
}

/* OYUN 1: FLAPPY */
const fCanvas = document.getElementById("flappyCanvas");
let fCtx; if(fCanvas) fCtx = fCanvas.getContext("2d");
let fBird, fPipes, fScore, fIsRunning, fLoop;
let fStars = []; let fWinds = [];

function initFlappy() { 
  fBird = { x: 60, y: 200, w: 34, h: 24, vy: 0 }; 
  fPipes = []; fScore = 0; fIsRunning = false; 
  fStars = []; for(let i=0; i<70; i++) fStars.push({x: Math.random()*320, y: Math.random()*480, s: Math.random()*1.5 + 0.5, a: Math.random()});
  fWinds = []; for(let i=0; i<5; i++) fWinds.push({x: Math.random()*320, y: Math.random()*480, w: Math.random()*40+20, s: Math.random()*4+4});
  drawFlappy(); 
}
function startFlappy() { initFlappy(); fIsRunning = true; window.addEventListener("keydown", fFlap); fCanvas.addEventListener("touchstart", fFlap, {passive: false}); fCanvas.addEventListener("mousedown", fFlap); fLoop = requestAnimationFrame(flappyLoop); }
function stopFlappy() { fIsRunning = false; cancelAnimationFrame(fLoop); window.removeEventListener("keydown", fFlap); if(fCanvas) { fCanvas.removeEventListener("touchstart", fFlap); fCanvas.removeEventListener("mousedown", fFlap); } }
function fFlap(e) { if (!fIsRunning) return; if (e.code === "Space" || e.type === "touchstart" || e.type === "mousedown") { fBird.vy = -6; if (e.type === "touchstart") e.preventDefault(); } }

function flappyLoop() {
  if (!fIsRunning) return;
  fBird.vy += 0.35; fBird.y += fBird.vy;
  if (fBird.y + fBird.h > fCanvas.height || fBird.y < 0) return endGameGlobal("flappy", fScore);
  if (fPipes.length === 0 || fPipes[fPipes.length - 1].x < fCanvas.width - 250) { 
    let topH = Math.random() * (fCanvas.height - 140 - 100) + 50; 
    fPipes.push({ x: fCanvas.width, topH: topH, passed: false, dirY: Math.random() > 0.5 ? 1 : -1, minY: topH - 40, maxY: topH + 40 }); 
  }
  for (let i = fPipes.length - 1; i >= 0; i--) {
    let p = fPipes[i]; p.x -= 2.5; 
    if (fScore >= 15) { p.topH += p.dirY * 1.5; if (p.topH > p.maxY || p.topH > fCanvas.height - 140 - 50) p.dirY = -1; if (p.topH < p.minY || p.topH < 50) p.dirY = 1; }
    if (!p.passed && fBird.x > p.x + 50) { fScore++; p.passed = true; }
    if (fBird.x < p.x + 50 && fBird.x + fBird.w > p.x && (fBird.y < p.topH || fBird.y + fBird.h > p.topH + 140)) return endGameGlobal("flappy", fScore); 
    if (p.x + 50 < 0) fPipes.splice(i, 1);
  }
  fWinds.forEach(w => { w.x -= w.s; if(w.x + w.w < 0) { w.x = fCanvas.width; w.y = Math.random() * fCanvas.height; }});
  drawFlappy(); fLoop = requestAnimationFrame(flappyLoop);
}

function drawFlappy() {
  if(!fCtx) return;
  let bgGrad = fCtx.createLinearGradient(0,0,0,fCanvas.height); bgGrad.addColorStop(0, "#020111"); bgGrad.addColorStop(1, "#0a0a2a");
  fCtx.fillStyle = bgGrad; fCtx.fillRect(0, 0, fCanvas.width, fCanvas.height);
  fStars.forEach(s => { fCtx.fillStyle = `rgba(255, 255, 255, ${s.a})`; fCtx.beginPath(); fCtx.arc(s.x, s.y, s.s, 0, Math.PI*2); fCtx.fill(); s.a += (Math.random() - 0.5) * 0.1; if(s.a < 0) s.a = 0; if(s.a > 1) s.a = 1; });
  fCtx.strokeStyle = "rgba(255,255,255,0.15)"; fCtx.lineWidth = 2; fWinds.forEach(w => { fCtx.beginPath(); fCtx.moveTo(w.x, w.y); fCtx.lineTo(w.x + w.w, w.y); fCtx.stroke(); });
  fPipes.forEach(p => { 
    let pGrad = fCtx.createLinearGradient(p.x, 0, p.x + 50, 0); pGrad.addColorStop(0, "#1a1a1a"); pGrad.addColorStop(0.5, "#00ff99"); pGrad.addColorStop(1, "#1a1a1a"); fCtx.fillStyle = pGrad; 
    fCtx.fillRect(p.x, 0, 50, p.topH); fCtx.fillStyle = "#00ff99"; fCtx.fillRect(p.x - 4, p.topH - 10, 58, 10); 
    fCtx.fillStyle = pGrad; fCtx.fillRect(p.x, p.topH + 140, 50, fCanvas.height); fCtx.fillStyle = "#00ff99"; fCtx.fillRect(p.x - 4, p.topH + 140, 58, 10); 
  });
  fCtx.save(); fCtx.translate(fBird.x + fBird.w / 2, fBird.y + fBird.h / 2);
  let angle = Math.PI / 8 * (fBird.vy / 6); if (angle < -Math.PI/4) angle = -Math.PI/4; if (angle > Math.PI/3) angle = Math.PI/3; fCtx.rotate(angle);
  let bGrad = fCtx.createLinearGradient(-15, -15, 15, 15); bGrad.addColorStop(0, "#fff200"); bGrad.addColorStop(1, "#d4af37"); fCtx.fillStyle = bGrad; fCtx.beginPath(); fCtx.ellipse(0, 0, 16, 12, 0, 0, Math.PI*2); fCtx.fill();
  fCtx.fillStyle = "#fff"; fCtx.beginPath(); let wingY = (fBird.vy < 0) ? 8 : -2; fCtx.ellipse(-4, wingY, 8, 5, Math.PI/6, 0, Math.PI*2); fCtx.fill();
  fCtx.fillStyle = "#000"; fCtx.beginPath(); fCtx.arc(8, -4, 2, 0, Math.PI*2); fCtx.fill();
  fCtx.fillStyle = "#ff9f43"; fCtx.beginPath(); fCtx.moveTo(14, -2); fCtx.lineTo(22, 2); fCtx.lineTo(14, 4); fCtx.fill(); fCtx.restore();
  fCtx.fillStyle = "#fff"; fCtx.font = "800 34px 'Poppins', sans-serif"; fCtx.textAlign = "center"; fCtx.fillText(fScore, fCanvas.width / 2, 50); 
}

/* OYUN 2: TOWER */
const tCanvas = document.getElementById("towerCanvas"); let tCtx; if(tCanvas) tCtx = tCanvas.getContext("2d");
let tBlocks = []; let tScore = 0; let tIsRunning = false; let tLoop;
let pendulum = { angle: 0, speed: 0.04, maxAngle: Math.PI / 3, ropeLength: 160, isDropping: false, dropY: 0, dropX: 0, currentWidth: 160 };

function initTower() { tBlocks = [{ x: 80, y: 400, w: 160, h: 40 }]; tScore = 0; tIsRunning = false; pendulum.currentWidth = 160; resetPendulum(); drawTower(); }
function resetPendulum() { pendulum.angle = 0; pendulum.isDropping = false; pendulum.speed = 0.035 + (tScore * 0.0015); }
function startTower() { initTower(); tIsRunning = true; window.addEventListener("keydown", tClick); tCanvas.addEventListener("touchstart", tClick, {passive: false}); tCanvas.addEventListener("mousedown", tClick); tLoop = requestAnimationFrame(towerLoop); }
function stopTower() { tIsRunning = false; cancelAnimationFrame(tLoop); window.removeEventListener("keydown", tClick); if(tCanvas) { tCanvas.removeEventListener("touchstart", tClick); tCanvas.removeEventListener("mousedown", tClick); } }
function tClick(e) { if (!tIsRunning) return; if (e.code === "Space" || e.type === "touchstart" || e.type === "mousedown") { if (e.type === "touchstart") e.preventDefault(); if (!pendulum.isDropping) { pendulum.isDropping = true; pendulum.dropX = (tCanvas.width / 2) + Math.sin(pendulum.angle) * pendulum.ropeLength - (pendulum.currentWidth / 2); pendulum.dropY = Math.cos(pendulum.angle) * pendulum.ropeLength; } } }

function towerLoop() {
  if (!tIsRunning) return;
  if (!pendulum.isDropping) { pendulum.angle += pendulum.speed; if (Math.abs(pendulum.angle) > pendulum.maxAngle) pendulum.speed *= -1; } 
  else {
    pendulum.dropY += 12; let lastBlock = tBlocks[tBlocks.length - 1];
    if (pendulum.dropY + 40 >= lastBlock.y) {
      let overlapStart = Math.max(pendulum.dropX, lastBlock.x), overlapEnd = Math.min(pendulum.dropX + pendulum.currentWidth, lastBlock.x + lastBlock.w), overlapWidth = overlapEnd - overlapStart;
      if (overlapWidth > 0) { tScore++; pendulum.currentWidth = overlapWidth; tBlocks.push({ x: overlapStart, y: lastBlock.y - 40, w: overlapWidth, h: 40 }); if (tBlocks[tBlocks.length - 1].y < 200) { tBlocks.forEach(b => b.y += 40); } resetPendulum(); } 
      else { endGameGlobal("tower", tScore); }
    }
  }
  drawTower(); tLoop = requestAnimationFrame(towerLoop);
}

function drawTower() {
  if(!tCtx) return;
  let bgGrad = tCtx.createLinearGradient(0,0,0,tCanvas.height); bgGrad.addColorStop(0, "#1a0b12"); bgGrad.addColorStop(1, "#2d1b24"); tCtx.fillStyle = bgGrad; tCtx.fillRect(0, 0, tCanvas.width, tCanvas.height);
  if (!pendulum.isDropping) {
    let px = (tCanvas.width / 2) + Math.sin(pendulum.angle) * pendulum.ropeLength, py = Math.cos(pendulum.angle) * pendulum.ropeLength;
    tCtx.beginPath(); tCtx.moveTo(tCanvas.width / 2, 0); tCtx.lineTo(px, py); tCtx.strokeStyle = "#ffd400"; tCtx.lineWidth = 3; tCtx.shadowBlur = 15; tCtx.shadowColor = "#ffd400"; tCtx.stroke(); tCtx.shadowBlur = 0; 
    drawPremiumCake(px - (pendulum.currentWidth / 2), py, pendulum.currentWidth, 40, true);
  } else { drawPremiumCake(pendulum.dropX, pendulum.dropY, pendulum.currentWidth, 40, true); }
  tBlocks.forEach((b, i) => drawPremiumCake(b.x, b.y, b.w, b.h, i === tBlocks.length - 1));
  tCtx.fillStyle = "#fff"; tCtx.font = "800 40px 'Poppins', sans-serif"; tCtx.textAlign = "center"; tCtx.fillText(tScore, tCanvas.width / 2, 60);
}

function drawPremiumCake(x, y, w, h, isTop) {
  let cakeGrad = tCtx.createLinearGradient(x, y, x, y + h); cakeGrad.addColorStop(0, "#8b4513"); cakeGrad.addColorStop(1, "#3d1e08"); tCtx.fillStyle = cakeGrad; tCtx.fillRect(x, y, w, h);
  let frostGrad = tCtx.createLinearGradient(x, y, x, y + h * 0.4); frostGrad.addColorStop(0, isTop ? "#ff9ff3" : "#feca57"); frostGrad.addColorStop(1, isTop ? "#f368e0" : "#ff9f43"); tCtx.fillStyle = frostGrad; tCtx.beginPath(); tCtx.roundRect(x, y, w, h * 0.5, [5, 5, 0, 0]); tCtx.fill();
  for (let i = 0; i < w; i += 18) { tCtx.beginPath(); tCtx.arc(x + i + 9, y + h * 0.4, 6, 0, Math.PI); tCtx.fill(); }
  if (isTop && w > 20) { tCtx.fillStyle = "#ff4757"; tCtx.beginPath(); tCtx.arc(x + w / 2, y - 5, 6, 0, Math.PI * 2); tCtx.fill(); tCtx.fillStyle = "#2ed573"; tCtx.beginPath(); tCtx.ellipse(x + w / 2 + 5, y - 10, 4, 2, Math.PI/4, 0, Math.PI*2); tCtx.fill(); }
}

boot();
