# İşçinin işi bitirməsi və adminin yekun təsdiqi — schema v3

## Kök səbəb

V2-də yekun completion/bonus artıq adminə məxsus idi. Lakin növbə, qəbul və
çekə baxış `payment_verified_at` üçün sahibin əvvəlcədən icazəsini tələb edirdi.
Geri qaytarma səbəbi saxlanmırdı; adminin əsas panelində ayrıca yoxlama növbəsi
yox idi və təqdimatın ayrı vaxtları/saxlanılmış mesaj snapshot-u çatışmırdı.

## Yeni axın

1. Aktiv/start verilmiş işçi yalnız başlanğıcdan sonra yaranmış real sifarişi görür.
2. `Qəbul et`: `EMPLOYEE_ACCEPTED`. Adminin əvvəlcədən buraxması tələb olunmur.
3. İşçi `Çekə bax` və `Çeki yoxladım — ödəniş düzgündür` ilə ayrıca ödəniş qərarı verir.
   `payment_verified_at/by` yaranır, amma payment statusu `reviewing` olaraq qalır.
4. `Stokdan məhsul seç`: məhsul/plan/quantity üzrə atomik, idempotent rezerv.
5. Mesaj önizləməsi və `WhatsApp-da aç`: manual adapterdir, avtomatik göndərilmiş sayılmır.
6. `Göndərildi` təqdimatı qeyd edir. `İşi tamamladım` yalnız `DELIVERED_PENDING_ADMIN` yaradır.
   Mətn: **İşçi tamamlayıb — admin yoxlaması gözlənilir**.
7. Bu mərhələdə employee reserve/verify/preview/sent/submit dəyişiklikləri bloklanır.
8. Admin `Düzəliş üçün işçiyə qaytar` etdikdə məcburi səbəb saxlanır, status
   `RETURNED_TO_EMPLOYEE` olur. Mövcud stok qorunur, ikinci rezerv yaranmır.
9. Yalnız admin `Təsdiqlə və tamamla` etdikdə workflow `COMPLETED`, stok `DELIVERED`
   olur; canonical legacy payment approval RPC-si tamamlanma vaxtını DB saatından yaradır,
   real satış/maliyyə sayına daxil olur və order-ID unique bonus bir dəfə yaranır.

Payment cədvəlinin mövcud `approved/completed` canonical tərifi dəyişdirilmir.
Employee submission ona `approved` vermir. Sifarişləri silən/sıfırlayan və tarixi
10.000 satış bölgüsünü dəyişən əməliyyat yoxdur.

## Vaxtlar və təhlükəsizlik

`employee_order_assignments` daxilində ayrıca `employee_accepted_at`,
`stock_reserved_at`, `employee_delivered_at`, `employee_submitted_for_review_at`,
`admin_reviewed_at` var. `payment_verified_at` həm payment order-də, həm assignment-də,
`completed_at` isə mövcud payment order-də qalır. Köhnə alias vaxtlar uyğunluq üçün qorunur.
Heç bir vaxt frontend input-undan götürülmür. Employee `complete/return/cancel/review/fill`
endpoint-ləri üçün hətta naməlum sifariş ID-sində də `403` alır.

Hazır mesaj `message_cipher` daxilində mövcud server key-dən törənən AES-256-GCM açarı
ilə, `employee-review:<orderId>` AAD istifadə edilərək saxlanır. Açar dəyişmir.
Mesaj və stok şifrəsi auditə yazılmır; admin mesajı ayrıca authenticated GET ilə açır,
önizləmə 30 saniyədən sonra/bağlananda/tab gizlənəndə təmizlənir.
Geri qaytarma səbəbi auditin `review_reason` sahəsində saxlanır.

## Əsas admin paneli

`employee-review-admin.js` sahibin əsas admin panelinə ayrıca, sayğaclı və
pagination-lı **İşçinin tamamladığı — yoxlama gözləyənlər** bölməsi əlavə edir.
Müştəri/məhsul/plan/quantity, çek, işçinin qərarı/qeydi, stok ID-ləri, vaxtlar,
şifrələnmiş snapshot-dan mesaj və audit mövcuddur. İki yekun əməliyyat birbaşa burada da işləyir.
Mövcud sifariş filtrləri və tamamlanmış sifariş tərifi dəyişmir.

## API əlavələri / dəyişiklikləri

- Employee `POST /api/employee/orders/:id/verify`: qəbul edilmiş öz sifarişində çek qərarı.
- Employee `POST /api/employee/orders/:id/submit`: yalnız admin yoxlamasına göndərir.
- Admin `POST /api/admin/workforce/orders/:id/verify`: artıq `403`; əvvəlcədən buraxılış çıxarılıb.
- Admin `POST /api/admin/workforce/orders/:id/return`: ən azı 3 simvolluq plain-text `reason` məcburidir.
- Admin `POST /api/admin/workforce/orders/:id/complete`: yeganə yekun təsdiq.
- Admin `GET /api/admin/workforce/review-summary`: server tərəfli bütün növbənin sayğacı.
- Admin `GET /api/admin/workforce/orders/:id/review`: mesaj snapshot-u və audit, `no-store`.

## Migration, backup və rollback

