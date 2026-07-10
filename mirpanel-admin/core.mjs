import vm from "node:vm";

const DATA_MARKER = "const DATA";
const CONTENT_MARKER = "const ADMIN_CONTENT";
const INFO_MARKER = "const INFO_TEXTS";
const UI_MARKER = "const UI";

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

function findObjectBlock(source, marker) {
  const markerStart = source.indexOf(marker);
  if (markerStart < 0) throw new Error(`${marker} tapılmadı.`);

  const start = source.indexOf("{", markerStart);
  if (start < 0) throw new Error(`${marker} bloku tapılmadı.`);

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

  throw new Error(`${marker} bloku bağlanmayıb.`);
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
    ...(Number(plan.oldPrice) > 0 ? { oldPrice: Number(plan.oldPrice) } : {}),
    ...(plan.discount ? { discount: String(plan.discount) } : {})
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
    .replace(/[əƏ]/g, "e")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LEGACY_FLOW_FIELDS = {
  name_code_4: [
    { key: "name", type: "text", label: "Ad", placeholder: "Adınızı yazın", required: true, enabled: true },
    { key: "code_4", type: "text", label: "4 rəqəmli kod / PIN", placeholder: "4 rəqəmli kod yazın", required: true, enabled: true }
  ],
  name_code_5: [
    { key: "name", type: "text", label: "Ad", placeholder: "Adınızı yazın", required: true, enabled: true },
    { key: "code_5", type: "text", label: "5 rəqəmli kod / PIN", placeholder: "5 rəqəmli kod yazın", required: true, enabled: true }
  ],
  email: [
    { key: "email", type: "email", label: "Email / Gmail", placeholder: "Gmail ünvanınızı yazın", required: true, enabled: true }
  ],
  spotify: [
    { key: "email", type: "email", label: "Email / Gmail", placeholder: "Gmail ünvanınızı yazın", required: true, enabled: true },
    { key: "password", type: "password", label: "Şifrə", placeholder: "Şifrənizi yazın", required: true, enabled: true }
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
    label: String(field.label || field.key || `Sahə ${index + 1}`),
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
    title: "Sifarişi təsdiqləyin",
    description: "",
    confirmText: "Təsdiqləyirəm",
    cancelText: "Ləğv et",
    footerText: "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
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
    throw new Error(`${id}: kömək linki yalnız https:// ilə başlamalıdır.`);
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
    throw new Error("Boş məhsul ID-si var.");
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
    order: Number.isFinite(Number(product.order)) ? Number(product.order) : index,
    category: String(product.category || "all"),
    image: String(product.image || "assets/your.png"),
    currency: String(product.currency || "₼"),
    title: String(product.title || id),
    variant: String(product.variant || ""),
    badge: String(product.badge || ""),
    desc: String(product.desc || ""),
    note: String(product.note || ""),
    seoSlug: normalizeSeoSlug(product.seoSlug),
    seoTitle: String(product.seoTitle || ""),
    seoDescription: String(product.seoDescription || ""),
    seoKeywords: Array.isArray(product.seoKeywords)
      ? product.seoKeywords.map((keyword) => String(keyword).trim()).filter(Boolean).join(", ")
      : String(product.seoKeywords || ""),
    seoContent: String(product.seoContent || ""),
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
    confirmationModal,
    whatsapp: normalizeWhatsApp(product.whatsapp),
    plans: Array.isArray(product.plans) ? product.plans.map(normalizePlan) : [],
    orderConfirmation: confirmationModal
  };
}

export function normalizeAdminPayload(payload = {}) {
  const sourceCategories = Array.isArray(payload.categories)
    ? payload.categories.map((category) => ({
        key: String(category.key || "").trim(),
        name: String(category.name || category.label || "").trim()
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

  for (const product of products) {
    if (ids.has(product.id)) {
      throw new Error(`Təkrar məhsul ID-si: ${product.id}`);
    }

    ids.add(product.id);
  }

  const content = {};

  for (const product of products) {
    const source = payload.content?.[product.id] || {};
    const aboutHtml = String(source.aboutHtml || "").trim();
    const rulesHtml = String(source.rulesHtml || "").trim();

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
    ui
  });
}

function patchRuntimeHooks(source) {
  let next = source;

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
      cBox.innerHTML = (info && info.htmlContent) ? info.htmlContent : \`<p>\${p.desc}</p><p>Sifariş etmək üçün WhatsApp-a yönləndiriləcəksiniz.</p>\`;
    } 
    else if (tabName === "tab-rules") {`,
      `    const adminContent = ADMIN_CONTENT[p.id] || {};

    if (tabName === "tab-about") {
      const info = INFO_TEXTS[p.id];
      cBox.innerHTML = adminContent.aboutHtml || ((info && info.htmlContent) ? info.htmlContent : \`<p>\${p.desc}</p><p>Sifariş etmək üçün WhatsApp-a yönləndiriləcəksiniz.</p>\`);
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

  next = replaceObjectDeclaration(next, CONTENT_MARKER, admin.content, INFO_MARKER);

  return patchRuntimeHooks(next);
}
