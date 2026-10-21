# Employee buraxılışı — blokerlərin bağlanması (2026-10-21)

Production migration, push, deploy və real hesab yaratma **icra edilməyib**. Baza `499d1a5` qorunur.

## Əvvəl uğursuz iki testin sübutu və düzəlişi

`c109252` (işçi sistemindən əvvəlki main) arxivi ayrıca `payment-test-artifacts/employee-baseline` qovluğunda açılıb.
Həmin arxivdə dəyişiklik edilmədən bu iki test ayrıca icra olunub:

- `test-payment-system.mjs:54`: JPEG baytlarını `image/png` kimi qəbul etməyi gözləyirdi; dəyişməmiş
  `payment-security.mjs:128` düzgün olaraq `RECEIPT_UNSUPPORTED_TYPE` qaytarırdı.
- `test-payment-orders-admin.mjs:101`: `.select(select, { count: "exact" })` literalını gözləyirdi;
  müddət filtri repository-si artıq `matchingQuery(select, { count: "exact" })` vasitəsilə bütün uyğun nəticələri oxuyurdu.

Bu test faylları və receipt security `c109252..499d1a5` arasında dəyişməyib (`git diff` boşdur).
Yeni gözləntilər:

- MIME uyğunsuzluğu (JPEG/PNG və PDF/text/plain) rədd edilir; düzgün MIME-li real PDF yenə qəbul edilir.
- Submit handler tək/dırnaq/boşluq formatına deyil, receipt form handler-inə və submitting/settled qorumasına baxır.
- Yeni təsdiqlənmiş düymə `ÇEKİ GÖNDƏR VƏ DAVAM ET →` və server receipt token gate-i yoxlanılır.
- Canonical WhatsApp çek mətni serverdədir; eyni-tab keçidi verified URL alan navigation adapteri ilə yoxlanılır.
- Kommersiya snapshot-u işçi işindən əvvəlki təsdiqlənmiş CMS `c109252` mənbəyindən ayrıca hesablanıb.
  Məhsul sayı 31, aktiv sayı 22 qalır; işçi dəyişikliyi kataloq məlumatını dəyişməyib.
- Köhnə sentyabr cache literalı yerinə bütün məhsul səhifələrinin indiki generatorla eyni versiyalı asseti oxuması yoxlanılır.
- Admin count seçiminin shared query-yə ötürülməsi ayrıca yoxlanılır.

Receipt/checkout/WhatsApp production məntiqi bu iki testi yaşıl etmək üçün dəyişdirilməyib.
Ayrıca funksional receipt, bank seçimi, duration/pagination və məhsul forması browser testləri saxlanılıb.

## Real PostgreSQL və paralellik

