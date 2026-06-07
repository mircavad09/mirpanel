const $ = (id) => document.getElementById(id);

const state = {
  data: null,
  baseSha: "",
  selectedId: "",
  dirty: false,
  modalAction: null
};

const legacyFlows = [
  ["whatsapp", "Birbaşa WhatsApp"],
  ["name_code_4", "Ad + 4 rəqəm kod"],
  ["name_code_5", "Ad + 5 rəqəm kod"],
  ["email", "Gmail form"],
  ["spotify", "Gmail + şifrə"],
  ["out_of_stock", "Stokda yoxdur"]
];

const orderFlows = [
  ["direct_whatsapp", "Birbaşa WhatsApp"],
  ["form_then_whatsapp", "Əvvəl məlumat forması, sonra WhatsApp"],
  ["confirm_then_whatsapp", "Əvvəl təsdiqləmə modalı, sonra WhatsApp"],
  ["form_confirm_whatsapp", "Əvvəl təsdiqləmə modalı, sonra məlumat forması, sonra WhatsApp"]
];

const legacyFlowDefaults = {
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

const formFieldTypes = [
  ["text", "Mətn"],
  ["tel", "Telefon"],
  ["email", "Email"],
  ["password", "Şifrə"],
  ["textarea", "Uzun qeyd"],
  ["number", "Rəqəm"]
];

const defaultUi = {
  brandSub: "",
  bannerText: "",
  searchTitle: "",
  searchDesc: "",
  bmTitle: "",
  bmSub: "",
  footRights: ""
};

function defaultConfirmation() {
  return {
    enabled: false,
    title: "Sifarişi təsdiqləyin",
    description: "",
    confirmText: "Təsdiqləyirəm",
    cancelText: "Ləğv et",
    footerText: "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
    helpLink: { enabled: false, label: "", url: "" }
  };
}

function defaultWhatsApp() {
  return { extraMessage: "", includeSeller: false, includeStock: false };
}

function defaultFormField(index = 0) {
  return {
    key: `custom_${index + 1}`,
    type: "text",
    label: "Yeni sahə",
    placeholder: "",
    required: false,
    enabled: true
  };
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("ə", "e")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ç", "c")
    .replaceAll("ğ", "g")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function imageUrl(path) {
  return /^https?:/i.test(path || "")
    ? path
    : `https://mirpanel.com/${path || "assets/your.png"}`;
}

function ensureConfirmation(product) {
  const source = product.orderConfirmation || product.confirmationModal || {};
  const base = defaultConfirmation();

  const confirmation = {
    ...base,
    ...source,
    helpLink: {
      ...base.helpLink,
      ...(source.helpLink || {})
    }
  };

  product.orderConfirmation = confirmation;
  product.confirmationModal = confirmation;
  return confirmation;
}

function activeFormFields(product) {
  return Array.isArray(product.formFields)
    ? product.formFields.filter((field) => field.enabled !== false)
    : [];
}

function cloneLegacyFields(flow) {
  return (legacyFlowDefaults[flow] || []).map((field) => ({ ...field }));
}

function syncLegacyFlow(product, overwriteFields = false) {
  const confirmation = ensureConfirmation(product);
  const legacyFields = cloneLegacyFields(product.flow);

  if (product.flow === "out_of_stock") {
    product.soldOut = true;
    product.orderFlow = "direct_whatsapp";
    return;
  }

  if (product.flow === "whatsapp") {
    if (overwriteFields) product.formFields = [];
    if (!activeFormFields(product).length) {
      product.orderFlow = confirmation.enabled ? "confirm_then_whatsapp" : "direct_whatsapp";
    }
    return;
  }

  if (legacyFields.length && (overwriteFields || !activeFormFields(product).length)) {
    product.formFields = legacyFields;
  }
}

function syncOrderFlow(product) {
  syncLegacyFlow(product);
  const confirmation = ensureConfirmation(product);
  const hasFields = activeFormFields(product).length > 0;

  if (confirmation.enabled) {
    product.orderFlow = hasFields ? "form_confirm_whatsapp" : "confirm_then_whatsapp";
    return;
  }

  if (!orderFlows.some(([value]) => value === product.orderFlow)) {
    product.orderFlow = hasFields ? "form_then_whatsapp" : "direct_whatsapp";
  }
}

function ensureProduct(product) {
  product.id = slug(product.id || product.title || "product");
  product.order = Number.isFinite(Number(product.order)) ? Number(product.order) : 0;
  product.category = product.category || "all";
  product.image = product.image || "assets/your.png";
  product.currency = product.currency || "₼";
  product.title = product.title || product.id;
  product.variant = product.variant || "";
  product.badge = product.badge || "";
  product.desc = product.desc || "";
  product.note = product.note || "";
  product.flow = product.flow || "whatsapp";
  product.soldOut = Boolean(product.soldOut);
  product.active = product.active !== false;
  product.stock = product.stock === undefined || product.stock === "" ? null : product.stock;
  product.stockEnabled = Boolean(product.stockEnabled);
  product.seller = product.seller || "";
  product.bestSeller = Boolean(product.bestSeller);
  product.formFields = Array.isArray(product.formFields) ? product.formFields : [];
  product.whatsapp = { ...defaultWhatsApp(), ...(product.whatsapp || {}) };
  product.plans = Array.isArray(product.plans) ? product.plans : [];
  ensureConfirmation(product);
  syncOrderFlow(product);
  if (product.stockEnabled && Number(product.stock) > 0 && product.flow !== "out_of_stock") product.soldOut = false;
  return product;
}

function syncAllProducts() {
  if (!state.data) return;
  state.data.products.forEach(ensureProduct);
  state.data.ui = { ...defaultUi, ...(state.data.ui || {}) };
}

function selectedProduct() {
  const product = state.data?.products.find((item) => item.id === state.selectedId) || null;
  return product ? ensureProduct(product) : null;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Server xətası: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setLoading(active, text = "Yüklənir...") {
  $("loading").classList.toggle("hidden", !active);
  $("loadingText").textContent = text;
  $("saveBtn").disabled = active;
  $("refreshBtn").disabled = active;
}

function toast(text, type = "good") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = text;
  $("toasts").appendChild(item);
  setTimeout(() => item.remove(), 4200);
}

function markDirty() {
  state.dirty = true;
  renderStats();
}

function renderOptions(items, selected) {
  return items.map(([value, label]) => `
    <option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>
      ${escapeHtml(label)}
    </option>
  `).join("");
}

function minimumPrice(product) {
  const prices = (product.plans || [])
    .map((plan) => Number(plan.price))
    .filter((price) => price > 0);
  return prices.length ? Math.min(...prices).toFixed(2) : "0.00";
}

async function loadState() {
  setLoading(true, "GitHub məlumatları oxunur...");
  try {
    const payload = await api("/api/admin/state");
    state.data = payload.data;
    state.baseSha = payload.sha;
    state.data.products = (state.data.products || []).map(ensureProduct);
    state.data.categories = Array.isArray(state.data.categories) ? state.data.categories : [];
    state.data.content = state.data.content || {};
    state.data.ui = { ...defaultUi, ...(state.data.ui || {}) };
    state.selectedId = state.data.products[0]?.id || "";
    state.dirty = false;
    $("commitInfo").textContent = `Yükləndi: ${new Date(payload.loadedAt).toLocaleString("az-AZ")} / ${payload.sha.slice(0, 7)}`;
    renderAll();
  } catch (error) {
    if (error.status === 401) location.href = "/login.html";
    else toast(error.message, "bad");
  } finally {
    setLoading(false);
  }
}

async function saveState() {
  if (!state.data) return;
  if (!state.dirty) {
    toast("Saxlanacaq dəyişiklik yoxdur.", "bad");
    return;
  }

  syncAllProducts();

  const invalidHelp = state.data.products.find((product) => {
    const help = ensureConfirmation(product).helpLink;
    return help.enabled && help.url && !help.url.startsWith("https://");
  });

  if (invalidHelp) {
    toast(`${invalidHelp.title}: kömək linki yalnız https:// ilə başlamalıdır.`, "bad");
    return;
  }

  setLoading(true, "Dəyişikliklər GitHub-a yazılır...");
  try {
    const payload = await api("/api/admin/save", {
      method: "POST",
      body: JSON.stringify({ baseSha: state.baseSha, data: state.data })
    });
    state.baseSha = payload.sha;
    state.dirty = false;
    $("commitInfo").textContent = `Commit: ${payload.commitSha.slice(0, 7)} / ${new Date(payload.committedAt).toLocaleString("az-AZ")}`;
    renderStats();
    toast(payload.cacheCommitSha ? "Saxlandı və cache versiyası yeniləndi." : "Saxlandı.");
  } catch (error) {
    if (error.status === 401) location.href = "/login.html";
    else if (error.status === 409) toast("Conflict: GitHub-da app.js dəyişib. Yenilə düyməsini bas.", "bad");
    else toast(error.message, "bad");
  } finally {
    setLoading(false);
  }
}

function renderStats() {
  if (!state.data) return;
  $("statProducts").textContent = state.data.products.length;
  $("statActive").textContent = state.data.products.filter((p) => p.active !== false).length;
  $("statCategories").textContent = state.data.categories.length;
  $("statDirty").textContent = state.dirty ? "Var" : "Yoxdur";
}

function renderFilters() {
  const current = $("categoryFilter").value || "all";
  $("categoryFilter").innerHTML = `
    <option value="all">Bütün kateqoriyalar</option>
    ${state.data.categories.map((cat) => `
      <option value="${escapeHtml(cat.key)}">${escapeHtml(cat.name)}</option>
    `).join("")}
  `;
  $("categoryFilter").value = [...$("categoryFilter").options].some((o) => o.value === current) ? current : "all";
}

function renderProducts() {
  const query = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const status = $("statusFilter").value;

  const products = state.data.products
    .slice()
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .filter((product) => {
      const blob = [product.title, product.id, product.badge, product.variant].join(" ").toLowerCase();
      const visibleByStatus =
        status === "all" ||
        (status === "active" && product.active !== false) ||
        (status === "inactive" && product.active === false) ||
        (status === "soldout" && (product.soldOut || (product.stockEnabled && Number(product.stock) <= 0)));
      return (!query || blob.includes(query)) &&
        (category === "all" || product.category === category) &&
        visibleByStatus;
    });

  if (!products.length) {
    $("productList").innerHTML = `<div class="emptyState">Nəticə tapılmadı.</div>`;
    return;
  }

  $("productList").innerHTML = products.map((product) => `
    <button class="productItem ${product.id === state.selectedId ? "active" : ""}" data-id="${escapeHtml(product.id)}">
      <img src="${escapeHtml(imageUrl(product.image))}" alt="">
      <div>
        <strong>${escapeHtml(product.title)}</strong>
        <span>${escapeHtml(product.category)} / ${product.active === false ? "Deaktiv" : "Aktiv"}</span>
      </div>
      <b class="price">${minimumPrice(product)} ${escapeHtml(product.currency)}</b>
    </button>
  `).join("");

  document.querySelectorAll(".productItem").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.id;
      renderProducts();
      renderProductForm();
    });
  });
}

