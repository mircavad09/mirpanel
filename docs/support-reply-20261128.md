# Canlı dəstək: cavab göndərişi və bildirişlər — 28 noyabr 2026

## Səbəb və sərhəd

Götürülməmiş yazışmada server `409 / Əvvəl yazışmanı üzərinizə götürün.` qaydasını tətbiq edir, əvvəlki interfeys isə göndərişə imkan verib səbəbi ümumi xəta ilə örtürdü. İnterfeys indi ilk göndərişdə normal claim əməliyyatını, sonra send əməliyyatını edir. Başqa əməkdaşın/bağlı yazışmasının qorunması serverdə qalır. İtmiş cavabın təkrarı eyni clientId ilə gedir; mətn/fayl xətada saxlanır.

Admin siyahısı və yazışma ayrıca sürüşür, mobil geri keçid var. Müştəri üçün bir sərbəst qonaq mesajı tranzaksiya və qonaq kukisinin hash-i ilə qorunur. Mövzu/handoff limiti sərf etmir; əvvəlki mesajlar silinmir. Giriş zamanı qonaq yazışması həmin hesabın sahibliyinə təhlükəsiz keçirilir. Yeni cihaz/kuki eyni şəxs kimi zəmanətlə tanına bilməz.

## Pulsuz Web Push

Yalnız açıq razılıq düyməsi permission soruşur. Server öz şifrələnmiş VAPID açarını və abunəliyi saxlayır; mesaj+cihaz üçün unikal, davamlı növbə var. Worker cari kuki sahibliyini yoxlamadan sistem bildirişi göstərmir. Bildiriş mətni həssas məzmun daşımır. Çıxış/hesab dəyişməsi abunəliyi söndürür. 404/410 abunəlik silinir; qeyri-müəyyən göndəriş kor-koranə təkrarlanmır. Başqa mövcud push və ödəniş sistemi dəyişməyib.

Rəsmi Apple tələbi: iOS/iPadOS 16.4 və daha yeni sistemdə ana ekrana əlavə edilmiş veb tətbiq, istifadəçi toxunuşu ilə icazə. Sistem/browser/Focus/batareya ayarları çatdırılmanı və səsi məhdudlaşdıra bilər. Hər cihazda və sönülü cihazda səs zəmanəti yoxdur.

- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers

## İzolə edilmiş yoxlamalar

- test-support-reply-20261128: Chrome/WebKit, 320/390/430/1440, 100 yoxlama; claim+Enter, uğursuz/lost-response təkrar, qaralama, qonaq limiti/adopt, görünüş və mobil geri.
- test-private-support: 61; test-support-media: 29.
- test-support-guest-push: 22; test-support-push-worker: 7; test-support-push-ui: 10. Push gateway/browser interfeysləri bu sınaqlarda saxtalaşdırılmışdır, real cihaz çatdırılması deyil.
- test-support-sound-proxy: 25, Chrome/WebKit; səs hesablayıcısı ilə tarixi/təkrar/öz mesajı/iki-tab yoxlamaları.
- test-live-support-delivery: real taymerlərlə yerli iki sessiya; Chrome 1470/1882 ms, WebKit 1836/1964 ms (müştəri→admin/admin→müştəri). Maliyyə əməliyyatı yoxdur.

Canlı yoxlama ayrıca yalnız icazəli yeni sınaq yazışmasında `scripts/live-support-reply-20261128.mjs --authorized-live-test` ilə aparılır. Tam nəticə lokal outputs/support-reply-20261128/live-proof.json-da saxlanır; canlı fayl uyğunluğu faktiki mesaj çatdırılması əvəzinə təqdim edilmir.

Girişə dönüş üçün yalnız dəqiq `/?support=<UUID>` ünvanı həm server, həm giriş formasında icazəlidir; əlavə parametr, xarici domen və saxta UUID rədd edilir. Dəstəkdən qeydiyyatda təsdiq pəncərəsi eyni səhifədə saxlanır ki, qorunan widget və qaralama tam səhifə keçidində itməsin. Chrome/WebKit giriş/qeydiyyat callback sınaqları keçirilib; hədiyyə axınının mövcud dönüş sınaqları da qorunub.

## Canlı yoxlamada xarici maneə

28 noyabr Bakı vaxtı təxminən 00:57–01:06 aralığında mövcud normal admin girişi HTTP 500 aldı. Render jurnalları dəstəkdən başqa banner, story, səbət qiyməti, balans və poçt işçilərində də `Upstream read timed out` göstərir. Mövcud birbaşa PostgreSQL bağlantısı 10 saniyə həddində açılmadı; saytın öz Supabase açarı ilə REST oxuması da 20 saniyədə bitmədi. Dəqiq xarici səbəb (xidmət vəziyyəti/şəbəkə/resurs) idarəetmə paneli olmadan təsdiqlənməyib. İdarəetmə tokeni mövcud deyil; heç bir giriş qorunması aşılmayıb.

Bu maneə səbəbindən həmin canlı cəhddə normal admin login mərhələsindən irəli gedilməyib, yeni sınaq söhbəti və push yaradılmayıb. İzolə edilmiş mesajlaşma/səs/push yoxlamaları real canlı sınaq kimi təqdim edilmir. Render aktiv commit və Cloudflare faylları ayrıca yoxlanır.
