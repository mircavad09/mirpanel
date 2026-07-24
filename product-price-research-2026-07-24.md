# Məhsul qiyməti araşdırması

Yoxlama tarixi: 2026-07-24

Valyuta çevirməsi üçün Azərbaycan Mərkəzi Bankının son yayımlanmış rəsmi
`1 USD = 1.7000 AZN` məzənnəsi istifadə edilib:
https://www.cbar.az/?language=en

Endirim yalnız eyni məhsul, hesab növü və müddət üçün təsdiqlənmiş müqayisə
qiyməti olduqda hesablanıb:

`Math.round((regularPrice - price) / regularPrice * 100)`

## Təsdiqlənmiş müqayisələr

| Məhsul | Plan | Mirpanel qiyməti | regularPrice | Mənbə valyutası | Endirim | Mənbə | Uyğunluq |
|---|---|---:|---:|---:|---:|---|---|
| Zoom Pro | 1 ay | 9.99 ₼ | 27.18 ₼ | $15.99 | 63% | https://www.zoom.com/en/products/collaboration-tools/zoom-workplace-pro/ | Zoom Workplace Pro, aylıq ödəniş, 1 istifadəçi |
| Spotify Premium | 1 ay, fərdi | 4.99 ₼ | 9.33 ₼ | $5.49 | 47% | https://www.spotify.com/az-az/premium/ | Azərbaycan üçün Premium Fərdi, aylıq |
| Surfshark VPN | 1 ay | 3.99 ₼ | 26.27 ₼ | $15.45 | 85% | https://surfshark.com/blog/cheapest-monthly-vpn | Surfshark Starter, tək aylıq plan |
| Captions AI | 1 aylıq PRO | 11.99 ₼ | 16.98 ₼ | $9.99 | 29% | https://captions.ai/help/docs/ai-usage | Pro/Starter, aylıq |
| Captions AI | 1 aylıq MAX | 19.99 ₼ | 42.48 ₼ | $24.99 | 53% | https://captions.ai/pricing | Max, aylıq |
| Grok AI | 1 ay, SuperGrok | 17.99 ₼ | 51.00 ₼ | $30.00 | 65% | https://x.ai/pricing | SuperGrok, aylıq |
| ChatGPT Plus | 1 ay, şəxsi hesab | 16.99 ₼ | 34.00 ₼ | $20.00 | 50% | https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus | ChatGPT Plus, aylıq şəxsi plan |

## Uyğun müqayisə qiyməti tapılmayan planlar

Bu planlarda `regularPrice` boş saxlanılıb və endirim göstərilmir.

| Məhsul | Plan | Mirpanel qiyməti | Nəticə |
|---|---|---:|---|
| CapCut Pro | 1 ay | 5.99 ₼ | Rəsmi qiymət region və checkout-a görə dəyişir; Azərbaycan üçün eyni plan təsdiqlənmədi |
| HBO Max | 1 ay, Şəxsi Otaq | 5.99 ₼ | Rəsmi “şəxsi otaq” planı yoxdur |
| Netflix Şəxsi | 1 ay | 5.99 ₼ | Ayrı otaq/hesab təqdimatı rəsmi Netflix planı ilə eyni deyil |
| Netflix Şəxsi | 3 ay | 16.49 ₼ | Eyni hesab növü və 3 aylıq rəsmi plan yoxdur |
| Netflix Şəxsi | 6 ay | 29.99 ₼ | Eyni hesab növü və 6 aylıq rəsmi plan yoxdur |
| Netflix Ümumi | 1 ay | 3.99 ₼ | Paylaşılan hesab rəsmi fərdi planla müqayisə edilə bilməz |
| YouTube Yeni hesab | 1 ay | 3.49 ₼ | Hazır/yeni hesab təqdimatı üçün uyğun rəsmi müqayisə təsdiqlənmədi |
| TikTok Jeton | 500+ jeton | 10.00 ₼ | Dəqiq jeton sayı və regional checkout qiyməti sabit deyil |
| Google AI Pro + VEO 3 | 12 ay | 29.99 ₼ | Rəsmi səhifədə eyni 12 aylıq yekun qiymət təsdiqlənmədi |
| Google AI Ultra + VEO 3 | 1 ay, stokda yoxdur | 0.00 ₼ | Satış qiyməti yoxdur |
| Claude AI | 12 ay, stokda yoxdur | 0.00 ₼ | Satış qiyməti yoxdur |
| Amazon Prime Video | 1 ay | 3.99 ₼ | Azərbaycan regionu üçün eyni paket təsdiqlənmədi |
| Amazon Prime Video | 6 ay | 17.99 ₼ | Eyni 6 aylıq rəsmi plan təsdiqlənmədi |
| Duolingo Super | 1 ay | 3.99 ₼ | Azərbaycan üçün cari rəsmi aylıq checkout qiyməti açıq mənbədə təsdiqlənmədi |
| Canva Premium | 1 ay | 1.49 ₼ | Məhsulun hesab/seat növü rəsmi Canva Pro fərdi planı ilə təsdiqlənmədi |
| Canva Premium | 12 ay | 2.99 ₼ | Məhsulun hesab/seat növü və qiymət vahidi rəsmi illik planla uyğun deyil |
| Adobe Creative Cloud | 1 ay | 9.99 ₼ | Rəsmi qiymət illik öhdəliklə aylıq hesablanır; tək ayla eyni deyil |
| Adobe Creative Cloud | 4 ay | 22.99 ₼ | Rəsmi 4 aylıq plan yoxdur |
| ChatGPT Plus (Ortaq hesab) | 1 ay | 8.99 ₼ | OpenAI ortaq hesab planı satmır |
| Youtube Eyni hesab | 1 ay | 5.99 ₼ | Təqdimat modeli üçün eyni rəsmi regional plan təsdiqlənmədi |

## Əlavə rəsmi istinadlar

- Netflix plan qaydaları və hesabların eyni ev təsərrüfatı üçün olması:
  https://help.netflix.com/en/node/24926
- Google AI planları:
  https://one.google.com/about/plans
- Canva Pro qiymətləri:
  https://www.canva.com/pricing/
- Adobe Creative Cloud qiymətləri:
  https://www.adobe.com/creativecloud/pricing.html
