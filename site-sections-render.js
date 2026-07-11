(function () {
  const DEFAULT_SECTIONS = {
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

  function sectionData() {
    try {
      if (typeof SITE_SECTIONS !== "undefined" && SITE_SECTIONS && typeof SITE_SECTIONS === "object") {
        return SITE_SECTIONS;
      }
    } catch (error) {
      // Fall back to the bundled public defaults below.
    }
    return DEFAULT_SECTIONS;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function whatsappHref(number) {
    const digits = String(number || "").replace(/\D/g, "");
    if (!digits) return "https://wa.me/994515243545";
    return `https://wa.me/${digits.startsWith("0") ? `994${digits.slice(1)}` : digits}`;
  }

  function normalizedSections() {
    const source = sectionData();
    return Object.entries(DEFAULT_SECTIONS).map(([key, fallback]) => {
      const item = source[key] || {};
      return [key, {
        ...fallback,
        ...item,
        enabled: item.enabled ?? fallback.enabled,
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : fallback.order,
        items: Array.isArray(item.items) ? item.items : fallback.items
      }];
    });
  }

  function renderSiteSectionsFromAdmin() {
    const container = document.getElementById("siteInfoSections") || document.querySelector(".infoSections");
    if (!container) return;

    const visible = normalizedSections()
      .filter(([, section]) => section.enabled !== false)
      .sort((a, b) => (Number(a[1].order) || 0) - (Number(b[1].order) || 0));

    container.innerHTML = visible.map(([key, section]) => {
      const title = escapeHtml(section.title || "");
      const text = escapeHtml(section.text || "").replace(/\n/g, "<br>");

      if (key === "sertler") {
        const list = (section.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
        return `<article class="siteInfoCard" id="sertler"><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${list ? `<ul>${list}</ul>` : ""}</article>`;
      }

      if (key === "elaqe") {
        const number = escapeHtml(section.whatsappNumber || "");
        const buttonText = escapeHtml(section.buttonText || "WhatsApp ilə yaz");
        return `<article class="siteInfoCard siteInfoContact" id="elaqe"><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}<p>WhatsApp: <strong>${number}</strong></p><a class="siteInfoWaBtn" href="${whatsappHref(section.whatsappNumber)}" target="_blank" rel="noopener noreferrer">${buttonText}</a></article>`;
      }

      const linkText = escapeHtml(section.linkText || "");
      return `<article class="siteInfoCard" id="haqqimizda"><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${linkText ? `<p class="siteInfoLinkText">${linkText}</p>` : ""}</article>`;
    }).join("");

    ["haqqimizda", "sertler", "elaqe"].forEach((id) => {
      const isVisible = visible.some(([key]) => key === id);
      document.querySelectorAll(`[data-section-nav="${id}"]`).forEach((link) => {
        link.style.display = isVisible ? "" : "none";
      });
    });
  }

  window.renderSiteSectionsFromAdmin = renderSiteSectionsFromAdmin;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSiteSectionsFromAdmin);
  } else {
    renderSiteSectionsFromAdmin();
  }
})();
