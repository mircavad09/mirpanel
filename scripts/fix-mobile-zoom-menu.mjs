import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) {
    if (source.includes(replacement)) return source;
    throw new Error(`${label} not found`);
  }
  return source.replace(search, replacement);
}

function insertBefore(source, marker, insert, label) {
  if (source.includes(insert.trim())) return source;
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`${label} marker not found`);
  return source.slice(0, index) + insert + source.slice(index);
}

let index = fs.readFileSync('index.html', 'utf8');

index = replaceOnce(
  index,
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />',
  'viewport'
);

index = replaceOnce(
  index,
  '        <a href="#about" class="desktopNavLink" data-i18n="about">Haqqımızda</a>\n        <a href="#terms" class="desktopNavLink" data-i18n="terms">Şərtlər</a>\n        <a href="#contact" class="desktopNavLink" data-i18n="contact">Əlaqə</a>',
  '        <a href="#haqqimizda" class="desktopNavLink" data-section-nav="haqqimizda" data-i18n="about">Haqqımızda</a>\n        <a href="#sertler" class="desktopNavLink" data-section-nav="sertler" data-i18n="terms">Şərtlər</a>\n        <a href="#elaqe" class="desktopNavLink" data-section-nav="elaqe" data-i18n="contact">Əlaqə</a>',
  'desktop section nav'
);

index = replaceOnce(
  index,
  '      <li><a href="#" class="sm-link" data-i18n="about">Haqqımızda</a></li>\n      <li><a href="#" class="sm-link" data-i18n="terms">Şərtlər</a></li>\n      <li><a href="#" class="sm-link" data-i18n="contact">Əlaqə</a></li>',
  '      <li><a href="#haqqimizda" class="sm-link" data-section-nav="haqqimizda" data-i18n="about">Haqqımızda</a></li>\n      <li><a href="#sertler" class="sm-link" data-section-nav="sertler" data-i18n="terms">Şərtlər</a></li>\n      <li><a href="#elaqe" class="sm-link" data-section-nav="elaqe" data-i18n="contact">Əlaqə</a></li>',
  'mobile section nav'
);

index = insertBefore(
  index,
  '\n\n  </div>\n\n  <div id="productPageView"',
  `\n\n    <section class="wrap infoSections" aria-label="Mirpanel məlumat bölmələri">\n      <article class="siteInfoCard" id="haqqimizda">\n        <h2 data-i18n="about">Haqqımızda</h2>\n        <p>Mirpanel premium hesabların sürətli və etibarlı aktivləşdirilməsi üçün xidmət göstərir. Məhsullar WhatsApp üzərindən rahat sifariş olunur və dəstək komandası müştərilərə kömək edir.</p>\n      </article>\n\n      <article class="siteInfoCard" id="sertler">\n        <h2 data-i18n="terms">Şərtlər</h2>\n        <ul>\n          <li>Sifarişdən əvvəl məhsul məlumatlarını diqqətlə oxuyun.</li>\n          <li>Rəqəmsal məhsullarda aktivləşdirmə qaydası məhsula görə dəyişə bilər.</li>\n          <li>Yanlış daxil edilən məlumatlara görə gecikmə yarana bilər.</li>\n          <li>Dəstək WhatsApp üzərindən göstərilir.</li>\n        </ul>\n      </article>\n\n      <article class="siteInfoCard siteInfoContact" id="elaqe">\n        <h2 data-i18n="contact">Əlaqə</h2>\n        <p>WhatsApp: <strong>051 524 35 45</strong></p>\n        <a class="siteInfoWaBtn" href="https://wa.me/994515243545" target="_blank" rel="noopener noreferrer">WhatsApp ilə yaz</a>\n      </article>\n    </section>`,
  'info sections'
);

index = insertBefore(
  index,
  '      // Linklərə kliklədikdə də menyu bağlansın',
  `      function installZoomLock() {\n        document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });\n        document.addEventListener("gesturechange", (event) => event.preventDefault(), { passive: false });\n        document.addEventListener("touchmove", (event) => {\n          if (event.touches && event.touches.length > 1) event.preventDefault();\n        }, { passive: false });\n\n        let lastTouchEnd = 0;\n        document.addEventListener("touchend", (event) => {\n          const now = Date.now();\n          if (now - lastTouchEnd <= 300) event.preventDefault();\n          lastTouchEnd = now;\n        }, { passive: false });\n      }\n\n      installZoomLock();\n\n`,
  'zoom lock'
);

