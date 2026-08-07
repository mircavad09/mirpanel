import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  maskedPaymentNumber,
  normalizePaymentNumber,
  safeColor,
  safeMultiline,
  safeText,
  safeUuid
} from "./payment-security.mjs";

function paymentError(error, fallback = "Ödəniş məlumatı işlənmədi.") {
  const message = String(error?.message || fallback);
  const known = [
    "IDEMPOTENCY_CONFLICT", "PAYMENT_METHOD_UNAVAILABLE", "PAYMENT_METHOD_LIMIT_REACHED",
    "RESERVATION_NOT_FOUND", "RESERVATION_EXPIRED", "ORDER_NOT_FOUND", "ORDER_NOT_REVIEWABLE",
    "ORDER_ALREADY_APPROVED", "REJECTION_REASON_REQUIRED", "RECEIPT_TOKEN_INVALID"
  ].find((code) => message.includes(code));
  const translated = {
    IDEMPOTENCY_CONFLICT: "Təkrar sorğu əvvəlki sifarişlə uyğun deyil.",
    PAYMENT_METHOD_UNAVAILABLE: "Ödəniş üsulu artıq əlçatan deyil.",
    PAYMENT_METHOD_LIMIT_REACHED: "Kart gündəlik limitdədir.",
    RESERVATION_NOT_FOUND: "Ödəniş rezervi tapılmadı.",
    RESERVATION_EXPIRED: "10 dəqiqəlik ödəniş rezervinin vaxtı bitib.",
    ORDER_NOT_FOUND: "Sifariş tapılmadı.",
    ORDER_NOT_REVIEWABLE: "Bu sifariş artıq yoxlanıla bilməz.",
    ORDER_ALREADY_APPROVED: "Təsdiqlənmiş sifariş rədd edilə bilməz.",
    REJECTION_REASON_REQUIRED: "Rədd səbəbini yazın.",
    RECEIPT_TOKEN_INVALID: "Yeni çek keçidi etibarsızdır, istifadə edilib və ya vaxtı bitib."
  }[known];
  const result = new Error(translated || fallback);
  result.code = known || "PAYMENT_STORE_ERROR";
  result.status = known?.includes("NOT_FOUND") ? 404 : known ? 409 : 500;
  result.cause = error;
  result.diagnostic = safeText([
    error?.code,
    error?.message,
    error?.details,
    error?.hint
  ].filter(Boolean).join(" · "), 1000);
  return result;
}

function rowMethod(row, stats = {}) {
  const confirmed = Number(stats.confirmed || 0);
  const pending = Number(stats.pending || 0);
  const unlimited = row.limit_mode === "unlimited";
  const remaining = unlimited ? null : Math.max(0, Number(row.daily_limit) - confirmed - pending);
  return {
    id: row.id,
    stableCode: row.stable_code,
    displayName: row.display_name,
    type: row.method_type,
    providerName: row.provider_name,
    holderName: row.holder_name,
    maskedNumber: maskedPaymentNumber(row.last4),
    last4: row.last4,
    color: row.color,
    icon: row.icon,
    active: row.active,
    archived: row.archived,
    order: row.sort_order,
    dailyLimit: row.daily_limit,
    limitMode: row.limit_mode,
    confirmedToday: confirmed,
    pendingReservations: pending,
    remaining,
    available: row.active && !row.archived && Boolean(row.encrypted_number) && (unlimited || remaining > 0),
    hasNumber: Boolean(row.encrypted_number),
    adminNote: row.admin_note,
    updatedAt: row.updated_at
  };
}

