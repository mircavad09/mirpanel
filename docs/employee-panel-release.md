# İşçi Paneli — buraxılış və təhlükəsizlik qeydləri

## Faktiki vəziyyət

Kod, ayrıca UI, server API, migration/rollback və izolyasiya edilmiş testlər hazırlanıb.
Production SQL bağlantısı bu terminalda yoxdur. Production backup/migration **icra edilməyib**,
real işçi hesabı, sifariş, stok, maaş, rezerv və WhatsApp mesajı yaradılmayıb.
Production migration və ayrıca buraxılış icazəsinə qədər push/deploy saxlanılır; canlı panel yoxlanılmış sayılmır.
Mövcud ana səhifə, kataloq mənbəyi, qiymətlər, tarixi satış bölgüsü, Story və banner faylları dəyişmir.

## Sahibin etməli olduğu bir manual buraxılış addımı

Supabase SQL Editor-də **`supabase/employee-release.sql` faylının tam məzmununu bir sorğu kimi işlədin**.
Bu paket ardıcıllıqla legacy payment RPC-lərini yoxlayır, private backup alıb fingerprint/sayını yoxlayır,
iki migration-u REPEATABLE READ transaction-da tətbiq edir. Xəta olarsa transaction geri qaytarılır.
Sonda manifestdə `payment_orders` və `payment_reservations` backup sətirləri, schema version `2` görünməlidir.
Heç bir şifrə/açarı çata göndərməyin. Yalnız nəticəni təsdiqləyin.
Təsdiqdən sonra agent əvvəl nəticəni yoxlamalı, push/deploy üçün ayrıca göstərişi gözləməlidir.

Bu paket işçini avtomatik yaratmır/aktiv etmir. Buraxılışdan sonra sahibin normal istifadəsi:
`/admin/workforce` → İşçi hesabları → ayrıca şifrə ilə hesab yarat →
“İşçini aktiv et və hesablamanı başlat”. Start vaxtı yalnız DB serverindən gəlir.
Hesab yaratmaq və işə başlatmaq deploy üçün tələb edilən test əməliyyatı deyil.

## SQL, backup və geri qaytarma

- Tam tətbiq SQL-i: `supabase/employee-release.sql`.
- Ayrı migration-lar: `supabase/migrations/202610210001_employee_reporting.sql`, `supabase/migrations/202610210002_employee_panel.sql`.
- Backup mənbəyi: `supabase/employee-pre-release-backup.sql`.
- Tam rollback: `supabase/employee-release-rollback.sql`.
- Ayrı rollback-lər: `supabase/rollback/202610210002_employee_panel.sql`, `supabase/rollback/202610210001_employee_reporting.sql`.

Backup private `employee_pre_release_20261021` schema-sındadır; anon/authenticated/service_role daxil ola bilmir.
Mövcud payment orders/reservations, varsa köhnə CapCut/Netflix inventory və varsa employee cədvəlləri kopyalanır.
Snapshot təkrar işlədikdə əvəz edilmir; manifestdəki say/fingerprint yenidən yoxlanılır.
Məhsullar/planlar Git-dəki `app.js` CMS mənbəyindədir; bu buraxılış həmin faylı dəyişmir.
Sahib adminin əvvəlki environment əsaslı girişini yeni hesab cədvəlinə köçürmürük.

Rollback əvvəlcə Render-də `EMPLOYEE_PANEL_ENABLED=false` və uyğun əvvəlki tətbiq versiyasına qayıtma tələb edir.
Açıq işçi sifarişi varsa SQL təhlükəsiz dayanır; onu sahib tamamlamalı/ləğv etməlidir.
Rollback triggeri söndürür və yeni funksiyaların/cədvəllərin service-role icazəsini bağlayır.
Sifarişləri, hesabları, şifrəli stoku, audit/bonus ledgerini və əlavə sütunları **silmir**.
Backup bərpası avtomatik overwrite etmir; fərqlər yoxlanmadan canlı cədvəli snapshot-la əvəz etmək olmaz.

## Rol və route-lar

