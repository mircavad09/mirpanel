(() => {
  "use strict";

  const emptyQuery = () => ({ tab: "pending", period: "", search: "", productId: "", planName: "", methodId: "", dateFrom: "", dateTo: "", sort: "newest", page: 1 });
  const paymentState = {
    methods: [], orders: [], emails: [], selectedMethodId: "", knownPendingCount: null,
    orderActions: new Set(), orderQuery: emptyQuery(),
    orderMeta: { counts: { pending: 0, today: 0, all: 0, expiring: 0 }, statistics: {}, pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, filters: { products: [], plans: [], methods: [] } }
  };
  const $p = (id) => document.getElementById(id);
  const escp = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const statusLabel = { reviewing: "Yoxlanılır", completed: "Tamamlandı", rejected: "Rədd edilib", expired: "Vaxtı bitib" };
  const reservationLabel = { reserved: "Rezerv edilib", reviewing: "Yoxlanılır", completed: "Tamamlandı", rejected: "Rədd edilib", cancelled: "Ləğv edilib", expired: "Vaxtı bitib" };
  const auditLabel = {
    "order.submitted": "Sifariş yaradıldı", "order.approved": "Ödəniş təsdiqləndi", "order.rejected": "Sifariş rədd edildi",
    "order.customer_contacted": "Müştəri ilə əlaqə saxlanıldı", "receipt.signed_url_created": "Çek təhlükəsiz açıldı", "email.retry_queued": "Bildiriş yenidən növbəyə alındı"
  };

  async function paymentApi(path, options) { return api(path, options); }
  const money = (value, currency = "AZN") => `${Number(value || 0).toFixed(2)} ${currency === "AZN" ? "₼" : currency}`;
  const dateTime = (value) => value ? new Date(value).toLocaleString("az-AZ", { timeZone: "Asia/Baku" }) : "—";
  const calendarDate = (value) => value ? new Date(`${value}T00:00:00+04:00`).toLocaleDateString("az-AZ") : "Müddət müəyyən edilməyib";
  const formatNumber = (value) => String(value || "").replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();

  function methodCard(method) {
    const limit = method.limitMode === "unlimited" ? "Limitsiz" : `Bu gün tamamlanıb: ${method.confirmedToday}/${method.dailyLimit}`;
    const remaining = method.limitMode === "unlimited" ? "Qalan limit: limitsiz" : `Qalan limit: ${method.remaining}`;
    const reset = method.lastResetAt ? dateTime(method.lastResetAt) : "Bu gün sayğac yaradılmayıb";
    const reason = !method.hasNumber ? "Tam nömrə daxil edilməyib" : method.archived ? "Silinib" : method.available ? "Aktivdir" : method.active ? "Limitdədir" : "Deaktivdir";
    return `<article class="paymentMethodAdminCard${method.available ? " isAvailable" : ""}" data-payment-method-id="${escp(method.id)}">
      <div class="paymentMethodColor" style="--payment-method-color:${escp(method.color)}"></div>
      <div><strong>${escp(method.displayName)}</strong><span>${escp(method.adminMaskedNumber || method.maskedNumber)} · ${escp(method.providerName)}</span><small>${escp(limit)} · Aktiv rezerv: ${Number(method.pendingReservations)} · ${escp(remaining)}</small><small>Son sıfırlanma: ${escp(reset)} · ${escp(reason)}</small></div>
      <div class="paymentMethodAdminActions"><span class="statusPill ${method.active && !method.archived ? "ok" : ""}">${method.archived ? "Silinib" : method.active ? "Aktiv" : "Deaktiv"}</span>${method.archived ? "" : `<button class="btn" type="button" data-edit-payment-method="${escp(method.id)}">Redaktə et</button>`}</div>
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
    const value = method || { displayName: "", type: "bank_card", providerName: "", holderName: "", color: "#151515", icon: "card", theme: "auto", active: false, order: paymentState.methods.filter((item) => !item.archived).length + 1, dailyLimit: 5, limitMode: "limited", adminNote: "", maskedNumber: "" };
    host.innerHTML = `<form id="paymentMethodForm" class="paymentMethodEditorCard" autocomplete="off">
      <div class="sectionHead"><div><h3>${isNew ? "Yeni ödəniş üsulu" : escp(value.displayName)}</h3><p>${isNew ? "Tam nömrə yalnız şifrələnmiş formada saxlanacaq." : `Hazırkı nömrə: ${escp(value.adminMaskedNumber || value.maskedNumber)}. Dəyişmək üçün yeni tam nömrə daxil edin.`}</p></div><button class="btn" type="button" data-close-payment-editor>Bağla</button></div>
      <div class="formGrid">
        <label>Göstərilən ad<input name="displayName" required maxlength="80" value="${escp(value.displayName)}"></label>
        <label>Növ<select name="type"><option value="bank_card"${value.type === "bank_card" ? " selected" : ""}>Bank kartı</option><option value="wallet"${value.type === "wallet" ? " selected" : ""}>Elektron cüzdan</option></select></label>
        <label>Bank/xidmət adı<input name="providerName" required maxlength="80" value="${escp(value.providerName)}"></label>
        <label>Kart/cüzdan sahibi<input name="holderName" maxlength="120" value="${escp(value.holderName)}"></label>
        <label>${isNew ? "Tam nömrə" : "Yeni tam nömrə — dəyişmirsə boş saxla"}<input name="fullNumber" type="text" inputmode="numeric" autocomplete="off" ${isNew ? "required" : ""} minlength="7" maxlength="23" placeholder="4098 5844 9937 4419"><small>Nömrəni yadda saxlamazdan əvvəl görə bilərsiniz; saxlandıqdan sonra sahə təmizlənəcək.</small></label>
        <label>Mövzu<select name="theme"><option value="auto"${value.theme === "auto" ? " selected" : ""}>Avtomatik</option><option value="leo"${value.theme === "leo" ? " selected" : ""}>LeoBank</option><option value="abb"${value.theme === "abb" ? " selected" : ""}>ABB</option><option value="kapital"${value.theme === "kapital" ? " selected" : ""}>Kapital Bank</option><option value="m10"${value.theme === "m10" ? " selected" : ""}>M10</option><option value="neutral"${value.theme === "neutral" ? " selected" : ""}>Neytral</option></select></label>
        <label>Rəng<input name="color" type="color" value="${escp(value.color)}"></label>
        <label>İkon<select name="icon"><option value="card"${value.icon === "card" ? " selected" : ""}>Kart</option><option value="bank"${value.icon === "bank" ? " selected" : ""}>Bank</option><option value="wallet"${value.icon === "wallet" ? " selected" : ""}>Cüzdan</option></select></label>
        <label>Sıra<input name="order" type="number" min="1" value="${Number(value.order)}"></label>
        <label>Gündəlik limit<input name="dailyLimit" type="number" min="1" max="10000" value="${Number(value.dailyLimit)}"></label>
        <label>Limit rejimi<select name="limitMode"><option value="limited"${value.limitMode === "limited" ? " selected" : ""}>Məhdud</option><option value="unlimited"${value.limitMode === "unlimited" ? " selected" : ""}>Limitsiz</option></select></label>
        <label class="checkLabel"><input name="active" type="checkbox"${value.active ? " checked" : ""}> Aktivdir</label>
        <label class="wide">Administrator qeydi<textarea name="adminNote" maxlength="2000">${escp(value.adminNote)}</textarea></label>
      </div>
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
    if (!pending) fields.push(["Təsdiqlənmə", dateTime(order.completedAt)], ["Bitmə tarixi", calendarDate(order.expiresOn)]);
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

  function renderStatistics() {
    const host = $p("paymentOrderStatistics"); if (!host) return;
    const stats = paymentState.orderMeta.statistics || {};
    if (paymentState.orderQuery.tab === "pending") { host.innerHTML = ""; return; }
    const productSummary = (stats.products || []).slice(0, 8).map((item) => `<span>${escp(item.title)}: <b>${Number(item.count)}</b></span>`).join("");
    host.innerHTML = `<div><small>Tamamlanmış sifariş</small><strong>${Number(stats.count || 0)}</strong></div><div><small>Ümumi satış</small><strong>${money(stats.revenue || 0)}</strong></div><div><small>Ən çox satılan məhsul</small><strong>${escp(stats.topProduct || "—")}</strong></div>${productSummary ? `<div class="paymentProductStats"><small>Məhsullar üzrə</small>${productSummary}</div>` : ""}`;
  }

  function renderOrders() {
    const list = $p("paymentOrdersList");
    if (list) list.innerHTML = paymentState.orders.length ? paymentState.orders.map(orderCard).join("") : '<div class="emptyState">Bu seçimə uyğun sifariş tapılmadı.</div>';
    const pagination = paymentState.orderMeta.pagination;
    if ($p("paymentOrdersPageInfo")) $p("paymentOrdersPageInfo").textContent = `Səhifə ${pagination.page} / ${pagination.totalPages} · ${pagination.total} sifariş`;
    if ($p("paymentOrdersPrevious")) $p("paymentOrdersPrevious").disabled = pagination.page <= 1;
    if ($p("paymentOrdersNext")) $p("paymentOrdersNext").disabled = pagination.page >= pagination.totalPages;
    document.querySelectorAll("[data-payment-order-tab]").forEach((button) => {
      const active = button.dataset.paymentOrderTab === paymentState.orderQuery.tab;
      button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active));
    });
    updateOrderCounts(); populateOrderFilters(); renderStatistics();
  }

  function renderEmails() {
    if ($p("paymentEmailsList")) $p("paymentEmailsList").innerHTML = paymentState.emails.length ? paymentState.emails.map((item) => `<article class="paymentEmailRow"><div><strong>${escp(item.status === "sent" ? "Göndərilib" : "Bildiriş gözləyir")}</strong><span>${escp(item.recipient)} · ${Number(item.attempts)} cəhd</span>${item.last_error ? `<small class="bad">${escp(item.last_error)}</small>` : ""}</div>${item.status !== "sent" ? `<button class="btn" type="button" data-retry-payment-email="${escp(item.id)}">Yenidən göndər</button>` : ""}</article>`).join("") : '<div class="emptyState">Bildiriş qeydi yoxdur.</div>';
  }

  async function loadOrders() {
    const status = $p("paymentOrdersStatus"); const list = $p("paymentOrdersList");
    if (status) status.textContent = "Sifarişlər yüklənir…";
    if (list) { list.setAttribute("aria-busy", "true"); list.innerHTML = '<div class="emptyState">Yüklənir…</div>'; }
    const query = new URLSearchParams(Object.entries(paymentState.orderQuery).filter(([, value]) => value !== ""));
    try {
      const result = await paymentApi(`/api/admin/payment-orders?${query}`);
      const nextPending = Number(result.counts?.pending || 0);
      if (paymentState.knownPendingCount !== null && nextPending > paymentState.knownPendingCount) toast(`${nextPending - paymentState.knownPendingCount} yeni sifariş var.`);
      paymentState.knownPendingCount = nextPending;
      paymentState.orders = result.orders || [];
      paymentState.orderMeta = { counts: result.counts || {}, statistics: result.statistics || {}, pagination: result.pagination || {}, filters: result.filters || {} };
      if (paymentState.orderQuery.page > paymentState.orderMeta.pagination.totalPages && paymentState.orderQuery.page > 1) { paymentState.orderQuery.page = paymentState.orderMeta.pagination.totalPages; return loadOrders(); }
      renderOrders(); if (status) status.textContent = `${paymentState.orderMeta.pagination.total || 0} nəticə göstərilir.`;
    } catch (error) {
      if (list) list.innerHTML = `<div class="emptyState bad">${escp(error.message || "Sifarişlər yüklənmədi.")}</div>`;
      if (status) status.textContent = "Server xətası baş verdi.";
      throw error;
    } finally { list?.removeAttribute("aria-busy"); }
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
    document.addEventListener("input", (event) => { if (event.target.matches('#paymentMethodForm input[name="fullNumber"]')) event.target.value = formatNumber(event.target.value); });
    document.addEventListener("change", (event) => { if (event.target.id === "paymentOrderPeriod") document.querySelectorAll(".paymentCustomDate").forEach((item) => item.classList.toggle("isActive", event.target.value === "custom")); });
    document.addEventListener("click", async (event) => {
      try {
        const viewButton = event.target.closest(".navBtn[data-view]");
        if (viewButton?.dataset.view === "paymentMethods") await loadMethods();
        if (viewButton?.dataset.view === "paymentOrders") await loadOrders();
        if (viewButton?.dataset.view === "paymentReviews") await loadEmails();
        if (event.target.closest("#paymentMethodAdd")) { paymentState.selectedMethodId = ""; renderMethodEditor(); }
        const edit = event.target.closest("[data-edit-payment-method]");
        if (edit) { paymentState.selectedMethodId = edit.dataset.editPaymentMethod; renderMethodEditor(paymentState.methods.find((item) => item.id === paymentState.selectedMethodId)); }
        if (event.target.closest("[data-close-payment-editor]")) { paymentState.selectedMethodId = ""; $p("paymentMethodEditor").innerHTML = ""; }
        if (event.target.closest("[data-reset-payment-counter]") && paymentState.selectedMethodId && confirm("Bu kartın bugünkü təsdiq sayğacı sıfırlansın?")) { await paymentApi(`/api/admin/payment-methods/${paymentState.selectedMethodId}/reset-counter`, { method: "POST", body: "{}" }); await loadMethods(); }
        if (event.target.closest("[data-delete-payment-method]") && paymentState.selectedMethodId && confirm("Bu kart aktiv ödəniş siyahısından silinsin? Tarixçə qorunacaq.")) { await paymentApi(`/api/admin/payment-methods/${paymentState.selectedMethodId}/delete`, { method: "POST", body: "{}" }); paymentState.selectedMethodId = ""; $p("paymentMethodEditor").innerHTML = ""; await loadMethods(); }
        if (event.target.closest("#paymentOrdersRefresh")) await loadOrders();
        if (event.target.closest("#paymentReviewsRefresh")) await loadEmails();
        const tab = event.target.closest("[data-payment-order-tab]");
        if (tab) { paymentState.orderQuery.tab = tab.dataset.paymentOrderTab; paymentState.orderQuery.page = 1; await loadOrders(); }
        if (event.target.closest("#paymentOrdersPrevious") && paymentState.orderMeta.pagination.page > 1) { paymentState.orderQuery.page -= 1; await loadOrders(); }
        if (event.target.closest("#paymentOrdersNext") && paymentState.orderMeta.pagination.page < paymentState.orderMeta.pagination.totalPages) { paymentState.orderQuery.page += 1; await loadOrders(); }
        if (event.target.closest("#paymentOrderFiltersClear")) { paymentState.orderQuery = emptyQuery(); $p("paymentOrderFilters")?.reset(); document.querySelectorAll(".paymentCustomDate").forEach((item) => item.classList.remove("isActive")); await loadOrders(); }
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
        Object.assign(paymentState.orderQuery, { search: $p("paymentOrderSearch")?.value.trim() || "", productId: $p("paymentOrderProduct")?.value || "", planName: $p("paymentOrderPlan")?.value || "", methodId: $p("paymentOrderMethod")?.value || "", period: $p("paymentOrderPeriod")?.value || "", dateFrom: $p("paymentOrderDateFrom")?.value || "", dateTo: $p("paymentOrderDateTo")?.value || "", sort: $p("paymentOrderSort")?.value || "newest", page: 1 });
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
      paymentState.orderQuery.page = 1; await loadOrders();
      const card = document.querySelector(`[data-payment-order-id="${CSS.escape(result.order.id)}"]`); card?.classList.add("isHighlighted"); card?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) { toast(error.message || "Yoxlama keçidi etibarsızdır."); }
    finally { history.replaceState({}, "", "/admin.html"); }
  }

  function bootPayments() {
    bindEvents(); setTimeout(openReviewToken, 400);
    const timer = setInterval(() => { if (document.visibilityState !== "visible") return; if (!$p("paymentOrdersView")?.classList.contains("hidden")) loadOrders().catch(() => {}); else if (!$p("paymentReviewsView")?.classList.contains("hidden")) loadEmails().catch(() => {}); else refreshOrderCounts().catch(() => {}); }, 45_000);
    setTimeout(() => refreshOrderCounts().catch(() => {}), 1000); window.addEventListener("beforeunload", () => clearInterval(timer), { once: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPayments); else bootPayments();
})();
