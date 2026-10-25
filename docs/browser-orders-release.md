# Qeydiyyatsız Sifarişlərim — release gate

## Arxitektura və saxlanma

Public frontend `mirpanel.com` / `www.mirpanel.com`, backend `mirpanel.onrender.com` fərqli saytlardır. Cloudflare Pages-də dar `/api/payments/*` proxy-si yalnız mövcud public checkout və my-orders route-larını fixed backend-ə ötürür. Admin/employee Authorization və cookie-ləri ötürülmür. Foreign Origin / Sec-Fetch-Site cross-site rədd edilir. API şəxsi cavabları private/no-store-dur.

`www.mirpanel.com` public GET/HEAD səhifələri canonical `mirpanel.com`-a 308 yönləndirilir: yeni brauzer tarixçəsi iki host cookie-si arasında parçalanmır. API POST-ları redirect edilmir. IP və ya köhnə cookie-lərdən hər hansı tarixçə birləşdirməsi aparılmır.

Brauzer identifikatoru: kriptoqrafik təsadüfi 256-bit token, imzalanmış bitmə tarixi ilə. Cookie `__Host-mirpanel_orders`, `Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000` — **365 gün**. URL, localStorage, analytics və tətbiq loglarında saxlanmır. DB-də yalnız HMAC hash və canonical order ID əlaqəsi var. Cookie təmizlənəndə, vaxtı bitəndə, gizli rejimdə və başqa profil/cihazda avtomatik bərpa yoxdur. IP/fingerprint əlaqələndirməsi yoxdur. İmzalama üçün mövcud token secret istifadə olunur, açar dəyişdirilmir. Cookie vaxtı ilə DB order/receipt retention fərqli anlayışdır; mövcud retention dəyişmir.

Yeni `submit_payment_order_browser` RPC mövcud `submit_payment_order_v2`-ni eyni transaction daxilində çağırır, yalnız həqiqətən yeni order yarananda owner əlaqəsi əlavə edir. Owner insert uğursuz olsa order/reservation/counter əməliyyatı da rollback olur. Eyni reservation üzrə iki bağlantı serializə edilir; eyni owner retry idempotent, fərqli owner conflict-dir. Köhnə unowned sifarişin etibarlı checkout retry-si belə onu tarixçəyə bağlamır. Sifariş və məbləğ stored snapshot-dan gəlir, cari catalog qiymətindən deyil. List 20 order + cursor ilə səhifələnir. Employee review state yalnız public status mətninə çevrilir; employee adı/secrets çıxmır.

Çek: owner cookie + UUID hər sorğuda yoxlanır, path müştəridən qəbul edilmir. Private storage-dan 60 saniyəlik signed URL yalnız sahibə qaytarılır. Silinibsə 410 / `Çek artıq mövcud deyil`. Məhsul, məbləğ, status, tarixdən başqa həssas form məlumatı tarixçəyə verilmir. Hazırkı checkout `Çek uğurla yükləndi` → əl ilə `Davam et` qaydasındadır. OCR bağlı, təhlükəsizlik/5MB qorunur.

## Lokal tətbiq və test

Məhsulların, Story/bannerlərin data/modelinə toxunulmur. Shared header script ayrı nav scriptini yükləyir. 3 düyməli mobil nav + safe-area/content padding; floating controls nav üstündə. Desktop link Əlaqənin yanındadır. Static səhifələr/generator yalnız checkout/header asset versiyalarını yeniləyir. Tarixçə route `/sifarislerim`, robots noindex. Loading/empty/error/retry/more və təhlükəsiz receipt dialog var. İlk səhifədə 30 saniyəlik görünən-səhifə yenilənməsi; əlavə səhifələr paging zamanı təzə sorğu ilə alınır, yenidən fokus/geri qayıdış ilk səhifəni yeniləyir.

`node scripts/test-browser-orders-release.mjs`: database first/repeat, schema-6 synthetic upgrade, forced partial failure, preserved legacy orders, two-connection concurrency, transaction rollback, data-preserving rollback/reapply, real HTTP+Postgres/browser profile isolation and browser restart, signature/expiry/CSRF/proxy, six-width UI and existing checkout/employee/inventory regression. Fixtures only. Screenshots in ignored `payment-test-artifacts/browser-orders` explicitly contain synthetic orders.

