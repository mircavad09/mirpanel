# Qəbzin texniki yoxlaması — lokal buraxılış paketi

Bu sənəd əvvəlki geniş əhatənin tarixçəsidir. Son qəbul siyasəti docs/receipt-shape-release.md sənədindədir: yalnız qəbz mövcudluğu, schema 5, migration YOX. Bu sənəddəki receipt schema-6 SQL-i bu buraxılış üçün işlətməyin.

Tətbiq hazırlığının aktual qərarı və HOLD şərtləri: [receipt-validation-readiness.md](receipt-validation-readiness.md). Production uyğunluğu və xarici backup restore-u bu sessiyada təsdiqlənməyib.

## Səbəb və sərhəd

Əvvəlki server yoxlaması faylın tipi/ölçüsü, private storage və upload təsdiqini yoxlayırdı; qəbz məzmununu, sifarişə uyğunluğu və müxtəlif fayllarda eyni əməliyyatın istifadəsini yoxlamırdı. Yeni qat həmin axını saxlayır və həm staged upload, həm birbaşa order upload yoluna tətbiq olunur. OCR heç vaxt sifarişi ödənilmiş/tamamlanmış etmir.

Production migration, deploy, biznes məlumatı və işçi hesabı yaradılması bu işdə icra edilmir. Bütün sifariş/qəbz sınaqları yalnız sintetik lokal fixture-lərdədir. Digər səhifələrin dizaynı, Story/banner, kataloq, qiymət, stok və WhatsApp şablonları dəyişdirilmir. Ana səhifə və 22 məhsul HTML faylında yalnız çek JS/CSS cache versiyası dəyişir.

## Qəbul siyasəti (v1)

| Profil | Əsas sahələr | Format fərqləri |
|---|---|---|
| Kapital Bank/Birbank, Yelo Bank, Rabitəbank, ABB, LeoBank | Bank, uğurlu status, AZN məbləği, tarix-saat, əməliyyat/istinad nömrəsi, alan kartın son 4 rəqəmi | Semantik etiketlər; piksel/loqo şablonu yoxdur |
| m10 | Xidmət, məbləğ, tarix-saat, əməliyyat nömrəsi, uğurlu status | Kart və ya telefonun son rəqəmləri; alan müəyyən edilmirsə manual review |
| eManat | Xidmət, əməliyyat/qəbz nömrəsi, məbləğ, tarix-saat | Mobil kart köçürməsinin bütün sahələri kor-koranə məcbur edilmir; alan yoxdursa manual review |
| PDF/QR | Təhlükəsiz render, mətn qatı, varsa QR/sənəd nömrəsi, vizual OCR ilə müqayisə | QR URL-i açılmır/fetch edilmir; tək QR məlumatı insan yoxlaması tələb edir |

- Yalnız real JPEG, PNG və təhlükəsiz PDF; maksimum 5 MB. WEBP bu tələbdə qəbul edilmir.
- `technical_pass`: çıxarılan məbləğ rezervin məbləğinə, alan son 4 rəqəm seçilmiş karta, tarix vaxt pəncərəsinə uyğundur; məcburi sahələr oxunur.
- `manual_review`: mümkün real, tanınmayan/yeni dizayn; az OCR etibarı; təhlükəsiz decode-dan sonra OCR nasazlığı; yalnız QR-də istinad; PDF mətn/şəkil ziddiyyəti; güclü risk və ya qəbz oxşarlığı. Bu status ödəniş təsdiqi DEYİL.
- `rejected`: aydın foto/sosial ekran/kart şəkli, oxunmayan/qaranlıq görüntü, məcburi sahələri olmayan tanınmış format, yüksək etibarlı yanlış məbləğ/kart/tarix və uğursuz/ləğv/gözləmədə əməliyyat. Yeni tanınmış-bank dizaynında sözlə yazılmış, hələ parse edilməyən tarix və başqa güclü qəbz sahələri varsa manual review tətbiq edilir.
- Vaxt: açıq timezone saxlanır; timezone olmayan yerli qəbz üçün Bakı (UTC+4). Gələcək üçün 5 dəqiqə dözümlülük; rezervin yaradılmasından 24 saatdan çox əvvəlki qəbz uyğun deyil. Parse edilməyən məlumatdan rəqəm uydurulmur.
- Validator/decode xidməti əlçatan deyilsə `503`: upload/continue bağlı qalır, qeyri-yoxlanmış fayl qəbul edilmir. OCR modeli işləmədiyi halda yalnız təhlükəsiz decode edilmiş fayl manual review ola bilər.

## Dublikat və risk

