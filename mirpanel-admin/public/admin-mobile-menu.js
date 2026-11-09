document.addEventListener("DOMContentLoaded", () => {
  const mobile = matchMedia("(max-width: 760px)");
  const sidebar = document.getElementById("adminSidebar");
  const nav = sidebar.querySelector(".nav");
  const toggle = document.querySelector(".mobileMenuToggle");
  const close = sidebar.querySelector(".mobileMenuClose");
  const header = toggle.closest("header");
  const sidebarPosition = document.createComment("Desktop sidebar position");
  sidebar.before(sidebarPosition);

  const quickLinks = ["dashboard", "products", "communityUsers", "paymentOrders", "communityGroup"];
  const groups = [
    ["Balans və mühasibatlıq", ["communityShop", "paymentCosts", "paymentMethods", "paymentReviews"]],
    ["Məhsul idarəetməsi", ["readyStock", "categories", "orders", "netflixAccounts"]],
    ["Sayt məzmunu", ["homepage", "navigation", "banners", "stories", "decorations", "media", "about", "contact", "terms", "seo"]],
    ["Sistem", ["history", "/admin/workforce"]]
  ];
  const key = link => link.dataset.view || link.getAttribute("href");
  const links = [...nav.querySelectorAll(".navBtn")];
  const stock = links.find(link => key(link) === "/admin/employee-stock");
  const mobileLinks = document.createElement("div");
  mobileLinks.className = "mobileMenuLinks";
  const positions = new Map();
  let open = false;

  function setOpen(next) {
    open = next;
    sidebar.classList.toggle("mobileMenuOpen", open);
    toggle.setAttribute("aria-expanded", String(open));
    mobileLinks.querySelectorAll("details").forEach(group => { group.open = false; });
  }

  function moveLink(link, target) {
    // Keep the live button, including its listeners and updated count badge.
    const position = document.createComment("Desktop link position");
    link.before(position);
    positions.set(link, position);
    target.append(link);
  }

  function applyLayout() {
    setOpen(false);
    if (!mobile.matches) {
      for (const [link, position] of positions) position.replaceWith(link);
      positions.clear();
      mobileLinks.replaceChildren();
      mobileLinks.remove();
      sidebarPosition.after(sidebar);
      return;
    }

    header.after(sidebar);
    nav.append(mobileLinks);
    for (const id of quickLinks) {
      const link = links.find(item => key(item) === id);
      if (link) moveLink(link, mobileLinks);
    }
    for (const [label, ids] of groups) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = label;
      details.append(summary);
      const groupLinks = ids.map(id => links.find(item => key(item) === id)).filter(Boolean);
      if (label === "Sistem") {
        groupLinks.push(...links.filter(link => !positions.has(link) && !groupLinks.includes(link) && link !== stock));
      }
      for (const link of groupLinks) moveLink(link, details);
      if (groupLinks.length) mobileLinks.append(details);
    }
    if (stock) moveLink(stock, mobileLinks);
  }

  function closeMenu() {
    setOpen(false);
    toggle.focus();
    window.scrollTo(0, 0);
  }

  toggle.addEventListener("click", () => {
    if (open) closeMenu();
    else {
      setOpen(true);
      close.focus();
    }
  });
  close.addEventListener("click", closeMenu);
  nav.addEventListener("click", event => {
    if (open && event.target.closest(".navBtn")) closeMenu();
  });
  document.addEventListener("keydown", event => {
    if (open && event.key === "Escape") closeMenu();
  });
  mobile.addEventListener("change", applyLayout);
  applyLayout();
});
