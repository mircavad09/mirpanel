(async function () {
  window.MirpanelInventory?.dispose?.();
  const {inventoryAvailability}=await import('/inventory-availability.mjs?v=epinby-stock-1');
  const {packageDeliveryText,instantPlanIndices}=await import('/ready-delivery.mjs?v=instant-filter-1');
  const inventory = new Map();let inventoryTimer,homeSalesTimer,painting=false,inventoryDisplayValid=false,inventoryFailed=false;
  if(!document.querySelector('style[data-supplier-stock-style]')){
    const style=document.createElement('style');style.dataset.supplierStockStyle='';style.dataset.shellPersistent='';
    style.textContent='#pp-plans-container .pp-plan-label>.supplier-stock-unavailable{display:inline-flex;grid-column:1/-1;grid-row:2;justify-self:start;align-self:center;max-width:calc(100% - 23px);margin:0 0 0 23px;padding:1px 5px;font-size:11px;line-height:14px;overflow-wrap:anywhere}#pp-plans-container .supplier-stock-unavailable[data-supplier-state="unknown"]{color:#f4ce66}';
    document.head.append(style);
  }
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function publicProductTitle(value) {
    return String(value || "").replace(/\s+almaq\s*$/i, "").trim();
  }

  function stockNumber(product) {
    return stateFor(product).available;
  }

  function stockBadgeData(product) {
    const state=stateFor(product);
    if(state.unavailable)return null;
    if(!state.canOrder)return {text:'Stokda yoxdur',className:'out'};
    if(state.scope==='plan')return null;
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

  // Homepage only: the exact starting-price plan represented by the card.
  // Never aggregate unrelated plan pools, or display a synthetic fail-closed zero.
  function homeStockBadgeData(product,homepage=true,exactIndex) {
    const badge=cardStockBadgeData(product,homepage,exactIndex);
    // Homepage presentation only; inventory and catalog availability stay unchanged.
    return homepage?(badge?.className==='out'?{...badge,text:'Stokda yoxdur'}:null):badge;
  }

  function cardStockBadgeData(product,homepage=true,exactIndex) {
    const ledger=inventory.get(product.id);
    if(ledger?.salesDisabled)return {text:'Stokda yoxdur',className:'out'};
    if(!inventoryDisplayValid||!ledger||ledger.needsSetup)return null;
    const pricePlan=exactIndex??(window.mirpanelHomeInstant?instantPlans(product)[0]:(product.plans||[]).findIndex(plan=>Number(plan.price)===minPrice(product)));
    const supplier=ledger.plans?.find(plan=>plan.planKey===String(pricePlan))?.supplierStock;
    if(supplier&&inventoryFailed)return {text:'Stok yoxlanıla bilmir',className:'unknown'};
    if(supplier?.status==='out')return {text:'Stokda bitib',className:'out'};
    if(supplier?.status==='unknown')return {text:'Stok yoxlanıla bilmir',className:'unknown'};
    if(supplier?.status==='available'){
      if(!Number.isSafeInteger(supplier.count))return null;
      const count=stateFor(product).plans[pricePlan]?.available;
      return Number.isSafeInteger(count)?{text:count===0?'Stokda bitib':'Stok: '+count,className:count===0?'out':count<=5?'low':'count'}:null;
    }
    let stock;
    if(ledger.scope==='product'){
      if(ledger.unlimited===true)return null;
      stock=ledger.available;
    }else if(ledger.scope==='plan'){
      const price=product.id==='tiktok_jeton'?10:minPrice(product);
      const index=pricePlan;
      const plan=ledger.plans?.find(plan=>plan.planKey===String(index));
      if(!plan||plan.tracked===false)return null;
      stock=plan.available;
    }else return null;
    if(!Number.isSafeInteger(stock)||stock<0)return null;
    if(stock===0)return {text:'Stokda yoxdur',className:'out'};
    if(homepage)return stock<=5?{text:`Son ${stock} ədəd`,className:'low'}:null;
    return stock<10?{text:`Son ${stock} ədəd`,className:'low'}:
      {text:`Stok: ${stock}`,className:'count'};
  }

  function homeStockBadgeHTML(product){
    const badge=homeStockBadgeData(product);
    return badge?`<div class="cardStockLine"><span class="mpStockBadge cardStockBadge ${badge.className}">${escapeHtml(badge.text)}</span></div>`:'';
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

  // Home card presentation only. Keep the catalog, filtering and navigation unchanged.
  function homeCardHTML(product, index, productUrl) {
    if(window.mirpanelHomeInstant){const exact=instantPlans(product)[0];if(exact===undefined)return '';productUrl+='?plan='+exact;
      return window.MirpanelCatalogCard.render(product,index,productUrl,publicProductTitle(product.title),Number(product.plans[exact].price),priceText(product),homeStockBadgeHTML(product),true).replace('<article ','<article data-instant-plan="'+exact+'" ');
    }
    if(window.MirpanelCatalogCard)return window.MirpanelCatalogCard.render(product,index,productUrl,publicProductTitle(product.title),product.id==='tiktok_jeton'?10:minPrice(product),priceText(product),homeStockBadgeHTML(product),true);
    const price = product.id === 'tiktok_jeton' ? 10 : minPrice(product);
    const plan = (product.plans || []).find(item=>Number(item.price)===price);
    const cents = Math.round(price*100), oldCents = Math.round(Number(plan?.regularPrice)*100);
    const discounted = Number.isSafeInteger(cents) && cents>0 && Number.isSafeInteger(oldCents) && oldCents>cents;
    const percent = discounted ? Math.round((oldCents-cents)/oldCents*100) : 0;
    const title = publicProductTitle(product.title), id=escapeHtml(product.id);
    const labels = [product.bestSeller===true?'🔥 Ən çox satılan':''].filter(Boolean);
    return `<article class="card homeProductCard" data-product-id="${id}" aria-labelledby="home-card-${id}" style="animation-delay:${Math.min(index*.03,.25)}s">
      <div class="imgWrap"><img class="img" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.imageAlt || title)}" loading="lazy" decoding="async">
        ${percent>0?`<span class="homeCardDiscount">-${percent}%</span>`:''}
        ${labels.length?`<div class="homeCardLabels">${labels.map(label=>`<span>${label}</span>`).join('')}</div>`:''}
      </div>
      <div class="pad homeCardBody">
        <h3 class="title" id="home-card-${id}" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
        <div class="homeCardPrices"><strong>${escapeHtml(priceText(product))}</strong>${discounted?`<del>${(oldCents/100).toFixed(2)} ${escapeHtml(product.currency || '₼')}</del>`:''}</div>
        <p class="homeCardSales" data-home-sales-id="${id}" hidden></p>
        <a class="homeCardOrder" href="${escapeHtml(productUrl)}" aria-label="Sifariş et" aria-describedby="home-card-${id}" title="Sifariş et"><span aria-hidden="true">→</span></a>
        ${homeStockBadgeHTML(product)}
      </div>
    </article>`;
  }

  const homeSalesCache = new Map(), homeSalesPending = new Map(), homeSalesQueue = [];
  let homeSalesActive = 0;
  function pumpHomeSales() {
    while(homeSalesActive<4 && homeSalesQueue.length){
      const {id,resolve}=homeSalesQueue.shift();homeSalesActive++;
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
      fetch(`https://mirpanel-frankfurt.onrender.com/api/product-sales?productId=${encodeURIComponent(id)}`,{cache:'no-store',signal:controller.signal})
        .then(response=>response.ok?response.json():null).then(value=>{
          const valid=value?.productId===id && value.initialized===true && Number.isSafeInteger(value.productTotal) && value.productTotal>=0;
          const count=valid?value.productTotal:null;
          homeSalesCache.set(id,{count,expires:Date.now()+5000});resolve(count);
        }).catch(()=>resolve(null)).finally(()=>{clearTimeout(timeout);homeSalesActive--;homeSalesPending.delete(id);pumpHomeSales();});
    }
  }
  function hydrateHomeCardSales() {
    if(document.hidden||!document.body.classList.contains('home-page'))return;
    document.querySelectorAll('#grid [data-home-sales-id]').forEach(line=>{
      const id=line.dataset.homeSalesId, cached=homeSalesCache.get(id);
      let result;
      if(cached && cached.expires>Date.now())result=Promise.resolve(cached.count);
      else {
        if(!homeSalesPending.has(id))homeSalesPending.set(id,new Promise(resolve=>homeSalesQueue.push({id,resolve})));
        result=homeSalesPending.get(id);pumpHomeSales();
      }
      void result.then(count=>{
        if(!line.isConnected || count===null)return;
        line.textContent=`${new Intl.NumberFormat('en-US').format(count).replaceAll(',',' ')}+ dəfə satılıb`;
        line.hidden=false;
      });
    });
  }

  function installCardRenderer() {
    if (typeof renderGrid !== "function") return;

    cardHTML = window.cardHTML = function stockAwareCardHTML(product, index) {
      const productSlug = String(product.seoSlug || "")
        .replace(/^\/+|\/+$/g, "")
        .replace(/-almaq$/, "")
        .replace(/(^|-)hesab0(?=-|$)/g, "$1hesab");
      const productUrl = productSlug ? `/mehsul/${productSlug}` : "#";
      if(document.body.classList.contains('home-page'))return homeCardHTML(product,index,productUrl);
      return `
        <a class="card" href="${productUrl}" data-product-id="${escapeHtml(product.id)}" style="animation-delay:${Math.min(index * 0.03, 0.25)}s;text-decoration:none;color:inherit">
          <div class="imgWrap"><img class="img" src="${escapeHtml(product.image)}" alt=""><div class="cornerPrice">${priceText(product)}</div></div>
          <div class="pad">
            <div class="topline"><h3 class="title">${escapeHtml(publicProductTitle(product.title))}</h3><div class="badge">${escapeHtml(product.badge)}</div></div>
            <div class="meta">${escapeHtml(product.desc)}</div>
            ${stockBadgeHTML(product)}
            <div class="priceRow"><span class="btn primary" style="display:inline-flex;align-items:center;justify-content:center">${escapeHtml(UI?.orderBtn || "Sifariş et")}</span></div>
          </div>
        </a>
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
        button.title = "Stokda yoxdur";
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
        if(typeof currentProduct==='undefined'||currentProduct?.id!==id)return;
        const product = DATA?.products?.find((item) => item.id === id);
        decorateDetail(product);
      }, 0);
    };
  }

  function stateFor(product){
    const state=inventoryAvailability(product,inventory.get(product?.id));
    if(!inventoryDisplayValid||!inventory.has(product?.id))return {...state,unavailable:true,available:null,canOrder:false,plans:state.plans.map(p=>({...p,available:null,canOrder:false}))};
    if(inventoryFailed){state.plans=state.plans.map(p=>p.supplierStock?{...p,available:null,canOrder:false,supplierStock:{...p.supplierStock,status:'unknown',count:null}}:p);state.canOrder=state.plans.some(p=>p.canOrder);}
    return state;
  }
  function planFor(product,index){return stateFor(product).plans.find(p=>p.planKey===String(index));}
  // Presentation only: use the same exact-plan evidence as the visible stock UI.
  function syncProductSchema(product,state){
    if(document.body.dataset.productId!==product.id)return;
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script=>{
      let data;try{data=JSON.parse(script.textContent);}catch{return;}
      let changed=false;
      for(const node of data['@graph']||[data]){
        if(node['@type']!=='Product'||node.sku!==product.id)continue;
        for(const offer of Array.isArray(node.offers)?node.offers:[node.offers].filter(Boolean)){
          const key=decodeURIComponent((offer['@id']||'').split('#offer-')[1]||'');
          const index=product.plans.findIndex((plan,i)=>String(plan.id??i)===key);
          const plan=state.plans.find(p=>p.planKey===String(index));
          const unknown=inventoryFailed||state.unavailable||plan?.supplierStock?.status==='unknown';
          const availability=unknown||!plan?undefined:'https://schema.org/'+(plan.canOrder?'InStock':'OutOfStock');
          if(offer.availability!==availability){if(availability)offer.availability=availability;else delete offer.availability;changed=true;}
        }
      }
      if(changed)script.textContent=JSON.stringify(data);
    });
  }
  // Opening the read-only order window is safe while inventory is unknown.
  // Quote and checkout still confirm the actual price, availability and balance.
  function canOpenOrder(product,index){const state=stateFor(product),plan=state.plans.find(p=>p.planKey===String(index));return product.active!==false&&!state.salesDisabled&&plan?.active===true&&(state.unavailable||plan.canOrder===true);}
  function deliveryFor(product,index){
    const state=stateFor(product);
    return packageDeliveryText(product,index,state.plans[index],{unavailable:state.unavailable||inventoryFailed});
  }
  function paintDelivery(product,rows,index){
    rows.forEach((row,i)=>{
      const label=deliveryFor(product,i);
      let line=row.querySelector('.plan-fact-delivery');
      if(!label){line?.remove();return;}
      if(!line){line=document.createElement('span');line.className='plan-fact plan-fact-delivery';row.querySelector('.pp-plan-meta')?.prepend(line);}
      line.textContent=label==='Anında təqdim olunur'?'Anında':label;line.hidden=label==='Stokda yoxdur';line.classList.toggle('is-instant',label==='Anında təqdim olunur');
    });
    const label=deliveryFor(product,index);
    document.querySelectorAll('.product-detail-summary-delivery,.product-page-delivery strong,.product-detail-trust li:nth-child(3) span').forEach(el=>{
      el.textContent=label;el.classList.toggle('is-instant',label==='Anında təqdim olunur');
      const line=el.closest('.product-page-delivery')||el.closest('.product-detail-trust li')||el;
      line.hidden=!label;
    });
  }
  function paintInventory(){
    if(painting)return;painting=true;
    try{
      let notice=document.getElementById('inventoryServiceStatus');
      if(inventoryFailed&&!notice){const target=document.querySelector('#grid,main .grid,.product-page-body,#pp-plans-container');if(target){
        notice=document.createElement('div');notice.id='inventoryServiceStatus';notice.setAttribute('role','status');notice.style.cssText='padding:12px;border:1px solid #66552c;border-radius:12px;background:#211c10;color:#f4d783;font-size:14px;line-height:1.5;overflow-wrap:anywhere';
        const label=document.createElement('span'),retry=document.createElement('button');label.textContent='Stok məlumatı hazırda alınmır. ';retry.type='button';retry.textContent='Yenidən cəhd et';retry.style.cssText='margin-left:8px;min-height:36px;padding:4px 10px;border:1px solid #8d7c33;border-radius:8px;background:#282315;color:#ffe875;cursor:pointer';retry.onclick=async()=>{retry.disabled=true;try{await refreshInventory();}finally{retry.disabled=false;}};notice.append(label,retry);target.before(notice);
      }}
      if(notice&&!inventoryFailed)notice.remove();

      for(const product of (typeof DATA!=='undefined'?DATA.products:[])){
        const state=stateFor(product);
        syncProductSchema(product,state);
        document.querySelectorAll('.homeProductCard[data-product-id]').forEach(card=>{
          if(card.dataset.productId!==product.id)return;
          const exact=card.dataset.instantPlan===undefined?undefined:Number(card.dataset.instantPlan);
          const badge=homeStockBadgeData(product,!!card.closest('#homePageView #grid'),exact);let line=card.querySelector('.cardStockLine');
          if(!badge)line?.remove();
          else{
            if(!line){line=document.createElement('div');line.className='cardStockLine';card.querySelector('.pad').append(line);}
            let label=line.querySelector('.cardStockBadge');if(!label){label=document.createElement('span');line.replaceChildren(label);}
            label.className='mpStockBadge cardStockBadge '+badge.className;label.textContent=badge.text;
          }
          if(card.closest('#homePageView #grid')) {
            card.querySelector('.homeCardDelivery')?.remove();
            const price=product.id==='tiktok_jeton'?10:minPrice(product);
            const index=(product.plans||[]).findIndex(plan=>Number(plan.price)===price);
            const instant=deliveryFor(product,index)==='Anında təqdim olunur';
            let badge=card.querySelector('.homeCardInstant');
            if(!instant)badge?.remove();
            else if(!badge){
              badge=document.createElement('span');badge.className='homeCardInstant';
              badge.textContent='Anında';card.querySelector('.imgWrap')?.append(badge);
            }
          } else {
            const start=exact??(product.plans||[]).findIndex(p=>Number(p.price)===minPrice(product)),label=deliveryFor(product,start);
            card.querySelector('.homeCardInstant')?.remove();
            let delivery=card.querySelector('.homeCardDelivery');
            if(!label)delivery?.remove();
            else{if(!delivery){delivery=document.createElement('p');delivery.className='homeCardDelivery';card.querySelector('.pad').append(delivery);}delivery.textContent=label;delivery.classList.toggle('is-instant',label==='Anında təqdim olunur');}
          }
          const add=card.querySelector('.homeCardAdd');
          if(add){add.disabled=state.salesDisabled||!state.unavailable&&!state.canOrder;card.toggleAttribute('data-cart-available',!state.unavailable&&state.canOrder);}
          const button=card.querySelector('.homeCardOrder');if(button){const navigate=!state.salesDisabled&&(state.unavailable||state.canOrder);button.setAttribute('aria-disabled',String(!navigate));button.tabIndex=navigate?0:-1;button.style.opacity=navigate?'':'.45';}
        });
      }
      const product=typeof currentProduct!=='undefined'?currentProduct:null;if(!product)return;
      const state=stateFor(product),rows=[...document.querySelectorAll('#pp-plans-container .pp-plan-label')];
      let index=typeof currentPlanIdx==='number'?currentPlanIdx:0;
      if(!state.unavailable&&!state.plans[index]?.canOrder){const next=state.plans.findIndex(p=>p.canOrder);if(next>=0&&rows[next]){currentPlanIdx=next;rows[next].click();index=next;}else if(next<0&&index!==-1){currentPlanIdx=-1;index=-1;rows.forEach(row=>{row.classList.remove('active');row.setAttribute('aria-checked','false');});document.getElementById('pp-plans-container')?.dispatchEvent(new Event('mirpanel:plan-selection-cleared'));}}
      const canOrder=state.plans[index]?.canOrder===true,canOpen=canOpenOrder(product,index);
      const button=document.getElementById('pp-order-btn');if(button){button.disabled=!canOpen;button.classList.toggle('disabled',!canOpen);button.title=state.salesDisabled?'Stokda yoxdur':state.unavailable?(inventoryFailed?'Müvəqqəti əlçatan deyil':'Stok yoxlanılır…'):canOrder?'':'Stokda yoxdur';}
      const add=document.getElementById('cartAddProduct');
      if(add)add.disabled=!canOpen;
      document.querySelectorAll('.product-page-status').forEach(el=>{el.textContent=state.salesDisabled?'Stokda yoxdur':state.unavailable?'Stok məlumatı alınır':state.canOrder?'Mövcuddur':state.plans.some(p=>p.supplierStock?.status==='unknown')?'Stok yoxlanıla bilmir':state.plans.some(p=>p.supplierStock?.status==='out')?'Stokda bitib':'Stokda yoxdur';el.classList.toggle('is-out',state.salesDisabled||!state.unavailable&&!state.canOrder);});
      rows.forEach((row,i)=>{
        const selected=i===index;
        const meta=row.querySelector('.pp-plan-meta');
        if(meta)meta.hidden=!selected;
        row.setAttribute('aria-expanded',String(selected));
        const plan=state.plans[i],unknown=plan?.supplierStock?.status==='unknown',out=!unknown&&!state.unavailable&&!inventoryFailed&&!plan?.canOrder;row.setAttribute('aria-disabled',String(out||unknown));row.tabIndex=out||unknown?-1:i===index?0:-1;
        const stock=row.querySelector('[data-plan-stock]');
        const showCount=!unknown&&!state.unavailable && !inventoryFailed && !state.salesDisabled && (!plan?.supplierStock||Number.isSafeInteger(plan.supplierStock.count)) && (plan?.tracked||Number.isSafeInteger(plan?.supplierStock?.count)) && Number.isSafeInteger(plan.available)
          && product.plans[i]?.stockVisibility!=='hide';
        if(stock){
          stock.hidden=!showCount;
          const label=showCount?`${plan.available} stokda`:'';
          if(stock.textContent!==label)stock.textContent=label;
        }
        let line=row.querySelector('[data-inventory-plan]');
        if(!line){line=document.createElement('span');line.dataset.inventoryPlan='';row.append(line);}
        line.className=out?'mpStockBadge cardStockBadge out inventory-plan-badge':'plan-fact plan-fact-stock inventory-plan-count';
        const supplierUnavailable=!!plan?.supplierStock&&(out||unknown);
        line.classList.toggle('supplier-stock-unavailable',supplierUnavailable);
        if(supplierUnavailable){line.dataset.supplierState=plan.supplierStock.status;if(line.parentElement!==row)row.append(line);}
        else if(plan?.supplierStock&&line.parentElement===row&&meta)meta.prepend(line);
        line.textContent=unknown?'Stok yoxlanıla bilmir':out?(plan?.supplierStock?.status==='out'?'Stokda bitib':'Stokda yoxdur'):!stock&&showCount?`${plan.available} stokda`:'';
        line.hidden=!unknown&&!out&&(!!stock||!showCount);
      });
      paintDelivery(product,rows,index);
    }finally{painting=false;}
  }
  let inventoryRequest=null,inventoryController=null,retryTimer=null,revision=0,failures=0,disposed=false;
  const activeRoute=()=>!window.MirpanelNavigation||['/','/mehsul'].includes(location.pathname)||location.pathname.startsWith('/mehsul/');
  function scheduleInventory(){clearTimeout(retryTimer);if(!document.hidden&&activeRoute()&&!disposed){const delay=Math.min(30000,3000*2**Math.min(failures-1,5));retryTimer=setTimeout(()=>void refreshInventory(),Math.round(delay*(.8+Math.random()*.4)));}}
  function cancelInventory(){revision++;inventoryController?.abort();inventoryController=null;inventoryRequest=null;clearTimeout(retryTimer);}
  function refreshInventory({force=false}={}){
    if(disposed||!activeRoute()||document.hidden)return Promise.resolve(false);
    if(inventoryRequest&&!force)return inventoryRequest;
    if(force)cancelInventory();clearTimeout(retryTimer);
    const run=++revision,controller=inventoryController=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    const pending=(async()=>{
      try{
        const base=window.MIRPANEL_PAYMENT_API||'https://mirpanel-frankfurt.onrender.com',url=base+'/api/payments/inventory',early=window.mirpanelInitialInventory;delete window.mirpanelInitialInventory;
        const initial=early?.url===url?await early.request.catch(()=>null):null;
        if(run!==revision||disposed)return false;
        // Consume a successful prefetch once; do not discard it after one second.
        const response=initial?.response?.ok?initial.response:await fetch(url,{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw Error('Inventory unavailable');const data=await response.json();if(!Array.isArray(data.products))throw Error('Invalid inventory');
        if(run!==revision||disposed)return false;
        inventory.clear();for(const row of data.products)inventory.set(row.productId,row);
        inventoryDisplayValid=true;inventoryFailed=false;failures=0;paintInventory();if(window.mirpanelHomeInstant&&location.pathname==='/')renderGrid();return true;
      }catch(error){
        if(run!==revision||disposed)return false;
        // Keep the last confirmed snapshot on transient failures. Checkout still
        // checks price and stock atomically on the server.
        inventoryFailed=true;failures++;paintInventory();if(window.mirpanelHomeInstant&&location.pathname==='/')renderGrid();scheduleInventory();return false;
      }finally{clearTimeout(timeout);if(inventoryRequest===pending){inventoryRequest=null;inventoryController=null;}}
    })();inventoryRequest=pending;return pending;
  }
  function instantPlans(product){return instantPlanIndices(product,stateFor(product).plans,{valid:inventoryDisplayValid&&!inventoryFailed});}
  window.MirpanelInventory={instantPlans,instantValid:()=>inventoryDisplayValid&&!inventoryFailed,instantFailed:()=>inventoryFailed,canOpenOrder,productState:stateFor,planState:planFor,refresh:refreshInventory,paint:paintInventory,dispose(){disposed=true;cancelInventory();clearInterval(inventoryTimer);clearInterval(homeSalesTimer);},async assertCanOrder(product,index){if(!await refreshInventory())throw Error('Stok məlumatı alınmadı. Yenidən cəhd edin.');if(!planFor(product,index)?.canOrder)throw Error('Stokda yoxdur.');}};
  document.addEventListener('click',event=>{
    const el=event.target.closest('.homeCardOrder,#pp-order-btn,#cartAddProduct,.pp-plan-label');if(!el)return;
    const product=el.classList.contains('homeCardOrder')?(typeof DATA!=='undefined'?DATA.products.find(p=>p.id===el.closest('[data-product-id]')?.dataset.productId):null):(typeof currentProduct!=='undefined'?currentProduct:null);if(!product)return;
    const rows=[...document.querySelectorAll('#pp-plans-container .pp-plan-label')];
    const unknown=stateFor(product).unavailable;const allowed=el.matches('.pp-plan-label')?(unknown||planFor(product,rows.indexOf(el))?.canOrder):el.matches('#pp-order-btn,#cartAddProduct')?canOpenOrder(product,currentPlanIdx):!stateFor(product).salesDisabled&&(unknown||stateFor(product).canOrder);
    if(!allowed){event.preventDefault();event.stopImmediatePropagation();return;}if(el.matches('.pp-plan-label'))setTimeout(paintInventory,0);
  },true);
  document.addEventListener('keydown',event=>{const row=event.target.closest('.pp-plan-label');if(!row||!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(event.key))return;const product=typeof currentProduct!=='undefined'?currentProduct:null;if(!product)return;event.preventDefault();event.stopImmediatePropagation();const rows=[...document.querySelectorAll('#pp-plans-container .pp-plan-label')],available=rows.filter((_,i)=>planFor(product,i)?.canOrder);if(!available.length)return;const at=available.indexOf(row),step=['ArrowUp','ArrowLeft'].includes(event.key)?-1:1,next=available[(at+step+available.length)%available.length];next.click();next.focus();},true);
  function startInventoryTimer(){clearInterval(inventoryTimer);clearInterval(homeSalesTimer);hydrateHomeCardSales();homeSalesTimer=setInterval(hydrateHomeCardSales,10000);paintInventory();refreshInventory();inventoryTimer=setInterval(()=>{paintInventory();refreshInventory();},15000);}
  function installCatalogAndDetail() {
    window.addEventListener("mirpanel:home-catalog-rendered", () => {
      hydrateHomeCardSales();
      paintInventory();
    });
    installCardRenderer();
    installDetailDecorator();
  }
  if (typeof renderGrid === "function") installCatalogAndDetail();
  else window.addEventListener("mirpanel:catalog-runtime-ready", installCatalogAndDetail, { once: true });
  startInventoryTimer();window.addEventListener('pagehide',()=>{clearInterval(inventoryTimer);clearInterval(homeSalesTimer);cancelInventory();});window.addEventListener('mirpanel:route-leave',()=>{clearInterval(inventoryTimer);clearInterval(homeSalesTimer);cancelInventory();});window.addEventListener('mirpanel:route-ready',e=>{if(['/','/mehsul'].includes(e.detail.path)||e.detail.path.startsWith('/mehsul/'))startInventoryTimer();});window.addEventListener('pageshow',event=>{if(event.persisted)startInventoryTimer();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){homeSalesCache.clear();refreshInventory();hydrateHomeCardSales();}});window.addEventListener('focus',()=>{homeSalesCache.clear();hydrateHomeCardSales();});window.addEventListener('online',()=>refreshInventory());
})();

(function () {
  const TOAST_ID = "netflixPinToast";
  const STYLE_ID = "netflixOrderFormFixStyles";

  function injectNetflixStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #modal.netflixOrderFormOpen .modalCard {
        border-color: rgba(229, 9, 20, .74) !important;
        background: radial-gradient(circle at 50% 0%, rgba(229, 9, 20, .18), transparent 42%), linear-gradient(180deg, rgba(18, 12, 13, .98), rgba(6, 6, 7, .98)) !important;
        box-shadow: 0 26px 80px rgba(0, 0, 0, .66), 0 0 38px rgba(229, 9, 20, .22) !important;
      }

      #modal.netflixOrderFormOpen .close {
        border-color: rgba(229, 9, 20, .22) !important;
        background: rgba(10, 10, 12, .72) !important;
      }

      .netflixOrderForm.premiumOrderForm { gap: 16px !important; }

      .netflixOrderForm .mpFormTitle {
        color: #ff2330 !important;
        background: linear-gradient(135deg, #fff 0%, #ff4b55 36%, #e50914 100%) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        text-shadow: 0 0 28px rgba(229, 9, 20, .32) !important;
      }

      .netflixOrderSubtitle {
        margin: -4px 0 4px;
        color: rgba(255, 255, 255, .68);
        font-size: 13px;
        line-height: 1.5;
        text-align: center;
      }

      .netflixOrderForm .universalField span { color: rgba(255, 238, 238, .94) !important; }

      .netflixOrderForm .universalField input {
        border-color: rgba(255, 255, 255, .16) !important;
        background: rgba(7, 7, 9, .86) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .045), 0 12px 30px rgba(0, 0, 0, .26) !important;
      }

      .netflixOrderForm .universalField input:focus {
        border-color: rgba(229, 9, 20, .86) !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 0 0 4px rgba(229, 9, 20, .13), 0 0 30px rgba(229, 9, 20, .20) !important;
      }

      .netflixOrderForm input[name="code_4"] {
        text-align: center;
        letter-spacing: .34em;
        font-size: 20px !important;
        font-weight: 900 !important;
      }

      .netflixOrderForm .mpBtn:not(.orderConfirmationCancel) {
        background: linear-gradient(135deg, #ff3340, #e50914 58%, #9f050d) !important;
        box-shadow: 0 14px 34px rgba(229, 9, 20, .30), inset 0 1px 0 rgba(255, 255, 255, .18) !important;
      }

      .netflixOrderForm .orderConfirmationCancel {
        background: linear-gradient(135deg, rgba(54, 57, 66, .95), rgba(21, 23, 28, .96)) !important;
      }

      @media (max-width: 600px) {
        #modal.netflixOrderFormOpen {
          align-items: flex-start !important;
          padding: calc(14px + env(safe-area-inset-top)) 0 18px !important;
        }

        #modal.netflixOrderFormOpen .modalCard {
          width: calc(100vw - 28px) !important;
          max-width: 500px !important;
          max-height: calc(100dvh - 120px) !important;
          overflow-y: auto !important;
          padding: 22px 18px 18px !important;
          border-radius: 22px !important;
          box-shadow: 0 18px 50px rgba(0, 0, 0, .64), 0 0 24px rgba(229, 9, 20, .20) !important;
        }

        #modal.netflixOrderFormOpen .close {
          top: 14px !important;
          right: 14px !important;
          padding: 9px 12px !important;
          border-radius: 12px !important;
          font-size: 13px !important;
        }

        .netflixOrderForm.premiumOrderForm {
          gap: 10px !important;
          padding: 0 !important;
        }

        .netflixOrderForm .mpFormTitle {
          max-width: calc(100% - 72px) !important;
          margin: 0 auto 4px !important;
          font-size: 28px !important;
          line-height: 1.08 !important;
          letter-spacing: 0 !important;
        }

        .netflixOrderSubtitle {
          margin: 0 0 8px !important;
          font-size: 14px !important;
          line-height: 1.35 !important;
        }

        .netflixOrderForm .premiumOrderFields {
          gap: 10px !important;
        }

        .netflixOrderForm .universalField {
          gap: 7px !important;
        }

        .netflixOrderForm .universalField span {
          font-size: 14px !important;
          line-height: 1.2 !important;
        }

        .netflixOrderForm .universalField input {
          min-height: 0 !important;
          height: 54px !important;
          padding: 0 16px !important;
          border-radius: 18px !important;
          font-size: 16px !important;
        }

        .netflixOrderForm input[name="code_4"] {
          height: 52px !important;
          font-size: 18px !important;
          letter-spacing: .26em !important;
        }

        .netflixOrderForm .orderConfirmationActions,
        .netflixOrderForm .premiumOrderActions {
          gap: 10px !important;
          margin-top: 8px !important;
        }

        .netflixOrderForm .mpBtn {
          min-height: 0 !important;
          height: 54px !important;
          padding: 0 16px !important;
          border-radius: 17px !important;
          font-size: 16px !important;
          line-height: 1 !important;
        }

        #modal.netflixOrderFormOpen .mBottom {
          margin-top: 10px !important;
          padding-top: 10px !important;
        }

        #modal.netflixOrderFormOpen .mInfo {
          font-size: 20px !important;
          line-height: 1.2 !important;
          margin: 0 !important;
        }

        #modal.netflixOrderFormOpen .mSmall {
          margin-top: 4px !important;
          font-size: 11px !important;
          line-height: 1.35 !important;
        }

        body.netflixOrderModalActive .gameFab,
        body.netflixOrderModalActive .waFab {
          opacity: 0 !important;
          pointer-events: none !important;
          transform: translateY(14px) scale(.96) !important;
        }
      }

      #${TOAST_ID} {
        position: fixed;
        top: calc(14px + env(safe-area-inset-top));
        left: 50%;
        z-index: 1000002;
        transform: translate(-50%, -16px);
        opacity: 0;
        pointer-events: none;
        max-width: min(420px, calc(100vw - 28px));
        padding: 12px 16px;
        border-radius: 999px;
        border: 1px solid rgba(229, 9, 20, .48);
        background: linear-gradient(135deg, rgba(34, 7, 9, .98), rgba(7, 7, 9, .96));
        color: #fff;
        font: 800 13px/1.2 Poppins, system-ui, sans-serif;
        text-align: center;
        box-shadow: 0 16px 44px rgba(0, 0, 0, .46), 0 0 26px rgba(229, 9, 20, .20);
        transition: opacity .2s ease, transform .2s ease;
      }

      #${TOAST_ID}.show {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    `;
    document.head.appendChild(style);
  }

  function showNetflixToast(message) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showNetflixToast.timer);
    showNetflixToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function isCode4Form(form) {
    return Boolean(form?.querySelector('input[name="code_4"]'));
  }

  function isNetflixCode4Form(form) {
    return isCode4Form(form) && !form?.classList?.contains("netflixPersonalForm") && String(form?.dataset?.productId || "").toLowerCase() === "netflix";
  }

  function cleanCodeInput(input) {
    const clean = input.value.replace(/\D/g, "").slice(0, 4);
    if (input.value !== clean) input.value = clean;
  }

  function decorateNetflixForm(form) {
    if (!isNetflixCode4Form(form) || form.dataset.netflixDecorated === "1") return;

    document.getElementById("modal")?.classList.add("netflixOrderFormOpen");
    document.body.classList.add("netflixOrderModalActive");
    form.classList.add("netflixOrderForm");
    form.dataset.netflixDecorated = "1";

    const title = form.querySelector(".mpFormTitle");
    if (title) {
      title.textContent = "Netflix profil məlumatları";
      if (!form.querySelector(".netflixOrderSubtitle")) {
        const subtitle = document.createElement("div");
        subtitle.className = "netflixOrderSubtitle";
        subtitle.textContent = "Profil adını və 4 rəqəmli otaq PIN kodunu qeyd edin.";
        title.insertAdjacentElement("afterend", subtitle);
      }
    }

    const nameInput = form.querySelector('input[name="name"]');
    if (nameInput) {
      nameInput.placeholder = nameInput.placeholder || "Profil adını yazın";
      nameInput.autocomplete = "name";
    }

    const codeInput = form.querySelector('input[name="code_4"]');
    if (codeInput) {
      codeInput.type = "text";
      codeInput.inputMode = "numeric";
      codeInput.maxLength = 4;
      codeInput.pattern = "\\d{4}";
      codeInput.autocomplete = "off";
      codeInput.placeholder = "••••";
      codeInput.setAttribute("aria-label", "4 rəqəmli otaq PIN kodu");
      cleanCodeInput(codeInput);
    }
  }

  injectNetflixStyles();

  const observer = new MutationObserver(() => {
    document.querySelectorAll("#universalOrderForm").forEach(decorateNetflixForm);
    const activeNetflixForm = [...document.querySelectorAll("#universalOrderForm")].some(isNetflixCode4Form);
    if (!activeNetflixForm) {
      document.getElementById("modal")?.classList.remove("netflixOrderFormOpen");
      document.body.classList.remove("netflixOrderModalActive");
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("input", (event) => {
    const input = event.target.closest?.('#universalOrderForm input[name="code_4"]');
    if (!input) return;
    cleanCodeInput(input);
  }, true);

  document.addEventListener("paste", (event) => {
    const input = event.target.closest?.('#universalOrderForm input[name="code_4"]');
    if (!input) return;
    event.preventDefault();
    const text = event.clipboardData?.getData("text") || "";
    input.value = text.replace(/\D/g, "").slice(0, 4);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, true);

  document.addEventListener("submit", (event) => {
    const form = event.target.closest?.("#universalOrderForm");
    if (!isCode4Form(form)) return;

    const input = form.querySelector('input[name="code_4"]');
    if (!input) return;
    cleanCodeInput(input);

    if (!/^\d{4}$/.test(input.value.trim())) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showNetflixToast("Sadəcə 4 rəqəm yazmalısınız");
      input.focus();
    }
  }, true);
})();
