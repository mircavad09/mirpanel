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
      "order": 1,
      "category": "film",
      "image": "assets/hbomax.png",
      "currency": "₼",
      "title": "HBO Max(+VPN Hədiyyə)",
      "variant": "Şəxsi Otaq",
      "badge": "Film",
      "desc": "Ən yeni HBO serialları. Surfshark VPN Hədiyyə!",
      "note": "Plan seç → Otaq adı və 4 rəqəmli kod yaz.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
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
      "flow": "whatsapp",
      "soldOut": false,
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
          "price": 3.99
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
      "id": "zoom",
      "order": 4,
      "category": "meeting",
      "image": "assets/zoom.png",
      "currency": "₼",
      "title": "Zoom Pro",
      "variant": "Pro",
      "badge": "Görüş",
      "desc": "Peşəkar onlayn görüşlər.",
      "note": "Hesab aktiv və hazır şəkildə təqdim olunur.",
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
      "order": 5,
      "category": "musiqi",
      "image": "assets/youtube.png",
      "currency": "₼",
      "title": "YouTube Premium",
      "variant": "Gmail",
      "badge": "Video",
      "desc": "Reklamsız izləmə, YouTube Music daxil.",
      "note": "Aktivləşmə üçün Gmailinizi qeyd edin.",
      "flow": "email",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_confirm_whatsapp",
      "formFields": [
        {
          "key": "email",
          "type": "email",
          "label": "Email / Gmail",
          "placeholder": "Gmail ünvanınızı yazın",
          "required": true,
          "enabled": true
        }
      ],
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "Təqdim edilən hesab yeni Gmail olmalı və heç bir ailə planına qoşulmamalıdır.",
        "confirmText": "Təsdiq edirəm",
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
          "price": 3.49
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "Təqdim edilən hesab yeni Gmail olmalı və heç bir ailə planına qoşulmamalıdır.",
        "confirmText": "Təsdiq edirəm",
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
      "id": "spotify",
      "order": 6,
      "category": "musiqi",
      "image": "assets/spotify.png",
      "currency": "₼",
      "title": "Spotify Premium",
      "variant": "Şəxsi hesab",
      "badge": "Musiqi",
      "desc": "Reklamsız musiqi, yüksək səs keyfiyyəti və limitsiz mahnı keçidləri.\n",
      "note": "",
      "flow": "spotify",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": true,
      "orderFlow": "form_confirm_whatsapp",
      "formFields": [
        {
          "key": "email",
          "type": "email",
          "label": "Email",
          "placeholder": "Spotify hesab emailinizi yazın",
          "required": true,
          "enabled": true
        },
        {
          "key": "password",
          "type": "password",
          "label": "Şifrə",
          "placeholder": "Spotify hesab şifrənizi yazın",
          "required": true,
          "enabled": true
        }
      ],
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "Abunəlik şəxsi hesabınızda aktiv edilir və Tam zəmanət verilir. İstifadə zamanı Spotify tərəfindən \"şübhəli fəaliyyət\" aşkarlanarsa və hesab platforma tərəfindən ləğv edilərsə, bu hal xidmət göstərənin məsuliyyət dairəsinə daxil deyil. Bu növ bloklanma hallarında hesabın əvəzlənməsi və ya ödənişin geri qaytarılması həyata keçirilmir. Sifarişi tamamlayaraq yuxarıdakı şərtləri rəsmən qəbul etdiyinizi təsdiq edirsiniz.",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": true,
          "label": "👉Şifrənizi unutmusunuzsa sıfırlayın👈Toxunun",
          "url": "https://accounts.spotify.com/az/password-reset"
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
          "price": 4.99
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "Abunəlik şəxsi hesabınızda aktiv edilir və Tam zəmanət verilir. İstifadə zamanı Spotify tərəfindən \"şübhəli fəaliyyət\" aşkarlanarsa və hesab platforma tərəfindən ləğv edilərsə, bu hal xidmət göstərənin məsuliyyət dairəsinə daxil deyil. Bu növ bloklanma hallarında hesabın əvəzlənməsi və ya ödənişin geri qaytarılması həyata keçirilmir. Sifarişi tamamlayaraq yuxarıdakı şərtləri rəsmən qəbul etdiyinizi təsdiq edirsiniz.",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": true,
          "label": "👉Şifrənizi unutmusunuzsa sıfırlayın👈Toxunun",
          "url": "https://accounts.spotify.com/az/password-reset"
        }
      }
    },
    {
      "id": "surfshark",
      "order": 7,
      "category": "video",
      "image": "assets/surfshark.png",
      "currency": "₼",
      "title": "Surfshark VPN",
      "variant": "VPN",
      "badge": "VPN",
      "desc": "IP gizlətmə, güclü şifrələmə.",
      "note": "Hesab hazır şəkildə verilir.",
      "flow": "whatsapp",
      "soldOut": false,
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
          "price": 3.99
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
      "id": "tiktok_jeton",
      "order": 8,
      "category": "video",
      "image": "assets/tiktok.png",
      "currency": "₼",
      "title": "TikTok Jeton",
      "variant": "500+",
      "badge": "TikTok",
      "desc": "Minimum 500 jeton.",
      "note": "500 jeton = 10 ₼. İstifadəçi adı və şifrə qeyd olunur.",
      "flow": "spotify",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_then_whatsapp",
      "formFields": [
        {
          "key": "email",
          "type": "email",
          "label": "Email",
          "placeholder": "Spotify hesab emailinizi yazın",
          "required": true,
          "enabled": true
        },
        {
          "key": "password",
          "type": "password",
          "label": "Şifrə",
          "placeholder": "Spotify hesab şifrənizi yazın",
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
          "label": "Jeton sayını daxil et",
          "months": 1,
          "price": 10
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
      "id": "google_ai",
      "order": 9,
      "category": "ai",
      "image": "assets/google-ai.png",
      "currency": "₼",
      "title": "Google AI Pro + VEO 3",
      "variant": "Pro",
      "badge": "AI",
      "desc": "Ağıllı mətn, analiz və məhsuldarlıq.",
      "note": "Aktivləşmə sizin Gmail hesabınız üzərindən edilir.",
      "flow": "spotify",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_then_whatsapp",
      "formFields": [
        {
          "key": "email",
          "type": "email",
          "label": "Email",
          "placeholder": "Spotify hesab emailinizi yazın",
          "required": true,
          "enabled": true
        },
        {
          "key": "password",
          "type": "password",
          "label": "Şifrə",
          "placeholder": "Spotify hesab şifrənizi yazın",
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
          "months": 12,
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
      "id": "google_ai_ultra",
      "order": 10,
      "category": "ai",
      "image": "assets/google-ai-ultra.png",
      "currency": "₼",
      "title": "Google AI Ultra + VEO 3",
      "variant": "Ultra",
      "badge": "AI",
      "desc": "Peşəkar istifadə üçün ən yüksək AI.",
      "note": "Stokta yoxdur.",
      "flow": "out_of_stock",
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
          "label": "Stokta yoxdur",
          "months": 1,
          "price": 0
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
      "id": "captions",
      "order": 11,
      "category": "ai",
      "image": "assets/captions.png",
      "currency": "₼",
      "title": "Captions AI",
      "variant": "Şəxsi",
      "badge": "AI",
      "desc": "Videolar üçün avtomatik caption.",
      "note": "Hesab biz tərəfdən hazır verilir.",
      "flow": "whatsapp",
      "soldOut": false,
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
          "label": "1 aylıq PRO",
          "months": 1,
          "price": 11.99
        },
        {
          "label": "1 aylıq MAX",
          "months": 1,
          "price": 19.99
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
      "id": "grok_supergrok",
      "order": 12,
      "category": "ai",
      "image": "assets/grok.png",
      "currency": "₼",
      "title": "Grok AI",
      "variant": "SuperGrok",
      "badge": "AI",
      "desc": "Güclü model + şəkil/fayl analizi.",
      "note": "Hesab hazır şəkildə təqdim olunur.",
      "flow": "whatsapp",
      "soldOut": false,
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
          "price": 17.99
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
      "id": "claude_ai",
      "order": 13,
      "category": "ai",
      "image": "assets/claude.png",
      "currency": "₼",
      "title": "Claude AI",
      "variant": "1 illik",
      "badge": "AI",
      "desc": "Mətn, kod, yazı üçün güclü AI.",
      "note": "Stokta yoxdur.",
      "flow": "whatsapp",
      "soldOut": false,
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
          "label": "Stokta yoxdur",
          "months": 12,
          "price": 0
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
      "id": "prime",
      "order": 14,
      "category": "film",
      "image": "assets/prime.png",
      "currency": "₼",
      "title": "Amazon Prime Video",
      "variant": "Premium",
      "badge": "Film",
      "desc": "Prime Video filmlər və seriallar.",
      "note": "Plan seç → Ad və 5 rəqəmli kod yaz.",
      "flow": "name_code_5",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
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
          "key": "code_5",
          "type": "text",
          "label": "5 rəqəmli kod / PIN",
          "placeholder": "5 rəqəmli kod yazın",
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
          "price": 3.99
        },
        {
          "months": 6,
          "price": 17.99
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
      "id": "duolingo",
      "order": 15,
      "category": "dil",
      "image": "assets/duolingo.png",
      "currency": "₼",
      "title": "Duolingo Super",
      "variant": "Super",
      "badge": "Dil",
      "desc": "Xarici dil öyrənmək üçün premium imkanlar.",
      "note": "Hazır hesab kimi təqdim edilir.",
      "flow": "whatsapp",
      "soldOut": false,
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
          "price": 3.99
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
      "id": "canva",
      "order": 16,
      "category": "dizayn",
      "image": "assets/canva.png",
      "currency": "₼",
      "title": "Canva Premium",
      "variant": "Pro",
      "badge": "Dizayn",
      "desc": "Premium template, elementlər.",
      "note": "Aktivləşmə üçün Gmail qeyd edin.",
      "flow": "whatsapp",
      "soldOut": false,
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
          "price": 1.49
        },
        {
          "months": 12,
          "price": 2.99
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
      "id": "chatgpt",
      "order": 17,
      "category": "ai",
      "image": "assets/chatgpt.png",
      "currency": "₼",
      "title": "ChatGPT Plus",
      "variant": "Plus",
      "badge": "AI",
      "desc": "Daha güclü model, fayl/şəkil imkanları.",
      "note": "Hesabınızın Email və Şifrəsini qeyd edin.",
      "flow": "whatsapp",
      "soldOut": true,
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
        "description": "ChatGPT Plus birbaşa sizin şəxsi hesabınızda aktivləşdiriləcəkdir.",
        "confirmText": "Davam et",
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
          "label": "1 Aylıq",
          "months": 1,
          "price": 12.99
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "ChatGPT Plus birbaşa sizin şəxsi hesabınızda aktivləşdiriləcəkdir.",
        "confirmText": "Davam et",
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
      "id": "adobecc",
      "order": 18,
      "category": "dizayn",
      "image": "assets/adobe.png",
      "currency": "₼",
      "title": "Adobe Creative Cloud",
      "variant": "Premium",
      "badge": "Dizayn",
      "desc": "Photoshop, Illustrator və digərləri.",
      "note": "Hesab hazır şəkildə təqdim edilir.",
      "flow": "whatsapp",
      "soldOut": false,
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
        },
        {
          "months": 4,
          "price": 22.99
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
      "id": "linkedin_career",
      "order": 19,
      "category": "meeting",
      "image": "assets/linkedin.png",
      "currency": "₼",
      "title": "Linkedin Career",
      "variant": "Biznes",
      "badge": "İş",
      "desc": "Karyeranızı və şəbəkənizi növbəti səviyyəyə daşıyın.",
      "note": "Hazır hesab kimi təqdim olunur.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
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
          "months": 3,
          "price": 19.99
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
      "id": "elevenlabs_creator",
      "order": 20,
      "category": "ai",
      "image": "assets/elevenlabs.png",
      "currency": "₼",
      "title": "Elevenlabs Creator",
      "variant": "Səs AI",
      "badge": "AI",
      "desc": "Mətnləri ən təbii insan səsi ilə səsləndirin.",
      "note": "Hazır hesab şəklində təqdim edilir.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
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
          "price": 19.99
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
      "id": "semrush_premium",
      "order": 21,
      "category": "meeting",
      "image": "assets/semrush.png",
      "currency": "₼",
      "title": "Semrush Premium",
      "variant": "SEO",
      "badge": "Biznes",
      "desc": "Rəqiblərinizi qabaqlayın, açar sözləri tapın.",
      "note": "Hazır hesab kimi verilir.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
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
          "price": 6.99
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
      "id": "adobe_express",
      "order": 22,
      "category": "dizayn",
      "image": "assets/adobe-express.png",
      "currency": "₼",
      "title": "Adobe Express",
      "variant": "Pro",
      "badge": "Dizayn",
      "desc": "Peşəkar qrafiklər və sosial media postları.",
      "note": "Hazır hesab kimi təqdim edilir.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
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
      "id": "notion_plus",
      "order": 23,
      "category": "meeting",
      "image": "assets/notion.png",
      "currency": "₼",
      "title": "Notion Plus",
      "variant": "Məhsuldarlıq",
      "badge": "İş",
      "desc": "Bütün işlərinizi və qeydlərinizi idarə edin.",
      "note": "Hesab hazır şəkildə təhvil verilir.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
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
          "months": 3,
          "price": 14.99
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
      "id": "picsart_premium",
      "order": 24,
      "category": "dizayn",
      "image": "assets/picsart.png",
      "currency": "₼",
      "title": "Picsart Premium",
      "variant": "Foto Edit",
      "badge": "Dizayn",
      "desc": "Premium alətlər və süni intellekt filtirləri.",
      "note": "Hesabınız hazır olaraq verilir.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
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
          "price": 2.89
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
      "id": "blink_starter",
      "order": 25,
      "category": "meeting",
      "image": "assets/blink.png",
      "currency": "₼",
      "title": "Blink Starter",
      "variant": "Starter",
      "badge": "İş",
      "desc": "Sürətli və effektiv iş mühiti üçün.",
      "note": "Hazır hesab kimi təqdim olunur.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
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
          "price": 16.99
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
      "id": "lightroom_photo",
      "order": 26,
      "category": "dizayn",
      "image": "assets/lightroom.png",
      "currency": "₼",
      "title": "Lightroom Photo",
      "variant": "Foto Edit",
      "badge": "Dizayn",
      "desc": "Peşəkar rəng korreksiyası və retuş.",
      "note": "Hazır hesab şəklində verilir.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
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
          "price": 6.99
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
      "id": "gemini_ai_pro",
      "order": 27,
      "category": "ai",
      "image": "assets/gemini.png",
      "currency": "₼",
      "title": "Gemini AI Pro",
      "variant": "Google AI",
      "badge": "AI",
      "desc": "Ən güclü süni intellekt modeli ilə sürətlənin.",
      "note": "Sizin şəxsi Gmail hesabınızda aktiv edilir.",
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
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
          "price": 8.99
        },
        {
          "months": 4,
          "price": 14.99
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
    }
  ]
};

/* =========================
   MƏHSUL HAQQINDA BÖLMƏSİ (INFO_TEXTS)
   ========================= */
const ADMIN_CONTENT = {
  "capcut": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">CapCut PRO - Peşəkar Video Redaktə Həlli</h3>\n<p>CapCut PRO, həm mobil cihazlarda, həm də kompüterdə yüksək keyfiyyətli videolar hazırlamaq üçün nəzərdə tutulmuş, süni intellekt dəstəkli peşəkar video montaj platformasıdır. Standart versiyadan fərqli olaraq, PRO abunəliyi istifadəçilərə premium effektlər, inkişaf etmiş montaj alətləri, trend şablonlar və daha sürətli iş axını təqdim edir. Sosial şəbəkələrdə fərqlənən, estetik və peşəkar görünüşlü kontent hazırlamaq istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>CapCut PRO, mürəkkəb montaj proqramlarının güclü imkanlarını sadə və rahat interfeysdə birləşdirir. İstifadəçilər videolarını kəsmə, birləşdirmə, rəngləmə, altyazı əlavə etmə, musiqi yerləşdirmə və xüsusi effektlərlə daha peşəkar hala gətirə bilərlər. Bulud yaddaşı dəstəyi sayəsində layihələrə müxtəlif cihazlardan giriş etmək və iş prosesini daha rahat idarə etmək mümkündür.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">CapCut PRO Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Bloqerlər və Kontent Yaradıcıları:</strong> TikTok, Instagram Reels və YouTube Shorts üçün sürətli, trend və diqqətçəkən videolar hazırlayanlar.</li>\n  <li><strong>SMM Menecerlər və Marketoloqlar:</strong> Brendlər üçün peşəkar reklam videoları, tanıtım çarxları və sosial media kontenti yaradanlar.</li>\n  <li><strong>Video Redaktorlar və Frilanserlər:</strong> Müştərilərinə qısa müddətdə keyfiyyətli və estetik montaj xidməti təqdim etmək istəyənlər.</li>\n  <li><strong>Biznes Sahibləri:</strong> Məhsul və xidmətlərini sosial şəbəkələrdə daha premium və cəlbedici formada tanıtmaq istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">CapCut PRO-nun Üstünlükləri</h3>\n<ul>\n  <li><strong>👑 Premium Effektlər və Filtrlər:</strong> Standart versiyada olmayan eksklüziv keçidlər, kinematik filtrlər, animasiyalar və trend vizual effektlər.</li>\n  <li><strong>🤖 Süni İntellekt Alətləri:</strong> Avtomatik arxa fon silmə, səsin keyfiyyətini artırma, obyekt izləmə və ağıllı redaktə funksiyaları.</li>\n  <li><strong>✨ PRO Altyazı və Mətn Şablonları:</strong> Avtomatik altyazı yaratmaq, animasiyalı mətn üslubları əlavə etmək və videoları daha dinamik göstərmək imkanı.</li>\n  <li><strong>🎵 Geniş Media Kitabxanası:</strong> Premium musiqilər, səs effektləri, stok videolar və hazır şablonlarla daha zəngin kontent hazırlamaq.</li>\n  <li><strong>🚀 Yüksək Keyfiyyətli İxrac:</strong> Videoları 4K keyfiyyətdə, 60 FPS axıcılığında və daha sürətli render etmə imkanı.</li>\n</ul>",
    "rulesHtml": ""
  },
  "hbomax": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">HBO Max - Premium Film və Serial İzləmə Platforması</h3>\n<p>HBO Max, yüksək keyfiyyətli filmlər, seriallar, sənədli filmlər və eksklüziv kontentləri izləmək istəyən istifadəçilər üçün hazırlanmış premium video yayım platformasıdır. Standart izləmə təcrübəsindən fərqli olaraq, HBO Max istifadəçilərə məşhur HBO serialları, Warner Bros. filmləri, orijinal istehsallar və geniş əyləncə kitabxanası təqdim edir. Keyfiyyətli kontent, rahat izləmə və premium əyləncə istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>HBO Max, istifadəçilərə dram, komediya, fantastika, kriminal, animasiya, sənədli film və ailəvi kontent daxil olmaqla müxtəlif janrlarda geniş seçim imkanı yaradır. Platformada HBO Original serialları, məşhur filmlər, yeni buraxılışlar və seçilmiş premium kontentlər izlənilə bilir. Telefon, kompüter, planşet, smart TV və digər cihazlarda rahat istifadə olunduğu üçün sevdiyiniz kontentə istənilən vaxt giriş mümkündür.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">HBO Max Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Film və Serial Sevərlər:</strong> Keyfiyyətli filmlər, reytinqli seriallar və premium kontentləri izləmək istəyən istifadəçilər.</li>\n  <li><strong>HBO Original İzləyiciləri:</strong> HBO istehsalı olan məşhur və eksklüziv seriallara maraq göstərənlər.</li>\n  <li><strong>Ailəvi İzləyicilər:</strong> Evdə ailə ilə birlikdə film gecələri, animasiyalar və müxtəlif janrlarda kontent izləmək istəyənlər.</li>\n  <li><strong>Sənədli Film Sevərlər:</strong> Real hekayələr, bioqrafiyalar, tarix, kriminal və maarifləndirici sənədli filmlərə baxmaq istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">HBO Max-in Üstünlükləri</h3>\n<ul>\n  <li><strong>🎬 Premium Film və Serial Kitabxanası:</strong> Məşhur filmlər, reytinqli seriallar, sənədli filmlər və ailəvi kontentlərə geniş giriş imkanı.</li>\n  <li><strong>⭐ HBO Original Kontentləri:</strong> Platformaya məxsus eksklüziv seriallar, xüsusi istehsallar və yüksək keyfiyyətli layihələr.</li>\n  <li><strong>🍿 Warner Bros. və Populyar Filmlər:</strong> Məşhur kinostudiyaların seçilmiş filmlərini rahat şəkildə izləmək imkanı.</li>\n  <li><strong>📱 Çox Cihaz Dəstəyi:</strong> Telefon, planşet, kompüter, smart TV və digər cihazlarda hesabınıza daxil olaraq izləməyə davam etmək.</li>\n  <li><strong>🔊 Yüksək Keyfiyyətli İzləmə:</strong> Keyfiyyətli görüntü və səs imkanları ilə daha komfortlu film və serial təcrübəsi.</li>\n</ul>",
    "rulesHtml": ""
  },
  "netflix": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Netflix Premium - Yüksək Keyfiyyətli Film və Serial Təcrübəsi</h3>\n<p>Netflix Premium, film, serial, sənədli film, animasiya və eksklüziv kontentləri ən yüksək keyfiyyətdə izləmək istəyən istifadəçilər üçün hazırlanmış premium video yayım abunəliyidir. Standart izləmə paketlərindən fərqli olaraq, Premium abunəlik daha yüksək görüntü keyfiyyəti, çox cihaz dəstəyi və ailə üzvləri ilə rahat istifadə imkanı təqdim edir. Evdə, səyahətdə və gündəlik istirahət zamanı keyfiyyətli əyləncə istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Netflix Premium, istifadəçilərə dünyanın müxtəlif ölkələrindən filmlər, seriallar, Netflix Originals layihələri, sənədli filmlər və ailəvi kontentləri izləmək imkanı verir. Platforma telefon, kompüter, planşet, smart TV və digər cihazlarda rahat istifadə olunur. Premium paket sayəsində daha yüksək görüntü keyfiyyəti, eyni anda bir neçə cihazda izləmə və daha komfortlu baxış təcrübəsi əldə edilir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Netflix Premium Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Film və Serial Sevərlər:</strong> Populyar filmləri, reytinqli serialları və eksklüziv layihələri yüksək keyfiyyətdə izləmək istəyənlər.</li>\n  <li><strong>Ailəvi İstifadəçilər:</strong> Eyni hesabdan bir neçə nəfərin fərqli cihazlarda rahat şəkildə istifadə etməsini istəyən ailələr.</li>\n  <li><strong>Netflix Originals İzləyiciləri:</strong> Netflix-ə məxsus eksklüziv seriallar, filmlər və sənədli layihələrə maraq göstərən istifadəçilər.</li>\n  <li><strong>Smart TV və Böyük Ekran İstifadəçiləri:</strong> Filmləri və serialları daha böyük ekranda yüksək görüntü keyfiyyəti ilə izləmək istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Netflix Premium-un Üstünlükləri</h3>\n<ul>\n  <li><strong>🎬 Geniş Film və Serial Kitabxanası:</strong> Müxtəlif janrlarda filmlər, seriallar, sənədli filmlər, animasiyalar və ailəvi kontentlərə rahat giriş.</li>\n  <li><strong>⭐ Netflix Originals Kontentləri:</strong> Platformaya məxsus eksklüziv seriallar, filmlər və sənədli layihələri izləmək imkanı.</li>\n  <li><strong>📺 Yüksək Görüntü Keyfiyyəti:</strong> Böyük ekranlarda daha aydın, detallı və komfortlu baxış təcrübəsi.</li>\n  <li><strong>👥 Çox Cihazda İstifadə:</strong> Eyni hesabla ailə üzvlərinin və istifadəçilərin fərqli cihazlarda rahat izləmə imkanı.</li>\n  <li><strong>📱 Bütün Cihazlarda Rahat Baxış:</strong> Telefon, planşet, kompüter, smart TV və digər cihazlarda sevdiyiniz kontentə istənilən vaxt giriş.</li>\n</ul>",
    "rulesHtml": ""
  },
  "netflix_umumi": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Netflix Premium - Yüksək Keyfiyyətli Film və Serial Təcrübəsi</h3>\n<p>Netflix Premium, film, serial, sənədli film, animasiya və eksklüziv kontentləri ən yüksək keyfiyyətdə izləmək istəyən istifadəçilər üçün hazırlanmış premium video yayım abunəliyidir. Standart izləmə paketlərindən fərqli olaraq, Premium abunəlik daha yüksək görüntü keyfiyyəti, çox cihaz dəstəyi və ailə üzvləri ilə rahat istifadə imkanı təqdim edir. Evdə, səyahətdə və gündəlik istirahət zamanı keyfiyyətli əyləncə istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Netflix Premium, istifadəçilərə dünyanın müxtəlif ölkələrindən filmlər, seriallar, Netflix Originals layihələri, sənədli filmlər və ailəvi kontentləri izləmək imkanı verir. Platforma telefon, kompüter, planşet, smart TV və digər cihazlarda rahat istifadə olunur. Premium paket sayəsində daha yüksək görüntü keyfiyyəti, eyni anda bir neçə cihazda izləmə və daha komfortlu baxış təcrübəsi əldə edilir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Netflix Premium Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Film və Serial Sevərlər:</strong> Populyar filmləri, reytinqli serialları və eksklüziv layihələri yüksək keyfiyyətdə izləmək istəyənlər.</li>\n  <li><strong>Ailəvi İstifadəçilər:</strong> Eyni hesabdan bir neçə nəfərin fərqli cihazlarda rahat şəkildə istifadə etməsini istəyən ailələr.</li>\n  <li><strong>Netflix Originals İzləyiciləri:</strong> Netflix-ə məxsus eksklüziv seriallar, filmlər və sənədli layihələrə maraq göstərən istifadəçilər.</li>\n  <li><strong>Smart TV və Böyük Ekran İstifadəçiləri:</strong> Filmləri və serialları daha böyük ekranda yüksək görüntü keyfiyyəti ilə izləmək istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Netflix Premium-un Üstünlükləri</h3>\n<ul>\n  <li><strong>🎬 Geniş Film və Serial Kitabxanası:</strong> Müxtəlif janrlarda filmlər, seriallar, sənədli filmlər, animasiyalar və ailəvi kontentlərə rahat giriş.</li>\n  <li><strong>⭐ Netflix Originals Kontentləri:</strong> Platformaya məxsus eksklüziv seriallar, filmlər və sənədli layihələri izləmək imkanı.</li>\n  <li><strong>📺 Yüksək Görüntü Keyfiyyəti:</strong> Böyük ekranlarda daha aydın, detallı və komfortlu baxış təcrübəsi.</li>\n  <li><strong>👥 Çox Cihazda İstifadə:</strong> Eyni hesabla ailə üzvlərinin və istifadəçilərin fərqli cihazlarda rahat izləmə imkanı.</li>\n  <li><strong>📱 Bütün Cihazlarda Rahat Baxış:</strong> Telefon, planşet, kompüter, smart TV və digər cihazlarda sevdiyiniz kontentə istənilən vaxt giriş.</li>\n</ul>",
    "rulesHtml": ""
  },
  "zoom": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Zoom Pro - Peşəkar Onlayn Görüş və Video Konfrans Həlli</h3>\n<p>Zoom Pro, iş görüşləri, dərslər, vebinarlar və komanda toplantıları üçün hazırlanmış premium video konfrans platformasıdır. Standart versiyadan fərqli olaraq, Pro abunəliyi daha uzun görüş müddəti, daha geniş idarəetmə imkanları və peşəkar onlayn ünsiyyət üçün əlavə funksiyalar təqdim edir. Uzaqdan işləyən komandalar, müəllimlər, biznes sahibləri və onlayn xidmət göstərən şəxslər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Zoom Pro, istifadəçilərə yüksək keyfiyyətli video və audio ilə onlayn görüşlər keçirmək, ekran paylaşmaq, görüşləri qeyd etmək və iştirakçıları rahat idarə etmək imkanı verir. Platforma kompüter, telefon və planşet üzərindən istifadə oluna bilir və müxtəlif iş proseslərinə asanlıqla uyğunlaşır. Pro abunəliyi xüsusilə uzunmüddətli görüşlər, peşəkar təqdimatlar və müntəzəm onlayn toplantılar üçün daha rahat təcrübə yaradır.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Zoom Pro Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Biznes Sahibləri və Komandalar:</strong> İş görüşləri, layihə müzakirələri və komanda toplantılarını onlayn şəkildə idarə edənlər.</li>\n  <li><strong>Müəllimlər və Təlimçilər:</strong> Onlayn dərslər, kurslar, təlimlər və seminarlar keçirən şəxslər.</li>\n  <li><strong>Frilanserlər və Konsultantlar:</strong> Müştərilərlə video zənglər, təqdimatlar və məsləhət görüşləri aparanlar.</li>\n  <li><strong>SMM və Rəqəmsal Xidmət Göstərənlər:</strong> Müştəri görüşləri, kontent planlaması və komanda koordinasiyası üçün stabil platformaya ehtiyac duyanlar.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Zoom Pro-nun Üstünlükləri</h3>\n<ul>\n  <li><strong>⏱️ Uzunmüddətli Görüşlər:</strong> Standart versiyadakı vaxt məhdudiyyətlərini azaltmaqla daha rahat və fasiləsiz toplantılar keçirmək imkanı.</li>\n  <li><strong>🎥 Yüksək Keyfiyyətli Video və Audio:</strong> Peşəkar görünüşlü görüşlər üçün stabil bağlantı, aydın səs və keyfiyyətli görüntü təcrübəsi.</li>\n  <li><strong>🖥️ Ekran Paylaşımı və Təqdimatlar:</strong> Sənədləri, slaydları, layihələri və tətbiqləri iştirakçılarla canlı şəkildə paylaşmaq imkanı.</li>\n  <li><strong>☁️ Görüş Qeydləri:</strong> Vacib görüşləri qeyd edərək daha sonra izləmək, paylaşmaq və arxivləmək üçün rahat imkanlar.</li>\n  <li><strong>🔐 Təhlükəsiz Görüş İdarəetməsi:</strong> Şifrə, gözləmə otağı, iştirakçı icazələri və idarəetmə alətləri ilə daha təhlükəsiz onlayn görüşlər.</li>\n</ul>",
    "rulesHtml": ""
  },
  "youtube": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">YouTube Premium - Reklamsız İzləmə</h3>\n      <p>YouTube Premium hesabı, videoları reklamsız izləmək və YouTube Music xidmətindən istifadə etmək üçündür.</p>",
    "rulesHtml": ""
  },
  "spotify": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Spotify Premium - Reklamsız Musiqi və Podcast Təcrübəsi</h3>\n<p>Spotify Premium, musiqi və podcast dinləməyi daha rahat, keyfiyyətli və fasiləsiz etmək üçün hazırlanmış premium abunəlik xidmətidir. Standart versiyadan fərqli olaraq, Premium abunəliyi reklamsız dinləmə, offline yükləmə, istənilən mahnını seçərək dinləmə və daha yüksək səs keyfiyyəti təqdim edir. Gündəlik musiqi zövqünü daha sərbəst və komfortlu yaşamaq istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Spotify Premium, istifadəçilərə milyonlarla mahnı, albom, playlist və podcasta limitsiz giriş imkanı verir. İstifadəçilər sevdikləri musiqiləri reklamsız dinləyə, internet bağlantısı olmadan istifadə üçün yükləyə və istədikləri mahnını istənilən vaxt seçə bilərlər. Premium abunəlik həm mobil cihazlarda, həm kompüterdə, həm də smart TV və digər dəstəklənən cihazlarda daha rahat musiqi təcrübəsi yaradır.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Spotify Premium Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Musiqi Sevərlər:</strong> Sevdiyi mahnıları, albomları və playlistləri reklamsız və limitsiz dinləmək istəyənlər.</li>\n  <li><strong>Podcast Dinləyiciləri:</strong> Maarifləndirici, əyləncəli və motivasiyaedici podcastları fasiləsiz dinləmək istəyən istifadəçilər.</li>\n  <li><strong>Səyahət Edənlər və Mobil İstifadəçilər:</strong> Musiqiləri əvvəlcədən yükləyib internet olmadan dinləmək istəyənlər.</li>\n  <li><strong>İdman və İş Zamanı Musiqi Dinləyənlər:</strong> Məşq, iş, dərs və gündəlik fəaliyyətlər zamanı rahat musiqi axını istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Spotify Premium-un Üstünlükləri</h3>\n<ul>\n  <li><strong>🚫 Reklamsız Dinləmə:</strong> Mahnılar və podcastlar arasında reklam fasilələri olmadan daha axıcı dinləmə təcrübəsi.</li>\n  <li><strong>📥 Offline Yükləmə:</strong> Sevdiyiniz mahnıları, albomları və playlistləri cihazınıza yükləyərək internet olmadan dinləmək imkanı.</li>\n  <li><strong>🎵 İstənilən Mahnını Seçmə:</strong> Mobil cihazda belə istədiyiniz mahnını seçib dərhal dinləmək və limitsiz keçid etmək imkanı.</li>\n  <li><strong>🔊 Yüksək Səs Keyfiyyəti:</strong> Daha təmiz, aydın və keyfiyyətli musiqi dinləmə təcrübəsi.</li>\n  <li><strong>📱 Bütün Cihazlarda İstifadə:</strong> Telefon, kompüter, planşet, smart TV və digər dəstəklənən cihazlarda rahat istifadə.</li>\n</ul>",
    "rulesHtml": ""
  },
  "surfshark": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Surfshark VPN - Təhlükəsiz və Məxfi İnternet Təcrübəsi</h3>\n<p>Surfshark VPN, internetdə daha təhlükəsiz, məxfi və sərbəst şəkildə gəzmək istəyən istifadəçilər üçün hazırlanmış premium VPN xidmətidir. Standart internet bağlantısından fərqli olaraq, Surfshark məlumatlarınızı şifrələyir, IP ünvanınızı gizlədir və onlayn fəaliyyətlərinizi daha qorunan hala gətirir. Məxfilik, təhlükəsizlik və region məhdudiyyətlərini aşmaq istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Surfshark VPN, istifadəçilərə müxtəlif ölkələrdə yerləşən serverlərə qoşularaq internet bağlantısını daha təhlükəsiz və məxfi idarə etmək imkanı verir. Xidmət şəxsi məlumatların qorunmasına, ictimai Wi-Fi şəbəkələrində təhlükəsizliyə və bəzi region məhdudiyyətli kontentlərə girişə kömək edir. Telefon, kompüter, planşet və digər cihazlarda istifadə oluna bilir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Surfshark VPN Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Məxfilik İstəyən İstifadəçilər:</strong> IP ünvanını gizlətmək və internet fəaliyyətlərini daha qorunan saxlamaq istəyənlər.</li>\n  <li><strong>Səyahət Edənlər:</strong> Xarici ölkələrdə təhlükəsiz internetdən istifadə etmək və bəzi yerli məhdudiyyətləri aşmaq istəyənlər.</li>\n  <li><strong>İctimai Wi-Fi İstifadəçiləri:</strong> Kafe, otel, hava limanı və digər açıq şəbəkələrdə məlumatlarını qorumaq istəyənlər.</li>\n  <li><strong>Remote İşçilər və Frilanserlər:</strong> Onlayn iş zamanı bağlantı təhlükəsizliyini artırmaq və şəxsi məlumatları qorumaq istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Surfshark VPN-in Üstünlükləri</h3>\n<ul>\n  <li><strong>🔐 Şifrələnmiş Bağlantı:</strong> İnternet trafikinizi qoruyaraq şəxsi məlumatların üçüncü şəxslər tərəfindən izlənməsini çətinləşdirir.</li>\n  <li><strong>🌍 Geniş Server Seçimi:</strong> Müxtəlif ölkələrdəki serverlərə qoşularaq daha sərbəst və çevik internet istifadəsi yaradır.</li>\n  <li><strong>🛡️ IP Ünvanının Gizlədilməsi:</strong> Real IP ünvanınızı gizlədərək onlayn məxfiliyinizi daha da gücləndirir.</li>\n  <li><strong>📶 İctimai Wi-Fi Təhlükəsizliyi:</strong> Açıq şəbəkələrdə bank, email və şəxsi hesab məlumatlarının qorunmasına kömək edir.</li>\n  <li><strong>📱 Çox Cihaz Dəstəyi:</strong> Telefon, kompüter, planşet və digər cihazlarda rahat istifadə imkanı təqdim edir.</li>\n</ul>",
    "rulesHtml": ""
  },
  "tiktok_jeton": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">TikTok Jeton - Sürətli Yükləmə</h3>\n      <p>TikTok Jeton, canlı yayımlarda dəstək olmaq və hədiyyə göndərmək üçün istifadə olunan rəsmi virtual valyutadır.</p>",
    "rulesHtml": ""
  },
  "google_ai": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Google AI Pro + VEO 3 - Premium Süni İntellekt və Video Yaratma Həlli</h3>\n<p>Google AI Pro + VEO 3, süni intellekt vasitəsilə mətn yazmaq, ideya yaratmaq, kontent hazırlamaq və peşəkar səviyyədə AI video generasiya etmək istəyən istifadəçilər üçün hazırlanmış premium rəqəmsal xidmətdir. Standart AI alətlərindən fərqli olaraq, Google AI Pro daha güclü Gemini imkanları, geniş yaradıcılıq funksiyaları və VEO 3 ilə yüksək keyfiyyətli video yaratma təcrübəsi təqdim edir. Kontent istehsalı, biznes, təhsil və kreativ layihələr üçün ideal süni intellekt həllidir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Google AI Pro, istifadəçilərə Gemini süni intellekt modeli vasitəsilə mətn yazmaq, araşdırma aparmaq, ideyalar hazırlamaq, təqdimatlar üçün kontent yaratmaq və gündəlik iş proseslərini daha sürətli idarə etmək imkanı verir. VEO 3 dəstəyi isə mətn təsvirləri əsasında realistik, kreativ və yüksək keyfiyyətli videolar yaratmağa kömək edir. Bu xidmət həm fərdi istifadəçilər, həm də peşəkar kontent yaradıcıları üçün vaxt qazandıran güclü AI platformasıdır.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Google AI Pro + VEO 3 Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Kontent Yaradıcıları və Bloqerlər:</strong> Sosial şəbəkələr üçün kreativ ideyalar, mətnlər, video ssenarilər və AI videolar hazırlamaq istəyənlər.</li>\n  <li><strong>SMM Menecerlər və Marketoloqlar:</strong> Reklam ideyaları, post mətnləri, kampaniya konseptləri və video kontent hazırlayan mütəxəssislər.</li>\n  <li><strong>Biznes Sahibləri və Sahibkarlar:</strong> Məhsul və xidmətlərini daha peşəkar təqdim etmək üçün süni intellektdən istifadə etmək istəyənlər.</li>\n  <li><strong>Tələbələr və Peşəkarlar:</strong> Araşdırma, yazı, təqdimat, planlama və gündəlik işlərdə AI dəstəyinə ehtiyac duyan istifadəçilər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Google AI Pro + VEO 3-ün Üstünlükləri</h3>\n<ul>\n  <li><strong>🤖 Güclü Gemini AI İmkanları:</strong> Mətn yazmaq, suallara cavab almaq, ideya yaratmaq, analiz etmək və iş proseslərini sürətləndirmək üçün inkişaf etmiş süni intellekt dəstəyi.</li>\n  <li><strong>🎬 VEO 3 ilə AI Video Yaratma:</strong> Mətn təsvirləri əsasında kreativ, realistik və peşəkar görünüşlü videolar hazırlamaq imkanı.</li>\n  <li><strong>✨ Kontent İstehsalında Vaxta Qənaət:</strong> Sosial media postları, reklam ssenariləri, video ideyaları və təqdimat mətnlərini daha sürətli hazırlamaq.</li>\n  <li><strong>📚 Araşdırma və Planlama Dəstəyi:</strong> Mövzular üzrə məlumat toplamaq, struktur qurmaq, mətnləri təkmilləşdirmək və layihələri daha rahat planlamaq.</li>\n  <li><strong>🚀 Kreativ və Peşəkar Nəticələr:</strong> AI dəstəyi ilə daha keyfiyyətli vizuallar, ideyalar, mətnlər və video kontent hazırlayaraq rəqəmsal işlərdə fərqlənmək.</li>\n</ul>",
    "rulesHtml": ""
  },
  "google_ai_ultra": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Google AI Ultra + VEO 3 (Gemini)</h3>\n      <p>Ən mürəkkəb mətn və video generasiyası tapşırıqlarını maksimum peşəkarlıqla həyata keçirmək üçün ən güclü (Ultra) AI.</p>",
    "rulesHtml": ""
  },
  "captions": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Captions AI Pro - Süni İntellekt Dəstəkli Video və Altyazı Həlli</h3>\n<p>Captions AI Pro, videoları daha peşəkar, dinamik və sosial şəbəkələrə uyğun formada hazırlamaq istəyən istifadəçilər üçün yaradılmış süni intellekt dəstəkli video redaktə platformasıdır. Standart redaktə alətlərindən fərqli olaraq, Captions AI Pro avtomatik altyazı, AI səs və video təkmilləşdirmə, danışıq əsaslı kontent düzəltmə və kreativ montaj imkanları təqdim edir. Qısa video kontent, reklam çarxları və şəxsi brend videoları hazırlamaq istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Captions AI Pro, istifadəçilərə videolara avtomatik altyazı əlavə etmək, mətnləri redaktə etmək, səsi təmizləmək, danışığı daha aydın göstərmək və sosial media üçün cəlbedici videolar hazırlamaq imkanı verir. Platforma süni intellekt alətləri vasitəsilə montaj prosesini sadələşdirir və kontentin daha peşəkar görünməsinə kömək edir. TikTok, Instagram Reels, YouTube Shorts və digər platformalar üçün sürətli video hazırlayanlar üçün olduqca faydalıdır.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Captions AI Pro Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Kontent Yaradıcıları və Bloqerlər:</strong> TikTok, Instagram Reels və YouTube Shorts üçün altyazılı, dinamik və diqqətçəkən videolar hazırlayanlar.</li>\n  <li><strong>SMM Menecerlər və Marketoloqlar:</strong> Brendlər üçün reklam videoları, məhsul tanıtımları və sosial media kontenti yaradan mütəxəssislər.</li>\n  <li><strong>Frilanserlər və Video Redaktorlar:</strong> Müştərilərinə sürətli, estetik və peşəkar altyazılı video xidməti təqdim etmək istəyənlər.</li>\n  <li><strong>Təlimçilər və Ekspertlər:</strong> Dərs, izah, təqdimat və şəxsi brend videolarını daha aydın və peşəkar göstərmək istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Captions AI Pro-nun Üstünlükləri</h3>\n<ul>\n  <li><strong>📝 Avtomatik Altyazı Yaratma:</strong> Videodakı danışığı avtomatik mətnə çevirərək dəqiq və vizual olaraq cəlbedici altyazılar əlavə etmək imkanı.</li>\n  <li><strong>🤖 AI Video Redaktə Alətləri:</strong> Süni intellekt vasitəsilə videonu daha sürətli düzəltmək, danışıq hissələrini optimallaşdırmaq və kontenti təkmilləşdirmək.</li>\n  <li><strong>🎙️ Səsin Təmizlənməsi və Yaxşılaşdırılması:</strong> Fon səslərini azaltmaq, danışığı daha aydın etmək və videoya daha peşəkar audio keyfiyyəti vermək.</li>\n  <li><strong>✨ Sosial Media Üçün Hazır Şablonlar:</strong> Trend altyazı stilləri, mətn animasiyaları və vizual dizaynlarla videoları daha cəlbedici etmək.</li>\n  <li><strong>🚀 Vaxta Qənaət və Sürətli Montaj:</strong> Əl ilə uzun redaktə prosesinə ehtiyac qalmadan qısa zamanda paylaşmağa hazır videolar hazırlamaq.</li>\n</ul>",
    "rulesHtml": ""
  },
  "grok_supergrok": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">SuperGrok AI - Premium Süni İntellekt Köməkçisi</h3>\n<p>SuperGrok AI, süni intellekt vasitəsilə daha sürətli cavablar almaq, ideyalar yaratmaq, mətnlər hazırlamaq və gündəlik işləri daha rahat idarə etmək istəyən istifadəçilər üçün hazırlanmış premium AI xidmətidir. Standart istifadə imkanlarından fərqli olaraq, SuperGrok daha güclü AI modeli, geniş sorğu imkanları və kreativ işlər üçün daha çevik süni intellekt dəstəyi təqdim edir. Kontent yaradıcıları, biznes sahibləri, tələbələr və peşəkarlar üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>SuperGrok AI, istifadəçilərə mətn yazmaq, suallara cavab almaq, araşdırma aparmaq, ideya hazırlamaq, kod yazmaq, plan qurmaq və müxtəlif mövzularda AI dəstəyi əldə etmək imkanı verir. Platforma gündəlik işlərdə, kontent istehsalında, təhsil prosesində və biznes tapşırıqlarında vaxta qənaət etməyə kömək edir. Premium imkanlar sayəsində istifadəçi daha sürətli, daha geniş və daha məhsuldar süni intellekt təcrübəsi əldə edir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">SuperGrok AI Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Kontent Yaradıcıları və Bloqerlər:</strong> Sosial media postları, video ssenariləri, ideyalar və kreativ mətnlər hazırlamaq istəyənlər.</li>\n  <li><strong>SMM Menecerlər və Marketoloqlar:</strong> Reklam mətnləri, kampaniya ideyaları, kontent planları və brend kommunikasiyası üçün AI dəstəyi axtaranlar.</li>\n  <li><strong>Tələbələr və Araşdırma Aparanlar:</strong> Mövzuları izah etmək, mətnləri strukturlaşdırmaq, ideyalar toplamaq və öyrənmə prosesini sürətləndirmək istəyənlər.</li>\n  <li><strong>Biznes Sahibləri və Peşəkarlar:</strong> Planlama, yazışmalar, analiz, ideya inkişafı və gündəlik iş tapşırıqlarını daha rahat idarə etmək istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">SuperGrok AI-nin Üstünlükləri</h3>\n<ul>\n  <li><strong>🤖 Güclü Süni İntellekt Dəstəyi:</strong> Mətn yazmaq, suallara cavab vermək, ideyalar yaratmaq və mürəkkəb mövzuları daha sadə izah etmək imkanı.</li>\n  <li><strong>⚡ Daha Sürətli və Məhsuldar İş Axını:</strong> Kontent, planlama, araşdırma və yazı işlərini daha qısa zamanda yerinə yetirməyə kömək edir.</li>\n  <li><strong>🧠 Kreativ İdeya Yaratma:</strong> Sosial media, biznes, reklam, video və layihələr üçün yeni konseptlər və məzmun fikirləri hazırlamaq.</li>\n  <li><strong>📚 Təhsil və Araşdırma Üçün Faydalı:</strong> Mövzuları izah etmək, xülasə hazırlamaq, mətnləri təkmilləşdirmək və öyrənmə prosesini dəstəkləmək.</li>\n  <li><strong>💼 Biznes və Peşəkar İstifadə:</strong> Email mətnləri, təqdimat ideyaları, strategiya planları və gündəlik iş tapşırıqlarında AI köməyi əldə etmək.</li>\n</ul>",
    "rulesHtml": ""
  },
  "claude_ai": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Claude AI Pro - Premium Süni İntellekt Köməkçisi</h3>\n<p>Claude AI Pro, mətn yazmaq, ideyalar yaratmaq, sənədləri analiz etmək, kodla işləmək və gündəlik tapşırıqları daha sürətli yerinə yetirmək istəyən istifadəçilər üçün hazırlanmış premium süni intellekt xidmətidir. Standart AI istifadəsindən fərqli olaraq, Pro abunəliyi daha geniş imkanlar, daha məhsuldar iş axını və peşəkar səviyyədə AI dəstəyi təqdim edir. Təhsil, biznes, kontent istehsalı və şəxsi məhsuldarlıq üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Claude AI Pro, istifadəçilərə suallara cavab almaq, mətnlər hazırlamaq, uzun sənədləri xülasələndirmək, ideyaları inkişaf etdirmək, kod yazmaq və müxtəlif mövzular üzrə analiz aparmaq imkanı verir. Platforma həm sadə gündəlik tapşırıqlar, həm də daha mürəkkəb peşəkar işlər üçün rahat AI köməkçisi kimi istifadə oluna bilər. Pro imkanları sayəsində istifadəçilər daha sürətli, daha çevik və daha effektiv süni intellekt təcrübəsi əldə edirlər.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Claude AI Pro Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Kontent Yaradıcıları və Kopirayterlər:</strong> Sosial media mətnləri, məqalələr, reklam yazıları, video ssenariləri və kreativ ideyalar hazırlayanlar.</li>\n  <li><strong>Tələbələr və Araşdırma Aparanlar:</strong> Mövzuları izah etmək, uzun mətnləri xülasələndirmək, esse və təqdimat strukturu qurmaq istəyənlər.</li>\n  <li><strong>Biznes Sahibləri və Peşəkarlar:</strong> Email, plan, hesabat, təqdimat və strategiya mətnlərini daha sürətli hazırlamaq istəyənlər.</li>\n  <li><strong>Proqramçılar və Texniki İstifadəçilər:</strong> Kod yazmaq, səhvləri izah etmək, texniki mətnləri analiz etmək və layihə ideyalarını inkişaf etdirmək istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Claude AI Pro-nun Üstünlükləri</h3>\n<ul>\n  <li><strong>🤖 Güclü AI Yazı Köməkçisi:</strong> Mətn hazırlamaq, redaktə etmək, ideya yaratmaq və mürəkkəb mövzuları sadə formada izah etmək imkanı.</li>\n  <li><strong>📄 Sənəd və Mətn Analizi:</strong> Uzun mətnləri oxumaq, xülasə etmək, əsas fikirləri çıxarmaq və məlumatları daha anlaşıqlı hala gətirmək.</li>\n  <li><strong>⚡ Məhsuldarlığın Artırılması:</strong> Gündəlik yazı, planlama, araşdırma və iş tapşırıqlarını daha qısa zamanda yerinə yetirməyə kömək edir.</li>\n  <li><strong>💻 Kod və Texniki Dəstək:</strong> Proqramlaşdırma, səhv izahı, kod nümunələri və texniki layihələr üçün faydalı AI dəstəyi.</li>\n  <li><strong>💼 Biznes və Təhsil Üçün Uyğun:</strong> Hesabatlar, təqdimatlar, dərs materialları, strategiya mətnləri və peşəkar yazışmalar üçün rahat istifadə.</li>\n</ul>",
    "rulesHtml": ""
  },
  "prime": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Prime Video - Premium Film və Serial İzləmə Platforması</h3>\n<p>Prime Video, film, serial, sənədli film və eksklüziv kontentləri yüksək keyfiyyətdə izləmək istəyən istifadəçilər üçün hazırlanmış premium video yayım platformasıdır. Standart televiziya və təsadüfi video izləmə təcrübəsindən fərqli olaraq, Prime Video istifadəçilərə geniş kontent kitabxanası, orijinal istehsallar və müxtəlif cihazlardan rahat izləmə imkanı təqdim edir. Əyləncəni daha komfortlu, keyfiyyətli və əlçatan etmək istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Prime Video, istifadəçilərə müxtəlif janrlarda filmlər, seriallar, animasiyalar, sənədli filmlər və Amazon Originals kontentlərini izləmək imkanı verir. Platforma telefon, kompüter, planşet, smart TV və digər cihazlarda istifadə oluna bilir. İstifadəçilər sevdikləri kontenti istədikləri vaxt izləyə, bəzi məzmunları offline baxış üçün yükləyə və ailəvi əyləncə təcrübəsindən rahat şəkildə yararlana bilərlər.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Prime Video Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Film və Serial Sevərlər:</strong> Geniş film və serial seçimini yüksək keyfiyyətdə izləmək istəyən istifadəçilər.</li>\n  <li><strong>Ailəvi İzləyicilər:</strong> Evdə ailə ilə birlikdə film gecələri, animasiyalar və müxtəlif janrlarda kontent izləmək istəyənlər.</li>\n  <li><strong>Səyahət Edənlər:</strong> Sevdikləri filmləri və serialları əvvəlcədən yükləyib internet olmayan yerlərdə izləmək istəyənlər.</li>\n  <li><strong>Eksklüziv Kontent İzləyənlər:</strong> Amazon Originals və platformaya məxsus xüsusi serial və filmləri izləmək istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Prime Video-nun Üstünlükləri</h3>\n<ul>\n  <li><strong>🎬 Geniş Film və Serial Kitabxanası:</strong> Müxtəlif janrlarda filmlər, seriallar, sənədli filmlər və animasiyalara rahat giriş imkanı.</li>\n  <li><strong>⭐ Amazon Originals Kontentləri:</strong> Platformaya məxsus eksklüziv seriallar, filmlər və xüsusi istehsalları izləmək imkanı.</li>\n  <li><strong>📥 Offline Yükləmə:</strong> Sevdiyiniz kontentləri cihazınıza yükləyərək internet bağlantısı olmadan izləmək.</li>\n  <li><strong>📱 Çox Cihaz Dəstəyi:</strong> Telefon, planşet, kompüter, smart TV və digər cihazlarda rahat baxış təcrübəsi.</li>\n  <li><strong>🔊 Yüksək Keyfiyyətli İzləmə:</strong> Keyfiyyətli görüntü və səs imkanları ilə daha komfortlu film və serial təcrübəsi.</li>\n</ul>sıdır.</p>",
    "rulesHtml": ""
  },
  "duolingo": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Duolingo Super - Premium Dil Öyrənmə Təcrübəsi</h3>\n<p>Duolingo Super, yeni dilləri daha rahat, fasiləsiz və motivasiyalı şəkildə öyrənmək istəyən istifadəçilər üçün hazırlanmış premium dil öyrənmə abunəliyidir. Standart Duolingo versiyasından fərqli olaraq, Super abunəliyi reklamsız istifadə, limitsiz səhv düzəltmə imkanları və daha rahat məşq prosesi təqdim edir. Dil öyrənməyi gündəlik vərdişə çevirmək, bilikləri möhkəmləndirmək və daha sürətli irəliləmək istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Duolingo Super, istifadəçilərə ingilis, alman, fransız, ispan və digər dilləri interaktiv dərslər, qısa tapşırıqlar və oyunlaşdırılmış məşqlər vasitəsilə öyrənmək imkanı verir. Platforma gündəlik dərs sistemi, dinləmə, yazma, oxuma və danışıq məşqləri ilə dil bacarıqlarını mərhələli şəkildə inkişaf etdirir. Super abunəliyi isə öyrənmə prosesini daha rahat edir və istifadəçinin diqqətini yalnız dərslərə yönəltməsinə kömək edir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Duolingo Super Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Dil Öyrənməyə Yeni Başlayanlar:</strong> Xarici dili sadə, əyləncəli və addım-addım üsulla öyrənmək istəyənlər.</li>\n  <li><strong>Tələbələr və Şagirdlər:</strong> Məktəb, universitet və imtahan hazırlığı üçün əlavə dil praktikası etmək istəyənlər.</li>\n  <li><strong>Səyahət Sevərlər:</strong> Xarici ölkələrə səfər zamanı əsas ifadələri, gündəlik danışığı və ünsiyyət bacarıqlarını inkişaf etdirmək istəyənlər.</li>\n  <li><strong>İş və Karyera Üçün Dil Öyrənənlər:</strong> Xarici dil biliyini artıraraq CV-sini gücləndirmək və beynəlxalq imkanlara hazırlaşmaq istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Duolingo Super-in Üstünlükləri</h3>\n<ul>\n  <li><strong>🚫 Reklamsız Öyrənmə:</strong> Dərslər zamanı reklamlarla bölünmədən daha rahat və fokuslanmış dil öyrənmə təcrübəsi.</li>\n  <li><strong>💙 Limitsiz Canlar:</strong> Səhvlərə görə dərsin dayanmasının qarşısını alır və istədiyiniz qədər məşq etməyə imkan verir.</li>\n  <li><strong>📚 Səhvləri Təkrar Məşq Etmə:</strong> Buraxılan səhvləri ayrıca görmək və zəif mövzuları daha yaxşı möhkəmləndirmək imkanı.</li>\n  <li><strong>⚡ Daha Sürətli İrəliləyiş:</strong> Məhdudiyyətsiz məşqlər və əlavə imkanlar sayəsində dil öyrənmə prosesini daha effektiv idarə etmək.</li>\n  <li><strong>📱 Mobil və Kompüter Dəstəyi:</strong> Hesabınıza telefon, planşet və kompüterdən daxil olaraq dərslərə istənilən yerdə davam etmək imkanı.</li>\n</ul>",
    "rulesHtml": ""
  },
  "canva": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Canva Pro - Peşəkar Dizayn və Kontent Yaratma Platforması</h3>\n<p>Canva Pro, sosial media postları, təqdimatlar, loqolar, reklam materialları, video kontent və biznes dizaynları hazırlamaq istəyən istifadəçilər üçün yaradılmış premium dizayn platformasıdır. Standart Canva versiyasından fərqli olaraq, Pro abunəliyi daha geniş şablon kitabxanası, premium elementlər, arxa fon silmə, brend kit və komanda ilə işləmə imkanları təqdim edir. Dizayn bacarığı olmadan belə peşəkar və estetik vizuallar yaratmaq istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Canva Pro, istifadəçilərə hazır şablonlar, premium şəkillər, ikonlar, videolar, animasiyalar və dizayn elementləri vasitəsilə sürətli və keyfiyyətli vizual kontent hazırlamaq imkanı verir. Platforma sosial media postları, story dizaynları, təqdimatlar, afişalar, CV-lər, reklam bannerləri və video layihələr üçün rahat alətlər təqdim edir. Canva Pro həm fərdi istifadəçilər, həm də biznes və komandalar üçün dizayn prosesini daha sadə və məhsuldar edir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Canva Pro Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>SMM Menecerlər və Marketoloqlar:</strong> Sosial media postları, reklam bannerləri, kampaniya vizualları və brend kontenti hazırlayanlar.</li>\n  <li><strong>Biznes Sahibləri və Sahibkarlar:</strong> Məhsul və xidmətlərini peşəkar dizaynlarla tanıtmaq və brend görünüşünü gücləndirmək istəyənlər.</li>\n  <li><strong>Kontent Yaradıcıları və Bloqerlər:</strong> Instagram, TikTok, YouTube və digər platformalar üçün estetik vizual və video kontent hazırlayanlar.</li>\n  <li><strong>Tələbələr və Peşəkarlar:</strong> Təqdimatlar, CV-lər, layihə dizaynları və gündəlik vizual materiallar hazırlamaq istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Canva Pro-nun Üstünlükləri</h3>\n<ul>\n  <li><strong>🎨 Premium Şablonlar və Elementlər:</strong> Minlərlə peşəkar hazır dizayn, ikon, şəkil, video və qrafik elementlərə geniş giriş.</li>\n  <li><strong>🪄 Arxa Fon Silmə Aləti:</strong> Şəkillərin arxa fonunu tək kliklə silərək məhsul, profil və reklam dizaynlarını daha peşəkar göstərmək.</li>\n  <li><strong>🏷️ Brand Kit Dəstəyi:</strong> Loqo, rəng palitrası və şriftləri saxlayaraq bütün dizaynlarda brend üslubunu qorumaq imkanı.</li>\n  <li><strong>📱 Sosial Media Üçün Hazır Formatlar:</strong> Instagram post, story, Reels cover, YouTube thumbnail, banner və digər ölçülərdə sürətli dizayn yaratmaq.</li>\n  <li><strong>🚀 Vaxta Qənaət və Asan İstifadə:</strong> Dizayn təcrübəsi olmadan belə qısa zamanda estetik, peşəkar və paylaşmağa hazır vizuallar hazırlamaq.</li>\n</ul>",
    "rulesHtml": ""
  },
  "chatgpt": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">ChatGPT Plus - Premium Süni İntellekt Köməkçisi</h3>\n<p>ChatGPT Plus, gündəlik işləri daha sürətli yerinə yetirmək, mətn yazmaq, ideya yaratmaq, suallara cavab almaq və müxtəlif mövzularda peşəkar AI dəstəyi əldə etmək istəyən istifadəçilər üçün hazırlanmış premium süni intellekt xidmətidir. Standart istifadədən fərqli olaraq, Plus abunəliyi daha güclü model imkanları, daha sürətli cavablar və daha məhsuldar iş təcrübəsi təqdim edir. Təhsil, biznes, kontent istehsalı və şəxsi inkişaf üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>ChatGPT Plus, istifadəçilərə mətn hazırlamaq, tərcümə etmək, ideyaları inkişaf etdirmək, kod yazmaq, plan qurmaq, araşdırma aparmaq və gündəlik tapşırıqları daha rahat idarə etmək imkanı verir. Platforma həm sadə suallar, həm də daha mürəkkəb peşəkar işlər üçün ağıllı köməkçi kimi istifadə oluna bilər. Plus imkanları sayəsində istifadəçi daha sürətli, daha çevik və daha effektiv süni intellekt təcrübəsi əldə edir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">ChatGPT Plus Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Tələbələr və Araşdırma Aparanlar:</strong> Mövzuları izah etmək, xülasə hazırlamaq, esse və təqdimat strukturu qurmaq istəyənlər.</li>\n  <li><strong>Kontent Yaradıcıları və Kopirayterlər:</strong> Sosial media mətnləri, reklam yazıları, video ssenariləri və kreativ ideyalar hazırlayanlar.</li>\n  <li><strong>Biznes Sahibləri və Peşəkarlar:</strong> Email, plan, hesabat, təqdimat və strategiya mətnlərini daha sürətli hazırlamaq istəyənlər.</li>\n  <li><strong>Proqramçılar və Texniki İstifadəçilər:</strong> Kod yazmaq, səhvləri izah etmək, texniki mövzuları analiz etmək və layihə ideyalarını inkişaf etdirmək istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">ChatGPT Plus-un Üstünlükləri</h3>\n<ul>\n  <li><strong>🤖 Güclü AI Dəstəyi:</strong> Mətn yazmaq, suallara cavab vermək, ideya yaratmaq və mürəkkəb mövzuları daha sadə izah etmək imkanı.</li>\n  <li><strong>⚡ Daha Sürətli Cavablar:</strong> Gündəlik yazı, araşdırma, planlama və iş tapşırıqlarını daha qısa zamanda yerinə yetirməyə kömək edir.</li>\n  <li><strong>📚 Təhsil və Araşdırma Üçün Faydalı:</strong> Mövzuları öyrənmək, xülasə çıxarmaq, mətnləri təkmilləşdirmək və məlumatları strukturlaşdırmaq.</li>\n  <li><strong>💻 Kod və Texniki Yardım:</strong> Proqramlaşdırma, kod nümunələri, səhv izahı və texniki layihələr üçün faydalı AI köməkçisi.</li>\n  <li><strong>💼 Biznes və Kontent Üçün Uyğun:</strong> Reklam mətnləri, strategiya ideyaları, təqdimatlar, email yazışmaları və sosial media kontenti hazırlamaq.</li>\n</ul>",
    "rulesHtml": ""
  },
  "adobecc": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">Adobe Creative Cloud - Peşəkar Dizayn, Foto, Video və Yaradıcı Alətlər Paketi</h3>\n<p>Adobe Creative Cloud, dizayn, foto redaktə, video montaj, animasiya, veb dizayn və kreativ kontent istehsalı ilə məşğul olan istifadəçilər üçün hazırlanmış peşəkar proqramlar paketidir. Standart redaktə alətlərindən fərqli olaraq, Creative Cloud Photoshop, Illustrator, Premiere Pro, After Effects, Lightroom və digər güclü Adobe tətbiqlərini bir ekosistemdə birləşdirir. Peşəkar vizuallar, reklam materialları, video layihələr və brend dizaynları hazırlamaq istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>Adobe Creative Cloud, istifadəçilərə foto retuşu, qrafik dizayn, loqo hazırlanması, video montaj, rəng korreksiyası, animasiya, sosial media kontenti və çap materialları yaratmaq üçün geniş imkanlar təqdim edir. Platforma bulud yaddaşı, proqramlararası inteqrasiya və peşəkar fayl formatları ilə yaradıcı iş prosesini daha rahat və məhsuldar edir. Dizaynerlər, video redaktorlar, fotoqraflar və marketinq komandaları üçün güclü yaradıcı ekosistemdir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Adobe Creative Cloud Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Qrafik Dizaynerlər:</strong> Loqo, brend kimliyi, reklam bannerləri, posterlər və sosial media dizaynları hazırlayan mütəxəssislər.</li>\n  <li><strong>Fotoqraflar və Retuş Mütəxəssisləri:</strong> Şəkilləri peşəkar şəkildə redaktə etmək, rəngləmək və retuş etmək istəyənlər.</li>\n  <li><strong>Video Redaktorlar və Kontent Yaradıcıları:</strong> YouTube, TikTok, Instagram və reklam layihələri üçün peşəkar video montaj edənlər.</li>\n  <li><strong>Marketoloqlar və Biznes Komandaları:</strong> Brend üçün vizual materiallar, reklam kampaniyaları və təqdimat kontenti hazırlayanlar.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Adobe Creative Cloud-un Üstünlükləri</h3>\n<ul>\n  <li><strong>🎨 Peşəkar Adobe Proqramları:</strong> Photoshop, Illustrator, Premiere Pro, After Effects, Lightroom və digər güclü yaradıcı tətbiqlərə giriş.</li>\n  <li><strong>🎬 Video və Animasiya İmkanları:</strong> Peşəkar video montaj, rəng korreksiyası, motion graphics və vizual effektlər hazırlamaq.</li>\n  <li><strong>📸 Foto Redaktə və Retuş:</strong> Şəkilləri yüksək keyfiyyətdə düzəltmək, rəngləmək, fon dəyişmək və peşəkar retuş etmək imkanı.</li>\n  <li><strong>☁️ Bulud və Fayl Sinxronizasiyası:</strong> Layihələri buludda saxlamaq, müxtəlif cihazlardan işləmək və faylları rahat paylaşmaq.</li>\n  <li><strong>🚀 Yaradıcı İş Axınında Məhsuldarlıq:</strong> Proqramlararası inteqrasiya və peşəkar alətlər sayəsində dizayn və montaj prosesini daha sürətli idarə etmək.</li>\n</ul>",
    "rulesHtml": ""
  },
  "linkedin_career": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">LinkedIn Career - Peşəkar Karyera və İş Axtarışı Həlli</h3>\n<p>LinkedIn Career, karyerasını inkişaf etdirmək, peşəkar profilini gücləndirmək və daha yaxşı iş imkanlarına çatmaq istəyən istifadəçilər üçün hazırlanmış premium karyera xidmətidir. Standart LinkedIn istifadəsindən fərqli olaraq, Career abunəliyi iş elanlarına daha effektiv müraciət, profil görünürlüğünü artırmaq və karyera inkişafı üçün əlavə alətlər təqdim edir. İş axtaranlar, peşəkarlar və karyera dəyişikliyi etmək istəyənlər üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>LinkedIn Career, istifadəçilərə iş elanlarını daha rahat izləmək, müraciətlərini daha strateji şəkildə idarə etmək, profilini işəgötürənlər üçün daha cəlbedici göstərmək və peşəkar şəbəkəsini genişləndirmək imkanı verir. Platforma karyera hədəflərinə uyğun vakansiyalar tapmaq, bacarıqları nümayiş etdirmək və iş bazarında daha görünən olmaq üçün faydalı alətlər təqdim edir. LinkedIn Career xüsusilə aktiv iş axtaranlar və yeni fürsətlərə açıq olan peşəkarlar üçün güclü dəstəkdir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">LinkedIn Career Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>İş Axtaranlar:</strong> Daha uyğun vakansiyalar tapmaq, müraciətlərini izləmək və işəgötürənlərin diqqətini çəkmək istəyənlər.</li>\n  <li><strong>Karyera Dəyişikliyi Edənlər:</strong> Yeni sahəyə keçmək, bacarıqlarını ön plana çıxarmaq və fərqli imkanları araşdırmaq istəyən peşəkarlar.</li>\n  <li><strong>Tələbələr və Yeni Məzunlar:</strong> İlk iş təcrübəsini tapmaq, staj imkanlarını izləmək və peşəkar profil yaratmaq istəyənlər.</li>\n  <li><strong>Peşəkar Şəbəkəsini Genişləndirmək İstəyənlər:</strong> Şirkətlər, HR mütəxəssisləri və sahə üzrə peşəkarlarla əlaqə qurmaq istəyən istifadəçilər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">LinkedIn Career-in Üstünlükləri</h3>\n<ul>\n  <li><strong>💼 Daha Effektiv İş Axtarışı:</strong> Karyera hədəflərinə uyğun vakansiyaları tapmaq və müraciət prosesini daha rahat idarə etmək.</li>\n  <li><strong>👀 Profil Görünürlüğünün Artırılması:</strong> İşəgötürənlər və HR mütəxəssisləri tərəfindən daha çox görünmək və diqqət çəkmək imkanı.</li>\n  <li><strong>📊 Müraciət və Rəqabət Məlumatları:</strong> İş elanları üzrə müraciət vəziyyətini və digər namizədlərlə müqayisəli məlumatları daha yaxşı anlamaq.</li>\n  <li><strong>🤝 Peşəkar Şəbəkə İmkanları:</strong> Şirkətlər, rəhbərlər, HR mütəxəssisləri və sahə ekspertləri ilə əlaqə quraraq karyera imkanlarını genişləndirmək.</li>\n  <li><strong>🚀 Karyera İnkişafına Dəstək:</strong> Profilin təkmilləşdirilməsi, bacarıqların ön plana çıxarılması və yeni iş fürsətlərinə daha hazırlıqlı yanaşmaq.</li>\n</ul>",
    "rulesHtml": ""
  },
  "elevenlabs_creator": {
    "aboutHtml": "<h3 style=\"color:#ffd400; margin-top:0;\">ElevenLabs Creator - Süni İntellekt Dəstəkli Səs və Voiceover Platforması</h3>\n<p>ElevenLabs Creator, mətnləri realistik səsləndirməyə çevirmək, peşəkar voiceover hazırlamaq və süni intellekt vasitəsilə yüksək keyfiyyətli audio kontent yaratmaq istəyən istifadəçilər üçün hazırlanmış premium AI səs platformasıdır. Standart səs yazma üsullarından fərqli olaraq, ElevenLabs Creator təbii səslənən AI səsləri, çoxdilli dəstək və sürətli audio generasiya imkanları təqdim edir. Video, reklam, podkast, təlim və sosial media kontenti üçün ideal rəqəmsal həlldir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">Məhsul Haqqında</h3>\n<p>ElevenLabs Creator, istifadəçilərə yazılmış mətnləri təbii danışıq tonuna yaxın səslərlə audioya çevirmək, müxtəlif dillərdə voiceover hazırlamaq və kontentə peşəkar səs əlavə etmək imkanı verir. Platforma videolar, reklam çarxları, YouTube kontenti, audiokitablar, təlim materialları və sosial media layihələri üçün rahat istifadə olunur. AI texnologiyası sayəsində səs yazısı prosesini daha sürətli, daha çevik və daha keyfiyyətli edir.</p>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">ElevenLabs Creator Kimlər Üçün Uyğundur?</h3>\n<ul>\n  <li><strong>Kontent Yaradıcıları və YouTuber-lər:</strong> Videolar üçün peşəkar voiceover, intro, izah səsi və sosial media audio kontenti hazırlayanlar.</li>\n  <li><strong>SMM Menecerlər və Marketoloqlar:</strong> Reklam çarxları, məhsul tanıtımları və brend videoları üçün keyfiyyətli səs yaratmaq istəyənlər.</li>\n  <li><strong>Təlimçilər və Kurs Yaradıcıları:</strong> Onlayn dərslər, izah videoları, təlim materialları və audiokurslar üçün aydın səsləndirmə hazırlayanlar.</li>\n  <li><strong>Podkast və Audiokitab Hazırlayanlar:</strong> Yazılı mətnləri dinlənilə bilən, təbii və peşəkar audio formatına çevirmək istəyənlər.</li>\n</ul>\n\n<h3 style=\"color:#ffd400; margin-top:15px;\">ElevenLabs Creator-un Üstünlükləri</h3>\n<ul>\n  <li><strong>🎙️ Realistik AI Səsləri:</strong> Mətnləri təbii danışıq tonuna yaxın, aydın və peşəkar səsləndirməyə çevirmək imkanı.</li>\n  <li><strong>🌍 Çoxdilli Səsləndirmə:</strong> Müxtəlif dillərdə voiceover hazırlayaraq beynəlxalq kontent və geniş auditoriya üçün istifadə etmək.</li>\n  <li><strong>⚡ Sürətli Audio Generasiya:</strong> Əl ilə səs yazmağa ehtiyac qalmadan qısa zamanda hazır audio fayllar yaratmaq.</li>\n  <li><strong>🎬 Video və Reklamlar Üçün Uyğun:</strong> YouTube videoları, TikTok/Reels kontenti, reklam çarxları və təqdimatlar üçün keyfiyyətli səs əlavə etmək.</li>\n  <li><strong>🚀 Peşəkar Kontent Keyfiyyəti:</strong> Kontenti daha inandırıcı, cəlbedici və premium səviyyədə təqdim etməyə kömək edir.</li>\n</ul>",
    "rulesHtml": ""
  }
};