function renderProductForm() {
  const product = selectedProduct();
  $("productEmpty").classList.toggle("hidden", Boolean(product));
  $("productForm").classList.toggle("hidden", !product);
  if (!product) return;

  const confirmation = ensureConfirmation(product);
  $("previewImage").src = imageUrl(product.image);
  $("previewTitle").textContent = product.title;
  $("previewMeta").textContent = `${product.id} / ${product.category}`;

  setValue("productActive", product.active !== false, "checked");
  setValue("productOrder", product.order ?? "");
  setValue("productId", product.id);
  setValue("productTitle", product.title);
  setValue("productVariant", product.variant);
  $("productCategory").innerHTML = renderOptions(state.data.categories.map((c) => [c.key, c.name]), product.category);
  $("productFlow").innerHTML = renderOptions(legacyFlows, product.flow);
  $("productOrderFlow").innerHTML = renderOptions(orderFlows, product.orderFlow);
  setValue("productImage", product.image);
  setValue("productBadge", product.badge);
  setValue("productCurrency", product.currency);
  setValue("productSoldOut", String(Boolean(product.soldOut)));
  setValue("productStock", product.stock ?? "");
  setValue("productStockEnabled", product.stockEnabled, "checked");
  setValue("productSeller", product.seller);
  setValue("productBestSeller", product.bestSeller, "checked");
  setValue("productDesc", product.desc);
  setValue("productNote", product.note);
  setValue("aboutHtml", state.data.content[product.id]?.aboutHtml || "");
  setValue("rulesHtml", state.data.content[product.id]?.rulesHtml || "");

  setValue("orderConfirmationEnabled", confirmation.enabled, "checked");
  setValue("orderConfirmationTitle", confirmation.title);
  setValue("orderConfirmationDescription", confirmation.description);
  setValue("orderConfirmationConfirmText", confirmation.confirmText);
  setValue("orderConfirmationCancelText", confirmation.cancelText);
  setValue("orderConfirmationFooterText", confirmation.footerText);
  setValue("orderConfirmationHelpEnabled", confirmation.helpLink.enabled, "checked");
  setValue("orderConfirmationHelpLabel", confirmation.helpLink.label);
  setValue("orderConfirmationHelpUrl", confirmation.helpLink.url);

  setValue("whatsappIncludeSeller", product.whatsapp.includeSeller, "checked");
  setValue("whatsappIncludeStock", product.whatsapp.includeStock, "checked");
  setValue("whatsappExtraMessage", product.whatsapp.extraMessage);

  updateHelpFields();
  renderPlans(product);
  renderFormFields(product);
}

