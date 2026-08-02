(function () {
  const source = typeof CMS_CONTENT === "object" && CMS_CONTENT ? CMS_CONTENT : {};
  const site = source.site || {};
  const home = source.homepage || {};
  const common = source.commonTexts || {};

  function text(selector, value) {
    if (value === undefined || value === null || value === "") return;
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = String(value);
    });
  }

  function safeImage(value) {
    const path = String(value || "").trim();
    if (!path || path.includes("..") || /^(?:javascript|data):/i.test(path)) return "";
    return path;
  }

  function safeHref(value) {
    const url = String(value || "").trim();
    if (/^\/(?!\/)/.test(url) || /^https?:\/\//i.test(url) || /^#/.test(url)) return url;
    return "/";
  }

  function optionalHref(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    return /^\/(?!\/)/.test(url) || /^https?:\/\//i.test(url) || /^#/.test(url) ? url : "";
  }

  function imageWithFallback(image, fallbacks) {
    const queue = [...new Set((Array.isArray(fallbacks) ? fallbacks : [fallbacks]).map(safeImage).filter(Boolean))];
    image.addEventListener("error", () => {
      const fallback = queue.shift();
      if (!fallback) {
        image.hidden = true;
        return;
      }
      image.src = fallback;
    }, { once: false });
  }

  function productSlug(product) {
    return String(product?.seoSlug || `${product?.id || "mehsul"}-almaq`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .replace(/-almaq$/, "")
      .replace(/(^|-)hesab0(?=-|$)/g, "$1hesab")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function iconSvg(name) {
    const icons = {
      home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/>',
      products: '<path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
      contact: '<path d="M6.5 3.5h3l1.5 4-2 1.5a15 15 0 0 0 6 6l1.5-2 4 1.5v3a3 3 0 0 1-3 3C9.8 20.5 3.5 14.2 3.5 6.5a3 3 0 0 1 3-3Z"/>',
      terms: '<path d="M7 3.5h10a2 2 0 0 1 2 2v15l-7-3-7 3v-15a2 2 0 0 1 2-2Z"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/>'
    };
    return icons[name] || icons.link;
  }

  function applyBrand() {
    const brand = site.brandName || (typeof DATA === "object" ? DATA.brand : "") || "Mirpanel";
    const logo = safeImage(site.logo);
    if (typeof DATA === "object") DATA.brand = brand;
    text(".brandName", brand);
    text(".premium-brand-text", brand.toUpperCase());
    text(".premium-sub-text", site.brandSubtitle || UI?.brandSub);
    if (logo) {
      document.querySelectorAll(".logo, .premium-logo").forEach((image) => {
        image.src = logo;
        image.alt = brand;
      });
    }
  }

  function applyContact() {
    const digits = String(site.whatsappNumber || "").replace(/\D/g, "");
    if (!digits) return;
    const href = `https://wa.me/${digits}`;
    try { PHONE_WA = href; } catch {}
    document.querySelectorAll('a[href*="wa.me"]').forEach((anchor) => {
      anchor.href = href;
    });
    const display = site.phoneDisplay || digits;
    document.querySelectorAll("#elaqe strong").forEach((element) => {
      element.textContent = display;
    });
  }

  function applyHomepage() {
    const announcement = home.announcement || {};
    const bannerWrap = document.querySelector(".banner-wrap");
    if (bannerWrap) bannerWrap.hidden = announcement.enabled === false;
    text(".banner-text", announcement.text || UI?.bannerText);
    const searchTitle = document.querySelector(".sp-title");
    if (searchTitle && home.search?.title) {
      searchTitle.textContent = home.search.title;
      if (home.search.highlight) {
        searchTitle.append(" ");
        const highlight = document.createElement("span");
        highlight.className = "highlight";
        highlight.textContent = home.search.highlight;
        searchTitle.appendChild(highlight);
      }
    }
    text(".sp-desc", home.search?.description || UI?.searchDesc);
    const seoIntro = home.seoIntro || {};
    const seoIntroSection = document.getElementById("homeSeoIntro");
    if (seoIntroSection) seoIntroSection.hidden = seoIntro.enabled === false;
    text("#homeSeoIntroTitle", seoIntro.title);
    text("#homeSeoIntroText", seoIntro.text);
    const search = document.getElementById("q");
    if (search && home.search?.placeholder) search.placeholder = home.search.placeholder;
    const cards = home.infoCards || {};
    [
      ["haqqimizda", cards.about],
      ["elaqe", cards.contact],
      ["sertler", cards.terms]
    ].forEach(([id, card]) => {
      if (!card) return;
      text(`#${id} h2`, card.title);
      text(`#${id} > p:not(.siteInfoLinkText):not(.info-page-contact)`, card.text);
      text(`#${id} .siteInfoLinkText, #${id} .siteInfoWaBtn`, card.linkText);
    });

    const sections = home.sections || {};
    const visibility = {
      hero: "#hero-section",
      products: "#products-section",
      info: ".infoSections",
      games: "#gameBtnOpen"
    };
    Object.entries(visibility).forEach(([key, selector]) => {
      if (sections[key] === undefined) return;
      document.querySelectorAll(selector).forEach((element) => {
        element.hidden = sections[key] === false;
      });
    });
  }

  function applyNavigation() {
    const items = Array.isArray(source.navigation)
      ? source.navigation.filter((item) => item.enabled !== false && item.label && item.url)
        .sort((a, b) => Number(a.order) - Number(b.order))
      : [];
    if (!items.length) return;
    const desktop = document.querySelector(".desktopNav");
    if (desktop) {
      desktop.replaceChildren(...items.map((item) => {
        const link = document.createElement("a");
        link.className = "desktopNavLink";
        link.href = safeHref(item.url);
        link.textContent = item.label;
        if (item.newTab) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        return link;
      }));
    }
    const sideList = document.querySelector(".side-menu ul");
    if (sideList) {
      sideList.replaceChildren(...items.map((item) => {
        const row = document.createElement("li");
        const link = document.createElement("a");
        link.className = "sm-link";
        link.href = safeHref(item.url);
        link.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24">${iconSvg(item.icon)}</svg><span></span>`;
        link.querySelector("span").textContent = item.label;
        if (item.newTab) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        row.appendChild(link);
        return row;
      }));
    }
  }

  function activeBanners() {
    const legacyBanners = Array.isArray(source.banners) ? source.banners : [];
    const products = typeof DATA === "object" && Array.isArray(DATA.products) ? DATA.products : [];
    return products
      .filter((product) => product.active !== false)
      .map((product, index) => {
        const slug = productSlug(product);
        const legacy = legacyBanners.find((banner) => {
          const legacyId = String(banner.id || "").replaceAll("-", "_");
          const legacyUrl = String(banner.url || "").replace(/^https?:\/\/[^/]+/i, "");
          return legacyId === product.id || legacyUrl.includes(`/${slug}/`) || legacyUrl.includes(`/mehsul/${slug}`);
        }) || {};
        const configured = product.banner || {};
        const hasConfiguredBanner = Object.keys(configured).length > 0;
        const banner = hasConfiguredBanner ? configured : legacy;
        return {
          product,
          enabled: banner.enabled === true,
          desktopImage: safeImage(banner.desktopImage) || safeImage(product.image),
          mobileImage: safeImage(banner.mobileImage),
          title: banner.title || product.title || "",
          description: banner.description || product.desc || "",
          alt: banner.alt || product.imageAlt || `${product.title || "Məhsul"} banneri`,
          url: `/mehsul/${slug}`,
          order: hasConfiguredBanner && Number.isFinite(Number(banner.order))
            ? Number(banner.order)
            : Number(product.order) || index + 1
        };
      })
      .filter((banner) => banner.enabled && banner.desktopImage)
      .sort((a, b) => Number(a.order) - Number(b.order) || Number(a.product.order) - Number(b.product.order));
  }

  function applyBanners() {
    const banners = activeBanners();
    const slider = document.getElementById("heroSlider");
    if (!slider) return;
    slider.querySelectorAll(".slide, .slider-dots").forEach((element) => element.remove());
    slider.hidden = !banners.length;
    slider.parentElement?.classList.toggle("no-product-banners", !banners.length);
    slider.querySelectorAll(".slider-arrow").forEach((arrow) => {
      arrow.hidden = banners.length < 2;
    });
    if (!banners.length) return;
    const dots = document.createElement("div");
    dots.className = "slider-dots";
    banners.forEach((banner, index) => {
      const href = optionalHref(banner.url);
      const link = document.createElement(href ? "a" : "div");
      link.className = `slide${index === 0 ? " active" : ""}`;
      if (href) link.href = href;
      if (banner.title || banner.alt) link.setAttribute("aria-label", banner.alt || banner.title);
      const picture = document.createElement("picture");
      const desktopImage = safeImage(banner.desktopImage);
      const mobileImage = safeImage(banner.mobileImage);
      if (mobileImage) {
        const mobile = document.createElement("source");
        mobile.media = "(max-width: 760px)";
        mobile.srcset = mobileImage;
        picture.appendChild(mobile);
      }
      const image = document.createElement("img");
      image.src = desktopImage || safeImage(banner.product.image) || "assets/logo.png";
      image.alt = banner.alt || banner.title || "";
      image.className = "full-slide-img";
      image.loading = index === 0 ? "eager" : "lazy";
      image.decoding = "async";
      image.width = 1600;
      image.height = 670;
      if (index === 0) image.fetchPriority = "high";
      imageWithFallback(image, [banner.product.image, "assets/logo.png"]);
      picture.appendChild(image);
      link.appendChild(picture);
      slider.appendChild(link);
      if (banners.length > 1) {
        const dot = document.createElement("span");
        dot.className = `dot${index === 0 ? " active" : ""}`;
        dot.dataset.index = String(index);
        dots.appendChild(dot);
      }
    });
    if (banners.length > 1) slider.appendChild(dots);
    if (typeof window.initSlider === "function") window.initSlider();
  }

  function applySupportCard() {
    const host = document.getElementById("homeSupportCard");
    if (!host) return;
    const card = source.supportCard || {};
    const desktopImage = safeImage(card.desktopImage) || "assets/support.png";
    const mobileImage = safeImage(card.mobileImage);
    host.hidden = card.enabled === false;
    host.replaceChildren();
    if (card.enabled === false) return;

    const href = optionalHref(card.url);
    const container = document.createElement(href ? "a" : "div");
    container.className = "side-box support-box-img";
    if (href) container.href = href;
    if (card.alt || card.title) container.setAttribute("aria-label", card.alt || card.title);

    const picture = document.createElement("picture");
    if (mobileImage) {
      const mobile = document.createElement("source");
      mobile.media = "(max-width: 760px)";
      mobile.srcset = mobileImage;
      picture.appendChild(mobile);
    }
    const image = document.createElement("img");
    image.src = desktopImage;
    image.alt = card.alt || card.title || "Canlı Dəstək";
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 1600;
    image.height = 670;
    imageWithFallback(image, ["assets/support.png", "assets/logo.png"]);
    picture.appendChild(image);
    container.appendChild(picture);

    if (card.title || card.workHours) {
      const content = document.createElement("span");
      content.className = "support-card-content";
      if (card.title) {
        const title = document.createElement("strong");
        title.textContent = card.title;
        content.appendChild(title);
      }
      if (card.workHours) {
        const hours = document.createElement("span");
        hours.textContent = card.workHours;
        content.appendChild(hours);
      }
      container.appendChild(content);
    }
    host.appendChild(container);
  }

  function applyCommonTexts() {
    const mapping = {
      stokVar: common.available,
      stokOut: common.outOfStock,
      orderBtn: common.order,
      productAbout: common.productAbout,
      sendWa: common.sendWhatsapp,
      reqEmail: common.invalidEmail
    };
    if (typeof UI === "object") {
      Object.entries(mapping).forEach(([key, next]) => {
        if (next) UI[key] = next;
      });
    }
  }

  function applyFooter() {
    const footer = source.footer || {};
    const year = Number(footer.year) || new Date().getFullYear();
    const brand = footer.brandName || site.brandName || "Mirpanel";
    const rights = footer.copyrightText || UI?.footRights || "Bütün hüquqlar qorunur";
    const footerLines = document.querySelectorAll(".footer .tiny");
    if (footerLines[0]) {
      footerLines[0].removeAttribute("data-i18n");
      footerLines[0].textContent = `© ${year} ${brand} · ${rights}`;
    }
    if (footerLines[1]) {
      footerLines[1].removeAttribute("data-i18n");
      footerLines[1].textContent = `WhatsApp: ${site.phoneDisplay || footer.phone || site.whatsappNumber || footer.whatsapp || ""}`;
    }
    const footerElement = document.querySelector(".footer .wrap");
    const links = Array.isArray(footer.links)
      ? footer.links.filter((item) => item.enabled !== false && item.label && item.url)
        .sort((a, b) => Number(a.order) - Number(b.order))
      : [];
    if (footerElement && links.length) {
      let navigation = footerElement.querySelector(".cms-footer-links");
      if (!navigation) {
        navigation = document.createElement("nav");
        navigation.className = "cms-footer-links";
        footerElement.appendChild(navigation);
      }
      navigation.replaceChildren(...links.map((item) => {
        const link = document.createElement("a");
        link.href = safeHref(item.url);
        link.textContent = item.label;
        if (item.newTab) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        return link;
      }));
    }
  }

  function applySeo() {
    const seo = source.seo?.home || {};
    if (seo.title) document.title = seo.title;
    const setMeta = (selector, attribute, value) => {
      if (!value) return;
      const element = document.querySelector(selector);
      if (element) element.setAttribute(attribute, value);
    };
    setMeta('meta[name="description"]', "content", seo.description);
    setMeta('meta[name="robots"]', "content", seo.index === false ? "noindex, follow" : "index, follow");
    setMeta('meta[property="og:title"]', "content", seo.ogTitle || seo.title);
    setMeta('meta[property="og:description"]', "content", seo.ogDescription || seo.description);
    if (seo.ogImage) {
      const image = safeImage(seo.ogImage);
      const absolute = image.startsWith("http") ? image : new URL(image, location.origin).href;
      setMeta('meta[property="og:image"]', "content", absolute);
    }
  }

  applyBrand();
  applyContact();
  applyHomepage();
  applyNavigation();
  applyBanners();
  applySupportCard();
  applyCommonTexts();
  applyFooter();
  applySeo();
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      applyBrand();
      applyContact();
      applyHomepage();
      applyNavigation();
      applyBanners();
      applySupportCard();
      applyCommonTexts();
      applyFooter();
      applySeo();
    }, 0);
  });
})();
