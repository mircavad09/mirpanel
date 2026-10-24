# Schema 5 — vahid stok mənbəyi

## Faktiki kök səbəb və read-only audit (2026-10-24)

Kataloqdakı `stock` CMS rəqəmi idi. Checkout onu yalnız ilkin yoxlayırdı; adminin tamamlaması həmin rəqəmi azaltmırdı. Ayrı `employee_stock_units` cədvəli isə yalnız plan vahidləri ayrıldıqda işləyirdi. Schema 4 əl ilə təqdimat axını sıfır stok rezervi ilə yekun təsdiqə imkan verirdi.

Canlı kataloqda `stockEnabled=true` yalnız `chatgpt` / `/mehsul/chatgpt-plus` üçün tapıldı: kataloq sayı 1. Tamamlanmış canonical sifariş `18320c7b-f5ef-45fb-8160-f841a0d3f99c`, nömrə `12054`, plan açarı `0`, canonical plan `a10b7413-8af9-4c9e-be6e-176ff7b9a081`, quantity 1, status `approved`; 2026-10-24 10:55:25 UTC yaradılıb, 11:19:09 UTC təsdiqlənib. Bağlı stok vahidi və employee stock/audit hadisəsi tapılmadı; planın `inventory_tracked=false` dəyəri var idi.

Bu audit sifarişin stokla bağlanmadığını sübut edir, hazırda faktiki stokun mütləq 0 olduğunu yox. Sonradan mal əlavə olunmuş ola bilər. Production-a heç bir düzəliş yazılmayıb.

## Vahid mənbə və keçidlər

- Yeganə əməliyyat stoku `employee_stock_units`-dir. `product_inventory_policies` yalnız scope/versiya saxlayır, ikinci stok sayı saxlamır.
- Rəqəmlə idarə olunan məhsul: hər real vahid ayrıca `unit_kind=quantity`, `plan_id=null`; hesab/parol uydurulmur. Köhnə CMS `stock` dəyəri qorunur, amma əməliyyat sayı kimi istifadə olunmur.
- Plan hesabları/kodları: mövcud şifrələnmiş `credential` vahidləri və canonical plan ID-si. Bir planın vahidi başqa plan üçün seçilmir. Plan stoku məhsul üzrə uydurma cəmə çevrilmir.
- `AVAILABLE → RESERVED` ödəniş rezervi ilə eyni transaction-da. Mövcud satışa açıq say elə bu anda 1-dən 0-a düşür; bu yekun satış deyil, digər müştəriyə satılmamaq üçün rezervdir.
- İşçi təqdimatı: `RESERVED → DELIVERY_PENDING`; order hələ approved/completed deyil, bonus yaranmır.
- Yalnız admin yekun təsdiqi: `DELIVERY_PENDING/RESERVED → DELIVERED`, stok auditi və mövcud canonical sifariş təsdiqi bir transaction-da. Təkrar təsdiq ikinci vahid/bonus/satış yaratmır.
- Stokla izlənən sifariş üçün uyğun rezerv sayı quantity-yə bərabər deyilsə həm insert, həm yekun təsdiq bloklanır.
- Rədd/ləğv/expiry: yekunlaşmamış quantity vahidi AVAILABLE olur. Təhlükəsizlik istisnası: sirri artıq açılmış credential vahidi yenidən satılmır, DISABLED saxlanılır. DELIVERED vahidi avtomatik geri qaytarılmır.
- Public snapshot yalnız sayları qaytarır; şəxsi stok payload-u yoxdur. Ana səhifə/detail 2 saniyəlik read-only yenilənir. API sıradan çıxarsa izlənən stok təhlükəsiz bağlı vəziyyətə keçir. Server yoxlaması browserdən asılı deyil.
- Adminin `Stoku bazada saxla` düyməsi təsdiq, CSRF/admin səlahiyyəti, idempotency və optimistic version yoxlaması ilə yalnız AVAILABLE quantity vahidlərini tənzimləyir. Plan idarəsində ümumi say sahəsi bağlıdır. CMS publish stoku artırmır.

## Buraxılış — hələ production-da tətbiq edilməyib

1. İcra faylı: `supabase/migrations/202610240001_inventory_authority.sql` — tam SQL, schema 4 tələb edir, schema 5 verir. Təkrar tətbiq stok və köhnə sifarişləri dəyişmir, heç bir başlanğıc stok yaratmır.
2. Migration öz transaction-u daxilində beş əlaqəli cədvəli `inventory_release_20261024` private sxeminə snapshot edir və manifestin saylarını yoxlayır. Açıq uzun transaction varsa 10 saniyəlik lock timeout ilə tam geri qayıdır. Production backup nəticəsi yalnız sahibi tətbiq etdikdən sonra təsdiqlənə bilər.
3. Yoxlama: `supabase/inventory-authority-verify.sql`. Gözlənilən nəticə: schema 5, manifest 5 cədvəl, DO bloku xətasız. Əlavə olaraq `select public.employee_system_ready() as employee_schema_version;` nəticəsi 5 olmalıdır.
4. İstifadəçi migration-u təsdiqləyənədək push/deploy yoxdur. Migration təkbaşına köhnə frontend/backend-i yeniləmir; sonra backend schema probe, ardınca yeni cache versiyalı frontend yayımlanmalıdır. Mövcud açarlar dəyişdirilmir.
5. Yeni backend/asset buraxılışından sonra sahibi faktiki mövcud stoku sayıb ayrıca admin düyməsi ilə təsdiqləməlidir. Kataloqda qalmış 1 avtomatik import edilmir. Təsdiq edilməyən tracked məhsul təhlükəsiz 0/setup-required vəziyyətindədir.
6. Köhnə `12054` sifarişi üçün reconciliation ayrıca razılıq tələb edir: həmin tarixdən sonra stok artırılmadığını və real hazırda qalan sayı sahibi təsdiqləməli; sifariş/çek, kataloq dəyişiklik vaxtları və stok auditinə baxılmalıdır. Sonra faktiki AVAILABLE say təsdiqlənə bilər; köhnə completed_at/qiymət/bonus dəyişdirilmir və saxta tarixi stok rezervi yaradılmır. Hazırkı patch bunu etmir.

