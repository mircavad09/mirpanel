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
      slug: "haqqimizda",
      title: "Haqqımızda",
      subtitle: "Mirpanel haqqında qısa məlumat",
      body: "Mirpanel premium hesabların sürətli və etibarlı aktivləşdirilməsi üçün xidmət göstərir. Məhsullar WhatsApp üzərindən rahat sifariş olunur və dəstək komandası müştərilərə kömək edir.",
      blocks: [],
      seoTitle: "Haqqımızda | Mirpanel",
      seoDescription: "Mirpanel premium hesabların sürətli və etibarlı aktivləşdirilməsi üçün xidmət göstərir.",
      order: 1
    },
    sertler: {
      enabled: true,
      slug: "sertler",
      title: "Şərtlər",
      subtitle: "Sifariş və istifadə şərtləri",
      body: "Sifarişdən əvvəl məhsul məlumatlarını diqqətlə oxuyun.",
      items: [
        "Sifarişdən əvvəl məhsul məlumatlarını diqqətlə oxuyun.",
        "Rəqəmsal məhsullarda aktivləşdirmə qaydası məhsula görə dəyişə bilər.",
        "Yanlış daxil edilən məlumatlara görə gecikmə yarana bilər.",
        "Dəstək WhatsApp üzərindən göstərilir."
      ],
      seoTitle: "Şərtlər | Mirpanel",
      seoDescription: "Mirpanel sifariş və istifadə şərtləri.",
      order: 2
    },
    elaqe: {
      enabled: true,
      slug: "elaqe",
      title: "Əlaqə",
      subtitle: "Mirpanel dəstək komandası ilə əlaqə",
      whatsappNumber: "051 524 35 45",
      buttonText: "WhatsApp ilə əlaqə",
      body: "Sualınız varsa WhatsApp üzərindən bizimlə əlaqə saxlaya bilərsiniz.",
      workHours: "Dəstək WhatsApp üzərindən göstərilir.",
      seoTitle: "Əlaqə | Mirpanel",
      seoDescription: "Mirpanel ilə WhatsApp üzərindən əlaqə saxlayın.",
      order: 3
    }
  };

  function slugify(value, fallback) {
    const slug = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[əƏ]/g, "e")
      .replace(/[ıİ]/g, "i")
      .replace(/[öÖ]/g, "o")
      .replace(/[üÜ]/g, "u")
      .replace(/[şŞ]/g, "s")
      .replace(/[çÇ]/g, "c")
      .replace(/[ğĞ]/g, "g")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || fallback;
  }

  function normalizeLines(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  function normalizeSitePages(source) {
    const input = source || {};
    const about = input.haqqimizda || {};
    const terms = input.sertler || {};
    const contact = input.elaqe || {};

    return {
      haqqimizda: {
        ...defaults.haqqimizda,
        ...about,
        enabled: about.enabled ?? defaults.haqqimizda.enabled,
        slug: slugify(about.slug || "haqqimizda", "haqqimizda"),
        title: String(about.title ?? defaults.haqqimizda.title),
        subtitle: String(about.subtitle ?? defaults.haqqimizda.subtitle),
        body: String(about.body ?? about.text ?? defaults.haqqimizda.body),
        blocks: normalizeLines(about.blocks),
        seoTitle: String(about.seoTitle ?? defaults.haqqimizda.seoTitle),
        seoDescription: String(about.seoDescription ?? defaults.haqqimizda.seoDescription),
        order: Number.isFinite(Number(about.order)) ? Number(about.order) : defaults.haqqimizda.order
      },
      sertler: {
        ...defaults.sertler,
        ...terms,
        enabled: terms.enabled ?? defaults.sertler.enabled,
        slug: slugify(terms.slug || "sertler", "sertler"),
        title: String(terms.title ?? defaults.sertler.title),
        subtitle: String(terms.subtitle ?? defaults.sertler.subtitle),
        body: String(terms.body ?? terms.text ?? defaults.sertler.body),
        items: normalizeLines(terms.items ?? defaults.sertler.items),
        seoTitle: String(terms.seoTitle ?? defaults.sertler.seoTitle),
        seoDescription: String(terms.seoDescription ?? defaults.sertler.seoDescription),
        order: Number.isFinite(Number(terms.order)) ? Number(terms.order) : defaults.sertler.order
      },
      elaqe: {
        ...defaults.elaqe,
        ...contact,
        enabled: contact.enabled ?? defaults.elaqe.enabled,
        slug: slugify(contact.slug || "elaqe", "elaqe"),
        title: String(contact.title ?? defaults.elaqe.title),
        subtitle: String(contact.subtitle ?? defaults.elaqe.subtitle),
        whatsappNumber: String(contact.whatsappNumber ?? contact.whatsapp ?? defaults.elaqe.whatsappNumber),
        buttonText: String(contact.buttonText ?? contact.whatsappButtonText ?? defaults.elaqe.buttonText),
        body: String(contact.body ?? contact.text ?? defaults.elaqe.body),
        workHours: String(contact.workHours ?? defaults.elaqe.workHours),
        seoTitle: String(contact.seoTitle ?? defaults.elaqe.seoTitle),
        seoDescription: String(contact.seoDescription ?? defaults.elaqe.seoDescription),
        order: Number.isFinite(Number(contact.order)) ? Number(contact.order) : defaults.elaqe.order
      }
    };
  }

  function ensureData() {
    if (!state.data) return null;
    state.data.siteSections = normalizeSitePages(state.data.siteSections);
    return state.data.siteSections;
  }

  function element(id) { return document.getElementById(id); }
  function setValue(id, value, type) {
    const target = element(id);
    if (!target) return;
    if (type === "checked") target.checked = Boolean(value);
    else target.value = value ?? "";
  }

  function injectView() {
    if (element("siteSectionsView")) return;

    const nav = document.querySelector(".nav");
    if (nav && !document.querySelector('[data-view="siteSections"]')) {
      const button = document.createElement("button");
      button.className = "navBtn";
      button.type = "button";
      button.dataset.view = "siteSections";
      button.textContent = "Səhifələr";
      button.addEventListener("click", () => showView("siteSections"));
      nav.appendChild(button);
    }

    const anchor = element("settingsView") || document.querySelector("main");
    const view = document.createElement("section");
    view.className = "workspace hidden";
    view.id = "siteSectionsView";
    view.innerHTML = `
      <div class="panel editorPanel">
        <div class="panelHead">
          <div>
            <h2>Səhifələr</h2>
            <p>Haqqımızda, Şərtlər və Əlaqə səhifələrini idarə et</p>
          </div>
        </div>

        <div class="formGrid">
          <h3>Haqqımızda</h3>
          <label><input type="checkbox" id="secAboutEnabled"> Aktiv</label>
          <label>SEO URL slug<input id="secAboutSlug" placeholder="haqqimizda"></label>
          <label>Bölmə sırası<input id="secAboutOrder" type="number" min="0" step="1"></label>
          <label>Başlıq<input id="secAboutTitle"></label>
          <label class="full">Qısa alt başlıq<input id="secAboutSubtitle"></label>
          <label class="full">Əsas mətn<textarea id="secAboutBody" rows="5"></textarea></label>
          <label class="full">Əlavə mətn blokları<textarea id="secAboutBlocks" rows="5" placeholder="Hər bloku ayrıca sətirdə yaz"></textarea></label>
          <button class="btn" type="button" id="secAboutAddBlock">Blok əlavə et</button>
          <button class="btn" type="button" id="secAboutClearBlocks">Blokları sil</button>
          <label class="full">SEO title<input id="secAboutSeoTitle"></label>
          <label class="full">SEO description<textarea id="secAboutSeoDescription" rows="3"></textarea></label>

          <h3>Şərtlər</h3>
          <label><input type="checkbox" id="secTermsEnabled"> Aktiv</label>
          <label>SEO URL slug<input id="secTermsSlug" placeholder="sertler"></label>
          <label>Bölmə sırası<input id="secTermsOrder" type="number" min="0" step="1"></label>
          <label>Başlıq<input id="secTermsTitle"></label>
          <label class="full">Qısa alt başlıq<input id="secTermsSubtitle"></label>
          <label class="full">Şərtlər mətni<textarea id="secTermsBody" rows="5"></textarea></label>
          <label class="full">Maddələr<textarea id="secTermsItems" rows="7" placeholder="Hər maddəni ayrıca sətirdə yaz"></textarea></label>
          <button class="btn" type="button" id="secTermsAddItem">Maddə əlavə et</button>
          <button class="btn" type="button" id="secTermsClearItems">Maddələri sil</button>
          <label class="full">SEO title<input id="secTermsSeoTitle"></label>
          <label class="full">SEO description<textarea id="secTermsSeoDescription" rows="3"></textarea></label>

          <h3>Əlaqə</h3>
          <label><input type="checkbox" id="secContactEnabled"> Aktiv</label>
          <label>SEO URL slug<input id="secContactSlug" placeholder="elaqe"></label>
          <label>Bölmə sırası<input id="secContactOrder" type="number" min="0" step="1"></label>
          <label>Başlıq<input id="secContactTitle"></label>
          <label class="full">Qısa alt başlıq<input id="secContactSubtitle"></label>
          <label>WhatsApp nömrəsi<input id="secContactWhatsapp"></label>
          <label>WhatsApp düymə mətni<input id="secContactButton"></label>
          <label class="full">Əlavə əlaqə mətni<textarea id="secContactBody" rows="4"></textarea></label>
          <label class="full">İş saatı mətni<textarea id="secContactWorkHours" rows="3"></textarea></label>
          <label class="full">SEO title<input id="secContactSeoTitle"></label>
          <label class="full">SEO description<textarea id="secContactSeoDescription" rows="3"></textarea></label>
        </div>
      </div>
    `;

    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(view, anchor.nextSibling);
    else document.querySelector("main")?.appendChild(view);
  }

  function renderSitePagesSettings() {
    const pages = ensureData();
    if (!pages) return;

    setValue("secAboutEnabled", pages.haqqimizda.enabled, "checked");
    setValue("secAboutSlug", pages.haqqimizda.slug);
    setValue("secAboutOrder", pages.haqqimizda.order);
    setValue("secAboutTitle", pages.haqqimizda.title);
    setValue("secAboutSubtitle", pages.haqqimizda.subtitle);
    setValue("secAboutBody", pages.haqqimizda.body);
    setValue("secAboutBlocks", (pages.haqqimizda.blocks || []).join("\n"));
    setValue("secAboutSeoTitle", pages.haqqimizda.seoTitle);
    setValue("secAboutSeoDescription", pages.haqqimizda.seoDescription);

    setValue("secTermsEnabled", pages.sertler.enabled, "checked");
    setValue("secTermsSlug", pages.sertler.slug);
    setValue("secTermsOrder", pages.sertler.order);
    setValue("secTermsTitle", pages.sertler.title);
    setValue("secTermsSubtitle", pages.sertler.subtitle);
    setValue("secTermsBody", pages.sertler.body);
    setValue("secTermsItems", (pages.sertler.items || []).join("\n"));
    setValue("secTermsSeoTitle", pages.sertler.seoTitle);
    setValue("secTermsSeoDescription", pages.sertler.seoDescription);

    setValue("secContactEnabled", pages.elaqe.enabled, "checked");
    setValue("secContactSlug", pages.elaqe.slug);
    setValue("secContactOrder", pages.elaqe.order);
    setValue("secContactTitle", pages.elaqe.title);
    setValue("secContactSubtitle", pages.elaqe.subtitle);
    setValue("secContactWhatsapp", pages.elaqe.whatsappNumber);
    setValue("secContactButton", pages.elaqe.buttonText);
    setValue("secContactBody", pages.elaqe.body);
    setValue("secContactWorkHours", pages.elaqe.workHours);
    setValue("secContactSeoTitle", pages.elaqe.seoTitle);
    setValue("secContactSeoDescription", pages.elaqe.seoDescription);
  }

  function bindField(id, pageKey, field, options = {}) {
    const target = element(id);
    if (!target || target.dataset.sitePageBound === "1") return;
    target.dataset.sitePageBound = "1";
    const eventName = options.type === "checked" ? "change" : "input";
    target.addEventListener(eventName, () => {
      const pages = ensureData();
      if (!pages) return;
      const page = pages[pageKey];
      if (options.type === "checked") page[field] = target.checked;
      else if (options.type === "number") page[field] = Number(target.value) || 0;
      else if (options.type === "lines") page[field] = normalizeLines(target.value);
      else if (options.type === "slug") page[field] = slugify(target.value, defaults[pageKey].slug);
      else page[field] = target.value;
      if (options.type === "slug") target.value = page[field];
      if (typeof markDirty === "function") markDirty();
    });
  }

  function appendLine(id) {
    const target = element(id);
    if (!target) return;
    target.value = `${target.value || ""}${target.value ? "\n" : ""}- yeni mətn`;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.focus();
  }

  function clearLines(id) {
    const target = element(id);
    if (!target) return;
    target.value = "";
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function bindButtons() {
    const pairs = [
      ["secAboutAddBlock", () => appendLine("secAboutBlocks")],
      ["secAboutClearBlocks", () => clearLines("secAboutBlocks")],
      ["secTermsAddItem", () => appendLine("secTermsItems")],
      ["secTermsClearItems", () => clearLines("secTermsItems")]
    ];
    pairs.forEach(([id, handler]) => {
      const target = element(id);
      if (!target || target.dataset.sitePageButtonBound === "1") return;
      target.dataset.sitePageButtonBound = "1";
      target.addEventListener("click", handler);
    });
  }

  function bindFields() {
    bindField("secAboutEnabled", "haqqimizda", "enabled", { type: "checked" });
    bindField("secAboutSlug", "haqqimizda", "slug", { type: "slug" });
    bindField("secAboutOrder", "haqqimizda", "order", { type: "number" });
    bindField("secAboutTitle", "haqqimizda", "title");
    bindField("secAboutSubtitle", "haqqimizda", "subtitle");
    bindField("secAboutBody", "haqqimizda", "body");
    bindField("secAboutBlocks", "haqqimizda", "blocks", { type: "lines" });
    bindField("secAboutSeoTitle", "haqqimizda", "seoTitle");
    bindField("secAboutSeoDescription", "haqqimizda", "seoDescription");

    bindField("secTermsEnabled", "sertler", "enabled", { type: "checked" });
    bindField("secTermsSlug", "sertler", "slug", { type: "slug" });
    bindField("secTermsOrder", "sertler", "order", { type: "number" });
    bindField("secTermsTitle", "sertler", "title");
    bindField("secTermsSubtitle", "sertler", "subtitle");
    bindField("secTermsBody", "sertler", "body");
    bindField("secTermsItems", "sertler", "items", { type: "lines" });
    bindField("secTermsSeoTitle", "sertler", "seoTitle");
    bindField("secTermsSeoDescription", "sertler", "seoDescription");

    bindField("secContactEnabled", "elaqe", "enabled", { type: "checked" });
    bindField("secContactSlug", "elaqe", "slug", { type: "slug" });
    bindField("secContactOrder", "elaqe", "order", { type: "number" });
    bindField("secContactTitle", "elaqe", "title");
    bindField("secContactSubtitle", "elaqe", "subtitle");
    bindField("secContactWhatsapp", "elaqe", "whatsappNumber");
    bindField("secContactButton", "elaqe", "buttonText");
    bindField("secContactBody", "elaqe", "body");
    bindField("secContactWorkHours", "elaqe", "workHours");
    bindField("secContactSeoTitle", "elaqe", "seoTitle");
    bindField("secContactSeoDescription", "elaqe", "seoDescription");
    bindButtons();
  }

  function installHooks() {
    if (typeof renderAll === "function" && !renderAll.__sitePagesWrapped) {
      const originalRenderAll = renderAll;
      renderAll = function sitePagesRenderAll(...args) {
        const result = originalRenderAll.apply(this, args);
        renderSitePagesSettings();
        return result;
      };
      renderAll.__sitePagesWrapped = true;
    }

    if (typeof syncAllProducts === "function" && !syncAllProducts.__sitePagesWrapped) {
      const originalSyncAllProducts = syncAllProducts;
      syncAllProducts = function sitePagesSyncAllProducts(...args) {
        const result = originalSyncAllProducts.apply(this, args);
        ensureData();
        return result;
      };
      syncAllProducts.__sitePagesWrapped = true;
    }

    if (typeof showView === "function" && !showView.__sitePagesWrapped) {
      const originalShowView = showView;
      showView = function sitePagesShowView(view) {
        if (view !== "siteSections") {
          originalShowView.call(this, view);
          element("siteSectionsView")?.classList.add("hidden");
          return;
        }

        ["products", "categories", "settings"].forEach((name) => {
          element(`${name}View`)?.classList.add("hidden");
        });
        element("siteSectionsView")?.classList.remove("hidden");
        document.querySelectorAll(".navBtn[data-view]").forEach((button) => {
          button.classList.toggle("active", button.dataset.view === view);
        });
        const crumb = element("crumb");
        if (crumb) crumb.textContent = "Səhifələr";
        renderSitePagesSettings();
      };
      showView.__sitePagesWrapped = true;
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
