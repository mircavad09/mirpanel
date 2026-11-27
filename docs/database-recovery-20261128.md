# Supabase restartından sonra proses bərpası — 28 noyabr 2026

Sahib Supabase-in EBS IO ehtiyatının tükəndiyini, dəstəyin restart başlatdığını və Micro keçidinin göründüyünü bildirib. Bundan ayrıca faktiki oxumalar aparılıb.

## Tapılan nasazlıq

Render jurnalı 27 noyabr 22:05:12 UTC-də (28 noyabr 02:05:12 Bakı) `terminating connection due to administrator command` və tutulmamış `error` hadisəsindən sonra Node prosesinin çıxışını göstərir. 22:05:30 UTC-də platforma avtomatik restart edib. `pg.Pool` yaradan community runtime-da boş bağlantı xətasının dinləyicisi yox idi. Read-only deployment probe pool-da da eyni boşluq vardı.

`pool-recovery.mjs` hər pool-a bir təhlükəsiz error dinləyicisi qoşur. pg özü sıradan çıxmış boş bağlantını çıxarır; növbəti sorğu yeni bağlantı alır. Dinləyici yalnız sabit işarə və xəta kodunu yazır, klient/açar/parol obyektini jurnala çıxarmır. Sorğunu, maliyyə əməliyyatını və tranzaksiyanı avtomatik təkrarlamır. Qlobal uncaughtException ilə bütün xətalar udulmur.

Rəsmi qayda: https://node-postgres.com/apis/pool#error

## Yoxlama

- İzolə edilmiş Postgres-də yalnız sınaq bağlantısı pg_terminate_backend ilə kəsildi: `57P01` tutuldu, proses işlək qaldı, pool köhnə bağlantını çıxardı, yeni select keçdi. Xətalı SQL yenidən icra edilmədi. 8 yoxlama.
- Son main-dəki paralel schema hazırlığı qorundu; 24 schema/restart/rollback/backoff yoxlaması keçdi.
- 22:07 və 22:08 UTC-də birbaşa DB oxumaları 653/628 ms, Auth və PostgREST cavabları uğurlu idi.
- İlk Render health 502, sonra eyni işləyən 514598cc versiyasında health bərpa oldu. Əsas domenin API-ləri bir qədər sonra bərpa oldu: prices, storefront, inventory, support session 200 və JSON məzmunu ilə. `/api/homepage-banners` əsas domendə marşrut deyil; sayt bannerləri mövcud Render ünvanından oxuyur. Buna görə həmin yanlış domendəki 404 banner nasazlığı kimi qəbul edilmədi.
- Özbaşına əlavə restart göndərilmədi: mövcud proses özü bərpa oldu. Kod düzəlişinin adi yayımı bir yeni proses başladır; təkrar restart dövrəsi yaradılmır.

Canlı brauzer və yayım nəticələri lokal `outputs/recovery-20261128` daxilində ayrıca saxlanılır. Baza sıfırlanmayıb, plan dəyişdirilməyib, real sifariş/ödəniş/balans/stok sınaq mutasiyası edilməyib.