## Əvvəlki buraxılış maneəsi (tarixi qeyd — artıq aradan qaldırılıb)

- Production layihə: **mirpanel-payments**, ref `sidgtcgyqkdplgfabmmp`. Render konfiqurasiyasından Supabase URL uyğunluğu yoxlanıb; yalnız GET RPC: `employee_system_ready()` = **6**, `browser_orders_ready()` = **404 / yoxdur**.
- Render environment-də DB SQL connection dəyişəni yoxdur. Service-role REST açarı SQL bağlantısı / pg_dump girişi deyil. Gizli açar dəyərləri çıxarılmayıb.
- Mövcud Supabase brauzer sessiyası açılır. Database → Backups ekranında authoritative mətn: **“Free Plan does not include project backups.”** Səhifədə ödənişli upgrade təklif olunur. Upgrade / plan dəyişmə / restore / data export edilməyib.
- Xarici backup və ayrıca private mühitdə restore nəticəsi **yoxdur / təsdiqlənməyib**. Lokal sintetik PG testləri production backup sübutu deyil. Migration manifesti 2 cədvəlin sayını qeyd edir, data backup-u deyil.

**Hazırkı yeganə buraxılış maneəsi: production üçün xarici, bərpası yoxlanmış backup sübutu.** Bu olmadan SQL, push və deploy YOX. Login sessiyası var deyə backup şərti atlanmır. Mövcud `mirpanel-test` layihəsinə real məlumat köçürmək və ya yeni pullu layihə yaratmaq avtomatik icra edilmir.

## Əvvəlki credential hazırlığı (tamamlanıb; yenidən icra etmə)

### Əl ilə backup girişinin faktiki yoxlaması