- SHA-256 və bank+normallaşdırılmış əməliyyat/istinad nömrəsinin domain-separated HMAC açarı: transaction daxilində unikal claim, başqa sifariş/aktiv rezerv üçün `409 RECEIPT_DUPLICATE`.
- Sıxılmış və kənarı kəsilmiş variantlarda real OCR-dən eyni istinad çıxarılması sınaqdan keçirilir.
- Migration-dan əvvəlki qəbzlərdən yalnız bazada artıq olan SHA import edilir. Köhnə qəbzlərin OCR/pHash analizi özbaşına aparılmır; onların dəyişdirilmiş nüsxələri üçün tam retrospektiv əhatə iddia edilmir. Bu səbəbdən də real bank mədaxilinin ayrıca yoxlanması həmişə məcburidir.
- 64-bit perceptual dHash, bank/məbləğ/gün/alan HMAC konteksti və ayrıca bank/məbləğ/tam vaxt/alan kombinasiyası oxşarlıq siqnalıdır. Eyni bank şablonu iki qanuni ödənişdə də oxşaya bilər: zəif oxşarlıq avtomatik saxtalıq hökmü deyil, manual review-dur.
- Rəqəm hündürlüklərinin uyğunsuzluğu, lokal JPEG residual/kompressiya fərqi, kənarda qalmış mətn və PDF mətn-şəkil ziddiyyəti risk balını artırır. Bunlar redaktəni etibarlı şəkildə sübut edən ekspertiza deyil.
- Heç bir şəkil əsasən bank hesabındakı real mədaxili sübut edə bilməz. Bank inteqrasiyası yoxdur; admin mədaxili ayrıca yoxlayıb açıq təsdiq verməlidir.

## Status və səlahiyyət

Texniki yoxlama → private upload təsdiqi → mövcud order/WhatsApp axını → ayrıca insan ödəniş yoxlaması → yalnız admin yekun təsdiqi.

Yeni qəbz yoxlamasına bağlı sifarişlərdə `receipt_validation_required=true`, `receipt_inspection_id` saxlanır. `bank_credit_verified_at/by` yalnız adminin açıq mədaxil təsdiqi olan server/RPC yolu ilə yazılır. Database trigger həmin sahələrsiz `approved/completed` keçidini bloklayır. Employee təqdimatı satış və bonus yaratmır. Köhnə sifarişlərin status/tarix/bonusları dəyişdirilmir.

- `GET /api/admin/payment-orders/:id/receipt-analysis`: mövcud admin sessiyası.
- `GET /api/admin/workforce/orders/:id/receipt-analysis`: admin sessiyası.
- `GET /api/employee/orders/:id/receipt-analysis`: ayrıca employee sessiyası və mövcud sifariş/start/ownership icazəsi.
- Hesabatda bank, məbləğ, tarix, istinad, maskalanmış alan, uyğunluq, risk və son 10 yoxlama cəhdi göstərilir. Rədd edilmiş upload sifariş yaratmır; sonradan eyni rezervdən sifariş yaranarsa rədd cəhdi də tarixçədə görünür.
- Orijinalın mövcud private signed-view axını qalır; upload cavabında açıq storage URL-i yoxdur. Raw OCR browserə/database loguna göndərilmir. Hesabat AES-256-GCM ilə mövcud server açarı altında şifrələnir.
- Mövcud qəbz silinmə müddəti qorunur. Pending hesabat müddəti rezerv bitdikdən 1 saatdır; sifarişə bağlı hesabat orijinal silinəndə təmizlənir. Sonrakı replay aşkarlanması üçün geri çevrilməyən SHA/HMAC claim-ləri saxlanır.

## OCR servisi və təhlükəsizlik

`receipt-worker/` ayrıca, tokenlə qorunan xidmətdir. Tesseract (`aze`+`eng`) və Sharp, PDF.js **6.4.299**, canvas, jsQR istifadə edir. Modellər rəsmi tessdata-fast `87416418657359cb625c412a48b6e1d6d41c29bd` revision-una bağlanıb, build zamanı SHA manifest çıxarılır; runtime model download yoxdur.

OCR ilə yanaşı mətn sətirlərinin görüntü geometriyası, fon/ink payı və oxunaqlılıq ölçülür. Sənədə bənzəyən, amma az etibarla oxunan yeni görünüş manual review-a gedir. Decoder təsdiqi olmayan boş/səhv worker cavabı isə manual review kimi qəbul edilmir, `503` ilə bağlanır.

Hər sənəd ayrı child process-dədir; secret-lər child environment-ə ötürülmür. Eyni anda 1 iş, 40 saniyə kill limiti, V8 256 MB, 20 MP/10 000 px görüntü limiti, maksimum 2 PDF səhifəsi və operator sayı limiti tətbiq edilir. JavaScript/action/attachment/XFA olan PDF, uyğunsuz MIME, polyglot, zədələnmiş və ölçü bombası bloklanır. PDF aktiv adlarının hex escape-ləri də əsas serverdə tam fayl boyu yoxlanır. Client ayrıldıqda OCR child dayandırılır.

