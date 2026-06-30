(() => {
  const DEFAULT_CONFIRMATION = {
    enabled: false,
    title: "Sifarişi təsdiqləyin",
    description: "",
    confirmText: "Təsdiqləyirəm",
    cancelText: "Ləğv et",
    footerText: "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
    helpLink: { enabled: false, label: "", url: "" }
  };

  const ORDER_FLOWS = new Set([
    "direct_whatsapp",
    "form_then_whatsapp",
    "confirm_then_whatsapp",
    "form_confirm_whatsapp"
  ]);

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

  const GOOGLE_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbw8eRhDxBhq5Kf68eVQBAnqf9llgo1bQWKgdwpBa0utRgVwn6rKd9YUCP6e70iPbHTMOg/exec";
  const STOCK_ENDPOINT = "/api/decrement-stock";

  function injectOrderStyles() {
    if (document.getElementById("mirpanelOrderRuntimeStyles")) return;

    const style = document.createElement("style");
    style.id = "mirpanelOrderRuntimeStyles";
    style.textContent = `
      #modal.premiumOrderFormOpen .modalCard {
        width: min(540px, calc(100vw - 28px));
        border: 1px solid rgba(34, 211, 119, .72);
        background: radial-gradient(circle at 50% 0%, rgba(34, 211, 119, .12), transparent 38%), linear-gradient(180deg, rgba(18, 24, 21, .98), rgba(7, 9, 8, .98));
        box-shadow: 0 26px 80px rgba(0, 0, 0, .62), 0 0 34px rgba(34, 211, 119, .18);
      }

      #modal.premiumOrderFormOpen .mTop,
      #modal.premiumOrderFormOpen .mPlansTitle,
      #modal.premiumOrderFormOpen .mPlans,
      #modal.premiumOrderFormOpen .mInfoBox,
      #modal.premiumOrderFormOpen #mDesc { display: none !important; }
      #modal.premiumOrderFormOpen #mForm { margin-top: 0 !important; }
      #modal.premiumOrderFormOpen .mBottom { margin-top: 18px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, .08); }
      #modal.premiumOrderFormOpen #mInfo { color: rgba(255, 255, 255, .92); font-size: 17px; font-weight: 800; text-align: center; }
      #modal.premiumOrderFormOpen .mSmall { display: none; }

      .universalOrderForm.premiumOrderForm { display: grid; gap: 18px; padding: 28px 2px 0; }
      .premiumOrderForm .mpFormTitle {
        margin: 0 0 8px; text-align: center; font-size: clamp(24px, 4vw, 30px); font-weight: 900; line-height: 1.15; letter-spacing: 0;
        color: #2dff86; background: linear-gradient(135deg, #c9ffe1 0%, #2dff86 45%, #13b87c 100%);
        -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 24px rgba(45, 255, 134, .22);
      }
      .premiumOrderForm .premiumOrderFields { display: grid; gap: 14px; }
      .premiumOrderForm .universalField { display: grid; gap: 8px; margin: 0; }
      .premiumOrderForm .universalField span { color: rgba(235, 255, 243, .9); font-size: 13px; font-weight: 800; }
      .premiumOrderForm .universalField input,
      .premiumOrderForm .universalField textarea {
        width: 100%; min-height: 52px; border-radius: 16px; border: 1px solid rgba(148, 163, 184, .28); background: rgba(3, 8, 7, .74);
        color: #f7fff9; font-family: inherit; font-size: 15px; font-weight: 600; outline: none; padding: 14px 16px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .05), 0 12px 30px rgba(0, 0, 0, .22);
        transition: border-color .22s ease, box-shadow .22s ease, background .22s ease, transform .18s ease;
      }
      .premiumOrderForm .universalField textarea { min-height: 112px; resize: vertical; }
      .premiumOrderForm .universalField input::placeholder,
      .premiumOrderForm .universalField textarea::placeholder { color: rgba(226, 232, 240, .48); font-weight: 500; }
      .premiumOrderForm .universalField input:focus,
      .premiumOrderForm .universalField textarea:focus {
        border-color: rgba(45, 255, 134, .78); background: rgba(4, 13, 10, .92);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 0 0 4px rgba(45, 255, 134, .1), 0 0 28px rgba(45, 255, 134, .16);
      }
      .premiumOrderForm .orderConfirmationActions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 6px; }
      .premiumOrderForm .mpBtn { min-height: 56px; border: 0; border-radius: 16px; color: #f8fff9; font-family: inherit; font-size: 16px; font-weight: 900; cursor: pointer; transition: transform .18s ease, box-shadow .2s ease, filter .2s ease, background .2s ease; }
      .premiumOrderForm .mpBtn:not(.orderConfirmationCancel) { background: linear-gradient(135deg, #2dde7d, #12a978); box-shadow: 0 14px 34px rgba(18, 169, 120, .28), inset 0 1px 0 rgba(255, 255, 255, .2); }
      .premiumOrderForm .orderConfirmationCancel { background: linear-gradient(135deg, rgba(71, 85, 105, .95), rgba(38, 48, 63, .95)); box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08); }
      .premiumOrderForm .mpBtn:hover { transform: translateY(-1px); filter: brightness(1.05); }
      .premiumOrderForm .mpBtn:active { transform: translateY(1px) scale(.99); }

      .mpStockLine { margin-top: 12px; }
      .mpStockBadge {
        display: inline-flex; align-items: center; gap: 8px; max-width: 100%; padding: 9px 13px; border-radius: 999px;
        font-size: 13px; font-weight: 900; line-height: 1; letter-spacing: 0; white-space: nowrap;
        border: 1px solid rgba(45, 255, 134, .38); color: #dcffe9;
        background: linear-gradient(135deg, rgba(19, 185, 116, .22), rgba(8, 20, 15, .86));
        box-shadow: 0 10px 28px rgba(24, 210, 130, .14), inset 0 1px 0 rgba(255, 255, 255, .08);
      }
      .mpStockBadge::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #35ff8f; box-shadow: 0 0 12px rgba(53, 255, 143, .8); flex: 0 0 auto; }
      .mpStockBadge.low { border-color: rgba(255, 186, 73, .45); color: #fff3ce; background: linear-gradient(135deg, rgba(255, 184, 53, .2), rgba(32, 20, 5, .86)); box-shadow: 0 10px 28px rgba(255, 184, 53, .14), inset 0 1px 0 rgba(255, 255, 255, .08); }
      .mpStockBadge.low::before { background: #ffbd4a; box-shadow: 0 0 12px rgba(255, 189, 74, .8); }
      .mpStockBadge.out { border-color: rgba(255, 96, 96, .42); color: #ffd5d5; background: linear-gradient(135deg, rgba(255, 70, 70, .18), rgba(29, 6, 8, .9)); box-shadow: 0 10px 28px rgba(255, 70, 70, .13), inset 0 1px 0 rgba(255, 255, 255, .06); }
      .mpStockBadge.out::before { background: #ff5b5b; box-shadow: 0 0 12px rgba(255, 91, 91, .75); }

      @media (max-width: 560px) {
        #modal.premiumOrderFormOpen .modalCard { width: min(100% - 20px, 520px); }
        .universalOrderForm.premiumOrderForm { padding-top: 24px; gap: 16px; }
        .premiumOrderForm .orderConfirmationActions { grid-template-columns: 1fr; }
        .mpStockBadge { white-space: normal; line-height: 1.25; }
      }
    `;
    document.head.appendChild(style);
  }

  function setPremiumFormMode(enabled) {
    document.getElementById("modal")?.classList.toggle("premiumOrderFormOpen", Boolean(enabled));
  }

  injectOrderStyles();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function activeFields(product) {
    const fields = Array.isArray(product.formFields) ? product.formFields : [];
    const active = fields.filter((field) => field.enabled !== false);
    if (active.length) return active;
    return LEGACY_FLOW_FIELDS[product?.flow] || [];
  }

  function confirmationFor(product) {
    const source = product.confirmationModal || product.orderConfirmation || {};
    return {
      ...DEFAULT_CONFIRMATION,
      ...source,
      helpLink: { ...DEFAULT_CONFIRMATION.helpLink, ...(source.helpLink || {}) }
    };
  }

  function flowFor(product) {
    const fields = activeFields(product);
    const confirmation = confirmationFor(product);
    const source = String(product.orderFlow || "").trim();

    if (ORDER_FLOWS.has(source)) {
      if (confirmation.enabled && source === "direct_whatsapp") return "confirm_then_whatsapp";
      return source;
    }

    if (confirmation.enabled && fields.length) return "form_confirm_whatsapp";
    if (confirmation.enabled) return "confirm_then_whatsapp";
    if (fields.length) return "form_then_whatsapp";
    return "direct_whatsapp";
  }

  function stockNumber(product) {
    if (product?.stockEnabled === false) return null;
    const rawStock = product.stock ?? product.stockCount ?? product.stockQuantity;
    if (rawStock === null || rawStock === "" || rawStock === undefined) return null;
    const stock = Number(rawStock);
    return Number.isFinite(stock) ? Math.max(0, stock) : null;
  }

  function stockIsAvailable(product) {
    if (product.active === false || product.soldOut === true || product.flow === "out_of_stock") return false;
    const stock = stockNumber(product);
    if (stock !== null) return stock > 0;
    return true;
  }

  function stockBadge(product) {
    const stock = stockNumber(product);
    if (product.active === false || product.soldOut === true || product.flow === "out_of_stock" || stock === 0) {
      return { text: "Stokda yoxdur", className: "out" };
    }
    if (stock !== null && stock <= 5) {
      return { text: `Az qalıb • ${stock} ədəd`, className: "low" };
    }
    if (stock !== null) {
      return { text: `Stokda var • ${stock} ədəd`, className: "ok" };
    }
    return null;
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
    if (order.stockBefore !== undefined) formData.append("stockBefore", order.stockBefore ?? "");
    if (order.stockAfter !== undefined) formData.append("stockAfter", order.stockAfter ?? "");

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
    setPremiumFormMode(false);
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
    if (info) info.textContent = selectedPlanLabel ? `${selectedPlanLabel} / ${priceText(product, plan)}` : priceText(product, plan);
    if (infoBox) infoBox.innerHTML = "";
    if (plans) plans.innerHTML = "";
    setFooter("");
  }

  function renderModalContent(html) {
    const form = document.getElementById("mForm");
    if (form) form.innerHTML = html;
  }

  function closeOrderModal() {
    setPremiumFormMode(false);
    if (typeof closeModal === "function") {
      closeModal();
      return;
    }

    document.getElementById("modal")?.classList.remove("show");
    document.body.classList.remove("noScroll");
  }

  function buildWhatsAppMessage(product, plan, formData = {}, orderId = createOrderId()) {
    const settings = { extraMessage: "", includeSeller: true, includeStock: false, ...(product.whatsapp || {}) };
    const lines = ["Salam, sifariş etmək istəyirəm.", "", `Sifariş №: ${orderId}`, `Məhsul: ${product.title || product.id}`];
    const selectedPlanLabel = planLabel(plan);

    if (selectedPlanLabel) lines.push(`Plan: ${selectedPlanLabel}`);
    lines.push(`Qiymət: ${priceText(product, plan)}`);
    if (settings.includeSeller && product.seller) lines.push(`Satıcı: ${product.seller}`);
    const stock = stockNumber(product);
    if (settings.includeStock && stock !== null) lines.push(`Stok: ${stock}`);

    const formLines = Object.entries(formData)
      .filter(([, value]) => String(value || "").trim())
      .map(([label, value]) => `${label}: ${value}`);

    if (formLines.length) lines.push("", ...formLines);
    if (settings.extraMessage) lines.push("", settings.extraMessage);

    return {
      orderId,
      message: lines.join("\n"),
      planText: selectedPlanLabel || (plan?.months ? `${plan.months} aylıq` : ""),
      price: priceText(product, plan),
      extraText: formLines.join("\n")
    };
  }

  async function decrementStock(product) {
    if (stockNumber(product) === null) return { skipped: true };

    const response = await fetch(STOCK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(payload.error || payload.code || "");
      const stockSyncUnavailable =
        response.status === 404 ||
        response.status === 503 ||
        message === "STOCK_SYNC_NOT_CONFIGURED" ||
        message.includes("MIRPANEL_GITHUB_TOKEN");

      if (stockSyncUnavailable) {
        console.warn("Mirpanel stock sync is not available yet.", {
          status: response.status,
          code: payload.code || payload.error || ""
        });
        return { skipped: true, unavailable: true };
      }

      if (message === "OUT_OF_STOCK") {
        throw new Error("Stokda yoxdur.");
      }

      throw new Error(payload.error || "Stok yenilənmədi.");
    }

    if (typeof payload.stockAfter === "number") {
      product.stock = payload.stockAfter;
      product.soldOut = payload.stockAfter <= 0;
      decorateProductPage(product);
    }

    return payload;
  }

  async function openWhatsApp(product, plan, formData = {}) {
    if (!stockIsAvailable(product)) {
      decorateProductPage(product);
      alert("Stokda yoxdur.");
      return;
    }

    let stockResult;
    try {
      stockResult = await decrementStock(product);
    } catch (error) {
      decorateProductPage(product);
      alert(error.message || "Stokda yoxdur.");
      return;
    }

    const order = buildWhatsAppMessage(product, plan, formData);
    submitGoogleSheets({
      ...order,
      productTitle: product.title || product.id,
      stockBefore: stockResult?.stockBefore,
      stockAfter: stockResult?.stockAfter
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

    setPremiumFormMode(true);
    setFooter("");

    renderModalContent(`
      <form class="mpForm universalOrderForm premiumOrderForm" id="universalOrderForm">
        <div class="mpFormTitle">Sifariş məlumatları</div>
        <div class="premiumOrderFields">
          ${fields.map((field) => {
            const inputType = field.type || "text";
            const common = `
              name="${escapeHtml(field.key)}"
              data-label="${escapeHtml(field.label || field.key)}"
              placeholder="${escapeHtml(field.placeholder || "")}"
              autocomplete="${inputType === "password" ? "current-password" : "off"}"
              ${field.required ? "required" : ""}
            `;

            if (inputType === "textarea") {
              return `<label class="universalField premiumUniversalField"><span>${escapeHtml(field.label || field.key)}</span><textarea ${common}></textarea></label>`;
            }

            return `<label class="universalField premiumUniversalField"><span>${escapeHtml(field.label || field.key)}</span><input type="${escapeHtml(inputType)}" ${common}></label>`;
          }).join("")}
        </div>
        <div class="orderConfirmationActions premiumOrderActions">
          <button class="mpBtn orderConfirmationCancel" id="universalFormCancel" type="button">Ləğv et</button>
          <button class="mpBtn premiumContinueBtn" type="submit">Davam et</button>
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
    setPremiumFormMode(false);
    const settings = confirmationFor(product);
    const helpUrl = String(settings.helpLink?.url || "").trim();
    const helpLabel = String(settings.helpLink?.label || "").trim();
    const showHelp = settings.helpLink?.enabled === true && helpUrl.startsWith("https://") && helpLabel;

    setFooter(settings.footerText);
    renderModalContent(`
      <div class="mpForm orderConfirmation">
        <div class="mpFormTitle">${escapeHtml(settings.title)}</div>
        <div class="orderConfirmationDesc">${escapeHtml(settings.description || "")}</div>
        ${product.note ? `<div class="orderConfirmationNote">${escapeHtml(product.note)}</div>` : ""}
        ${showHelp ? `<a class="orderConfirmationHelp" href="${escapeHtml(helpUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(helpLabel)}</a>` : ""}
        <div class="orderConfirmationActions">
          <button id="orderConfirmationCancel" class="mpBtn orderConfirmationCancel" type="button">${escapeHtml(settings.cancelText)}</button>
          <button id="orderConfirmationConfirm" class="mpBtn" type="button">${escapeHtml(settings.confirmText)}</button>
        </div>
      </div>
    `);

    document.getElementById("orderConfirmationCancel").onclick = closeOrderModal;
    document.getElementById("orderConfirmationConfirm").onclick = () => onConfirm(formData);
  }

  function runOrderFlow(product, plan) {
    if (!stockIsAvailable(product) || !plan || Number(plan.price) <= 0) {
      decorateProductPage(product);
      alert("Stokda yoxdur.");
      return;
    }

    openBaseModal(product, plan);
    const flow = flowFor(product);
    const confirmation = confirmationFor(product);
    const needsForm = flow === "form_then_whatsapp" || flow === "form_confirm_whatsapp";
    const needsConfirmation = confirmation.enabled === true || flow === "confirm_then_whatsapp" || flow === "form_confirm_whatsapp";

    const continueToFormOrWhatsApp = () => {
      if (needsForm) {
        showForm(product, plan, (nextFormData) => openWhatsApp(product, plan, nextFormData));
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
      document
        .querySelectorAll("#productPageView .pp-detail-stock-line, #productPageView .detailStockBadge")
        .forEach((element) => element.remove());
      delivery
        .querySelectorAll(".mpSellerLine, .mpStockLine")
        .forEach((element) => element.remove());

      if (product.seller) {
        const seller = document.createElement("div");
        seller.className = "mpSellerLine";
        seller.textContent = `Satıcı: ${product.seller}`;
        delivery.appendChild(seller);
      }

      const badgeData = stockBadge(product);
      if (badgeData) {
        const stock = document.createElement("div");
        stock.className = "mpStockLine";
        stock.innerHTML = `<span class="mpStockBadge ${badgeData.className}">${escapeHtml(badgeData.text)}</span>`;
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
    if (event.key === "Escape" && document.getElementById("modal")?.classList.contains("show")) closeOrderModal();
  });

  document.addEventListener("click", (event) => {
    const modal = document.getElementById("modal");
    if (event.target === modal) closeOrderModal();
  });

  wrapProductPage();
})();
