/* ====== CONFIG ====== */
const LS_KEY = "mirpanel_data_v1";
const $ = (id) => document.getElementById(id);
const deepClone = (x)=> JSON.parse(JSON.stringify(x||{}));

function load(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch{ return null; }
}
function save(d){ localStorage.setItem(LS_KEY, JSON.stringify(d)); }

/* ====== INIT ====== */
let data = load();
if(!data){
  alert("LocalStorage boşdur. Əvvəl index.html aç (1 dəfə), sonra admin.html aç.");
  data = { brand:"Mirpanel", phone_wa:"https://wa.me/994515243545", categories:[{key:"all",label:"Hamısı"}], products:[] };
}
if(!data.phone_wa) data.phone_wa = "https://wa.me/994515243545";
if(!Array.isArray(data.categories)) data.categories = [{key:"all",label:"Hamısı"}];
if(!Array.isArray(data.products)) data.products = [];

let mode = "products"; // products | cats
let activeId = (data.products[0]?.id) || null;

/* ====== HELPERS ====== */
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}
function slugId(x){
  return String(x||"")
    .trim()
    .toLowerCase()
    .replaceAll("ə","e").replaceAll("ı","i").replaceAll("ö","o").replaceAll("ü","u").replaceAll("ş","s").replaceAll("ç","c").replaceAll("ğ","g")
    .replace(/[^a-z0-9_]+/g,"_")
    .replace(/_+/g,"_")
    .replace(/^_|_$/g,"");
}
function getProduct(id){ return data.products.find(p=>p.id===id) || null; }
function ensureActive(){
  if(activeId && getProduct(activeId)) return;
  activeId = data.products[0]?.id || null;
}
function setMode(m){
  mode = m;

  const left = $("leftCard");
  const add = $("btnAdd");
  const search = $("searchP");

  if(left) left.style.display = (mode==="products") ? "" : "none";
  if(add) add.style.display = (mode==="products") ? "" : "none";
  if(search) search.style.display = (mode==="products") ? "" : "none";

  render();
}
function toast(msg){ alert(msg); }

/* ====== LIST ====== */
function listProducts(filter=""){
  const box = $("plist");
  if(!box) return;

  box.innerHTML = "";
  const q = (filter||"").toLowerCase();

  data.products
    .slice()
    .sort((a,b)=> (a.order??9999) - (b.order??9999))
    .filter(p => !q || [p.id,p.title,p.variant,p.category,p.badge].join(" ").toLowerCase().includes(q))
    .forEach(p=>{
      const div = document.createElement("div");
      div.className = "pitem" + (p.id===activeId ? " active":"");
      div.innerHTML = `
        <div class="pname">${escapeHtml(p.title||p.id)} ${p.variant ? `<span class="small">(${escapeHtml(p.variant)})</span>`:""}</div>
        <div class="psub">${escapeHtml(p.category||"-")} • flow: ${escapeHtml(p.flow||"whatsapp")} ${p.soldOut ? "• STOCK OUT":""}</div>
      `;
      div.onclick = ()=>{ activeId = p.id; render(); };
      box.appendChild(div);
    });
}

/* ====== FORMS ====== */
function categoryOptionsHTML(selected){
  return (data.categories||[]).map(c =>
    `<option value="${escapeHtml(c.key)}" ${c.key===selected?"selected":""}>${escapeHtml(c.label)}</option>`
  ).join("");
}