export function createPaymentStore(config) {
  if (!config.supabaseUrl || !config.supabaseSecretKey) throw new Error("Supabase ödəniş konfiqurasiyası tamamlanmayıb.");
  const client = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  async function rpc(name, args = {}) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw paymentError(error);
    return data;
  }

  async function statsForMethods(methodIds) {
    if (!methodIds.length) return new Map();
    await rpc("expire_payment_reservations");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const [{ data: counters, error: counterError }, { data: reservations, error: reservationError }] = await Promise.all([
      client.from("payment_method_daily_counters").select("method_id,confirmed_count").eq("counter_date", today).in("method_id", methodIds),
      client.from("payment_reservations").select("method_id,status,expires_at").in("method_id", methodIds).in("status", ["reserved", "reviewing"])
    ]);
    if (counterError) throw paymentError(counterError);
    if (reservationError) throw paymentError(reservationError);
    const stats = new Map(methodIds.map((id) => [id, { confirmed: 0, pending: 0 }]));
    for (const row of counters || []) stats.get(row.method_id).confirmed = Number(row.confirmed_count || 0);
    for (const row of reservations || []) {
      if (row.status === "reviewing" || new Date(row.expires_at).getTime() > Date.now()) stats.get(row.method_id).pending += 1;
    }
    return stats;
  }

  async function listMethods({ includeArchived = false } = {}) {
    let query = client.from("payment_methods").select("*").order("sort_order", { ascending: true });
    if (!includeArchived) query = query.eq("archived", false);
    const { data, error } = await query;
    if (error) throw paymentError(error);
    const stats = await statsForMethods((data || []).map((item) => item.id));
    return (data || []).map((item) => rowMethod(item, stats.get(item.id)));
  }

  async function normalizeMethodOrder(movedId, requestedOrder) {
    const { data, error } = await client.from("payment_methods").select("id,sort_order").eq("archived", false).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    if (error) throw paymentError(error);
    const ordered = (data || []).filter((item) => item.id !== movedId);
    const moved = (data || []).find((item) => item.id === movedId);
    if (!moved) return;
    const target = Math.max(0, Math.min(ordered.length, (Number(requestedOrder) || ordered.length + 1) - 1));
    ordered.splice(target, 0, moved);
    for (let index = 0; index < ordered.length; index += 1) {
      if (Number(ordered[index].sort_order) === index + 1) continue;
      const { error: updateError } = await client.from("payment_methods").update({ sort_order: index + 1, updated_at: new Date().toISOString() }).eq("id", ordered[index].id);
      if (updateError) throw paymentError(updateError);
    }
  }

  async function audit(actor, action, entityType, entityId, metadata = {}) {
    const { error } = await client.from("payment_audit_log").insert({
      actor_type: actor === "system" ? "system" : "admin",
      actor_ref: safeText(actor, 120),
      action: safeText(action, 120),
      entity_type: safeText(entityType, 80),
      entity_id: safeText(entityId, 160),
      metadata
    });
    if (error) throw paymentError(error);
  }

  return {
    client,
    rpc,
    async publicMethods() {
      return (await listMethods()).filter((method) => method.active && !method.archived).map(({ adminNote, ...method }) => ({ ...method, adminNote: undefined }));
    },
    adminMethods() {
      return listMethods({ includeArchived: true });
    },
    async rawMethod(id) {
      const { data, error } = await client.from("payment_methods").select("*").eq("id", id).single();
      if (error) throw paymentError(error, "Ödəniş üsulu tapılmadı.");
      return data;
    },
    async createMethod(input, encryptedNumber, actor = "admin") {
      const number = normalizePaymentNumber(input.fullNumber);
      const row = {
        id: crypto.randomUUID(),
        stable_code: safeText(input.stableCode || `${input.providerName}-${Date.now()}`, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, ""),
        display_name: safeText(input.displayName, 80),
        method_type: input.type === "wallet" ? "wallet" : "bank_card",
        provider_name: safeText(input.providerName, 80),
        holder_name: safeText(input.holderName, 120),
        encrypted_number: encryptedNumber || null,
        last4: number.slice(-4),
        color: safeColor(input.color),
        icon: ["card", "wallet", "bank"].includes(input.icon) ? input.icon : "card",
        active: Boolean(input.active && encryptedNumber),
        sort_order: Math.max(1, Number(input.order) || 1),
        daily_limit: Math.max(1, Math.min(10000, Number(input.dailyLimit) || 5)),
        limit_mode: input.limitMode === "unlimited" ? "unlimited" : "limited",
        admin_note: safeMultiline(input.adminNote, 2000)
      };
      if (!row.display_name || !row.provider_name || !/^[0-9]{4}$/.test(row.last4)) throw Object.assign(new Error("Ödəniş üsulunun məcburi sahələrini doldurun."), { status: 400 });
      const { data, error } = await client.from("payment_methods").insert(row).select("*").single();
      if (error) throw paymentError(error);
      await normalizeMethodOrder(data.id, row.sort_order);
      await audit(actor, "method.created", "payment_method", data.id, { providerName: row.provider_name, last4: row.last4 });
      return rowMethod(await this.rawMethod(data.id));
    },
    async updateMethod(id, input, encryptedNumber, actor = "admin") {
      if (!safeUuid(id)) throw Object.assign(new Error("Ödəniş üsulu ID-si düzgün deyil."), { status: 400 });
      const patch = {
        display_name: safeText(input.displayName, 80),
        method_type: input.type === "wallet" ? "wallet" : "bank_card",
        provider_name: safeText(input.providerName, 80),
        holder_name: safeText(input.holderName, 120),
        color: safeColor(input.color),
        icon: ["card", "wallet", "bank"].includes(input.icon) ? input.icon : "card",
        sort_order: Math.max(1, Number(input.order) || 1),
        daily_limit: Math.max(1, Math.min(10000, Number(input.dailyLimit) || 5)),
        limit_mode: input.limitMode === "unlimited" ? "unlimited" : "limited",
        admin_note: safeMultiline(input.adminNote, 2000),
        updated_at: new Date().toISOString()
      };
      if (encryptedNumber) {
        const number = normalizePaymentNumber(input.fullNumber);
        patch.encrypted_number = encryptedNumber;
        patch.last4 = number.slice(-4);
      }
      const current = await this.rawMethod(id);
      patch.active = Boolean(input.active && (encryptedNumber || current.encrypted_number));
      const { data, error } = await client.from("payment_methods").update(patch).eq("id", id).select("*").single();
      if (error) throw paymentError(error);
      await normalizeMethodOrder(data.id, patch.sort_order);
      await audit(actor, "method.updated", "payment_method", data.id, { numberChanged: Boolean(encryptedNumber), active: patch.active });
      return rowMethod(await this.rawMethod(data.id));
    },
    async archiveMethod(id, actor = "admin") {
      const { error } = await client.from("payment_methods").update({ active: false, archived: true, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw paymentError(error);
      await audit(actor, "method.archived", "payment_method", id);
    },
    async resetMethodCounter(id, actor) {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const { error } = await client.from("payment_method_daily_counters").upsert({ method_id: id, counter_date: today, confirmed_count: 0, updated_at: new Date().toISOString() });
      if (error) throw paymentError(error);
      await client.from("payment_audit_log").insert({ actor_type: "admin", actor_ref: actor, action: "method.counter_reset", entity_type: "payment_method", entity_id: id });
    },
    async reserve(args) {
      return rpc("reserve_payment_method", {
        p_method_id: args.methodId,
        p_product_id: args.productId,
        p_plan_id: args.planId,
        p_amount: args.amount,
        p_currency: "AZN",
        p_idempotency_key: args.idempotencyKey,
        p_minutes: config.reservationMinutes
      });
    },
    async submitOrder(args) {
      return rpc("submit_payment_order", {
        p_order_code: args.orderCode,
        p_reservation_id: args.reservationId,
        p_product_title: args.productTitle,
        p_plan_name: args.planName,
        p_receipt_bucket: args.receiptBucket,
        p_receipt_path: args.receiptPath,
        p_receipt_mime: args.receiptMime,
        p_receipt_size: args.receiptSize,
        p_receipt_sha256: args.receiptSha256
      });
    },
    async listOrders() {
      const { data, error } = await client.from("payment_orders").select("*,payment_methods(display_name,last4,provider_name),payment_reservations(status,expires_at)").order("created_at", { ascending: false }).limit(200);
      if (error) throw paymentError(error);
      const orders = data || [];
      if (!orders.length) return orders;
      const { data: auditRows, error: auditError } = await client.from("payment_audit_log").select("entity_id,actor_type,actor_ref,action,metadata,created_at").eq("entity_type", "order").in("entity_id", orders.map((item) => item.id)).order("created_at", { ascending: false });
      if (auditError) throw paymentError(auditError);
      const history = new Map();
      for (const row of auditRows || []) {
        if (!history.has(row.entity_id)) history.set(row.entity_id, []);
        history.get(row.entity_id).push(row);
      }
      return orders.map((order) => ({ ...order, audit_history: history.get(order.id) || [] }));
    },
    async getOrder(id) {
      let query = client.from("payment_orders").select("*,payment_methods(display_name,last4,provider_name),payment_reservations(status,expires_at)");
      query = safeUuid(id) ? query.eq("id", id) : query.eq("order_code", safeText(id, 20).toUpperCase());
      const { data, error } = await query.single();
      if (error) throw paymentError(error, "Sifariş tapılmadı.");
      return data;
    },
    async getOrderByReservation(reservationId) {
      const { data, error } = await client.from("payment_orders").select("*").eq("reservation_id", reservationId).maybeSingle();
      if (error) throw paymentError(error);
      return data || null;
    },
    approveOrder(id, actor) { return rpc("approve_payment_order", { p_order_id: id, p_actor: actor }); },
    rejectOrder(id, reason, actor) { return rpc("reject_payment_order", { p_order_id: id, p_reason: reason, p_actor: actor }); },
    cancelReservation(id, actor) { return rpc("cancel_payment_reservation", { p_reservation_id: id, p_actor: actor }); },
    async requestNewReceipt(id, actor, note) {
      const { data, error } = await client.from("payment_orders").update({ status: "new_receipt_requested", admin_note: safeMultiline(note, 4000), updated_at: new Date().toISOString() }).eq("id", id).eq("status", "reviewing").select("id,order_code,status").single();
      if (error) throw paymentError(error);
      await client.from("payment_audit_log").insert({ actor_type: "admin", actor_ref: actor, action: "order.new_receipt_requested", entity_type: "order", entity_id: id });
      return data;
    },
    async updateOrderNote(id, actor, note) {
      const value = safeMultiline(note, 4000);
      const { data, error } = await client.from("payment_orders").update({ admin_note: value, updated_at: new Date().toISOString() }).eq("id", id).select("id,order_code,admin_note").single();
      if (error) throw paymentError(error);
      await audit(actor, "order.note_updated", "order", id, { hasNote: Boolean(value) });
      return data;
    },
    async createReviewToken(orderId, tokenHash, expiresAt) {
      const { error } = await client.from("payment_review_tokens").insert({ order_id: orderId, token_hash: tokenHash, expires_at: expiresAt });
      if (error) throw paymentError(error);
    },
    async createReceiptToken(orderId, tokenHash, expiresAt) {
      const { error } = await client.from("payment_receipt_tokens").insert({ order_id: orderId, token_hash: tokenHash, expires_at: expiresAt });
      if (error) throw paymentError(error);
    },
    async replaceReceipt(args) {
      return rpc("replace_payment_order_receipt", {
        p_token_hash: args.tokenHash,
        p_receipt_bucket: args.receiptBucket,
        p_receipt_path: args.receiptPath,
        p_receipt_mime: args.receiptMime,
        p_receipt_size: args.receiptSize,
        p_receipt_sha256: args.receiptSha256
      });
    },
    async consumeReviewToken(tokenHash) {
      try {
        return await rpc("consume_payment_review_token", { p_token_hash: tokenHash });
      } catch {
        throw Object.assign(new Error("Yoxlama keçidi etibarsızdır, istifadə edilib və ya vaxtı bitib."), { status: 410 });
      }
    },
    async enqueueEmail(row) {
      const { error } = await client.from("payment_email_queue").insert(row);
      if (error) throw paymentError(error);
    },
    async claimEmail() {
      const data = await rpc("claim_payment_email");
      return Array.isArray(data) ? data[0] || null : data || null;
    },
    async emailSent(id) {
      await client.from("payment_email_queue").update({ status: "sent", sent_at: new Date().toISOString(), locked_at: null, last_error: "", updated_at: new Date().toISOString() }).eq("id", id);
    },
    async emailFailed(id, error, attempts) {
      const delayMinutes = Math.min(60, 2 ** Math.min(6, Number(attempts) || 1));
      await client.from("payment_email_queue").update({ status: "failed", locked_at: null, last_error: safeText(error, 1000), next_attempt_at: new Date(Date.now() + delayMinutes * 60000).toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    },
    async retryEmail(id, actor = "admin") {
      const { error } = await client.from("payment_email_queue").update({ status: "pending", next_attempt_at: new Date().toISOString(), locked_at: null, last_error: "", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw paymentError(error);
      await audit(actor, "email.retry_queued", "payment_email", id);
    },
    async pendingEmails() {
      const { data, error } = await client.from("payment_email_queue").select("id,order_id,recipient,status,attempts,next_attempt_at,last_error,created_at,sent_at").order("created_at", { ascending: false }).limit(100);
      if (error) throw paymentError(error);
      return data || [];
    },
    async signedReceipt(path, expiresIn = 300, actor = "admin", orderId = "") {
      const { data, error } = await client.storage.from(config.receiptsBucket).createSignedUrl(path, expiresIn);
      if (error) throw paymentError(error, "Çek üçün təhlükəsiz keçid yaradılmadı.");
      await audit(actor, "receipt.signed_url_created", "order", orderId || "unknown", { expiresIn });
      return data.signedUrl;
    },
    async uploadReceipt(path, receipt) {
      const { error } = await client.storage.from(config.receiptsBucket).upload(path, receipt.buffer, { contentType: receipt.mimeType, upsert: false, cacheControl: "0" });
      if (error) throw paymentError(error, "Çek private yaddaşa yüklənmədi.");
    },
    async removeReceipt(path) {
      await client.storage.from(config.receiptsBucket).remove([path]);
    },
    async rateLimit(key, seconds, maxHits) {
      const result = await rpc("consume_payment_rate_limit", { p_rate_key: key, p_window_seconds: seconds, p_max_hits: maxHits });
      if (!result?.allowed) throw Object.assign(new Error("Çox sayda sorğu göndərilib. Bir qədər sonra yenidən cəhd edin."), { status: 429 });
      return result;
    },
    async getSettings() {
      const { data, error } = await client.from("payment_settings").select("notification_email,receipt_retention_days,updated_at").eq("id", true).single();
      if (error) throw paymentError(error);
      return {
        notificationEmail: data.notification_email,
        receiptRetentionDays: data.receipt_retention_days,
        updatedAt: data.updated_at
      };
    },
    async updateSettings(input, actor = "admin") {
      const email = safeText(input.notificationEmail, 320).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error("Bildiriş e-poçtu düzgün deyil."), { status: 400 });
      const row = {
        id: true,
        notification_email: email,
        receipt_retention_days: Math.max(1, Math.min(3650, Number(input.receiptRetentionDays) || 90)),
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from("payment_settings").upsert(row);
      if (error) throw paymentError(error);
      await audit(actor, "settings.updated", "payment_settings", "global", { receiptRetentionDays: row.receipt_retention_days, notificationEmailChanged: true });
      return this.getSettings();
    },
    async cleanupExpiredReceipts() {
      const settings = await this.getSettings();
      const cutoff = new Date(Date.now() - settings.receiptRetentionDays * 86400000).toISOString();
      const { data, error } = await client.from("payment_orders").select("id,receipt_path").in("status", ["approved", "rejected"]).is("receipt_deleted_at", null).lt("updated_at", cutoff).limit(50);
      if (error) throw paymentError(error);
      if (!data?.length) return 0;
      await client.storage.from(config.receiptsBucket).remove(data.map((item) => item.receipt_path));
      const ids = data.map((item) => item.id);
      const { error: updateError } = await client.from("payment_orders").update({ receipt_deleted_at: new Date().toISOString() }).in("id", ids);
      if (updateError) throw paymentError(updateError);
      return ids.length;
    }
  };
}
