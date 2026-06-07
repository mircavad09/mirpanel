(() => {
  const statusLabels = {
    pending: "Gozleyir",
    approved: "Tesdiqlendi",
    rejected: "Redd edildi",
    completed: "Tamamlandi"
  };

  const statusActions = [
    ["approved", "Tesdiqle", "approve"],
    ["rejected", "Redd et", "reject"],
    ["completed", "Tamamlandi et", "complete"]
  ];

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const get = (id) => document.getElementById(id);

  function notify(message, type = "good") {
    if (typeof window.toast === "function") {
      window.toast(message, type);
      return;
    }

    const toasts = get("toasts");
    if (!toasts) {
      alert(message);
      return;
    }

    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    toasts.appendChild(item);
    setTimeout(() => item.remove(), 4200);
  }

  function loading(active, text = "Yuklenir...") {
    if (typeof window.setLoading === "function") {
      window.setLoading(active, text);
      return;
    }

    const box = get("loading");
    const label = get("loadingText");
    if (box) box.classList.toggle("hidden", !active);
    if (label) label.textContent = text;
  }

  async function adminApi(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Server xetasi: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function injectStyles() {
    if (document.getElementById("adminOrdersStyles")) return;

    const style = document.createElement("style");
    style.id = "adminOrdersStyles";
    style.textContent = `
      .ordersTable td { vertical-align: top; }
      .ordersTable small { display: block; color: var(--muted); margin-top: 4px; line-height: 1.35; }
      .receiptLink { color: #ffe153; font-weight: 800; text-decoration: none; }
      .receiptLink:hover { text-decoration: underline; }
      .rowActions { display: flex; flex-wrap: wrap; gap: 6px; }
      .rowActions .btn { padding: 7px 9px; font-size: 12px; }
      .statusPill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 800;
        background: rgba(148, 163, 184, .14);
        color: #e5e7eb;
        border: 1px solid rgba(148, 163, 184, .22);
        white-space: nowrap;
      }
      .statusPill.approved {
        color: #bbf7d0;
        border-color: rgba(34, 197, 94, .34);
        background: rgba(34, 197, 94, .13);
      }
      .statusPill.rejected {
        color: #fecaca;
        border-color: rgba(239, 68, 68, .34);
        background: rgba(239, 68, 68, .13);
      }
      .statusPill.completed {
        color: #bfdbfe;
        border-color: rgba(59, 130, 246, .34);
        background: rgba(59, 130, 246, .13);
      }
      @media (max-width: 760px) {
        .ordersTable { min-width: 980px; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOrdersView() {
    injectStyles();

    const nav = document.querySelector(".nav");
    if (nav && !document.querySelector('.navBtn[data-view="orders"]')) {
      const settingsButton = document.querySelector('.navBtn[data-view="settings"]');
      const button = document.createElement("button");
      button.className = "navBtn";
      button.dataset.view = "orders";
      button.type = "button";
      button.textContent = "Sifarisler";
      nav.insertBefore(button, settingsButton || null);
    }

    const main = document.querySelector(".main");
    if (main && !get("ordersView")) {
      const section = document.createElement("section");
      section.className = "panel singlePanel hidden";
      section.id = "ordersView";
      section.innerHTML = `
        <div class="panelHead">
          <div>
            <h2>Sifarisler</h2>
            <p>Admin tesdiqli odenisli sifarisler</p>
          </div>
          <button class="btn" id="refreshOrdersBtn" type="button">Yenile</button>
        </div>
        <div class="tableWrap">
          <table class="ordersTable">
            <thead>
              <tr>
                <th>Sifaris</th>
                <th>Tarix</th>
                <th>Mehsul</th>
                <th>Plan</th>
                <th>Qiymet</th>
                <th>Gmail</th>
                <th>Cek</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="ordersBody">
              <tr><td colspan="9" class="emptyState">Sifarisler yuklenir...</td></tr>
            </tbody>
          </table>
        </div>
      `;
      main.appendChild(section);
    }

    document.querySelectorAll('.navBtn[data-view="orders"]').forEach((button) => {
      if (button.dataset.ordersBound === "true") return;
      button.dataset.ordersBound = "true";
      button.addEventListener("click", () => {
        showOrders();
        loadOrders();
      });
    });

    get("refreshOrdersBtn")?.addEventListener("click", loadOrders);
  }

  function showOrders() {
    ["products", "categories", "settings"].forEach((name) => {
      get(`${name}View`)?.classList.add("hidden");
    });
    get("ordersView")?.classList.remove("hidden");
    document.querySelectorAll(".navBtn[data-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === "orders");
    });
    const crumb = get("crumb");
    if (crumb) crumb.textContent = "Sifarisler";
  }

  async function loadOrders() {
    const body = get("ordersBody");
    if (!body) return;

    loading(true, "Sifarisler yuklenir...");
    try {
      const payload = await adminApi("/api/admin/payment-orders");
      renderOrders(Array.isArray(payload.orders) ? payload.orders : []);
    } catch (error) {
      body.innerHTML = `<tr><td colspan="9" class="emptyState">${escapeHtml(error.message)}</td></tr>`;
      notify(error.message, "bad");
    } finally {
      loading(false);
    }
  }

  function renderOrders(orders) {
    const body = get("ordersBody");
    if (!body) return;

    if (!orders.length) {
      body.innerHTML = `<tr><td colspan="9" class="emptyState">Sifaris yoxdur.</td></tr>`;
      return;
    }

    body.innerHTML = orders.map((order) => {
      const status = order.status || "pending";
      const date = order.createdAt ? new Date(order.createdAt).toLocaleString("az-AZ") : "";
      const receipt = order.receiptFileUrl
        ? `<a class="receiptLink" href="${escapeHtml(order.receiptFileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(order.receiptFileName || "Ceke bax")}</a>`
        : `<span class="muted">Yoxdur</span>`;
      const actions = statusActions.map(([nextStatus, label, className]) => `
        <button class="btn ${className === "reject" ? "danger" : ""} orderStatusBtn"
          data-order-id="${escapeHtml(order.orderId)}"
          data-next-status="${nextStatus}"
          type="button">${label}</button>
      `).join("");

      return `
        <tr>
          <td><strong>#${escapeHtml(order.orderId)}</strong></td>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(order.productTitle || order.productId || "")}</td>
          <td>${escapeHtml(order.plan || "")}</td>
          <td>${escapeHtml(order.price || "")}</td>
          <td>${escapeHtml(order.customerEmail || "")}</td>
          <td>${receipt}</td>
          <td>
            <span class="statusPill ${escapeHtml(status)}">${escapeHtml(statusLabels[status] || status)}</span>
            ${Number.isFinite(Number(order.stockAfter)) ? `<small>Stok: ${escapeHtml(order.stockBefore)} -> ${escapeHtml(order.stockAfter)}</small>` : ""}
          </td>
          <td><div class="rowActions">${actions}</div></td>
        </tr>
      `;
    }).join("");

    document.querySelectorAll(".orderStatusBtn").forEach((button) => {
      button.addEventListener("click", () => updateStatus(button.dataset.orderId, button.dataset.nextStatus));
    });
  }

  async function updateStatus(orderId, status) {
    const label = statusLabels[status] || status;
    if (status === "approved" && !confirm("Sifarisi tesdiqleyim? Stok aktivdirse 1 eded azalacaq.")) return;

    loading(true, `${label} yazilir...`);
    try {
      const payload = await adminApi(`/api/admin/payment-orders/${encodeURIComponent(orderId)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      const stockText = payload.order && Number.isFinite(Number(payload.order.stockAfter))
        ? ` Stok: ${payload.order.stockBefore} -> ${payload.order.stockAfter}.`
        : "";
      notify(`Sifaris statusu yenilendi.${stockText}`);
      await loadOrders();

      if (typeof window.loadState === "function") {
        await window.loadState();
      }
    } catch (error) {
      notify(error.message, "bad");
    } finally {
      loading(false);
    }
  }

  function boot() {
    ensureOrdersView();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
