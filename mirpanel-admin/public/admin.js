const $ = (id) => document.getElementById(id);

const state = {
  data: null,
  baseSha: "",
  selectedId: "",
  dirty: false,
  modalAction: null
};

const flows = [
  ["whatsapp", "Birbaşa WhatsApp"],
  ["name_code_4", "Ad + 4 rəqəm kod"],
  ["name_code_5", "Ad + 5 rəqəm kod"],
  ["email", "Gmail form"],
  ["spotify", "Gmail + şifrə"],
  ["out_of_stock", "Stokda yoxdur"]
];

const formFieldTypes = [
  ["text", "Mətn"],
  ["tel", "Telefon"],
  ["email", "Email"],
  ["password", "Şifrə"],
  ["textarea", "Uzun qeyd"],
  ["number", "Rəqəm"]
];

const orderFlows = new Set([
  "direct_whatsapp",
  "form_then_whatsapp",
  "confirm_then_whatsapp",
  "form_confirm_whatsapp"
]);

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

function ensureOrderConfirmation(product) {
  const defaults = defaultOrderConfirmation();

  product.orderConfirmation = {
    ...defaults,
    ...(product.orderConfirmation || {}),
    helpLink: {
      ...defaults.helpLink,
      ...(product.orderConfirmation?.helpLink || {})
    }
  };

  return product.orderConfirmation;
}

function defaultWhatsAppSettings() {
  return {
    extraMessage: "",
    includeSeller: true,
    includeStock: false
  };
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

function fieldsForLegacyFlow(flow, id = "") {
  if (flow === "spotify" || id === "spotify") {
    return [
      {
        key: "email",
        type: "email",
        label: "Email",
        placeholder: "Spotify hesab emailinizi yazın",
        required: true,
        enabled: true
      },
      {
        key: "password",
        type: "password",
        label: "Şifrə",
        placeholder: "Spotify hesab şifrənizi yazın",
        required: true,
        enabled: true
      }
    ];
  }

  if (flow === "email") {
    return [
      {
        key: "email",
        type: "email",
        label: "Email",
        placeholder: "Gmail hesabınızı yazın",
        required: true,
        enabled: true
      }
    ];
  }

  if (flow === "name_code_4" || flow === "name_code_5") {
    const digits = flow === "name_code_5" ? "5" : "4";

    return [
      {
        key: "name",
        type: "text",
        label: "Ad",
        placeholder: "Adınızı yazın",
        required: true,
        enabled: true
      },
      {
        key: `code_${digits}`,
        type: "text",
        label: `${digits} rəqəmli kod`,
        placeholder: `${digits} rəqəmli kodu yazın`,
        required: true,
        enabled: true
      }
    ];
  }

  return [];
}

function inferOrderFlow(product) {
  if (orderFlows.has(product.orderFlow)) {
    return product.orderFlow;
  }

  const hasFields =
    Array.isArray(product.formFields) &&
    product.formFields.some((field) => field.enabled !== false);
  const hasModal = ensureOrderConfirmation(product).enabled;

  if (hasFields && hasModal) return "form_confirm_whatsapp";
  if (hasModal) return "confirm_then_whatsapp";
  if (hasFields) return "form_then_whatsapp";

  return "direct_whatsapp";
}

function ensureAdvancedProduct(product) {
  const confirmation = ensureOrderConfirmation(product);

  if (!product.confirmationModal) {
    product.confirmationModal = confirmation;
  }

  product.orderConfirmation = {
    ...confirmation,
    ...product.confirmationModal,
    helpLink: {
      ...confirmation.helpLink,
      ...(product.confirmationModal?.helpLink || {})
    }
  };

  product.confirmationModal = product.orderConfirmation;
  product.whatsapp = {
    ...defaultWhatsAppSettings(),
    ...(product.whatsapp || {})
  };
  product.formFields = Array.isArray(product.formFields)
    ? product.formFields
    : fieldsForLegacyFlow(product.flow, product.id);
  product.orderFlow = inferOrderFlow(product);
  product.seller = product.seller || "";
  product.stock = product.stock ?? "";
  product.stockEnabled = Boolean(product.stockEnabled);
  product.bestSeller = Boolean(product.bestSeller);

  return product;
}

const imageUrl = (path) =>
  /^https?:/i.test(path || "")
    ? path
    : `https://mirpanel.com/${path || "assets/your.png"}`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slug = (value) =>
  String(value || "")
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

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload.error || `Server xətası: ${response.status}`
    );

    error.status = response.status;
    throw error;
  }

  return payload;
}