function setValue(id, value, prop = "value") {
  $(id)[prop] = value;
}

function bindProductField(id, update) {
  const handler = () => {
    const product = selectedProduct();
    if (!product) return;
    update(product, $(id));
    syncOrderFlow(product);
    markDirty();
    renderProducts();
  };
  $(id).addEventListener("input", handler);
  $(id).addEventListener("change", handler);
}

bindProductField("productActive", (p, e) => p.active = e.checked);
bindProductField("productOrder", (p, e) => p.order = e.value === "" ? null : Number(e.value));
bindProductField("productId", (p, e) => {
  const oldId = p.id;
  const nextId = slug(e.value);
  if (!nextId) return;
  p.id = nextId;
  state.selectedId = nextId;
  state.data.content[nextId] = state.data.content[oldId] || {};
  if (oldId !== nextId) delete state.data.content[oldId];
});
bindProductField("productTitle", (p, e) => { p.title = e.value; $("previewTitle").textContent = p.title; });
bindProductField("productVariant", (p, e) => p.variant = e.value);
bindProductField("productCategory", (p, e) => p.category = e.value);
bindProductField("productFlow", (p, e) => {
  p.flow = e.value;
  syncLegacyFlow(p, true);
});
bindProductField("productOrderFlow", (p, e) => p.orderFlow = e.value);
bindProductField("productImage", (p, e) => { p.image = e.value; $("previewImage").src = imageUrl(p.image); });
bindProductField("productBadge", (p, e) => p.badge = e.value);
bindProductField("productCurrency", (p, e) => p.currency = e.value);
bindProductField("productSoldOut", (p, e) => {
  p.soldOut = e.value === "true";
  if (p.soldOut) p.flow = "out_of_stock";
});
bindProductField("productStock", (p, e) => {
  p.stock = e.value === "" ? null : Math.max(0, Number(e.value) || 0);
  if (p.stockEnabled && Number(p.stock) > 0 && p.flow !== "out_of_stock") p.soldOut = false;
  if (p.stockEnabled && Number(p.stock) <= 0) p.soldOut = true;
});
bindProductField("productStockEnabled", (p, e) => {
  p.stockEnabled = e.checked;
  if (p.stockEnabled && Number(p.stock) > 0 && p.flow !== "out_of_stock") p.soldOut = false;
  if (p.stockEnabled && Number(p.stock) <= 0) p.soldOut = true;
});
bindProductField("productSeller", (p, e) => p.seller = e.value);
bindProductField("productBestSeller", (p, e) => p.bestSeller = e.checked);
bindProductField("productDesc", (p, e) => p.desc = e.value);
bindProductField("productNote", (p, e) => p.note = e.value);
bindProductField("aboutHtml", (p, e) => { state.data.content[p.id] ??= {}; state.data.content[p.id].aboutHtml = e.value; });
bindProductField("rulesHtml", (p, e) => { state.data.content[p.id] ??= {}; state.data.content[p.id].rulesHtml = e.value; });