Rollback: `supabase/rollback/202610240001_inventory_authority.sql`. Açıq RESERVED/DELIVERY_PENDING varsa dayandırır. Yalnız yeni trigger/execute girişlərini söndürür və schema 4 readiness-ni bərpa edir; sifariş, stok, audit, yeni sütun və private backup silinmir. Schema 4 tətbiq versiyası ilə birlikdə istifadə edilməlidir; köhnə scalar-stok problemi rollback ilə həll olunmur. Açıq rezervləri SQL ilə məcburi silmək olmaz.

Lokal mənbə arxivi: `outputs/inventory-before-0c18f7b.zip` (Git-dən, commitə daxil deyil). Testlər yalnız 127.0.0.1:55439-da ayrıca yaradılıb silinən test bazalarında işləyir. Production açarı testlərdə istifadə olunmur.

## Test sübutları

| Paket | Nəticə |
|---|---:|
| test-inventory-authority-postgres | 56 yoxlama; iki real bağlantı; yalnız bir stok rezervi; duplicate delivery/bonus 0; timeout/killed connection rollback; migration replay/rollback |
| test-inventory-api | 28; sessiyasız 401, employee 403, legacy CMS sayına fallback yoxdur, schema gate |
| test-inventory-browser | 39; 320/390/430/768/1024/1440; yenilənmədən 1→0→1; plan izolyasiyası |
| test-inventory-admin-browser | 19; köhnəlmiş admin sayı bloklanır, double click bir yazı, plan counter bağlı |
| test-public-checkout-no-customer | 39; quantity 1; customer null; köhnə məlumat dəyişmir |
| test-employee-orders-http | 58 |
| test-employee-orders-postgres | 66; real PostgreSQL paralellik |
| test-employee-orders-browser | 68; 8 ölçü; 401/403 digər HTTP paketində |
| test-payment-system | 81; 31 məhsul/22 aktiv; commercial snapshot dəyişməyib |
| test-employee-http | 44; CSRF, session revoke, admin icazələri |
| test-employee-panel-db | 42 |
| test-employee-reporting | 62; tarixi statistika dəyişmir |
| test-employee-review | 80; işçi təqdimatı satış/maliyyə/bonus yaratmır |
| test-payment-method-selection | 6 responsive ssenari; kart rəngləri və seçim qorunur |
| test-receipt-confirmation-gate | 6 responsive ssenari + JPG/PNG/WEBP/PDF, retry/timeout, server təsdiqi, duplicate 0 |

13 sayılan paketdə 682 yoxlama, əlavə 2 browser ssenari paketi keçib. Uğursuz yekun paket: 0. `test-payment-system`-in köhnə string assertion-u schema 5 wrapper/fallback davranışına uyğunlaşdırılıb. Köhnə commercial hash-in bu işdən əvvəlki `0c18f7b:app.js` ilə də fərqli olduğu ayrıca hesablanıb sübut edilib; yeni sabit hash həmin HEAD və cari app.js-də eynidir: `0eab00edcdd6b316c35a482ca6746b6227c516ed8f50ad976f535d16550ad860`. Məhsul/qiymət/CMS dəyişdirilməyib.

Screenshot-lar (izolyasiya): `payment-test-artifacts/inventory-visuals/before-chatgpt-390.png`, `after-available-390.png`, `after-empty-390.png`, `after-home-empty-390.png`. Altı ölçüdə overflow, tətbiq JS xətası, qırıq görünən şəkil və 404: 0. Production sifariş/rezerv/stok/bonus/mesaj yazısı: 0.

## Dəyişən faylların tam siyahısı

Əməliyyat kodu:
- `mirpanel-admin/employee-api.mjs`
- `mirpanel-admin/payment-api.mjs`
- `mirpanel-admin/payment-store.mjs`
- `mirpanel-admin/server.mjs`
- `mirpanel-admin/public/admin.js`
- `mirpanel-admin/public/admin-stock-save-fix.js`
- `stock-display-fix.js`

Yalnız cache query versiyası dəyişən girişlər/generator:
- `index.html`
- `mirpanel-admin/public/admin.html`
- `mirpanel-admin/product-pages.mjs`
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

SQL/test/sənəd:
- `supabase/migrations/202610240001_inventory_authority.sql`
- `supabase/rollback/202610240001_inventory_authority.sql`
- `supabase/inventory-authority-verify.sql`
- `scripts/test-inventory-authority-postgres.mjs`
- `scripts/test-inventory-api.mjs`
- `scripts/test-inventory-browser.mjs`
- `scripts/test-inventory-admin-browser.mjs`
- `scripts/test-payment-system.mjs`
- `docs/inventory-authority-release.md`

Əvvəldən lokal dəyişmiş `scripts/test-header-product-media.mjs`, `scripts/test-splash.mjs` və `outputs/` bu işin commitinə daxil edilmir.