function setLoading(active, text = "Yüklənir...") {
  $("loading").classList.toggle("hidden", !active);
  $("loadingText").textContent = text;
  $("saveBtn").disabled = active;
}

function toast(text, type = "good") {
  const element = document.createElement("div");

  element.className = `toast ${type}`;
  element.textContent = text;

  $("toasts").appendChild(element);

  setTimeout(() => {
    element.remove();
  }, 4200);
}

function markDirty() {
  state.dirty = true;
  renderStats();
}

function selectedProduct() {
  const product = (
    state.data?.products.find(
      (product) => product.id === state.selectedId
    ) || null
  );

  return product ? ensureAdvancedProduct(product) : null;
}

function minimumPrice(product) {
  const values = (product.plans || [])
    .map((plan) => Number(plan.price))
    .filter((price) => price > 0);

  return values.length
    ? Math.min(...values).toFixed(2)
    : "0.00";
}

async function loadState() {
  setLoading(true, "GitHub məlumatları oxunur...");

  try {
    const payload = await api("/api/admin/state");

    state.data = payload.data;
    state.baseSha = payload.sha;
    state.selectedId = state.data.products[0]?.id || "";
    state.dirty = false;

    $("commitInfo").textContent =
      `Yükləndi: ${new Date(payload.loadedAt)
        .toLocaleString("az-AZ")} / ${payload.sha.slice(0, 7)}`;

    renderAll();
    toast("Məlumatlar GitHub-dan yükləndi.");
  } catch (error) {
    if (error.status === 401) {
      location.href = "/login.html";
      return;
    }

    toast(error.message, "bad");
  } finally {
    setLoading(false);
  }
}

async function saveState() {
  if (!state.data || !state.dirty) {
    toast("Saxlanacaq dəyişiklik yoxdur.", "bad");
    return;
  }

  const invalidProduct = state.data.products.find((product) => {
    const confirmation = ensureOrderConfirmation(product);
    const helpUrl = confirmation.helpLink.url.trim();

    return (
      confirmation.helpLink.enabled &&
      helpUrl &&
      !helpUrl.startsWith("https://")
    );
  });

  if (invalidProduct) {
    toast(
      `${invalidProduct.title}: kömək linki https:// ilə başlamalıdır.`,
      "bad"
    );
    return;
  }

  setLoading(true, "Dəyişikliklər GitHub-a yazılır...");

  try {
    const payload = await api("/api/admin/save", {
      method: "POST",
      body: JSON.stringify({
        baseSha: state.baseSha,
        data: state.data
      })
    });

    state.baseSha = payload.sha;
    state.dirty = false;

    renderStats();

    $("commitInfo").textContent =
      `Commit: ${payload.commitSha.slice(0, 7)} / ` +
      new Date(payload.committedAt).toLocaleString("az-AZ");

    toast("Dəyişikliklər GitHub-a yazıldı.");
  } catch (error) {
    if (error.status === 401) {
      location.href = "/login.html";
      return;
    }

    if (error.status === 409) {
      toast(
        "Conflict: GitHub-da app.js dəyişib. Yenilə düyməsini bas.",
        "bad"
      );

      return;
    }

    toast(error.message, "bad");
  } finally {
    setLoading(false);
  }
}

function renderAll() {
  renderStats();
  renderFilters();
  renderProducts();
  renderProductForm();
  renderCategories();
  renderSettings();
}

function renderStats() {
  if (!state.data) return;

  $("statProducts").textContent =
    state.data.products.length;

  $("statActive").textContent =
    state.data.products.filter(
      (product) => product.active !== false
    ).length;

  $("statCategories").textContent =
    state.data.categories.length;

  $("statDirty").textContent =
    state.dirty ? "Var" : "Yoxdur";
}

