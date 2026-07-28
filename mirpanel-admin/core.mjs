import vm from "node:vm";

const DATA_MARKER = "const DATA";
const CONTENT_MARKER = "const ADMIN_CONTENT";
const SITE_SECTIONS_MARKER = "const SITE_SECTIONS";
const INFO_MARKER = "const INFO_TEXTS";
const UI_MARKER = "const UI";
const CMS_MARKER = "const CMS_CONTENT";

const SAFE_ICONS = new Set([
  "home", "products", "search", "info", "contact", "terms", "whatsapp",
  "sparkles", "game", "ai", "link", "image", "shield"
]);

const COMMON_TEXT_DEFAULTS = {
  available: "Mövcuddur",
  outOfStock: "Stokda yoxdur",
  selectDuration: "Müddət seçin",
  order: "Sifariş et",
  productAbout: "Məhsul haqqında",
  usageRules: "İstifadə qaydaları",
  relatedProducts: "Oxşar məhsullar",
  moreProducts: "Daha çox məhsul",
  instantDelivery: "7/24 anında təqdim edilir",
  close: "Bağla",
  confirm: "Təsdiqləyirəm",
  cancel: "Ləğv et",
  sendWhatsapp: "WhatsApp-a göndər",
  requiredField: "Bu sahə məcburidir.",
  invalidEmail: "Düzgün e-poçt ünvanı daxil edin.",
  noSearchResults: "Axtarışa uyğun məhsul tapılmadı.",
  bundleTitle: "Paket yarat",
  bundleButton: "Paket yarat"
};

function cleanText(value, fallback = "", max = 20_000) {
  return String(value ?? fallback)
    .replace(/\u0000/g, "")
    .slice(0, max);
}

function repairLegacyText(value) {
  const replacements = {
    "Д±": "ı", "Д°": "İ", "Гј": "ü", "Гњ": "Ü", "Й™": "ə",
    "ЖЏ": "Ə", "Еџ": "ş", "Ећ": "Ş", "Г§": "ç", "Г‡": "Ç",
    "Г¶": "ö", "Г–": "Ö", "Дџ": "ğ", "Дћ": "Ğ",
    "Ð”Â±": "ı", "Ð”Â°": "İ", "Ð“Ñ˜": "ü", "Ð“Ñš": "Ü",
    "Ð™â„¢": "ə", "Ð–Ð": "Ə", "Ð•ÑŸ": "ş", "Ð•Ñ›": "Ş",
    "Ð“Â§": "ç", "Ð“â€¡": "Ç", "Ð“Â¶": "ö", "Ð“â€“": "Ö"
  };
  return Object.entries(replacements).reduce(
    (text, [broken, correct]) => text.split(broken).join(correct),
    cleanText(value)
  );
}

function normalizeSlug(value, fallback = "") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[əƏ]/g, "e")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function safeUrl(value, { allowRelative = true } = {}) {
  const input = String(value || "").trim();
  if (!input) return "";
  if (
    allowRelative &&
    !input.includes("..") &&
    /^(?:\/(?!\/))?(?:[a-zA-Z0-9]|#)[a-zA-Z0-9/_?&=.%#-]*$/.test(input)
  ) return input;
  try {
    const parsed = new URL(input);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function sanitizeRichText(value) {
  let html = cleanText(value, "", 100_000);
  html = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|option|svg|math)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|option|svg|math)\b[^>]*\/?>/gi, "");

  return html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, rawTag, rawAttrs) => {
    const tag = rawTag.toLowerCase();
    const allowed = new Set(["p", "br", "h2", "h3", "h4", "ul", "ol", "li", "strong", "b", "em", "i", "a"]);
    if (!allowed.has(tag)) return "";
    if (match.startsWith("</")) return `</${tag}>`;
    if (tag === "br") return "<br>";
    if (tag !== "a") return `<${tag}>`;
    const href = rawAttrs.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
    const safeHref = safeUrl(href);
    return safeHref ? `<a href="${safeHref.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">` : "<a>";
  });
}

function normalizeSeo(source = {}, fallbackSlug = "") {
  return {
    slug: normalizeSlug(source.slug, fallbackSlug),
    title: cleanText(source.title, "", 160),
    description: cleanText(source.description, "", 320),
    ogTitle: cleanText(source.ogTitle, "", 160),
    ogDescription: cleanText(source.ogDescription, "", 320),
    ogImage: safeUrl(source.ogImage),
    index: source.index !== false,
    includeInSitemap: source.includeInSitemap !== false
  };
}

function normalizeLink(item = {}, index = 0) {
  return {
    id: normalizeSlug(item.id, `link-${index + 1}`),
    label: cleanText(item.label, `Keçid ${index + 1}`, 100),
    url: safeUrl(item.url) || "/",
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
    enabled: item.enabled !== false,
    icon: SAFE_ICONS.has(item.icon) ? item.icon : "link",
    newTab: Boolean(item.newTab)
  };
}