| Əməliyyat | Sessiyasız | employee | admin |
|---|---|---|---|
| İşçi login | Origin/rate-limit ilə açıq | ayrıca giriş | ayrıca giriş |
| İşçi dashboard/sifariş/məhsul/stok sayları/qazanc | 401 | yalnız icazəli DTO/öz dövrü | owner workforce API |
| Admin URL/API, qiymət/məhsul/kart parametrləri | 401/API; HTML login-ə yönəlir | 403 | əvvəlki admin icazəsi |
| İşçi yarat/start/deaktiv/revoke/yeni dövr | 401 | 403 | CSRF + admin |
| Stok əlavə/şablon/deaktiv/problemli/audit/maaş tarifi | 401 | 403 | CSRF + admin |
| Sifarişi qəbul/rezerv/mesaj/sent/submit | 401 | yalnız uyğun sifariş | işçi əvəzinə icra edilmir |
| Ödənişi ayrıca yoxla/geri qaytar/tamamla/ləğv | 401 | 403 | CSRF + admin |

HTML: `/employee/login`, `/employee`, `/admin/workforce`.
İşçi API: `/api/employee/login`, `/session`, `/logout`, `/capabilities`, `/dashboard`, `/orders`, `/products`, `/stock`, `/payroll`.
Burada `/session` və sonrakı qısa yollar `/api/employee` prefiksi altındadır.
`/api/employee/orders/:id/{accept,reserve,preview,whatsapp,sent,submit}` POST; `receipt` GET.
Sahib API prefiksi `/api/admin/workforce`:
`accounts` GET/POST; `accounts/:id/{start,disable,enable,revoke,restart,salary,paid}` POST;
`dashboard`, `orders`, `products`, `stock`, `stock/units`, `payroll`, `audit`, `template` GET;
`stock`, `template`, `plans/review`, `stock/:id/{disable,invalid}` POST;
`orders/:id/{verify,return,complete,cancel,fill}` POST və `receipt` GET.
Legacy admin sifariş kartında işçinin adı/qəbul vaxtı/state görünür, yeni axınlı sifariş workforce panelinə yönəlir.
Sifarişlər legacy siyahıdan silinmir; duration/bank/tarix/pagination filtrləri saxlanılır.

## Məlumat və təqdimat axını

- Checkout yeni capability açıldıqda ad, ölkə kodlu WhatsApp nömrəsi və miqdar (default 1) istəyir.
  Məbləğ serverdə real plan qiyməti × miqdardır; canonical məhsul, sabit UUID plan mapping-i və qiymət/ad snapshot-u atomic submit-də saxlanılır.
- Plan mapping məhsul ID-si + mövcud plan açarı/signature ilə qorunur. Plan yerində dəyişibsə səssiz başqa plana bağlanmır;
  admin uyğunluğu yoxlayır, əvvəlki UUID/stok/sifariş əlaqələri saxlanılır.
- Yalnız startdan əvvəlki, məlumatı çatışmayan sifarişdə əl ilə tamamlama forması görünür.
  Məhsul/plan təxmin edilmir, qiymət/date/raw plan adı əvəz edilmir; köhnə sifariş yenə işçi qazancına düşmür.
- `payment_verified_at/by` ayrıca yoxlamadır; canonical status reviewing qalır, satış/bonus yaranmır.
- NEW → EMPLOYEE_ACCEPTED → STOCK_RESERVED → DELIVERED_PENDING_ADMIN → COMPLETED.
  Admin RETURNED_TO_EMPLOYEE və ya CANCELLED edə bilər. Employee tamamlamaya icazə almır.
- Final completion əvvəlki `approve_payment_order_v7` səlahiyyətli mexanizmini çağırır;
  assignment/stok/bonus eyni transaction-dadır. Legacy approval enrolled sifarişi yarımçıq keçə bilmir.
  Miqdar >1 olduqda xərc snapshot-u real vahid sayına uyğunlaşdırılır; kart limiti qaydası dəyişmir.
- Hər hesab/kod ayrı UUID vahididir. AES-256-GCM + AAD, ayrıca HKDF konteksti;
  mövcud server payment encryption açarı istifadə edilir. Açarı re-encryption planı olmadan dəyişmək olmaz.
