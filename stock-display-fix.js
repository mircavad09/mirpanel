(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function stockNumber(product) {
    if (product?.stockEnabled === false) return null;
    const rawStock = product.stock ?? product.stockCount ?? product.stockQuantity;
    if (rawStock === null || rawStock === "" || rawStock === undefined) return null;
    const stock = Number(rawStock);
    return Number.isFinite(stock) ? Math.max(0, stock) : null;
  }

  function stockBadgeData(product) {
    const stock = stockNumber(product);
    if (stock === null) return null;
    if (stock === 0) return { text: "Stokda yoxdur", className: "out" };
    return { text: `Stok: ${stock}`, className: stock <= 5 ? "low" : "ok" };
  }

  function stockBadgeHTML(product) {
    const badge = stockBadgeData(product);
    if (!badge) return "";
    return `<div class="cardStockLine"><span class="mpStockBadge cardStockBadge ${badge.className}">${escapeHtml(badge.text)}</span></div>`;
  }

  function minPrice(product) {
    if (typeof getMinPrice === "function") return getMinPrice(product);
    return Math.min(...(product.plans || []).filter((plan) => Number(plan.price) > 0).map((plan) => Number(plan.price)));
  }

  function priceText(product) {
    if (product.id === "tiktok_jeton") return `10.00 ${product.currency || "₼"}`;
    const min = minPrice(product);
    return min != null && min !== Infinity && min !== 0
      ? `${Number(min).toFixed(2)} ${product.currency || "₼"}`
      : "—";
  }

  function installCardRenderer() {
    if (typeof renderGrid !== "function") return;

    cardHTML = window.cardHTML = function stockAwareCardHTML(product, index) {
      return `
        <div class="card" onclick="window.openProductPage('${escapeHtml(product.id)}')" style="animation-delay:${Math.min(index * 0.03, 0.25)}s">
          <div class="imgWrap"><img class="img" src="${escapeHtml(product.image)}" alt=""><div class="cornerPrice">${priceText(product)}</div></div>
          <div class="pad">
            <div class="topline"><h3 class="title">${escapeHtml(product.title)}</h3><div class="badge">${escapeHtml(product.badge)}</div></div>
            <div class="meta">${escapeHtml(product.desc)}</div>
            ${stockBadgeHTML(product)}
            <div class="priceRow"><button class="btn primary" type="button">${escapeHtml(UI?.orderBtn || "Sifariş et")}</button></div>
          </div>
        </div>
      `;
    };

    renderGrid();
  }

  function decorateDetail(product) {
    if (!product) return;
    const imageBadge = document.querySelector(".pp-avail-badge");
    if (imageBadge) imageBadge.style.display = "none";

    document
      .querySelectorAll("#productPageView .pp-detail-stock-line, #productPageView .detailStockBadge")
      .forEach((element) => element.remove());

    const badgeData = stockBadgeData(product);
    if (!badgeData) return;

    if (badgeData.className === "out") {
      const button = document.getElementById("pp-order-btn");
      if (button) {
        button.disabled = true;
        button.textContent = "Stokda yoxdur";
        button.classList.add("disabled");
      }
    }
  }

  function installDetailDecorator() {
    if (typeof openProductPage !== "function") return;
    const originalOpenProductPage = openProductPage;

    openProductPage = window.openProductPage = function stockAwareOpenProductPage(id) {
      originalOpenProductPage(id);
      setTimeout(() => {
        const product = DATA?.products?.find((item) => item.id === id);
        decorateDetail(product);
      }, 0);
    };
  }

  installCardRenderer();
  installDetailDecorator();
})();