$("productFlow").addEventListener("change", () => renderProductForm());

bindProductField("orderConfirmationEnabled", (p, e) => ensureConfirmation(p).enabled = e.checked);
bindProductField("orderConfirmationTitle", (p, e) => ensureConfirmation(p).title = e.value);
bindProductField("orderConfirmationDescription", (p, e) => ensureConfirmation(p).description = e.value);
bindProductField("orderConfirmationConfirmText", (p, e) => ensureConfirmation(p).confirmText = e.value);
bindProductField("orderConfirmationCancelText", (p, e) => ensureConfirmation(p).cancelText = e.value);
bindProductField("orderConfirmationFooterText", (p, e) => ensureConfirmation(p).footerText = e.value);
bindProductField("orderConfirmationHelpEnabled", (p, e) => { ensureConfirmation(p).helpLink.enabled = e.checked; updateHelpFields(); });
bindProductField("orderConfirmationHelpLabel", (p, e) => ensureConfirmation(p).helpLink.label = e.value);
bindProductField("orderConfirmationHelpUrl", (p, e) => ensureConfirmation(p).helpLink.url = e.value.trim());
bindProductField("whatsappIncludeSeller", (p, e) => p.whatsapp.includeSeller = e.checked);
bindProductField("whatsappIncludeStock", (p, e) => p.whatsapp.includeStock = e.checked);
bindProductField("whatsappExtraMessage", (p, e) => p.whatsapp.extraMessage = e.value);

