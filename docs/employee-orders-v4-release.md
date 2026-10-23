# İşçi sifarişləri — schema 4, production buraxılışı DAYANDIRILIB

## Dəyişən faylların tam siyahısı (repository kökünə nəzərən)

- `mirpanel-admin/employee-api.mjs`
- `mirpanel-admin/employee-order-status.mjs`
- `mirpanel-admin/payment-api.mjs`
- `mirpanel-admin/payment-store.mjs`
- `mirpanel-admin/server.mjs`
- `mirpanel-admin/public/employee.js`
- `mirpanel-admin/public/employee-review-admin.js`
- `mirpanel-admin/public/payment-admin.js`
- `order-confirmation.js` — yalnız mövcud confirmation status sətri; checkout/WhatsApp mesajı dəyişmir
- `scripts/employee-http-fixture.mjs`
- `scripts/test-employee-admin-bridge.mjs`
- `scripts/test-employee-browser.mjs`
- `scripts/test-employee-review.mjs`
- `scripts/test-employee-review-browser.mjs`
- `scripts/test-employee-orders-http.mjs`
- `scripts/test-employee-orders-postgres.mjs`
- `scripts/test-employee-orders-browser.mjs`
- `scripts/test-employee-orders-gate.mjs`
- `supabase/migrations/202610230001_employee_orders.sql`
- `supabase/rollback/202610230001_employee_orders.sql`
- `supabase/employee-orders-v4-verify.sql`
- `docs/employee-orders-v4-release.md`

Əlaqəsiz lokal `test-header-product-media.mjs` və `test-splash.mjs` dəyişiklikləri
qorunub, bu işin commitinə daxil edilmir. Ana səhifə/Story/banner/qiymət diff-i 0.
Lokal əvvəlki mənbə backup-u: `outputs/employee-orders-v4-20261023/pre-change-source.zip`.
SHA256: `CCDE499D79F1738AFA6A137EC39424E0E71E4888755EE2DB953ECE51A82341CE`.

## Faktiki səbəb və scope

2026-10-23 read-only production probe: schema 3; health 200; public checkout
`customerDetailsRequired=false`; sessiyasız employee/admin API 401; employee route
302 `/employee/login`; admin login/workforce 200. Production əməliyyat yazısı yoxdur.

Schema 3 `employee_order_action_v3` qəbul/çek yoxlamasını customer_name/phone və
canonical_plan_id ilə bloklayırdı; təqdimat üçün stok, mesaj snapshot-u və sent
mərhələləri tələb olunurdu. Ayrı admin/employee sahiblik qeydi yox idi. Əsas admin
kartı işçiyə uyğun sifarişləri `/admin/workforce` səhifəsinə yönləndirirdi.

Schema 4 yalnız sifariş əməliyyatını genişləndirir. Yeni stok, maaş, məhsul,
statistika, WhatsApp adapteri və hesab yaratmır. Mövcud inventory/bonus cədvəlləri
və şifrələmə açarları qorunur. Köhnə sifarişlər yenidən yazılmır və aid edilmir.

## Model və transaction

`employee_order_claims`: canonical order_id PRIMARY KEY, owner_role, owner_ref,
employee_id, DB saatından claimed_at. Bir payment_orders qeydi hər iki paneldə
görünür. Employee assignment əvvəlki cədvəldə saxlanır, admin claim assignment
və bonus yaratmır. NULL ad/nömrə qəbul/verify/submit üçün maneə deyil. Manual
təqdimat üçün stok və yeni WhatsApp məlumatı tələb olunmur.

NEW → Üzərinə götür → EMPLOYEE_ACCEPTED → çek yoxlanışı → Təqdim etdim
→ DELIVERED_PENDING_ADMIN → yalnız admin → COMPLETED (canonical payment approved).
Review → məcburi səbəblə RETURNED_TO_EMPLOYEE → yenidən Təqdim etdim → review.
Admin claim: NEW → Admin icra edir → mövcud admin approval axını.

Qəbul, təqdimat, return və complete transaction daxilində order FOR UPDATE və
canonical payment advisory lock ilə qorunur. Idempotency actor+UUID açarına,
order/action/role/employee/quantity/details/review dövrünə bağlıdır. Eyni retry
eyni nəticəni qaytarır, fərqli payload və köhnə review-dövrü açarı conflict verir.
Müxtəlif açarlı paralel keçiddə yalnız biri uğurludur. Bonus order_id unique qalır.
Ödəniş yoxlanışı və employee submit status/finance/sales/completed_at dəyişmir.

