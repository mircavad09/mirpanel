// ===== PIN LOGIN =====
const ADMIN_PIN = "2580"; // ✅ PIN-ni burdan dəyiş
const SESSION_KEY = "mirpanel_admin_ok";

// ===== DATA =====
const STORAGE_KEY = "mirpanel_data_v1";

const DEFAULT_DATA = {
  phone: "994515243545",
  products: []
};

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return DEFAULT_DATA;
    const d = JSON.parse(raw);
    if(!d || !d.products) return DEFAULT_DATA;
    return d;
  }catch(e){
    return DEFAULT_DATA;
  }
}

let DATA = load();

// ===== PIN UI =====
const lock = document.getElementById("lock");
const adminApp = document.getElementById("adminApp");
const pinInput = document.getElementById("pin");
const pinBtn = document.getElementById("pinBtn");
const pinErr = document.getElementById("pinErr");

function unlock(){
  lock.style.display = "none";
  adminApp.style.display = "block";
}
function checkSession(){
  if(sessionStorage.getItem(SESSION_KEY) === "1") unlock();
}
checkSession();

pinBtn.addEventListener("click", ()=>{
  const val = (pinInput.value || "").trim();
  if(val === ADMIN_PIN){
    sessionStorage.setItem(SESSION_KEY, "1");
    unlock();
  } else {
    pinErr.textContent = "PIN yanlışdır ❌";
    pinInput.value = "";
    pinInput.focus();
  }
});
pinInput.addEventListener("keydown",(e)=>{
  if(e.key === "Enter") pinBtn.click();
});

// ===== ADMIN APP =====
const list = document.getElementById("list");
const phoneInput = document.getElementById("phone");
const saveBtn = document.getElementById("saveBtn");
const addBtn = document.getElementById("addBtn");
const resetBtn = document.getElementById("resetBtn");

phoneInput.value = DATA.phone || "";

function uid(){
  return "p_" + Math.random().toString(16).slice(2);
}
function escapeAttr(s){
  return (s||"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
function opt(current, val){
  const sel = current === val ? "selected" : "";
  return `<option value="${val}" ${sel}>${val}</option>`;
}
function findProduct(id){
  return DATA.products.find(x=>x.id===id);
}

function render(){
  list.innerHTML = "";

  DATA.products.forEach((p)=>{
    const el = document.createElement("div");
    el.className = "card";

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div><b>${escapeAttr(p.title || "Məhsul")}</b> <span class="small">(${escapeAttr(p.cat || "-")})</span></div>
        <button class="btn danger" data-del="${p.id}">Sil</button>
      </div>

      <div class="row3">
        <div>
          <label>Başlıq (title)</label>
          <input data-k="title" data-id="${p.id}" value="${escapeAttr(p.title)}">
        </div>
        <div>
          <label>Kategori (cat)</label>
          <select data-k="cat" data-id="${p.id}">
            ${opt(p.cat,"netflix")}
            ${opt(p.cat,"spotify")}
            ${opt(p.cat,"youtube")}
            ${opt(p.cat,"capcut")}
            ${opt(p.cat,"chatgpt")}
          </select>
        </div>
        <div>
          <label>Sağ üst qiymət (corner)</label>
          <input data-k="cornerPrice" data-id="${p.id}" value="${escapeAttr(p.cornerPrice)}" placeholder="5.99₼">
        </div>
      </div>

      <div class="row">
        <div>
          <label>Şəkil yolu (img)</label>
          <input data-k="img" data-id="${p.id}" value="${escapeAttr(p.img)}" placeholder="assets/netflix.png">
          <div class="small">assets qovluğundakı fayl adı.</div>
        </div>
        <div>
          <label>Qısa açıqlama (desc)</label>
          <input data-k="desc" data-id="${p.id}" value="${escapeAttr(p.desc)}">
        </div>
      </div>

      <div class="row">
        <div>
          <label>Məlumat (popup info)</label>
          <textarea data-k="info" data-id="${p.id}">${p.info || ""}</textarea>
          <div class="small">Enter yaz → popup-da sətir-sətir görünür.</div>
        </div>
        <div>
          <label>Planlar</label>
          <div id="plans_${p.id}"></div>
          <button class="iconBtn" data-addplan="${p.id}">+ Plan əlavə et</button>
        </div>
      </div>
    `;

    list.appendChild(el);

    const plansBox = document.getElementById(`plans_${p.id}`);
    plansBox.innerHTML = "";
    (p.plans || []).forEach((pl, i)=>{
      const row = document.createElement("div");
      row.className = "planRow";
      row.innerHTML = `
        <input data-planlabel="${p.id}" data-i="${i}" value="${escapeAttr(pl.label)}" placeholder="1 aylıq">
        <input data-planprice="${p.id}" data-i="${i}" value="${escapeAttr(pl.price)}" placeholder="5.99 AZN">
        <button class="iconBtn del" data-delplan="${p.id}" data-i="${i}">X</button>
      `;
      plansBox.appendChild(row);
    });
  });
}

document.addEventListener("input",(e)=>{
  const t = e.target;

  if(t.dataset && t.dataset.k && t.dataset.id){
    const p = findProduct(t.dataset.id);
    if(!p) return;
    p[t.dataset.k] = t.value;
  }

  if(t.dataset && t.dataset.planlabel){
    const p = findProduct(t.dataset.planlabel);
    const i = Number(t.dataset.i);
    if(p && p.plans && p.plans[i]) p.plans[i].label = t.value;
  }
  if(t.dataset && t.dataset.planprice){
    const p = findProduct(t.dataset.planprice);
    const i = Number(t.dataset.i);
    if(p && p.plans && p.plans[i]) p.plans[i].price = t.value;
  }
});

document.addEventListener("click",(e)=>{
  const t = e.target;

  if(t.dataset && t.dataset.del){
    DATA.products = DATA.products.filter(x=>x.id !== t.dataset.del);
    render();
  }

  if(t.dataset && t.dataset.addplan){
    const p = findProduct(t.dataset.addplan);
    if(!p) return;
    p.plans = p.plans || [];
    p.plans.push({label:"1 aylıq", price:"0 AZN"});
    render();
  }

  if(t.dataset && t.dataset.delplan){
    const p = findProduct(t.dataset.delplan);
    const i = Number(t.dataset.i);
    if(!p || !p.plans) return;
    p.plans.splice(i,1);
    render();
  }
});

addBtn.addEventListener("click", ()=>{
  DATA.products.push({
    id: uid(),
    cat: "netflix",
    title: "Yeni məhsul",
    img: "assets/logo.png",
    cornerPrice: "0₼",
    desc: "",
    info: "",
    plans: [{label:"1 aylıq", price:"0 AZN"}]
  });
  render();
});

saveBtn.addEventListener("click", ()=>{
  DATA.phone = (phoneInput.value || "").trim();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
  alert("Yadda saxlandı ✅");
});

resetBtn.addEventListener("click", ()=>{
  if(confirm("Reset edilsin? (admin datalar sıfırlanacaq)")){
    localStorage.removeItem(STORAGE_KEY);
    DATA = load();
    phoneInput.value = DATA.phone || "";
    render();
    alert("Reset olundu ✅");
  }
});

render();