function normalizeInfoCard(item = {}, fallback = {}) {
  return {
    title: cleanText(item?.title, fallback.title, 200),
    text: cleanText(item?.text, fallback.text, 1000),
    linkText: cleanText(item?.linkText, fallback.linkText, 120)
  };
}

function cmsDefaults({ brand, phone_wa, ui, siteSections } = {}) {
  const whatsappNumber = String(phone_wa || "").replace(/\D/g, "") || "994515243545";
  const searchMarkup = String(ui?.searchTitle || "");
  const searchHighlight = searchMarkup.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "";
  const searchPrefix = searchMarkup.replace(/<span[^>]*>[\s\S]*?<\/span>/gi, "").replace(/<[^>]+>/g, "").trim();
  return {
    schemaVersion: 1,
    site: {
      brandName: cleanText(brand, "Mirpanel", 80),
      logo: "",
      brandSubtitle: cleanText(ui?.brandSub),
      whatsappNumber,
      phoneDisplay: cleanText(siteSections?.elaqe?.whatsappNumber, "051 524 35 45", 40)
    },
    homepage: {
      announcement: { enabled: Boolean(ui?.bannerText), text: cleanText(ui?.bannerText) },
      hero: { title: cleanText(ui?.heroTitle), description: cleanText(ui?.heroHint) },
      search: {
        title: cleanText(searchPrefix || ui?.searchTitle),
        highlight: cleanText(searchHighlight),
        description: cleanText(ui?.searchDesc),
        placeholder: "Məhsul axtar..."
      },
      bundle: {
        enabled: true,
        title: cleanText(ui?.bmTitle, COMMON_TEXT_DEFAULTS.bundleTitle),
        description: cleanText(ui?.bmSub),
        buttonText: COMMON_TEXT_DEFAULTS.bundleButton,
        discountPercent: 0
      },
      sectionOrder: ["announcement", "hero", "search", "products", "bundle", "info"],
      sections: {
        announcement: true, hero: true, search: true, products: true,
        bundle: true, info: true, games: true, ai: true
      },
      infoCards: {
        about: { title: cleanText(siteSections?.haqqimizda?.title, "Haqqımızda"), text: cleanText(siteSections?.haqqimizda?.text), linkText: cleanText(siteSections?.haqqimizda?.linkText, "Ətraflı") },
        contact: { title: cleanText(siteSections?.elaqe?.title, "Əlaqə"), text: cleanText(siteSections?.elaqe?.text), linkText: cleanText(siteSections?.elaqe?.buttonText, "WhatsApp ilə yaz") },
        terms: { title: cleanText(siteSections?.sertler?.title, "Şərtlər"), text: cleanText(siteSections?.sertler?.text), linkText: "Ətraflı" }
      }
    },
    navigation: [
      { id: "products", label: "Məhsullar", url: "/#products", order: 1, enabled: true, icon: "products", newTab: false },
      { id: "about", label: "Haqqımızda", url: `/${normalizeSlug(siteSections?.haqqimizda?.slug, "haqqimizda")}`, order: 2, enabled: siteSections?.haqqimizda?.enabled !== false, icon: "info", newTab: false },
      { id: "contact", label: "Əlaqə", url: `/${normalizeSlug(siteSections?.elaqe?.slug, "elaqe")}`, order: 3, enabled: siteSections?.elaqe?.enabled !== false, icon: "contact", newTab: false }
    ],
    banners: [],
    footer: {
      copyrightText: cleanText(ui?.footRights, "Bütün hüquqlar qorunur."),
      year: new Date().getUTCFullYear(),
      brandName: cleanText(brand, "Mirpanel", 80),
      phone: cleanText(siteSections?.elaqe?.whatsappNumber, "051 524 35 45", 40),
      whatsapp: whatsappNumber,
      shortText: "",
      links: []
    },
    commonTexts: { ...COMMON_TEXT_DEFAULTS },
    seo: {
      home: normalizeSeo({}, ""),
      robotsIndexing: true
    },
    orderSettings: {
      whatsappButtonText: "WhatsApp",
      defaultExtraMessage: "",
      requireConfirmation: false
    },
    media: []
  };
}