- Stok rezervi row lock/SKIP LOCKED və idempotency key ilə qorunur. Açıqlanan məlumat ləğvdən sonra AVAILABLE olmur.
  Problemli vahidi admin INVALID edir, yeni fərqli vahid əlavə edir, lazım gələrsə sifarişi işçiyə qaytarır;
  işçi yalnız eyni canonical məhsul/plana uyğun əvəz vahid rezerv edə bilər.
- Önizləmə yalnız həmin işçinin sifarişinə ayrılmış məlumatı açır; 30 saniyə/sekme gizlənməsi/naviqasiya zamanı UI-dən silinir.
  `wa.me` yalnız əl ilə göndərişdir. “Göndərildi” işçinin təsdiqidir, avtomatik çatdırılma sübutu deyil.
  Cloud API adapteri konfiqurasiyasız 503 verir və göndərilmiş kimi göstərmir.
- Auditdə vaxt, actor, action, sifariş/stok ID-si var; parol, mesaj mətni və çek payload-u yoxdur.
- Maaş parametrləri 500 ₼ / 0.35 ₼ / 50 ₼; şəxsi real bonus yalnız admin final təsdiqində unique order ledgerinə yazılır.
  Maaş önizləməsi bank köçürməsi və ya maaş əməliyyatı deyil; “Ödənilib” yalnız sahibin uçot qeydidir.
  Start yoxdursa bütün şəxsi nəticələr 0; tarixi 10.000 və köhnə sifarişlər heç vaxt işçi statistikasına qatılmır.

## İzolyasiya edilmiş yoxlamalar

İşçi testləri production bağlantısı və real mesaj göndərişi istifadə etmir.

| Test | Faktiki nəticə |
|---|---|
| `node scripts/test-employee-reporting.mjs` | 62 yoxlama; əvvəlki foundation suite qorunub |
| `node scripts/test-employee-panel-db.mjs` | 42 yoxlama; PostgreSQL/PGlite; stok, checkout, final approval/bonus, retry, açıqlanmış stokun təkrar verilməməsi |
| `node scripts/test-employee-http.mjs` | 43 yoxlama; 401/403/409, CSRF, revocation, metadata, şablon/legacy UI qaydası |
| `node scripts/test-employee-release.mjs` | 14 yoxlama; tam SQL/rollback 2 dəfə, backup/say/fingerprint, seed 0 |
| `node scripts/test-employee-browser.mjs` | 151 yoxlama; işçi/admin UI, tam fixture axını, checkout metadata + receipt + final submit, 8 viewport |
| `node scripts/test-employee-admin-bridge.mjs` | 18 yoxlama; legacy admin kartında işçi məlumatı, pre-start owner axını və doğru idarə keçidi |
| `node scripts/test-employee-key.mjs` | 29 yoxlama; canonical açar formatı, fail-closed API, rotation round-trip |
| `node scripts/test-employee-real-postgres.mjs` | 60 yoxlama; real PostgreSQL 18.4, ayrı backend-lər, migration/rollback/checkout |
| `node scripts/test-admin-auth-boundary.mjs` | keçdi; əvvəlki owner giriş sərhədi |
| `node scripts/test-payment-method-selection.mjs` | keçdi; seçim/rezerv düyməsi regressiyası |
| `node scripts/test-payment-receipt-browser.mjs` | keçdi; formatlar, retry, timeout, server təsdiqi və davam gate-i |
| `node scripts/test-payment-orders-browser.mjs` | keçdi; 4 bölmə, mövcud owner sifariş UI-si |
| `node scripts/test-order-duration-filter.mjs` | keçdi; 1005 uyğun sətir, 4 bölmə, pagination/toplu seçim |

UI ölçüləri: 320/360/390/430/768/1024/1366/1440 px. Lokal işçi/admin screenshot yoxlamasında overflow 0,
app console error 0, 404 0; görünən işçi düymələri minimum 44 px.
Şəkillər izolə testdə fixture assetləridir, canlı storage testi kimi təqdim edilmir.
Screenshot-lar: `C:/Users/user/.codex/visualizations/2026/07/21/019f86ca-a67d-70e2-8827-51cc8588f307/employee-panel-20261021/employee-*.png`.

