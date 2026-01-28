<!doctype html>
<html lang="az">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Mirpanel — Admin</title>
  <style>
    :root{
      --bg:#070707;--txt:#fff;--mut:rgba(255,255,255,.65);
      --bd:rgba(255,255,255,.10);--p:rgba(255,255,255,.04);
      --acc:#facc15;--acc2:#2563eb;--r:16px;--sh:0 18px 60px rgba(0,0,0,.55);
    }
    *{box-sizing:border-box}
    body{
      margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
      background:
        radial-gradient(900px 480px at 12% -10%, rgba(250,204,21,.16), transparent 60%),
        radial-gradient(900px 520px at 92% 0%, rgba(37,99,235,.11), transparent 60%),
        var(--bg);
      color:var(--txt);
    }
    .wrap{max-width:1180px;margin:0 auto;padding:14px}
    .top{
      display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;
      padding:12px;border:1px solid var(--bd);border-radius:18px;
      background:linear-gradient(180deg,var(--p),rgba(255,255,255,.02));
      box-shadow:var(--sh);
    }
    .brand{display:flex;align-items:center;gap:10px}
    .logoPrev{
      width:44px;height:44px;border-radius:16px;object-fit:cover;
      border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);
      box-shadow:0 0 30px rgba(250,204,21,.10);
    }
    h1{margin:0;font-size:16px}
    .mut{color:var(--mut);font-size:12px;line-height:1.35}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
    @media(max-width:900px){.row{grid-template-columns:1fr}}
    .box{
      border:1px solid var(--bd);border-radius:18px;
      background:linear-gradient(180deg,var(--p),rgba(255,255,255,.02));
      padding:12px;
      box-shadow:var(--sh);
    }
    .box h2{margin:0 0 8px 0;font-size:14px}
    label{display:block;font-size:12px;color:var(--mut);margin:8px 0 6px}
    input,textarea,select{
      width:100%;
      padding:10px 12px;border-radius:14px;
      border:1px solid var(--bd);
      background:rgba(255,255,255,.03);
      color:var(--txt);
      outline:none;
    }
    textarea{min-height:84px;resize:vertical}
    .btns{display:flex;gap:10px;flex-wrap:wrap}
    button{
      cursor:pointer;
      padding:10px 12px;border-radius:14px;
      border:1px solid var(--bd);
      background:rgba(255,255,255,.04);
      color:var(--txt);
      font-weight:900;
    }
    .primary{
      border-color:rgba(250,204,21,.35);
      background:linear-gradient(135deg, rgba(250,204,21,.95), rgba(250,204,21,.72));
      color:#000;
    }
    .ghost{
      border-color:rgba(255,255,255,.16);
      background:rgba(255,255,255,.04);
      color:#fff;
    }
    .danger{
      border-color:rgba(255,80,80,.35);
      background:rgba(255,80,80,.12);
      color:#fff;
    }
    .mini{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .hr{height:1px;background:rgba(255,255,255,.08);margin:12px 0}
    .small{font-size:12px;color:var(--mut);line-height:1.45}

    .list{display:flex;flex-direction:column;gap:10px;margin-top:10px}
    .item{
      border:1px solid var(--bd);
      border-radius:16px;
      background:rgba(255,255,255,.03);
      padding:10px;
      display:grid;
      grid-template-columns: 1fr 220px;
      gap:10px;
      align-items:start;
    }
    @media(max-width:900px){.item{grid-template-columns:1fr}}
    .thumb{
      width:70px;height:48px;object-fit:cover;border-radius:12px;
      border:1px solid var(--bd);background:#111;
    }
    .k{font-size:12px;color:var(--mut)}
    .split{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    @media(max-width:900px){.split{grid-template-columns:1fr}}

    /* PIN gate */
    .pin{
      position:fixed;inset:0;background:rgba(0,0,0,.72);
      display:flex;align-items:center;justify-content:center;padding:14px;
      z-index:9999;
    }
    .pinCard{
      width:min(520px,100%);
      border:1px solid var(--bd);border-radius:20px;
      background:linear-gradient(180deg,var(--p),rgba(255,255,255,.02));
      padding:14px;
      box-shadow:var(--sh);
    }
  </style>
</head>

<body>

<!-- PIN GATE -->
<div class="pin" id="pinGate">
  <div class="pinCard">
    <h1>Mirpanel Admin giriş</h1>
    <div class="mut" style="margin-top:6px">
      4 rəqəmli PIN. İlk dəfə daxil olanda öz PIN-ini təyin edirsən.
      PIN yalnız sənin brauzerdə saxlanır.
    </div>

    <label>PIN</label>
    <input id="pin" inputmode="numeric" maxlength="4" placeholder="****" />

    <div class="btns" style="margin-top:10px">
      <button class="primary" id="pinEnter">Daxil ol</button>
      <button class="danger" id="pinReset">PIN sıfırla</button>
    </div>
  </div>
</div>

<!-- APP -->
<div class="wrap" style="display:none" id="app">
  <div class="top">
    <div class="brand">
      <img id="topLogo" class="logoPrev" alt="logo" src="assets/logo.png" />
      <div>
        <h1>Mirpanel — Admin Panel</h1>
        <div class="mut">Paket əlavə et → Yaddaşa yaz → Əsas sayt avtomatik yenilənir ✅</div>
      </div>
    </div>

    <div class="btns">
      <button class="ghost" id="goSite">Əsas sayta keç</button>
      <button class="ghost" id="loadFromSite">Saytdan oxu</button>
      <button class="primary" id="saveDraft">Yadda saxla</button>
      <button class="danger" id="logout">Çıxış</button>
    </div>
  </div>

  <!-- GENERAL -->
  <div class="row">
    <div class="box">
      <h2>Ümumi</h2>
      <label>WhatsApp nömrə (994...)</label>
      <input id="phone" placeholder="994515243545" />
      <div class="small">Sifariş linki bu nömrəyə gedəcək.</div>
    </div>

    <div class="box">
      <h2>Admin info</h2>
      <div class="small">
        Gizli giriş: <b>/admin.html</b> və ya <b>/?panel=1</b><br>
        Qeyd: Admin dəyişiklikləri localStorage-da saxlanır.
      </div>
    </div>
  </div>

  <!-- SERVICE FORM -->
  <div class="box" style="margin-top:12px">
    <h2>Paket əlavə et / düzəlt</h2>

    <div class="split">
      <div>
        <label>ID (unikal)</label>
        <input id="pid" placeholder="netflix_premium_1" />
      </div>
      <div>
        <label>Kateqoriya</label>
        <select id="pcat">
          <option value="netflix">Netflix</option>
          <option value="spotify">Spotify</option>
          <option value="youtube">YouTube</option>
          <option value="capcut">CapCut</option>
          <option value="chatgpt">ChatGPT</option>
        </select>
      </div>
    </div>

    <label>Başlıq</label>
    <input id="ptitle" placeholder="Netflix Premium (Şəxsi otaq)" />

    <div class="split">
      <div>
        <label>Şəkil yolu (assets/netflix.png)</label>
        <input id="pimg" placeholder="assets/netflix.png" />
      </div>
      <div>
        <label>Künc qiymət (məs: 5.99₼)</label>
        <input id="pprice" placeholder="5.99₼" />
      </div>
    </div>

    <label>Qısa təsvir (kart üçün)</label>
    <input id="pdesc" placeholder="HD/4K • Aktivləşmə 5–30 dəq" />

    <label>Məlumat (modal üçün)</label>
    <textarea id="pinfo" placeholder="• ..."></textarea>

    <div class="hr"></div>

    <h2>Planlar</h2>
    <div class="split">
      <div>
        <label>Plan 1 adı</label>
        <input id="pl1" placeholder="1 aylıq" />
      </div>
      <div>
        <label>Plan 1 qiymət</label>
        <input id="pp1" placeholder="5.99 AZN" />
      </div>
    </div>

    <div class="split">
      <div>
        <label>Plan 2 adı</label>
        <input id="pl2" placeholder="3 aylıq" />
      </div>
      <div>
        <label>Plan 2 qiymət</label>
        <input id="pp2" placeholder="16.99 AZN" />
      </div>
    </div>

    <div class="split">
      <div>
        <label>Plan 3 adı</label>
        <input id="pl3" placeholder="6 aylıq" />
      </div>
      <div>
        <label>Plan 3 qiymət</label>
        <input id="pp3" placeholder="31.99 AZN" />
      </div>
    </div>

    <div class="btns" style="margin-top:10px">
      <button class="primary" id="saveProduct">Yaddaşa yaz</button>
      <button class="ghost" id="clearForm">Formu təmizlə</button>
      <button class="danger" id="deleteProduct">Sil</button>
    </div>

    <div class="small" style="margin-top:10px">
      ✅ Yaddaşa yazanda əsas sayta <b>siqnal gedir</b> və avtomatik yenilənir.
    </div>
  </div>

  <!-- LIST -->
  <div class="box" style="margin-top:12px">
    <h2>Mövcud paketlər (kliklə edit)</h2>
    <div class="list" id="list"></div>
  </div>
</div>

<script>
  const STORAGE_KEY = "mirpanel_data_v1";
  const PIN_KEY = "mirpanel_admin_pin_v1";
  const SESSION_KEY = "mirpanel_admin_authed_v1";

  const bc = (() => {
    try { return new BroadcastChannel("mirpanel_sync"); } catch { return null; }
  })();

  const $ = (id)=> document.getElementById(id);

  let DATA = null;

  function safeParse(raw){ try{ return JSON.parse(raw); }catch(e){ return null; } }

  function esc(s){
    return String(s ?? "").replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  }

  function loadData(){
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if(!parsed || !Array.isArray(parsed.products)){
      return { phone:"994515243545", products: [] };
    }
    if(!parsed.phone) parsed.phone = "994515243545";
    if(!parsed.products) parsed.products = [];
    return parsed;
  }

  function saveData(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
    if(bc) bc.postMessage("refresh");
  }

  function gate(){
    if(sessionStorage.getItem(SESSION_KEY)==="1"){
      openApp(); return;
    }

    $("pinEnter").onclick = ()=>{
      const v = ($("pin").value || "").trim();
      if(v.length !== 4) return alert("4 rəqəm yaz.");

      const saved = localStorage.getItem(PIN_KEY);
      if(!saved){
        localStorage.setItem(PIN_KEY, v);
        sessionStorage.setItem(SESSION_KEY,"1");
        alert("PIN quruldu ✅");
        openApp();
        return;
      }
      if(saved !== v) return alert("PIN yanlışdır ❌");
      sessionStorage.setItem(SESSION_KEY,"1");
      openApp();
    };

    $("pinReset").onclick = ()=>{
      localStorage.removeItem(PIN_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      alert("PIN sıfırlandı. İndi yenidən 4 rəqəm təyin edəcəksən.");
      location.reload();
    };
  }

  function openApp(){
    $("pinGate").style.display="none";
    $("app").style.display="block";
    boot();
  }

  function boot(){
    DATA = loadData();
    $("phone").value = DATA.phone || "994515243545";

    bindEvents();
    renderList();
  }

  function bindEvents(){
    $("goSite").onclick = ()=> location.href="index.html";

    $("logout").onclick = ()=>{
      sessionStorage.removeItem(SESSION_KEY);
      alert("Çıxış edildi.");
      location.href="index.html";
    };

    $("saveDraft").onclick = ()=>{
      syncPhone();
      saveData();
      alert("Yadda saxlandı ✅");
    };

    $("loadFromSite").onclick = ()=>{
      DATA = loadData();
      $("phone").value = DATA.phone || "";
      renderList();
      alert("Saytdan oxundu ✅");
    };

    $("saveProduct").onclick = saveProduct;
    $("deleteProduct").onclick = deleteProduct;
    $("clearForm").onclick = clearForm;

    window.addEventListener("storage",(e)=>{
      if(e.key === STORAGE_KEY){
        DATA = loadData();
        $("phone").value = DATA.phone || "";
        renderList();
      }
    });

    if(bc){
      bc.onmessage = (ev)=>{
        if(ev?.data==="refresh"){
          DATA = loadData();
          $("phone").value = DATA.phone || "";
          renderList();
        }
      };
    }
  }

  function syncPhone(){
    const phone = ($("phone").value || "").trim();
    if(phone) DATA.phone = phone;
  }

  function collectPlans(){
    const plans = [];
    const a = ($("pl1").value || "").trim(); const b = ($("pp1").value || "").trim();
    const c = ($("pl2").value || "").trim(); const d = ($("pp2").value || "").trim();
    const e = ($("pl3").value || "").trim(); const f = ($("pp3").value || "").trim();
    if(a && b) plans.push({label:a, price:b});
    if(c && d) plans.push({label:c, price:d});
    if(e && f) plans.push({label:e, price:f});
    return plans;
  }

  function saveProduct(){
    syncPhone();

    const id = ($("pid").value || "").trim();
    const cat = ($("pcat").value || "").trim();
    const title = ($("ptitle").value || "").trim();
    const img = ($("pimg").value || "").trim();
    const cornerPrice = ($("pprice").value || "").trim();
    const desc = ($("pdesc").value || "").trim();
    const info = ($("pinfo").value || "").trim();
    const plans = collectPlans();

    if(!id) return alert("ID yaz.");
    if(!title) return alert("Başlıq yaz.");
    if(!img) return alert("Şəkil yolu yaz (assets/....png).");
    if(plans.length===0) return alert("Ən az 1 plan yaz.");

    const obj = { id, cat, title, img, cornerPrice, desc, info, plans };

    const idx = (DATA.products || []).findIndex(x=>x.id===id);
    if(idx>=0) DATA.products[idx] = obj;
    else DATA.products.unshift(obj);

    saveData();
    renderList();
    alert("Yaddaşa yazıldı ✅ Əsas sayt yenilənməlidir.");
  }

  function deleteProduct(){
    const id = ($("pid").value || "").trim();
    if(!id) return alert("Silmək üçün ID lazımdır.");
    if(!confirm("Bu paketi silim?")) return;

    DATA.products = (DATA.products||[]).filter(x=>x.id!==id);
    saveData();
    renderList();
    clearForm();
    alert("Silindi ✅");
  }

  function clearForm(){
    $("pid").value="";
    $("pcat").value="netflix";
    $("ptitle").value="";
    $("pimg").value="";
    $("pprice").value="";
    $("pdesc").value="";
    $("pinfo").value="";
    $("pl1").value=""; $("pp1").value="";
    $("pl2").value=""; $("pp2").value="";
    $("pl3").value=""; $("pp3").value="";
  }

  function loadToForm(id){
    const p = (DATA.products||[]).find(x=>x.id===id);
    if(!p) return;

    $("pid").value = p.id || "";
    $("pcat").value = p.cat || "netflix";
    $("ptitle").value = p.title || "";
    $("pimg").value = p.img || "";
    $("pprice").value = p.cornerPrice || "";
    $("pdesc").value = p.desc || "";
    $("pinfo").value = p.info || "";

    const plans = p.plans || [];
    $("pl1").value = plans[0]?.label || ""; $("pp1").value = plans[0]?.price || "";
    $("pl2").value = plans[1]?.label || ""; $("pp2").value = plans[1]?.price || "";
    $("pl3").value = plans[2]?.label || ""; $("pp3").value = plans[2]?.price || "";
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function renderList(){
    const list = $("list");
    list.innerHTML = "";

    (DATA.products||[]).forEach(p=>{
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div>
          <div class="mini">
            <img class="thumb" src="${esc(p.img || "")}" alt="">
            <div>
              <div style="font-weight:900">${esc(p.title || "")}</div>
              <div class="k">${esc(p.cat || "")} • ${esc(p.cornerPrice || "")} • ID: ${esc(p.id || "")}</div>
              <div class="k">${esc(p.desc || "")}</div>
            </div>
          </div>
        </div>
        <div class="mini">
          <button class="primary">Edit</button>
        </div>
      `;
      div.querySelector("button").onclick = ()=> loadToForm(p.id);
      list.appendChild(div);
    });
  }

  gate();
</script>

</body>
</html>