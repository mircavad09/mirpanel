(function () {
  "use strict";

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
    if (!query && location.pathname !== '/') return;
    if (location.pathname === "/") {
      const homeSearch = document.getElementById("q");
      if (homeSearch) {
        homeSearch.value = query;
        homeSearch.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
    }
    if (location.pathname === "/mehsul") {
      applyListingSearch(query);
      history.replaceState(null, "", `/mehsul?search=${encodeURIComponent(query)}`);
      return;
    }
    location.assign(`/mehsul?search=${encodeURIComponent(query)}`);
  }

  function initHeader(header) {
    if(header.dataset.headerBound) return;
    header.dataset.headerBound='true';
    const menuButton = header.querySelector(".site-header-menu-button");
    const closeButton = header.querySelector(".site-header-menu-close");
    const overlay = header.querySelector(".site-header-overlay");
    const drawer = header.querySelector(".site-header-drawer");
    let lastFocused = null;

    function focusable() {
      return [...drawer.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')];
    }

    function openMenu() {
      lastFocused = document.activeElement;
      header.classList.add("is-menu-open");
      document.body.classList.add("site-header-menu-open");
      menuButton?.setAttribute("aria-expanded", "true");
      drawer?.setAttribute("aria-hidden", "false");
      overlay?.setAttribute("aria-hidden", "false");
      closeButton?.focus();
    }

    function closeMenu(restoreFocus = true) {
      header.classList.remove("is-menu-open");
      document.body.classList.remove("site-header-menu-open");
      menuButton?.setAttribute("aria-expanded", "false");
      drawer?.setAttribute("aria-hidden", "true");
      overlay?.setAttribute("aria-hidden", "true");
      if (restoreFocus && lastFocused instanceof HTMLElement) lastFocused.focus();
    }

    menuButton?.addEventListener("click", openMenu);
    closeButton?.addEventListener("click", () => closeMenu());
    overlay?.addEventListener("click", () => closeMenu());
    drawer?.querySelectorAll("a[href]").forEach((link) => link.addEventListener("click", () => closeMenu(false)));

    header.querySelectorAll("[data-site-header-search]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        runSearch(form);
        if(drawer?.contains(form) && document.body.classList.contains('home-page')) closeMenu(false);
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
