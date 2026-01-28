const STORAGE_KEY = "mirpanel_data_v1";
const ADMIN_PASS_KEY = "mirpanel_admin_pass_hash";
const ADMIN_SESSION_KEY = "mirpanel_admin_authed";

const bc = (() => {
  try { return new BroadcastChannel("mirpanel_sync"); } catch { return null; }
})();

function safeParse(raw){ try { return JSON.parse(raw); } catch { return null; } }

function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : null;
  if (!parsed || !Array.isArray(parsed.products)) {
    // Əsas sayt DEFAULT yazıbsa, onu saxlayacaq. Burda boşdan başlamırıq.
    return { phone: "994515243545", products: [] };
  }
  if (!parsed.phone) parsed.phone = "994515243545";
  if (!parsed.products) parsed.products = [];
  return parsed;
}

function saveData(data){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // əsas sayta siqnal
  if (bc) bc.postMessage("refresh");
}

async function sha256(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function ensureAuth(){
  // artıq sessiya var?
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") return true;

  // ilk dəfə şifrə qurulsun
  let savedHash = localStorage.getItem(ADMIN_PASS_KEY);
  if (!savedHash) {
    const p1 = prompt("İlk dəfədir. Admin şifrəsi təyin et:") || "";
    if (p1.length < 4) { alert("Şifrə ən az 4 simvol olsun."); return false; }
    const p2 = prompt("Şifrəni təkrar yaz:") || "";
    if (p1 !== p2) { alert("Şifrələr uyğun gəlmədi."); return false; }
    savedHash = await sha256(p1);
    localStorage.setItem(ADMIN_PASS_KEY, savedHash);
    alert("Şifrə quruldu ✅ İndi giriş edirsən.");
  }

  // login
  const pass = prompt("Admin şifrəsini yaz:") || "";
  const hash = await sha256(pass);
  if (hash !== localStorage.getItem(ADMIN_PASS_KEY)) {
    alert("Şifrə səhvdir ❌");
    return false;
  }

  sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
  return true;
}

// ===== UI =====
const el = (id) => document.getElementById(id);

let DATA = null;
let selectedId = null;

function renderPlansInputs(count, existingPlans){
  const area = el("plansArea");
  area.innerHTML = "";
  const plans = existingPlans && existingPlans.length ? existingPlans : [];
  for (let i=0; i<count; i++){
    const p = plans[i] || { label:"", price:"" };
    const wrap = document.createElement("div");
    wrap.className = "row";
    wrap.style.marginBottom = "10px";
    wrap.innerHTML = `
      <div class="field">
        <label>Plan ${i+1} adı (məs: 1 aylıq)</label>
        <input class="plabel" value="${p.label || ""}" placeholder="1 aylıq">
      </div>
      <div class="field">
        <label>Plan ${i+1} qiymət (məs: 5.99 AZN)</label>
        <input class="pprice" value="${p.price || ""}" placeholder="5.99 AZN">
      </div>
    `;
    area.appendChild(wrap);
  }
}

function renderList(){
  const list = el("list");
  list.innerHTML = "";

  (DATA.products || []).forEach(p=>{
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <b>${p.title || "(adsız məhsul)"}</b>
      <div class="mini">ID: ${p.id || "-"} • Cat: ${p.cat || "-"}</div>
      <div class="mini">Şəkil: ${p.img || "-"}</div>
      <div class="mini">Qiymət: ${p.cornerPrice || "-"}</div>
    `;
    item.addEventListener("click", ()=> loadToForm(p.id));
    list.appendChild(item);
  });
}

function clearForm(){
  selectedId = null;
  el("pid").value = "";
  el("pcat").value = "netflix";
  el("ptitle").value = "";
  el("pimg").value = "";
  el("pprice").value = "";
  el("pdesc").value = "";
  el("pinfo").value = "";
  el("pplanCount").value = 3;
  renderPlansInputs(3, []);
}

function loadToForm(id){
  const p = (DATA.products || []).find(x => x.id === id);
  if (!p) return;

  selectedId = id;
  el("pid").value = p.id || "";
  el("pcat").value = p.cat || "netflix";
  el("ptitle").value = p.title || "";
  el("pimg").value = p.img || "";
  el("pprice").value = p.cornerPrice || "";
  el("pdesc").value = p.desc || "";
  el("pinfo").value = p.info || "";
  const count = Math.max(1, (p.plans || []).length || 3);
  el("pplanCount").value = count;
  renderPlansInputs(count, p.plans || []);
}

function collectPlans(){
  const labels = Array.from(document.querySelectorAll(".plabel"));
  const prices = Array.from(document.querySelectorAll(".pprice"));
  const out = [];
  for (let i=0; i<labels.length; i++){
    const label = (labels[i].value || "").trim();
    const price = (prices[i].value || "").trim();
    if (label && price) out.push({ label, price });
  }
  return out;
}

function upsertProduct(){
  const id = (el("pid").value || "").trim();
  const cat = el("pcat").value;
  const title = (el("ptitle").value || "").trim();
  const img = (el("pimg").value || "").trim();
  const cornerPrice = (el("pprice").value || "").trim();
  const desc = (el("pdesc").value || "").trim();
  const info = (el("pinfo").value || "").trim();
  const plans = collectPlans();

  if (!id) return alert("ID boş ola bilməz.");
  if (!title) return alert("Başlıq boş ola bilməz.");
  if (!img) return alert("Şəkil yolu boş ola bilməz. (məs: assets/netflix.png)");
  if (plans.length === 0) return alert("Ən az 1 plan daxil et.");

  const obj = { id, cat, title, img, cornerPrice, desc, info, plans };

  const idx = (DATA.products || []).findIndex(x => x.id === id);
  if (idx >= 0) DATA.products[idx] = obj;
  else DATA.products.unshift(obj);

  saveData(DATA);
  renderList();
  alert("Yaddaşa yazıldı ✅ Əsas sayt avtomatik yenilənməlidir.");
}

function deleteSelected(){
  const id = (el("pid").value || "").trim();
  if (!id) return alert("Silmek üçün ID lazımdır.");
  if (!confirm("Bu məhsulu silim?")) return;

  DATA.products = (DATA.products || []).filter(x => x.id !== id);
  saveData(DATA);
  renderList();
  clearForm();
  alert("Silindi ✅");
}

function savePhone(){
  const phone = (el("phone").value || "").trim();
  if (!phone) return alert("Telefon boş ola bilməz.");
  DATA.phone = phone;
  saveData(DATA);
  alert("Telefon yaddaşa yazıldı ✅");
}

async function init(){
  const ok = await ensureAuth();
  if (!ok) {
    // giriş olmayıbsa əsas sayta qaytar
    location.replace("index.html");
    return;
  }

  DATA = loadData();

  el("phone").value = DATA.phone || "994515243545";

  renderList();
  clearForm();

  el("pplanCount").addEventListener("input", ()=>{
    const count = Math.max(1, parseInt(el("pplanCount").value || "1", 10));
    renderPlansInputs(count, collectPlans());
  });

  el("saveProduct").addEventListener("click", upsertProduct);
  el("deleteProduct").addEventListener("click", deleteSelected);
  el("clearForm").addEventListener("click", clearForm);

  el("savePhone").addEventListener("click", savePhone);

  el("goSite").addEventListener("click", ()=>{
    // admindən əsas sayta düzgün qayıtma
    location.href = "index.html";
  });

  el("logout").addEventListener("click", ()=>{
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    alert("Çıxış edildi.");
    location.replace("index.html");
  });

  // Əgər storage dəyişsə (başqa tabdan), admin də yenilənsin
  window.addEventListener("storage", (e)=>{
    if (e.key === STORAGE_KEY) {
      DATA = loadData();
      el("phone").value = DATA.phone || "";
      renderList();
    }
  });

  if (bc) {
    bc.onmessage = (ev)=>{
      if (ev && ev.data === "refresh") {
        DATA = loadData();
        el("phone").value = DATA.phone || "";
        renderList();
      }
    };
  }
}

init();