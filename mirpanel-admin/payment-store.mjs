import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { boundedReadFetch } from "./bounded-read-fetch.mjs";
import {
  maskedPaymentNumber,
  normalizePaymentNumber,
  safeColor,
  safeMultiline,
  safeText,
  safeUuid
} from "./payment-security.mjs";
import {
  adminOrderStatus,
  normalizeOrderListParams,
  orderDatabaseStatuses,
  paymentMethodLabel
} from "./payment-order-query.mjs";
import { bakuDayBounds, expiryStatus } from "./payment-order-lifecycle.mjs";
import { normalizeFinancialStatistics } from "./payment-order-report.mjs";
import { catalogCostRows, centsToDecimal, parseMoneyCents, planKey } from "./payment-profit.mjs";

function paymentError(error, fallback = "Ödəniş məlumatı işlənmədi.") {
  const message = String(error?.message || fallback);
  const known = [
    "IDEMPOTENCY_CONFLICT", "PAYMENT_METHOD_UNAVAILABLE", "PAYMENT_METHOD_LIMIT_REACHED", "PAYMENT_METHOD_TEMPORARILY_BUSY",
    "RESERVATION_NOT_FOUND", "RESERVATION_EXPIRED", "ORDER_NOT_FOUND", "ORDER_NOT_REVIEWABLE",
    "ORDER_ALREADY_APPROVED", "REJECTION_REASON_REQUIRED", "RECEIPT_TOKEN_INVALID",
    "CHECKOUT_KEY_REQUIRED", "ACTIVE_RESERVATION_EXISTS", "RESERVATION_ALREADY_SUBMITTED",
    "RESERVATION_CHECKOUT_MISMATCH", "PAYMENT_METHOD_HAS_ACTIVE_RESERVATIONS",
    "PAYMENT_METHOD_NOT_FOUND", "PAYMENT_METHOD_NUMBER_REQUIRED", "ORDER_NOT_COMPLETED", "INVALID_PLAN_DURATION",
    "INVALID_COST_BATCH", "INVALID_COST_KEY", "INVALID_COST_AMOUNT"
  ].find((code) => message.includes(code));
  const translated = {
    IDEMPOTENCY_CONFLICT: "Təkrar sorğu əvvəlki sifarişlə uyğun deyil.",
    PAYMENT_METHOD_UNAVAILABLE: "Ödəniş üsulu artıq əlçatan deyil.",
    PAYMENT_METHOD_LIMIT_REACHED: "Kart gündəlik limitdədir.",
    PAYMENT_METHOD_TEMPORARILY_BUSY: "Kart müvəqqəti rezervlərlə tutulub. Bir qədər sonra yenidən cəhd edin.",
    RESERVATION_NOT_FOUND: "Ödəniş rezervi tapılmadı.",
    RESERVATION_EXPIRED: "10 dəqiqəlik ödəniş rezervinin vaxtı bitib.",
    ORDER_NOT_FOUND: "Sifariş tapılmadı.",
    ORDER_NOT_REVIEWABLE: "Bu sifariş artıq yoxlanıla bilməz.",
    ORDER_ALREADY_APPROVED: "Təsdiqlənmiş sifariş rədd edilə bilməz.",
    REJECTION_REASON_REQUIRED: "Rədd səbəbini yazın.",
    RECEIPT_TOKEN_INVALID: "Yeni çek keçidi etibarsızdır, istifadə edilib və ya vaxtı bitib.",
    CHECKOUT_KEY_REQUIRED: "Təhlükəsiz ödəniş sessiyası yaradılmadı.",
    ACTIVE_RESERVATION_EXISTS: "Bu ödəniş sessiyasında artıq aktiv rezerv var.",
    RESERVATION_ALREADY_SUBMITTED: "Bu rezerv üzrə çek artıq göndərilib.",
    RESERVATION_CHECKOUT_MISMATCH: "Rezerv bu ödəniş sessiyasına aid deyil.",
    PAYMENT_METHOD_HAS_ACTIVE_RESERVATIONS: "Bu kartda aktiv rezerv var. Əvvəlcə kartı deaktiv edin və rezervlərin tamamlanmasını gözləyin.",
    PAYMENT_METHOD_NOT_FOUND: "Ödəniş üsulu tapılmadı.",
    PAYMENT_METHOD_NUMBER_REQUIRED: "Kartı aktivləşdirmək üçün tam nömrəni daxil edin.",
    ORDER_NOT_COMPLETED: "Yalnız tamamlanmış sifariş üçün əlaqə statusu dəyişdirilə bilər.",
    INVALID_PLAN_DURATION: "Planın strukturlaşdırılmış müddəti düzgün deyil.",
    INVALID_COST_BATCH: "Maya dəyəri siyahısı düzgün deyil.",
    INVALID_COST_KEY: "Məhsul və ya plan açarı düzgün deyil.",
    INVALID_COST_AMOUNT: "Maya dəyəri düzgün məbləğ deyil."
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

const PAYMENT_THEMES = new Set(["auto", "leo", "abb", "kapital", "m10", "neutral"]);

function paymentTheme(value, providerName, methodType) {
  const selected = PAYMENT_THEMES.has(value) ? value : "auto";
  if (selected !== "auto") return selected;
  const provider = String(providerName || "").toLocaleLowerCase("az-AZ");
  if (provider.includes("leo")) return "leo";
  if (provider.includes("abb")) return "abb";
  if (provider.includes("kapital")) return "kapital";
  if (provider.includes("m10") || methodType === "wallet") return "m10";
  return "neutral";
}

export function rowMethod(row, stats = {}) {
  const confirmed = Number(stats.confirmed || 0);
  const activeReservations = Number(stats.activeReservations || 0);
  const reviewingReceipts = Number(stats.reviewingReceipts || 0);
  const pending = activeReservations + reviewingReceipts;
  const unlimited = row.limit_mode === "unlimited";
  const remaining = unlimited ? null : Math.max(0, Number(row.daily_limit) - confirmed - pending);
  const status = row.deleted_at || row.archived ? "deleted" :
    row.manual_disabled ? "inactive" :
    (!unlimited && confirmed >= Number(row.daily_limit)) ? "limit_reached" :
    row.active ? ((!unlimited && remaining <= 0) ? "temporarily_busy" : "active") : "pending";
  return {
    id: row.id,
    stableCode: row.stable_code,
    displayName: row.display_name,
    type: row.method_type,
    providerName: row.provider_name,
    holderName: row.holder_name,
    maskedNumber: maskedPaymentNumber(row.last4),
    adminMaskedNumber: maskedPaymentNumber(row.last4),
    last4: row.last4,
    color: row.color,
    icon: row.icon,
    theme: PAYMENT_THEMES.has(row.theme) ? row.theme : "auto",
    resolvedTheme: paymentTheme(row.theme, row.provider_name, row.method_type),
    active: row.active,
    activatedToday: Boolean(row.activated_today),
    archived: row.archived,
    deletedAt: row.deleted_at || null,
    manualDisabled: Boolean(row.manual_disabled),
    autoPriority: Number(row.auto_priority || 1000),
    deactivatedAt: row.deactivated_at || null,
    order: row.sort_order,
    dailyLimit: row.daily_limit,
    limitMode: row.limit_mode,
    confirmedToday: confirmed,
    activeReservations,
    reviewingReceipts,
    occupiedToday: confirmed + pending,
    pendingReservations: pending,
    lastResetAt: stats.lastResetAt || null,
    nextResetAt: stats.nextResetAt || null,
    remaining,
    status,
    available: status === "active" && Boolean(row.encrypted_number) && (unlimited || remaining > 0),
    hasNumber: Boolean(row.encrypted_number),
    adminNote: row.admin_note,
    updatedAt: row.updated_at
  };
}

export function createPaymentStore(config) {
  if (!config.supabaseUrl || !config.supabaseSecretKey) throw new Error("Supabase ödəniş konfiqurasiyası tamamlanmayıb.");
  const client = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    global: { fetch: (input, init = {}) => {
      const url = String(input?.url || input);
      const checkoutWrite = url.endsWith("/rpc/submit_payment_order_v2") || url.includes("/storage/v1/object/");
      if (!checkoutWrite) return boundedReadFetch(input, init);
      const timeout = AbortSignal.timeout(25000);
      return fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
    } },
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
      client.from("payment_method_daily_counters").select("method_id,confirmed_count,updated_at").eq("counter_date", today).in("method_id", methodIds),
      client.from("payment_reservations").select("method_id,status,expires_at,usage_day").eq("usage_day", today).in("method_id", methodIds).in("status", ["reserved", "reviewing"])
    ]);
    if (counterError) throw paymentError(counterError);
    if (reservationError) throw paymentError(reservationError);
    const resetAt = `${today}T00:00:00+04:00`;
    const nextResetAt = new Date(new Date(resetAt).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const stats = new Map(methodIds.map((id) => [id, { confirmed: 0, activeReservations: 0, reviewingReceipts: 0, lastResetAt: resetAt, nextResetAt }]));
    for (const row of counters || []) {
      stats.get(row.method_id).confirmed = Number(row.confirmed_count || 0);
      stats.get(row.method_id).lastResetAt = resetAt;
    }
    for (const row of reservations || []) {
      if (row.status === "reviewing") stats.get(row.method_id).reviewingReceipts += 1;
      else if (new Date(row.expires_at).getTime() > Date.now()) stats.get(row.method_id).activeReservations += 1;
    }
    return stats;
  }

  async function listMethods({ includeArchived = false, includeDeleted = false } = {}) {
    const data = await rpc("payment_method_queue_snapshot", {
      p_include_archived: includeArchived, p_include_deleted: includeDeleted
    });
    return (data || []).map((item) => rowMethod(item, item.queue_stats));
  }

  async function normalizeMethodOrder(movedId, requestedOrder) {
    const { data, error } = await client.from("payment_methods").select("id,sort_order").eq("archived", false).is("deleted_at", null).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
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
      return (await listMethods()).filter((method) => !method.manualDisabled && method.hasNumber &&
        (method.active || (method.activatedToday && method.status === "limit_reached")))
        .map(({ adminNote, adminMaskedNumber, deletedAt, deactivatedAt, ...method }) => method);
    },
    adminMethods() {
      // Deleted cards stay in the audit trail only. They are not returned to
      // the operational admin list and cannot be restored through this API.
      return listMethods();
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
        theme: PAYMENT_THEMES.has(input.theme) ? input.theme : "auto",
        active: false, // Queue refresh selects at most four eligible methods.
        manual_disabled: false,
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
        theme: PAYMENT_THEMES.has(input.theme) ? input.theme : "auto",
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
      const active = Boolean(input.active && (encryptedNumber || current.encrypted_number));
      const updated = await rpc("update_payment_method_admin", {
        p_method_id: id,
        p_display_name: patch.display_name,
        p_method_type: patch.method_type,
        p_provider_name: patch.provider_name,
        p_holder_name: patch.holder_name,
        p_encrypted_number: encryptedNumber || null,
        p_last4: encryptedNumber ? normalizePaymentNumber(input.fullNumber).slice(-4) : null,
        p_color: patch.color,
        p_icon: patch.icon,
        p_theme: patch.theme,
        p_active: active,
        p_sort_order: patch.sort_order,
        p_daily_limit: patch.daily_limit,
        p_limit_mode: patch.limit_mode,
        p_admin_note: patch.admin_note,
        p_actor: actor
      });
      await normalizeMethodOrder(id, patch.sort_order);
      return rowMethod(await this.rawMethod(updated.id || id));
    },
    async archiveMethod(id, actor = "admin") {
      const { error } = await client.from("payment_methods").update({ active: false, deactivated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw paymentError(error);
      await audit(actor, "method.deactivated", "payment_method", id);
    },
    async setMethodActive(id, active, actor = "admin") {
      if (!safeUuid(id)) throw Object.assign(new Error("Ödəniş üsulu ID-si düzgün deyil."), { status: 400 });
      return rpc("set_payment_method_active_admin", { p_method_id: id, p_active: Boolean(active), p_actor: actor });
    },
    async deleteMethod(id, actor = "admin") {
      if (!safeUuid(id)) throw Object.assign(new Error("Ödəniş üsulu ID-si düzgün deyil."), { status: 400 });
      return rpc("delete_payment_method_safely", { p_method_id: id, p_actor: actor });
    },
    async resetMethodCounter(id, actor) {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const { error } = await client.from("payment_method_daily_counters").upsert({ method_id: id, counter_date: today, confirmed_count: 0, updated_at: new Date().toISOString() });
      if (error) throw paymentError(error);
      await client.from("payment_audit_log").insert({ actor_type: "admin", actor_ref: actor, action: "method.counter_reset", entity_type: "payment_method", entity_id: id });
    },
    async reserve(args) {
      return rpc("reserve_payment_method_v3", {
        p_method_id: args.methodId,
        p_product_id: args.productId,
        p_plan_id: args.planId,
        p_amount: args.amount,
        p_currency: "AZN",
        p_idempotency_key: args.idempotencyKey,
        p_checkout_key: args.checkoutKey,
        p_previous_reservation_id: args.previousReservationId || null,
        p_minutes: config.reservationMinutes
      });
    },
    async submitOrder(args) {
      const submitted = await rpc("submit_payment_order_v2", {
        p_reservation_id: args.reservationId,
        p_checkout_key: args.checkoutKey,
        p_product_id: args.productId,
        p_plan_id: args.planId,
        p_product_title: args.productTitle,
        p_plan_name: args.planName,
        p_receipt_bucket: args.receiptBucket,
        p_receipt_path: args.receiptPath,
        p_receipt_mime: args.receiptMime,
        p_receipt_size: args.receiptSize,
        p_receipt_sha256: args.receiptSha256,
        p_duration_months: args.durationMonths || null
      });
      return submitted;
    },
    async checkoutReservation(reservationId, checkoutKey) {
      const { data, error } = await client.from("payment_reservations").select("id,checkout_key,product_id,plan_id,amount,currency,status,expires_at,method_id")
        .eq("id", reservationId).eq("checkout_key", checkoutKey).maybeSingle();
      if (error) throw paymentError(error);
      if (!data) throw Object.assign(new Error("Rezerv bu ödəniş sessiyasına aid deyil."), { status: 404 });
      return data;
    },
    async planCosts(catalog) {
      const { data, error } = await client.from("payment_plan_costs")
        .select("product_id,plan_id,cost_amount,updated_at")
        .order("product_id", { ascending: true });
      if (error) throw paymentError(error);
      return catalogCostRows(catalog, data || []);
    },
    async savePlanCosts(items, catalog, actor = "admin") {
      const valid = new Set((catalog?.products || []).flatMap((product) =>
        (product.plans || []).map((plan, index) => `${product.id}:${planKey(plan, index)}`)));
      const normalized = items.map((item) => {
        const productId = safeText(item.productId, 100);
        const planId = safeText(item.planId, 100);
        if (!valid.has(`${productId}:${planId}`)) throw Object.assign(new Error("Məhsul və ya plan artıq mövcud deyil."), { status: 409 });
        const cents = parseMoneyCents(item.cost);
        return { productId, planId, cost: centsToDecimal(cents) };
      });
      return rpc("save_payment_plan_costs", { p_items: normalized, p_actor: actor });
    },
    async monthlyReports() {
      // This is deliberately called on an ordinary admin read. If Render was
      // asleep at midnight, the first authenticated request creates each
      // missing closed-month snapshot once, without touching any order.
      await rpc("archive_due_payment_monthly_reports");
      const [current, { data: archives, error: archiveError }] = await Promise.all([
        rpc("current_payment_month_report"),
        client.from("payment_monthly_reports")
          .select("month_start,completed_count,revenue,cost,profit,missing_cost_count,top_product,products,payment_methods,archived_at")
          .order("month_start", { ascending: false })
      ]);
      if (archiveError) throw paymentError(archiveError);
      const normalize = (item = {}) => ({
        monthStart: item.monthStart || item.month_start,
        completedCount: Number(item.completedCount ?? item.completed_count ?? 0),
        revenue: Number(item.revenue || 0), cost: Number(item.cost || 0), profit: Number(item.profit || 0),
        missingCostCount: Number(item.missingCostCount ?? item.missing_cost_count ?? 0),
        topProduct: item.topProduct || item.top_product || "—",
        products: item.products || [], paymentMethods: item.paymentMethods || item.payment_methods || [],
        archivedAt: item.archivedAt || item.archived_at || null
      });
      return { current: normalize(current || {}), archives: (archives || []).map(normalize) };
    },
    async listOrders(input = {}) {
      await rpc("archive_due_payment_monthly_reports");
      const filters = normalizeOrderListParams(input);
      const todayBounds = bakuDayBounds(filters.today);
      const select = "id,order_code,product_id,product_title,plan_id,plan_name,amount,currency,status,created_at,updated_at,approved_at,completed_at,duration_months,service_expires_on,expiry_notification_on,contacted_at,method_name_snapshot,method_last4_snapshot,sale_price_snapshot,cost_price_snapshot,profit_snapshot,profit_margin_snapshot,cost_source,cost_backfilled_at,receipt_deleted_at,payment_methods(display_name,last4,provider_name),payment_reservations(status,expires_at)";

      const applyCommonFilters = (query, dateColumn = "completed_at") => {
        let next = query;
        if (filters.search) next = next.ilike("order_code", `%${filters.search}%`);
        if (filters.productId) next = next.eq("product_id", filters.productId);
        if (filters.planName) next = next.eq("plan_name", filters.planName);
        if (filters.methodId) next = next.eq("method_id", filters.methodId);
        if (filters.dateFrom) next = next.gte(dateColumn, `${filters.dateFrom}T00:00:00+04:00`);
        if (filters.dateTo) next = next.lt(dateColumn, bakuDayBounds(filters.dateTo).endExclusive);
        return next;
      };

      let query = applyCommonFilters(client.from("payment_orders").select(select, { count: "exact" }), filters.tab === "pending" ? "created_at" : "completed_at");
      const statuses = orderDatabaseStatuses(filters);
      query = query.in("status", statuses);
      if (filters.tab === "today") query = query.gte("completed_at", todayBounds.start).lt("completed_at", todayBounds.endExclusive);
      if (filters.tab === "expiring") query = query.is("contacted_at", null).not("expiry_notification_on", "is", null).lte("expiry_notification_on", filters.today);
      const from = (filters.page - 1) * filters.pageSize;
      query = query
        .order(filters.tab === "pending" ? "created_at" : "completed_at", { ascending: filters.sort === "oldest" })
        .range(from, from + filters.pageSize - 1);

      const countStatus = async (statusValues, mutate = (value) => value) => {
        let countQuery = client.from("payment_orders").select("id", { count: "exact", head: true }).in("status", statusValues);
        countQuery = mutate(countQuery);
        const { count, error } = await countQuery;
        if (error) throw paymentError(error);
        return Number(count || 0);
      };

      const [{ data, error, count }, pendingCount, todayCount, completedCount, expiringCount, productRows, methodRows, statistics] = await Promise.all([
        query,
        countStatus(["reviewing", "new_receipt_requested"]),
        countStatus(["approved", "completed"], (value) => value.gte("completed_at", todayBounds.start).lt("completed_at", todayBounds.endExclusive)),
        countStatus(["approved", "completed"]),
        countStatus(["approved", "completed"], (value) => value.is("contacted_at", null).not("expiry_notification_on", "is", null).lte("expiry_notification_on", filters.today)),
        client.from("payment_orders").select("product_id,product_title,plan_name").order("product_title", { ascending: true }).limit(5000),
        client.from("payment_methods").select("id,display_name,provider_name,last4,archived").order("sort_order", { ascending: true }),
        rpc("payment_order_profit_statistics_v2", {
          p_tab: filters.tab,
          p_search: filters.search || null,
          p_product_id: filters.productId || null,
          p_plan_name: filters.planName || null,
          p_method_id: filters.methodId || null,
          p_date_from: filters.dateFrom || null,
          p_date_to: filters.dateTo || null,
          p_today: filters.today
        })
      ]);
      if (error) throw paymentError(error);
      if (productRows.error) throw paymentError(productRows.error);
      if (methodRows.error) throw paymentError(methodRows.error);

      const orders = data || [];
      const history = new Map();
      if (orders.length) {
        const { data: auditRows, error: auditError } = await client.from("payment_audit_log")
          .select("entity_id,actor_type,action,created_at")
          .eq("entity_type", "order")
          .in("entity_id", orders.map((item) => item.id))
          .order("created_at", { ascending: false });
        if (auditError) throw paymentError(auditError);
        for (const row of auditRows || []) {
          if (!history.has(row.entity_id)) history.set(row.entity_id, []);
          history.get(row.entity_id).push(row);
        }
      }

      const products = new Map();
      const plans = new Set();
      for (const row of productRows.data || []) {
        if (row.product_id && !products.has(row.product_id)) products.set(row.product_id, row.product_title);
        if (row.plan_name) plans.add(row.plan_name);
      }
      const total = Number(count || 0);
      return {
        orders: orders.map((order) => {
          const method = Array.isArray(order.payment_methods) ? order.payment_methods[0] || {} : order.payment_methods || {};
          const reservation = Array.isArray(order.payment_reservations) ? order.payment_reservations[0] || {} : order.payment_reservations || {};
          return {
            id: order.id,
            orderCode: order.order_code,
            productId: order.product_id,
            productTitle: order.product_title,
            planId: order.plan_id,
            planName: order.plan_name,
            amount: Number(order.amount),
            salePriceSnapshot: order.sale_price_snapshot === null ? Number(order.amount) : Number(order.sale_price_snapshot),
            costPriceSnapshot: order.cost_price_snapshot === null ? null : Number(order.cost_price_snapshot),
            profitSnapshot: order.profit_snapshot === null ? null : Number(order.profit_snapshot),
            profitMarginSnapshot: order.profit_margin_snapshot === null ? null : Number(order.profit_margin_snapshot),
            costSource: order.cost_source || null,
            costBackfilledAt: order.cost_backfilled_at || null,
            currency: order.currency,
            status: adminOrderStatus(order.status, reservation.status),
            reservationStatus: reservation.status || "",
            createdAt: order.created_at,
            completedAt: order.completed_at || order.approved_at || (adminOrderStatus(order.status, reservation.status) === "completed" ? order.updated_at : null),
            durationMonths: order.duration_months,
            expiresOn: order.service_expires_on,
            expiryNotificationOn: order.expiry_notification_on,
            expiry: expiryStatus(order.service_expires_on),
            contactedAt: order.contacted_at,
            receiptAvailable: !order.receipt_deleted_at,
            paymentMethodLabel: paymentMethodLabel({ ...method, method_name_snapshot: order.method_name_snapshot, method_last4_snapshot: order.method_last4_snapshot }),
            auditHistory: history.get(order.id) || []
          };
        }),
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / filters.pageSize))
        },
        counts: {
          pending: pendingCount,
          today: filters.tab === "today" ? total : todayCount,
          all: filters.tab === "all" ? total : completedCount,
          expiring: expiringCount
        },
        statistics: normalizeFinancialStatistics(statistics || { count: 0, revenue: 0, cost: 0, profit: 0, missingCostCount: 0, topProduct: "—", products: [], plans: [], days: [] }),
        appliedFilters: filters,
        filters: {
          products: [...products].map(([id, title]) => ({ id, title })),
          plans: [...plans].sort((a, b) => a.localeCompare(b, "az")),
          methods: (methodRows.data || []).map((method) => ({ id: method.id, label: paymentMethodLabel(method) }))
        }
      };
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
    approveOrder(id, durationMonths, actor) {
      return rpc("approve_payment_order_v6", {
        p_order_id: id,
        p_duration_months: durationMonths || null,
        p_actor: actor
      });
    },
    financeSnapshot() { return rpc("payment_finance_snapshot"); },
    costBackfillPreview() { return rpc("payment_cost_backfill_preview"); },
    applyCostBackfill(expectedCount, expectedDigest, actor) {
      return rpc("backfill_payment_order_cost_snapshots", {
        p_expected_count: Number(expectedCount),
        p_expected_digest: safeText(expectedDigest, 64),
        p_actor: actor
      });
    },
    rejectOrder(id, actor) { return rpc("reject_payment_order", { p_order_id: id, p_reason: "Admin tərəfindən rədd edildi.", p_actor: actor }); },
    contactOrder(id, actor) { return rpc("mark_payment_order_contacted", { p_order_id: id, p_actor: actor }); },
    cancelCustomerReservation(id, checkoutKey, actor) {
      return rpc("cancel_customer_payment_reservation", { p_reservation_id: id, p_checkout_key: checkoutKey, p_actor: actor });
    },
    async createReviewToken(orderId, tokenHash, expiresAt) {
      const { error } = await client.from("payment_review_tokens").insert({ order_id: orderId, token_hash: tokenHash, expires_at: expiresAt });
      if (error) throw paymentError(error);
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
      if (Number(error?.statusCode) === 409 && path.endsWith(`/${receipt.sha256}.${receipt.extension}`)) return;
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
