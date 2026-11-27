# Kompüter səbət və ödəniş sütunları — 27.11.2026

- Yalnız səhifə checkout düzülüşü üçün ayrıca checkout-desktop.css, 1180 px-dən başlayaraq 65/35 sütun və 24 px ara, maksimum 1440 px konteyner.
- /sebet daxilində mövcud page-cart header/body/footer grid sahələrinə bölünür. /odenis mövcud checkout grid-i istifadə edir. DOM, quote, alış funksiyası, rezerv, balans və provayder məntiqi dəyişmir.
- Sağ kartda məhsul siyahısı və xülasənin başlığı yalnız desktop-da gizlənir; maliyyə xülasəsi, yığcam üsullar, razılıq, parlaq alış düyməsi, mövcud üsul izahı və etibar məlumatı qalır.
- Desktop-da mobil sürüşmə düyməsi gizlidir. Tövsiyələr mövcud aktiv kataloq mənbəyindən gəlir, iki sütunda, boş məcburi hündürlük olmadan göstərilir. Modal drawer üslubları ayrıca qalır.
- Sticky və daxili scroll yoxdur; səhifənin adi sürüşməsi bütün sağ karta çatır. Mobil və 1024 px bir sütun saxlanır.
- Chrome/WebKit 320/390/430/1024/1280/1440/1920, /sebet və /odenis, uzun məhsul/paket, boş və çoxməhsullu səbət, miqdar, əlavə üsullar, razılıq, ölçü dəyişməsi, stok/deaktiv üsul, scroll-lock və aşağı düyməyə çatma testləri. Bütün API-lər izolyasiya edilmişdir, real sifariş/ödəniş/balans yazısı yoxdur.