function updateHelpFields() {
  const enabled = $("orderConfirmationHelpEnabled").checked;
  $("orderConfirmationHelpFields").classList.toggle("hidden", !enabled);
  $("orderConfirmationHelpLabel").disabled = !enabled;
  $("orderConfirmationHelpUrl").disabled = !enabled;
}

function renderPlans(product) {
  $("plans").innerHTML = (product.plans || []).map((plan, index) => `
    <div class="planRow">
      <input data-plan="${index}" data-field="label" placeholder="Label" value="${escapeHtml(plan.label || "")}">
      <input data-plan="${index}" data-field="months" type="number" placeholder="Ay" value="${escapeHtml(plan.months ?? "")}">
      <input data-plan="${index}" data-field="price" type="number" step="0.01" placeholder="Qiymət" value="${escapeHtml(plan.price ?? "")}">
      <input data-plan="${index}" data-field="oldPrice" type="number" step="0.01" placeholder="Köhnə qiymət" value="${escapeHtml(plan.oldPrice ?? "")}">
      <input data-plan="${index}" data-field="discount" placeholder="Endirim" value="${escapeHtml(plan.discount || "")}">
      <button class="iconBtn removePlan" data-plan="${index}" type="button">X</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", () => {
      const plan = product.plans[Number(input.dataset.plan)];
      if (!plan) return;
      if (["label", "discount"].includes(input.dataset.field)) plan[input.dataset.field] = input.value;
      else if (input.value === "") delete plan[input.dataset.field];
      else plan[input.dataset.field] = Number(input.value);
      markDirty();
      renderProducts();
    });
  });

  document.querySelectorAll(".removePlan").forEach((button) => {
    button.addEventListener("click", () => {
      product.plans.splice(Number(button.dataset.plan), 1);
      markDirty();
      renderPlans(product);
      renderProducts();
    });
  });
}

function renderFormFields(product) {
  if (!product.formFields.length) {
    $("formFields").innerHTML = `<div class="emptyMini">Forma sahəsi yoxdur.</div>`;
    return;
  }

  $("formFields").innerHTML = product.formFields.map((field, index) => `
    <div class="formFieldRow">
      <label class="switchLine"><input data-form-index="${index}" data-form-field="enabled" type="checkbox" ${field.enabled !== false ? "checked" : ""}><span>Aktiv</span></label>
      <label>Key<input data-form-index="${index}" data-form-field="key" value="${escapeHtml(field.key || "")}"></label>
      <label>Tip<select data-form-index="${index}" data-form-field="type">${renderOptions(formFieldTypes, field.type || "text")}</select></label>
      <label>Label<input data-form-index="${index}" data-form-field="label" value="${escapeHtml(field.label || "")}"></label>
      <label>Placeholder<input data-form-index="${index}" data-form-field="placeholder" value="${escapeHtml(field.placeholder || "")}"></label>
      <label class="switchLine"><input data-form-index="${index}" data-form-field="required" type="checkbox" ${field.required ? "checked" : ""}><span>Məcburi</span></label>
      <button class="iconBtn removeFormField" data-form-index="${index}" type="button">X</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-form-field]").forEach((input) => {
    const update = () => {
      const field = product.formFields[Number(input.dataset.formIndex)];
      if (!field) return;
      const key = input.dataset.formField;
      if (input.type === "checkbox") field[key] = input.checked;
      else if (key === "key") field.key = slug(input.value || `custom_${input.dataset.formIndex}`);
      else field[key] = input.value;
      syncOrderFlow(product);
      markDirty();
      $("productOrderFlow").value = product.orderFlow;
    };
    input.addEventListener("input", update);
    input.addEventListener("change", update);
  });

  document.querySelectorAll(".removeFormField").forEach((button) => {
    button.addEventListener("click", () => {
      product.formFields.splice(Number(button.dataset.formIndex), 1);
      syncOrderFlow(product);
      markDirty();
      renderFormFields(product);
      $("productOrderFlow").value = product.orderFlow;
    });
  });
}

