(function () {
  const DEFAULT_PAGES = {
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

  const BASE_URL = "https://mirpanel.com";

  function sourcePages() {
    try {
      if (typeof SITE_PAGES !== "undefined" && SITE_PAGES && typeof SITE_PAGES === "object") return SITE_PAGES;
    } catch {}
    try {
      if (typeof SITE_SECTIONS !== "undefined" && SITE_SECTIONS && typeof SITE_SECTIONS === "object") return SITE_SECTIONS;
    } catch {}
    return DEFAULT_PAGES;
  }

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

  function lines(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }

  function normalizePages() {
    const source = sourcePages();
    return {
      haqqimizda: normalizePage("haqqimizda", source.haqqimizda),
      sertler: normalizePage("sertler", source.sertler),
      elaqe: normalizePage("elaqe", source.elaqe)
    };
  }

  function normalizePage(key, item = {}) {
    const fallback = DEFAULT_PAGES[key];
    const page = {
      ...fallback,
      ...item,
      enabled: item.enabled ?? fallback.enabled,
      slug: slugify(item.slug || fallback.slug, fallback.slug),
      title: String(item.title ?? fallback.title),
      subtitle: String(item.subtitle ?? fallback.subtitle),
      body: String(item.body ?? item.text ?? fallback.body),
      seoTitle: String(item.seoTitle ?? fallback.seoTitle),
      seoDescription: String(item.seoDescription ?? fallback.seoDescription),
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : fallback.order
    };
    if (key === "haqqimizda") page.blocks = lines(item.blocks);
    if (key === "sertler") page.items = lines(item.items ?? fallback.items);
    if (key === "elaqe") {
      page.whatsappNumber = String(item.whatsappNumber ?? item.whatsapp ?? fallback.whatsappNumber);
      page.buttonText = String(item.buttonText ?? item.whatsappButtonText ?? fallback.buttonText);
      page.workHours = String(item.workHours ?? fallback.workHours);
    }
    return page;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function textToHtml(value) {
    return escapeHtml(value).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
  }

  function whatsappHref(number) {
    const digits = String(number || "").replace(/\D/g, "");
    if (!digits) return "https://wa.me/994515243545";
    return `https://wa.me/${digits.startsWith("0") ? `994${digits.slice(1)}` : digits}`;
  }

  function ensurePageView() {
    let view = document.getElementById("sitePageView");
    if (view) return view;
    view = document.createElement("main");
    view.id = "sitePageView";
    view.className = "wrap sitePageView";
    view.style.display = "none";
    document.body.insertBefore(view, document.querySelector("footer") || null);
    return view;
  }

  function ensureStyles() {
    if (document.getElementById("site-pages-style")) return;
    const style = document.createElement("style");
    style.id = "site-pages-style";
    style.textContent = `
      .sitePageView{padding:34px 0 120px;min-height:62vh}.sitePageCard{max-width:920px;margin:0 auto;border:1px solid rgba(255,212,0,.18);border-radius:24px;background:radial-gradient(520px 220px at 100% 0%,rgba(255,212,0,.08),transparent 62%),rgba(10,10,10,.78);box-shadow:0 24px 70px rgba(0,0,0,.34),inset 0 0 0 1px rgba(255,255,255,.035);padding:30px}.sitePageBack{display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;padding:10px 14px;border:1px solid rgba(255,212,0,.3);border-radius:14px;background:rgba(255,255,255,.045);color:#ffd400;font-weight:800}.sitePageEyebrow{color:#ffd400;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.sitePageCard h1{margin:8px 0 8px;color:#fff;font-size:clamp(30px,4vw,48px);line-height:1.08}.sitePageSubtitle{margin:0 0 22px;color:rgba(255,255,255,.72);font-size:16px}.sitePageBody{color:rgba(255,255,255,.82);font-size:16px;line-height:1.75}.sitePageBody p{margin:0 0 14px}.sitePageList{display:grid;gap:10px;margin:18px 0 0;padding:0;list-style:none}.sitePageList li{border:1px solid rgba(255,212,0,.12);border-radius:14px;background:rgba(255,255,255,.035);padding:13px 14px;color:rgba(255,255,255,.82)}.sitePageWa{display:inline-flex;margin-top:18px;padding:13px 18px;border-radius:16px;background:linear-gradient(135deg,#ffd400,#caa300);color:#070707;font-weight:900;box-shadow:0 14px 30px rgba(255,212,0,.16)}.sitePageContactLine{margin-top:16px;color:rgba(255,255,255,.84)}.sitePageHours{margin-top:10px;color:rgba(255,255,255,.68)}@media(max-width:640px){.sitePageView{padding:18px 0 96px}.sitePageCard{border-radius:18px;padding:20px}.sitePageSubtitle,.sitePageBody{font-size:15px;line-height:1.65}.sitePageList li{font-size:14px;line-height:1.55}}`;
    document.head.appendChild(style);
  }

  function setMeta(selector, attr, value) {
    let el = document.head.querySelector(selector);
    if (!el) return;
    el.setAttribute(attr, value);
  }

  function canonical(url) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = url;
  }

  function applySeo(page) {
    const url = `${BASE_URL}/${page.slug}`;
    document.title = page.seoTitle || `${page.title} | Mirpanel`;
    setMeta('meta[name="description"]', "content", page.seoDescription || page.subtitle || page.body);
    setMeta('meta[property="og:title"]', "content", page.seoTitle || page.title);
    setMeta('meta[property="og:description"]', "content", page.seoDescription || page.subtitle || page.body);
    setMeta('meta[property="og:type"]', "content", "website");
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[name="twitter:title"]', "content", page.seoTitle || page.title);
    setMeta('meta[name="twitter:description"]', "content", page.seoDescription || page.subtitle || page.body);
    canonical(url);
  }

  function pageByPath() {
    const current = slugify(window.location.pathname.replace(/^\/+|\/+$/g, ""), "");
    if (!current) return null;
    const pages = normalizePages();
    return Object.entries(pages).find(([, page]) => page.enabled !== false && page.slug === current) || null;
  }

  function showHome(scrollProducts) {
    const productView = document.getElementById("productPageView");
    const homeView = document.getElementById("homePageView");
    const hero = document.getElementById("hero-section");
    const pageView = ensurePageView();
    if (productView) productView.style.display = "none";
    if (homeView) homeView.style.display = "block";
    if (hero) hero.style.display = scrollProducts ? "none" : "block";
    pageView.style.display = "none";
    document.getElementById("mainHeader")?.style.removeProperty("display");
    if (scrollProducts) document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
    window.MirpanelSEO?.applyHomeSEO?.();
  }

  function renderPage(key, page, replaceOnly) {
    ensureStyles();
    const pageView = ensurePageView();
    const productView = document.getElementById("productPageView");
    const homeView = document.getElementById("homePageView");
    const hero = document.getElementById("hero-section");

    if (productView) productView.style.display = "none";
    if (homeView) homeView.style.display = "none";
    if (hero) hero.style.display = "none";
    document.getElementById("mainHeader")?.style.removeProperty("display");

    const body = `<p>${textToHtml(page.body || "")}</p>`;
    const extra = key === "haqqimizda" && page.blocks?.length
      ? page.blocks.map((block) => `<p>${textToHtml(block)}</p>`).join("")
      : "";
    const items = key === "sertler" && page.items?.length
      ? `<ul class="sitePageList">${page.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
    const contact = key === "elaqe"
      ? `<p class="sitePageContactLine">WhatsApp: <strong>${escapeHtml(page.whatsappNumber)}</strong></p><a class="sitePageWa" href="${whatsappHref(page.whatsappNumber)}" target="_blank" rel="noopener noreferrer">${escapeHtml(page.buttonText)}</a>${page.workHours ? `<p class="sitePageHours">${escapeHtml(page.workHours)}</p>` : ""}`
      : "";

    pageView.innerHTML = `<article class="sitePageCard"><a href="/" class="sitePageBack" data-site-home>← Ana səhifəyə qayıt</a><div class="sitePageEyebrow">Mirpanel</div><h1>${escapeHtml(page.title)}</h1>${page.subtitle ? `<p class="sitePageSubtitle">${escapeHtml(page.subtitle)}</p>` : ""}<div class="sitePageBody">${body}${extra}${items}${contact}</div></article>`;
    pageView.style.display = "block";
    applySeo(page);
    if (!replaceOnly && window.location.pathname.replace(/^\/+|\/+$/g, "") !== page.slug) history.pushState({ sitePage: key }, "", `/${page.slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderSiteSectionsFromAdmin() {
    const container = document.getElementById("siteInfoSections") || document.querySelector(".infoSections");
    if (!container) return;
    const pages = normalizePages();
    const visible = Object.entries(pages)
      .filter(([, page]) => page.enabled !== false)
      .sort((a, b) => (Number(a[1].order) || 0) - (Number(b[1].order) || 0));
    container.innerHTML = visible.map(([key, page]) => `<article class="siteInfoCard" id="${key === "haqqimizda" ? "haqqimizda" : key === "sertler" ? "sertler" : "elaqe"}"><h2>${escapeHtml(page.title)}</h2><p>${escapeHtml(page.subtitle || page.body)}</p></article>`).join("");
    syncNavLinks();
  }

  function syncNavLinks() {
    const pages = normalizePages();
    const map = { haqqimizda: pages.haqqimizda, sertler: pages.sertler, elaqe: pages.elaqe };
    Object.entries(map).forEach(([key, page]) => {
      document.querySelectorAll(`[data-section-nav="${key}"]`).forEach((link) => {
        link.style.display = page.enabled === false ? "none" : "";
        link.setAttribute("href", `/${page.slug}`);
      });
    });
  }

  function installRouting() {
    syncNavLinks();

    document.addEventListener("click", (event) => {
      const home = event.target.closest("[data-site-home]");
      if (home) {
        event.preventDefault();
        history.pushState({}, "", "/");
        showHome(false);
        return;
      }

      const nav = event.target.closest("[data-section-nav]");
      if (nav) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const key = nav.getAttribute("data-section-nav");
        const page = normalizePages()[key];
        if (!page || page.enabled === false) return;
        document.getElementById("sideMenu")?.classList.remove("active");
        document.getElementById("sideMenuOverlay")?.classList.remove("active");
        document.body.style.overflow = "";
        renderPage(key, page);
      }
    }, true);

    window.addEventListener("popstate", () => {
      const match = pageByPath();
      if (match) renderPage(match[0], match[1], true);
      else showHome(false);
    });

    const match = pageByPath();
    if (match) setTimeout(() => renderPage(match[0], match[1], true), 50);
  }

  window.renderSiteSectionsFromAdmin = renderSiteSectionsFromAdmin;
  window.renderMirpanelSitePage = renderPage;

  function boot() {
    renderSiteSectionsFromAdmin();
    installRouting();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
