# Məhsulun əlavə təsdiq pəncərəsi — 20 noyabr 2026

## Səbəb

Admin `orderConfirmationEnabled` checkbox-u `ensureConfirmation(product).enabled` sahəsini dəyişir; `orderConfirmation` və `confirmationModal` eyni normalizə edilmiş obyektdir. `core.mjs`-də nullish fallback false-u qoruyur. Son admin yayımı və canlı `/app.js` Amazon `prime` üçün hər iki sahədə `enabled:false` göstərirdi (BYPASS keş cavabı).

Problem saxlanmada deyildi: müsbət qiymətli məhsullar `runOrderFlow` → `openPreparedCartEntry` → ortaq `cart-entry.js` yoluna gedirdi. `loadTerms` şərtsiz `terms(q)` çağırırdı; server quote-u isə presentation ayarını ümumiyyətlə daşımırdı. Köhnə yolun `needsConfirmation=true` sabiti və `requireOrderConsent` çağırışının mərkəzi guard-sız olması da ayarı nəzərə almırdı.

## Dəyişiklik

Server `termsInfo`/quote-da `confirmationEnabled` boolean qaytarır. Qiymət/stok/məlumat yoxlaması dəyişmir. Bu presentation bayrağı termsVersion-a əlavə edilmir: əvvəlki qaralamalar/razılıqlar məcburi yenidən yazılmır. Müştəri server boolean-ını əsas götürür; qarışıq yayımda sahə yoxdursa kataloq ayarına baxır. Explicit false default ilə əvəz edilmir.

Söndürüləndə `fields()` mərhələsinə keçilir. Məcburi sahələr varsa forma açılır; yoxdursa mövcud qorunan qaralama saxlanılır və səbət açılır. Lazımsız warning modalı göstərilmir. Sorğu/saxlama xətaları üçün görünən xəta və retry qalır. Aktiv ayarda xəbərdarlıq checkbox-u əvvəlki kimi işləyir. Səbətdən düzəliş/reaccept də eyni qaydanı istifadə edir. Köhnə sifariş çağırışları da mərkəzi guard və ayara əsaslanan needsConfirmation istifadə edir.

Yekun alışın consentAccepted server tələbi, qiymət/stok, idempotentlik və şərt versiyası yoxlamaları olduğu kimi qalır. Yeni order/cart-entry skript versiyaları köhnə brauzer keşini ayırır.

## Yoxlama

`scripts/test-confirmation-toggle.mjs`: real quote/draft/shop kodu və izolyasiya edilmiş PostgreSQL, yerli Chrome 390/1440. Amazon/CapCut/Spotify × on/off × ana səhifə/məhsul × iki en: 24 ssenari. Səhifə yenilənir; Amazon üçün köhnə klient ayarı ilə server bayrağının üstünlüyü də sınanır. Səbət, Spotify məlumat redaktəsi, required sahələr və yekun checkbox yoxlanır. False serialization roundtrip-də qorunur. Presentation toggle terms hash-i dəyişmir. Server yekun consent=false alışını rədd edir. Sınaqda payment_orders sayı 0-dır; real alış yaradılmır.