`receipt-worker/compose.yml`: non-root image, read-only filesystem, capabilities silinir, no-new-privileges, PID 64, 768 MB/1 CPU, məhdud tmpfs, internal network. Model faylları/build manifest və node_modules Git-ə daxil deyil.

**Yoxlama sərhədi:** bu Windows mühitində Docker yoxdur. Real OCR/child-process və HTTP servis testləri keçir, amma Docker/cgroup/network məhdudiyyətlərinin production hostunda faktiki tətbiqi operator tərəfindən ayrıca təsdiqlənməlidir. Konteyner bu məhdudiyyətlərsiz və açıq internet ingress-i ilə yayımlanmamalıdır. Render private service istifadə edilərsə ekvivalent izolyasiya/egress qaydaları təsdiqlənməlidir; təkcə bearer token şəbəkə izolyasiyasının əvəzi deyil.

Yeni environment adları:

- `RECEIPT_VALIDATION_ENABLED=true` — yalnız schema 6 və hazır worker olduqdan sonra.
- `RECEIPT_OCR_URL` — private worker ünvanı; redirects yoxdur; xarici HTTP qadağandır.
- `RECEIPT_OCR_TOKEN` — backend və worker üçün eyni, təsadüfi ən az 32 baytlıq ayrıca secret. Dəyəri çata/loga/commitə yazılmır.
- Worker-də `RECEIPT_MODEL_PATH=/app/models`; lokal alternativ yalnız testdə.

Mövcud `PAYMENT_ENCRYPTION_KEY_B64` və `PAYMENT_TOKEN_SECRET_B64` dəyişdirilmir. HMAC identifikatorları mövcud token açarından domain separation ilə yaranır; gələcək rotasiya dual-key/fingerprint keçid planı olmadan edilməməlidir.

## Migration, backup və rollback

Production-da özbaşına işlətmək olmaz. Əvvəl schema 5-i read-only təsdiqləyin. Tam SQL: `supabase/migrations/202610250001_receipt_validation.sql`.

Transaction/advisory lock daxilində üç cədvəlin eyni DB-də consistency surəti və 3/3 manifest yaradılır; indi sütun siyahısı və UTC-də SHA-256 məzmun izi də yoxlanır. Bunlar tam, müstəqil, bərpa-sınaqlı backup DEYİL: CTAS constraint/index/sequence/RLS/grant və Storage fayllarını tam backup etmir. Production tətbiqindən əvvəl ayrıca xarici backup və təsdiqlənmiş məxfi restore mühitində bərpa yoxlaması tələb olunur; lokalda bu external restore edilməyib. Köhnə sifarişlərin status/qiymət/tarix/bonusu dəyişmir.

Tətbiqdən sonra tam yoxlama: `supabase/receipt-validation-verify.sql`.

Gözlənilən nəticə: employee_schema_version=6, receipt_validation_version=1, düzgün üç snapshot adı, non-null content SHA və sütun siyahısı, ACL/RLS/unique/trigger yoxlamaları, RECEIPT_VERIFY_OK. İlkin maintenance verification-da current_original_columns_match_snapshot üçü də true olmalıdır. 3/3 nəticəsi xarici backup/restore sübutu deyil.

`Receipt validation migration tətbiq edildi. Schema 6, receipt validation version 1, daxili snapshot manifest 3/3 və verification keçdi.` Bu mətn xarici backup restore-u təsdiqləmir; onun ayrıca sübutu tətbiqdən əvvəl tələb olunur.

Rollback: supabase/rollback/202610250001_receipt_validation.sql. Yeni yoxlamaya bağlı açıq sifariş və ya aktiv staged qəbz varsa ROLLBACK_BLOCKED_OPEN_RECEIPTS ilə dayanır. Əvvəl düzgün drain/expiry və ya roll-forward qərarı tələb olunur. Gate boş olduqda readiness 5 olur; cədvəl/məlumat/approval guard silinmir, register/submit RPC dayandırılır. Təkrar tətbiq məlumat silmir. Flag-ı false edib yoxlamasız checkout açmaq təhlükəsiz rollback deyil. Tam ardıcıllıq readiness sənədindədir.

## Test və tətbiq ardıcıllığı

