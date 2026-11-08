(function () {
  "use strict";
  if(!document.querySelector('link[data-mobile-profile-style]')){
    const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/mobile-profile.css?v=1';sheet.media='(max-width: 767px)';sheet.dataset.mobileProfileStyle='';sheet.dataset.shellPersistent='';document.head.append(sheet);
  }
  if(!document.querySelector('script[data-customer-footer-loader]')){
    const footer=document.createElement('script');footer.src='/customer-footer.js?v=total-sales-20261108';footer.dataset.customerFooterLoader='true';document.head.append(footer);
  }
  // Only a successful email registration/recovery leaves this tab-local marker.
  try {
    const pending = JSON.parse(sessionStorage.getItem('mirpanel:signup-confirmation'));
    if (pending?.path === location.pathname) {
      import('/community-assets/auth-forms.js?v=verify-session-20261108')
        .then(module => module.resumeSignupConfirmation())
        .catch(() => {
          const notice = document.createElement('p');
          notice.setAttribute('role', 'alert');
          notice.textContent = 'Hesabınız yaradılıb, amma təsdiq pəncərəsi yüklənmədi. ';
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.textContent = 'Yenidən cəhd et';
          retry.onclick = () => location.reload();
          notice.append(retry);
          document.body.prepend(notice);
        });
    }
  } catch {}
  if(!document.querySelector('link[data-mobile-menu-style]')){const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/site-header-menu.css?v=dropdown-20261106';sheet.dataset.mobileMenuStyle='true';document.head.append(sheet);}
  if(!document.querySelector('script[data-decorations-loader]')){const s=document.createElement('script');s.src='/decorative-backgrounds.js?v=plain-header-20261103';s.dataset.decorationsLoader='true';document.head.append(s);}
  if(!document.querySelector('script[data-support-loader]')){const script=document.createElement('script');script.src='/support-widget.js?v=mobile-profile-1';script.dataset.supportLoader='true';document.head.append(script);}
  if(!document.querySelector('script[data-browser-nav-loader]')){const script=document.createElement('script');script.src='/browser-nav.js?v=order-guide-1';script.dataset.browserNavLoader='true';document.head.append(script);}

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("az").trim();
  }

  function applyListingSearch(query) {
    if (location.pathname !== "/mehsul") return;
    const value = normalize(query);
    document.querySelectorAll(".grid .card").forEach((card) => {
      card.hidden = Boolean(value) && !normalize(card.textContent).includes(value);
    });
  }

  function runSearch(form) {
    const input = form.querySelector('input[type="search"]');
    const query = String(input?.value || "").trim();
    if (!query) return;
    if (location.pathname === "/") {
      const homeSearch = document.getElementById("q");
      if (homeSearch) {
        homeSearch.value = query;
        homeSearch.dispatchEvent(new Event("input", { bubbles: true }));
        document.getElementById("products-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    if (location.pathname === "/mehsul") {
      applyListingSearch(query);
      if(window.MirpanelNavigation)window.MirpanelNavigation.replaceURL(`/mehsul?search=${encodeURIComponent(query)}`);else history.replaceState(null, "", `/mehsul?search=${encodeURIComponent(query)}`);
      return;
    }
    if(window.MirpanelNavigation)void window.MirpanelNavigation.go(`/mehsul?search=${encodeURIComponent(query)}`);else location.assign(`/mehsul?search=${encodeURIComponent(query)}`);
  }

  function initHeader(header) {
    if(header.dataset.headerMounted)return;header.dataset.headerMounted='true';
    const menuButton = header.querySelector(".site-header-menu-button");
    const closeButton = header.querySelector(".site-header-menu-close");
    const overlay = header.querySelector(".site-header-overlay");
    const drawer = header.querySelector(".site-header-drawer");
    if(!menuButton||!drawer)return;
    drawer.id||='mirpanelMobileMenu';drawer.inert=true;
    menuButton.setAttribute('aria-controls',drawer.id);
    menuButton.setAttribute('aria-haspopup','true');
    const menuPath=menuButton.querySelector('svg path'),bars='M4 7h16M4 12h16M4 17h16',up='m6 15 6-6 6 6';
    let lastFocused = null;
    const mobile=matchMedia('(max-width:999px)');
    function positionMenu(){
      const h=header.getBoundingClientRect(),b=menuButton.getBoundingClientRect(),top=Math.max(b.bottom,h.bottom)+7;
      header.style.setProperty('--menu-left',Math.max(8,b.left-h.left)+'px');
      header.style.setProperty('--menu-top',(top-h.top)+'px');
      const nav=document.querySelector('.browser-bottom-nav'),bottom=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().height:0;
      header.style.setProperty('--menu-space',Math.max(100,innerHeight-top-bottom-12)+'px');
      header.style.setProperty('--menu-header-height',h.height+'px');
    }

    function focusable() {
      return [menuButton,...drawer.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')].filter(n=>n.getClientRects().length);
    }

    function openMenu() {
      if(!mobile.matches)return;
      positionMenu();drawer.inert=false;
      lastFocused = document.activeElement;
      header.classList.add("is-menu-open");
      document.body.classList.add("site-header-menu-open");
      menuButton?.setAttribute("aria-expanded", "true");
      menuButton.setAttribute('aria-label','Menyunu bağla');menuPath?.setAttribute('d',up);
      drawer?.setAttribute("aria-hidden", "false");
      overlay?.setAttribute("aria-hidden", "false");
      closeButton?.focus();
    }

    function closeMenu(restoreFocus = true) {
      header.classList.remove("is-menu-open");
      drawer.inert=true;
      document.body.classList.remove("site-header-menu-open");
      menuButton?.setAttribute("aria-expanded", "false");
      menuButton.setAttribute('aria-label','Menyunu aç');menuPath?.setAttribute('d',bars);
      drawer?.setAttribute("aria-hidden", "true");
      overlay?.setAttribute("aria-hidden", "true");
      if (restoreFocus && lastFocused instanceof HTMLElement) lastFocused.focus();
    }

    menuButton?.addEventListener("click", ()=>header.classList.contains('is-menu-open')?closeMenu():openMenu());
    closeButton?.addEventListener("click", () => closeMenu());
    overlay?.addEventListener("click", () => closeMenu());
    window.addEventListener('mirpanel:route-leave',()=>closeMenu(false));
    drawer.addEventListener('click',e=>{if(e.target.closest('a[href]'))closeMenu(false);});
    document.addEventListener('pointerdown',e=>{if(header.classList.contains('is-menu-open')&&!drawer.contains(e.target)&&!menuButton.contains(e.target))closeMenu();});
    window.addEventListener('resize',()=>{if(!mobile.matches)closeMenu(false);else if(header.classList.contains('is-menu-open'))positionMenu();});
    window.visualViewport?.addEventListener('resize',()=>{if(header.classList.contains('is-menu-open'))positionMenu();});

    header.querySelectorAll("[data-site-header-search]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        runSearch(form);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (!header.classList.contains("is-menu-open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  document.querySelectorAll(".site-header").forEach((header) => {
    header.querySelectorAll('.site-header-nav a[href="/netflix_tesdiq"], .site-header-drawer-nav a[href="/netflix_tesdiq"]').forEach((link) => link.remove());
    initHeader(header);
  });

  const query = new URLSearchParams(location.search).get("search") || "";
  if (query) {
    document.querySelectorAll('[data-site-header-search] input[type="search"]').forEach((input) => { input.value = query; });
    applyListingSearch(query);
  }
})();
