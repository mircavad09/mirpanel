(function () {
  const viewGroups = [
    ["Əsas idarəetmə", [["dashboard", "İdarə paneli"], ["products", "Məhsullar"], ["categories", "Kateqoriyalar"]]],
    ["Saytın görünüşü", [["homepage", "Ana səhifə"], ["navigation", "Naviqasiya və keçidlər"], ["banners", "Bannerlər"], ["about", "Haqqımızda"], ["contact", "Əlaqə"], ["terms", "Şərtlər"]]],
    ["Parametrlər", [["orders", "Sifariş parametrləri"], ["paymentMethods", "Ödəniş üsulları"], ["paymentCosts", "Məhsulların maya dəyəri və qazanc"], ["paymentOrders", "Sifarişlər"], ["paymentReviews", "Ödəniş yoxlamaları"], ["netflixAccounts", "Netflix hesabları"], ["seo", "SEO və sitemap"], ["media", "Şəkil kitabxanası"], ["history", "Dəyişiklik tarixçəsi"]]]
  ];
  const viewLabels = viewGroups.flatMap(([, items]) => items);
  const safeIcons = ["home", "products", "search", "info", "contact", "terms", "whatsapp", "sparkles", "game", "ai", "link", "image", "shield"];
  let baselineData = null;
  let baselineSha = "";
  const bannerUploadJobs = new Map();
  const dirtyBannerProductIds = new Set();

  function el(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }
  function cms() { return state.data?.cms || null; }
  function value(path, fallback = "") {
    return path.split(".").reduce((current, key) => current?.[key], cms()) ?? fallback;
  }
  function setValue(path, next) {
    const parts = path.split(".");
    let target = cms();
    for (const key of parts.slice(0, -1)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      target = target[key];
    }
    target[parts.at(-1)] = next;
    if (path.startsWith("navigation.")) syncFooterProjection();
    markDirty();
  }
  function bannerProductId(path) {
    const parts = String(path || "").split(".");
    return parts[0] === "productBanner" ? parts[1] || "" : "";
  }
  function markBannerDirty(path, publishStatus = "unsaved") {
    const productId = bannerProductId(path);
    if (productId) dirtyBannerProductIds.add(productId);
    markDirty();
    state.publishStatus = publishStatus;
    renderStats();
  }
  function syncFooterProjection() {
    if (!cms()) return;
    cms().footer ||= {};
    cms().footer.links = (cms().navigation || [])
      .filter((item) => item.showFooter === true)
      .map(({ showHeader, showFooter, ...item }) => ({ ...item }));
  }
  function field(label, path, options = {}) {
    const type = options.type || "text";
    const full = options.full ? " full" : "";
    if (type === "checkbox") {
      return `<label class="switchLine${full}"><input type="checkbox" data-cms="${esc(path)}"><span>${esc(label)}</span></label>`;
    }
    if (type === "textarea" || type === "richtext") {
      return `<label class="${full.trim()}">${esc(label)}<textarea rows="${options.rows || 4}" data-cms="${esc(path)}"></textarea>${type === "richtext" ? '<small>İcazəli formatlar: başlıq, paraqraf, siyahı, qalın mətn və təhlükəsiz keçid.</small>' : ""}</label>`;
    }
    return `<label class="${full.trim()}">${esc(label)}<input data-cms="${esc(path)}" type="${esc(type)}"${options.min !== undefined ? ` min="${options.min}"` : ""}${options.max !== undefined ? ` max="${options.max}"` : ""}></label>`;
  }
  function panel(title, description, body) {
    return `<div class="panel editorPanel cmsPanel"><div class="panelHead"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div></div>${body}</div>`;
  }
  function createView(id, html) {
    let view = el(`${id}View`);
    if (!view) {
      view = document.createElement("section");
      view.id = `${id}View`;
      view.className = "workspace hidden cmsWorkspace";
      document.querySelector(".main").appendChild(view);
    }
    view.innerHTML = html;
  }
  function installNavigation() {
    const nav = document.querySelector(".nav");
    nav.innerHTML = viewGroups.map(([group, items], groupIndex) => `<div class="navGroup">
      <span class="navGroupTitle">${esc(group)}</span>
      ${items.map(([id, label], index) => `<button class="navBtn${groupIndex === 0 && index === 0 ? " active" : ""}" type="button" data-view="${id}">${esc(label)}</button>`).join("")}
    </div>`).join("");
    nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (button) activateView(button.dataset.view);
    });
  }
  function activateView(view) {
    document.querySelectorAll(".workspace, .singlePanel, .cmsWorkspace").forEach((section) => section.classList.add("hidden"));
    const target = el(`${view}View`);
    if (target) target.classList.remove("hidden");
    document.querySelectorAll(".navBtn[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    el("crumb").textContent = viewLabels.find(([id]) => id === view)?.[1] || "İdarə paneli";
    if (view === "history") loadHistory();
    if (view === "dashboard") renderDashboard();
    if (view === "netflixAccounts") loadNetflixAccounts();
  }
  async function loadNetflixAccounts() {
    const list = el("netflixAccountsList"); if (!list) return;
    list.textContent = "Yüklənir...";
    try { const q = el("netflixAccountSearch")?.value || ""; const result = await api(`/api/admin/netflix-accounts?q=${encodeURIComponent(q)}`); list.innerHTML = (result.items || []).map((item) => `<div class="cmsListItem compact"><strong>${esc(item.email)}</strong><span>${item.active ? "Aktiv" : "Deaktiv"}</span><div><button class="btn" type="button" data-netflix-toggle="${esc(item.email)}" data-active="${item.active ? "false" : "true"}">${item.active ? "Deaktiv et" : "Aktiv et"}</button><button class="btn danger" type="button" data-netflix-delete="${esc(item.email)}">Sil</button></div></div>`).join("") || "Hesab əlavə edilməyib."; } catch { list.textContent = "Hesablar yüklənmədi."; }
  }
  function createStaticViews() {
    createView("dashboard", panel("İdarə paneli", "Sayt məzmununun ümumi vəziyyəti", '<div class="cmsCards" id="cmsDashboardCards"></div>'));
    createView("homepage", panel("Ana səhifə", "Mövcud dizaynı dəyişmədən ana səhifə mətnlərini idarə et", `<div class="sectionHead"><h3>Ümumi sayt məlumatları</h3></div><div class="formGrid">
      ${field("Brend adı", "site.brandName")}${field("Loqo yolu", "site.logo")}
      ${field("Brend alt yazısı", "site.brandSubtitle", { full: true })}
      ${field("Copyright ili", "footer.year", { type: "number", min: 2000, max: 2200 })}
      ${field("Müəllif hüquqları mətni", "footer.copyrightText", { full: true })}
      ${field("Elan aktivdir", "homepage.announcement.enabled", { type: "checkbox" })}
      ${field("Elan mətni", "homepage.announcement.text", { full: true })}
      ${field("Əsas başlıq", "homepage.hero.title", { full: true })}
      ${field("Əsas açıqlama", "homepage.hero.description", { type: "textarea", full: true })}
      ${field("SEO təqdimatı görünsün", "homepage.seoIntro.enabled", { type: "checkbox" })}
      ${field("SEO təqdimatı H1", "homepage.seoIntro.title", { full: true })}
      ${field("SEO təqdimatı mətni", "homepage.seoIntro.text", { type: "textarea", full: true })}
      ${field("Axtarış başlığı", "homepage.search.title")}${field("Axtarış vurğusu", "homepage.search.highlight")}
      ${field("Axtarış placeholder-i", "homepage.search.placeholder")}
      ${field("Axtarış açıqlaması", "homepage.search.description", { type: "textarea", full: true })}
      ${field("Paket bölməsi aktivdir", "homepage.bundle.enabled", { type: "checkbox" })}
      ${field("Paket başlığı", "homepage.bundle.title")}
      ${field("Paket düyməsi", "homepage.bundle.buttonText")}
      ${field("Paket endirimi (%)", "homepage.bundle.discountPercent", { type: "number", min: 0, max: 100 })}
      ${field("Paket açıqlaması", "homepage.bundle.description", { type: "textarea", full: true })}
      ${field("Oyun bölməsi görünsün", "homepage.sections.games", { type: "checkbox" })}
      ${field("AI bölməsi görünsün", "homepage.sections.ai", { type: "checkbox" })}
      ${field("Haqqımızda qısa kart başlığı", "homepage.infoCards.about.title")}
      ${field("Haqqımızda qısa kart keçidi", "homepage.infoCards.about.linkText")}
      ${field("Haqqımızda qısa kart mətni", "homepage.infoCards.about.text", { type: "textarea", full: true })}
      ${field("Əlaqə qısa kart başlığı", "homepage.infoCards.contact.title")}
      ${field("Əlaqə qısa kart keçidi", "homepage.infoCards.contact.linkText")}
      ${field("Əlaqə qısa kart mətni", "homepage.infoCards.contact.text", { type: "textarea", full: true })}
      ${field("Şərtlər qısa kart başlığı", "homepage.infoCards.terms.title")}
      ${field("Şərtlər qısa kart keçidi", "homepage.infoCards.terms.linkText")}
      ${field("Şərtlər qısa kart mətni", "homepage.infoCards.terms.text", { type: "textarea", full: true })}
    </div><div class="sectionHead"><div><h3>Bölmələrin sırası və görünməsi</h3></div></div><div id="homepageSections" class="cmsList"></div><details class="adminAccordion"><summary>Ümumi sayt mətnləri</summary><p class="formHint">Düymələrdə, axtarışda və modal pəncərələrdə görünən ortaq mətnlər.</p><div class="formGrid" id="commonTextFields"></div></details>`));
    createView("navigation", panel("Naviqasiya və keçidlər", "Keçidi bir dəfə yaradın, header və footer görünüşünü checkbox-larla seçin", `<div class="formGrid">
      ${field("Brend adı", "site.brandName")}${field("Loqo yolu", "site.logo")}
      ${field("Footer mətni", "footer.shortText", { type: "textarea", full: true })}
    </div><div class="sectionHead"><h3>Sayt keçidləri</h3><button class="btn" type="button" data-add-list="navigation">Keçid əlavə et</button></div><div id="navigationList" class="cmsList"></div>`));
    createView("banners", panel("Bannerlər", "Məhsul bannerlərini sadə siyahıdan seçib redaktə edin", '<div class="sectionHead"><h3>Bütün məhsul bannerləri</h3></div><div id="bannerProductList" class="bannerManageList"></div><label class="bannerProductPicker hidden">Məhsulu seç<select id="bannerProductSelect"></select></label><div id="bannerProductEditor"></div><div class="sectionHead"><h3>Canlı Dəstək böyük şəkli</h3></div><div id="supportCardEditor"></div>'));
    createView("paymentMethods", panel("Ödəniş üsulları", "Kart və elektron cüzdanları təhlükəsiz idarə edin. Tam nömrə saxlandıqdan sonra yenidən göstərilmir.", '<div id="paymentMethodsStatus" class="previewResult hidden"></div><div class="sectionHead"><div><h3>Kart və cüzdanlar</h3><p>Standart gündəlik limit 5-dir. Limitsiz rejim yalnız əl ilə aktivləşdirilir.</p></div><button class="btn primary" type="button" id="paymentMethodAdd">Yeni üsul əlavə et</button></div><div id="paymentMethodsList" class="paymentMethodsAdminList"></div><div id="paymentMethodEditor"></div><div class="sectionHead"><h3>Bildiriş və çek saxlanması</h3></div><form id="paymentSettingsForm" class="paymentSettingsForm formGrid"><label>Bildiriş Gmail ünvanı<input id="paymentNotificationEmail" type="email" required></label><label>Çeklərin saxlanma müddəti (gün)<input id="paymentReceiptRetentionDays" type="number" min="1" max="3650" value="90"></label><div class="wide"><button class="btn" type="submit">Parametrləri saxla</button></div></form>'));
    createView("paymentCosts", panel("Məhsulların maya dəyəri və qazanc", "Maya dəyərini plan üzrə daxil edin. Satış qiyməti və xalis qazanc avtomatik hesablanır; bu məlumatlar yalnız admin paneldə görünür.", `<div class="paymentCostToolbar">
      <form id="paymentCostFilters" class="paymentCostFilters" role="search">
        <label>Məhsul axtarışı<input id="paymentCostSearch" type="search" autocomplete="off" placeholder="Məhsul adı"></label>
        <label>Vəziyyət<select id="paymentCostActive"><option value="">Hamısı</option><option value="active">Aktiv</option><option value="inactive">Deaktiv</option></select></label>
        <label>Kateqoriya<select id="paymentCostCategory"><option value="">Bütün kateqoriyalar</option></select></label>
        <label class="checkLabel"><input id="paymentCostMissing" type="checkbox"> Yalnız maya dəyəri qeyd edilməyənlər</label>
      </form>
      <button class="btn primary" type="button" id="paymentCostsSaveAll" disabled>Hamısını yadda saxla</button>
    </div>
    <div id="paymentCostsStatus" class="paymentOrdersStatus" role="status" aria-live="polite"></div>
    <div id="paymentCostsList" class="paymentCostsList" aria-live="polite"></div>
    <details class="paymentBackfillPanel"><summary>Köhnə sifarişlərin maya snapshot-u</summary><p>Maya snapshot-u olmayan tamamlanmış sifarişlər yalnız məhsul ID-si və plan ID-si tam uyğun gəldikdə hesablanır. Sıfır və ya təxmini maya yazılmır.</p><div class="paymentOrderActions"><button class="btn" type="button" id="paymentCostBackfillPreview">Preview yarat</button><button class="btn primary" type="button" id="paymentCostBackfillApply" disabled>Təsdiqlə və tətbiq et</button></div><div id="paymentCostBackfillResult" class="paymentOrdersStatus" aria-live="polite"></div></details>`));
    createView("paymentOrders", panel("Sifarişlər", "Gözləyən sifarişləri yoxlayın, tamamlanmış satış tarixçəsini və müddəti bitən məhsulları izləyin.", `<div class="paymentOrderToolbar">
      <div class="paymentOrderTabs" role="tablist" aria-label="Sifariş statusları">
        <button class="paymentOrderTab active" type="button" role="tab" aria-selected="true" data-payment-order-tab="pending">Gözləyən sifarişlər (<span id="paymentPendingCount">0</span>)</button>
        <button class="paymentOrderTab" type="button" role="tab" aria-selected="false" data-payment-order-tab="today">Bu gün tamamlananlar (<span id="paymentTodayCount">0</span>)</button>
        <button class="paymentOrderTab" type="button" role="tab" aria-selected="false" data-payment-order-tab="all">Ümumi sifarişlər (<span id="paymentAllCount">0</span>)</button>
        <button class="paymentOrderTab" type="button" role="tab" aria-selected="false" data-payment-order-tab="expiring">Bitən məhsullar (<span id="paymentExpiringCount">0</span>)</button>
      </div>
      <button class="btn" type="button" id="paymentOrdersRefresh">Yenilə</button>
    </div>
    <div id="paymentOrderStatistics" class="paymentOrderStatistics" aria-live="polite"></div>
    <form id="paymentOrderFilters" class="paymentOrderFilters" role="search">
      <label>Sifariş ID-si<input id="paymentOrderSearch" type="search" placeholder="MP-XXXXXX" autocomplete="off"></label>
      <label>Məhsul<select id="paymentOrderProduct"><option value="">Bütün məhsullar</option></select></label>
      <label>Plan<select id="paymentOrderPlan"><option value="">Bütün planlar</option></select></label>
      <label>Bank<select id="paymentOrderMethod"><option value="">Bütün banklar</option></select></label>
      <label>Müddət<select id="paymentOrderPeriod"><option value="all">Bütün tarixlər</option><option value="today">Bu gün</option><option value="yesterday">Dünən</option><option value="7d">Son 7 gün</option><option value="30d">Son 30 gün</option><option value="this_month">Bu ay</option><option value="last_month">Keçən ay</option><option value="3m">Son 3 ay</option><option value="6m">Son 6 ay</option><option value="12m">Son 12 ay</option><option value="custom">Xüsusi tarix</option></select></label>
      <label class="paymentCustomDate">Başlanğıc tarixi<input id="paymentOrderDateFrom" type="date"></label>
      <label class="paymentCustomDate">Son tarix<input id="paymentOrderDateTo" type="date"></label>
      <label>Sıralama<select id="paymentOrderSort"><option value="newest">Ən yeni</option><option value="oldest">Ən köhnə</option></select></label>
      <div class="paymentOrderFilterActions"><button class="btn primary" type="submit">Tətbiq et</button><button class="btn" type="button" id="paymentOrderFiltersClear">Təmizlə</button></div>
    </form>
    <div id="paymentOrdersStatus" class="paymentOrdersStatus" role="status" aria-live="polite"></div>
    <div id="paymentOrdersList" class="paymentOrdersAdminList" aria-live="polite"></div>
    <nav class="paymentOrderPagination" aria-label="Sifariş səhifələri"><button class="btn" type="button" id="paymentOrdersPrevious">Əvvəlki</button><span id="paymentOrdersPageInfo">Səhifə 1 / 1</span><button class="btn" type="button" id="paymentOrdersNext">Növbəti</button></nav>`));
    createView("paymentReviews", panel("Ödəniş yoxlamaları", "Gmail bildirişlərinin göndərilmə vəziyyətini izləyin.", '<div class="sectionHead"><div><h3>Gmail bildirişləri</h3><p>Uğursuz bildirişləri təhlükəsiz şəkildə yenidən növbəyə ala bilərsiniz.</p></div><button class="btn" type="button" id="paymentReviewsRefresh">Yenilə</button></div><div id="paymentEmailsList" class="paymentEmailsAdminList"></div>'));
    createView("netflixAccounts", panel("Netflix hesabları", "Ünvanı əlavə etmək yönləndirməni avtomatik qurmur. Mənbə Gmail-də yönləndirmə ayrıca təsdiqlənməlidir.", '<div class="formGrid"><label>Gmail ünvanı<input id="netflixAccountEmail" type="email" autocomplete="off"></label><div><button class="btn primary" type="button" id="netflixAccountAdd">Əlavə et</button></div><label class="wide">Axtarış<input id="netflixAccountSearch" type="search" placeholder="Gmail üzrə axtar"></label></div><div id="netflixAccountsList" class="cmsList"></div>'));
    createView("about", pageForm("haqqimizda", "Haqqımızda"));
    createView("contact", contactForm());
    createView("terms", termsForm());
    createView("seo", panel("SEO və sitemap", "Canonical, Open Graph və indekslənmə parametrləri", `<div class="warningBox">“Noindex” seçimi səhifənin axtarış nəticələrindən çıxmasına səbəb ola bilər.</div><div class="formGrid">
      ${field("Ana səhifə SEO title", "seo.home.title")}
      ${field("Ana səhifə meta description", "seo.home.description", { type: "textarea", full: true })}
      ${field("Open Graph title", "seo.home.ogTitle")}
      ${field("Open Graph şəkli", "seo.home.ogImage")}
      ${field("Open Graph description", "seo.home.ogDescription", { type: "textarea", full: true })}
      ${field("Sayt indekslənsin", "seo.robotsIndexing", { type: "checkbox" })}
      ${field("Ana səhifə sitemap-a daxil olsun", "seo.home.includeInSitemap", { type: "checkbox" })}
    </div><div class="canonicalPreview">Canonical: https://mirpanel.com/</div><div id="seoProductWarnings"></div>`));
    createView("media", panel("Şəkil kitabxanası", "Buraya yüklədiyiniz şəkilləri məhsullarda, bannerlərdə və saytın digər bölmələrində seçərək istifadə edə bilərsiniz.", `<div class="mediaUpload"><input class="hidden" id="cmsMediaFile" type="file" accept="image/jpeg,image/png,image/webp"><button class="btn" id="cmsMediaPick" type="button">Şəkil seç</button><span id="cmsMediaFileName">Şəkil seçilməyib</span><label>Alternativ mətn<input id="cmsMediaAlt"></label><button class="btn primary" id="cmsMediaUpload" type="button">Kitabxanaya yüklə</button><small>Yalnız JPG, PNG və WEBP. Maksimum fayl ölçüsü: 5 MB.</small></div><div id="mediaList" class="mediaGrid"></div>`));
    createView("orders", panel("Sifariş parametrləri", "Bütün məhsullar üçün ortaq sifariş və WhatsApp mətnləri", `<div class="formGrid">
      ${field("WhatsApp düyməsinin mətni", "orderSettings.whatsappButtonText")}
      ${field("WhatsApp nömrəsi", "site.whatsappNumber")}
      ${field("Ekranda görünən telefon", "site.phoneDisplay")}
      ${field("Standart əlavə mesaj", "orderSettings.defaultExtraMessage", { type: "textarea", full: true })}
      ${field("Razılıq checkbox mətni", "orderSettings.agreementText", { full: true })}
      ${field("Standart təsdiq tələb olunsun", "orderSettings.requireConfirmation", { type: "checkbox" })}
    </div>`));
    createView("history", panel("Dəyişiklik tarixçəsi", "Məxfi məlumatlar göstərilmir", '<button class="btn" id="refreshHistory" type="button">Tarixçəni yenilə</button><div id="historyList" class="cmsList"></div>'));
    const previewResult = document.createElement("div");
    previewResult.id = "cmsPreviewResult";
    previewResult.className = "previewResult hidden";
    document.body.appendChild(previewResult);
  }
  function pageForm(key, label) {
    if (key === "haqqimizda") {
      return panel(label, "Haqqımızda səhifəsinin məzmunu, keçidləri və SEO məlumatları", `<div class="formGrid" data-site-page="${key}">
        ${siteField("Aktivdir", key, "enabled", "checkbox")}${siteField("Slug", key, "slug")}
        ${siteField("Kiçik üst etiket", key, "kicker")}${siteField("Əsas H1", key, "title")}
        ${siteField("SEO title", key, "seoTitle")}${siteField("Meta description", key, "seoDescription", "textarea", true)}
        ${siteField("Open Graph title", key, "ogTitle")}${siteField("Open Graph şəkli", key, "ogImage")}
        ${siteField("Open Graph description", key, "ogDescription", "textarea", true)}
        ${siteField("İndekslənsin", key, "index", "checkbox")}${siteField("Sitemap-a daxil olsun", key, "includeInSitemap", "checkbox")}
      </div><div class="sectionHead"><h3>Mətn abzasları</h3><button class="btn" type="button" data-add-block="${key}">Abzas əlavə et</button></div><p class="formHint">Hər element səhifədə sadə abzas kimi göstərilir. **Qalın mətn** və [daxili keçid](/elaqe/) istifadə edilə bilər. Təhlükəli HTML bloklanır.</p><div class="cmsList" data-block-list="${key}"></div>`);
    }
    return panel(label, `${label} səhifəsinin məzmunu və SEO məlumatları`, `<div class="formGrid" data-site-page="${key}">
      ${siteField("Aktivdir", key, "enabled", "checkbox")}${siteField("Slug", key, "slug")}
      ${siteField("H1", key, "title")}${siteField("Giriş mətni", key, "subtitle")}
      ${siteField("Əsas mətn", key, "body", "richtext", true)}
      ${siteField("Düymə mətni", key, "buttonText")}${siteField("Düymə keçidi", key, "buttonUrl")}
      ${siteField("SEO title", key, "seoTitle")}${siteField("Meta description", key, "seoDescription", "textarea", true)}
      ${siteField("Open Graph title", key, "ogTitle")}${siteField("Open Graph şəkli", key, "ogImage")}
      ${siteField("Open Graph description", key, "ogDescription", "textarea", true)}
      ${siteField("İndekslənsin", key, "index", "checkbox")}${siteField("Sitemap-a daxil olsun", key, "includeInSitemap", "checkbox")}
    </div><div class="sectionHead"><h3>Məzmun bölmələri</h3><button class="btn" type="button" data-add-block="${key}">Bölmə əlavə et</button></div><div class="cmsList" data-block-list="${key}"></div>`);
  }
  function contactForm() {
    return panel("Əlaqə", "Telefon bir mənbədən bütün WhatsApp keçidlərinə tətbiq edilir", `<div class="formGrid">
      ${siteField("Aktivdir", "elaqe", "enabled", "checkbox")}${siteField("Slug", "elaqe", "slug")}
      ${siteField("H1", "elaqe", "title")}${siteField("Giriş mətni", "elaqe", "subtitle")}
      ${field("WhatsApp nömrəsi", "site.whatsappNumber")}${field("Ekranda görünən telefon", "site.phoneDisplay")}
      ${siteField("WhatsApp düyməsi", "elaqe", "buttonText")}${siteField("Hazır WhatsApp mesajı", "elaqe", "whatsappMessage")}
      ${siteField("Dəstək məlumatı", "elaqe", "body", "textarea", true)}${siteField("İş saatları", "elaqe", "workHours", "textarea", true)}
      ${siteField("SEO title", "elaqe", "seoTitle")}${siteField("Meta description", "elaqe", "seoDescription", "textarea", true)}
    </div><div class="sectionHead"><h3>Əlavə bölmələr</h3><button class="btn" type="button" data-add-block="elaqe">Bölmə əlavə et</button></div><div class="cmsList" data-block-list="elaqe"></div>`);
  }
  function termsForm() {
    return panel("Şərtlər", "Uzun hüquqi mətn, formatlama və SEO məlumatları", `<div class="formGrid">
      ${siteField("Aktivdir", "sertler", "enabled", "checkbox")}${siteField("Slug", "sertler", "slug")}
      ${siteField("H1", "sertler", "title")}
      <label class="full">Tam hüquqi mətn<textarea class="legalTextEditor" rows="32" data-site="sertler.body"></textarea><small># əsas bölmə, ## alt bölmə, - siyahı, **qalın mətn** və [keçid](URL) formatları dəstəklənir. Script, iframe və təhlükəli HTML bloklanır.</small></label>
      ${siteField("SEO title", "sertler", "seoTitle")}${siteField("Meta description", "sertler", "seoDescription", "textarea", true)}
      ${siteField("Open Graph title", "sertler", "ogTitle")}${siteField("Open Graph şəkli", "sertler", "ogImage")}
      ${siteField("Open Graph description", "sertler", "ogDescription", "textarea", true)}
      ${siteField("İndekslənsin", "sertler", "index", "checkbox")}${siteField("Sitemap-a daxil olsun", "sertler", "includeInSitemap", "checkbox")}
    </div>`);
  }
  function siteField(label, page, key, type = "text", full = false) {
    const attrs = `data-site="${page}.${key}"`;
    if (type === "checkbox") return `<label class="switchLine${full ? " full" : ""}"><input type="checkbox" ${attrs}><span>${esc(label)}</span></label>`;
    if (type === "textarea" || type === "richtext") return `<label class="${full ? "full" : ""}">${esc(label)}<textarea rows="5" ${attrs}></textarea>${type === "richtext" ? "<small>Script, iframe və sərbəst HTML bloklanır.</small>" : ""}</label>`;
    return `<label class="${full ? "full" : ""}">${esc(label)}<input ${attrs}></label>`;
  }
  function ensurePage(key) {
    state.data.siteSections ||= {};
    state.data.siteSections[key] ||= { enabled: true, slug: key, title: "", subtitle: "", body: "", blocks: [], seoTitle: "", seoDescription: "", index: true, includeInSitemap: true };
    state.data.siteSections[key].blocks ||= [];
    return state.data.siteSections[key];
  }
  function bindInputs() {
    document.querySelector(".main").addEventListener("input", (event) => {
      const target = event.target;
      if (target.dataset.cms) {
        const next = target.type === "checkbox" ? target.checked : target.type === "number" ? Number(target.value) : target.value;
        setValue(target.dataset.cms, next);
      }
      if (target.dataset.productBanner) {
        const owner = bannerImageOwner(target.dataset.productBanner);
        if (!owner.item || owner.field === "order") return;
        owner.item[owner.field] = target.type === "checkbox" ? target.checked : target.value;
        markBannerDirty(target.dataset.productBanner);
      }
      if (target.dataset.site) {
        const [pageKey, fieldKey] = target.dataset.site.split(".");
        ensurePage(pageKey)[fieldKey] = target.type === "checkbox" ? target.checked : target.value;
        markDirty();
      }
    });
    document.querySelector(".main").addEventListener("change", handleBannerChange);
    document.querySelector(".main").addEventListener("click", handleClick);
  }
  function bannerImageOwner(path) {
    const parts = path.split(".");
    if (parts[0] === "productBanner") {
      const product = state.data.products.find((item) => item.id === parts[1]);
      const banner = product ? ensureProductBanner(product) : null;
      return { item: banner, field: parts[2], previewKey: parts[2] === "mobileImage" ? "_mobilePreview" : "_desktopPreview" };
    }
    return {
      item: cms().supportCard,
      field: parts[1],
      previewKey: parts[1] === "mobileImage" ? "_mobilePreview" : "_desktopPreview"
    };
  }
  async function uploadBannerImage(path, file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      return toast("Yalnız JPG, PNG və WEBP, maksimum 5 MB.", "bad");
    }
    const owner = bannerImageOwner(path);
    if (!owner.item) return { ok: false };
    const previous = {
      image: owner.item[owner.field],
      preview: owner.item[owner.previewKey],
      dirty: state.dirty,
      draftSaved: state.draftSaved,
      publishStatus: state.publishStatus,
      bannerDirty: dirtyBannerProductIds.has(bannerProductId(path))
    };
    const previewElement = document.querySelector(`[data-banner-preview="${CSS.escape(path)}"]`);
    const localPreview = URL.createObjectURL(file);
    if (previewElement) {
      previewElement.hidden = false;
      previewElement.src = localPreview;
    }
    markBannerDirty(path, "uploading");
    setLoading(true, "Banner şəkli yüklənir...");
    try {
      const contentBase64 = await readFileAsBase64(file);
      const result = await api("/api/upload-product-image", {
        method: "POST",
        body: JSON.stringify({ productId: path.startsWith("supportCard") ? "support" : path.split(".")[1], fileName: file.name, mimeType: file.type, contentBase64 })
      });
      owner.item[owner.field] = result.publicPath;
      if (result.filePath && !state.pendingUploads.includes(result.filePath)) state.pendingUploads.push(result.filePath);
      markDirty();
      owner.item[owner.previewKey] = result.previewDataUrl;
      if (!cms().media.some((item) => item.path === result.publicPath)) {
        cms().media.push({
          path: result.publicPath,
          _preview: result.previewDataUrl,
          alt: owner.item.alt || file.name,
          size: file.size,
          type: file.type,
          uploadedAt: result.uploadedAt
        });
      }
      renderBanners();
      renderMedia();
      populateBoundInputs();
      state.publishStatus = "save-ready";
      renderStats();
      toast("Şəkil bannerə əlavə edildi və Media bölməsində saxlanıldı.");
      return { ok: true, result };
    } catch (error) {
      owner.item[owner.field] = previous.image;
      owner.item[owner.previewKey] = previous.preview;
      if (!previous.bannerDirty) dirtyBannerProductIds.delete(bannerProductId(path));
      state.dirty = previous.dirty;
      state.draftSaved = previous.draftSaved;
      state.publishStatus = "upload-failed";
      renderBanners();
      populateBoundInputs();
      renderStats();
      toast(error.message, "bad");
      return { ok: false, error };
    } finally {
      URL.revokeObjectURL(localPreview);
      setLoading(false);
    }
  }
  function handleBannerChange(event) {
    const target = event.target;
    if (target.dataset.replaceMedia !== undefined) {
      const file = target.files?.[0];
      if (file) replaceMedia(Number(target.dataset.replaceMedia), file);
      return;
    }
    if (target.dataset.bannerUpload) {
      const file = target.files?.[0];
      if (file) {
        const path = target.dataset.bannerUpload;
        const job = uploadBannerImage(path, file);
        bannerUploadJobs.set(path, job);
        job.finally(() => {
          if (bannerUploadJobs.get(path) === job) bannerUploadJobs.delete(path);
          target.value = "";
        });
      }
      return;
    }
    if (target.dataset.bannerMedia) {
      const path = target.dataset.bannerMedia;
      const selected = cms().media.find((item) => item.path === target.value);
      const owner = bannerImageOwner(path);
      owner.item[owner.field] = target.value;
      owner.item[owner.previewKey] = selected?._preview || "";
      markBannerDirty(path);
      renderBanners();
      populateBoundInputs();
      return;
    }
    if (target.id === "bannerProductSelect") {
      selectedBannerProductId = target.value;
      renderBanners();
      populateBoundInputs();
      return;
    }
    if (target.dataset.productBanner?.endsWith(".order")) {
      const productId = target.dataset.productBanner.split(".")[1];
      const ordered = bannerProductsInOrder();
      const current = ordered.findIndex((product) => product.id === productId);
      const requested = Math.max(1, Math.min(ordered.length, Math.trunc(Number(target.value)) || 1)) - 1;
      if (current >= 0) {
        const [product] = ordered.splice(current, 1);
        ordered.splice(requested, 0, product);
        ordered.forEach((item, index) => { ensureProductBanner(item).order = index + 1; });
      }
      normalizeBannerOrders();
      markDirty();
      renderBanners();
      populateBoundInputs();
      return;
    }
    if (target.dataset.productBanner?.match(/\.(?:desktopImage|mobileImage)$/) ||
        /^(?:supportCard)\.(?:desktopImage|mobileImage)$/.test(target.dataset.cms || "")) {
      renderBanners();
      populateBoundInputs();
    }
  }
  function withoutPreviewData(value) {
    return JSON.parse(JSON.stringify(value, (key, current) => key.startsWith("_") ? undefined : current));
  }
  async function saveBannerDraft() {
    const product = state.data.products.find((item) => item.id === selectedBannerProductId);
    if (!product) return toast("Banner məhsulu tapılmadı.", "bad");
    const uploadPrefix = `productBanner.${product.id}.`;
    const uploads = [...bannerUploadJobs.entries()]
      .filter(([path]) => path.startsWith(uploadPrefix))
      .map(([, job]) => job);
    if (uploads.length) {
      state.publishStatus = "uploading";
      renderStats();
      const uploaded = await Promise.all(uploads);
      if (uploaded.some((item) => !item?.ok)) {
        return toast("Şəkil yüklənmədiyi üçün banner yadda saxlanmadı. Köhnə banner qorunub.", "bad");
      }
    }
    if (!dirtyBannerProductIds.has(product.id)) return toast("Yadda saxlanacaq banner dəyişikliyi yoxdur.", "bad");
    setLoading(true, "Banner dəyişiklikləri yadda saxlanılır...");
    try {
      const bannerPayload = withoutPreviewData(ensureProductBanner(product));
      const result = await api("/api/admin/banner-draft", {
        method: "POST",
        body: JSON.stringify({
          baseSha: state.baseSha,
          productId: product.id,
          banner: bannerPayload,
          media: withoutPreviewData(cms().media)
        })
      });
      if (
        result.productId !== product.id ||
        !result.banner ||
        result.banner.desktopImage !== bannerPayload.desktopImage ||
        result.banner.mobileImage !== bannerPayload.mobileImage
      ) {
        throw new Error("Server banner şəklinin yeni yolunu təsdiqləmədi. Dəyişikliklər brauzerdə qorunub.");
      }
      state.draftSaved = true;
      state.draftConflict = result.draftConflict === true;
      dirtyBannerProductIds.delete(product.id);
      state.publishStatus = "ready";
      renderStats();
      toast(state.draftConflict
        ? "Banner yadda saxlanıldı, amma GitHub məlumatı dəyişib. Yayımlamadan əvvəl konflikti həll edin."
        : "Banner yadda saxlanıldı və yayımlanmağa hazırdır.", state.draftConflict ? "bad" : "good");
    } catch (error) {
      state.draftSaved = false;
      state.publishStatus = "unsaved";
      renderStats();
      toast(error.message || "Banner yadda saxlanılmadı.", "bad");
    } finally {
      setLoading(false);
    }
  }
  async function handleClick(event) {
    const chooseBannerMedia = event.target.closest("[data-choose-banner-media]");
    if (chooseBannerMedia) {
      const path = chooseBannerMedia.dataset.chooseBannerMedia;
      const item = cms().media[Number(chooseBannerMedia.dataset.mediaIndex)];
      if (!item) return;
      const owner = bannerImageOwner(path);
      owner.item[owner.field] = item.path;
      owner.item[owner.previewKey] = item._preview || "";
      markBannerDirty(path);
      renderBanners();
      populateBoundInputs();
      toast("Şəkil kitabxanadan seçildi. Yadda saxla düyməsinə basın.");
      return;
    }
    const selectMedia = event.target.closest("[data-select-media]");
    if (selectMedia) {
      const item = cms().media[Number(selectMedia.dataset.selectMedia)];
      if (item) navigator.clipboard?.writeText(item.path).then(() => toast("Şəkil seçildi və yolu köçürüldü.")).catch(() => toast("Şəkil yolu: " + item.path));
      return;
    }
    const renameMedia = event.target.closest("[data-rename-media]");
    if (renameMedia) {
      const index = Number(renameMedia.dataset.renameMedia);
      const item = cms().media[index];
      openModal("Şəklin adını dəyiş", `<label>Şəkil adı<input id="mediaRenameValue" value="${esc(item?.name || String(item?.path || "").split("/").at(-1) || "")}"></label>`, "Yadda saxla", () => {
        const name = el("mediaRenameValue").value.trim();
        if (!name) return toast("Şəkil adı boş ola bilməz.", "bad");
        item.name = name; markDirty(); renderMedia(); closeModal();
      });
      return;
    }
    const deleteMedia = event.target.closest("[data-delete-media]");
    if (deleteMedia) {
      const index = Number(deleteMedia.dataset.deleteMedia);
      const usageCount = Number(deleteMedia.dataset.usageCount);
      if (usageCount > 0) return toast(`Bu şəkil ${usageCount} yerdə istifadə olunur. Əvvəl həmin bölmələrdə şəkli dəyişin.`, "bad");
      openModal("Şəkli kitabxanadan sil", "<p>Şəkil istifadə olunmur. Kitabxana qeydini silmək istəyirsiniz?</p>", "Sil", () => {
        cms().media.splice(index, 1); markDirty(); renderMedia(); closeModal();
      });
      return;
    }
    const editBanner = event.target.closest("[data-edit-product-banner]");
    if (editBanner) {
      selectedBannerProductId = editBanner.dataset.editProductBanner;
      renderBanners();
      populateBoundInputs();
      el("activeBannerEditor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (event.target.closest("[data-save-banner]")) {
      await saveBannerDraft();
      return;
    }
    const moveBanner = event.target.closest("[data-move-product-banner]");
    if (moveBanner) {
      const ordered = bannerProductsInOrder();
      const current = ordered.findIndex((product) => product.id === moveBanner.dataset.moveProductBanner);
      const next = current + Number(moveBanner.dataset.direction);
      if (current >= 0 && next >= 0 && next < ordered.length) {
        const [product] = ordered.splice(current, 1);
        ordered.splice(next, 0, product);
        ordered.forEach((item, index) => { ensureProductBanner(item).order = index + 1; });
        normalizeBannerOrders();
        markDirty();
        renderBanners();
        populateBoundInputs();
      }
      return;
    }
    const clearImage = event.target.closest("[data-clear-banner-image]");
    if (clearImage) {
      const imagePath = clearImage.dataset.clearBannerImage;
      const owner = bannerImageOwner(imagePath);
      const isMobile = owner.field === "mobileImage";
      openModal(
        isMobile ? "Mobil şəkli sil" : "Banner şəklini sil",
        `<p>${isMobile ? "Mobil override silinəcək və əsas banner şəkli istifadə olunacaq." : "Seçilmiş banner şəkli silinəcək. Məhsulun əsas şəkli avtomatik fallback kimi göstəriləcək. Fallback istəmirsinizsə banneri deaktiv edin."}</p>`,
        "Şəkli sil",
        () => {
          owner.item[owner.field] = "";
          owner.item[owner.previewKey] = "";
          markBannerDirty(imagePath);
          renderBanners();
          populateBoundInputs();
          closeModal();
        }
      );
      return;
    }
    const addList = event.target.closest("[data-add-list]")?.dataset.addList;
    if (addList) addListItem(addList);
    const remove = event.target.closest("[data-remove-list]");
    if (remove) removeListItem(remove.dataset.removeList, Number(remove.dataset.index));
    const addBlock = event.target.closest("[data-add-block]")?.dataset.addBlock;
    if (addBlock) {
      ensurePage(addBlock).blocks.push({ title: "", text: "", image: "", order: ensurePage(addBlock).blocks.length + 1 });
      markDirty(); renderBlocks(addBlock);
    }
    const removeBlock = event.target.closest("[data-remove-block]");
    if (removeBlock) {
      ensurePage(removeBlock.dataset.removeBlock).blocks.splice(Number(removeBlock.dataset.index), 1);
      markDirty(); renderBlocks(removeBlock.dataset.removeBlock);
    }
  }
  function addListItem(type) {
    if (type === "navigation") cms().navigation.push({ id: `link-${Date.now()}`, label: "Yeni keçid", url: "/", order: cms().navigation.length + 1, enabled: true, icon: "link", newTab: false, showHeader: true, showFooter: false });
    syncFooterProjection(); markDirty(); renderCms();
  }
  function removeListItem(type, index) {
    if (type !== "navigation") return;
    cms().navigation.splice(index, 1);
    syncFooterProjection(); markDirty(); renderCms();
  }
  function listInput(type, index, key, label, itemType = "text") {
    const path = `${type}.${index}.${key}`;
    if (itemType === "checkbox") return `<label class="switchLine"><input type="checkbox" data-cms="${path}"><span>${label}</span></label>`;
    return `<label>${label}<input type="${itemType}" data-cms="${path}"></label>`;
  }
  function renderLinks(type, elementId) {
    const list = cms().navigation;
    el(elementId).innerHTML = list.map((item, index) => `<div class="cmsListItem"><div class="formGrid">
      ${listInput(type, index, "label", "Keçidin adı")}${listInput(type, index, "url", "URL")}
      ${listInput(type, index, "order", "Sıra", "number")}
      <label>İkon<select data-cms="${type}.${index}.icon">${safeIcons.map((icon) => `<option value="${icon}">${icon}</option>`).join("")}</select></label>
      ${listInput(type, index, "showHeader", "Header-də göstər", "checkbox")}
      ${listInput(type, index, "showFooter", "Footer-də göstər", "checkbox")}
      ${listInput(type, index, "enabled", "Aktiv", "checkbox")}${listInput(type, index, "newTab", "Yeni tabda aç", "checkbox")}
    </div><button class="btn danger" type="button" data-remove-list="${type}" data-index="${index}">Sil</button></div>`).join("");
  }
  let selectedBannerProductId = "";
  function ensureProductBanner(product) {
    product.banner ||= {};
    product.banner.enabled = product.banner.enabled === true;
    product.banner.desktopImage ||= product.image || "";
    product.banner.mobileImage ||= "";
    product.banner.title ||= product.title || "";
    product.banner.description ||= product.desc || "";
    product.banner.alt ||= product.imageAlt || `${product.title || "Məhsul"} banneri`;
    product.banner.order = Number.isFinite(Number(product.banner.order))
      ? Math.max(1, Math.trunc(Number(product.banner.order)))
      : Math.max(1, Math.trunc(Number(product.order)) || 1);
    return product.banner;
  }
  function bannerProductsInOrder() {
    return state.data.products
      .map((product, index) => ({ product, index }))
      .sort((left, right) =>
        Number(ensureProductBanner(left.product).order) - Number(ensureProductBanner(right.product).order) ||
        Number(left.product.order) - Number(right.product.order) ||
        left.index - right.index
      )
      .map(({ product }) => product);
  }
  function normalizeBannerOrders() {
    bannerProductsInOrder().forEach((product, index) => {
      ensureProductBanner(product).order = index + 1;
    });
  }
  function cmsImageUrl(value) {
    const imagePath = String(value || "").trim();
    if (!imagePath) return "";
    if (/^(?:data:|blob:|https?:\/\/)/i.test(imagePath)) return imagePath;
    const cleanPath = imagePath.replace(/^\/+/, "").split("?")[0];
    if (state.pendingUploads.includes(cleanPath)) {
      return `/api/admin/pending-image?path=${encodeURIComponent(imagePath)}`;
    }
    return `https://mirpanel.com/${imagePath.replace(/^\/+/, "")}`;
  }
  function mediaDisplayName(item, index) {
    const fileName = String(item?.path || "").split("/").at(-1)?.split("?")[0] || `şəkil-${index + 1}`;
    return String(item?.name || item?.alt || fileName).trim();
  }
  function mediaUsageCount(mediaPath) {
    if (!mediaPath) return 0;
    const serialized = JSON.stringify({ products: state.data.products, supportCard: cms().supportCard, pages: state.data.siteSections });
    return serialized.split(mediaPath).length - 1;
  }
  function bannerMediaLibrary(path, selected) {
    const items = cms().media.map((item, index) => {
      const name = mediaDisplayName(item, index);
      const usage = mediaUsageCount(item.path);
      return `<button class="bannerMediaChoice${item.path === selected ? " active" : ""}" type="button" data-choose-banner-media="${esc(path)}" data-media-index="${index}">
        <img src="${esc(item._preview || cmsImageUrl(item.path))}" alt="${esc(item.alt || name)}">
        <span><strong>${esc(name)}</strong><small>${usage ? `${usage} yerdə istifadə olunur` : "Hazırda istifadə olunmur"}</small></span>
      </button>`;
    }).join("");
    return `<details class="bannerMediaLibrary"><summary>Şəkil kitabxanasından seç</summary><div class="bannerMediaEmpty">Kitabxanadan şəkil seçilməyib</div><div class="bannerMediaChoices">${items || '<div class="emptyMini">Şəkil kitabxanası boşdur.</div>'}</div></details>`;
  }
  function imageEditor(path, label, imagePath, preview, options = {}) {
    const fallbackPath = options.fallbackPath || "";
    const effectivePath = imagePath || fallbackPath;
    const fallbackText = !imagePath && fallbackPath
      ? `<small class="bannerFallback">Hazırda məhsulun əsas şəkli fallback kimi istifadə olunur.</small>`
      : options.mobile
        ? '<small class="bannerFallback">Mobil şəkil seçilməyib — əsas banner avtomatik istifadə olunur.</small>'
        : "";
    return `<div class="bannerImageEditor">
      <strong>${esc(label)}</strong>
      <img data-banner-preview="${esc(path)}" src="${esc(preview || cmsImageUrl(effectivePath))}" alt=""${effectivePath || preview ? "" : " hidden"}>
      <div class="bannerImageActions"><label class="btn filePickerButton">Şəkli dəyiş<input class="hidden" type="file" accept="image/jpeg,image/png,image/webp" data-banner-upload="${esc(path)}"></label><button class="btn danger" type="button" data-clear-banner-image="${esc(path)}">Şəkli sil</button></div>
      ${fallbackText}
      ${bannerMediaLibrary(path, imagePath)}
      <small>JPG, PNG və ya WEBP · maksimum 5 MB</small>
    </div>`;
  }
  function renderBanners() {
    normalizeBannerOrders();
    const orderedProducts = bannerProductsInOrder();
    if (!orderedProducts.some((product) => product.id === selectedBannerProductId)) {
      selectedBannerProductId = orderedProducts.find((product) => product.active !== false)?.id || orderedProducts[0]?.id || "";
    }
    const selector = el("bannerProductSelect");
    selector.innerHTML = orderedProducts.map((product) =>
      `<option value="${esc(product.id)}"${product.id === selectedBannerProductId ? " selected" : ""}>${esc(product.title)}${product.active === false ? " (deaktiv)" : ""}</option>`
    ).join("");
    el("bannerProductList").innerHTML = orderedProducts.map((item, index) => {
      const banner = ensureProductBanner(item);
      const reason = item.active === false ? "Məhsul deaktivdir" : banner.enabled ? "Banner aktivdir" : "Banner deaktivdir";
      return `<article class="bannerManageRow${item.id === selectedBannerProductId ? " active" : ""}">
        <img src="${esc(cmsImageUrl(banner.desktopImage || item.image))}" alt="${esc(item.title)}">
        <div><strong>${esc(item.title)}</strong><small>${esc(reason)}</small></div>
        <span class="statusPill ${banner.enabled && item.active !== false ? "active" : ""}">${banner.enabled && item.active !== false ? "Aktiv" : "Deaktiv"}</span>
        <label>Sıra<input type="number" min="1" max="${orderedProducts.length}" data-product-banner="productBanner.${esc(item.id)}.order" value="${banner.order}"></label>
        <div class="bannerOrderActions"><button class="btn" title="${index === 0 ? "Bu banner artıq birinci sıradadır" : "Bir pillə yuxarı keçir"}" type="button" data-move-product-banner="${esc(item.id)}" data-direction="-1"${index === 0 ? " disabled" : ""}>Yuxarı</button><button class="btn" title="${index === orderedProducts.length - 1 ? "Bu banner artıq son sıradadır" : "Bir pillə aşağı keçir"}" type="button" data-move-product-banner="${esc(item.id)}" data-direction="1"${index === orderedProducts.length - 1 ? " disabled" : ""}>Aşağı</button><button class="btn" type="button" data-edit-product-banner="${esc(item.id)}">Redaktə et</button></div>
      </article>`;
    }).join("");
    const product = orderedProducts.find((item) => item.id === selectedBannerProductId);
    const editor = el("bannerProductEditor");
    if (!product) {
      editor.innerHTML = '<div class="emptyMini">Məhsul yoxdur.</div>';
    } else {
      const item = ensureProductBanner(product);
      const index = orderedProducts.indexOf(product);
      const path = `productBanner.${product.id}`;
      const slug = String(product.seoSlug || product.id || "")
        .replaceAll("_", "-")
        .replace(/-almaq$/, "")
        .replace(/(^|-)hesab0(?=-|$)/g, "$1hesab")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
      editor.innerHTML = `<div class="cmsListItem bannerEditorCard" id="activeBannerEditor">
      <div class="bannerEditorHead"><div><strong>${esc(product.title)}</strong><small> · ${product.active === false ? "Məhsul deaktivdir, banner saytda görünmür" : "Aktiv məhsul banneri"}</small></div><div class="bannerOrderActions">
        <button class="btn" type="button" data-move-product-banner="${esc(product.id)}" data-direction="-1"${index === 0 ? " disabled" : ""}>Yuxarı</button>
        <button class="btn" type="button" data-move-product-banner="${esc(product.id)}" data-direction="1"${index === orderedProducts.length - 1 ? " disabled" : ""}>Aşağı</button>
      </div></div>
      <label class="switchLine bannerEnabled"><input type="checkbox" data-product-banner="${esc(path)}.enabled"${item.enabled ? " checked" : ""}><span>Banner aktivdir</span></label>
      ${imageEditor(`${path}.desktopImage`, "Banner şəkli", item.desktopImage, item._desktopPreview, { fallbackPath: product.image })}
      <details class="adminAccordion bannerAdvanced"><summary>Ətraflı seçimlər — mobil üçün ayrıca şəkil</summary><p class="formHint">Bu sahə istəyə bağlıdır. Boş saxlanıldıqda əsas banner bütün ekranlarda istifadə olunur.</p>${imageEditor(`${path}.mobileImage`, "Mobil üçün ayrıca şəkil", item.mobileImage, item._mobilePreview, { fallbackPath: item.desktopImage || product.image, mobile: true })}</details>
      <div class="formGrid">
        <label>Alternativ mətn (alt)<input data-product-banner="${esc(path)}.alt" value="${esc(item.alt)}"></label>
        <label>Məhsul keçidi<input value="https://mirpanel.com/mehsul/${esc(slug)}" readonly></label>
        <label>Sıra<input type="number" min="1" max="${orderedProducts.length}" data-product-banner="${esc(path)}.order" value="${item.order}"></label>
      </div>
      <button class="btn primary" type="button" data-save-banner>Yadda saxla</button>
      <small>Yadda saxla dəyişiklikləri yayıma hazırlayır. Canlı sayta çıxarmaq üçün yuxarıdakı Yayımla düyməsini basın.</small>
    </div>`;
    }

    cms().supportCard ||= { desktopImage: "assets/support.png", mobileImage: "", title: "", workHours: "", alt: "Canlı Dəstək", url: "", enabled: true };
    const support = cms().supportCard;
    el("supportCardEditor").innerHTML = `<div class="cmsListItem bannerEditorCard">
      <div class="bannerImageGrid">
        ${imageEditor("supportCard.desktopImage", "Desktop şəkli", support.desktopImage, support._desktopPreview)}
        ${imageEditor("supportCard.mobileImage", "Mobil şəkli (boşdursa desktop işlənir)", support.mobileImage, support._mobilePreview || support._desktopPreview)}
      </div>
      <div class="formGrid">
        ${field("Başlıq", "supportCard.title")}${field("İş saatı", "supportCard.workHours")}
        ${field("Alternativ mətn (alt)", "supportCard.alt")}${field("Keçid ünvanı", "supportCard.url")}
        ${field("Aktiv", "supportCard.enabled", { type: "checkbox" })}
      </div>
    </div>`;
  }
  function renderBlocks(key) {
    const container = document.querySelector(`[data-block-list="${key}"]`);
    if (!container) return;
    if (key === "haqqimizda") {
      container.innerHTML = ensurePage(key).blocks.map((block, index) => `<div class="cmsListItem"><div class="formGrid">
        <label>Sıra<input type="number" data-page-block="${key}.${index}.order"></label>
        <label class="full">Abzas mətni<textarea rows="5" data-page-block="${key}.${index}.text"></textarea></label>
      </div><button class="btn danger" type="button" data-remove-block="${key}" data-index="${index}">Sil</button></div>`).join("");
    } else {
    container.innerHTML = ensurePage(key).blocks.map((block, index) => `<div class="cmsListItem"><div class="formGrid">
      <label>Başlıq<input data-page-block="${key}.${index}.title"></label>
      <label>Sıra<input type="number" data-page-block="${key}.${index}.order"></label>
      <label class="full">Mətn<textarea rows="4" data-page-block="${key}.${index}.text"></textarea></label>
      <label class="full">Şəkil yolu<input data-page-block="${key}.${index}.image"></label>
    </div><button class="btn danger" type="button" data-remove-block="${key}" data-index="${index}">Sil</button></div>`).join("");
    }
    container.querySelectorAll("[data-page-block]").forEach((input) => {
      const [, index, fieldKey] = input.dataset.pageBlock.split(".");
      input.value = ensurePage(key).blocks[Number(index)][fieldKey] ?? "";
      input.addEventListener("input", () => {
        ensurePage(key).blocks[Number(index)][fieldKey] = input.type === "number" ? Number(input.value) : input.value;
        markDirty();
      });
    });
  }
  function populateBoundInputs() {
    document.querySelectorAll("[data-cms]").forEach((input) => {
      const current = value(input.dataset.cms);
      if (input.type === "checkbox") input.checked = Boolean(current);
      else input.value = current ?? "";
    });
    document.querySelectorAll("[data-site]").forEach((input) => {
      const [pageKey, fieldKey] = input.dataset.site.split(".");
      const current = ensurePage(pageKey)[fieldKey];
      if (input.type === "checkbox") input.checked = current !== false;
      else input.value = current ?? "";
    });
  }
  function renderSections() {
    el("homepageSections").innerHTML = cms().homepage.sectionOrder.map((key, index) => `<div class="cmsListItem compact"><strong>${esc(key)}</strong><label>Sıra<input type="number" min="1" value="${index + 1}" data-section-order="${esc(key)}"></label><label class="switchLine"><input type="checkbox" data-cms="homepage.sections.${esc(key)}"><span>Aktiv</span></label></div>`).join("");
    el("homepageSections").querySelectorAll("[data-section-order]").forEach((input) => input.addEventListener("change", () => {
      const order = Math.max(1, Math.min(cms().homepage.sectionOrder.length, Number(input.value) || 1));
      const current = cms().homepage.sectionOrder.indexOf(input.dataset.sectionOrder);
      const [item] = cms().homepage.sectionOrder.splice(current, 1);
      cms().homepage.sectionOrder.splice(order - 1, 0, item);
      markDirty(); renderSections(); populateBoundInputs();
    }));
  }
  function renderTexts() {
    const labels = {
      available: "Mövcuddur", outOfStock: "Stokda yoxdur", selectDuration: "Müddət seçin",
      order: "Sifariş et", productAbout: "Məhsul haqqında", usageRules: "İstifadə qaydaları",
      relatedProducts: "Oxşar məhsullar", moreProducts: "Daha çox məhsul", instantDelivery: "Təqdimat mətni",
      close: "Bağla", confirm: "Təsdiqləyirəm", cancel: "Ləğv et", sendWhatsapp: "WhatsApp-a göndər",
      requiredField: "Məcburi sahə xətası", invalidEmail: "E-poçt xətası", noSearchResults: "Axtarış nəticəsi yoxdur",
      bundleTitle: "Paket başlığı", bundleButton: "Paket düyməsi"
    };
    el("commonTextFields").innerHTML = Object.keys(cms().commonTexts).map((key) => field(labels[key] || key, `commonTexts.${key}`, { full: true })).join("");
  }
  function renderMedia() {
    const serialized = JSON.stringify({
      products: state.data.products,
      homepage: cms().homepage,
      navigation: cms().navigation,
      banners: cms().banners,
      footer: cms().footer,
      pages: state.data.siteSections
    });
    el("mediaList").innerHTML = cms().media.map((item, index) => {
      const usageCount = item.path ? serialized.split(item.path).length - 1 : 0;
      const name = item.name || String(item.path || "").split("/").at(-1) || "Adsız şəkil";
      return `<article class="mediaCard" data-media-card="${index}"><img src="${esc(item._preview || cmsImageUrl(item.path))}" alt="${esc(item.alt || name)}" data-media-dimensions="${index}"><strong>${esc(name)}</strong><small>${esc(item.type || "Naməlum format")} · ${Math.ceil(Number(item.size || 0) / 1024)} KB</small><small data-media-pixels="${index}">${item.width && item.height ? `${item.width} × ${item.height} px` : "Ölçü müəyyən edilir..."}</small><small>${usageCount ? `${usageCount} yerdə istifadə olunur` : "Hazırda istifadə olunmur"}</small><div class="mediaActions"><button class="btn" type="button" data-select-media="${index}">Seç</button><button class="btn" type="button" data-rename-media="${index}">Adını dəyiş</button><label class="btn filePickerButton">Əvəz et<input class="hidden" type="file" accept="image/jpeg,image/png,image/webp" data-replace-media="${index}"></label><button class="btn danger" type="button" data-delete-media="${index}" data-usage-count="${usageCount}">Sil</button></div><details><summary>Ətraflı məlumat</summary><code>${esc(item.path)}</code></details></article>`;
    }).join("");
    el("mediaList").querySelectorAll("[data-media-dimensions]").forEach((image) => {
      const update = () => {
        const index = Number(image.dataset.mediaDimensions);
        const item = cms().media[index];
        if (!item || !image.naturalWidth) return;
        item.width = image.naturalWidth;
        item.height = image.naturalHeight;
        const output = document.querySelector(`[data-media-pixels="${index}"]`);
        if (output) output.textContent = `${item.width} × ${item.height} px`;
      };
      image.addEventListener("load", update, { once: true });
      image.addEventListener("error", () => {
        image.closest(".mediaCard")?.classList.add("broken");
        const output = document.querySelector(`[data-media-pixels="${image.dataset.mediaDimensions}"]`);
        if (output) output.textContent = "Şəkil yüklənmədi — fayl yolu və deploy vəziyyətini yoxlayın.";
      }, { once: true });
      if (image.complete) update();
    });
  }

  function replacePathDeep(value, oldPath, newPath) {
    if (Array.isArray(value)) return value.forEach((item) => replacePathDeep(item, oldPath, newPath));
    if (!value || typeof value !== "object") return;
    for (const [key, current] of Object.entries(value)) {
      if (typeof current === "string" && current === oldPath) value[key] = newPath;
      else replacePathDeep(current, oldPath, newPath);
    }
  }

  async function replaceMedia(index, file) {
    const item = cms().media[index];
    if (!item || !file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) return toast("Yalnız JPG, PNG və WEBP, maksimum 5 MB.", "bad");
    setLoading(true, "Şəkil əvəz edilir...");
    try {
      const contentBase64 = await readFileAsBase64(file);
      const result = await api("/api/upload-product-image", { method: "POST", body: JSON.stringify({ productId: "media", fileName: file.name, mimeType: file.type, contentBase64 }) });
      if (result.filePath && !state.pendingUploads.includes(result.filePath)) state.pendingUploads.push(result.filePath);
      const oldPath = item.path;
      replacePathDeep(state.data, oldPath, result.publicPath);
      Object.assign(item, { path: result.publicPath, _preview: result.previewDataUrl, name: file.name, size: file.size, type: file.type, uploadedAt: result.uploadedAt });
      markDirty(); renderCms(); toast("Şəkil əvəz edildi. İstifadə olunan bölmələr yeni şəkilə bağlandı.");
    } catch (error) { toast(error.message, "bad"); }
    finally { setLoading(false); }
  }
  function renderDashboard() {
    if (!state.data || !cms()) {
      el("cmsDashboardCards").innerHTML = '<div class="emptyMini">Məlumatlar yüklənir...</div>';
      return;
    }
    el("cmsDashboardCards").innerHTML = [
      ["Məhsullar", state.data.products.length],
      ["Aktiv məhsullar", state.data.products.filter((item) => item.active !== false).length],
      ["Kateqoriyalar", state.data.categories.length],
      ["Bannerlər", state.data.products.filter((item) => item.active !== false && ensureProductBanner(item).enabled !== false).length],
      ["Media", cms().media.length],
      ["Yayımlanmamış dəyişiklik", state.dirty ? "Var" : "Yoxdur"]
    ].map(([label, count]) => `<div class="stat"><strong>${esc(count)}</strong><span>${esc(label)}</span></div>`).join("");
  }
  function renderCms() {
    if (!cms()) return;
    syncFooterProjection();
    if (!state.dirty && (baselineSha !== state.baseSha || !baselineData)) {
      baselineData = structuredClone(state.data);
      baselineSha = state.baseSha;
    }
    renderDashboard(); renderSections(); renderLinks("navigation", "navigationList");
    renderBanners(); renderTexts(); renderMedia();
    ["haqqimizda", "elaqe", "sertler"].forEach(renderBlocks);
    populateBoundInputs();
  }
  function enhanceProducts() {
    const form = el("productForm");
    if (!form || el("cmsProductFields")) return;
    const section = document.createElement("div");
    section.id = "cmsProductFields";
    section.innerHTML = `<div class="sectionHead"><div><h3>Geniş məzmun və SEO</h3><p>Məhsul kartı, ayrıca səhifə və JSON-LD üçün vahid məlumat</p></div></div><div class="formGrid">
      <label>Şəkil alt mətni<input data-product-extra="imageAlt"></label>
      <label>Təqdimat mətni<input data-product-extra="deliveryText"></label>
      <label>Mövcudluq mətni<input data-product-extra="availabilityText"></label>
      <label>Forma başlığı<input data-product-extra="formTitle"></label>
      <label class="full">Geniş açıqlama<textarea rows="6" data-product-extra="longDescription"></textarea></label>
      <label class="full">İstifadə qaydaları<textarea rows="6" data-product-extra="usageRules"></textarea></label>
      <label>H1 başlığı<input data-product-extra="seoH1"></label>
      <label>Əsas açar ifadə<input data-product-extra="seoPrimaryKeyword"></label>
      <label class="full">Əlaqəli açar ifadələr<textarea data-product-extra="seoRelatedKeywords"></textarea></label>
      <label>Open Graph title<input data-product-extra="seoOgTitle"></label>
      <label>Sosial paylaşım şəkli<input data-product-extra="seoOgImage" placeholder="Boş olduqda əsas məhsul şəkli istifadə edilir"></label>
      <label class="full">Open Graph description<textarea data-product-extra="seoOgDescription"></textarea></label>
      <label class="switchLine"><input type="checkbox" data-product-extra="seoIndex"><span>İndekslənsin</span></label>
      <label class="switchLine"><input type="checkbox" data-product-extra="includeInSitemap"><span>Sitemap-a daxil olsun</span></label>
    </div>`;
    const deleteSection = el("deleteProductBtn")?.closest(".dangerZone");
    if (deleteSection?.parentNode === form) form.insertBefore(section, deleteSection);
    else form.appendChild(section);
    el("productId").readOnly = true;
    el("productId").title = "ID məhsul yaradıldıqdan sonra qorunur.";
    section.addEventListener("input", (event) => {
      const key = event.target.dataset.productExtra;
      const product = selectedProduct();
      if (!key || !product) return;
      product[key] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
      markDirty();
    });
    organizeProductForm(form, section);
  }

  function organizeProductForm(form, section) {
    if (form.querySelector(".productFormGroups")) return;
    const hero = form.querySelector(".editorHero");
    const groups = document.createElement("div");
    groups.className = "productFormGroups";
    hero.insertAdjacentElement("afterend", groups);
    const makeGroup = (title, description, open = false) => {
      const details = document.createElement("details");
      details.className = "adminAccordion productGroup";
      details.open = open;
      details.innerHTML = `<summary><span>${esc(title)}</span><small>${esc(description)}</small></summary><div class="productGroupBody"></div>`;
      groups.appendChild(details);
      return details.querySelector(".productGroupBody");
    };
    const basic = makeGroup("Əsas məlumatlar", "Ad, kateqoriya, şəkil və qısa təsvir", true);
    const pricing = makeGroup("Qiymət və planlar", "Planlar, qiymətlər və stok vəziyyəti", true);
    const orders = makeGroup("Sifariş və müştəri forması", "Sifariş addımları, forma sahələri və təsdiq", false);
    const advanced = makeGroup("Geniş parametrlər", "SEO, schema, texniki ID və nadir parametrlər", false);
    const grids = [basic, pricing, advanced].map((body) => {
      const grid = document.createElement("div");
      grid.className = "formGrid";
      body.appendChild(grid);
      return grid;
    });
    const moveControl = (id, target) => {
      const control = el(id);
      const owner = control?.closest("label") || control?.closest(".imageUploadBox");
      if (owner) target.appendChild(owner);
      return owner;
    };
    ["productOrder", "productTitle", "productVariant", "productCategory", "productImage", "productBadge", "productDesc", "productNote"].forEach((id) => moveControl(id, grids[0]));
    const imageUpload = el("productImagePickBtn")?.closest(".imageUploadBox");
    if (imageUpload) grids[0].appendChild(imageUpload);
    ["productCurrency", "productSoldOut", "productStock", "productStockEnabled", "productBestSeller"].forEach((id) => {
      moveControl(id, grids[1]);
    });
    form.querySelectorAll(".fieldHelp").forEach((help) => grids[1].appendChild(help));
    ["productId", "productFlow", "productSeller"].forEach((id) => moveControl(id, grids[2]));
    const moveSection = (controlId, target) => {
      const control = el(controlId);
      const block = control?.closest(".confirmationSettings") || control;
      const heading = block?.previousElementSibling?.classList.contains("sectionHead") ? block.previousElementSibling : null;
      if (heading) target.appendChild(heading);
      if (block) target.appendChild(block);
    };
    const plans = el("plans");
    if (plans) { if (plans.previousElementSibling?.classList.contains("sectionHead")) pricing.appendChild(plans.previousElementSibling); pricing.appendChild(plans); }
    moveSection("productOrderFlow", orders);
    const formFields = el("formFields");
    if (formFields) { if (formFields.previousElementSibling?.classList.contains("sectionHead")) orders.appendChild(formFields.previousElementSibling); orders.appendChild(formFields); }
    moveSection("orderConfirmationEnabled", orders);
    moveSection("whatsappExtraMessage", orders);
    moveSection("productSeoSlug", advanced);
    ["aboutHtml", "rulesHtml"].forEach((id) => moveControl(id, advanced));
    if (section.parentNode === form) advanced.appendChild(section);
    const danger = el("deleteProductBtn")?.closest(".dangerZone");
    if (danger) advanced.appendChild(danger);
    form.querySelectorAll(":scope > .formGrid").forEach((grid) => { if (!grid.children.length) grid.remove(); });
  }
  function enhanceCategories() {
    const row = el("categoriesView")?.querySelector("thead tr");
    if (!row || row.querySelector("[data-cms-category-head]")) return;
    const productCountHead = row.children[3];
    ["İkon", "Aktiv"].forEach((label) => {
      const head = document.createElement("th");
      head.dataset.cmsCategoryHead = "1";
      head.textContent = label;
      row.insertBefore(head, productCountHead);
    });
  }
  function renderProductExtras() {
    const product = selectedProduct();
    document.querySelectorAll("[data-product-extra]").forEach((input) => {
      const current = product?.[input.dataset.productExtra];
      if (input.type === "checkbox") input.checked = current !== false;
      else input.value = current ?? "";
    });
  }
  async function preview() {
    if (!state.data) return;
    setLoading(true, "Məzmun yoxlanılır...");
    try {
      const result = await api("/api/admin/preview", {
        method: "POST",
        body: JSON.stringify({ baseSha: state.baseSha, data: payloadWithoutTransientPreviews(state.data) })
      });
      state.previewDigest = result.previewDigest;
      const previewResult = el("cmsPreviewResult");
      previewResult.innerHTML = `<strong>Önizləmə uğurludur.</strong><p>${result.productCount} məhsul, ${result.activeProductCount} aktiv məhsul, ${result.pageCount} statik səhifə.</p>${result.warnings.map((warning) => `<p class="bad">${esc(warning)}</p>`).join("")}`;
      if (result.aboutPreviewHtml) {
        const heading = document.createElement("h3");
        heading.textContent = "Haqqımızda səhifəsinin real önizləməsi";
        const frame = document.createElement("iframe");
        frame.className = "cmsPagePreview";
        frame.title = "Haqqımızda səhifəsinin önizləməsi";
        frame.setAttribute("sandbox", "");
        frame.srcdoc = result.aboutPreviewHtml;
        previewResult.append(heading, frame);
      }
      if (result.termsPreviewHtml) {
        const heading = document.createElement("h3");
        heading.textContent = "Şərtlər səhifəsinin real önizləməsi";
        const frame = document.createElement("iframe");
        frame.className = "cmsPagePreview";
        frame.title = "Şərtlər səhifəsinin önizləməsi";
        frame.setAttribute("sandbox", "");
        frame.srcdoc = result.termsPreviewHtml;
        previewResult.append(heading, frame);
      }
      toast("Önizləmə və yoxlamalar uğurla tamamlandı.");
      return result;
    } catch (error) {
      state.previewDigest = "";
      el("cmsPreviewResult").textContent = error.message;
      toast(error.message, "bad");
      return null;
    } finally { setLoading(false); }
  }
  function changedSections() {
    if (!baselineData || !state.data) return ["Sayt məlumatları"];
    const checks = [
      ["Məhsullar", "products"], ["Kateqoriyalar", "categories"], ["Ana səhifə", "cms.homepage"],
      ["Naviqasiya və keçidlər", "cms.navigation"], ["Haqqımızda", "siteSections.haqqimizda"],
      ["Əlaqə", "siteSections.elaqe"], ["Şərtlər", "siteSections.sertler"], ["Şəkil kitabxanası", "cms.media"],
      ["Sifariş parametrləri", "cms.orderSettings"], ["SEO və sitemap", "cms.seo"]
    ];
    const get = (source, path) => path.split(".").reduce((current, key) => current?.[key], source);
    return checks.filter(([, path]) => JSON.stringify(get(baselineData, path)) !== JSON.stringify(get(state.data, path))).map(([label]) => label);
  }
  async function showPublishDialog() {
    if (!state.dirty) return toast("Yayımlanacaq dəyişiklik yoxdur.", "bad");
    const sections = changedSections();
    const result = await preview();
    if (!result) return;
    openModal("Dəyişiklikləri yoxlayın", `<div class="publishReview"><p>Avtomatik önizləmə və təhlükəsizlik yoxlamaları uğurla tamamlandı.</p><strong>Dəyişən bölmələr</strong><ul>${sections.map((section) => `<li>${esc(section)}</li>`).join("")}</ul><p>${result.productCount} məhsul · ${result.activeProductCount} aktiv məhsul · ${result.pageCount} statik səhifə</p>${result.warnings.map((warning) => `<p class="warningBox">${esc(warning)}</p>`).join("")}</div>`, "Təsdiqlə və yayımla", async () => {
      const confirmButton = el("modalConfirm");
      confirmButton.disabled = true;
      await publishAndMonitor();
      confirmButton.disabled = false;
      if (state.lastPublishResult && !state.dirty) {
        baselineData = structuredClone(state.data);
        baselineSha = state.baseSha;
        el("modalBody").innerHTML = `<div class="previewResult"><strong>Yayım uğurla başladıldı.</strong><p>Commit: ${esc(state.lastPublishResult.commitSha)}</p></div>`;
        el("modalConfirm").classList.add("hidden");
        el("modalCancel").textContent = "Bağla";
      }
    });
  }
  async function publishAndMonitor() {
    state.lastPublishResult = null;
    await saveState();
    const published = state.lastPublishResult;
    if (!published) return;
    state.publishStatus = "cloudflare";
    renderStats();
    const selectedProduct = state.data.products.find((item) => item.id === selectedBannerProductId);
    const liveImagePath = selectedProduct
      ? (ensureProductBanner(selectedProduct).desktopImage || selectedProduct.image || "")
      : "";
    el("cmsPreviewResult").textContent = `Commit ${published.commitSha.slice(0, 12)} yaradıldı. Cloudflare və Render yoxlanılır...`;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      try {
        const status = await api(`/api/admin/deploy-status?appSha=${encodeURIComponent(published.sha)}&imagePath=${encodeURIComponent(liveImagePath)}`);
        const image = status.cloudflare.bannerImage || {};
        el("cmsPreviewResult").innerHTML = `<strong>Commit: ${esc(published.commitSha)}</strong><p>Cloudflare: HTTP ${status.cloudflare.status} — ${status.cloudflare.live ? "yeni məzmun canlıdır" : "deploy gözlənilir"}</p>${liveImagePath ? `<p>Banner şəkli: HTTP ${Number(image.status || 0)} · ${esc(image.contentType || "yoxlanılır")}</p>` : ""}<p>Render: ${esc(status.render.url)} — HTTP ${status.render.status}</p>`;
        if (status.cloudflare.live && status.render.live) {
          state.publishStatus = "live";
          renderStats();
          toast("Cloudflare və Render canlı yoxlaması uğurludur.");
          return;
        }
      } catch (error) {
        el("cmsPreviewResult").textContent = error.message;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    state.publishStatus = "cloudflare";
    renderStats();
    toast("Commit yaradıldı, deploy hələ tamamlanmayıb. Statusu yenidən yoxlayın.", "bad");
  }
  async function uploadMedia() {
    const file = el("cmsMediaFile").files?.[0];
    if (!file) return toast("Şəkil seçin.", "bad");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      return toast("Yalnız JPG, PNG və WEBP, maksimum 5 MB.", "bad");
    }
    setLoading(true, "Şəkil yüklənir...");
    try {
      const contentBase64 = await readFileAsBase64(file);
      const result = await api("/api/upload-product-image", {
        method: "POST",
        body: JSON.stringify({ productId: "media", fileName: file.name, mimeType: file.type, contentBase64 })
      });
      if (result.filePath && !state.pendingUploads.includes(result.filePath)) state.pendingUploads.push(result.filePath);
      cms().media.push({ path: result.publicPath, _preview: result.previewDataUrl, alt: el("cmsMediaAlt").value, size: file.size, type: file.type, uploadedAt: result.uploadedAt });
      markDirty(); renderMedia(); toast("Şəkil media kitabxanasına əlavə edildi.");
    } catch (error) { toast(error.message, "bad"); }
    finally { setLoading(false); }
  }
  async function loadHistory() {
    try {
      const result = await api("/api/admin/history");
      el("historyList").innerHTML = result.items.map((item) => `<article class="cmsListItem"><strong>${esc(item.message)}</strong><span>${new Date(item.date).toLocaleString("az-AZ")}</span><code>${esc(item.sha.slice(0, 12))}</code><small>${esc(item.deployStatus)}</small><button class="btn" type="button" data-restore-sha="${esc(item.sha)}">Bu məzmunu önizlə</button></article>`).join("");
      el("historyList").querySelectorAll("[data-restore-sha]").forEach((button) => {
        button.addEventListener("click", async () => {
          if (!confirm("Yalnız seçilmiş commitdəki sayt məzmunu önizləməyə gətirilsin? Yayımlanana qədər canlı sayt dəyişməyəcək.")) return;
          try {
            const restored = await api("/api/admin/restore-preview", {
              method: "POST",
              body: JSON.stringify({ targetSha: button.dataset.restoreSha })
            });
            state.data = restored.data;
            state.baseSha = restored.baseSha;
            state.previewDigest = restored.previewDigest;
            state.dirty = true;
            syncAllProducts();
            renderAll();
            toast(`${restored.restoredFrom.slice(0, 12)} commitinin məzmunu önizləməyə gətirildi. Yayımla düyməsinə basmadan canlı sayt dəyişməyəcək.`);
          } catch (error) { toast(error.message, "bad"); }
        });
      });
    } catch (error) { toast(error.message, "bad"); }
  }
  function installActions() {
    el("cmsMediaUpload").addEventListener("click", uploadMedia);
    el("cmsMediaPick").addEventListener("click", () => el("cmsMediaFile").click());
    el("cmsMediaFile").addEventListener("change", () => {
      el("cmsMediaFileName").textContent = el("cmsMediaFile").files?.[0]?.name || "Şəkil seçilməyib";
    });
    el("refreshHistory").addEventListener("click", loadHistory);
    el("netflixAccountAdd")?.addEventListener("click", async () => { const input = el("netflixAccountEmail"); try { await api("/api/admin/netflix-accounts", { method: "POST", body: JSON.stringify({ email: input.value }) }); input.value = ""; await loadNetflixAccounts(); toast("Netflix hesabı əlavə edildi."); } catch (error) { toast(error.message, "bad"); } });
    el("netflixAccountSearch")?.addEventListener("input", () => loadNetflixAccounts());
    el("netflixAccountsList")?.addEventListener("click", async (event) => { const toggle = event.target.closest("[data-netflix-toggle]"); const remove = event.target.closest("[data-netflix-delete]"); try { if (toggle) { await api(`/api/admin/netflix-accounts/${encodeURIComponent(toggle.dataset.netflixToggle)}`, { method: "PATCH", body: JSON.stringify({ active: toggle.dataset.active === "true" }) }); await loadNetflixAccounts(); } else if (remove && confirm("Bu Netflix hesabı siyahıdan deaktiv ediləcək. Davam edilsin?")) { await api(`/api/admin/netflix-accounts/${encodeURIComponent(remove.dataset.netflixDelete)}`, { method: "DELETE" }); await loadNetflixAccounts(); } } catch (error) { toast(error.message, "bad"); } });
    el("saveBtn").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showPublishDialog();
    }, true);
    window.addEventListener("beforeunload", (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }
  function installHooks() {
    const originalRenderAll = renderAll;
    renderAll = function (...args) {
      const result = originalRenderAll.apply(this, args);
      renderCms(); renderProductExtras();
      return result;
    };
    const originalRenderProductForm = renderProductForm;
    renderProductForm = function (...args) {
      const result = originalRenderProductForm.apply(this, args);
      renderProductExtras();
      return result;
    };
    showView = activateView;
    confirmDeleteCategory = function (index) {
      const category = state.data.categories[index];
      const affected = state.data.products.filter((product) => product.category === category.key);
      const alternatives = state.data.categories
        .filter((_, itemIndex) => itemIndex !== index)
        .map((item) => `<option value="${esc(item.key)}">${esc(item.name)}</option>`)
        .join("");
      openModal(
        "Kateqoriyanı sil",
        `<p>${esc(category.name)} silinsin?</p>${affected.length ? `<label>${affected.length} məhsul üçün alternativ kateqoriya<select id="categoryReplacement"><option value="all">Kateqoriyasız</option>${alternatives}</select></label>` : ""}`,
        "Sil",
        () => {
          const replacement = affected.length ? el("categoryReplacement")?.value : "all";
          if (affected.length && !replacement) return toast("Alternativ kateqoriya seçin.", "bad");
          affected.forEach((product) => { product.category = replacement; });
          state.data.categories.splice(index, 1);
          markDirty();
          renderAll();
          closeModal();
        }
      );
    };
  }
  function boot() {
    document.querySelector('[data-view="siteSections"]')?.remove();
    el("siteSectionsView")?.remove();
    installNavigation();
    createStaticViews();
    enhanceProducts();
    enhanceCategories();
    bindInputs();
    installActions();
    installHooks();
    if (state.data) renderCms();
    activateView("dashboard");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
