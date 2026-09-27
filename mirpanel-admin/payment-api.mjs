import { createPaymentMailer, paymentEmailContent } from "./payment-mail.mjs";
import {
  createPaymentSecurity,
  normalizePaymentNumber,
  publicPaymentNumber,
  receiptFromBuffer,
  receiptFromPayload,
  safeMultiline,
  safeText,
  safeUuid,
  validatePaymentNumber
} from "./payment-security.mjs";
import { createPaymentStore } from "./payment-store.mjs";
import { structuredDurationMonths } from "./payment-order-lifecycle.mjs";
import { paymentMethodLabel } from "./payment-order-query.mjs";

function planName(plan) {
  return safeText(plan?.label || plan?.name || (plan?.months ? `${plan.months} aylıq` : "Seçilmiş plan"), 160);
}

export function buildCanonicalWhatsApp(order, methodLabel, extraText, configuredPhone) {
  let phone = String(configuredPhone || "").replace(/\D/g, "");
  if (phone.startsWith("0")) phone = `994${phone.slice(1)}`;
  if (!/^\d{8,15}$/.test(phone)) phone = "994515243545";
  const extra = safeMultiline(extraText, 2000);
  const message = [
    "Salam, ödəniş etmişəm.", "",
    `Sifariş nömrəsi: ${order.order_code}`,
    `Məhsul: ${safeText(order.product_title, 160)}`,
    `Plan: ${safeText(order.plan_name, 160)}`,
    `Məbləğ: ${Number(order.amount).toFixed(2)} ${safeText(order.currency || "₼", 8)}`,
    `Ödəniş üsulu: ${methodLabel}`,
    ...(extra ? ["", extra] : []), "",
    "Ödəniş çeki Mirpanel sisteminə yüklənib. Zəhmət olmasa sifarişi yoxlayıb təsdiqləyin."
  ].join("\n");
  return { whatsappMessage: message, whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(message)}` };
}

function resolvedPaymentTheme(method) {
  if (["leo", "abb", "kapital", "m10", "neutral"].includes(method.theme)) return method.theme;
  const provider = String(method.provider_name || "").toLocaleLowerCase("az-AZ");
  if (provider.includes("leo")) return "leo";
  if (provider.includes("abb")) return "abb";
  if (provider.includes("kapital")) return "kapital";
  if (provider.includes("m10") || method.method_type === "wallet") return "m10";
  return "neutral";
}

function publicMethod(method) {
  return {
    id: method.id,
    displayName: method.displayName,
    type: method.type,
    providerName: method.providerName,
    maskedNumber: method.maskedNumber,
    last4: method.last4,
    color: method.color,
    icon: method.icon,
    theme: method.resolvedTheme,
    order: method.order,
    available: method.available,
    status: method.status,
    unavailableReason: method.available ? "" : method.status === "limit_reached" ? "Bu gün limit dolub" : "Müvəqqəti rezervdədir"
  };
}

function errorStatus(error) {
  return Number(error?.status) || (error?.code === "PAYMENT_METHOD_LIMIT_REACHED" ? 409 : 500);
}

export async function paymentOrderFromMultipart(rawBody, contentType, maxReceiptBytes = 5 * 1024 * 1024) {
  let form;
  try {
    form = await new Request("http://localhost/api/payments/orders", {
      method: "POST",
      headers: { "Content-Type": String(contentType || "") },
      body: rawBody
    }).formData();
  } catch {
    throw Object.assign(new Error("Çek məlumatı düzgün göndərilməyib."), { status: 400 });
  }
  const uploaded = form.get("receipt");
  if (!uploaded || typeof uploaded.arrayBuffer !== "function") throw Object.assign(new Error("Ödəniş qəbzi seçilməyib."), { status: 400 });
  if (Number(uploaded.size) > maxReceiptBytes) throw Object.assign(new Error("Fayl 5 MB-dan böyükdür. Şəkli sıxışdırıb yenidən seçin."), { status: 413, code: "RECEIPT_TOO_LARGE" });
  return {
    body: {
      reservationId: form.get("reservationId"),
      checkoutKey: form.get("checkoutKey"),
      productId: form.get("productId"),
      planIndex: form.get("planIndex"),
      consentAccepted: form.get("consentAccepted") === "true",
      whatsappExtraText: form.get("whatsappExtraText"),
    },
    receipt: receiptFromBuffer(Buffer.from(await uploaded.arrayBuffer()), uploaded.type, maxReceiptBytes)
  };
}

export function createPaymentSystem(options) {
  const { config, json, readBody, readRawBody, requireAuth, requireMutationAuth, loadCatalog, actorName } = options;
  const required = [config.supabaseUrl, config.supabaseSecretKey, config.receiptsBucket, config.encryptionKey, config.tokenSecret];
  if (required.some((item) => !item)) {
    return {
      configured: false,
      start() {},
      async guardLogin() {},
      async handle(request, response) {
        if (!new URL(request.url, "http://localhost").pathname.startsWith("/api/payments/")) return false;
        json(response, 503, { error: "Ödəniş sistemi təhlükəsiz server konfiqurasiyasını gözləyir." });
        return true;
      }
    };
  }

  const security = createPaymentSecurity(config);
  const store = options.store || createPaymentStore(config);
  const mailer = options.mailer || createPaymentMailer(config, store);
  const allowedOrigins = new Set(config.allowedOrigins);

  function clientIp(request) {
    return String(request.headers["cf-connecting-ip"] || request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown").split(",")[0].trim();
  }

  function corsHeaders(request) {
    const origin = String(request.headers.origin || "");
    if (!origin || !allowedOrigins.has(origin)) return { Vary: "Origin" };
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Idempotency-Key",
      "Access-Control-Max-Age": "600",
      Vary: "Origin"
    };
  }

  function publicJson(request, response, status, body) {
    json(response, status, body, { ...corsHeaders(request), "Cache-Control": "no-store" });
  }

  async function orderResult(order, idempotent = true, whatsappExtraText = "") {
    const method = await store.rawMethod(order.method_id);
    const methodLabel = paymentMethodLabel({
      method_name_snapshot: order.method_name_snapshot || method?.provider_name || method?.display_name,
      method_last4_snapshot: order.method_last4_snapshot || method?.last4
    });
    return {
      orderId: order.id, orderCode: order.order_code, status: order.status, idempotent,
      paymentMethod: methodLabel,
      productTitle: order.product_title, planName: order.plan_name,
      amount: Number(order.amount), currency: order.currency,
      receiptUploaded: Boolean(order.receipt_path && !order.receipt_deleted_at),
      ...buildCanonicalWhatsApp(order, methodLabel, whatsappExtraText, config.whatsappPhone)
    };
  }

  async function publicRate(request, action, seconds, maxHits) {
    await store.rateLimit(`${action}:${security.ipHash(clientIp(request))}`, seconds, maxHits);
  }

  async function catalogSelection(productId, planIndex) {
    const data = await loadCatalog();
    const product = data.products.find((item) => item.id === productId && item.active !== false);
    const index = Number(planIndex);
    const plan = product?.plans?.[index];
    const rawStock = product?.stock ?? product?.stockCount ?? product?.stockQuantity;
    const unavailableStock = product?.soldOut === true || product?.flow === "out_of_stock" ||
      (product?.stockEnabled === true && rawStock !== null && rawStock !== "" && rawStock !== undefined && Number(rawStock) <= 0);
    if (!product || unavailableStock || !plan || !Number.isFinite(Number(plan.price)) || Number(plan.price) <= 0) {
      throw Object.assign(new Error("Məhsul və ya plan artıq sifariş üçün açıq deyil."), { status: 409 });
    }
    return { product, plan, planIndex: index };
  }

  async function handlePublic(request, response, url) {
    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders(request));
      response.end();
      return true;
    }
    const origin = String(request.headers.origin || "");
    if (origin && !allowedOrigins.has(origin)) {
      publicJson(request, response, 403, { error: "Sorğunun mənbəyi icazəli deyil." });
      return true;
    }
    if (request.method === "GET" && url.pathname === "/api/payments/health") {
      await publicRate(request, "health", 60, 30);
      await store.publicMethods();
      publicJson(request, response, 200, { ok: true, configured: true, database: true, storage: "private", registrationRequired: false });
      return true;
    }
    if (request.method === "GET" && url.pathname === "/api/payments/methods") {
      await publicRate(request, "methods", 60, 60);
      const methods = (await store.publicMethods()).map(publicMethod);
      publicJson(request, response, 200, { methods, anyAvailable: methods.some((item) => item.available), reservationMinutes: config.reservationMinutes });
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/payments/reservations") {
      await publicRate(request, "reserve", 600, 12);
      const body = await readBody(request, 50_000);
      const idempotencyKey = safeUuid(request.headers["x-idempotency-key"] || body.idempotencyKey);
      const checkoutKey = safeUuid(body.checkoutKey);
      const previousReservationId = body.previousReservationId ? safeUuid(body.previousReservationId) : null;
      const methodId = safeUuid(body.methodId);
      if (!idempotencyKey || !checkoutKey || !methodId || (body.previousReservationId && !previousReservationId)) {
        throw Object.assign(new Error("Təhlükəsiz sifariş və checkout açarı tələb olunur."), { status: 400 });
      }
      const { product, plan, planIndex } = await catalogSelection(safeText(body.productId, 100), body.planIndex);
      const reserved = await store.reserve({
        methodId, productId: product.id, planId: String(planIndex), amount: Number(plan.price),
        idempotencyKey, checkoutKey, previousReservationId
      });
      const method = await store.rawMethod(methodId);
      publicJson(request, response, 200, {
        reservationId: reserved.id,
        expiresAt: reserved.expiresAt,
        method: {
          id: method.id,
          displayName: method.display_name,
          providerName: method.provider_name,
          holderName: method.holder_name,
          number: publicPaymentNumber(security.decryptNumber(method.encrypted_number), method.method_type),
          type: method.method_type,
          color: method.color,
          theme: resolvedPaymentTheme(method)
        },
        amount: Number(plan.price),
        currency: "AZN"
      });
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/payments/reservations/cancel") {
      await publicRate(request, "cancel", 600, 20);
      const body = await readBody(request, 20_000);
      const reservationId = safeUuid(body.reservationId);
      const checkoutKey = safeUuid(body.checkoutKey);
      if (!reservationId || !checkoutKey) throw Object.assign(new Error("Rezerv və checkout açarı düzgün deyil."), { status: 400 });
      const cancellation = await store.cancelCustomerReservation(reservationId, checkoutKey, `customer:${security.ipHash(clientIp(request)).slice(0, 12)}`);
      publicJson(request, response, 200, { ok: true, cancellation });
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/payments/checkout/resume") {
      await publicRate(request, "resume", 600, 30);
      const body = await readBody(request, 20_000);
      const reservationId = safeUuid(body.reservationId);
      const checkoutKey = safeUuid(body.checkoutKey);
      if (!reservationId || !checkoutKey) throw Object.assign(new Error("Rezerv və checkout açarı düzgün deyil."), { status: 400 });
      const reservation = await store.checkoutReservation(reservationId, checkoutKey);
      const order = await store.getOrderByReservation(reservationId);
      if (order) {
        publicJson(request, response, 200, { state: "submitted", order: await orderResult(order) });
        return true;
      }
      if (reservation.status !== "reserved" || Date.parse(reservation.expires_at) <= Date.now()) {
        publicJson(request, response, 200, { state: "expired" });
        return true;
      }
      const method = await store.rawMethod(reservation.method_id);
      publicJson(request, response, 200, {
        state: "reserved", productId: reservation.product_id, planIndex: Number(reservation.plan_id),
        reservation: {
          reservationId, expiresAt: reservation.expires_at,
          amount: Number(reservation.amount), currency: reservation.currency,
          method: {
            id: method.id, displayName: method.display_name, providerName: method.provider_name,
            holderName: method.holder_name,
            number: publicPaymentNumber(security.decryptNumber(method.encrypted_number), method.method_type),
            type: method.method_type, color: method.color, theme: resolvedPaymentTheme(method)
          }
        }
      });
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/payments/orders") {
      await publicRate(request, "submit", 3600, 10);
      const contentType = String(request.headers["content-type"] || "");
      let body;
      let receipt;
      if (contentType.toLowerCase().startsWith("multipart/form-data;")) {
        if (typeof readRawBody !== "function") throw Object.assign(new Error("Fayl yükləmə xidməti hazır deyil."), { status: 503 });
        let rawBody;
        try {
          rawBody = await readRawBody(request, config.maxReceiptBytes + 150_000);
        } catch (error) {
          if (Number(error?.status) === 413) throw Object.assign(new Error("Fayl 5 MB-dan böyükdür. Şəkli sıxışdırıb yenidən seçin."), { status: 413, code: "RECEIPT_TOO_LARGE" });
          throw error;
        }
        ({ body, receipt } = await paymentOrderFromMultipart(rawBody, contentType, config.maxReceiptBytes));
      } else {
        body = await readBody(request, Math.ceil(config.maxReceiptBytes * 1.42) + 100_000);
        receipt = receiptFromPayload(body.receipt, config.maxReceiptBytes);
      }
      const reservationId = safeUuid(body.reservationId);
      const checkoutKey = safeUuid(body.checkoutKey);
      const idempotencyKey = safeUuid(request.headers["x-idempotency-key"]);
      if (!checkoutKey) throw Object.assign(new Error("Ödəniş səhifəsi yenilənib. Səhifəni yeniləyib yenidən cəhd edin; rezerviniz qorunur."), { status: 400 });
      if (!reservationId || !checkoutKey || !idempotencyKey || body.consentAccepted !== true) throw Object.assign(new Error("Rezerv, checkout açarı və məcburi razılıq tələb olunur."), { status: 400 });
      const reservation = await store.checkoutReservation(reservationId, checkoutKey);
      if (reservation.product_id !== body.productId || reservation.plan_id !== String(body.planIndex)) {
        throw Object.assign(new Error("Təkrar sorğu əvvəlki sifarişlə uyğun deyil."), { status: 409 });
      }
      const existing = await store.getOrderByReservation(reservationId);
      if (existing) {
        publicJson(request, response, 200, await orderResult(existing, true, body.whatsappExtraText));
        return true;
      }
      const { product, plan, planIndex } = await catalogSelection(safeText(body.productId, 100), body.planIndex);
      // Same reservation + identical validated bytes always target one private
      // object, even if a timeout hides a successful storage response.
      const receiptPath = `${reservationId}/${receipt.sha256}.${receipt.extension}`;
      await store.uploadReceipt(receiptPath, receipt);
      let submitted;
      try {
        submitted = await store.submitOrder({
          reservationId,
          checkoutKey,
          productId: product.id,
          planId: String(planIndex),
          productTitle: safeText(product.title, 160),
          planName: planName(plan),
          receiptBucket: config.receiptsBucket,
          receiptPath,
          receiptMime: receipt.mimeType,
          receiptSize: receipt.buffer.length,
          receiptSha256: receipt.sha256,
          durationMonths: structuredDurationMonths(plan)
        });
      } catch (error) {
        // A lost RPC response is not proof of rollback. Never delete a possibly linked receipt.
        const reconciled = await store.getOrderByReservation(reservationId).catch(() => null);
        if (reconciled) {
          if (reconciled.receipt_path !== receiptPath) await store.removeReceipt(receiptPath).catch(() => {});
          submitted = { id: reconciled.id, idempotent: true };
        } else {
          if (error.status >= 400 && error.status < 500) await store.removeReceipt(receiptPath).catch(() => {});
          throw error;
        }
      }
      const order = await store.getOrder(submitted.id);
      if (submitted.idempotent && order.receipt_path !== receiptPath) await store.removeReceipt(receiptPath).catch(() => {});
      const method = await store.rawMethod(order.method_id);
      if (submitted.idempotent) {
        publicJson(request, response, 200, await orderResult(order, true, body.whatsappExtraText));
        return true;
      }
      const reviewToken = security.randomToken();
      const reviewUrl = `${config.adminBaseUrl}/admin/review?token=${encodeURIComponent(reviewToken)}`;
      try {
        await store.createReviewToken(order.id, security.hashToken(reviewToken), new Date(Date.now() + 30 * 60_000).toISOString());
        const settings = await store.getSettings().catch(() => ({ notificationEmail: "" }));
        const recipient = settings.notificationEmail || config.notificationEmail;
        if (!recipient) throw new Error("PAYMENT_NOTIFICATION_EMAIL təyin edilməyib.");
        const content = paymentEmailContent({ order, method, reviewUrl, recipient, fromName: config.gmailFromName });
        await store.enqueueEmail({
          order_id: order.id,
          recipient,
          subject: content.subject,
          html_body: content.htmlBody,
          text_body: content.textBody
        });
        mailer.drain(1).catch((error) => console.error("Payment email", error.message));
      } catch (error) {
        console.error("Payment notification queue", order.order_code, error.message);
      }
      publicJson(request, response, 201, await orderResult(order, false, body.whatsappExtraText));
      return true;
    }
    const deliveryMatch = url.pathname.match(/^\/api\/payments\/capcut\/delivery\/([A-Za-z0-9_-]{32,})$/);
    if (deliveryMatch && request.method === "GET") {
      await publicRate(request, "capcut-delivery", 60, 60);
      const delivery = await store.capcutDeliveryByTokenHash(security.hashToken(deliveryMatch[1]));
      if (!delivery) throw Object.assign(new Error("Gizli sifariş keçidi tapılmadı."), { status: 404, code: "CAPCUT_DELIVERY_NOT_FOUND" });
      const order = delivery.payment_orders || {};
      const base = { status: delivery.status, orderCode: order.order_code, product: "CapCut Pro", plan: order.plan_name, amount: Number(order.amount), currency: order.currency, createdAt: delivery.created_at };
      if (delivery.status === "approved") {
        const account = await store.capcutAccount(delivery.account_id);
        if (!account || !["assigned", "delivered"].includes(account.status)) throw Object.assign(new Error("Hesab məlumatı hazır deyil."), { status: 409 });
        const template = await store.capcutTemplate();
        Object.assign(base, { account: { email: security.decryptSecret(account.email_cipher), password: security.decryptSecret(account.password_cipher), expiresOn: account.expires_on }, template: { title: template.title, loginRules: template.login_rules, prohibitions: template.prohibitions, supportText: template.support_text, footerText: template.footer_text } });
      }
      publicJson(request, response, 200, base); return true;
    }
    const notifyMatch = url.pathname.match(/^\/api\/payments\/capcut\/delivery\/([A-Za-z0-9_-]{32,})\/notify$/);
    if (notifyMatch && request.method === "POST") {
      await publicRate(request, "capcut-notify", 600, 10);
      const delivery = await store.capcutDeliveryByTokenHash(security.hashToken(notifyMatch[1]));
      if (!delivery) throw Object.assign(new Error("Gizli sifariş keçidi tapılmadı."), { status: 404 });
      await store.markCapcutNotified(delivery.order_id);
      const order = delivery.payment_orders || {};
      const message = `Salam. CapCut sifarişimin yoxlanmasını gözləyirəm.\nSifariş: ${safeText(order.order_code, 30)}\nMüştəri nömrəsi: +${delivery.customer_phone}\nMəhsul: CapCut\nMəbləğ: ${Number(order.amount).toFixed(2)} ${safeText(order.currency || "AZN", 8)}\nÇek yüklənib, yoxlama gözlənilir.`;
      const phone = String(config.whatsappPhone || "994515243545").replace(/\D/g, "");
      publicJson(request, response, 200, { status: delivery.status, whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(message)}` }); return true;
    }
    return false;
  }

  async function handleAdmin(request, response, url) {
    if (!url.pathname.startsWith("/api/admin/payment") && !url.pathname.startsWith("/api/admin/capcut")) return false;
    if (request.method === "GET") {
      if (!requireAuth(request, response)) return true;
    } else if (!requireMutationAuth(request, response)) return true;

    if (request.method === "GET" && url.pathname === "/api/admin/payment-methods") {
      json(response, 200, { methods: await store.adminMethods() }); return true;
    }
    if (request.method === "GET" && url.pathname === "/api/admin/capcut") {
      const snapshot = await store.capcutAdminSnapshot();
      const accounts = snapshot.accounts.map((row) => ({ id: row.id, email: security.decryptSecret(row.email_cipher), password: security.decryptSecret(row.password_cipher), expiresOn: row.expires_on, note: row.admin_note, status: row.status, assignedOrderId: row.assigned_order_id }));
      const deliveries = snapshot.deliveries.map((row) => ({ orderId: row.order_id, status: row.status, phone: row.customer_phone, notifiedAt: row.notified_at, approvedAt: row.approved_at, createdAt: row.created_at, accountId: row.account_id, order: row.payment_orders ? { orderCode: row.payment_orders.order_code, planName: row.payment_orders.plan_name, amount: Number(row.payment_orders.amount), currency: row.payment_orders.currency, receiptUploaded: Boolean(row.payment_orders.receipt_path) } : null, customerUrl: `https://mirpanel.com/capcut-sifaris.html#${encodeURIComponent(security.decryptSecret(row.token_cipher))}` }));
      const template = await store.capcutTemplate();
      json(response, 200, { accounts, deliveries, template, counts: { available: accounts.filter((x) => x.status === "available").length, waiting: deliveries.filter((x) => x.status === "waiting").length, delivered: deliveries.filter((x) => x.status === "approved").length, cancelled: deliveries.filter((x) => x.status === "cancelled").length } }); return true;
    }
    if (request.method === "POST" && url.pathname === "/api/admin/capcut/accounts") {
      const body = await readBody(request, 100_000); const items = Array.isArray(body.items) ? body.items : [body];
      if (!items.length || items.length > 500) throw Object.assign(new Error("Hesab siyahısı düzgün deyil."), { status: 400 });
      const errors = [], rows = [];
      items.forEach((item, index) => { const email = safeText(item.email, 254).toLowerCase(), password = String(item.password || ""), expires = String(item.expiresOn || ""); if (!/^\S+@\S+\.\S+$/.test(email) || !password || !/^\d{4}-\d{2}-\d{2}$/.test(expires)) errors.push({ line: index + 1, error: "E-poçt, şifrə və bitmə tarixi tələb olunur." }); else rows.push({ email_cipher: security.encryptSecret(email), password_cipher: security.encryptSecret(password), expires_on: expires, admin_note: safeText(item.note, 500) }); });
      const created = rows.length ? await store.addCapcutAccounts(rows) : [];
      json(response, errors.length ? 207 : 201, { created: created.length, errors }); return true;
    }
    if (request.method === "PUT" && url.pathname === "/api/admin/capcut/template") {
      const body = await readBody(request, 50_000); const template = await store.saveCapcutTemplate({ title: safeText(body.title, 160), login_rules: safeMultiline(body.loginRules, 8000), prohibitions: safeMultiline(body.prohibitions, 8000), support_text: safeMultiline(body.supportText, 4000), footer_text: safeText(body.footerText, 500) }); json(response, 200, { template }); return true;
    }
    const capcutOrder = url.pathname.match(/^\/api\/admin\/capcut\/orders\/([0-9a-f-]+)\/(approve|reject|cancel)$/i);
    if (request.method === "POST" && capcutOrder) {
      const id = safeUuid(capcutOrder[1]); if (!id) throw Object.assign(new Error("Sifariş ID-si düzgün deyil."), { status: 400 });
      const action = capcutOrder[2]; const result = action === "approve" ? await store.approveCapcutDelivery(id, actorName) : action === "reject" ? await store.rejectCapcutDelivery(id, actorName) : await store.cancelCapcutDelivery(id, actorName);
      json(response, 200, result); return true;
    }
    if (request.method === "GET" && url.pathname === "/api/admin/payment-costs") {
      const catalog = await loadCatalog();
      const rows = await store.planCosts(catalog);
      json(response, 200, {
        rows,
        productCount: (catalog.products || []).length,
        planCount: rows.length,
        categories: [...new Set(rows.map((row) => row.category))].sort((a, b) => a.localeCompare(b, "az"))
      });
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/admin/payment-costs") {
      const body = await readBody(request, 100_000);
      if (!Array.isArray(body.items) || body.items.length > 500) throw Object.assign(new Error("Maya dəyəri siyahısı düzgün deyil."), { status: 400 });
      const catalog = await loadCatalog();
      const result = await store.savePlanCosts(body.items, catalog, actorName);
      json(response, 200, { ...result, rows: await store.planCosts(catalog) });
      return true;
    }
    if (request.method === "GET" && url.pathname === "/api/admin/payment-cost-backfill-preview") {
      json(response, 200, {
        preview: await store.costBackfillPreview(),
        snapshot: await store.financeSnapshot()
      });
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/admin/payment-cost-backfill") {
      const body = await readBody(request, 10_000);
      if (!Number.isInteger(Number(body.expectedCount)) || Number(body.expectedCount) < 0 || !/^[a-f0-9]{32}$/i.test(String(body.digest || ""))) {
        throw Object.assign(new Error("Backfill preview məlumatı düzgün deyil."), { status: 400 });
      }
      const before = await store.financeSnapshot();
      const result = await store.applyCostBackfill(body.expectedCount, body.digest, actorName);
      const after = await store.financeSnapshot();
      json(response, 200, { result, before, after, preview: await store.costBackfillPreview() });
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/admin/payment-methods") {
      const body = await readBody(request, 50_000);
      const number = validatePaymentNumber(body.fullNumber, body.type);
      const encrypted = number ? security.encryptNumber(number) : null;
      json(response, 201, { method: await store.createMethod(body, encrypted, actorName) }); return true;
    }
    const methodMatch = url.pathname.match(/^\/api\/admin\/payment-methods\/([0-9a-f-]+)(?:\/(archive|delete|activate|deactivate|reset-counter))?$/i);
    if (methodMatch) {
      const id = safeUuid(methodMatch[1]);
      if (!id) throw Object.assign(new Error("Ödəniş üsulu ID-si düzgün deyil."), { status: 400 });
      if (request.method === "POST" && methodMatch[2] === "archive") {
        await store.archiveMethod(id, actorName); json(response, 200, { ok: true }); return true;
      }
      if (request.method === "POST" && methodMatch[2] === "delete") {
        json(response, 200, await store.deleteMethod(id, actorName)); return true;
      }
      if (request.method === "POST" && methodMatch[2] === "activate") {
        json(response, 200, await store.setMethodActive(id, true, actorName)); return true;
      }
      if (request.method === "POST" && methodMatch[2] === "deactivate") {
        json(response, 200, await store.setMethodActive(id, false, actorName)); return true;
      }
      if (request.method === "POST" && methodMatch[2] === "reset-counter") {
        await store.resetMethodCounter(id, actorName); json(response, 200, { ok: true }); return true;
      }
      if (request.method === "POST" && !methodMatch[2]) {
        const body = await readBody(request, 50_000);
        const number = validatePaymentNumber(body.fullNumber, body.type);
        const encrypted = number ? security.encryptNumber(number) : null;
        json(response, 200, { method: await store.updateMethod(id, body, encrypted, actorName) }); return true;
      }
    }
    if (request.method === "GET" && url.pathname === "/api/admin/payment-orders") {
      const orders = await store.listOrders(Object.fromEntries(url.searchParams));
      const catalog = await loadCatalog();
      orders.filters ||= {};
      orders.filters.products = (catalog.products || [])
        .filter((product) => product && product.active !== false && product.id)
        .map((product) => ({ id: safeText(product.id, 100), title: safeText(product.title || product.name || "Məhsul", 160) }))
        .sort((a, b) => a.title.localeCompare(b.title, "az"));
      json(response, 200, orders); return true;
    }
    if (request.method === "POST" && url.pathname === "/api/admin/payment-orders/batch-contacted") {
      const body = await readBody(request, 100_000);
      const ids = Array.isArray(body.ids) ? body.ids : [];
      if (!ids.length || ids.length > 500 || ids.some((id) => !safeUuid(id))) {
        throw Object.assign(new Error("Seçilmiş sifariş siyahısı düzgün deyil."), { status: 400, code: "ORDER_BATCH_INVALID" });
      }
      json(response, 200, await store.contactExpiringOrders(ids, actorName)); return true;
    }
    if (request.method === "GET" && url.pathname === "/api/admin/payment-monthly-reports") {
      json(response, 200, await store.monthlyReports()); return true;
    }
    if (request.method === "GET" && url.pathname === "/api/admin/payment-emails") {
      json(response, 200, { emails: await store.pendingEmails() }); return true;
    }
    if (request.method === "GET" && url.pathname === "/api/admin/payment-settings") {
      json(response, 200, { settings: await store.getSettings(), health: { database: true, privateStorage: true, gmailConfigured: mailer.configured } }); return true;
    }
    if (request.method === "POST" && url.pathname === "/api/admin/payment-settings") {
      const body = await readBody(request, 20_000);
      json(response, 200, { settings: await store.updateSettings(body, actorName) }); return true;
    }
    const orderMatch = url.pathname.match(/^\/api\/admin\/payment-orders\/([0-9a-f-]+)(?:\/(approve|reject|contacted|receipt))?$/i);
    if (orderMatch) {
      const id = safeUuid(orderMatch[1]);
      if (!id) throw Object.assign(new Error("Sifariş ID-si düzgün deyil."), { status: 400 });
      const action = orderMatch[2];
      if (request.method === "GET" && action === "receipt") {
        const order = await store.getOrder(id);
        if (order.receipt_deleted_at) throw Object.assign(new Error("Çekin saxlanma müddəti bitib və fayl təhlükəsiz silinib."), { status: 410 });
        json(response, 200, { url: await store.signedReceipt(order.receipt_path, 300, actorName, order.id), expiresIn: 300, mimeType: order.receipt_mime }); return true;
      }
      if (request.method === "POST" && action === "approve") {
        const order = await store.getOrder(id);
        let durationMonths = order.duration_months || null;
        if (!durationMonths) {
          try {
            const { plan } = await catalogSelection(order.product_id, order.plan_id);
            durationMonths = structuredDurationMonths(plan);
          } catch {
            durationMonths = null;
          }
        }
        const result = await store.approveOrder(id, durationMonths, actorName);
        json(response, 200, { ...result, status: result.status === "approved" ? "completed" : result.status }); return true;
      }
      if (request.method === "POST" && action === "reject") { json(response, 200, await store.rejectOrder(id, actorName)); return true; }
      if (request.method === "POST" && action === "contacted") { json(response, 200, await store.contactOrder(id, actorName)); return true; }
    }
    const emailMatch = url.pathname.match(/^\/api\/admin\/payment-emails\/([0-9a-f-]+)\/retry$/i);
    if (request.method === "POST" && emailMatch) {
      await store.retryEmail(safeUuid(emailMatch[1]), actorName); mailer.drain(1).catch(() => {}); json(response, 200, { ok: true }); return true;
    }
    if (request.method === "POST" && url.pathname === "/api/admin/payment-review-token") {
      const body = await readBody(request, 20_000);
      const token = String(body.token || "");
      const checked = await store.consumeReviewToken(security.hashToken(token));
      json(response, 200, { order: await store.getOrder(checked.orderId), tokenValid: true }); return true;
    }
    return false;
  }

  return {
    configured: true,
    store,
    mailer,
    async guardLogin(request) {
      await store.rateLimit(`admin-login:${security.ipHash(clientIp(request))}`, 15 * 60, 12);
    },
    start() {
      mailer.start();
      const cleanup = () => store.cleanupExpiredReceipts().catch((error) => console.error("Payment receipt cleanup", error.diagnostic || error.message));
      setTimeout(cleanup, 15_000).unref?.();
      const timer = setInterval(cleanup, 6 * 60 * 60_000);
      timer.unref?.();
    },
    async handle(request, response) {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      try {
        if (url.pathname.startsWith("/api/payments/")) return await handlePublic(request, response, url);
        if (url.pathname.startsWith("/api/admin/payment") || url.pathname.startsWith("/api/admin/capcut")) return await handleAdmin(request, response, url);
        return false;
      } catch (error) {
        const isPublic = url.pathname.startsWith("/api/payments/");
        const status = errorStatus(error);
        console.error("Payment API", error.code || "PAYMENT_ERROR", error.diagnostic || error.message);
        if (isPublic) publicJson(request, response, status, { error: error.message, code: error.code || "PAYMENT_ERROR" });
        else json(response, status, { error: error.message, code: error.code || "PAYMENT_ERROR" });
        return true;
      }
    }
  };
}