function renderFilters() {
  const previousValue =
    $("categoryFilter").value || "all";

  const items = state.data.categories
    .filter((category) => category.key !== "all")
    .map((category) => `
      <option value="${escapeHtml(category.key)}">
        ${escapeHtml(category.name)}
      </option>
    `)
    .join("");

  $("categoryFilter").innerHTML = `
    <option value="all">Bütün kateqoriyalar</option>
    ${items}
  `;

  const exists = [
    ...$("categoryFilter").options
  ].some((option) => option.value === previousValue);

  $("categoryFilter").value =
    exists ? previousValue : "all";
}

function renderProducts() {
  const query =
    $("searchInput").value.trim().toLowerCase();

  const category =
    $("categoryFilter").value;

  const status =
    $("statusFilter").value;

  const products = state.data.products
    .slice()
    .sort((left, right) =>
      (left.order ?? 999) - (right.order ?? 999)
    )
    .filter((product) => {
      const text = [
        product.title,
        product.id,
        product.badge,
        product.variant
      ].join(" ").toLowerCase();

      const matchesQuery =
        !query || text.includes(query);

      const matchesCategory =
        category === "all" ||
        product.category === category;

      const matchesStatus =
        status === "all" ||
        (
          status === "active" &&
          product.active !== false
        ) ||
        (
          status === "inactive" &&
          product.active === false
        ) ||
        (
          status === "soldout" &&
          product.soldOut
        );

      return (
        matchesQuery &&
        matchesCategory &&
        matchesStatus
      );
    });

  if (!products.length) {
    $("productList").innerHTML = `
      <div class="emptyState">
        Nəticə tapılmadı.
      </div>
    `;

    return;
  }

  $("productList").innerHTML = products
    .map((product) => `
      <button
        class="productItem ${
          product.id === state.selectedId
            ? "active"
            : ""
        }"
        data-id="${escapeHtml(product.id)}"
      >
        <img
          src="${escapeHtml(imageUrl(product.image))}"
          alt=""
        >

        <div>
          <strong>${escapeHtml(product.title)}</strong>

          <span>
            ${escapeHtml(product.category)} /
            ${
              product.active === false
                ? "Deaktiv"
                : "Aktiv"
            }
          </span>
        </div>

        <b class="price">
          ${minimumPrice(product)}
          ${escapeHtml(product.currency)}
        </b>
      </button>
    `)
    .join("");

  document
    .querySelectorAll(".productItem")
    .forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedId = button.dataset.id;

        renderProducts();
        renderProductForm();
      });
    });
}

function renderOptions(items, selectedValue) {
  return items
    .map(([value, label]) => `
      <option
        value="${escapeHtml(value)}"
        ${value === selectedValue ? "selected" : ""}
      >
        ${escapeHtml(label)}
      </option>
    `)
    .join("");
}

