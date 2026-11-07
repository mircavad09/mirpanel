const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const amountFormat = new Intl.NumberFormat("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("az-AZ", { timeZone: "Asia/Baku", dateStyle: "short", timeStyle: "short" });
const displayAmount = value => amountFormat.formatToParts(Number(value)).map(part =>
  part.type === "decimal" ? "," : part.type === "group" ? " " : part.value).join("");
const money = cents => displayAmount(Number(cents) / 100) + " ₼";
const labels = { reviewing: "Yoxlanılır", approved: "Təsdiqləndi", rejected: "Rədd edildi" };

function time(label, value) {
  const wrapper = el("span");
  if (value && Number.isFinite(Date.parse(value))) {
    const node = el("time", dateFormat.format(new Date(value)));
    node.dateTime = value;
    wrapper.append(label + ": ", node);
  } else wrapper.textContent = label + ": vaxt qeyd edilməyib";
  return wrapper;
}

function identity(t) {
  const name = t.name?.trim() || "Müştəri";
  const member = t.member_number ? "#" + t.member_number : "ID qeyd edilməyib";
  const link = el(t.user_id ? "a" : "div", null, "topupIdentity");
  if (t.user_id) {
    link.href = "/admin.html?" + new URLSearchParams({topupUser:t.user_id}) + "#communityUsers";
    link.target = "_blank";
    link.rel = "noopener";
  }
  const initials = name.split(/\s+/u).slice(0, 2).map(word => Array.from(word)[0]).join("").toLocaleUpperCase("az-AZ");
  const avatar = el("span", initials, "topupAvatar");
  avatar.setAttribute("aria-hidden", "true");
  if (/^[a-f0-9-]{36}\.webp$/i.test(t.avatar_path || "")) {
    const img = el("img");
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => img.remove(), {once:true});
    img.src = "/api/community/media/" + t.avatar_path;
    avatar.append(img);
  }
  const text = el("span");
  text.append(el("strong", name), el("small", member));
  link.append(avatar, text);
  return link;
}

export async function mountShop({root, call, alive}) {
  let stopped = false, busy = false;
  const error = el("p", null, "topupError");
  error.setAttribute("role", "alert");
  const list = el("div", null, "topupList");
  const header = el("header", null, "topupHeader");
  header.append(el("h1", "Balans müraciətləri"), button("Yenilə", load));
  root.replaceChildren(header, error, list);

  function button(text, fn, className = "") {
    const b = el("button", text, ("btn " + className).trim());
    b.type = "button";
    b.onclick = async () => {
      if (busy) return;
      busy = true;
      b.disabled = true;
      error.textContent = "";
      try { await fn(); }
      catch (e) { error.textContent = e.message; }
      finally { busy = false; b.disabled = false; }
    };
    return b;
  }

  async function receipt(t) {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const {url} = await call("/shop", {action:"receipt", id:t.id});
      if (tab) tab.location.replace(url);
      else window.location.assign(url);
    } catch (e) { tab?.close(); throw e; }
  }

  async function decide(t, action, value) {
    if (action === "approve") {
      value = value.trim().replace(",", ".");
      if (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) <= 0) throw Error("Düzgün müsbət AZN məbləği yazın.");
      if (!confirm(`${t.name} hesabına ${displayAmount(value)} ₼ əlavə edilsin?`)) return;
    } else if (!confirm("Bu balans müraciəti rədd edilsin?")) return;
    await call("/shop", {action, id:t.id, ...(action === "approve" ? {amount:value} : {})});
    window.dispatchEvent(new Event("admin-topup-changed"));
    await load();
  }

  function renderCard(t) {
    const card = el("article", null, "topupCard");
    const top = el("div", null, "topupCardTop");
    const summary = el("div", null, "topupSummary");
    const status = el("span", labels[t.status] || "Naməlum status", "topupStatus");
    status.dataset.status = t.status;
    summary.append(el("strong", `İstənilən ${money(t.requested_cents)}`), status);
    top.append(identity(t), summary);

    const details = el("div", null, "topupDetails");
    details.append(time("Göndərilib", t.submitted_at));
    if (t.status === "approved") {
      if (t.approved_cents != null) details.append(el("strong", `Təsdiqlənən ${money(t.approved_cents)}`, "topupApproved"));
      details.append(time("Təsdiqlənib", t.decided_at));
    }
    if (t.receipt_available) details.append(button("Çekə bax", () => receipt(t)));
    card.append(top, details);

    if (t.status === "reviewing") {
      const actions = el("div", null, "topupActions");
      const label = el("label", "Təsdiqlənəcək məbləğ (₼)");
      const amount = el("input");
      amount.inputMode = "decimal";
      amount.value = (Number(t.requested_cents) / 100).toFixed(2);
      label.append(amount);
      actions.append(label, button("Təsdiqlə", () => decide(t, "approve", amount.value), "primary"),
        button("Rədd et", () => decide(t, "reject"), "danger"));
      card.append(actions);
    }
    return card;
  }

  async function load() {
    const data = await call("/shop?only=topups");
    if (stopped || !alive()) return;
    const heading = el("h2", "Balans artırma müraciətləri", "topupListTitle");
    list.replaceChildren(heading, ...(data.topups.length ? data.topups.map(renderCard) : [el("p", "Hələ müraciət yoxdur.")]));
  }
  busy = true;
  try { await load(); }
  catch (e) { error.textContent = e.message; }
  finally { busy = false; }
  return () => { stopped = true; };
}
