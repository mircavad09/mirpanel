import {orderLines} from './order-lines.mjs';
import crypto from "node:crypto";
import {adminListWindow} from './admin-list-window.mjs';
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
import { bakuDate, bakuDayBounds, expiryStatus } from "./payment-order-lifecycle.mjs";
import { normalizeFinancialStatistics } from "./payment-order-report.mjs";
import { durationOptions, durationStatistics, orderDuration } from "./payment-order-duration.mjs";
import { orderProductMatcher } from "./payment-order-product.mjs";
import { catalogCostRows, centsToDecimal, parseMoneyCents, planKey } from "./payment-profit.mjs";

export function paymentError(error, fallback = "Ödəniş məlumatı işlənmədi.") {
  const message = String(error?.message || fallback);
  const known = [
    "INVENTORY_EMPTY", "INVENTORY_SETUP_REQUIRED", "INVENTORY_RESERVATION_REQUIRED", "INVENTORY_VERSION_CONFLICT", "PLAN_INVENTORY_MANAGED_SEPARATELY", "INVALID_INVENTORY",
    "IDEMPOTENCY_CONFLICT", "PAYMENT_METHOD_UNAVAILABLE", "PAYMENT_METHOD_LIMIT_REACHED", "PAYMENT_METHOD_TEMPORARILY_BUSY",
    "RESERVATION_NOT_FOUND", "RESERVATION_EXPIRED", "ORDER_NOT_FOUND", "ORDER_NOT_REVIEWABLE",
    "ORDER_ALREADY_APPROVED", "REJECTION_REASON_REQUIRED", "RECEIPT_TOKEN_INVALID",
    "CHECKOUT_KEY_REQUIRED", "ACTIVE_RESERVATION_EXISTS", "RESERVATION_ALREADY_SUBMITTED",
    "RESERVATION_CHECKOUT_MISMATCH", "PAYMENT_METHOD_HAS_ACTIVE_RESERVATIONS",
    "PAYMENT_METHOD_NOT_FOUND", "PAYMENT_METHOD_NUMBER_REQUIRED", "ORDER_NOT_COMPLETED", "INVALID_PLAN_DURATION",
    "INVALID_COST_BATCH", "INVALID_COST_KEY", "INVALID_COST_AMOUNT", "CAPCUT_STOCK_EMPTY",
    "CAPCUT_DELIVERY_NOT_FOUND", "CAPCUT_ORDER_REQUIRED", "CAPCUT_ORDER_NOT_REVIEWABLE"
  ].find((code) => message.includes(code));
  const translated = {
    INVENTORY_EMPTY:"Stokda yoxdur.",INVENTORY_SETUP_REQUIRED:"Stok bazada təsdiqlənməyib. Admin yoxlaması tələb olunur.",INVENTORY_RESERVATION_REQUIRED:"Bu sifariş üçün stok rezerv edilməyib. Tamamlama bloklandı.",INVENTORY_VERSION_CONFLICT:"Stok dəyişib. Yeniləyib təkrar yoxlayın.",PLAN_INVENTORY_MANAGED_SEPARATELY:"Stok plan səviyyəsində idarə olunur; ümumi məhsul sayı yazıla bilməz.",
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
    INVALID_COST_AMOUNT: "Maya dəyəri düzgün məbləğ deyil.",
    CAPCUT_STOCK_EMPTY: "Boş CapCut stoku yoxdur.",
    CAPCUT_DELIVERY_NOT_FOUND: "CapCut çatdırılma sifarişi tapılmadı.",
    CAPCUT_ORDER_REQUIRED: "Bu sifariş CapCut məhsuluna aid deyil.",
    CAPCUT_ORDER_NOT_REVIEWABLE: "Bu CapCut sifarişi artıq təsdiqlənə bilməz."
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
  if (/kapital|birbank/.test(provider)) return "kapital";
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
    !unlimited && remaining <= 0 && pending > 0 && row.activated_today ? "temporarily_busy" :
    row.active ? "active" : "pending";
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
  let receiptCleanupOffset = 0;
  const shopCleanupOffsets={cart:0,topup:0};
  if (!config.supabaseUrl || !config.supabaseSecretKey) throw new Error("Supabase ödəniş konfiqurasiyası tamamlanmayıb.");
  const client = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    global: { fetch: (input, init = {}) => {
      const url = String(input?.url || input);
      const checkoutWrite = url.endsWith("/rpc/submit_payment_order_v2") || url.endsWith("/rpc/submit_payment_order_browser") || url.includes("/storage/v1/object/");
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
        (method.active || (method.activatedToday && ["temporarily_busy", "limit_reached"].includes(method.status))))
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
      if(args.requireStock&&!config.inventoryEnabled)throw Object.assign(new Error('Stok sistemi migration gözləyir.'),{status:503});
      return rpc(config.inventoryEnabled?"inventory_reserve_payment":"reserve_payment_method_v3", {
        p_method_id: args.methodId,
        p_product_id: args.productId,
        p_plan_id: args.planId,
        p_amount: args.amount,
        p_currency: "AZN",
        p_idempotency_key: args.idempotencyKey,
        p_checkout_key: args.checkoutKey,
        p_previous_reservation_id: args.previousReservationId || null,
        p_minutes: config.reservationMinutes,
        ...(config.inventoryEnabled?{p_require_stock:args.requireStock===true}:{})
      });
    },
    inventorySnapshot(){return rpc('inventory_snapshot');},
    inventoryReady(){return rpc('employee_system_ready');},
    setInventory(productId,available,actor,key,version,planKey=null){return rpc('inventory_set_nullable_quantity',{p_product:productId,p_available:available,p_actor:actor,p_key:key,p_expected_version:version,p_plan_key:planKey});},
    async submitOrder(args) {
      const params = {
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
      };
      // Public checkout collects no customer identity or quantity. Resolve only
      // canonical plan metadata; keep the legacy transactional receipt/payment RPC.
      const metadata=args.checkoutMetadata;
      const canonicalPlanId=metadata ? await rpc('employee_plan_resolve',{p_product:args.productId,p_key:metadata.sourcePlanKey,p_signature:metadata.signature,p_label:args.planName}) : null;
      const result=await rpc(args.accountUserId?'submit_payment_order_account_v1':args.browserOwnerHash?'submit_payment_order_browser':'submit_payment_order_v2',{...params,...(args.browserOwnerHash?{p_owner_hash:args.browserOwnerHash}:{}),...(args.accountUserId?{p_user_id:args.accountUserId}:{})});
      if(metadata){
        const snapshot={productId:args.productId,planId:canonicalPlanId,productName:args.productTitle,planName:args.planName,unitPrice:metadata.unitPrice,quantity:1,amount:metadata.unitPrice};
        const {error}=await client.from('payment_orders').update({quantity:1,canonical_plan_id:canonicalPlanId,checkout_snapshot:snapshot})
          .eq('id',result.id).is('quantity',null).is('canonical_plan_id',null).is('customer_name',null).is('customer_phone',null);
        if(error)throw paymentError(error);
      }
      return result;
    },
    async checkoutReservation(reservationId, checkoutKey) {
      const { data, error } = await client.from("payment_reservations").select("id,checkout_key,product_id,plan_id,amount,currency,status,expires_at,method_id")
        .eq("id", reservationId).eq("checkout_key", checkoutKey).maybeSingle();
      if (error) throw paymentError(error);
      if (!data) throw Object.assign(new Error("Rezerv bu ödəniş sessiyasına aid deyil."), { status: 404 });
      return data;
    },
    browserOrdersReady(){return rpc('browser_orders_ready');},
    browserOrderPage(owner,before,beforeId){return rpc('browser_orders_page',{p_owner_hash:owner,p_before:before,p_before_id:beforeId,p_limit:21});},
    async browserOwnedOrder(owner,id){const{data,error}=await client.from('browser_order_owners').select('payment_orders!inner(id,receipt_path,receipt_deleted_at,receipt_mime)').eq('token_hash',owner).eq('order_id',id).maybeSingle();if(error)throw paymentError(error);return data?.payment_orders||null;},
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
    async workforceOrders(ids) {
      if(!ids.length)return new Map();
      const rows=await rpc('employee_order_workflow',{p_ids:ids});
      return new Map(rows.map(({id,...workflow})=>[id,workflow]));
    },
    async listOrders(input = {}, catalog = [], { pendingDeliveries, pendingDeliveryProgress, deliveryCompletions } = {}) {
      const filters = normalizeOrderListParams(input);
      const todayBounds = bakuDayBounds(filters.today);
      const select = "id,checkout_snapshot,payment_source,payment_confirmed,order_code,product_id,product_title,plan_id,plan_name,quantity,amount,currency,status,created_at,updated_at,approved_at,completed_at,duration_months,service_expires_on,expiry_notification_on,contacted_at,method_name_snapshot,method_last4_snapshot,sale_price_snapshot,cost_price_snapshot,profit_snapshot,profit_margin_snapshot,cost_source,cost_backfilled_at,receipt_path,receipt_deleted_at,payment_methods(display_name,last4,provider_name),payment_reservations(status,expires_at)";

      const rangeStart = filters.tab === "today" ? todayBounds.start : filters.tab === "all" && filters.dateFrom ? filters.dateFrom+"T00:00:00+04:00" : null;
      const recent = new Map((deliveryCompletions && rangeStart ? await deliveryCompletions({since:rangeStart}) : []).map(o=>[o.id,o.completedAt]));

      const countStatus = async (statusValues, mutate = (value) => value) => {
        let countQuery = client.from("payment_orders").select("id", { count: "exact", head: true }).in("status", statusValues);
        countQuery = mutate(countQuery);
        const { count, error } = await countQuery;
        if (error) throw paymentError(error);
        return Number(count || 0);
      };

      const countToday = async () => {
        if (!deliveryCompletions || !pendingDeliveries) return countStatus(["approved", "completed"], query => query.gte("completed_at", todayBounds.start).lt("completed_at", todayBounds.endExclusive));
        const recentToday = rangeStart && rangeStart <= todayBounds.start
          ? [...recent].map(([id,completedAt])=>({id,completedAt}))
          : await deliveryCompletions({since:todayBounds.start});
        const inToday = time => Date.parse(time)>=Date.parse(todayBounds.start) && Date.parse(time)<Date.parse(todayBounds.endExclusive);
        const completed = new Set(recentToday.filter(row=>inToday(row.completedAt)).map(row=>row.id));
        for(let offset=0;;offset+=500){
          const {data,error}=await client.from("payment_orders").select("id").in("status",["approved","completed"])
            .gte("completed_at",todayBounds.start).lt("completed_at",todayBounds.endExclusive).order("id").range(offset,offset+499);
          if(error)throw paymentError(error);
          const ids=data.map(row=>row.id).filter(id=>!completed.has(id));
          if(ids.length){
            const [pending, delivered]=await Promise.all([pendingDeliveries(ids),deliveryCompletions({ids})]);
            const excluded=new Set([...pending,...delivered.filter(row=>!inToday(row.completedAt)).map(row=>row.id)]);
            for(const id of ids)if(!excluded.has(id))completed.add(id);
          }
          if(data.length<500)return completed.size;
        }
      };

      const deliveryProgressRequest = pendingDeliveryProgress
        ? pendingDeliveryProgress().then(rows=>new Map(rows.map(({id,remaining})=>[id,remaining])))
        : Promise.resolve(null);
      void deliveryProgressRequest.catch(() => {});
      const countsRequest = Promise.all([
        countStatus(["reviewing", "new_receipt_requested"], query=>query.eq("payment_source","card").not("payment_confirmed","is",true)),
        countToday(),
        deliveryCompletions ? countStatus(["approved", "completed", "reviewing", "new_receipt_requested"], query => query.or("status.in.(approved,completed),payment_confirmed.is.true")) : countStatus(["approved", "completed"]),
        countStatus(["approved", "completed"], query=>query.is("contacted_at", null).not("expiry_notification_on", "is", null).lte("expiry_notification_on", filters.today))
      ]);
      if (input.countsOnly === "true") {
        const [[pending,today,all,expiring],progress] = await Promise.all([countsRequest,deliveryProgressRequest]);
        const delivery=progress?.size ?? 0;
        return { counts:{pending,delivery,pendingTotal:pending+delivery,today,all,expiring} };
      }
      // Start counters alongside the list, and propagate errors when joining below.
      void countsRequest.catch(() => {});

      const applyCommonFilters = (query, dateColumn = "completed_at") => {
        let next = query;
        if (filters.search) next = next.ilike("order_code", `%${filters.search}%`);
        if (filters.methodId) next = next.eq("method_id", filters.methodId);
        const from=filters.dateFrom&&`${filters.dateFrom}T00:00:00+04:00`,to=filters.dateTo&&bakuDayBounds(filters.dateTo).endExclusive;
        if (from && !paidView) next = next.gte(dateColumn,from);
        if (to && !paidView) next = next.lt(dateColumn,to);
        return next;
      };

      const deliveryQueue = filters.tab === "pending" && input.pendingStage === "delivery";
      const reviewQueue = filters.tab === "pending" && input.pendingStage === "payment";
      const completedView = filters.tab === "today" && Boolean(pendingDeliveries);
      if (deliveryQueue && !pendingDeliveries) throw Object.assign(new Error("Təhvil siyahısı yalnız adminə açıqdır."), { status: 403 });
      const paidView = completedView || (filters.tab === "all" && Boolean(deliveryCompletions));
      const statuses = deliveryQueue ? ["approved", "reviewing", "new_receipt_requested"]
        : paidView ? ["approved", "completed", "reviewing", "new_receipt_requested"] : orderDatabaseStatuses(filters);
      const deliveryProgress = await deliveryProgressRequest;
      const dateColumn = filters.tab === "pending" ? "created_at" : "completed_at";
      const matchingQuery = (columns, options, completionIds = []) => {
        let query = applyCommonFilters(client.from("payment_orders").select(columns, options), dateColumn).in("status", statuses);
        if (reviewQueue) query = query.eq("payment_source", "card").not("payment_confirmed", "is", true);
        if (deliveryQueue && completionIds.length) query = query.in("id", completionIds);
        if (deliveryQueue || paidView) query = query.or("status.in.(approved,completed),payment_confirmed.is.true");
        if (paidView && rangeStart) {
          const lower = `completed_at.gte.${rangeStart},and(completed_at.is.null,created_at.gte.${rangeStart})`;
          query = completionIds.length ? query.in("id", completionIds) : query.or(lower);
        }
        if (filters.tab === "today" && !completedView) query = query.gte("completed_at", todayBounds.start).lt("completed_at", todayBounds.endExclusive);
        if (filters.tab === "expiring") query = query.is("contacted_at", null).not("expiry_notification_on", "is", null).lte("expiry_notification_on", filters.today);
        return query.order(dateColumn, { ascending: filters.sort === "oldest" }).order("id", { ascending: filters.sort === "oldest" });
      };
      // Facets exclude only the duration filter, not product/bank/date/ID/tab.
      // Read every matching row in bounded pages: neither a UI page nor a 5000-row
      // cap can determine the available durations or the filtered batch selection.
      const matchProduct = filters.productId ? orderProductMatcher(filters.productId, catalog) : null;
      const facetColumns = "id,product_id,product_title,plan_id,plan_name,duration_months,status,completed_at,created_at,payment_confirmed,amount,sale_price_snapshot,cost_price_snapshot,profit_snapshot" +
        (matchProduct ? ",method_id,method_name_snapshot,method_last4_snapshot,cart_items:checkout_snapshot->items,snapshot_product:checkout_snapshot->>productId" : "");
      const facetRows = [];
      const seenOrders = new Set();
      const candidateBatches = [[]];
      if (deliveryQueue && deliveryProgress) {
        candidateBatches.length=0;
        const ids=[...deliveryProgress.keys()];
        for(let i=0;i<ids.length;i+=100) candidateBatches.push(ids.slice(i,i+100));
      }
      if (paidView && rangeStart) {
        const ids = [...recent.keys()];
        for (let i=0;i<ids.length;i+=100) candidateBatches.push(ids.slice(i,i+100));
      }
      for (const ids of candidateBatches) {
        let facetTotal, offset = 0;
        do {
          const result = await matchingQuery(facetColumns, { count: "exact" }, ids).range(offset, offset + 999);
          if (result.error) throw paymentError(result.error);
          facetTotal = Number(result.count || 0);
          if (!result.data?.length && offset < facetTotal) throw paymentError(null, "Sifariş filtri tam yüklənmədi. Yenidən cəhd edin.");
          offset += result.data?.length || 0;
          const candidates = (result.data || []).filter(row => !seenOrders.has(row.id) && (!matchProduct || matchProduct(row)));
          const pending = (deliveryQueue || completedView) && candidates.length
            ? deliveryProgress || new Set(await pendingDeliveries(candidates.map(row => row.id))) : null;
          const completions = paidView && rangeStart && deliveryCompletions && candidates.length
            ? new Map((await deliveryCompletions({ids:candidates.map(row=>row.id)})).map(o=>[o.id,o.completedAt])) : recent;
          for (const row of candidates) if (!pending || pending.has(row.id) === deliveryQueue) {
            const completedAt = completions.get(row.id) || row.completed_at || row.created_at;
            if (paidView && rangeStart && Date.parse(completedAt)<Date.parse(rangeStart)) continue;
            const rangeEnd = completedView ? todayBounds.endExclusive : filters.dateTo && bakuDayBounds(filters.dateTo).endExclusive;
            if (paidView && rangeEnd && Date.parse(completedAt)>=Date.parse(rangeEnd)) continue;
            seenOrders.add(row.id);
            const {cart_items, snapshot_product, ...summary} = row;
            facetRows.push(completedView||completions.has(row.id)?{...summary,status:'completed',completed_at:completedAt}:summary);
          }
        } while (offset < facetTotal);
      }
      if(deliveryQueue && candidateBatches.length>1){
        const direction=filters.sort==="oldest"?1:-1;
        facetRows.sort((a,b)=>direction*((Date.parse(a.created_at)||0)-(Date.parse(b.created_at)||0)||a.id.localeCompare(b.id)));
      }
      if(paidView){const direction=filters.sort==='oldest'?1:-1;facetRows.sort((a,b)=>direction*((Date.parse(a.completed_at)||0)-(Date.parse(b.completed_at)||0)||a.id.localeCompare(b.id)));}
      const durations = durationOptions(facetRows);
      if (filters.durationMonths && !durations.some((item) => item.value === filters.durationMonths) && input.preserveFilters!=='true') {
        filters.durationMonths = "";
        filters.page = 1;
      }
      const matchedRows = filters.durationMonths ? facetRows.filter((row) => orderDuration(row) === filters.durationMonths) : facetRows;
      const view=adminListWindow(matchedRows,{page:filters.page,pageSize:filters.pageSize,anchorId:safeUuid(input.anchorId),anchorIndex:input.anchorIndex});
      const pageIds = view.rows.map((row) => row.id);
      const query = pageIds.length ? matchingQuery(select, {}, pageIds).in("id", pageIds) : Promise.resolve({ data: [], error: null });

      const [{ data, error }, [pendingCount, todayCount, completedCount, expiringCount], methodRows, statistics] = await Promise.all([
        query,
        countsRequest,
        client.from("payment_methods").select("id,display_name,provider_name,last4,archived").order("sort_order", { ascending: true }),
        deliveryQueue || reviewQueue || paidView || filters.durationMonths || matchProduct ? Promise.resolve(durationStatistics(matchedRows, { includeMethods: Boolean(matchProduct) })) : rpc("payment_order_profit_statistics_v2", {
          p_tab: filters.tab,
          p_search: filters.search || null,
          p_product_id: filters.productId || null,
          p_plan_name: null,
          p_method_id: filters.methodId || null,
          p_date_from: filters.dateFrom || null,
          p_date_to: filters.dateTo || null,
          p_today: filters.today
        })
      ]);
      if (error) throw paymentError(error);
      if (methodRows.error) throw paymentError(methodRows.error);

      const orders = data || [];
      if(completedView){const positions=new Map(pageIds.map((id,index)=>[id,index]));orders.sort((a,b)=>positions.get(a.id)-positions.get(b.id));}
      const displayedCompletions = new Map((deliveryCompletions && !deliveryQueue ? await deliveryCompletions({ids:orders.map(o=>o.id)}) : []).map(o=>[o.id,o.completedAt]));
      const products = new Map();
      for (const row of facetRows) {
        if (row.product_id && !products.has(row.product_id)) products.set(row.product_id, row.product_title);
      }
      const total = matchedRows.length;
      return {
        orders: orders.map((order) => {
          const method = Array.isArray(order.payment_methods) ? order.payment_methods[0] || {} : order.payment_methods || {};
          const reservation = Array.isArray(order.payment_reservations) ? order.payment_reservations[0] || {} : order.payment_reservations || {};
          return {
            id: order.id,
            orderCode: order.order_code,
            productId: order.product_id,
            productTitle: order.product_title,
            items:orderLines(order.checkout_snapshot),
            ...(deliveryQueue && deliveryProgress ? {remainingDelivery:deliveryProgress.get(order.id)} : {}),
            planId: order.plan_id,
            planName: order.plan_name,
            quantity: order.quantity,
            amount: Number(order.amount),
            salePriceSnapshot: order.sale_price_snapshot === null ? Number(order.amount) : Number(order.sale_price_snapshot),
            costPriceSnapshot: order.cost_price_snapshot === null ? null : Number(order.cost_price_snapshot),
            profitSnapshot: order.profit_snapshot === null ? null : Number(order.profit_snapshot),
            profitMarginSnapshot: order.profit_margin_snapshot === null ? null : Number(order.profit_margin_snapshot),
            costSource: order.cost_source || null,
            costBackfilledAt: order.cost_backfilled_at || null,
            currency: order.currency,
            status: completedView||displayedCompletions.has(order.id) ? 'completed' : adminOrderStatus(order.status, reservation.status),
            reservationStatus: reservation.status || "",
            createdAt: order.created_at,
            completedAt: displayedCompletions.get(order.id) || order.completed_at || order.approved_at || (completedView&&order.payment_confirmed ? order.created_at : adminOrderStatus(order.status, reservation.status) === "completed" ? order.updated_at : null),
            durationMonths: order.duration_months,
            expiresOn: order.service_expires_on,
            expiryNotificationOn: order.expiry_notification_on,
            expiry: expiryStatus(order.service_expires_on),
            contactedAt: order.contacted_at,
            receiptAvailable: Boolean(order.receipt_path && !order.receipt_deleted_at && order.payment_source!=='wallet'),paymentSource:order.payment_source||'card',paymentConfirmed:order.payment_confirmed===true,
            paymentMethodLabel: paymentMethodLabel({ ...method, method_name_snapshot: order.method_name_snapshot, method_last4_snapshot: order.method_last4_snapshot }),
            ...(deliveryQueue ? { deliveryPending: true } : {})
          };
        }),
        liveWindow:{newBeforeAnchor:view.newBeforeAnchor,anchorMissing:view.anchorMissing},
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / filters.pageSize))
        },
        counts: {
          pending: pendingCount,
          delivery: deliveryProgress?.size ?? (deliveryQueue ? facetRows.length : 0),
          pendingTotal: pendingCount + (deliveryProgress?.size ?? (deliveryQueue ? facetRows.length : 0)),
          today: todayCount,
          all: filters.tab === "all" ? total : completedCount,
          expiring: filters.tab === "expiring" ? total : expiringCount
        },
        statistics: normalizeFinancialStatistics(statistics || { count: 0, revenue: 0, cost: 0, profit: 0, missingCostCount: 0, topProduct: "—", products: [], plans: [], days: [] }),
        appliedFilters: filters,
        filters: {
          products: [...products].map(([id, title]) => ({ id, title })),
          durations,
          methods: (methodRows.data || []).map((method) => ({ id: method.id, label: paymentMethodLabel(method) }))
        },
        selection: filters.tab === "expiring" ? {
          ids: matchedRows.map((item) => item.id),
          total: matchedRows.length
        } : { ids: [], total: 0 }
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
    async ensureCapcutDelivery(orderId, customerPhone, tokenHash, tokenCipher) {
      const existing = await client.from("capcut_deliveries").select("*").eq("order_id", orderId).maybeSingle();
      if (existing.error) throw paymentError(existing.error);
      if (existing.data) return existing.data;
      const inserted = await client.from("capcut_deliveries").insert({ order_id: orderId, customer_phone: customerPhone, token_hash: tokenHash, token_cipher: tokenCipher }).select("*").single();
      if (inserted.error) {
        const recovered = await client.from("capcut_deliveries").select("*").eq("order_id", orderId).single();
        if (recovered.error) throw paymentError(inserted.error);
        return recovered.data;
      }
      return inserted.data;
    },
    async capcutDeliveryByOrder(orderId) {
      const { data, error } = await client.from("capcut_deliveries").select("*").eq("order_id", orderId).maybeSingle();
      if (error) throw paymentError(error); return data || null;
    },
    async capcutDeliveryByTokenHash(tokenHash) {
      const { data, error } = await client.from("capcut_deliveries").select("*,payment_orders(*)").eq("token_hash", tokenHash).maybeSingle();
      if (error) throw paymentError(error); return data || null;
    },
    async capcutAccount(id) {
      const { data, error } = await client.from("capcut_accounts").select("*").eq("id", id).maybeSingle();
      if (error) throw paymentError(error); return data || null;
    },
    async capcutTemplate() {
      const { data, error } = await client.from("capcut_delivery_template").select("*").eq("singleton", true).single();
      if (error) throw paymentError(error); return data;
    },
    async saveCapcutTemplate(row) {
      const { data, error } = await client.from("capcut_delivery_template").upsert({ singleton: true, ...row, updated_at: new Date().toISOString() }).select("*").single();
      if (error) throw paymentError(error); return data;
    },
    async addCapcutAccounts(rows) {
      const { data, error } = await client.from("capcut_accounts").insert(rows).select("*");
      if (error) throw paymentError(error); return data || [];
    },
    async capcutAdminSnapshot() {
      const [accounts, deliveries] = await Promise.all([
        client.from("capcut_accounts").select("*").order("created_at"),
        client.from("capcut_deliveries").select("*,payment_orders(*)").order("created_at", { ascending: false })
      ]);
      if (accounts.error) throw paymentError(accounts.error); if (deliveries.error) throw paymentError(deliveries.error);
      return { accounts: accounts.data || [], deliveries: deliveries.data || [] };
    },
    approveCapcutDelivery(id, actor) { return rpc("approve_capcut_delivery", { p_order_id: id, p_actor: actor }); },
    cancelCapcutDelivery(id, actor) { return rpc("cancel_capcut_delivery", { p_order_id: id, p_actor: actor }); },
    async rejectCapcutDelivery(id, actor) {
      const result = await this.rejectOrder(id, actor);
      const { error } = await client.from("capcut_deliveries").update({ status: "rejected", rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("order_id", id).eq("status", "waiting");
      if (error) throw paymentError(error); return result;
    },
    async markCapcutNotified(orderId) {
      const { error } = await client.from("capcut_deliveries").update({ notified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("order_id", orderId).is("notified_at", null);
      if (error) throw paymentError(error);
    },
    approveOrder(id, durationMonths, actor) {
      return rpc(config.employeeEnabled ? 'employee_approve_direct' : 'approve_payment_order_v7', {
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
    async contactExpiringOrders(ids, actor, now = new Date()) {
      const uniqueIds = [...new Set((ids || []).map(safeUuid).filter(Boolean))].slice(0, 500);
      const completed = [];
      const skipped = [];
      const today = bakuDate(now);
      for (const id of uniqueIds) {
        try {
          const order = await this.getOrder(id);
          const eligibleStatus = ["approved", "completed"].includes(order.status);
          if (!order.expiry_notification_on) {
            skipped.push({ id, orderCode: order.order_code || "", reason: "Bitmə tarixi müəyyən edilməyib." });
            continue;
          }
          if (!eligibleStatus || order.contacted_at || order.expiry_notification_on > today) {
            skipped.push({ id, orderCode: order.order_code || "", reason: "Sifariş artıq bitən məhsullar siyahısına uyğun deyil." });
            continue;
          }
          const result = await this.contactOrder(id, actor);
          if (result?.idempotent) skipped.push({ id, orderCode: order.order_code || "", reason: "Sifariş artıq təsdiqlənib." });
          else completed.push({ id, orderCode: order.order_code || "" });
        } catch {
          skipped.push({ id, orderCode: "", reason: "Sifariş təhlükəsiz yoxlamadan keçmədi." });
        }
      }
      return { requested: uniqueIds.length, completed, skipped };
    },
    cancelCustomerReservation(id, checkoutKey, actor) {
      return rpc("cancel_customer_payment_reservation", { p_reservation_id: id, p_checkout_key: checkoutKey, p_actor: actor });
    },
    async missingReservationIsClear(id, checkoutKey) {
      // Called ONLY after the canonical cancel RPC reports RESERVATION_NOT_FOUND.
      // Never infer absence from a filtered ownership query or generic HTTP 404.
      const {data:rows,error}=await client.from('payment_reservations').select('id,status')
        .or(`id.eq.${id},checkout_key.eq.${checkoutKey}`).limit(101);
      if(error)throw paymentError(error);
      if(!Array.isArray(rows)||rows.length>=101||rows.some(r=>r.id===id||!['cancelled','expired'].includes(r.status)))return false;
      if(rows.length){const {data:orders,error:orderError}=await client.from('payment_orders').select('id').in('reservation_id',rows.map(r=>r.id)).limit(1);if(orderError)throw paymentError(orderError);if(!Array.isArray(orders)||orders.length)return false;}
      return true;
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
      const upload = client.storage.from(config.receiptsBucket).upload(path, receipt.buffer, { contentType: receipt.mimeType, upsert: false, cacheControl: "0" });
      const timeout = new Promise((_, reject) => {
        const timer = setTimeout(() => reject(Object.assign(new Error("Private storage cavabı gecikdi."), {
          status: 504, code: "RECEIPT_STORAGE_TIMEOUT", diagnostic: "Receipt storage upload exceeded 75 seconds"
        })), 75_000);
        timer.unref?.();
      });
      const { error } = await Promise.race([upload, timeout]);
      if (Number(error?.statusCode) === 409 && path.endsWith(`/${receipt.sha256}.${receipt.extension}`)) return;
      if (error) throw Object.assign(paymentError(error, "Çek private yaddaşa yüklənmədi."), {
        status: [408, 429, 500, 502, 503, 504].includes(Number(error.statusCode)) ? Number(error.statusCode) : 503,
        code: "RECEIPT_STORAGE_TEMPORARY",
        diagnostic: `storage_upload:http_${Number(error.statusCode)||0}`
      });
    },
    async verifyUploadedReceipt(path, size) {
      const slash = path.lastIndexOf('/');
      const {data,error} = await client.storage.from(config.receiptsBucket).list(path.slice(0,slash), {search:path.slice(slash+1),limit:100});
      if (error) throw Object.assign(paymentError(error, 'Private storage yoxlaması alınmadı.'), {status:503,code:'RECEIPT_STORAGE_TEMPORARY',diagnostic:`storage_verify:http_${Number(error.statusCode)||0}`});
      const file = data?.find(item=>item.name===path.slice(slash+1));
      if (!file || Number(file.metadata?.size)!==Number(size)) throw Object.assign(new Error('Çek private yaddaşda təsdiqlənmədi. Yenidən yükləyin.'), {status:409,code:'RECEIPT_CONFIRMATION_INVALID'});
    },
    async cleanupStagedReceipts() {
      const cutoff = new Date(Date.now()-2*60*60_000).toISOString();
      const {data,error} = await client.storage.from(config.receiptsBucket).list('pending',{limit:100,offset:receiptCleanupOffset,sortBy:{column:'name',order:'asc'}});
      if (error) throw paymentError(error);
      receiptCleanupOffset = data?.length===100 ? receiptCleanupOffset+100 : 0;
      let removed=0;
      for (const folder of data || []) {
        const reservationId=safeUuid(folder.name);
        if(!reservationId)continue;
        const prefix=`pending/${reservationId}`;
        const result=await client.storage.from(config.receiptsBucket).list(prefix,{limit:100});
        if (result.error) throw paymentError(result.error);
        const order=await this.getOrderByReservation(reservationId);
        const paths=(result.data || []).filter(file=>Date.parse(file.created_at)<Date.parse(cutoff))
          .map(file=>`${prefix}/${file.name}`).filter(path=>path!==order?.receipt_path);
        if(paths.length){const cleanup=await client.storage.from(config.receiptsBucket).remove(paths);if(cleanup.error)throw paymentError(cleanup.error);removed+=paths.length;}
      }
      return removed;
    },
    async removeReceipt(path) {
      const r=await client.storage.from(config.receiptsBucket).remove([path]);if(r.error)throw paymentError(r.error);
    },
    async shopReceiptFiles(){
      const files=[];for(const prefix of ['cart','topup']){const page=await client.storage.from(config.receiptsBucket).list(prefix,{limit:30,offset:shopCleanupOffsets[prefix],sortBy:{column:'name',order:'asc'}});if(page.error)throw paymentError(page.error);shopCleanupOffsets[prefix]=page.data?.length===30?shopCleanupOffsets[prefix]+30:0;for(const folder of page.data||[]){if(!safeUuid(folder.name))continue;const r=await client.storage.from(config.receiptsBucket).list(prefix+'/'+folder.name,{limit:100});if(r.error)throw paymentError(r.error);for(const file of r.data||[])if(/^[a-f0-9]{64}\.(?:jpg|png|pdf)$/.test(file.name)&&Date.parse(file.created_at)<Date.now()-2*3600000)files.push({kind:prefix,id:folder.name,path:prefix+'/'+folder.name+'/'+file.name});}}
      return files;
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
      // A cart stores one receipt for several orders. Keep it while any linked
      // order is still inside the existing retention window or under review.
      const paths=[...new Set(data.map(item=>item.receipt_path).filter(Boolean))],safePaths=[];
      for(const path of paths){const related=await client.from('payment_orders').select('id,status,updated_at').eq('receipt_path',path).is('receipt_deleted_at',null);if(related.error)throw paymentError(related.error);if((related.data||[]).every(o=>['approved','rejected','completed','cancelled'].includes(o.status)&&Date.parse(o.updated_at)<Date.parse(cutoff)))safePaths.push(path);}
      if(!safePaths.length)return 0;
      const removed=await client.storage.from(config.receiptsBucket).remove(safePaths);if(removed.error)throw paymentError(removed.error);
      const eligible=await client.from('payment_orders').select('id').in('receipt_path',safePaths).is('receipt_deleted_at',null);if(eligible.error)throw paymentError(eligible.error);
      const ids = (eligible.data||[]).map(item=>item.id);
      const { error: updateError } = await client.from("payment_orders").update({ receipt_deleted_at: new Date().toISOString() }).in("id", ids);
      if (updateError) throw paymentError(updateError);
      return ids.length;
    }
  };
}