function normalizeCms(source = {}, legacy = {}) {
  source = source || {};
  const defaults = cmsDefaults(legacy);
  const site = source.site || {};
  const homepage = source.homepage || {};
  const footer = source.footer || {};
  const bundle = homepage.bundle || {};
  const search = homepage.search || {};
  const hero = homepage.hero || {};
  const announcement = homepage.announcement || {};
  const allowedSections = defaults.homepage.sectionOrder;
  const sectionOrder = Array.isArray(homepage.sectionOrder)
    ? [...new Set(homepage.sectionOrder.filter((key) => allowedSections.includes(key)))]
    : [...allowedSections];
  for (const key of allowedSections) if (!sectionOrder.includes(key)) sectionOrder.push(key);

  return {
    schemaVersion: 1,
    site: {
      brandName: cleanText(site.brandName, defaults.site.brandName, 80),
      logo: safeUrl(site.logo),
      brandSubtitle: cleanText(site.brandSubtitle, defaults.site.brandSubtitle, 200),
      whatsappNumber: String(site.whatsappNumber || defaults.site.whatsappNumber).replace(/\D/g, "").slice(0, 20),
      phoneDisplay: cleanText(site.phoneDisplay, defaults.site.phoneDisplay, 40)
    },
    homepage: {
      announcement: { enabled: announcement.enabled ?? defaults.homepage.announcement.enabled, text: cleanText(announcement.text, defaults.homepage.announcement.text, 500) },
      hero: { title: cleanText(hero.title, defaults.homepage.hero.title, 300), description: cleanText(hero.description, defaults.homepage.hero.description, 1000) },
      search: { title: cleanText(search.title, defaults.homepage.search.title, 300), highlight: cleanText(search.highlight, defaults.homepage.search.highlight, 300), description: cleanText(search.description, defaults.homepage.search.description, 1000), placeholder: cleanText(search.placeholder, defaults.homepage.search.placeholder, 120) },
      bundle: { enabled: bundle.enabled ?? defaults.homepage.bundle.enabled, title: cleanText(bundle.title, defaults.homepage.bundle.title, 200), description: cleanText(bundle.description, defaults.homepage.bundle.description, 1000), buttonText: cleanText(bundle.buttonText, defaults.homepage.bundle.buttonText, 100), discountPercent: Math.min(100, Math.max(0, Number(bundle.discountPercent) || 0)) },
      sectionOrder,
      sections: Object.fromEntries(Object.keys(defaults.homepage.sections).map((key) => [key, homepage.sections?.[key] ?? defaults.homepage.sections[key]])),
      infoCards: {
        about: normalizeInfoCard(homepage.infoCards?.about, defaults.homepage.infoCards.about),
        contact: normalizeInfoCard(homepage.infoCards?.contact, defaults.homepage.infoCards.contact),
        terms: normalizeInfoCard(homepage.infoCards?.terms, defaults.homepage.infoCards.terms)
      }
    },
    navigation: (Array.isArray(source.navigation) ? source.navigation : defaults.navigation).map(normalizeLink),
    banners: (Array.isArray(source.banners) ? source.banners : []).map((banner, index) => ({
      id: normalizeSlug(banner.id, `banner-${index + 1}`),
      title: cleanText(banner.title, "", 200),
      description: cleanText(banner.description, "", 1000),
      alt: cleanText(banner.alt, "", 250),
      url: safeUrl(banner.url),
      order: Number.isFinite(Number(banner.order)) ? Number(banner.order) : index + 1,
      enabled: banner.enabled !== false,
      startAt: cleanText(banner.startAt, "", 40),
      endAt: cleanText(banner.endAt, "", 40),
      desktopImage: safeUrl(banner.desktopImage),
      mobileImage: safeUrl(banner.mobileImage)
    })),
    footer: {
      copyrightText: cleanText(footer.copyrightText, defaults.footer.copyrightText, 300),
      year: Math.min(2200, Math.max(2000, Number(footer.year) || defaults.footer.year)),
      brandName: cleanText(footer.brandName, defaults.footer.brandName, 80),
      phone: cleanText(footer.phone, defaults.footer.phone, 40),
      whatsapp: String(footer.whatsapp || defaults.footer.whatsapp).replace(/\D/g, "").slice(0, 20),
      shortText: cleanText(footer.shortText, "", 500),
      links: (Array.isArray(footer.links) ? footer.links : []).map(normalizeLink)
    },
    commonTexts: Object.fromEntries(Object.entries(COMMON_TEXT_DEFAULTS).map(([key, value]) => [key, cleanText(source.commonTexts?.[key], value, 500) || value])),
    seo: {
      home: normalizeSeo(source.seo?.home, ""),
      robotsIndexing: source.seo?.robotsIndexing !== false
    },
    orderSettings: {
      whatsappButtonText: cleanText(source.orderSettings?.whatsappButtonText, defaults.orderSettings.whatsappButtonText, 100),
      defaultExtraMessage: cleanText(source.orderSettings?.defaultExtraMessage, "", 2000),
      requireConfirmation: Boolean(source.orderSettings?.requireConfirmation)
    },
    media: (Array.isArray(source.media) ? source.media : []).map((item) => ({
      path: safeUrl(item.path),
      alt: cleanText(item.alt, "", 250),
      size: Math.max(0, Number(item.size) || 0),
      type: cleanText(item.type, "", 50),
      uploadedAt: cleanText(item.uploadedAt, "", 40)
    })).filter((item) => item.path)
  };
}

const UI_DEFAULTS = {
  brandSub: "",
  bannerText: "",
  heroTitle: "",
  heroHint: "",
  searchTitle: "",
  searchDesc: "",
  bmTitle: "",
  bmSub: "",
  footRights: ""
};