Əvvəldən ayrılmış stok varsa submit mövcud rezervi qoruyur, completion yalnız
həmin vahidləri DELIVERED edir; stok yaratmır/ikinci dəfə ayırmır. Köhnə stock RPC
əməliyyatları private schema-3 rutinləri vasitəsilə uyğunluq üçün saxlanır, yeni
Orders UI-də stok/mesaj idarəsi göstərilmir.

## API və icazələr

| Route | Employee | Admin |
|---|---|---|
| POST /api/employee/login | ayrıca login/cookie, admin sessiyası lazım deyil | employee cookie yaratmır |
| GET /api/employee/orders | yalnız startdan sonrakı uyğun növbə/öz sifarişləri | admin cookie bu sessiyanı əvəz etmir |
| POST /api/employee/orders/:id/accept | atomik götürür | employee route admin sessiyası ilə 401 |
| POST /api/employee/orders/:id/verify | yalnız öz aktiv sifarişində | admin verify 403 |
| POST /api/employee/orders/:id/submit | delivered=true; yalnız review | employee tamamlaması deyil |
| POST /api/admin/workforce/orders/:id/claim | 403 | atomik admin claim |
| GET /api/admin/workforce/orders/:id/review | 403 | məlumat, masked bank, vaxtlar, audit |
| POST /api/admin/workforce/orders/:id/complete | 403 | yeganə yekun review təsdiqi |
| POST /api/admin/workforce/orders/:id/return | 403 | ən azı 3 simvolluq səbəb |
| GET .../receipt | səlahiyyətli sifariş, signed URL | səlahiyyətli signed URL |

Sessiyasız API 401; employee → admin route/API 403. CSRF, HttpOnly/SameSite,
session revocation və rate limit saxlanır. Yeni public SQL execute/table icazəsi
yoxdur. Server yalnız schema >=4 olduqda employee funksiyalarını açır.

Əsas admin naviqasiyası dəyişmir. Review sayğacı və siyahısı yalnız mövcud
paymentOrdersView daxilindədir. Kartda sahiblik, employee adı/vaxtları və Yoxla
var. Adminin köhnə approval imkanı qalır; employee-owned order yalnız review ilə
yekunlaşa bilər. Employee Orders səhifəsi 3 saniyəlik mövcud poll ilə yenilənir.

## Public checkout və status

Ad/WhatsApp/quantity inputları yoxdur, quantity=1, customer sahələri NULL qala
bilir. Kart seçimi, məbləğ, çek token/storage yoxlaması, sifariş nömrəsi və WhatsApp
mesajının məzmunu dəyişmir. Yeni nömrə və avtomatik mesaj yoxdur.
Mövcud capability-protected checkout/resume cavabına yalnız statusMessage əlavə
olunur. Mövcud confirmation sahəsi həmin statusu göstərir və görünən halda 15
saniyədən bir eyni read-only resume sorğusu ilə yeniləyir; yeni order/reserve yoxdur.
Review: “Sifarişiniz təqdim edilib. Admin təsdiqi gözlənilir.”
Yalnız canonical approved/completed: “Sifarişiniz uğurla tamamlandı.”

## Backup, migration, rollback

Yalnız `supabase/migrations/202610230001_employee_orders.sql` işlədilir.
Schema 3 və əvvəlki employee-release.sql TƏKRAR İŞLƏDİLMİR.

SQL transaction əvvəlcə uyğun schema-nı yoxlayır, bounded lock_timeout və canonical
payment lock alır. Aşağıdakı 7 cədvəli consistent SHARE lock altında private
`employee_orders_release_20261023` schema-sına bir dəfə backup edir:
payment_orders, employee_order_assignments, employee_order_bonus_events,
employee_requests, employee_work_audit, employee_accounts, employee_stock_units.
Function definitions də saxlanır. Manifest count/backup count eyniliyi transaction
daxilində yoxlanır. Retry backup-u yeniləmir. Sütun/sifariş/media silinmir.
Private backup-a public/anon/authenticated və service_role çıxışı verilmir.

`supabase/employee-orders-v4-verify.sql`: yalnız oxuyan schema=4, 7 manifest və
public icazə yoxlaması. Real PostgreSQL testində ilk tətbiq/ikinci tətbiq, ortada
süni failure, əvvəlki order snapshot-u və manifest bərabərliyi təsdiqlənir.