function renderCategories(){
  const rf = $("rightForm");
  if(!rf) return;

  const rows = (data.categories||[]).map((c,idx)=>`
    <div class="row" style="margin-bottom:10px">
      <div>
        <label>Key</label>
        <input value="${escapeHtml(c.key)}" data-cat-key="${idx}" class="mono">
      </div>
      <div>
        <label>Label</label>
        <input value="${escapeHtml(c.label)}" data-cat-label="${idx}">
      </div>
    </div>
  `).join("");

  rf.innerHTML = `
    <h3 class="secTitle">Kateqoriyalar</h3>

    <div class="row">
      <div>
        <label>Brand adı</label>
        <input id="brand" value="${escapeHtml(data.brand||"Mirpanel")}">
      </div>
      <div>
        <label>WhatsApp link (PHONE_WA)</label>
        <input id="phone" class="mono" value="${escapeHtml(data.phone_wa||"https://wa.me/994515243545")}">
      </div>
    </div>

    <div class="hr"></div>

    ${rows}

    <div class="actions">
      <button class="btn primary" id="addCat" type="button">+ Kateqoriya</button>
      <button class="btn danger" id="rmCat" type="button">- Son kateqoriyanı sil</button>
    </div>

    <div class="hr"></div>
    <div class="small">Qeyd: <span class="mono">all</span> kateqoriyasını silmə.</div>
  `;

  rf.querySelectorAll("[data-cat-key]").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const i = Number(inp.getAttribute("data-cat-key"));
      data.categories[i].key = slugId(inp.value) || "cat";
      inp.value = data.categories[i].key;
    });
  });
  rf.querySelectorAll("[data-cat-label]").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const i = Number(inp.getAttribute("data-cat-label"));
      data.categories[i].label = inp.value;
    });
  });

  $("brand")?.addEventListener("input", e=> data.brand = e.target.value);
  $("phone")?.addEventListener("input", e=> data.phone_wa = e.target.value);

  $("addCat").onclick = ()=>{
    data.categories.push({ key:"yeni", label:"Yeni" });
    render();
  };
  $("rmCat").onclick = ()=>{
    if(data.categories.length<=1) return toast("Ən az 1 kateqoriya qalmalıdır.");
    const last = data.categories[data.categories.length-1];
    if(last.key==="all") return toast("all silinmir.");
    data.categories.pop();
    data.products.forEach(p=>{ if(p.category===last.key) p.category="all"; });
    render();
  };
}

