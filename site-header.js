(function () {
  "use strict";
  if(!window.MirpanelPricing&&!document.querySelector('script[data-customer-pricing]')){const script=document.createElement('script');script.src='/customer-pricing.js?v=seller-1';script.dataset.customerPricing='';script.dataset.shellPersistent='';document.head.append(script);}

  if(!document.querySelector('link[data-mobile-profile-style]')){
    const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/mobile-profile.css?v=2';sheet.media='(max-width: 767px)';sheet.dataset.mobileProfileStyle='';sheet.dataset.shellPersistent='';document.head.append(sheet);
  }
  if(!document.querySelector('script[data-customer-footer-loader]')){
    const footer=document.createElement('script');footer.src='/customer-footer.js?v=total-sales-20261108';footer.dataset.customerFooterLoader='true';document.head.append(footer);
  }
  // Only a successful email registration/recovery leaves this tab-local marker.
  try {
    const pending = JSON.parse(sessionStorage.getItem('mirpanel:signup-confirmation'));
    if (pending?.path === location.pathname) {
      import('/community-assets/auth-forms.js?v=az-addresses-1')
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
  if(!document.querySelector('script[data-support-loader]')){const script=document.createElement('script');script.src='/support-widget.js?v=chat-panel-20261114';script.dataset.supportLoader='true';document.head.append(script);}
  if(!document.querySelector('script[data-browser-nav-loader]')){const script=document.createElement('script');script.src='/browser-nav.js?v=seven-chat-panel-1';script.dataset.browserNavLoader='true';document.head.append(script);}

  function normalize(value) {
    return String(value || "").toLocaleLowerCase("az").trim();
  }

  const searchIcon = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
  function emptySearch(grid, clear) {
    const state=document.createElement('div');state.className='catalog-search-state';state.setAttribute('role','status');
    state.innerHTML=searchIcon+'<h2>Məhsul tapılmadı</h2><p>Başqa adla axtarın və ya axtarışı təmizləyin.</p>';
    const button=document.createElement('button');button.type='button';button.textContent='Axtarışı təmizlə';button.onclick=clear;state.append(button);grid.append(state);
  }
  function clearSearch(){
    document.querySelectorAll('[data-site-header-search] input[type="search"],#q').forEach(input=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));});
    if(location.pathname==='/')document.querySelector('[data-home-filter=all]')?.click();
    if(location.pathname==='/mehsul'){
      if(window.MirpanelNavigation)window.MirpanelNavigation.replaceURL('/mehsul');else history.replaceState(null,'','/mehsul');
      applyListingSearch('');
    }
  }
  function applyListingSearch(query) {
    if (location.pathname !== "/mehsul") return;
    const grid=document.querySelector('.catalog-grid');if(!grid)return;
    const value = normalize(query);grid.querySelector('.catalog-search-state')?.remove();
    let count=0;
    grid.querySelectorAll('.card').forEach(card=>{
      card.hidden=Boolean(value)&&!normalize(card.textContent).includes(value);if(!card.hidden)count++;
    });
    grid.removeAttribute('aria-busy');
    if(!count)emptySearch(grid,clearSearch);
  }
  window.MirpanelCatalogSearch={apply:applyListingSearch,empty:grid=>emptySearch(grid,clearSearch)};
  const searchStyle=document.createElement('style');searchStyle.dataset.shellPersistent='';searchStyle.textContent=`
    .catalog-grid,#grid{min-height:clamp(430px,65svh,740px);align-content:start}
    .catalog-grid .card[hidden]{display:none!important}
    .catalog-search-state{grid-column:1/-1;align-self:stretch;min-height:clamp(430px,65svh,740px);box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:32px 16px;text-align:center;color:#d2d6dc;font:15px/1.5 system-ui,sans-serif}
    .catalog-search-state h2{margin:0;font-size:21px;color:#f0f2f5}.catalog-search-state p{margin:0;color:#b8bdc5}
    .catalog-search-state button{min-height:44px;padding:10px 18px;margin-top:6px;border:1px solid #a58a1f;border-radius:12px;background:#ffd400;color:#111;font-weight:700;cursor:pointer}
    .site-route-loading[data-route="/mehsul"]{max-width:1200px;min-height:clamp(520px,75svh,850px)}
    .catalog-search-wheel{width:25px;height:25px;border:2px solid #ffffff30;border-top-color:#ffd400;border-radius:50%;animation:catalog-search-spin .8s linear infinite}
    @keyframes catalog-search-spin{to{transform:rotate(1turn)}}
    @media(prefers-reduced-motion:reduce){.catalog-search-wheel{animation:none}}
  `;document.head.append(searchStyle);
  function restoreSearch(){
    if(location.pathname!=='/mehsul')return;
    const query=new URLSearchParams(location.search).get('search')||'';
    document.querySelectorAll('[data-site-header-search] input[type="search"]').forEach(input=>{input.value=query;});applyListingSearch(query);
  }
  window.addEventListener('mirpanel:route-ready',restoreSearch);
  window.addEventListener('pageshow',restoreSearch);

  function runSearch(form) {
    const input = form.querySelector('input[type="search"]');
    const query = String(input?.value || "").trim();
    if (!query && location.pathname !== "/mehsul") return;
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
      form.addEventListener('input',()=>{
        if(location.pathname!=='/mehsul')return;
        const value=form.querySelector('input[type="search"]').value;
        document.querySelectorAll('[data-site-header-search] input[type="search"]').forEach(input=>{input.value=value;});
        const url='/mehsul'+(value?'?search='+encodeURIComponent(value):'');
        if(window.MirpanelNavigation)window.MirpanelNavigation.replaceURL(url);else history.replaceState(null,'',url);
        applyListingSearch(value);
      });
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
