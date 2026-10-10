(function () {
  function productIdFromElement(element) {
    const explicit = element?.dataset?.productId;
    if (explicit) return explicit;
    const onclick = element?.getAttribute?.("onclick") || "";
    return onclick.match(/openProductPage\('([^']+)'\)/)?.[1] || "";
  }

  function productPath(productId) {
    let products = [];
    try {
      if (typeof DATA !== "undefined" && Array.isArray(DATA.products)) products = DATA.products;
    } catch {}
    const product = products.find((item) => item.id === productId);
    const slug = String(product?.seoSlug || "")
      .replace(/^\/+|\/+$/g, "")
      .replace(/-almaq$/, "")
      .replace(/(^|-)hesab0(?=-|$)/g, "$1hesab");
    return slug ? `/mehsul/${slug}` : "/";
  }

  function rootRelativeImage(value) {
    const source = String(value || "").trim();
    if (!source) return "";
    if (/^https?:\/\//i.test(source)) {
      try {
        const url = new URL(source);
        if (url.hostname === location.hostname || url.hostname === "mirpanel.com") {
          return `${url.pathname}${url.search}`;
        }
      } catch {}
      return source;
    }
    return source.startsWith("/") ? source : `/${source.replace(/^\.?\//, "")}`;
  }

  function normalizeProductImages(product) {
    const mainImage = document.getElementById("pp-main-img");
    if (mainImage && product?.image) mainImage.src = rootRelativeImage(product.image);
    if (mainImage) {
      const fitMedia = () => {
        if (!mainImage.naturalWidth || !mainImage.naturalHeight) return;
        mainImage.closest('.product-page-media')?.style.setProperty('--product-image-ratio', String(mainImage.naturalWidth / mainImage.naturalHeight));
      };
      mainImage.addEventListener('load', fitMedia);
      fitMedia();
    }
    document.querySelectorAll(".product-page-root img").forEach((image) => {
      const source = image.getAttribute("src");
      if (source) image.setAttribute("src", rootRelativeImage(source));
    });
  }

  function convertSimilarCardsToLinks() {
    document.querySelectorAll("#pp-similar-list .pp-sim-card").forEach((card) => {
      if (card.tagName === "A") return;
      const productId = productIdFromElement(card);
      if (!productId) return;
      const link = document.createElement("a");
      for (const attribute of card.attributes) {
        if (attribute.name !== "onclick") link.setAttribute(attribute.name, attribute.value);
      }
      link.href = productPath(productId);
      link.innerHTML = card.innerHTML;
      card.replaceWith(link);
    });
  }

  function initializeContentTabs() {
    const tabs = [...document.querySelectorAll(".product-page-tab[data-product-tab]")];
    const panels = [...document.querySelectorAll(".product-page-panel[data-product-panel]")];
    const showPanel = (name) => {
      tabs.forEach((tab) => {
        const active = tab.dataset.productTab === name;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
        tab.setAttribute("tabindex", active ? "0" : "-1");
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.productPanel !== name;
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => showPanel(tab.dataset.productTab));
      tab.addEventListener("keydown", (event) => {
        const currentIndex = tabs.indexOf(tab);
        let nextIndex = currentIndex;
        if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
        else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        showPanel(tabs[nextIndex].dataset.productTab);
        tabs[nextIndex].focus();
      });
    });
    showPanel("about");

    document.querySelector(".product-page-action.is-about")?.addEventListener("click", (event) => {
      event.preventDefault();
      showPanel("about");
      document.getElementById("product-about")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  async function initializeProductPage() {
    const productId = document.body?.dataset?.productId;
    if (!productId || typeof window.openProductPage !== "function") return;
    const staticSimilarMarkup = document.getElementById("pp-similar-list")?.innerHTML || "";
    window.openProductPage(productId);
    const similarList = document.getElementById("pp-similar-list");
    if (similarList && staticSimilarMarkup) similarList.innerHTML = staticSimilarMarkup;
    document.querySelector("[data-static-product-plans]")?.setAttribute("hidden", "");
    document.getElementById("pp-plans-container")?.removeAttribute("hidden");
    let product = null;
    try {
      if (typeof DATA !== "undefined" && Array.isArray(DATA.products)) {
        product = DATA.products.find((item) => item.id === productId) || null;
      }
    } catch {}
    document.querySelectorAll("#pp-plans-container .pp-plan-label").forEach((row, index) => {
      const plan = product?.plans?.[index] || {};
      const price = Number(plan.price) || 0;
      const regularPrice = Number(plan.regularPrice) || 0;
      if (!(regularPrice > price && price > 0)) {
        row.querySelector(".pp-old-price")?.remove();
        row.querySelector(".pp-plan-disc-badge")?.remove();
      }
    });
    normalizeProductImages(product);
    convertSimilarCardsToLinks();
    initializeContentTabs();
    if (product) {
      try {
        const metrics = await import('/mirpanel-admin/public/product-plan-utils.mjs?v=detail-20261010-1');
        initializeDetailMetadata(product, metrics);
      } catch { /* Keep the existing functioning page if enhancement cannot load. */ }
    }
  }

  function initializeDetailMetadata(product, utils) {
    const root = document.getElementById('productPageView');
    if (!root || root.dataset.detailEnhanced) return;
    root.dataset.detailEnhanced = 'true';
    const text = (tag, className, value) => {
      const el = document.createElement(tag); el.className = className; el.textContent = value; return el;
    };
    const media = root.querySelector('.product-page-media');
    const left = text('div','product-detail-left','');
    media.before(left); left.append(media);
    const sales = text('p','product-detail-sales',''); sales.hidden = true; left.append(sales);
    const trust = text('ul','product-detail-trust','');
    trust.append(text('li','','2024-dən fəaliyyət göstərir'));
    const total = text('li','',''); total.hidden = true; trust.append(total);
    trust.append(text('li','',utils.deliveryText(product)));
    if (product.commissionFree === true) trust.append(text('li','','Komissiyasız ödəniş — əlavə məbləğ tutulmur'));
    left.append(trust);
    root.querySelector('.product-page-delivery strong').textContent = utils.deliveryText(product);
    const summary = text('section','product-detail-summary','');
    summary.setAttribute('aria-live','polite');
    const container = document.getElementById('pp-plans-container');
    root.querySelector('.product-page-section-title').before(summary);
    const rows = [...container.querySelectorAll('.pp-plan-label')];
    const plans = product.plans || [];
    const unavailable = product.soldOut === true || product.flow === 'out_of_stock' ||
      (product.stockEnabled === true && product.stock != null && Number(product.stock) <= 0);
    const best = unavailable ? -1 : utils.bestValueIndex(plans);
    rows.forEach((row, index) => {
      const plan = plans[index], m = utils.planMetrics(plan);
      row.hidden = plan.active === false;
      row.setAttribute('role','radio'); row.tabIndex = row.hidden ? -1 : 0;
      row.setAttribute('aria-label',plan.label || `${m.months || ''} aylıq`);
      const name = row.querySelector('.pp-plan-name');
      name.textContent = plan.label || `${m.months || ''} aylıq`;
      const notes = text('span','product-detail-plan-notes','');
      if (m.monthly !== null && m.months > 1) notes.append(text('span','',`ayda ${utils.formatPrice(m.monthly)} ₼`));
      if (m.warranty) notes.append(text('span','',m.warranty));
      // There is currently no plan-level inventory source: do not invent per-plan stock
      // from the global product stock. visibleStock deliberately requires an inventory read.
      if (index === best) notes.append(text('span','product-detail-best','Ən sərfəli'));
      name.append(notes);
      const price = row.querySelector('.pp-new-price');
      if (m.price !== null && m.price > 0) price.textContent = `${utils.formatPrice(m.price)} ₼`;
      row.querySelector('.pp-plan-price-meta')?.remove();
      if (m.oldPrice !== null) {
        const old = text('div','pp-plan-price-meta','');
        old.append(text('div','pp-old-price',`${utils.formatPrice(m.oldPrice)} ₼`),text('div','pp-plan-disc-badge',`-${m.discount}%`));
        row.querySelector('.pp-plan-right').prepend(old);
      }
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); row.click(); }
      });
    });
    container.setAttribute('role','radiogroup');
    const update = () => {
      const index = rows.findIndex(row=>row.classList.contains('active') && !row.hidden);
      summary.replaceChildren();
      rows.forEach((row,i)=>row.setAttribute('aria-checked',String(i===index)));
      if (index < 0) {
        summary.append(text('p','','Aktiv paket yoxdur.'));
        const button=document.getElementById('pp-order-btn');button.disabled=true;button.classList.add('disabled');
        return;
      }
      const plan = plans[index], m = utils.planMetrics(plan);
      summary.append(text('p','product-detail-summary-label',`Seçilmiş paket: ${plan.label || (m.months ? `${m.months} ay` : 'Paket')}`));
      const prices = text('div','product-detail-summary-prices','');
      if (m.price !== null) prices.append(text('strong','',`${utils.formatPrice(m.price)} ₼`));
      if (m.oldPrice !== null) prices.append(text('del','',`${utils.formatPrice(m.oldPrice)} ₼`));
      if (m.discount !== null) prices.append(text('span','product-detail-best',`-${m.discount}%`));
      summary.append(prices);
      if (m.savings !== null) summary.append(text('p','product-detail-savings',`Qənaət: ${utils.formatPrice(m.savings)} ₼`));
    };
    container.addEventListener('click', update);
    if (!rows.some(row=>row.classList.contains('active') && !row.hidden)) rows.find(row=>!row.hidden)?.click();
    update();
    const number = new Intl.NumberFormat('az-AZ');
    let loading = false;
    async function refreshSales() {
      if (loading || document.hidden) return;
      loading = true;
      try {
        const response = await fetch(`https://mirpanel.onrender.com/api/product-sales?productId=${encodeURIComponent(product.id)}`, {cache:'no-store'});
        if (!response.ok) return;
        const value = await response.json();
        if (value.productId !== product.id || !value.initialized || !Number.isSafeInteger(value.productTotal) || !Number.isSafeInteger(value.siteTotal)) return;
        sales.textContent = `2024-dən bəri təxminən ${number.format(value.productTotal)} satış`; sales.hidden = false;
        total.textContent = `${number.format(value.siteTotal)}+ tamamlanmış ümumi sifariş`; total.hidden = false;
      } catch { /* A network error never creates invented sales numbers. */ }
      finally { loading = false; }
    }
    void refreshSales();
    const timer = setInterval(refreshSales,30000);
    window.addEventListener('focus',refreshSales);
    document.addEventListener('visibilitychange',refreshSales);
    window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeProductPage, { once: true });
  } else {
    initializeProductPage();
  }
})();
