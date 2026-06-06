(() => {
  const DEFAULT_CONFIRMATION = {
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

  const ORDER_FLOWS = new Set([
    "direct_whatsapp",
    "form_then_whatsapp",
    "confirm_then_whatsapp",
    "form_confirm_whatsapp"
  ]);

  const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbw8eRhDxBhq5Kf68eVQBAnqf9llgo1bQWKgdwpBa0utRgVwn6rKd9YUCP6e70iPbHTMOg/exec";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function activeFields(product) {
    const fields = Array.isArray(product.formFields)
      ? product.formFields
      : [];

    return fields.filter((field) => field.enabled !== false);
  }

  function confirmationFor(product) {
    const source =
      product.confirmationModal ||
      product.orderConfirmation ||
      {};

    return {
      ...DEFAULT_CONFIRMATION,
      ...source,
      helpLink: {
        ...DEFAULT_CONFIRMATION.helpLink,
        ...(source.helpLink || {})
      }
    };
  }

  function flowFor(product) {
    if (ORDER_FLOWS.has(product.orderFlow)) {
      return product.orderFlow;
    }

    const fields = activeFields(product);
    const confirmation = confirmationFor(product);

    if (confirmation.enabled && fields.length) {
      return "form_confirm_whatsapp";
    }

    if (confirmation.enabled) return "confirm_then_whatsapp";
    if (fields.length) return "form_then_whatsapp";

    return "direct_whatsapp";
  }

  function stockIsAvailable(product) {
    if (product.soldOut === true) {
      return false;
    }

    if (
      product.stockEnabled === true &&
      product.stock !== null &&
      product.stock !== "" &&
      product.stock !== undefined
    ) {
      return Number(product.stock) > 0;
    }

    return true;
  }

  function planLabel(plan) {
    if (!plan) return "";
    return String(plan.label || "").trim();
  }

  function selectedPlan(product) {
    return product?.plans?.[currentPlanIdx] || product?.plans?.[0];
  }

  function priceText(product, plan) {
    return `${Number(plan?.price || 0).toFixed(2)} ${product.currency || "₼"}`;
  }

  function createOrderId() {
    return Math.floor(10000 + Math.random() * 90000);
  }

  function submitGoogleSheets(order) {
    if (!GOOGLE_SCRIPT_URL) return;

    const formData = new FormData();
    formData.append("orderId", order.orderId);
    formData.append("product", order.productTitle);
    formData.append("plan", order.planText);
    formData.append("price", order.price);
    formData.append("extra", order.extraText);
    formData.append("message", order.message);
    formData.append("createdAt", new Date().toISOString());

    fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: formData
    }).catch((error) => {
      console.error("Sheet Error:", error);
    });
  }

  function setFooter(text) {
    const footer = document.querySelector("#modal .mSmall");
    if (footer) footer.textContent = text || "";
  }

  function openBaseModal(product, plan) {
    document.getElementById("modal")?.classList.add("show");
    lockBodyScroll();

    const img = document.getElementById("mImg");
    const title = document.getElementById("mTitle");
    const desc = document.getElementById("mDesc");
    const info = document.getElementById("mInfo");
    const infoBox = document.getElementById("mInfoBox");
    const plans = document.getElementById("mPlans");
    const selectedPlanLabel = planLabel(plan);

    if (img) img.src = product.image || "";
    if (title) title.textContent = product.title || "";
    if (desc) desc.textContent = product.desc || "";
    if (info) {
      info.textContent = selectedPlanLabel
        ? `${selectedPlanLabel} / ${priceText(product, plan)}`
        : priceText(product, plan);
    }
    if (infoBox) infoBox.innerHTML = "";
    if (plans) plans.innerHTML = "";
    setFooter("");
  }

  function renderModalContent(html) {
    const form = document.getElementById("mForm");
    if (form) form.innerHTML = html;
  }

  function closeOrderModal() {
    if (typeof closeModal === "function") {
      closeModal();
      return;
    }

    document.getElementById("modal")?.classList.remove("show");
    document.body.classList.remove("noScroll");
  }

  function buildWhatsAppMessage(product, plan, formData = {}, orderId = createOrderId()) {
    const settings = {
      extraMessage: "",
      includeSeller: true,
      includeStock: false,
      ...(product.whatsapp || {})
    };

    const lines = [
      "Salam, sifariş etmək istəyirəm.",
      "",
      `Sifariş №: ${orderId}`,
      `Məhsul: ${product.title || product.id}`
    ];

    const selectedPlanLabel = planLabel(plan);
    if (selectedPlanLabel) {
      lines.push(`Plan: ${selectedPlanLabel}`);
    }

    lines.push(`Qiymət: ${priceText(product, plan)}`);

    if (settings.includeSeller && product.seller) {
      lines.push(`Satıcı: ${product.seller}`);
    }
    if (
      settings.includeStock &&
      product.stockEnabled &&
      product.stock !== null &&
      product.stock !== "" &&
      product.stock !== undefined
    ) {
      lines.push(`Stok: ${product.stock}`);
    }

    const formLines = Object.entries(formData)
      .filter(([, value]) => String(value || "").trim())
      .map(([label, value]) => `${label}: ${value}`);

    if (formLines.length) {
      lines.push("", ...formLines);
    }

    if (settings.extraMessage) lines.push("", settings.extraMessage);

    return {
      orderId,
      message: lines.join("\n"),
      planText: selectedPlanLabel || (plan?.months ? `${plan.months} aylıq` : ""),
      price: priceText(product, plan),
      extraText: formLines.join("\n")
    };
  }

  function openWhatsApp(product, plan, formData = {}) {
    const order = buildWhatsAppMessage(product, plan, formData);
    submitGoogleSheets({
      ...order,
      productTitle: product.title || product.id
    });

    const separator = PHONE_WA.includes("?") ? "&" : "?";
    const url = `${PHONE_WA}${separator}text=${encodeURIComponent(order.message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
    closeOrderModal();
  }

  function showForm(product, plan, onDone) {
    const fields = activeFields(product);

    if (!fields.length) {
      onDone({});
      return;
    }

    setFooter("");

    renderModalContent(`
      <form class="mpForm universalOrderForm" id="universalOrderForm">
        <div class="mpFormTitle">Sifariş məlumatları</div>
        ${product.desc ? `
          <div class="orderConfirmationDesc">
            ${escapeHtml(product.desc)}
          </div>
        ` : ""}

        ${fields
          .map((field) => {
            const inputType = field.type || "text";
            const common = `
              name="${escapeHtml(field.key)}"
              data-label="${escapeHtml(field.label || field.key)}"
              placeholder="${escapeHtml(field.placeholder || "")}"
              ${field.required ? "required" : ""}
            `;

            if (inputType === "textarea") {
              return `
                <label class="universalField">
                  <span>${escapeHtml(field.label || field.key)}</span>
                  <textarea ${common}></textarea>
                </label>
              `;
            }

            return `
              <label class="universalField">
                <span>${escapeHtml(field.label || field.key)}</span>
                <input type="${escapeHtml(inputType)}" ${common}>
              </label>
            `;
          })
          .join("")}

        <div class="orderConfirmationActions">
          <button
            class="mpBtn orderConfirmationCancel"
            id="universalFormCancel"
            type="button"
          >
            Ləğv et
          </button>
          <button class="mpBtn" type="submit">Davam et</button>
        </div>
      </form>
    `);

    document.getElementById("universalFormCancel").onclick = closeOrderModal;
    document.getElementById("universalOrderForm").onsubmit = (event) => {
      event.preventDefault();

      const values = {};
      const controls = event.currentTarget.querySelectorAll("input, textarea");

      for (const control of controls) {
        const value = control.value.trim();

        if (control.required && !value) {
          control.focus();
          return;
        }

        values[control.dataset.label || control.name] = value;
      }

      onDone(values);
    };
  }

  function showConfirmation(product, plan, formData, onConfirm) {
    const settings = confirmationFor(product);
    const helpUrl = String(settings.helpLink?.url || "").trim();
    const helpLabel = String(settings.helpLink?.label || "").trim();
    const showHelp =
      settings.helpLink?.enabled === true &&
      helpUrl.startsWith("https://") &&
      helpLabel;

    setFooter(settings.footerText);

    renderModalContent(`
      <div class="mpForm orderConfirmation">
        <div class="mpFormTitle">${escapeHtml(settings.title)}</div>

        <div class="orderConfirmationDesc">
          ${escapeHtml(settings.description || product.desc || "")}
        </div>

        ${product.note ? `
          <div class="orderConfirmationNote">
            ${escapeHtml(product.note)}
          </div>
        ` : ""}

        ${showHelp ? `
          <a
            class="orderConfirmationHelp"
            href="${escapeHtml(helpUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${escapeHtml(helpLabel)}
          </a>
        ` : ""}

        <div class="orderConfirmationActions">
          <button
            id="orderConfirmationCancel"
            class="mpBtn orderConfirmationCancel"
            type="button"
          >
            ${escapeHtml(settings.cancelText)}
          </button>

          <button
            id="orderConfirmationConfirm"
            class="mpBtn"
            type="button"
          >
            ${escapeHtml(settings.confirmText)}
          </button>
        </div>
      </div>
    `);

    document.getElementById("orderConfirmationCancel").onclick = closeOrderModal;
    document.getElementById("orderConfirmationConfirm").onclick = () => {
      onConfirm(formData);
    };
  }

  function runOrderFlow(product, plan) {
    if (!stockIsAvailable(product) || !plan || Number(plan.price) <= 0) {
      alert("Stokda yoxdur.");
      return;
    }

    openBaseModal(product, plan);

    const flow = flowFor(product);
    const confirmation = confirmationFor(product);
    const needsForm =
      flow === "form_then_whatsapp" ||
      flow === "form_confirm_whatsapp";
    const needsConfirmation =
      confirmation.enabled === true ||
      flow === "confirm_then_whatsapp" ||
      flow === "form_confirm_whatsapp";

    const continueToFormOrWhatsApp = () => {
      if (needsForm) {
        showForm(product, plan, (nextFormData) => {
          openWhatsApp(product, plan, nextFormData);
        });
        return;
      }

      openWhatsApp(product, plan, {});
    };

    if (needsConfirmation) {
      showConfirmation(product, plan, {}, continueToFormOrWhatsApp);
      return;
    }

    continueToFormOrWhatsApp();
  }

  function decorateProductPage(product) {
    if (!product) return;

    const badge = document.querySelector(".pp-avail-badge");
    const button = document.getElementById("pp-order-btn");
    const delivery = document.querySelector(".pp-delivery");
    const available = stockIsAvailable(product);

    if (badge) {
      badge.textContent = available ? "Mövcuddur" : "Stokda yoxdur";
      badge.classList.toggle("out", !available);
    }

    if (button) {
      button.disabled = !available;
      button.textContent = available ? "Sifariş et" : "Stokda yoxdur";
      button.classList.toggle("disabled", !available);
    }

    if (delivery) {
      delivery.querySelector(".mpSellerLine")?.remove();
      delivery.querySelector(".mpStockLine")?.remove();

      if (product.seller) {
        const seller = document.createElement("div");
        seller.className = "mpSellerLine";
        seller.textContent = `Satıcı: ${product.seller}`;
        delivery.appendChild(seller);
      }

      if (
        product.stockEnabled &&
        product.stock !== null &&
        product.stock !== "" &&
        product.stock !== undefined
      ) {
        const stock = document.createElement("div");
        stock.className = "mpStockLine";
        stock.textContent = available ? `Stok: ${product.stock}` : "Stokda yoxdur";
        delivery.appendChild(stock);
      }
    }
  }

  function wrapProductPage() {
    if (typeof openProductPage !== "function") return;

    const original = openProductPage;

    openProductPage = function patchedOpenProductPage(id) {
      original(id);

      setTimeout(() => {
        const product = DATA.products.find((item) => item.id === id);
        decorateProductPage(product);
      }, 0);
    };
  }

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("#pp-order-btn");

      if (!button || !currentProduct) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      runOrderFlow(currentProduct, selectedPlan(currentProduct));
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      document.getElementById("modal")?.classList.contains("show")
    ) {
      closeOrderModal();
    }
  });

  document.addEventListener("click", (event) => {
    const modal = document.getElementById("modal");
    if (event.target === modal) closeOrderModal();
  });

  wrapProductPage();
})();
