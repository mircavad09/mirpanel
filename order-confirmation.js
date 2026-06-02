(() => {
  function defaultsFor(product) {
    const defaults = {
      enabled: false,
      title: "Sifarişi təsdiqləyin",
      description: "",
      confirmText: "Təsdiqləyirəm",
      cancelText: "Ləğv et",
      footerText:
        "Sifarişi təsdiqlədikdə WhatsApp avtomatik açılacaq.",
      helpLink: {
        enabled: false,
        label: "",
        url: ""
      }
    };

    if (product.id === "spotify") {
      return {
        ...defaults,
        enabled: true,
        description:
          "Şəxsi hesabınızda rəsmi Spotify Premium paketi aktivləşdirilir."
      };
    }

    if (product.id === "chatgpt") {
      return {
        ...defaults,
        enabled: true,
        description:
          "ChatGPT Plus birbaşa sizin şəxsi hesabınızda aktivləşdiriləcəkdir.",
        confirmText: "Davam et"
      };
    }

    if (product.id === "youtube") {
      return {
        ...defaults,
        enabled: true,
        description:
          "Təqdim edilən hesab yeni Gmail olmalı və heç bir ailə planına qoşulmamalıdır.",
        confirmText: "Təsdiq edirəm"
      };
    }

    return defaults;
  }

  function settingsFor(product) {
    const fallback = defaultsFor(product);
    const saved = product.orderConfirmation || {};

    return {
      ...fallback,
      ...saved,
      helpLink: {
        ...fallback.helpLink,
        ...(saved.helpLink || {})
      }
    };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function setFooter(text) {
    const footer =
      document.querySelector("#modal .mSmall");

    if (footer) footer.textContent = text || "";
  }

  function openBaseModal() {
    document
      .getElementById("modal")
      ?.classList.add("show");

    lockBodyScroll();
  }

  function continueOriginalOrderFlow(product, plan) {
    setFooter(UI.modalWait);

    if (product.id === "tiktok_jeton") {
      showTikTokJetonForm(product, plan);
    } else if (
      product.id === "netflix" ||
      product.id === "prime" ||
      product.id === "hbomax"
    ) {
      showNameCodeForm(
        product,
        plan,
        product.id === "prime" ? 5 : 4
      );
    } else if (
      product.id === "spotify" ||
      product.id === "chatgpt"
    ) {
      showEmailPassForm(product, plan);
    } else if (
      product.id === "youtube" ||
      product.id === "canva" ||
      product.id === "google_ai" ||
      product.id === "google_ai_ultra" ||
      product.id === "captions" ||
      product.id === "grok_supergrok" ||
      product.id === "claude_ai" ||
      product.id === "adobecc" ||
      product.id === "duolingo" ||
      product.id === "adobe-express" ||
      product.id === "picsart-premium" ||
      product.id === "lightroom-photo" ||
      product.id === "gemini-ai-pro"
    ) {
      showEmailOnlyForm(product, plan);
    } else {
      showConfirmOnlyForm(product, plan);
    }
  }

  function showConfirmation(product, plan, settings) {
    const helpUrl =
      String(settings.helpLink?.url || "").trim();

    const showHelp =
      settings.helpLink?.enabled === true &&
      helpUrl.startsWith("https://");

    setFooter(settings.footerText);

    document.getElementById("mForm").innerHTML = `
      <div class="mpForm orderConfirmation">
        <div class="mpFormTitle">
          ${escapeHtml(settings.title)}
        </div>

        <div class="orderConfirmationDesc">
          ${escapeHtml(settings.description)}
        </div>

        ${showHelp ? `
          <a
            class="orderConfirmationHelp"
            href="${escapeHtml(helpUrl)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${escapeHtml(settings.helpLink.label)}
          </a>
        ` : ""}

        <div class="orderConfirmationActions">
          <button
            id="order_confirmation_cancel"
            class="mpBtn orderConfirmationCancel"
            type="button"
          >
            ${escapeHtml(settings.cancelText)}
          </button>

          <button
            id="order_confirmation_confirm"
            class="mpBtn"
            type="button"
          >
            ${escapeHtml(settings.confirmText)}
          </button>
        </div>
      </div>
    `;

    document
      .getElementById("order_confirmation_cancel")
      .onclick = closeModal;

    document
      .getElementById("order_confirmation_confirm")
      .onclick = () =>
        continueOriginalOrderFlow(product, plan);
  }

  document.addEventListener(
    "click",
    (event) => {
      const button =
        event.target.closest("#pp-order-btn");

      if (!button || !currentProduct) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const plan =
        currentProduct.plans[currentPlanIdx];

      if (!plan || plan.price <= 0) {
        alert(UI.stokOut);
        return;
      }

      openBaseModal();

      const settings =
        settingsFor(currentProduct);

      if (settings.enabled) {
        showConfirmation(
          currentProduct,
          plan,
          settings
        );
      } else {
        continueOriginalOrderFlow(
          currentProduct,
          plan
        );
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        document
          .getElementById("modal")
          ?.classList.contains("show")
      ) {
        closeModal();
      }
    }
  );
})();