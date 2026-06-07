const REPO = "mircavad09/mirpanel";
const BRANCH = "main";
const ORDERS_PATH = "data/payment-orders.json";
const RECEIPT_DIR = "uploads/receipts";
const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
const ALLOWED_RECEIPTS = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function token(env) {
  return env.MIRPANEL_GITHUB_TOKEN || env.GITHUB_TOKEN || env.GH_TOKEN || "";
}

async function github(env, pathname, init = {}) {
  const auth = token(env);
  if (!auth) {
    const error = new Error("PAYMENT_ORDER_STORAGE_NOT_CONFIGURED");
    error.status = 503;
    throw error;
  }
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${auth}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mirpanel-payment-orders",
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `GitHub xetasi: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function decodeBase64(value) {
  const binary = atob(String(value || "").replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Text(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function encodeBase64Bytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function getRepoFile(env, path) {
  try {
    const file = await github(env, `/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`);
    return { sha: file.sha, source: decodeBase64(file.content), downloadUrl: file.download_url || "" };
  } catch (error) {
    if (error.status === 404) return { sha: "", source: "", downloadUrl: "" };
    throw error;
  }
}

async function putRepoFile(env, path, content, sha, message) {
  const body = { message, content, branch: BRANCH };
  if (sha) body.sha = sha;
  return github(env, `/repos/${REPO}/contents/${path}`, { method: "PUT", body: JSON.stringify(body) });
}

function findObjectBlock(source, marker) {
  const markerStart = source.indexOf(marker);
  if (markerStart < 0) throw new Error(`${marker} tapilmadi.`);
  const start = source.indexOf("{", markerStart);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${marker} bloku baglanmayib.`);
}

function parseData(source) {
  return JSON.parse(findObjectBlock(source, "const DATA"));
}

async function readOrders(env) {
  const file = await getRepoFile(env, ORDERS_PATH);
  if (!file.source) return { sha: "", orders: [] };
  const parsed = JSON.parse(file.source || "[]");
  return { sha: file.sha, orders: Array.isArray(parsed) ? parsed : [] };
}

function safeFileName(name) {
  const clean = String(name || "receipt").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return clean || "receipt";
}

function orderNumber() {
  return `MP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function defaultAdminPaymentOrder(productId = "") {
  return {
    enabled: productId === "capcut",
    requireCustomerEmail: true,
    emailLabel: "Sifarisin gonderileceyi Gmail unvani",
    emailPlaceholder: "mes: adiniz@gmail.com",
    receiptRequired: true,
    redirectWhatsApp: false,
    successMessage: "Sifarisiniz qebul edildi. Odenis yoxlanildiqdan sonra sizinle elaqe saxlanilacaq."
  };
}

async function sendNotification(env, order) {
  const to = order.notifyEmail || env.ADMIN_NOTIFY_EMAIL || "mircavad09@gmail.com";
  const subject = `Yeni CapCut sifarisi: #${order.orderId}`;
  const text = [
    `Sifaris nomresi: ${order.orderId}`,
    `Mehsul: ${order.productTitle}`,
    `Plan: ${order.plan}`,
    `Qiymet: ${order.price}`,
    `Musteri Gmail-i: ${order.customerEmail}`,
    `Tarix/saat: ${order.createdAt}`,
    `Admin panel: ${env.ADMIN_PANEL_URL || "Admin panel linki elave edilmeyib"}`
  ].join("\n");
  if (env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Mirpanel <onboarding@resend.dev>", to, subject, text })
    }).catch((error) => console.error("Payment email notification failed", error));
  } else {
    console.warn("Payment email notification skipped: RESEND_API_KEY is not configured.");
  }
}

export async function onRequestPost(context) {
  try {
    const form = await context.request.formData();
    const productId = String(form.get("productId") || "").trim();
    const productTitle = String(form.get("productTitle") || "").trim();
    const plan = String(form.get("plan") || "").trim();
    const price = String(form.get("price") || "").trim();
    const customerEmail = String(form.get("customerEmail") || "").trim();
    const receipt = form.get("receiptFile");
    if (!productId) return json({ ok: false, error: "productId teleb olunur." }, 400);
    const appFile = await getRepoFile(context.env, "app.js");
    const data = parseData(appFile.source);
    const product = data.products?.find((item) => item.id === productId);
    const payment = { ...defaultAdminPaymentOrder(productId), ...(product?.adminPaymentOrder || {}) };
    if (!product || product.active === false) return json({ ok: false, error: "Mehsul tapilmadi ve ya aktiv deyil." }, 404);
    if (payment.enabled !== true) return json({ ok: false, error: "Bu mehsul ucun odenisli sifaris aktiv deyil." }, 409);
    if (product.soldOut === true || product.flow === "out_of_stock") return json({ ok: false, error: "Stokda yoxdur." }, 409);
    if (product.stockEnabled === true && Number(product.stock) <= 0) return json({ ok: false, error: "Stokda yoxdur." }, 409);
    if (payment.requireCustomerEmail !== false && !customerEmail) return json({ ok: false, error: "Gmail teleb olunur." }, 400);
    if (payment.receiptRequired !== false && !(receipt instanceof File)) return json({ ok: false, error: "Cek fayli teleb olunur." }, 400);
    let receiptPath = "";
    let receiptFileUrl = "";
    let receiptFileName = "";
    let receiptMimeType = "";
    const orderId = orderNumber();
    if (receipt instanceof File && receipt.size > 0) {
      if (!ALLOWED_RECEIPTS.has(receipt.type)) return json({ ok: false, error: "Cek JPG, PNG, WEBP ve ya PDF olmalidir." }, 400);
      if (receipt.size > MAX_RECEIPT_SIZE) return json({ ok: false, error: "Cek fayli maksimum 5 MB ola biler." }, 400);
      receiptFileName = safeFileName(receipt.name);
      receiptMimeType = receipt.type;
      receiptPath = `${RECEIPT_DIR}/${orderId}-${receiptFileName}`;
      const bytes = new Uint8Array(await receipt.arrayBuffer());
      const uploaded = await putRepoFile(context.env, receiptPath, encodeBase64Bytes(bytes), "", `Upload receipt for ${orderId}`);
      receiptFileUrl = uploaded.content?.download_url || `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${receiptPath}`;
    }
    const settings = { bankName: "", cardHolderName: "", cardNumber: "", notifyEmail: "mircavad09@gmail.com", ...(data.paymentSettings || {}) };
    const order = {
      orderId,
      productId,
      productTitle: productTitle || product.title || productId,
      plan,
      price,
      customerEmail,
      bankName: settings.bankName,
      cardHolderName: settings.cardHolderName,
      cardNumber: settings.cardNumber,
      notifyEmail: settings.notifyEmail,
      receiptFileUrl,
      receiptFileName,
      receiptMimeType,
      receiptPath,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const ordersFile = await readOrders(context.env);
    ordersFile.orders.push(order);
    const saved = await putRepoFile(context.env, ORDERS_PATH, encodeBase64Text(JSON.stringify(ordersFile.orders, null, 2) + "\n"), ordersFile.sha, `Create payment order ${orderId}`);
    await sendNotification(context.env, order);
    return json({ ok: true, orderId, order, commitSha: saved.commit?.sha || "" });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: error.message || "Sifaris yaradilmadi." }, error.status || 500);
  }
}
