/* =========================================================
   app.js — Mirpanel (TAM FINAL: YENİ SIRALAMA BANNERİ VƏ YAN MENYU)
   ========================================================= */

let PHONE_WA = "https://wa.me/994514113545";

/* =========================
   UI MƏTNLƏRİ (YALNIZ AZ)
   ========================= */
const UI = {
  "brandSub": "Premium Hesablar • Etibarlı Aktivləşmə",
  "bannerText": "Diqqət! Saytımızda qeydiyyat tələb olunmur. Məhsulu seçib ödənişi tamamladıqdan sonra WhatsApp avtomatik açılacaq.",
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
  "orderBtn": "İndi al",
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
      "key": "subscriptions",
      "name": "Rəqəmsal abunəliklər",
      "order": 1,
      "active": true,
      "icon": "sparkles"
    },
    {
      "key": "design",
      "name": "Dizayn proqramları",
      "order": 2,
      "active": true,
      "icon": "image"
    },
    {
      "key": "ai",
      "name": "Süni intellekt",
      "order": 3,
      "active": true,
      "icon": "ai"
    },
    {
      "key": "office",
      "name": "Ofis və proqramlaşdırma",
      "order": 4,
      "active": true,
      "icon": "products"
    },
    {
      "key": "games",
      "name": "Oyunlar və oyun balansları",
      "order": 5,
      "active": true,
      "icon": "game"
    },
    {
      "key": "steam",
      "name": "Steam oyunları",
      "order": 6,
      "active": true,
      "icon": "game"
    },
    {
      "key": "panel",
      "name": "Panel xidmətləri",
      "order": 7,
      "active": true,
      "icon": "products"
    },
    {
      "key": "other",
      "name": "Digər məhsullar",
      "order": 8,
      "active": true,
      "icon": "products"
    }
  ],
  "products": [
    {
      "id": "youtube",
      "_stableId": "youtube",
      "order": 1,
      "category": "subscriptions",
      "image": "uploads/products/youtube-1792448135653-d84f34dc.png?v=1792448135653",
      "currency": "₼",
      "title": "YouTube Premium (Öz hesabınız)",
      "variant": "Gmail",
      "badge": "Video",
      "imageAlt": "YouTube Premium — MirPanel məhsul şəkli",
      "desc": "YouTube-da video izləmək və musiqi dinləmək üçün öz Google hesabınızda aktivləşdirilən abunəlikdir. Hazır yeni hesab satışı ilə eyni deyil.",
      "note": "Aktivləşmə üçün Gmailinizi qeyd edin.",
      "longDescription": "YouTube-da video izləmək və musiqi dinləmək üçün öz Google hesabınızda aktivləşdirilən abunəlikdir. Hazır yeni hesab satışı ilə eyni deyil. Sifarişdə tələb olunan Google hesabı məlumatlarını yalnız qorunan sifariş formasında yazın. Aktivləşdirmədən sonra məhz həmin hesabla YouTube-a daxil olub abunəlik vəziyyətini yoxlayın.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "youtube-premium",
      "seoTitle": "YouTube Premium almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "YouTube-da video izləmək və musiqi dinləmək üçün öz Google hesabınızda aktivləşdirilən abunəlikdir. Hazır yeni hesab satışı ilə eyni deyil. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "YouTube Premium",
      "seoPrimaryKeyword": "YouTube Premium almaq",
      "seoRelatedKeywords": " YouTube Premium qiyməti",
      "seoKeywords": "YouTube Premium almaq, YouTube Premium qiyməti",
      "seoContent": "YouTube-da video izləmək və musiqi dinləmək üçün öz Google hesabınızda aktivləşdirilən abunəlikdir. Hazır yeni hesab satışı ilə eyni deyil.",
      "seoUpdatedAt": "2026-11-22T12:17:59.742Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "YouTube Premium almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "YouTube-da video izləmək və musiqi dinləmək üçün öz Google hesabınızda aktivləşdirilən abunəlikdir. Hazır yeni hesab satışı ilə eyni deyil. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/youtube.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/slider4.png",
        "mobileImage": "",
        "title": "YouTube Yeni hesab",
        "description": "Reklamsız izləmə, YouTube Music daxil.",
        "alt": "YouTube Premium banneri",
        "order": 9
      },
      "flow": "out_of_stock",
      "soldOut": true,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "confirm_then_whatsapp",
      "formFields": [
        {
          "key": "email",
          "type": "email",
          "label": "Email / Gmail",
          "placeholder": "Gmail ünvanınızı yazın",
          "description": "",
          "required": true,
          "enabled": true,
          "order": 1
        },
        {
          "key": "custom_6cd47184e15c44f6b78fbd1d0fb85073",
          "type": "text",
          "label": "Email / Gmail Şifrəsi",
          "placeholder": "Şifrə",
          "description": "",
          "required": false,
          "enabled": true,
          "order": 2
        }
      ],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "YouTube Premium abunəliyini tam zəmanətli və problemsiz aktivləşdirmək üçün bizə yeni bir Google (Gmail) hesabı təqdim etməyiniz tövsiyə olunur.\n\nKöhnə Gmail hesabı üzərindən də aktivləşdirmək mümkündür, lakin hesabın əvvəlki bölgə tarixçəsindən asılı olaraq 50% ehtimalla aktivasiya alınmaya bilər.  ",
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
          "stockSignature": "d93e40ae155d53635ab4545b35924c2da3a228c2a8d94b0613e5f9591e2490ea",
          "stockContract": "[null,1,null]",
          "id": "0",
          "warrantyUnit": "day",
          "warrantyDuration": 30,
          "stockIdentityId": null,
          "pricingId": "6b70f3f1-26b6-47f3-9b60-1ccf560aa27c",
          "label": "1 Ay",
          "months": 1,
          "price": 5.99,
          "regularPrice": 15
        },
        {
          "stockSignature": "d8299fd93481a2bd30a135c447452dd34c85eaab84f009d6e53a3ac5fc31f727",
          "stockContract": "[null,12,null]",
          "id": "1",
          "durationMonths": 12,
          "duration_months": 12,
          "warrantyMode": "guaranteed",
          "stockVisibility": "show",
          "warrantyDuration": 12,
          "stockIdentityId": null,
          "pricingId": "24f61b10-9eb3-4ca7-bf6d-5ea460c68e8f",
          "label": "12 Ay",
          "months": 12,
          "price": 49.49,
          "regularPrice": 165
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "YouTube Premium abunəliyini tam zəmanətli və problemsiz aktivləşdirmək üçün bizə yeni bir Google (Gmail) hesabı təqdim etməyiniz tövsiyə olunur.\n\nKöhnə Gmail hesabı üzərindən də aktivləşdirmək mümkündür, lakin hesabın əvvəlki bölgə tarixçəsindən asılı olaraq 50% ehtimalla aktivasiya alınmaya bilər.  ",
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
      "id": "zoom",
      "_stableId": "zoom",
      "order": 2,
      "category": "office",
      "image": "uploads/products/zoom-1793128113656-08a17411.png?v=1793128113656",
      "currency": "₼",
      "title": "Zoom Pro",
      "variant": "Pro",
      "badge": "Görüş",
      "imageAlt": "Zoom Pro — MirPanel məhsul şəkli",
      "desc": "Zoom Pro onlayn dərs, iş görüşü və toplantılar üçün hesab təklifidir. Müddəti və qiyməti aşağıdakı paket seçimində müqayisə edə bilərsiniz.",
      "note": "Hesab aktiv və hazır şəkildə təqdim olunur.",
      "longDescription": "Zoom Pro onlayn dərs, iş görüşü və toplantılar üçün hesab təklifidir. Müddəti və qiyməti aşağıdakı paket seçimində müqayisə edə bilərsiniz. Təhvil verilən hesabın e-poçt və şifrəsi ilə Zoom tətbiqinə daxil olun. Zoom təsdiq kodu istəyərsə sifarişinizdəki Telefonla giriş təlimatını izləyin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "zoom-pro",
      "seoTitle": "Zoom Pro almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Zoom Pro almaq üçün MirPanel-də mövcud müddət və AZN qiymətinə baxın. Hazır hesabın təhvili, telefonla giriş və təsdiq kodu addımları ilə tanış olun.",
      "seoH1": "Zoom Pro",
      "seoPrimaryKeyword": "Zoom Pro almaq",
      "seoRelatedKeywords": " Zoom Pro Azərbaycan, Zoom hesabı qiyməti",
      "seoKeywords": "Zoom Pro almaq, Zoom Pro Azərbaycan, Zoom hesabı qiyməti",
      "seoContent": "Zoom Pro onlayn dərs, iş görüşü və toplantılar üçün hesab təklifidir. Müddəti və qiyməti aşağıdakı paket seçimində müqayisə edə bilərsiniz.",
      "seoUpdatedAt": "2026-11-22T12:17:59.743Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Zoom Pro almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Zoom Pro almaq üçün MirPanel-də mövcud müddət və AZN qiymətinə baxın. Hazır hesabın təhvili, telefonla giriş və təsdiq kodu addımları ilə tanış olun.",
      "seoOgImage": "assets/zoom.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/zoom.png",
        "mobileImage": "",
        "title": "Zoom Pro",
        "description": "Peşəkar onlayn görüşlər.",
        "alt": "Zoom Pro",
        "order": 16
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": true,
      "seller": "",
      "bestSeller": true,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
      "orderGuide": {
        "information": "💻 Necə istifadə etməli?\nHesabdan həm telefonunuzdan, həm də noutbuk və ya kompüterinizdən rahatlıqla daxil olub istifadə edə bilərsiniz.\n\n⚠️ Vacib Qaydalar və Qeydlər:\nŞifrəni dəyişməyin: Hər hansı problem yaranarsa dərhal kömək edə bilməyimiz üçün zəhmət olmasa şifrəni dəyişməyin. Əgər mütləq dəyişməli olursunuzsa, dərhal bizə yeni şifrəni bildirin!\n\n2FA (İki mərhələli doğrulama): Giriş zamanı 2FA tələbi gələrsə, sadəcə \"Skip\" (Ötür) düyməsini seçin.\n\nOTP kodu: E-poçtda 333333 kodunu görsəniz, bu, sadəcə sistemin yer tutucusudur. Düzgün 6 rəqəmli kodu görmək üçün həmin sətrin/kodun üzərinə klikləməlisiniz. Birbaşa 333333 yazmayın, əks halda səhv verəcək (əgər hesab bloklanarsa, açılması üçün 30 dəqiqə gözləməli olacaqsınız).",
        "tracks": {}
      },
      "confirmationModal": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "Sifarişdən sonra \"Zoom Pro\" paketi aktiv edilmiş yeni və tam şəxsi hesab təqdim olunur.\nCihaz İstifadəsi: Hesaba əlavə cihaz qoşa bilərsiniz — həm telefon, həm də noutbuk/kompüterdən eyni vaxtda daxil olmaq mümkündür.\nMəxfilik və Şifrə: Hesab tam sizə aid olduğu üçün daxil olduqdan sonra şifrəsini dəyişərək hesabın məxfiliyini tam qoruya bilərsiniz.\nPlatforma Qaydaları: \"ZOOM\" platformasının daxili təhlükəsizlik qaydaları, təsdiq mexanizmləri və etdiyi sistem dəyişiklikləri bizim nəzarətimizdə deyil.\nZəmanət və Cavabdehlik: Mirpanel.com sifarişə uyğun aktiv məhsulun düzgün təqdimatına tam cavabdehdir.\n\n💡 Vacib Məsləhət: Hesab təhvil verildikdən sonra ilk 24 saat ərzində daxil olun, sifariş məlumatlarındakı qeydləri nəzərə alın, təhlükəsizlik tədbirlərini görün (şifrəni yeniləyin) və \"Təlimat\" bölməsini mütləq oxuyun.",
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
          "stockSignature": "d1062bd2f0a1d6513aee999392c1f94a5434b9ca7c60dc2e90295acc53b11f80",
          "stockContract": "[null,1,null]",
          "id": "0",
          "warrantyMode": "guaranteed",
          "warrantyUnit": "day",
          "warrantyDuration": 28,
          "stockIdentityId": null,
          "pricingId": "f042d4ea-0063-4de1-ac11-bfb9aedc42a7",
          "label": "1 ay",
          "months": 1,
          "price": 9.98,
          "regularPrice": 27.18
        }
      ],
      "orderConfirmation": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "Sifarişdən sonra \"Zoom Pro\" paketi aktiv edilmiş yeni və tam şəxsi hesab təqdim olunur.\nCihaz İstifadəsi: Hesaba əlavə cihaz qoşa bilərsiniz — həm telefon, həm də noutbuk/kompüterdən eyni vaxtda daxil olmaq mümkündür.\nMəxfilik və Şifrə: Hesab tam sizə aid olduğu üçün daxil olduqdan sonra şifrəsini dəyişərək hesabın məxfiliyini tam qoruya bilərsiniz.\nPlatforma Qaydaları: \"ZOOM\" platformasının daxili təhlükəsizlik qaydaları, təsdiq mexanizmləri və etdiyi sistem dəyişiklikləri bizim nəzarətimizdə deyil.\nZəmanət və Cavabdehlik: Mirpanel.com sifarişə uyğun aktiv məhsulun düzgün təqdimatına tam cavabdehdir.\n\n💡 Vacib Məsləhət: Hesab təhvil verildikdən sonra ilk 24 saat ərzində daxil olun, sifariş məlumatlarındakı qeydləri nəzərə alın, təhlükəsizlik tədbirlərini görün (şifrəni yeniləyin) və \"Təlimat\" bölməsini mütləq oxuyun.",
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
      "id": "spotify",
      "_stableId": "spotify",
      "order": 3,
      "category": "subscriptions",
      "image": "uploads/products/spotify-1792446476574-ac5a1948.png?v=1792446476574",
      "currency": "₼",
      "title": "Spotify Premium (Öz hesabınız)",
      "variant": "Şəxsi hesab",
      "badge": "Musiqi",
      "imageAlt": "Spotify Premium — MirPanel məhsul şəkli",
      "desc": "Bu Spotify Premium təklifi müştərinin öz hesabında aktivləşdirmə üçündür. Mövcud hesabınızı istifadə etmək istəyirsinizsə seçilən paketin adını və tələb olunan giriş məlumatlarını yoxlayın.",
      "note": "",
      "longDescription": "Bu Spotify Premium təklifi müştərinin öz hesabında aktivləşdirmə üçündür. Mövcud hesabınızı istifadə etmək istəyirsinizsə seçilən paketin adını və tələb olunan giriş məlumatlarını yoxlayın. Sifariş formasında tələb edilən e-poçt və Spotify şifrəsini yalnız saytın sifariş pəncərəsində daxil edin. Məlumatların düzgünlüyünü təsdiqləyin və aktivləşdirməni Sifarişlərimdən izləyin.",
      "usageRules": "",
      "deliveryText": "1-3 saat",
      "availabilityText": "",
      "seoSlug": "spotify-premium",
      "seoTitle": "Spotify Premium almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Spotify Premium-u öz hesabınızda aktivləşdirmək üçün MirPanel paketinə baxın. AZN qiyməti, tələb olunan e-poçt və giriş məlumatlarını əvvəlcədən yoxlayın.",
      "seoH1": "Spotify Premium",
      "seoPrimaryKeyword": "Spotify Premium almaq",
      "seoRelatedKeywords": " Spotify Premium Azərbaycan, Spotify qiyməti",
      "seoKeywords": "Spotify Premium almaq, Spotify Premium Azərbaycan, Spotify qiyməti",
      "seoContent": "Bu Spotify Premium təklifi müştərinin öz hesabında aktivləşdirmə üçündür. Mövcud hesabınızı istifadə etmək istəyirsinizsə seçilən paketin adını və tələb olunan giriş məlumatlarını yoxlayın.",
      "seoUpdatedAt": "2026-11-22T12:17:59.743Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Spotify Premium almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Spotify Premium-u öz hesabınızda aktivləşdirmək üçün MirPanel paketinə baxın. AZN qiyməti, tələb olunan e-poçt və giriş məlumatlarını əvvəlcədən yoxlayın.",
      "seoOgImage": "assets/spotify.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/slider1.png",
        "mobileImage": "",
        "title": "Spotify Premium",
        "description": "Reklamsız musiqi, yüksək səs keyfiyyəti və limitsiz mahnı keçidləri.\n",
        "alt": "Spotify Premium banneri",
        "order": 4
      },
      "flow": "spotify",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": true,
      "spotifyPasswordResetUrl": "https://accounts.spotify.com/az/password-reset",
      "orderFlow": "form_confirm_whatsapp",
      "formFields": [
        {
          "key": "email",
          "type": "email",
          "label": "Gmail ünvanınız",
          "placeholder": "Gmail ünvanınızı yazın",
          "description": "",
          "required": true,
          "enabled": true
        },
        {
          "key": "password",
          "type": "password",
          "label": "Spotify şifrəniz",
          "placeholder": "Spotify şifrənizi yazın",
          "description": "",
          "required": true,
          "enabled": true
        },
        {
          "key": "password_confirm",
          "type": "password",
          "label": "Spotify şifrənizi təkrar yazın",
          "placeholder": "Şifrənizi yenidən yazın",
          "description": "",
          "required": true,
          "enabled": true
        }
      ],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "**Spotify Premium – şəxsi hesabınıza aktivləşdirmə**\n\nSpotify Premium abunəliyi təqdim etdiyiniz şəxsi hesabda aktivləşdirilir.\n\n⚠️ **Vacib məlumat**\n\nSpotify öz qaydalarına əsasən abunəliyi istənilən vaxt dayandırmaq və ya ləğv etmək hüququna malikdir. Nadir hallarda rast gəlinən bu vəziyyət xidmət təminatçısının nəzarətindən kənardır. Buna görə platforma tərəfindən həyata keçirilən məhdudiyyət və ya ləğvlərlə bağlı geri ödəniş və zəmanət təqdim edilmir.\n\nSifariş verməklə qeyd olunan şərtləri və mümkün riskləri qəbul etmiş sayılırsınız. **Xahiş edirik, ödəniş etməzdən əvvəl şərtləri diqqətlə nəzərdən keçirin.**\n\n📌 **Diqqət:** Aktivləşdirmənin problemsiz tamamlanması üçün hesab məlumatlarınızı düzgün daxil etdiyinizə əmin olun.",
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
          "stockSignature": "3395b03a29f6d9ded72e3af03704e84379290492cbf29058dec239c44a895d6f",
          "stockContract": "[null,1,null]",
          "id": "0",
          "warrantyDuration": 1,
          "stockIdentityId": null,
          "pricingId": "018ff8cf-5756-474c-ad89-a437b2e5d2c9",
          "label": "1 Ay  (Öz hesabınızda aktiv edilir)",
          "months": 1,
          "price": 5.49,
          "regularPrice": 11
        },
        {
          "stockSignature": "df1026fd058c6c674df6c33c1e8cb2b463f4e8aaf006159eb2c677abeb9996ef",
          "stockContract": "[null,12,null]",
          "id": "1",
          "durationMonths": 12,
          "duration_months": 12,
          "warrantyMode": "guaranteed",
          "warrantyDuration": 12,
          "stockIdentityId": null,
          "pricingId": "f7552b80-54eb-4779-9bb1-6d4b56f7b30e",
          "label": "12 Ay (Öz hesabınızda aktiv edilir) endirim💥",
          "months": 12,
          "price": 44.99,
          "regularPrice": 168.12
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "**Spotify Premium – şəxsi hesabınıza aktivləşdirmə**\n\nSpotify Premium abunəliyi təqdim etdiyiniz şəxsi hesabda aktivləşdirilir.\n\n⚠️ **Vacib məlumat**\n\nSpotify öz qaydalarına əsasən abunəliyi istənilən vaxt dayandırmaq və ya ləğv etmək hüququna malikdir. Nadir hallarda rast gəlinən bu vəziyyət xidmət təminatçısının nəzarətindən kənardır. Buna görə platforma tərəfindən həyata keçirilən məhdudiyyət və ya ləğvlərlə bağlı geri ödəniş və zəmanət təqdim edilmir.\n\nSifariş verməklə qeyd olunan şərtləri və mümkün riskləri qəbul etmiş sayılırsınız. **Xahiş edirik, ödəniş etməzdən əvvəl şərtləri diqqətlə nəzərdən keçirin.**\n\n📌 **Diqqət:** Aktivləşdirmənin problemsiz tamamlanması üçün hesab məlumatlarınızı düzgün daxil etdiyinizə əmin olun.",
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
      "id": "netflix",
      "_stableId": "netflix",
      "order": 4,
      "category": "subscriptions",
      "image": "uploads/products/netflix-1792446904161-56cd3ef4.png?v=1792446904161",
      "currency": "₼",
      "title": "Netflix Şəxsi",
      "variant": "Premium",
      "badge": "Film",
      "imageAlt": "Netflix Şəxsi — MirPanel məhsul şəkli",
      "desc": "Netflix Şəxsi film və serial izləmək üçün ayrılan otaq/profil təklifidir. Bu məhsulu ümumi hesabdan fərqləndirən hissə sifarişinizə aid otaq və PIN məlumatıdır.",
      "note": "Ödəniş təsdiqləndikdən sonra otaq və PIN Sifarişlərim bölməsində göstərilir.",
      "longDescription": "Netflix Şəxsi film və serial izləmək üçün ayrılan otaq/profil təklifidir. Bu məhsulu ümumi hesabdan fərqləndirən hissə sifarişinizə aid otaq və PIN məlumatıdır. Təhvil tamamlandıqda hesab, otaq və PIN məlumatlarını Sifarişlərim bölməsindən açın. Ayrılmış profildən istifadə edin; digər profillərin məlumatlarını dəyişməyin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "netflix-sexsi",
      "seoTitle": "Netflix Şəxsi almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Netflix Şəxsi hesab almaq üçün aylıq və uzunmüddətli paketləri müqayisə edin. MirPanel-də AZN qiymətləri, ayrılmış otaq, PIN və təhvil qaydasını yoxlayın.",
      "seoH1": "Netflix Şəxsi",
      "seoPrimaryKeyword": "Netflix almaq",
      "seoRelatedKeywords": " Netflix Premium Azərbaycan, Netflix hesabı, Netflix qiyməti",
      "seoKeywords": "Netflix almaq, Netflix Premium Azərbaycan, Netflix hesabı, Netflix qiyməti",
      "seoContent": "Netflix Şəxsi film və serial izləmək üçün ayrılan otaq/profil təklifidir. Bu məhsulu ümumi hesabdan fərqləndirən hissə sifarişinizə aid otaq və PIN məlumatıdır.",
      "seoUpdatedAt": "2026-11-22T12:17:59.743Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Netflix Şəxsi almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Netflix Şəxsi hesab almaq üçün aylıq və uzunmüddətli paketləri müqayisə edin. MirPanel-də AZN qiymətləri, ayrılmış otaq, PIN və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/netflix.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/slider2.png",
        "mobileImage": "",
        "title": "Netflix Şəxsi",
        "description": "Filmlər, seriallar, yüksək keyfiyyət.",
        "alt": "Netflix banneri",
        "order": 2
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": true,
      "seller": "",
      "bestSeller": true,
      "orderFlow": "direct_whatsapp",
      "formFields": [
        {
          "key": "name",
          "type": "text",
          "label": "Ad",
          "placeholder": "Adınızı yazın",
          "description": "",
          "required": true,
          "enabled": true
        },
        {
          "key": "code_4",
          "type": "text",
          "label": "Otaq kodu",
          "placeholder": "Otaq 4 rəqəmli kod (PİN) təyin edin",
          "description": "",
          "required": true,
          "enabled": true
        }
      ],
      "formTitle": "",
      "formDescription": "",
      "orderGuide": {
        "information": "MƏLUMAT VƏ TƏLİMAT — NETFLIX | 4K HD | ŞƏXSİ OTAQ\n\nƏsas qaydalar\n\n• Hesaba maksimum 3 cihazdan daxil ola bilərsiniz. Məsələn, telefon, televizor və noutbuk.\n• Eyni anda yalnız 1 cihazda film və ya serial izləyə bilərsiniz.\n• Yalnız sizə ayrılmış profildən istifadə edin. Öz profilinizin adını və PİN kodunu dəyişə bilərsiniz.\n• Hesabın şifrəsini dəyişmək və giriş məlumatlarını başqası ilə paylaşmaq qadağandır.\n\nNetflix hesabına giriş\n1. Netflix tətbiqini açın və ya Netflix saytına daxil olun.\n2. Sifarişlərim bölməsində sizə təqdim olunan e-poçt və şifrəni yazın.\n3. Sizə ayrılmış profili seçin və 4 rəqəmli otaq kodunu daxil edin.\nGirişdə təsdiq kodu istənərsə\n\nGiriş ekranında Get help → Use password seçimi görünürsə, həmin keçidi seçin və sizə təqdim olunan hesab şifrəsini yazın. Otaq kodunu öz profilinizi açanda daxil edin.\n\nTelevizorda Netflix hesabına giriş\n1. Televizorda Netflix tətbiqini açın.\n2. Sign in düyməsini seçin. Get started düyməsinə basmayın.\n3. Ekranın yuxarısındakı Use remote seçiminə basın.\n4. Sizə göndərdiyimiz e-poçt ünvanını yazın və Next düyməsinə basın.\n5. Hesabın şifrəsini yazın və yenidən Next düyməsinə basın.\n6. Sizə ayrılmış profili seçin və 4 rəqəmli otaq kodunu daxil edin.\nKompüterdə Netflix hesabına giriş\n1. Brauzerdə Netflix-i açın. Giriş ekranında sizə göndərdiyimiz e-poçt ünvanını yazın və Continue düyməsinə basın.\n2. Ekran 4 rəqəmli təsdiq kodu istəsə, sol aşağıdakı Get help düyməsinə basın və Use password seçimini edin.\n3. Sizə göndərdiyimiz hesab şifrəsini yazın və daxil olun.\n4. Sizə ayrılmış profili seçin və 4 rəqəmli otaq kodunu daxil edin.\n \n📌 Diqqət\nBaşqa cihazda izləyirsinizsə, yeni cihazda izləməyə başlamazdan əvvəl əvvəlki cihazda videonu dayandırın.\n\nQaydalar pozularsa, hesaba giriş bloklana bilər. Geri ödəniş və əvəzləmə MirPanel-in satış şərtlərinə tabedir.\n\nProfilinizi tapa bilmirsinizsə, otaq kodu işləmirsə və ya girişdə çətinlik yaranırsa, sifariş nömrənizlə MirPanel → Operatora yaz bölməsindən bizə müraciət edin.",
        "tracks": {}
      },
      "confirmationModal": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "Profil tamamilə sizə aid olur. Öz profilinizin adını və PİN kodunu istədiyiniz kimi dəyişə bilərsiniz.\n\nCihaz Limiti: Hesaba maksimum 3 cihazdan daxil olmaq mümkündür (məsələn: Telefon, TV və Noutbuk).\n\nİzləmə Qaydası: Eyni anda yalnız 1 cihazdan film və ya serial izləmək olar.",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "months": 1,
          "price": 5.99,
          "regularPrice": 25
        },
        {
          "stockSignature": "be6c1277e7e29010d7b003e0d41272847365ca1372ccc7791a6de60445bd05d4",
          "stockContract": "[null,3,null]",
          "id": "1",
          "stockIdentityId": null,
          "months": 3,
          "price": 16.49
        },
        {
          "stockSignature": "6ba9a2b7ac0962c00573a86023d4eb50f8566376ac3bada7d5762216c6351acd",
          "stockContract": "[null,6,null]",
          "id": "2",
          "stockIdentityId": null,
          "months": 6,
          "price": 29.99
        }
      ],
      "orderConfirmation": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "Profil tamamilə sizə aid olur. Öz profilinizin adını və PİN kodunu istədiyiniz kimi dəyişə bilərsiniz.\n\nCihaz Limiti: Hesaba maksimum 3 cihazdan daxil olmaq mümkündür (məsələn: Telefon, TV və Noutbuk).\n\nİzləmə Qaydası: Eyni anda yalnız 1 cihazdan film və ya serial izləmək olar.",
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
      "id": "capcut",
      "_stableId": "capcut",
      "order": 5,
      "category": "design",
      "image": "uploads/products/capcut-1792446915889-2c0554fd.png?v=1792446915889",
      "currency": "₼",
      "title": "CapCut Pro",
      "variant": "Pro",
      "badge": "Video",
      "imageAlt": "CapCut Pro — MirPanel məhsul şəkli",
      "desc": "CapCut Pro video montajı üçün premium hesab təklifidir. Qısa müddətli və aylıq paketləri eyni səhifədə görüb ümumi qiymətlərini müqayisə edə bilərsiniz.",
      "note": "",
      "longDescription": "CapCut Pro video montajı üçün premium hesab təklifidir. Qısa müddətli və aylıq paketləri eyni səhifədə görüb ümumi qiymətlərini müqayisə edə bilərsiniz. Seçilən paket üçün verilmiş hesab və giriş üsulunu Sifarişlərimdən açın. Tətbiq versiyası və cihazla bağlı göstərişlər üçün məhsulun Təlimat bölməsinə baxın.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "capcut-pro",
      "seoTitle": "CapCut Pro almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "CapCut Pro almaq üçün qısa və aylıq paketləri MirPanel-də müqayisə edin. AZN qiymətləri, paket zəmanəti və təhvil sonrası giriş təlimatını yoxlayın.",
      "seoH1": "CapCut Pro",
      "seoPrimaryKeyword": "CapCut Pro almaq",
      "seoRelatedKeywords": " CapCut Pro Azərbaycan, CapCut qiyməti",
      "seoKeywords": "CapCut Pro almaq, CapCut Pro Azərbaycan, CapCut qiyməti",
      "seoContent": "CapCut Pro video montajı üçün premium hesab təklifidir. Qısa müddətli və aylıq paketləri eyni səhifədə görüb ümumi qiymətlərini müqayisə edə bilərsiniz.",
      "seoUpdatedAt": "2026-11-22T12:17:59.743Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "CapCut Pro almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "CapCut Pro almaq üçün qısa və aylıq paketləri MirPanel-də müqayisə edin. AZN qiymətləri, paket zəmanəti və təhvil sonrası giriş təlimatını yoxlayın.",
      "seoOgImage": "assets/capcut.png",
      "banner": {
        "enabled": true,
        "desktopImage": "/uploads/products/capcut-1786103247176-d7438ec7.jpg?v=1786103247176",
        "mobileImage": "",
        "title": "CapCut Pro",
        "description": "Rəsmi Pro funksiyalar, 4K eksport, premium effektlər və şablonlar.",
        "alt": "CapCut Pro banneri",
        "order": 1
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": true,
      "seller": "",
      "bestSeller": true,
      "orderFlow": "direct_whatsapp",
      "formFields": [
        {
          "key": "email",
          "type": "email",
          "label": "Email",
          "placeholder": "Gmail hesabınızı yazın",
          "description": "",
          "required": true,
          "enabled": false
        }
      ],
      "formTitle": "",
      "formDescription": "",
      "orderGuide": {
        "information": "İstifadə etməzdən əvvəl oxuyun\n\n\nMƏLUMAT VƏ TƏLİMAT - CAPCUT PRO\n\nƏsas qaydalar\n\n• Hesab yalnız sizə məxsusdur - başqa şəxslərlə paylaşmaq tövsiyə edilmir\n\n• Hesab və email sizdə olur, dəyişə bilərsiniz\n\n• Eyni anda birdən çox cihazda istifadə etməyin - deaktiv riski yaradır\n\n• Problem yaşansa, bizimlə əlaqə saxlayın - bərpa üçün kömək edilir\n\nCapCut hesabına giriş\n\n• CapCut tətbiqini açın və \"Sign in with mail\" seçin\n\n• Sizə təqdim olunan email və şifrəni daxil edin\n\n• Əlavə təsdiq kodu və ya ayar tələb olunmur\n\nPRO paketin aktiv olduğunu yoxlayın\n\n• Tətbiqə daxil olduqdan sonra \"Me\" (Profil) bölməsində PRO statusun aktiv olduğunu görəcəksiniz\n\n• PRO görünmürsə, çıxış edib yenidən daxil olun və ya tətbiqi yeniləyin\n\n• Yenə görünmürsə, Canlı Dəstək komandamızla əlaqə saxlayın\n\nKompüterdə istifadə\n\n• CapCut desktop tətbiqini yükləyin və eyni email və şifrə ilə daxil olun\n\n• CapCut web versiyasına QR kod ilə də giriş mümkündür\n\n• Qeyd: web versiyada bəzi funksiyalar məhdud işləyə bilər - tam təcrübə üçün desktop tətbiqi tövsiyə olunur",
        "tracks": {
          "phone": [
            {
              "animation": "ben",
              "image": "/uploads/guides/capcut-mobile/1.png",
              "description": "CapCut-u aç və sağ altdakı “Ben” bölməsinə toxun."
            },
            {
              "animation": "sign-in",
              "image": "/uploads/guides/capcut-mobile/2.png",
              "description": "Yuxarıdan üçüncü düyməni, “E-postayla giriş yapın” seç."
            },
            {
              "animation": "email",
              "image": "/uploads/guides/capcut-mobile/3.png",
              "description": "MirPanel-də sənə təqdim edilən e-poçtu yaz. Ekrandakı ünvan nümunədir."
            },
            {
              "animation": "password",
              "image": "/uploads/guides/capcut-mobile/4.png",
              "description": "MirPanel-də verilən şifrəni yaz və “Devam” düyməsinə toxun."
            },
            {
              "animation": "pro",
              "image": "/uploads/guides/capcut-mobile/5.png",
              "description": "Profil adının sağındakı “Pro” nişanını yoxla. Bu nişan CapCut Pro-nun aktiv olduğunu göstərir."
            }
          ]
        }
      },
      "confirmationModal": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "Sifarişinizi tamamlamazdan öncə qaydalarla tanış olun:\n\nTəhvil: CapCut Pro bizim tərəfimizdən hazır hesab kimi 30-60 saniyə ərzində təhvil verilir.\n\nQayda: Hesaba eyni anda yalnız 1 cihaz daxil ola bilər. İkinci cihaz qoşulduqda hesab bloklana bilər.\n\nMəsuliyyət: Qayda pozuntusuna görə hesab bloklanarsa, geri ödəniş edilmir və hesab əvəzlənmir.\nSifarişi təsdiqləməklə bu şərtləri tam qəbul etmiş sayılırsınız",
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
          "stockSignature": "c4a75349add27e1f8325ad85695875ef1530ae76f7af27efd7159dd36f122d95",
          "stockContract": "[null,1,null]",
          "id": "0",
          "warrantyUnit": "day",
          "warrantyDuration": 28,
          "bestValue": false,
          "stockIdentityId": null,
          "label": "1 Ay (endirim)",
          "months": 1,
          "price": 4.99,
          "regularPrice": 20
        },
        {
          "stockSignature": "079579ddca6eef092b4dc445cc40dff05357d423c19b982de3c2881898d9f717",
          "stockContract": "[7,7,null]",
          "id": "1",
          "durationDays": 7,
          "duration_months": 7,
          "warrantyMode": "guaranteed",
          "warrantyUnit": "day",
          "warrantyDuration": 6,
          "bestValue": true,
          "stockIdentityId": null,
          "pricingId": "fc790f2d-3f2d-4f31-9e61-a2ea1737e351",
          "label": " 7 gün",
          "months": 7,
          "price": 1.12,
          "regularPrice": 8
        }
      ],
      "orderConfirmation": {
        "enabled": false,
        "title": "Sifarişi təsdiqləyin",
        "description": "Sifarişinizi tamamlamazdan öncə qaydalarla tanış olun:\n\nTəhvil: CapCut Pro bizim tərəfimizdən hazır hesab kimi 30-60 saniyə ərzində təhvil verilir.\n\nQayda: Hesaba eyni anda yalnız 1 cihaz daxil ola bilər. İkinci cihaz qoşulduqda hesab bloklana bilər.\n\nMəsuliyyət: Qayda pozuntusuna görə hesab bloklanarsa, geri ödəniş edilmir və hesab əvəzlənmir.\nSifarişi təsdiqləməklə bu şərtləri tam qəbul etmiş sayılırsınız",
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
      "id": "chatgpt_ortaq",
      "_stableId": "chatgpt_ortaq",
      "order": 6,
      "category": "other",
      "image": "uploads/products/chatgpt_ortaq-1793127941676-a7cb0a6a.png?v=1793127941676",
      "currency": "₼",
      "title": "ChatGPT Plus (Ortaq hesab)",
      "variant": "",
      "badge": "Premium",
      "imageAlt": "ChatGPT Plus ortaq hesab — MirPanel məhsul şəkli",
      "desc": "",
      "note": "",
      "longDescription": "Süni intellektlə işləmək üçün paylaşılan hesab təklifidir; hazır şəxsi ChatGPT Plus məhsulundan ayrıdır. Paylaşılan girişdə hesabın şifrəsini və digər istifadəçilərin məlumatlarını dəyişməyin. İcazə verilən istifadə formasını təhvil təlimatından yoxlayın.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "chatgpt-plus-ortaq-hesab",
      "seoTitle": "ChatGPT Plus ortaq hesab almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Süni intellektlə işləmək üçün paylaşılan hesab təklifidir; hazır şəxsi ChatGPT Plus məhsulundan ayrıdır. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "ChatGPT Plus ortaq hesab",
      "seoPrimaryKeyword": "ChatGPT Plus ortaq hesab almaq",
      "seoRelatedKeywords": " ChatGPT Plus ortaq hesab qiyməti",
      "seoKeywords": "ChatGPT Plus ortaq hesab almaq, ChatGPT Plus ortaq hesab qiyməti",
      "seoContent": "Süni intellektlə işləmək üçün paylaşılan hesab təklifidir; hazır şəxsi ChatGPT Plus məhsulundan ayrıdır.",
      "seoUpdatedAt": "2026-11-22T12:17:59.743Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "ChatGPT Plus ortaq hesab almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Süni intellektlə işləmək üçün paylaşılan hesab təklifidir; hazır şəxsi ChatGPT Plus məhsulundan ayrıdır. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/chatgpt.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/chatgpt.png",
        "mobileImage": "",
        "title": "ChatGPT Plus (Ortaq hesab)",
        "description": "",
        "alt": "ChatGPT Plus (Ortaq hesab)",
        "order": 20
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": true,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "confirm_then_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "ChatGPT Ortaq Hesab İstifadə Qaydaları və Məlumatlar\n\nHesabın İdarə Edilməsi: Bu hesab ortaq şəkildə istifadə olunur və hesab 5-7 nəfər arasında bölünür. Plus paketi aktivdir. Paket limitləri istifadəçilər arasında paylaşıldığı üçün bəzən müvəqqəti tükənə bilər.\n\nCihaz Limitləri: Hesab yalnız 1 cihaz üçün nəzərdə tutulub. Eyni anda fərqli cihazlardan giriş cəhdi spam xətasına səbəb ola bilər və bu da hesabın bağlanmasına gətirib çıxarır.\n\nAbunəlik və Aktivlik: Hər hansı gözlənilməz dayanma olarsa, bizə dərhal bildirə bilərsiniz, biz təkrar bərpa edəcəyik.\n\nTəhlükəsizlik və Digər İstifadəçilər: Digər istifadəçilərin yazışmalarına, əməliyyatlarına müdaxilə etmək və onları silmək qəti qadağandır.\n\nCodex və Məxvilik: Əgər kod (və ya vacib işlər) üçün istifadə edəcəksinizsə və istəyirsiniz ki, hesabınız tam sizə aid olsun, sizdən başqası mesajlarınızı görməsin — şəxsi hesab almağınızı məsləhət görürük.\n\n💡 Vacib Qeyd: Zəhmət olmasa, istifadə etməzdən əvvəl yuxarıdakı qaydaları diqqətlə oxuyun.",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": true,
          "label": "🔗 Şəxsi hesab əldə etmək üçün buraya klikləyin 👑",
          "url": "https://mirpanel.com/mehsul/chatgpt-plus"
        }
      },
      "whatsapp": {
        "extraMessage": "",
        "includeSeller": false,
        "includeStock": false
      },
      "plans": [
        {
          "stockSignature": "1c21f3cf25dcadddd3380bd8b5deb5fcf2d9207d2a858502fa6559dd7eabe2b9",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "label": "1 ayliq ",
          "months": 1,
          "price": 5.99
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "ChatGPT Ortaq Hesab İstifadə Qaydaları və Məlumatlar\n\nHesabın İdarə Edilməsi: Bu hesab ortaq şəkildə istifadə olunur və hesab 5-7 nəfər arasında bölünür. Plus paketi aktivdir. Paket limitləri istifadəçilər arasında paylaşıldığı üçün bəzən müvəqqəti tükənə bilər.\n\nCihaz Limitləri: Hesab yalnız 1 cihaz üçün nəzərdə tutulub. Eyni anda fərqli cihazlardan giriş cəhdi spam xətasına səbəb ola bilər və bu da hesabın bağlanmasına gətirib çıxarır.\n\nAbunəlik və Aktivlik: Hər hansı gözlənilməz dayanma olarsa, bizə dərhal bildirə bilərsiniz, biz təkrar bərpa edəcəyik.\n\nTəhlükəsizlik və Digər İstifadəçilər: Digər istifadəçilərin yazışmalarına, əməliyyatlarına müdaxilə etmək və onları silmək qəti qadağandır.\n\nCodex və Məxvilik: Əgər kod (və ya vacib işlər) üçün istifadə edəcəksinizsə və istəyirsiniz ki, hesabınız tam sizə aid olsun, sizdən başqası mesajlarınızı görməsin — şəxsi hesab almağınızı məsləhət görürük.\n\n💡 Vacib Qeyd: Zəhmət olmasa, istifadə etməzdən əvvəl yuxarıdakı qaydaları diqqətlə oxuyun.",
        "confirmText": "Təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
        "helpLink": {
          "enabled": true,
          "label": "🔗 Şəxsi hesab əldə etmək üçün buraya klikləyin 👑",
          "url": "https://mirpanel.com/mehsul/chatgpt-plus"
        }
      }
    },
    {
      "id": "chatgpt",
      "_stableId": "chatgpt",
      "order": 7,
      "category": "ai",
      "image": "uploads/products/chatgpt-1792447571091-e78cfb71.png?v=1792447571091",
      "currency": "₼",
      "title": "ChatGPT Plus (Hazır Şəxsi hesab)",
      "variant": "Plus",
      "badge": "AI",
      "imageAlt": "ChatGPT Plus şəxsi hesab — MirPanel məhsul şəkli",
      "desc": "Bu səhifə hazır şəxsi ChatGPT Plus hesabı təklifi üçündür. Paylaşılan hesabla qarışdırmamaq üçün məhsul adını və seçilmiş müddəti yoxlayın.",
      "note": "Hazır şəxsi hesabın e-poçt və şifrəsi təhvil zamanı Sifarişlərim bölməsində göstərilir.",
      "longDescription": "Bu səhifə hazır şəxsi ChatGPT Plus hesabı təklifi üçündür. Paylaşılan hesabla qarışdırmamaq üçün məhsul adını və seçilmiş müddəti yoxlayın. Təhvil məlumatlarını Sifarişlərimdə açın. Giriş və iki mərhələli təsdiq üçün məhsula aid təlimatı izləyin; təsdiq kodunu və gizli açarı açıq söhbətdə paylaşmayın.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "chatgpt-plus",
      "seoTitle": "ChatGPT Plus şəxsi hesab almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "ChatGPT Plus hazır şəxsi hesab üçün MirPanel-in paket və AZN qiymətinə baxın. Paylaşılan hesabdan fərqi, təhvil və təhlükəsiz giriş qaydalarını oxuyun.",
      "seoH1": "ChatGPT Plus şəxsi hesab",
      "seoPrimaryKeyword": "ChatGPT Plus almaq",
      "seoRelatedKeywords": " ChatGPT şəxsi hesab Azərbaycan",
      "seoKeywords": "ChatGPT Plus almaq, ChatGPT şəxsi hesab Azərbaycan",
      "seoContent": "Bu səhifə hazır şəxsi ChatGPT Plus hesabı təklifi üçündür. Paylaşılan hesabla qarışdırmamaq üçün məhsul adını və seçilmiş müddəti yoxlayın.",
      "seoUpdatedAt": "2026-11-22T12:17:59.743Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "ChatGPT Plus şəxsi hesab almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "ChatGPT Plus hazır şəxsi hesab üçün MirPanel-in paket və AZN qiymətinə baxın. Paylaşılan hesabdan fərqi, təhvil və təhlükəsiz giriş qaydalarını oxuyun.",
      "seoOgImage": "assets/chatgpt.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/chatgpt.png",
        "mobileImage": "",
        "title": "ChatGPT Plus (Şəxsi hesab)",
        "description": "Daha güclü model, fayl/şəkil imkanları.",
        "alt": "ChatGPT Plus (Şəxsi hesab)",
        "order": 19
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": 1,
      "stockEnabled": true,
      "seller": "",
      "bestSeller": true,
      "orderFlow": "confirm_then_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
      "orderGuide": {
        "information": "📌 Hesaba Giriş Qaydası:\n1. ChatGPT səhifəsinə daxil olun.\n2. E-poçt ünvanını  yazaraq Davam et düyməsini klikləyin.\n3. Şifrəni daxil edib yenə Davam et düyməsini basın.\n4. Əgər 6 rəqəmli təsdiq kodu istəsə:\n5. Yuxarıda qeyd olunan (https://2fa.live/) keçidinə daxil olun.\n6. 2FA açarını həmin səhifəyə yapışdıraraq kodu əldə edin və ChatGPT-yə yazaraq təsdiq edin.\n7. İkinci pəncərədə gələn kodu kopyalayıb ChatGPT-yə daxil edərək yapışdırın.\n\n⚠️ Vacib Qaydalar və Məlumatlar:\n* Müddət: 30 gün\n* Zəmanət (Qarantiya): 27 gün\n* Hesaba əlavə cihazlarla giriş edə bilərsiniz.\n* Bu hesab yalnız sizə satılıb, başqasına verilmir.\n* Xahiş edirik, hesabın təhlükəsizliyi üçün şifrəni dəyişməyin. 💙",
        "tracks": {}
      },
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "ChatGPT Plus abunəliyi üçün hazır hesab birbaşa bizim tərəfimizdən sizə təqdim olunur.\n\nHesab Şərtləri və Üstünlükləri:\n\nTam Şəxsi Hesab: Hesab tamamilə sizə məxsusdur, daxildə sizdən başqa heç bir kənar şəxs olmur.\n\nÇoxlu Cihaz Dəstəyi: Hesabınıza əlavə cihazlar qoşaraq rahatlıqla istifadə edə bilərsiniz.\n\nİstifadə Müddəti: Hesabın aktivlik müddəti 30 gündür.\n\nZəmanət: 25 gün müddətinə tam əvəzləmə (qarantiya) dəstəyi verilir.",
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
          "stockSignature": "0867790b2a80241e19dcdcddeb5fbf95e3e2d7d0f4aa8c4639c335942cf0dea5",
          "stockContract": "[null,1,null]",
          "id": "0",
          "warrantyMode": "guaranteed",
          "warrantyUnit": "day",
          "warrantyText": "",
          "warrantyDuration": 27,
          "bestValue": true,
          "stockIdentityId": null,
          "label": "1 ayliq  ",
          "months": 1,
          "price": 15.99,
          "regularPrice": 40
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "ChatGPT Plus abunəliyi üçün hazır hesab birbaşa bizim tərəfimizdən sizə təqdim olunur.\n\nHesab Şərtləri və Üstünlükləri:\n\nTam Şəxsi Hesab: Hesab tamamilə sizə məxsusdur, daxildə sizdən başqa heç bir kənar şəxs olmur.\n\nÇoxlu Cihaz Dəstəyi: Hesabınıza əlavə cihazlar qoşaraq rahatlıqla istifadə edə bilərsiniz.\n\nİstifadə Müddəti: Hesabın aktivlik müddəti 30 gündür.\n\nZəmanət: 25 gün müddətinə tam əvəzləmə (qarantiya) dəstəyi verilir.",
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
      "id": "netflix_umumi",
      "_stableId": "netflix_umumi",
      "order": 8,
      "category": "subscriptions",
      "image": "uploads/products/netflix_umumi-1792446909068-646ca735.png?v=1792446909068",
      "currency": "₼",
      "title": "Netflix Ümumi",
      "variant": "Premium",
      "badge": "Film",
      "imageAlt": "Netflix Ümumi — MirPanel məhsul şəkli",
      "desc": "Netflix Ümumi paylaşılan hesab formatında təqdim edilir. Şəxsi otaq təklifi ilə eyni məhsul deyil; giriş və istifadə qaydalarını ödənişdən əvvəl müqayisə edin.",
      "note": "Hazır hesab verilir. Sifarişi təsdiqləyin.",
      "longDescription": "Netflix Ümumi paylaşılan hesab formatında təqdim edilir. Şəxsi otaq təklifi ilə eyni məhsul deyil; giriş və istifadə qaydalarını ödənişdən əvvəl müqayisə edin. Hesabı təhvil aldıqdan sonra sifarişdəki giriş təlimatını izləyin. Paylaşılan hesabda parolu və digər istifadəçilərin profillərini icazəsiz dəyişməyin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "netflix-umumi",
      "seoTitle": "Netflix Ümumi almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Netflix Ümumi hesab üçün cari AZN qiymətini və paylaşılan giriş şərtlərini yoxlayın. Şəxsi otaq paketindən fərqini öyrənib MirPanel-də sifariş edin.",
      "seoH1": "Netflix Ümumi",
      "seoPrimaryKeyword": "Netflix ümumi hesab almaq",
      "seoRelatedKeywords": " paylaşılan Netflix hesabı",
      "seoKeywords": "Netflix ümumi hesab almaq, paylaşılan Netflix hesabı",
      "seoContent": "Netflix Ümumi paylaşılan hesab formatında təqdim edilir. Şəxsi otaq təklifi ilə eyni məhsul deyil; giriş və istifadə qaydalarını ödənişdən əvvəl müqayisə edin.",
      "seoUpdatedAt": "2026-11-22T12:17:59.743Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Netflix Ümumi almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Netflix Ümumi hesab üçün cari AZN qiymətini və paylaşılan giriş şərtlərini yoxlayın. Şəxsi otaq paketindən fərqini öyrənib MirPanel-də sifariş edin.",
      "seoOgImage": "assets/netflix.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/netflix.png",
        "mobileImage": "",
        "title": "Netflix Ümumi",
        "description": "Ümumi hesab (paylaşılan).",
        "alt": "Netflix Ümumi",
        "order": 3
      },
      "flow": "out_of_stock",
      "soldOut": true,
      "active": true,
      "stock": null,
      "stockEnabled": true,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "confirm_then_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
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
      "id": "prime",
      "_stableId": "prime",
      "order": 9,
      "category": "subscriptions",
      "image": "uploads/products/prime-1792446922093-1fb61bd1.png?v=1792446922093",
      "currency": "₼",
      "title": "Amazon Prime Video",
      "variant": "Premium",
      "badge": "Film",
      "imageAlt": "Amazon Prime Video — MirPanel məhsul şəkli",
      "desc": "Amazon Prime Video film və serial izləmək üçün hesab təklifidir. Paket müddətini və qiymətini bu səhifədə seçin; bu məhsulu Amazon alış-veriş xidmətləri ilə eyniləşdirməyin.",
      "note": "Plan seç → Ad və 5 rəqəmli kod yaz.",
      "longDescription": "Amazon Prime Video film və serial izləmək üçün hesab təklifidir. Paket müddətini və qiymətini bu səhifədə seçin; bu məhsulu Amazon alış-veriş xidmətləri ilə eyniləşdirməyin. Təhvil verilən e-poçt və şifrə ilə Prime Video-ya daxil olun. Keçid açarı təklifi görünərsə məhsulun telefonla giriş təlimatındakı şifrə ilə davam etmə addımına baxın.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "amazon-prime-video",
      "seoTitle": "Amazon Prime Video almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Amazon Prime Video almaq üçün bir və altı aylıq seçimləri müqayisə edin. MirPanel-də AZN qiymətlərini, hesab təhvilini və telefonla girişi yoxlayın.",
      "seoH1": "Amazon Prime Video",
      "seoPrimaryKeyword": "Prime Video almaq",
      "seoRelatedKeywords": " Amazon Prime Video Azərbaycan, Prime Video qiyməti",
      "seoKeywords": "Prime Video almaq, Amazon Prime Video Azərbaycan, Prime Video qiyməti",
      "seoContent": "Amazon Prime Video film və serial izləmək üçün hesab təklifidir. Paket müddətini və qiymətini bu səhifədə seçin; bu məhsulu Amazon alış-veriş xidmətləri ilə eyniləşdirməyin.",
      "seoUpdatedAt": "2026-11-22T15:22:01.159Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Amazon Prime Video almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Amazon Prime Video almaq üçün bir və altı aylıq seçimləri müqayisə edin. MirPanel-də AZN qiymətlərini, hesab təhvilini və telefonla girişi yoxlayın.",
      "seoOgImage": "assets/prime.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/prime.png",
        "mobileImage": "",
        "title": "Amazon Prime Video",
        "description": "Prime Video filmlər və seriallar.",
        "alt": "Amazon Prime Video",
        "order": 5
      },
      "flow": "name_code_5",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": true,
      "orderFlow": "form_then_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
      "orderGuide": {
        "information": "• Hesaba giriş üçün təqdim olunan bütün məlumatları diqqətlə saxlayın və təhlükəsizliyini təmin edin\n• Yalnız sizə təqdim edilmiş profil üzərindən istifadə edin, giriş məlumatlarını üçüncü şəxslərlə paylaşmayın\n• Hesab və profil parametrlərində hər hansı dəyişiklik etməyin\n• İstifadə qaydalarına əməl edilmədiyi təqdirdə xidmət xəbərdarlıq edilmədən dayandırıla bilər",
        "tracks": {}
      },
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
          "stockSignature": "d1062bd2f0a1d6513aee999392c1f94a5434b9ca7c60dc2e90295acc53b11f80",
          "stockContract": "[null,1,null]",
          "id": "0",
          "warrantyMode": "guaranteed",
          "warrantyUnit": "day",
          "warrantyDuration": 27,
          "bestValue": false,
          "stockIdentityId": null,
          "pricingId": "6814465e-5ab7-43da-9e2b-56199661f001",
          "label": "1 ay",
          "months": 1,
          "price": 2.89,
          "regularPrice": 18
        },
        {
          "stockSignature": "6730c2fc4d203a289b03787d05d90bcdb430a8648d6900b6977f4887a0c12125",
          "stockContract": "[null,6,null]",
          "id": "1",
          "warrantyMode": "guaranteed",
          "warrantyUnit": "day",
          "warrantyDuration": 160,
          "bestValue": true,
          "stockIdentityId": null,
          "pricingId": "9a89cb3d-75f9-4c20-b626-7f879bc6e2df",
          "label": "6 ay",
          "months": 6,
          "price": 8.99
        },
        {
          "stockSignature": "1fcaebf871789fde2a99170cf7e3d6aec7e5604596b42af63f3570c13b4aa08f",
          "stockContract": "[null,1,null]",
          "id": "2",
          "warrantyMode": "guaranteed",
          "warrantyUnit": "day",
          "warrantyDuration": 28,
          "stockIdentityId": null,
          "pricingId": "34ab6efa-6bba-42a6-b0cf-fe48c0397813",
          "label": "1 ay Tam şəxsi hesab (6 şəxsi otaq)",
          "months": 1,
          "price": 10.99
        },
        {
          "stockSignature": "c65ebd0695e6e46de01bfa6ec02112f57ee075218a76412a9604ef469ce82468",
          "stockContract": "[null,1,null]",
          "id": "3",
          "warrantyMode": "guaranteed",
          "warrantyUnit": "day",
          "warrantyDuration": 173,
          "stockIdentityId": null,
          "pricingId": "939fd711-4b69-456c-bd10-5a732eeaf129",
          "label": "6 ay Tam şəxsi hesab (6 şəxsi otaq)",
          "months": 1,
          "price": 23.99,
          "regularPrice": 32
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
      "_stableId": "claude_ai",
      "order": 10,
      "category": "ai",
      "image": "uploads/products/claude_ai-1792448422631-a0521937.png?v=1792448422631",
      "currency": "₼",
      "title": "Claude AI",
      "variant": "1 ayliq",
      "badge": "AI",
      "imageAlt": "Claude AI — MirPanel məhsul şəkli",
      "desc": "Mətn, kod, yazı üçün güclü AI.",
      "note": "Stokta yoxdur.",
      "longDescription": "Mətnlə işləmək, araşdırma və kodla bağlı tapşırıqlar üçün süni intellekt xidmətinin paket təklifidir. Giriş formatı və istifadə limiti dəqiqləşdirildikdən sonra təhvil təlimatını izləyin. Paket adı göstərilməyən əlavə model və limitlər vəd edilmir.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "cloud-ai-pro",
      "seoTitle": "Claude AI almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Mətnlə işləmək, araşdırma və kodla bağlı tapşırıqlar üçün süni intellekt xidmətinin paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Claude AI",
      "seoPrimaryKeyword": "Claude AI almaq",
      "seoRelatedKeywords": " Claude AI qiyməti",
      "seoKeywords": "Claude AI almaq, Claude AI qiyməti",
      "seoContent": "Mətnlə işləmək, araşdırma və kodla bağlı tapşırıqlar üçün süni intellekt xidmətinin paket təklifidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.743Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Claude AI almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Mətnlə işləmək, araşdırma və kodla bağlı tapşırıqlar üçün süni intellekt xidmətinin paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/claude.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/claude.png",
        "mobileImage": "",
        "title": "Claude AI",
        "description": "Mətn, kod, yazı üçün güclü AI.",
        "alt": "Claude AI",
        "order": 15
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "2ff860e90c86485822a0dfa28902b057953d3d586b0d4254631d0a6b962144e2",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "label": "1 Ayliq",
          "months": 1,
          "price": 37.4,
          "regularPrice": 50.55
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
      "id": "youtube_sexsi",
      "_stableId": "youtube_sexsi",
      "order": 11,
      "category": "other",
      "image": "uploads/products/youtube_sexsi-1792448126347-307ca913.png?v=1792448126347",
      "currency": "₼",
      "title": "Youtube Yenilemek",
      "variant": "",
      "badge": "Premium",
      "imageAlt": "YouTube Premium yenilənməsi — MirPanel məhsul şəkli",
      "desc": "",
      "note": "",
      "longDescription": "Mövcud YouTube abunəliyini yeniləmək üçün kataloq qeydidir; yeni hesab məhsulu deyil. Əvvəlki abunəliyin hansı Google hesabına aid olduğunu və yenilənmə müddətini operatorla dəqiqləşdirin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "youtube-eyni-hesab",
      "seoTitle": "YouTube Premium yenilənməsi almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Mövcud YouTube abunəliyini yeniləmək üçün kataloq qeydidir; yeni hesab məhsulu deyil. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "YouTube Premium yenilənməsi",
      "seoPrimaryKeyword": "YouTube Premium yenilənməsi almaq",
      "seoRelatedKeywords": " YouTube Premium yenilənməsi qiyməti",
      "seoKeywords": "YouTube Premium yenilənməsi almaq, YouTube Premium yenilənməsi qiyməti",
      "seoContent": "Mövcud YouTube abunəliyini yeniləmək üçün kataloq qeydidir; yeni hesab məhsulu deyil.",
      "seoUpdatedAt": "2026-11-22T12:17:59.743Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "YouTube Premium yenilənməsi almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Mövcud YouTube abunəliyini yeniləmək üçün kataloq qeydidir; yeni hesab məhsulu deyil. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/youtube.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/youtube.png",
        "mobileImage": "",
        "title": "Youtube Eyni hesab",
        "description": "",
        "alt": "Youtube Eyni hesab",
        "order": 6
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": true,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "confirm_then_whatsapp",
      "formFields": [
        {
          "key": "email",
          "type": "email",
          "label": "Email / Gmail",
          "placeholder": "Gmail ünvanınızı yazın",
          "description": "",
          "required": true,
          "enabled": true
        },
        {
          "key": "password",
          "type": "password",
          "label": "Gmail şifrəsi",
          "placeholder": "Gmail şifrənizi yazın",
          "description": "",
          "required": true,
          "enabled": true
        }
      ],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": " Təqdim etdiyiniz hesab yeni açılmış Gmail olmalı və heç bir ailə qrupuna qoşulmamalıdır. Hesab tamamilə sıfırdan yaradılmalıdır. Hesabınızda Premium aktivləşdirildikdən sonra, hər ay ödəniş edərək eyni hesab üzərindən istifadəyə davam edə bilərsiniz.",
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
        "includeSeller": false,
        "includeStock": false
      },
      "plans": [
        {
          "stockSignature": "14df93de4f84da463547349a0783995b5446a632d6cbffc930d95c762566ad8f",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "label": "1 ayliq",
          "months": 1,
          "price": 5.99
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": " Təqdim etdiyiniz hesab yeni açılmış Gmail olmalı və heç bir ailə qrupuna qoşulmamalıdır. Hesab tamamilə sıfırdan yaradılmalıdır. Hesabınızda Premium aktivləşdirildikdən sonra, hər ay ödəniş edərək eyni hesab üzərindən istifadəyə davam edə bilərsiniz.",
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
      "id": "adobecc",
      "_stableId": "adobecc",
      "order": 12,
      "category": "design",
      "image": "uploads/products/adobecc-1792450954538-64c5979f.png?v=1792450954538",
      "currency": "₼",
      "title": "Adobe Creative Cloud",
      "variant": "Premium",
      "badge": "Dizayn",
      "imageAlt": "Adobe Creative Cloud — MirPanel məhsul şəkli",
      "desc": "Photoshop, Illustrator və digərləri.",
      "note": "Hesab hazır şəkildə təqdim edilir.",
      "longDescription": "Yaradıcı proqramlarla işləmək üçün Adobe Creative Cloud paket təklifidir. Paketə daxil olan tətbiqləri və hesabın giriş formasını dəqiqləşdirin; təsdiqlənməyən əlavə proqram və yaddaş həcmi daxil sayılmır.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "adobe-creative-cloud",
      "seoTitle": "Adobe Creative Cloud almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Yaradıcı proqramlarla işləmək üçün Adobe Creative Cloud paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Adobe Creative Cloud",
      "seoPrimaryKeyword": "Adobe Creative Cloud almaq",
      "seoRelatedKeywords": " Adobe Creative Cloud qiyməti",
      "seoKeywords": "Adobe Creative Cloud almaq, Adobe Creative Cloud qiyməti",
      "seoContent": "Yaradıcı proqramlarla işləmək üçün Adobe Creative Cloud paket təklifidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Adobe Creative Cloud almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Yaradıcı proqramlarla işləmək üçün Adobe Creative Cloud paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/adobe.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/adobe.png",
        "mobileImage": "",
        "title": "Adobe Creative Cloud",
        "description": "Photoshop, Illustrator və digərləri.",
        "alt": "Adobe Creative Cloud",
        "order": 21
      },
      "flow": "out_of_stock",
      "soldOut": true,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "confirm_then_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "📌 Sifariş təsdiqləndikdən sonra müştəriyə **4 aylıq Adobe Creative Cloud abunəliyi aktiv olan hazır hesab** təqdim edilir. Hesab e-poçt ünvanı və giriş məlumatları ilə birlikdə verilir və istifadəyə hazır olur.\n\n✅ Abunəlik müddəti: **4 ay**  \n🛡️ MirPanel zəmanəti: **1 ay**\n\n**Zəmanət haqqında:** Hesabda təqdim edildiyi tarixdən etibarən ilk 1 ay ərzində MirPanel-dən asılı olmayan deaktivasiya və ya giriş problemi yaranarsa, vəziyyət yoxlanılır və uyğun olduğu halda hesabın bərpası və ya əvəzlənməsi təmin edilir.\n\n1 aylıq zəmanət hesabın abunəlik müddəti deyil. Hesab normal şəraitdə **4 aylıq istifadə üçün** təqdim olunur, zəmanət isə yalnız ilk ay ərzində yarana biləcək problemlərə qarşı əlavə xidmət təminatıdır.\n\n### Sifarişdən əvvəl nəzərə alın ⚠️\n\nAdobe tərəfindən aparılan təhlükəsizlik yoxlamaları, sistem yenilikləri və daxili qayda dəyişiklikləri səbəbindən hesabın məhdudlaşdırılması və ya deaktiv edilməsi ehtimalı mövcuddur. Belə vəziyyət yaranarsa, zəmanət müddəti ərzində MirPanel-in rəsmi WhatsApp dəstəyinə müraciət edin.\n\nHesab məlumatlarının başqa şəxslərlə paylaşılması, icazəsiz dəyişdirilməsi və istifadə təlimatlarına əməl edilməməsi nəticəsində yaranan problemlər zəmanətə daxil olmaya bilər.",
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
          "stockSignature": "dd5f09493268584705d24eb114c4e72fc608b8122b66dfa2bcda411443a161d7",
          "stockContract": "[null,4,null]",
          "id": "0",
          "stockIdentityId": null,
          "months": 4,
          "price": 22.99
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "📌 Sifariş təsdiqləndikdən sonra müştəriyə **4 aylıq Adobe Creative Cloud abunəliyi aktiv olan hazır hesab** təqdim edilir. Hesab e-poçt ünvanı və giriş məlumatları ilə birlikdə verilir və istifadəyə hazır olur.\n\n✅ Abunəlik müddəti: **4 ay**  \n🛡️ MirPanel zəmanəti: **1 ay**\n\n**Zəmanət haqqında:** Hesabda təqdim edildiyi tarixdən etibarən ilk 1 ay ərzində MirPanel-dən asılı olmayan deaktivasiya və ya giriş problemi yaranarsa, vəziyyət yoxlanılır və uyğun olduğu halda hesabın bərpası və ya əvəzlənməsi təmin edilir.\n\n1 aylıq zəmanət hesabın abunəlik müddəti deyil. Hesab normal şəraitdə **4 aylıq istifadə üçün** təqdim olunur, zəmanət isə yalnız ilk ay ərzində yarana biləcək problemlərə qarşı əlavə xidmət təminatıdır.\n\n### Sifarişdən əvvəl nəzərə alın ⚠️\n\nAdobe tərəfindən aparılan təhlükəsizlik yoxlamaları, sistem yenilikləri və daxili qayda dəyişiklikləri səbəbindən hesabın məhdudlaşdırılması və ya deaktiv edilməsi ehtimalı mövcuddur. Belə vəziyyət yaranarsa, zəmanət müddəti ərzində MirPanel-in rəsmi WhatsApp dəstəyinə müraciət edin.\n\nHesab məlumatlarının başqa şəxslərlə paylaşılması, icazəsiz dəyişdirilməsi və istifadə təlimatlarına əməl edilməməsi nəticəsində yaranan problemlər zəmanətə daxil olmaya bilər.",
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
      "id": "hbomax",
      "_stableId": "hbomax",
      "order": 13,
      "category": "subscriptions",
      "image": "uploads/products/hbomax-1794730390763-0efc1b5b.png?v=1794730390763",
      "currency": "₼",
      "title": "HBO Max",
      "variant": "Şəxsi Otaq",
      "badge": "Film",
      "imageAlt": "HBO Max — MirPanel məhsul şəkli",
      "desc": "HBO Max film və serial izləmək üçün hesab təklifidir. Sifariş üçün mövcud müddəti, qiyməti və paket şərtlərini birlikdə yoxlayın.",
      "note": "Plan seç → Otaq adı və 4 rəqəmli kod yaz.",
      "longDescription": "HBO Max film və serial izləmək üçün hesab təklifidir. Sifariş üçün mövcud müddəti, qiyməti və paket şərtlərini birlikdə yoxlayın. Sifariş forması otaq adı və PIN istəyərsə onları düzgün daxil edin. Verilən hesabdan məhsulun istifadə təlimatına uyğun yararlanın; əlavə xidmətin mövcudluğunu paket şərtlərində yoxlayın.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "hbo-max",
      "seoTitle": "HBO Max almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "HBO Max hesabı üçün MirPanel-də müddət, AZN qiyməti və paket şərtlərinə baxın. Otaq, PIN və təhvil məlumatlarını ödənişdən əvvəl dəqiqləşdirin.",
      "seoH1": "HBO Max",
      "seoPrimaryKeyword": "HBO Max almaq",
      "seoRelatedKeywords": " HBO Max Azərbaycan, HBO Max hesab qiyməti",
      "seoKeywords": "HBO Max almaq, HBO Max Azərbaycan, HBO Max hesab qiyməti",
      "seoContent": "HBO Max film və serial izləmək üçün hesab təklifidir. Sifariş üçün mövcud müddəti, qiyməti və paket şərtlərini birlikdə yoxlayın.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "HBO Max almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "HBO Max hesabı üçün MirPanel-də müddət, AZN qiyməti və paket şərtlərinə baxın. Otaq, PIN və təhvil məlumatlarını ödənişdən əvvəl dəqiqləşdirin.",
      "seoOgImage": "uploads/products/hbomax-1783292107083-520c4b4a.jpg?v=1783292107083",
      "banner": {
        "enabled": false,
        "desktopImage": "uploads/products/hbomax-1783292107083-520c4b4a.jpg?v=1783292107083",
        "mobileImage": "",
        "title": "HBO Max",
        "description": "Ən yeni HBO serialları. Surfshark VPN Hədiyyə!",
        "alt": "HBO Max",
        "order": 7
      },
      "flow": "name_code_4",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": true,
      "orderFlow": "form_then_whatsapp",
      "formFields": [],
      "formTitle": "HBO Max profil məlumatları",
      "formDescription": "HBO Max profil adını və 4 rəqəmli profil kodunu daxil edin.",
      "orderGuide": {
        "information": "🎬 HBO Max Hesabından İstifadə və Giriş Qaydaları\nCihaz Seçimi və İstifadə Qaydası:\nHesaba telefon, televizor və ya noutbuk vasitəsilə daxil ola bilərsiniz (bu üç cihazdan istənilən biri ilə daxil olmaq mümkündür).\n\n⚠️ Vacib şərt: Hesabı eyni anda yalnız bir cihazda izləyin. Əgər eyni anda iki cihazda (məsələn, həm telefonda, həm də televizor/noutbukda) eyni anda filmə baxılarsa, hesab sistemdən atılar və bloklana bilər.\nQeyd: Bu qaydanın pozulması nəticəsində hesab bloklanarsa, geri ödəniş və ya hesabın əvəzlənməsi (zəmanət) tətbiq olunmur. Zəhmət olmasa, bu qaydanı diqqətə alaraq istifadə edin.\n\nGiriş Təlimatı:\nHesaba giriş qaydası ilə bağlı ətraflı məlumatı sistemdəki \"Təlimat\" düyməsinə klikləməklə əldə edə bilərsiniz.\n\nOtaq Ayarları:\nÖz otağınızın adını dəyişə bilərsiniz.\n❌ Otağın kodunu dəyişmək isə qəti qadağandır.\n\nZəmanət Müddəti:\nHesaba 28 gün zəmanət veririk. Tam 30 gün işləməyə bilər; təxmini işləmə müddəti 28-30 gün arası dəyişir (28 gün də işləyə bilər, 30 gün də). Tam 30 gün işləyəcəyinə dair zəmanət verilmir.",
        "tracks": {}
      },
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "HBO Max Azərbaycanda rəsmi olaraq dəstəklənmir.\nMirpanel'in hesabları qlobaldır, işləyir.\n\n💡 Məsləhət: Sifarişdən əvvəl HBO Max tətbiqinə və ya veb saytına giriş edə bildiyinizdən əmin olun. Sifarişdən sonra sizə \"HBO MAX\" hesab məlumatlarını təqdim edəcəyik.",
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
          "stockSignature": "d1062bd2f0a1d6513aee999392c1f94a5434b9ca7c60dc2e90295acc53b11f80",
          "stockContract": "[null,1,null]",
          "id": "0",
          "durationMonths": 1,
          "duration_months": 1,
          "warrantyMode": "guaranteed",
          "warrantyUnit": "day",
          "warrantyDuration": 28,
          "stockIdentityId": null,
          "pricingId": "9862f006-0b4b-4c63-97ef-eda5829158da",
          "label": "1 ay",
          "months": 1,
          "price": 3.99,
          "regularPrice": 13
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "HBO Max Azərbaycanda rəsmi olaraq dəstəklənmir.\nMirpanel'in hesabları qlobaldır, işləyir.\n\n💡 Məsləhət: Sifarişdən əvvəl HBO Max tətbiqinə və ya veb saytına giriş edə bildiyinizdən əmin olun. Sifarişdən sonra sizə \"HBO MAX\" hesab məlumatlarını təqdim edəcəyik.",
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
      "_stableId": "tiktok_jeton",
      "order": 14,
      "category": "subscriptions",
      "image": "uploads/products/tiktok_jeton-1792448326473-7df012e5.png?v=1792448326473",
      "currency": "₼",
      "title": "TikTok Jeton",
      "variant": "500+",
      "badge": "TikTok",
      "imageAlt": "TikTok Jeton — MirPanel məhsul şəkli",
      "desc": "Minimum 500 jeton.",
      "note": "500 jeton = 10 ₼. TikTok istifadəçi adı qeyd olunur.",
      "longDescription": "TikTok hesabı üçün seçilən sayda jeton paketidir; aylıq abunəlik deyil. TikTok istifadəçi identifikatorunu və jeton sayını təsdiqdən əvvəl tutuşdurun. Hesabınızda yüklənməni yoxlayıb uyğunsuzluğu sifariş nömrəsi ilə bildirin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "tiktok-jeton",
      "seoTitle": "TikTok Jeton almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "TikTok hesabı üçün seçilən sayda jeton paketidir; aylıq abunəlik deyil. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "TikTok Jeton",
      "seoPrimaryKeyword": "TikTok Jeton almaq",
      "seoRelatedKeywords": " TikTok Jeton qiyməti",
      "seoKeywords": "TikTok Jeton almaq, TikTok Jeton qiyməti",
      "seoContent": "TikTok hesabı üçün seçilən sayda jeton paketidir; aylıq abunəlik deyil.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "TikTok Jeton almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "TikTok hesabı üçün seçilən sayda jeton paketidir; aylıq abunəlik deyil. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/tiktok.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/slider6.png",
        "mobileImage": "",
        "title": "TikTok Jeton",
        "description": "Minimum 500 jeton.",
        "alt": "TikTok Jeton banneri",
        "order": 11
      },
      "flow": "tiktok_jeton",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_then_whatsapp",
      "formFields": [
        {
          "key": "tiktok_username",
          "type": "text",
          "label": "TikTok istifadəçi identifikatoru",
          "placeholder": "@istifadeci_adi",
          "description": "",
          "required": true,
          "enabled": true
        },
        {
          "key": "jeton_quantity",
          "type": "number",
          "label": "Jeton miqdarı",
          "placeholder": "500",
          "description": "",
          "required": true,
          "enabled": true,
          "min": 500,
          "max": 500,
          "step": 500,
          "defaultValue": "500",
          "readOnly": true
        }
      ],
      "formTitle": "TikTok Jeton məlumatları",
      "formDescription": "",
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
          "stockSignature": "47de19b1560e31d6100178d81c412f811798254c31ab4e1681fdc024efe6d58a",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "label": "500 jeton",
          "months": 1,
          "price": 11
        },
        {
          "stockSignature": "244113b78fdcd3c1f4e1049b84030595cfe040900f3a5988e043a8a3f01e7304",
          "stockContract": "[null,1,null]",
          "id": "1",
          "stockIdentityId": null,
          "label": "1000 jeton",
          "months": 1,
          "price": 21
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
      "id": "surfshark",
      "_stableId": "surfshark",
      "order": 15,
      "category": "subscriptions",
      "image": "uploads/products/surfshark-1792448333121-dcfb98b1.png?v=1792448333121",
      "currency": "₼",
      "title": "Surfshark VPN ",
      "variant": "VPN",
      "badge": "VPN",
      "imageAlt": "Surfshark VPN — MirPanel məhsul şəkli",
      "desc": "Surfshark VPN internet bağlantısı üçün VPN hesabı təklifidir. Bu məhsul bağlantının məxfiliyi üçün alətdir; tam anonimlik və ya bütün saytlara giriş zəmanəti kimi təqdim edilmir.",
      "note": "Hesab hazır şəkildə verilir.",
      "longDescription": "Surfshark VPN internet bağlantısı üçün VPN hesabı təklifidir. Bu məhsul bağlantının məxfiliyi üçün alətdir; tam anonimlik və ya bütün saytlara giriş zəmanəti kimi təqdim edilmir. Təhvil verilmiş hesabla uyğun Surfshark tətbiqinə daxil olun. Cihaz, tətbiq və bağlantı qaydalarını sifarişin Təlimat bölməsində yoxlayın.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "surfshark-vpn",
      "seoTitle": "Surfshark VPN almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Surfshark VPN almaq üçün MirPanel-də paket müddətini və AZN qiymətini yoxlayın. Hesab təhvili, cihaz uyğunluğu və VPN istifadə məhdudiyyətlərini oxuyun.",
      "seoH1": "Surfshark VPN",
      "seoPrimaryKeyword": "Surfshark VPN almaq",
      "seoRelatedKeywords": " VPN Azərbaycan, Surfshark qiyməti",
      "seoKeywords": "Surfshark VPN almaq, VPN Azərbaycan, Surfshark qiyməti",
      "seoContent": "Surfshark VPN internet bağlantısı üçün VPN hesabı təklifidir. Bu məhsul bağlantının məxfiliyi üçün alətdir; tam anonimlik və ya bütün saytlara giriş zəmanəti kimi təqdim edilmir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Surfshark VPN almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Surfshark VPN almaq üçün MirPanel-də paket müddətini və AZN qiymətini yoxlayın. Hesab təhvili, cihaz uyğunluğu və VPN istifadə məhdudiyyətlərini oxuyun.",
      "seoOgImage": "assets/surfshark.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/surfshark.png",
        "mobileImage": "",
        "title": "Surfshark VPN",
        "description": "IP gizlətmə, güclü şifrələmə.",
        "alt": "Surfshark VPN",
        "order": 10
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "d1062bd2f0a1d6513aee999392c1f94a5434b9ca7c60dc2e90295acc53b11f80",
          "stockContract": "[null,1,null]",
          "id": "0",
          "warrantyMode": "guaranteed",
          "warrantyUnit": "day",
          "warrantyDuration": 30,
          "stockIdentityId": null,
          "pricingId": "211daf58-234b-4911-992e-bda1537663c4",
          "label": "1 ay",
          "months": 1,
          "price": 4.99,
          "regularPrice": 26.27
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
      "_stableId": "google_ai_ultra",
      "order": 16,
      "category": "ai",
      "image": "uploads/products/google_ai_ultra-1793128040365-716704a3.png?v=1793128040365",
      "currency": "₼",
      "title": "Google AI Ultra + VEO 3",
      "variant": "Ultra",
      "badge": "AI",
      "imageAlt": "Google AI Ultra + VEO 3 — MirPanel məhsul şəkli",
      "desc": "Peşəkar istifadə üçün ən yüksək AI.",
      "note": "Stokta yoxdur.",
      "longDescription": "Google süni intellekt və video yaratma xidmətləri üçün kataloq təklifidir. Model, video limiti və hesab formatı təsdiqlənmədən satınalma qərarı verməyin. Hazırda müsbət qiymətli paket yoxdur.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "google-ai-pro-ultra",
      "seoTitle": "Google AI Ultra + VEO 3 almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Google süni intellekt və video yaratma xidmətləri üçün kataloq təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Google AI Ultra + VEO 3",
      "seoPrimaryKeyword": "Google AI Ultra + VEO 3 almaq",
      "seoRelatedKeywords": " Google AI Ultra + VEO 3 qiyməti",
      "seoKeywords": "Google AI Ultra + VEO 3 almaq, Google AI Ultra + VEO 3 qiyməti",
      "seoContent": "Google süni intellekt və video yaratma xidmətləri üçün kataloq təklifidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Google AI Ultra + VEO 3 almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Google süni intellekt və video yaratma xidmətləri üçün kataloq təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/google-ai-ultra.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/google-ai-ultra.png",
        "mobileImage": "",
        "title": "Google AI Ultra + VEO 3",
        "description": "Peşəkar istifadə üçün ən yüksək AI.",
        "alt": "Google AI Ultra + VEO 3",
        "order": 12
      },
      "flow": "out_of_stock",
      "soldOut": true,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "97d003b47329f91efaee01176e1985c541c821030c05307259cce013eac75355",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
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
      "_stableId": "captions",
      "order": 17,
      "category": "ai",
      "image": "uploads/products/captions-1792448708784-7d662bbc.png?v=1792448708784",
      "currency": "₼",
      "title": "Captions AI",
      "variant": "Şəxsi",
      "badge": "AI",
      "imageAlt": "Captions AI — MirPanel məhsul şəkli",
      "desc": "Videolar üçün avtomatik caption.",
      "note": "Hesab biz tərəfdən hazır verilir.",
      "longDescription": "Video və altyazı hazırlamaq üçün Pro və Max paket seçimləri olan süni intellekt alətidir. Pro və Max paket adlarını ayırın. Aktivləşdirmədən sonra aldığınız səviyyənin hesabda göründüyünü yoxlayın; əlavə istifadə limiti ayrıca təsdiqlənməlidir.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "captions-ai",
      "seoTitle": "Captions AI almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Video və altyazı hazırlamaq üçün Pro və Max paket seçimləri olan süni intellekt alətidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Captions AI",
      "seoPrimaryKeyword": "Captions AI almaq",
      "seoRelatedKeywords": " Captions AI qiyməti",
      "seoKeywords": "Captions AI almaq, Captions AI qiyməti",
      "seoContent": "Video və altyazı hazırlamaq üçün Pro və Max paket seçimləri olan süni intellekt alətidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Captions AI almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Video və altyazı hazırlamaq üçün Pro və Max paket seçimləri olan süni intellekt alətidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/captions.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/captions.png",
        "mobileImage": "",
        "title": "Captions AI",
        "description": "Videolar üçün avtomatik caption.",
        "alt": "Captions AI",
        "order": 13
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "f7713a35ebea46200b9b6c28fb236e63572832356d4eccf8dfb35def35eccf6a",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "label": "1 aylıq PRO",
          "months": 1,
          "price": 11.99,
          "regularPrice": 16.98
        },
        {
          "stockSignature": "6bf4ed5ae5d099a727761a825a57ca6920c7c4bc84297099e7989383e5fcd4ee",
          "stockContract": "[null,1,null]",
          "id": "1",
          "stockIdentityId": null,
          "label": "1 aylıq MAX",
          "months": 1,
          "price": 19.99,
          "regularPrice": 42.48
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
      "_stableId": "grok_supergrok",
      "order": 18,
      "category": "ai",
      "image": "uploads/products/grok_supergrok-1792448632619-5d302a16.png?v=1792448632619",
      "currency": "₼",
      "title": "Grok AI",
      "variant": "SuperGrok",
      "badge": "AI",
      "imageAlt": "Grok AI — MirPanel məhsul şəkli",
      "desc": "Güclü model + şəkil/fayl analizi.",
      "note": "Hesab hazır şəkildə təqdim olunur.",
      "longDescription": "Sual-cavab və mətn tapşırıqları üçün Grok süni intellekt xidməti üzrə paket təklifidir. Giriş formasını və konkret abunəlik səviyyəsini dəqiqləşdirin. Məhsul adı bütün modellərə limitsiz giriş vədi deyil.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "grok-ai",
      "seoTitle": "Grok AI almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Sual-cavab və mətn tapşırıqları üçün Grok süni intellekt xidməti üzrə paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Grok AI",
      "seoPrimaryKeyword": "Grok AI almaq",
      "seoRelatedKeywords": " Grok AI qiyməti",
      "seoKeywords": "Grok AI almaq, Grok AI qiyməti",
      "seoContent": "Sual-cavab və mətn tapşırıqları üçün Grok süni intellekt xidməti üzrə paket təklifidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Grok AI almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Sual-cavab və mətn tapşırıqları üçün Grok süni intellekt xidməti üzrə paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/grok.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/grok.png",
        "mobileImage": "",
        "title": "Grok AI",
        "description": "Güclü model + şəkil/fayl analizi.",
        "alt": "Grok AI",
        "order": 14
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "months": 1,
          "price": 29.99,
          "regularPrice": 51
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
      "_stableId": "duolingo",
      "order": 19,
      "category": "other",
      "image": "uploads/products/duolingo-1792448623830-b79e0ac4.png?v=1792448623830",
      "currency": "₼",
      "title": "Duolingo Super",
      "variant": "Super",
      "badge": "Dil",
      "imageAlt": "Duolingo Super — MirPanel məhsul şəkli",
      "desc": "Xarici dil öyrənmək üçün premium imkanlar.",
      "note": "Hazır hesab kimi təqdim edilir.",
      "longDescription": "Dil öyrənmə üçün Duolingo Super abunəlik paketidir. Aktivləşən Duolingo hesabını və paket müddətini yoxlayın. Öyrənmə irəliləyişinizi saxlayan hesabın seçilməsini operatorla dəqiqləşdirin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "duolingo-super",
      "seoTitle": "Duolingo Super almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Dil öyrənmə üçün Duolingo Super abunəlik paketidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Duolingo Super",
      "seoPrimaryKeyword": "Duolingo Super almaq",
      "seoRelatedKeywords": " Duolingo Super qiyməti",
      "seoKeywords": "Duolingo Super almaq, Duolingo Super qiyməti",
      "seoContent": "Dil öyrənmə üçün Duolingo Super abunəlik paketidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Duolingo Super almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Dil öyrənmə üçün Duolingo Super abunəlik paketidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/duolingo.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/duolingo.png",
        "mobileImage": "",
        "title": "Duolingo Super",
        "description": "Xarici dil öyrənmək üçün premium imkanlar.",
        "alt": "Duolingo Super",
        "order": 17
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "months": 1,
          "price": 3.99,
          "regularPrice": 12
        },
        {
          "stockSignature": "14d47c6bb51bf203ea17727bc99f63e67a83ce46a746ade5b27eede4abd0fb60",
          "stockContract": "[null,12,null]",
          "id": "1",
          "stockIdentityId": null,
          "months": 12,
          "price": 29.99,
          "regularPrice": 99
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
      "_stableId": "canva",
      "order": 20,
      "category": "design",
      "image": "uploads/products/canva-1792448677882-81e67e07.png?v=1792448677882",
      "currency": "₼",
      "title": "Canva Premium",
      "variant": "Pro",
      "badge": "Dizayn",
      "imageAlt": "Canva Premium — MirPanel məhsul şəkli",
      "desc": "Canva Premium dizayn və təqdimat hazırlamaq üçün paket təklifidir. Müddət və giriş formatı seçdiyiniz paketə görə fərqlənə bilər.",
      "note": "Aktivləşmə üçün Gmail qeyd edin.",
      "longDescription": "Canva Premium dizayn və təqdimat hazırlamaq üçün paket təklifidir. Müddət və giriş formatı seçdiyiniz paketə görə fərqlənə bilər. Aktivləşdirmə üçün forma Gmail ünvanı istəyərsə istifadə etdiyiniz ünvanı düzgün yazın. Təhvil və dəvət qaydasını sifarişinizdəki məlumatdan izləyin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "canva-premium",
      "seoTitle": "Canva Premium almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Canva Premium almaq üçün MirPanel paketlərini və AZN qiymətlərini müqayisə edin. Aktivləşdirmə e-poçtu, giriş formatı və təhvil qaydası ilə tanış olun.",
      "seoH1": "Canva Premium",
      "seoPrimaryKeyword": "Canva Premium almaq",
      "seoRelatedKeywords": " Canva hesabı Azərbaycan, Canva qiyməti",
      "seoKeywords": "Canva Premium almaq, Canva hesabı Azərbaycan, Canva qiyməti",
      "seoContent": "Canva Premium dizayn və təqdimat hazırlamaq üçün paket təklifidir. Müddət və giriş formatı seçdiyiniz paketə görə fərqlənə bilər.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Canva Premium almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Canva Premium almaq üçün MirPanel paketlərini və AZN qiymətlərini müqayisə edin. Aktivləşdirmə e-poçtu, giriş formatı və təhvil qaydası ilə tanış olun.",
      "seoOgImage": "assets/canva.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/slider3.png",
        "mobileImage": "",
        "title": "Canva Premium",
        "description": "Premium template, elementlər.",
        "alt": "Canva Premium banneri",
        "order": 18
      },
      "flow": "email",
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
          "label": "Email / Gmail",
          "placeholder": "misal@gmail.com",
          "description": "",
          "required": true,
          "enabled": true
        }
      ],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "months": 1,
          "price": 2.99,
          "regularPrice": 30
        },
        {
          "stockSignature": "14d47c6bb51bf203ea17727bc99f63e67a83ce46a746ade5b27eede4abd0fb60",
          "stockContract": "[null,12,null]",
          "id": "1",
          "stockIdentityId": null,
          "months": 12,
          "price": 4.99
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
      "id": "netflix_sexsi",
      "_stableId": "netflix_sexsi",
      "order": 21,
      "category": "subscriptions",
      "image": "uploads/products/netflix_sexsi-1792448690453-b2c32429.png?v=1792448690453",
      "currency": "₼",
      "title": "Netflix şəxsi (Yeniləmək)",
      "variant": "Yeniləmək",
      "badge": "film",
      "imageAlt": "Netflix Şəxsi yenilənməsi — MirPanel məhsul şəkli",
      "desc": "",
      "note": "",
      "longDescription": "Mövcud Netflix Şəxsi otağının yenilənməsi üçün köhnə kataloq qeydidir. Yenilənmə üçün əvvəlki sifariş və otaq məlumatını dəqiqləşdirin. Yeni otaq satışı ilə mövcud otağın yenilənməsini qarışdırmayın.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "netflix-sexsi-yenilemek",
      "seoTitle": "Netflix Şəxsi yenilənməsi almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Mövcud Netflix Şəxsi otağının yenilənməsi üçün köhnə kataloq qeydidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Netflix Şəxsi yenilənməsi",
      "seoPrimaryKeyword": "Netflix Şəxsi yenilənməsi almaq",
      "seoRelatedKeywords": " Netflix Şəxsi yenilənməsi qiyməti",
      "seoKeywords": "Netflix Şəxsi yenilənməsi almaq, Netflix Şəxsi yenilənməsi qiyməti",
      "seoContent": "Mövcud Netflix Şəxsi otağının yenilənməsi üçün köhnə kataloq qeydidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Netflix Şəxsi yenilənməsi almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Mövcud Netflix Şəxsi otağının yenilənməsi üçün köhnə kataloq qeydidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/your.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/your.png",
        "mobileImage": "",
        "title": "Netflix şəxsi (Yeniləmək)",
        "description": "",
        "alt": "Netflix şəxsi (Yeniləmək)",
        "order": 31
      },
      "flow": "out_of_stock",
      "soldOut": true,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "confirm_then_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": true,
        "title": "Diqqət!",
        "description": "Nəzərinizə çatdırırıq ki, sizə göndərilən Netflix hesabının abunəlik müddəti (növbəti ödəniş tarixi) artıq keçibsə, həmin hesabı mövcud paketlə yeniləmək təəssüf ki, mümkün deyil. Xidmətdən istifadəyə davam etmək üçün *yeni şəxsi otaq (profil) sifariş etməyiniz xahiş olunur*.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
        "helpLink": {
          "enabled": true,
          "label": "👉Yeni netflix şəxsi otaq almaq 👈",
          "url": "https://mirpanel.com/mehsul/netflix-sexsi"
        }
      },
      "whatsapp": {
        "extraMessage": "",
        "includeSeller": false,
        "includeStock": false
      },
      "plans": [
        {
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "months": 1,
          "price": 5.99
        },
        {
          "stockSignature": "be60937201ab614a2a40efc78c4ad60ec29ed69390f7b52f5b5b169b353660b0",
          "stockContract": "[null,2,null]",
          "id": "1",
          "stockIdentityId": null,
          "months": 2,
          "price": 11.99
        },
        {
          "stockSignature": "be6c1277e7e29010d7b003e0d41272847365ca1372ccc7791a6de60445bd05d4",
          "stockContract": "[null,3,null]",
          "id": "2",
          "stockIdentityId": null,
          "months": 3,
          "price": 16.5
        },
        {
          "stockSignature": "6ba9a2b7ac0962c00573a86023d4eb50f8566376ac3bada7d5762216c6351acd",
          "stockContract": "[null,6,null]",
          "id": "3",
          "stockIdentityId": null,
          "months": 6,
          "price": 29.99
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Diqqət!",
        "description": "Nəzərinizə çatdırırıq ki, sizə göndərilən Netflix hesabının abunəlik müddəti (növbəti ödəniş tarixi) artıq keçibsə, həmin hesabı mövcud paketlə yeniləmək təəssüf ki, mümkün deyil. Xidmətdən istifadəyə davam etmək üçün *yeni şəxsi otaq (profil) sifariş etməyiniz xahiş olunur*.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
        "helpLink": {
          "enabled": true,
          "label": "👉Yeni netflix şəxsi otaq almaq 👈",
          "url": "https://mirpanel.com/mehsul/netflix-sexsi"
        }
      }
    },
    {
      "id": "linkedin_career",
      "_stableId": "linkedin_career",
      "order": 22,
      "category": "office",
      "image": "uploads/products/linkedin_career-1793128270752-744fc34c.png?v=1793128270752",
      "currency": "₼",
      "title": "Linkedin Career",
      "variant": "Biznes",
      "badge": "İş",
      "imageAlt": "LinkedIn Career — MirPanel məhsul şəkli",
      "desc": "Karyeranızı və şəbəkənizi növbəti səviyyəyə daşıyın.",
      "note": "Hazır hesab kimi təqdim olunur.",
      "longDescription": "Peşəkar profil və iş axtarışı üçün LinkedIn Career paket təklifidir. Təqdim ediləcək hesabı və abunəlik səviyyəsini aktivləşdirmədən əvvəl dəqiqləşdirin; iş tapılması və ya müraciət nəticəsi barədə zəmanət verilmir.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "linkedin-career",
      "seoTitle": "LinkedIn Career almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Peşəkar profil və iş axtarışı üçün LinkedIn Career paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "LinkedIn Career",
      "seoPrimaryKeyword": "LinkedIn Career almaq",
      "seoRelatedKeywords": " LinkedIn Career qiyməti",
      "seoKeywords": "LinkedIn Career almaq, LinkedIn Career qiyməti",
      "seoContent": "Peşəkar profil və iş axtarışı üçün LinkedIn Career paket təklifidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "LinkedIn Career almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Peşəkar profil və iş axtarışı üçün LinkedIn Career paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/linkedin.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/linkedin.png",
        "mobileImage": "",
        "title": "Linkedin Career",
        "description": "Karyeranızı və şəbəkənizi növbəti səviyyəyə daşıyın.",
        "alt": "Linkedin Career",
        "order": 22
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "be6c1277e7e29010d7b003e0d41272847365ca1372ccc7791a6de60445bd05d4",
          "stockContract": "[null,3,null]",
          "id": "0",
          "stockIdentityId": null,
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
      "_stableId": "elevenlabs_creator",
      "order": 23,
      "category": "ai",
      "image": "uploads/products/elevenlabs_creator-1793128505997-2ea31cf7.png?v=1793128505997",
      "currency": "₼",
      "title": "Elevenlabs Creator",
      "variant": "Səs AI",
      "badge": "AI",
      "imageAlt": "ElevenLabs Creator — MirPanel məhsul şəkli",
      "desc": "Mətnləri ən təbii insan səsi ilə səsləndirin.",
      "note": "Hazır hesab şəklində təqdim edilir.",
      "longDescription": "Səs yaratma və səsli kontent üzərində işləmək üçün Creator paket təklifidir. Səs yaratma limiti və istifadə hüquqlarını konkret paket üzrə yoxlayın. Kontentdən istifadə qaydaları üçün xidmətin öz şərtlərini də oxuyun.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "elevenlabs-creator",
      "seoTitle": "ElevenLabs Creator almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Səs yaratma və səsli kontent üzərində işləmək üçün Creator paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "ElevenLabs Creator",
      "seoPrimaryKeyword": "ElevenLabs Creator almaq",
      "seoRelatedKeywords": " ElevenLabs Creator qiyməti",
      "seoKeywords": "ElevenLabs Creator almaq, ElevenLabs Creator qiyməti",
      "seoContent": "Səs yaratma və səsli kontent üzərində işləmək üçün Creator paket təklifidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "ElevenLabs Creator almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Səs yaratma və səsli kontent üzərində işləmək üçün Creator paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/elevenlabs.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/elevenlabs.png",
        "mobileImage": "",
        "title": "Elevenlabs Creator",
        "description": "Mətnləri ən təbii insan səsi ilə səsləndirin.",
        "alt": "Elevenlabs Creator",
        "order": 23
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
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
      "_stableId": "semrush_premium",
      "order": 24,
      "category": "office",
      "image": "assets/semrush.png",
      "currency": "₼",
      "title": "Semrush Premium",
      "variant": "SEO",
      "badge": "Biznes",
      "imageAlt": "Semrush Premium — MirPanel məhsul şəkli",
      "desc": "Rəqiblərinizi qabaqlayın, açar sözləri tapın.",
      "note": "Hazır hesab kimi verilir.",
      "longDescription": "Sayt və axtarış təhlili üçün Semrush alətlərinə aid paket təklifidir. Giriş formatını, layihə və sorğu limitlərini dəqiqləşdirin. Alətə giriş axtarışda mövqe və ya trafik zəmanəti deyil.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "semrush-premium",
      "seoTitle": "Semrush Premium almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Sayt və axtarış təhlili üçün Semrush alətlərinə aid paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Semrush Premium",
      "seoPrimaryKeyword": "Semrush Premium almaq",
      "seoRelatedKeywords": " Semrush Premium qiyməti",
      "seoKeywords": "Semrush Premium almaq, Semrush Premium qiyməti",
      "seoContent": "Sayt və axtarış təhlili üçün Semrush alətlərinə aid paket təklifidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Semrush Premium almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Sayt və axtarış təhlili üçün Semrush alətlərinə aid paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/semrush.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/semrush.png",
        "mobileImage": "",
        "title": "Semrush Premium",
        "description": "Rəqiblərinizi qabaqlayın, açar sözləri tapın.",
        "alt": "Semrush Premium",
        "order": 24
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
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
      "_stableId": "adobe_express",
      "order": 25,
      "category": "design",
      "image": "uploads/products/adobe_express-1793128277159-ed1498a1.png?v=1793128277159",
      "currency": "₼",
      "title": "Adobe Express",
      "variant": "Pro",
      "badge": "Dizayn",
      "imageAlt": "Adobe Express — MirPanel məhsul şəkli",
      "desc": "Peşəkar qrafiklər və sosial media postları.",
      "note": "Hazır hesab kimi təqdim edilir.",
      "longDescription": "Sosial media vizualları və sadə yaradıcı işlər üçün dizayn alətinə aid paketdir. Aldığınız hesabın Express paketini yoxlayın. Creative Cloud proqramlarının hamısını bu paketə daxil hesab etməyin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "adobe-express",
      "seoTitle": "Adobe Express almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Sosial media vizualları və sadə yaradıcı işlər üçün dizayn alətinə aid paketdir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Adobe Express",
      "seoPrimaryKeyword": "Adobe Express almaq",
      "seoRelatedKeywords": " Adobe Express qiyməti",
      "seoKeywords": "Adobe Express almaq, Adobe Express qiyməti",
      "seoContent": "Sosial media vizualları və sadə yaradıcı işlər üçün dizayn alətinə aid paketdir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Adobe Express almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Sosial media vizualları və sadə yaradıcı işlər üçün dizayn alətinə aid paketdir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/adobe-express.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/adobe-express.png",
        "mobileImage": "",
        "title": "Adobe Express",
        "description": "Peşəkar qrafiklər və sosial media postları.",
        "alt": "Adobe Express",
        "order": 25
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
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
      "_stableId": "notion_plus",
      "order": 26,
      "category": "office",
      "image": "uploads/products/notion_plus-1793128335750-5e44b2d1.png?v=1793128335750",
      "currency": "₼",
      "title": "Notion Plus",
      "variant": "Məhsuldarlıq",
      "badge": "İş",
      "imageAlt": "Notion Plus — MirPanel məhsul şəkli",
      "desc": "Bütün işlərinizi və qeydlərinizi idarə edin.",
      "note": "Hesab hazır şəkildə təhvil verilir.",
      "longDescription": "Qeydlər, sənədlər və işlərin təşkili üçün Notion Plus paket təklifidir. Dəvət və ya giriş aldıqda düzgün iş sahəsini açın. Komanda hüquqları və əlavə AI imkanları ayrıca təsdiqlənməlidir.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "notion-plus",
      "seoTitle": "Notion Plus almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Qeydlər, sənədlər və işlərin təşkili üçün Notion Plus paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Notion Plus",
      "seoPrimaryKeyword": "Notion Plus almaq",
      "seoRelatedKeywords": " Notion Plus qiyməti",
      "seoKeywords": "Notion Plus almaq, Notion Plus qiyməti",
      "seoContent": "Qeydlər, sənədlər və işlərin təşkili üçün Notion Plus paket təklifidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Notion Plus almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Qeydlər, sənədlər və işlərin təşkili üçün Notion Plus paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/notion.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/notion.png",
        "mobileImage": "",
        "title": "Notion Plus",
        "description": "Bütün işlərinizi və qeydlərinizi idarə edin.",
        "alt": "Notion Plus",
        "order": 26
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "be6c1277e7e29010d7b003e0d41272847365ca1372ccc7791a6de60445bd05d4",
          "stockContract": "[null,3,null]",
          "id": "0",
          "stockIdentityId": null,
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
      "_stableId": "picsart_premium",
      "order": 27,
      "category": "design",
      "image": "uploads/products/picsart_premium-1793128536130-84c3b402.png?v=1793128536130",
      "currency": "₼",
      "title": "Picsart Premium",
      "variant": "Foto Edit",
      "badge": "Dizayn",
      "imageAlt": "Picsart Premium — MirPanel məhsul şəkli",
      "desc": "Premium alətlər və süni intellekt filtirləri.",
      "note": "Hesabınız hazır olaraq verilir.",
      "longDescription": "Foto redaktəsi və vizual kontent hazırlamaq üçün Picsart paket təklifidir. Girişdən sonra hesabın paketini yoxlayın. Əlavə AI kreditləri və cihaz sayı konkret sifarişdə təsdiqlənməlidir.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "picsart-premium",
      "seoTitle": "Picsart Premium almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Foto redaktəsi və vizual kontent hazırlamaq üçün Picsart paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Picsart Premium",
      "seoPrimaryKeyword": "Picsart Premium almaq",
      "seoRelatedKeywords": " Picsart Premium qiyməti",
      "seoKeywords": "Picsart Premium almaq, Picsart Premium qiyməti",
      "seoContent": "Foto redaktəsi və vizual kontent hazırlamaq üçün Picsart paket təklifidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Picsart Premium almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Foto redaktəsi və vizual kontent hazırlamaq üçün Picsart paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/picsart.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/picsart.png",
        "mobileImage": "",
        "title": "Picsart Premium",
        "description": "Premium alətlər və süni intellekt filtirləri.",
        "alt": "Picsart Premium",
        "order": 27
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
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
      "_stableId": "blink_starter",
      "order": 28,
      "category": "office",
      "image": "assets/blink.png",
      "currency": "₼",
      "title": "Blink Starter",
      "variant": "Starter",
      "badge": "İş",
      "imageAlt": "Blink Starter — MirPanel məhsul şəkli",
      "desc": "Sürətli və effektiv iş mühiti üçün.",
      "note": "Hazır hesab kimi təqdim olunur.",
      "longDescription": "Veb layihələrin ilkin hazırlanması üçün Starter səviyyəli platforma paketidir. Hesab formatını, layihə və istifadə limitlərini dəqiqləşdirin. Domen, əlavə kredit və yayımlama xidməti ayrıca göstərilmədikdə daxil sayılmır.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "blink-starter",
      "seoTitle": "Blink Starter almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Veb layihələrin ilkin hazırlanması üçün Starter səviyyəli platforma paketidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Blink Starter",
      "seoPrimaryKeyword": "Blink Starter almaq",
      "seoRelatedKeywords": " Blink Starter qiyməti",
      "seoKeywords": "Blink Starter almaq, Blink Starter qiyməti",
      "seoContent": "Veb layihələrin ilkin hazırlanması üçün Starter səviyyəli platforma paketidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Blink Starter almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Veb layihələrin ilkin hazırlanması üçün Starter səviyyəli platforma paketidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/blink.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/blink.png",
        "mobileImage": "",
        "title": "Blink Starter",
        "description": "Sürətli və effektiv iş mühiti üçün.",
        "alt": "Blink Starter",
        "order": 28
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
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
      "_stableId": "lightroom_photo",
      "order": 29,
      "category": "design",
      "image": "assets/lightroom.png",
      "currency": "₼",
      "title": "Lightroom Photo",
      "variant": "Foto Edit",
      "badge": "Dizayn",
      "imageAlt": "Lightroom Photo — MirPanel məhsul şəkli",
      "desc": "Peşəkar rəng korreksiyası və retuş.",
      "note": "Hazır hesab şəklində verilir.",
      "longDescription": "Fotoşəkillərin rəng və işıq redaktəsi üçün Lightroom paket təklifidir. Giriş formasını və uyğun tətbiqi yoxlayın. Bulud yaddaşı və əlavə Adobe proqramlarının daxil olub-olmadığını ayrıca dəqiqləşdirin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "lightroom-photo",
      "seoTitle": "Lightroom Photo almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Fotoşəkillərin rəng və işıq redaktəsi üçün Lightroom paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Lightroom Photo",
      "seoPrimaryKeyword": "Lightroom Photo almaq",
      "seoRelatedKeywords": " Lightroom Photo qiyməti",
      "seoKeywords": "Lightroom Photo almaq, Lightroom Photo qiyməti",
      "seoContent": "Fotoşəkillərin rəng və işıq redaktəsi üçün Lightroom paket təklifidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Lightroom Photo almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Fotoşəkillərin rəng və işıq redaktəsi üçün Lightroom paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/lightroom.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/lightroom.png",
        "mobileImage": "",
        "title": "Lightroom Photo",
        "description": "Peşəkar rəng korreksiyası və retuş.",
        "alt": "Lightroom Photo",
        "order": 29
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
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
      "_stableId": "gemini_ai_pro",
      "order": 30,
      "category": "ai",
      "image": "assets/gemini.png",
      "currency": "₼",
      "title": "Gemini AI Pro",
      "variant": "Google AI",
      "badge": "AI",
      "imageAlt": "Gemini AI Pro — MirPanel məhsul şəkli",
      "desc": "Ən güclü süni intellekt modeli ilə sürətlənin.",
      "note": "Sizin şəxsi Gmail hesabınızda aktiv edilir.",
      "longDescription": "Google Gemini ilə mətn və süni intellekt tapşırıqları üçün Pro paket təklifidir. Paketə uyğun hesabla daxil olun. Model, region və kredit limitləri konkret sifariş üzrə dəqiqləşdirilməlidir.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "gemini-ai-pro",
      "seoTitle": "Gemini AI Pro almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Google Gemini ilə mətn və süni intellekt tapşırıqları üçün Pro paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Gemini AI Pro",
      "seoPrimaryKeyword": "Gemini AI Pro almaq",
      "seoRelatedKeywords": " Gemini AI Pro qiyməti",
      "seoKeywords": "Gemini AI Pro almaq, Gemini AI Pro qiyməti",
      "seoContent": "Google Gemini ilə mətn və süni intellekt tapşırıqları üçün Pro paket təklifidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Gemini AI Pro almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Google Gemini ilə mətn və süni intellekt tapşırıqları üçün Pro paket təklifidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/gemini.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/gemini.png",
        "mobileImage": "",
        "title": "Gemini AI Pro",
        "description": "Ən güclü süni intellekt modeli ilə sürətlənin.",
        "alt": "Gemini AI Pro",
        "order": 30
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
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
          "stockSignature": "ca420f969f473158e725d62b85940f9fca05b482d98ea6056a555f1162a88478",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "months": 1,
          "price": 8.99
        },
        {
          "stockSignature": "dd5f09493268584705d24eb114c4e72fc608b8122b66dfa2bcda411443a161d7",
          "stockContract": "[null,4,null]",
          "id": "1",
          "stockIdentityId": null,
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
    },
    {
      "id": "google_ai",
      "_stableId": "google_ai",
      "order": 31,
      "category": "ai",
      "image": "uploads/products/google_ai-1792447643071-a8ab5d26.png?v=1792447643071",
      "currency": "₼",
      "title": "Gemini ai pro + 5TB yaddaş",
      "variant": "Pro",
      "badge": "AI",
      "imageAlt": "Gemini AI Pro + 5 TB yaddaş — MirPanel məhsul şəkli",
      "desc": "Ağıllı mətn, analiz və məhsuldarlıq.",
      "note": "Aktivləşmə sizin Gmail hesabınız üzərindən edilir.",
      "longDescription": "Gemini süni intellekt və məhsul adında göstərilən yaddaş təklifinə aid kataloq qeydidir. Google hesabının giriş formatını, yaddaşın tətbiqini və AI paketini dəqiqləşdirin. Bu qeyd başqa Google AI məhsulları ilə eyniləşdirilmir.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "google-ai-pro-v3",
      "seoTitle": "Gemini AI Pro + 5 TB yaddaş almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Gemini süni intellekt və məhsul adında göstərilən yaddaş təklifinə aid kataloq qeydidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "Gemini AI Pro + 5 TB yaddaş",
      "seoPrimaryKeyword": "Gemini AI Pro + 5 TB yaddaş almaq",
      "seoRelatedKeywords": " Gemini AI Pro + 5 TB yaddaş qiyməti",
      "seoKeywords": "Gemini AI Pro + 5 TB yaddaş almaq, Gemini AI Pro + 5 TB yaddaş qiyməti",
      "seoContent": "Gemini süni intellekt və məhsul adında göstərilən yaddaş təklifinə aid kataloq qeydidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Gemini AI Pro + 5 TB yaddaş almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Gemini süni intellekt və məhsul adında göstərilən yaddaş təklifinə aid kataloq qeydidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "assets/google-ai.png",
      "banner": {
        "enabled": false,
        "desktopImage": "assets/google-ai.png",
        "mobileImage": "",
        "title": "Google AI Pro + VEO 3",
        "description": "Ağıllı mətn, analiz və məhsuldarlıq.",
        "alt": "Google AI Pro + VEO 3",
        "order": 8
      },
      "flow": "out_of_stock",
      "soldOut": true,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "confirm_then_whatsapp",
      "formFields": [
        {
          "key": "email",
          "type": "email",
          "label": "Email / Gmail",
          "placeholder": "Gmailinizi qeyd edin",
          "description": "",
          "required": true,
          "enabled": true
        }
      ],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "⚠️ SİFARİŞ ETMƏZDƏN ƏVVƏL DİQQƏTLƏ OXUYUN! ⚠️\n\nGemini AI Pro + 5 TB Yaddaş (18 Aylıq) paketi ilə bağlı şərtlər aşağıdakı kimidir:\n\n🔗 Aktivasiya Qaydası:\n• Ödənişdən sonra sizə xüsusi aktivasiya linki təqdim olunur.\n• Həmin linkə daxil olaraq cəmi tək bir kliklə xidməti öz şəxsi Gmail hesabınızda aktivləşdirirsiniz.\n\n📌 Vacib Şərtlər və Qaydalar:\n• Xidmət Növü: Bu, birbaşa Google tərəfindən təqdim olunan xüsusi kampaniya təklifidir. Təklif yalnız 27 Oktyabr tarixinə qədər qüvvədədir.\n• Zəmanət (Qarantiya): Bu paket üçün Mirpanel tərəfindən heç bir zəmanət verilmir və geri ödəniş edilmir.\n• İstifadə Müddəti: Kampaniya 18 aylıq nəzərdə tutulsa da, fəaliyyət tamamilə Google-un daxili siyasətindən asılıdır (hesab 1 ay da işləyə bilər, 18 ay da).\n• Texniki Dəstək: Aktivasiyadan sonra yarana biləcək texniki problemlərə və Google tərəfindən tətbiq edilə biləcək məhdudiyyətlərə görə Mirpanel heç bir məsuliyyət daşımır.\n\nQeyd olunan bütün şərtlərlə razısınızsa, təsdiq edin, sifarişinizi tamamlayaq. 🤝⚡",
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
          "stockSignature": "d3ee54916d002a9b49a48ec9489287cd8cebe44d2579dfb905b43c05cd78b745",
          "stockContract": "[null,18,null]",
          "id": "0",
          "stockIdentityId": null,
          "months": 18,
          "price": 8.99,
          "regularPrice": 700
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Sifarişi təsdiqləyin",
        "description": "⚠️ SİFARİŞ ETMƏZDƏN ƏVVƏL DİQQƏTLƏ OXUYUN! ⚠️\n\nGemini AI Pro + 5 TB Yaddaş (18 Aylıq) paketi ilə bağlı şərtlər aşağıdakı kimidir:\n\n🔗 Aktivasiya Qaydası:\n• Ödənişdən sonra sizə xüsusi aktivasiya linki təqdim olunur.\n• Həmin linkə daxil olaraq cəmi tək bir kliklə xidməti öz şəxsi Gmail hesabınızda aktivləşdirirsiniz.\n\n📌 Vacib Şərtlər və Qaydalar:\n• Xidmət Növü: Bu, birbaşa Google tərəfindən təqdim olunan xüsusi kampaniya təklifidir. Təklif yalnız 27 Oktyabr tarixinə qədər qüvvədədir.\n• Zəmanət (Qarantiya): Bu paket üçün Mirpanel tərəfindən heç bir zəmanət verilmir və geri ödəniş edilmir.\n• İstifadə Müddəti: Kampaniya 18 aylıq nəzərdə tutulsa da, fəaliyyət tamamilə Google-un daxili siyasətindən asılıdır (hesab 1 ay da işləyə bilər, 18 ay da).\n• Texniki Dəstək: Aktivasiyadan sonra yarana biləcək texniki problemlərə və Google tərəfindən tətbiq edilə biləcək məhdudiyyətlərə görə Mirpanel heç bir məsuliyyət daşımır.\n\nQeyd olunan bütün şərtlərlə razısınızsa, təsdiq edin, sifarişinizi tamamlayaq. 🤝⚡",
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
      "id": "epinby_3436",
      "_stableId": "epinby_3436",
      "supplier": {
        "provider": "epinby",
        "productId": 3436,
        "type": "TOPUP",
        "gameId": 4,
        "categoryId": 223,
        "fields": [
          {
            "key": "player_id",
            "label": "Player ID",
            "required": true,
            "type": "text",
            "options": [],
            "maxLength": 400,
            "enabled": true
          }
        ]
      },
      "order": 32,
      "category": "games",
      "image": "uploads/products/epinby_3436-1794438474049-f9e16779.png?v=1794438474049",
      "currency": "₼",
      "title": "60 UC",
      "variant": "",
      "badge": "",
      "imageAlt": "PUBG Mobile 60 UC — arxiv paket — MirPanel məhsul şəkli",
      "desc": "",
      "note": "",
      "longDescription": "PUBG Mobile məhsuluna birləşdirilmiş əvvəlki 60 UC kataloq qeydidir. Aktual paket üçün PUBG Mobile məhsul səhifəsinə baxın. Bu arxiv qeydindən ayrıca alış nəzərdə tutulmur.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "Ödənişdən sonra avtomatik icra",
      "seoSlug": "epinby-3436",
      "seoTitle": "PUBG Mobile 60 UC — arxiv paket almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "PUBG Mobile məhsuluna birləşdirilmiş əvvəlki 60 UC kataloq qeydidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "PUBG Mobile 60 UC — arxiv paket",
      "seoPrimaryKeyword": "PUBG Mobile 60 UC — arxiv paket almaq",
      "seoRelatedKeywords": " PUBG Mobile 60 UC — arxiv paket qiyməti",
      "seoKeywords": "PUBG Mobile 60 UC — arxiv paket almaq, PUBG Mobile 60 UC — arxiv paket qiyməti",
      "seoContent": "PUBG Mobile məhsuluna birləşdirilmiş əvvəlki 60 UC kataloq qeydidir.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": false,
      "includeInSitemap": false,
      "seoOgTitle": "PUBG Mobile 60 UC — arxiv paket almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "PUBG Mobile məhsuluna birləşdirilmiş əvvəlki 60 UC kataloq qeydidir. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "uploads/products/epinby_3436-1794438474049-f9e16779.png?v=1794438474049",
      "banner": {
        "enabled": false,
        "desktopImage": "uploads/products/epinby_3436-1794438474049-f9e16779.png?v=1794438474049",
        "mobileImage": "",
        "title": "60 UC",
        "description": "",
        "alt": "60 UC",
        "order": 32
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_then_whatsapp",
      "formFields": [
        {
          "key": "player_id",
          "type": "text",
          "label": "Player ID",
          "placeholder": "",
          "description": "",
          "required": true,
          "enabled": true,
          "maxLength": 400
        }
      ],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": false,
        "title": "Diqqət!",
        "description": "",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      },
      "whatsapp": {
        "extraMessage": "",
        "includeSeller": false,
        "includeStock": false
      },
      "plans": [
        {
          "stockSignature": "72b909893116fb6b7f65d0cfb6b87ee2c6a172146923fd870cb3274113e8e007",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "pricingId": "caf50ff1-bffa-424d-94d3-a8cd86e612f3",
          "label": "60 UC",
          "months": 1,
          "price": 1.65
        }
      ],
      "orderConfirmation": {
        "enabled": false,
        "title": "Diqqət!",
        "description": "",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "pubg_mobile",
      "_stableId": "pubg_mobile",
      "epinbyGroup": true,
      "order": 33,
      "category": "games",
      "image": "/uploads/products/pubg-mobile-cover.webp",
      "currency": "₼",
      "title": "PUBG Mobile",
      "variant": "",
      "badge": "",
      "imageAlt": "PUBG Mobile UC — MirPanel məhsul şəkli",
      "desc": "PUBG Mobile UC paketlərini eyni məhsul səhifəsində müqayisə edin. 60 UC, 325 UC və digər seçimlərin qiyməti ayrıca göstərilir; sifariş seçdiyiniz paketə bağlanır.",
      "note": "",
      "longDescription": "PUBG Mobile UC paketlərini eyni məhsul səhifəsində müqayisə edin. 60 UC, 325 UC və digər seçimlərin qiyməti ayrıca göstərilir; sifariş seçdiyiniz paketə bağlanır. UC yükləməsi üçün seçilən paketin tələb etdiyi Player ID və varsa server/region məlumatını daxil edin. Yoxlama hesab adını təsdiqləyirsə adı da tutuşdurun. Şifrəni oyunçu ID-si əvəzinə yazmayın.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "Ödənişdən sonra avtomatik icra",
      "seoSlug": "pubg-mobile",
      "seoTitle": "PUBG Mobile UC almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "PUBG Mobile UC almaq üçün 60 UC, 325 UC və digər paketləri müqayisə edin. MirPanel-də AZN qiymətlərini, Player ID və region uyğunluğunu yoxlayın.",
      "seoH1": "PUBG Mobile UC",
      "seoPrimaryKeyword": "PUBG Mobile UC almaq",
      "seoRelatedKeywords": " PUBG UC Azərbaycan, UC qiyməti",
      "seoKeywords": "PUBG Mobile UC almaq, PUBG UC Azərbaycan, UC qiyməti",
      "seoContent": "PUBG Mobile UC paketlərini eyni məhsul səhifəsində müqayisə edin. 60 UC, 325 UC və digər seçimlərin qiyməti ayrıca göstərilir; sifariş seçdiyiniz paketə bağlanır.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "PUBG Mobile UC almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "PUBG Mobile UC almaq üçün 60 UC, 325 UC və digər paketləri müqayisə edin. MirPanel-də AZN qiymətlərini, Player ID və region uyğunluğunu yoxlayın.",
      "seoOgImage": "uploads/products/epinby_3436-1794438474049-f9e16779.png?v=1794438474049",
      "banner": {
        "enabled": false,
        "desktopImage": "uploads/products/epinby_3436-1794438474049-f9e16779.png?v=1794438474049",
        "mobileImage": "",
        "title": "PUBG Mobile",
        "description": "PUBG Mobile UC paketlərini eyni məhsul səhifəsində müqayisə edin. 60 UC, 325 UC və digər seçimlərin qiyməti ayrıca göstərilir; sifariş seçdiyiniz paketə bağlanır.",
        "alt": "PUBG Mobile",
        "order": 33
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": false,
        "title": "Diqqət!",
        "description": "",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
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
          "stockSignature": "112d86d11912ff1ff177aaebdb7e1a30df546f4b38e747e93924a5d7ddae77d9",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 3436,
            "type": "TOPUP",
            "gameId": 4,
            "categoryId": 223,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/epinby_3436-1794438474049-f9e16779.png",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3436",
          "pricingId": "91a0c3a1-657e-4102-a4b6-73f3af4f95c7",
          "label": "60 UC",
          "months": 1,
          "price": 1.65
        },
        {
          "stockSignature": "4967d5f36049c6c6343253dd48bdeabd14c170e13cc52fe32bcbdaf49248c5cb",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 3437,
            "type": "TOPUP",
            "gameId": 4,
            "categoryId": 223,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/pubg-325-uc.png",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3437",
          "pricingId": "5348e426-1f23-45f1-8031-3cbd6bb55773",
          "label": "325 UC",
          "months": 1,
          "price": 7.99
        },
        {
          "stockSignature": "3049ac92d9f3184ab8951b9e9425bd2349a9c6966f020a38e2c124f5fe694d54",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 3438,
            "type": "TOPUP",
            "gameId": 4,
            "categoryId": 223,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/pubg-660-uc.png",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3438",
          "pricingId": "ed7d1f86-c522-4cd5-9aa2-858830e4d62f",
          "label": "660 UC",
          "months": 1,
          "price": 15.54
        },
        {
          "stockSignature": "2714609e38d8f6a7cfffd78b57e847497d19f86177bdba3a2e7fdeaf4120fd88",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 3439,
            "type": "TOPUP",
            "gameId": 4,
            "categoryId": 223,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/pubg-1800-uc.png",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3439",
          "pricingId": "4e2c8137-7040-4b6b-9b6b-77b3dd7a423e",
          "label": "1800 UC",
          "months": 1,
          "price": 39.87
        },
        {
          "stockSignature": "5380f8b77f45edc894350b22975c1ef8e112d6de162ca7c33fa1f927072448f8",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 3440,
            "type": "TOPUP",
            "gameId": 4,
            "categoryId": 223,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/pubg-3850-uc.png",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3440",
          "pricingId": "4fef9151-b07e-4377-a15d-218ff5f7d9a4",
          "label": "3850 UC",
          "months": 1,
          "price": 78.7
        },
        {
          "stockSignature": "994e3e2a5751efa903131195bdbba8439d9a84061ed6b86f716726b64dccb4ca",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 3441,
            "type": "TOPUP",
            "gameId": 4,
            "categoryId": 223,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/pubg-8100-uc.png",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3441",
          "pricingId": "12f5ad5f-3921-4f66-9bd5-aa25bf471f5a",
          "label": "8100 UC",
          "months": 1,
          "price": 148.9
        }
      ],
      "orderConfirmation": {
        "enabled": false,
        "title": "Diqqət!",
        "description": "",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "free_fire",
      "_stableId": "free_fire",
      "epinbyGroup": true,
      "order": 34,
      "category": "games",
      "image": "/uploads/products/free-fire-cover.webp",
      "currency": "₼",
      "title": "Free Fire",
      "variant": "",
      "badge": "",
      "imageAlt": "Free Fire almaz — MirPanel məhsul şəkli",
      "desc": "Free Fire almaz paketləri bu səhifədə bir yerdə təqdim olunur. Paket adındakı almaz sayını, varsa bonusu və regionu qiymətlə birlikdə yoxlayın.",
      "note": "",
      "longDescription": "Free Fire almaz paketləri bu səhifədə bir yerdə təqdim olunur. Paket adındakı almaz sayını, varsa bonusu və regionu qiymətlə birlikdə yoxlayın. Free Fire Player ID-ni və paket tələb edirsə digər məlumatları daxil edin. Hesab adı yoxlaması əlçatandırsa nəticəni yoxlayın; adı təsdiqlənməmiş hesabı təsdiqlənmiş kimi qəbul etməyin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "free-fire",
      "seoTitle": "Free Fire almaz almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Free Fire almaz almaq üçün MirPanel paketlərini və AZN qiymətlərini yoxlayın. Almaz sayı, bonus, region və Player ID məlumatlarını sifarişdən əvvəl tutuşdurun.",
      "seoH1": "Free Fire almaz",
      "seoPrimaryKeyword": "Free Fire almaz almaq",
      "seoRelatedKeywords": " Free Fire Azərbaycan, almaz qiyməti",
      "seoKeywords": "Free Fire almaz almaq, Free Fire Azərbaycan, almaz qiyməti",
      "seoContent": "Free Fire almaz paketləri bu səhifədə bir yerdə təqdim olunur. Paket adındakı almaz sayını, varsa bonusu və regionu qiymətlə birlikdə yoxlayın.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "Free Fire almaz almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Free Fire almaz almaq üçün MirPanel paketlərini və AZN qiymətlərini yoxlayın. Almaz sayı, bonus, region və Player ID məlumatlarını sifarişdən əvvəl tutuşdurun.",
      "seoOgImage": "/uploads/products/free-fire-cover.webp",
      "banner": {
        "enabled": false,
        "desktopImage": "/uploads/products/free-fire-cover.webp",
        "mobileImage": "",
        "title": "Free Fire",
        "description": "Free Fire almaz paketləri bu səhifədə bir yerdə təqdim olunur. Paket adındakı almaz sayını, varsa bonusu və regionu qiymətlə birlikdə yoxlayın.",
        "alt": "Free Fire banneri",
        "order": 34
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": false,
        "title": "Diqqət!",
        "description": "",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
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
          "stockSignature": "eaf3c0234951e4050dd40d93d3d077a038c980645e4d78f92bf13ff182816bd0",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 682,
            "type": "TOPUP",
            "gameId": 5,
            "categoryId": 20,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_682",
          "pricingId": "d0b70eed-360e-4810-bf1f-9ed34e76cd1f",
          "label": " Free Fire 110 Almaz (7/24)",
          "months": 1,
          "price": 1.58
        },
        {
          "stockSignature": "3773640be451004a485f19e2aaee1d5dd0c69418323af2cf62fca01fe28447a8",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 683,
            "type": "TOPUP",
            "gameId": 5,
            "categoryId": 20,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_683",
          "pricingId": "1305b657-1136-415e-b008-41856164e5b0",
          "label": " Free Fire 341 Almaz (7/24)",
          "months": 1,
          "price": 4.69
        },
        {
          "stockSignature": "d72859d25f82d1ffd9b80ec494571df9c8d23e1d4a28cd29deb6962afc2e4803",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 684,
            "type": "TOPUP",
            "gameId": 5,
            "categoryId": 20,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_684",
          "pricingId": "e1835028-8946-47fe-9270-041cdc2d8f7e",
          "label": "Free Fire 572 Almaz (7/24)",
          "months": 1,
          "price": 7.54
        },
        {
          "stockSignature": "b57e7a4835d9718b2e69aed4a3ec11b21edd0c393260254dc998950407bab02b",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 690,
            "type": "TOPUP",
            "gameId": 5,
            "categoryId": 20,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_690",
          "pricingId": "c83337cb-5625-426c-8763-c3d5d1670fdd",
          "label": "Free Fire 1166 Almaz (7/24)",
          "months": 1,
          "price": 13.83
        },
        {
          "stockSignature": "4ef2d22e3b4b181ef87e82aea185833985b66b07542e64f54e3a137bc63e8e22",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 677,
            "type": "TOPUP",
            "gameId": 5,
            "categoryId": 20,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_677",
          "pricingId": "39824726-1360-4e3f-bde3-9c4d05461eb1",
          "label": "Free Fire 2398 Almaz (7/24)",
          "months": 1,
          "price": 27.58
        },
        {
          "stockSignature": "6e541730ade7086b30197f9f121afd62f25a752601b220774bec3be3a1e18e0c",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 685,
            "type": "TOPUP",
            "gameId": 5,
            "categoryId": 20,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_685",
          "pricingId": "d67f0849-89e9-4d01-9d71-1b4b66115541",
          "label": "Free Fire 6160 Almaz (7/24)",
          "months": 1,
          "price": 69.56
        }
      ],
      "orderConfirmation": {
        "enabled": false,
        "title": "Diqqət!",
        "description": "",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "telegram_premium",
      "_stableId": "telegram_premium",
      "epinbyGroup": true,
      "order": 35,
      "category": "subscriptions",
      "image": "/uploads/products/telegram-premium-cover.webp",
      "currency": "₼",
      "title": "Telegram Premium",
      "variant": "",
      "badge": "",
      "imageAlt": "Telegram Premium — MirPanel məhsul şəkli",
      "desc": "Telegram Premium üçün üç və altı aylıq seçimləri müqayisə edin. Premium abunəliklə Telegram Stars eyni məhsul deyil; təsdiqdə göstərilən xidmət növünü yoxlayın.",
      "note": "",
      "longDescription": "Telegram Premium üçün üç və altı aylıq seçimləri müqayisə edin. Premium abunəliklə Telegram Stars eyni məhsul deyil; təsdiqdə göstərilən xidmət növünü yoxlayın. Telegram istifadəçi adını sifariş formasında tələb olunduğu kimi yazın. Paket adı ilə təsdiq ekranındakı xidmət fərqlənirsə ödəniş etmədən operatora müraciət edin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "telegram-premium",
      "seoTitle": "Telegram Premium almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "Telegram Premium paket adlarını, AZN qiymətlərini və faktiki xidmət növünü MirPanel-də yoxlayın. Premium abunəliklə Stars fərqini ödənişdən əvvəl dəqiqləşdirin.",
      "seoH1": "Telegram Premium",
      "seoPrimaryKeyword": "Telegram Premium almaq",
      "seoRelatedKeywords": " Telegram Premium Azərbaycan, Telegram qiyməti",
      "seoKeywords": "Telegram Premium almaq, Telegram Premium Azərbaycan, Telegram qiyməti",
      "seoContent": "Telegram Premium üçün üç və altı aylıq seçimləri müqayisə edin. Premium abunəliklə Telegram Stars eyni məhsul deyil; təsdiqdə göstərilən xidmət növünü yoxlayın.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": false,
      "includeInSitemap": false,
      "seoOgTitle": "Telegram Premium almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "Telegram Premium paket adlarını, AZN qiymətlərini və faktiki xidmət növünü MirPanel-də yoxlayın. Premium abunəliklə Stars fərqini ödənişdən əvvəl dəqiqləşdirin.",
      "seoOgImage": "/uploads/products/telegram-premium-cover.webp",
      "banner": {
        "enabled": false,
        "desktopImage": "/uploads/products/telegram-premium-cover.webp",
        "mobileImage": "",
        "title": "Telegram Premium",
        "description": "Telegram Premium üçün üç və altı aylıq seçimləri müqayisə edin. Premium abunəliklə Telegram Stars eyni məhsul deyil; təsdiqdə göstərilən xidmət növünü yoxlayın.",
        "alt": "Telegram Premium banneri",
        "order": 35
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": false,
        "title": "Diqqət!",
        "description": "",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
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
          "stockSignature": "1ef2acc3a573641f512299796b492bd8934b929ae64380c795892bfcd4d14f20",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 1421,
            "type": "TELEGRAM_STARS",
            "starsAmount": 3,
            "fields": [
              {
                "key": "telegram_username",
                "label": "Telegram istifadəçi adı",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 33,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "telegram_username",
              "type": "text",
              "label": "Telegram istifadəçi adı",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 33
            }
          ],
          "id": "epinby_1421",
          "warrantyMode": "guaranteed",
          "warrantyUnit": "day",
          "warrantyDuration": 87,
          "pricingId": "2da27c28-0306-4d92-925b-0ab82fe5b8ea",
          "label": "Telegram Premium 3 Aylıq",
          "months": 1,
          "price": 23.75,
          "regularPrice": 25.5
        },
        {
          "stockSignature": "6efadcdd618b110b6e920426d4aae9ca3ffd2d275aec04a22b6f971d94afad12",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 1423,
            "type": "TELEGRAM_STARS",
            "starsAmount": 6,
            "fields": [
              {
                "key": "telegram_username",
                "label": "Telegram istifadəçi adı",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 33,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "telegram_username",
              "type": "text",
              "label": "Telegram istifadəçi adı",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 33
            }
          ],
          "id": "epinby_1423",
          "warrantyMode": "guaranteed",
          "warrantyUnit": "day",
          "warrantyDuration": 175,
          "pricingId": "d4096286-0a18-45a8-af6a-5a0e3a22769f",
          "label": "Telegram Premium 6 Aylıq",
          "months": 1,
          "price": 31.99,
          "regularPrice": 51
        }
      ],
      "orderConfirmation": {
        "enabled": false,
        "title": "Diqqət!",
        "description": "",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "mirpanel_token",
      "_stableId": "mirpanel_token",
      "order": 36,
      "category": "other",
      "image": "/assets/tokens/mirpanel-token.webp",
      "currency": "₼",
      "title": "Mirpanel Token",
      "variant": "",
      "badge": "",
      "imageAlt": "MirPanel Token — MirPanel məhsul şəkli",
      "desc": "MirPanel daxilində rəqəmsal hədiyyələr üçün istifadə olunan token paketidir. Başqa platformanın oyun valyutası və ya premium hesab abunəliyi deyil.",
      "note": "",
      "longDescription": "MirPanel daxilində rəqəmsal hədiyyələr üçün istifadə olunan token paketidir. Başqa platformanın oyun valyutası və ya premium hesab abunəliyi deyil. Paketdəki token sayını və yekun AZN qiymətini yoxlayın. Ödəniş təsdiqləndikdən sonra hesabınızdakı token vəziyyətini yoxlayın; dəstəyə müraciətdə sifariş nömrəsini göstərin.",
      "usageRules": "",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "mirpanel-token",
      "seoTitle": "MirPanel Token almaq | Qiymət və paketlər — MirPanel",
      "seoDescription": "MirPanel daxilində rəqəmsal hədiyyələr üçün istifadə olunan token paketidir. Başqa platformanın oyun valyutası və ya premium hesab abunəliyi deyil. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoH1": "MirPanel Token",
      "seoPrimaryKeyword": "MirPanel Token almaq",
      "seoRelatedKeywords": " MirPanel Token qiyməti",
      "seoKeywords": "MirPanel Token almaq, MirPanel Token qiyməti",
      "seoContent": "MirPanel daxilində rəqəmsal hədiyyələr üçün istifadə olunan token paketidir. Başqa platformanın oyun valyutası və ya premium hesab abunəliyi deyil.",
      "seoUpdatedAt": "2026-11-22T12:17:59.744Z",
      "seoIndex": true,
      "includeInSitemap": true,
      "seoOgTitle": "MirPanel Token almaq | Qiymət və paketlər — MirPanel",
      "seoOgDescription": "MirPanel daxilində rəqəmsal hədiyyələr üçün istifadə olunan token paketidir. Başqa platformanın oyun valyutası və ya premium hesab abunəliyi deyil. MirPanel-də paket qiymətini və təhvil qaydasını yoxlayın.",
      "seoOgImage": "/assets/tokens/mirpanel-token.webp",
      "banner": {
        "enabled": false,
        "desktopImage": "/assets/tokens/mirpanel-token.webp",
        "mobileImage": "",
        "title": "Mirpanel Token",
        "description": "1 token = 0,02 ₼. Influencerlərə gül və ürək hədiyyə edin.",
        "alt": "Mirpanel Token — qızılı M hərfli jeton",
        "order": 36
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "direct_whatsapp",
      "formFields": [],
      "formTitle": "",
      "formDescription": "",
      "confirmationModal": {
        "enabled": false,
        "title": "Diqqət!",
        "description": "",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
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
          "stockSignature": "a899816b520b8fbaf2eaa085933af0fae6d0bc9df381541e0f398d50f0b2a33d",
          "stockContract": "[null,1,null]",
          "id": "0",
          "stockIdentityId": null,
          "pricingId": "0dfe589f-5f80-4212-806b-98206f532dfb",
          "label": "50 token",
          "months": 1,
          "price": 1
        }
      ],
      "orderConfirmation": {
        "enabled": false,
        "title": "Diqqət!",
        "description": "",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Ləğv et",
        "footerText": "",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "mobile_legends",
      "_stableId": "mobile_legends",
      "epinbyGroup": true,
      "order": 37,
      "category": "games",
      "image": "/uploads/products/mobile-legends-cover.webp",
      "currency": "₼",
      "title": "Mobile Legends",
      "variant": "",
      "badge": "",
      "imageAlt": "Mobile Legends — oyun məhsulunun banneri",
      "desc": "Mobile Legends: Bang Bang üçün seçilmiş Weekly və Twilight paketlərinin oyun hesabına yüklənməsi. Paket oyunçu ID-si və təchizatçının tələb etdiyi server məlumatı ilə əlaqələndirilir. Hesab şifrəsi tələb olunmur.",
      "note": "Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
      "longDescription": "Mobile Legends: Bang Bang üçün seçilmiş Weekly və Twilight paketlərinin oyun hesabına yüklənməsi. Paket oyunçu ID-si və təchizatçının tələb etdiyi server məlumatı ilə əlaqələndirilir. Hesab şifrəsi tələb olunmur.",
      "usageRules": "Bu əlaqələr Mobile Legends Global kateqoriyasına aiddir; İndoneziya və Braziliya hesabları uyğun deyil. Weekly paketi MY/SG/PH/ID/RU hesabları üçün də bağlıdır. Hesab ölkəsini server nömrəsindən təxmin etməyin. İlk alış bonusu yalnız uyğun bonus paketində və limit yoxlanandan sonra tətbiq edilə bilər; Weekly və Twilight üçün əlavə bonus vəd edilmir.",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "mobile-legends",
      "seoTitle": "Mobile Legends paketləri | MirPanel",
      "seoDescription": "Mobile Legends: Bang Bang üçün seçilmiş Weekly və Twilight paketlərinin oyun hesabına yüklənməsi. Paket oyunçu ID-si və təchizatçının tələb etdiyi server məlumatı ilə əlaqələndirilir. Hesab şifrəsi tələb olunmur.",
      "seoH1": "Mobile Legends",
      "seoPrimaryKeyword": "Mobile Legends almaq",
      "seoRelatedKeywords": "",
      "seoKeywords": "",
      "seoContent": "",
      "seoUpdatedAt": "2026-11-22T21:34:10.265Z",
      "seoIndex": false,
      "includeInSitemap": false,
      "seoOgTitle": "",
      "seoOgDescription": "",
      "seoOgImage": "/uploads/products/mobile-legends-cover.webp",
      "banner": {
        "enabled": false,
        "desktopImage": "/uploads/products/mobile-legends-cover.webp",
        "mobileImage": "/uploads/products/mobile-legends-cover.webp",
        "title": "Mobile Legends",
        "description": "Mobile Legends: Bang Bang üçün seçilmiş Weekly və Twilight paketlərinin oyun hesabına yüklənməsi. Paket oyunçu ID-si və təchizatçının tələb etdiyi server məlumatı ilə əlaqələndirilir. Hesab şifrəsi tələb olunmur.",
        "alt": "Mobile Legends",
        "order": 37
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": true,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_then_whatsapp",
      "formFields": [
        {
          "key": "player_id",
          "type": "text",
          "label": "Player ID",
          "placeholder": "",
          "description": "",
          "required": true,
          "enabled": true
        },
        {
          "key": "server_id",
          "type": "text",
          "label": "Server ID",
          "placeholder": "",
          "description": "",
          "required": false,
          "enabled": true
        }
      ],
      "formTitle": "Oyun hesabının məlumatları",
      "formDescription": "Məlumatları oyun hesabınızdan olduğu kimi köçürün. Hesab şifrənizi yazmayın.",
      "orderGuide": {
        "information": "Bu əlaqələr Mobile Legends Global kateqoriyasına aiddir; İndoneziya və Braziliya hesabları uyğun deyil. Weekly paketi MY/SG/PH/ID/RU hesabları üçün də bağlıdır. Hesab ölkəsini server nömrəsindən təxmin etməyin. İlk alış bonusu yalnız uyğun bonus paketində və limit yoxlanandan sonra tətbiq edilə bilər; Weekly və Twilight üçün əlavə bonus vəd edilmir. Ödəniş təsdiqlənmədən yükləmə göndərilmir. Status və nəticə Sifarişlərim bölməsində göstərilir. Yükləmə müddəti təchizatçının cavabından asılıdır; anında təhvil zəmanəti verilmir.",
        "tracks": {}
      },
      "confirmationModal": {
        "enabled": true,
        "title": "Oyun hesabını yoxlayın",
        "description": "Bu əlaqələr Mobile Legends Global kateqoriyasına aiddir; İndoneziya və Braziliya hesabları uyğun deyil. Weekly paketi MY/SG/PH/ID/RU hesabları üçün də bağlıdır. Hesab ölkəsini server nömrəsindən təxmin etməyin. İlk alış bonusu yalnız uyğun bonus paketində və limit yoxlanandan sonra tətbiq edilə bilər; Weekly və Twilight üçün əlavə bonus vəd edilmir.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Geri",
        "footerText": "",
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
          "stockSignature": "016d19116ed2cb2215e8a5a33a924dfa268245ba953a8456c43cf5f017f5f7dc",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Bu əlaqələr Mobile Legends Global kateqoriyasına aiddir; İndoneziya və Braziliya hesabları uyğun deyil. Weekly paketi MY/SG/PH/ID/RU hesabları üçün də bağlıdır. Hesab ölkəsini server nömrəsindən təxmin etməyin. İlk alış bonusu yalnız uyğun bonus paketində və limit yoxlanandan sonra tətbiq edilə bilər; Weekly və Twilight üçün əlavə bonus vəd edilmir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 413,
            "type": "TOPUP",
            "gameId": 6,
            "categoryId": 11,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              },
              {
                "key": "server_id",
                "label": "Server ID",
                "required": false,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/mobile-legends-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            },
            {
              "key": "server_id",
              "type": "text",
              "label": "Server ID",
              "placeholder": "",
              "description": "",
              "required": false,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_413",
          "active": false,
          "pricingId": "five-games-413",
          "label": "Weekly",
          "months": 1,
          "price": 2.91
        },
        {
          "stockSignature": "40a5c9839de7f10f65066a9bcc06698d7a7927e5a33ba2f0df12c90863d7023b",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Bu əlaqələr Mobile Legends Global kateqoriyasına aiddir; İndoneziya və Braziliya hesabları uyğun deyil. Weekly paketi MY/SG/PH/ID/RU hesabları üçün də bağlıdır. Hesab ölkəsini server nömrəsindən təxmin etməyin. İlk alış bonusu yalnız uyğun bonus paketində və limit yoxlanandan sonra tətbiq edilə bilər; Weekly və Twilight üçün əlavə bonus vəd edilmir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 414,
            "type": "TOPUP",
            "gameId": 6,
            "categoryId": 11,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              },
              {
                "key": "server_id",
                "label": "Server ID",
                "required": false,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/mobile-legends-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            },
            {
              "key": "server_id",
              "type": "text",
              "label": "Server ID",
              "placeholder": "",
              "description": "",
              "required": false,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_414",
          "active": false,
          "pricingId": "five-games-414",
          "label": "Twilight",
          "months": 1,
          "price": 15.3
        },
        {
          "stockSignature": "b042d05697a757161cc30aa2a89123ef81464d79b8644c72c89e32da80f86446",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 2754,
            "type": "TOPUP",
            "gameId": 6,
            "categoryId": 11,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              },
              {
                "key": "server_id",
                "label": "Server ID",
                "required": false,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            },
            {
              "key": "server_id",
              "type": "text",
              "label": "Server ID",
              "placeholder": "",
              "description": "",
              "required": false,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_2754",
          "pricingId": "06acf32b-ebc5-4bd5-9c6c-a88bdc0f0732",
          "label": "50 + 5 Diamonds (First Top-Up Bonus)",
          "months": 1,
          "price": 1.49
        },
        {
          "stockSignature": "50e674146bf164b8d7db8930bd48c0dc232722fd7e01d82c6a4198efb22f6a49",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 2746,
            "type": "TOPUP",
            "gameId": 6,
            "categoryId": 11,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              },
              {
                "key": "server_id",
                "label": "Server ID",
                "required": false,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            },
            {
              "key": "server_id",
              "type": "text",
              "label": "Server ID",
              "placeholder": "",
              "description": "",
              "required": false,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_2746",
          "pricingId": "1dfe56e3-f5ef-4587-a3e6-98aea7cb83d5",
          "label": "250 + 25 Diamonds (First Top-Up Bonus)",
          "months": 1,
          "price": 6.98
        },
        {
          "stockSignature": "fcf0b7367e04c0847eceedaefb2b78ef25562c0d317b93d061fedc003dad4709",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 2745,
            "type": "TOPUP",
            "gameId": 6,
            "categoryId": 11,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              },
              {
                "key": "server_id",
                "label": "Server ID",
                "required": false,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            },
            {
              "key": "server_id",
              "type": "text",
              "label": "Server ID",
              "placeholder": "",
              "description": "",
              "required": false,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_2745",
          "pricingId": "92520ef6-fd18-4af4-8299-2bd2d84e6b3c",
          "label": "234 + 23 Diamonds",
          "months": 1,
          "price": 6.71
        },
        {
          "stockSignature": "77ed93a3e927b09f84eb6fdb7c92d7fd05a5f0b867b1afaf3fabc998c054633c",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 2741,
            "type": "TOPUP",
            "gameId": 6,
            "categoryId": 11,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              },
              {
                "key": "server_id",
                "label": "Server ID",
                "required": false,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            },
            {
              "key": "server_id",
              "type": "text",
              "label": "Server ID",
              "placeholder": "",
              "description": "",
              "required": false,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_2741",
          "pricingId": "1344d8f2-a111-4252-9172-3325a4656b44",
          "label": "156 + 16 Diamonds",
          "months": 1,
          "price": 4.65
        },
        {
          "stockSignature": "e39ebe7f320113787d52621379fe28aed5cea6d5712555385e41b49160857efc",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 2740,
            "type": "TOPUP",
            "gameId": 6,
            "categoryId": 11,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              },
              {
                "key": "server_id",
                "label": "Server ID",
                "required": false,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            },
            {
              "key": "server_id",
              "type": "text",
              "label": "Server ID",
              "placeholder": "",
              "description": "",
              "required": false,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_2740",
          "pricingId": "7007e0be-4440-4200-966f-2f98985298c7",
          "label": "150 + 15 Diamonds (First Top-Up Bonus)",
          "months": 1,
          "price": 4.45
        },
        {
          "stockSignature": "8495f2d7d2ed035bb100f51a723cadd2c814ac123a0789eb5b8bf2fe3928e009",
          "stockContract": "[null,1,null]",
          "supplier": {
            "provider": "epinby",
            "productId": 2763,
            "type": "TOPUP",
            "gameId": 6,
            "categoryId": 11,
            "fields": [
              {
                "key": "player_id",
                "label": "Player ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              },
              {
                "key": "server_id",
                "label": "Server ID",
                "required": false,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "Player ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            },
            {
              "key": "server_id",
              "type": "text",
              "label": "Server ID",
              "placeholder": "",
              "description": "",
              "required": false,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_2763",
          "pricingId": "e93dfadd-2eba-4144-aedf-8b083edb9209",
          "label": "78 + 8 Diamonds",
          "months": 1,
          "price": 2.24
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Oyun hesabını yoxlayın",
        "description": "Bu əlaqələr Mobile Legends Global kateqoriyasına aiddir; İndoneziya və Braziliya hesabları uyğun deyil. Weekly paketi MY/SG/PH/ID/RU hesabları üçün də bağlıdır. Hesab ölkəsini server nömrəsindən təxmin etməyin. İlk alış bonusu yalnız uyğun bonus paketində və limit yoxlanandan sonra tətbiq edilə bilər; Weekly və Twilight üçün əlavə bonus vəd edilmir.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Geri",
        "footerText": "",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "honor_of_kings",
      "_stableId": "honor_of_kings",
      "epinbyGroup": true,
      "order": 38,
      "category": "games",
      "image": "/uploads/products/honor-of-kings-cover.webp",
      "currency": "₼",
      "title": "Honor of Kings",
      "variant": "",
      "badge": "",
      "imageAlt": "Honor of Kings — oyun məhsulunun banneri",
      "desc": "Honor of Kings üçün Tokens və seçilmiş oyun paketləri. Yükləmə seçilmiş paket və həmin sifarişdə yazılmış User ID üzrə aparılır; oyun hesabının şifrəsi istənmir.",
      "note": "Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
      "longDescription": "Honor of Kings üçün Tokens və seçilmiş oyun paketləri. Yükləmə seçilmiş paket və həmin sifarişdə yazılmış User ID üzrə aparılır; oyun hesabının şifrəsi istənmir.",
      "usageRules": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir.",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "honor-of-kings",
      "seoTitle": "Honor of Kings paketləri | MirPanel",
      "seoDescription": "Honor of Kings üçün Tokens və seçilmiş oyun paketləri. Yükləmə seçilmiş paket və həmin sifarişdə yazılmış User ID üzrə aparılır; oyun hesabının şifrəsi istənmir.",
      "seoH1": "Honor of Kings",
      "seoPrimaryKeyword": "Honor of Kings almaq",
      "seoRelatedKeywords": "",
      "seoKeywords": "",
      "seoContent": "",
      "seoUpdatedAt": null,
      "seoIndex": false,
      "includeInSitemap": false,
      "seoOgTitle": "",
      "seoOgDescription": "",
      "seoOgImage": "/uploads/products/honor-of-kings-cover.webp",
      "banner": {
        "enabled": false,
        "desktopImage": "/uploads/products/honor-of-kings-cover.webp",
        "mobileImage": "/uploads/products/honor-of-kings-cover.webp",
        "title": "Honor of Kings",
        "description": "Honor of Kings üçün Tokens və seçilmiş oyun paketləri. Yükləmə seçilmiş paket və həmin sifarişdə yazılmış User ID üzrə aparılır; oyun hesabının şifrəsi istənmir.",
        "alt": "Honor of Kings",
        "order": 38
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_then_whatsapp",
      "formFields": [
        {
          "key": "player_id",
          "type": "text",
          "label": "User ID",
          "placeholder": "",
          "description": "",
          "required": true,
          "enabled": true
        }
      ],
      "formTitle": "Oyun hesabının məlumatları",
      "formDescription": "Məlumatları oyun hesabınızdan olduğu kimi köçürün. Hesab şifrənizi yazmayın.",
      "orderGuide": {
        "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Ödəniş təsdiqlənmədən yükləmə göndərilmir. Status və nəticə Sifarişlərim bölməsində göstərilir. Yükləmə müddəti təchizatçının cavabından asılıdır; anında təhvil zəmanəti verilmir.",
        "tracks": {}
      },
      "confirmationModal": {
        "enabled": true,
        "title": "Oyun hesabını yoxlayın",
        "description": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Geri",
        "footerText": "",
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
          "stockSignature": "b7dd0fcc6bf8178d9460d4e388fe5adc7409e7ac71cb08552dc3e0ea22148251",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3825,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3825",
          "active": false,
          "pricingId": "five-games-3825",
          "label": "16 Tokens",
          "months": 1,
          "price": 0.39
        },
        {
          "stockSignature": "d080cb43cf08d177ef07172fc2a35e036e108e45336c454ab826b6ded75b96b1",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3826,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3826",
          "active": false,
          "pricingId": "five-games-3826",
          "label": "Double Token Lucky Bag",
          "months": 1,
          "price": 0.63
        },
        {
          "stockSignature": "a07a394b0a39ef4f14c15e0f81ce4e757ee8fc9ca4c3aace51cf3dc83f3221d0",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3827,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3827",
          "active": false,
          "pricingId": "five-games-3827",
          "label": "Honor Point Value Pack",
          "months": 1,
          "price": 0.63
        },
        {
          "stockSignature": "ab1260318c227745c706dca92224e5b4c1b50fa71cdcf239e8a9a29d42a2ebc6",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3830,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3830",
          "active": false,
          "pricingId": "five-games-3830",
          "label": "80 Tokens",
          "months": 1,
          "price": 1.81
        },
        {
          "stockSignature": "1618f3442b08ee106731a8c0a1212f8fcfab90b0978d478de9da21c83ea73876",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3831,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3831",
          "active": false,
          "pricingId": "five-games-3831",
          "label": "Weekly Card",
          "months": 1,
          "price": 2.06
        },
        {
          "stockSignature": "fafc3665809a8bc809c7e079979365210f8b39b482fb4034f4c02968ec143fb5",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3832,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3832",
          "active": false,
          "pricingId": "five-games-3832",
          "label": "Premium Purchase Rebate Pack",
          "months": 1,
          "price": 2.37
        },
        {
          "stockSignature": "e3f057c2ac194ef3dbf2f7e6f9f248e1c5a454226e02826ffc3a84d7dc39a7a9",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3833,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3833",
          "active": false,
          "pricingId": "five-games-3833",
          "label": "240 Tokens",
          "months": 1,
          "price": 5.2
        },
        {
          "stockSignature": "add6aa1a1294615d2ca8fbde93fb9d8828218630bbc27a11df6ede7cb9e83c04",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3834,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3834",
          "active": false,
          "pricingId": "five-games-3834",
          "label": "Weekly Card Plus",
          "months": 1,
          "price": 5.44
        },
        {
          "stockSignature": "3e467769a7fdc305b9e209007904be0d2d72399e7e3f497da45343dd5a505697",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3835,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3835",
          "active": false,
          "pricingId": "five-games-3835",
          "label": "400 Tokens",
          "months": 1,
          "price": 8.48
        },
        {
          "stockSignature": "e0580df4851b586a283d176e57feb75a28da85a3b9e2dee2827f13d34e0ca295",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3836,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3836",
          "active": false,
          "pricingId": "five-games-3836",
          "label": "560 Tokens",
          "months": 1,
          "price": 11.79
        },
        {
          "stockSignature": "d5afbb252fc5adc547cdf4c0fde63434e9c8f3b5c647095289e85eae9aafff03",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3837,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3837",
          "active": false,
          "pricingId": "five-games-3837",
          "label": "830 Tokens",
          "months": 1,
          "price": 16.67
        },
        {
          "stockSignature": "7adce7731bb74a9a6e5c625e3e9a0569b87ab0c0eb7759160c211e74ab76c84a",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3838,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3838",
          "active": false,
          "pricingId": "five-games-3838",
          "label": "1245 Tokens",
          "months": 1,
          "price": 24.72
        },
        {
          "stockSignature": "041f28df066e669b2e2081c8235b3f12def764eb6fe4421587c0f82c5e39e6ae",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3839,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3839",
          "active": false,
          "pricingId": "five-games-3839",
          "label": "2508 Tokens",
          "months": 1,
          "price": 49.39
        },
        {
          "stockSignature": "f8e6597549be2d0768d7a5df56193c4462f5c3d0f08770c6354209d2b7d8486e",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3840,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3840",
          "active": false,
          "pricingId": "five-games-3840",
          "label": "4180 Tokens",
          "months": 1,
          "price": 82.19
        },
        {
          "stockSignature": "376dd0539be9ffb1b1ab25fc121798c64ae6cc101d7de3f90508f3ffd2a49492",
          "stockContract": "[null,1,null]",
          "orderGuide": {
            "information": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir. Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
            "tracks": {}
          },
          "supplier": {
            "provider": "epinby",
            "productId": 3841,
            "type": "TOPUP",
            "gameId": 48,
            "categoryId": 229,
            "fields": [
              {
                "key": "player_id",
                "label": "User ID",
                "required": true,
                "type": "text",
                "options": [],
                "maxLength": 400,
                "enabled": true
              }
            ]
          },
          "image": "/uploads/products/honor-of-kings-cover.webp",
          "formFields": [
            {
              "key": "player_id",
              "type": "text",
              "label": "User ID",
              "placeholder": "",
              "description": "",
              "required": true,
              "enabled": true,
              "maxLength": 400
            }
          ],
          "id": "epinby_3841",
          "active": false,
          "pricingId": "five-games-3841",
          "label": "8360 Tokens",
          "months": 1,
          "price": 162.71
        }
      ],
      "orderConfirmation": {
        "enabled": true,
        "title": "Oyun hesabını yoxlayın",
        "description": "Oyun daxilindəki User ID-ni mətn kimi köçürün və paketin nominalını yoxlayın. Təchizatçının araşdırma səhifəsində bütün istifadəçilər qeyd edilsə də, cari paket və Azərbaycan hesabı uyğunluğu satış açılmazdan əvvəl yenidən təsdiqlənməlidir.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Geri",
        "footerText": "",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "arena_breakout",
      "_stableId": "arena_breakout",
      "epinbyGroup": true,
      "order": 39,
      "category": "games",
      "image": "/uploads/products/arena-breakout-cover.webp",
      "currency": "₼",
      "title": "Arena Breakout — mobil",
      "variant": "",
      "badge": "",
      "imageAlt": "Arena Breakout — mobil — oyun məhsulunun banneri",
      "desc": "Arena Breakout mobil versiyası üçün oyun paketlərinin qaralaması. Bu məhsul Arena Breakout Infinite PC versiyası üçün deyil. Dəqiq nominal və valyuta seçiləcək təchizatçı paketi ilə müəyyən olunur, bannerdən götürülmür.",
      "note": "Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
      "longDescription": "Arena Breakout mobil versiyası üçün oyun paketlərinin qaralaması. Bu məhsul Arena Breakout Infinite PC versiyası üçün deyil. Dəqiq nominal və valyuta seçiləcək təchizatçı paketi ilə müəyyən olunur, bannerdən götürülmür.",
      "usageRules": "Mobil oyunun User ID / Player ID məlumatından istifadə edin. PC hesabı ilə qarışdırmayın. Satış qiyməti, cari təchizatçı paketi, hesab bölgəsi və valyuta təsdiqlənənədək sifariş bağlıdır.",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "arena-breakout",
      "seoTitle": "Arena Breakout — mobil paketləri | MirPanel",
      "seoDescription": "Arena Breakout mobil versiyası üçün oyun paketlərinin qaralaması. Bu məhsul Arena Breakout Infinite PC versiyası üçün deyil. Dəqiq nominal və valyuta seçiləcək təchizatçı paketi ilə müəyyən olunur, bannerdən götürülmür.",
      "seoH1": "Arena Breakout — mobil",
      "seoPrimaryKeyword": "Arena Breakout — mobil almaq",
      "seoRelatedKeywords": "",
      "seoKeywords": "",
      "seoContent": "",
      "seoUpdatedAt": null,
      "seoIndex": false,
      "includeInSitemap": false,
      "seoOgTitle": "",
      "seoOgDescription": "",
      "seoOgImage": "/uploads/products/arena-breakout-cover.webp",
      "banner": {
        "enabled": false,
        "desktopImage": "/uploads/products/arena-breakout-cover.webp",
        "mobileImage": "/uploads/products/arena-breakout-cover.webp",
        "title": "Arena Breakout — mobil",
        "description": "Arena Breakout mobil versiyası üçün oyun paketlərinin qaralaması. Bu məhsul Arena Breakout Infinite PC versiyası üçün deyil. Dəqiq nominal və valyuta seçiləcək təchizatçı paketi ilə müəyyən olunur, bannerdən götürülmür.",
        "alt": "Arena Breakout — mobil",
        "order": 39
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_then_whatsapp",
      "formFields": [
        {
          "key": "player_id",
          "type": "text",
          "label": "User ID / Player ID:",
          "placeholder": "",
          "description": "",
          "required": true,
          "enabled": true
        }
      ],
      "formTitle": "Oyun hesabının məlumatları",
      "formDescription": "Məlumatları oyun hesabınızdan olduğu kimi köçürün. Hesab şifrənizi yazmayın.",
      "orderGuide": {
        "information": "Mobil oyunun User ID / Player ID məlumatından istifadə edin. PC hesabı ilə qarışdırmayın. Satış qiyməti, cari təchizatçı paketi, hesab bölgəsi və valyuta təsdiqlənənədək sifariş bağlıdır. Ödəniş təsdiqlənmədən yükləmə göndərilmir. Status və nəticə Sifarişlərim bölməsində göstərilir. Yükləmə müddəti təchizatçının cavabından asılıdır; anında təhvil zəmanəti verilmir.",
        "tracks": {}
      },
      "confirmationModal": {
        "enabled": true,
        "title": "Oyun hesabını yoxlayın",
        "description": "Mobil oyunun User ID / Player ID məlumatından istifadə edin. PC hesabı ilə qarışdırmayın. Satış qiyməti, cari təchizatçı paketi, hesab bölgəsi və valyuta təsdiqlənənədək sifariş bağlıdır.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Geri",
        "footerText": "",
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
      "plans": [],
      "orderConfirmation": {
        "enabled": true,
        "title": "Oyun hesabını yoxlayın",
        "description": "Mobil oyunun User ID / Player ID məlumatından istifadə edin. PC hesabı ilə qarışdırmayın. Satış qiyməti, cari təchizatçı paketi, hesab bölgəsi və valyuta təsdiqlənənədək sifariş bağlıdır.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Geri",
        "footerText": "",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "arena_breakout_infinite",
      "_stableId": "arena_breakout_infinite",
      "epinbyGroup": true,
      "order": 40,
      "category": "games",
      "image": "/uploads/products/arena-breakout-infinite-cover.webp",
      "currency": "₼",
      "title": "Arena Breakout Infinite — PC",
      "variant": "",
      "badge": "",
      "imageAlt": "Arena Breakout Infinite — PC — oyun məhsulunun banneri",
      "desc": "Arena Breakout Infinite PC versiyası üçün oyun paketlərinin qaralaması. Bu məhsul Arena Breakout mobil oyunu üçün deyil. Paket nominalı və oyun valyutası ayrıca təchizatçı məlumatı ilə təsdiqlənir.",
      "note": "Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
      "longDescription": "Arena Breakout Infinite PC versiyası üçün oyun paketlərinin qaralaması. Bu məhsul Arena Breakout mobil oyunu üçün deyil. Paket nominalı və oyun valyutası ayrıca təchizatçı məlumatı ilə təsdiqlənir.",
      "usageRules": "PC oyunundakı Player ID-ni yoxlayın. Mobil Arena Breakout ID-sini daxil etməyin. Satış qiyməti, cari paket və Azərbaycan hesabına uyğunluq təsdiqlənənədək sifariş açılmır.",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "arena-breakout-infinite",
      "seoTitle": "Arena Breakout Infinite — PC paketləri | MirPanel",
      "seoDescription": "Arena Breakout Infinite PC versiyası üçün oyun paketlərinin qaralaması. Bu məhsul Arena Breakout mobil oyunu üçün deyil. Paket nominalı və oyun valyutası ayrıca təchizatçı məlumatı ilə təsdiqlənir.",
      "seoH1": "Arena Breakout Infinite — PC",
      "seoPrimaryKeyword": "Arena Breakout Infinite — PC almaq",
      "seoRelatedKeywords": "",
      "seoKeywords": "",
      "seoContent": "",
      "seoUpdatedAt": null,
      "seoIndex": false,
      "includeInSitemap": false,
      "seoOgTitle": "",
      "seoOgDescription": "",
      "seoOgImage": "/uploads/products/arena-breakout-infinite-cover.webp",
      "banner": {
        "enabled": false,
        "desktopImage": "/uploads/products/arena-breakout-infinite-cover.webp",
        "mobileImage": "/uploads/products/arena-breakout-infinite-cover.webp",
        "title": "Arena Breakout Infinite — PC",
        "description": "Arena Breakout Infinite PC versiyası üçün oyun paketlərinin qaralaması. Bu məhsul Arena Breakout mobil oyunu üçün deyil. Paket nominalı və oyun valyutası ayrıca təchizatçı məlumatı ilə təsdiqlənir.",
        "alt": "Arena Breakout Infinite — PC",
        "order": 40
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_then_whatsapp",
      "formFields": [
        {
          "key": "player_id",
          "type": "text",
          "label": "Player ID",
          "placeholder": "",
          "description": "",
          "required": true,
          "enabled": true
        }
      ],
      "formTitle": "Oyun hesabının məlumatları",
      "formDescription": "Məlumatları oyun hesabınızdan olduğu kimi köçürün. Hesab şifrənizi yazmayın.",
      "orderGuide": {
        "information": "PC oyunundakı Player ID-ni yoxlayın. Mobil Arena Breakout ID-sini daxil etməyin. Satış qiyməti, cari paket və Azərbaycan hesabına uyğunluq təsdiqlənənədək sifariş açılmır. Ödəniş təsdiqlənmədən yükləmə göndərilmir. Status və nəticə Sifarişlərim bölməsində göstərilir. Yükləmə müddəti təchizatçının cavabından asılıdır; anında təhvil zəmanəti verilmir.",
        "tracks": {}
      },
      "confirmationModal": {
        "enabled": true,
        "title": "Oyun hesabını yoxlayın",
        "description": "PC oyunundakı Player ID-ni yoxlayın. Mobil Arena Breakout ID-sini daxil etməyin. Satış qiyməti, cari paket və Azərbaycan hesabına uyğunluq təsdiqlənənədək sifariş açılmır.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Geri",
        "footerText": "",
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
      "plans": [],
      "orderConfirmation": {
        "enabled": true,
        "title": "Oyun hesabını yoxlayın",
        "description": "PC oyunundakı Player ID-ni yoxlayın. Mobil Arena Breakout ID-sini daxil etməyin. Satış qiyməti, cari paket və Azərbaycan hesabına uyğunluq təsdiqlənənədək sifariş açılmır.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Geri",
        "footerText": "",
        "helpLink": {
          "enabled": false,
          "label": "",
          "url": ""
        }
      }
    },
    {
      "id": "stumble_guys",
      "_stableId": "stumble_guys",
      "epinbyGroup": true,
      "order": 41,
      "category": "games",
      "image": "/uploads/products/stumble-guys-cover.webp",
      "currency": "₼",
      "title": "Stumble Guys",
      "variant": "",
      "badge": "",
      "imageAlt": "Stumble Guys — oyun məhsulunun banneri",
      "desc": "Stumble Guys üçün Gems, Tokens və qarışıq paket namizədləri. Hər nominal ayrıca təchizatçı ID-si ilə əlaqələndirilib. Bannerin Gems yazısı bütün paketlərin Gems olması demək deyil.",
      "note": "Qaralama: cari EpinBy hesab API qiyməti, stok və Azərbaycan hesabı uyğunluğu təsdiqlənməyib. Satış bağlıdır.",
      "longDescription": "Stumble Guys üçün Gems, Tokens və qarışıq paket namizədləri. Hər nominal ayrıca təchizatçı ID-si ilə əlaqələndirilib. Bannerin Gems yazısı bütün paketlərin Gems olması demək deyil.",
      "usageRules": "Player ID ilə yanaşı hesabın platforması və paketin valyutası təchizatçı üzrə dəqiqləşdirilməlidir. Mobil, PC və konsol hesablarının eyni qaydada işlədiyi fərz edilmir. Satış qiyməti və platforma uyğunluğu təsdiqlənənədək alış bağlıdır.",
      "deliveryText": "",
      "availabilityText": "",
      "seoSlug": "stumble-guys",
      "seoTitle": "Stumble Guys paketləri | MirPanel",
      "seoDescription": "Stumble Guys üçün Gems, Tokens və qarışıq paket namizədləri. Hər nominal ayrıca təchizatçı ID-si ilə əlaqələndirilib. Bannerin Gems yazısı bütün paketlərin Gems olması demək deyil.",
      "seoH1": "Stumble Guys",
      "seoPrimaryKeyword": "Stumble Guys almaq",
      "seoRelatedKeywords": "",
      "seoKeywords": "",
      "seoContent": "",
      "seoUpdatedAt": null,
      "seoIndex": false,
      "includeInSitemap": false,
      "seoOgTitle": "",
      "seoOgDescription": "",
      "seoOgImage": "/uploads/products/stumble-guys-cover.webp",
      "banner": {
        "enabled": false,
        "desktopImage": "/uploads/products/stumble-guys-cover.webp",
        "mobileImage": "/uploads/products/stumble-guys-cover.webp",
        "title": "Stumble Guys",
        "description": "Stumble Guys üçün Gems, Tokens və qarışıq paket namizədləri. Hər nominal ayrıca təchizatçı ID-si ilə əlaqələndirilib. Bannerin Gems yazısı bütün paketlərin Gems olması demək deyil.",
        "alt": "Stumble Guys",
        "order": 41
      },
      "flow": "whatsapp",
      "soldOut": false,
      "active": false,
      "stock": null,
      "stockEnabled": false,
      "seller": "",
      "bestSeller": false,
      "orderFlow": "form_then_whatsapp",
      "formFields": [
        {
          "key": "player_id",
          "type": "text",
          "label": "Player ID",
          "placeholder": "",
          "description": "",
          "required": true,
          "enabled": true
        }
      ],
      "formTitle": "Oyun hesabının məlumatları",
      "formDescription": "Məlumatları oyun hesabınızdan olduğu kimi köçürün. Hesab şifrənizi yazmayın.",
      "orderGuide": {
        "information": "Player ID ilə yanaşı hesabın platforması və paketin valyutası təchizatçı üzrə dəqiqləşdirilməlidir. Mobil, PC və konsol hesablarının eyni qaydada işlədiyi fərz edilmir. Satış qiyməti və platforma uyğunluğu təsdiqlənənədək alış bağlıdır. Ödəniş təsdiqlənmədən yükləmə göndərilmir. Status və nəticə Sifarişlərim bölməsində göstərilir. Yükləmə müddəti təchizatçının cavabından asılıdır; anında təhvil zəmanəti verilmir.",
        "tracks": {}
      },
      "confirmationModal": {
        "enabled": true,
        "title": "Oyun hesabını yoxlayın",
        "description": "Player ID ilə yanaşı hesabın platforması və paketin valyutası təchizatçı üzrə dəqiqləşdirilməlidir. Mobil, PC və konsol hesablarının eyni qaydada işlədiyi fərz edilmir. Satış qiyməti və platforma uyğunluğu təsdiqlənənədək alış bağlıdır.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Geri",
        "footerText": "",
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
      "plans": [],
      "orderConfirmation": {
        "enabled": true,
        "title": "Oyun hesabını yoxlayın",
        "description": "Player ID ilə yanaşı hesabın platforması və paketin valyutası təchizatçı üzrə dəqiqləşdirilməlidir. Mobil, PC və konsol hesablarının eyni qaydada işlədiyi fərz edilmir. Satış qiyməti və platforma uyğunluğu təsdiqlənənədək alış bağlıdır.",
        "confirmText": "Oxudum və təsdiqləyirəm",
        "cancelText": "Geri",
        "footerText": "",
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
const CMS_CONTENT = {
  "schemaVersion": 2,
  "site": {
    "brandName": "Mirpanel",
    "logo": "assets/logo.png",
    "brandSubtitle": "Premium Hesablar • Etibarlı Aktivləşmə",
    "whatsappNumber": "994514113545",
    "phoneDisplay": "051 411 35 45"
  },
  "homepage": {
    "announcement": {
      "enabled": true,
      "text": "Diqqət! Saytımızda qeydiyyat tələb olunmur. Məhsulu seçib ödənişi tamamladıqdan sonra WhatsApp avtomatik açılacaq."
    },
    "hero": {
      "title": "Premium Hesablar — Sürətli və Etibarlı",
      "description": "Netflix, ChatGPT Plus, Google AI, CapCut Pro və daha çox. Plan seç → məlumatları yaz → WhatsApp avtomatik açılır."
    },
    "seoIntro": {
      "enabled": false,
      "title": "Azərbaycanda premium rəqəmsal məhsullar",
      "text": "Mirpanel rəqəmsal məhsulların mövcud planlarını, qiymətlərini və sifariş məlumatlarını bir yerdə nəzərdən keçirməyə imkan verir."
    },
    "search": {
      "title": "AXTARIŞ ET,",
      "highlight": "İSTƏDİYİNİ TAP!",
      "description": "Bütün məlumatlar saytda mövcuddur. Axtarış bölməsindən istədiyiniz məhsulu rahatlıqla tapa bilərsiniz.",
      "placeholder": "Məhsul axtar... (məs: Netflix, Zoom)"
    },
    "bundle": {
      "enabled": true,
      "title": "XÜSUSİ PAKET (ENDİRİMLİ)",
      "description": "İstədiyiniz məhsulları seçin və 5% paket endirimi qazanın! Bütün paketlər 1 aylıq hesablanır.",
      "buttonText": "Paket yarat",
      "discountPercent": 5
    },
    "sectionOrder": [
      "announcement",
      "hero",
      "search",
      "products",
      "bundle",
      "info"
    ],
    "sections": {
      "announcement": true,
      "hero": true,
      "search": true,
      "products": true,
      "bundle": true,
      "info": true,
      "games": true,
      "ai": true
    },
    "infoCards": {
      "about": {
        "title": "Haqqımızda",
        "text": "Mirpanel premium hesabların sürətli və etibarlı aktivləşdirilməsi üçün xidmət göstərir.",
        "linkText": "Ətraflı"
      },
      "contact": {
        "title": "Əlaqə",
        "text": "WhatsApp üzərindən dəstək",
        "linkText": "WhatsApp ilə yaz"
      },
      "terms": {
        "title": "Şərtlər",
        "text": "Sifariş və istifadə şərtləri",
        "linkText": "Ətraflı"
      }
    }
  },
  "navigation": [
    {
      "id": "home",
      "label": "Ana Səhifə",
      "url": "/",
      "order": 1,
      "enabled": true,
      "icon": "home",
      "newTab": false,
      "showHeader": true,
      "showFooter": false
    },
    {
      "id": "products",
      "label": "Məhsullar",
      "url": "/mehsul",
      "order": 2,
      "enabled": true,
      "icon": "products",
      "newTab": false,
      "showHeader": true,
      "showFooter": false
    },
    {
      "id": "about",
      "label": "Haqqımızda",
      "url": "/haqqimizda",
      "order": 3,
      "enabled": true,
      "icon": "info",
      "newTab": false,
      "showHeader": true,
      "showFooter": true
    },
    {
      "id": "terms",
      "label": "Şərtlər",
      "url": "/sertler",
      "order": 4,
      "enabled": true,
      "icon": "terms",
      "newTab": false,
      "showHeader": true,
      "showFooter": true
    },
    {
      "id": "contact",
      "label": "Əlaqə",
      "url": "/elaqe",
      "order": 5,
      "enabled": true,
      "icon": "contact",
      "newTab": false,
      "showHeader": true,
      "showFooter": true
    }
  ],
  "banners": [],
  "supportCard": {
    "desktopImage": "assets/support.png",
    "mobileImage": "",
    "title": "",
    "workHours": "",
    "alt": "Canlı Dəstək",
    "url": "https://wa.me/994514113545",
    "enabled": true
  },
  "footer": {
    "copyrightText": "Bütün hüquqlar qorunur",
    "year": 2026,
    "brandName": "Mirpanel",
    "phone": "051 411 35 45",
    "whatsapp": "994514113545",
    "shortText": "",
    "links": [
      {
        "id": "about",
        "label": "Haqqımızda",
        "url": "/haqqimizda",
        "order": 3,
        "enabled": true,
        "icon": "info",
        "newTab": false
      },
      {
        "id": "terms",
        "label": "Şərtlər",
        "url": "/sertler",
        "order": 4,
        "enabled": true,
        "icon": "terms",
        "newTab": false
      },
      {
        "id": "contact",
        "label": "Əlaqə",
        "url": "/elaqe",
        "order": 5,
        "enabled": true,
        "icon": "contact",
        "newTab": false
      }
    ]
  },
  "commonTexts": {
    "available": "Mövcuddur",
    "outOfStock": "Stokda yoxdur",
    "selectDuration": "Müddət seçin",
    "order": "İndi al",
    "productAbout": "Məhsul haqqında",
    "usageRules": "İstifadə qaydaları",
    "relatedProducts": "Oxşar məhsullar",
    "moreProducts": "Daha çox məhsul",
    "instantDelivery": "7/24 anında təqdim edilir",
    "close": "Bağla",
    "confirm": "Təsdiqləyirəm",
    "cancel": "Ləğv et",
    "sendWhatsapp": "WhatsApp-a göndər",
    "requiredField": "Bu sahə məcburidir.",
    "invalidEmail": "Düzgün e-poçt ünvanı daxil edin.",
    "noSearchResults": "Axtarışa uyğun məhsul tapılmadı.",
    "bundleTitle": "Paket yarat",
    "bundleButton": "Paket yarat"
  },
  "seo": {
    "home": {
      "slug": "",
      "title": "Premium rəqəmsal məhsullar Azərbaycanda | Mirpanel",
      "description": "Netflix, Spotify Premium, ChatGPT Plus, CapCut Pro və digər rəqəmsal məhsulların mövcud planlarını Mirpanel-də nəzərdən keçirin.",
      "ogTitle": "Premium rəqəmsal məhsullar Azərbaycanda | Mirpanel",
      "ogDescription": "Netflix, Spotify Premium, ChatGPT Plus, CapCut Pro və digər rəqəmsal məhsulların mövcud planlarını Mirpanel-də nəzərdən keçirin.",
      "ogImage": "assets/logo.png",
      "index": true,
      "includeInSitemap": true
    },
    "robotsIndexing": true
  },
  "orderSettings": {
    "whatsappButtonText": "WhatsApp",
    "defaultExtraMessage": "",
    "requireConfirmation": false,
    "agreementText": "İstifadə qaydalarını və şərtləri oxudum, qəbul edirəm."
  },
  "media": [
    {
      "path": "assets/slider1.png",
      "name": "",
      "alt": "Spotify Premium banneri",
      "size": 8555028,
      "type": "image/png",
      "width": 3200,
      "height": 1342,
      "uploadedAt": ""
    },
    {
      "path": "assets/slider2.png",
      "name": "",
      "alt": "Netflix banneri",
      "size": 9355020,
      "type": "image/png",
      "width": 3202,
      "height": 1312,
      "uploadedAt": ""
    },
    {
      "path": "assets/slider3.png",
      "name": "",
      "alt": "Canva Premium banneri",
      "size": 8785009,
      "type": "image/png",
      "width": 3200,
      "height": 1340,
      "uploadedAt": ""
    },
    {
      "path": "assets/slider4.png",
      "name": "",
      "alt": "YouTube Premium banneri",
      "size": 5252146,
      "type": "image/png",
      "width": 3200,
      "height": 1340,
      "uploadedAt": ""
    },
    {
      "path": "assets/slider5.png",
      "name": "",
      "alt": "CapCut Pro banneri",
      "size": 8441107,
      "type": "image/png",
      "width": 3200,
      "height": 1340,
      "uploadedAt": ""
    },
    {
      "path": "assets/slider6.png",
      "name": "",
      "alt": "TikTok Jeton banneri",
      "size": 8957752,
      "type": "image/png",
      "width": 3200,
      "height": 1340,
      "uploadedAt": ""
    },
    {
      "path": "assets/support.png",
      "name": "",
      "alt": "Canlı Dəstək",
      "size": 5547663,
      "type": "image/png",
      "width": 3196,
      "height": 1344,
      "uploadedAt": ""
    },
    {
      "path": "/uploads/products/media-1785511117501-4809285c.jpg?v=1785511117501",
      "name": "",
      "alt": "",
      "size": 161840,
      "type": "image/jpeg",
      "width": 1376,
      "height": 768,
      "uploadedAt": "2026-07-31T15:18:37.501Z"
    },
    {
      "path": "/uploads/products/capcut-1786103247176-d7438ec7.jpg?v=1786103247176",
      "name": "",
      "alt": "CapCut Pro banneri",
      "size": 790789,
      "type": "image/jpeg",
      "width": 3200,
      "height": 1340,
      "uploadedAt": "2026-08-07T11:47:27.177Z"
    }
  ]
};

const SITE_SECTIONS = {
  "haqqimizda": {
    "enabled": true,
    "kicker": "Haqqımızda",
    "title": "Haqqımızda",
    "text": "Mirpanel premium hesabların sürətli və etibarlı aktivləşdirilməsi üçün xidmət göstərir. Məhsullar WhatsApp üzərindən rahat sifariş olunur və dəstək komandası müştərilərə kömək edir.",
    "linkText": "",
    "order": 1,
    "slug": "haqqimizda",
    "subtitle": "",
    "body": "",
    "blocks": [
      {
        "title": "",
        "text": "",
        "image": "",
        "order": 1
      },
      {
        "title": "",
        "text": "",
        "image": "",
        "order": 2
      },
      {
        "title": "",
        "text": "",
        "image": "",
        "order": 3
      },
      {
        "title": "",
        "text": "",
        "image": "",
        "order": 4
      },
      {
        "title": "",
        "text": "",
        "image": "",
        "order": 5
      }
    ],
    "seoTitle": "Haqqımızda | MirPanel",
    "seoDescription": "MirPanel-in rəqəmsal məhsulları, sifariş prosesi, təqdimat qaydaları, təhlükəsizlik prinsipləri və müştəri dəstəyi haqqında məlumat.",
    "homeButtonText": "Ana səhifə",
    "homeButtonUrl": "",
    "productsButtonText": "Məhsullara bax",
    "productsButtonUrl": "/mehsul",
    "contactLinkText": "Əlaqə səhifəsinə keçin",
    "contactLinkUrl": "/elaqe",
    "ogTitle": "MirPanel haqqında",
    "ogDescription": "MirPanel-in rəqəmsal məhsulları, sifariş prosesi və xidmət prinsipləri ilə tanış olun.",
    "ogImage": "",
    "index": true,
    "includeInSitemap": true,
    "buttonText": "",
    "buttonUrl": ""
  },
  "sertler": {
    "enabled": true,
    "title": "İstifadəçi qaydaları və şərtləri",
    "text": "",
    "items": [],
    "order": 2,
    "slug": "sertler",
    "subtitle": "",
    "body": "# MIRPANEL.COM – İSTİFADƏÇİ QAYDALARI VƏ ŞƏRTLƏRİ\r\n\r\nBu Qaydalar və Şərtlər **[https://mirpanel.com/](https://mirpanel.com/)** saytından istifadə edən və MirPanel-in rəsmi WhatsApp hesabı vasitəsilə sifariş verən bütün müştərilərə şamil olunur.\r\n\r\nMirPanel-də istifadəçi qeydiyyatı mövcud deyil. Müştəri saytda məhsul və ya xidmət seçdikdən sonra sifarişi tamamlamaq üçün avtomatik olaraq MirPanel-in rəsmi WhatsApp hesabına yönləndirilir.\r\n\r\n**WhatsApp vasitəsilə sifariş verməklə və ödənişi həyata keçirməklə müştəri bu sənəddə qeyd olunan bütün qayda və şərtləri oxuduğunu, başa düşdüyünü və qəbul etdiyini təsdiqləmiş sayılır.**\r\n\r\nBu sənəd Azərbaycan Respublikasının qanunvericiliyi ilə istehlakçıya verilən məcburi hüquqları aradan qaldırmır.\r\n\r\n## ⚠️ ƏN VACİB MƏLUMATLAR ⚠️\r\n\r\n- Geri ödəniş yalnız bu sənəddə göstərilən və qanunvericiliklə nəzərdə tutulan hallarda mümkündür.\r\n- MirPanel-də istifadəçi hesabı və sayt balansı olmadığı üçün təsdiqlənmiş geri ödəniş müştərinin ödəniş etdiyi karta, bank hesabına və ya razılaşdırılmış digər ödəniş vasitəsinə qaytarılır.\r\n- Geri ödəniş üçün müştəri MirPanel-in rəsmi WhatsApp hesabına müraciət etməli, sifariş məlumatlarını, ödəniş qəbzini və problemlə bağlı sübutları təqdim etməlidir.\r\n- Geri ödəniş zamanı faktiki bank komissiyaları və əməliyyat xərcləri nəzərə alınaraq məbləğdən **5%-dək xidmət haqqı** tutula bilər.\r\n- Netflix, Spotify, YouTube, OpenAI, Adobe və digər üçüncü tərəf platformaların tətbiq etdiyi deaktivasiya, məhdudiyyət və qayda dəyişiklikləri MirPanel-in nəzarətində deyil.\r\n- Üçüncü tərəf platformanın qərarı nəticəsində xidmətin dayandırılması və ya məhdudlaşdırılması avtomatik geri ödəniş və ya əvəzləmə hüququ yaratmır.\r\n- MirPanel uyğun hallarda müştəri məmnuniyyətini nəzərə alaraq könüllü texniki dəstək, əvəzləmə və ya alternativ həll təqdim edə bilər.\r\n\r\n# 1. Platformanın fəaliyyət istiqaməti\r\n\r\n**1.1.** MirPanel rəqəmsal məhsul və xidmətlərin təqdim edilməsi və sifarişlərin icrasında vasitəçilik edən onlayn platformadır.\r\n\r\n**1.2.** Platformadan və təqdim edilən xidmətlərdən yalnız qanuni məqsədlər üçün istifadə edilməsinə icazə verilir.\r\n\r\n**1.3.** MirPanel, saytda açıq şəkildə başqa məlumat göstərilmədiyi müddətdə, Netflix, Spotify, YouTube, OpenAI, Adobe və digər üçüncü tərəf platformanın rəsmi nümayəndəsi, distribütoru və ya tərəfdaşı deyil.\r\n\r\n**1.4.** Üçüncü tərəf platformalar MirPanel-dən müstəqil fəaliyyət göstərir və öz istifadə qaydalarını, texniki tələblərini və təhlükəsizlik siyasətlərini tətbiq edirlər.\r\n\r\n# 2. Azyaşlılarla bağlı qaydalar\r\n\r\n**2.1.** 18 yaşdan aşağı şəxslər MirPanel-dən yalnız valideyninin və ya qanuni nümayəndəsinin məlumatı və razılığı ilə istifadə edə və sifariş verə bilərlər.\r\n\r\n**2.2.** Valideynin, ailə üzvünün və ya başqa şəxsin kartından və ödəniş vasitəsindən icazəsiz istifadə nəticəsində yaranan məsuliyyət sifarişi verən şəxsə aiddir. MirPanel belə hallara görə məsuliyyət daşımır.\r\n\r\n**2.3.** Azyaşlı tərəfindən valideynin və ya qanuni nümayəndənin razılığı olmadan verilmiş sifarişlə bağlı müraciətlər ödəniş sənədləri və digər mövcud məlumatlar əsasında ayrıca araşdırılır.\r\n\r\n# 3. Sifariş prosesi\r\n\r\n**3.1.** Müştəri MirPanel saytında məhsul və ya xidmət seçdikdən sonra sifarişi tamamlamaq üçün avtomatik olaraq MirPanel-in rəsmi WhatsApp hesabına yönləndirilir.\r\n\r\n**3.2.** Müştəri sifariş üçün tələb olunan məlumatları WhatsApp vasitəsilə təqdim edir. Sifariş yalnız ödəniş həyata keçirildikdən və MirPanel tərəfindən təsdiqləndikdən sonra qəbul edilmiş sayılır.\r\n\r\n**3.3.** Ödənişin təsdiqlənməsi üçün müştəridən ödəniş qəbzi və ya əməliyyatı təsdiq edən digər məlumat tələb oluna bilər.\r\n\r\n**3.4.** Rəqəmsal məhsul və xidmətlər adətən qısa müddətdə təqdim edilir. Texniki səbəb və ya sifariş sıxlığı yarandıqda icra müddəti maksimum **24–48 saat** ola bilər.\r\n\r\n**3.5.** Sifarişlər növbə əsasında icra olunur. Sifariş yalnız məhsulun alınmasına, hazırlanmasına və ya aktivləşdirilməsinə başlanılmadığı halda ləğv edilə bilər.\r\n\r\n**3.6.** Hesab məlumatı, giriş imkanı, aktivləşdirmə linki, promokod, dəvət, lisenziya açarı və ya abunəlik müştəriyə WhatsApp və ya razılaşdırılmış digər elektron əlaqə vasitəsilə göndərildikdə rəqəmsal məhsul təqdim edilmiş sayılır.\r\n\r\n**3.7.** Müştəri sifariş zamanı təqdim etdiyi telefon nömrəsi, e-poçt ünvanı, istifadəçi adı və digər məlumatların düzgünlüyünə görə məsuliyyət daşıyır.\r\n\r\n# 4. Ödəniş qaydaları\r\n\r\n**4.1.** Ödəniş yalnız MirPanel-in rəsmi WhatsApp hesabı vasitəsilə müştəriyə təqdim edilən bank kartına qəbul olunur.\r\n\r\n**4.2.** Müştəri ödəniş etməzdən əvvəl yazışdığı WhatsApp nömrəsinin və təqdim edilən kart məlumatlarının MirPanel tərəfindən göndərildiyini yoxlamalıdır.\r\n\r\n**4.3.** Başqa şəxslərin təqdim etdiyi karta, hesaba və ya ödəniş vasitəsinə köçürülən məbləğlərə görə MirPanel məsuliyyət daşımır.\r\n\r\n**4.4.** Ödənişdən sonra müştəri əməliyyat qəbzini MirPanel-in rəsmi WhatsApp hesabına göndərməlidir.\r\n\r\n**4.5.** Ödəniş qəbz, bank bildirişi və ya hesab əməliyyatı əsasında yoxlanılır. Zəruri hallarda müştəridən ödənişi təsdiqləyən əlavə məlumat tələb oluna bilər.\r\n\r\n**4.6.** Ödəniş MirPanel tərəfindən təsdiqlənmədən sifarişin icrasına başlanılmır.\r\n\r\n# 5. Abunəlik və istifadə qaydaları\r\n\r\n**5.1.** Texniki olaraq mümkün olduğu hallarda abunəliyin bitmə tarixi barədə müştəriyə **1–2 gün əvvəl WhatsApp vasitəsilə bildiriş göndərilir**.\r\n\r\n**5.2.** Bildiriş əlavə məlumat xarakteri daşıyır. Abunəliyin bitmə tarixini izləmək və vaxtında yeniləmə sifarişi vermək müştərinin də məsuliyyətidir.\r\n\r\n**5.3.** Müştərinin cihazı, internet bağlantısı, proqram təminatı, DNS, VPN, region uyğunsuzluğu və ya digər şəxsi texniki səbəblərə görə xidmətdən istifadə edə bilməməsi geri ödəniş üçün əsas hesab edilmir.\r\n\r\n**5.4.** Məhsulun istifadə qaydaları saytda və ya sifariş zamanı WhatsApp vasitəsilə təqdim edilibsə, müştəri həmin məlumatlarla tanış olmalı və göstərilən təlimatlara əməl etməlidir.\r\n\r\n**5.5.** Tək cihaz və ya şəxsi istifadə üçün təqdim edilən hesabın başqa şəxslərlə paylaşılması və icazəsiz olaraq bir neçə cihazda istifadə edilməsi qadağandır.\r\n\r\n**5.6.** MirPanel-in icazəsi olmadan hesabın şifrəsinin, regionunun, təhlükəsizlik məlumatlarının və digər vacib parametrlərinin dəyişdirilməsi nəticəsində yaranan problemlərə görə MirPanel məsuliyyət daşımır.\r\n\r\n## 5.7. Texniki aktivləşdirmə\r\n\r\n**5.7.1.** Bəzi rəqəmsal xidmətlərin aktivləşdirilməsi üçün MirPanel və ya onun səlahiyyətli texniki əməkdaşı müştərinin təqdim etdiyi məlumatlardan yalnız sifarişin icrası üçün lazım olan minimum həcmdə istifadə edə bilər.\r\n\r\n**5.7.2.** Bəzi xidmətlərdə region uyğunluğunun yoxlanılması, müştərinin razılığı ilə hesaba müvəqqəti giriş və ya digər texniki aktivləşdirmə addımları tələb oluna bilər.\r\n\r\n**5.7.3.** Texniki giriş yalnız sifarişin icrası məqsədilə, zəruri müddətdə və məhdud şəkildə həyata keçirilir.\r\n\r\n**5.7.4.** Aktivləşdirmə üsulları qüvvədə olan qanunvericiliyə və müvafiq platformanın tətbiq olunan qaydalarına uyğun olmalıdır.\r\n\r\n# 6. Geri qaytarılma və əvəzləmə\r\n\r\n**6.1.** Qanunvericiliklə nəzərdə tutulan hallar istisna olmaqla, müştəri üçün xüsusi olaraq alınmış, hazırlanmış, aktivləşdirilmiş və ya artıq təqdim edilmiş rəqəmsal məhsul və xidmətlər geri qaytarılmır.\r\n\r\n## 6.2. Geri ödənişin mümkün olduğu hallar\r\n\r\nGeri ödəniş və ya əvəzləmə aşağıdakı hallarda mümkündür:\r\n\r\n- Məhsul ödəniş təsdiqləndikdən sonra **24–48 saat ərzində təqdim edilməyibsə**;\r\n- Məhsul ilkin təqdimat və ilk giriş zamanı texniki olaraq işləmirsə;\r\n- Problem video, ekran görüntüsü və ya digər yoxlanıla bilən sübutla təsdiqlənibsə;\r\n- MirPanel-in yoxlaması nəticəsində problemin müştəri səhvindən yaranmadığı müəyyən edilibsə;\r\n- Problem MirPanel tərəfindən **24 saat ərzində aradan qaldırıla bilməyibsə**.\r\n\r\n**6.3.** Qüsurlu məhsul dedikdə hesabın və ya xidmətin ilkin təqdimat və ilk istifadə zamanı funksional şəkildə işləməməsi nəzərdə tutulur.\r\n\r\n**6.4.** MirPanel ilk növbədə problemi aradan qaldırmağa və ya məhsulu işlək məhsulla əvəzləməyə çalışır. Bu mümkün olmadıqda geri ödəniş məsələsinə baxılır.\r\n\r\n## 6.5. Geri ödənişin nəzərdə tutulmadığı hallar\r\n\r\nQanunvericiliklə başqa hal tələb edilmədiyi müddətdə aşağıdakılar geri ödəniş üçün əsas hesab edilmir:\r\n\r\n- Məhsul işlək vəziyyətdə təqdim edilibsə;\r\n- Hesab, abunəlik, kod, lisenziya, promokod və ya dəvət artıq müştəriyə göndərilibsə;\r\n- Məhsul müştəri üçün xüsusi olaraq alınıb və çəkilmiş xərc təchizatçı tərəfindən geri qaytarılmırsa;\r\n- Müştəri yanlış məhsul və ya platforma seçibsə;\r\n- Müştəri səhv telefon nömrəsi, e-poçt ünvanı və ya hesab məlumatı təqdim edibsə;\r\n- Problem müştərinin cihazı, interneti, DNS-i, VPN-i və ya region uyğunsuzluğu səbəbindən yaranıbsa;\r\n- Hesab üçüncü şəxslə paylaşılıbsa;\r\n- Hesabda icazəsiz dəyişiklik və ya çoxsaylı riskli giriş həyata keçirilibsə;\r\n- MirPanel tərəfindən verilən istifadə təlimatlarına əməl edilməyibsə;\r\n- Üçüncü tərəf platforma hesabı yoxlamaya göndərib, məhdudlaşdırıb və ya deaktiv edibsə.\r\n\r\n## 6.6. Subyektiv narazılıq\r\n\r\nHazır hesabda görünən e-poçt adı, profil adı, istifadəçi adı, hesab adı, qrup və ya “family” adı əvvəlcədən yaradılmış ola bilər.\r\n\r\nBu məlumatlar xidmətin işləməsinə təsir etmədikdə məhsul qüsurlu hesab olunmur. Müştərinin həmin məlumatları subyektiv və ya estetik səbəblərlə bəyənməməsi geri ödəniş, əvəzləmə və ya sifarişin ləğvi üçün əsas yaratmır.\r\n\r\n## 6.7. Geri ödənişin forması və müddəti\r\n\r\n**6.7.1.** MirPanel-də istifadəçi hesabı və sayt balansı olmadığı üçün təsdiqlənmiş geri ödəniş müştərinin ödəniş etdiyi karta, bank hesabına və ya tərəflərin razılaşdırdığı digər ödəniş vasitəsinə qaytarılır.\r\n\r\n**6.7.2.** Geri ödəniş müraciətinin icra müddəti təsdiq tarixindən etibarən maksimum **3–5 iş günüdür**. Bank əməliyyatına görə məbləğin hesaba çatması əlavə vaxt tələb edə bilər.\r\n\r\n**6.7.3.** Geri ödəniş zamanı faktiki bank komissiyaları, köçürmə və əməliyyat xərcləri nəzərə alınaraq məbləğdən **5%-dək xidmət haqqı** tutula bilər.\r\n\r\n**6.7.4.** Müddətli rəqəmsal məhsul üzrə geri ödəniş təsdiqlənərsə, hesablamada yalnız istifadə olunmamış müddət nəzərə alınır.\r\n\r\n**6.7.5.** Xidmət müddətinin **90%-i və ya daha çoxu keçdikdə**, qanunvericiliklə başqa hal tələb edilmədiyi müddətdə geri ödəniş hesablanmır.\r\n\r\n**6.7.6.** Məhsulun alınması, təmin edilməsi və ya texniki aktivləşdirilməsi üçün çəkilmiş və geri qaytarılması mümkün olmayan faktiki xərc geri ödəniş məbləğindən çıxıla bilər.\r\n\r\n**6.7.7.** Geri ödəniş üçün müştəri MirPanel-in rəsmi WhatsApp hesabına sifariş məlumatlarını, ödəniş qəbzini və problemlə bağlı sübutları göndərməlidir.\r\n\r\n# 7. Təhlükəsizlik və fırıldaqçılığın qarşısının alınması\r\n\r\n**7.1.** MirPanel tərəfindən saytda göstərilməyən və ya rəsmi WhatsApp hesabı vasitəsilə təsdiqlənməyən əlaqə vasitələri ilə aparılan yazışma, ödəniş və alış-verişlərə görə MirPanel məsuliyyət daşımır.\r\n\r\n**7.2.** Müştəri ödəniş etməzdən əvvəl yazışdığı WhatsApp nömrəsinin və təqdim edilən kart məlumatlarının MirPanel-ə aid olduğunu yoxlamalıdır.\r\n\r\n**7.3.** Saxta və ya dəyişdirilmiş ödəniş qəbzi, kart fırıldaqçılığı, hesab oğurluğu, icazəsiz giriş, üçüncü şəxslərin məlumatlarından istifadə və digər sui-istifadə halları aşkarlandıqda sifariş dərhal dayandırılır.\r\n\r\n**7.4.** Qayda pozuntusuna yol verən şəxsin telefon nömrəsi bloklana, həmin şəxsə gələcəkdə xidmət göstərilməsindən imtina edilə və sifarişləri ləğv oluna bilər.\r\n\r\n**7.5.** Fırıldaqçılıq və ya digər qanun pozuntusu şübhəsi yarandıqda müvafiq sübutlar saxlanıla və qanunvericiliyin tələblərinə uyğun olaraq hüquq-mühafizə orqanlarına təqdim edilə bilər.\r\n\r\n# 8. MirPanel-in öhdəlikləri və məsuliyyət hədləri\r\n\r\n**8.1.** MirPanel sifariş edilən rəqəmsal məhsul və ya xidmətin hazırlanması, aktivləşdirilməsi və müştəriyə təqdim edilməsi mərhələsinə görə məsuliyyət daşıyır.\r\n\r\n**8.2.** MirPanel üçüncü tərəf platformaların daxili qaydalarını, texniki nasazlıqlarını, təhlükəsizlik yoxlamalarını, region məhdudiyyətlərini və siyasət dəyişikliklərini idarə etmir.\r\n\r\n**8.3.** Üçüncü tərəf platformalar öz istifadə qaydalarına əsasən hesabı və ya abunəliyi dəyişdirə, yoxlamaya göndərə, məhdudlaşdıra, deaktiv edə və ya xidməti dayandıra bilərlər.\r\n\r\n**8.4.** MirPanel üçüncü tərəf platformanın texniki və inzibati qərarlarına müdaxilə etməyə, hesabı bərpa etməyə və ya məhdudiyyəti aradan qaldırmağa təminat vermir.\r\n\r\n**8.5.** Sifariş üçün çəkilən xərc artıq təchizatçıya və ya üçüncü tərəf platformaya ödənilib və həmin məbləğ geri qaytarılmırsa, MirPanel qanunvericiliklə başqa hal tələb edilmədiyi müddətdə avtomatik geri ödəniş və ya əvəzləmə öhdəliyi daşımır.\r\n\r\n**8.6.** Xidmət təqdim edildikdən sonra onun davamlılığı üçüncü tərəf platformanın fəaliyyətindən və müştərinin istifadə qaydalarına əməl etməsindən asılıdır.\r\n\r\n**8.7.** MirPanel imkan daxilində texniki dəstək, izah, yönləndirmə, məhsulun bərpası, əvəzlənməsi və ya alternativ həll təqdim edə bilər.\r\n\r\n**8.8.** MirPanel tərəfindən göstərilən könüllü yardım, güzəşt, əvəzləmə və ya kompensasiya digər sifarişlər üçün avtomatik təminat və ya daimi öhdəlik yaratmır.\r\n\r\n## 8.9. Məsuliyyətin məhdudlaşdırılması\r\n\r\nMirPanel qanunvericiliyin yol verdiyi həddə aşağıdakılara görə məsuliyyət daşımır:\r\n\r\n- Üçüncü tərəf platformanın xidməti dəyişdirməsi, məhdudlaşdırması və ya dayandırması;\r\n- Müştərinin yanlış və ya natamam məlumat təqdim etməsi;\r\n- Müştərinin cihazı, interneti, DNS-i, VPN-i və ya region uyğunsuzluğu;\r\n- Hesabın paylaşılması və istifadə qaydalarının pozulması;\r\n- MirPanel-dən asılı olmayan texniki nasazlıqlar və xidmət fasilələri;\r\n- Məlumat, gəlir, mənfəət, reputasiya və ya müştəri itkisi kimi dolayı zərərlər.\r\n\r\nBu məhdudiyyətlər MirPanel-in qəsdi, kobud səhlənkarlığı və ya qanunvericiliklə məhdudlaşdırılmasına icazə verilməyən məsuliyyət hallarına tətbiq edilmir.\r\n\r\n# 9. Müştərinin öhdəlikləri\r\n\r\n**9.1.** Müştəri ona təqdim edilən hesab məlumatlarını, şifrələri, giriş kodlarını, aktivləşdirmə linklərini və digər məxfi məlumatları təhlükəsiz saxlamalıdır.\r\n\r\n**9.2.** Şəxsi və ya tək cihaz üçün təqdim edilən hesabın üçüncü şəxslərlə paylaşılması qadağandır.\r\n\r\n**9.3.** Hesabın paylaşılması nəticəsində yaranan deaktivasiya, giriş itkisi və digər problemlərə görə məsuliyyət müştəriyə aiddir.\r\n\r\n**9.4.** Müştəri sifariş zamanı düzgün telefon nömrəsi, e-poçt ünvanı, istifadəçi adı və digər zəruri məlumatları təqdim etməlidir.\r\n\r\n**9.5.** Müştəri məhsulun istifadə qaydalarına və MirPanel tərəfindən WhatsApp vasitəsilə verilən təlimatlara əməl etməlidir.\r\n\r\n**9.6.** MirPanel-in icazəsi olmadan hesab məlumatlarının, şifrənin, regionun və ya təhlükəsizlik parametrlərinin dəyişdirilməsi nəticəsində yaranan problemlərə görə MirPanel məsuliyyət daşımır.\r\n\r\n**9.7.** Saxta qəbz, fırıldaqçılıq, icazəsiz giriş və ya digər ciddi qayda pozuntusu aşkarlandıqda sifariş dayandırıla, müştərinin WhatsApp nömrəsi bloklana və gələcək sifarişlərin qəbulundan imtina edilə bilər.\r\n\r\n# 10. Şəxsi məlumatların qorunması\r\n\r\n**10.1.** MirPanel sifarişin icrası üçün müştərinin təqdim etdiyi məlumatlardan yalnız zəruri olan minimum həcmdə istifadə edir.\r\n\r\n**10.2.** Məlumatlar aşağıdakı məqsədlərlə işlənilə bilər:\r\n\r\n- Sifarişin qəbul və icra edilməsi;\r\n- Məhsul və xidmətin aktivləşdirilməsi;\r\n- Müştəri dəstəyinin göstərilməsi;\r\n- Ödənişin yoxlanılması;\r\n- Fırıldaqçılığın və sui-istifadənin qarşısının alınması;\r\n- Qanunvericiliklə nəzərdə tutulan öhdəliklərin yerinə yetirilməsi.\r\n\r\n**10.3.** Müştəri məlumatları kommersiya məqsədilə satılmır.\r\n\r\n**10.4.** Sifarişin texniki icrası üçün zəruri olduqda minimum məlumat səlahiyyətli texniki əməkdaş və ya xidmət təminatçısı ilə paylaşıla bilər.\r\n\r\n**10.5.** Məlumatlar yalnız sifarişin icrası, təhlükəsizlik və zəruri dəstək üçün lazım olan müddətdə saxlanılır. Hüquqi və ya texniki saxlanma zərurəti olmadıqda məlumatlar silinir və ya anonimləşdirilir.\r\n\r\n**10.6.** MirPanel şəxsi məlumatların icazəsiz istifadəsinin və paylaşılmasının qarşısını almaq üçün müvafiq təhlükəsizlik tədbirləri görür.\r\n\r\n# 11. Xidmətin hüquqi xarakteri\r\n\r\n**11.1.** MirPanel tərəfindən təqdim edilən hesablar, abunəliklər, aktivləşdirmə kodları, dəvətlər, promokodlar, lisenziyalar və digər xidmətlər rəqəmsal formada təqdim olunur və fiziki məhsul hesab edilmir.\r\n\r\n**11.2.** Rəqəmsal məhsulun məlumatları, giriş imkanı, aktivləşdirmə linki, kodu və ya abunəliyi müştəriyə WhatsApp və ya razılaşdırılmış digər elektron əlaqə vasitəsilə göndərildikdə məhsul təqdim edilmiş sayılır.\r\n\r\n**11.3.** Rəqəmsal məhsullar üzrə geri ödəniş və əvəzləmə bu sənəddə göstərilən qaydalara və Azərbaycan Respublikasının qüvvədə olan qanunvericiliyinə uyğun həyata keçirilir.\r\n\r\n**11.4.** Bu sənədin hər hansı müddəası qanunvericiliklə ziddiyyət təşkil edərsə, həmin məsələyə qüvvədə olan qanunvericiliyin tələbləri tətbiq olunur.\r\n\r\n# 12. Müraciətlər və mübahisələrin həlli\r\n\r\n**12.1.** Xidmətlə bağlı müraciət və şikayətlər MirPanel-in rəsmi WhatsApp hesabına yazılı şəkildə təqdim edilməlidir.\r\n\r\n**12.2.** Müştəri müraciət zamanı sifariş məlumatlarını, ödəniş qəbzini və problemin mövcudluğunu göstərən sübutları təqdim etməlidir.\r\n\r\n**12.3.** Tərəflər mübahisəni ilk növbədə qarşılıqlı danışıqlar və təqdim edilən sübutların araşdırılması yolu ilə həll etməyə çalışırlar.\r\n\r\n**12.4.** Razılıq əldə edilmədikdə mübahisə Azərbaycan Respublikasının qüvvədə olan qanunvericiliyinə uyğun olaraq aidiyyəti məhkəmə və ya digər səlahiyyətli orqan tərəfindən həll edilir.\r\n\r\n**12.5.** Bu sənəddə nəzərdə tutulmayan məsələlərə Azərbaycan Respublikasının qüvvədə olan qanunvericiliyi tətbiq olunur.\r\n\r\n# 13. Qaydaların qəbul edilməsi və qüvvəyə minməsi\r\n\r\n**13.1.** Bu qaydalar müştərinin MirPanel-in rəsmi WhatsApp hesabı vasitəsilə sifariş verməsi və ödənişi həyata keçirməsi anından etibarən qüvvəyə minir.\r\n\r\n**13.2.** Sifariş verən və ödəniş edən müştəri bu Qaydalar və Şərtləri oxuduğunu, başa düşdüyünü və qəbul etdiyini təsdiqləmiş sayılır.\r\n\r\n**13.3.** Müştəri sifariş verməzdən və ödəniş etməzdən əvvəl qaydalarla tanış olmalıdır.\r\n\r\n**13.4.** MirPanel zəruri olduqda bu qaydalara dəyişiklik edə bilər. Dəyişikliklər saytda dərc edildiyi andan sonra verilən sifarişlərə tətbiq olunur.\r\n\r\n**13.5.** Müştərinin əvvəlki sifarişinə həmin sifariş və ödəniş tarixində saytda qüvvədə olan qaydalar tətbiq edilir.\r\n\r\n# 14. Müştərinin yekun təsdiqi\r\n\r\nSifariş vermək və ödəniş etmək vasitəsilə müştəri aşağıdakıları təsdiqləyir:\r\n\r\n- Bu sənədi oxuduğunu və şərtləri qəbul etdiyini;\r\n- Təqdim edilən məhsul və xidmətlərin rəqəmsal xarakter daşıdığını;\r\n- Üçüncü tərəf platformaların MirPanel-dən müstəqil fəaliyyət göstərdiyini;\r\n- Məhsul və xidmətlərdən təqdim edilən təlimatlara uyğun istifadə edəcəyini;\r\n- Hesab məlumatlarının təhlükəsiz saxlanılmasına görə məsuliyyət daşıdığını;\r\n- Geri ödəniş və əvəzləmə müraciətlərinin hər bir hal üzrə ayrıca araşdırılacağını;\r\n- Qanunvericiliklə nəzərdə tutulan hüquqları saxlanılmaqla, üçüncü tərəfin qərarlarına görə MirPanel-in avtomatik geri ödəniş, əvəzləmə və ya bərpa təminatı vermədiyini.",
    "seoTitle": "İstifadəçi qaydaları və şərtləri | MirPanel",
    "seoDescription": "MirPanel sifariş, ödəniş, rəqəmsal məhsulların istifadəsi, geri ödəniş və müştəri öhdəlikləri barədə qaydalar.",
    "blocks": [],
    "ogTitle": "MirPanel istifadəçi qaydaları və şərtləri",
    "ogDescription": "MirPanel sifariş, ödəniş, istifadə, geri ödəniş və müştəri öhdəlikləri barədə qaydalar.",
    "ogImage": "",
    "index": true,
    "includeInSitemap": true,
    "buttonText": "",
    "buttonUrl": ""
  },
  "elaqe": {
    "enabled": true,
    "title": "Əlaqə",
    "whatsappNumber": "051 411 35 45",
    "buttonText": "WhatsApp ilЙ™ yaz",
    "text": "",
    "order": 3,
    "slug": "elaqe",
    "subtitle": "Mirpanel dəstək komandası ilə əlaqə",
    "body": "",
    "workHours": "Dəstək WhatsApp üzərindən göstərilir.",
    "seoTitle": "Əlaqə | Mirpanel",
    "seoDescription": "Mirpanel ilə WhatsApp üzərindən əlaqə saxlayın.",
    "blocks": [],
    "ogTitle": "",
    "ogDescription": "",
    "ogImage": "",
    "index": true,
    "includeInSitemap": true,
    "buttonUrl": "",
    "whatsappMessage": ""
  }
};

const ADMIN_CONTENT = {
  "youtube": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>YouTube-da video izləmək və musiqi dinləmək üçün öz Google hesabınızda aktivləşdirilən abunəlikdir. Hazır yeni hesab satışı ilə eyni deyil.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 Ay</strong> — 5,99 ₼.</li><li><strong>12 Ay · 12 ay</strong> — 49,49 ₼; 12 ay zəmanət.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Email / Gmail, Email / Gmail Şifrəsi.</p>",
    "rulesHtml": "<h3>YouTube Premium — istifadə addımları</h3><ol><li>Aktivləşdirmə öz Google hesabınız üçündür. Yeni hesabın sizə veriləcəyini gözləməyin.</li><li>Abunəlik açıldıqda YouTube profilində Premium vəziyyətini yoxlayın. Məhsul hazırda sifarişə bağlıdırsa alternativ sifariş yaratmayın.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 Ay</strong> — 5,99 ₼.</li><li><strong>12 Ay · 12 ay</strong> — 49,49 ₼; 12 ay zəmanət.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "zoom": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Zoom Pro onlayn dərs, iş görüşü və toplantılar üçün hesab təklifidir. Müddəti və qiyməti aşağıdakı paket seçimində müqayisə edə bilərsiniz.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 ay</strong> — 9,98 ₼; 28 gün zəmanət.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Zoom Pro — istifadə addımları</h3><ol><li>Təqdim edilən e-poçt və şifrə ilə Zoom tətbiqində “Giriş yapın” seçin.</li><li>Təsdiq kodu tələb olunarsa Zoom üçün telefonlu təlimatı izləyin; nümunə kodu yox, öz hesabınıza gələn ən son kodu istifadə edin.</li><li>Şifrə dəyişməzdən əvvəl sifarişin cari təhvil qeydlərini yoxlayın və operatorla razılaşdırın.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 ay</strong> — 9,98 ₼; 28 gün zəmanət.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "spotify": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Bu Spotify Premium təklifi müştərinin öz hesabında aktivləşdirmə üçündür. Mövcud hesabınızı istifadə etmək istəyirsinizsə seçilən paketin adını və tələb olunan giriş məlumatlarını yoxlayın.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 Ay  (Öz hesabınızda aktiv edilir)</strong> — 5,49 ₼.</li><li><strong>12 Ay (Öz hesabınızda aktiv edilir) endirim💥 · 12 ay</strong> — 44,99 ₼; 12 ay zəmanət.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Gmail ünvanınız, Spotify şifrəniz, Spotify şifrənizi təkrar yazın.</p>",
    "rulesHtml": "<h3>Spotify Premium — istifadə addımları</h3><ol><li>Öz Spotify hesabınıza aktivləşdirmə edilir; e-poçt və Spotify şifrəsini sifariş formasında düzgün yazın.</li><li>Təkrar şifrə sahəsi varsa eyni şifrəni yazın. Aktivləşdirmə bitdikdə həmin hesabın Premium vəziyyətini yoxlayın.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 Ay  (Öz hesabınızda aktiv edilir)</strong> — 5,49 ₼.</li><li><strong>12 Ay (Öz hesabınızda aktiv edilir) endirim💥 · 12 ay</strong> — 44,99 ₼; 12 ay zəmanət.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "netflix": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Netflix Şəxsi film və serial izləmək üçün ayrılan otaq/profil təklifidir. Bu məhsulu ümumi hesabdan fərqləndirən hissə sifarişinizə aid otaq və PIN məlumatıdır.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 5,99 ₼.</li><li><strong>3 aylıq</strong> — 16,49 ₼.</li><li><strong>6 aylıq</strong> — 29,99 ₼.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Ad, Otaq kodu.</p>",
    "rulesHtml": "<h3>Netflix Şəxsi — istifadə addımları</h3><ol><li>Təhvil məlumatındakı Netflix hesabına daxil olub sizə ayrılmış otağı/profili və PIN-i seçin.</li><li>Başqa müştərinin profilinə keçməyin. Otaqla bağlı dəyişiklikdən əvvəl sifarişinizdəki cari istifadə qaydasını oxuyun.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 5,99 ₼.</li><li><strong>3 aylıq</strong> — 16,49 ₼.</li><li><strong>6 aylıq</strong> — 29,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "capcut": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>CapCut Pro video montajı üçün premium hesab təklifidir. Qısa müddətli və aylıq paketləri eyni səhifədə görüb ümumi qiymətlərini müqayisə edə bilərsiniz.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 Ay (endirim)</strong> — 4,99 ₼.</li><li><strong>7 gün</strong> — 1,12 ₼; 6 gün zəmanət.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>CapCut Pro — istifadə addımları</h3><ol><li>Paketdə seçdiyiniz müddətə uyğun hazır hesabın giriş məlumatını açın.</li><li>Telefonda e-poçt və şifrə ilə giriş üçün CapCut təlimatını izləyin. Paket kompüter girişini dəstəkləyirsə, QR ilə giriş zamanı kodu daxil olduğunuz telefondan oxudun.</li><li>7 günlük paketlə aylıq paketin xidmət və zəmanət müddətləri eyni deyil; aşağıdakı paket məlumatını ayrıca yoxlayın.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 Ay (endirim)</strong> — 4,99 ₼.</li><li><strong>7 gün</strong> — 1,12 ₼; 6 gün zəmanət.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "chatgpt_ortaq": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Süni intellektlə işləmək üçün paylaşılan hesab təklifidir; hazır şəxsi ChatGPT Plus məhsulundan ayrıdır.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 ayliq</strong> — 5,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>ChatGPT Plus ortaq hesab — istifadə addımları</h3><ol><li>Paylaşılan girişdə hesabın şifrəsini və digər istifadəçilərin məlumatlarını dəyişməyin. İcazə verilən istifadə formasını təhvil təlimatından yoxlayın.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 ayliq</strong> — 5,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "chatgpt": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Bu səhifə hazır şəxsi ChatGPT Plus hesabı təklifi üçündür. Paylaşılan hesabla qarışdırmamaq üçün məhsul adını və seçilmiş müddəti yoxlayın.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 ayliq</strong> — 15,99 ₼; 27 gün zəmanət.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>ChatGPT Plus şəxsi hesab — istifadə addımları</h3><ol><li>Sizə verilən şəxsi hesabın e-poçt və şifrəsi ilə ChatGPT-yə daxil olun.</li><li>Əlavə təsdiq tələb olunarsa yalnız sifarişdəki şəxsi təlimatdan istifadə edin. Şifrəni, təsdiq kodunu və 2FA açarını açıq söhbətdə paylaşmayın.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 ayliq</strong> — 15,99 ₼; 27 gün zəmanət.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "netflix_umumi": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Netflix Ümumi paylaşılan hesab formatında təqdim edilir. Şəxsi otaq təklifi ilə eyni məhsul deyil; giriş və istifadə qaydalarını ödənişdən əvvəl müqayisə edin.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 3,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Netflix Ümumi — istifadə addımları</h3><ol><li>Bu paylaşılan hesabdır, ayrıca şəxsi otaq paketi deyil.</li><li>Yalnız təhvil qeydində göstərilən giriş qaydasını izləyin; digər istifadəçilərin şifrəsini və profillərini dəyişməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 3,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "prime": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Amazon Prime Video film və serial izləmək üçün hesab təklifidir. Paket müddətini və qiymətini bu səhifədə seçin; bu məhsulu Amazon alış-veriş xidmətləri ilə eyniləşdirməyin.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 ay</strong> — 2,89 ₼; 27 gün zəmanət.</li><li><strong>6 ay</strong> — 8,99 ₼; 160 gün zəmanət.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Ad, 5 rəqəmli kod.</p>",
    "rulesHtml": "<h3>Amazon Prime Video — istifadə addımları</h3><ol><li>Amazon Prime Video-ya təqdim olunan e-poçt və şifrə ilə daxil olun, ayrılmış profili seçin.</li><li>Keçid açarı təklifi çıxarsa Prime Video təlimatındakı şifrə ilə davam etmə addımını izləyin.</li><li>Otaq adı və kodu istənilərsə seçilmiş paket formasını doldurun; başqa məhsulun PIN qaydasını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 ay</strong> — 2,89 ₼; 27 gün zəmanət.</li><li><strong>6 ay</strong> — 8,99 ₼; 160 gün zəmanət.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "claude_ai": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Mətnlə işləmək, araşdırma və kodla bağlı tapşırıqlar üçün süni intellekt xidmətinin paket təklifidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 Ayliq</strong> — 37,40 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Claude AI — istifadə addımları</h3><ol><li>Giriş formatı və istifadə limiti dəqiqləşdirildikdən sonra təhvil təlimatını izləyin. Paket adı göstərilməyən əlavə model və limitlər vəd edilmir.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 Ayliq</strong> — 37,40 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "youtube_sexsi": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Mövcud YouTube abunəliyini yeniləmək üçün kataloq qeydidir; yeni hesab məhsulu deyil.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 ayliq</strong> — 5,99 ₼.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Email / Gmail, Gmail şifrəsi.</p>",
    "rulesHtml": "<h3>YouTube Premium yenilənməsi — istifadə addımları</h3><ol><li>Əvvəlki abunəliyin hansı Google hesabına aid olduğunu və yenilənmə müddətini operatorla dəqiqləşdirin.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 ayliq</strong> — 5,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "adobecc": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Yaradıcı proqramlarla işləmək üçün Adobe Creative Cloud paket təklifidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>4 aylıq</strong> — 22,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Adobe Creative Cloud — istifadə addımları</h3><ol><li>Paketə daxil olan tətbiqləri və hesabın giriş formasını dəqiqləşdirin; təsdiqlənməyən əlavə proqram və yaddaş həcmi daxil sayılmır.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>4 aylıq</strong> — 22,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "hbomax": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>HBO Max film və serial izləmək üçün hesab təklifidir. Sifariş üçün mövcud müddəti, qiyməti və paket şərtlərini birlikdə yoxlayın.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 ay</strong> — 3,99 ₼; 28 gün zəmanət.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Otaq adı, 4 rəqəmli otaq kodu.</p>",
    "rulesHtml": "<h3>HBO Max — istifadə addımları</h3><ol><li>Təqdim edilən hesabla HBO Max-a daxil olun və sizə ayrılan otaq/profili seçin.</li><li>Sifariş forması otaq adı və dördrəqəmli kod istəyirsə düzgün daxil edin. İstifadə zamanı təhvil qaydalarındakı cihaz məhdudiyyətini yoxlayın.</li><li>Tətbiqin cihazınızda və regionunuzda açılmasını alışdan əvvəl yoxlayın; işləməyən cihaz üçün ümumi giriş vədi verilmir.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 ay</strong> — 3,99 ₼; 28 gün zəmanət.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "tiktok_jeton": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>TikTok hesabı üçün seçilən sayda jeton paketidir; aylıq abunəlik deyil.</p><h3>Paketlərin fərqi</h3><ul><li><strong>500 jeton</strong> — 11,00 ₼.</li><li><strong>1000 jeton</strong> — 21,00 ₼.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: TikTok istifadəçi identifikatoru, Jeton miqdarı.</p>",
    "rulesHtml": "<h3>TikTok Jeton — istifadə addımları</h3><ol><li>TikTok istifadəçi identifikatorunu və jeton sayını təsdiqdən əvvəl tutuşdurun. Hesabınızda yüklənməni yoxlayıb uyğunsuzluğu sifariş nömrəsi ilə bildirin.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>500 jeton</strong> — 11,00 ₼.</li><li><strong>1000 jeton</strong> — 21,00 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "surfshark": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Surfshark VPN internet bağlantısı üçün VPN hesabı təklifidir. Bu məhsul bağlantının məxfiliyi üçün alətdir; tam anonimlik və ya bütün saytlara giriş zəmanəti kimi təqdim edilmir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 ay</strong> — 4,99 ₼; 30 gün zəmanət.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Surfshark VPN — istifadə addımları</h3><ol><li>Uyğun Surfshark tətbiqini açıb təqdim olunan hesabla daxil olun.</li><li>Bağlantını seçdikdən sonra işləməsini yoxlayın. Şəbəkə və üçüncü tərəf məhdudiyyətləri səbəbindən bütün xidmətlərə giriş vədi verilmir.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 ay</strong> — 4,99 ₼; 30 gün zəmanət.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "google_ai_ultra": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Google süni intellekt və video yaratma xidmətləri üçün kataloq təklifidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>Stokta yoxdur</strong> — 0,00 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Google AI Ultra + VEO 3 — istifadə addımları</h3><ol><li>Model, video limiti və hesab formatı təsdiqlənmədən satınalma qərarı verməyin. Hazırda müsbət qiymətli paket yoxdur.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>Stokta yoxdur</strong> — 0,00 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "captions": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Video və altyazı hazırlamaq üçün Pro və Max paket seçimləri olan süni intellekt alətidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq PRO</strong> — 11,99 ₼.</li><li><strong>1 aylıq MAX</strong> — 19,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Captions AI — istifadə addımları</h3><ol><li>Pro və Max paket adlarını ayırın. Aktivləşdirmədən sonra aldığınız səviyyənin hesabda göründüyünü yoxlayın; əlavə istifadə limiti ayrıca təsdiqlənməlidir.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq PRO</strong> — 11,99 ₼.</li><li><strong>1 aylıq MAX</strong> — 19,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "grok_supergrok": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Sual-cavab və mətn tapşırıqları üçün Grok süni intellekt xidməti üzrə paket təklifidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 29,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Grok AI — istifadə addımları</h3><ol><li>Giriş formasını və konkret abunəlik səviyyəsini dəqiqləşdirin. Məhsul adı bütün modellərə limitsiz giriş vədi deyil.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 29,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "duolingo": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Dil öyrənmə üçün Duolingo Super abunəlik paketidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 3,99 ₼.</li><li><strong>12 aylıq</strong> — 29,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Duolingo Super — istifadə addımları</h3><ol><li>Aktivləşən Duolingo hesabını və paket müddətini yoxlayın. Öyrənmə irəliləyişinizi saxlayan hesabın seçilməsini operatorla dəqiqləşdirin.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 3,99 ₼.</li><li><strong>12 aylıq</strong> — 29,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "canva": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Canva Premium dizayn və təqdimat hazırlamaq üçün paket təklifidir. Müddət və giriş formatı seçdiyiniz paketə görə fərqlənə bilər.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 2,99 ₼.</li><li><strong>12 aylıq</strong> — 4,99 ₼.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Email / Gmail.</p>",
    "rulesHtml": "<h3>Canva Premium — istifadə addımları</h3><ol><li>Sifarişdə aktiv istifadə etdiyiniz e-poçt/Gmail ünvanını yazın; hazır hesab veriləcəyini fərz etməyin.</li><li>Aktivləşdirmə və ya dəvət təhvil edildikdə həmin ünvanla Canva hesabına daxil olub paket vəziyyətini yoxlayın.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 2,99 ₼.</li><li><strong>12 aylıq</strong> — 4,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "netflix_sexsi": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Mövcud Netflix Şəxsi otağının yenilənməsi üçün köhnə kataloq qeydidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 5,99 ₼.</li><li><strong>2 aylıq</strong> — 11,99 ₼.</li><li><strong>3 aylıq</strong> — 16,50 ₼.</li><li><strong>6 aylıq</strong> — 29,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Netflix Şəxsi yenilənməsi — istifadə addımları</h3><ol><li>Yenilənmə üçün əvvəlki sifariş və otaq məlumatını dəqiqləşdirin. Yeni otaq satışı ilə mövcud otağın yenilənməsini qarışdırmayın.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 5,99 ₼.</li><li><strong>2 aylıq</strong> — 11,99 ₼.</li><li><strong>3 aylıq</strong> — 16,50 ₼.</li><li><strong>6 aylıq</strong> — 29,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "linkedin_career": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Peşəkar profil və iş axtarışı üçün LinkedIn Career paket təklifidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>3 aylıq</strong> — 19,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>LinkedIn Career — istifadə addımları</h3><ol><li>Təqdim ediləcək hesabı və abunəlik səviyyəsini aktivləşdirmədən əvvəl dəqiqləşdirin; iş tapılması və ya müraciət nəticəsi barədə zəmanət verilmir.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>3 aylıq</strong> — 19,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "elevenlabs_creator": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Səs yaratma və səsli kontent üzərində işləmək üçün Creator paket təklifidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 19,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>ElevenLabs Creator — istifadə addımları</h3><ol><li>Səs yaratma limiti və istifadə hüquqlarını konkret paket üzrə yoxlayın. Kontentdən istifadə qaydaları üçün xidmətin öz şərtlərini də oxuyun.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 19,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "semrush_premium": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Sayt və axtarış təhlili üçün Semrush alətlərinə aid paket təklifidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 6,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Semrush Premium — istifadə addımları</h3><ol><li>Giriş formatını, layihə və sorğu limitlərini dəqiqləşdirin. Alətə giriş axtarışda mövqe və ya trafik zəmanəti deyil.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 6,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "adobe_express": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Sosial media vizualları və sadə yaradıcı işlər üçün dizayn alətinə aid paketdir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 9,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Adobe Express — istifadə addımları</h3><ol><li>Aldığınız hesabın Express paketini yoxlayın. Creative Cloud proqramlarının hamısını bu paketə daxil hesab etməyin.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 9,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "notion_plus": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Qeydlər, sənədlər və işlərin təşkili üçün Notion Plus paket təklifidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>3 aylıq</strong> — 14,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Notion Plus — istifadə addımları</h3><ol><li>Dəvət və ya giriş aldıqda düzgün iş sahəsini açın. Komanda hüquqları və əlavə AI imkanları ayrıca təsdiqlənməlidir.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>3 aylıq</strong> — 14,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "picsart_premium": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Foto redaktəsi və vizual kontent hazırlamaq üçün Picsart paket təklifidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 2,89 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Picsart Premium — istifadə addımları</h3><ol><li>Girişdən sonra hesabın paketini yoxlayın. Əlavə AI kreditləri və cihaz sayı konkret sifarişdə təsdiqlənməlidir.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 2,89 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "blink_starter": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Veb layihələrin ilkin hazırlanması üçün Starter səviyyəli platforma paketidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 16,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Blink Starter — istifadə addımları</h3><ol><li>Hesab formatını, layihə və istifadə limitlərini dəqiqləşdirin. Domen, əlavə kredit və yayımlama xidməti ayrıca göstərilmədikdə daxil sayılmır.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 16,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "lightroom_photo": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Fotoşəkillərin rəng və işıq redaktəsi üçün Lightroom paket təklifidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 6,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Lightroom Photo — istifadə addımları</h3><ol><li>Giriş formasını və uyğun tətbiqi yoxlayın. Bulud yaddaşı və əlavə Adobe proqramlarının daxil olub-olmadığını ayrıca dəqiqləşdirin.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 6,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "gemini_ai_pro": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Google Gemini ilə mətn və süni intellekt tapşırıqları üçün Pro paket təklifidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>1 aylıq</strong> — 8,99 ₼.</li><li><strong>4 aylıq</strong> — 14,99 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>Gemini AI Pro — istifadə addımları</h3><ol><li>Paketə uyğun hesabla daxil olun. Model, region və kredit limitləri konkret sifariş üzrə dəqiqləşdirilməlidir.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>1 aylıq</strong> — 8,99 ₼.</li><li><strong>4 aylıq</strong> — 14,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "google_ai": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Gemini süni intellekt və məhsul adında göstərilən yaddaş təklifinə aid kataloq qeydidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>18 aylıq</strong> — 8,99 ₼.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Email / Gmail.</p>",
    "rulesHtml": "<h3>Gemini AI Pro + 5 TB yaddaş — istifadə addımları</h3><ol><li>Google hesabının giriş formatını, yaddaşın tətbiqini və AI paketini dəqiqləşdirin. Bu qeyd başqa Google AI məhsulları ilə eyniləşdirilmir.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>18 aylıq</strong> — 8,99 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "epinby_3436": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>PUBG Mobile məhsuluna birləşdirilmiş əvvəlki 60 UC kataloq qeydidir.</p><h3>Paketlərin fərqi</h3><ul><li><strong>60 UC</strong> — 1,65 ₼.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Player ID.</p>",
    "rulesHtml": "<h3>PUBG Mobile 60 UC — arxiv paket — istifadə addımları</h3><ol><li>Aktual paket üçün PUBG Mobile məhsul səhifəsinə baxın. Bu arxiv qeydindən ayrıca alış nəzərdə tutulmur.</li><li>Hesabın giriş formatını və paketə daxil olanları dəqiqləşdirmədən başqa məhsulun təlimatını tətbiq etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>60 UC</strong> — 1,65 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "pubg_mobile": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>PUBG Mobile UC paketlərini eyni məhsul səhifəsində müqayisə edin. 60 UC, 325 UC və digər seçimlərin qiyməti ayrıca göstərilir; sifariş seçdiyiniz paketə bağlanır.</p><h3>Paketlərin fərqi</h3><ul><li><strong>60 UC</strong> — 1,65 ₼.</li><li><strong>325 UC</strong> — 7,99 ₼.</li><li><strong>660 UC</strong> — 15,54 ₼.</li><li><strong>1800 UC</strong> — 39,87 ₼.</li><li><strong>3850 UC</strong> — 78,70 ₼.</li><li><strong>8100 UC</strong> — 148,90 ₼.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Player ID.</p>",
    "rulesHtml": "<h3>PUBG Mobile UC — istifadə addımları</h3><ol><li>Oyundakı Player ID-ni mətn kimi köçürün; başlanğıc sıfırlarını silməyin.</li><li>Seçilmiş UC paketini və tələb edilərsə region/serveri yoxlayın. Hesab adı qaytarılarsa öz hesabınızla tutuşdurun.</li><li>Yükləmə nəticəsi təsdiqləndikdən sonra oyunda UC balansını yoxlayın. Oyun şifrəsini Player ID xanasına yazmayın.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>60 UC</strong> — 1,65 ₼.</li><li><strong>325 UC</strong> — 7,99 ₼.</li><li><strong>660 UC</strong> — 15,54 ₼.</li><li><strong>1800 UC</strong> — 39,87 ₼.</li><li><strong>3850 UC</strong> — 78,70 ₼.</li><li><strong>8100 UC</strong> — 148,90 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "free_fire": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Free Fire almaz paketləri bu səhifədə bir yerdə təqdim olunur. Paket adındakı almaz sayını, varsa bonusu və regionu qiymətlə birlikdə yoxlayın.</p><h3>Paketlərin fərqi</h3><ul><li><strong>Free Fire 110 Almaz (7/24)</strong> — 1,58 ₼.</li><li><strong>Free Fire 341 Almaz (7/24)</strong> — 4,69 ₼.</li><li><strong>Free Fire 572 Almaz (7/24)</strong> — 7,54 ₼.</li><li><strong>Free Fire 1166 Almaz (7/24)</strong> — 13,83 ₼.</li><li><strong>Free Fire 2398 Almaz (7/24)</strong> — 27,58 ₼.</li><li><strong>Free Fire 6160 Almaz (7/24)</strong> — 69,56 ₼.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Player ID.</p>",
    "rulesHtml": "<h3>Free Fire almaz — istifadə addımları</h3><ol><li>Free Fire Player ID-ni öz oyun profilinizdən köçürün və almaz paketini seçin.</li><li>Paketin regionu və hesab uyğunluğu vacibdir. Oyunçu adı yoxlanılıbsa adı təsdiqdən əvvəl tutuşdurun.</li><li>İcra tamamlandıqdan sonra oyun balansını yoxlayın; yanlış nəticədə sifariş nömrəsi ilə dəstəyə yazın.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>Free Fire 110 Almaz (7/24)</strong> — 1,58 ₼.</li><li><strong>Free Fire 341 Almaz (7/24)</strong> — 4,69 ₼.</li><li><strong>Free Fire 572 Almaz (7/24)</strong> — 7,54 ₼.</li><li><strong>Free Fire 1166 Almaz (7/24)</strong> — 13,83 ₼.</li><li><strong>Free Fire 2398 Almaz (7/24)</strong> — 27,58 ₼.</li><li><strong>Free Fire 6160 Almaz (7/24)</strong> — 69,56 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "telegram_premium": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>Telegram Premium üçün üç və altı aylıq seçimləri müqayisə edin. Premium abunəliklə Telegram Stars eyni məhsul deyil; təsdiqdə göstərilən xidmət növünü yoxlayın.</p><h3>Paketlərin fərqi</h3><ul><li><strong>Telegram Premium 3 Aylıq</strong> — 23,75 ₼; 87 gün zəmanət.</li><li><strong>Telegram Premium 6 Aylıq</strong> — 31,99 ₼; 175 gün zəmanət.</li></ul><p>Sifariş üçün tələb olunan məlumatlar: Telegram istifadəçi adı.</p>",
    "rulesHtml": "<h3>Telegram Premium — istifadə addımları</h3><ol><li>Diqqət: paket adları Premium göstərsə də təchizatçı bağlantısı hazırda TELEGRAM_STARS kimi saxlanılıb.</li><li>Premium abunəlik və Stars fərqli məhsullardır. Xidmət uyğunluğu operator tərəfindən düzəldilmədən bu səhifədən Premium alışı etməyin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>Telegram Premium 3 Aylıq</strong> — 23,75 ₼; 87 gün zəmanət.</li><li><strong>Telegram Premium 6 Aylıq</strong> — 31,99 ₼; 175 gün zəmanət.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
  },
  "mirpanel_token": {
    "aboutHtml": "<h3>Nə əldə edirsiniz?</h3><p>MirPanel daxilində rəqəmsal hədiyyələr üçün istifadə olunan token paketidir. Başqa platformanın oyun valyutası və ya premium hesab abunəliyi deyil.</p><h3>Paketlərin fərqi</h3><ul><li><strong>50 token</strong> — 1,00 ₼.</li></ul><p>Bu məhsulun açıq sifariş ayarında əlavə müştəri məlumatı göstərilmir. Təhvil üçün lazım olan məlumat varsa seçilmiş paketin formasında dəqiqləşdirilir.</p>",
    "rulesHtml": "<h3>MirPanel Token — istifadə addımları</h3><ol><li>Seçdiyiniz token sayını və yekun məbləği təsdiq edin. Tokenlər başqa platformanın hesab məlumatı deyil.</li><li>Ödənişdən sonra hesabınızdakı token vəziyyətini yoxlayın. Uyğunsuzluqda əməliyyatı təkrar ödəmədən sifariş nömrəsi ilə dəstəyə müraciət edin.</li></ol><h3>Müddət və zəmanət</h3><ul><li><strong>50 token</strong> — 1,00 ₼.</li></ul><p>Paketdə göstərilməyən cihaz sayı, region və əlavə zəmanət vəd edilmir. Müddət və zəmanət ayrı anlayışlardır; seçilmiş paketin məlumatını əsas götürün.</p><h3>Təhvil və kömək</h3><p>Sifarişin statusunu və təqdim edilən məlumatları <a href=\"/profil?tab=sifarislerim\">Sifarişlərim</a> bölməsində açın. Məhsula aid bələdçi varsa həmin sifarişdə “Təlimat” düyməsindən baxın. Problem olduqda sifariş nömrəsini göstərərək <a href=\"/elaqe\">MirPanel dəstəyinə yazın</a>; şifrə və təsdiq kodunu açıq paylaşmayın.</p>"
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
window.mirpanelResetProductSelection=()=>{currentProduct=null;currentPlanIdx=0;};

function publicProductTitle(value) {
  return String(value || "").replace(/\s+almaq\s*$/i, "").trim();
}
function productImageAlt(product) {
  return window.MirpanelCatalogCard?.imageAlt?.(product, publicProductTitle(product.seoH1 || product.title)) || String(product.imageAlt || '').trim() || publicProductTitle(product.seoH1 || product.title) || 'Məhsul';
}

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
  if(mainImg) { mainImg.alt = productImageAlt(p); mainImg.src = p.image; }
  
  const titleEl = document.getElementById("pp-main-title");
  if(titleEl) titleEl.textContent = publicProductTitle(p.seoH1 || (p.variant ? `${p.title} - (${p.variant})` : p.title));

  renderProductPlans(p);
  // Canonical detail HTML already contains active, correctly resolved similar images.
  // Do not briefly request inactive legacy assets before product-page.js restores it.
  if (!document.body.classList.contains('product-page-document')) renderSimilarProducts(p);
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
  if(container.hasAttribute('data-server-plans')) {
    const rows=[...container.querySelectorAll('.pp-plan-label')];
    currentPlanIdx=Math.max(0,rows.findIndex(row=>row.classList.contains('active')));
    rows.forEach((row,idx)=>{row.onclick=()=>{
      currentPlanIdx=idx;
      rows.forEach(item=>item.classList.toggle('active',item===row));
    };});
    return;
  }
  container.innerHTML = "";

  const plans = p.plans || [];
  if(!plans.length) {
    container.innerHTML = `<div style="color:red;">Mövcud plan yoxdur</div>`;
    return;
  }

  plans.forEach((pl, idx) => {
    const price = Number(pl.price) || 0;
    const regularPrice = Number(pl.regularPrice) || 0;
    let discount = regularPrice > price && price > 0
      ? Math.round((regularPrice - price) / regularPrice * 100)
      : 0;

    const isStockOut = price <= 0;
    if(isStockOut) discount = 0;

    const duration = pl.durationDays ? `${pl.durationDays} gün` : `${pl.durationMonths ?? pl.months} ${UI.month}`;
    const labelName = pl.label || duration;

    const div = document.createElement("div");
    div.className = `pp-plan-label ${idx === currentPlanIdx ? 'active' : ''}`;
    const hasNamedMonthlyOffer = plans.some(plan => !plan.durationDays && Number(plan.months) === 1 && /endirim/i.test(plan.label || '') && Number(plan.regularPrice) > Number(plan.price));
    div.dataset.priceEmphasis = !pl.durationDays && Number(pl.months) === 1 && discount > 0 && (!hasNamedMonthlyOffer || /endirim/i.test(pl.label || '')) ? 'discount-month' : 'standard';
    div.innerHTML = `
      <div class="pp-plan-left">
         <div class="pp-radio-circle"></div>
         <div class="pp-plan-name">${labelName}${(pl.durationDays || pl.durationMonths) && labelName !== duration ? ` · ${duration}` : ""}</div>
      </div>
      <div class="pp-plan-right">
        ${discount > 0 ? `<div class="pp-plan-price-meta"><div class="pp-old-price">${regularPrice.toFixed(2)} ₼</div><div class="pp-plan-disc-badge">-${discount}%</div></div>` : ''}
         <div class="pp-new-price"${isStockOut ? ' hidden' : ''}>${isStockOut ? '' : price.toFixed(2) + ' ₼'}</div>
      </div>
    `;

    div.onclick = () => {
      currentPlanIdx = idx;
      container.querySelectorAll('.pp-plan-label').forEach(row => row.classList.toggle('active', row === div));
    };
    if(!p.epinbyGroup&&pl.supplier?.provider==='epinby'&&pl.image){
      const image=document.createElement('img');
      image.className='epinby-package-thumb';image.alt='';image.loading='lazy';image.width=52;image.height=38;
      const url=new URL(pl.image,location.origin+'/');
      if(['http:','https:'].includes(url.protocol)){image.src=url.href;div.querySelector('.pp-radio-circle').after(image);}
    }

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
        <img src="${sp.image}" class="pp-sim-img" alt="${esc(productImageAlt(sp))}">
        <div class="pp-sim-info">
           <div class="pp-sim-title">${publicProductTitle(sp.title)}</div>
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
          <h3 style="color:#ffd400; margin-top:0;">Mirpanel: ${publicProductTitle(p.title)} Qaydaları</h3>
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
         Siz <b>${publicProductTitle(p.title)}</b> (${plan.label || plan.months + ' aylıq'}) sifariş edirsiniz.
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
  // Product checkout is rendered by the shared payment flow. Keep this
  // legacy hook inert so an old listener can never reintroduce credentials.
  return undefined;
}

function sendWA(p, plan, extra) {
  const tPlan = plan.label ? plan.label : `${plan.months} aylıq`;
  const orderProductTitle = publicProductTitle(p.title);
  const orderId = Math.floor(10000 + Math.random() * 90000);
  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw8eRhDxBhq5Kf68eVQBAnqf9llgo1bQWKgdwpBa0utRgVwn6rKd9YUCP6e70iPbHTMOg/exec";

  const formData = new FormData();
  formData.append('orderId', orderId); 
  formData.append('product', orderProductTitle);
  formData.append('plan', tPlan);
  formData.append('price', plan.price + ' ' + p.currency);
  formData.append('extra', extra); 

  fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: formData }).catch(err => { console.error("Sheet Error:", err); });

  const waMessage = `Salam, sifariş etmək istəyirəm.\n\nSifariş №: ${orderId}\nMəhsul: ${orderProductTitle}\nMüddət: ${tPlan}\nQiymət: ${plan.price} ${p.currency}\n\n${extra}`;
  window.open(PHONE_WA + "?text=" + encodeURIComponent(waMessage), "_blank");
}

function closeModal() {
  const mod = document.getElementById("modal");
  if(mod) mod.classList.remove("show");
  unlockBodyScroll();
}

function getMinPrice(p) { return Math.min(...(p.plans||[]).filter(x => x.price > 0).map(x => x.price)); }
function formatPrice(n) { return Number(n).toFixed(2); }
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================
   UI YÜKLƏNMƏ (SLAYDER, GRID VƏ YENİ SIRALAMA MƏNTİQİ)
   ========================= */
let disposeSlider;

function initSlider() {
  disposeSlider?.();
  const slider = document.getElementById('heroSlider');
  if (!slider) return;
  const slides = [...slider.querySelectorAll('.slide')];
  slider.querySelector('.hero-controls')?.remove();
  if (!slides.length) return;

  const lifecycle = new AbortController();
  const {signal} = lifecycle;
  let current = Math.max(0, slides.findIndex(slide => slide.classList.contains('active')));
  let requested = current;
  let animation, timer, generation = 0;
  slider.setAttribute('role', 'region');
  slider.setAttribute('aria-label', 'Məhsul bannerləri');
  slider.setAttribute('aria-roledescription', 'carousel');
  slider.ondragstart = event => event.preventDefault();

  const controls = document.createElement('div');
  controls.className = 'hero-controls';
  controls.innerHTML = '<button type="button" class="hero-arrow hero-prev" aria-label="Əvvəlki banner">‹</button><button type="button" class="hero-arrow hero-next" aria-label="Növbəti banner">›</button><span class="hero-count"></span><span class="hero-progress" aria-hidden="true"></span>';
  slider.append(controls);
  const [prev, next, counter, progress] = controls.children;
  prev.hidden = next.hidden = progress.hidden = slides.length < 2;

  function prepare(index) {
    const slide = slides[index];
    for (const source of slide.querySelectorAll('source[data-srcset]')) {
      source.srcset = source.dataset.srcset;
      delete source.dataset.srcset;
    }
    const image = slide.querySelector('img');
    if (image?.dataset.src) {
      image.loading = 'eager';
      image.src = image.dataset.src;
      delete image.dataset.src;
    }
    return image;
  }
  const wrap = index => (index + slides.length) % slides.length;
  function paint() {
    slides.forEach((slide, index) => {
      const active = index === current;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', String(!active));
      if (slide.matches('a')) slide.tabIndex = active ? 0 : -1;
    });
    counter.textContent = (current + 1) + '/' + slides.length;
    if (slides.length > 1) {
      prepare(wrap(current + 1));
      prepare(wrap(current - 1));
    }
  }
  function stop() {
    clearTimeout(timer);
    animation?.cancel();
  }
  function start() {
    stop();
    if (signal.aborted || document.hidden || slides.length < 2) return;
    animation = progress.animate([{transform:'scaleX(0)'}, {transform:'scaleX(1)'}], {duration:5000,fill:'forwards'});
    timer = setTimeout(() => move(1), 5000);
  }
  async function move(direction) {
    const id = ++generation;
    const index = requested = wrap(requested + direction);
    clearTimeout(timer);
    const image = prepare(index);
    if (image && !image.complete) await image.decode().catch(() => {});
    if (signal.aborted || generation !== id) return;
    current = index;
    paint();
    start();
  }
  prev.addEventListener('click', () => move(-1), {signal});
  next.addEventListener('click', () => move(1), {signal});
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start(), {signal});
  disposeSlider = () => { lifecycle.abort(); stop(); };
  paint();
  start();
}

window.initSlider = initSlider;
window.addEventListener('mirpanel:route-leave', () => disposeSlider?.());
window.addEventListener('mirpanel:route-ready',e=>{if(e.detail.path==='/')initSlider();});

const $ = (id) => document.getElementById(id);

function escapeSectionHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function whatsappHrefFromSectionNumber(number) {
  const digits = String(number || "").replace(/\D/g, "");
  if (!digits) return PHONE_WA;
  const normalized = digits.startsWith("0") ? `994${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

function renderSiteSectionsFromAdmin() {
  const container = document.getElementById("siteInfoSections") || document.querySelector(".infoSections");
  if (!container) return;

  const sections = SITE_SECTIONS || {};
  const visible = Object.entries(sections)
    .filter(([, section]) => section?.enabled !== false)
    .sort((a, b) => (Number(a[1]?.order) || 0) - (Number(b[1]?.order) || 0));

  container.innerHTML = visible.map(([key, section]) => {
    const title = escapeSectionHtml(section.title || "");
    const text = escapeSectionHtml(section.text || "").replace(/\n/g, "<br>");

    if (key === "sertler") {
      const items = Array.isArray(section.items) ? section.items : [];
      const list = items.map((item) => `<li>${escapeSectionHtml(item)}</li>`).join("");
      return `<article class="siteInfoCard" id="sertler"><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${list ? `<ul>${list}</ul>` : ""}</article>`;
    }

    if (key === "elaqe") {
      const number = escapeSectionHtml(section.whatsappNumber || "");
      const buttonText = escapeSectionHtml(section.buttonText || "WhatsApp ilЙ™ yaz");
      const href = whatsappHrefFromSectionNumber(section.whatsappNumber);
      return `<article class="siteInfoCard siteInfoContact" id="elaqe"><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}<p>WhatsApp: <strong>${number}</strong></p><a class="siteInfoWaBtn" href="${href}" target="_blank" rel="noopener noreferrer">${buttonText}</a></article>`;
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
    if(el.id==='pp-order-btn') return;
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

  window.mirpanelRestoreCatalog?.();
}

const homeCatalogState = { filter: "all", sort: "default", query: "" };
try { Object.assign(homeCatalogState, JSON.parse(sessionStorage.getItem("mirpanel.home.catalog"))); } catch {}

function saveHomeCatalogState() {
  try { sessionStorage.setItem("mirpanel.home.catalog", JSON.stringify(homeCatalogState)); } catch {}
}

function matchesHomeFilter(product) {
  if(homeCatalogState.filter==='instant')return window.MirpanelInventory?.instantPlans(product).length>0;
  return homeCatalogState.filter==='all'||product.category===homeCatalogState.filter;
}

function productSlugForHome(product) {
  return String(product?.seoSlug || product?.id || "").replace(/-almaq$/, "").replace(/(^|-)hesab0(?=-|$)/g, "$1hesab").replace(/^\/+|\/+$/g, "");
}

function renderHomeDiscovery() {
  const activeProducts = DATA.products.filter((product) => product.active !== false);
  const quickLinks = document.getElementById("homeQuickLinks");
  if (quickLinks && window.MirpanelHomeShortcuts) {
    const preferred = ["youtube", "netflix", "capcut", "spotify"];
    const chosen = [...preferred.map((id) => activeProducts.find((product) => product.id === id)).filter(Boolean), ...activeProducts.filter((product) => !preferred.includes(product.id))].slice(0, 6);
    const buildLink = (product, duplicate = false) => {
      const presentation = window.MirpanelHomeShortcuts.presentation(product);
      const link = document.createElement("a");
      link.className = "home-quick-link";
      link.dataset.quickBrand = presentation.brand;
      link.dataset.quickProduct = product.id;
      link.href = `/mehsul/${productSlugForHome(product)}`;
      // The visible product name is also the accessible name; do not announce the logo twice.
      link.tabIndex = duplicate ? -1 : 0;
      if (duplicate) link.setAttribute('aria-hidden','true');
      const logo = document.createElement("span"); logo.className = "home-quick-logo"; logo.setAttribute("aria-hidden", "true");
      const image = document.createElement("img"); image.src = presentation.logo; image.alt = ""; image.setAttribute('role','presentation'); image.loading = "lazy"; image.addEventListener("error", () => logo.remove(), { once: true });
      const label = document.createElement("span"); label.className = "home-quick-label"; label.textContent = presentation.title;
      logo.appendChild(image); link.append(logo, label); return link;
    };
    const track = document.createElement("div");
    track.className = "home-quick-track";
    const primary = document.createElement("div");
    primary.className = "home-quick-group";
    primary.append(...chosen.map((product) => buildLink(product)));
    const duplicate = document.createElement("div");
    duplicate.className = "home-quick-group";
    duplicate.setAttribute("aria-hidden", "true");
    duplicate.append(...chosen.map((product) => buildLink(product, true)));
    track.append(primary, duplicate);
    quickLinks.replaceChildren(track);
    quickLinks.hidden = !chosen.length;
    quickLinks.onpointerdown = () => {
      quickLinks.classList.add("is-interacting");
      clearTimeout(quickLinks._resumeTimer);
    };
    const resume = () => {
      clearTimeout(quickLinks._resumeTimer);
      quickLinks._resumeTimer = setTimeout(() => quickLinks.classList.remove("is-interacting"), 3200);
    };
    quickLinks.onpointerup = resume;
    quickLinks.onpointercancel = resume;
  }
}

function buildTabs() {
  const tabs = document.getElementById("tabs");
  if (!tabs) return;
  const activeProducts = DATA.products.filter((product) => product.active !== false);
  const params=new URLSearchParams(location.search);
  if(params.get('delivery')==='instant')homeCatalogState.filter='instant';
  else if(params.has('category'))homeCatalogState.filter=params.get('category');
  const categories=[...DATA.categories].filter(c=>c.active!==false&&activeProducts.some(p=>p.category===c.key)).sort((a,b)=>Number(a.order)-Number(b.order));
  tabs.innerHTML = `
    <div class="home-filter-tabs" role="tablist" aria-label="Məhsul filtrləri">
      <button type="button" class="home-filter-tab" data-home-filter="all" role="tab">Hamısı</button>
      <button type="button" class="home-filter-tab" data-home-filter="instant" role="tab">⚡ Anında təhvil</button>
      ${categories.map(c=>`<button type="button" class="home-filter-tab" data-home-filter="${escapeSectionHtml(c.key)}" role="tab">${escapeSectionHtml(c.key==='games'?'Oyunlar':c.name)}</button>`).join('')}
    </div>
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
  const sort = document.getElementById("sortSelect");
  sort.value = homeCatalogState.sort;
  if (!sort.value) sort.value = "default";
  sort.addEventListener("change", () => {
    homeCatalogState.sort = sort.value;
    saveHomeCatalogState();
    renderGrid();
  });
  const filters = [...tabs.querySelectorAll("[data-home-filter]")];
  if (!filters.some(button => button.dataset.homeFilter === homeCatalogState.filter)) homeCatalogState.filter = "all";
  function paintFilters() {
    for (const button of filters) {
      const selected = button.dataset.homeFilter === homeCatalogState.filter;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    }
  }
  paintFilters();
  tabs.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
  for (const button of filters) button.addEventListener("click", () => {
    homeCatalogState.filter = button.dataset.homeFilter;
    saveHomeCatalogState();
    paintFilters();
    const url=new URL(location.href);url.searchParams.delete('delivery');url.searchParams.delete('category');
    if(homeCatalogState.filter==='instant')url.searchParams.set('delivery','instant');
    else if(homeCatalogState.filter!=='all')url.searchParams.set('category',homeCatalogState.filter);
    history.replaceState(history.state,'',url);
    button.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    renderGrid();
  });
}

function normalizeSearch(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("az")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ə", "e")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g");
}

function searchInputs() {
  const selectors = [
    "#q",
    "#sideMenuInput",
    ".side-search",
    ".headActions input[type='text']",
    "header input[type='text']",
    "input[placeholder*='Məhsul']",
    "input[placeholder*='məhsul']"
  ];

  return [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
    .filter((input) => input && input.tagName === "INPUT");
}

function syncSearchInputs(value, source) {
  searchInputs().forEach((input) => {
    if (input !== source && input.value !== value) input.value = value;
  });
}

function productMatches(product, query) {
  if (!query) return true;
  const blob = [
    product.title,
    product.variant,
    product.badge,
    product.category,
    product.desc,
    product.id,
    product.note
  ].join(" ");
  return normalizeSearch(blob).includes(query);
}

function sortedProducts(products) {
  const sortVal = document.getElementById("sortSelect")?.value || "default";
  const getPrice = (product) => {
    if(homeCatalogState.filter==='instant'){const i=window.MirpanelInventory?.instantPlans(product)[0];return Number(product.plans[i]?.price)||999999;}
    if (product.id === "tiktok_jeton") return 10;
    const price = getMinPrice(product);
    return price === Infinity || price === 0 ? 999999 : price;
  };

  return [...products].sort((a, b) => {
    const priceA = getPrice(a);
    const priceB = getPrice(b);

    if (sortVal === "price-asc") return priceA - priceB;
    if (sortVal === "price-desc") {
      if (priceA === 999999) return 1;
      if (priceB === 999999) return -1;
      return priceB - priceA;
    }
    if (sortVal === "az") return String(a.title || "").localeCompare(String(b.title || ""), "az");
    if (sortVal === "za") return String(b.title || "").localeCompare(String(a.title || ""), "az");
    return (Number(a.order ?? 9999) - Number(b.order ?? 9999));
  });
}

function renderGrid() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  const query = normalizeSearch(homeCatalogState.query);
  const instant=homeCatalogState.filter==='instant';
  window.mirpanelHomeInstant=instant;
  if(instant&&!window.MirpanelInventory?.instantValid()){
    grid.innerHTML='<p class="home-catalog-status" role="status">'+(window.MirpanelInventory?.instantFailed()?'Stok yoxlanıla bilmir. <button type="button" onclick="MirpanelInventory.refresh()">Yenidən cəhd et</button>':'Hazır hesablar yoxlanılır…')+'</p>';
    grid.setAttribute('aria-busy',String(!window.MirpanelInventory?.instantFailed()));return;
  }
  const list = sortedProducts(DATA.products.filter(product =>
    product.active !== false && matchesHomeFilter(product) && productMatches(product, query)
  ));
  const title=instant?'Anında təhvil':DATA.categories.find(c=>c.key===homeCatalogState.filter)?.name;
  grid.innerHTML = list.length ? (window.MirpanelHomeSections ? window.MirpanelHomeSections.render(list, DATA.categories, cardHTML, {query, filtered:homeCatalogState.filter!=="all",title}) : list.map((p, idx) => cardHTML(p, idx)).join("")) :
    '';
  if(!list.length){if(instant)grid.innerHTML='<p class="home-catalog-status">Hazırda anında təhvil verilən hesab yoxdur<br><a href="/mehsul">Bütün məhsullara bax</a></p>';else window.MirpanelCatalogSearch?.empty(grid);}
  grid.removeAttribute("aria-busy");
  window.dispatchEvent(new Event("mirpanel:home-catalog-rendered"));
}

function updateHomeCatalogSearch(event) {
  const input = event.target;
  if (location.pathname !== "/" || !searchInputs().includes(input)) return;
  homeCatalogState.query = input.value;
  syncSearchInputs(input.value, input);
  saveHomeCatalogState();
  renderGrid();
}
document.addEventListener("input", updateHomeCatalogSearch);
document.addEventListener("search", updateHomeCatalogSearch, true);

window.mirpanelRestoreCatalog=()=>{
 if(location.pathname!=='/')return;
 const grid=document.getElementById('grid');
 if(!grid)return;
 if(!grid.dataset.catalogMounted){
  homeCatalogState.query=new URLSearchParams(location.search).get('search')??homeCatalogState.query;
  syncSearchInputs(homeCatalogState.query);
  buildTabs();
  renderHomeDiscovery();
  grid.dataset.catalogMounted='1';
 }
 renderGrid();
};
function cardHTML(p, idx) {
  const min = getMinPrice(p);
  const showPrice = p.id === "tiktok_jeton" ? `10.00 ${p.currency}` : (min != null && min !== Infinity && min !== 0 ? `${formatPrice(min)} ${p.currency}` : "—");
  const productSlug = String(p.seoSlug || p.id || "")
    .replace(/-almaq$/, "")
    .replace(/(^|-)hesab0(?=-|$)/g, "$1hesab")
    .replace(/^\/+|\/+$/g, "");
  if (window.MirpanelCatalogCard && document.body.classList.contains("home-page")) {
    return window.MirpanelCatalogCard.render(p, idx, "/mehsul/" + productSlug, publicProductTitle(p.title), p.id === "tiktok_jeton" ? 10 : min, showPrice, "", true);
  }
  return `
    <a class="card" href="/mehsul/${productSlug}" data-product-id="${p.id}" style="animation-delay:${Math.min(idx * 0.03, 0.25)}s">
      <div class="imgWrap"><img class="img" src="${p.image}" alt="${esc(productImageAlt(p))}"><div class="cornerPrice">${showPrice}</div></div>
      <div class="pad">
        <div class="topline"><h3 class="title">${esc(publicProductTitle(p.title))}</h3><div class="badge">${esc(p.badge)}</div></div>
        <div class="meta">${esc(p.desc)}</div>
        <div class="priceRow"><span class="btn primary">${UI.orderBtn}</span></div>
      </div>
    </a>
  `;
}

let savedScrollY = 0;
function lockBodyScroll() { savedScrollY = window.scrollY || 0; document.documentElement.classList.add("modalOpen"); document.body.classList.add("modalOpen"); document.body.style.position = "fixed"; document.body.style.top = `-${savedScrollY}px`; document.body.style.width = "100%"; }
function unlockBodyScroll() { document.body.style.position = ""; document.body.style.top = ""; document.body.style.width = ""; document.documentElement.classList.remove("modalOpen"); document.body.classList.remove("modalOpen"); window.scrollTo(0, savedScrollY); }

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
  let lastFocusedElement = null;

  function focusableElements() {
    if (!sideMenu) return [];
    return [...sideMenu.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')]
      .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
  }

  function openMenu() {
    if(!sideMenu) return;
    lastFocusedElement = document.activeElement;
    sideMenu.classList.add("active");
    if(sideMenuOverlay) sideMenuOverlay.classList.add("active");
    sideMenu.setAttribute("aria-hidden", "false");
    sideMenuOverlay?.setAttribute("aria-hidden", "false");
    menuOpenBtn?.setAttribute("aria-expanded", "true");
    document.body.classList.add("side-menu-open");
    (sideMenuClose || focusableElements()[0])?.focus();
  }

  function closeMenu({ restoreFocus = true } = {}) {
    if(!sideMenu) return;
    sideMenu.classList.remove("active");
    if(sideMenuOverlay) sideMenuOverlay.classList.remove("active");
    sideMenu.setAttribute("aria-hidden", "true");
    sideMenuOverlay?.setAttribute("aria-hidden", "true");
    menuOpenBtn?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("side-menu-open");
    if (restoreFocus && lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
  }

  if(menuOpenBtn) menuOpenBtn.addEventListener("click", openMenu);
  if(sideMenuClose) sideMenuClose.addEventListener("click", closeMenu);
  if(sideMenuOverlay) sideMenuOverlay.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (event) => {
    if (!sideMenu?.classList.contains("active")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  const smLinks = document.querySelectorAll(".sm-link");
  smLinks.forEach(link => {
    link.addEventListener("click", () => closeMenu({ restoreFocus: false }));
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
    linkProducts.addEventListener("click", closeMenu);
  }
}

function boot() {
  setupUI();
  initSlider();
  initSidebar();
  document.getElementById("closeModal")?.addEventListener("click", closeModal);
  document.getElementById("modal")?.addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
}

boot();
window.dispatchEvent(new Event("mirpanel:catalog-runtime-ready"));
