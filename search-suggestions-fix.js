(function () {
  const STYLE_ID = "mirpanelSearchSuggestionsStyles";
  const PANEL_ID = "mirpanelSearchSuggestPanel";
  const CLEAR_CLASS = "mirpanelSearchClear";
  let activeInput = null;
  let loadingTimer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function normalizeSearch(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("az")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replaceAll("ə", "e")
      .replaceAll("ı", "i")
      .replaceAll("ö", "o")
      .replaceAll("ü", "u")
      .replaceAll("ş", "s")
      .replaceAll("ç", "c")
      .replaceAll("ğ", "g");
  }

  function allProducts() {
    if (Array.isArray(window.DATA?.products)) return window.DATA.products;
    try {
      if (typeof DATA !== "undefined" && Array.isArray(DATA.products)) return DATA.products;
    } catch (error) {
      return [];
    }
    return [];
  }

  function productPlanText(product) {
    return (product?.plans || []).map((plan) => [
      plan.label,
      plan.name,
      plan.title,
      plan.months,
      plan.price
    ].filter((part) => part !== null && part !== undefined && part !== "").join(" ")).join(" ");
  }

  function productSearchBlob(product) {
    return [
      product?.title,
      product?.variant,
      product?.badge,
      product?.category,
      product?.desc,
      product?.note,
      product?.id,
      productPlanText(product)
    ].filter(Boolean).join(" ");
  }

  function productRank(product, normalizedQuery) {
    const title = normalizeSearch(product?.title);
    const id = normalizeSearch(product?.id);
    const variant = normalizeSearch(product?.variant);
    const badge = normalizeSearch(product?.badge);
    const category = normalizeSearch(product?.category);
    const desc = normalizeSearch(product?.desc);
    const plans = normalizeSearch(productPlanText(product));

    if (title.startsWith(normalizedQuery)) return 0;
    if (id.startsWith(normalizedQuery)) return 1;
    if (title.includes(normalizedQuery)) return 2;
    if (id.includes(normalizedQuery)) return 3;
    if ([variant, badge, category].some((value) => value.includes(normalizedQuery))) return 4;
    if (plans.includes(normalizedQuery)) return 5;
    if (desc.includes(normalizedQuery)) return 6;
    return 7;
  }

  function minPrice(product) {
    if (typeof getMinPrice === "function") return getMinPrice(product);
    const prices = (product?.plans || []).map((plan) => Number(plan.price)).filter((price) => price > 0);
    return prices.length ? Math.min(...prices) : Infinity;
  }

  function priceText(product) {
    if (product?.id === "tiktok_jeton") return `10.00 ${product.currency || "₼"}`;
    const price = minPrice(product);
    return price && price !== Infinity ? `${Number(price).toFixed(2)} ${product.currency || "₼"}` : "—";
  }

  function stockText(product) {
    if (product?.stockEnabled === false) return "";
    const raw = product?.stock ?? product?.stockCount ?? product?.stockQuantity;
    if (raw === null || raw === undefined || raw === "") return "";
    const stock = Number(raw);
    if (!Number.isFinite(stock)) return "";
    if (stock <= 0) return "Stokda yoxdur";
    return `Stok: ${Math.max(0, stock)}`;
  }

  function searchInputs() {
    const selectors = [
      "#q",
      "#sideMenuInput",
      ".side-search",
      ".headActions input[type='text']",
      "header input[type='text']",
      "input[placeholder*='Məhsul']",
      "input[placeholder*='məhsul']"
    ];
    return [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
      .filter((input) => input?.tagName === "INPUT");
  }

  function productsForQuery(query) {
    const normalized = normalizeSearch(query);
    if (!normalized) return [];
    return allProducts()
      .filter((product) => product.active !== false)
      .filter((product) => normalizeSearch(productSearchBlob(product)).includes(normalized))
      .sort((a, b) => {
        const rankDiff = productRank(a, normalized) - productRank(b, normalized);
        if (rankDiff !== 0) return rankDiff;
        return Number(a.order ?? 9999) - Number(b.order ?? 9999);
      });
  }

  function syncInputs(value, source) {
    searchInputs().forEach((input) => {
      if (input !== source && input.value !== value) input.value = value;
      toggleClear(input);
    });
  }

  function getPanel() {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.className = "mirpanelSearchSuggestPanel";
      panel.setAttribute("role", "listbox");
      document.body.appendChild(panel);
    }
    return panel;
  }

  function closePanel() {
    clearTimeout(loadingTimer);
    getPanel().classList.remove("show");
  }

  function positionPanel(input) {
    const panel = getPanel();
    const rect = input.getBoundingClientRect();
    const gap = 8;
    panel.style.left = `${Math.max(12, rect.left)}px`;
    panel.style.top = `${rect.bottom + gap}px`;
    panel.style.width = `${Math.min(window.innerWidth - 24, rect.width)}px`;
  }

  function renderPanel(input, products, loading) {
    const panel = getPanel();
    positionPanel(input);

    if (loading) {
      panel.innerHTML = `<div class="mirpanelSuggestState">Axtarılır...</div>`;
      panel.classList.add("show");
      return;
    }

    if (!products.length) {
      panel.innerHTML = `<div class="mirpanelSuggestState">Nəticə tapılmadı</div>`;
      panel.classList.add("show");
      return;
    }

    panel.innerHTML = products.slice(0, 6).map((product) => {
      const stock = stockText(product);
      return `
        <button class="mirpanelSuggestItem" type="button" data-product-id="${escapeHtml(product.id)}" role="option">
          <span class="mirpanelSuggestImg"><img src="${escapeHtml(product.image)}" alt=""></span>
          <span class="mirpanelSuggestText">
            <strong>${escapeHtml(product.title)}</strong>
            <span><em>${escapeHtml(product.badge || product.category || "Məhsul")}</em>${stock ? `<small>${escapeHtml(stock)}</small>` : ""}</span>
          </span>
          <span class="mirpanelSuggestPrice">${escapeHtml(priceText(product))}</span>
        </button>
      `;
    }).join("");
    panel.classList.add("show");
  }

  function updateSearch(input) {
    activeInput = input;
    const value = input.value.trim();
    syncInputs(input.value, input);
    if (typeof window.renderGrid === "function") window.renderGrid();

    if (!value) {
      closePanel();
      return;
    }

    renderPanel(input, [], true);
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => renderPanel(input, productsForQuery(value), false), 220);
  }

  function ensureWrapper(input) {
    const parent = input.parentElement;
    if (!parent || parent.dataset.searchEnhanced === "1") return;
    parent.dataset.searchEnhanced = "1";
    parent.classList.add("mirpanelSearchShell");

    const button = document.createElement("button");
    button.className = CLEAR_CLASS;
    button.type = "button";
    button.setAttribute("aria-label", "Axtarışı təmizlə");
    button.textContent = "×";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      input.value = "";
      syncInputs("", input);
      toggleClear(input);
      closePanel();
      if (typeof window.renderGrid === "function") window.renderGrid();
      input.focus();
    });
    parent.appendChild(button);
    toggleClear(input);
  }

  function toggleClear(input) {
    const button = input.parentElement?.querySelector(`.${CLEAR_CLASS}`);
    if (button) button.classList.toggle("show", Boolean(input.value.trim()));
  }

  function bindInputs() {
    searchInputs().forEach((input) => {
      ensureWrapper(input);
      input.setAttribute("autocomplete", "off");
      input.setAttribute("autocapitalize", "none");
      input.setAttribute("spellcheck", "false");
      input.style.fontSize = "16px";

      if (input.dataset.searchSuggestionsBound === "1") return;
      input.dataset.searchSuggestionsBound = "1";
      input.addEventListener("input", () => updateSearch(input));
      input.addEventListener("focus", () => {
        activeInput = input;
        document.body.classList.add("mirpanelSearchFocused");
        if (input.value.trim()) updateSearch(input);
      });
      input.addEventListener("blur", () => {
        setTimeout(() => {
          if (!document.activeElement?.closest?.(`#${PANEL_ID}`)) closePanel();
          document.body.classList.remove("mirpanelSearchFocused");
        }, 160);
      });
    });
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @media (max-width: 850px) {
        .headActions { position: relative; flex: 1 1 auto !important; min-width: 0 !important; }
        .headActions .mirpanelSearchShell {
          position: relative !important;
          flex: 1 1 auto !important;
          max-width: none !important;
          min-width: 0 !important;
          height: 54px !important;
          padding: 0 48px 0 16px !important;
          border-radius: 20px !important;
          border: 1px solid rgba(255, 212, 0, .24) !important;
          background: linear-gradient(135deg, rgba(9, 12, 20, .88), rgba(0, 0, 0, .78)) !important;
          box-shadow: 0 12px 34px rgba(0, 0, 0, .42), 0 0 22px rgba(47, 128, 255, .12) !important;
          backdrop-filter: blur(16px);
        }
        .headActions input[type='text'], .side-search, #sideMenuInput {
          font-size: 16px !important;
          line-height: 1.2 !important;
          transform: none !important;
        }
      }

      .mirpanelSearchShell { position: relative !important; }
      .mirpanelSearchClear {
        position: absolute;
        right: 10px;
        top: 50%;
        z-index: 5;
        width: 30px;
        height: 30px;
        transform: translateY(-50%) scale(.88);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 999px;
        background: rgba(255,255,255,.08);
        color: rgba(255,255,255,.86);
        font: 800 20px/1 Poppins, system-ui, sans-serif;
        opacity: 0;
        pointer-events: none;
        transition: opacity .18s ease, transform .18s ease, border-color .18s ease;
      }
      .mirpanelSearchClear.show { opacity: 1; pointer-events: auto; transform: translateY(-50%) scale(1); }
      .mirpanelSearchClear:hover { border-color: rgba(255,212,0,.45); color: #ffd400; }

      .mirpanelSearchSuggestPanel {
        position: fixed;
        z-index: 99998;
        max-height: min(390px, calc(100dvh - 145px));
        overflow-y: auto;
        padding: 8px;
        border: 1px solid rgba(255,212,0,.22);
        border-radius: 22px;
        background: linear-gradient(180deg, rgba(13, 15, 22, .96), rgba(3, 4, 7, .96));
        box-shadow: 0 24px 70px rgba(0,0,0,.58), 0 0 28px rgba(47,128,255,.14), inset 0 1px 0 rgba(255,255,255,.06);
        backdrop-filter: blur(18px);
        opacity: 0;
        transform: translateY(-8px) scale(.985);
        pointer-events: none;
        transition: opacity .18s ease, transform .18s ease;
      }
      .mirpanelSearchSuggestPanel.show { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
      .mirpanelSuggestState { padding: 18px 14px; color: rgba(255,255,255,.78); text-align: center; font: 800 14px/1.3 Poppins, system-ui, sans-serif; }
      .mirpanelSuggestItem {
        display: grid;
        grid-template-columns: 52px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 9px;
        border: 0;
        border-radius: 16px;
        background: transparent;
        color: #fff;
        text-align: left;
        cursor: pointer;
        transition: background .18s ease, transform .18s ease;
      }
      .mirpanelSuggestItem:hover { background: rgba(255,212,0,.08); transform: translateY(-1px); }
      .mirpanelSuggestImg { width: 52px; height: 42px; border-radius: 12px; overflow: hidden; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); }
      .mirpanelSuggestImg img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .mirpanelSuggestText { min-width: 0; display: grid; gap: 4px; }
      .mirpanelSuggestText strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 900 14px/1.12 Poppins, system-ui, sans-serif; }
      .mirpanelSuggestText span { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .mirpanelSuggestText em, .mirpanelSuggestText small {
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 4px 7px;
        border-radius: 999px;
        border: 1px solid rgba(255,212,0,.22);
        background: rgba(255,212,0,.09);
        color: rgba(255,255,255,.78);
        font: 800 10px/1 Poppins, system-ui, sans-serif;
        font-style: normal;
      }
      .mirpanelSuggestText small { border-color: rgba(47,128,255,.24); background: rgba(47,128,255,.10); }
      .mirpanelSuggestPrice { color: #ffd400; white-space: nowrap; font: 900 13px/1 Poppins, system-ui, sans-serif; text-shadow: 0 0 14px rgba(255,212,0,.24); }

      #modal.spotifyLoginOrderForm {
        align-items: center;
      }
      #modal.spotifyLoginOrderForm .modalCard {
        width: min(480px, calc(100vw - 28px));
        max-height: calc(100dvh - 112px);
        overflow-y: auto;
        border: 1px solid rgba(30, 215, 96, .58);
        background: radial-gradient(circle at 50% 0%, rgba(30, 215, 96, .15), transparent 38%), linear-gradient(180deg, rgba(14, 16, 15, .99), rgba(0, 0, 0, .99));
        box-shadow: 0 24px 76px rgba(0, 0, 0, .7), 0 0 36px rgba(30, 215, 96, .17);
      }
      #modal.spotifyLoginOrderForm .mTop,
      #modal.spotifyLoginOrderForm .mPlansTitle,
      #modal.spotifyLoginOrderForm .mPlans,
      #modal.spotifyLoginOrderForm .mInfoBox,
      #modal.spotifyLoginOrderForm #mDesc,
      #modal.spotifyLoginOrderForm .mBottom {
        display: none !important;
      }
      #modal.spotifyLoginOrderForm #mForm {
        margin-top: 0 !important;
      }
      .spotifyLoginOrderForm .spotifyLoginForm {
        display: grid;
        gap: 16px;
        padding: 24px 4px 2px;
      }
      .spotifyLoginOrderForm .spotifyLoginTitle {
        margin: 0 0 4px;
        color: #fff;
        font-size: clamp(27px, 5vw, 34px);
        line-height: 1.08;
        font-weight: 900;
        letter-spacing: 0;
        text-align: left;
        -webkit-text-fill-color: #fff;
        background: none;
        text-shadow: none;
      }
      .spotifyLoginOrderForm .spotifyLoginFields {
        display: grid;
        gap: 13px;
      }
      .spotifyLoginOrderForm .spotifyLoginField {
        display: grid;
        gap: 8px;
        margin: 0;
      }
      .spotifyLoginOrderForm .spotifyLoginField span {
        color: #f8fff9;
        font-size: 13px;
        line-height: 1.2;
        font-weight: 900;
      }
      .spotifyLoginOrderForm .spotifyLoginField input {
        width: 100%;
        min-height: 56px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, .42);
        background: #121212;
        color: #fff;
        font-family: inherit;
        font-size: 16px;
        font-weight: 650;
        outline: none;
        padding: 15px 16px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .04);
        transition: border-color .2s ease, box-shadow .2s ease, background .2s ease;
      }
      .spotifyLoginOrderForm .spotifyLoginField input::placeholder {
        color: rgba(255, 255, 255, .52);
        font-weight: 500;
      }
      .spotifyLoginOrderForm .spotifyLoginField input:focus {
        border-color: #1ed760;
        background: #0b0f0d;
        box-shadow: 0 0 0 3px rgba(30, 215, 96, .18), 0 0 24px rgba(30, 215, 96, .13);
      }
      .spotifyLoginOrderForm .spotifyPasswordWrap {
        position: relative;
      }
      .spotifyLoginOrderForm .spotifyPasswordWrap input {
        padding-right: 54px;
      }
      .spotifyLoginOrderForm .spotifyPasswordToggle {
        position: absolute;
        top: 50%;
        right: 10px;
        width: 38px;
        height: 38px;
        transform: translateY(-50%);
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: rgba(255, 255, 255, .74);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: color .18s ease, background .18s ease, transform .18s ease;
      }
      .spotifyLoginOrderForm .spotifyPasswordToggle:hover {
        color: #1ed760;
        background: rgba(30, 215, 96, .1);
      }
      .spotifyLoginOrderForm .spotifyPasswordToggle:active {
        transform: translateY(-50%) scale(.96);
      }
      .spotifyLoginOrderForm .spotifyPasswordToggle svg {
        width: 20px;
        height: 20px;
        pointer-events: none;
      }
      .spotifyLoginOrderForm .spotifyLoginActions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 11px;
        margin-top: 2px;
      }
      .spotifyLoginOrderForm .spotifyLoginSubmit,
      .spotifyLoginOrderForm .spotifyLoginCancel {
        min-height: 54px;
        border-radius: 999px;
        font-family: inherit;
        font-size: 16px;
        font-weight: 900;
        cursor: pointer;
        transition: transform .18s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;
      }
      .spotifyLoginOrderForm .spotifyLoginSubmit {
        border: 0;
        background: #1ed760;
        color: #050505;
        box-shadow: 0 14px 34px rgba(30, 215, 96, .25);
      }
      .spotifyLoginOrderForm .spotifyLoginSubmit:hover {
        transform: translateY(-1px);
        box-shadow: 0 18px 44px rgba(30, 215, 96, .32);
      }
      .spotifyLoginOrderForm .spotifyLoginCancel {
        border: 1px solid rgba(255, 255, 255, .34);
        background: transparent;
        color: #fff;
      }
      .spotifyLoginOrderForm .spotifyLoginCancel:hover {
        border-color: rgba(30, 215, 96, .6);
        background: rgba(255, 255, 255, .04);
      }
      .spotifyLoginOrderForm .spotifyLoginSubmit:active,
      .spotifyLoginOrderForm .spotifyLoginCancel:active {
        transform: translateY(1px) scale(.99);
      }

      @media (max-width: 560px) {
        #modal.spotifyLoginOrderForm {
          align-items: flex-start;
          padding: calc(12px + env(safe-area-inset-top)) 0 18px;
        }
        #modal.spotifyLoginOrderForm .modalCard {
          width: calc(100vw - 24px);
          max-height: calc(100dvh - 112px);
          padding: 18px 16px 16px;
          border-radius: 22px;
        }
        #modal.spotifyLoginOrderForm .close {
          top: 12px;
          right: 12px;
          padding: 8px 11px;
          border-radius: 12px;
          font-size: 12px;
        }
        .spotifyLoginOrderForm .spotifyLoginForm {
          gap: 13px;
          padding: 18px 0 0;
        }
        .spotifyLoginOrderForm .spotifyLoginTitle {
          max-width: calc(100% - 82px);
          font-size: 27px;
        }
        .spotifyLoginOrderForm .spotifyLoginFields {
          gap: 11px;
        }
        .spotifyLoginOrderForm .spotifyLoginField {
          gap: 7px;
        }
        .spotifyLoginOrderForm .spotifyLoginField input {
          min-height: 52px;
          padding: 13px 14px;
        }
        .spotifyLoginOrderForm .spotifyPasswordWrap input {
          padding-right: 50px;
        }
        .spotifyLoginOrderForm .spotifyLoginSubmit,
        .spotifyLoginOrderForm .spotifyLoginCancel {
          min-height: 50px;
          font-size: 15px;
        }
        body.spotifyLoginFormActive .gameFab,
        body.spotifyLoginFormActive .waFab {
          opacity: 0 !important;
          pointer-events: none !important;
          transform: translateY(14px) scale(.96) !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function installPanelEvents() {
    getPanel().addEventListener("pointerdown", (event) => {
      const item = event.target.closest(".mirpanelSuggestItem");
      if (!item) return;
      event.preventDefault();
      const id = item.getAttribute("data-product-id");
      closePanel();
      syncInputs("", activeInput);
      if (typeof window.openProductPage === "function") {
        window.openProductPage(id);
      } else if (typeof openProductPage === "function") {
        openProductPage(id);
      }
    });

    window.addEventListener("resize", () => {
      if (activeInput && getPanel().classList.contains("show")) positionPanel(activeInput);
    });
    window.addEventListener("scroll", () => {
      if (activeInput && getPanel().classList.contains("show")) positionPanel(activeInput);
    }, { passive: true });
    document.addEventListener("pointerdown", (event) => {
      if (event.target.closest(`#${PANEL_ID}`) || searchInputs().includes(event.target)) return;
      closePanel();
    });
  }

  function currentSpotifyProduct() {
    try {
      if (typeof currentProduct !== "undefined" && currentProduct) return currentProduct;
    } catch (error) {
      return null;
    }
    return window.currentProduct || null;
  }

  function isSpotifyProduct(product) {
    const id = normalizeSearch(product?.id);
    const title = normalizeSearch(product?.title);
    return id.includes("spotify") || title.includes("spotify");
  }

  function spotifyLoginCandidate(form) {
    const email = form?.querySelector("input[name='email'], input[type='email']");
    const password = form?.querySelector("input[name='password'], input[type='password']");
    return { email, password, ok: Boolean(email && password) };
  }

  function setSpotifyLoginClasses(enabled) {
    document.getElementById("modal")?.classList.toggle("spotifyLoginOrderForm", Boolean(enabled));
    document.body.classList.toggle("spotifyLoginFormActive", Boolean(enabled));
  }

  function relabelSpotifyField(input, label, placeholder) {
    if (!input) return;
    const field = input.closest("label");
    field?.classList.add("spotifyLoginField");
    const labelText = field?.querySelector("span");
    if (labelText) labelText.textContent = label;
    input.dataset.label = label;
    input.placeholder = placeholder;
  }

  function ensureSpotifyPasswordToggle(passwordInput) {
    if (!passwordInput || passwordInput.closest(".spotifyPasswordWrap")) return;

    const wrapper = document.createElement("div");
    wrapper.className = "spotifyPasswordWrap";
    passwordInput.parentNode.insertBefore(wrapper, passwordInput);
    wrapper.appendChild(passwordInput);

    const button = document.createElement("button");
    button.className = "spotifyPasswordToggle";
    button.type = "button";
    button.setAttribute("aria-label", "Şifrəni göstər");
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    button.addEventListener("click", () => {
      const showPassword = passwordInput.type === "password";
      passwordInput.type = showPassword ? "text" : "password";
      button.setAttribute("aria-label", showPassword ? "Şifrəni gizlət" : "Şifrəni göstər");
      button.setAttribute("aria-pressed", String(showPassword));
    });
    wrapper.appendChild(button);
  }

  function transformSpotifyLoginForm() {
    const modal = document.getElementById("modal");
    const form = document.getElementById("universalOrderForm");
    const product = currentSpotifyProduct();
    const { email, password, ok } = spotifyLoginCandidate(form);
    const shouldTransform = Boolean(modal?.classList.contains("show") && form && ok && isSpotifyProduct(product));

    if (!shouldTransform) {
      setSpotifyLoginClasses(false);
      return;
    }

    setSpotifyLoginClasses(true);
    form.classList.add("spotifyLoginForm");
    const title = form.querySelector(".mpFormTitle");
    if (title) {
      title.classList.add("spotifyLoginTitle");
      title.textContent = "Parol ilə daxil olun";
    }

    const fieldBox = form.querySelector(".premiumOrderFields");
    fieldBox?.classList.add("spotifyLoginFields");
    relabelSpotifyField(email, "E-poçt", "E-poçt ünvanınızı yazın");
    relabelSpotifyField(password, "Parol", "Parolunuzu yazın");
    ensureSpotifyPasswordToggle(password);

    const actions = form.querySelector(".orderConfirmationActions");
    const cancel = form.querySelector("#universalFormCancel");
    const submit = form.querySelector("button[type='submit']");
    actions?.classList.add("spotifyLoginActions");
    if (submit) {
      submit.classList.add("spotifyLoginSubmit");
      submit.classList.remove("premiumContinueBtn", "mpBtn");
      submit.textContent = "Sifariş et";
    }
    if (cancel) {
      cancel.classList.add("spotifyLoginCancel");
      cancel.classList.remove("mpBtn");
      cancel.textContent = "Ləğv et";
    }
    if (actions && submit && cancel && actions.firstElementChild !== submit) {
      actions.insertBefore(submit, cancel);
    }
  }

  function installSpotifyLoginTransformer() {
    document.addEventListener("click", () => setTimeout(transformSpotifyLoginForm, 80), true);
    document.addEventListener("keydown", () => setTimeout(transformSpotifyLoginForm, 80), true);
    document.addEventListener("submit", () => setTimeout(transformSpotifyLoginForm, 80), true);
    setTimeout(transformSpotifyLoginForm, 300);
  }

  function boot() {
    injectStyles();
    bindInputs();
    installPanelEvents();
    installSpotifyLoginTransformer();
    setTimeout(bindInputs, 350);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