const INFO_TEXTS = {
  hbomax: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">HBO Max Premium (Şəxsi Otaq) + Surfshark VPN Hədiyyə</h3>
      <p>HBO Max Premium hesabı, dünyaca məşhur serialları izləmək üçün ideal platformadır.</p>
      <p><b>🎁 XÜSUSİ KAMPANİYA:</b> Bu paketi alan hər kəsə <b>Surfshark VPN</b> tamamilə pulsuz hədiyyə olunur!</p>
    `
  },
  capcut: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">CapCut PRO - Peşəkar Video Montaj</h3>
      <p>CapCut PRO hesabı, keyfiyyətli və limitsiz şəkildə videolar hazırlanması üçün nəzərdə tutulmuş premium video montaj proqramıdır.</p>
    `
  },
  zoom: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Zoom Pro - Peşəkar Video Konfrans</h3>
      <p>Zoom Pro hesabı, onlayn görüşlərin, kəsintisiz, yüksək keyfiyyətli və limitsiz şəkildə həyata keçirilməsi üçün premium platformasıdır.</p>
    `
  },
  netflix: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Netflix Premium (Şəxsi Otaq) - 4K Ultra HD</h3>
      <p>Sizə təqdim edilən "Şəxsi Otaq" paketi vasitəsilə ümumi Premium hesab daxilində yalnız sizə aid olan xüsusi profilə sahib olursunuz.</p>
    `
  },
  netflix_umumi: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Netflix Premium (Ümumi Otaq) - Sərfəli Qiymət</h3>
      <p>Bu paket büdcəsinə qənaət edərək, sadəcə bir cihazdan film və seriallardan həzz almaq istəyən şəxslər üçün ən ideal və sürətli həlldir.</p>
    `
  },
  youtube: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">YouTube Premium - Reklamsız İzləmə</h3>
      <p>YouTube Premium hesabı, videoları reklamsız izləmək və YouTube Music xidmətindən istifadə etmək üçündür.</p>
    `
  },
  spotify: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Spotify Premium - Reklamsız Musiqi</h3>
      <p>Spotify Premium hesabı, musiqi və podkastlara reklamsız və kəsintisiz çıxış əldə etmək üçün rəqəmsal yayım platformasıdır.</p>
    `
  },
  surfshark: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Surfshark VPN - Təhlükəsiz İnternet</h3>
      <p>İnternetdə tam anonim və təhlükəsiz gəzinmək üçün premium VPN xidməti.</p>
    `
  },
  tiktok_jeton: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">TikTok Jeton - Sürətli Yükləmə</h3>
      <p>TikTok Jeton, canlı yayımlarda dəstək olmaq və hədiyyə göndərmək üçün istifadə olunan rəsmi virtual valyutadır.</p>
    `
  },
  google_ai: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Google AI Pro + VEO 3 (Gemini)</h3>
      <p>Mürəkkəb mətn tapşırıqları və yüksək keyfiyyətli səsli videoların süni intellekt vasitəsilə hazırlanması üçün premium platforma.</p>
    `
  },
  google_ai_ultra: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Google AI Ultra + VEO 3 (Gemini)</h3>
      <p>Ən mürəkkəb mətn və video generasiyası tapşırıqlarını maksimum peşəkarlıqla həyata keçirmək üçün ən güclü (Ultra) AI.</p>
    `
  },
  captions: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Captions AI - Peşəkar Altyazı Həlli</h3>
      <p>Videolarınız üçün avtomatik altyazılar yaratmaq və səsi fərqli dillərə tərcümə etmək üçün premium platformadır.</p>
    `
  },
  grok_supergrok: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Grok AI Super - Real-Time Süni İntellekt</h3>
      <p>xAI tərəfindən yaradılmış və X (Twitter) platformasının real-time məlumat bazasına birbaşa çıxışı olan premium AI.</p>
    `
  },
  claude_ai: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Claude AI (Pro) - Dərin Analiz</h3>
      <p>Mürəkkəb mətnlərin yazılması, böyük həcmli məlumatların analizi üçün premium platformadır.</p>
    `
  },
  prime: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Amazon Prime Video</h3>
      <p>Minlərlə populyar film və eksklüziv məzmunları ən yüksək keyfiyyətdə izləmək üçün qlobal rəqəmsal yayım platformasıdır.</p>
    `
  },
  duolingo: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Duolingo Super - Limitsiz Öyrənmə</h3>
      <p>Duolingo Super hesabı, xarici dil öyrənmək prosesini daha sürətli, əyləncəli və limitsiz şəkildə həyata keçirmək üçündür.</p>
    `
  },
  canva: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Canva Premium (Pro) - Peşəkar Dizayn</h3>
      <p>Canva Premium hesabı, istənilən növ qrafik dizayn, təqdimat və video materialların hazırlanması üçündür.</p>
    `
  },
  chatgpt: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">ChatGPT Plus - Qabaqcıl Süni İntellekt</h3>
      <p>Mürəkkəb mətnlərin yazılması, məlumat analizi və yaradıcı tapşırıqlar üçün premium süni intellekt platformasıdır.</p>
    `
  },
  adobecc: {
    htmlContent: `
      <h3 style="color:#ffd400; margin-top:0;">Adobe Creative Cloud - Peşəkar Dizayn Həlli</h3>
      <p>Qrafik dizayn, video montaj və 3D modelləşdirmə layihələrinin hazırlanması üçün qabaqcıl proqramlar toplusudur.</p>
    `
  }
};