Free plan yalnız scheduled backup-u məhdudlaşdırır. Connect → Direct → Session pooler pulsuz IPv4 bağlantısını göstərir: host `aws-0-eu-central-1.pooler.supabase.com`, port `5432`, database `postgres`, user `postgres.sidgtcgyqkdplgfabmmp`. Şifrə yerində `[YOUR-PASSWORD]` var; Dashboard mövcud şifrəni vermir. Render env adları yoxlanılıb: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_RECEIPTS_BUCKET`; PostgreSQL bağlantı dəyişəni yoxdur. Standart lokal pgpass və Supabase CLI token faylları da yoxdur. REST açarı tam schema/functions/RLS daxil olan pg_dump girişi əvəzi deyil.

Yeganə tələb olunan giriş addımı: `scripts/set-browser-orders-backup-credential.ps1` skriptini istifadəçinin öz PowerShell terminalında işə salıb **mövcud PostgreSQL şifrəsini yalnız gizli lokal prompt-a** daxil etmək. Skript heç bir DB əməliyyatı etmir; credential-i Git-dən kənarda `%LOCALAPPDATA%/MirpanelPrivateBackups` daxilində owner-only NTFS ACL və Windows DPAPI ilə saxlayır. Şifrə sıfırlanmır, çata göndərilmir, terminalda açıq görünmür. Script parser yoxlaması credential/backup/restore yoxlaması deyil. Real backup və private restore hələ icra edilməyib; migration/push/deploy HOLD-dur.

Birbaşa bağlantı ekranı: https://supabase.com/dashboard/project/sidgtcgyqkdplgfabmmp/database/backups/scheduled?showConnect=true&connectTab=direct&method=session

`mirpanel-payments` üçün mövcud təhlükəsiz DB bağlantısını yalnız öz lokal secret manager/environment-də istifadə edən operator:

1. Production DB-nin xarici, şifrələnmiş, girişləri məhdud backup-unu hazırlamalıdır (schema/functions/indexes/RLS/constraints + payment_orders/payment_reservations və digər DB məlumatları). Şifrə və connection string çata göndərilməməlidir.
2. Backup-u production üzərinə deyil, ayrıca, internetə/app/mail/cron/WhatsApp-a bağlanmayan private restore mühitində bərpa etməli; obyektlər, constraint/RLS/functions və sətir sayları yoxlanmalıdır. Mövcud unrelated test bazası təsdiqsiz overwrite edilməməlidir. Storage DB metadata-sı faktiki private fayl backup-u deyil: receipt object-lər üçün də mövcud backup/restore qaydası ayrıca sənədləşdirilməlidir.
3. Yalnız secret-siz sübut: backup ID/tarix/status, restore target adı/izolyasiyası, restore uğuru və consistency yoxlamasının nəticəsi təqdim edilməlidir. Raw dump, müştəri sətirləri və çeklər göndərilməsin.

## Backup təsdiqindən sonra icra ardıcıllığı

### Faktiki nəticə — 2026-10-25

- İstifadəçinin mövcud DPAPI credential-i dəyişdirilmədən istifadə edildi. DACL-only hazırlıq skripti 7/7 sintetik yoxlamadan keçib; SACL/owner dəyişmir, admin privilege tələb etmir.
- Production PostgreSQL 17.6 / employee schema 6 read-only bağlantıda təsdiqləndi. TLS verification aktivdir; Dashboard-dan göstərilən rəsmi Supabase CA istifadə edildi.
- PostgreSQL 17.11 rəsmi EDB binary arxivinin SHA-256 yoxlaması keçdi. `pg_dump` exported repeatable-read snapshot ilə bütün `public` sxeminin məlumat/DDL/ACL arxivini yaratdı. Bu, migration üçün scoped backup-dur: 44 biznes cədvəli və 99 funksiya; **Storage fayllarının və digər Supabase daxili sxemlərinin tam backup-u deyil**. Migration həmin faylları/sxemləri dəyişmir.
- Arxiv Git-dən kənarda `%LOCALAPPDATA%/MirpanelPrivateBackups/browser-orders-2026-10-25T19-41-15-731Z` daxilindədir. Qovluq yalnız cari Windows istifadəçisinə açıqdır. `public.dump.dpapi` Windows CurrentUser DPAPI ilə şifrələnib; decrypt/SHA-256 roundtrip uyğunluğu yoxlanıb, plaintext dump nüsxələri silinib. Credential dəyişməyib. Restore cluster dayandırılıb; heç bir app/cron/WhatsApp adapterinə qoşulmayıb, yalnız loopback-də işləyib, ayrıca təsadüfi SCRAM şifrəsi istifadə olunub.
- İlk lokal orchestration cəhdində Windows child-pipe lifecycle xətası düzəldildi. İkinci müqayisədə row counts və bütün DDL uyğun idi, timestamp fingerprint-ləri lokal timezone-a görə fərqlənirdi; UTC kanonikləşdirməsindən sonra bütün 44 cədvəlin fingerprint-ləri eyni oldu. Bu uğursuz cəhdlər production migration başlatmadı.
- Son bərpa yoxlaması: bütün cədvəl məlumatları, funksiya tərifləri, constraints, indexes, RLS/policies uyğun; `pg_restore --exit-on-error` ACL-lərlə uğurlu; lokal migration ilk/təkrar tətbiqi və non-deleting rollback biznes məlumatlarını qorudu. Lokal owner production owner əvəzinə izolə edilmiş restore owner-dir (`--no-owner`); bu, production rollback planı deyil.
- Production preflight `BROWSER_ORDERS_PREFLIGHT_OK`. Yalnız `202610250002_browser_orders.sql` bir dəfə tətbiq edildi. Verification: ready=1, manifest_entries=2, rls=true, anon_read=false, anon_rpc=false, service_rpc=true, orphan_links=0, employee_schema=6. Köhnə sifarişlər backfill edilmədi.
- Release regressiyası yenidən: 14/14 paket, failed=0; yalnız sintetik əməliyyatlar. Production test order/reservation/receipt/WhatsApp=0.

Yuxarıdakı əvvəlki HOLD və manual hazırlıq abzasları audit üçün saxlanılıb, cari vəziyyət kimi oxunmamalıdır. Aşağıdakı ardıcıllıq runbook-dur; production migration artıq tətbiq edilib və təkrarlanmamalıdır.

Platforma: Supabase Dashboard → **mirpanel-payments** → SQL Editor, `https://supabase.com/dashboard/project/sidgtcgyqkdplgfabmmp/sql/new`.

