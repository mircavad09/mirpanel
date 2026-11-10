(() => {
  "use strict";

  const emptyQuery = (tab = "pending") => ({
    tab,
    period: tab === "today" ? "today" : tab === "all" ? "this_month" : "all",
    search: "", productId: "", durationMonths: "", methodId: "", dateFrom: "", dateTo: "", sort: "newest", page: 1
  });
  const paymentState = {
    pendingStage: "payment",
    openOrders: new Map(), permissions: {},
    methods: [], orders: [], emails: [], selectedMethodId: "", knownPendingCount: null,
    orderActions: new Set(), methodActions: new Set(), orderQuery: emptyQuery(),
    selectedOrderIds: new Set(), batchBusy: false,
    costs: [], costDirty: new Set(), costSaving: false, costBackfillPreview: null, costBackfillBusy: false,
    orderMeta: { counts: { pending: 0, today: 0, all: 0, expiring: 0 }, statistics: {}, pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, filters: { products: [], plans: [], methods: [] }, appliedFilters: {}, selection: { ids: [], total: 0 } },
    monthlyReports: { current: null, archives: [], selectedMonth: "", archiveOpen: false },
    orderRequestSequence: 0
  };
  const $p = (id) => document.getElementById(id);
  const loadedFields = new WeakSet();
  const fieldRequests = new WeakMap();
  const fieldsObserver = new IntersectionObserver(entries=>{for(const {target,isIntersecting} of entries)if(isIntersecting){fieldsObserver.unobserve(target);void loadCardFields(target);}});
  const mobileOrderFilters = () => matchMedia("(max-width:650px)").matches;
  const orderPages = new Map();
  const orderRequests = new Map();
  const deliveryPreviewRequests = new Map();
  const orderCardVersions = new Map();
  let lastOrderMarkup = null, cardVersion = 0;
  let visibleOrderPage = "";
  let orderRevision = 0;
  let orderCountRequest;
  const escp = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const statusLabel = { reviewing: "Yoxlanılır", preparing: "Təhvil gözlənilir", completed: "Tamamlandı", rejected: "Rədd edilib", expired: "Vaxtı bitib", cancelled:"Ləğv edildi", partial_cancelled:"Qismən ləğv edildi" };
  const methodStatusLabel = { active: "Aktiv", inactive: "Deaktiv", pending: "Gözləmədə", temporarily_busy: "Müvəqqəti rezervdədir", limit_reached: "Limit dolub", deleted: "Silinib" };

  async function paymentApi(path, options) { return api(path, options); }
  const money = (value, currency = "AZN") => `${Number(value || 0).toFixed(2)} ${currency === "AZN" ? "₼" : currency}`;
  const dateTime = (value) => value ? new Date(value).toLocaleString("az-AZ", { timeZone: "Asia/Baku" }) : "—";
  const orderTimeFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  });
  function orderTimeMarkup(value, id) {
    const clock = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round"/></svg>';
    const date = value ? new Date(value) : null;
    if (!date || !Number.isFinite(date.getTime())) {
      return `<span id="${id}" class="paymentOrderCreatedAt">${clock}Sifariş vaxtı məlum deyil</span>`;
    }
    const {day,month,year,hour,minute} = Object.fromEntries(orderTimeFormat.formatToParts(date).map(({type,value})=>[type,value]));
    return `<time id="${id}" class="paymentOrderCreatedAt" datetime="${date.toISOString()}">${clock}${day}.${month}.${year}, ${hour}:${minute}</time>`;
  }
  const azMonths = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
  const monthLabel = (value) => {
    const match = /^(\d{4})-(\d{2})-01$/.exec(String(value || ""));
    if (!match) return "—";
    const month = azMonths[Number(match[2]) - 1];
    return month ? `${month.charAt(0).toLocaleUpperCase("az-AZ")}${month.slice(1)} ${match[1]}` : "—";
  };
  const fullDateLabel = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return "Tarix yoxdur";
    return `${Number(match[3])} ${azMonths[Number(match[2]) - 1]} ${match[1]}`;
  };
  const nextMonthLastDay = (monthStart) => {
    const match = /^(\d{4})-(\d{2})-01$/.exec(String(monthStart || ""));
    if (!match) return "";
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  };
  const formatNumber = (value) => String(value || "").replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  function resolvedTheme(theme, providerName, type) {
    if (theme && theme !== "auto") return theme;
    const provider = String(providerName || "").toLocaleLowerCase("az-AZ");
    if (provider.includes("leo")) return "leo";
    if (provider.includes("abb")) return "abb";
    if (/kapital|birbank/.test(provider)) return "kapital";
    if (provider.includes("m10") || type === "wallet") return "m10";
    return "neutral";
  }

  function methodCard(method) {
    const full = method.limitMode !== "unlimited" && method.occupiedToday >= method.dailyLimit;
    const limit = method.limitMode === "unlimited" ? "Limitsiz" : `${full ? "Gündəlik limit dolub" : "Gündəlik istifadə"} · ${method.occupiedToday}/${method.dailyLimit} · Təsdiqlənib: ${method.confirmedToday}`;
    const remaining = method.limitMode === "unlimited" ? "Qalan limit: limitsiz" : `Qalan limit: ${method.remaining}`;
    const reset = method.lastResetAt ? dateTime(method.lastResetAt) : "Bu gün sayğac yaradılmayıb";
    const nextReset = method.nextResetAt ? dateTime(method.nextResetAt) : "—";
    const status = method.status || (method.active ? "active" : "inactive");
    const reason = !method.hasNumber ? "Tam nömrə daxil edilməyib" : (methodStatusLabel[status] || "Deaktiv");
    const actions = `<button class="btn" type="button" data-edit-payment-method="${escp(method.id)}">Redaktə et</button><button class="btn" type="button" data-toggle-payment-method="${escp(method.id)}" data-next-active="${method.active ? "false" : "true"}">${method.active ? "Deaktiv et" : "Aktiv et"}</button><button class="btn danger" type="button" data-delete-payment-method="${escp(method.id)}">Sil</button>`;
    return `<article class="paymentMethodAdminCard${method.available ? " isAvailable" : ""}" data-payment-method-id="${escp(method.id)}">
      <div class="paymentMethodColor" style="--payment-method-color:${escp(method.color)}"></div>
      <div><strong>${escp(method.displayName)}</strong><span>${escp(method.adminMaskedNumber || method.maskedNumber)} · ${escp(method.providerName)}</span><small>${escp(limit)} · Aktiv rezerv: ${Number(method.activeReservations)} · Yoxlanılan çek: ${Number(method.reviewingReceipts)}</small><small>${escp(remaining)} · Son sıfırlanma: ${escp(reset)} · Növbəti sıfırlanma: ${escp(nextReset)}</small><small>${escp(reason)}</small></div>
      <div class="paymentMethodAdminActions"><span class="statusPill ${status === "active" ? "ok" : status === "limit_reached" ? "danger" : ""}">${escp(methodStatusLabel[status] || "Deaktiv")}</span>${actions}</div>
    </article>`;
  }

  function renderMethods() {
    const list = $p("paymentMethodsList");
    if (!list) return;
    if(!$p('paymentBackgroundsLink'))list.insertAdjacentHTML('beforebegin','<p id="paymentBackgroundsLink"><button class="btn" type="button" data-open-decorations>Bank fonları — Şəkillər və fonlar</button></p>');
    list.innerHTML = paymentState.methods.length ? paymentState.methods.map(methodCard).join("") : '<div class="emptyState">Ödəniş üsulu tapılmadı.</div>';
    if (paymentState.selectedMethodId) renderMethodEditor(paymentState.methods.find((item) => item.id === paymentState.selectedMethodId));
  }

  let bankBackgroundState={banks:{kapital:'Birbank / Kapital Bank',m10:'m10',abb:'ABB',leo:'Leobank','wallet-card':'Böyük balans kartı'},backgrounds:{},busy:new Set(),error:''};
  const decorationDescriptions={kapital:'Bütün Birbank/Kapital Bank kartları · hər iki ödəniş mərhələsi',m10:'Bütün m10 kartları · hər iki ödəniş mərhələsi',abb:'Bütün ABB kartları · hər iki ödəniş mərhələsi',leo:'Bütün Leobank kartları · hər iki ödəniş mərhələsi','wallet-card':'Balans səhifəsi · Mövcud balans kartı'};
  function renderBankBackgrounds(){
    const host=$p('paymentBankBackgrounds');if(!host)return;
    const groups=[['Bank kartı fonları',['kapital','m10','abb','leo']],['Balans səhifəsi',['wallet-card']]];
    host.innerHTML='<p>PNG, JPG, WebP · maksimum 5 MB. Dəyişiklik saxlanandan sonra avtomatik tətbiq olunur.</p>'+(bankBackgroundState.error?`<p role="alert">${escp(bankBackgroundState.error)}</p>`:'')+groups.map(([title,keys])=>'<h3>'+title+'</h3><div class="paymentBankBackgroundGrid">'+keys.map(key=>{
      const name=bankBackgroundState.banks[key],url=bankBackgroundState.backgrounds[key],busy=bankBackgroundState.busy.has(key);
      return `<article data-decoration-card="${key}"><strong>${escp(name)}</strong><p>${escp(decorationDescriptions[key])}</p>${(url||key==='wallet-card')?`<div class="decorationChecker"><img src="${escp(url||'https://mirpanel.com/assets/wallet/balance-gold.png')}" alt="${escp(name)} fon önizləməsi"></div>`:'<div class="paymentBankEmpty">Standart görünüş</div>'}<label class="btn">${busy?'Saxlanılır…':url?'Dəyiş':'Yüklə'}<input aria-label="${escp(name)} — şəkil seç" type="file" accept="image/png,image/jpeg,image/webp" data-bank-background="${key}" ${busy?'disabled':''}></label><button class="btn" type="button" data-bank-background-remove="${key}" ${!url||busy?'disabled':''}>Sil</button></article>`;
    }).join('')+'</div>').join('');
  }
  async function loadBackgrounds(){
    try{const r=await paymentApi('/api/admin/payment-backgrounds');bankBackgroundState.backgrounds=r.backgrounds;bankBackgroundState.error='';}catch(e){bankBackgroundState.error=e.message||'Fonlar yüklənmədi.';}renderBankBackgrounds();
  }
  async function changeBankBackground(key,file,remove=false){
    if(bankBackgroundState.busy.has(key))return;
    if(remove&&!await paymentActionDialog({title:'Fonu sil',message:bankBackgroundState.banks[key]+' fonu silinsin? Standart görünüş bərpa olunacaq.',confirmText:'Sil',danger:true}))return;
    if(!remove&&(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5242880)){toast('PNG, JPG və ya WebP seçin. Maksimum 5 MB.');return;}
    bankBackgroundState.busy.add(key);bankBackgroundState.error='';renderBankBackgrounds();
    try{const r=await paymentApi('/api/admin/payment-backgrounds/'+key+(remove?'/remove':''),{method:'POST',...(remove?{body:'{}'}:{body:file,headers:{'Content-Type':file.type}})});bankBackgroundState.backgrounds=r.backgrounds;toast(remove?'Fon silindi.':'Fon saxlanıldı.');try{localStorage.setItem('mirpanel.decorations.updated',String(Date.now()));}catch{}}
    catch(e){bankBackgroundState.error=e.message||'Fon saxlanmadı. Yenidən cəhd edin.';toast(bankBackgroundState.error);}
    finally{bankBackgroundState.busy.delete(key);renderBankBackgrounds();}
  }

  function renderMethodEditor(method = null) {
    const host = $p("paymentMethodEditor");
    if (!host) return;
    const isNew = !method;
    const value = method || { displayName: "", type: "bank_card", providerName: "", holderName: "", color: "#151515", icon: "card", theme: "auto", active: false, order: paymentState.methods.length + 1, dailyLimit: 5, limitMode: "limited", adminNote: "", maskedNumber: "", activeReservations: 0, reviewingReceipts: 0 };
    const previewTheme = resolvedTheme(value.theme, value.providerName, value.type);
    host.innerHTML = `<form id="paymentMethodForm" class="paymentMethodEditorCard" autocomplete="off">
      <div class="sectionHead"><div><h3>${isNew ? "Yeni ödəniş üsulu" : escp(value.displayName)}</h3><p>${isNew ? "Tam nömrə yalnız şifrələnmiş formada saxlanacaq." : `Hazırkı nömrə: ${escp(value.adminMaskedNumber || value.maskedNumber)}. Dəyişmək üçün yeni tam nömrə daxil edin.`}</p></div><button class="btn" type="button" data-close-payment-editor>Bağla</button></div>
      <fieldset class="paymentMethodFieldset"><legend>Əsas məlumatlar</legend><div class="formGrid">
        <label>Göstərilən ad<input name="displayName" required maxlength="80" value="${escp(value.displayName)}"></label>
        <label>Növ<select name="type"><option value="bank_card"${value.type === "bank_card" ? " selected" : ""}>Bank kartı</option><option value="wallet"${value.type === "wallet" ? " selected" : ""}>Elektron cüzdan</option></select></label>
        <label>Bank/xidmət adı<input name="providerName" required maxlength="80" value="${escp(value.providerName)}"></label>
        <label>Kart/cüzdan sahibi<input name="holderName" maxlength="120" value="${escp(value.holderName)}"></label>
        <label>${isNew ? "Tam nömrə" : "Yeni tam nömrə — dəyişmirsə boş saxla"}<input name="fullNumber" type="text" inputmode="numeric" autocomplete="off" ${isNew ? "required" : ""} minlength="7" maxlength="23" placeholder="4098 5844 9937 4419"><small>Nömrə saxlanıldıqdan sonra brauzerə geri qaytarılmır.</small></label>
      </div></fieldset>
      <fieldset class="paymentMethodFieldset"><legend>Kartın görünüşü</legend><div class="formGrid">
        <label>Rəng mövzusu<select name="theme"><option value="auto"${value.theme === "auto" ? " selected" : ""}>Avtomatik</option><option value="leo"${value.theme === "leo" ? " selected" : ""}>LeoBank</option><option value="abb"${value.theme === "abb" ? " selected" : ""}>ABB</option><option value="kapital"${value.theme === "kapital" ? " selected" : ""}>Kapital Bank</option><option value="m10"${value.theme === "m10" ? " selected" : ""}>M10</option><option value="neutral"${value.theme === "neutral" ? " selected" : ""}>Neytral</option></select><small>Avtomatik seçim bank adına görə müştəri kartının rəngini təyin edir.</small></label>
        <label>Rəng<input name="color" type="color" value="${escp(value.color)}"></label>
        <label>İkon<select name="icon"><option value="card"${value.icon === "card" ? " selected" : ""}>Kart</option><option value="bank"${value.icon === "bank" ? " selected" : ""}>Bank</option><option value="wallet"${value.icon === "wallet" ? " selected" : ""}>Cüzdan</option></select></label>
        <div class="paymentThemePreview theme-${escp(previewTheme)}" data-payment-theme-preview><small>Kart dizaynı</small><strong>${escp(value.providerName || "Bank adı")}</strong><span>${escp(value.maskedNumber || "•••• 0000")}</span></div>
      </div></fieldset>
      <fieldset class="paymentMethodFieldset"><legend>Limit və görünmə</legend><div class="formGrid">
        <label>Sıra<input name="order" type="number" min="1" value="${Number(value.order)}"></label>
        <label>Gündəlik limit<input name="dailyLimit" type="number" min="1" max="10000" value="${Number(value.dailyLimit)}"></label>
        <label>Limit rejimi<select name="limitMode"><option value="limited"${value.limitMode === "limited" ? " selected" : ""}>Məhdud</option><option value="unlimited"${value.limitMode === "unlimited" ? " selected" : ""}>Limitsiz</option></select></label>
        <label class="paymentActiveToggle"><input name="active" type="checkbox" role="switch" aria-describedby="paymentActiveHelp"${value.active ? " checked" : ""}><span aria-hidden="true"></span><b data-payment-active-label>${value.active ? "Aktivdir" : "Deaktivdir"}</b></label>
        <p id="paymentActiveHelp" class="wide paymentFieldHelp">Deaktiv edilən kart yeni checkout seçimindən dərhal çıxır; mövcud rezervlər və sifariş tarixçəsi qorunur.</p>
        <label class="wide">Administrator qeydi<textarea name="adminNote" maxlength="2000">${escp(value.adminNote)}</textarea></label>
      </div></fieldset>
      <div class="paymentEditorActions"><button class="btn primary" type="submit">Yadda saxla</button>${!isNew ? '<button class="btn" type="button" data-reset-payment-counter>Bugünkü sayğacı sıfırla</button><button class="btn danger" type="button" data-delete-payment-method>Kartı sil</button>' : ""}</div>
    </form>`;
  }

  async function loadMethods() {
    const [methodResult, settingsResult] = await Promise.all([paymentApi("/api/admin/payment-methods"), paymentApi("/api/admin/payment-settings")]);
    if (!Array.isArray(methodResult.methods)) throw Error("Kart istifadəsi məlumatı alınmadı. Yenidən yoxlayın.");
    paymentState.methods = methodResult.methods;
    renderMethods();
    if ($p("paymentNotificationEmail")) $p("paymentNotificationEmail").value = settingsResult.settings?.notificationEmail || "";
    if ($p("paymentReceiptRetentionDays")) $p("paymentReceiptRetentionDays").value = settingsResult.settings?.receiptRetentionDays || 90;
  }

  function orderLineText(line, amount, currency) {
    const price = Number(amount).toFixed(2).replace('.',',');
    return [line.title,line.planName,`${line.quantity} ədəd`,`${price} ${!currency||currency==='AZN'?'₼':currency}`].filter(Boolean).join(' · ');
  }
  function orderCard(order) {
    const tab = paymentState.orderQuery.tab;
    const pending = tab === "pending";
    const expiring = tab === "expiring";
    const deliveryQueue = pending && paymentState.pendingStage === "delivery";
    const expanded = paymentState.openOrders.get(order.id) ?? !matchMedia("(max-width:650px)").matches;
    const {fields,manage}=paymentState.permissions;
    const displayStatus = deliveryQueue || order.deliveryPending ? "preparing" : order.status;
    const reviewing = pending && displayStatus === "reviewing" && !order.paymentConfirmed;
    const lines = order.items?.length ? order.items.map(line=>orderLineText(line,line.unitCents*line.quantity/100,order.currency)) : [orderLineText({title:order.productTitle,planName:order.planName,quantity:order.quantity||1},order.amount,order.currency)];
    const customer = [order.customerName,order.customerNumber?'#'+order.customerNumber:''].filter(Boolean).join(' · ') || 'Məlumat yoxdur';
    const method = order.paymentSource==='wallet' ? 'MirPanel balansı' : order.paymentMethodLabel || 'Məlumat yoxdur';
    const selected = expiring && paymentState.selectedOrderIds.has(order.id);
    const product = order.items?.length ? [...new Set(order.items.map(x=>x.title).filter(Boolean))].join(' + ') : order.productTitle;
    const detailId = `paymentOrderDetails-${escp(order.id)}`;
    const timeId = `paymentOrderCreatedAt-${escp(order.id)}`;
    const signature=JSON.stringify([order,tab,deliveryQueue,expanded,fields,manage,selected]);
    let version=orderCardVersions.get(order.id);
    if(version?.signature!==signature){
      orderCardVersions.delete(order.id);
      orderCardVersions.set(order.id,version={signature,id:++cardVersion});
      if(orderCardVersions.size>400)orderCardVersions.delete(orderCardVersions.keys().next().value);
    }
    return `<article class="paymentOrderAdminCard${selected ? " isSelected" : ""}" data-payment-order-id="${escp(order.id)}" data-order-code="${escp(order.orderCode)}" data-order-render-version="${version.id}">
      <div class="paymentOrderCardHeader">${expiring ? `<label class="paymentOrderSelect"><input type="checkbox" data-expiring-order-select aria-label="${escp(order.orderCode)} sifarişini seç"${selected ? " checked" : ""}></label>` : ""}
        <strong class="paymentOrderCardNumber">№ ${escp(order.orderCode)}</strong>
        <button class="btn compact" type="button" data-copy-order-id aria-label="${escp(order.orderCode)} sifariş nömrəsini kopyala">Kopyala</button>
        <button class="paymentOrderCardToggle" type="button" data-order-toggle aria-label="Sifariş № ${escp(order.orderCode)}" aria-expanded="${expanded}" aria-controls="${detailId}" aria-describedby="${timeId}"><span class="paymentOrderCardMeta"><span class="statusPill status-${escp(expiring ? order.expiry?.code : displayStatus)}">${escp(expiring ? order.expiry?.label : statusLabel[displayStatus] || "Yoxlanılır")}</span>${orderTimeMarkup(order.createdAt,timeId)}</span><span class="paymentOrderCardPreview">${escp(product)}</span><b class="paymentOrderCardPreview">${escp(money(order.amount,order.currency))}</b><span class="paymentOrderCardArrow" aria-hidden="true">⌄</span></button>
      </div>
      <div class="paymentOrderCardDetails" id="${detailId}"${expanded?'':' hidden'}>
      <dl><div><dt>Məhsul</dt><dd><ul>${lines.map((line,index)=>`<li>${escp(line)}${order.remainingDelivery?.[index]!=null?` <small>· ${Number(order.remainingDelivery[index])} ədəd qalıb</small>`:''}${fields?`<div class="paymentOrderLineFields" data-order-line-fields="${index}"></div>`:''}</li>`).join('')}</ul></dd></div><div><dt>Ödəniş üsulu</dt><dd>${escp(method)}</dd></div><div><dt>Müştəri</dt><dd>${escp(customer)}</dd></div>${order.reportCost!==undefined?`<div><dt>Maya</dt><dd>${order.reportCost===null?'Maya məlum deyil':money(order.reportCost)+(order.reportEstimated?' · Təxmini':'')}</dd></div>`:''}${order.cancellation?.reason?'<div><dt>Ləğv səbəbi</dt><dd style="white-space:pre-wrap">'+escp(order.cancellation.reason)+'</dd></div>':''}</dl>
      <div class="paymentOrderActions">
        ${manage && displayStatus==='preparing'?'<button class="btn primary" type="button" data-order-delivery>Təhvil ver</button>':''}
        ${manage && deliveryQueue?'<button class="btn danger" type="button" data-cancel-fulfillment>Ləğv et</button>':''}
        ${order.cancellation?`<small>${escp(order.cancellation.refundStatus==='wallet_refunded'?'Balansa qaytarılıb: ':'Kart üzrə əl ilə qaytarılmalıdır: ')}${escp(money(order.cancellation.refundCents/100,order.currency))}</small>`:''}
        ${manage && order.receiptAvailable && !deliveryQueue ? '<button class="btn" type="button" data-open-receipt>Çeki aç</button>' : ''}
        ${manage && reviewing ? order.workforce?.ownerRole==='employee' ? `<button class="btn" type="button" data-review-employee="${escp(order.id)}">Yoxla</button>` : '<button class="btn primary" type="button" data-approve-payment>Ödənişi təsdiqlə</button><button class="btn danger" type="button" data-reject-payment>Rədd et</button>' : ''}
        ${expiring ? '<button class="btn primary" type="button" data-contacted-payment>Əlaqə saxlanıldı</button>' : ""}
      </div></div>
    </article>`;
  }

  function paintCardFields(card, lines = []) {
    for(const host of card.querySelectorAll('[data-order-line-fields]')){
      const fields=lines.find(x=>x.index===Number(host.dataset.orderLineFields))?.fields||[];
      const filled=fields.filter(f=>typeof f.value==='string'&&f.value.trim());
      host.innerHTML=filled.length?`<button class="btn compact paymentOrderFieldsCopy" type="button" data-copy-order-fields aria-label="Müştəri məlumatlarını kopyala" title="Müştəri məlumatlarını kopyala"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button><div class="paymentOrderFieldValues">`+filled.map(f=>`<div><strong data-order-field-label>${escp(f.label)}</strong>: <span data-order-field-value>${escp(f.value)}</span></div>`).join('')+'</div>':'';
    }
  }

  function clearCardFields(card) {
    fieldRequests.delete(card);
    loadedFields.delete(card);
    paintCardFields(card);
  }

  async function loadCardFields(card) {
    const visible=()=>paymentState.permissions.fields&&!document.hidden&&card.isConnected&&
      !card.querySelector('.paymentOrderCardDetails')?.hidden&&!card.closest('.workspace.hidden,.singlePanel.hidden');
    if(!visible()||loadedFields.has(card)||fieldRequests.has(card))return;
    const host=card.querySelector('[data-order-line-fields]');
    if(!host)return;
    host.textContent='Sifariş sahələri yüklənir…';
    const request=paymentApi('/api/admin/payment-orders/'+card.dataset.paymentOrderId+'/details');
    fieldRequests.set(card,request);
    try{
      const {lines}=await request;
      if(fieldRequests.get(card)===request&&visible()){
        paintCardFields(card,lines);
        loadedFields.add(card);
      }
    }catch{
      if(fieldRequests.get(card)===request&&visible())host.innerHTML='<button class="btn compact" type="button" data-retry-order-fields>Sifariş sahələri alınmadı · Yenidən cəhd et</button>';
    }finally{
      if(fieldRequests.get(card)===request)fieldRequests.delete(card);
    }
  }

  function updateOrderCounts(counts = paymentState.orderMeta.counts) {
    paymentState.orderMeta.counts = counts;
    for (const [key, id] of Object.entries({ pending: "paymentPendingCount", delivery: "paymentDeliveryCount", today: "paymentTodayCount", all: "paymentAllCount", expiring: "paymentExpiringCount" })) {
      if ($p(id)) $p(id).textContent = String(counts[key] || 0);
    }
    const nav = document.querySelector('.navBtn[data-view="paymentOrders"]');
    if (nav) {
      const pending = Number(counts.pendingTotal ?? counts.pending ?? 0);
      nav.dataset.pendingCount = String(pending);
      delete nav.dataset.attentionCount;
      nav.setAttribute("aria-label", pending ? `Sifarişlər, ${pending} gözləyən sifariş` : "Sifarişlər");
    }
  }

  function populateOrderFilters(filters = paymentState.orderMeta.filters) {
    const fill = (id, empty, rows, value, getValue, getLabel) => {
      const select = $p(id); if (!select) return;
      select.innerHTML = `<option value="">${escp(empty)}</option>` + (rows || []).map((item) => `<option value="${escp(getValue(item))}">${escp(getLabel(item))}</option>`).join("");
      select.value = value;
    };
    fill("paymentOrderProduct", "Bütün məhsullar", filters.products, paymentState.orderQuery.productId, (item) => item.id, (item) => item.title);
    fill("paymentOrderPlan", "Bütün müddətlər", filters.durations, paymentState.orderQuery.durationMonths, (item) => item.value, (item) => item.label);
    fill("paymentOrderMethod", "Bütün banklar", filters.methods, paymentState.orderQuery.methodId, (item) => item.id, (item) => item.label);
  }

  function reportCostLabel(report) {
    if (report.missingCostCount && !Number(report.cost)) return "Maya məlum deyil";
    return money(report.cost) + (report.missingCostCount ? " · məlum hissə" : report.estimatedCostCount ? " · təxmini" : "");
  }

  function reportProfitLabel(report) {
    return report.missingCostCount ? "Maya məlum deyil" : money(report.profit) + (report.estimatedCostCount ? " · təxmini" : "");
  }

  function reportPrimaryMarkup(report, emptyText = "Bu dövr üçün tamamlanmış sifariş yoxdur.") {
    if (!report) return `<div class="emptyState">${escp(emptyText)}</div>`;
    return `<div class="paymentMonthlyMetric"><small>Tamamlanmış sifariş</small><strong>${Number(report.completedCount || 0)}</strong></div>
      <div class="paymentMonthlyMetric"><small>Ümumi satış</small><strong>${money(report.revenue)}</strong></div>
      <div class="paymentMonthlyMetric"><small>Ümumi maya</small><strong>${reportCostLabel(report)}</strong></div>
      <div class="paymentMonthlyMetric ${Number(report.profit) < 0 ? "bad" : ""}"><small>Xalis qazanc</small><strong>${reportProfitLabel(report)}</strong></div>`;
  }

  function reportBreakdownMarkup(report) {
    const products = (report?.products || []).slice(0, 8);
    const plans = (report?.plans || []).slice(0, 12);
    const methods = (report?.paymentMethods || []).slice(0, 12);
    return `<div class="paymentMonthlyBreakdown"><b>Ən çox satılan məhsullar</b>${products.length ? products.map((item) => `<span>${escp(item.title)} · ${Number(item.count)} satış</span>`).join("") : "<span>—</span>"}</div>
      <div class="paymentMonthlyBreakdown"><b>Planlar üzrə hesabat</b>${plans.length ? plans.map((item) => `<span>${escp(item.productTitle)} · ${escp(item.planName)} · ${Number(item.count)} satış</span>`).join("") : "<span>—</span>"}</div>
      <div class="paymentMonthlyBreakdown"><b>Ödəniş üsulu üzrə satış</b>${methods.length ? methods.map((item) => `<span>${escp(item.label)} · ${Number(item.count)} satış · ${money(item.revenue)}</span>`).join("") : "<span>—</span>"}</div>`;
  }

  function renderMonthlyReports() {
    const state = paymentState.monthlyReports;
    const select = $p("paymentMonthlyArchiveMonth");
    if (!select) return;
    if (!state.selectedMonth && state.archives[0]) state.selectedMonth = state.archives[0].monthStart;
    select.innerHTML = state.archives.length ? state.archives.map((item) => `<option value="${escp(item.monthStart)}"${item.monthStart === state.selectedMonth ? " selected" : ""}>${escp(monthLabel(item.monthStart))}</option>`).join("") : '<option value="">Bağlanmış ay yoxdur</option>';
  }

  async function loadMonthlyReports() {
    const result = await paymentApi("/api/admin/payment-monthly-reports");
    paymentState.monthlyReports.current = result.current || null;
    paymentState.monthlyReports.archives = result.archives || [];
    renderMonthlyReports();
  }

  function syncOrderFilterControls() {
    const query = paymentState.orderQuery;
    if ($p("paymentOrderPeriod")) $p("paymentOrderPeriod").value = query.period;
    if ($p("paymentOrderDateFrom")) $p("paymentOrderDateFrom").value = query.dateFrom;
    if ($p("paymentOrderDateTo")) $p("paymentOrderDateTo").value = query.dateTo;
    document.querySelectorAll(".paymentCustomDate").forEach((item) => item.classList.toggle("isActive", query.period === "custom"));
    validateCustomDates(false);
  }

  function validateCustomDates(showMessage = true) {
    const custom = ($p("paymentOrderPeriod")?.value || paymentState.orderQuery.period) === "custom";
    const from = $p("paymentOrderDateFrom")?.value || ""; const to = $p("paymentOrderDateTo")?.value || "";
    let message = "";
    if (custom && (!from || !to)) message = "Başlanğıc və son tarixini seçin.";
    else if (custom && from > to) message = "Başlanğıc tarixi son tarixdən böyük ola bilməz.";
    const error = $p("paymentOrderDateError"); if (error) error.textContent = showMessage ? message : "";
    const apply = $p("paymentOrderFiltersApply"); if (apply) apply.disabled = Boolean(message);
    return !message;
  }

  function readOrderFilterControls() {
    Object.assign(paymentState.orderQuery, {
      search: $p("paymentOrderSearch")?.value.trim() || "", productId: $p("paymentOrderProduct")?.value || "",
      durationMonths: $p("paymentOrderPlan")?.value || "", methodId: $p("paymentOrderMethod")?.value || "",
      period: $p("paymentOrderPeriod")?.value || "all", dateFrom: $p("paymentOrderDateFrom")?.value || "",
      dateTo: $p("paymentOrderDateTo")?.value || "", sort: $p("paymentOrderSort")?.value || "newest", page: 1
    });
  }

  function renderOrderContext() {
    const tab = paymentState.orderQuery.tab;
    $p("paymentPendingStages")?.toggleAttribute("hidden",tab!=="pending");
    document.querySelectorAll("[data-payment-pending-stage]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.paymentPendingStage===paymentState.pendingStage)));
    $p("paymentMonthlyReports")?.toggleAttribute("hidden", !["today", "all"].includes(tab));
    $p("paymentMonthlyArchivePanel")?.toggleAttribute("hidden", tab !== "all");
    document.querySelectorAll("[data-payment-order-tab]").forEach((button) => {
      const active = button.dataset.paymentOrderTab === tab;
      button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active));
    });
    syncOrderFilterControls();
  }

  function clearOrderSelection() {
    paymentState.selectedOrderIds.clear();
    renderBatchControls();
  }

  function renderBatchControls() {
    const expiring = paymentState.orderQuery.tab === "expiring";
    const panel = $p("paymentExpiringBatch");
    panel?.toggleAttribute("hidden", !expiring);
    if (!expiring) return;
    const allowed = new Set(paymentState.orderMeta.selection?.ids || []);
    for (const id of [...paymentState.selectedOrderIds]) if (!allowed.has(id)) paymentState.selectedOrderIds.delete(id);
    const count = paymentState.selectedOrderIds.size;
    const total = Number(paymentState.orderMeta.selection?.total || 0);
    if ($p("paymentSelectAllFiltered")) $p("paymentSelectAllFiltered").textContent = `Filtrdəki bütün nəticələri seç (${total})`;
    if ($p("paymentConfirmSelected")) {
      $p("paymentConfirmSelected").textContent = count ? `${count} sifarişi təsdiqlə` : "Seçilənləri təsdiqlə";
      $p("paymentConfirmSelected").disabled = !count || paymentState.batchBusy;
    }
    for (const button of [$p("paymentSelectPage"), $p("paymentSelectAllFiltered"), $p("paymentClearSelection")]) if (button) button.disabled = paymentState.batchBusy;
    document.querySelectorAll("[data-expiring-order-select]").forEach((input) => {
      const card = input.closest("[data-payment-order-id]");
      input.checked = paymentState.selectedOrderIds.has(card?.dataset.paymentOrderId || "");
      input.disabled = paymentState.batchBusy;
      card?.classList.toggle("isSelected", input.checked);
    });
  }

  async function setOrderTab(tab) {
    const safeTab = ["pending", "today", "all", "expiring"].includes(tab) ? tab : "pending";
    paymentState.orderQuery = emptyQuery(safeTab);
    clearOrderSelection();
    renderOrderContext();
    if (["today", "all"].includes(safeTab)) void loadMonthlyReports().catch(() => {});
    await loadOrders();
  }

  async function submitMobileOrderFilters(clear = false) {
    if (!clear && !validateCustomDates(true)) return;
    if (clear) {
      $p("paymentOrderFilters")?.reset();
      paymentState.orderQuery = emptyQuery(paymentState.orderQuery.tab);
      renderOrderContext();
    } else readOrderFilterControls();
    clearOrderSelection();
    validateCustomDates(false);
    await loadOrders();
  }

  function renderStatistics() {
    const host = $p("paymentCurrentMonthReport"); const breakdown = $p("paymentCurrentMonthBreakdown");
    const label = $p("paymentCurrentMonthLabel"); const title = $p("paymentReportTitle");
    if (!host) return;
    const stats = paymentState.orderMeta.statistics || {};
    if (!["today", "all"].includes(paymentState.orderQuery.tab)) { host.innerHTML = ""; if (breakdown) breakdown.innerHTML = ""; return; }
    host.innerHTML = reportPrimaryMarkup({ ...stats, completedCount: stats.count }) +
      (stats.missingCostCount ? `<p class="warningBox">Maya məlum deyil: ${Number(stats.missingCostCount)} sifariş.</p>` : "") +
      (stats.estimatedCostCount ? `<p class="warningBox">Cari maya ilə təxmini hesablanıb: ${Number(stats.estimatedCostCount)} sifariş.</p>` : "");
    if (breakdown) breakdown.innerHTML = reportBreakdownMarkup(stats);
    const today = paymentState.orderMeta.appliedFilters?.period === "today";
    if (title) title.textContent = today ? "Bu günün hesabatı" : "Filtr üzrə maliyyə hesabatı";
    if (label) label.textContent = today ? "Bakı vaxtı ilə bu gün tamamlanan sifarişlər" : `${fullDateLabel(paymentState.orderMeta.appliedFilters?.dateFrom)} – ${fullDateLabel(paymentState.orderMeta.appliedFilters?.dateTo)} · Bakı vaxtı`;
  }

  function bakuOrderDay(value) {
    if (!value) return "";
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function completedOrderGroups() {
    const statsByDay = new Map((paymentState.orderMeta.statistics?.days || []).map((item) => [String(item.date), item]));
    const groups = new Map();
    for (const order of paymentState.orders) {
      const day = bakuOrderDay(order.completedAt);
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day).push(order);
    }
    return [...groups].map(([day, orders]) => {
      const stat = statsByDay.get(day) || {};
      const label = fullDateLabel(day);
      return `<details class="paymentOrderDay" data-live-group="day-${escp(day)}" open><summary><strong>${escp(label)}</strong><span>${Number(stat.count || orders.length)} sifariş · Satış ${money(stat.revenue || 0)} · Maya ${reportCostLabel(stat)} · Xalis qazanc ${reportProfitLabel(stat)}</span></summary><div class="paymentOrderDayList">${orders.map(orderCard).join("")}</div></details>`;
    }).join("");
  }

  function renderOrders(automatic=false) {
    const list = $p("paymentOrdersList");
    const markup=paymentState.orders.length ? (paymentState.orderQuery.tab === "pending" || paymentState.orderQuery.tab === "expiring" ? paymentState.orders.map(orderCard).join("") : completedOrderGroups()) : '<div class="emptyState">Bu seçimə uyğun sifariş tapılmadı.</div>';
    if(list&&(markup!==lastOrderMarkup||list.querySelector('[data-retry-payment-orders]'))){
      const previous=new Map([...list.querySelectorAll('[data-payment-order-id]')].map(card=>[card,card.dataset.orderRenderVersion]));
      if(window.AdminLive)window.AdminLive.update(list,markup,(old,fresh)=>old.hasChildNodes()&&old.dataset?.orderRenderVersion&&old.dataset.orderRenderVersion===fresh.dataset?.orderRenderVersion);
      else list.innerHTML=markup;
      for(const [card,version] of previous){
        if(!card.isConnected)fieldsObserver.unobserve(card);
        else if(card.dataset.orderRenderVersion!==version)clearCardFields(card);
      }
      lastOrderMarkup=markup;
      if(paymentState.permissions.fields)for(const card of list.querySelectorAll('[data-payment-order-id]'))if(!loadedFields.has(card)&&!fieldRequests.has(card)&&!card.querySelector('.paymentOrderCardDetails')?.hidden)fieldsObserver.observe(card);
    }
    const pagination = paymentState.orderMeta.pagination;
    if ($p("paymentOrdersPageInfo")) $p("paymentOrdersPageInfo").textContent = `Səhifə ${pagination.page} / ${pagination.totalPages} · ${pagination.total} sifariş`;
    if ($p("paymentOrdersPrevious")) $p("paymentOrdersPrevious").disabled = pagination.page <= 1;
    if ($p("paymentOrdersNext")) $p("paymentOrdersNext").disabled = pagination.page >= pagination.totalPages;
    updateOrderCounts(); if(!automatic){populateOrderFilters();renderOrderContext();} renderStatistics(); renderBatchControls();
  }

  async function confirmSelectedExpiringOrders() {
    if (paymentState.batchBusy || paymentState.orderQuery.tab !== "expiring") return;
    const allowed = new Set(paymentState.orderMeta.selection?.ids || []);
    const ids = [...paymentState.selectedOrderIds].filter((id) => allowed.has(id));
    if (!ids.length) return clearOrderSelection();
    const productSelect = $p("paymentOrderProduct");
    const productLabel = paymentState.orderQuery.productId && productSelect?.selectedOptions?.[0]?.textContent
      ? productSelect.selectedOptions[0].textContent.trim() : "filtrdəki";
    const confirmed = await paymentActionDialog({
      title: "Bitən sifarişləri təsdiqlə",
      message: `${ids.length} bitən ${productLabel} sifarişini təsdiqləmək istəyirsiniz?`,
      confirmText: "Təsdiqlə"
    });
    if (!confirmed) return;
    paymentState.batchBusy = true; renderBatchControls();
    const status = $p("paymentBatchStatus");
    const completed = []; const skipped = [];
    try {
      for (let offset = 0; offset < ids.length; offset += 5) {
        const chunk = ids.slice(offset, offset + 5);
        if (status) status.textContent = `${completed.length + skipped.length}/${ids.length} yoxlanılır…`;
        const result = await paymentApi("/api/admin/payment-orders/batch-contacted", { method: "POST", body: JSON.stringify({ ids: chunk }) });
        completed.push(...(result.completed || [])); skipped.push(...(result.skipped || []));
        if (result.completed?.length) invalidateOrders();
        if (status) status.textContent = `${Math.min(ids.length, offset + chunk.length)}/${ids.length} yoxlanıldı…`;
      }
      clearOrderSelection();
      await loadOrders();
      const summary = `${completed.length} tamamlandı, ${skipped.length} tamamlanmadı.`;
      if (status) status.textContent = skipped.length ? `${summary} ${skipped.map((item) => item.orderCode || item.id).join(", ")}` : summary;
      toast(summary);
    } finally {
      paymentState.batchBusy = false; renderBatchControls();
    }
  }

  function renderEmails() {
    const list=$p("paymentEmailsList");if(list){const markup= paymentState.emails.length ? paymentState.emails.map((item) => `<article class="paymentEmailRow" data-live-key="${escp(item.id)}"><div><strong>${escp(item.status === "sent" ? "Göndərilib" : "Bildiriş gözləyir")}</strong><span>${escp(item.recipient)} · ${Number(item.attempts)} cəhd</span>${item.last_error ? `<small class="bad">${escp(item.last_error)}</small>` : ""}</div>${item.status !== "sent" ? `<button class="btn" type="button" data-retry-payment-email="${escp(item.id)}">Yenidən göndər</button>` : ""}</article>`).join("") : '<div class="emptyState">Bildiriş qeydi yoxdur.</div>';if(window.AdminLive)window.AdminLive.update(list,markup);else list.innerHTML=markup;}
  }

  function costKey(row) { return `${row.productId}:${row.planId}`; }
  function costMetrics(row, rawCost) {
    const normalized = String(rawCost ?? "").trim().replace(",", ".");
    if (normalized === "") return { cost: null, profit: null, margin: null, invalid: false };
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized) || Number(normalized) > 9999999.99) return { invalid: true };
    const cost = Number(normalized); const sale = Number(row.salePrice);
    const profit = Number((sale - cost).toFixed(2));
    return { cost, profit, margin: sale ? Number((profit / sale * 100).toFixed(2)) : null, invalid: false };
  }
  function renderCosts() {
    const host = $p("paymentCostsList"); if (!host) return;
    const search = ($p("paymentCostSearch")?.value || "").trim().toLocaleLowerCase("az-AZ");
    const active = $p("paymentCostActive")?.value || ""; const category = $p("paymentCostCategory")?.value || "";
    const onlyMissing = Boolean($p("paymentCostMissing")?.checked);
    const rows = paymentState.costs.filter((row) => (!search || row.productTitle.toLocaleLowerCase("az-AZ").includes(search)) &&
      (!active || (active === "active") === row.productActive) && (!category || row.category === category) && (!onlyMissing || row.costAmount === null));
    const groups = new Map(); for (const row of rows) { if (!groups.has(row.productId)) groups.set(row.productId, []); groups.get(row.productId).push(row); }
    host.innerHTML = [...groups.values()].map((plans) => {
      const first = plans[0];
      return `<details class="paymentCostProduct" open><summary><strong>${escp(first.productTitle)}</strong><span class="statusPill ${first.productActive ? "ok" : ""}">${first.productActive ? "Aktiv" : "Deaktiv"}</span><small>${plans.length} plan</small></summary><div class="paymentCostPlanList">${plans.map((row) => {
        const key = costKey(row); const dirty = paymentState.costDirty.has(key); const metrics = costMetrics(row, row.costAmount);
        const negative = metrics.profit !== null && metrics.profit < 0;
        return `<div class="paymentCostRow${dirty ? " isDirty" : ""}${negative ? " hasLoss" : ""}" data-payment-cost-key="${escp(key)}" data-product-id="${escp(row.productId)}" data-plan-id="${escp(row.planId)}">
          <span><b>Plan</b><em>${escp(row.planName)}${row.durationMonths ? ` · ${Number(row.durationMonths)} ay` : ""}</em></span>
          <span><b>Satış qiyməti</b><em>${money(row.salePrice)}</em></span>
          <label><b>Maya dəyəri</b><input data-payment-cost-input inputmode="decimal" autocomplete="off" placeholder="Qeyd edilməyib" value="${row.costAmount === null ? "" : escp(row.costAmount)}"></label>
          <span><b>Bir satışdan mənfəət</b><em data-cost-profit class="${negative ? "bad" : ""}">${metrics.invalid ? "Yanlış məbləğ" : metrics.profit === null ? "Qeyd edilməyib" : money(metrics.profit)}</em></span>
          <span><b>Mənfəət faizi</b><em data-cost-margin class="${negative ? "bad" : ""}">${metrics.invalid ? "—" : metrics.margin === null ? "Qeyd edilməyib" : `${metrics.margin.toFixed(2)}%`}</em></span>
          <span><b>Son yenilənmə</b><em>${row.updatedAt ? dateTime(row.updatedAt) : "Qeyd edilməyib"}</em></span>
          <button class="btn compact" type="button" data-save-payment-cost ${dirty ? "" : "disabled"}>Yadda saxla</button>
        </div>`;
      }).join("")}</div></details>`;
    }).join("") || '<div class="emptyState">Filtrə uyğun məhsul planı tapılmadı.</div>';
    const saveAll = $p("paymentCostsSaveAll"); if (saveAll) saveAll.disabled = paymentState.costSaving || paymentState.costDirty.size === 0;
    const status = $p("paymentCostsStatus"); if (status) status.textContent = paymentState.costDirty.size ? `${paymentState.costDirty.size} yadda saxlanmamış dəyişiklik var.` : `${paymentState.costs.length} plan · Bütün dəyişikliklər yadda saxlanılıb.`;
  }
  async function loadCosts() {
    const status = $p("paymentCostsStatus"); if (status) status.textContent = "Maya dəyərləri yüklənir…";
    const result = await paymentApi("/api/admin/payment-costs"); paymentState.costs = result.rows || []; paymentState.costDirty.clear();
    const category = $p("paymentCostCategory"); if (category) category.innerHTML = '<option value="">Bütün kateqoriyalar</option>' + (result.categories || []).map((item) => `<option value="${escp(item)}">${escp(item)}</option>`).join("");
    renderCosts();
  }
  function renderCostBackfill() {
    const host = $p("paymentCostBackfillResult"); const apply = $p("paymentCostBackfillApply");
    if (!host || !apply) return;
    const preview = paymentState.costBackfillPreview;
    apply.disabled = paymentState.costBackfillBusy || !preview || Number(preview.matchedCount || 0) === 0;
    if (paymentState.costBackfillBusy) { host.textContent = "Məlumat yoxlanılır…"; return; }
    if (!preview) { host.textContent = "Əvvəl preview yaradın. Heç bir sifariş preview və ayrıca təsdiq olmadan dəyişdirilmir."; return; }
    const unmatched = (preview.items || []).filter((item) => !item.matched);
    const matchedRows = (preview.items || []).filter((item) => item.matched).map((item) => `<tr><td>${escp(item.orderCode)}</td><td>${escp(item.productTitle)}</td><td>${escp(item.planName)}</td><td>${money(item.sale)}</td><td>${money(item.cost)}${item.estimated?" · Təxmini":""}</td><td class="${Number(item.profit) < 0 ? "bad" : ""}">${money(item.profit)}</td></tr>`).join("");
    host.innerHTML = `<div class="paymentBackfillStats"><span>Snapshot çatışmır: <strong>${Number(preview.missingCount || 0)}</strong></span><span>Maya tapıldı: <strong>${Number(preview.matchedCount || 0)}</strong></span><span>Uyğunlaşmadı: <strong>${Number(preview.unmatchedCount || 0)}</strong></span><span>Ümumi maya: <strong>${money(preview.cost || 0)}</strong></span><span>Xalis qazanc: <strong>${money(preview.profit || 0)}</strong></span></div>${unmatched.length ? `<p class="warningBox">${unmatched.length} sifarişə maya yazılmayacaq: ${unmatched.map((item) => `${escp(item.orderCode)} — ${escp(item.productTitle)} / ${escp(item.planName)}`).join("; ")}</p>` : ""}${matchedRows ? `<div class="paymentProductProfitTable"><table><thead><tr><th>Sifariş</th><th>Məhsul</th><th>Plan</th><th>Satış</th><th>Tətbiq ediləcək maya</th><th>Xalis qazanc</th></tr></thead><tbody>${matchedRows}</tbody></table></div>` : '<div class="emptyState">Bərpa edilə bilən maya tapılmadı.</div>'}`;
  }
  async function loadCostBackfillPreview() {
    if (paymentState.costBackfillBusy) return;
    paymentState.costBackfillBusy = true; renderCostBackfill();
    try {
      const result = await paymentApi("/api/admin/payment-cost-backfill-preview");
      paymentState.costBackfillPreview = result.preview || null;
    } finally { paymentState.costBackfillBusy = false; renderCostBackfill(); }
  }
  async function applyCostBackfill() {
    const preview = paymentState.costBackfillPreview;
    if (!preview || paymentState.costBackfillBusy || Number(preview.matchedCount || 0) === 0) return;
    const confirmed = await paymentActionDialog({ title: "Maya snapshot-larını yaz", message: `${Number(preview.matchedCount)} sifariş dəqiq məhsul və plan ID-si ilə uyğunlaşdırılıb. Preview dəyişməyibsə atomik tətbiq edilsin?`, confirmText: "Təsdiqlə və tətbiq et" });
    if (!confirmed) return;
    paymentState.costBackfillBusy = true; renderCostBackfill();
    try {
      const result = await paymentApi("/api/admin/payment-cost-backfill", { method: "POST", body: JSON.stringify({ expectedCount: Number(preview.matchedCount), digest: preview.digest }) });
      paymentState.costBackfillPreview = result.preview || null;
      toast(`${Number(result.result?.changed || 0)} sifarişin maya snapshot-u atomik yeniləndi.`);
      await Promise.all([loadOrders(), loadCosts()]);
    } finally { paymentState.costBackfillBusy = false; renderCostBackfill(); }
  }
  async function saveCosts(keys) {
    if (paymentState.costSaving) return;
    const selected = [...new Set(keys)].filter((key) => paymentState.costDirty.has(key));
    if (!selected.length) return toast("Yadda saxlanılacaq dəyişiklik yoxdur.");
    const items = selected.map((key) => {
      const row = paymentState.costs.find((item) => costKey(item) === key); const input = document.querySelector(`[data-payment-cost-key="${CSS.escape(key)}"] [data-payment-cost-input]`);
      const value = String(input?.value ?? row?.costAmount ?? "").trim().replace(",", ".");
      if (value && (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) > 9999999.99)) throw new Error("Maya dəyəri mənfi olmayan və maksimum iki onluq rəqəmli məbləğ olmalıdır.");
      return { productId: row.productId, planId: row.planId, cost: value || null };
    });
    paymentState.costSaving = true; renderCosts();
    try {
      const result = await paymentApi("/api/admin/payment-costs", { method: "POST", body: JSON.stringify({ items }) });
      paymentState.costs = result.rows || paymentState.costs; selected.forEach((key) => paymentState.costDirty.delete(key));
      paymentState.costBackfillPreview = null; renderCostBackfill();
      toast(result.idempotent ? "Bu dəyərlər artıq saxlanılıb." : "Maya dəyərləri təhlükəsiz saxlanıldı."); renderCosts();
    } catch (error) { toast(error.message || "Maya dəyərləri saxlanmadı."); renderCosts(); throw error; }
    finally { paymentState.costSaving = false; renderCosts(); }
  }

  function invalidateOrders() {
    orderRevision += 1;
    orderPages.clear();
    orderRequests.clear();
    orderCountRequest = undefined;
  }

  function requestOrderPage(query,key=query.toString()){
    let pending=orderRequests.get(key);
    if(!pending){
      pending=paymentApi(`/api/admin/payment-orders?${query}`).finally(()=>{
        if(orderRequests.get(key)===pending)orderRequests.delete(key);
      });
      orderRequests.set(key,pending);
    }
    return pending;
  }

  async function loadOrders({automatic=false}={}) {
    const status = $p("paymentOrdersStatus"); const list = $p("paymentOrdersList");
    const requestSequence = ++paymentState.orderRequestSequence;
    const query = new URLSearchParams(Object.entries(paymentState.orderQuery).filter(([, value]) => value !== ""));
    if(paymentState.orderQuery.tab==="pending")query.set("pendingStage",paymentState.pendingStage);
    else query.set("includeCustomer","true");
    const key = query.toString();
    const revision = orderRevision;
    const cached = orderPages.get(key);
    const pageChanged = visibleOrderPage !== key;
    const apply = (result, background, fromCache = false) => {
      paymentState.orders = result.orders || [];
      paymentState.permissions = result.permissions || {};
      paymentState.orderMeta = { counts: fromCache ? paymentState.orderMeta.counts : result.counts || {}, statistics: result.statistics || {}, pagination: result.pagination || {}, filters: result.filters || {}, appliedFilters: result.appliedFilters || {}, selection: result.selection || { ids: [], total: 0 } };
      renderOrders(background);
      visibleOrderPage = key;
      list?.setAttribute("data-order-page", key);
      if (status) status.textContent = `${paymentState.orderMeta.pagination.total || 0} nəticə göstərilir.`;
    };
    if (pageChanged) {
      if (cached) apply(cached, false, true);
      else {
        for(const card of list?.querySelectorAll('[data-payment-order-id]')||[])fieldsObserver.unobserve(card);
        lastOrderMarkup=null;
        const loading = document.createElement("div");
        loading.className = "emptyState";
        loading.dataset.orderListLoading = "";
        loading.setAttribute("role", "status");
        loading.textContent = "Sifarişlər yüklənir…";
        list?.replaceChildren(loading);
        list?.removeAttribute("data-order-page");
        visibleOrderPage = "";
        if (status) status.textContent = "";
      }
    }
    if (list) list.setAttribute("aria-busy", "true");
    if(automatic)query.set('preserveFilters','true');
    const anchor=automatic&&list&&!pageChanged?(window.AdminLive?.anchor(list)||(paymentState.orders[0]?{id:paymentState.orders[0].id}:null)):null;
    if(anchor){query.set('anchorId',anchor.id);query.set('anchorIndex',String(paymentState.orders.findIndex(o=>o.id===anchor.id)));}
    try {
      const result = await requestOrderPage(query,key);
      if (revision !== orderRevision) return;
      orderPages.set(key,result);
      if (orderPages.size > 16) orderPages.delete(orderPages.keys().next().value);
      if (requestSequence !== paymentState.orderRequestSequence) return;
      const nextPending = Number(result.counts?.pending || 0);
      paymentState.knownPendingCount = nextPending;
      // The chosen duration may disappear after another filter changes. The
      // server already re-ran the page without it; keep the controls in sync.
      paymentState.orderQuery.durationMonths = result.appliedFilters?.durationMonths || "";
      paymentState.orderQuery.page = result.pagination?.page || paymentState.orderQuery.page;
      if (paymentState.orderQuery.page > result.pagination?.totalPages && paymentState.orderQuery.page > 1) { paymentState.orderQuery.page = result.pagination.totalPages; return loadOrders(); }
      apply(result,automatic);
      if(!automatic&&result.permissions?.manage&&result.counts?.delivery>0&&query.get("pendingStage")==="payment"){
        const warm=new URLSearchParams(Object.entries(emptyQuery()).filter(([,value])=>value!==""));
        warm.set("pendingStage","delivery");
        const warmKey=warm.toString();
        if(!orderPages.has(warmKey)&&!orderRequests.has(warmKey)){
          void requestOrderPage(warm).then(value=>{if(revision===orderRevision&&!orderPages.has(warmKey))orderPages.set(warmKey,value);}).catch(()=>{});
        }
      }
      window.AdminLive?.notice(list,automatic?result.liveWindow?.newBeforeAnchor||0:0,async()=>{paymentState.orderQuery.page=1;await loadOrders();},'Yeni sifarişlər var');
      if (status) status.textContent = result.liveWindow?.anchorMissing?'Baxılan sifariş bu filtrdən çıxıb. Yaxın mövqe qorundu.':`${paymentState.orderMeta.pagination.total || 0} nəticə göstərilir.`;
    } catch (error) {
      if (requestSequence !== paymentState.orderRequestSequence || revision !== orderRevision) return;
      if (status) status.textContent=error.message||'Sifarişlər yüklənmədi.';
      const retry=document.createElement("button");
      retry.className="btn";
      retry.type="button";
      retry.dataset.retryPaymentOrders="";
      retry.textContent="Yenidən cəhd et";
      list?.querySelector('[data-order-list-loading]')?.remove();
      list?.querySelector('[data-retry-payment-orders]')?.remove();
      list?.prepend(retry);
    } finally { if (requestSequence === paymentState.orderRequestSequence) list?.removeAttribute("aria-busy"); }
  }

  async function loadEmails() { const result = await paymentApi("/api/admin/payment-emails"); paymentState.emails = result.emails || []; renderEmails(); }
  async function refreshOrderCounts() {
    if (orderCountRequest || orderRequests.size || !$p("paymentOrdersView")?.classList.contains("hidden")) return orderCountRequest;
    const revision = orderRevision, sequence = paymentState.orderRequestSequence;
    const pending = paymentApi("/api/admin/payment-orders?tab=pending&countsOnly=true").then(result=>{
      if (revision===orderRevision && sequence===paymentState.orderRequestSequence) updateOrderCounts(result.counts || {});
    }).finally(()=>{if(orderCountRequest===pending)orderCountRequest=undefined;});
    return orderCountRequest=pending;
  }

  async function saveMethod(form) {
    const data = Object.fromEntries(new FormData(form));
    data.active = form.elements.active.checked; data.dailyLimit = Number(data.dailyLimit); data.order = Number(data.order);
    data.fullNumber = String(data.fullNumber || "").replace(/\D/g, "");
    if (data.fullNumber && (data.fullNumber.length < (data.type === "wallet" ? 7 : 12) || data.fullNumber.length > 19)) throw new Error("Kart/cüzdan nömrəsinin uzunluğu düzgün deyil.");
    const path = paymentState.selectedMethodId ? `/api/admin/payment-methods/${paymentState.selectedMethodId}` : "/api/admin/payment-methods";
    await paymentApi(path, { method: "POST", body: JSON.stringify(data) });
    paymentState.selectedMethodId = ""; $p("paymentMethodEditor").innerHTML = ""; toast("Ödəniş üsulu təhlükəsiz saxlanıldı."); await loadMethods();
  }

  function paymentActionDialog({ title, message, confirmText = "Təsdiqlə", danger = false, cancellationReason = false }) {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog"); dialog.className = "paymentActionDialog";
      dialog.innerHTML = `<form method="dialog" class="paymentActionDialogCard"><div class="sectionHead"><div><h3>${escp(title)}</h3><p>${escp(message)}</p></div><button class="btn" type="button" data-payment-dialog-close aria-label="Bağla">×</button></div>${cancellationReason?'<label>Ləğv səbəbi<textarea name="reason" required maxlength="1000"></textarea></label>':''}<div class="paymentOrderActions"><button class="btn" type="button" data-payment-dialog-close>${cancellationReason?'Geri':'Ləğv et'}</button><button class="btn ${danger ? "danger" : "primary"}" type="submit">${escp(confirmText)}</button></div></form>`;
      document.body.appendChild(dialog);
      const finish = (result) => { dialog.close(); dialog.remove(); resolve(result); };
      dialog.querySelectorAll("[data-payment-dialog-close]").forEach((button) => button.addEventListener("click", () => finish(false)));
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(false); }, { once: true });
      const reason=dialog.querySelector('textarea[name="reason"]');
      reason?.addEventListener("input",()=>reason.setCustomValidity(""));
      dialog.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        if(!reason){finish(true);return;}
        const value=reason.value.trim();
        if(!value){reason.setCustomValidity("Ləğv səbəbini yazın.");reason.reportValidity();return;}
        finish(value);
      });
      dialog.showModal(); (reason||dialog.querySelector('button[type="submit"]'))?.focus();
    });
  }

  async function handleOrderAction(card, action) {
    const id = card.dataset.paymentOrderId;
    if(action==='cancel-fulfillment'){
      if(paymentState.orderActions.has(id))return;
      paymentState.orderActions.add(id);
      const url='/api/admin/payment-orders/'+id+'/cancel-fulfillment';
      try{
        const preview=await paymentApi(url);
        const amount=money(preview.refundCents/100,'AZN');
        const refund=preview.refundStatus==='wallet_refunded'?`Balansa qaytarılacaq: ${amount}.`:`Əl ilə karta qaytarılacaq: ${amount}. Köçürmə avtomatik icra edilmir.`;
        const reason=await paymentActionDialog({title:`Sifariş №${preview.orderCode} ləğv edilsin?`,message:`Ödəniş üsulu: ${preview.method}. ${preview.full?'Bütün sifariş':'Yalnız təhvil verilməmiş vahidlər'} ləğv ediləcək. ${refund}`,confirmText:'Ləğvi təsdiqlə',danger:true,cancellationReason:true});
        if(!reason)return;
        await paymentApi(url,{method:'POST',body:JSON.stringify({previewToken:preview.previewToken,reason})});
        invalidateOrders();toast('Ləğv qeydə alındı.');await loadOrders();
      }finally{paymentState.orderActions.delete(id);}
      return;
    }
    if(action==='delivery'){
      if(document.querySelector('[data-payment-delivery-dialog][open]'))return;
      const url='/api/admin/payment-orders/'+id+'/delivery';
      let lines=[];
      const dlg=document.createElement('dialog'),form=document.createElement('form');
      dlg.className='paymentActionDialog paymentDeliveryDialog';dlg.dataset.paymentDeliveryDialog='';form.innerHTML='<h2>Müştəri hesabına təhvil ver</h2><p>Hazır mesajı dəyişmək üçün Hazır hesab stoku bölməsini açın.</p><label>Məhsul və paket <select name="line"></select></label><label>Say <input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Hesabın e-poçtu (istəyə bağlı)<input name="email" type="email" maxlength="254" autocomplete="off"></label><label>Hesabın şifrəsi (istəyə bağlı)<input name="password" type="text" maxlength="512" autocomplete="new-password" spellcheck="false" autocapitalize="off"></label><label>Müştəriyə hazır mesaj <textarea name="message" rows="7" readonly spellcheck="false"></textarea></label><p role="alert"></p><button class="btn" type="button">Bağla</button> <button class="btn primary" type="submit">Göndər və təhvil ver</button>';
      const {line,quantity,email,password,message}=form.elements,submit=form.querySelector('[type=submit]'),close=form.querySelector('[type=button]'),error=form.querySelector('[role=alert]');
      const room=document.createElement('fieldset');
      room.hidden=true;
      room.innerHTML='<legend>Netflix Şəxsi</legend><label>Otaq adı<input name="roomName" maxlength="400" autocomplete="off"></label><label>Otaq kodu<input name="roomCode" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off"></label>';
      message.closest('label').before(room);
      const {roomName,roomCode}=form.elements;
      const controls=[line,quantity,email,password,roomName,roomCode,message,close];
      const status=document.createElement('p'),retry=document.createElement('button');
      status.setAttribute('role','status');retry.type='button';retry.className='btn';retry.hidden=true;retry.textContent='Yenidən cəhd et';error.before(status,retry);
      const renewalNote=document.createElement('label'),renewalCheck=document.createElement('input'),renewalText=document.createElement('span');
      renewalCheck.type='checkbox';renewalNote.append(renewalCheck,renewalText);error.before(renewalNote);
      line.onchange=()=>{const x=lines.find(x=>x.index===Number(line.value));if(!x)return;quantity.max=String(x.netflixRoom?1:x.remaining);quantity.value='1';message.value=x.message||'';
        room.hidden=!x.netflixRoom;
        roomName.required=roomCode.required=!!x.netflixRoom;
        roomName.value=x.netflixRoom?.name||'';roomCode.value=x.netflixRoom?.code||'';submit.disabled=!message.value;
        status.textContent=submit.disabled?'Bu məhsul üçün hazır mesaj yoxdur. Hazır hesab stoku bölməsində mesajı saxlayıb təhvil pəncərəsini yenidən açın.':'';
        renewalCheck.checked=false;renewalNote.hidden=!x.renewalOrderCode;renewalNote.classList.toggle('hidden',!x.renewalOrderCode);renewalCheck.required=!!x.renewalOrderCode;renewalText.textContent=x.renewalOrderCode?' №'+x.renewalOrderCode+' sifarişinin '+x.renewalSourceLine+'-ci sətrindəki '+x.renewalSourceUnit+'-ci abunəliyi həqiqətən uzatdım.':'';};
      let loading=false;
      const load=async()=>{
        if(loading)return;
        loading=true;retry.hidden=true;error.textContent='';status.textContent='Təhvil məlumatı yüklənir…';
        for(const field of [line,quantity,email,password,message,submit,renewalCheck])field.disabled=true;
        renewalNote.hidden=true;renewalNote.classList.add('hidden');
        try{
          let request=deliveryPreviewRequests.get(id);
          if(!request){
            request=paymentApi(url).finally(()=>{if(deliveryPreviewRequests.get(id)===request)deliveryPreviewRequests.delete(id);});
            deliveryPreviewRequests.set(id,request);
          }
          const state=await request;
          if(!dlg.open)return;
          lines=state.lines.filter(x=>x.remaining>0);
          status.textContent=lines.length?'':'Təhvil üçün məhsul qalmayıb.';
          if(!lines.length)return;
          for(const x of lines)line.add(new Option(x.title+' · '+x.plan+' ('+x.remaining+' qalıb)'+(x.renewalOrderCode?' · Yeniləmə №'+x.renewalOrderCode:''),x.index));
          for(const field of [line,quantity,email,password,message,renewalCheck])field.disabled=false;
          line.onchange();
        }catch(err){if(dlg.open){status.textContent='';error.textContent=err.message||'Təhvil məlumatı alınmadı.';retry.hidden=false;}}
        finally{loading=false;}
      };
      retry.onclick=()=>void load();
      let pending=null;close.onclick=()=>dlg.close();
      dlg.addEventListener('close',()=>dlg.remove(),{once:true});
      dlg.addEventListener('cancel',e=>{if(pending)e.preventDefault();});
      form.onsubmit=async e=>{
        e.preventDefault();if(submit.disabled||!message.value)return;
        if(!pending&&(email.value||password.value)&&quantity.value!=='1'){error.textContent='E-poçt və şifrəni hər vahid üçün ayrıca göndərin. Sayı 1 seçin.';return;}
        const data={line:Number(line.value),quantity:Number(quantity.value),message:message.value,...(email.value?{email:email.value}:{}),...(password.value?{password:password.value}:{}),...(!room.hidden?{roomName:roomName.value.trim(),roomCode:roomCode.value}:{}),...(renewalCheck.required?{renewalApplied:renewalCheck.checked}:{})};
        pending??={...data,requestId:crypto.randomUUID()};
        for(const field of [...controls,submit])field.disabled=true;
        error.textContent='';
        try{const result=await paymentApi(url,{method:'POST',body:JSON.stringify(pending)});invalidateOrders();dlg.close();toast(result.status==='completed'?'Sifariş tamamlandı.':'Təhvil məlumatı müştəri hesabına əlavə edildi.');void loadOrders();}
        catch(err){const definite=Number(err.status)>=400&&Number(err.status)<500;error.textContent=(err.message||'Təhvil təsdiqlənmədi.')+(definite?'':' Eyni əməliyyatı yenidən sınayın.');if(definite){pending=null;for(const field of controls)field.disabled=false;}submit.disabled=err.status===409;}
      };
      dlg.append(form);document.body.append(dlg);dlg.showModal();close.focus();void load();return;
    }
    if(action==='details'){
      const {details,items}=await paymentApi(`/api/admin/payment-orders/${id}/details`);
      const dlg=document.createElement('dialog'),form=document.createElement('form'),title=document.createElement('h3'),body=document.createElement('pre'),close=document.createElement('button');
      form.method='dialog';title.textContent='Sifariş məlumatları';body.style.whiteSpace='pre-wrap';body.textContent=items?.length?items.map(x=>x.title+' · '+x.plan+' · '+x.quantity+' ədəd\n'+Object.entries(x.details||{}).map(([k,v])=>k+': '+v).join('\n')).join('\n\n'):details?Object.entries(details).map(([k,v])=>k+': '+v).join('\n'):'Əlavə məlumat yoxdur.';close.textContent='Bağla';form.append(title,body,close);dlg.append(form);document.body.append(dlg);dlg.addEventListener('close',()=>dlg.remove(),{once:true});dlg.showModal();return;
    }
    if (action === "receipt") {
      const receiptWindow = window.open("about:blank", "_blank"); if (receiptWindow) receiptWindow.opener = null;
      try { const result = await paymentApi(`/api/admin/payment-orders/${id}/receipt`); if (receiptWindow) receiptWindow.location.replace(result.url); else window.location.assign(result.url); }
      catch (error) { receiptWindow?.close(); throw error; }
      return;
    }
    if (paymentState.orderActions.has(id)) return;
    if (action === "approve" && !await paymentActionDialog({ title: "Ödənişi təsdiqlə", message: "Bu sifarişin ödənişini təsdiqləmək istəyirsiniz?", confirmText: "Təsdiqlə" })) return;
    if (action === "reject" && !await paymentActionDialog({ title: "Sifarişi rədd et", message: "Bu sifarişi rədd etmək istəyirsiniz?", confirmText: "Rədd et", danger: true })) return;
    if (action === "contacted" && !await paymentActionDialog({ title: "Əlaqə saxlanıldı", message: "Müştəri ilə əlaqə saxladığınızı təsdiqləyirsiniz?", confirmText: "Təsdiqlə" })) return;
    if (paymentState.orderActions.has(id) || !card.isConnected) return;
    paymentState.orderActions.add(id); card.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try {
      const result = await paymentApi(`/api/admin/payment-orders/${id}/${action}`, { method: "POST", body: "{}" });
      invalidateOrders();
      toast(result.idempotent ? "Bu əməliyyat artıq tətbiq edilib." : "Sifariş məlumatı yeniləndi.");
      await Promise.all([loadOrders(), loadMethods()]);
    } finally { paymentState.orderActions.delete(id); if (card.isConnected) card.querySelectorAll("button").forEach((button) => { button.disabled = false; }); }
  }

  function bindEvents() {
    const cards=()=>document.querySelectorAll('#paymentOrdersList [data-payment-order-id]');
    const clearFields=()=>{for(const card of cards())clearCardFields(card);};
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)clearFields();
      else for(const card of cards())fieldsObserver.observe(card);
    });
    window.addEventListener('pagehide',clearFields);
    window.addEventListener('mirpanel:session-expired',()=>{
      invalidateOrders();
      deliveryPreviewRequests.clear();
      document.querySelector('[data-payment-delivery-dialog][open]')?.close();
      paymentState.permissions.fields=false;
      clearFields();
    });
    window.addEventListener('admin-community-view',event=>{
      if(event.detail!=='paymentOrders')clearFields();
      else for(const card of cards())fieldsObserver.observe(card);
    });
    document.addEventListener('change',e=>{const key=e.target.dataset.bankBackground;if(key)void changeBankBackground(key,e.target.files?.[0]);});
    document.addEventListener('click',e=>{const b=e.target.closest('[data-bank-background-remove]');if(b)void changeBankBackground(b.dataset.bankBackgroundRemove,null,true);});
    document.addEventListener("input", (event) => {
      if (event.target.closest?.("#paymentOrderFilters")) clearOrderSelection();
      if (["paymentOrderDateFrom", "paymentOrderDateTo"].includes(event.target.id)) validateCustomDates(true);
      if (event.target.matches('#paymentMethodForm input[name="fullNumber"]')) event.target.value = formatNumber(event.target.value);
      if (event.target.matches('#paymentMethodForm input[name="providerName"]')) {
        const methodForm = event.target.form;
        const preview = methodForm.querySelector("[data-payment-theme-preview]");
        const theme = resolvedTheme(methodForm.elements.theme.value, event.target.value, methodForm.elements.type.value);
        preview.className = `paymentThemePreview theme-${theme}`;
        preview.querySelector("strong").textContent = event.target.value || "Bank adı";
      }
      if (event.target.id === "paymentCostSearch") renderCosts();
      if (event.target.matches("[data-payment-cost-input]")) {
        const host = event.target.closest("[data-payment-cost-key]"); const row = paymentState.costs.find((item) => costKey(item) === host?.dataset.paymentCostKey);
        if (!row) return; row.costAmount = event.target.value; paymentState.costDirty.add(costKey(row));
        const metrics = costMetrics(row, event.target.value); const negative = metrics.profit !== null && metrics.profit < 0;
        host.classList.add("isDirty"); host.classList.toggle("hasLoss", negative);
        const profit = host.querySelector("[data-cost-profit]"); const margin = host.querySelector("[data-cost-margin]");
        if (profit) { profit.textContent = metrics.invalid ? "Yanlış məbləğ" : metrics.profit === null ? "Qeyd edilməyib" : money(metrics.profit); profit.classList.toggle("bad", negative || metrics.invalid); }
        if (margin) { margin.textContent = metrics.invalid || metrics.margin === null ? "—" : `${metrics.margin.toFixed(2)}%`; margin.classList.toggle("bad", negative); }
        host.querySelector("[data-save-payment-cost]")?.removeAttribute("disabled");
        const saveAll = $p("paymentCostsSaveAll"); if (saveAll) saveAll.disabled = false;
        if ($p("paymentCostsStatus")) $p("paymentCostsStatus").textContent = `${paymentState.costDirty.size} yadda saxlanmamış dəyişiklik var.`;
      }
    });
    document.addEventListener("change", async (event) => {
      if (event.target.matches("[data-expiring-order-select]")) {
        const id = event.target.closest("[data-payment-order-id]")?.dataset.paymentOrderId;
        if (id) event.target.checked ? paymentState.selectedOrderIds.add(id) : paymentState.selectedOrderIds.delete(id);
        renderBatchControls();
        return;
      }
      if (event.target.closest?.("#paymentOrderFilters")) clearOrderSelection();
      if (event.target.id === "paymentOrderPeriod") {
        clearOrderSelection();
        const period = event.target.value;
        document.querySelectorAll(".paymentCustomDate").forEach((item) => item.classList.toggle("isActive", period === "custom"));
        if (period !== "custom") {
          if ($p("paymentOrderDateFrom")) $p("paymentOrderDateFrom").value = "";
          if ($p("paymentOrderDateTo")) $p("paymentOrderDateTo").value = "";
          if (mobileOrderFilters()) { validateCustomDates(false); return; }
          readOrderFilterControls(); validateCustomDates(false);
          try { await loadOrders(); } catch (error) { toast(error.message || "Sifarişlər yüklənmədi."); }
        } else validateCustomDates(true);
        return;
      }
      if (event.target.closest?.("#paymentOrderFilters")) {
        if (mobileOrderFilters()) { validateCustomDates(true); return; }
        if (!validateCustomDates(true)) return;
        readOrderFilterControls();
        try { await loadOrders(); } catch (error) { toast(error.message || "Sifarişlər yüklənmədi."); }
        return;
      }
      if (event.target.id === "paymentMonthlyArchiveMonth") {
        const monthStart = event.target.value; const monthEnd = nextMonthLastDay(monthStart);
        paymentState.monthlyReports.selectedMonth = monthStart; renderMonthlyReports();
        if (monthStart && monthEnd) {
          Object.assign(paymentState.orderQuery, { tab: "all", period: "custom", dateFrom: monthStart, dateTo: monthEnd, page: 1 });
          renderOrderContext(); await loadOrders();
        }
      }
      if (["paymentCostActive", "paymentCostCategory", "paymentCostMissing"].includes(event.target.id)) renderCosts();
      const methodForm = event.target.closest("#paymentMethodForm");
      if (methodForm && ["theme", "providerName", "type"].includes(event.target.name)) {
        const preview = methodForm.querySelector("[data-payment-theme-preview]");
        const theme = resolvedTheme(methodForm.elements.theme.value, methodForm.elements.providerName.value, methodForm.elements.type.value);
        preview.className = `paymentThemePreview theme-${theme}`;
        preview.querySelector("strong").textContent = methodForm.elements.providerName.value || "Bank adı";
      }
      if (methodForm && event.target.name === "active") {
        methodForm.querySelector("[data-payment-active-label]").textContent = event.target.checked ? "Aktivdir" : "Deaktivdir";
      }
    });
    document.addEventListener("click", async (event) => {
      try {
        const viewButton = event.target.closest(".navBtn[data-view]");
        if(event.target.closest('[data-open-decorations]'))document.querySelector('.navBtn[data-view="decorations"]')?.click();
        if(viewButton?.dataset.view==='decorations')await loadBackgrounds();
        if (viewButton?.dataset.view === "paymentMethods") await loadMethods();
        if (viewButton?.dataset.view === "paymentCosts") await loadCosts();
        if (viewButton?.dataset.view === "paymentOrders") {
          renderOrderContext();
          if (["today", "all"].includes(paymentState.orderQuery.tab)) void loadMonthlyReports().catch(() => {});
          await loadOrders();
        }
        if (viewButton?.dataset.view === "paymentReviews") await loadEmails();
        if (event.target.closest("#paymentMethodAdd")) { paymentState.selectedMethodId = ""; renderMethodEditor(); }
        const edit = event.target.closest("[data-edit-payment-method]");
        if (edit) {
          paymentState.selectedMethodId = edit.dataset.editPaymentMethod;
          renderMethodEditor(paymentState.methods.find((item) => item.id === paymentState.selectedMethodId));
          requestAnimationFrame(() => {
            const editor = $p("paymentMethodEditor");
            editor?.classList.add("isFocused");
            editor?.scrollIntoView({ behavior: "smooth", block: "start" });
            editor?.querySelector('input[name="displayName"]')?.focus({ preventScroll: true });
            setTimeout(() => editor?.classList.remove("isFocused"), 1600);
          });
        }
        const toggleMethod = event.target.closest("[data-toggle-payment-method]");
        if (toggleMethod) {
          const methodId = toggleMethod.dataset.togglePaymentMethod;
          if (!methodId || paymentState.methodActions.has(methodId)) return;
          paymentState.methodActions.add(methodId); toggleMethod.disabled = true;
          try {
            await paymentApi(`/api/admin/payment-methods/${methodId}/${toggleMethod.dataset.nextActive === "true" ? "activate" : "deactivate"}`, { method: "POST", body: "{}" });
            await loadMethods();
          } finally { paymentState.methodActions.delete(methodId); if (toggleMethod.isConnected) toggleMethod.disabled = false; }
        }
        if (event.target.closest("[data-close-payment-editor]")) { paymentState.selectedMethodId = ""; $p("paymentMethodEditor").innerHTML = ""; }
        if (event.target.closest("[data-reset-payment-counter]") && paymentState.selectedMethodId && confirm("Bu kartın bugünkü təsdiq sayğacı sıfırlansın?")) { await paymentApi(`/api/admin/payment-methods/${paymentState.selectedMethodId}/reset-counter`, { method: "POST", body: "{}" }); await loadMethods(); }
        const deleteMethodButton = event.target.closest("[data-delete-payment-method]");
        if (deleteMethodButton) {
          const methodId = deleteMethodButton.dataset.deletePaymentMethod || paymentState.selectedMethodId;
          if (paymentState.methodActions.has(methodId)) return;
          const confirmed = await paymentActionDialog({
            title: "Kartı siyahıdan çıxar",
            message: "Kart yeni ödənişlər üçün bağlanacaq və siyahıdan çıxacaq. Köhnə sifariş tarixçəsi qorunacaq.",
            confirmText: "Kartı sil",
            danger: true
          });
          if (!confirmed) return;
          paymentState.methodActions.add(methodId);
          deleteMethodButton.disabled = true;
          try {
            const result = await paymentApi(`/api/admin/payment-methods/${methodId}/delete`, { method: "POST", body: "{}" });
            if (paymentState.selectedMethodId === methodId) {
              paymentState.selectedMethodId = "";
              $p("paymentMethodEditor").innerHTML = "";
            }
            await loadMethods();
            toast(result.idempotent ? "Kart artıq siyahıdan çıxarılıb." : "Kart yeni ödənişlər üçün bağlandı. Köhnə sifarişlər qorunur.");
          } finally {
            paymentState.methodActions.delete(methodId);
            if (deleteMethodButton.isConnected) deleteMethodButton.disabled = false;
          }
        }
        if (event.target.closest("#paymentOrdersRefresh")) await Promise.all([loadOrders(), loadMonthlyReports()]);
        if (event.target.closest("[data-retry-payment-orders]")) await loadOrders();
        if (event.target.closest("#paymentMonthlyReportsRefresh")) await Promise.all([loadOrders(), loadMonthlyReports()]);
        if (event.target.closest("#paymentReviewsRefresh")) await loadEmails();
        if (event.target.closest("#paymentCostsSaveAll")) await saveCosts([...paymentState.costDirty]);
        if (event.target.closest("#paymentCostBackfillPreview")) await loadCostBackfillPreview();
        if (event.target.closest("#paymentCostBackfillApply")) await applyCostBackfill();
        const costRow = event.target.closest("[data-payment-cost-key]");
        if (costRow && event.target.closest("[data-save-payment-cost]")) await saveCosts([costRow.dataset.paymentCostKey]);
        const orderTab = event.target.closest("[data-payment-order-tab]");
        if (orderTab) await setOrderTab(orderTab.dataset.paymentOrderTab);
        const stage = event.target.closest("[data-payment-pending-stage]");
        if(stage&&stage.dataset.paymentPendingStage!==paymentState.pendingStage){
          paymentState.pendingStage=stage.dataset.paymentPendingStage;
          paymentState.orderQuery.page=1;
          renderOrderContext();
          await loadOrders();
        }
        if (event.target.closest("#paymentOrdersPrevious") && paymentState.orderMeta.pagination.page > 1) { paymentState.orderQuery.page -= 1; await loadOrders(); }
        if (event.target.closest("#paymentOrdersNext") && paymentState.orderMeta.pagination.page < paymentState.orderMeta.pagination.totalPages) { paymentState.orderQuery.page += 1; await loadOrders(); }
        if (event.target.closest("#paymentOrderFiltersClear")) { if (mobileOrderFilters()) { await submitMobileOrderFilters(true); return; } $p("paymentOrderFilters")?.reset(); if ($p("paymentOrderDateError")) $p("paymentOrderDateError").textContent = ""; await setOrderTab(paymentState.orderQuery.tab); }
        if (event.target.closest("#paymentSelectPage")) { paymentState.orders.forEach((order) => paymentState.selectedOrderIds.add(order.id)); renderBatchControls(); }
        if (event.target.closest("#paymentSelectAllFiltered")) { paymentState.selectedOrderIds = new Set(paymentState.orderMeta.selection?.ids || []); renderBatchControls(); }
        if (event.target.closest("#paymentClearSelection")) clearOrderSelection();
        if (event.target.closest("#paymentConfirmSelected")) await confirmSelectedExpiringOrders();
        const card = event.target.closest("[data-payment-order-id]");
        const orderToggle=event.target.closest("[data-order-toggle]")||(event.target.closest(".paymentOrderCardNumber")&&card?.querySelector("[data-order-toggle]"));
        if(card&&orderToggle){
          const open=orderToggle.getAttribute("aria-expanded")!=="true",id=card.dataset.paymentOrderId;
          paymentState.openOrders.set(id,open);
          orderToggle.setAttribute("aria-expanded",String(open));card.querySelector('.paymentOrderCardDetails').hidden=!open;
          if(open)void loadCardFields(card);else clearCardFields(card);return;
        }
        if (card && event.target.closest("[data-copy-order-id]")) { await navigator.clipboard.writeText(card.dataset.orderCode); toast("Sifariş ID-si kopyalandı."); }
        if (card && event.target.closest("[data-retry-order-fields]")) { await loadCardFields(card);return; }
        const copyFields=event.target.closest('[data-copy-order-fields]');
        if(card&&copyFields&&paymentState.permissions.fields){
          const block=copyFields.closest('[data-order-line-fields]');
          const rows=[...block.querySelectorAll('[data-order-field-label]')].map(label=>
            label.textContent+': '+label.parentElement.querySelector('[data-order-field-value]').textContent);
          await navigator.clipboard.writeText(rows.join('\n'));
          toast('Müştəri məlumatları kopyalandı.');
          return;
        }
        if (card && event.target.closest("[data-open-receipt]")) await handleOrderAction(card, "receipt");
        if (card && event.target.closest("[data-order-details]")) await handleOrderAction(card, "details");
        if (card && event.target.closest("[data-order-delivery]")) await handleOrderAction(card, "delivery");
        if (card && event.target.closest("[data-cancel-fulfillment]")) await handleOrderAction(card, "cancel-fulfillment");
        if (card && event.target.closest("[data-claim-payment]")) {
          if(paymentState.orderActions.has(card.dataset.paymentOrderId))return;
          paymentState.orderActions.add(card.dataset.paymentOrderId);
          try{const b=event.target.closest('[data-claim-payment]');b.dataset.key||=crypto.randomUUID();await paymentApi(`/api/admin/workforce/orders/${card.dataset.paymentOrderId}/claim`,{method:'POST',headers:{'X-Idempotency-Key':b.dataset.key},body:'{}'});await loadOrders();}finally{paymentState.orderActions.delete(card.dataset.paymentOrderId);}
        }
        if (card && event.target.closest("[data-approve-payment]")) await handleOrderAction(card, "approve");
        if (card && event.target.closest("[data-reject-payment]")) await handleOrderAction(card, "reject");
        if (card && event.target.closest("[data-contacted-payment]")) await handleOrderAction(card, "contacted");
        const retry = event.target.closest("[data-retry-payment-email]");
        if (retry) { await paymentApi(`/api/admin/payment-emails/${retry.dataset.retryPaymentEmail}/retry`, { method: "POST", body: "{}" }); toast("Bildiriş yenidən növbəyə alındı."); await loadEmails(); }
      } catch (error) { toast(error.message || "Ödəniş əməliyyatı tamamlanmadı."); }
    });
    document.addEventListener("submit", async (event) => {
      if (event.target.id === "paymentSettingsForm") { event.preventDefault(); try { await paymentApi("/api/admin/payment-settings", { method: "POST", body: JSON.stringify({ notificationEmail: $p("paymentNotificationEmail").value, receiptRetentionDays: Number($p("paymentReceiptRetentionDays").value) }) }); toast("Ödəniş parametrləri saxlanıldı."); } catch (error) { toast(error.message || "Parametrlər saxlanmadı."); } return; }
      if (event.target.id === "paymentOrderFilters") {
        event.preventDefault();
        if (mobileOrderFilters()) { await submitMobileOrderFilters(); return; }
        if (!validateCustomDates(true)) return;
        clearOrderSelection();
        readOrderFilterControls();
        await loadOrders(); return;
      }
      if (event.target.id !== "paymentMethodForm") return;
      event.preventDefault(); try { await saveMethod(event.target); } catch (error) { toast(error.message || "Ödəniş üsulu saxlanmadı."); }
    });
  }

  async function openReviewToken() {
    const token = new URLSearchParams(location.search).get("reviewToken"); if (!token) return;
    document.querySelector('.navBtn[data-view="paymentOrders"]')?.click();
    try {
      const result = await paymentApi("/api/admin/payment-review-token", { method: "POST", body: JSON.stringify({ token }) });
      if (result.order.status === "rejected") { toast("Bu sifariş rədd edilib və əsas siyahılarda göstərilmir."); return; }
      paymentState.orderQuery.search = result.order.order_code || "";
      paymentState.orderQuery.tab = ["approved", "completed"].includes(result.order.status) ? "all" : "pending";
      paymentState.pendingStage="payment";
      paymentState.orderQuery.page = 1;
      renderOrderContext();
      await loadOrders();
      const card = document.querySelector(`[data-payment-order-id="${CSS.escape(result.order.id)}"]`); card?.classList.add("isHighlighted"); card?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) { toast(error.message || "Yoxlama keçidi etibarsızdır."); }
    finally { history.replaceState({}, "", "/admin.html"); }
  }

  function bootPayments() {
    if(location.hash==='#decorations')void loadBackgrounds();
    bindEvents(); setTimeout(openReviewToken, 400);
    const timer = setInterval(() => { if (document.visibilityState !== "visible") return; if (!$p("paymentOrdersView")?.classList.contains("hidden")) { if (!orderRequests.size) loadOrders({automatic:true}).catch(() => {}); } else if (!$p("paymentReviewsView")?.classList.contains("hidden")) loadEmails().catch(() => {}); else refreshOrderCounts().catch(() => {}); }, 45_000);
    setTimeout(() => refreshOrderCounts().catch(() => {}), 1000);
    window.addEventListener("beforeunload", (event) => { clearInterval(timer); if (paymentState.costDirty.size) { event.preventDefault(); event.returnValue = ""; } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPayments); else bootPayments();
})();
