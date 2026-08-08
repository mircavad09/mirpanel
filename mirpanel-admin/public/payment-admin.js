(() => {
  "use strict";

  const paymentState = {
    methods: [], orders: [], emails: [], selectedMethodId: "", loading: false,
    knownPendingCount: null, orderActions: new Set(),
    orderQuery: { tab: "pending", status: "", search: "", productId: "", methodId: "", dateFrom: "", dateTo: "", sort: "newest", page: 1 },
    orderMeta: { counts: { pending: 0, completed: 0, rejected: 0 }, pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 }, filters: { products: [], methods: [] } }
  };
  const $p = (id) => document.getElementById(id);
  const escp = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const statusLabel = { reviewing: "Yoxlanılır", completed: "Tamamlandı", rejected: "Rədd edilib", expired: "Vaxtı bitib" };
  const reservationLabel = { reserved: "Rezerv edilib", reviewing: "Yoxlanılır", completed: "Tamamlandı", rejected: "Rədd edilib", cancelled: "Ləğv edilib", expired: "Vaxtı bitib" };
  const auditLabel = {
    "order.submitted": "Sifariş yaradıldı", "order.approved": "Ödəniş təsdiqləndi", "order.rejected": "Sifariş rədd edildi",
    "receipt.signed_url_created": "Çek təhlükəsiz açıldı", "email.retry_queued": "Bildiriş yenidən növbəyə alındı"
  };

  async function paymentApi(path, options) {
    return api(path, options);
  }

  function methodCard(method) {
    const limit = method.limitMode === "unlimited" ? "Limitsiz" : `Bu gün tamamlanıb: ${method.confirmedToday}/${method.dailyLimit}`;
    const remaining = method.limitMode === "unlimited" ? "Qalan limit: limitsiz" : `Qalan limit: ${method.remaining}`;
    const reset = method.lastResetAt ? new Date(method.lastResetAt).toLocaleString("az-AZ") : "Bu gün sayğac yaradılmayıb";
    const reason = !method.hasNumber ? "Tam nömrə daxil edilməyib" : method.archived ? "Arxivdədir" : method.available ? "Aktivdir" : method.active ? "Limitdədir" : "Deaktivdir";
    return `<article class="paymentMethodAdminCard${method.available ? " isAvailable" : ""}" data-payment-method-id="${escp(method.id)}">
      <div class="paymentMethodColor" style="--payment-method-color:${escp(method.color)}"></div>
      <div><strong>${escp(method.displayName)}</strong><span>${escp(method.maskedNumber)} · ${escp(method.providerName)}</span><small>${escp(limit)} · Aktiv rezerv: ${Number(method.pendingReservations)} · ${escp(remaining)}</small><small>Son sıfırlanma: ${escp(reset)} · ${escp(reason)}</small></div>
      <div class="paymentMethodAdminActions"><span class="statusPill ${method.active ? "ok" : ""}">${method.active ? "Aktiv" : "Deaktiv"}</span><button class="btn" type="button" data-edit-payment-method="${escp(method.id)}">Redaktə et</button></div>
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
    const value = method || { displayName: "", type: "bank_card", providerName: "", holderName: "", color: "#151515", icon: "card", theme: "auto", active: false, order: paymentState.methods.length + 1, dailyLimit: 5, limitMode: "limited", adminNote: "", maskedNumber: "" };
    host.innerHTML = `<form id="paymentMethodForm" class="paymentMethodEditorCard" autocomplete="off">
      <div class="sectionHead"><div><h3>${isNew ? "Yeni ödəniş üsulu" : escp(value.displayName)}</h3><p>${isNew ? "Tam nömrə yalnız şifrələnmiş formada saxlanacaq." : `Hazırkı nömrə: ${escp(value.maskedNumber)}. Dəyişmək üçün yeni tam nömrə daxil edin.`}</p></div><button class="btn" type="button" data-close-payment-editor>Bağla</button></div>
      <div class="formGrid">
        <label>Göstərilən ad<input name="displayName" required maxlength="80" value="${escp(value.displayName)}"></label>
        <label>Növ<select name="type"><option value="bank_card"${value.type === "bank_card" ? " selected" : ""}>Bank kartı</option><option value="wallet"${value.type === "wallet" ? " selected" : ""}>Elektron cüzdan</option></select></label>
        <label>Bank/xidmət adı<input name="providerName" required maxlength="80" value="${escp(value.providerName)}"></label>
        <label>Kart/cüzdan sahibi<input name="holderName" maxlength="120" value="${escp(value.holderName)}"></label>
        <label>${isNew ? "Tam nömrə" : "Yeni tam nömrə (dəyişmirsə boş saxla)"}<input name="fullNumber" type="password" inputmode="numeric" autocomplete="new-password" ${isNew ? "required" : ""} minlength="4" maxlength="40"><small>Tam nömrə admin siyahısına geri qaytarılmır.</small></label>
        <label>Rəng<input name="color" type="color" value="${escp(value.color)}"></label>
        <label>Kart mövzusu<select name="theme"><option value="auto"${value.theme === "auto" ? " selected" : ""}>Avtomatik (bank adına görə)</option><option value="leo"${value.theme === "leo" ? " selected" : ""}>LeoBank — qara/qızılı</option><option value="abb"${value.theme === "abb" ? " selected" : ""}>ABB — tünd mavi</option><option value="kapital"${value.theme === "kapital" ? " selected" : ""}>Kapital Bank — qırmızı</option><option value="m10"${value.theme === "m10" ? " selected" : ""}>M10 — firuzəyi cüzdan</option><option value="neutral"${value.theme === "neutral" ? " selected" : ""}>Neytral</option></select><small>Avtomatik seçim bank adına görə mövzunu təyin edir; istəsəniz əl ilə dəyişə bilərsiniz.</small></label>
        <label>İkon<select name="icon"><option value="card"${value.icon === "card" ? " selected" : ""}>Kart</option><option value="bank"${value.icon === "bank" ? " selected" : ""}>Bank</option><option value="wallet"${value.icon === "wallet" ? " selected" : ""}>Cüzdan</option></select></label>
        <label>Sıra<input name="order" type="number" min="1" value="${Number(value.order) || 1}"></label>
        <label>Gündəlik limit<input name="dailyLimit" type="number" min="1" max="10000" value="${Number(value.dailyLimit) || 5}"></label>
        <label>Limit rejimi<select name="limitMode"><option value="limited"${value.limitMode === "limited" ? " selected" : ""}>Gündəlik limit</option><option value="unlimited"${value.limitMode === "unlimited" ? " selected" : ""}>Limitsiz — əl ilə seçilib</option></select></label>
        <label class="switchLine"><input name="active" type="checkbox"${value.active ? " checked" : ""}><span>Müştəri üçün aktivdir</span></label>
        <label class="wide">Administrator qeydi<textarea name="adminNote" maxlength="2000">${escp(value.adminNote)}</textarea></label>
      </div>
      <div class="paymentEditorActions"><button class="btn primary" type="submit">Yadda saxla</button>${!isNew ? '<button class="btn" type="button" data-reset-payment-counter>Bugünkü sayğacı sıfırla</button><button class="btn danger" type="button" data-archive-payment-method>Arxivləşdir</button>' : ""}</div>
    </form>`;
    host.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadMethods() {
    const [result, settingsResult] = await Promise.all([paymentApi("/api/admin/payment-methods"), paymentApi("/api/admin/payment-settings")]);
    paymentState.methods = result.methods || [];
    if ($p("paymentNotificationEmail")) $p("paymentNotificationEmail").value = settingsResult.settings?.notificationEmail || "";
    if ($p("paymentReceiptRetentionDays")) $p("paymentReceiptRetentionDays").value = settingsResult.settings?.receiptRetentionDays || 90;
    if ($p("paymentMethodsStatus")) {
      const health = settingsResult.health || {};
      $p("paymentMethodsStatus").classList.remove("hidden");
      $p("paymentMethodsStatus").textContent = health.database && health.privateStorage
        ? `Verilənlər bazası və private çek yaddaşı hazırdır. Gmail: ${health.gmailConfigured ? "hazırdır" : "konfiqurasiya gözləyir"}.`
        : "Ödəniş infrastrukturu tam hazır deyil.";
    }
    renderMethods();
  }

  function orderCard(order) {
    const pending = order.status === "reviewing";
    const history = (order.auditHistory || []).map((item) => `<li><span>${escp(auditLabel[item.action] || item.action)}</span><time>${escp(new Date(item.created_at).toLocaleString("az-AZ"))}</time></li>`).join("");
    const displayDate = order.status === "completed" && order.completedAt ? order.completedAt : order.createdAt;
    return `<article class="paymentOrderAdminCard status-${escp(order.status)}" data-payment-order-id="${escp(order.id)}">
      <div class="paymentOrderHead"><div><strong title="${escp(order.orderCode)}">${escp(order.orderCode)}</strong><span class="statusPill status-${escp(order.status)}">${escp(statusLabel[order.status] || "Yoxlanılır")}</span></div><time datetime="${escp(displayDate)}">${escp(new Date(displayDate).toLocaleString("az-AZ"))}</time></div>
      <div class="paymentOrderCompactGrid">
        <span><b>Məhsul</b><em title="${escp(order.productTitle)}">${escp(order.productTitle)}</em></span>
        <span><b>Plan</b><em title="${escp(order.planName)}">${escp(order.planName)}</em></span>
        <span><b>Məbləğ</b><em>${Number(order.amount).toFixed(2)} ${escp(order.currency)}</em></span>
        <span><b>Ödəniş üsulu</b><em>${escp(order.paymentMethodLabel)}</em></span>
        ${pending ? `<span><b>Rezerv</b><em>${escp(reservationLabel[order.reservationStatus] || "Yoxlanılır")}</em></span>` : ""}
      </div>
      <div class="paymentOrderActions">
        ${order.receiptAvailable ? '<button class="btn" type="button" data-open-receipt>Çeki aç</button>' : '<span class="statusPill">Çek saxlanma müddəti bitib</span>'}
        ${pending ? '<button class="btn primary" type="button" data-approve-payment>Ödənişi təsdiqlə</button><button class="btn danger" type="button" data-reject-payment>Rədd et</button>' : ""}
      </div>
      <details class="paymentAuditHistory"><summary>Əməliyyat tarixçəsi (${(order.auditHistory || []).length})</summary><ul>${history || "<li>Audit qeydi yoxdur.</li>"}</ul></details>
    </article>`;
  }

  function updateOrderCounts(counts = paymentState.orderMeta.counts) {
    paymentState.orderMeta.counts = counts;
    if ($p("paymentPendingCount")) $p("paymentPendingCount").textContent = String(counts.pending || 0);
    if ($p("paymentCompletedCount")) $p("paymentCompletedCount").textContent = String(counts.completed || 0);
    const nav = document.querySelector('.navBtn[data-view="paymentOrders"]');
    if (nav) {
      nav.dataset.pendingCount = String(counts.pending || 0);
      nav.setAttribute("aria-label", counts.pending ? `Sifarişlər, ${counts.pending} gözləyən sifariş` : "Sifarişlər");
    }
  }

  function populateOrderFilters(filters = paymentState.orderMeta.filters) {
    const product = $p("paymentOrderProduct");
    const method = $p("paymentOrderMethod");
    if (product) {
      const selected = paymentState.orderQuery.productId;
      product.innerHTML = '<option value="">Bütün məhsullar</option>' + (filters.products || []).map((item) => `<option value="${escp(item.id)}">${escp(item.title)}</option>`).join("");
      product.value = selected;
    }
    if (method) {
      const selected = paymentState.orderQuery.methodId;
      method.innerHTML = '<option value="">Bütün banklar</option>' + (filters.methods || []).map((item) => `<option value="${escp(item.id)}">${escp(item.label)}</option>`).join("");
      method.value = selected;
    }
  }

  function renderOrders() {
    const list = $p("paymentOrdersList");
    if (list) list.innerHTML = paymentState.orders.length ? paymentState.orders.map(orderCard).join("") : '<div class="emptyState">Bu seçimə uyğun sifariş tapılmadı.</div>';
    const pagination = paymentState.orderMeta.pagination;
    if ($p("paymentOrdersPageInfo")) $p("paymentOrdersPageInfo").textContent = `Səhifə ${pagination.page} / ${pagination.totalPages} · ${pagination.total} sifariş`;
    if ($p("paymentOrdersPrevious")) $p("paymentOrdersPrevious").disabled = pagination.page <= 1;
    if ($p("paymentOrdersNext")) $p("paymentOrdersNext").disabled = pagination.page >= pagination.totalPages;
    document.querySelectorAll("[data-payment-order-tab]").forEach((button) => {
      const active = button.dataset.paymentOrderTab === paymentState.orderQuery.tab && !paymentState.orderQuery.status;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    updateOrderCounts();
    populateOrderFilters();
  }

  function renderEmails() {
    if ($p("paymentEmailsList")) $p("paymentEmailsList").innerHTML = paymentState.emails.length ? paymentState.emails.map((item) => `<article class="paymentEmailRow"><div><strong>${escp(item.status === "sent" ? "Göndərilib" : "Bildiriş gözləyir")}</strong><span>${escp(item.recipient)} · ${Number(item.attempts)} cəhd</span>${item.last_error ? `<small class="bad">${escp(item.last_error)}</small>` : ""}</div>${item.status !== "sent" ? `<button class="btn" type="button" data-retry-payment-email="${escp(item.id)}">Yenidən göndər</button>` : ""}</article>`).join("") : '<div class="emptyState">Bildiriş qeydi yoxdur.</div>';
  }

  async function loadOrders() {
    const status = $p("paymentOrdersStatus");
    const list = $p("paymentOrdersList");
    if (status) status.textContent = "Sifarişlər yüklənir…";
    if (list) { list.setAttribute("aria-busy", "true"); list.innerHTML = '<div class="emptyState">Yüklənir…</div>'; }
    const query = new URLSearchParams(Object.entries(paymentState.orderQuery).filter(([, value]) => value !== ""));
    try {
      const result = await paymentApi(`/api/admin/payment-orders?${query}`);
      const nextPending = Number(result.counts?.pending || 0);
      if (paymentState.knownPendingCount !== null && nextPending > paymentState.knownPendingCount) toast(`${nextPending - paymentState.knownPendingCount} yeni sifariş var.`);
      paymentState.knownPendingCount = nextPending;
      paymentState.orders = result.orders || [];
      paymentState.orderMeta = { counts: result.counts || {}, pagination: result.pagination || {}, filters: result.filters || {} };
      if (paymentState.orderQuery.page > paymentState.orderMeta.pagination.totalPages && paymentState.orderQuery.page > 1) {
        paymentState.orderQuery.page = paymentState.orderMeta.pagination.totalPages;
        return loadOrders();
      }
      renderOrders();
      if (status) status.textContent = `${paymentState.orderMeta.pagination.total || 0} nəticə göstərilir.`;
    } catch (error) {
      if (list) list.innerHTML = `<div class="emptyState bad">${escp(error.message || "Sifarişlər yüklənmədi.")}</div>`;
      if (status) status.textContent = "Server xətası baş verdi.";
      throw error;
    } finally {
      list?.removeAttribute("aria-busy");
    }
  }

  async function loadEmails() {
    const result = await paymentApi("/api/admin/payment-emails");
    paymentState.emails = result.emails || [];
    renderEmails();
  }

  async function refreshPendingCount() {
    const result = await paymentApi("/api/admin/payment-orders?tab=pending&page=1");
    const nextPending = Number(result.counts?.pending || 0);
    if (paymentState.knownPendingCount !== null && nextPending > paymentState.knownPendingCount) toast(`${nextPending - paymentState.knownPendingCount} yeni sifariş var.`);
    paymentState.knownPendingCount = nextPending;
    updateOrderCounts(result.counts || {});
  }

  async function saveMethod(form) {
    const data = Object.fromEntries(new FormData(form));
    data.active = form.elements.active.checked;
    data.dailyLimit = Number(data.dailyLimit);
    data.order = Number(data.order);
    const path = paymentState.selectedMethodId ? `/api/admin/payment-methods/${paymentState.selectedMethodId}` : "/api/admin/payment-methods";
    await paymentApi(path, { method: "POST", body: JSON.stringify(data) });
    paymentState.selectedMethodId = "";
    $p("paymentMethodEditor").innerHTML = "";
    toast("Ödəniş üsulu təhlükəsiz saxlanıldı.");
    await loadMethods();
  }

  function paymentActionDialog({ title, message, label = "", value = "", required = false, confirmText = "Təsdiqlə", danger = false }) {
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = "paymentActionDialog";
      dialog.innerHTML = `<form method="dialog" class="paymentActionDialogCard">
        <div class="sectionHead"><div><h3>${escp(title)}</h3><p>${escp(message)}</p></div><button class="btn" type="button" data-payment-dialog-close aria-label="Bağla">×</button></div>
        ${label ? `<label>${escp(label)}<textarea data-payment-dialog-value maxlength="2000"${required ? " required" : ""}>${escp(value)}</textarea></label>` : ""}
        <div class="paymentOrderActions"><button class="btn" type="button" data-payment-dialog-close>Ləğv et</button><button class="btn ${danger ? "danger" : "primary"}" type="submit">${escp(confirmText)}</button></div>
      </form>`;
      document.body.appendChild(dialog);
      const finish = (result) => {
        dialog.close();
        dialog.remove();
        resolve(result);
      };
      dialog.querySelectorAll("[data-payment-dialog-close]").forEach((button) => button.addEventListener("click", () => finish(null)));
      dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(null); }, { once: true });
      dialog.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = dialog.querySelector("[data-payment-dialog-value]");
        const result = input ? input.value.trim() : true;
        if (required && !result) { input.setCustomValidity("Bu sahə məcburidir."); input.reportValidity(); return; }
        finish(result);
      });
      dialog.showModal();
      dialog.querySelector("[data-payment-dialog-value]")?.focus();
    });
  }

  async function handleOrderAction(card, action) {
    const id = card.dataset.paymentOrderId;
    if (action === "receipt") {
      const receiptWindow = window.open("about:blank", "_blank");
      if (receiptWindow) receiptWindow.opener = null;
      try {
        const result = await paymentApi(`/api/admin/payment-orders/${id}/receipt`);
        if (receiptWindow) receiptWindow.location.replace(result.url);
        else window.location.assign(result.url);
      } catch (error) {
        receiptWindow?.close();
        throw error;
      }
      return;
    }
    if (paymentState.orderActions.has(id)) return;
    paymentState.orderActions.add(id);
    card.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try {
      if (action === "approve") {
        const approved = await paymentActionDialog({ title: "Ödənişi təsdiqlə", message: "Bu sifarişin ödənişini təsdiqləmək istəyirsiniz?", confirmText: "Təsdiqlə" });
        if (!approved) return;
      }
      if (action === "reject") {
        const rejected = await paymentActionDialog({ title: "Ödənişi rədd et", message: "Bu sifarişi rədd etmək istəyirsiniz?", confirmText: "Rədd et", danger: true });
        if (!rejected) return;
      }
      const result = await paymentApi(`/api/admin/payment-orders/${id}/${action}`, { method: "POST", body: "{}" });
      toast(result.idempotent ? "Sifariş artıq bu vəziyyətdədir." : "Sifariş vəziyyəti yeniləndi.");
      if (!result.idempotent) {
        card.remove();
        const counts = paymentState.orderMeta.counts;
        counts.pending = Math.max(0, Number(counts.pending || 0) - 1);
        if (action === "approve") counts.completed = Number(counts.completed || 0) + 1;
        if (action === "reject") counts.rejected = Number(counts.rejected || 0) + 1;
        updateOrderCounts(counts);
      }
      await loadOrders();
      await loadMethods();
    } finally {
      paymentState.orderActions.delete(id);
      if (card.isConnected) card.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    }
  }

  function bindEvents() {
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
        if (event.target.closest("[data-reset-payment-counter]") && paymentState.selectedMethodId && confirm("Bu kartın bugünkü təsdiq sayğacı sıfırlansın?")) {
          await paymentApi(`/api/admin/payment-methods/${paymentState.selectedMethodId}/reset-counter`, { method: "POST", body: "{}" }); await loadMethods();
        }
        if (event.target.closest("[data-archive-payment-method]") && paymentState.selectedMethodId && confirm("Ödəniş üsulu deaktiv edilərək arxivləşdirilsin?")) {
          await paymentApi(`/api/admin/payment-methods/${paymentState.selectedMethodId}/archive`, { method: "POST", body: "{}" }); paymentState.selectedMethodId = ""; $p("paymentMethodEditor").innerHTML = ""; await loadMethods();
        }
        if (event.target.closest("#paymentOrdersRefresh")) await loadOrders();
        if (event.target.closest("#paymentReviewsRefresh")) await loadEmails();
        const tab = event.target.closest("[data-payment-order-tab]");
        if (tab) {
          paymentState.orderQuery.tab = tab.dataset.paymentOrderTab;
          paymentState.orderQuery.status = "";
          paymentState.orderQuery.page = 1;
          if ($p("paymentOrderStatus")) $p("paymentOrderStatus").value = "";
          await loadOrders();
        }
        if (event.target.closest("#paymentOrdersPrevious") && paymentState.orderMeta.pagination.page > 1) {
          paymentState.orderQuery.page -= 1;
          await loadOrders();
        }
        if (event.target.closest("#paymentOrdersNext") && paymentState.orderMeta.pagination.page < paymentState.orderMeta.pagination.totalPages) {
          paymentState.orderQuery.page += 1;
          await loadOrders();
        }
        if (event.target.closest("#paymentOrderFiltersClear")) {
          paymentState.orderQuery = { tab: "pending", status: "", search: "", productId: "", methodId: "", dateFrom: "", dateTo: "", sort: "newest", page: 1 };
          $p("paymentOrderFilters")?.reset();
          await loadOrders();
        }
        const card = event.target.closest("[data-payment-order-id]");
        if (card && event.target.closest("[data-open-receipt]")) await handleOrderAction(card, "receipt");
        if (card && event.target.closest("[data-approve-payment]")) await handleOrderAction(card, "approve");
        if (card && event.target.closest("[data-reject-payment]")) await handleOrderAction(card, "reject");
        const retry = event.target.closest("[data-retry-payment-email]");
        if (retry) { await paymentApi(`/api/admin/payment-emails/${retry.dataset.retryPaymentEmail}/retry`, { method: "POST", body: "{}" }); toast("Bildiriş yenidən növbəyə alındı."); await loadEmails(); }
      } catch (error) { toast(error.message || "Ödəniş əməliyyatı tamamlanmadı."); }
    });
    document.addEventListener("submit", async (event) => {
      if (event.target.id === "paymentSettingsForm") {
        event.preventDefault();
        try {
          await paymentApi("/api/admin/payment-settings", { method: "POST", body: JSON.stringify({ notificationEmail: $p("paymentNotificationEmail").value, receiptRetentionDays: Number($p("paymentReceiptRetentionDays").value) }) });
          toast("Ödəniş parametrləri saxlanıldı.");
        } catch (error) { toast(error.message || "Parametrlər saxlanmadı."); }
        return;
      }
      if (event.target.id === "paymentOrderFilters") {
        event.preventDefault();
        paymentState.orderQuery.search = $p("paymentOrderSearch")?.value.trim() || "";
        paymentState.orderQuery.productId = $p("paymentOrderProduct")?.value || "";
        paymentState.orderQuery.status = $p("paymentOrderStatus")?.value || "";
        paymentState.orderQuery.methodId = $p("paymentOrderMethod")?.value || "";
        paymentState.orderQuery.dateFrom = $p("paymentOrderDateFrom")?.value || "";
        paymentState.orderQuery.dateTo = $p("paymentOrderDateTo")?.value || "";
        paymentState.orderQuery.sort = $p("paymentOrderSort")?.value || "newest";
        if (paymentState.orderQuery.status === "completed") paymentState.orderQuery.tab = "completed";
        else if (paymentState.orderQuery.status === "rejected") paymentState.orderQuery.tab = "rejected";
        else if (paymentState.orderQuery.status === "reviewing") paymentState.orderQuery.tab = "pending";
        paymentState.orderQuery.page = 1;
        await loadOrders();
        return;
      }
      if (event.target.id !== "paymentMethodForm") return;
      event.preventDefault();
      try { await saveMethod(event.target); } catch (error) { toast(error.message || "Ödəniş üsulu saxlanmadı."); }
    });
  }

  async function openReviewToken() {
    const token = new URLSearchParams(location.search).get("reviewToken");
    if (!token) return;
    const button = document.querySelector('.navBtn[data-view="paymentOrders"]');
    button?.click();
    try {
      const result = await paymentApi("/api/admin/payment-review-token", { method: "POST", body: JSON.stringify({ token }) });
      paymentState.orderQuery.search = result.order.order_code || "";
      paymentState.orderQuery.status = result.order.status === "rejected" ? "rejected" : (["approved", "completed"].includes(result.order.status) ? "completed" : "reviewing");
      paymentState.orderQuery.tab = paymentState.orderQuery.status === "completed" ? "completed" : (paymentState.orderQuery.status === "rejected" ? "rejected" : "pending");
      paymentState.orderQuery.page = 1;
      await loadOrders();
      const card = document.querySelector(`[data-payment-order-id="${CSS.escape(result.order.id)}"]`);
      card?.classList.add("isHighlighted");
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) { toast(error.message || "Yoxlama keçidi etibarsızdır."); }
    history.replaceState({}, "", "/admin.html");
  }

  function bootPayments() {
    bindEvents();
    setTimeout(openReviewToken, 400);
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (!$p("paymentOrdersView")?.classList.contains("hidden")) loadOrders().catch(() => {});
      else if (!$p("paymentReviewsView")?.classList.contains("hidden")) loadEmails().catch(() => {});
      else refreshPendingCount().catch(() => {});
    }, 45_000);
    setTimeout(() => refreshPendingCount().catch(() => {}), 1000);
    window.addEventListener("beforeunload", () => clearInterval(timer), { once: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPayments);
  else bootPayments();
})();