1. `supabase/browser-orders-preflight.sql` — gözlənilən `BROWSER_ORDERS_PREFLIGHT_OK`; STOP mesajı varsa davam etmə.
2. `supabase/migrations/202610250002_browser_orders.sql` — bütöv transaction kimi. Əvvəlki schema-6/receipt migration-u TƏKRAR tətbiq etmə. Yeni cədvəl boşdur; köhnə sifarişlər backfill edilmir.
3. `supabase/browser-orders-verify.sql` — ready=1, manifest_entries=2, rls=true, anon_read=false, anon_rpc=false, service_rpc=true, orphan_links=0. Fərq, error və ya DB vaxt aşımı varsa deploy dayansın. Manifest sayını backup hesab etmə.
4. Main push. Render backend-i əvvəl `BROWSER_ORDERS_ENABLED=false` ilə deploy et: legacy checkout işləməyə davam edir. Sonra Cloudflare frontend/proxy deploy. Route/asset/health uyğunluğunu yoxla.
5. Backup/migration yoxlaması tamamdırsa Render-də yalnız `BROWSER_ORDERS_ENABLED=true` aktivləşdirib redeploy et. Mövcud encryption/token açarlarını dəyişmə. Tarixçə bağlı vəziyyətdə 503 göstərir, yanlış boş uğur göstərmir. Bu flag aktiv olmadan yeni order owner əlaqəsi yaranmır; aktivləşmə release başlanğıcıdır.
6. Canlıda GET health/assets, boş yeni-profil tarixçəsi, noindex/cache/cookie atributları və responsive görünüş. Dəyişən funksional testlər yalnız local fixture; production sifariş/rezerv/çek/WhatsApp yaratma.

Geri dönüş: əvvəl flag false və əvvəlki tətbiq/frontend versiyasına rollback; sonra `supabase/rollback/202610250002_browser_orders.sql`. Bu SQL yalnız yeni hüquqları bağlayır və readiness=0 edir. Cədvəl/link/order/receipt silmir, mövcud checkout RPC-lərini dəyişmir. Yenidən migration tətbiqi linkləri qoruyaraq yeni hüquqları açır.


## Dəyişən fayllar

- `_redirects`
- `browser-nav.js`
- `browser-orders.css`
- `browser-orders.js`
- `docs/browser-orders-release.md`
- `elaqe`
- `functions/_middleware.js`
- `functions/api/payments/[[path]].js`
- `haqqimizda`
- `index.html`
- `mehsul.page`
- `mehsul/adobe-creative-cloud.page`
- `mehsul/amazon-prime-video.page`
- `mehsul/canva-premium.page`
- `mehsul/capcut-pro.page`
- `mehsul/captions-ai.page`
- `mehsul/chatgpt-plus-ortaq-hesab.page`
- `mehsul/chatgpt-plus.page`
- `mehsul/cloud-ai-pro.page`
- `mehsul/duolingo-super.page`
- `mehsul/google-ai-pro-ultra.page`
- `mehsul/google-ai-pro-v3.page`
- `mehsul/grok-ai.page`
- `mehsul/hbo-max.page`
- `mehsul/netflix-sexsi-yenilemek.page`
- `mehsul/netflix-sexsi.page`
- `mehsul/netflix-umumi.page`
- `mehsul/spotify-premium.page`
- `mehsul/surfshark-vpn.page`
- `mehsul/tiktok-jeton.page`
- `mehsul/youtube-eyni-hesab.page`
- `mehsul/youtube-premium.page`
- `mehsul/zoom-pro.page`
- `mirpanel-admin/browser-orders.mjs`
- `mirpanel-admin/payment-api.mjs`
- `mirpanel-admin/payment-store.mjs`
- `mirpanel-admin/product-pages.mjs`
- `mirpanel-admin/server.mjs`
- `payment-flow.js`
- `scripts/receipt-gate-fixture.mjs`
- `scripts/test-browser-orders-db.mjs`
- `scripts/test-browser-orders-http.mjs`
- `scripts/test-browser-orders-proxy.mjs`
- `scripts/test-browser-orders-release.mjs`
- `scripts/test-browser-orders-ui.mjs`
- `sertler`
- `sifarislerim.html`
- `site-header.js`
- `supabase/browser-orders-preflight.sql`
- `supabase/browser-orders-verify.sql`
- `supabase/migrations/202610250002_browser_orders.sql`
- `supabase/rollback/202610250002_browser_orders.sql`