function renderProduct(){
  ensureActive();
  const rf = $("rightForm");
  if(!rf) return;

  const p = getProduct(activeId);

  if(!p){
    rf.innerHTML = `<div class="small">Məhsul yoxdur. Solda <b>Yeni</b> bas.</div>`;
    return;
  }

  if(!Array.isArray(p.plans)) p.plans = [];
  if(!p.currency) p.currency = "₼";
  if(!p.flow) p.flow = "whatsapp";

  const plansHTML = p.plans.map((pl,idx)=>`
    <div class="planRow" style="margin-bottom:8px">
      <input placeholder="Label (1 aylıq)" value="${escapeHtml(pl.label||"")}" data-pl-label="${idx}">
      <input placeholder="Months (1)" class="mono" value="${escapeHtml(pl.months??"")}" data-pl-months="${idx}">
      <input placeholder="Price (3.99)" class="mono" value="${escapeHtml(pl.price??"")}" data-pl-price="${idx}">
      <button class="xbtn" title="Sil" data-pl-del="${idx}" type="button">✕</button>
    </div>
  `).join("");

  rf.innerHTML = `
    <h3 class="secTitle">Məhsul</h3>

    <div class="row">
      <div>
        <label>ID</label>
        <input id="p_id" class="mono" value="${escapeHtml(p.id||"")}">
        <div class="small">ID boşluq olmadan: məsələn <span class="mono">netflix_umumi</span></div>
      </div>
      <div>
        <label>Order (sıralama)</label>
        <input id="p_order" class="mono" value="${escapeHtml(p.order??"")}">
      </div>
    </div>

    <div class="row" style="margin-top:10px">
      <div>
        <label>Kateqoriya</label>
        <select id="p_cat">${categoryOptionsHTML(p.category||"all")}</select>
      </div>
      <div>
        <label>Flow (klik davranışı)</label>
        <select id="p_flow">
          <option value="whatsapp" ${p.flow==="whatsapp"?"selected":""}>Birbaşa WhatsApp</option>
          <option value="name_code_4" ${p.flow==="name_code_4"?"selected":""}>Ad + 4 rəqəm kod</option>
          <option value="name_code_5" ${p.flow==="name_code_5"?"selected":""}>Ad + 5 rəqəm kod</option>
          <option value="email" ${p.flow==="email"?"selected":""}>Gmail form</option>
          <option value="spotify" ${p.flow==="spotify"?"selected":""}>Spotify (Gmail + şifrə)</option>
          <option value="out_of_stock" ${p.flow==="out_of_stock"?"selected":""}>Stokta yoxdur</option>
        </select>
      </div>
    </div>

    <div class="row" style="margin-top:10px">
      <div>
        <label>Title</label>
        <input id="p_title" value="${escapeHtml(p.title||"")}">
      </div>
      <div>
        <label>Variant</label>
        <input id="p_variant" value="${escapeHtml(p.variant||"")}">
      </div>
    </div>

    <div class="row" style="margin-top:10px">
      <div>
        <label>Image path</label>
        <input id="p_image" class="mono" value="${escapeHtml(p.image||"")}">
      </div>
      <div>
        <label>Badge</label>
        <input id="p_badge" value="${escapeHtml(p.badge||"")}">
      </div>
    </div>

    <div class="row" style="margin-top:10px">
      <div>
        <label>Currency</label>
        <input id="p_currency" class="mono" value="${escapeHtml(p.currency||"₼")}">
      </div>
      <div style="display:flex;align-items:flex-end;gap:10px">
        <div class="tag">
          <input type="checkbox" id="p_soldout" ${p.soldOut ? "checked":""} style="width:auto">
          <span>Sold out (etiket)</span>
        </div>
      </div>
    </div>

    <div class="row" style="margin-top:10px">
      <div>
        <label>Desc (qısa)</label>
        <textarea id="p_desc">${escapeHtml(p.desc||"")}</textarea>
      </div>
      <div>
        <label>Haqqında / Note (modalda görünür)</label>
        <textarea id="p_note">${escapeHtml(p.note||"")}</textarea>
      </div>
    </div>

    <div class="hr"></div>

    <h3 class="secTitle">Planlar</h3>
    ${plansHTML || `<div class="small">Plan yoxdur. Aşağıdan əlavə et.</div>`}

    <div class="actions">
      <button class="btn primary" id="addPlan" type="button">+ Plan</button>
      <button class="btn" id="sortPlans" type="button">Planları months görə sırala</button>
    </div>

    <div class="hr"></div>

    <div class="actions">
      <button class="btn primary" id="saveP" type="button">Məhsulu yadda saxla</button>
      <button class="btn danger" id="delP" type="button">Məhsulu sil</button>
    </div>
  `;

  // bind fields
  $("p_id").addEventListener("input", e=>{
    const newId = slugId(e.target.value);
    e.target.value = newId;
    p.id = newId;
  });
  $("p_order").addEventListener("input", e=> p.order = e.target.value === "" ? null : Number(e.target.value));
  $("p_cat").addEventListener("change", e=> p.category = e.target.value);
  $("p_flow").addEventListener("change", e=> p.flow = e.target.value);

  $("p_title").addEventListener("input", e=> p.title = e.target.value);
  $("p_variant").addEventListener("input", e=> p.variant = e.target.value);
  $("p_image").addEventListener("input", e=> p.image = e.target.value);
  $("p_badge").addEventListener("input", e=> p.badge = e.target.value);
  $("p_currency").addEventListener("input", e=> p.currency = e.target.value);
  $("p_soldout").addEventListener("change", e=> p.soldOut = !!e.target.checked);
  $("p_desc").addEventListener("input", e=> p.desc = e.target.value);
  $("p_note").addEventListener("input", e=> p.note = e.target.value);

  // plans bind
  rf.querySelectorAll("[data-pl-label]").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const i = Number(inp.getAttribute("data-pl-label"));
      p.plans[i].label = inp.value;
    });
  });
  rf.querySelectorAll("[data-pl-months]").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const i = Number(inp.getAttribute("data-pl-months"));
      const v = inp.value.trim();
      p.plans[i].months = v==="" ? null : Number(v);
    });
  });
  rf.querySelectorAll("[data-pl-price]").forEach(inp=>{
    inp.addEventListener("input", ()=>{
      const i = Number(inp.getAttribute("data-pl-price"));
      const v = inp.value.trim();
      p.plans[i].price = v==="" ? null : Number(v);
    });
  });
  rf.querySelectorAll("[data-pl-del]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const i = Number(btn.getAttribute("data-pl-del"));
      p.plans.splice(i,1);
      render();
    });
  });

  $("addPlan").onclick = ()=>{
    p.plans.push({ months: 1, label: "1 aylıq", price: 0 });
    render();
  };
  $("sortPlans").onclick = ()=>{
    p.plans.sort((a,b)=> (Number(a.months)||999) - (Number(b.months)||999));
    render();
  };

  $("saveP").onclick = ()=>{
    // ID collision fix
    const others = data.products.filter(x=>x!==p);
    if(!p.id) return toast("ID boş ola bilməz.");
    if(others.some(x=>x.id===p.id)) return toast("Bu ID artıq var. Başqa ID yaz.");
    // order default
    if(p.order==null || !Number.isFinite(p.order)) p.order = data.products.length;
    toast("Məhsul yadda saxlandı (LocalStorage).");
    render();
  };

  $("delP").onclick = ()=>{
    if(!confirm("Silmək istəyirsən?")) return;
    data.products = data.products.filter(x=>x.id!==p.id);
    activeId = data.products[0]?.id || null;
    render();
  };
}