const SITE_SECTION_DEFAULTS = {
  haqqimizda: {
    enabled: true,
    title: "HaqqД±mД±zda",
    text: "Mirpanel premium hesablarД±n sГјrЙ™tli vЙ™ etibarlД± aktivlЙ™ЕџdirilmЙ™si ГјГ§Гјn xidmЙ™t gГ¶stЙ™rir. MЙ™hsullar WhatsApp ГјzЙ™rindЙ™n rahat sifariЕџ olunur vЙ™ dЙ™stЙ™k komandasД± mГјЕџtЙ™rilЙ™rЙ™ kГ¶mЙ™k edir.",
    linkText: "",
    order: 1
  },
  sertler: {
    enabled: true,
    title: "ЕћЙ™rtlЙ™r",
    text: "",
    items: [
      "SifariЕџdЙ™n Й™vvЙ™l mЙ™hsul mЙ™lumatlarД±nД± diqqЙ™tlЙ™ oxuyun.",
      "RЙ™qЙ™msal mЙ™hsullarda aktivlЙ™ЕџdirmЙ™ qaydasД± mЙ™hsula gГ¶rЙ™ dЙ™yiЕџЙ™ bilЙ™r.",
      "YanlД±Еџ daxil edilЙ™n mЙ™lumatlara gГ¶rЙ™ gecikmЙ™ yarana bilЙ™r.",
      "DЙ™stЙ™k WhatsApp ГјzЙ™rindЙ™n gГ¶stЙ™rilir."
    ],
    order: 2
  },
  elaqe: {
    enabled: true,
    title: "ЖЏlaqЙ™",
    whatsappNumber: "051 524 35 45",
    buttonText: "WhatsApp ilЙ™ yaz",
    text: "",
    order: 3
  }
};

function normalizeLines(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSiteSections(source = {}) {
  const next = {};

  for (const [key, fallback] of Object.entries(SITE_SECTION_DEFAULTS)) {
    const item = source[key] || {};
    next[key] = {
      ...fallback,
      ...item,
      enabled: item.enabled ?? fallback.enabled,
      slug: normalizeSlug(item.slug, key),
      title: repairLegacyText(item.title ?? fallback.title),
      text: repairLegacyText(item.text ?? fallback.text ?? ""),
      subtitle: repairLegacyText(item.subtitle || "").slice(0, 1000),
      body: sanitizeRichText(repairLegacyText(item.body ?? item.text ?? fallback.text ?? "")),
      blocks: (Array.isArray(item.blocks) ? item.blocks : []).map((block, index) => ({
        title: cleanText(block.title, "", 250),
        text: sanitizeRichText(block.text || ""),
        image: safeUrl(block.image),
        order: Number.isFinite(Number(block.order)) ? Number(block.order) : index + 1
      })),
      seoTitle: cleanText(item.seoTitle || "", "", 160),
      seoDescription: cleanText(item.seoDescription || "", "", 320),
      ogTitle: cleanText(item.ogTitle || "", "", 160),
      ogDescription: cleanText(item.ogDescription || "", "", 320),
      ogImage: safeUrl(item.ogImage),
      index: item.index !== false,
      includeInSitemap: item.includeInSitemap !== false,
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : fallback.order,
      buttonText: cleanText(item.buttonText || "", fallback.buttonText || "", 120),
      buttonUrl: safeUrl(item.buttonUrl || fallback.buttonUrl || "")
    };

    if (key === "haqqimizda") {
      next[key].linkText = String(item.linkText ?? fallback.linkText ?? "");
    }

    if (key === "sertler") {
      next[key].items = normalizeLines(item.items ?? fallback.items);
    }

    if (key === "elaqe") {
      next[key].whatsappNumber = String(item.whatsappNumber ?? fallback.whatsappNumber);
      next[key].whatsappMessage = cleanText(item.whatsappMessage || "", "", 2000);
      next[key].workHours = cleanText(item.workHours || "", "", 1000);
    }
  }

  return next;
}

function findObjectBlock(source, marker) {
  const markerStart = source.indexOf(marker);
  if (markerStart < 0) throw new Error(`${marker} tapД±lmadД±.`);

  const start = source.indexOf("{", markerStart);
  if (start < 0) throw new Error(`${marker} bloku tapД±lmadД±.`);

  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") depth += 1;

    if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        let end = index + 1;

        while (source[end] && /[\s;]/.test(source[end])) {
          end += 1;
        }

        return {
          markerStart,
          start,
          end,
          text: source.slice(start, index + 1)
        };
      }
    }
  }

  throw new Error(`${marker} bloku baДџlanmayД±b.`);
}

function evaluateObject(source, marker, fallback) {
  try {
    const { text } = findObjectBlock(source, marker);

    return vm.runInNewContext(
      `(${text})`,
      Object.create(null),
      { timeout: 1000 }
    );
  } catch (error) {
    if (arguments.length >= 3) return fallback;
    throw error;
  }
}

