# Spotify — bir cari şifrə sahəsi

Canlı əvvəlki DOM: email + 2 password input. Hər iki password input artıq
current-password idi; new-password 0 idi. İki password sahəsinin Chrome qeydiyyat
heuristikasına təsiri ehtimaldır, native Password Manager popup-u təkrar yaradılıb
təsdiqlənməyib. Bu iş popup-un bütün cihazlarda yox olmasına zəmanət vermir.

İkinci input, label, göz düyməsi, mismatch validasiyası və xəbərdarlıq mətni
çıxarıldı. Bir cari şifrə inputu qaldı. Email username, şifrə current-password,
autocapitalize none, spellcheck false. Şifrə type=password başlayır və yalnız
istifadəçi gözə basanda text olur. HTML value atributu və storage yoxdur.
Mövcud detached input təmizlənməsi, reset HTTPS linki və tək şifrə handoff-u qorundu.
Backend confirmation sahəsini tələb etmir; backend/storage/encryption dəyişməyib.
CMS raw plan/məhsul məlumatları yenidən yazılmayıb. Canonical Spotify renderer
köhnə CMS confirmation metadata-sını DOM-a çevirmir.

Test: test-spotify-confirmation.mjs — Windows Chrome headless və Android emulyasiyası,
5 ölçü × 2 rejim, 401 assertion. test-product-order-isolation.mjs — 22 aktiv məhsul,
39 aktiv plan, 156 purchasable ssenari; CapCut/Netflix/Google və digər məhsullar.
Real Android cihazı və native Chrome Password Manager popup-u manual yoxlanmayıb.
Real sifariş/rezerv/çek/WhatsApp mesajı 0. Testlər yalnız fixture parolları istifadə edir.

## Dəyişən fayllar

- order-confirmation.js
- scripts/test-spotify-confirmation.mjs
- scripts/test-product-order-isolation.mjs
- mirpanel-admin/product-pages.mjs (yalnız asset versiyası)
- index.html (yalnız asset versiyası)
- mehsul/adobe-creative-cloud.page
- mehsul/amazon-prime-video.page
- mehsul/canva-premium.page
- mehsul/capcut-pro.page
- mehsul/captions-ai.page
- mehsul/chatgpt-plus-ortaq-hesab.page
- mehsul/chatgpt-plus.page
- mehsul/cloud-ai-pro.page
- mehsul/duolingo-super.page
- mehsul/google-ai-pro-ultra.page
- mehsul/google-ai-pro-v3.page
- mehsul/grok-ai.page
- mehsul/hbo-max.page
- mehsul/netflix-sexsi-yenilemek.page
- mehsul/netflix-sexsi.page
- mehsul/netflix-umumi.page
- mehsul/spotify-premium.page
- mehsul/surfshark-vpn.page
- mehsul/tiktok-jeton.page
- mehsul/youtube-eyni-hesab.page
- mehsul/youtube-premium.page
- mehsul/zoom-pro.page
- docs/spotify-single-password-20261024.md

22 .page faylında yalnız order-confirmation.js query versiyası dəyişib:
spotify-single-password-20261024-1. _headers no-cache/no-store qaydası qorunub.
Şəkil, qiymət, plan, digər məhsul forması, employee, Story və banner kodu dəyişməyib.
