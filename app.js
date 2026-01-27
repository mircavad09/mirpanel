const STORAGE_KEY = "mirpanel_data_v1";

const DEFAULT_DATA = {
  phone: "994515243545",
  products: [
    {
      id: "netflix",
      cat: "netflix",
      title: "Netflix Premium (Şəxsi otaq)",
      img: "assets/netflix.png",
      cornerPrice: "5.99₼",
      desc: "HD/4K • Aktivləşmə 5–30 dəq • Şəxsi otaq",
      info: "📺 Netflix Şəxsi Otaq\n\n• Otaq tam sizə aiddir\n• Ad və şifrəni dəyişə bilərsiniz\n• TV, telefon, noutbuk – istənilən cihaz",
      plans: [
        { label: "1 aylıq", price: "5.99 AZN" },
        { label: "3 aylıq", price: "16.99 AZN" },
        { label: "6 aylıq", price: "31.99 AZN" }
      ]
    },
    {
      id: "spotify",
      cat: "spotify",
      title: "Spotify Premium",
      img: "assets/spotify.png",
      cornerPrice: "4.49₼",
      desc: "Reklamsız • Offline dinlə • Premium musiqi",
      info: "🎵 Spotify Premium\n\n• Reklamsız\n• Offline dinləmə\n• Premium keyfiyyət",
      plans: [
        { label: "1 aylıq", price: "4.49 AZN" },
        { label: "3 aylıq", price: "11.99 AZN" },
        { label: "6 aylıq", price: "22.99 AZN" }
      ]
    },
    {
      id: "youtube",
      cat: "youtube",
      title: "YouTube Premium",
      img: "assets/youtube.png",
      cornerPrice: "4.99₼",
      desc: "Reklamsız • Background play • YouTube Music",
      info: "▶️ YouTube Premium\n\n• Reklamsız izləmə\n• Background play\n• YouTube Music daxildir",
      plans: [
        { label: "1 aylıq", price: "4.99 AZN" },
        { label: "4 aylıq (ENDİRİMLİ)", price: "17.99 AZN" },
        { label: "6 aylıq", price: "24.99 AZN" }
      ]
    },
    {
      id: "capcut",
      cat: "capcut",
      title: "CapCut Pro",
      img: "assets/capcut.png",
      cornerPrice: "4.99₼",
      desc: "Premium effektlər • Pro şablonlar • HD/4K export",
      info: "✂️ CapCut Pro\n\n• Premium effektlər\n• Pro şablonlar\n• HD/4K export",
      plans: [
        { label: "1 aylıq", price: "4.99 AZN" },
        { label: "6 aylıq (ENDİRİMLİ)", price: "24.99 AZN" },
        { label: "12 aylıq", price: "44.99 AZN" }
      ]
    },
    {
      id: "chatgpt",
      cat: "chatgpt",
      title: "ChatGPT Plus",
      img: "assets/chatgpt.png",
      cornerPrice: "9₼",
      desc: "Rəsmi Plus • Sürətli • Güclü model",
      info: "🤖 ChatGPT Plus\n\n• Rəsmi aktivləşdirmə\n• Sürətli cavablar\n• Fayl və şəkil analizi",
      plans: [
        { label: "1 aylıq", price: "9 AZN" },
        { label: "3 aylıq", price: "25 AZN" }
      ]
    }
  ]
};

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw);
    if(!parsed || !parsed.products) return DEFAULT_DATA;
    return parsed;
  }catch(e){
    return DEFAULT_DATA;
  }
}

const DATA = loadData();

// ===== Render products to grid =====
const grid = document.getElementById("grid");

