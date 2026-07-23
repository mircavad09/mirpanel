/* =========================================================
   app.js — Mirpanel (TAM FINAL: YENİ SIRALAMA BANNERİ VƏ YAN MENYU)
   ========================================================= */

const PHONE_WA = "https://wa.me/994515243545";

/* =========================
   UI MƏTNLƏRİ (YALNIZ AZ)
   ========================= */
const UI = {
  "brandSub": "Premium Hesablar • Etibarlı Aktivləşmə",
  "bannerText": "Diqqət! Saytımızda ödəniş sistemi yoxdur. Sifariş etdiyiniz zaman sayt sizi avtomatik WhatsApp-a yönləndirir.",
  "heroTitle": "Premium Hesablar — Sürətli və Etibarlı",
  "heroHint": "Netflix, ChatGPT Plus, Google AI, CapCut Pro və daha çox. Plan seç → məlumatları yaz → WhatsApp avtomatik açılır.",
  "footRights": "©️ 2026 Mirpanel • Bütün hüquqlar qorunur",
  "modalClose": "Bağla ✕",
  "modalPlan": "Plan seçin",
  "modalWait": "Sifariş etdikdə WhatsApp avtomatik açılacaq.",
  "chatTitle": "Mirpanel AI",
  "chatSub": "Məhsullar haqqında sual verin",
  "chatBtn": "Göndər",
  "search": "Məhsul axtar... (məs: Netflix, Zoom)",
  "month": "aylıq",
  "orderBtn": "Sifariş et",
  "noPlan": "Plan yoxdur (WhatsApp-da dəqiqləşdirilir).",
  "formTitle": "Məlumatları daxil et",
  "stokOut": "Stokta yoxdur",
  "nameLabel": "Ad",
  "codeLabel": "rəqəmli kod",
  "emailLabel": "Gmail ünvanı",
  "passLabel": "Şifrə",
  "sendWa": "WhatsApp-a göndər",
  "ttCoin": "Jeton sayı",
  "ttPrice": "Qiymət",
  "ttUser": "TikTok istifadəçi adı",
  "ttRule": "Minimum 500 jeton. 500 jeton = 10 ₼",
  "minCoin": "Minimum",
  "spNote": "Şəxsi hesabınızda aktiv edirik.",
  "reqName": "Zəhmət olmasa, adınızı yazın.",
  "reqCode": "Zəhmət olmasa, kodu düzgün yazın.",
  "reqEmail": "Zəhmət olmasa, e-poçt ünvanını düzgün yazın.",
  "reqPass": "Zəhmət olmasa, şifrəni və ya istifadəçi adını qeyd edin.",
  "reqCoin": "Minimum 500 jeton daxil et.",
  "namePlace": "Məs: Mələk",
  "codePlace": " rəqəmli kod",
  "emailPlace": "məs: misal@gmail.com",
  "passPlace": "Şifrəni yazın...",
  "ttUserPlace": "@istifadeci_adi",
  "bundleBtn": "Paket Yarat",
  "bmTitle": "XÜSUSİ PAKET (ENDİRİMLİ)",
  "bmSub": "İstədiyiniz məhsulları seçin və 5% paket endirimi qazanın! Bütün paketlər 1 aylıq hesablanır.",
  "bmTotal": "Ümumi Qiymət:",
  "bmDisc": "Paket Endirimi (5%):",
  "bmFinal": "Yekun Qiymət:",
  "bmEmail": "Gmail",
  "bmNxCode": "Otaq Kodu (4 rəqəm)",
  "bmPrCode": "Prime Kodu (5 rəqəm)",
  "bmSpPass": "Spotify Şifrəsi",
  "bmTtUser": "TikTok İstifadəçi adı",
  "bmTtPass": "TikTok Şifrəsi",
  "bmSend": "WhatsApp-a göndər",
  "bmClose": "Bağla ✕",
  "available": "Mövcuddur",
  "deliveryFast": "7/24, dərhal təqdim olunur ✅⚡",
  "similarProds": "Oxşar Məhsullar",
  "tabAbout": "Məhsul Haqqında",
  "tabRules": "İstifadə Qaydaları",
  "searchTitle": "AXTARIŞ ET, <span class='highlight'>İSTƏDİYİNİ TAP!</span>",
  "searchDesc": "Bütün məlumatlar saytda mövcuddur. Axtarış bölməsindən istədiyiniz məhsulu rahatlıqla tapa bilərsiniz.",
  "buyNow": "İndi al",
  "addCart": "🛒 Səbətə At",
  "gameMainBtn": "Əylən & Oyna",
  "gameSelTitle": "ARCADE OYUNLARI",
  "gameSelSub": "Asudə vaxtını əyləncəli keçir. Öz rekordunu qır!",
  "game1Title": "Flappy Kosmos",
  "game1Desc": "15 xalı keç, yuxarı-aşağı hərəkət edən borulara diqqət et!",
  "game2Title": "Tort Qülləsi",
  "game2Desc": "İpdən sallanan tort təbəqələrini tam üst-üstə diz!",
  "gameStart": "Oyuna Başla",
  "gameRetry": "Yenidən Oyna",
  "gameBack": "Geri Qayıt",
  "gameWin": "ƏLA NƏTİCƏ 🎉",
  "gameLose": "OYUN BİTDİ 💥",
  "flappyRule": "Maneələrə dəymədən ekrana basaraq quşu uçurun. Maksimum rekordunuzu qırın!",
  "tapperRule": "Yuxarıdan sallanan tortları tam üst-üstə düzün. İpi kəsmək üçün toxunun. Rekord qırın!",
  "gameWinTxt": "Sənin topladığın xal: {score}. Əla nəticədir!",
  "gameLoseTxt": "Sənin topladığın xal: {score}. Növbəti dəfə daha yaxşı olar!"
};

