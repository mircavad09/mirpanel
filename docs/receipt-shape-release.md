# Aktiv əhatə: yalnız qəbzin mövcudluğunun yoxlanması

2026-10-25 sürət yeniləməsi: cari runtime və ölçmələr üçün `receipt-speed-release.md` əsas götürülür. Qəbul siyasəti dəyişməyib; hər faylda yeni proses əvəzinə limitsiz olmayan, secretsiz isti OCR prosesi işləyir.

Son istifadəçi qərarı əvvəlki geniş receipt-validation tələblərini əvəz edir.

- Yalnız qəbz əlaməti olmayan şəkil, random foto və adi yazışma ekranı saxlanır. Uyğun olmayan fayl sifariş yaratmır və sifariş statusunu rejected etmir.
- Məbləğ, kart, tarix, successful/failed və təkrar istifadə heç bir halda müqayisə/bloklama səbəbi deyil. Receipt SHA yalnız mövcud private storage yolunun/idempotency-nin hissəsidir; qlobal duplicate claim yoxdur.
- Tanınan/naməlum bank dizaynı, seçilən bulanıq/kəsilmiş qəbz, WhatsApp-dan paylaşılmış real qəbz qəbul edilir. Təkcə WhatsApp sözünə görə rədd edilmir. OCR qəbz əlamətini müəyyən edə bilmirsə qəbul edilmir; service nasazlığı 503/retry-dir, manual-review mərhələsi deyil.
- JPEG/PNG/PDF, 5 MB, magic MIME, təhlükəsiz decode, aktiv məzmunlu PDF/ölçü-bomba/polyglot qoruması qalır. Tam OCR mətni DB-də və loglarda saxlanmır.
- Serverin şəxsiyyət yoxlaması olmayan qəbz-presence nəticəsi şifrəli, rezerv+checkout+SHA+expiry-yə bağlı mövcud upload capability-sində `shapeVersion:1` ilə verilir. Köhnə/yoxlanmamış token direct submit yolunu bypass etmir.
- Uyğun upload cavabı `receiptShapeAccepted:true`, `autoSubmit:true`, `paymentVerified:false` qaytarır. Frontend mövcud order endpoint-ini bir dəfə çağırır; yalnız real order cavabından sonra mövcud confirmation ekranına keçir. WhatsApp mesajı/nömrəsi dəyişmir və testdə göndərilmir.
- Xəta: “Çek yüklənmədi. Zəhmət olmasa, düzgün çek yükləyin.”
- Uğurlu upload: “Çek uğurla yükləndi. Məlumatlar serverə ötürüldü.”
- Ödəniş/admin final approval, employee review, stok və bonus qaydaları live upstream ilə eyni saxlanılır. Əvvəlki əlavə receipt-analysis UI və bank-credit-confirmation dəyişiklikləri aktiv axından çıxarılır.

## Database və runtime

**Migration lazım deyil.** Schema 5 və mövcud submit/approval RPC istifadə edilir. `202610250001_receipt_validation.sql` və onun əvvəlki hazırlıq sənədləri tarixçə kimi lokaldakı işi qoruyur, amma bu release üçün tətbiq edilməməlidir. Heç bir migration runner/postinstall DB bağlantısı yoxdur. `RECEIPT_VALIDATION_ENABLED` köhnə geniş flag-i serverdə istifadə olunmur.

Aktiv flag: `RECEIPT_SHAPE_ENABLED` default enabled. Backend postinstall ayrıca pinned receipt-worker asılılıqlarını və eng/aze modellərini build zamanı quraşdırır. Yeni pullu servis tələb edilmir. Mövcud Render Node backend-ində hər qəbz ayrıca secretsiz child process-də, maksimum 40 saniyə/192 MB V8 limiti və 1 paralel iş ilə yoxlanır. Native/WASM yaddaşı V8 limitindən ayrıdır; container-level ayrı OCR host izolyasiyası bu release-də iddia edilmir. Private storage və signed-view dəyişmir. Payment encryption/token açarları dəyişmir.

`mirpanel-admin/.node-version` və package engines Node 24.15 tələb edir. Worker dependency audit ayrıca keçirilir. OCR modeli runtime-da internetdən endirilmir. Servis hazır deyilsə upload 503 verir və uğur/order göstərilmir.

Render monorepo build kökü repository root olmalıdır: build `npm install --prefix mirpanel-admin`, start `npm start --prefix mirpanel-admin`. Bu, `scripts/` və `receipt-worker/` fayllarını əlçatan edir; köhnə yalnız `mirpanel-admin` root seçimi bu yeni asılılıqlara uyğun deyil. Repo kökündəki `.node-version` da 24.15.0-dır. Mövcud service/plan və gizli payment açarları dəyişmir.

## Sınaq

`node scripts/test-receipt-release.mjs` indi yalnız son əhatə üzrə testləri və mövcud checkout/employee/inventory regresiyalarını çalışdırır. Əvvəlki geniş metadata/dublikat/manual-review testləri yeni qəbul siyasəti üçün etibarlı deyil və bu runner-də istifadə edilmir; tarixçədə qorunur.

Sintetik bank qəbzləri (Kapital/Birbank, Yelo, Rabitəbank, m10, eManat, ABB, Leo), yeni dizayn, fərqli məbləğ/kart/tarix/status, blur/crop, WhatsApp real qəbz və chat fərqi, təkrar qəbz, direct-submit bypass, MIME/5 MB/malicious PDF, outage, double click və 320/390/430/768/1024/1440 px browser testləri daxildir. Test business məlumatı yalnız izolyasiya edilmiş fixture/PG bazasındadır.

Artefaktlar: `payment-test-artifacts/receipt-shape/results.json`, `390-before.png`, `390-after.png`, `release/results.json`.

## Buraxılış

Main-də paralel CMS yeniləmələri normal merge ilə qorunmalıdır. SQL işlətmədən əvvəl backend, sonra Cloudflare production build-i izlənir. Backend `/api/payments/health` `receiptCheck:presence-v1`, `receiptRuntimeReady:true` göstərməlidir. Canlıda yalnız GET/DOM/assets yoxlaması: checkout reserve/upload/submit və WhatsApp mesajı testi edilmir. Aktiv production upload-un real funksional testi kimi yalnız HTTP 200 təqdim edilmir; tam funksional ssenarilər izolyasiya edilmiş mühitdə yoxlanır.
