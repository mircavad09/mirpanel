import {renderPaymentConfirmation} from '/community-assets/payment-confirmation.js';
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const amountFormat = new Intl.NumberFormat("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormat = {format(value){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baku',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(value).map(p=>[p.type,p.value]));return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;}};
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
  {let css=document.querySelector('link[data-topup-finance]');if(!css){css=el('link');css.rel='stylesheet';css.dataset.topupFinance='';document.head.append(css);}const href='/admin-topup-finance.css?v=compact-operations-20261124';if(css.getAttribute('href')!==href)css.href=href;}
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
  for(const key of Object.keys(methodNames)){const b=el('button',methodNames[key],'btn');b.type='button';b.dataset.method=key;b.setAttribute('aria-pressed',String(key===method));b.onclick=()=>{method=key;offset=0;for(const x of methods.children)x.setAttribute('aria-pressed',String(x.dataset.method===key));void reload();};methods.append(b);}
  const period=el('select');period.setAttribute('aria-label','Dövr');for(const [key,name]of [['all','Bütün tarixlər'],['today','Bu gün'],['month','Bu ay'],['range','Tarix aralığı']])period.append(new Option(name,key));
  const from=el('input'),to=el('input');from.type=to.type='date';from.setAttribute('aria-label','Başlanğıc tarix');to.setAttribute('aria-label','Son tarix');from.hidden=to.hidden=true;
  period.onchange=()=>{from.hidden=to.hidden=period.value!=='range';if(period.value!=='range'){offset=0;void reload();}};
  const purpose=el('select');purpose.setAttribute('aria-label','Ödəniş məqsədi');for(const [key,name]of [['all','Bütün məqsədlər'],['topup','Balans artımı'],['purchase','Səbət alışı']])purpose.append(new Option(name,key));purpose.onchange=()=>{offset=0;void reload();};
  const apply=el('button','Tətbiq et','btn');apply.type='submit';filters.append(methods,purpose,period,from,to,apply);filters.onsubmit=e=>{e.preventDefault();offset=0;void reload();};
  const pages=el('nav',null,'topupPaging');pages.setAttribute('aria-label','Mədaxil səhifələri');
  const header = el("header", null, "topupHeader");
  header.append(el("h1", "Balans və elektron ödənişlər"), button("Yenilə", load));
  root.replaceChildren(header, filters, error, report, list, pages);
  async function reload(){run++;lastSnapshot='';try{await load(false);}catch(e){error.textContent=e.message;}}
  function renderReport(data){const r=data.report;if(!r)return;report.replaceChildren(el('h2','Seçilmiş dövr üzrə ödənişlər'));
    const specific=['apple-pay','google-pay','birbank'].includes(method),covered=r.calculatedCount>0,partial=r.uncalculatedCount>0;
    const grid=el('div',null,'topupFinanceGrid');
    for(const [name,value,note]of [
      ['Uğurlu ödəniş sayı',r.completedCount],['Ümumi ödəniş',money(r.grossCents)],['Balans artırmalarının məbləği',money(r.topupCents)],['Birbaşa məhsul ödənişləri',money(r.purchaseCents)],
      [specific?'Komissiya — 3%':'Hesablanmış komissiya',covered?money(r.calculatedFeeCents):'Hesablanmır',partial?'3%-li üsullar üzrə':'' ],
      ['Komissiyadan sonra qalan',covered?money(r.calculatedNetCents):'Hesablanmır',partial?'Tarifi olan hissə üzrə; bank geri ödənişi çıxılıb':'' ],['Banka geri ödəniş',money(r.refundCents)],['MirPanel balansına kompensasiya',money(r.walletCompensationCents)]
    ]){const cell=el('div');cell.append(el('small',name),el('strong',String(value)));if(note)cell.append(el('small',note));grid.append(cell);}
    const extra=el('details',null,'topupTechnical');extra.append(el('summary','Ətraflı'),el('p',data.refundNote));
    extra.append(el('p',`Faktiki komissiya: ${r.actualCount?money(r.actualFeeCents):'qeydə alınmayıb'} · Komissiya geri ödənişi: ${money(r.feeRefundCents)}`),el('p',`Tarifi olmayan ${r.uncalculatedCount} əməliyyatın komissiyası sıfır sayılmayıb; həmin hissə hesablanmış cəmlərə daxil deyil.`));if(r.unquantifiedReturnCount)report.append(el('p',`${r.unquantifiedReturnCount} ödəniş Epoint-də returned görünür; bankın qaytardığı dəqiq məbləğ ayrıca təsdiqlənməyib. Qalıq yekun hesablaşma deyil.`,'topupError'));
    report.append(grid,el('p','Komissiya göstərilən tarif üzrə, hər ödəniş üçün ayrıca qəpiyə yuvarlaqlaşdırılır.'+(partial?` ${r.uncalculatedCount} əməliyyatın tarifi yoxdur; həmin hissə komissiya və qalıq cəminə daxil deyil.`:'')),extra);if(r.conflictCount)report.append(el('p',`${r.conflictCount} əməliyyatda transaction əlaqəsi ziddiyyətlidir; yoxlanana qədər uğurlu cəmə daxil edilməyib.`,'topupError'));if(r.duplicateReferences)extra.append(el('p',`${r.duplicateReferences} təkrar transaction əlaqəsi ikinci dəfə hesablanmayıb.`));
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
    const {url,mime,document:confirmation} = await call("/shop?" + new URLSearchParams({only:"receipt", id:t.id}));
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
    if(confirmation){const preview=el('div');renderPaymentConfirmation(preview,confirmation);box.append(title,preview,close);dialog.append(box);document.body.append(dialog);receiptDialog=dialog;dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();return;}
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
    const layout=el('div',null,'topupCompactLayout'),left=el('div',null,'topupCompactLeft'),right=el('div',null,'topupCompactRight'),reference=el('div',null,'topupOperationReference'),methodGroup=el('div',null,'topupOperationMethod'),times=el('div',null,'topupOperationTimes'),fees=el('div',null,'topupOperationFees');
    const status=el('span',t.source==='epoint'&&t.status==='completed'?'Uğurlu':labels[t.status]||'Naməlum status','topupStatus');status.dataset.status=t.status;
    const purchase=t.purpose==='purchase',paid=t.payment_success===true||!purchase&&t.credited_cents>0;
    left.append(identity(t));reference.append(el('small',purchase?'Səbət alışı':'Balans artımı','topupPurpose'));
    if(purchase){reference.append(el('small','Əməliyyat №'+(t.display_number||'Hələ verilməyib'),'topupOperationNumber'));const order=el('a','Sifariş №'+t.order_code,'topupOperationNumber');order.href='/admin.html?'+new URLSearchParams({paymentOrder:t.order_code,orderId:t.order_id})+'#sifarisler';reference.append(order);}
    else reference.append(el('small','Əməliyyat №'+(t.display_number||'Hələ verilməyib'),'topupOperationNumber'));
    const bank=typeof t.card_bank==='string'?t.card_bank.trim():'';
    const method=methodNames[t.method]||'Kartdan karta';
    methodGroup.append(el('span',method+(t.source!=='epoint'&&bank&&/^\d{4}$/.test(t.card_last4)?` · ${bank} •••• ${t.card_last4}`:''),'topupMethodLine'));
    const created=time('Yaradılıb',t.created_at||t.submitted_at);created.className='topupCreated';times.append(created);
    if(paid&&t.settled_at){const completed=time('Ödəniş təsdiqlənib',t.settled_at);completed.className='topupCompleted';times.append(completed);}
    else times.append(el('span','Tamamlanıb: —','topupNotCompleted'));
    right.append(el('strong',money(t.gross_cents??t.requested_cents),'topupPaymentAmount'),status);
    const fee=t.estimated_fee_cents??t.actual_fee_cents,net=t.estimated_fee_cents!=null?t.calculated_net_cents:t.net_cents;
    if(paid){if(!purchase)fees.append(el('span','Balansa əlavə olunub: '+money(t.credited_cents)));if(fee!=null){fees.append(el('span','Tarif komissiyası: '+(t.basis_points!=null&&Number(t.basis_points)!==0?`${Number(t.basis_points)/100}% · `:'')+money(fee)));if(net!=null)fees.append(el('span','Komissiyadan sonra qalan: '+money(net)));}if(t.refund_cents)fees.append(el('span','Banka geri ödəniş: '+money(t.refund_cents)));if(t.wallet_compensation_cents)fees.append(el('span','MirPanel balansına kompensasiya: '+money(t.wallet_compensation_cents)));}
    const canReceipt=t.receipt_available||t.source==='epoint'&&t.credited_cents>0;
    if(!purchase){const check=button('Çek',()=>showReceipt(t),'topupCheck');check.disabled=!canReceipt;check.title=canReceipt?(t.source==='epoint'?'MirPanel ödəniş təsdiqi':'Yüklənmiş çek'):'Tamamlanmış ödəniş sənədi yoxdur';right.append(check);}
    layout.append(left,reference,methodGroup,times,right,fees);card.append(layout);
    const technical=el('details',null,'topupTechnical');technical.append(el('summary','Ətraflı'),el('small','Daxili ID: '+t.id));
    if(t.opening_issue)technical.append(el('small','Ödəniş yoxlaması: '+t.opening_issue));
    if(t.opening_issue?.startsWith('ARTIQ ÖDƏNİŞ'))left.append(el('strong','Artıq ödəniş · admin yoxlaması tələb olunur','topupError'));
    if(t.method==='m10'&&['missing_transaction','missing_redirect_url','provider_rejected','provider_rejected_redirect','invalid_redirect_url'].includes(t.opening_issue)){left.append(el('strong','m10 keçidi alınmayıb — ödəniş ekranı açılmayıb.'));if(t.provider_trace)technical.append(el('small','İzləmə: '+t.provider_trace));}
    if(t.source==='epoint')technical.append(el('small','Epoint əməliyyat №: '+(t.provider_transaction||'Hələ verilməyib')),el('small','Sorğu: mp_ep_'+t.id));
    if(t.basis_points==null&&t.actual_fee_cents==null)technical.append(el('small','Komissiya tarifi qeyd edilməyib'));
    if(t.settled_at&&!paid)technical.append(time('Qərar verilib',t.settled_at));
    if(purchase)technical.append(el('small','Sifarişin təhvil statusu: '+t.fulfillment_status));if(t.payment_conflict)left.append(el('strong','Transaction əlaqəsi yoxlanmalıdır.','topupError'));
    if(t.provider_observed_status==='returned'){left.append(el('strong','Epoint: returned — bank qaytarması üzrə tutuşdurma tələb olunur.'));technical.append(time('Provayderdə yoxlanıb',t.provider_observed_at));if(!t.refund_cents)technical.append(el('small','Qaytarılmış dəqiq məbləğ və komissiya qaytarılması təsdiqlənməyib; balans avtomatik dəyişdirilməyib.'));}
    if(t.tariff_source)technical.append(el('small',t.tariff_source));
    if(t.actual_fee_cents!=null)technical.append(el('small','Faktiki komissiya: '+money(t.actual_fee_cents)));
    if(t.evidence)technical.append(el('small','Mənbə: '+t.evidence));
    if(t.fee_refund_cents)technical.append(el('small','Komissiya geri ödənişi: '+money(t.fee_refund_cents)));card.append(technical);
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
    const current=run;const query=new URLSearchParams({only:'topups',method,purpose:purpose.value,period:period.value,offset:String(offset)});if(target)query.set('id',target);if(period.value==='range'){query.set('from',from.value);query.set('to',to.value);}
    const data = await call('/shop?'+query);
    if (stopped || !alive() || current!==run) return;
    renderReport(data);
    pages.replaceChildren();if(offset>0)pages.append(button('Əvvəlki',()=>{offset=Math.max(0,offset-100);return reload();}));pages.append(el('span',`${data.total??data.topups.length} əməliyyat`));if(data.hasMore)pages.append(button('Sonrakı',()=>{offset+=100;return reload();}));
    const snapshot = JSON.stringify(data.topups);
    if (snapshot !== lastSnapshot) {
      const edits = new Map([...list.querySelectorAll('[data-topup-id]')].map(card => [card.dataset.topupId,card.querySelector('[data-topup-amount]')?.value]));
      const heading = el("h2", "Ödəniş əməliyyatları", "topupListTitle");
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