function renderProductForm() {
  const product = selectedProduct();

  $("productEmpty").classList.toggle(
    "hidden",
    Boolean(product)
  );

  $("productForm").classList.toggle(
    "hidden",
    !product
  );

  if (!product) return;
  const confirmation = ensureOrderConfirmation(product);

  $("previewImage").src = imageUrl(product.image);
  $("previewTitle").textContent = product.title;
  $("previewMeta").textContent =
    `${product.id} / ${product.category}`;

  $("productActive").checked =
    product.active !== false;

  $("productOrder").value =
    product.order ?? "";

  $("productId").value = product.id;
  $("productTitle").value = product.title;
  $("productVariant").value = product.variant;

  $("productCategory").innerHTML =
    renderOptions(
      state.data.categories.map(
        (category) => [
          category.key,
          category.name
        ]
      ),
      product.category
    );

  $("productFlow").innerHTML =
    renderOptions(flows, product.flow);

  $("productOrderFlow").value = product.orderFlow;

  $("productImage").value = product.image;
  $("productBadge").value = product.badge;
  $("productCurrency").value = product.currency;

  $("productSoldOut").value =
    String(Boolean(product.soldOut));

  $("productStock").value =
    product.stock ?? "";
  $("productStockEnabled").checked =
    Boolean(product.stockEnabled);
  $("productSeller").value =
    product.seller || "";
  $("productBestSeller").checked =
    Boolean(product.bestSeller);

  $("productDesc").value = product.desc;
  $("productNote").value = product.note;

  $("aboutHtml").value =
    state.data.content[product.id]?.aboutHtml || "";

  $("rulesHtml").value =
    state.data.content[product.id]?.rulesHtml || "";

  $("orderConfirmationEnabled").checked =
    confirmation.enabled;
  $("orderConfirmationTitle").value =
    confirmation.title;
  $("orderConfirmationDescription").value =
    confirmation.description;
  $("orderConfirmationConfirmText").value =
    confirmation.confirmText;
  $("orderConfirmationCancelText").value =
    confirmation.cancelText;
  $("orderConfirmationFooterText").value =
    confirmation.footerText;
  $("orderConfirmationHelpEnabled").checked =
    confirmation.helpLink.enabled;
  $("orderConfirmationHelpLabel").value =
    confirmation.helpLink.label;
  $("orderConfirmationHelpUrl").value =
    confirmation.helpLink.url;

  $("whatsappIncludeSeller").checked =
    product.whatsapp.includeSeller !== false;
  $("whatsappIncludeStock").checked =
    Boolean(product.whatsapp.includeStock);
  $("whatsappExtraMessage").value =
    product.whatsapp.extraMessage || "";

  updateOrderConfirmationHelpFields();
  renderFormFields(product);
  renderPlans(product);
}

function updateOrderConfirmationHelpFields() {
  const enabled = $("orderConfirmationHelpEnabled").checked;

  $("orderConfirmationHelpFields").classList.toggle(
    "hidden",
    !enabled
  );

  $("orderConfirmationHelpLabel").disabled = !enabled;
  $("orderConfirmationHelpUrl").disabled = !enabled;
}

function bindProductField(id, update) {
  const handler = () => {
    const product = selectedProduct();

    if (!product) return;

    update(product, $(id));
    markDirty();
    renderProducts();
  };

  $(id).addEventListener("input", handler);
  $(id).addEventListener("change", handler);
}

bindProductField("productActive", (product, element) => {
  product.active = element.checked;
});

bindProductField("productOrder", (product, element) => {
  product.order =
    element.value === ""
      ? null
      : Number(element.value);
});

bindProductField("productId", (product, element) => {
  const oldId = product.id;
  const newId = slug(element.value);

  product.id = newId;
  state.selectedId = newId;

  state.data.content[newId] =
    state.data.content[oldId] || {};

  if (oldId !== newId) {
    delete state.data.content[oldId];
  }

  $("previewMeta").textContent =
    `${product.id} / ${product.category}`;
});

bindProductField("productTitle", (product, element) => {
  product.title = element.value;
  $("previewTitle").textContent = product.title;
});

bindProductField("productVariant", (product, element) => {
  product.variant = element.value;
});

bindProductField("productCategory", (product, element) => {
  product.category = element.value;

  $("previewMeta").textContent =
    `${product.id} / ${product.category}`;
});

bindProductField("productFlow", (product, element) => {
  product.flow = element.value;

  if (!product.formFields?.length) {
    product.formFields = fieldsForLegacyFlow(product.flow, product.id);
    renderFormFields(product);
  }
});

bindProductField("productOrderFlow", (product, element) => {
  product.orderFlow = element.value;
});

bindProductField("productImage", (product, element) => {
  product.image = element.value;
  $("previewImage").src = imageUrl(product.image);
});

bindProductField("productBadge", (product, element) => {
  product.badge = element.value;
});

bindProductField("productCurrency", (product, element) => {
  product.currency = element.value;
});

bindProductField("productSoldOut", (product, element) => {
  product.soldOut = element.value === "true";
});

bindProductField("productStock", (product, element) => {
  product.stock =
    element.value === ""
      ? null
      : Math.max(0, Number(element.value) || 0);
});

bindProductField("productStockEnabled", (product, element) => {
  product.stockEnabled = element.checked;
});