/* =========================
   ROUTING & MODAL MENECMENTİ
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
  const heroSection = document.getElementById("hero-section");
  if(heroSection) heroSection.style.display = "block"; // Geri qayıdanda Hero görünür
  window.scrollTo(0, savedScrollY || 0);
});

document.querySelector(".brand")?.addEventListener("click", () => {
  document.getElementById("productPageView").style.display = "none";
  document.getElementById("homePageView").style.display = "block";
  const heroSection = document.getElementById("hero-section");
  if(heroSection) heroSection.style.display = "block";
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
    let oldPrice = pl.oldPrice || (price * 1.5 + 2).toFixed(2); 
    let discount = pl.discount ? parseInt(pl.discount.toString().replace('-','').replace('%','')) : Math.round((1 - (price/oldPrice)) * 100);

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
  
  similar = similar.slice(0, 4);

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
      cBox.innerHTML = (info && info.htmlContent) ? info.htmlContent : `<p>${p.desc}</p><p>Sifariş etmək üçün WhatsApp-a yönləndiriləcəksiniz.</p>`;
    } 
    else if (tabName === "tab-rules") {
      if (adminContent.rulesHtml) {
        cBox.innerHTML = adminContent.rulesHtml;
      }
      else if (p.id === "netflix" || p.id === "hbomax") {
        cBox.innerHTML = `
          <h3 style="color:#ffd400; margin-top:0;">Mirpanel: ${p.title} Qaydaları</h3>
          <ul style="list-style-type: none; padding-left:0; margin-bottom:15px; line-height: 1.6;">
            <li>✅ Otaq yalnız sizə aiddir.</li>
            <li>✅ Otaq Adını və PIN-i dəyişə bilərsiniz.</li>
            <li>🆘 Eyni anda bir neçə cihazdan istifadə etməyin.</li>
          </ul>
        `;
      }
      else {
        cBox.innerHTML = `
          <h3 style="color:#ffd400;margin-top:0;">İstifadə Qaydaları və Şərtlər</h3>
          <p>1. Bütün hesablar rəsmi və qanuni yollarla aktivləşdirilir.</p>
          <p>2. Sifariş verdikdən sonra məlumatlar WhatsApp vasitəsilə sizə təqdim olunacaq.</p>
        `;
      }
    }
  };

  tabs.forEach(t => t.onclick = () => showTab(t.getAttribute("data-target")));
  showTab("tab-about"); 
}

/* =========================
   TƏK MƏHSUL SİFARİŞ FORMLARI
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
  } else if (id === "netflix" || id === "prime" || id === "hbomax") {
      showNameCodeForm(currentProduct, plan, id === "prime" ? 5 : 4);
  } else if (id === "spotify") {
      showSpotifyWarning(currentProduct, plan);
  } else if (id === "chatgpt") {
      showChatGPTWarning(currentProduct, plan);
  } else if (id === "youtube") {
      showYoutubeWarningForm(currentProduct, plan);
  } else if (id === "canva" || id === "google_ai" || id === "google_ai_ultra" || id === "captions" || id === "grok_supergrok" || id === "claude_ai" || id === "adobecc" || id === "duolingo" || id === "adobe-express" || id === "picsart-premium" || id === "lightroom-photo" || id === "gemini-ai-pro") {
      showEmailOnlyForm(currentProduct, plan);
  } else {
      showConfirmOnlyForm(currentProduct, plan);
  }
});

function showSpotifyWarning(p, plan) {
  document.getElementById("mForm").innerHTML = `
    <div class="mpForm" style="text-align:left;">
      <div style="color:#d1d5db; font-size:14px; margin-bottom:15px;">
        Şəxsi hesabınızda rəsmi <b>Spotify Premium</b> paketi aktivləşdirilir.
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
      <div style="color:#d1d5db; font-size:14px; margin-bottom:15px;">
        <b>ChatGPT Plus</b> birbaşa sizin şəxsi hesabınızda aktivləşdiriləcəkdir.
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
      <div style="color:#d1d5db; font-size:14px; margin-bottom:15px;">
        Təqdim edilən hesab <b>yeni Gmail</b> olmalı və heç bir ailə planına qoşulmamalıdır.
      </div>
      <div style="display:flex; gap:10px;">
        <button id="yt_cancel" class="mpBtn" style="background:#374151; color:#fff; flex:1;">Ləğv et</button>
        <button id="yt_confirm" class="mpBtn" style="background:#f3f4f6; color:#000; flex:1;">Təsdiq edirəm</button>
      </div>
    </div>
  `;
  document.getElementById("yt_cancel").onclick = () => { closeModal(); };
  document.getElementById("yt_confirm").onclick = () => { showEmailOnlyForm(p, plan); };
}

function showConfirmOnlyForm(p, plan) {
  document.getElementById("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle" style="margin-bottom: 10px;">Sifarişi Təsdiqlə</div>
      <div style="text-align:center; color:#ccc; font-size:14px; margin-bottom:20px; line-height: 1.5;">
         Siz <b>${p.title}</b> (${plan.label || plan.months + ' aylıq'}) sifariş edirsiniz.
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
  let cpLabel = digits + " " + UI.codePlace; 
  document.getElementById("mForm").innerHTML = `
    <div class="mpForm">
      <div class="mpFormTitle">${UI.formTitle}</div>
      <div class="mpGrid2">
        <div><div class="mpLabel">Otaq (Profil) Adı</div><input id="x_name" class="mpInput" placeholder="${UI.namePlace}"></div>
        <div><div class="mpLabel">${cpLabel}</div><input id="x_code" class="mpInput" type="number" placeholder="${cpLabel}"></div>
      </div>
      <button id="x_send" class="mpBtn">${UI.sendWa}</button>
    </div>`;
  document.getElementById("x_send").onclick = () => {
    const name = document.getElementById("x_name").value.trim(), code = document.getElementById("x_code").value.trim();
    if(!name) return alert(UI.reqName);
    if(code.length !== digits) return alert(UI.reqCode);
    sendWA(p, plan, `Otaq/Profil Adı: ${name}\nPIN Kod: ${code}`);
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
    sendWA(p, plan, `Say: ${c}\nİstifadəçi: ${user}\nŞifrə: ${pass}`);
    closeModal();
  };
}

function sendWA(p, plan, extra) {
  const tPlan = plan.label ? plan.label : `${plan.months} aylıq`;
  const orderId = Math.floor(10000 + Math.random() * 90000);
  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw8eRhDxBhq5Kf68eVQBAnqf9llgo1bQWKgdwpBa0utRgVwn6rKd9YUCP6e70iPbHTMOg/exec";

  const formData = new FormData();
  formData.append('orderId', orderId); 
  formData.append('product', p.title);
  formData.append('plan', tPlan);
  formData.append('price', plan.price + ' ' + p.currency);
  formData.append('extra', extra); 

  fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: formData }).catch(err => { console.error("Sheet Error:", err); });

  const waMessage = `Salam, sifariş etmək istəyirəm.\n\nSifariş №: ${orderId}\nMəhsul: ${p.title}\nMüddət: ${tPlan}\nQiymət: ${plan.price} ${p.currency}\n\n${extra}`;
  window.open(PHONE_WA + "?text=" + encodeURIComponent(waMessage), "_blank");
}

function closeModal() {
  const mod = document.getElementById("modal");
  if(mod) mod.classList.remove("show");
  unlockBodyScroll();
}

function getMinPrice(p) { return Math.min(...(p.plans||[]).filter(x => x.price > 0).map(x => x.price)); }
function formatPrice(n) { return Number(n).toFixed(2); }
function esc(s) { return String(s ?? "").replaceAll("<", "<").replaceAll(">", ">"); }


/* =========================
   UI YÜKLƏNMƏ (SLAYDER, GRID VƏ YENİ SIRALAMA MƏNTİQİ)
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

const $ = (id) => document.getElementById(id);

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
