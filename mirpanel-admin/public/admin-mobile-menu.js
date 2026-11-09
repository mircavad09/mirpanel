const menuIconPaths = {
  dashboard: "M9.5 3h5l.6 2.6 2 .9 2.3-1.2 2.3 4-2 1.7v2l2 1.7-2.3 4-2.3-1.2-2 .9-.6 2.6h-5l-.6-2.6-2-.9-2.3 1.2-2.3-4 2-1.7v-2l-2-1.7 2.3-4 2.3 1.2 2-.9z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  products: "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10",
  communityUsers: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2 M16 5a3 3 0 0 1 0 6 M18 14a4 4 0 0 1 3 4v2",
  communityGroup: "M3 4h13v9H8l-5 4z M19 8h2v10h-3v3l-4-3h-4v-2",
  employeeStock: "M9 4V2h6v2 M5 4h14v17H5z M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M8 17a4 4 0 0 1 8 0",
  paymentOrders: "M8 4H5v17h14V4h-3 M8 3h8v4H8z M9 11h6 M9 15h6 M9 18h4",
  readyStock: "M8 3h8v7H8z M3 12h8v8H3z M13 12h8v8h-8z M12 3v3 M7 12v3 M17 12v3",
  communityShop: "M20 8V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7 M21 12h-5a2 2 0 0 0 0 4h5 M16 14h.1",
  paymentCosts: "M3 4v16h18 M7 16v-3 M12 16V9 M17 16V5",
  paymentMethods: "M3 5h18v14H3z M3 10h18 M7 15h3",
  categories: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  orderGuide: "M12 6c-3-2-6-3-10-2v14c4-1 7 0 10 2 3-2 6-3 10-2V4c-4-1-7 0-10 2z M12 6v14",
  apiIntegrations: "M9 3v5 M15 3v5 M7 8h10v3a5 5 0 0 1-10 0z M12 16v5 M12 21h6",
  gameProducts: "M7 7h10a4 4 0 0 1 4 3l1 7a2 2 0 0 1-3 2l-4-3H9l-4 3a2 2 0 0 1-3-2l1-7a4 4 0 0 1 4-3z M7 10v4 M5 12h4 M16 11h.1 M18 13h.1",
  orders: "M5 6h14 M5 12h14 M5 18h14 M9 4v4 M15 10v4 M10 16v4",
  netflixAccounts: "M3 5h18v14H3z M10 9l5 3-5 3z",
  homepage: "M3 11l9-8 9 8 M5 9v12h14V9 M10 21v-7h4v7",
  navigation: "M10 8l3-3a4 4 0 0 1 6 6l-3 3 M14 16l-3 3a4 4 0 0 1-6-6l3-3 M9 15l6-6",
  banners: "M3 4h18v15H3z M3 8h18 M7 12h10 M7 15h6",
  decorations: "M3 4h18v16H3z M3 17l6-6 4 4 3-3 5 5 M16 8h.1",
  media: "M3 3h14v14H3z M7 17v4h14V7h-4 M3 14l5-5 4 4 2-2 3 3",
  about: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 11v6 M12 7h.1",
  contact: "M3 5h18v14H3z M3 6l9 7 9-7",
  terms: "M5 3h10l4 4v14H5z M14 3v5h5 M9 12h6 M9 16h6",
  seo: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M15 15l6 6",
  paymentReviews: "M12 3l8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z M8 12l3 3 5-6",
  history: "M3 12a9 9 0 1 1 3 7 M3 6v6h6 M12 7v5l3 2",
  workforce: "M3 7h18v13H3z M8 7V4h8v3 M3 12l9 3 9-3 M10 14h4",
  stories: "M4 3h16v18H4z M10 8l6 4-6 4z",
  settings: "M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4",
  logout: "M11 4H4v16h7 M9 12h12 M17 8l4 4-4 4",
};

function addMenuIcon(link, name) {
  const path = menuIconPaths[name];
  if (!path) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("adminMenuIcon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const shape = document.createElementNS(svg.namespaceURI, "path");
  shape.setAttribute("d", path);
  svg.append(shape);

  const label = document.createElement("span");
  label.className = "adminMenuLabel";
  label.textContent = link.textContent.trim();
  link.replaceChildren(svg, label);
}

document.addEventListener("DOMContentLoaded", () => {
  const mobile = matchMedia("(max-width: 760px)");
  const sidebar = document.getElementById("adminSidebar");
  const nav = sidebar.querySelector(".nav");
  const toggle = document.querySelector(".mobileMenuToggle");
  const close = sidebar.querySelector(".mobileMenuClose");
  const header = toggle.closest("header");
  const sidebarPosition = document.createComment("Desktop sidebar position");
  sidebar.before(sidebarPosition);

  const quickLinks = ["dashboard", "products", "communityUsers", "paymentOrders", "communityGroup", "apiIntegrations"];
  const groups = [
    ["Balans və mühasibatlıq", ["communityShop", "paymentCosts", "paymentMethods", "paymentReviews"]],
    ["Məhsul idarəetməsi", ["readyStock", "categories", "gameProducts", "orderGuide", "orders", "netflixAccounts"]],
    ["Sayt məzmunu", ["homepage", "navigation", "banners", "stories", "decorations", "media", "about", "contact", "terms", "seo"]],
    ["Sistem", ["history", "/admin/workforce"]]
  ];
  const key = link => link.dataset.view || link.getAttribute("href");
  const links = [...nav.querySelectorAll(".navBtn")];
  const linkedIcons = { "/admin/employee-stock": "employeeStock", "/admin/workforce": "workforce", "/admin/users": "communityUsers" };
  for (const link of links) addMenuIcon(link, link.dataset.view || linkedIcons[key(link)]);
  addMenuIcon(sidebar.querySelector(".logout"), "logout");
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