bindProductField("productSeller", (product, element) => {
  product.seller = element.value;
});

bindProductField("productBestSeller", (product, element) => {
  product.bestSeller = element.checked;
});

bindProductField("productDesc", (product, element) => {
  product.desc = element.value;
});

bindProductField("productNote", (product, element) => {
  product.note = element.value;
});

bindProductField("orderConfirmationEnabled", (product, element) => {
  ensureOrderConfirmation(product).enabled = element.checked;
});

bindProductField("orderConfirmationTitle", (product, element) => {
  ensureOrderConfirmation(product).title = element.value;
});

bindProductField("orderConfirmationDescription", (product, element) => {
  ensureOrderConfirmation(product).description = element.value;
});

bindProductField("orderConfirmationConfirmText", (product, element) => {
  ensureOrderConfirmation(product).confirmText = element.value;
});

bindProductField("orderConfirmationCancelText", (product, element) => {
  ensureOrderConfirmation(product).cancelText = element.value;
});

bindProductField("orderConfirmationFooterText", (product, element) => {
  ensureOrderConfirmation(product).footerText = element.value;
});

bindProductField("orderConfirmationHelpEnabled", (product, element) => {
  ensureOrderConfirmation(product).helpLink.enabled = element.checked;
  updateOrderConfirmationHelpFields();
});

bindProductField("orderConfirmationHelpLabel", (product, element) => {
  ensureOrderConfirmation(product).helpLink.label = element.value;
});

bindProductField("orderConfirmationHelpUrl", (product, element) => {
  ensureOrderConfirmation(product).helpLink.url = element.value.trim();
});

bindProductField("whatsappIncludeSeller", (product, element) => {
  product.whatsapp ??= defaultWhatsAppSettings();
  product.whatsapp.includeSeller = element.checked;
});

bindProductField("whatsappIncludeStock", (product, element) => {
  product.whatsapp ??= defaultWhatsAppSettings();
  product.whatsapp.includeStock = element.checked;
});

bindProductField("whatsappExtraMessage", (product, element) => {
  product.whatsapp ??= defaultWhatsAppSettings();
  product.whatsapp.extraMessage = element.value;
});

bindProductField("aboutHtml", (product, element) => {
  state.data.content[product.id] ??= {};

  state.data.content[product.id].aboutHtml =
    element.value;
});

bindProductField("rulesHtml", (product, element) => {
  state.data.content[product.id] ??= {};

  state.data.content[product.id].rulesHtml =
    element.value;
});

function renderFormFields(product) {
  ensureAdvancedProduct(product);

  if (!product.formFields.length) {
    $("formFields").innerHTML = `
      <div class="emptyMini">
        Forma sahəsi yoxdur. Bu məhsulda forma istifadə etmək istəyirsənsə,
        "Sahə əlavə et" düyməsini bas.
      </div>
    `;
    return;
  }

  $("formFields").innerHTML = product.formFields
    .map((field, index) => `
      <div class="formFieldRow">
        <label class="switchLine">
          <input
            data-form-index="${index}"
            data-form-field="enabled"
            type="checkbox"
            ${field.enabled !== false ? "checked" : ""}
          >
          <span>Aktiv</span>
        </label>

        <label>
          Key
          <input
            data-form-index="${index}"
            data-form-field="key"
            value="${escapeHtml(field.key || "")}"
          >
        </label>

        <label>
          Tip
          <select data-form-index="${index}" data-form-field="type">
            ${renderOptions(formFieldTypes, field.type || "text")}
          </select>
        </label>

        <label>
          Label
          <input
            data-form-index="${index}"
            data-form-field="label"
            value="${escapeHtml(field.label || "")}"
          >
        </label>

        <label>
          Placeholder
          <input
            data-form-index="${index}"
            data-form-field="placeholder"
            value="${escapeHtml(field.placeholder || "")}"
          >
        </label>

        <label class="switchLine">
          <input
            data-form-index="${index}"
            data-form-field="required"
            type="checkbox"
            ${field.required ? "checked" : ""}
          >
          <span>Məcburi</span>
        </label>

        <button
          class="iconBtn removeFormField"
          data-form-index="${index}"
          type="button"
        >
          X
        </button>
      </div>
    `)
    .join("");

  document
    .querySelectorAll("[data-form-field]")
    .forEach((input) => {
      input.addEventListener("input", () => {
        updateFormField(product, input);
      });
      input.addEventListener("change", () => {
        updateFormField(product, input);
      });
    });

  document
    .querySelectorAll(".removeFormField")
    .forEach((button) => {
      button.addEventListener("click", () => {
        product.formFields.splice(
          Number(button.dataset.formIndex),
          1
        );
        markDirty();
        renderFormFields(product);
      });
    });
}