1. `npm ci --prefix receipt-worker`, `node receipt-worker/models.mjs`.
2. Disposable lokal PostgreSQL (yalnız 127.0.0.1) işə salın; `MIRPANEL_NODE_MODULES` və `MIRPANEL_BROWSER_PATH` lokal test runtime-na uyğun olsun.
3. `node scripts/test-receipt-release.mjs`. Yekun nəticə: `payment-test-artifacts/receipt-validation/release/results.json`.
4. Synthetic OCR confusion matrix: `payment-test-artifacts/receipt-validation/policy-results.json`. FP/FN yalnız bu sintetik korpusa aiddir; real bank/populyasiya dəqiqliyi kimi təqdim edilmir.
5. 320/390/430/768/1024/1440 px upload/status/continue/hesabat, private storage/token, 3 retry/manual retry/timeout/double-click, 401/403 və real PostgreSQL paralellik yoxlamaları daxil edilib. 390 px screenshot-lar `payment-test-artifacts/receipt-validation/` altındadır.
6. Yalnız lokal commit. SQL tətbiqi təsdiqi və worker izolyasiyası yoxlanmadan push/deploy yoxdur. Sonra ayrıca icazə ilə backend/worker readiness, frontend cache assetləri və canlı read-only yoxlama aparılmalıdır. Production test sifarişi/qəbzi/rezervi/WhatsApp mesajı yaradılmır.

## İlkin 6f70 paketinin dəyişən faylları (tarixi siyahı)

6f70 commitinin əvvəlki qeydi: 16/16 paket, 350 yeni əsas assertion və 54 PostgreSQL yoxlaması idi. Bu rəqəmlər production uyğunluğu və ya xarici restore sübutu deyildi. Cari hazırlıq mərhələsinin faktiki təkrar testləri və bloklanmış yoxlamaları receipt-validation-readiness.md sənədində ayrıca göstərilir.

Layihə kökü: C:/Users/user/Documents/Codex/2026-07-22/mircavad09-mirpanel-layih-sind-yaln-z/work/mirpanel-latest

```text
.gitignore
docs/receipt-validation-release.md
index.html
mehsul/adobe-creative-cloud.page
mehsul/amazon-prime-video.page
mehsul/canva-premium.page
mehsul/capcut-pro.page
mehsul/captions-ai.page
mehsul/chatgpt-plus-ortaq-hesab.page
mehsul/chatgpt-plus.page
mehsul/cloud-ai-pro.page
mehsul/duolingo-super.page
mehsul/google-ai-pro-ultra.page
mehsul/google-ai-pro-v3.page
mehsul/grok-ai.page
mehsul/hbo-max.page
mehsul/netflix-sexsi-yenilemek.page
mehsul/netflix-sexsi.page
mehsul/netflix-umumi.page
mehsul/spotify-premium.page
mehsul/surfshark-vpn.page
mehsul/tiktok-jeton.page
mehsul/youtube-eyni-hesab.page
mehsul/youtube-premium.page
mehsul/zoom-pro.page
mirpanel-admin/employee-api.mjs
mirpanel-admin/payment-api.mjs
mirpanel-admin/payment-security.mjs
mirpanel-admin/payment-store.mjs
mirpanel-admin/product-pages.mjs
mirpanel-admin/public/admin.html
mirpanel-admin/public/employee-review-admin.js
mirpanel-admin/public/employee.html
mirpanel-admin/public/employee.js
mirpanel-admin/public/payment-admin.js
mirpanel-admin/public/receipt-analysis-view.js
mirpanel-admin/public/workforce-admin.html
mirpanel-admin/receipt-inspector.mjs
mirpanel-admin/receipt-policy.mjs
mirpanel-admin/server.mjs
payment-flow.css
payment-flow.js
receipt-worker/.dockerignore
receipt-worker/compose.yml
receipt-worker/Dockerfile
receipt-worker/engine.mjs
receipt-worker/job.mjs
receipt-worker/models.mjs
receipt-worker/package-lock.json
receipt-worker/package.json
receipt-worker/server.mjs
scripts/employee-http-fixture.mjs
scripts/receipt-gate-fixture.mjs
scripts/receipt-synthetic-fixtures.mjs
scripts/test-employee-orders-browser.mjs
scripts/test-payment-system.mjs
scripts/test-receipt-analysis-roles.mjs
scripts/test-receipt-confirmation-gate.mjs
scripts/test-receipt-inspector-failures.mjs
scripts/test-receipt-policy.mjs
scripts/test-receipt-release.mjs
scripts/test-receipt-scope.mjs
scripts/test-receipt-validation-http-browser.mjs
scripts/test-receipt-validation-postgres.mjs
scripts/test-receipt-worker.mjs
supabase/migrations/202610250001_receipt_validation.sql
supabase/receipt-validation-verify.sql
supabase/rollback/202610250001_receipt_validation.sql
```
