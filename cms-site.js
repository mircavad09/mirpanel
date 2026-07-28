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
    const search = document.getElementById("q");
    if (search && home.search?.placeholder) search.placeholder = home.search.placeholder;

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
    const now = Date.now();
    return (Array.isArray(source.banners) ? source.banners : [])
      .filter((banner) => {
        if (banner.enabled === false || !safeImage(banner.desktopImage)) return false;
        const start = banner.startAt ? Date.parse(banner.startAt) : 0;
        const end = banner.endAt ? Date.parse(banner.endAt) : 0;
        return (!start || start <= now) && (!end || end >= now);
      })
      .sort((a, b) => Number(a.order) - Number(b.order));
  }

  function applyBanners() {
    const banners = activeBanners();
    if (!banners.length) return;
    const slider = document.getElementById("heroSlider");
    if (!slider) return;
    slider.querySelectorAll(".slide, .slider-dots").forEach((element) => element.remove());
    const dots = document.createElement("div");
    dots.className = "slider-dots";
    banners.forEach((banner, index) => {
      const link = document.createElement(banner.url ? "a" : "div");
      link.className = `slide${index === 0 ? " active" : ""}`;
      if (banner.url) link.href = safeHref(banner.url);
      const picture = document.createElement("picture");
      if (banner.mobileImage) {
        const mobile = document.createElement("source");
        mobile.media = "(max-width: 760px)";
        mobile.srcset = safeImage(banner.mobileImage);
        picture.appendChild(mobile);
      }
      const image = document.createElement("img");
      image.src = safeImage(banner.desktopImage);
      image.alt = banner.alt || banner.title || "";
      image.className = "full-slide-img";
      picture.appendChild(image);
      link.appendChild(picture);
      slider.insertBefore(link, dots);
      const dot = document.createElement("span");
      dot.className = `dot${index === 0 ? " active" : ""}`;
      dot.dataset.index = String(index);
      dots.appendChild(dot);
    });
    slider.appendChild(dots);
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
  applyCommonTexts();
  applyFooter();
  applySeo();
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      applyBrand();
      applyContact();
      applyHomepage();
      applyNavigation();
      applyCommonTexts();
      applyFooter();
      applySeo();
    }, 0);
  });
})();