function updateFormField(product, input) {
  const field =
    product.formFields[Number(input.dataset.formIndex)];
  const key = input.dataset.formField;

  if (!field) return;

  if (input.type === "checkbox") {
    field[key] = input.checked;
  } else if (key === "key") {
    field.key = slug(input.value || `custom_${input.dataset.formIndex}`);
  } else {
    field[key] = input.value;
  }

  markDirty();
}

function renderPlans(product) {
  $("plans").innerHTML = (product.plans || [])
    .map((plan, index) => `
      <div class="planRow">
        <input
          data-plan="${index}"
          data-field="label"
          placeholder="Label"
          value="${escapeHtml(plan.label || "")}"
        >

        <input
          data-plan="${index}"
          data-field="months"
          type="number"
          placeholder="Ay"
          value="${escapeHtml(plan.months ?? "")}"
        >

        <input
          data-plan="${index}"
          data-field="price"
          type="number"
          step="0.01"
          placeholder="Qiymət"
          value="${escapeHtml(plan.price ?? "")}"
        >

        <input
          data-plan="${index}"
          data-field="oldPrice"
          type="number"
          step="0.01"
          placeholder="Köhnə qiymət"
          value="${escapeHtml(plan.oldPrice ?? "")}"
        >

        <input
          data-plan="${index}"
          data-field="discount"
          placeholder="Endirim"
          value="${escapeHtml(plan.discount || "")}"
        >

        <button
          class="iconBtn removePlan"
          data-plan="${index}"
          type="button"
        >
          X
        </button>
      </div>
    `)
    .join("");

  document
    .querySelectorAll("[data-field]")
    .forEach((input) => {
      input.addEventListener("input", () => {
        const plan =
          product.plans[Number(input.dataset.plan)];

        if (
          input.dataset.field === "label" ||
          input.dataset.field === "discount"
        ) {
          plan[input.dataset.field] = input.value;
        } else if (input.value === "") {
          delete plan[input.dataset.field];
        } else {
          plan[input.dataset.field] = Number(input.value);
        }

        markDirty();
        renderProducts();
      });
    });

  document
    .querySelectorAll(".removePlan")
    .forEach((button) => {
      button.addEventListener("click", () => {
        product.plans.splice(
          Number(button.dataset.plan),
          1
        );

        markDirty();
        renderPlans(product);
        renderProducts();
      });
    });
}

function renderCategories() {
  $("categoriesBody").innerHTML =
    state.data.categories
      .map((category, index) => `
        <tr>
          <td>${index + 1}</td>

          <td>
            <input
              data-cat="${index}"
              data-cat-field="key"
              value="${escapeHtml(category.key)}"
            >
          </td>

          <td>
            <input
              data-cat="${index}"
              data-cat-field="name"
              value="${escapeHtml(category.name)}"
            >
          </td>

          <td>
            ${
              state.data.products.filter(
                (product) =>
                  product.category === category.key
              ).length
            }
          </td>

          <td>
            ${
              category.key === "all"
                ? ""
                : `
                  <button
                    class="btn danger deleteCat"
                    data-cat="${index}"
                  >
                    Sil
                  </button>
                `
            }
          </td>
        </tr>
      `)
      .join("");

  document
    .querySelectorAll("[data-cat-field]")
    .forEach((input) => {
      input.addEventListener("input", () => {
        const category =
          state.data.categories[
            Number(input.dataset.cat)
          ];

        const oldKey = category.key;

        category[input.dataset.catField] =
          input.dataset.catField === "key"
            ? slug(input.value)
            : input.value;

        if (oldKey !== category.key) {
          state.data.products.forEach((product) => {
            if (product.category === oldKey) {
              product.category = category.key;
            }
          });
        }

        markDirty();
        renderFilters();
      });
    });

  document
    .querySelectorAll(".deleteCat")
    .forEach((button) => {
      button.addEventListener("click", () => {
        confirmDeleteCategory(
          Number(button.dataset.cat)
        );
      });
    });
}

