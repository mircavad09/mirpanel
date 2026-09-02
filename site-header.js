(function () {
  "use strict";

  function addNetflixVerificationLink(header) {
    header.querySelectorAll(".site-header-nav, .site-header-drawer-nav").forEach((nav) => {
      if (nav.querySelector('a[href="/netflix_tesdiq"]')) return;
      const link = document.createElement("a");
      link.href = "/netflix_tesdiq";
      link.dataset.headerKey = "netflixVerification";
      if (location.pathname.replace(/\/+$/, "") === "/netflix_tesdiq") link.setAttribute("aria-current", "page");
      link.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 4.5 6v5c0 4.7 3.1 8.6 7.5 10 4.4-1.4 7.5-5.3 7.5-10V6L12 3Z"/><path d="m8.8 12 2.1 2.1 4.4-4.5"/></svg><span>Netflix Təsdiqi</span>';
      nav.append(link);
    });
  }

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
      history.replaceState(null, "", `/mehsul?search=${encodeURIComponent(query)}`);
      return;
    }
    location.assign(`/mehsul?search=${encodeURIComponent(query)}`);
  }

  function initHeader(header) {
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
    addNetflixVerificationLink(header);
    initHeader(header);
  });

  const query = new URLSearchParams(location.search).get("search") || "";
  if (query) {
    document.querySelectorAll('[data-site-header-search] input[type="search"]').forEach((input) => { input.value = query; });
    applyListingSearch(query);
  }
})();