index = insertBefore(
  index,
  '    });\n  </script>',
  `      function showHomeForSection(sectionId) {\n        const section = document.getElementById(sectionId);\n        if (!section) return;\n\n        if(productView) productView.style.display = "none";\n        if(homePageView) homePageView.style.display = "block";\n        if(heroSection) heroSection.style.display = "block";\n        if(mainHeader) mainHeader.style.display = "block";\n\n        history.replaceState("", document.title, \\/#\${sectionId}\`);\n        setTimeout(() => {\n          section.scrollIntoView({ behavior: "smooth", block: "start" });\n        }, 60);\n      }\n\n      document.querySelectorAll("[data-section-nav]").forEach((link) => {\n        link.addEventListener("click", (e) => {\n          e.preventDefault();\n          closeMenu();\n          showHomeForSection(link.getAttribute("data-section-nav"));\n        });\n      });\n\n      const initialSection = window.location.hash.replace("#", "");\n      if (["haqqimizda", "sertler", "elaqe"].includes(initialSection)) {\n        setTimeout(() => showHomeForSection(initialSection), 120);\n      }\n\n`,
  'section nav handler'
).replace('history.replaceState("", document.title, \\/#${sectionId}`);', 'history.replaceState("", document.title, `/#${sectionId}`);');

fs.writeFileSync('index.html', index, 'utf8');

let css = fs.readFileSync('style.css', 'utf8');
css = insertBefore(css, '\n\nbody{', `\nhtml{\n  touch-action: manipulation;\n  -webkit-text-size-adjust: 100%;\n  text-size-adjust: 100%;\n}`, 'html zoom css');
css = insertBefore(css, '\n\nhtml.modalOpen', `\n\ninput,\ntextarea,\nselect,\nbutton {\n  font: inherit;\n}`, 'font inherit css');
css = insertBefore(css, '\n\n.support-box-img', `\n\n.infoSections{\n  display:grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap:14px;\n  margin-top:18px;\n  margin-bottom:110px;\n}\n\n.siteInfoCard{\n  scroll-margin-top:96px;\n  border:1px solid rgba(255,212,0,.14);\n  border-radius:20px;\n  background:\n    radial-gradient(260px 110px at 100% 0%, rgba(255,212,0,.08), transparent 62%),\n    rgba(255,255,255,.035);\n  box-shadow:0 14px 32px rgba(0,0,0,.22), inset 0 0 0 1px rgba(255,255,255,.025);\n  padding:20px;\n}\n\n.siteInfoCard h2{\n  margin:0 0 10px;\n  color:#ffd400;\n  font-size:18px;\n  line-height:1.2;\n}\n\n.siteInfoCard p,\n.siteInfoCard li{\n  color:rgba(255,255,255,.76);\n  font-size:14px;\n  line-height:1.65;\n}\n\n.siteInfoCard p{margin:0}\n.siteInfoCard ul{margin:0;padding-left:18px}\n\n.siteInfoWaBtn{\n  display:inline-flex;\n  align-items:center;\n  justify-content:center;\n  margin-top:14px;\n  padding:11px 16px;\n  border-radius:14px;\n  border:1px solid rgba(255,212,0,.35);\n  background:linear-gradient(135deg, #ffd400, #caa300);\n  color:#070707;\n  font-weight:800;\n  box-shadow:0 10px 22px rgba(255,212,0,.14);\n}`, 'info section css');
css = css.replace('@media(max-width:640px){\n  .grid', '@media(max-width:640px){\n  input,\n  textarea,\n  select,\n  .headActions input[type="text"],\n  .side-menu-search input,\n  .side-search,\n  .mpInput,\n  .glass-sort-select,\n  .premiumOrderForm input,\n  .premiumOrderForm textarea,\n  .spotifyLoginOrderForm input,\n  .netflixOrderForm input,\n  .hboMaxOrderForm input,\n  .primeVideoOrderForm input {\n    font-size: 16px !important;\n  }\n\n  .grid');
css = css.replace('  .side-search { padding: 8px; font-size: 12px; border-radius: 10px; }', '  .side-search { padding: 8px; border-radius: 10px; }');
css = insertBefore(css, '\n}\n\n.premium-splash', `\n\n  .infoSections{\n    grid-template-columns:1fr;\n    gap:10px;\n    margin-top:12px;\n    margin-bottom:96px;\n  }\n\n  .siteInfoCard{\n    scroll-margin-top:78px;\n    border-radius:16px;\n    padding:16px;\n  }\n\n  .siteInfoCard h2{\n    font-size:16px;\n  }\n\n  .siteInfoCard p,\n  .siteInfoCard li{\n    font-size:13px;\n    line-height:1.58;\n  }`, 'mobile info section css');
fs.writeFileSync('style.css', css, 'utf8');

console.log('Mobile zoom and menu section fixes applied.');
