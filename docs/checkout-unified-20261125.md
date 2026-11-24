# Ortaq sifariş və ödəniş kartı — 25.11.2026

- Xülasə və ödəniş seçimləri bir checkout-unified-card xarici kartında yerləşdirildi. Təkrar başlıq və məbləğ bloku çıxarıldı.
- Paralel xülasə redaktəsinin daxili məhsul, zəmanət, endirim və Dəyiş görünüşü qorundu. Xarici çərçivələr ayrıca, yalnız checkout daxilində üslubla idarə olunur.
- Balans, Kart, uyğun iPhone-da Apple Pay iki sütunda; mövcud cihaz və provayder uyğunluğu dəyişdirilməyib.
- Native details/summary klaviatura davranışı qorunur; marker əvəzinə chevron, aria-expanded və reduced-motion nəzərə alınan açılış animasiyası əlavə edildi.
- Razılıq, əsas düymənin alış funksiyası, server yoxlamaları və bir dəfə icra mexanizmi dəyişdirilməyib.
- Chrome/WebKit 320/390/430/1440, Apple Pay var/yox: 464 mövcud + yeni yoxlama, əlavə 32 çərçivə yoxlaması. Eyni səhifədə səbət yenilənməsi səkkiz ssenaridə keçdi. Real sifariş, ödəniş, balans və təhvil yazısı yoxdur.
- Fiziki iPhone/Android cihazında sınaq iddiası yoxdur; brauzer sınaqlarında cihaz imkanları simulyasiya edilib.
