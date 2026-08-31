(function () {
  "use strict";

  const LANGUAGE_KEY = "mirpanel_language";
  const CURRENCY_KEY = "mirpanel_currency";
  const HEADER_TEXT = {
    az: { home: "Ana səhifə", products: "Məhsullar", about: "Haqqımızda", terms: "Şərtlər", contact: "Əlaqə", netflixVerification: "Netflix Təsdiqi", search: "Məhsul axtar..." },
    en: { home: "Home", products: "Products", about: "About", terms: "Terms", contact: "Contact", netflixVerification: "Netflix Confirmation", search: "Search products..." },
    ru: { home: "Главная", products: "Товары", about: "О нас", terms: "Условия", contact: "Контакты", netflixVerification: "Подтверждение Netflix", search: "Поиск товаров..." }
  };

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

  function applyHeaderLanguage(header, language) {
    const texts = HEADER_TEXT[language] || HEADER_TEXT.az;
    header.querySelectorAll("[data-header-key]").forEach((link) => {
      const text = link.querySelector("span");
      if (text && texts[link.dataset.headerKey]) text.textContent = texts[link.dataset.headerKey];
    });
    header.querySelectorAll('[data-site-header-search] input[type="search"]').forEach((input) => {
      input.placeholder = texts.search;
      input.setAttribute("aria-label", texts.search);
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

    header.querySelectorAll(".langBtn[data-lang]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextLanguage = button.dataset.lang || "az";
        localStorage.setItem(LANGUAGE_KEY, nextLanguage);
        header.querySelectorAll(".langBtn[data-lang]").forEach((item) => item.classList.toggle("active", item === button));
        applyHeaderLanguage(header, nextLanguage);
      });
    });
    const language = localStorage.getItem(LANGUAGE_KEY) || "az";
    header.querySelectorAll(".langBtn[data-lang]").forEach((button) => button.classList.toggle("active", button.dataset.lang === language));
    applyHeaderLanguage(header, language);

    const currency = header.querySelector("[data-site-header-currency]");
    if (currency) {
      currency.value = localStorage.getItem(CURRENCY_KEY) || "AZN";
      currency.addEventListener("change", () => localStorage.setItem(CURRENCY_KEY, currency.value));
    }

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
