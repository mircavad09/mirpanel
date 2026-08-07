(() => {
  "use strict";

  const paymentState = { methods: [], orders: [], emails: [], selectedMethodId: "", loading: false, knownReviewingIds: null };
  const $p = (id) => document.getElementById(id);
  const escp = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const statusLabel = { reviewing: "Yoxlanılır", approved: "Təsdiqlənib", rejected: "Rədd edilib", new_receipt_requested: "Yeni çek gözlənilir" };

  async function paymentApi(path, options) {
    return api(path, options);
  }

  function methodCard(method) {
    const limit = method.limitMode === "unlimited" ? "Limitsiz" : `${method.confirmedToday}/${method.dailyLimit} təsdiq · ${method.pendingReservations} rezerv`;
    const reason = !method.hasNumber ? "Tam nömrə daxil edilməyib" : method.archived ? "Arxivdədir" : method.available ? "Müştəri üçün əlçatandır" : method.active ? "Limit və ya rezerv səbəbilə bağlıdır" : "Deaktivdir";
    return `<article class="paymentMethodAdminCard${method.available ? " isAvailable" : ""}" data-payment-method-id="${escp(method.id)}">
      <div class="paymentMethodColor" style="--payment-method-color:${escp(method.color)}"></div>
      <div><strong>${escp(method.displayName)}</strong><span>${escp(method.maskedNumber)} · ${escp(method.providerName)}</span><small>${escp(limit)} · ${escp(reason)}</small></div>
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
    const value = method || { displayName: "", type: "bank_card", providerName: "", holderName: "", color: "#151515", icon: "card", active: false, order: paymentState.methods.length + 1, dailyLimit: 5, limitMode: "limited", adminNote: "", maskedNumber: "" };
    host.innerHTML = `<form id="paymentMethodForm" class="paymentMethodEditorCard" autocomplete="off">
      <div class="sectionHead"><div><h3>${isNew ? "Yeni ödəniş üsulu" : escp(value.displayName)}</h3><p>${isNew ? "Tam nömrə yalnız şifrələnmiş formada saxlanacaq." : `Hazırkı nömrə: ${escp(value.maskedNumber)}. Dəyişmək üçün yeni tam nömrə daxil edin.`}</p></div><button class="btn" type="button" data-close-payment-editor>Bağla</button></div>
      <div class="formGrid">
        <label>Göstərilən ad<input name="displayName" required maxlength="80" value="${escp(value.displayName)}"></label>
        <label>Növ<select name="type"><option value="bank_card"${value.type === "bank_card" ? " selected" : ""}>Bank kartı</option><option value="wallet"${value.type === "wallet" ? " selected" : ""}>Elektron cüzdan</option></select></label>
        <label>Bank/xidmət adı<input name="providerName" required maxlength="80" value="${escp(value.providerName)}"></label>
        <label>Kart/cüzdan sahibi<input name="holderName" maxlength="120" value="${escp(value.holderName)}"></label>
        <label>${isNew ? "Tam nömrə" : "Yeni tam nömrə (dəyişmirsə boş saxla)"}<input name="fullNumber" type="password" inputmode="numeric" autocomplete="new-password" ${isNew ? "required" : ""} minlength="4" maxlength="40"><small>Tam nömrə admin siyahısına geri qaytarılmır.</small></label>
        <label>Rəng<input name="color" type="color" value="${escp(value.color)}"></label>
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
    const method = order.payment_methods || {};
    const reservation = order.payment_reservations || {};
    const history = (order.audit_history || []).map((item) => `<li><span>${escp(item.action)}</span><time>${escp(new Date(item.created_at).toLocaleString("az-AZ"))}</time></li>`).join("");
    return `<article class="paymentOrderAdminCard" data-payment-order-id="${escp(order.id)}">
      <div class="paymentOrderHead"><div><strong>${escp(order.order_code)}</strong><span class="statusPill status-${escp(order.status)}">${escp(statusLabel[order.status] || order.status)}</span></div><time>${escp(new Date(order.created_at).toLocaleString("az-AZ"))}</time></div>
      <div class="paymentOrderGrid"><span><b>Məhsul</b>${escp(order.product_title)}</span><span><b>Plan</b>${escp(order.plan_name)}</span><span><b>Məbləğ</b>${Number(order.amount).toFixed(2)} ${escp(order.currency)}</span><span><b>Ödəniş üsulu</b>${escp(method.display_name || "")} •••• ${escp(method.last4 || "")}</span><span><b>Rezerv</b>${escp(reservation.status || "")}</span></div>
      ${order.rejection_reason ? `<p class="bad">Rədd səbəbi: ${escp(order.rejection_reason)}</p>` : ""}
      <label class="paymentOrderNote">Administrator qeydi<textarea maxlength="4000" data-payment-order-note>${escp(order.admin_note || "")}</textarea></label>
      <div class="paymentOrderActions"><button class="btn" type="button" data-open-receipt>Çeki aç</button>${order.status !== "approved" && order.status !== "rejected" ? '<button class="btn primary" type="button" data-approve-payment>Ödənişi təsdiqlə</button><button class="btn danger" type="button" data-reject-payment>Rədd et</button><button class="btn" type="button" data-request-receipt>Yeni çek tələb et</button><button class="btn" type="button" data-cancel-payment-reservation>Rezervi ləğv et</button>' : ""}</div>
      <div class="paymentOrderActions"><button class="btn" type="button" data-save-payment-note>Qeydi saxla</button></div>
      <details class="paymentAuditHistory"><summary>Əməliyyat tarixçəsi (${(order.audit_history || []).length})</summary><ul>${history || "<li>Audit qeydi yoxdur.</li>"}</ul></details>
    </article>`;
  }

  function renderOrders() {
    const query = ($p("paymentOrderSearch")?.value || "").trim().toLowerCase();
    const orders = paymentState.orders.filter((item) => !query || item.order_code.toLowerCase().includes(query));
    if ($p("paymentOrdersList")) $p("paymentOrdersList").innerHTML = orders.length ? orders.map(orderCard).join("") : '<div class="emptyState">Sifariş tapılmadı.</div>';
    if ($p("paymentEmailsList")) $p("paymentEmailsList").innerHTML = paymentState.emails.length ? paymentState.emails.map((item) => `<article class="paymentEmailRow"><div><strong>${escp(item.status === "sent" ? "Göndərilib" : "Bildiriş gözləyir")}</strong><span>${escp(item.recipient)} · ${Number(item.attempts)} cəhd</span>${item.last_error ? `<small class="bad">${escp(item.last_error)}</small>` : ""}</div>${item.status !== "sent" ? `<button class="btn" type="button" data-retry-payment-email="${escp(item.id)}">Yenidən göndər</button>` : ""}</article>`).join("") : '<div class="emptyState">Bildiriş qeydi yoxdur.</div>';
  }

  async function loadOrders() {
    const result = await paymentApi("/api/admin/payment-orders");
    const reviewingIds = new Set((result.orders || []).filter((item) => item.status === "reviewing").map((item) => item.id));
    if (paymentState.knownReviewingIds) {
      const newCount = [...reviewingIds].filter((id) => !paymentState.knownReviewingIds.has(id)).length;
      if (newCount) toast(`${newCount} yeni ödəniş yoxlaması var.`);
    }
    paymentState.knownReviewingIds = reviewingIds;
    paymentState.orders = result.orders || [];
    paymentState.emails = result.emails || [];
    const nav = document.querySelector('.navBtn[data-view="paymentReviews"]');
    if (nav) {
      nav.dataset.pendingCount = String(reviewingIds.size);
      nav.setAttribute("aria-label", reviewingIds.size ? `Ödəniş yoxlamaları, ${reviewingIds.size} yeni sifariş` : "Ödəniş yoxlamaları");
    }
    renderOrders();
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
      const result = await paymentApi(`/api/admin/payment-orders/${id}/receipt`);
      window.open(result.url, "_blank", "noopener,noreferrer");
      return;
    }
    let body = {};
    if (action === "note") body.note = card.querySelector("[data-payment-order-note]")?.value || "";
    if (action === "approve") {
      const approved = await paymentActionDialog({ title: "Ödənişi təsdiqlə", message: "Ödənişin real olduğunu yoxladığınızı təsdiqləyin.", confirmText: "Təsdiqlə" });
      if (!approved) return;
    }
    if (action === "reject") {
      const reason = await paymentActionDialog({ title: "Ödənişi rədd et", message: "Rədd səbəbini yazın. Bu məlumat audit tarixçəsində saxlanacaq.", label: "Rədd səbəbi", required: true, confirmText: "Rədd et", danger: true });
      if (!reason) return;
      body.reason = reason;
    }
    if (action === "new-receipt") {
      const note = await paymentActionDialog({ title: "Yeni çek tələb et", message: "Müştəriyə göndəriləcək qeydi yazın.", label: "Qeyd", value: "Yeni ödəniş çeki tələb olunur.", confirmText: "Keçid yarat" });
      if (note === null) return;
      body.note = note || "Yeni ödəniş çeki tələb olunur.";
    }
    const result = await paymentApi(`/api/admin/payment-orders/${id}/${action}`, { method: "POST", body: JSON.stringify(body) });
    if (action === "new-receipt" && result.replacementUrl) {
      await navigator.clipboard.writeText(result.replacementUrl).catch(() => {});
      await paymentActionDialog({ title: "Yeni çek keçidi hazırdır", message: "Keçid buferə kopyalandı. WhatsApp vasitəsilə müştəriyə göndərin. Keçid 24 saat etibarlıdır və bir dəfə işləyir.", label: "Keçid", value: result.replacementUrl, confirmText: "Bağla" });
    }
    toast("Sifariş vəziyyəti yeniləndi.");
    await loadOrders();
    await loadMethods();
  }

  function bindEvents() {
    document.addEventListener("click", async (event) => {
      try {
        const viewButton = event.target.closest(".navBtn[data-view]");
        if (viewButton?.dataset.view === "paymentMethods") await loadMethods();
        if (viewButton?.dataset.view === "paymentReviews") await loadOrders();
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
        if (event.target.closest("#paymentReviewsRefresh")) await loadOrders();
        const card = event.target.closest("[data-payment-order-id]");
        if (card && event.target.closest("[data-open-receipt]")) await handleOrderAction(card, "receipt");
        if (card && event.target.closest("[data-approve-payment]")) await handleOrderAction(card, "approve");
        if (card && event.target.closest("[data-reject-payment]")) await handleOrderAction(card, "reject");
        if (card && event.target.closest("[data-request-receipt]")) await handleOrderAction(card, "new-receipt");
        if (card && event.target.closest("[data-cancel-payment-reservation]")) await handleOrderAction(card, "cancel-reservation");
        if (card && event.target.closest("[data-save-payment-note]")) await handleOrderAction(card, "note");
        const retry = event.target.closest("[data-retry-payment-email]");
        if (retry) { await paymentApi(`/api/admin/payment-emails/${retry.dataset.retryPaymentEmail}/retry`, { method: "POST", body: "{}" }); toast("Bildiriş yenidən növbəyə alındı."); await loadOrders(); }
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
      if (event.target.id !== "paymentMethodForm") return;
      event.preventDefault();
      try { await saveMethod(event.target); } catch (error) { toast(error.message || "Ödəniş üsulu saxlanmadı."); }
    });
    document.addEventListener("input", (event) => { if (event.target.id === "paymentOrderSearch") renderOrders(); });
  }

  async function openReviewToken() {
    const token = new URLSearchParams(location.search).get("reviewToken");
    if (!token) return;
    const button = document.querySelector('.navBtn[data-view="paymentReviews"]');
    button?.click();
    try {
      const result = await paymentApi("/api/admin/payment-review-token", { method: "POST", body: JSON.stringify({ token }) });
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
      if (document.visibilityState === "visible") loadOrders().catch(() => {});
    }, 45_000);
    window.addEventListener("beforeunload", () => clearInterval(timer), { once: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootPayments);
  else bootPayments();
})();
