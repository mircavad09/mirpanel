(function () {
  function runWhenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
      return;
    }
    callback();
  }

  runWhenReady(() => {
    const stockInput = document.getElementById("productStock");
    const stockEnabledInput = document.getElementById("productStockEnabled");
    if (!stockInput || !stockEnabledInput) return;

    stockInput.addEventListener("input", () => {
      if (typeof selectedProduct !== "function") return;
      const product = selectedProduct();
      if (!product) return;

      if (stockInput.value === "") {
        product.stock = null;
        product.stockEnabled = false;
        stockEnabledInput.checked = false;
      } else {
        product.stock = Math.max(0, Number(stockInput.value) || 0);
        product.stockEnabled = true;
        stockEnabledInput.checked = true;
      }

      if (product.stockEnabled && Number(product.stock) > 0 && product.flow !== "out_of_stock") {
        product.soldOut = false;
      }
      if (product.stockEnabled && Number(product.stock) <= 0) {
        product.soldOut = true;
      }

      if (typeof markDirty === "function") markDirty();
      if (typeof renderProducts === "function") renderProducts();
    });
  });
})();

(function () {
  const defaults = {
    haqqimizda: {
      enabled: true,
      title: "Haqqımızda",
      text: "Mirpanel premium hesabların sürətli və etibarlı aktivləşdirilməsi üçün xidmət göstərir. Məhsullar WhatsApp üzərindən rahat sifariş olunur və dəstək komandası müştərilərə kömək edir.",
      linkText: "",
      order: 1
    },
    sertler: {
      enabled: true,
      title: "Şərtlər",
      text: "",
      items: [
        "Sifarişdən əvvəl məhsul məlumatlarını diqqətlə oxuyun.",
        "Rəqəmsal məhsullarda aktivləşdirmə qaydası məhsula görə dəyişə bilər.",
        "Yanlış daxil edilən məlumatlara görə gecikmə yarana bilər.",
        "Dəstək WhatsApp üzərindən göstərilir."
      ],
      order: 2
    },
    elaqe: {
      enabled: true,
      title: "Əlaqə",
      whatsappNumber: "051 524 35 45",
      buttonText: "WhatsApp ilə yaz",
      text: "",
      order: 3
    }
  };

  function normalizeLines(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  function normalizeSiteSections(source) {
    const input = source || {};
    return {
      haqqimizda: {
        ...defaults.haqqimizda,
        ...(input.haqqimizda || {}),
        enabled: (input.haqqimizda || {}).enabled ?? defaults.haqqimizda.enabled,
        order: Number.isFinite(Number((input.haqqimizda || {}).order)) ? Number(input.haqqimizda.order) : defaults.haqqimizda.order
      },
      sertler: {
        ...defaults.sertler,
        ...(input.sertler || {}),
        enabled: (input.sertler || {}).enabled ?? defaults.sertler.enabled,
        items: normalizeLines((input.sertler || {}).items ?? defaults.sertler.items),
        order: Number.isFinite(Number((input.sertler || {}).order)) ? Number(input.sertler.order) : defaults.sertler.order
      },
      elaqe: {
        ...defaults.elaqe,
        ...(input.elaqe || {}),
        enabled: (input.elaqe || {}).enabled ?? defaults.elaqe.enabled,
        order: Number.isFinite(Number((input.elaqe || {}).order)) ? Number(input.elaqe.order) : defaults.elaqe.order
      }
    };
  }

  function ensureData() {
    if (!state.data) return null;
    state.data.siteSections = normalizeSiteSections(state.data.siteSections);
    return state.data.siteSections;
  }

  function setValue(id, value, type) {
    const element = document.getElementById(id);
    if (!element) return;
    if (type === "checked") element.checked = Boolean(value);
    else element.value = value ?? "";
  }

  function injectView() {
    if (document.getElementById("siteSectionsView")) return;

    const nav = document.querySelector(".nav");
    if (nav && !document.querySelector('[data-view="siteSections"]')) {
      const button = document.createElement("button");
      button.className = "navBtn";
      button.type = "button";
      button.dataset.view = "siteSections";
      button.textContent = "Sayt mətnləri";
      button.addEventListener("click", () => showView("siteSections"));
      nav.appendChild(button);
    }

    const anchor = document.getElementById("settingsView") || document.querySelector("main");
    const view = document.createElement("section");
    view.className = "workspace hidden";
    view.id = "siteSectionsView";
    view.innerHTML = `
      <div class="panel editorPanel">
        <div class="panelHead">
          <div>
            <h2>Sayt mətnləri</h2>
            <p>Haqqımızda, Şərtlər və Əlaqə bölmələrini idarə et</p>
          </div>
        </div>

        <div class="formGrid">
          <h3>Haqqımızda</h3>
          <label><input type="checkbox" id="secAboutEnabled"> Aktiv</label>
          <label>Başlıq<input id="secAboutTitle"></label>
          <label>Bölmə sırası<input id="secAboutOrder" type="number" min="0" step="1"></label>
          <label>Düymə/link mətni<input id="secAboutLinkText"></label>
          <label class="wide">Mətn<textarea id="secAboutText" rows="5"></textarea></label>

          <h3>Şərtlər</h3>
          <label><input type="checkbox" id="secTermsEnabled"> Aktiv</label>
          <label>Başlıq<input id="secTermsTitle"></label>
          <label>Bölmə sırası<input id="secTermsOrder" type="number" min="0" step="1"></label>
          <label class="wide">Mətn<textarea id="secTermsText" rows="4"></textarea></label>
          <label class="wide">Maddələr / sətirlər<textarea id="secTermsItems" rows="6" placeholder="Hər sətri ayrıca yaz"></textarea></label>

          <h3>Əlaqə</h3>
          <label><input type="checkbox" id="secContactEnabled"> Aktiv</label>
          <label>Başlıq<input id="secContactTitle"></label>
          <label>Bölmə sırası<input id="secContactOrder" type="number" min="0" step="1"></label>
          <label>WhatsApp nömrəsi<input id="secContactWhatsapp"></label>
          <label>WhatsApp düymə mətni<input id="secContactButton"></label>
          <label class="wide">Əlavə əlaqə mətni<textarea id="secContactText" rows="4"></textarea></label>
        </div>
      </div>
    `;

    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(view, anchor.nextSibling);
    else document.querySelector("main")?.appendChild(view);
  }

  function renderSiteSectionsSettings() {
    const sections = ensureData();
    if (!sections) return;
    setValue("secAboutEnabled", sections.haqqimizda.enabled, "checked");
    setValue("secAboutTitle", sections.haqqimizda.title);
    setValue("secAboutOrder", sections.haqqimizda.order);
    setValue("secAboutLinkText", sections.haqqimizda.linkText);
    setValue("secAboutText", sections.haqqimizda.text);

    setValue("secTermsEnabled", sections.sertler.enabled, "checked");
    setValue("secTermsTitle", sections.sertler.title);
    setValue("secTermsOrder", sections.sertler.order);
    setValue("secTermsText", sections.sertler.text);
    setValue("secTermsItems", (sections.sertler.items || []).join("\n"));

    setValue("secContactEnabled", sections.elaqe.enabled, "checked");
    setValue("secContactTitle", sections.elaqe.title);
    setValue("secContactOrder", sections.elaqe.order);
    setValue("secContactWhatsapp", sections.elaqe.whatsappNumber);
    setValue("secContactButton", sections.elaqe.buttonText);
    setValue("secContactText", sections.elaqe.text);
  }

  function bindField(id, sectionKey, field, options = {}) {
    const element = document.getElementById(id);
    if (!element || element.dataset.siteSectionBound === "1") return;
    element.dataset.siteSectionBound = "1";
    const eventName = options.type === "checked" ? "change" : "input";
    element.addEventListener(eventName, () => {
      const sections = ensureData();
      if (!sections) return;
      const section = sections[sectionKey];
      if (options.type === "checked") section[field] = element.checked;
      else if (options.type === "number") section[field] = Number(element.value) || 0;
      else if (options.type === "lines") section[field] = normalizeLines(element.value);
      else section[field] = element.value;
      if (typeof markDirty === "function") markDirty();
    });
  }

  function bindFields() {
    bindField("secAboutEnabled", "haqqimizda", "enabled", { type: "checked" });
    bindField("secAboutTitle", "haqqimizda", "title");
    bindField("secAboutOrder", "haqqimizda", "order", { type: "number" });
    bindField("secAboutLinkText", "haqqimizda", "linkText");
    bindField("secAboutText", "haqqimizda", "text");

    bindField("secTermsEnabled", "sertler", "enabled", { type: "checked" });
    bindField("secTermsTitle", "sertler", "title");
    bindField("secTermsOrder", "sertler", "order", { type: "number" });
    bindField("secTermsText", "sertler", "text");
    bindField("secTermsItems", "sertler", "items", { type: "lines" });

    bindField("secContactEnabled", "elaqe", "enabled", { type: "checked" });
    bindField("secContactTitle", "elaqe", "title");
    bindField("secContactOrder", "elaqe", "order", { type: "number" });
    bindField("secContactWhatsapp", "elaqe", "whatsappNumber");
    bindField("secContactButton", "elaqe", "buttonText");
    bindField("secContactText", "elaqe", "text");
  }

  function installHooks() {
    if (typeof renderAll === "function" && !renderAll.__siteSectionsWrapped) {
      const originalRenderAll = renderAll;
      renderAll = function siteSectionsRenderAll(...args) {
        const result = originalRenderAll.apply(this, args);
        renderSiteSectionsSettings();
        return result;
      };
      renderAll.__siteSectionsWrapped = true;
    }

    if (typeof syncAllProducts === "function" && !syncAllProducts.__siteSectionsWrapped) {
      const originalSyncAllProducts = syncAllProducts;
      syncAllProducts = function siteSectionsSyncAllProducts(...args) {
        const result = originalSyncAllProducts.apply(this, args);
        ensureData();
        return result;
      };
      syncAllProducts.__siteSectionsWrapped = true;
    }

    if (typeof showView === "function" && !showView.__siteSectionsWrapped) {
      const originalShowView = showView;
      showView = function siteSectionsShowView(view) {
        if (view !== "siteSections") {
          originalShowView.call(this, view);
          document.getElementById("siteSectionsView")?.classList.add("hidden");
          return;
        }

        ["products", "categories", "settings"].forEach((name) => {
          document.getElementById(`${name}View`)?.classList.add("hidden");
        });
        document.getElementById("siteSectionsView")?.classList.remove("hidden");
        document.querySelectorAll(".navBtn[data-view]").forEach((button) => {
          button.classList.toggle("active", button.dataset.view === view);
        });
        const crumb = document.getElementById("crumb");
        if (crumb) crumb.textContent = "Sayt mətnləri";
        renderSiteSectionsSettings();
      };
      showView.__siteSectionsWrapped = true;
    }
  }

  function boot() {
    injectView();
    bindFields();
    installHooks();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
