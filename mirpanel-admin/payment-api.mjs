import { createPaymentMailer, paymentEmailContent } from "./payment-mail.mjs";
import {randomUUID} from 'node:crypto';
import {
  createPaymentSecurity,
  normalizePaymentNumber,
  publicPaymentNumber,
  receiptFromBuffer,
  receiptFromPayload,
  detectReceiptType,
  safeMultiline,
  safeText,
  safeUuid,
  validatePaymentNumber
} from "./payment-security.mjs";
import { createPaymentStore, paymentError } from "./payment-store.mjs";
import {adminOrderFields} from './admin-order-fields.mjs';
import { structuredDurationMonths } from "./payment-order-lifecycle.mjs";
import { paymentMethodLabel } from "./payment-order-query.mjs";
import {signature} from './employee-security.mjs';
import {planKey} from './payment-profit.mjs';
import {userPriceSignature} from './community/user-price-key.mjs';
import {customerOrderStatus} from './employee-order-status.mjs';
import {inventoryAvailability} from '../inventory-availability.mjs';
import {createInventoryReader,inventoryUnavailable} from './inventory-reader.mjs';
import {validateReceiptFile,FILE_SAFETY_ENGINE} from './receipt-file-safety.mjs';
import {createBrowserOrders} from './browser-orders.mjs';
import {createAccountOrders} from './account-orders.mjs';
import {createShop,productCardPaymentUnavailable} from './shop.mjs';
import {handleShop} from './shop-http.mjs';
import {createBankBackgrounds,bankKey,BANKS,DECORATIONS} from './bank-backgrounds.mjs';
import {productSeoSlug} from './product-pages.mjs';

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
  if (/kapital|birbank/.test(provider)) return "kapital";
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
    backgroundUrl: method.backgroundUrl || '',
    order: method.order,
    available: method.available,
    status: method.status,
    unavailableReason: method.available ? "" : method.status === "limit_reached" ? "Bu gün limit dolub" : "Müvəqqəti rezervdədir"
  };
}

function errorStatus(error) {
  return Number(error?.status) || (error?.code === "PAYMENT_METHOD_LIMIT_REACHED" ? 409 : 500);
}