function render(){
  if(mode==="products"){
    listProducts($("searchP")?.value || "");
    renderProduct();
  }else{
    renderCategories();
  }
}

/* ====== ACTIONS ====== */
$("btnCats").onclick = ()=> setMode("cats");
$("btnProducts").onclick = ()=> setMode("products");

$("btnAdd").onclick = ()=>{
  const nid = "new_product_" + Math.floor(Math.random()*9999);
  const p = {
    id: nid,
    order: data.products.length,
    category: "all",
    flow: "whatsapp",
    title: "Yeni Məhsul",
    variant: "",
    image: "assets/your.png",
    badge: "Premium",
    desc: "",
    note: "",
    currency: "₼",
    soldOut: false,
    plans: [{ months: 1, label:"1 aylıq", price: 0 }]
  };
  data.products.push(p);
  activeId = nid;
  render();
};

$("searchP").addEventListener("input", ()=> render());

$("btnSaveAll").onclick = ()=>{
  // brand/phone save from cats screen too
  const brandEl = $("brand");
  const phoneEl = $("phone");
  if(brandEl) data.brand = brandEl.value;
  if(phoneEl) data.phone_wa = phoneEl.value;

  save(data);
  toast("Hamısı LocalStorage-a yazıldı ✅");
};

$("btnExportJson").onclick = ()=>{
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mirpanel_data.json";
  a.click();
  URL.revokeObjectURL(url);
};

$("btnExportData").onclick = ()=>{
  const out = deepClone(data);

  const snippet =
`// === Mirpanel export ===
const PHONE_WA = "${(out.phone_wa||"https://wa.me/994515243545").replaceAll('"','\\"')}";
const DATA = ${JSON.stringify({
  brand: out.brand || "Mirpanel",
  categories: out.categories || [{key:"all",label:"Hamısı"}],
  products: (out.products||[]).slice().sort((a,b)=> (a.order??9999)-(b.order??9999))
}, null, 2)};
`;

  const w = window.open("", "_blank");
  w.document.write("<pre style='white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,monospace;padding:14px;background:#070707;color:#fff'>"
    + escapeHtml(snippet) + "</pre>");
};

/* ====== START ====== */
setMode("products");
render();