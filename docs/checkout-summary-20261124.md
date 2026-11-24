# Sifariş xülasəsi — 24.11.2026

- `checkout-summary.js` mövcud quote.items / quote.totalCents cavabını göstərir; ayrıca ödəniləcək məbləğ hesablamır. Yalnız həmin cavabdakı düzgün əvvəlki qiymət endirim izahı üçün işlənir.
- `/sebet` səhifəsində cart-quote hadisəsi eyni cavabı xülasə və mövcud alış idarələrinə ötürür. Dəyiş keçidi cart edit hissəsinə aparır.
- Razılıq əvvəlcədən seçilmir. Natamam forma, paket şərtləri, stok, razılıq, balans və uyğun üsul qorunmaları mövcud alış funksiyasında qalır.
- Dəyişməyən arxa plan cavabı seçim və razılığı qoruyur; səbət dəyişəndə düymə yeni qiymət gələnədək bağlanır. Başlanmış alış/nəticə ekranı səbət yoxlaması ilə əvəz edilmir.
- Chrome və WebKit 320/390/430/1440: 120 xülasə yoxlaması; 8 tam inline səbət sınağı (miqdar, endirim, zəmanət, stok, sürüşmə, razılıq, daşma). İzolyasiya edilmiş məlumatlar, sıfır real sifariş/pul/təhvil yazısı.
- Görüntülər sintetik məlumatlarla brauzer sınağıdır; girişli canlı müştəri sınağı və fiziki iPhone yoxlaması deyil.