function renderSettings() {
  const ui = state.data.ui || {};

  $("settingBrand").value = state.data.brand;
  $("settingPhone").value = state.data.phone_wa;
  $("settingBrandSub").value = ui.brandSub || "";
  $("settingBannerText").value = ui.bannerText || "";
  $("settingSearchTitle").value = ui.searchTitle || "";
  $("settingSearchDesc").value = ui.searchDesc || "";
  $("settingCampaignTitle").value = ui.bmTitle || "";
  $("settingCampaignText").value = ui.bmSub || "";
  $("settingFootRights").value = ui.footRights || "";
}

function bindSetting(id, key, target = "ui") {
  $(id).addEventListener("input", () => {
    if (target === "root") {
      state.data[key] = $(id).value;
    } else {
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

function showView(view) {
  ["products", "categories", "settings"]
    .forEach((name) => {
      $(`${name}View`).classList.toggle(
        "hidden",
        name !== view
      );
    });

  document
    .querySelectorAll(".navBtn[data-view]")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.view === view
      );
    });

  $("crumb").textContent = {
    products: "Məhsullar",
    categories: "Kateqoriyalar",
    settings: "Ayarlar"
  }[view];
}

function openModal(
  title,
  body,
  confirmText,
  action
) {
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
  const category =
    state.data.categories[index];

  openModal(
    "Kateqoriyanı sil",
    `
      <p>
        ${escapeHtml(category.name)} silinsin?
        Məhsullar Hamısı kateqoriyasına keçiriləcək.
      </p>
    `,
    "Sil",
    () => {
      state.data.products.forEach((product) => {
        if (product.category === category.key) {
          product.category = "all";
        }
      });

      state.data.categories.splice(index, 1);

      markDirty();
      renderAll();
      closeModal();
    }
  );
}

$("addProductBtn").addEventListener("click", () => {
  openModal(
    "Yeni məhsul",
    `
      <div class="modalGrid">
        <label>
          Ad
          <input id="newProductTitle">
        </label>

        <label>
          ID
          <input id="newProductId">
        </label>

        <label>
          Şəkil yolu
          <input
            id="newProductImage"
            value="assets/your.png"
          >
        </label>
      </div>
    `,
    "Əlavə et",
    () => {
      const title =
        $("newProductTitle").value.trim();

      const id = slug(
        $("newProductId").value || title
      );

      if (!title || !id) {
        toast("Ad və ID tələb olunur.", "bad");
        return;
      }

      if (
        state.data.products.some(
          (product) => product.id === id
        )
      ) {
        toast("Bu ID artıq var.", "bad");
        return;
      }

      state.data.products.push({
        id,
        order: state.data.products.length,
        category: "all",
        image: $("newProductImage").value,
        currency: "₼",
        title,
        variant: "",
        badge: "Premium",
        desc: "",
        note: "",
        flow: "whatsapp",
        soldOut: false,
        active: true,
        stock: null,
        stockEnabled: false,
        seller: "",
        bestSeller: false,
        orderFlow: "direct_whatsapp",
        formFields: [],
        whatsapp: defaultWhatsAppSettings(),
        confirmationModal: defaultOrderConfirmation(),
        orderConfirmation: defaultOrderConfirmation(),
        plans: [
          {
            months: 1,
            price: 0
          }
        ]
      });

      state.data.content[id] = {
        aboutHtml: "",
        rulesHtml: ""
      };

      state.selectedId = id;

      markDirty();
      renderAll();
      closeModal();
    }
  );
});

$("deleteProductBtn").addEventListener("click", () => {
  const product = selectedProduct();

  if (!product) return;

  openModal(
    "Məhsulu sil",
    `
      <p>
        ${escapeHtml(product.title)} silinsin?
      </p>
    `,
    "Sil",
    () => {
      state.data.products =
        state.data.products.filter(
          (item) => item !== product
        );

      delete state.data.content[product.id];

      state.selectedId =
        state.data.products[0]?.id || "";

      markDirty();
      renderAll();
      closeModal();
    }
  );
});

$("addCategoryBtn").addEventListener("click", () => {
  openModal(
    "Yeni kateqoriya",
    `
      <div class="modalGrid">
        <label>
          Ad
          <input id="newCategoryName">
        </label>

        <label>
          Key
          <input id="newCategoryKey">
        </label>
      </div>
    `,
    "Əlavə et",
    () => {
      const name =
        $("newCategoryName").value.trim();

      const key = slug(
        $("newCategoryKey").value || name
      );

      if (!name || !key) {
        toast("Ad və key tələb olunur.", "bad");
        return;
      }

      if (
        state.data.categories.some(
          (category) => category.key === key
        )
      ) {
        toast("Bu key artıq var.", "bad");
        return;
      }

      state.data.categories.push({
        key,
        name
      });

      markDirty();
      renderAll();
      closeModal();
    }
  );
});

$("addPlanBtn").addEventListener("click", () => {
  const product = selectedProduct();

  if (!product) return;

  product.plans.push({
    label: "1 aylıq",
    months: 1,
    price: 0
  });

  markDirty();
  renderPlans(product);
});

$("addFormFieldBtn").addEventListener("click", () => {
  const product = selectedProduct();

  if (!product) return;

  product.formFields.push(
    defaultFormField(product.formFields.length)
  );

  if (product.orderFlow === "direct_whatsapp") {
    product.orderFlow = "form_then_whatsapp";
    $("productOrderFlow").value = product.orderFlow;
  }

  markDirty();
  renderFormFields(product);
});

$("previewOrderConfirmationBtn").addEventListener("click", () => {
  const product = selectedProduct();

  if (!product) return;

  const confirmation = ensureOrderConfirmation(product);
  const helpUrl = confirmation.helpLink.url.trim();
  const showHelp =
    confirmation.helpLink.enabled &&
    helpUrl.startsWith("https://");

  openModal(
    confirmation.title || "Sifariş təsdiqi",
    `
      <div class="confirmationPreview">
        <p>${escapeHtml(confirmation.description)}</p>
        ${showHelp ? `
          <a
            href="${escapeHtml(helpUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${escapeHtml(confirmation.helpLink.label)}
          </a>
        ` : ""}
        <div class="confirmationPreviewActions">
          <button class="btn" type="button" disabled>
            ${escapeHtml(confirmation.cancelText)}
          </button>
          <button class="btn primary" type="button" disabled>
            ${escapeHtml(confirmation.confirmText)}
          </button>
        </div>
        <small>${escapeHtml(confirmation.footerText)}</small>
      </div>
    `,
    "Bağla",
    closeModal
  );
});

$("refreshBtn").addEventListener("click", () => {
  if (
    state.dirty &&
    !confirm(
      "Saxlanılmamış dəyişikliklər silinəcək. Davam et?"
    )
  ) {
    return;
  }

  loadState();
});

$("saveBtn").addEventListener("click", saveState);

$("searchInput").addEventListener(
  "input",
  renderProducts
);

$("categoryFilter").addEventListener(
  "change",
  renderProducts
);

$("statusFilter").addEventListener(
  "change",
  renderProducts
);

$("modalClose").addEventListener(
  "click",
  closeModal
);

$("modalCancel").addEventListener(
  "click",
  closeModal
);

$("modalConfirm").addEventListener(
  "click",
  () => state.modalAction?.()
);

$("modal").addEventListener("click", (event) => {
  if (event.target === $("modal")) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
});

document
  .querySelectorAll(".navBtn[data-view]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      showView(button.dataset.view);
    });
  });

$("logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", {
    method: "POST"
  });

  location.href = "/login.html";
});

loadState();