function replaceObjectDeclaration(source, marker, object, beforeMarker = "") {
  const formatted = `${marker} = ${JSON.stringify(object, null, 2)};\n\n`;

  if (source.includes(marker)) {
    const block = findObjectBlock(source, marker);

    return (
      source.slice(0, block.markerStart) +
      formatted +
      source.slice(block.end)
    );
  }

  const insertAt = beforeMarker ? source.indexOf(beforeMarker) : -1;

  if (insertAt < 0) {
    return `${formatted}${source}`;
  }

  return source.slice(0, insertAt) + formatted + source.slice(insertAt);
}

function normalizePlan(plan = {}) {
  return {
    ...(plan.label ? { label: String(plan.label) } : {}),
    months: Number(plan.months) || 1,
    price: Number(plan.price) || 0,
    ...(Number(plan.regularPrice) > 0 ? { regularPrice: Number(plan.regularPrice) } : {})
  };
}

const ORDER_FLOWS = new Set([
  "direct_whatsapp",
  "form_then_whatsapp",
  "confirm_then_whatsapp",
  "form_confirm_whatsapp"
]);

const FIELD_TYPES = new Set([
  "text",
  "tel",
  "email",
  "password",
  "textarea",
  "number"
]);

function normalizeStock(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const stock = Number(value);
  return Number.isFinite(stock) ? Math.max(0, stock) : null;
}

function normalizeSeoSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[Й™ЖЏ]/g, "e")
    .replace(/[Д±Д°]/g, "i")
    .replace(/[Г¶Г–]/g, "o")
    .replace(/[ГјГњ]/g, "u")
    .replace(/[ЕџЕћ]/g, "s")
    .replace(/[Г§Г‡]/g, "c")
    .replace(/[ДџДћ]/g, "g")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LEGACY_FLOW_FIELDS = {
  name_code_4: [
    { key: "name", type: "text", label: "Ad", placeholder: "AdД±nД±zД± yazД±n", required: true, enabled: true },
    { key: "code_4", type: "text", label: "4 rЙ™qЙ™mli kod / PIN", placeholder: "4 rЙ™qЙ™mli kod yazД±n", required: true, enabled: true }
  ],
  name_code_5: [
    { key: "name", type: "text", label: "Ad", placeholder: "AdД±nД±zД± yazД±n", required: true, enabled: true },
    { key: "code_5", type: "text", label: "5 rЙ™qЙ™mli kod / PIN", placeholder: "5 rЙ™qЙ™mli kod yazД±n", required: true, enabled: true }
  ],
  email: [
    { key: "email", type: "email", label: "Email / Gmail", placeholder: "Gmail ГјnvanД±nД±zД± yazД±n", required: true, enabled: true }
  ],
  spotify: [
    { key: "email", type: "email", label: "Email / Gmail", placeholder: "Gmail ГјnvanД±nД±zД± yazД±n", required: true, enabled: true },
    { key: "password", type: "password", label: "ЕћifrЙ™", placeholder: "ЕћifrЙ™nizi yazД±n", required: true, enabled: true }
  ]
};

function defaultFieldsForFlow(flow) {
  return (LEGACY_FLOW_FIELDS[flow] || []).map((field) => ({ ...field }));
}

function orderFlowFromProduct(product = {}) {
  const source = String(product.orderFlow || "").trim();

  const fields = Array.isArray(product.formFields) && product.formFields.length
    ? product.formFields.filter((field) => field?.enabled !== false)
    : defaultFieldsForFlow(product.flow);

  const modalSource =
    product.confirmationModal ||
    product.orderConfirmation ||
    {};

  const hasModal = modalSource.enabled === true;

  if (ORDER_FLOWS.has(source)) {
    if (hasModal && source === "direct_whatsapp") return "confirm_then_whatsapp";
    return source;
  }

  if (hasModal && fields.length) return "form_confirm_whatsapp";
  if (hasModal) return "confirm_then_whatsapp";
  if (fields.length) return "form_then_whatsapp";

  return "direct_whatsapp";
}

function normalizeFormField(field = {}, index = 0) {
  const key = String(field.key || `custom_${index + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_|_$/g, "");

  return {
    key: key || `custom_${index + 1}`,
    type: FIELD_TYPES.has(field.type) ? field.type : "text",
    label: String(field.label || field.key || `SahЙ™ ${index + 1}`),
    placeholder: String(field.placeholder || ""),
    required: Boolean(field.required),
    enabled: field.enabled !== false
  };
}

function normalizeFormFields(product = {}) {
  const source = Array.isArray(product.formFields) && product.formFields.length
    ? product.formFields
    : defaultFieldsForFlow(product.flow);

  return source.map(normalizeFormField);
}

function normalizeWhatsApp(source = {}) {
  return {
    extraMessage: String(source.extraMessage || ""),
    includeSeller: source.includeSeller !== false,
    includeStock: Boolean(source.includeStock)
  };
}

function defaultOrderConfirmation() {
  return {
    enabled: false,
    title: "Diqqət!",
    description: "",
    confirmText: "Oxudum və təsdiqləyirəm",
    cancelText: "Ləğv et",
    footerText: "",
    helpLink: {
      enabled: false,
      label: "",
      url: ""
    }
  };
}

function normalizeOrderConfirmation(source = {}, id = "") {
  const fallback = defaultOrderConfirmation();
  const helpSource = source.helpLink || {};
  const helpUrl = String(helpSource.url || "").trim();

  if (helpUrl && !helpUrl.startsWith("https://")) {
    throw new Error(`${id}: kГ¶mЙ™k linki yalnД±z https:// ilЙ™ baЕџlamalД±dД±r.`);
  }

  return {
    enabled: source.enabled ?? fallback.enabled,
    title: String(source.title ?? fallback.title),
    description: String(source.description ?? fallback.description),
    confirmText: String(source.confirmText ?? fallback.confirmText),
    cancelText: String(source.cancelText ?? fallback.cancelText),
    footerText: String(source.footerText ?? fallback.footerText),
    helpLink: {
      enabled: Boolean(helpSource.enabled),
      label: String(helpSource.label || ""),
      url: helpUrl
    }
  };
}

