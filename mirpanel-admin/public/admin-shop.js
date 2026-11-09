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
  let stopped = false, busy = false, rejectionDialog, receiptDialog, opened = false;
  const params = new URLSearchParams(location.search);
  const target = params.get("topup");
  const intent = params.get("topupAction");
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

  async function showReceipt(t) {
    if (receiptDialog?.open) return;
    const {url,mime} = await call("/shop", {action:"receipt", id:t.id});
    if (stopped || !alive()) return;
    const dialog = el("dialog", null, "paymentActionDialog");
    const box = el("div", null, "paymentActionDialogCard");
    const close = el("button", "Bağla", "btn");
    close.type = "button";
    close.onclick = () => dialog.close();
    const original = el("a", "Qəbzi tam ölçüdə aç", "btn");
    original.href = url;
    original.target = "_blank";
    original.rel = "noopener noreferrer";
    const title = el("h3", "Qəbz");
    title.id = "topupReceiptTitle";
    dialog.setAttribute("aria-labelledby", title.id);
    const preview = el(mime === "application/pdf" ? "iframe" : "img");
    preview.style.cssText = "display:block;width:100%;max-height:65dvh;object-fit:contain;margin:8px 0";
    if (preview.tagName === "IFRAME") {
      preview.title = "Qəbz";
      preview.style.height = "65dvh";
    } else preview.alt = "Ödəniş qəbzi";
    preview.referrerPolicy = "no-referrer";
    preview.src = url;
    box.append(title, preview, original, close);
    dialog.append(box);
    document.body.append(dialog);
    receiptDialog = dialog;
    dialog.addEventListener("close", () => dialog.remove(), {once:true});
    dialog.showModal();
  }

  async function decide(t, action, value) {
    if (action === "approve") {
      value = value.trim().replace(",", ".");
      if (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) <= 0) throw Error("Düzgün müsbət AZN məbləği yazın.");
      if (!confirm(`${t.name} hesabına ${displayAmount(value)} ₼ əlavə edilsin?`)) return;
    }
    await call("/shop", {action, id:t.id, ...(action === "approve" ? {amount:value} : {reason:value})});
    window.dispatchEvent(new Event("admin-topup-changed"));
    try { await load(); }
    catch { error.textContent = "Qərar saxlanıldı, amma siyahı yenilənmədi. Yenilə düyməsinə basın."; }
  }

  function reject(t) {
    if(rejectionDialog?.open)return;
    const dialog=el("dialog",null,"paymentActionDialog"),form=el("form",null,"paymentActionDialogCard");
    const title=el("h3","Bu balans müraciəti rədd edilsin?");
    title.id="topupRejectTitle";
    dialog.setAttribute("aria-labelledby",title.id);
    const summary=el("p",(t.history_number?"Müraciət № "+t.history_number+" · ":"")+money(t.requested_cents));
    const label=el("label","Ləğv səbəbi");
    const reason=el("textarea");reason.rows=4;reason.required=true;reason.maxLength=1000;reason.style.width="100%";label.append(reason);
    const hint=el("p","Səbəb müştəriyə e-poçtla göndəriləcək.");
    const feedback=el("p",null,"topupError");feedback.setAttribute("role","alert");
    const cancel=el("button","Geri","btn");cancel.type="button";
    const submit=el("button","Rəddi təsdiqlə","btn danger");submit.type="submit";submit.disabled=true;
    const actions=el("div",null,"paymentOrderActions");actions.append(cancel,submit);
    form.append(title,summary,label,hint,feedback,actions);dialog.append(form);document.body.append(dialog);
    rejectionDialog=dialog;
    let pending=false;
    cancel.onclick=()=>dialog.close();
    reason.oninput=()=>{submit.disabled=!reason.value.trim();feedback.textContent="";};
    dialog.addEventListener("cancel",e=>{if(pending)e.preventDefault();});
    dialog.addEventListener("close",()=>{dialog.remove();if(rejectionDialog===dialog)rejectionDialog=null;},{once:true});
    form.onsubmit=async event=>{
      event.preventDefault();
      if(busy||pending||!reason.value.trim())return;
      busy=pending=true;cancel.disabled=reason.disabled=submit.disabled=true;
      try { await decide(t,"reject",reason.value.trim());dialog.close(); }
      catch(e) { feedback.textContent=e.message||"Müraciət rədd edilmədi. Yenidən cəhd edin."; }
      finally { busy=pending=false;cancel.disabled=reason.disabled=false;submit.disabled=!reason.value.trim(); }
    };
    dialog.showModal();reason.focus();
  }

  function renderCard(t) {
    const card = el("article", null, "topupCard");
    const top = el("div", null, "topupCardTop");
    const summary = el("div", null, "topupSummary");
    const status = el("span", labels[t.status] || "Naməlum status", "topupStatus");
    status.dataset.status = t.status;
    summary.append(el("strong", `Müştərinin daxil etdiyi məbləğ: ${money(t.requested_cents)}`), status);
    top.append(identity(t), summary);

    const details = el("div", null, "topupDetails");
    const bank=typeof t.card_bank==="string"?t.card_bank.trim():"";
    details.append(el("span", bank&&/^\d{4}$/.test(t.card_last4)?`${bank} •••• ${t.card_last4}`:"Kart məlumatı qeydə alınmayıb"));
    details.append(time("Göndərilib", t.submitted_at));
    if (t.status === "approved") {
      if (t.approved_cents != null) details.append(el("strong", `Təsdiqlənən məbləğ: ${money(t.approved_cents)}`, "topupApproved"));
      details.append(time("Təsdiqlənib", t.decided_at));
    }
    if (t.receipt_available) details.append(button("Çekə bax", () => receipt(t)));
    card.append(top, details);
    if(t.status==="rejected"){
      details.append(time("Rədd edilib",t.decided_at));
      if(t.rejection_reason){
        const note=el("p","Səbəb — "+t.rejection_reason);
        note.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 0";
        card.append(note);
      }
    }

    if (t.status === "reviewing") {
      const actions = el("div", null, "topupActions");
      const label = el("label", "Təsdiqlənəcək məbləğ (₼)");
      const amount = el("input");
      amount.inputMode = "decimal";
      amount.value = (Number(t.requested_cents) / 100).toFixed(2);
      label.append(amount);
      amount.dataset.topupAmount = "";
      actions.append(label, button("Təsdiqlə", () => decide(t, "approve", amount.value), "primary"),
        button("Rədd et", () => reject(t), "danger"));
      card.append(actions);
    }
    return card;
  }

  async function load() {
    const data = await call("/shop?only=topups" + (target ? "&id=" + encodeURIComponent(target) : ""));
    if (stopped || !alive()) return;
    const heading = el("h2", "Balans artırma müraciətləri", "topupListTitle");
    list.replaceChildren(heading, ...(data.topups.length ? data.topups.map(renderCard) : [el("p", target ? "Müraciət tapılmadı." : "Hələ müraciət yoxdur.")]));
    if (target) {
      const all = el("a", "Bütün balans müraciətləri", "btn");
      all.href = "/admin.html#communityShop";
      list.prepend(all);
    }
    const topup = target && data.topups.find(t => t.id === target);
    if (!topup || opened) return;
    opened = true;
    if (intent === "receipt") {
      if (topup.receipt_available) await showReceipt(topup);
      else error.textContent = "Qəbz artıq mövcud deyil.";
    } else if (topup.status === "reviewing") {
      if (intent === "reject") reject(topup);
      if (intent === "approve") list.querySelector("[data-topup-amount]")?.focus();
    }
  }
  busy = true;
  try { await load(); }
  catch (e) { error.textContent = e.message; }
  finally { busy = false; }
  return () => { stopped = true; rejectionDialog?.close(); receiptDialog?.close(); };
}