/* =========================
   MƏHSUL BAZASI (DATA)
   ========================= */
const DATA = {
  "brand": "Mirpanel",
  "categories": [
    {
      "key": "video",
      "name": "video"
    },
    {
      "key": "film",
      "name": "film"
    },
    {
      "key": "meeting",
      "name": "meeting"
    },
    {
      "key": "musiqi",
      "name": "musiqi"
    },
    {
      "key": "ai",
      "name": "ai"
    },
    {
      "key": "dil",
      "name": "dil"
    },
    {
      "key": "dizayn",
      "name": "dizayn"
    }
  ],
  "products": [
    {
      "id": "capcut",
      "order": 0,
      "category": "video",
      "image": "assets/capcut.png",
      "currency": "₼",
      "title": "CapCut Pro",
      "variant": "Pro",
      "badge": "Video",
      "desc": "Rəsmi Pro funksiyalar, 4K eksport, premium effektlər və şablonlar.",
      "note": "",
      "seoSlug": "capcut-pro-almaq",
      "seoTitle": "CapCut Pro almaq | Ucuz CapCut Pro Azərbaycan - Mirpanel",
      "seoDescription": "CapCut Pro hesabını Azərbaycanda sərfəli qiymətə əldə et. Video montaj üçün premium funksiyalar və sürətli aktivləşdirmə.",
      "seoKeywords": "CapCut Pro almaq, CapCut Pro ucuz, CapCut Pro Azərbaycan, CapCut hesab almaq, CapCut premium, CapCut Pro video montaj, CapCut Pro aktivləşdirmə, CapCut Pro qiyməti, CapCut Pro hazır hesab",
      "seoContent": "CapCut Pro video montaj edən istifadəçilər üçün premium effektlər, şablonlar və əlavə funksiyalar təqdim edir. Mirpanel vasitəsilə CapCut Pro hesabını Azərbaycanda sərfəli qiymətə əldə edə bilərsiniz. Sifariş prosesi sadədir və aktivləşdirmə qısa müddətdə həyata keçirilir.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": true,
      "orderFlow": "confirm_then_whatsapp",
      "formFields": [
        {
          "key": "email",
          "type": "email",
          "label": "Email",
          "placeholder": "Gmail hesabınızı yazın",
          "required": true,
          "enabled": false
        }
      ],
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "CapCut Pro abunəliyi sizin təqdim edəcəyiniz yeni bir Gmail hesabına rəsmi şəkildə aktivləşdirilir. Təhlükəsizlik qaydalarına əsasən, hesaba eyni anda yalnız 1 cihaz daxil ola bilər; ikinci cihaz qoşulduqda hesab bloklanır. Qaydaların pozulması səbəbindən bloklanma hallarında əvəzləmə və ya geri ödəniş edilmir. Sifarişi tamamlayaraq bu şərtləri rəsmən qəbul edirsiniz.",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": false,
          "label": "Gmail yaradı",
          "url": ""
        }
      },
      "whatsapp": {
        "extraMessage": "",
        "includeSeller": true,
        "includeStock": false
      },
      "plans": [
        {
          "months": 1,
          "price": 5.99
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "CapCut Pro abunəliyi sizin təqdim edəcəyiniz yeni bir Gmail hesabına rəsmi şəkildə aktivləşdirilir. Təhlükəsizlik qaydalarına əsasən, hesaba eyni anda yalnız 1 cihaz daxil ola bilər; ikinci cihaz qoşulduqda hesab bloklanır. Qaydaların pozulması səbəbindən bloklanma hallarında əvəzləmə və ya geri ödəniş edilmir. Sifarişi tamamlayaraq bu şərtləri rəsmən qəbul edirsiniz.",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": false,
          "label": "Gmail yaradı",
          "url": ""
        }
      }
    },
    {
      "id": "hbomax",
      "order": 5,
      "category": "film",
      "image": "uploads/products/hbomax-1783292107083-520c4b4a.jpg?v=1783292107083",
      "currency": "₼",
      "title": "HBO Max",
      "variant": "Şəxsi Otaq",
      "badge": "Film",
      "desc": "Ən yeni HBO serialları. Surfshark VPN Hədiyyə!",
      "note": "Plan seç → Otaq adı və 4 rəqəmli kod yaz.",
      "seoSlug": "hbo-max-almaq",
      "seoTitle": "HBO Max almaq | Ucuz HBO Max hesab Azərbaycan - Mirpanel",
      "seoDescription": "HBO Max hesabını sərfəli qiymətə al. Film, serial və premium izləmə imkanları Mirpanel-də.",
      "seoKeywords": "HBO Max almaq, HBO Max ucuz, HBO Max qiyməti, HBO Max Azərbaycan, HBO Max hesab almaq, HBO Max aylıq, HBO Max premium, HBO Max film hesabı",
      "seoContent": "HBO Max premium film və serial izləmək istəyənlər üçün geniş məzmun təqdim edir. Mirpanel HBO Max hesablarını Azərbaycanda sərfəli qiymətə təklif edir. Sifariş WhatsApp üzərindən rahat şəkildə tamamlanır.",
      "flow": "name_code_4",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_then_whatsapp",
      "formFields": [
        {
          "key": "name",
          "type": "text",
          "label": "Ad",
          "placeholder": "Adınızı yazın",
          "required": true,
          "enabled": true
        },
        {
          "key": "code_4",
          "type": "text",
          "label": "4 rəqəmli kod / PIN",
          "placeholder": "4 rəqəmli kod yazın",
          "required": true,
          "enabled": true
        }
      ],
      "confirmationModal": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      },
      "whatsapp": {
        "extraMessage": "",
        "includeSeller": true,
        "includeStock": false
      },
      "plans": [
        {
          "months": 1,
          "price": 5.99
        }
      ],
      "orderConfirmation": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "netflix",
      "order": 2,
      "category": "film",
      "image": "assets/netflix.png",
      "currency": "₼",
      "title": "Netflix Şəxsi",
      "variant": "Premium",
      "badge": "Film",
      "desc": "Filmlər, seriallar, yüksək keyfiyyət.",
      "note": "Netflix Şəxsi otaq: Plan seç → Ad və 4 rəqəmli kod yaz.",
      "seoSlug": "netflix-sexsi-almaq",
      "seoTitle": "Netflix Şəxsi almaq | Ucuz Netflix Premium Azərbaycan - Mirpanel",
      "seoDescription": "Netflix şəxsi hesabını sərfəli qiymətə əldə et. Premium izləmə, rahat sifariş və sürətli aktivləşdirmə Mirpanel-də.",
      "seoKeywords": "Netflix şəxsi almaq, Netflix şəxsi hesab, Netflix almaq, Netflix Premium almaq, Netflix ucuz, Netflix Azərbaycan, Netflix hesab almaq, Netflix profil almaq, Netflix aylıq",
      "seoContent": "Netflix Şəxsi hesab öz profilindən istifadə etmək istəyənlər üçün rahat seçimdir. Mirpanel Netflix Premium hesablarını Azərbaycanda sərfəli qiymətə təqdim edir. Sifariş WhatsApp üzərindən tamamlanır və aktivləşdirmə qısa müddətdə həyata keçirilir.",
      "flow": "name_code_4",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_then_whatsapp",
      "formFields": [
        {
          "key": "name",
          "type": "text",
          "label": "Ad",
          "placeholder": "Adınızı yazın",
          "required": true,
          "enabled": true
        },
        {
          "key": "code_4",
          "type": "text",
          "label": "Otaq kodu",
          "placeholder": "Otaq 4 rəqəmli kod (PİN) təyin edin",
          "required": true,
          "enabled": true
        }
      ],
      "confirmationModal": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      },
      "whatsapp": {
        "extraMessage": "",
        "includeSeller": true,
        "includeStock": false
      },
      "plans": [
        {
          "months": 1,
          "price": 5.99
        },
        {
          "months": 3,
          "price": 16.49
        },
        {
          "months": 6,
          "price": 29.99
        }
      ],
      "orderConfirmation": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "netflix_umumi",
      "order": 3,
      "category": "film",
      "image": "assets/netflix.png",
      "currency": "₼",
      "title": "Netflix Ümumi",
      "variant": "Premium",
      "badge": "Film",
      "desc": "Ümumi hesab (paylaşılan).",
      "note": "Hazır hesab verilir. Sifarişi təsdiqləyin.",
      "seoSlug": "netflix-umumi-almaq",
      "seoTitle": "Netflix Ümumi almaq | Ucuz Netflix hesab Azərbaycan - Mirpanel",
      "seoDescription": "Netflix ümumi hesabını sərfəli qiymətə al. Film və serialları rahat izləmək üçün sürətli aktivləşdirmə.",
      "seoKeywords": "Netflix ümumi almaq, Netflix ümumi hesab, Netflix almaq, Netflix ucuz almaq, Netflix Azərbaycan, Netflix Premium qiyməti, Netflix hesab qiyməti, Netflix paket almaq",
      "seoContent": "Netflix Ümumi hesab film və serial izləmək istəyənlər üçün sərfəli premium seçimdir. Mirpanel vasitəsilə Netflix hesabını rahat sifariş edə və qısa müddətdə aktivləşdirə bilərsiniz. Azərbaycanda ucuz Netflix almaq istəyənlər üçün uyğun seçimdir.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "confirm_then_whatsapp",
      "formFields": [],
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "\n\nHesab Şərtləri və Qaydaları:\n\nPaylaşımlı Otaq: Bu otaq paylaşımlı statusdadır, otaq daxilində sizinlə birlikdə digər müştərilər də mövcuddur.\n\nYüksək Keyfiyyət: Filmləri və serialları rahat şəkildə 4K HD keyfiyyətində izləyə bilərsiniz.\n\nGiriş Limiti: Hesaba yalnız 1 cihazla giriş etmək mümkündür. Əlavə cihaz qoşmaq qətiyyən mümkün deyil.",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      },
      "whatsapp": {
        "extraMessage": "",
        "includeSeller": true,
        "includeStock": false
      },
      "plans": [
        {
          "months": 1,
          "price": 3.99
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "\n\nHesab Şərtləri və Qaydaları:\n\nPaylaşımlı Otaq: Bu otaq paylaşımlı statusdadır, otaq daxilində sizinlə birlikdə digər müştərilər də mövcuddur.\n\nYüksək Keyfiyyət: Filmləri və serialları rahat şəkildə 4K HD keyfiyyətində izləyə bilərsiniz.\n\nGiriş Limiti: Hesaba yalnız 1 cihazla giriş etmək mümkündür. Əlavə cihaz qoşmaq qətiyyən mümkün deyil.",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "zoom",
      "order": 14,
      "category": "meeting",
      "image": "assets/zoom.png",
      "currency": "₼",
      "title": "Zoom Pro",
      "variant": "Pro",
      "badge": "Görüş",
      "desc": "Peşəkar onlayn görüşlər.",
      "note": "Hesab aktiv və hazır şəkildə təqdim olunur.",
      "seoSlug": "zoom-pro-almaq",
      "seoTitle": "Zoom Pro almaq | Ucuz Zoom hesab Azərbaycan - Mirpanel",
      "seoDescription": "Zoom Pro hesabını sərfəli qiymətə əldə et. Online görüşlər və premium Zoom imkanları Mirpanel-də.",
      "seoKeywords": "Zoom Pro almaq, Zoom Pro ucuz, Zoom Pro Azərbaycan, Zoom hesab almaq, Zoom premium almaq, Zoom meeting hesabı, Zoom görüş hesabı, Zoom limitsiz görüş",
      "seoContent": "Zoom Pro online görüşlər, dərslər və iş toplantıları üçün premium imkanlar təqdim edir. Mirpanel Zoom Pro hesabını Azərbaycanda sərfəli qiymətə əldə etmək istəyənlər üçün rahat sifariş imkanı yaradır. Aktivləşdirmə sürətli şəkildə həyata keçirilir.",
      "flow": "whatsapp",
      "soldOut": true,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "confirmationModal": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      },
      "whatsapp": {
        "extraMessage": "",
        "includeSeller": true,
        "includeStock": false
      },
      "plans": [
        {
          "months": 1,
          "price": 9.99
        }
      ],
      "orderConfirmation": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "youtube",
      "order": 6,
      "category": "musiqi",
      "image": "assets/youtube.png",
      "currency": "₼",
      "title": "YouTube Yeni hesab",
      "variant": "Gmail",
      "badge": "Video",
      "desc": "Reklamsız izləmə, YouTube Music daxil.",
      "note": "Aktivləşmə üçün Gmailinizi qeyd edin.",
      "seoSlug": "youtube-premium-almaq",
      "seoTitle": "YouTube Premium almaq | Ucuz YouTube hesab Azərbaycan - Mirpanel",
      "seoDescription": "YouTube Premium hesabını sərfəli qiymətə əldə et. Reklamsız video, YouTube Music və premium imkanlar.",
      "seoKeywords…40877 tokens truncated…rong></p><a class="siteInfoWaBtn" href="${href}" target="_blank" rel="noopener noreferrer">${buttonText}</a></article>`;
    }

    const linkText = escapeSectionHtml(section.linkText || "");
    return `<article class="siteInfoCard" id="haqqimizda"><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${linkText ? `<p class="siteInfoLinkText">${linkText}</p>` : ""}</article>`;
  }).join("");

  ["haqqimizda", "sertler", "elaqe"].forEach((id) => {
    const isVisible = visible.some(([key]) => key === id);
    document.querySelectorAll(`[data-section-nav="${id}"]`).forEach((link) => {
      link.style.display = isVisible ? "" : "none";
    });
  });
}