function escapeHtml(str){
  return (str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderCards(){
  grid.innerHTML = "";
  DATA.products.forEach(p=>{
    const card = document.createElement("div");
    card.className = "card premium";
    card.dataset.cat = p.cat;
    card.dataset.title = p.title;
    card.dataset.img = p.img;
    card.dataset.desc = p.desc;
    card.dataset.info = p.info;
    card.dataset.plans = JSON.stringify(p.plans || []);

    card.innerHTML = `
      <div class="corner-price">${p.cornerPrice || ""}</div>
      <img class="card-img big" src="${p.img}" alt="">
      <div class="content">
        <div class="title">${escapeHtml(p.title)}</div>
        <div class="desc long">${escapeHtml(p.desc || "")}</div>
        <div class="bottom">
          <div class="hint">Paket seç → WhatsApp</div>
          <button class="btn light" type="button">Seç</button>
        </div>
      </div>
    `;

    card.addEventListener("click", ()=> openModalFromCard(card));
    grid.appendChild(card);
  });
}
renderCards();

// ===== Filters =====
const buttons = document.querySelectorAll(".cat-btn");
const searchInput = document.getElementById("search");
let activeCat = "all";

buttons.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    buttons.forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    activeCat = btn.dataset.cat;
    applyFilters();
  });
});
searchInput.addEventListener("input", applyFilters);

function applyFilters(){
  const q = (searchInput.value || "").toLowerCase().trim();
  document.querySelectorAll(".card").forEach(card=>{
    const catOk = (activeCat === "all" || card.dataset.cat === activeCat);

    const title = (card.dataset.title || "").toLowerCase();
    const desc  = (card.dataset.desc || "").toLowerCase();
    const info  = (card.dataset.info || "").toLowerCase();
    const plans = (card.dataset.plans || "").toLowerCase();
    const text = title + " " + desc + " " + info + " " + plans;

    const searchOk = text.includes(q);
    card.style.display = (catOk && searchOk) ? "block" : "none";
  });
}

// ===== Modal + WhatsApp =====
const modal = document.getElementById("modal");
const closeModalBtn = document.getElementById("closeModal");

const modalImg = document.getElementById("modalImg");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalText = document.getElementById("modalText");
const plansBox = document.getElementById("plans");
const orderBtn = document.getElementById("orderBtn");

let selectedPlan = null;
let selectedProduct = null;

function openModalFromCard(card){
  selectedPlan = null;
  orderBtn.disabled = true;

  selectedProduct = {
    title: card.dataset.title || "Məhsul",
    img: card.dataset.img || "",
    desc: card.dataset.desc || "",
    info: card.dataset.info || "",
    plans: []
  };

  try{ selectedProduct.plans = JSON.parse(card.dataset.plans || "[]"); }
  catch(e){ selectedProduct.plans = []; }

  modalImg.src = selectedProduct.img;
  modalTitle.textContent = selectedProduct.title;
  modalDesc.textContent = selectedProduct.desc;
  modalText.textContent = selectedProduct.info;

  renderPlans(selectedProduct.plans);
  modal.classList.add("show");
}

function renderPlans(plans){
  plansBox.innerHTML = "";
  plans.forEach((p)=>{
    const row = document.createElement("div");
    row.className = "plan";
    row.innerHTML = `
      <div class="plan-left">
        <div class="radio"></div>
        <div class="plan-title">${p.label}</div>
      </div>
      <div class="plan-price">${p.price}</div>
    `;
    row.addEventListener("click", ()=>{
      document.querySelectorAll(".plan").forEach(x=>x.classList.remove("selected"));
      row.classList.add("selected");
      selectedPlan = p;
      orderBtn.disabled = false;
    });
    plansBox.appendChild(row);
  });
}

orderBtn.addEventListener("click", ()=>{
  if(!selectedProduct || !selectedPlan) return;

  const msg =
`Salam, ${selectedProduct.title} sifariş etmək istəyirəm.
Müddət: ${selectedPlan.label}
Qiymət: ${selectedPlan.price}`;

  window.open(`https://wa.me/${DATA.phone}?text=${encodeURIComponent(msg)}`, "_blank");
});

closeModalBtn.addEventListener("click", ()=> modal.classList.remove("show"));
modal.addEventListener("click", (e)=>{ if(e.target === modal) modal.classList.remove("show"); });