function normalizeProduct(product = {}, index = 0) {
  const id = String(product.id || "").trim();

  if (!id) {
    throw new Error("BoЕџ mЙ™hsul ID-si var.");
  }

  const confirmationModal = normalizeOrderConfirmation(
    product.confirmationModal || product.orderConfirmation,
    id
  );
  const stock = normalizeStock(product.stock);
  const formFields = normalizeFormFields(product);
  const soldOut =
    Boolean(product.soldOut) ||
    product.flow === "out_of_stock" ||
    (Boolean(product.stockEnabled) && stock !== null && stock <= 0);

  return {
    id,
    _stableId: String(product._stableId || id),
    order: Number.isFinite(Number(product.order)) ? Number(product.order) : index,
    category: String(product.category || "all"),
    image: String(product.image || "assets/your.png"),
    currency: String(product.currency || "в‚ј"),
    title: String(product.title || id),
    variant: String(product.variant || ""),
    badge: String(product.badge || ""),
    imageAlt: cleanText(product.imageAlt, product.title || id, 250),
    desc: String(product.desc || ""),
    note: String(product.note || ""),
    longDescription: sanitizeRichText(product.longDescription || product.seoContent || ""),
    usageRules: sanitizeRichText(product.usageRules || ""),
    deliveryText: cleanText(product.deliveryText || "", "", 1000),
    availabilityText: cleanText(product.availabilityText || "", "", 250),
    seoSlug: normalizeSeoSlug(product.seoSlug),
    seoTitle: String(product.seoTitle || ""),
    seoDescription: String(product.seoDescription || ""),
    seoKeywords: Array.isArray(product.seoKeywords)
      ? product.seoKeywords.map((keyword) => String(keyword).trim()).filter(Boolean).join(", ")
      : String(product.seoKeywords || ""),
    seoContent: String(product.seoContent || ""),
    seoIndex: product.seoIndex !== false,
    includeInSitemap: product.includeInSitemap !== false,
    seoOgTitle: cleanText(product.seoOgTitle || "", "", 160),
    seoOgDescription: cleanText(product.seoOgDescription || "", "", 320),
    seoOgImage: safeUrl(product.seoOgImage || product.image),
    flow: String(product.flow || "whatsapp"),
    soldOut,
    active: product.active !== false,
    stock,
    stockEnabled: Boolean(product.stockEnabled),
    seller: String(product.seller || ""),
    bestSeller: Boolean(product.bestSeller),
    orderFlow: orderFlowFromProduct({
      ...product,
      id,
      formFields
    }),
    formFields,
    formTitle: cleanText(product.formTitle || "", "", 200),
    confirmationModal,
    whatsapp: normalizeWhatsApp(product.whatsapp),
    plans: Array.isArray(product.plans) ? product.plans.map(normalizePlan) : [],
    orderConfirmation: confirmationModal
  };
}