`supabase/rollback/202610230001_employee_orders.sql`: yalnız saxlanmış schema-3
rutinlərini bərpa edir, v4 execute icazəsini bağlayır; heç nə silmir. Açıq claim
varsa ROLLBACK_BLOCKED_OPEN_ORDER_CLAIMS ilə transaction dayanır. Belə halda əvvəl
açıq işləri normal admin axını ilə həll edin; məlumatı silib downgrade etməyin.
Real testdə finalized fixture-lər saxlanır və rollback-dən sonra legacy approval
yenə işləyir. Backend/frontend də uyğun schema-3 commitinə qaytarılmalıdır.

## Təkrarlanan lokal yoxlama

Yekun gate: **20/20 paket, 0 uğursuz paket, 804 sayğaclı assertion**.
Əlavə kart seçimi, çek upload, admin auth boundary, köhnə sifariş approval və
məhsul-spesifik sifariş izolasiya ssenariləri də keçib; onların assertion-ları
804 sayına əlavə edilməyib. İlkin 62 reporting yoxlaması qorunub və yenidən keçib.

Keçən paketlər:
`test-employee-reporting`, `test-employee-panel-db`, `test-employee-http`,
`test-employee-release`, `test-employee-admin-bridge`, `test-employee-key`,
`test-employee-real-postgres`, `test-employee-browser`, `test-employee-review`,
`test-employee-review-postgres`, `test-employee-review-browser`,
`test-employee-orders-http`, `test-employee-orders-postgres`,
`test-employee-orders-browser`, `test-public-checkout-no-customer`,
`test-payment-method-selection`, `test-payment-receipt-browser`,
`test-admin-auth-boundary`, `test-old-order-approval-database`,
`test-product-order-isolation`.

Schema-4 real PostgreSQL paketi: 66 yoxlama; iki ayrı backend bağlantısı;
boş schema-3 bazada migration/ikinci tətbiq/verify/rollback; fixture-li bazada
backup, transaction failure rollback, parallel claim/submit/complete, eyni açar
retry, fərqli açar conflict, köhnə review açarı, bağlantının öldürülməsi keçib.
Duplicate claim/sifariş/bonus/status audit və yarımçıq claim 0.
Əlavə v2/v3 real PostgreSQL paketləri 60 və 41 yoxlama ilə keçib; stock regression 0.
Səkkiz responsive ölçüdə overflow/JS exception/404 0, düymələr >=44px.
Null customer order-da qəbul düyməsi aktivdir; avtomatik yeni sifariş polling-i
və refresh-dən sonra sahiblik ayrıca yoxlanıb. UI screenshot-ları yalnız fixture-dir,
production schema 4 UI-si yayımlanmayıb.

`node scripts/test-employee-orders-gate.mjs` — lokal PostgreSQL port 55439 və
bundled Playwright/Chrome yolları ilə. Production host test bazası ola bilməz:
real PG helper yalnız 127.0.0.1 istifadə edir və random adlı disposable DB yaradır.
Gate JSON: `payment-test-artifacts/employee-orders-v4-gate.json`.
`reportedAssertions` yalnız sayğacı olan paketlərin dəqiq sayıdır; ayrıca kart/çek
scenario paketləri də keçməlidir. Uğursuz paket olduqda release qadağandır.
Screenshot-lar: `employee-orders-v4-20261023` visualizations qovluğu; əvvəl/sonra
390 px və 320/360/390/430/768/1024/1366/1440 px yoxlamaları.

## Manual gate və sonrakı buraxılış

Production SQL tətbiq edilməyib, push/deploy edilməməlidir. Sahib yalnız yuxarıdakı
migration və verify SQL-ni işlətdikdən sonra belə təsdiqləyir:
“Employee orders migration tətbiq edildi. Schema versiyası 4, backup manifest yoxlaması keçdi.”
Sonra ayrıca göstərişlə read-only schema yoxlanır, backend, ardınca frontend
yayımlanır. Confirmation JS üçün mövcud `_headers` no-cache/no-store qaydası
qorunur; buraxılışda backend/frontend asset uyğunluğu yenidən yoxlanır.
Mövcud PAYMENT_ENCRYPTION_KEY_B64/PAYMENT_TOKEN_SECRET_B64 və flag dəyişdirilmir.
Production employee hesabı, start, order, receipt, stock, payroll, bonus və WhatsApp
test məlumatı yaradılmır. Canlı authenticated employee yoxlaması yalnız sahibin
mövcud sessiyası ilə, şəxsi şifrəni çata/loga yazmadan aparılır.
