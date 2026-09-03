(() => {
  "use strict";

  const emptyQuery = (tab = "pending") => ({
    tab,
    period: tab === "today" ? "today" : tab === "all" ? "this_month" : "all",
    search: "", productId: "", planName: "", methodId: "", dateFrom: "", dateTo: "", sort: "newest", page: 1
  });
  const paymentState = {
    methods: [], orders: [], emails: [], selectedMethodId: "", knownPendingCount: null,
    orderActions: new Set(), methodActions: new Set(), orderQuery: emptyQuery(),
    costs: [], costDirty: new Set(), costSaving: false, costBackfillPreview: null, costBackfillBusy: false,
    orderMeta: { counts: { pending: 0, today: 0, all: 0, expiring: 0 }, statistics: {}, pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, filters: { products: [], plans: [], methods: [] }, appliedFilters: {} },
    monthlyReports: { current: null, archives: [], selectedMonth: "", archiveOpen: false },
    orderRequestSequence: 0
  };
  const $p = (id) => document.getElementById(id);
  const escp = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const statusLabel = { reviewing: "Yoxlanılır", completed: "Tamamlandı", rejected: "Rədd edilib", expired: "Vaxtı bitib" };
  const reservationLabel = { reserved: "Rezerv edilib", reviewing: "Yoxlanılır", completed: "Tamamlandı", rejected: "Rədd edilib", cancelled: "Ləğv edilib", expired: "Vaxtı bitib" };
  const methodStatusLabel = { active: "Aktiv", inactive: "Deaktiv", pending: "Gözləmədə", temporarily_busy: "Müvəqqəti rezervdədir", limit_reached: "Limit dolub", deleted: "Silinib" };
  const auditLabel = {
    "order.submitted": "Sifariş yaradıldı", "order.approved": "Ödəniş təsdiqləndi", "order.rejected": "Sifariş rədd edildi",
    "order.customer_contacted": "Müştəri ilə əlaqə saxlanıldı", "receipt.signed_url_created": "Çek təhlükəsiz açıldı", "email.retry_queued": "Bildiriş yenidən növbəyə alındı"
  };

  async function paymentApi(path, options) { return api(path, options); }
  const money = (value, currency = "AZN") => `${Number(value || 0).toFixed(2)} ${currency === "AZN" ? "₼" : currency}`;
  const dateTime = (value) => value ? new Date(value).toLocaleString("az-AZ", { timeZone: "Asia/Baku" }) : "—";
  const calendarDate = (value) => value ? new Date(`${value}T00:00:00+04:00`).toLocaleDateString("az-AZ") : "Müddət müəyyən edilməyib";
  const monthLabel = (value) => value ? new Intl.DateTimeFormat("az-AZ", { month: "long", year: "numeric", timeZone: "Asia/Baku" }).format(new Date(`${value}T00:00:00+04:00`)) : "—";
  const azMonths = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
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
    if (provider.includes("kapital")) return "kapital";
    if (provider.includes("m10") || type === "wallet") return "m10";
    return "neutral";
  }

  function methodCard(method) {
    const limit = method.limitMode === "unlimited" ? "Limitsiz" : `Bu gün tamamlanıb: ${method.confirmedToday}/${method.dailyLimit}`;
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
    list.innerHTML = paymentState.methods.length ? paymentState.methods.map(methodCard).join("") : '<div class="emptyState">Ödəniş üsulu tapılmadı.</div>';
    if (paymentState.selectedMethodId) renderMethodEditor(paymentState.methods.find((item) => item.id === paymentState.selectedMethodId));
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
    paymentState.methods = methodResult.methods || [];
    renderMethods();
    if ($p("paymentNotificationEmail")) $p("paymentNotificationEmail").value = settingsResult.settings?.notificationEmail || "";
    if ($p("paymentReceiptRetentionDays")) $p("paymentReceiptRetentionDays").value = settingsResult.settings?.receiptRetentionDays || 90;
  }

  function orderHistory(order) {
    const history = (order.auditHistory || []).map((item) => `<li>${escp(auditLabel[item.action] || item.action)}<time>${escp(dateTime(item.created_at))}</time></li>`).join("");
    return `<details class="paymentAuditHistory"><summary>Əməliyyat tarixçəsi (${(order.auditHistory || []).length})</summary><ul>${history || "<li>Audit qeydi yoxdur.</li>"}</ul></details>`;
  }

  function copyButton(order) {
    return `<button class="btn compact" type="button" data-copy-order-id aria-label="${escp(order.orderCode)} sifariş ID-sini kopyala">ID-ni kopyala</button>`;
  }

  function orderCard(order) {
    const tab = paymentState.orderQuery.tab;
    const pending = tab === "pending";
    const expiring = tab === "expiring";
    const displayDate = pending ? order.createdAt : order.completedAt;
    const fields = [
      ["Məhsul", order.productTitle], ["Plan", order.planName], ["Məbləğ", money(order.amount, order.currency)], ["Ödəniş üsulu", order.paymentMethodLabel]
    ];
    if (pending) fields.push(["Rezerv", reservationLabel[order.reservationStatus] || "Yoxlanılır"]);
    if (!pending) {
      fields.push(["Təsdiqlənmə", dateTime(order.completedAt)], ["Bitmə tarixi", calendarDate(order.expiresOn)]);
      fields.push(["Snapshot maya", order.costPriceSnapshot === null ? "Tarixi maya dəyəri mövcud deyil" : money(order.costPriceSnapshot, order.currency)]);
      fields.push(["Snapshot mənfəət", order.profitSnapshot === null ? "Hesablanmayıb" : `${money(order.profitSnapshot, order.currency)}${order.profitMarginSnapshot === null ? "" : ` · ${Number(order.profitMarginSnapshot).toFixed(2)}%`}`]);
    }
    if (tab === "all") fields.push(["Əlaqə", order.contactedAt ? `Əlaqə saxlanıldı · ${dateTime(order.contactedAt)}` : "Əlaqə saxlanılmayıb"]);
    if (expiring) fields.push(["Vəziyyət", order.expiry?.label || "Müddət müəyyən edilməyib"]);
    return `<article class="paymentOrderAdminCard status-${escp(order.status)}" data-payment-order-id="${escp(order.id)}" data-order-code="${escp(order.orderCode)}">
      <div class="paymentOrderHead"><div><strong title="${escp(order.orderCode)}">${escp(order.orderCode)}</strong>${copyButton(order)}<span class="statusPill status-${escp(expiring ? order.expiry?.code : order.status)}">${escp(expiring ? order.expiry?.label : statusLabel[order.status] || "Yoxlanılır")}</span></div><time datetime="${escp(displayDate || "")}">${escp(dateTime(displayDate))}</time></div>
      <div class="paymentOrderCompactGrid">${fields.map(([label, value]) => `<span><b>${escp(label)}</b><em title="${escp(value)}">${escp(value)}</em></span>`).join("")}</div>
      <div class="paymentOrderActions">
        ${order.receiptAvailable ? '<button class="btn" type="button" data-open-receipt>Çeki aç</button>' : '<span class="statusPill">Çek saxlanma müddəti bitib</span>'}
        ${pending ? '<button class="btn primary" type="button" data-approve-payment>Ödənişi təsdiqlə</button><button class="btn danger" type="button" data-reject-payment>Rədd et</button>' : ""}
        ${expiring ? '<button class="btn primary" type="button" data-contacted-payment>Əlaqə saxlanıldı</button>' : ""}
      </div>${pending || expiring ? orderHistory(order) : ""}
    </article>`;
  }

  function updateOrderCounts(counts = paymentState.orderMeta.counts) {
    paymentState.orderMeta.counts = counts;
    for (const [key, id] of Object.entries({ pending: "paymentPendingCount", today: "paymentTodayCount", all: "paymentAllCount", expiring: "paymentExpiringCount" })) {
      if ($p(id)) $p(id).textContent = String(counts[key] || 0);
    }
    const nav = document.querySelector('.navBtn[data-view="paymentOrders"]');
    if (nav) {
      const attention = Number(counts.expiring || 0);
      nav.dataset.attentionCount = String(attention);
      nav.setAttribute("aria-label", attention ? `Sifarişlər, ${attention} əlaqə saxlanılmamış bitən məhsul` : "Sifarişlər");
    }
  }

  function populateOrderFilters(filters = paymentState.orderMeta.filters) {
    const fill = (id, empty, rows, value, getValue, getLabel) => {
      const select = $p(id); if (!select) return;
      select.innerHTML = `<option value="">${escp(empty)}</option>` + (rows || []).map((item) => `<option value="${escp(getValue(item))}">${escp(getLabel(item))}</option>`).join("");
      select.value = value;
    };
    fill("paymentOrderProduct", "Bütün məhsullar", filters.products, paymentState.orderQuery.productId, (item) => item.id, (item) => item.title);
    fill("paymentOrderPlan", "Bütün planlar", filters.plans, paymentState.orderQuery.planName, (item) => item, (item) => item);
    fill("paymentOrderMethod", "Bütün banklar", filters.methods, paymentState.orderQuery.methodId, (item) => item.id, (item) => item.label);
  }

  function reportPrimaryMarkup(report, emptyText = "Bu dövr üçün tamamlanmış sifariş yoxdur.") {
    if (!report) return `<div class="emptyState">${escp(emptyText)}</div>`;
    return `<div class="paymentMonthlyMetric"><small>Tamamlanmış sifariş</small><strong>${Number(report.completedCount || 0)}</strong></div>
      <div class="paymentMonthlyMetric"><small>Ümumi satış</small><strong>${money(report.revenue)}</strong></div>
      <div class="paymentMonthlyMetric"><small>Ümumi maya</small><strong>${money(report.cost)}</strong></div>
      <div class="paymentMonthlyMetric ${Number(report.profit) < 0 ? "bad" : ""}"><small>Xalis qazanc</small><strong>${money(report.profit)}</strong></div>`;
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

  function renderOrderContext() {
    const tab = paymentState.orderQuery.tab;
    $p("paymentMonthlyReports")?.toggleAttribute("hidden", !["today", "all"].includes(tab));
    $p("paymentMonthlyArchivePanel")?.toggleAttribute("hidden", tab !== "all");
    document.querySelectorAll("[data-payment-order-tab]").forEach((button) => {
      const active = button.dataset.paymentOrderTab === tab;
      button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active));
    });
    syncOrderFilterControls();
  }

  async function setOrderTab(tab) {
    const safeTab = ["pending", "today", "all", "expiring"].includes(tab) ? tab : "pending";
    paymentState.orderQuery = emptyQuery(safeTab);
    renderOrderContext();
    await loadOrders();
  }

  function renderStatistics() {
    const host = $p("paymentCurrentMonthReport"); const breakdown = $p("paymentCurrentMonthBreakdown");
    const label = $p("paymentCurrentMonthLabel"); const title = $p("paymentReportTitle");
    if (!host) return;
    const stats = paymentState.orderMeta.statistics || {};
    if (!["today", "all"].includes(paymentState.orderQuery.tab)) { host.innerHTML = ""; if (breakdown) breakdown.innerHTML = ""; return; }
    host.innerHTML = reportPrimaryMarkup({ completedCount: stats.count, revenue: stats.revenue, cost: stats.cost, profit: stats.profit });
    if (breakdown) breakdown.innerHTML = reportBreakdownMarkup(stats);
    if (title) title.textContent = paymentState.orderQuery.tab === "today" ? "Bu günün hesabatı" : "Filtr üzrə maliyyə hesabatı";
    if (label) label.textContent = paymentState.orderQuery.tab === "today" ? "Bakı vaxtı ilə bu gün tamamlanan sifarişlər" : `${fullDateLabel(paymentState.orderMeta.appliedFilters?.dateFrom)} – ${fullDateLabel(paymentState.orderMeta.appliedFilters?.dateTo)} · Bakı vaxtı`;
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
      return `<details class="paymentOrderDay" open><summary><strong>${escp(label)}</strong><span>${Number(stat.count || orders.length)} sifariş · Satış ${money(stat.revenue || 0)} · Maya ${money(stat.cost || 0)} · Xalis qazanc ${money(stat.profit || 0)}</span></summary><div class="paymentOrderDayList">${orders.map(orderCard).join("")}</div></details>`;
    }).join("");
  }

  function renderOrders() {
    const list = $p("paymentOrdersList");
    if (list) list.innerHTML = paymentState.orders.length ? (paymentState.orderQuery.tab === "pending" || paymentState.orderQuery.tab === "expiring" ? paymentState.orders.map(orderCard).join("") : completedOrderGroups()) : '<div class="emptyState">Bu seçimə uyğun sifariş tapılmadı.</div>';
    const pagination = paymentState.orderMeta.pagination;
    if ($p("paymentOrdersPageInfo")) $p("paymentOrdersPageInfo").textContent = `Səhifə ${pagination.page} / ${pagination.totalPages} · ${pagination.total} sifariş`;
    if ($p("paymentOrdersPrevious")) $p("paymentOrdersPrevious").disabled = pagination.page <= 1;
    if ($p("paymentOrdersNext")) $p("paymentOrdersNext").disabled = pagination.page >= pagination.totalPages;
    updateOrderCounts(); populateOrderFilters(); renderOrderContext(); renderStatistics();
  }

  function renderEmails() {
    if ($p("paymentEmailsList")) $p("paymentEmailsList").innerHTML = paymentState.emails.length ? paymentState.emails.map((item) => `<article class="paymentEmailRow"><div><strong>${escp(item.status === "sent" ? "Göndərilib" : "Bildiriş gözləyir")}</strong><span>${escp(item.recipient)} · ${Number(item.attempts)} cəhd</span>${item.last_error ? `<small class="bad">${escp(item.last_error)}</small>` : ""}</div>${item.status !== "sent" ? `<button class="btn" type="button" data-retry-payment-email="${escp(item.id)}">Yenidən göndər</button>` : ""}</article>`).join("") : '<div class="emptyState">Bildiriş qeydi yoxdur.</div>';
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
    const matchedRows = (preview.items || []).filter((item) => item.matched).map((item) => `<tr><td>${escp(item.orderCode)}</td><td>${escp(item.productTitle)}</td><td>${escp(item.planName)}</td><td>${money(item.sale)}</td><td>${money(item.cost)}</td><td class="${Number(item.profit) < 0 ? "bad" : ""}">${money(item.profit)}</td></tr>`).join("");
    host.innerHTML = `<div class="paymentBackfillStats"><span>Snapshot çatışmır: <strong>${Number(preview.missingCount || 0)}</strong></span><span>Dəqiq uyğunlaşdı: <strong>${Number(preview.matchedCount || 0)}</strong></span><span>Uyğunlaşmadı: <strong>${Number(preview.unmatchedCount || 0)}</strong></span><span>Ümumi maya: <strong>${money(preview.cost || 0)}</strong></span><span>Xalis qazanc: <strong>${money(preview.profit || 0)}</strong></span></div>${unmatched.length ? `<p class="warningBox">${unmatched.length} sifarişə maya yazılmayacaq: ${unmatched.map((item) => `${escp(item.orderCode)} — ${escp(item.productTitle)} / ${escp(item.planName)}`).join("; ")}</p>` : ""}${matchedRows ? `<div class="paymentProductProfitTable"><table><thead><tr><th>Sifariş</th><th>Məhsul</th><th>Plan</th><th>Satış</th><th>Tətbiq ediləcək maya</th><th>Xalis qazanc</th></tr></thead><tbody>${matchedRows}</tbody></table></div>` : '<div class="emptyState">Tətbiq ediləcək dəqiq uyğunluq yoxdur.</div>'}`;
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

  async function loadOrders() {
    const status = $p("paymentOrdersStatus"); const list = $p("paymentOrdersList");
    const requestSequence = ++paymentState.orderRequestSequence;
    if (status) status.textContent = "Sifarişlər yüklənir…";
    if (list) { list.setAttribute("aria-busy", "true"); list.innerHTML = '<div class="emptyState">Yüklənir…</div>'; }
    paymentState.orderMeta.statistics = {};
    if ($p("paymentCurrentMonthReport")) $p("paymentCurrentMonthReport").innerHTML = '<div class="emptyState">Hesabat yüklənir…</div>';
    if ($p("paymentCurrentMonthBreakdown")) $p("paymentCurrentMonthBreakdown").innerHTML = "";
    const query = new URLSearchParams(Object.entries(paymentState.orderQuery).filter(([, value]) => value !== ""));
    try {
      const result = await paymentApi(`/api/admin/payment-orders?${query}`);
      if (requestSequence !== paymentState.orderRequestSequence) return;
      const nextPending = Number(result.counts?.pending || 0);
      if (paymentState.knownPendingCount !== null && nextPending > paymentState.knownPendingCount) toast(`${nextPending - paymentState.knownPendingCount} yeni sifariş var.`);
      paymentState.knownPendingCount = nextPending;
      paymentState.orders = result.orders || [];
      paymentState.orderMeta = { counts: result.counts || {}, statistics: result.statistics || {}, pagination: result.pagination || {}, filters: result.filters || {}, appliedFilters: result.appliedFilters || {} };
      if (paymentState.orderQuery.page > paymentState.orderMeta.pagination.totalPages && paymentState.orderQuery.page > 1) { paymentState.orderQuery.page = paymentState.orderMeta.pagination.totalPages; return loadOrders(); }
      renderOrders(); if (status) status.textContent = `${paymentState.orderMeta.pagination.total || 0} nəticə göstərilir.`;
    } catch (error) {
      if (requestSequence !== paymentState.orderRequestSequence) return;
      if (list) list.innerHTML = `<div class="emptyState bad">${escp(error.message || "Sifarişlər yüklənmədi.")}<br><button class="btn" type="button" data-retry-payment-orders>Yenidən yoxla</button></div>`;
      if ($p("paymentCurrentMonthReport")) $p("paymentCurrentMonthReport").innerHTML = '<div class="emptyState bad">Maliyyə hesabatı yüklənmədi.</div>';
      if (status) status.textContent = "Server xətası baş verdi.";
      throw error;
    } finally { if (requestSequence === paymentState.orderRequestSequence) list?.removeAttribute("aria-busy"); }
  }

  async function loadEmails() { const result = await paymentApi("/api/admin/payment-emails"); paymentState.emails = result.emails || []; renderEmails(); }
  async function refreshOrderCounts() { const result = await paymentApi("/api/admin/payment-orders?tab=pending&page=1"); updateOrderCounts(result.counts || {}); }

  async function saveMethod(form) {
    const data = Object.fromEntries(new FormData(form));
    data.active = form.elements.active.checked; data.dailyLimit = Number(data.dailyLimit); data.order = Number(data.order);
    data.fullNumber = String(data.fullNumber || "").replace(/\D/g, "");
    if (data.fullNumber && (data.fullNumber.length < (data.type === "wallet" ? 7 : 12) || data.fullNumber.length > 19)) throw new Error("Kart/cüzdan nömrəsinin uzunluğu düzgün deyil.");
    const path = paymentState.selectedMethodId ? `/api/admin/payment-methods/${paymentState.selectedMethodId}` : "/api/admin/payment-methods";
    await paymentApi(path, { method: "POST", body: JSON.stringify(data) });
    paymentState.selectedMethodId = ""; $p("paymentMethodEditor").innerHTML = ""; toast("Ödəniş üsulu təhlükəsiz saxlanıldı."); await loadMethods();
  }

  function paymentActionDialog({ title, message, confirmText = "Təsdiqlə", danger = false }) {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog"); dialog.className = "paymentActionDialog";
      dialog.innerHTML = `<form method="dialog" class="paymentActionDialogCard"><div class="sectionHead"><div><h3>${escp(title)}</h3><p>${escp(message)}</p></div><button class="btn" type="button" data-payment-dialog-close aria-label="Bağla">×</button></div><div class="paymentOrderActions"><button class="btn" type="button" data-payment-dialog-close>Ləğv et</button><button class="btn ${danger ? "danger" : "primary"}" type="submit">${escp(confirmText)}</button></div></form>`;
      document.body.appendChild(dialog);
      const finish = (result) => { dialog.close(); dialog.remove(); resolve(result); };
      dialog.querySelectorAll("[data-payment-dialog-close]").forEach((button) => button.addEventListener("click", () => finish(false)));
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(false); }, { once: true });
      dialog.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); finish(true); });
      dialog.showModal(); dialog.querySelector('button[type="submit"]')?.focus();
    });
  }

  async function handleOrderAction(card, action) {
    const id = card.dataset.paymentOrderId;
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
    paymentState.orderActions.add(id); card.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try {
      const result = await paymentApi(`/api/admin/payment-orders/${id}/${action}`, { method: "POST", body: "{}" });
      toast(result.idempotent ? "Bu əməliyyat artıq tətbiq edilib." : "Sifariş məlumatı yeniləndi.");
      card.remove(); await Promise.all([loadOrders(), loadMethods()]);
    } finally { paymentState.orderActions.delete(id); if (card.isConnected) card.querySelectorAll("button").forEach((button) => { button.disabled = false; }); }
  }

  function bindEvents() {
    document.addEventListener("input", (event) => {
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
      if (event.target.id === "paymentOrderPeriod") {
        const period = event.target.value;
        document.querySelectorAll(".paymentCustomDate").forEach((item) => item.classList.toggle("isActive", period === "custom"));
        paymentState.orderQuery.period = period; paymentState.orderQuery.page = 1;
        if (period !== "custom") {
          paymentState.orderQuery.dateFrom = ""; paymentState.orderQuery.dateTo = "";
          if ($p("paymentOrderDateFrom")) $p("paymentOrderDateFrom").value = "";
          if ($p("paymentOrderDateTo")) $p("paymentOrderDateTo").value = "";
          validateCustomDates(false); await loadOrders();
        } else validateCustomDates(true);
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
        if (viewButton?.dataset.view === "paymentMethods") await loadMethods();
        if (viewButton?.dataset.view === "paymentCosts") await loadCosts();
        if (viewButton?.dataset.view === "paymentOrders") { await Promise.all([loadOrders(), loadMonthlyReports()]); renderOrderContext(); }
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
        if (event.target.closest("#paymentOrdersPrevious") && paymentState.orderMeta.pagination.page > 1) { paymentState.orderQuery.page -= 1; await loadOrders(); }
        if (event.target.closest("#paymentOrdersNext") && paymentState.orderMeta.pagination.page < paymentState.orderMeta.pagination.totalPages) { paymentState.orderQuery.page += 1; await loadOrders(); }
        if (event.target.closest("#paymentOrderFiltersClear")) { $p("paymentOrderFilters")?.reset(); if ($p("paymentOrderDateError")) $p("paymentOrderDateError").textContent = ""; await setOrderTab(paymentState.orderQuery.tab); }
        const card = event.target.closest("[data-payment-order-id]");
        if (card && event.target.closest("[data-copy-order-id]")) { await navigator.clipboard.writeText(card.dataset.orderCode); toast("Sifariş ID-si kopyalandı."); }
        if (card && event.target.closest("[data-open-receipt]")) await handleOrderAction(card, "receipt");
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
        if (!validateCustomDates(true)) return;
        Object.assign(paymentState.orderQuery, { search: $p("paymentOrderSearch")?.value.trim() || "", productId: $p("paymentOrderProduct")?.value || "", planName: $p("paymentOrderPlan")?.value || "", methodId: $p("paymentOrderMethod")?.value || "", period: $p("paymentOrderPeriod")?.value || "all", dateFrom: $p("paymentOrderDateFrom")?.value || "", dateTo: $p("paymentOrderDateTo")?.value || "", sort: $p("paymentOrderSort")?.value || "newest", page: 1 });
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
      paymentState.orderQuery.page = 1;
      renderOrderContext();
      await loadOrders();
      const card = document.querySelector(`[data-payment-order-id="${CSS.escape(result.order.id)}"]`); card?.classList.add("isHighlighted"); card?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) { toast(error.message || "Yoxlama keçidi etibarsızdır."); }
    finally { history.replaceState({}, "", "/admin.html"); }
  }

  function bootPayments() {
    bindEvents(); setTimeout(openReviewToken, 400);
    const timer = setInterval(() => { if (document.visibilityState !== "visible") return; if (!$p("paymentOrdersView")?.classList.contains("hidden")) loadOrders().catch(() => {}); else if (!$p("paymentReviewsView")?.classList.contains("hidden")) loadEmails().catch(() => {}); else refreshOrderCounts().catch(() => {}); }, 45_000);
    setTimeout(() => refreshOrderCounts().catch(() => {}), 1000);
    window.addEventListener("beforeunload", (event) => { clearInterval(timer); if (paymentState.costDirty.size) { event.preventDefault(); event.returnValue = ""; } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPayments); else bootPayments();
})();