Yekun release gate: **17/17 paket yaşıl**, **419 işçi yoxlaması**, uğursuz paket **0**.
İki əvvəl uğursuz testin pre-employee `c109252` arxivində eyni xətaları verdiyi ayrıca təsdiqlənib;
MIME/handler/cache/CMS/query assertion-ları təsdiqlənmiş davranışa uyğun yenilənib və hər iki paket indi keçir.
Real PostgreSQL 18.4-də ayrı backend-lər, connection termination, atomic dry-run və rollback də yoxlanıb;
köhnə approval testi lokal DB-də 12 backend ilə keçir. Production migration və canlı employee sessiyası hələ yoxlanmayıb.
Tam səbəb, sübut, açarın adı/formatı/rotasiyası və runtime qeydləri: `docs/employee-release-blockers.md`.

## Deploy sonrası agent yoxlaması

1. Main push-dan sonra Render health və `/api/employee/capabilities` schema gate-i yoxlanılsın.
2. İşçi login və admin workforce JS/CSS yeni build-dən 200 alınsın; admin API sessiyasız 401 olmalıdır.
3. Mövcud admin sessiyası ilə owner paneli yoxlanılsın. İşçi hesabını yalnız sahib yaradır/aktiv edir.
4. Production-da saxta işçi/sifariş/stok/maaş/çek/rezerv/WhatsApp mesajı yaradılmasın.

## Dəyişən faylların tam siyahısı

İlkin `499d1a5` və bloker düzəlişi birlikdə 42 əlaqəli fayl:

- `docs/employee-panel-release.md`
- `docs/employee-reporting-foundation.md`
- `docs/employee-release-blockers.md`
- `mirpanel-admin/employee-api.mjs`
- `mirpanel-admin/employee-reporting.mjs`
- `mirpanel-admin/employee-security.mjs`
- `mirpanel-admin/payment-api.mjs`
- `mirpanel-admin/payment-store.mjs`
- `mirpanel-admin/server.mjs`
- `mirpanel-admin/public/admin.html`
- `mirpanel-admin/public/payment-admin.js`
- `mirpanel-admin/public/employee-login.html`
- `mirpanel-admin/public/employee-login.js`
- `mirpanel-admin/public/employee.html`
- `mirpanel-admin/public/employee.css`
- `mirpanel-admin/public/employee.js`
- `mirpanel-admin/public/workforce-admin.html`
- `payment-flow.js`
- `payment-flow.css`
- `scripts/employee-http-fixture.mjs`
- `scripts/employee-local-postgres.mjs`
- `scripts/receipt-gate-fixture.mjs`
- `scripts/test-employee-admin-bridge.mjs`
- `scripts/test-employee-browser.mjs`
- `scripts/test-employee-http.mjs`
- `scripts/test-employee-key.mjs`
- `scripts/test-employee-real-postgres.mjs`
- `scripts/test-employee-release-gate.mjs`
- `scripts/test-employee-panel-db.mjs`
- `scripts/test-employee-release.mjs`
- `scripts/test-employee-reporting.mjs`
- `scripts/test-old-order-approval-database.mjs`
- `scripts/test-payment-orders-admin.mjs`
- `scripts/test-payment-system.mjs`
- `scripts/test-postgres-adapter.mjs`
- `supabase/employee-pre-release-backup.sql`
- `supabase/employee-release.sql`
- `supabase/employee-release-rollback.sql`
- `supabase/migrations/202610210001_employee_reporting.sql`
- `supabase/migrations/202610210002_employee_panel.sql`
- `supabase/rollback/202610210001_employee_reporting.sql`
- `supabase/rollback/202610210002_employee_panel.sql`

Əvvəldən olan `scripts/test-header-product-media.mjs` və `scripts/test-splash.mjs` lokal dəyişiklikləri qorunur və bu commitə daxil edilmir.
