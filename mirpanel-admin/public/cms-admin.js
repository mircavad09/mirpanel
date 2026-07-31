(function () {
  const viewLabels = [
    ["dashboard", "İdarə paneli"],
    ["products", "Məhsullar"],
    ["categories", "Kateqoriyalar"],
    ["homepage", "Ana səhifə"],
    ["navigation", "Naviqasiya və header"],
    ["banners", "Bannerlər"],
    ["about", "Haqqımızda"],
    ["contact", "Əlaqə"],
    ["terms", "Şərtlər"],
    ["footer", "Footer"],
    ["texts", "Ümumi mətnlər"],
    ["seo", "SEO və sitemap"],
    ["media", "Media/şəkillər"],
    ["orders", "Sifariş parametrləri"],
    ["publish", "Önizləmə və yayımlama"],
    ["history", "Dəyişiklik tarixçəsi"]
  ];
  const safeIcons = ["home", "products", "search", "info", "contact", "terms", "whatsapp", "sparkles", "game", "ai", "link", "image", "shield"];

  function el(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }
  function repairText(value) {
    const replacements = {
      "Ã‰â„¢": "ə", "Ã†Â": "Ə", "Ã„Â±": "ı", "Ã„Â°": "İ",
      "ÃƒÂ¶": "ö", "Ãƒâ€“": "Ö", "ÃƒÂ¼": "ü", "ÃƒÅ“": "Ü",
      "Ã…Å¸": "ş", "Ã…Å¾": "Ş", "ÃƒÂ§": "ç", "Ãƒâ€¡": "Ç",
      "Ã„Å¸": "ğ", "Ã„Å¾": "Ğ", "Ã¢â€šÂ¼": "₼",
      "É™": "ə", "Æ": "Ə", "Ä±": "ı", "ÅŸ": "ş", "Åž": "Ş",
      "Ã¶": "ö", "Ã¼": "ü", "Ã§": "ç", "ÄŸ": "ğ"
    };
    return Object.entries(replacements).reduce(
      (text, [broken, correct]) => text.split(broken).join(correct),
      String(value ?? "")
    );
  }
  function repairAdminDom(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const repaired = repairText(node.nodeValue);
      if (repaired !== node.nodeValue) node.nodeValue = repaired;
    }
    root.querySelectorAll?.("[placeholder], [title], [aria-label]").forEach((element) => {
      ["placeholder", "title", "aria-label"].forEach((attribute) => {
        if (element.hasAttribute(attribute)) element.setAttribute(attribute, repairText(element.getAttribute(attribute)));
      });
    });
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
    markDirty();
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
    nav.innerHTML = viewLabels.map(([id, label], index) =>
      `<button class="navBtn${index === 0 ? " active" : ""}" type="button" data-view="${id}">${label}</button>`
    ).join("");
    nav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (button) showView(button.dataset.view);
    });
  }
  function createStaticViews() {
    createView("dashboard", panel("İdarə paneli", "Sayt məzmununun ümumi vəziyyəti", '<div class="cmsCards" id="cmsDashboardCards"></div>'));
    createView("homepage", panel("Ana səhifə", "Mövcud dizaynı dəyişmədən ana səhifə mətnlərini idarə et", `<div class="formGrid">
      ${field("Brend adı", "site.brandName")}${field("Loqo yolu", "site.logo")}
      ${field("Brend alt yazısı", "site.brandSubtitle", { full: true })}
      ${field("Elan aktivdir", "homepage.announcement.enabled", { type: "checkbox" })}
      ${field("Elan mətni", "homepage.announcement.text", { full: true })}
      ${field("Əsas başlıq", "homepage.hero.title", { full: true })}
      ${field("Əsas açıqlama", "homepage.hero.description", { type: "textarea", full: true })}
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
    </div><div class="sectionHead"><div><h3>Bölmələrin sırası və görünməsi</h3></div></div><div id="homepageSections" class="cmsList"></div>`));
    createView("navigation", panel("Naviqasiya və header", "Daxili keçidlər eyni tabda açılır; yalnız təhlükəsiz ikonlar istifadə olunur", `<div class="formGrid">
      ${field("Brend adı", "site.brandName")}${field("Loqo yolu", "site.logo")}
    </div><div class="sectionHead"><h3>Naviqasiya elementləri</h3><button class="btn" type="button" data-add-list="navigation">Keçid əlavə et</button></div><div id="navigationList" class="cmsList"></div>`));
    createView("banners", panel("Bannerlər", "Hər məhsulun banneri həmin məhsulun vahid məlumatından avtomatik yaranır", '<div class="sectionHead"><h3>Məhsul bannerləri</h3></div><label class="bannerProductPicker">Məhsulu seç<select id="bannerProductSelect"></select></label><div id="bannerProductEditor"></div><div class="sectionHead"><h3>Canlı Dəstək böyük şəkli</h3></div><div id="supportCardEditor"></div>'));
    createView("about", pageForm("haqqimizda", "Haqqımızda"));
    createView("contact", contactForm());
    createView("terms", termsForm());
    createView("footer", panel("Footer", "Bütün səhifələr üçün vahid footer məlumatları", `<div class="formGrid">
      ${field("Müəllif hüquqları mətni", "footer.copyrightText", { full: true })}
      ${field("İl", "footer.year", { type: "number", min: 2000, max: 2200 })}
      ${field("Brend adı", "footer.brandName")}${field("Telefon", "footer.phone")}
      ${field("WhatsApp nömrəsi", "footer.whatsapp")}
      ${field("Əlavə qısa mətn", "footer.shortText", { type: "textarea", full: true })}
    </div><div class="sectionHead"><h3>Footer keçidləri</h3><button class="btn" type="button" data-add-list="footerLinks">Keçid əlavə et</button></div><div id="footerLinkList" class="cmsList"></div>`));
    createView("texts", panel("Ümumi mətnlər", "Boş sahələr saytda təhlükəsiz standart dəyərə qayıdır", '<div class="formGrid" id="commonTextFields"></div>'));
    createView("seo", panel("SEO və sitemap", "Canonical, Open Graph və indekslənmə parametrləri", `<div class="warningBox">“Noindex” seçimi səhifənin axtarış nəticələrindən çıxmasına səbəb ola bilər.</div><div class="formGrid">
      ${field("Ana səhifə SEO title", "seo.home.title")}
      ${field("Ana səhifə meta description", "seo.home.description", { type: "textarea", full: true })}
      ${field("Open Graph title", "seo.home.ogTitle")}
      ${field("Open Graph şəkli", "seo.home.ogImage")}
      ${field("Open Graph description", "seo.home.ogDescription", { type: "textarea", full: true })}
      ${field("Sayt indekslənsin", "seo.robotsIndexing", { type: "checkbox" })}
      ${field("Ana səhifə sitemap-a daxil olsun", "seo.home.includeInSitemap", { type: "checkbox" })}
    </div><div class="canonicalPreview">Canonical: https://mirpanel.com/</div><div id="seoProductWarnings"></div>`));
    createView("media", panel("Media/şəkillər", "JPG, PNG və WEBP; maksimum 5 MB", `<div class="mediaUpload"><input id="cmsMediaFile" type="file" accept="image/jpeg,image/png,image/webp"><label>Alt mətn<input id="cmsMediaAlt"></label><button class="btn primary" id="cmsMediaUpload" type="button">Şəkil yüklə</button></div><div id="mediaList" class="mediaGrid"></div>`));
    createView("orders", panel("Sifariş parametrləri", "Bütün məhsullar üçün ortaq sifariş və WhatsApp mətnləri", `<div class="formGrid">
      ${field("WhatsApp düyməsinin mətni", "orderSettings.whatsappButtonText")}
      ${field("WhatsApp nömrəsi", "site.whatsappNumber")}
      ${field("Ekranda görünən telefon", "site.phoneDisplay")}
      ${field("Standart əlavə mesaj", "orderSettings.defaultExtraMessage", { type: "textarea", full: true })}
      ${field("Standart təsdiq tələb olunsun", "orderSettings.requireConfirmation", { type: "checkbox" })}
    </div>`));
    createView("publish", panel("Önizləmə və yayımlama", "Dəyişikliklər doğrulanmadan GitHub-a göndərilmir", `<div class="publishFlow">
      <div class="publishStep"><strong>1. Önizləmə</strong><p>Məlumat, slug, səhifə və təhlükəsizlik yoxlamalarını işə salır.</p><button class="btn" id="cmsPreviewBtn" type="button">Önizlə və yoxla</button></div>
      <div class="publishStep"><strong>2. Yayımla</strong><p>Yalnız uğurlu önizləmədən sonra atomik GitHub commit yaradır.</p><button class="btn primary" id="cmsPublishBtn" type="button">Yayımla</button></div>
      <div id="cmsPreviewResult" class="previewResult">Hələ önizləmə aparılmayıb.</div>
    </div>`));
    createView("history", panel("Dəyişiklik tarixçəsi", "Məxfi məlumatlar göstərilmir", '<button class="btn" id="refreshHistory" type="button">Tarixçəni yenilə</button><div id="historyList" class="cmsList"></div>'));
  }
  function pageForm(key, label) {
    if (key === "haqqimizda") {
      return panel(label, "Haqqımızda səhifəsinin məzmunu, keçidləri və SEO məlumatları", `<div class="formGrid" data-site-page="${key}">
        ${siteField("Aktivdir", key, "enabled", "checkbox")}${siteField("Slug", key, "slug")}
        ${siteField("Kiçik üst etiket", key, "kicker")}${siteField("Əsas H1", key, "title")}
        ${siteField("Giriş mətni", key, "subtitle", "textarea", true)}
        ${siteField("Ana səhifə düyməsi", key, "homeButtonText")}${siteField("Ana səhifə keçidi", key, "homeButtonUrl")}
        ${siteField("Məhsullar düyməsi", key, "productsButtonText")}${siteField("Məhsullar keçidi", key, "productsButtonUrl")}
        ${siteField("Əlaqə keçidinin mətni", key, "contactLinkText")}${siteField("Əlaqə keçidinin URL-si", key, "contactLinkUrl")}
        ${siteField("SEO title", key, "seoTitle")}${siteField("Meta description", key, "seoDescription", "textarea", true)}
        ${siteField("Open Graph title", key, "ogTitle")}${siteField("Open Graph şəkli", key, "ogImage")}
        ${siteField("Open Graph description", key, "ogDescription", "textarea", true)}
        ${siteField("İndekslənsin", key, "index", "checkbox")}${siteField("Sitemap-a daxil olsun", key, "includeInSitemap", "checkbox")}
      </div><div class="sectionHead"><h3>Məzmun bölmələri</h3><button class="btn" type="button" data-add-block="${key}">Bölmə əlavə et</button></div><p class="formHint">Bölmə mətnində abzas, **qalın mətn**, siyahı və [daxili keçid](/elaqe/) istifadə edilə bilər. Təhlükəli HTML bloklanır.</p><div class="cmsList" data-block-list="${key}"></div>`);
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
    return panel("Şərtlər", "Təhlükəsiz formatlı qayda bölmələri", `<div class="formGrid">
      ${siteField("Aktivdir", "sertler", "enabled", "checkbox")}${siteField("Slug", "sertler", "slug")}
      ${siteField("H1", "sertler", "title")}${siteField("Giriş mətni", "sertler", "subtitle")}
      ${siteField("Əsas mətn", "sertler", "body", "richtext", true)}
      ${siteField("SEO title", "sertler", "seoTitle")}${siteField("Meta description", "sertler", "seoDescription", "textarea", true)}
    </div><div class="sectionHead"><h3>Qayda bölmələri</h3><button class="btn" type="button" data-add-block="sertler">Qayda əlavə et</button></div><div class="cmsList" data-block-list="sertler"></div>`);
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
        markDirty();
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
    const previewElement = document.querySelector(`[data-banner-preview="${CSS.escape(path)}"]`);
    const localPreview = URL.createObjectURL(file);
    if (previewElement) {
      previewElement.hidden = false;
      previewElement.src = localPreview;
    }
    setLoading(true, "Banner şəkli yüklənir...");
    try {
      const contentBase64 = await readFileAsBase64(file);
      const result = await api("/api/upload-product-image", {
        method: "POST",
        body: JSON.stringify({ productId: path.startsWith("supportCard") ? "support" : path.split(".")[1], fileName: file.name, mimeType: file.type, contentBase64 })
      });
      const owner = bannerImageOwner(path);
      owner.item[owner.field] = result.publicPath;
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
      toast("Şəkil bannerə əlavə edildi və Media bölməsində saxlanıldı.");
    } catch (error) {
      toast(error.message, "bad");
    } finally {
      URL.revokeObjectURL(localPreview);
      setLoading(false);
    }
  }
  function handleBannerChange(event) {
    const target = event.target;
    if (target.dataset.bannerUpload) {
      const file = target.files?.[0];
      if (file) uploadBannerImage(target.dataset.bannerUpload, file);
      return;
    }
    if (target.dataset.bannerMedia) {
      const path = target.dataset.bannerMedia;
      const selected = cms().media.find((item) => item.path === target.value);
      const owner = bannerImageOwner(path);
      owner.item[owner.field] = target.value;
      owner.item[owner.previewKey] = selected?._preview || "";
      markDirty();
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
  function handleClick(event) {
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
      const owner = bannerImageOwner(clearImage.dataset.clearBannerImage);
      owner.item[owner.field] = "";
      owner.item[owner.previewKey] = "";
      markDirty();
      renderBanners();
      populateBoundInputs();
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
    if (type === "navigation") cms().navigation.push({ id: `link-${Date.now()}`, label: "Yeni keçid", url: "/", order: cms().navigation.length + 1, enabled: true, icon: "link", newTab: false });
    if (type === "footerLinks") cms().footer.links.push({ id: `footer-${Date.now()}`, label: "Yeni keçid", url: "/", order: cms().footer.links.length + 1, enabled: true, icon: "link", newTab: false });
    markDirty(); renderCms();
  }
  function removeListItem(type, index) {
    const list = type === "navigation" ? cms().navigation : cms().footer.links;
    list.splice(index, 1);
    markDirty(); renderCms();
  }
  function listInput(type, index, key, label, itemType = "text") {
    const path = type === "footerLinks" ? `footer.links.${index}.${key}` : `${type}.${index}.${key}`;
    if (itemType === "checkbox") return `<label class="switchLine"><input type="checkbox" data-cms="${path}"><span>${label}</span></label>`;
    return `<label>${label}<input type="${itemType}" data-cms="${path}"></label>`;
  }
  function renderLinks(type, elementId) {
    const list = type === "navigation" ? cms().navigation : cms().footer.links;
    el(elementId).innerHTML = list.map((item, index) => `<div class="cmsListItem"><div class="formGrid">
      ${listInput(type, index, "label", "Ad")}${listInput(type, index, "url", "URL")}
      ${listInput(type, index, "order", "Sıra", "number")}
      <label>İkon<select data-cms="${type === "footerLinks" ? `footer.links.${index}.icon` : `${type}.${index}.icon`}">${safeIcons.map((icon) => `<option value="${icon}">${icon}</option>`).join("")}</select></label>
      ${listInput(type, index, "enabled", "Aktiv", "checkbox")}${listInput(type, index, "newTab", "Yeni tab", "checkbox")}
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
    return `https://mirpanel.com/${imagePath.replace(/^\/+/, "")}`;
  }
  function mediaOptions(selected) {
    return `<option value="">Media seçin</option>${cms().media.map((item) =>
      `<option value="${esc(item.path)}"${item.path === selected ? " selected" : ""}>${esc(item.alt || item.path)}</option>`
    ).join("")}`;
  }
  function imageEditor(path, label, imagePath, preview) {
    const binding = path.startsWith("productBanner.") ? "data-product-banner" : "data-cms";
    return `<div class="bannerImageEditor">
      <strong>${esc(label)}</strong>
      <img data-banner-preview="${esc(path)}" src="${esc(preview || cmsImageUrl(imagePath))}" alt=""${imagePath || preview ? "" : " hidden"}>
      <label>Kompüterdən yüklə<input type="file" accept="image/jpeg,image/png,image/webp" data-banner-upload="${esc(path)}"></label>
      <label>Media bölməsindən seç<select data-banner-media="${esc(path)}">${mediaOptions(imagePath)}</select></label>
      <label>Şəkil yolu<input ${binding}="${esc(path)}" value="${esc(imagePath)}"></label>
      <button class="btn" type="button" data-clear-banner-image="${esc(path)}">Şəkli sil</button>
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
    const product = orderedProducts.find((item) => item.id === selectedBannerProductId);
    const editor = el("bannerProductEditor");
    if (!product) {
      editor.innerHTML = '<div class="emptyMini">Məhsul yoxdur.</div>';
    } else {
      const item = ensureProductBanner(product);
      const index = orderedProducts.indexOf(product);
      const path = `productBanner.${product.id}`;
      const slug = String(product.seoSlug || product.id || "").replaceAll("_", "-");
      editor.innerHTML = `<div class="cmsListItem bannerEditorCard">
      <div class="bannerEditorHead"><div><strong>${esc(product.title)}</strong><small> · ${product.active === false ? "Məhsul deaktivdir, banner saytda görünmür" : "Aktiv məhsul banneri"}</small></div><div class="bannerOrderActions">
        <button class="btn" type="button" data-move-product-banner="${esc(product.id)}" data-direction="-1"${index === 0 ? " disabled" : ""}>Yuxarı</button>
        <button class="btn" type="button" data-move-product-banner="${esc(product.id)}" data-direction="1"${index === orderedProducts.length - 1 ? " disabled" : ""}>Aşağı</button>
      </div></div>
      <div class="bannerImageGrid">
        ${imageEditor(`${path}.desktopImage`, "Desktop şəkli", item.desktopImage, item._desktopPreview)}
        ${imageEditor(`${path}.mobileImage`, "Mobil şəkli (boşdursa desktop işlənir)", item.mobileImage, item._mobilePreview || item._desktopPreview)}
      </div>
      <div class="formGrid">
        <label>Başlıq<input data-product-banner="${esc(path)}.title" value="${esc(item.title)}"></label>
        <label>Alternativ mətn (alt)<input data-product-banner="${esc(path)}.alt" value="${esc(item.alt)}"></label>
        <label class="full">Açıqlama<textarea rows="3" data-product-banner="${esc(path)}.description">${esc(item.description)}</textarea></label>
        <label>Canonical keçid<input value="https://mirpanel.com/${esc(slug)}/" readonly></label>
        <label>Sıra<input type="number" min="1" max="${orderedProducts.length}" data-product-banner="${esc(path)}.order" value="${item.order}"></label>
        <label class="switchLine"><input type="checkbox" data-product-banner="${esc(path)}.enabled"${item.enabled ? " checked" : ""}><span>Banner aktivdir</span></label>
      </div>
      <small>Banner şəkli boş olarsa məhsulun əsas şəkli avtomatik istifadə olunur. Keçid məhsulun SEO slug-ından yaranır və eyni tabda açılır.</small>
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
    container.innerHTML = ensurePage(key).blocks.map((block, index) => `<div class="cmsListItem"><div class="formGrid">
      <label>Başlıq<input data-page-block="${key}.${index}.title"></label>
      <label>Sıra<input type="number" data-page-block="${key}.${index}.order"></label>
      <label class="full">Mətn<textarea rows="4" data-page-block="${key}.${index}.text"></textarea></label>
      <label class="full">Şəkil yolu<input data-page-block="${key}.${index}.image"></label>
    </div><button class="btn danger" type="button" data-remove-block="${key}" data-index="${index}">Sil</button></div>`).join("");
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
    el("mediaList").innerHTML = cms().media.map((item) => {
      const usageCount = item.path ? serialized.split(item.path).length - 1 : 0;
      return `<article class="mediaCard"><img src="${esc(item._preview || item.path)}" alt="${esc(item.alt)}"><strong>${esc(item.alt || "Adsız şəkil")}</strong><small>${esc(item.type)} · ${Math.ceil(Number(item.size || 0) / 1024)} KB</small><small>${usageCount ? `${usageCount} yerdə istifadə olunur` : "Hazırda istifadə olunmur"}</small><code>${esc(item.path)}</code></article>`;
    }).join("");
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
    renderDashboard(); renderSections(); renderLinks("navigation", "navigationList");
    renderLinks("footerLinks", "footerLinkList"); renderBanners(); renderTexts(); renderMedia();
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
      <label>Open Graph şəkli<input data-product-extra="seoOgImage"></label>
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
        body: JSON.stringify({ baseSha: state.baseSha, data: state.data })
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
      toast("Önizləmə və yoxlamalar uğurla tamamlandı.");
    } catch (error) {
      state.previewDigest = "";
      el("cmsPreviewResult").textContent = error.message;
      toast(error.message, "bad");
    } finally { setLoading(false); }
  }
  async function publishAndMonitor() {
    state.lastPublishResult = null;
    await saveState();
    const published = state.lastPublishResult;
    if (!published) return;
    el("cmsPreviewResult").textContent = `Commit ${published.commitSha.slice(0, 12)} yaradıldı. Cloudflare və Render yoxlanılır...`;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      try {
        const status = await api(`/api/admin/deploy-status?appSha=${encodeURIComponent(published.sha)}`);
        el("cmsPreviewResult").innerHTML = `<strong>Commit: ${esc(published.commitSha)}</strong><p>Cloudflare: HTTP ${status.cloudflare.status} — ${status.cloudflare.live ? "yeni məzmun canlıdır" : "deploy gözlənilir"}</p><p>Render: ${esc(status.render.url)} — HTTP ${status.render.status}</p>`;
        if (status.cloudflare.live && status.render.live) {
          toast("Cloudflare və Render canlı yoxlaması uğurludur.");
          return;
        }
      } catch (error) {
        el("cmsPreviewResult").textContent = error.message;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
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
            showView("publish");
            el("cmsPreviewResult").textContent = `${restored.restoredFrom.slice(0, 12)} commitinin məzmunu önizləməyə gətirildi. Yayımla düyməsinə basmadan canlı sayt dəyişməyəcək.`;
          } catch (error) { toast(error.message, "bad"); }
        });
      });
    } catch (error) { toast(error.message, "bad"); }
  }
  function installActions() {
    el("cmsPreviewBtn").addEventListener("click", preview);
    el("cmsPublishBtn").addEventListener("click", publishAndMonitor);
    el("cmsMediaUpload").addEventListener("click", uploadMedia);
    el("refreshHistory").addEventListener("click", loadHistory);
  }
  function installHooks() {
    const originalRenderAll = renderAll;
    renderAll = function (...args) {
      const result = originalRenderAll.apply(this, args);
      renderCms(); renderProductExtras();
      repairAdminDom(document.querySelector(".main"));
      return result;
    };
    const originalRenderProductForm = renderProductForm;
    renderProductForm = function (...args) {
      const result = originalRenderProductForm.apply(this, args);
      renderProductExtras();
      return result;
    };
    showView = function (view) {
      document.querySelectorAll(".workspace").forEach((section) => section.classList.add("hidden"));
      const target = el(`${view}View`);
      if (target) target.classList.remove("hidden");
      document.querySelectorAll(".navBtn[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
      el("crumb").textContent = viewLabels.find(([id]) => id === view)?.[1] || "İdarə paneli";
      if (view === "history") loadHistory();
      if (view === "dashboard") renderDashboard();
    };
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
    showView("dashboard");
    repairAdminDom();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