function renderCategories() {
  $("categoriesBody").innerHTML = state.data.categories.map((category, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><input data-cat="${index}" data-cat-field="key" value="${escapeHtml(category.key)}"></td>
      <td><input data-cat="${index}" data-cat-field="name" value="${escapeHtml(category.name)}"></td>
      <td>${state.data.products.filter((p) => p.category === category.key).length}</td>
      <td><button class="btn danger deleteCat" data-cat="${index}">Sil</button></td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-cat-field]").forEach((input) => {
    input.addEventListener("input", () => {
      const category = state.data.categories[Number(input.dataset.cat)];
      const oldKey = category.key;
      category[input.dataset.catField] = input.dataset.catField === "key" ? slug(input.value) : input.value;
      if (oldKey !== category.key) {
        state.data.products.forEach((product) => {
          if (product.category === oldKey) product.category = category.key;
        });
      }
      markDirty();
      renderFilters();
    });
  });

  document.querySelectorAll(".deleteCat").forEach((button) => {
    button.addEventListener("click", () => confirmDeleteCategory(Number(button.dataset.cat)));
  });
}

function renderSettings() {
  const ui = state.data.ui || {};
  setValue("settingBrand", state.data.brand || "Mirpanel");
  setValue("settingPhone", state.data.phone_wa || "https://wa.me/994515243545");
  setValue("settingBrandSub", ui.brandSub || "");
  setValue("settingBannerText", ui.bannerText || "");
  setValue("settingSearchTitle", ui.searchTitle || "");
  setValue("settingSearchDesc", ui.searchDesc || "");
  setValue("settingCampaignTitle", ui.bmTitle || "");
  setValue("settingCampaignText", ui.bmSub || "");
  setValue("settingFootRights", ui.footRights || "");
}

function bindSetting(id, key, target = "ui") {
  $(id).addEventListener("input", () => {
    if (target === "root") state.data[key] = $(id).value;
    else {
      state.data.ui ??= {};
      state.data.ui[key] = $(id).value;
    }
    markDirty();
  });
}

bindSetting("settingBrand", "brand", "root");
bindSetting("settingPhone", "phone_wa", "root");
bindSetting("settingBrandSub", "brandSub");
bindSetting("settingBannerText", "bannerText");
bindSetting("settingSearchTitle", "searchTitle");
bindSetting("settingSearchDesc", "searchDesc");
bindSetting("settingCampaignTitle", "bmTitle");
bindSetting("settingCampaignText", "bmSub");
bindSetting("settingFootRights", "footRights");

function renderAll() {
  renderStats();
  renderFilters();
  renderProducts();
  renderProductForm();
  renderCategories();
  renderSettings();
}

