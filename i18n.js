(function () {
  const STORAGE_KEY = "mirpanel_language";
  const LANGS = ["az", "en", "ru"];
  const STYLE_ID = "mirpanelI18nStyles";

  const I18N = {
    az: {
      navHome: "Ana Səhifə",
      products: "Məhsullar",
      about: "Haqqımızda",
      terms: "Şərtlər",
      contact: "Əlaqə",
      searchHeader: "Məhsul və ya xidmət axtar...",
      searchShort: "Məhsul axtar...",
      searchShortExample: "Məhsul axtar... (məs: Netflix, Zoom)",
      searchPromoTitle: "AXTARIŞ ET, <span class=\"highlight\">İSTƏDİYİNİ TAP!</span>",
      searchPromoDesc: "Bütün məlumatlar saytda mövcuddur. Axtarış bölməsindən istədiyiniz məhsulu rahatlıqla tapa bilərsiniz.",
      bannerText: "Diqqət! Saytımızda ödəniş sistemi yoxdur. Sifariş etdiyiniz zaman sayt sizi avtomatik WhatsApp-a yönləndirir.",
      sortProducts: "Məhsulları Sırala",
      bestSelling: "Ən Çox Satılanlar",
      priceAsc: "Ucuzdan bahaya",
      priceDesc: "Bahadan ucuza",
      nameAz: "Ada görə A-Z",
      nameZa: "Ada görə Z-A",
      order: "Sifariş et",
      back: "⟵ Geri Qayıt",
      chooseDuration: "Müddət seçin",
      choosePlan: "Plan seçin",
      productAbout: "Məhsul haqqında",
      rules: "İstifadə Qaydaları",
      similar: "Oxşar Məhsullar",
      stockCard: "Stok",
      stockIn: "Stokda var",
      stockOut: "Stokda yoxdur",
      stockLow: "Az qalıb",
      unit: "ədəd",
      available: "Mövcuddur",
      noResults: "Nəticə tapılmadı",
      searching: "Axtarılır...",
      orderInfo: "Sifariş məlumatları",
      confirmTitle: "Sifarişi təsdiqləyin",
      confirm: "Təsdiqləyirəm",
      cancel: "Ləğv et",
      continue: "Davam et",
      close: "Bağla",
      closeWithX: "Bağla ✕",
      email: "Email / E-poçt",
      emailShort: "E-poçt",
      password: "Şifrə / Parol",
      passwordShort: "Parol",
      name: "Ad",
      roomCode: "Otaq kodu",
      fourDigits: "Sadəcə 4 rəqəm yazmalısınız",
      whatsappAuto: "Sifariş etdikdə WhatsApp avtomatik açılacaq.",
      footerRights: "©️ 2026 Mirpanel • Bütün hüquqlar qorunur",
      footerWhatsApp: "WhatsApp: 051 524 35 45",
      gameButton: "🎮 Əylən & Oyna",
      productFallback: "Məhsul",
      spotifyLoginTitle: "Parol ilə daxil olun",
      spotifyOrder: "Sifariş et"
    },
    en: {
      navHome: "Home",
      products: "Products",
      about: "About",
      terms: "Terms",
      contact: "Contact",
      searchHeader: "Search product or service...",
      searchShort: "Search product...",
      searchShortExample: "Search product... (e.g. Netflix, Zoom)",
      searchPromoTitle: "SEARCH, <span class=\"highlight\">FIND WHAT YOU WANT!</span>",
      searchPromoDesc: "All information is available on the site. Use search to easily find the product you need.",
      bannerText: "Attention! There is no payment system on our site. When you order, the site automatically redirects you to WhatsApp.",
      sortProducts: "Sort Products",
      bestSelling: "Best Sellers",
      priceAsc: "Price: low to high",
      priceDesc: "Price: high to low",
      nameAz: "Name A-Z",
      nameZa: "Name Z-A",
      order: "Order",
      back: "⟵ Back",
      chooseDuration: "Choose duration",
      choosePlan: "Choose plan",
      productAbout: "About product",
      rules: "Usage Rules",
      similar: "Similar Products",
      stockCard: "Stock",
      stockIn: "In stock",
      stockOut: "Out of stock",
      stockLow: "Few left",
      unit: "pcs",
      available: "Available",
      noResults: "No results found",
      searching: "Searching...",
      orderInfo: "Order details",
      confirmTitle: "Confirm order",
      confirm: "I confirm",
      cancel: "Cancel",
      continue: "Continue",
      close: "Close",
      closeWithX: "Close ✕",
      email: "Email",
      emailShort: "Email",
      password: "Password",
      passwordShort: "Password",
      name: "Name",
      roomCode: "Room code",
      fourDigits: "You must enter exactly 4 digits",
      whatsappAuto: "WhatsApp will open automatically when you order.",
      footerRights: "©️ 2026 Mirpanel • All rights reserved",
      footerWhatsApp: "WhatsApp: 051 524 35 45",
      gameButton: "🎮 Play & Enjoy",
      productFallback: "Product",
      spotifyLoginTitle: "Log in with password",
      spotifyOrder: "Order"
    },
    ru: {
      navHome: "Главная",
      products: "Товары",
      about: "О нас",
      terms: "Условия",
      contact: "Контакты",
      searchHeader: "Найти продукт или услугу...",
      searchShort: "Найти продукт...",
      searchShortExample: "Найти продукт... (например: Netflix, Zoom)",
      searchPromoTitle: "ИЩИТЕ, <span class=\"highlight\">НАХОДИТЕ НУЖНОЕ!</span>",
      searchPromoDesc: "Вся информация доступна на сайте. Через поиск вы легко найдете нужный продукт.",
      bannerText: "Внимание! На сайте нет платежной системы. При заказе сайт автоматически перенаправит вас в WhatsApp.",
      sortProducts: "Сортировать товары",
      bestSelling: "Хиты продаж",
      priceAsc: "Цена: по возрастанию",
      priceDesc: "Цена: по убыванию",
      nameAz: "Название A-Z",
      nameZa: "Название Z-A",
      order: "Заказать",
      back: "⟵ Назад",
      chooseDuration: "Выберите срок",
      choosePlan: "Выберите план",
      productAbout: "О товаре",
      rules: "Правила использования",
      similar: "Похожие товары",
      stockCard: "Склад",
      stockIn: "В наличии",
      stockOut: "Нет в наличии",
      stockLow: "Осталось мало",
      unit: "шт.",
      available: "Доступно",
      noResults: "Ничего не найдено",
      searching: "Поиск...",
      orderInfo: "Данные заказа",
      confirmTitle: "Подтвердите заказ",
      confirm: "Подтверждаю",
      cancel: "Отмена",
      continue: "Продолжить",
      close: "Закрыть",
      closeWithX: "Закрыть ✕",
      email: "Email",
      emailShort: "Email",
      password: "Пароль",
      passwordShort: "Пароль",
      name: "Имя",
      roomCode: "Код комнаты",
      fourDigits: "Нужно ввести ровно 4 цифры",
      whatsappAuto: "После заказа WhatsApp откроется автоматически.",
      footerRights: "©️ 2026 Mirpanel • Все права защищены",
      footerWhatsApp: "WhatsApp: 051 524 35 45",
      gameButton: "🎮 Играть",
      productFallback: "Товар",
      spotifyLoginTitle: "Войти с паролем",
      spotifyOrder: "Заказать"
    }
  };

  const keyValues = {};
  Object.values(I18N).forEach((dict) => {
    Object.entries(dict).forEach(([key, value]) => {
      keyValues[String(value).replace(/<[^>]+>/g, "").trim()] = key;
    });
  });

  function getLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(saved) ? saved : "az";
  }

  function tr(key) {
    const lang = getLanguage();
    return I18N[lang]?.[key] || I18N.az[key] || key;
  }

  function setHtml(element, html) {
    if (element && element.innerHTML !== html) element.innerHTML = html;
  }

  function setText(element, text) {
    if (element && element.textContent !== text) element.textContent = text;
  }

  function setPlaceholder(element, text) {
    if (element && element.placeholder !== text) element.placeholder = text;
  }

  function findKnownKey(text) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    return keyValues[clean] || null;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .langSwitch {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-top: 4px;
      }
      .langBtn {
        min-width: 34px;
        height: 22px;
        padding: 0 7px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.025));
        color: rgba(255,255,255,.68);
        font: 900 10px/1 Poppins, system-ui, sans-serif;
        letter-spacing: .2px;
        cursor: pointer;
        transition: border-color .2s ease, color .2s ease, box-shadow .2s ease, transform .2s ease, background .2s ease;
      }
      .langBtn:hover {
        color: #fff;
        border-color: rgba(255,212,0,.32);
      }
      .langBtn.active {
        color: #ffd400;
        border-color: rgba(255,212,0,.8);
        background: linear-gradient(180deg, rgba(255,212,0,.13), rgba(255,255,255,.035));
        box-shadow: 0 0 0 1px rgba(255,212,0,.12), 0 0 15px rgba(255,212,0,.18);
      }
      .langBtn:active { transform: translateY(1px) scale(.98); }
      @media (max-width: 850px) {
        .langSwitch { gap: 4px; margin-top: 3px; }
        .langBtn { min-width: 31px; height: 20px; padding: 0 6px; font-size: 9px; }
      }
    `;
    document.head.appendChild(style);
  }

  function applyStatic() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      if (key === "searchPromoTitle") setHtml(element, tr(key));
      else setText(element, tr(key));
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      setPlaceholder(element, tr(element.getAttribute("data-i18n-placeholder")));
    });

    document.documentElement.lang = getLanguage();
    document.querySelectorAll(".langBtn").forEach((button) => {
      button.classList.toggle("active", button.dataset.lang === getLanguage());
      button.setAttribute("aria-pressed", String(button.dataset.lang === getLanguage()));
    });
  }

  function applySortLabels() {
    const options = {
      default: `↕ ${tr("sortProducts")} (${tr("bestSelling")})`,
      "price-asc": `🔽 ${tr("priceAsc")}`,
      "price-desc": `🔼 ${tr("priceDesc")}`,
      az: `🔤 ${tr("nameAz")}`,
      za: `🔤 ${tr("nameZa")}`
    };
    Object.entries(options).forEach(([value, label]) => {
      const option = document.querySelector(`#sortSelect option[value="${value}"]`);
      setText(option, label);
    });
  }

  function stockLabelFromText(text) {
    const clean = String(text || "");
    const number = clean.match(/-?\d+/)?.[0];
    const outWords = [I18N.az.stockOut, I18N.en.stockOut, I18N.ru.stockOut];
    const lowWords = [I18N.az.stockLow, I18N.en.stockLow, I18N.ru.stockLow];
    const cardWords = [I18N.az.stockCard, I18N.en.stockCard, I18N.ru.stockCard];

    if (outWords.some((word) => clean.includes(word))) return tr("stockOut");
    if (number && lowWords.some((word) => clean.includes(word))) return `${tr("stockLow")} • ${number} ${tr("unit")}`;
    if (number && cardWords.some((word) => clean.includes(word))) return `${tr("stockCard")}: ${number}`;
    if (number) return `${tr("stockIn")} • ${number} ${tr("unit")}`;
    return clean;
  }

  function applyDynamicLabels() {
    applySortLabels();

    document.querySelectorAll(".card .btn.primary, #pp-order-btn").forEach((button) => setText(button, tr("order")));
    document.querySelectorAll("#btnBackToHome").forEach((button) => setText(button, tr("back")));
    document.querySelectorAll("#pp-about-btn").forEach((button) => setText(button, tr("productAbout")));
    document.querySelectorAll(".pp-tab[data-target='tab-about']").forEach((button) => setText(button, tr("productAbout")));
    document.querySelectorAll(".pp-tab[data-target='tab-rules']").forEach((button) => setText(button, tr("rules")));

    document.querySelectorAll(".pp-subtitle").forEach((element) => {
      const key = findKnownKey(element.textContent);
      if (key === "chooseDuration" || /Müddət|duration|срок/i.test(element.textContent)) setText(element, tr("chooseDuration"));
      if (key === "similar" || /Oxşar|Similar|Похожие/i.test(element.textContent)) setText(element, tr("similar"));
    });

    document.querySelectorAll(".pp-avail-badge").forEach((element) => {
      const text = element.textContent;
      if (/yoxdur|out of stock|нет/i.test(text)) setText(element, tr("stockOut"));
      else setText(element, tr("available"));
    });

    document.querySelectorAll(".mpStockLine, .mpStockBadge, .stockBadge, .productStockBadge").forEach((element) => {
      setText(element, stockLabelFromText(element.textContent));
    });

    document.querySelectorAll(".mirpanelSuggestState").forEach((element) => {
      const text = element.textContent;
      if (/axtar|search|поиск/i.test(text)) setText(element, tr("searching"));
      else setText(element, tr("noResults"));
    });

    document.querySelectorAll(".mirpanelSuggestText em").forEach((element) => {
      if (findKnownKey(element.textContent) === "productFallback" || element.textContent.trim() === "Məhsul") {
        setText(element, tr("productFallback"));
      }
    });

    document.querySelectorAll(".mirpanelSuggestText small").forEach((element) => {
      setText(element, stockLabelFromText(element.textContent));
    });

    document.querySelectorAll(".mpFormTitle, .orderConfirmationTitle, .confirmationTitle").forEach((element) => {
      const key = findKnownKey(element.textContent);
      if (key) setText(element, tr(key));
    });

    document.querySelectorAll("label span, .spotifyLoginField span, .premiumOrderField span").forEach((element) => {
      const key = findKnownKey(element.textContent);
      if (key) setText(element, tr(key));
    });

    document.querySelectorAll("button, a").forEach((element) => {
      const key = findKnownKey(element.textContent);
      if (key && ["order", "confirm", "cancel", "continue", "close", "closeWithX", "spotifyOrder"].includes(key)) {
        setText(element, tr(key === "spotifyOrder" ? "order" : key));
      }
    });

    document.querySelectorAll("input").forEach((input) => {
      const key = findKnownKey(input.placeholder);
      if (key) setPlaceholder(input, tr(key));
    });

    document.querySelectorAll(".toast, .mpToast, [role='alert']").forEach((element) => {
      if (findKnownKey(element.textContent) === "fourDigits" || /4 rəqəm|4 digits|4 циф/i.test(element.textContent)) {
        setText(element, tr("fourDigits"));
      }
    });

    const gameBtn = document.getElementById("gameBtnOpen");
    if (gameBtn) setText(gameBtn, tr("gameButton"));
  }

  let applying = false;
  let pending = 0;
  function applyI18n() {
    if (applying) return;
    applying = true;
    try {
      applyStatic();
      applyDynamicLabels();
    } finally {
      applying = false;
    }
  }

  function scheduleApply() {
    clearTimeout(pending);
    pending = setTimeout(applyI18n, 40);
  }

  function setLanguage(lang) {
    const next = LANGS.includes(lang) ? lang : "az";
    localStorage.setItem(STORAGE_KEY, next);
    applyI18n();
    setTimeout(applyI18n, 80);
  }

  function bindLanguageButtons() {
    document.querySelectorAll(".langBtn").forEach((button) => {
      if (button.dataset.i18nBound === "1") return;
      button.dataset.i18nBound = "1";
      button.addEventListener("click", () => setLanguage(button.dataset.lang));
    });
  }

  function boot() {
    injectStyles();
    bindLanguageButtons();
    applyI18n();

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  window.MIRPANEL_I18N = I18N;
  window.t = tr;
  window.setLanguage = setLanguage;
  window.getLanguage = getLanguage;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
