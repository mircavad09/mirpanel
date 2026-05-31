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

const imageUrl = (value) => {
  if (/^https?:/i.test(value || "")) return value;
  return `https://mirpanel.com/${value || "assets/your.png"}`;
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const slug = (value) => String(value || "")
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
  return (
    state.data?.products.find(
      (product) => product.id === state.selectedId
    ) || null
  );
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

  $("previewImage").src =
    imageUrl(product.image);

  $("previewTitle").textContent =
    product.title;

  $("previewMeta").textContent =
    `${product.id} / ${product.category}`;

  $("productActive").checked =
    product.active !== false;

  $("productOrder").value =
    product.order ?? "";

  $("productId").value =
    product.id;

  $("productTitle").value =
    product.title;

  $("productVariant").value =
    product.variant;

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
    renderOptions(
      flows,
      product.flow
    );

  $("productImage").value =
    product.image;

  $("productBadge").value =
    product.badge;

  $("productCurrency").value =
    product.currency;

  $("productSoldOut").value =
    String(Boolean(product.soldOut));

  $("productDesc").value =
    product.desc;

  $("productNote").value =
    product.note;

  $("aboutHtml").value =
    state.data.content[product.id]?.aboutHtml || "";

  $("rulesHtml").value =
    state.data.content[product.id]?.rulesHtml || "";

  renderPlans(product);
}

function bindProductField(id, update) {
  $(id).addEventListener("input", () => {
    const product = selectedProduct();

    if (!product) return;

    update(product, $(id));
    markDirty();
    renderProducts();
  });
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

bindProductField("productDesc", (product, element) => {
  product.desc = element.value;
});

bindProductField("productNote", (product, element) => {
  product.note = element.value;
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

        plan[input.dataset.field] =
          input.dataset.field === "label"
            ? input.value
            : Number(input.value);

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

        const oldKey =
          category.key;

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
  $("settingBrand").value =
    state.data.brand;

  $("settingPhone").value =
    state.data.phone_wa;
}

$("settingBrand").addEventListener("input", () => {
  state.data.brand =
    $("settingBrand").value;

  markDirty();
});

$("settingPhone").addEventListener("input", () => {
  state.data.phone_wa =
    $("settingPhone").value;

  markDirty();
});

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