`scripts/employee-local-postgres.mjs` yalnız `127.0.0.1`, lokal test portu (default 55439),
`employee_test_owner` və özü yaratdığı `mirpanel_employee_test_<random>` database-ə qoşulur.
Connection URL və uzaq host qəbul etmir. Hər test sonda yalnız öz yaratdığı database-i silir.
Real engine: PostgreSQL 18.4, Windows x64; WASM/PGlite deyil.
Portativ runtime [embedded-postgres layihəsinin](https://github.com/leinelissen/embedded-postgres)
`@embedded-postgres/windows-x64@18.4.0-beta.17` paketindən alınıb (engine özü 18.4-dür).
Runtime və DB faylları ignored `payment-test-artifacts` daxilindədir, commitə daxil edilmir.

`test-employee-real-postgres.mjs` ən azı iki ayrı `pg_backend_pid()` ilə yoxlayır:

- Eyni sifarişin ayrı request key-lərlə paralel qəbulu: bir uğur, bir conflict.
  Bu test həqiqi uyğunsuzluğu üzə çıxardı; SQL-də `ORDER_ALREADY_ASSIGNED` əlavə edildi.
- Eyni key ilə retry: eyni nəticə, yeni assignment/rezerv/bonus yoxdur.
- İki qəbul edilmiş sifarişin son vahid üçün yarışı: bir rezerv, digərinə `STOCK_EMPTY`;
  itirən assignment əvvəlki vəziyyətdə qalır.
- İki ayrı admin completion sorğusu: bir completion, digərinə `ORDER_FINALIZED`.
- İki backend-dən bonus insert-i: bir insert, digərinə unique constraint conflict.
- Açıq transaction-dakı rezerv ROLLBACK olduqda vahid və idempotency qeydi əvvəlki vəziyyətə qayıdır.
- Rezerv edilmiş, amma commit edilməmiş backend `pg_terminate_backend` ilə kəsildikdə eyni rollback baş verir;
  digər bağlantı eyni key ilə təhlükəsiz retry edə bilir.
- Təqdimat 1, bonus 1; duplicate rezerv/təqdimat/bonus 0; mənfi inventory count və yarımçıq final status 0.

Legacy approval testi də `MIRPANEL_TEST_LOCAL_ONLY=1 MIRPANEL_REAL_TEST=1` ilə real lokal serverdə
12 ayrı backend üzərindən keçir: bir təsdiq, 11 idempotent replay, bir audit qeydi.
Uzaq test adapterinin əvvəlki davranışı dəyişdirilməyib; release-gate runner həmişə lokal rejimi məcbur edir.

## Migration dry-run / rollback

1. Tamamilə boş DB-də paket `EMPLOYEE_LEGACY_PAYMENT_PREREQUISITES_MISSING` ilə təhlükəsiz dayanır.
   Bu additive paket əvvəlki payment sistemini əvəz etmir.
2. Sonra boş test DB-yə repository-dəki 17 **orijinal** payment migration-u tətbiq edilir.
   Yalnız Supabase platformasının `storage.buckets` infrastrukturu lokal fixture-dir; payment RPC-lər mock deyil.
3. Köhnə sifariş fixture-i yaradılır, tam employee paketi ilk və ikinci dəfə tətbiq edilir;
   sifariş və private backup məzmunu qorunur, işçi/maaş/stok seed edilmir.
4. Paketin COMMIT-indən əvvəl qəsdən SQL xətası yaradılır. Employee DDL və backup schema-sı birlikdə rollback olur;
   köhnə sifariş bayt-məzmunu dəyişmir.
5. Köhnə yaradılma tarixli sifariş employee qəbul/statistikasına daxil edilmir.
6. Açıq işçi sifarişi varsa rollback bloklanır. Onlar bağlandıqdan sonra rollback heç bir məlumat silmir.
7. Rollback-dən sonra əvvəlki `approve_payment_order_v7` real RPC-si işləyir, service-role icazəsi qalır.

## Şifrələmə açarı və Render environment

Stok üçün dəyişən **`PAYMENT_ENCRYPTION_KEY_B64`**-dür. Yeni açar tələb olunmur: mövcud payment master key-dən
`HKDF-SHA256`, salt `Mirpanel`, context `employee-stock-v1` ilə ayrıca 32-baytlıq stok açarı törədilir.

- Format: standart, canonical, padding-li Base64; **44 simvol**, decode nəticəsi **dəqiq 32 bayt (256 bit)**.
- Mənbə: CSPRNG/secret manager. İnsan şifrəsi, UUID, nümunə/zero açar istifadə olunmamalıdır.
- Boş, qısa, uzun, padding-siz, zibil simvollu və canonical olmayan dəyər rədd edilir.
- Açar yoxdursa/yanlışdırsa employee capability false olur, qorunan employee API 503 qaytarır;
  login/stok/bonus əməliyyatları açılmır. Mövcud payment modulu da boş və decode nəticəsi 32 bayt olmayan master key ilə başlanmır.
- AES-256-GCM: hər yazıda random 12-bayt IV, 16-bayt tag; AAD `unitId:productId:planId`.
- Açar, plaintext və mesaj audit/log/commit/test nəticəsinə çıxarılmır. Test açarları yalnız proses yaddaşında random yaranır.

Mövcud Render dəyişənləri saxlanılmalıdır:

| Dəyişən | Təyinat |
|---|---|
| `PAYMENT_ENCRYPTION_KEY_B64` | bank məlumatları + ayrıca HKDF stok şifrələməsi; yuxarıdakı format |
| `PAYMENT_TOKEN_SECRET_B64` | mövcud payment token təhlükəsizliyi; encryption key-dən ayrı secret |
| `SUPABASE_URL` | mövcud layihə URL-si |
| `SUPABASE_SECRET_KEY` | yalnız serverdə service-role/server secret; anon key deyil |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | mövcud sahib girişi; employee şifrəsi ilə eyni deyil |
| `COOKIE_SECURE=true` | production secure cookies |
| `MIRPANEL_GITHUB_TOKEN` | mövcud CMS kataloquna server girişi |
| `EMPLOYEE_PANEL_ENABLED` | optional; `false` emergency off. Əks halda SQL schema readiness + key yoxlaması aktivləşdirir |

Mövcud bucket/origin/mail environment parametrləri saxlanılır; yeni WhatsApp Cloud secret-i tələb edilmir.
Real secret-i SQL Editor-ə, chat-a, source-a və test fixture-inə yazmayın.

### Təhlükəsiz rotasiya proseduru (bu buraxılışda icra edilmir)

Master key bank məlumatları ilə ortaq olduğuna görə **yalnız Render dəyərini dəyişmək olmaz**.

1. Maintenance rejimi; employee və payment mutasiyalarını dayandırın, açıq əməliyyatları tamamlayın.
   SQL backup və əvvəlki açarı ayrıca təhlükəsiz secret manager-də saxlayın; plaintext export etməyin.
2. Etibarlı offline server prosesində köhnə açarla hər stok vahidini GCM/AAD yoxlaması ilə açın,
   yeni random master key-dən törənmiş stok açarı ilə eyni ID/AAD və yeni IV ilə yenidən şifrələyin.
   Dedup HMAC `fingerprint`-lərini yeni açarla, eyni identity sahələri/sırası ilə yenidən hesablayın.
3. Eyni maintenance transaction-ında bütün şifrəli bank nömrələrini də mövcud `createPaymentSecurity`
   formatında köhnə açarla açıb yeni açarla şifrələyin. Key table/string/SQL payload-da saxlanılmır.
4. Commit-dən əvvəl hər yeni cipher-i yeni açarla oxuyub plaintext bərabərliyini yalnız yaddaşda yoxlayın;
   say/ID/order əlaqəsi/state/version və audit bütövlüyünü yoxlayın. Uğursuzluqda bütün transaction rollback olsun.
5. Sonra Render secret-i dəyişib bütün server instansiyalarını birlikdə restart edin; aralıqda trafik açmayın.
   Bu single-key formatdır, qarışıq köhnə/yeni instansiyalarla rolling re-encryption təhlükəsiz deyil.
6. Rotasiyadan əvvəlki stock-add request-ləri əvvəlki HMAC əsaslı idempotency payload-u ilə qalır.
   Onları yenidən yaratmayın/ledgerdən silməyin; köhnə retry conflict ilə dayanmalıdır.
   Əməliyyatın əvvəl uğurlu olub-olmadığını audit/stok ID-si ilə yoxlamadan yeni request key istifadə etməyin.
7. Yeni açarla maskalanmış oxuma, dedup və izolyasiya olunmuş canary yoxlamasından sonra trafik açılsın.
   Bərpa lazım olsa DB snapshot və əvvəlki secret birlikdə bərpa edilsin. Təkcə secret-i geri çevirməyin.

## Yekun test əmri və nəticə

`node scripts/test-employee-release-gate.mjs` — 17 əlaqəli paket; runner canlı rejimi söndürür,
köhnə PostgreSQL testini lokal rejimə bağlayır. Playwright və lokal PostgreSQL əvvəl hazır olmalıdır.
Tam stdout/stderr və nəticə `payment-test-artifacts/employee-release-gate-result.json` artefaktındadır.
Responsive ölçülər: 320/360/390/430/768/1024/1366/1440 px.
Yekun nəticə yalnız bütün 17 paket keçdikdən sonra yaşıl hesab edilir; production/live test deyil.

Faktiki yekun: **17/17 keçdi, failed=0, reportedEmployeeChecks=419**. Hər iki əvvəl uğursuz paket də bu keçidə daxildir.
Checkout browser yoxlaması ad/normal WhatsApp/quantity=3 məlumatını həm rezervdə, həm çek upload-dan sonrakı final submit-də yoxlayır;
fixture ümumi məbləği 17.97 ₼ olur, yalnız bir fixture sifariş yazılması təsdiqlənir. Canonical plan UUID-si ayrıca orijinal payment RPC-ləri ilə real PostgreSQL-də yoxlanır.
İşçi UI/API/checkout səkkiz responsive ölçüdə yoxlanıb; lokal overflow, 404 və tətbiq console xətası 0-dır.
Real stok/sifariş/rezerv/maaş/WhatsApp mesajı və production SQL dəyişikliyi 0-dır.

## Production SQL və təsdiq

Yalnız yekun yaşıl nəticədən sonra istifadəçiyə verilən fayl: **`supabase/employee-release.sql`**.
Bu tək paket backup + hər iki migration + manifest/readiness nəticəsini ehtiva edir.
Rollback: `supabase/employee-release-rollback.sql`. Production-da bunlar hələ icra edilməyib.

SQL tətbiqindən sonra göndəriləcək mətn:

> Employee migration uğurla tətbiq edildi. employee_schema_version = 2. Backup manifest yoxlaması keçdi. Hələ push/deploy etmə.