function showView(view) {
  ["products", "categories", "settings"].forEach((name) => {
    $(`${name}View`).classList.toggle("hidden", name !== view);
  });
  document.querySelectorAll(".navBtn[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  $("crumb").textContent = { products: "Məhsullar", categories: "Kateqoriyalar", settings: "Ayarlar" }[view];
}

function openModal(title, body, confirmText, action) {
  $("modalTitle").textContent = title;
  $("modalBody").innerHTML = body;
  $("modalConfirm").textContent = confirmText;
  state.modalAction = action;
  $("modal").classList.remove("hidden");
}

function closeModal() {
  $("modal").classList.add("hidden");
  state.modalAction = null;
}

function confirmDeleteCategory(index) {
  const category = state.data.categories[index];
  openModal("Kateqoriyanı sil", `<p>${escapeHtml(category.name)} silinsin?</p>`, "Sil", () => {
    state.data.products.forEach((product) => {
      if (product.category === category.key) product.category = "all";
    });
    state.data.categories.splice(index, 1);
    markDirty();
    renderAll();
    closeModal();
  });
}

$("addProductBtn").addEventListener("click", () => {
  openModal("Yeni məhsul", `
    <div class="modalGrid">
      <label>Ad<input id="newProductTitle"></label>
      <label>ID<input id="newProductId"></label>
      <label>Şəkil yolu<input id="newProductImage" value="assets/your.png"></label>
    </div>
  `, "Əlavə et", () => {
    const title = $("newProductTitle").value.trim();
    const id = slug($("newProductId").value || title);
    if (!title || !id) return toast("Ad və ID tələb olunur.", "bad");
    if (state.data.products.some((product) => product.id === id)) return toast("Bu ID artıq var.", "bad");
    state.data.products.push(ensureProduct({
      id,
      order: state.data.products.length,
      category: "all",
      image: $("newProductImage").value,
      currency: "₼",
      title,
      badge: "Premium",
      plans: []
    }));
    state.data.content[id] = { aboutHtml: "", rulesHtml: "" };
    state.selectedId = id;
    markDirty();
    renderAll();
    closeModal();
  });
});

$("deleteProductBtn").addEventListener("click", () => {
  const product = selectedProduct();
  if (!product) return;
  openModal("Məhsulu sil", `<p>${escapeHtml(product.title)} silinsin?</p>`, "Sil", () => {
    state.data.products = state.data.products.filter((item) => item.id !== product.id);
    delete state.data.content[product.id];
    state.selectedId = state.data.products[0]?.id || "";
    markDirty();
    renderAll();
    closeModal();
  });
});

$("addCategoryBtn").addEventListener("click", () => {
  openModal("Yeni kateqoriya", `
    <div class="modalGrid">
      <label>Ad<input id="newCategoryName"></label>
      <label>Key<input id="newCategoryKey"></label>
    </div>
  `, "Əlavə et", () => {
    const name = $("newCategoryName").value.trim();
    const key = slug($("newCategoryKey").value || name);
    if (!name || !key) return toast("Ad və key tələb olunur.", "bad");
    if (state.data.categories.some((category) => category.key === key)) return toast("Bu key artıq var.", "bad");
    state.data.categories.push({ key, name });
    markDirty();
    renderAll();
    closeModal();
  });
});

$("addPlanBtn").addEventListener("click", () => {
  const product = selectedProduct();
  if (!product) return;
  product.plans.push({ label: "", months: 1, price: 0 });
  markDirty();
  renderPlans(product);
  renderProducts();
});

$("addFormFieldBtn").addEventListener("click", () => {
  const product = selectedProduct();
  if (!product) return;
  product.formFields.push(defaultFormField(product.formFields.length));
  syncOrderFlow(product);
  $("productOrderFlow").value = product.orderFlow;
  markDirty();
  renderFormFields(product);
});

$("previewOrderConfirmationBtn").addEventListener("click", () => {
  const product = selectedProduct();
  if (!product) return;
  const c = ensureConfirmation(product);
  const helpUrl = c.helpLink.url.trim();
  const showHelp = c.helpLink.enabled && helpUrl.startsWith("https://") && c.helpLink.label.trim();
  openModal(c.title || "Sifariş təsdiqi", `
    <div class="confirmationPreview">
      <p>${escapeHtml(c.description)}</p>
      ${showHelp ? `<a href="${escapeHtml(helpUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.helpLink.label)}</a>` : ""}
      <div class="confirmationPreviewActions">
        <button class="btn" type="button" disabled>${escapeHtml(c.cancelText)}</button>
        <button class="btn primary" type="button" disabled>${escapeHtml(c.confirmText)}</button>
      </div>
      <small>${escapeHtml(c.footerText)}</small>
    </div>
  `, "Bağla", closeModal);
});

$("refreshBtn").addEventListener("click", () => {
  if (state.dirty && !confirm("Saxlanılmamış dəyişikliklər silinəcək. Davam et?")) return;
  loadState();
});
$("saveBtn").addEventListener("click", saveState);
$("searchInput").addEventListener("input", renderProducts);
$("categoryFilter").addEventListener("change", renderProducts);
$("statusFilter").addEventListener("change", renderProducts);
$("modalClose").addEventListener("click", closeModal);
$("modalCancel").addEventListener("click", closeModal);
$("modalConfirm").addEventListener("click", () => state.modalAction?.());
$("modal").addEventListener("click", (event) => { if (event.target === $("modal")) closeModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
document.querySelectorAll(".navBtn[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});
$("logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  location.href = "/login.html";
});

loadState();