Production üçün yalnız **`supabase/migrations/202610210003_employee_review.sql`**.
Əvvəlki `employee-release.sql` təkrar işlədilməməlidir.

Yeni paket transaction daxilində:

- `employee_review_release_20261021` private schema-sında dəyişən rutinləri və aid cədvəlləri
  bir dəfə snapshot edir; manifestdə frozen row count və tarix saxlanır;
- yeni nullable vaxtlar/notes/encrypted-message sahələri əlavə edir;
- assignment ödəniş vaxtını qəbul mərhələsi üçün nullable edir;
- yeni service-role-only v3 RPC və köhnə RPC üçün təhlükəsiz wrapper yaradır;
- növbə/readiness/reporting rutinlərini dəyişir və schema versiyasını `3` edir;
- heç bir real hesab/sifariş/stok/maaş seed etmir, köhnə əməliyyat sətrlərini update etmir.

Paket idempotentdir. Təkrar tətbiq snapshot-u, idempotency ledger-i və məlumatları sıfırlamır.
Yeni backend yalnız schema `>=3` olduqda işçi axınını açır.

Rollback: **`supabase/rollback/202610210003_employee_review.sql`**.
Açıq işçi sifarişi olduqda rollback təhlükəsiz bloklanır. Rutinlər v2 backup-dan
bərpa olunur və v3 RPC icazələri bağlanır. Sifariş/stok/bonus/audit/vaxt/snapshot sütunları
silinmir. Rollback ilə birlikdə tətbiq də əvvəlki commitə qaytarılmalıdır.

## Buraxılış ardıcıllığı

1. İşçi əməliyyatları üçün qısa maintenance pəncərəsi ayırın. Aktiv hesabları/start tarixlərini dəyişməyin.
2. SQL Editor-də yalnız yeni v3 migration faylını tam işlədin.
3. Son nəticə `employee_schema_version = 3` və beş backup manifest sətri olmalıdır.
4. Bu təsdiqi göndərin: **Employee review migration uğurla tətbiq edildi. Schema versiyası 3, backup manifest yoxlaması keçdi.**
5. Yalnız bundan sonra yeni commit push/Render deploy və canlı yoxlama aparılmalıdır.
6. Encryption/token açarları dəyişdirilmir, işçi hesabı/start/real sifariş test üçün yaradılmır.

Bu sənəd production migration və deploy-un icra edildiyini bildirmir.

## İzolyasiya edilmiş yoxlamalar

`node scripts/test-employee-release-gate.mjs` — əvvəlki 17 paketi saxlayır, üstünə üç v3 paketi əlavə edir.

- `test-employee-review`: HTTP/RLS rol, dəyişdirilmiş request ilə forged admin/status/timestamps,
  hazırlıq → review → məcburi səbəblə return → resubmit → final admin approval;
  faktiki `product_sales_snapshot`, completed count, maliyyə cəmi və bonus fərqləri.
- `test-employee-review-postgres`: orijinal payment migration-ları ilə real PostgreSQL,
  ayrı backend-lər, qəbul/rezerv/completion yarışları, retry, rollback, kəsilmiş bağlantı,
  v3 migration-ın təkrarı/fault rollback-i və məlumat silməyən rollback.
- `test-employee-review-browser`: əsas admin review komponenti, səbəb/mesaj/audit,
  double-click, 320/360/390/430/768/1024/1366/1440 px.
- Yenilənmiş employee browser testi adminsiz qəbul/çek yoxlamasını, kilidlənmiş review
  vəziyyətini və səkkiz responsive ölçünü qoruyur.

Yekun faktiki stdout və suite nəticələri ignored
`payment-test-artifacts/employee-release-gate-result.json` daxilindədir.
Screenshot-lar task visualization qovluğunun `employee-review-20261021` alt qovluğundadır.
Production yazısı yoxdur; bütün fixture DB-ləri test sonunda silinir.

Faktiki yekun: **20/20 paket, 574 işçi yoxlaması, failed=0**.
Real PostgreSQL v3 paketi 41, HTTP v3 paketi 80, əsas admin review browser paketi 24 yoxlama keçir.
İşçi browser paketi 156 yoxlama ilə səkkiz ölçüdə keçib.
Əvvəlki 62 foundation yoxlaması və payment/receipt/order-form regressiyaları da saxlanılıb.
Production sifariş/stok/rezerv/maaş/mesaj yazısı 0; ana səhifə/Story/banner diff-i 0.

Dəyişən fayllar:

- `mirpanel-admin/employee-api.mjs`
- `mirpanel-admin/server.mjs`
- `mirpanel-admin/public/admin.html`
- `mirpanel-admin/public/employee.js`
- `mirpanel-admin/public/employee-review-admin.js`
- `mirpanel-admin/public/payment-admin.js`
- `scripts/employee-http-fixture.mjs`
- `scripts/test-employee-http.mjs`
- `scripts/test-employee-browser.mjs`
- `scripts/test-employee-release-gate.mjs`
- `scripts/test-employee-review.mjs`
- `scripts/test-employee-review-postgres.mjs`
- `scripts/test-employee-review-browser.mjs`
- `supabase/migrations/202610210003_employee_review.sql`
- `supabase/rollback/202610210003_employee_review.sql`
- `docs/employee-review-release.md`