export function normalizeAdminPayload(payload = {}) {
  const sourceCategories = Array.isArray(payload.categories)
    ? payload.categories.map((category, index) => ({
        key: String(category.key || "").trim(),
        name: String(category.name || category.label || "").trim(),
        order: Number.isFinite(Number(category.order)) ? Number(category.order) : index + 1,
        active: category.active !== false,
        icon: SAFE_ICONS.has(category.icon) ? category.icon : "products"
      }))
    : [];

  const products = Array.isArray(payload.products)
    ? payload.products.map(normalizeProduct)
    : [];

  const categories = sourceCategories.length
    ? sourceCategories
    : [...new Set(products.map((product) => product.category))]
        .filter(Boolean)
        .map((key) => ({ key, name: key }));

  const ids = new Set();
  const slugs = new Set();
  const categoryKeys = new Set(categories.map((category) => category.key));
  if (categoryKeys.size !== categories.length || categories.some((category) => !category.key)) {
    throw new Error("Kateqoriya açarları boş və ya təkrarlanan ola bilməz.");
  }

  for (const product of products) {
    if (ids.has(product.id)) {
      throw new Error(`TЙ™krar mЙ™hsul ID-si: ${product.id}`);
    }

    ids.add(product.id);
    if (product.seoSlug) {
      if (slugs.has(product.seoSlug)) throw new Error(`Təkrar SEO slug: ${product.seoSlug}`);
      slugs.add(product.seoSlug);
    }
    if (product.category !== "all" && !categoryKeys.has(product.category)) {
      throw new Error(`${product.id}: mövcud olmayan kateqoriya "${product.category}".`);
    }
  }
  const siteSections = normalizeSiteSections(payload.siteSections);
  for (const section of Object.values(siteSections)) {
    if (section.enabled === false || !section.slug) continue;
    if (slugs.has(section.slug)) throw new Error(`Səhifə və məhsul slug toqquşması: ${section.slug}`);
    slugs.add(section.slug);
  }

  const content = {};

  for (const product of products) {
    const source = payload.content?.[product.id] || {};
    const aboutHtml = sanitizeRichText(source.aboutHtml || "");
    const rulesHtml = sanitizeRichText(source.rulesHtml || "");

    if (aboutHtml || rulesHtml) {
      content[product.id] = {
        aboutHtml,
        rulesHtml
      };
    }
  }

  return {
    brand: String(payload.brand || "Mirpanel"),
    phone_wa: String(payload.phone_wa || "https://wa.me/994515243545"),
    categories,
    products,
    content,
    siteSections,
    cms: normalizeCms(payload.cms, {
      brand: payload.brand,
      phone_wa: payload.phone_wa,
      ui: payload.ui,
      siteSections: payload.siteSections
    }),
    ui: Object.fromEntries(
      Object.keys(UI_DEFAULTS).map((key) => [
        key,
        String(payload.ui?.[key] ?? UI_DEFAULTS[key])
      ])
    )
  };
}

function extractPhone(source) {
  return (
    source.match(/const\s+PHONE_WA\s*=\s*["']([^"']+)["']\s*;/)?.[1] ||
    "https://wa.me/994515243545"
  );
}

export function extractAdminState(source) {
  const data = evaluateObject(source, DATA_MARKER);
  const overrides = evaluateObject(source, CONTENT_MARKER, {});
  const infoTexts = evaluateObject(source, INFO_MARKER, {});
  const ui = evaluateObject(source, UI_MARKER, {});
  const siteSections = evaluateObject(source, SITE_SECTIONS_MARKER, SITE_SECTION_DEFAULTS);
  const cms = evaluateObject(source, CMS_MARKER, null);
  const products = (data.products || []).map(normalizeProduct);
  const content = {};

  for (const product of products) {
    content[product.id] = {
      aboutHtml: String(
        overrides[product.id]?.aboutHtml ||
        infoTexts[product.id]?.htmlContent ||
        ""
      ),
      rulesHtml: String(overrides[product.id]?.rulesHtml || "")
    };
  }

  return normalizeAdminPayload({
    brand: data.brand,
    phone_wa: extractPhone(source),
    categories: data.categories,
    products,
    content,
    siteSections,
    ui,
    cms
  });
}