function applyAdminHomepageSettings() {
  const setHtml = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && value) element.innerHTML = value;
  };

  setHtml(".brandSub", UI.brandSub);
  setHtml(".banner-text", UI.bannerText);
  setHtml(".sp-title", UI.searchTitle);
  setHtml(".sp-desc", UI.searchDesc);
  setHtml(".footer .tiny", UI.footRights);

  document
    .querySelectorAll('a[href^="https://wa.me/"]')
    .forEach((link) => {
      link.href = PHONE_WA;
    });
}

function setupUI() {
  applyAdminHomepageSettings();
  renderSiteSectionsFromAdmin();
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
}

function buildTabs() {
  const tabs = document.getElementById("tabs");
  if (!tabs) return;
  tabs.innerHTML = `
    <div class="glass-sort-container">
      <select id="sortSelect" class="glass-sort-select">
          <option value="default">↕ Məhsulları Sırala (Ən Çox Satılanlar)</option>
          <option value="price-asc">🔽 Ucuzdan Bahaya</option>
          <option value="price-desc">🔼 Bahadan Ucuza</option>
          <option value="az">🔤 A-dan Z-yə</option>
          <option value="za">🔤 Z-dən A-ya</option>
      </select>
    </div>
  `;
  document.getElementById("sortSelect").addEventListener("change", renderGrid);
}

