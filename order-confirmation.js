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

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function fieldDefaultsForFlow(flow = "", id = "") {
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

    if (flow === "tiktok_jeton") {
      return [
        {
          key: "username",
          type: "text",
          label: "TikTok istifadəçi adı",
          placeholder: "@username",
          required: true,
          enabled: true
        },
        {
          key: "password",
          type: "password",
          label: "Şifrə",
          placeholder: "TikTok hesab şifrəsi",
          required: true,
          enabled: true
        },
        {
          key: "note",
          type: "textarea",
          label: "Qeyd",
          placeholder: "Əlavə qeydiniz varsa yazın",
          required: false,
          enabled: true
        }
      ];
    }

    return [];
  }

  function activeFields(product) {
    const fields = Array.isArray(product.formFields)
      ? product.formFields
      : fieldDefaultsForFlow(product.flow, product.id);

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
    return plan.label || `${plan.months || 1} aylıq`;
  }

  function selectedPlan(product) {
    return product?.plans?.[currentPlanIdx] || product?.plans?.[0];
  }

  function priceText(product, plan) {
    return `${Number(plan?.price || 0).toFixed(2)} ${product.currency || "₼"}`;
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

    if (img) img.src = product.image || "";
    if (title) title.textContent = product.title || "";
    if (desc) desc.textContent = product.desc || "";
    if (info) info.textContent = `${planLabel(plan)} / ${priceText(product, plan)}`;
    if (infoBox) infoBox.innerHTML = "";
    if (plans) plans.innerHTML = "";

    setFooter("Sifariş etdikdə WhatsApp avtomatik açılacaq.");
  }

  function setFooter(text) {
    const footer = document.querySelector("#modal .mSmall");
    if (footer) footer.textContent = text || "";
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

  function buildWhatsAppMessage(product, plan, formData = {}) {
    const settings = {
      extraMessage: "",
      includeSeller: true,
      includeStock: false,
      ...(product.whatsapp || {})
    };

    const lines = [
      "Salam, sifariş etmək istəyirəm.",
      "",
      `Məhsul: ${product.title || product.id}`,
      `Plan: ${planLabel(plan)}`,
      `Qiymət: ${priceText(product, plan)}`
    ];

    if (product.variant) lines.push(`Variant: ${product.variant}`);
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
      lines.push("", "Müştəri məlumatları:", ...formLines);
    }

    if (product.note) lines.push("", `Qeyd: ${product.note}`);
    if (settings.extraMessage) lines.push("", settings.extraMessage);

    return lines.join("\n");
  }

  function openWhatsApp(product, plan, formData = {}) {
    const message = buildWhatsAppMessage(product, plan, formData);
    const separator = PHONE_WA.includes("?") ? "&" : "?";
    const url = `${PHONE_WA}${separator}text=${encodeURIComponent(message)}`;

    window.open(url, "_blank", "noopener,noreferrer");
    closeOrderModal();
  }

  function showForm(product, plan, onDone) {
    const fields = activeFields(product);

    if (!fields.length) {
      onDone({});
      return;
    }

    setFooter("Məlumatları doldurduqdan sonra sifariş WhatsApp-a göndəriləcək.");

    renderModalContent(`
      <form class="mpForm universalOrderForm" id="universalOrderForm">
        <div class="mpFormTitle">Sifariş məlumatları</div>
        <div class="orderConfirmationDesc">
          ${escapeHtml(product.desc || "Zəhmət olmasa tələb olunan məlumatları daxil edin.")}
        </div>

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
    const showHelp =
      settings.helpLink?.enabled === true &&
      helpUrl.startsWith("https://");

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
            ${escapeHtml(settings.helpLink.label || "Kömək linki")}
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
      flow === "confirm_then_whatsapp" ||
      flow === "form_confirm_whatsapp" ||
      (confirmation.enabled && flow === "direct_whatsapp");

    const finish = (formData = {}) => {
      if (needsConfirmation) {
        showConfirmation(product, plan, formData, (confirmedData) => {
          openWhatsApp(product, plan, confirmedData);
        });
      } else {
        openWhatsApp(product, plan, formData);
      }
    };

    if (needsForm) {
      showForm(product, plan, finish);
    } else {
      finish({});
    }
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

      if (product.seller) {
        const seller = document.createElement("div");
        seller.className = "mpSellerLine";
        seller.textContent = `Satıcı: ${product.seller}`;
        delivery.appendChild(seller);
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