function patchRuntimeHooks(source) {
  let next = source;

  if (!next.includes("function renderSiteSectionsFromAdmin()")) {
    const helper = `function escapeSectionHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function whatsappHrefFromSectionNumber(number) {
  const digits = String(number || "").replace(/\\D/g, "");
  if (!digits) return PHONE_WA;
  const normalized = digits.startsWith("0") ? \`994\${digits.slice(1)}\` : digits;
  return \`https://wa.me/\${normalized}\`;
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
    const text = escapeSectionHtml(section.text || "").replace(/\\n/g, "<br>");

    if (key === "sertler") {
      const items = Array.isArray(section.items) ? section.items : [];
      const list = items.map((item) => \`<li>\${escapeSectionHtml(item)}</li>\`).join("");
      return \`<article class="siteInfoCard" id="sertler"><h2>\${title}</h2>\${text ? \`<p>\${text}</p>\` : ""}\${list ? \`<ul>\${list}</ul>\` : ""}</article>\`;
    }

    if (key === "elaqe") {
      const number = escapeSectionHtml(section.whatsappNumber || "");
      const buttonText = escapeSectionHtml(section.buttonText || "WhatsApp ilЙ™ yaz");
      const href = whatsappHrefFromSectionNumber(section.whatsappNumber);
      return \`<article class="siteInfoCard siteInfoContact" id="elaqe"><h2>\${title}</h2>\${text ? \`<p>\${text}</p>\` : ""}<p>WhatsApp: <strong>\${number}</strong></p><a class="siteInfoWaBtn" href="\${href}" target="_blank" rel="noopener noreferrer">\${buttonText}</a></article>\`;
    }

    const linkText = escapeSectionHtml(section.linkText || "");
    return \`<article class="siteInfoCard" id="haqqimizda"><h2>\${title}</h2>\${text ? \`<p>\${text}</p>\` : ""}\${linkText ? \`<p class="siteInfoLinkText">\${linkText}</p>\` : ""}</article>\`;
  }).join("");

  ["haqqimizda", "sertler", "elaqe"].forEach((id) => {
    const isVisible = visible.some(([key]) => key === id);
    document.querySelectorAll(\`[data-section-nav="\${id}"]\`).forEach((link) => {
      link.style.display = isVisible ? "" : "none";
    });
  });
}

`;

    if (next.includes("function applyAdminHomepageSettings()")) {
      next = next.replace("function applyAdminHomepageSettings() {", `${helper}function applyAdminHomepageSettings() {`);
    } else {
      next = next.replace("function setupUI() {", `${helper}function setupUI() {`);
    }
  }

  if (!next.includes("renderSiteSectionsFromAdmin();")) {
    next = next.replace(
      "  applyAdminHomepageSettings();",
      "  applyAdminHomepageSettings();\n  renderSiteSectionsFromAdmin();"
    );
  }

  if (!next.includes("function applyAdminHomepageSettings()")) {
    next = next.replace(
      "function setupUI() {",
      `function applyAdminHomepageSettings() {
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
  applyAdminHomepageSettings();`
    );
  }

  if (!next.includes("ADMIN_CONTENT[p.id]?.aboutHtml ||")) {
    next = next.replace(
      "cBox.innerHTML = (info && info.htmlContent) ? info.htmlContent : `<p>${p.desc}</p><p>${p.note}</p>`;",
      "cBox.innerHTML = ADMIN_CONTENT[p.id]?.aboutHtml || ((info && info.htmlContent) ? info.htmlContent : `<p>${p.desc}</p><p>${p.note}</p>`);"
    );
  }

  if (!next.includes("if (ADMIN_CONTENT[p.id]?.rulesHtml)")) {
    next = next.replace(
      '      if (p.id === "google_ai" || p.id === "google_ai_ultra") {',
      `      if (ADMIN_CONTENT[p.id]?.rulesHtml) {
        cBox.innerHTML = ADMIN_CONTENT[p.id].rulesHtml;
      }
      else if (p.id === "google_ai" || p.id === "google_ai_ultra") {`
    );
  }

  if (!next.includes("const adminContent = ADMIN_CONTENT[p.id] || {};")) {
    next = next.replace(
      `    if (tabName === "tab-about") {
      const info = INFO_TEXTS[p.id];
      cBox.innerHTML = (info && info.htmlContent) ? info.htmlContent : \`<p>\${p.desc}</p><p>SifariЕџ etmЙ™k ГјГ§Гјn WhatsApp-a yГ¶nlЙ™ndirilЙ™cЙ™ksiniz.</p>\`;
    } 
    else if (tabName === "tab-rules") {`,
      `    const adminContent = ADMIN_CONTENT[p.id] || {};

    if (tabName === "tab-about") {
      const info = INFO_TEXTS[p.id];
      cBox.innerHTML = adminContent.aboutHtml || ((info && info.htmlContent) ? info.htmlContent : \`<p>\${p.desc}</p><p>SifariЕџ etmЙ™k ГјГ§Гјn WhatsApp-a yГ¶nlЙ™ndirilЙ™cЙ™ksiniz.</p>\`);
    } 
    else if (tabName === "tab-rules") {`
    );

    next = next.replace(
      '      if (p.id === "netflix" || p.id === "hbomax") {',
      `      if (adminContent.rulesHtml) {
        cBox.innerHTML = adminContent.rulesHtml;
      }
      else if (p.id === "netflix" || p.id === "hbomax") {`
    );
  }

  if (!next.includes("let list = DATA.products.filter((p) => p.active !== false).filter((p) => {")) {
    next = next.replace(
      "let list = DATA.products.filter((p) => {",
      "let list = DATA.products.filter((p) => p.active !== false).filter((p) => {"
    );
  }

  return next;
}

export function patchAppSource(source, payload) {
  const admin = normalizeAdminPayload(payload);

  const data = {
    brand: admin.brand,
    categories: admin.categories,
    products: admin.products
  };

  let next = source.replace(
    /const\s+PHONE_WA\s*=\s*["'][^"']+["']\s*;/,
    `const PHONE_WA = ${JSON.stringify(admin.phone_wa)};`
  );

  next = replaceObjectDeclaration(next, DATA_MARKER, data);

  next = replaceObjectDeclaration(next, UI_MARKER, {
    ...evaluateObject(next, UI_MARKER, {}),
    ...admin.ui
  });

  next = replaceObjectDeclaration(next, SITE_SECTIONS_MARKER, admin.siteSections, CONTENT_MARKER);

  next = replaceObjectDeclaration(next, CONTENT_MARKER, admin.content, INFO_MARKER);

  next = replaceObjectDeclaration(next, CMS_MARKER, admin.cms, SITE_SECTIONS_MARKER);

  return patchRuntimeHooks(next);
}