function renderGrid() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  const searchInp = document.getElementById("q");
  const q = (searchInp?.value || "").trim().toLowerCase();
  
  const sortSelect = document.getElementById("sortSelect");
  const sortVal = sortSelect ? sortSelect.value : "default";

  let list = DATA.products.filter((p) => p.active !== false).filter((p) => {
    if (!q) return true;
    const blob = [p.title, p.desc, p.category, p.variant].join(" ").toLowerCase();
    return blob.includes(q);
  });
  
  list.sort((a, b) => {
     const getPrice = (prod) => {
        if (prod.id === "tiktok_jeton") return 10.00;
        const m = getMinPrice(prod);
        return (m === Infinity || m === 0) ? 999999 : m;
     };
     
     const priceA = getPrice(a);
     const priceB = getPrice(b);

     if (sortVal === "price-asc") {
        return priceA - priceB;
     } else if (sortVal === "price-desc") {
        if (priceA === 999999) return 1;
        if (priceB === 999999) return -1;
        return priceB - priceA;
     } else if (sortVal === "az") {
        return a.title.localeCompare(b.title);
     } else if (sortVal === "za") {
        return b.title.localeCompare(a.title);
     }
     return 0; 
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
        ${p.id === "netflix" || p.id === "netflix_umumi"
          ? `<a href="/netflix-almaq" onclick="event.stopPropagation()" style="display:inline-flex;margin-top:9px;color:#ffd400;font-size:12px;font-weight:800;text-decoration:none;">Netflix almaq</a>`
          : ""}
        <div class="priceRow"><button class="btn primary" type="button">${UI.orderBtn}</button></div>
      </div>
    </div>
  `;
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

/* =========================
   YAN MENYU (SIDEBAR) VƏ NAVİQASİYA
   ========================= */
function initSidebar() {
  const menuOpenBtn = document.getElementById("menuOpenBtn");
  const sideMenu = document.getElementById("sideMenu");
  const sideMenuOverlay = document.getElementById("sideMenuOverlay");
  const sideMenuClose = document.getElementById("sideMenuClose");
  const heroSection = document.getElementById("hero-section");
  const homePageView = document.getElementById("homePageView");
  const productPageView = document.getElementById("productPageView");

  function openMenu() {
    if(!sideMenu) return;
    sideMenu.classList.add("active");
    if(sideMenuOverlay) sideMenuOverlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    if(!sideMenu) return;
    sideMenu.classList.remove("active");
    if(sideMenuOverlay) sideMenuOverlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  if(menuOpenBtn) menuOpenBtn.addEventListener("click", openMenu);
  if(sideMenuClose) sideMenuClose.addEventListener("click", closeMenu);
  if(sideMenuOverlay) sideMenuOverlay.addEventListener("click", closeMenu);

  const smLinks = document.querySelectorAll(".sm-link");
  smLinks.forEach(link => {
    link.addEventListener("click", closeMenu);
  });

  const linkHome = document.getElementById("linkHome");
  if(linkHome) {
    linkHome.addEventListener("click", (e) => {
      e.preventDefault();
      if(productPageView) productPageView.style.display = "none";
      if(homePageView) homePageView.style.display = "block";
      if(heroSection) heroSection.style.display = "block";
      window.scrollTo(0, 0);
    });
  }

  const linkProducts = document.getElementById("linkProducts");
  if(linkProducts) {
    linkProducts.addEventListener("click", (e) => {
      e.preventDefault();
      if(productPageView) productPageView.style.display = "none";
      if(homePageView) homePageView.style.display = "block";
      if(heroSection) heroSection.style.display = "none";
      window.scrollTo(0, 0);
    });
  }
}

function boot() {
  initSplash();
  setupUI();
  initSlider(); 
  initSidebar(); 
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

boot();

