import crypto from "node:crypto";
import { createPaymentMailer, paymentEmailContent } from "./payment-mail.mjs";
import {
  createPaymentSecurity,
  normalizePaymentNumber,
  orderCode,
  publicPaymentNumber,
  receiptFromPayload,
  safeMultiline,
  safeText,
  safeUuid
} from "./payment-security.mjs";
import { createPaymentStore } from "./payment-store.mjs";

function planName(plan) {
  return safeText(plan?.label || plan?.name || (plan?.months ? `${plan.months} aylıq` : "Seçilmiş plan"), 160);
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
    unavailableReason: method.available ? "" : "Bu gün limit dolub"
  };
}

function errorStatus(error) {
  return Number(error?.status) || (error?.code === "PAYMENT_METHOD_LIMIT_REACHED" ? 409 : 500);
}

export function createPaymentSystem(options) {
  const { config, json, readBody, requireAuth, requireMutationAuth, loadCatalog, actorName } = options;
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
  const store = createPaymentStore(config);
  const mailer = createPaymentMailer(config, store);
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
    json(response, status, body, corsHeaders(request));
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
      if (!reservationId) throw Object.assign(new Error("Rezerv ID-si düzgün deyil."), { status: 400 });
      const cancellation = await store.cancelReservation(reservationId, `customer:${security.ipHash(clientIp(request)).slice(0, 12)}`);
      publicJson(request, response, 200, { ok: true, cancellation });
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/payments/orders") {
      await publicRate(request, "submit", 3600, 10);
      const body = await readBody(request, Math.ceil(config.maxReceiptBytes * 1.42) + 100_000);
      const reservationId = safeUuid(body.reservationId);
      if (!reservationId || body.consentAccepted !== true) throw Object.assign(new Error("Rezerv və məcburi razılıq tələb olunur."), { status: 400 });
      const existing = await store.getOrderByReservation(reservationId);
      if (existing) {
        const method = await store.rawMethod(existing.method_id);
        publicJson(request, response, 200, { orderId: existing.id, orderCode: existing.order_code, status: existing.status, idempotent: true, paymentMethod: method.display_name });
        return true;
      }
      const { product, plan, planIndex } = await catalogSelection(safeText(body.productId, 100), body.planIndex);
      const receipt = receiptFromPayload(body.receipt, config.maxReceiptBytes);
      const code = orderCode();
      const now = new Date();
      const receiptPath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${code}-${crypto.randomUUID()}.${receipt.extension}`;
      await store.uploadReceipt(receiptPath, receipt);
      let submitted;
      try {
        submitted = await store.submitOrder({
          orderCode: code,
          reservationId,
          productTitle: safeText(product.title, 160),
          planName: planName(plan),
          receiptBucket: config.receiptsBucket,
          receiptPath,
          receiptMime: receipt.mimeType,
          receiptSize: receipt.buffer.length,
          receiptSha256: receipt.sha256
        });
      } catch (error) {
        await store.removeReceipt(receiptPath).catch(() => {});
        throw error;
      }
      const order = await store.getOrder(submitted.id);
      const method = await store.rawMethod(order.method_id);
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
      publicJson(request, response, 201, {
        orderId: order.id,
        orderCode: order.order_code,
        status: order.status,
        paymentMethod: method.display_name,
        productTitle: product.title,
        planName: planName(plan),
        amount: Number(plan.price),
        currency: "AZN",
        receiptUploaded: true
      });
      return true;
    }
    return false;
  }

  async function handleAdmin(request, response, url) {
    if (!url.pathname.startsWith("/api/admin/payment")) return false;
    if (request.method === "GET") {
      if (!requireAuth(request, response)) return true;
    } else if (!requireMutationAuth(request, response)) return true;

    if (request.method === "GET" && url.pathname === "/api/admin/payment-methods") {
      json(response, 200, { methods: await store.adminMethods() }); return true;
    }
    if (request.method === "POST" && url.pathname === "/api/admin/payment-methods") {
      const body = await readBody(request, 50_000);
      const encrypted = body.fullNumber ? security.encryptNumber(body.fullNumber) : null;
      json(response, 201, { method: await store.createMethod(body, encrypted, actorName) }); return true;
    }
    const methodMatch = url.pathname.match(/^\/api\/admin\/payment-methods\/([0-9a-f-]+)(?:\/(archive|reset-counter))?$/i);
    if (methodMatch) {
      const id = safeUuid(methodMatch[1]);
      if (!id) throw Object.assign(new Error("Ödəniş üsulu ID-si düzgün deyil."), { status: 400 });
      if (request.method === "POST" && methodMatch[2] === "archive") {
        await store.archiveMethod(id, actorName); json(response, 200, { ok: true }); return true;
      }
      if (request.method === "POST" && methodMatch[2] === "reset-counter") {
        await store.resetMethodCounter(id, actorName); json(response, 200, { ok: true }); return true;
      }
      if (request.method === "POST" && !methodMatch[2]) {
        const body = await readBody(request, 50_000);
        const encrypted = body.fullNumber ? security.encryptNumber(body.fullNumber) : null;
        json(response, 200, { method: await store.updateMethod(id, body, encrypted, actorName) }); return true;
      }
    }
    if (request.method === "GET" && url.pathname === "/api/admin/payment-orders") {
      const orders = await store.listOrders(Object.fromEntries(url.searchParams));
      json(response, 200, orders); return true;
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
    const orderMatch = url.pathname.match(/^\/api\/admin\/payment-orders\/([0-9a-f-]+)(?:\/(approve|reject|receipt))?$/i);
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
        const result = await store.approveOrder(id, actorName);
        json(response, 200, { ...result, status: result.status === "approved" ? "completed" : result.status }); return true;
      }
      if (request.method === "POST" && action === "reject") { json(response, 200, await store.rejectOrder(id, actorName)); return true; }
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
        if (url.pathname.startsWith("/api/admin/payment")) return await handleAdmin(request, response, url);
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
