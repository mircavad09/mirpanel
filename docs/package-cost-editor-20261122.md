# Paket redaktorunda maya — 22 noyabr 2026

Mənbə dəyişmir: `public.payment_plan_costs`, AZN, mövcud `save_payment_plan_costs` funksiyası və audit jurnalı. Yeni maya bazası və miqrasiya yoxdur. İctimai kataloqa maya məbləği yazılmır.

Admin → Məhsullar → məhsul → Qiymət və paketlər → paket: satış və əvvəlki qiymət yanında **Maya qiyməti — AZN**. **Mayanı saxla** yalnız mayanı serverə yazır, ayrıca yayım tələb etmir. Məhsulun **Yadda saxla / Yayımla** qaralamasından ayrıdır və bu fərq sahənin altında göstərilir. Yeni, hələ yayımlanmamış paket əvvəlcə yayımlanmalıdır; belə paket üçün serverdə mövcud olmayan qiymətə maya bağlanmır.

Köhnə ID-siz paketlərə mövcud maya açarı bir dəfə `id` kimi verilir və redaktorun qaralamasında/publikasiya nəticəsində saxlanır. Mövcud ID dəyişmir; yeni paket UUID alır. Ad dəyişməsi və sıralama bu ID-ni daşımır. Təkrarlanan ID rədd edilir. Köhnə maya qeydlərinin açarları və tarixçə yenidən yazılmır.

Hər iki maya görünüşü son oxunmuş `updated_at` versiyasını göndərir. Server mövcud maya cədvəlində tranzaksiya kilidi altında versiyanı yoxlayıb mövcud auditli funksiyanı çağırır. Köhnə görünüşün yazısı 409 ilə rədd edilir. Mikrosaniyə dəqiqliyi PostgreSQL daxilində saxlanır. Yeni dəyəri ayrıca yükləyənədək konfliktli qaralama qorunur. Hər görünüşdə yalnız dəyişmiş paketlər göndərilir. Epinby faktiki maya məlumatları yalnız oxunur; əl ilə əvəz edilmir.

GET/POST yalnız admin roluna açıqdır; mutasiya autentifikasiya və CSRF yoxlamasından keçir. GET private/no-store-dur. Maya ictimai kataloq, lokal məhsul qaralaması və yalnız oxuyan işçi cavabına əlavə edilmir. Boş dəyər qeyd edilməmiş, açıq `0` isə sıfır kimi saxlanır. Vergül/nöqtə qəbul edilir; mənfi, yanlış və iki onluqdan artıq məbləğ rədd edilir. Qiymət, stok, balans və sifariş hesablamaları dəyişdirilməyib.

## Yoxlama

- `test-package-cost-editor.mjs`: yalnız 127.0.0.1:55478 üzərində ayrılmış PostgreSQL klasteri və sintetik məlumat. Müxtəlif paketlər; iki görünüş; yenilənmə; vergül; boş/sıfır; eyni versiyanın iki paralel yazısından yalnız birinin keçməsi; server xətasında qaralamanın qalması; ad/sıra/ID; yeni paket; Epinby qorunması. Chrome və WebKit, 390 və 1440 px. İctimai məhsul qaralaması maya yazısında dəyişmir. Real məhsul yazısı: 0.
- `test-package-cost-permissions.mjs`: girişsiz 401; yalnız oxuyan işçi GET/POST 403; CSRF-siz admin mutasiyası 403; admin GET private/no-store; ictimai maya yolu yoxdur.
- `test-payment-profit.mjs`, `test-epinby-finance.mjs`, `test-seo.mjs`: keçdi.
- `test-admin-publish-roundtrip.mjs`: izolyasiya edilmiş real admin/publisher; saxla/aç/yayım, paralel Git dəyişikliyi, gecikmiş cavab, itmiş təsdiq, sessiya və şəbəkə xətaları keçdi; istehsal yazısı 0.
- `test-payment-order-cost-recovery.mjs`: ayrıca lokal sınaq bazası; köhnə sifariş, avtomatik/əl ilə təhvil, miqdarlar, dəyişməz xərc snapshot-u, Bakı tarixi, sıfır/naməlum maya, geri qaytarma keçdi.
- Mövcud `test-admin-integrity.mjs` köhnə, sabit kataloq snapshot-u ilə uğursuzdur: 31 məhsul/22 aktiv gözləyir, hazırkı əsas kataloqda 36 məhsul/15 aktivdir. Əlaqəsiz kataloq və test etalonu bu işdə dəyişdirilməyib. Ayrıca yayım və maliyyə yoxlamaları yuxarıda göstərilib.

Canlı yoxlama yalnız oxuma ilə aparılır; real məhsula sınaq mayası yazılmır. Ekran görüntülərindəki yazma ssenariləri izolyasiya edilmiş məlumatlara aiddir.