export async function paymentOrderFromMultipart(rawBody, contentType, maxReceiptBytes = 5 * 1024 * 1024, onFile=()=>{}) {
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
  onFile(Number(uploaded.size),detectReceiptType(Buffer.from(await uploaded.slice(0,32).arrayBuffer()))?.extension||'unknown');
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
  const bankBackgrounds=options.bankBackgrounds||(store.client?createBankBackgrounds(store.client,config.storiesBucket):null);
  async function backgroundList(){
    if(!bankBackgrounds)return {};
    let timer;try{return await Promise.race([bankBackgrounds.list(),new Promise(resolve=>{timer=setTimeout(()=>resolve({}),1000);})]);}
    catch{console.error('Bank background: metadata unavailable');return {};}finally{clearTimeout(timer);}
  }
  async function withBackground(method){
    const backgrounds=await backgroundList();return {...method,backgroundUrl:backgrounds[bankKey(method)]||''};
  }
  const readInventory=createInventoryReader({snapshot:()=>store.inventorySnapshot(),ready:store.inventoryReady?()=>store.inventoryReady():null,enabled:()=>config.inventoryEnabled===true,onReady:()=>{config.inventoryEnabled=true;},cacheMs:options.store?0:2000});
  const validateFile = options.validateReceiptFile || validateReceiptFile;
  // Coalesce only authenticated reservation + identical raw bytes. Never cache a
  // failed attempt; storage itself remains the durable, immutable hash authority.
  const receiptAttempts=new Map();
  const browserOrders=createBrowserOrders({security,store,enabled:config.browserOrdersEnabled===true});
  const accountOrders=createAccountOrders({security,store,resolve:options.accountHistory});
  const mailer = options.mailer || createPaymentMailer(config, store);
  const shop=options.shopContext?createShop({context:options.shopContext,catalog:loadCatalog,snapshot:()=>readInventory({fresh:true}),store,config,adminTopupNotifications:options.adminTopupNotifications}):null;
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
      "Access-Control-Allow-Headers": "Content-Type,X-Idempotency-Key,X-Upload-Trace",
      "Access-Control-Max-Age": "600",
      Vary: "Origin"
    };
  }

  function publicJson(request, response, status, body) {
    if(request.receiptTrace){body={...body,traceId:request.receiptTrace};response.setHeader('X-Upload-Trace',request.receiptTrace);response.setHeader('Access-Control-Expose-Headers','Server-Timing, X-Upload-Trace');}
    const timing=request.receiptTimings;
    const personal=/^\/api\/payments\/(?:my-orders|shop)/.test(String(request.url||''));
    json(response, status, body, { ...corsHeaders(request), "Cache-Control": personal?"private, no-store, max-age=0":"no-store",...(personal?{Vary:'Cookie, Origin','Surrogate-Control':'no-store','Referrer-Policy':'no-referrer'}:{}),...(timing?{"Server-Timing":Object.entries(timing).map(([name,ms])=>`${name};dur=${Math.max(0,ms).toFixed(1)}`).join(', '),"Access-Control-Expose-Headers":"Server-Timing, X-Upload-Trace"}:{}) });
  }

  async function orderResult(order, idempotent = true, whatsappExtraText = "") {
    const workflow=config.employeeEnabled&&store.workforceOrders?(await store.workforceOrders([order.id])).get(order.id):null;
    const method = await store.rawMethod(order.method_id);
    const methodLabel = paymentMethodLabel({
      method_name_snapshot: order.method_name_snapshot || method?.provider_name || method?.display_name,
      method_last4_snapshot: order.method_last4_snapshot || method?.last4
    });
    return {
      orderId: order.id, orderCode: order.order_code, status: order.status, idempotent,
      statusMessage:customerOrderStatus(order.status,workflow?.state),
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

  // An authenticated-encrypted receipt capability, not a public storage URL.
  function uploadedReceipt(token, reservationId, checkoutKey) {
    try {
      const parts=String(token || '').split('.');
      if(parts.length!==4 || parts[0]!=='v1' || parts.slice(1).some(part=>Buffer.from(part,'base64url').toString('base64url')!==part)) throw new Error();
      const value = JSON.parse(security.decryptSecret(String(token || '')));
      if (value.purpose !== 'payment-receipt' || value.reservationId !== reservationId ||
          value.checkoutHash !== security.hashToken(checkoutKey) || !Number.isFinite(value.expiresAt) || value.expiresAt < Date.now() ||
          !/^[a-f0-9]{64}$/.test(value.sha256) || !['jpg','png','webp','pdf'].includes(value.extension) ||
          !Number.isSafeInteger(value.size) || value.size <= 0 || value.size > config.maxReceiptBytes ||
          value.path !== `pending/${reservationId}/${value.sha256}.${value.extension}`) throw new Error();
      return value;
    } catch {
      throw Object.assign(new Error('Çek təsdiqi etibarlı deyil. Çeki yenidən yükləyin.'), {status:400,code:'RECEIPT_CONFIRMATION_INVALID'});
    }
  }

  async function inventoryView(all=false){const [rows,c]=await Promise.all([readInventory({fresh:!all}),loadCatalog()]);return c.products.filter(p=>p.active!==false&&(all||p.stockEnabled===true||rows.some(r=>r.productId===p.id))).map(p=>inventoryAvailability(p,rows.find(r=>r.productId===p.id)));}

  async function catalogSelection(productId, planIndex) {
    const data = await loadCatalog();
    const product = data.products.find((item) => item.id === productId && item.active !== false);
    const index = Number(planIndex);
    const plan = product?.plans?.[index];
    // Catalog stock is a legacy display value, NEVER an inventory counter.
    const rows=config.inventoryEnabled||store.inventoryReady?await readInventory({fresh:true}):[];
    const availability=product?inventoryAvailability(product,rows.find(r=>r.productId===product.id)):null;
    const inventoryPlan=availability?.plans.find(p=>p.planKey===String(index));
    // Zero quantity is enforced by the atomic RPC, not a pre-check that would
    // reject the legitimate retry of a reservation which took the last unit.
    if(availability?.salesDisabled)throw Object.assign(Error('Məhsul stokda yoxdur.'),{status:409,code:'PRODUCT_SALE_PAUSED'});
    const unavailableStock=!inventoryPlan?.active;
    if (!product || unavailableStock || !plan || !Number.isFinite(Number(plan.price)) || Number(plan.price) <= 0) {
      throw Object.assign(new Error("Məhsul və ya plan artıq sifariş üçün açıq deyil."), { status: 409 });
    }
    return { product, plan, planIndex: index, requireStock:inventoryPlan.tracked };
  }

  let storefront;
  async function handlePublic(request, response, url) {
    if(request.method==='GET'&&url.pathname==='/api/payments/inventory'){
      try{const [products]=await Promise.all([inventoryView(true),publicRate(request,'inventory',60,120)]);publicJson(request,response,200,{products});return true;}catch(e){if(e.status===429)throw e;throw inventoryUnavailable();}
    }
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
    if(request.method==='GET'&&url.pathname==='/api/payments/storefront'){
      if(!storefront||storefront.until<Date.now()){
        const value=(async()=>{
          const [orders,catalog,stock,methods]=await Promise.allSettled([
            store.client.from('payment_orders').select('id',{count:'exact',head:true}).in('status',['approved','completed']),
            loadCatalog(),inventoryView(true),store.publicMethods()
          ]);
          const available=new Map((stock.status==='fulfilled'?stock.value:[]).map(x=>[x.productId,x]));
          const products=(catalog.status==='fulfilled'?catalog.value.products:[]).filter(p=>p.active!==false).flatMap(p=>{
            const slug=productSeoSlug(p),sale=available.get(p.id);
            const prices=(p.plans||[]).map((x,i)=>sale?.plans[i]?.canOrder?Math.round(Number(x.price)*100):0).filter(x=>Number.isSafeInteger(x)&&x>0);
            return slug&&prices.length?[{id:p.id,title:p.title,category:p.category,image:p.image||'',path:'/mehsul/'+slug,priceCents:Math.min(...prices),from:(p.plans||[]).length>1}]:[];
          });
          return {
            completedOrders:orders.status==='fulfilled'&&!orders.value.error&&Number.isSafeInteger(orders.value.count)?orders.value.count:null,
            products,banks:methods.status==='fulfilled'?[...new Set(methods.value.map(bankKey))]:[]
          };
        })();
        storefront={value,until:Date.now()+60000};
      }
      publicJson(request,response,200,await storefront.value);return true;
    }
    if(request.method==='GET'&&url.pathname==='/api/payments/backgrounds'&&bankBackgrounds){
      await publicRate(request,'decorations',60,60);publicJson(request,response,200,{backgrounds:await bankBackgrounds.list()});return true;
    }
    const bankImage=url.pathname.match(/^\/api\/payments\/(?:bank-backgrounds\/(kapital|m10|abb|leo)|backgrounds\/(wallet-card))$/);
    if(request.method==='GET'&&bankImage&&bankBackgrounds){
      const image=await bankBackgrounds.image(bankImage[1]||bankImage[2]);
      const headers={...corsHeaders(request),'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=60, must-revalidate','ETag':image.etag};
      response.writeHead(request.headers['if-none-match']===image.etag?304:200,headers);
      response.end(request.headers['if-none-match']===image.etag?undefined:image.bytes);return true;
    }
    if(url.pathname.startsWith('/api/payments/shop/')){
      if(!shop)throw Object.assign(Error('Səbət xidməti əlçatan deyil.'),{status:503});
      if(request.headers['sec-fetch-site']==='cross-site'||request.method==='POST'&&!allowedOrigins.has(origin))throw Object.assign(Error('Sorğunun mənbəyi icazəli deyil.'),{status:403});
      return handleShop({req:request,res:response,url,shop,browserOrders,security,readBody,readRawBody,validateFile,store,config,json:publicJson,rate:publicRate,withBackground});
    }
    if(request.method==='GET'&&url.pathname==='/api/payments/my-orders'){
      if(request.headers['sec-fetch-site']==='cross-site')throw Object.assign(Error('Sorğunun mənbəyi icazəli deyil.'),{status:403});
      await publicRate(request,'browser-orders',60,60);
      publicJson(request,response,200,await accountOrders.list(request,url.searchParams.get('cursor'),url.searchParams.get('order')));return true;
    }
    const codes=url.pathname.match(/^\/api\/payments\/my-orders\/codes(?:\/([0-9a-f-]{36}))?$/);
    if(request.method==='GET'&&codes){publicJson(request,response,200,await accountOrders.codes(request,codes[1]));return true;}
    const orderGuide=url.pathname.match(/^\/api\/payments\/my-orders\/([0-9a-f-]{36})\/guide\/(\d{1,3})$/);
    if(request.method==='GET'&&orderGuide){publicJson(request,response,200,await accountOrders.guide(request,orderGuide[1],orderGuide[2]));return true;}
    const browserReceipt=url.pathname.match(/^\/api\/payments\/my-orders\/([0-9a-f-]{36})\/receipt$/);
    if(request.method==='GET'&&browserReceipt){
      if(!safeUuid(browserReceipt[1]))throw Object.assign(Error('Sifariş tapılmadı.'),{status:404});
      if(request.headers['sec-fetch-site']==='cross-site')throw Object.assign(Error('Sorğunun mənbəyi icazəli deyil.'),{status:403});
      await publicRate(request,'browser-receipt',60,30);
      publicJson(request,response,200,await accountOrders.receipt(request,browserReceipt[1]));return true;
    }
    if (request.method === "GET" && url.pathname === "/api/payments/health") {
      await publicRate(request, "health", 60, 30);
      await store.publicMethods();
      publicJson(request, response, 200, { ok:true, configured:true, database:true, storage:"private", registrationRequired:false, receiptCheck:"file-safety-only-v1", fileSafetyEngine:FILE_SAFETY_ENGINE, fileSafetyRuntime:{node:process.version,platform:process.platform,protocol:2}, contentChecked:false, ocrRequired:false });
      return true;
    }
    if (request.method === "GET" && url.pathname === "/api/payments/methods") {
      if(browserOrders.enabled)browserOrders.ensure(request,response);
      await publicRate(request, "methods", 60, 60);
      const [rows,backgrounds]=await Promise.all([store.publicMethods(),backgroundList()]);
      const methods=rows.map(method=>publicMethod({...method,backgroundUrl:backgrounds[bankKey(method)]||''}));
      publicJson(request, response, 200, { methods, anyAvailable: methods.some((item) => item.available), reservationMinutes: config.reservationMinutes,customerDetailsRequired:false });
      return true;
    }
    if (request.method === "POST" && url.pathname === "/api/payments/reservations") {
      if(config.productCardPaymentsPaused)throw productCardPaymentUnavailable();
      if(options.accountForCheckout&&!await options.accountForCheckout(request))throw Object.assign(Error('Sifarişi tamamlamaq üçün hesabınıza daxil olun.'),{status:401,code:'CHECKOUT_LOGIN_REQUIRED'});
      await publicRate(request, "reserve", 600, 12);
      const body = await readBody(request, 50_000);
      const idempotencyKey = safeUuid(request.headers["x-idempotency-key"] || body.idempotencyKey);
      const checkoutKey = safeUuid(body.checkoutKey);
      const previousReservationId = body.previousReservationId ? safeUuid(body.previousReservationId) : null;
      const methodId = safeUuid(body.methodId);
      if (!idempotencyKey || !checkoutKey || !methodId || (body.previousReservationId && !previousReservationId)) {
        throw Object.assign(new Error("Təhlükəsiz sifariş və checkout açarı tələb olunur."), { status: 400 });
      }
      const { product, plan, planIndex, requireStock } = await catalogSelection(safeText(body.productId, 100), body.planIndex);
      const orderQuantity=1;
      const reserveArgs={
        methodId, productId: product.id, planId: String(planIndex), amount: Number((Number(plan.price)*orderQuantity).toFixed(2)),
        idempotencyKey, checkoutKey, previousReservationId,requireStock:requireStock===true
      };
      const reserved=await options.accountReservation?.(request,{...reserveArgs,minutes:config.reservationMinutes,planKey:planKey(plan,planIndex),signature:userPriceSignature(plan)})||await store.reserve(reserveArgs);
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
          theme: resolvedPaymentTheme(method),
          backgroundUrl: (await withBackground(method)).backgroundUrl || ''
        },
        amount: reserved.amount===undefined?Number((Number(plan.price)*orderQuantity).toFixed(2)):Number(reserved.amount),
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
      let cancellation;
      try{cancellation=await store.cancelCustomerReservation(reservationId,checkoutKey,`customer:${security.ipHash(clientIp(request)).slice(0,12)}`);}
      catch(error){
        if(error.code!=='RESERVATION_NOT_FOUND')throw error;
        if(typeof store.missingReservationIsClear!=='function'||!await store.missingReservationIsClear(reservationId,checkoutKey))throw error;
        cancellation={status:'absent',idempotent:true,serverVerifiedAbsent:true};
      }
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
      await options.reservedAccountPrice?.(request,reservationId);
      const order = await store.getOrderByReservation(reservationId);
      if (order) {
        publicJson(request, response, 200, { state: "submitted", order: await orderResult(order) });
        return true;
      }
      if (reservation.status !== "reserved" || Date.parse(reservation.expires_at) <= Date.now()) {
        publicJson(request, response, 200, { state: "expired" });
        return true;
      }
      if(config.productCardPaymentsPaused)throw productCardPaymentUnavailable();
      const method = await store.rawMethod(reservation.method_id);
      // A reload may recover only an authenticated, reservation-bound proof.
      // Never trust sessionStorage as evidence that Storage actually contains it.
      let receiptUploadToken;
      if (body.receiptUploadToken) {
        const receipt = uploadedReceipt(body.receiptUploadToken, reservationId, checkoutKey);
        await store.verifyUploadedReceipt(receipt.path, receipt.size);
        receiptUploadToken = body.receiptUploadToken;
      }
      publicJson(request, response, 200, {
        state: "reserved", productId: reservation.product_id, planIndex: Number(reservation.plan_id),
        reservation: {
          reservationId, expiresAt: reservation.expires_at,
          ...(receiptUploadToken ? {receiptUploaded:true,receiptUploadToken} : {}),
          amount: Number(reservation.amount), currency: reservation.currency,
          method: {
            id: method.id, displayName: method.display_name, providerName: method.provider_name,
            holderName: method.holder_name,
            number: publicPaymentNumber(security.decryptNumber(method.encrypted_number), method.method_type),
            type: method.method_type, color: method.color, theme: resolvedPaymentTheme(method),
            backgroundUrl: (await withBackground(method)).backgroundUrl || ''
          }
        }
      });
      return true;
    }
    if (request.method === 'POST' && url.pathname === '/api/payments/receipts/discard') {
      await publicRate(request, 'receipt-discard', 600, 30);
      const body = await readBody(request, 20000);
      const reservationId = safeUuid(body.reservationId), checkoutKey = safeUuid(body.checkoutKey);
      const receipt = uploadedReceipt(body.receiptUploadToken, reservationId, checkoutKey);
      await store.checkoutReservation(reservationId, checkoutKey);
      // Do not race an in-flight final submission by deleting a valid capability's object.
      // Unlinked pending objects are collected only after every capability has expired.
      publicJson(request,response,200,{ok:true}); return true;
    }
    if (request.method === "POST" && ['/api/payments/orders','/api/payments/receipts'].includes(url.pathname)) {
      const uploadOnly = url.pathname === '/api/payments/receipts';
      if(config.productCardPaymentsPaused&&uploadOnly)throw productCardPaymentUnavailable();
      if(!uploadOnly&&options.accountForCheckout&&!await options.accountForCheckout(request))throw Object.assign(Error('Sifarişi tamamlamaq üçün hesabınıza daxil olun.'),{status:401,code:'CHECKOUT_LOGIN_REQUIRED'});
      await publicRate(request, uploadOnly ? 'receipt-upload' : 'submit', 3600, uploadOnly ? 30 : 10);
      const contentType = String(request.headers["content-type"] || "");
      let body;
      let receipt;
      let checkpoint=performance.now();request.receiptTimings={};
      request.receiptStage='receive';
      if (contentType.toLowerCase().startsWith("multipart/form-data;")) {
        if (typeof readRawBody !== "function") throw Object.assign(new Error("Fayl yükləmə xidməti hazır deyil."), { status: 503 });
        let rawBody;
        try {
          rawBody = await readRawBody(request, config.maxReceiptBytes + 150_000);
        } catch (error) {
          if (Number(error?.status) === 413) throw Object.assign(new Error("Fayl 5 MB-dan böyükdür. Şəkli sıxışdırıb yenidən seçin."), { status: 413, code: "RECEIPT_TOO_LARGE" });
          throw error;
        }
        ({ body, receipt } = await paymentOrderFromMultipart(rawBody, contentType, config.maxReceiptBytes,(size,format)=>{request.receiptSize=size;request.receiptFormat=format;}));
      } else {
        body = await readBody(request, Math.ceil(config.maxReceiptBytes * 1.42) + 100_000);
        if (body.receiptUploadToken) {
          receipt = uploadedReceipt(body.receiptUploadToken, safeUuid(body.reservationId), safeUuid(body.checkoutKey));
        } else receipt = receiptFromPayload(body.receipt, config.maxReceiptBytes);
      }
      request.receiptTimings.receive=performance.now()-checkpoint;checkpoint=performance.now();
      request.receiptSize=receipt.buffer?.length||receipt.size||0;request.receiptFormat=receipt.extension||'unknown';
      request.receiptStage='reservation';
      const reservationId = safeUuid(body.reservationId);
      const checkoutKey = safeUuid(body.checkoutKey);
      const idempotencyKey = safeUuid(request.headers["x-idempotency-key"]);
      if (!checkoutKey) throw Object.assign(new Error("Ödəniş səhifəsi yenilənib. Səhifəni yeniləyib yenidən cəhd edin; rezerviniz qorunur."), { status: 400 });
      if (!reservationId || !checkoutKey || !idempotencyKey || body.consentAccepted !== true) throw Object.assign(new Error("Rezerv, checkout açarı və məcburi razılıq tələb olunur."), { status: 400 });
      let reservation;
      try{reservation=await store.checkoutReservation(reservationId, checkoutKey);}catch(error){if([401,403,404].includes(Number(error.status)))throw Object.assign(Error('Ödəniş sessiyası uyğun deyil. Kart seçimini yenidən açın.'),{status:409,code:'RECEIPT_SESSION_INVALID'});throw error;}
      const accountBoundPrice=await options.reservedAccountPrice?.(request,reservationId);
      if (reservation.product_id !== body.productId || reservation.plan_id !== String(body.planIndex)) {
        throw Object.assign(new Error("Təkrar sorğu əvvəlki sifarişlə uyğun deyil."), { status: 409 });
      }
      const existing = await store.getOrderByReservation(reservationId);
      request.receiptTimings.binding=performance.now()-checkpoint;checkpoint=performance.now();
      const assertActive=r=>{if(r.status!=='reserved'||Date.parse(r.expires_at)<=Date.now())throw Object.assign(new Error(Date.parse(r.expires_at)<=Date.now()?'Rezervin vaxtı bitib. Kart seçimini yenidən açın.':'Rezerv artıq aktiv deyil. Kart seçimini yenidən açın.'),{status:409,code:'RECEIPT_RESERVATION_INVALID'});};
      if(config.productCardPaymentsPaused&&!existing)throw productCardPaymentUnavailable();
      if(!existing)assertActive(reservation);
      // Emergency upload-only policy: decoding/PDF security is mandatory; OCR is not.
      request.receiptStage='file_safety';
      if(!uploadOnly&&!existing&&receipt.buffer)await validateFile(receipt);
      request.receiptTimings.fileSafety=performance.now()-checkpoint;checkpoint=performance.now();
      if (uploadOnly) {
        if (existing || !receipt.buffer || reservation.status !== 'reserved' || Date.parse(reservation.expires_at) <= Date.now()) {
          throw Object.assign(new Error('Bu rezerv üçün çek yükləmək mümkün deyil.'), {status:409,code:'RECEIPT_RESERVATION_INVALID'});
        }
        const attemptKey=reservationId+':'+security.hashToken(checkoutKey)+':'+receipt.sha256;
        let attempt=receiptAttempts.get(attemptKey);
        if(!attempt){
          attempt={stage:'file_safety'};receiptAttempts.set(attemptKey,attempt);
          attempt.promise=(async()=>{
            await validateFile(receipt);request.receiptTimings.fileSafety=performance.now()-checkpoint;checkpoint=performance.now();
            attempt.stage='reservation_recheck';assertActive(await store.checkoutReservation(reservationId,checkoutKey));
            const path=`pending/${reservationId}/${receipt.sha256}.${receipt.extension}`;
            attempt.stage='storage';
            try{await store.uploadReceipt(path,receipt);}catch(error){try{await store.verifyUploadedReceipt(path,receipt.buffer.length);}catch{throw error;}}
            attempt.stage='storage_verify';await store.verifyUploadedReceipt(path,receipt.buffer.length);
            attempt.stage='reservation_recheck';assertActive(await store.checkoutReservation(reservationId,checkoutKey));
            return {purpose:'payment-receipt',reservationId,checkoutHash:security.hashToken(checkoutKey),path,sha256:receipt.sha256,extension:receipt.extension,mimeType:receipt.mimeType,size:receipt.buffer.length,expiresAt:Date.now()+3600000,safetyVersion:1};
          })().catch(error=>{error.receiptStage=attempt.stage;throw error;}).finally(()=>receiptAttempts.delete(attemptKey));
        }
        request.receiptAttempt=attempt;request.receiptStage='upload_wait';const proof=await attempt.promise;
        request.receiptStage='complete';request.receiptTimings.storage=performance.now()-checkpoint;
        publicJson(request,response,200,{receiptUploaded:true,receiptUploadToken:security.encryptSecret(JSON.stringify(proof)),autoSubmit:false,contentChecked:false,paymentVerified:false});
        return true;
      }
      if (existing) {
        request.receiptStage='order_readback';
        if (body.receiptUploadToken) await store.verifyUploadedReceipt(existing.receipt_path, existing.receipt_size);
        publicJson(request, response, 200, await orderResult(existing, true, body.whatsappExtraText));
        return true;
      }
      const { product, plan, planIndex } = await catalogSelection(safeText(body.productId, 100), body.planIndex);
      const boundPrice=accountBoundPrice;
      const checkoutMetadata=config.employeeEnabled ? {unitPrice:boundPrice??Number(plan.price),signature:signature(plan),sourcePlanKey:planKey(plan,planIndex)} : null;
      // Same reservation + identical validated bytes always target one private
      // object, even if a timeout hides a successful storage response.
      const receiptPath = receipt.path || `${reservationId}/${receipt.sha256}.${receipt.extension}`;
      if (receipt.buffer) await store.uploadReceipt(receiptPath, receipt);
      else await store.verifyUploadedReceipt(receiptPath, receipt.size);
      let submitted;
      let browserOwnerHash=null;
      request.receiptStage='account_session';
      const accountUserId=options.accountForCheckout?await options.accountForCheckout(request):null;
      request.receiptStage='history_session';
      if(browserOrders.enabled){await browserOrders.ready();browserOwnerHash=browserOrders.read(request);if(!browserOwnerHash)throw Object.assign(Error('Ödəniş sessiyası yenilənməlidir. Kart seçimini yenidən açın.'),{status:409,code:'BROWSER_SESSION_REQUIRED'});}
      try {
        request.receiptStage='order_commit';
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
          receiptSize: receipt.size || receipt.buffer.length,
          receiptSha256: receipt.sha256,
          durationMonths: structuredDurationMonths(plan)
          ,checkoutMetadata
          ,browserOwnerHash
          ,accountUserId
        });
      } catch (error) {
        request.receiptStage='order_reconcile';
        // A lost RPC response is not proof of rollback. Never delete a possibly linked receipt.
        const reconciled = await store.getOrderByReservation(reservationId).catch(() => null);
        if (reconciled) {
          if(accountUserId){const account=await options.accountHistory(request);if(account.userId!==accountUserId||!await account.owned(reconciled.id))throw Object.assign(Error('Sifariş hesabı ilə əlaqə təsdiqlənmədi.'),{status:409,code:'ACCOUNT_ORDER_OWNER_MISMATCH'});}
          if(browserOwnerHash&&!await store.browserOwnedOrder(browserOwnerHash,reconciled.id))throw Object.assign(Error('Sifariş tarixçəsi ilə əlaqə təsdiqlənmədi. Yenidən cəhd edin.'),{status:503,code:'BROWSER_OWNERSHIP_UNCONFIRMED'});
          if (reconciled.receipt_path !== receiptPath) await store.removeReceipt(receiptPath).catch(() => {});
          submitted = { id: reconciled.id, idempotent: true };
        } else {
          if (error.status >= 400 && error.status < 500) await store.removeReceipt(receiptPath).catch(() => {});
          throw error;
        }
      }
      request.receiptStage='order_readback';
      const order = await store.getOrder(submitted.id);
      if (submitted.idempotent && order.receipt_path !== receiptPath) await store.removeReceipt(receiptPath).catch(() => {});
      const method = await store.rawMethod(order.method_id);
      if (submitted.idempotent) {
        request.receiptStage='response_prepare';
        publicJson(request, response, 200, await orderResult(order, true, body.whatsappExtraText));
        return true;
      }
      const reviewToken = security.randomToken();
      const reviewUrl = `${config.adminBaseUrl}/admin/review?token=${encodeURIComponent(reviewToken)}`;
      try {
        request.receiptStage='notification_queue';
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
      request.receiptStage='response_prepare';
      const result = await orderResult(order, false, body.whatsappExtraText);
      request.receiptStage='complete';
      publicJson(request, response, 201, result);
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

    if(['/api/admin/payment-bank-backgrounds','/api/admin/payment-backgrounds'].includes(url.pathname)&&request.method==='GET'){
      if(!bankBackgrounds)throw Object.assign(new Error('Bank fonu xidməti əlçatan deyil.'),{status:503});
      json(response,200,{banks:BANKS,elements:DECORATIONS,backgrounds:await bankBackgrounds.list(true)});return true;
    }
    const bankWrite=url.pathname.match(/^\/api\/admin\/(?:payment-bank-backgrounds|payment-backgrounds)\/(kapital|m10|abb|leo|wallet-card)(\/remove)?$/);
    if(bankWrite&&request.method==='POST'){
      if(!bankBackgrounds)throw Object.assign(new Error('Bank fonu xidməti əlçatan deyil.'),{status:503});
      const backgrounds=bankWrite[2]?await bankBackgrounds.remove(bankWrite[1]):await bankBackgrounds.write(bankWrite[1],await readRawBody(request,5242880),request.headers['content-type']);
      json(response,200,{backgrounds});return true;
    }

    if(url.pathname==='/api/admin/payment-sale-state'){
      if(!options.readyStockAllowed?.(request))throw Object.assign(Error('Bu əməliyyat yalnız adminə açıqdır.'),{status:403});
      response.setHeader('Cache-Control','private, no-store');
      if(request.method==='GET'){
        const [catalog,rows]=await Promise.all([loadCatalog(),readInventory({fresh:true})]);
        const product=catalog.products.find(p=>p.id===url.searchParams.get('productId'));
        if(!product)throw Object.assign(Error('Məhsul canlı kataloqda tapılmadı.'),{status:404});
        const availability=inventoryAvailability(product,rows.find(row=>row.productId===product.id));
        json(response,200,{paused:availability.salePaused??availability.salesDisabled});return true;
      }
      if(request.method==='POST'){
        const body=await readBody(request,10000),catalog=await loadCatalog();
        if(typeof body.paused!=='boolean'||!catalog.products.some(p=>p.id===body.productId))
          throw Object.assign(Error('Məhsul canlı kataloqda tapılmadı və ya stok seçimi düzgün deyil.'),{status:400});
        await store.setSalePaused(body.productId,body.paused);
        readInventory.invalidate();
        storefront=undefined;
        json(response,200,{paused:body.paused});return true;
      }
    }
    if(url.pathname==='/api/admin/payment-inventory'){
      if(request.method==='GET'){json(response,200,{products:await inventoryView()});return true;}
      if(request.method==='POST'){const b=await readBody(request,10000),key=safeUuid(request.headers['x-idempotency-key']);const c=await loadCatalog();if(!key||b.confirm!==true||!(b.available===null||(Number.isSafeInteger(b.available)&&b.available>=0&&b.available<=10000))||!Number.isSafeInteger(b.expectedVersion)||!c.products.some(p=>p.id===b.productId&&(b.planKey==null||(typeof b.planKey==='string'&&/^\d+$/.test(b.planKey)&&p.plans?.[Number(b.planKey)]))))throw Object.assign(new Error('Məhsul, stok miqdarı və təsdiq tələb olunur.'),{status:400});json(response,200,await store.setInventory(b.productId,b.available,actorName,key,b.expectedVersion,b.planKey??null));return true;}
    }
    if(['/api/admin/payment-ready-stock','/api/admin/payment-ready-stock/sales','/api/admin/payment-ready-stock/message'].includes(url.pathname)&&options.readyStockAllowed){
      if(!options.readyStockAllowed(request))throw Object.assign(new Error('Bu bölmə yalnız adminə açıqdır.'),{status:403});
      response.setHeader('Cache-Control','private, no-store');
      const catalog=await loadCatalog();
      if(url.pathname.endsWith('/message')){
        if(request.method!=='POST')return false;
        json(response,200,await options.saveProductMessage(security,catalog,await readBody(request,50_000)));return true;
      }
      if(url.pathname.endsWith('/sales')&&request.method==='POST'){
        const b=await readBody(request,10000),id=safeUuid(b.requestId),p=catalog.products.find(x=>x.id===b.productId&&x.active!==false),plan=p?.plans?.[b.index];
        if(!id||!Number.isSafeInteger(b.index)||!Number.isSafeInteger(b.expectedVersion)||!plan||signature(plan)!==b.planSignature||!(b.available===null||(Number.isSafeInteger(b.available)&&b.available>=0&&b.available<=10000)))throw Object.assign(new Error('Məhsul, paket və stok miqdarı düzgün deyil.'),{status:400});
        const inventory=await readInventory({fresh:true}),scope=inventory.find(x=>x.productId===p.id)?.scope;
        json(response,200,await store.setInventory(p.id,b.available,actorName,id,b.expectedVersion,scope==='plan'?String(b.index):null));return true;
      }
      if(url.pathname.endsWith('/sales'))return false;
      if(request.method==='GET'){
        const inventory=await readInventory({fresh:true});
        json(response,200,await options.readyStock(catalog,catalog.products.map(p=>inventoryAvailability(p,inventory.find(i=>i.productId===p.id))),security));return true;
      }
      if(request.method==='POST'){
        json(response,200,await options.saveReadyStock(security,config.tokenSecret,catalog,actorName,await readBody(request,700000)));return true;
      }
    }

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
      const started = performance.now();
      const query=Object.fromEntries(url.searchParams), canDeliver=options.readyStockAllowed?.(request);
      const deliveryQueue=query.tab==='pending'&&query.pendingStage==='delivery';
      if(deliveryQueue&&!canDeliver)throw Object.assign(new Error('Təhvil yalnız adminə açıqdır.'),{status:403});
      const catalogRequest = query.countsOnly==='true' ? Promise.resolve(null) : loadCatalog();
      void catalogRequest.catch(()=>{});
      const matchingProducts=query.productId?(await catalogRequest)?.products:[];
      const listingStarted = performance.now();
      const orders = await store.listOrders(query, matchingProducts || [], {pendingDeliveries:canDeliver?options.pendingDeliveries:undefined,pendingDeliveryProgress:canDeliver?options.pendingDeliveryProgress:undefined,deliveryCompletions:canDeliver?options.deliveryCompletions:undefined});
      const listingMs = performance.now()-listingStarted;
      if(query.countsOnly==='true'){json(response,200,orders);return true;}
      const pendingCustomerView=query.tab==='pending'&&Boolean(query.pendingStage);
      const customersTask=(async()=>{
      if(canDeliver&&options.orderCustomers&&orders.orders.length&&(pendingCustomerView||query.includeCustomer==='true')){
        try{
          const customers=new Map((await options.orderCustomers(orders.orders.map(o=>o.id))).map(o=>[o.id,o]));
          for(const order of orders.orders){const customer=customers.get(order.id);order.customerName=customer?.name||null;order.customerNumber=customer?.memberNumber||null;}
        }catch(error){if(pendingCustomerView)throw error; /* Optional display metadata must not block the history list. */}
      }})();
      const pendingTask=(async()=>{
      if(!deliveryQueue&&options.pendingDeliveries&&canDeliver){
        const candidates=(orders.orders||[]).filter(o=>o.paymentConfirmed||['approved','completed'].includes(o.status));
        if(candidates.length){
          try{const pending=new Set(await options.pendingDeliveries(candidates.map(o=>o.id)));for(const order of candidates)order.deliveryPending=pending.has(order.id);}
          catch{ /* Keep the protected delivery dialog as a fallback during an outage. */ }
        }
      }})();
      const workforceTask=(async()=>{
        if(!config.employeeEnabled||!orders.orders.length)return;
        const workflow=await store.workforceOrders(orders.orders.map(o=>o.id));
        for(const order of orders.orders)order.workforce=workflow.get(order.id)||null;
      })();
      await Promise.all([customersTask,pendingTask,workforceTask]);
      const catalog=await catalogRequest;
      orders.permissions={fields:!!canDeliver,manage:!!canDeliver};
      orders.filters ||= {};
      orders.filters.products = (catalog?.products || [])
        .filter((product) => product && product.active !== false && product.id)
        .map((product) => ({ id: safeText(product.id, 100), title: safeText(product.title || product.name || "Məhsul", 160) }))
        .sort((a, b) => a.title.localeCompare(b.title, "az"));
      json(response, 200, orders, {"Server-Timing":`orders;dur=${listingMs.toFixed(1)}, total;dur=${(performance.now()-started).toFixed(1)}`}); return true;
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
    const orderMatch = url.pathname.match(/^\/api\/admin\/payment-orders\/([0-9a-f-]+)(?:\/(approve|reject|contacted|receipt|details|delivery|cancel-fulfillment))?$/i);
    if (orderMatch) {
      const id = safeUuid(orderMatch[1]);
      if (!id) throw Object.assign(new Error("Sifariş ID-si düzgün deyil."), { status: 400 });
      const action = orderMatch[2];
      if(action==='cancel-fulfillment'&&options.cancelFulfillment&&['GET','POST'].includes(request.method)){
        if(!options.readyStockAllowed?.(request))throw Object.assign(Error('Ləğv yalnız adminə açıqdır.'),{status:403});
        response.setHeader('Cache-Control','private, no-store');
        const input=request.method==='POST'?await readBody(request,10000):null;
        if(request.method==='POST'&&!/^[a-f0-9]{64}$/.test(input?.previewToken||''))throw Object.assign(Error('Ləğv təsdiqi tələb olunur.'),{status:400});
        json(response,200,await options.cancelFulfillment(actorName,id,input));return true;
      }
      if(['receipt','approve','reject'].includes(action)&&options.readyStockAllowed&&!options.readyStockAllowed(request))throw Object.assign(new Error('Sifariş əməliyyatı yalnız adminə açıqdır.'),{status:403});
      if(action==='delivery'&&options.customerDelivery&&['GET','POST'].includes(request.method)){
        if(options.readyStockAllowed&&!options.readyStockAllowed(request))throw Object.assign(new Error('Təhvil yalnız adminə açıqdır.'),{status:403});
        response.setHeader('Cache-Control','private, no-store');
        const input=request.method==='POST'?await readBody(request,50_000):null;
        const started=performance.now();
        const result=await options.customerDelivery(security,actorName,id,input);
        json(response,200,result,input?undefined:{"Server-Timing":`delivery;dur=${(performance.now()-started).toFixed(1)}`});return true;
      }
      if (action === "details" && ["GET","POST"].includes(request.method)) {
        if(!options.readyStockAllowed?.(request))throw Object.assign(new Error('Sifariş sahələri yalnız adminə açıqdır.'),{status:403});
        response.setHeader('Cache-Control','private, no-store');
        const reveal=request.method==='POST'?await readBody(request,1000):null;
        if(request.method==='POST'&&(!Number.isSafeInteger(reveal?.line)||reveal.line<0||!Number.isSafeInteger(reveal.field)||reveal.field<0))throw Object.assign(new Error('Sifariş sahəsi düzgün deyil.'),{status:400});
        const order=await store.getOrder(id),catalog=await loadCatalog();
        let lines;
        try{lines=adminOrderFields(order,catalog,security,reveal);}catch{throw Object.assign(new Error('Sifariş sahələri açıla bilmədi.'),{status:503});}
        if(reveal){
          const field=lines[reveal.line]?.fields[reveal.field];
          if(!field?.sensitive||field.value===null)throw Object.assign(new Error('Sifariş sahəsi tapılmadı.'),{status:404});
          json(response,200,{value:field.value});return true;
        }
        json(response,200,{lines});return true;
      }
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
        let result;
        if(options.approveCardWithReadyStock && options.readyStockAllowed?.(request) && (order.payment_source || 'card')==='card'){
          try{result=await options.approveCardWithReadyStock(security,id,durationMonths,actorName,config.employeeEnabled);}
          catch(error){throw paymentError({message:/^[A-Z_]+$/.test(error.message||'')?error.message:undefined});}
        }else result=await store.approveOrder(id, durationMonths, actorName);
        json(response, 200, { ...result, status: result.status === "approved" ? (result.deliveryPending?'preparing':'completed') : result.status }); return true;
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
    shop,
    store,
    mailer,
    async guardLogin(request) {
      await store.rateLimit(`admin-login:${security.ipHash(clientIp(request))}`, 15 * 60, 12);
    },
    start() {
      mailer.start();
      const cleanup = () => store.cleanupExpiredReceipts().then(()=>shop?.cleanup()).catch((error) => console.error("Payment receipt cleanup", error.code || 'CLEANUP_FAILED'));
      const stagedCleanup = () => store.cleanupStagedReceipts().catch(error=>console.error('Receipt staging cleanup',error.code || 'STORAGE_ERROR'));
      setTimeout(cleanup, 15_000).unref?.();
      setTimeout(stagedCleanup, 30000).unref?.();
      const timer = setInterval(cleanup, 6 * 60 * 60_000);
      timer.unref?.();
      setInterval(stagedCleanup, 60 * 60_000).unref?.();
    },
    async handle(request, response) {
      const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
      if(['/api/payments/receipts','/api/payments/orders'].includes(url.pathname)&&request.method==='POST'){
        request.receiptTrace=safeUuid(request.headers['x-upload-trace'])||randomUUID();request.receiptStage='request';
        const started=performance.now();let logged=false;const log=closed=>{if(logged)return;logged=true;console.info('Receipt attempt',JSON.stringify({traceId:request.receiptTrace,stage:request.receiptStage==='upload_wait'?request.receiptAttempt?.stage||'upload_wait':request.receiptStage,status:closed?499:response.statusCode,code:request.receiptCode||(closed?'RECEIPT_CLIENT_DISCONNECTED':'RECEIPT_STORED'),size:Number.isSafeInteger(request.receiptSize)?request.receiptSize:null,format:/^(jpg|png|pdf|unknown)$/.test(request.receiptFormat||'')?request.receiptFormat:'unknown',ms:Math.round(performance.now()-started)}));};
        response.once('finish',()=>log(false));response.once('close',()=>log(!response.writableFinished));
      }
      try {
        if (url.pathname.startsWith("/api/payments/")) return await handlePublic(request, response, url);
        if (url.pathname.startsWith("/api/admin/payment") || url.pathname.startsWith("/api/admin/capcut")) return await handleAdmin(request, response, url);
        return false;
      } catch (error) {
        if(error.message==='PRODUCT_SALE_PAUSED')error=Object.assign(Error('Məhsul stokda yoxdur.'),{status:409,code:'PRODUCT_SALE_PAUSED'});
        const isPublic = url.pathname.startsWith("/api/payments/");
        const status = errorStatus(error);
        if(request.receiptTrace){request.receiptStage=error.receiptStage||request.receiptStage;request.receiptCode=/^[A-Z_]+$/.test(error.code||'')?error.code:'PAYMENT_ERROR';}
        if(['/api/payments/receipts','/api/payments/orders'].includes(url.pathname))console.error('Payment upload',JSON.stringify({stage:request.receiptStage||'request',status,code:/^[A-Z_]+$/.test(error.code||'')?error.code:'PAYMENT_ERROR',diagnostic:/^(?:file_safety:RECEIPT_[A-Z_]+|storage_(?:upload|verify):http_\d{1,3})$/.test(error.diagnostic||'')?error.diagnostic:undefined}));
        else console.error("Payment API", error.code || "PAYMENT_ERROR", error.diagnostic || error.message);
        if (isPublic) publicJson(request, response, status, { error: error.message, code: error.code || "PAYMENT_ERROR", ...(Array.isArray(error.reasonCodes)?{reasonCodes:error.reasonCodes}:{} ) });
        else json(response, status, { error: error.message, code: error.code || "PAYMENT_ERROR" });
        return true;
      }
    }
  };
}
