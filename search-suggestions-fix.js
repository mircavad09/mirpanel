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
    return (window.DATA?.products || [])
      .filter((product) => product.active !== false)
      .filter((product) => {
        const blob = [product.title, product.variant, product.badge, product.category, product.desc, product.id].join(" ");
        return normalizeSearch(blob).includes(normalized);
      })
      .sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999));
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
        meta[name="viewport"] { content: width=device-width, initial-scale=1, viewport-fit=cover; }
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
      if (typeof window.openProductPage === "function") window.openProductPage(id);
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

  function boot() {
    injectStyles();
    bindInputs();
    installPanelEvents();
    setTimeout(bindInputs, 350);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
