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
Object.assign(labels,{completed:'Tamamlandı',pending:'Gözləyir',failed:'Uğursuz',cancelled:'Ləğv edildi',refunded:'Geri qaytarılıb',partially_refunded:'Qismən geri qaytarılıb'});
const methodNames={'all':'Hamısı','apple-pay':'Apple Pay','google-pay':'Google Pay',birbank:'Birbank',m10:'m10','card-to-card':'Kartdan karta',card:'Epoint kart',unknown:'Üsul qeydə alınmayıb'};

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
  const text = el("span", null, "topupIdentityText");
  text.append(el("strong", name), " ", el("small", "· " + member));
  link.append(avatar, text);
  return link;
}

export async function mountShop({root, call, alive}) {
  if(!document.querySelector('link[data-topup-finance]')){const css=el('link');css.rel='stylesheet';css.href='/admin-topup-finance.css?v=1';css.dataset.topupFinance='';document.head.append(css);}
  let stopped = false, busy = false, rejectionDialog, receiptDialog, opened = false, loading = null, lastSnapshot = '';
  const params = new URLSearchParams(location.search);
  const target = params.get("topup");
  const intent = params.get("topupAction");
  const error = el("p", null, "topupError");
  error.setAttribute("role", "alert");
  const list = el("div", null, "topupList");
  const report = el('section',null,'topupFinanceReport');
  const filters=el('form',null,'topupFilters'),methods=el('div',null,'topupMethodFilters');
  let method='all',offset=0,run=0;
  for(const key of Object.keys(methodNames).filter(k=>!['card','unknown'].includes(k))){const b=el('button',methodNames[key],'btn');b.type='button';b.dataset.method=key;b.setAttribute('aria-pressed',String(key===method));b.onclick=()=>{method=key;offset=0;for(const x of methods.children)x.setAttribute('aria-pressed',String(x.dataset.method===key));void reload();};methods.append(b);}
  const period=el('select');period.setAttribute('aria-label','Dövr');for(const [key,name]of [['all','Bütün tarixlər'],['today','Bu gün'],['month','Bu ay'],['range','Tarix aralığı']])period.append(new Option(name,key));
  const from=el('input'),to=el('input');from.type=to.type='date';from.setAttribute('aria-label','Başlanğıc tarix');to.setAttribute('aria-label','Son tarix');from.hidden=to.hidden=true;
  period.onchange=()=>{from.hidden=to.hidden=period.value!=='range';if(period.value!=='range'){offset=0;void reload();}};
  const apply=el('button','Tətbiq et','btn');apply.type='submit';filters.append(methods,period,from,to,apply);filters.onsubmit=e=>{e.preventDefault();offset=0;void reload();};
  const pages=el('nav',null,'topupPaging');pages.setAttribute('aria-label','Mədaxil səhifələri');
  const header = el("header", null, "topupHeader");
  header.append(el("h1", "Balans müraciətləri"), button("Yenilə", load));
  root.replaceChildren(header, filters, error, report, list, pages);
  async function reload(){run++;lastSnapshot='';try{await load(false);}catch(e){error.textContent=e.message;}}
  function renderReport(data){const r=data.report;if(!r)return;report.replaceChildren(el('h2','Seçilmiş dövr üzrə mədaxillər'));
    const grid=el('div',null,'topupFinanceGrid');for(const [name,value]of [['Tamamlanmış mədaxil',r.completedCount],['Ümumi məbləğ',money(r.grossCents)],['Müştəri balansına mədaxil',money(r.creditedCents)],['Faktiki komissiya',r.actualCount?money(r.actualFeeCents)+` · ${r.actualCount} əməliyyat`:'Faktiki xərc qeydə alınmayıb'],['Tariflə hesablanan komissiya',money(r.estimatedFeeCents)+` · ${r.estimatedCount} əməliyyat`],['Komissiyası məlum olmayan',r.unknownFeeCount+' əməliyyat'],['Geri qaytarma',money(r.refundCents)+` · ${r.refundCount} əməliyyat`],['Komissiya geri ödənişi',money(r.feeRefundCents)],['Faktiki komissiyalı hissənin daxilolması',r.actualCount?money(r.actualNetCents):'Faktiki xərc qeydi yoxdur'],['Tariflə hesablanan hissənin daxilolması',money(r.estimatedNetCents)]]){const cell=el('div');cell.append(el('small',name),el('strong',String(value)));grid.append(cell);}report.append(grid,el('p',`Apple Pay: 3% · 23.11.2026-dan · mənbə: sahibin bildirdiyi tarif. Hesablanmış rəqəmlər bankın faktiki nəticəsi deyil. ${r.unknownFeeCount?'Naməlum komissiyalı hissə üçün xalis daxilolma hesablanmayıb.':''}`),el('p',data.refundNote));
  }

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
      const {url} = await call("/shop?" + new URLSearchParams({only:"receipt", id:t.id}));
      if (tab) tab.location.replace(url);
      else window.location.assign(url);
    } catch (e) { tab?.close(); throw e; }
  }

  async function showReceipt(t) {
    if (receiptDialog?.open) return;
    const {url,mime} = await call("/shop?" + new URLSearchParams({only:"receipt", id:t.id}));
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
    card.dataset.topupId = t.id;
    const top = el("div", null, "topupCardTop");
    const summary = el("div", null, "topupSummary");
    const status = el("span", labels[t.status] || "Naməlum status", "topupStatus");
    status.dataset.status = t.status;
    const requested = el("strong", "Müştərinin daxil etdiyi məbləğ: ");
    requested.append(el("span", money(t.gross_cents??t.requested_cents)));
    summary.append(requested, status);
    top.append(identity(t), summary);

    const details = el("div", null, "topupDetails");
    const bank=typeof t.card_bank==="string"?t.card_bank.trim():"";
    details.append(el('strong',methodNames[t.method]||'Kartdan karta','topupBank'));
    if(t.source!=='epoint')details.append(el("strong", bank&&/^\d{4}$/.test(t.card_last4)?`${bank} •••• ${t.card_last4}`:"Kart məlumatı qeydə alınmayıb", "topupBank"));
    details.append(el('span',t.source==='epoint'?'MirPanel əməliyyatı: mp_ep_'+t.id:'Müraciət № '+(t.history_number||t.id)));
    if(t.source==='epoint')details.append(el('span','Epoint transaction: '+(t.provider_transaction||'Hələ verilməyib')));
    details.append(time("Müraciət vaxtı (Bakı)", t.submitted_at||t.created_at));
    if(t.settled_at)details.append(time('Təsdiq vaxtı (Bakı)',t.settled_at));
    if(t.credited_cents>0){details.append(el('span','Müştəri balansına mədaxil: '+money(t.credited_cents)));details.append(el('span',t.fee_cents==null?'Komissiya: məlum deyil':`Komissiya (${t.fee_basis==='actual'?'faktiki':'tariflə hesablanmış'}): ${money(t.fee_cents)}`));if(t.actual_fee_cents!=null&&t.estimated_fee_cents!=null)details.append(el('span','Tarif müqayisəsi: '+money(t.estimated_fee_cents)));details.append(el('span','Komissiyadan sonrakı daxilolma: '+(t.net_cents==null?'hesablanmır':money(t.net_cents)+(t.fee_basis==='estimated'?' · hesablanmış':''))));if(t.tariff_source)details.append(el('small',t.tariff_source+' · qüvvəyə minmə: '+dateFormat.format(new Date(t.tariff_effective_at))));if(t.evidence)details.append(el('small','Faktiki maliyyə mənbəyi: '+t.evidence));if(t.refund_cents)details.append(el('span','Geri qaytarılıb: '+money(t.refund_cents)));}
    if (t.status === "approved" && t.decided_at) details.append(time("Təsdiqlənib", t.decided_at));
    if (t.status === "rejected") details.append(time("Rədd edilib", t.decided_at));
    card.append(top, details);

    const receiptRow = el("div", null, "topupReceiptRow");
    if (t.receipt_available) receiptRow.append(button("Çekə bax", () => receipt(t)));
    if (t.manual_status === "approved" && t.credited_cents != null) {
      receiptRow.append(el("strong", `Təsdiqlənən məbləğ: ${money(t.credited_cents)}`, "topupApproved"));
    }
    if (receiptRow.childElementCount) card.append(receiptRow);
    if(t.status==="rejected"){
      if(t.rejection_reason){
        const note=el("p","Səbəb — "+t.rejection_reason);
        note.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 0";
        card.append(note);
      }
    }

    if (t.source !== 'epoint' && t.status === "reviewing") {
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

  async function fetchList(openIntent) {
    const current=run;const query=new URLSearchParams({only:'topups',method,period:period.value,offset:String(offset)});if(target)query.set('id',target);if(period.value==='range'){query.set('from',from.value);query.set('to',to.value);}
    const data = await call('/shop?'+query);
    if (stopped || !alive() || current!==run) return;
    renderReport(data);
    pages.replaceChildren();if(offset>0)pages.append(button('Əvvəlki',()=>{offset=Math.max(0,offset-100);return reload();}));pages.append(el('span',`${data.total??data.topups.length} əməliyyat`));if(data.hasMore)pages.append(button('Sonrakı',()=>{offset+=100;return reload();}));
    const snapshot = JSON.stringify(data.topups);
    if (snapshot !== lastSnapshot) {
      const edits = new Map([...list.querySelectorAll('[data-topup-id]')].map(card => [card.dataset.topupId,card.querySelector('[data-topup-amount]')?.value]));
      const heading = el("h2", "Balans artırma müraciətləri", "topupListTitle");
      list.replaceChildren(heading, ...(data.topups.length ? data.topups.map(renderCard) : [el("p", target ? "Müraciət tapılmadı." : "Hələ müraciət yoxdur.")]));
      lastSnapshot = snapshot;
      for (const card of list.querySelectorAll('[data-topup-id]')) {
        const input = card.querySelector('[data-topup-amount]');
        if (input && edits.has(card.dataset.topupId) && edits.get(card.dataset.topupId) != null) input.value = edits.get(card.dataset.topupId);
      }
      if (target) {
        const all = el("a", "Bütün balans müraciətləri", "btn");
        all.href = "/admin.html#communityShop";
        list.prepend(all);
      }
    }
    const topup = target && data.topups.find(t => t.id === target);
    if (!topup || opened || !openIntent) return;
    if (intent === "receipt") {
      if (topup.receipt_available) await showReceipt(topup);
      else error.textContent = "Qəbz artıq mövcud deyil.";
    } else if (topup.status === "reviewing") {
      if (intent === "reject") reject(topup);
      if (intent === "approve") list.querySelector("[data-topup-amount]")?.focus();
    }
    opened = true;
  }
  function load(openIntent = true) {
    if(loading)return loading.then(()=>load(openIntent));
    return loading = fetchList(openIntent).finally(() => { loading = null; });
  }
  const poll = () => { if (!busy && !rejectionDialog?.open && !receiptDialog?.open && !list.contains(document.activeElement)) void load(false).then(() => { if (!busy && !(target && intent && !opened)) error.textContent = ""; }).catch(e => { if (!stopped) error.textContent = e.message; }); };
  window.addEventListener('admin-topup-poll', poll);
  busy = true;
  try { await load(); }
  catch (e) { error.textContent = e.message; }
  finally { busy = false; }
  return () => { stopped = true; window.removeEventListener('admin-topup-poll', poll); rejectionDialog?.close(); receiptDialog?.close(); };
}
