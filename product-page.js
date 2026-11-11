(function () {
  let activeRoot=null,scope=null;
  function disposeProductPage(){
    scope?.abort();scope=null;activeRoot=null;
    window.mirpanelResetProductSelection?.();
  }
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
      // The catalog's canonical image is also the source for the media backdrop.
      const media = mainImage.closest('.product-page-media');
      const backdrop = media?.querySelector('.product-page-media-backdrop');
      if (backdrop && product?.image) backdrop.src = rootRelativeImage(product.image);
      const showFallback = () => {
        if (!media || media.querySelector('[data-product-image-fallback]')) return;
        const fallback = document.createElement('span');
        fallback.dataset.productImageFallback = '';
        fallback.setAttribute('role','img');
        fallback.setAttribute('aria-label', product?.title || 'Məhsul şəkli');
        fallback.textContent = 'Şəkil hazırda yüklənmir';
        fallback.style.cssText = 'display:grid;place-items:center;min-height:160px;padding:16px;color:#b8b8c0;background:#111;text-align:center';
        mainImage.hidden = true;
        mainImage.style.setProperty('display','none','important');
        media.append(fallback);
      };
      const fitMedia = () => {
        if (!mainImage.naturalWidth || !mainImage.naturalHeight) return;
        mainImage.hidden = false;
        mainImage.style.removeProperty('display');
        media?.querySelector('[data-product-image-fallback]')?.remove();
        mainImage.closest('.product-page-media')?.style.setProperty('--product-image-ratio', String(mainImage.naturalWidth / mainImage.naturalHeight));
      };
      mainImage.addEventListener('error', showFallback);
      mainImage.addEventListener('load', fitMedia);
      if (mainImage.complete && !mainImage.naturalWidth) showFallback();
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
    const root=document.querySelector('main#productPageView.product-page-root');
    if (!root||activeRoot===root||!productId||typeof window.openProductPage!=="function") return;
    if(scope)disposeProductPage();activeRoot=root;scope=new AbortController();const {signal}=scope;
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
        const [metrics,display] = await Promise.all([
          import('/mirpanel-admin/public/product-plan-utils.mjs?v=product-summary-1'),
          import('/product-detail-display.mjs?v=package-details-1')
        ]);
        if(!signal.aborted&&activeRoot===root&&root.isConnected)initializeDetailMetadata(root,product, {...metrics,...display},signal);
      } catch { /* Keep the existing functioning page if enhancement cannot load. */ }
    }
  }

  function initializeDetailMetadata(root,product, utils,signal) {
    if (!root || root.dataset.detailEnhanced) return;
    root.dataset.detailEnhanced = 'true';
    root.classList.add('detail-v2');
    const text = (tag, className, value) => {
      const el = document.createElement(tag); el.className = className; el.textContent = value; return el;
    };
    const media = root.querySelector('.product-page-media');
    const left = text('div','product-detail-left','');
    media.before(left); left.append(media);
    const sales = text('p','product-detail-sales',''); sales.hidden = true; left.append(sales);
    const trust = text('ul','product-detail-trust','');
    const iconPaths = [
      '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
      '<path d="m4 16 5-5 4 3 7-9m-6 0h6v6"/>',
      '<path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z"/>',
      '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'
    ];
    const fact=(value,index)=>{
      const item=text('li','',''),icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
      icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');
      icon.innerHTML=iconPaths[index];item.append(icon,text('span','',value));return item;
    };
    trust.append(fact('2024-dən fəaliyyət göstəririk',0));
    const total=fact('',1);total.hidden=true;trust.append(total);
    const deliveryFact=fact(utils.deliveryText(product),2);
    trust.append(deliveryFact,fact('MirPanel əlavə komissiya tutmur',3));
    const actions=root.querySelector('.product-page-actions');
    root.querySelector('.product-page-info')?.append(actions);
    left.append(trust);
    root.querySelector('.product-page-delivery strong').textContent = utils.deliveryText(product);
    const summary = text('section','product-detail-summary','');
    summary.setAttribute('aria-live','polite');
    const container = document.getElementById('pp-plans-container');
    root.querySelector('.product-page-section-title').before(summary);
    const priceText = value => utils.formatPrice(value).replace('.', ',') + ' ₼';
    const rows = [...container.querySelectorAll('.pp-plan-label')];
    const plans = product.plans || [];
    const delivery = product.deliveryText?.trim() || (product.deliveryType === 'automatic' ? 'Anında' : '');
    rows.forEach((row, index) => {
      const plan = plans[index], m = utils.detailPlanMetrics(plan);
      row.hidden = plan.active === false;
      row.setAttribute('role','radio'); row.tabIndex = row.hidden ? -1 : 0;
      const duration = m.days !== null ? `${m.days} gün` : plan.durationMonths && m.months !== null ? `${m.months} ay` : '';
      const label = plan.label?.trim() || duration || (m.months === null ? 'Paket' : `${m.months} aylıq`);
      const planName = duration && label !== duration ? `${label} · ${duration}` : label;
      row.setAttribute('aria-label', planName);
      const name = row.querySelector('.pp-plan-name');
      name.textContent = planName;
      if (plan.bestValue === true) {
        name.append(' ', text('span','product-detail-best','Ən sərfəli'));
      }
      const notes = text('span','product-detail-plan-notes','');
      notes.id = `plan-details-${product.id}-${index}`;
      notes.setAttribute('role','region'); notes.setAttribute('aria-label','Paketin əlavə məlumatları');
      row.setAttribute('aria-controls',notes.id);
      if (delivery) notes.append(text('span','plan-fact plan-fact-delivery',delivery));
      const stock = text('span','plan-fact plan-fact-stock','');
      stock.dataset.planStock = '';
      stock.hidden = true;
      notes.append(stock);
      if (m.warranty) notes.append(text('span','plan-fact plan-fact-warranty',m.warranty));
      if (m.rate !== null && (m.days !== null || m.months >= 2)) {
        const rate = text('span','product-detail-rate',m.days !== null ? 'Gündə ' : 'Ayda ');
        rate.append(text('strong','',priceText(m.rate)));notes.append(rate);
      }
      row.append(notes);
      const price = row.querySelector('.pp-new-price');
      if (m.price !== null && m.price > 0) price.textContent = priceText(m.price);
      row.querySelector('.pp-plan-price-meta')?.remove();
      if (m.oldPrice !== null) {
        const old = text('div','pp-plan-price-meta','');
        old.append(text('div','pp-old-price',priceText(m.oldPrice)),text('div','pp-plan-disc-badge',`-${m.discount}%`));
        row.querySelector('.pp-plan-right').prepend(old);
      }
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); row.click(); }
        if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(event.key)) {
          event.preventDefault();const available=rows.filter(item=>!item.hidden),at=available.indexOf(row);
          const next=available[(at+(event.key==='ArrowDown'||event.key==='ArrowRight'?1:-1)+available.length)%available.length];next?.click();next?.focus();
        }
      });
    });
    container.setAttribute('role','radiogroup');
    const update = () => {
      const index = rows.findIndex(row=>row.classList.contains('active') && !row.hidden);
      summary.replaceChildren();
      rows.forEach((row,i)=>{
        row.setAttribute('aria-checked',String(i===index));row.tabIndex=i===index?0:-1;
        const notes=row.querySelector('.product-detail-plan-notes');
        notes.hidden=i!==index;
      });
      if (index < 0) {
        summary.append(text('p','','Aktiv paket yoxdur.'));
        const button=document.getElementById('pp-order-btn');button.disabled=true;button.classList.add('disabled');
        return;
      }
      const plan = plans[index], m = utils.planMetrics(plan);
      summary.append(text('p','product-detail-summary-label',`Seçilmiş paket: ${rows[index].getAttribute('aria-label')}`));
      const prices = text('div','product-detail-summary-prices','');
      if (m.price !== null) prices.append(text('strong','',priceText(m.price)));
      if (m.oldPrice !== null) prices.append(text('del','',priceText(m.oldPrice)));
      if (m.discount !== null) prices.append(text('span','product-detail-best',`-${m.discount}%`));
      const priceLine=text('div','product-detail-summary-line','');
      priceLine.append(prices);
      summary.append(priceLine);
      if (m.savings !== null) {
        const saving = text('p','product-detail-savings','');
        saving.append(text('strong','',priceText(m.savings)),document.createTextNode(' '),text('span','product-detail-savings-caption','qənaət edirsiniz'));priceLine.append(saving);
      }
      summary.append(text('p','product-detail-summary-delivery',utils.deliveryText(product)));
    };
    window.addEventListener('mirpanel:prices',()=>{rows.forEach((row,i)=>{const m=utils.detailPlanMetrics(plans[i]);const price=row.querySelector('.pp-new-price');if(price&&m.price!==null)price.textContent=priceText(m.price);const rate=row.querySelector('.product-detail-rate strong');if(rate&&m.rate!==null)rate.textContent=priceText(m.rate);row.querySelector('.pp-plan-price-meta')?.remove();});update();},{signal});
    container.addEventListener('click', update);
    container.addEventListener('mirpanel:plan-selection-cleared', update);
    if (!rows.some(row=>row.classList.contains('active') && !row.hidden)) rows.find(row=>!row.hidden)?.click();
    update();
    window.MirpanelInventory?.paint?.();
    const number = new Intl.NumberFormat('az-AZ');
    let loading = false;
    async function refreshSales() {
      if (loading || document.hidden || signal.aborted) return;
      loading = true;
      try {
        const response = await fetch(`https://mirpanel.onrender.com/api/product-sales?productId=${encodeURIComponent(product.id)}`, {cache:'no-store',priority:'low',signal});
        if (!response.ok) return;
        const value = await response.json();
        if (signal.aborted||value.productId !== product.id || !value.initialized || !Number.isSafeInteger(value.productTotal) || !Number.isSafeInteger(value.siteTotal)) return;
        sales.replaceChildren(text('span','product-detail-sales-intro','↗ Bu məhsul '),text('span','product-detail-sales-approx','≈ '),text('strong','',`${new Intl.NumberFormat('en-US').format(value.productTotal).replaceAll(',',' ')}+`),document.createTextNode(' dəfə satılıb'));
        sales.title='Satış göstəricisi təxmini tarixi bölgü və tamamlanmış sayt sifarişlərinin cəmidir.';sales.hidden = false;
        if(Number.isSafeInteger(value.completedTotal)&&value.completedTotal>=0){
          total.querySelector('span').textContent=number.format(value.completedTotal)+' tamamlanmış sifariş';
          total.hidden=false;
        }
      } catch { /* A network error never creates invented sales numbers. */ }
      finally { loading = false; }
    }
    void refreshSales();
    const timer = setInterval(refreshSales,30000);
    window.addEventListener('focus',refreshSales,{signal});
    document.addEventListener('visibilitychange',refreshSales,{signal});
    signal.addEventListener('abort',()=>clearInterval(timer),{once:true});
  }

  window.mirpanelMountProduct=initializeProductPage;
  window.mirpanelDisposeProduct=disposeProductPage;
  if(window.mirpanelNavigationMounting)return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeProductPage, { once: true });
  } else {
    initializeProductPage();
  }
})();
