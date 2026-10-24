# Kataloq üzrə vahid stok görünüşü (schema 5)

Kök səbəb: əvvəlki kart nişanı yalnız `stockEnabled`/rəqəmsal stok olan məhsullar üçün yaradılırdı. Satışdan bağlı, amma rəqəmsal stok izlənməyən məhsullar eyni status yolundan keçmirdi. Planların 0 stoku yalnız yazı idi: seçim bloklanmır, ilk mövcud plan avtomatik seçilmirdi. Checkout təsdiq kodunda ayrıca köhnə CMS stok hesabı və ödənişdən sonra legacy decrement çağırışı qalırdı.

`inventory-availability.mjs` frontend və backend üçün ortaq qərar modelidir. Heç bir məhsul adına/slug-a xüsusi şərt yoxdur. Rəqəmsal say yalnız `employee_stock_units` snapshot-undan gəlir; CMS `stock`, məhsul/plan adındakı mətn say mənbəyi deyil. Stok izlənməyən məhsulun mövcud `soldOut`/`out_of_stock` satışdan-bağlama seçimi ayrıca qorunur; belə məhsula saxta database stok sayı yazılmır. Ledger artıq izlənirsə mövcudluq onun faktiki sayından hesablanır.

Public inventory API bütün aktiv kataloq üçün məhsul və canonical plan açarı üzrə `canOrder`, `tracked`, `available`, `active` qaytarır. Admin stok yazma API-si dəyişməyib. Yeni məhsul/plan CMS kataloqundan avtomatik daxil olur.

Məhsul scope: 0 → eyni qırmızı nişan, bağlı düymə və checkout. Plan scope: yalnız 0 olan plan bağlanır, nişanı bağlı accordion-da da görünür; ilk uyğun plan seçilir; bütün aktiv uyğun planlar bitibsə məhsul da bağlanır. Klaviatura stoksuz planları ötürür. İnventory yenilənməsi mövcud 2 saniyəlik interval ilədir. Sifariş/plan adları, qiymətlər və şəkillər dəyişməyib.

Checkout yeni başlanğıcda fresh inventory preflight edir; preflight ikiqat çağırışı birləşdirilir. Artıq öz son vahidini rezerv etmiş checkout-un server tərəfindən yoxlanılan resume axını qorunur. Server hər yeni rezervdən əvvəl eyni seçilmiş planı yoxlayır; database-in mövcud atomik trigger-i paralel son vahidi qoruyur. Legacy CMS decrement artıq çağırılmır; çek/WhatsApp mesajı və təqdimat məzmunu dəyişməyib.

## Testlər

- `test-inventory-availability.mjs`: 85 yoxlama, 22 real kataloq məhsulu, gələcək məhsul fixture-i, 1→0→1, plan qismən/tam bitməsi, ad/qiymət uyğunluğunun qorunması.
- `test-inventory-api.mjs`: 40; birbaşa API bypass 409, inactive/0 plan, gələcək məhsul, sessiyasız 401/employee 403.
- `test-inventory-browser.mjs`: 40; canlı yenilənmə fixture-i, 6 ölçü, planın avtomatik ötürülməsi.
- `test-inventory-catalog-browser.mjs`: 281; bütün 22 məhsul və hər birində 320/390/430/768/1024/1440; qismən/tam bitmiş plan, klaviatura, birbaşa checkout, gələcək məhsul.
- `test-inventory-authority-postgres.mjs`: 56; real PostgreSQL ayrı bağlantılarla bir son vahidə yalnız bir rezerv, duplicate delivery/bonus 0.
- `test-payment-system.mjs`: 81; commercial hash eyni, 31 ümumi/22 aktiv məhsul.
- `test-public-checkout-no-customer.mjs`: 39; quantity 1, ad/nömrə inputu tələb olunmur.
- `test-employee-orders-http.mjs`: 58; qəbul/təqdimat/təsdiq və icazələr qorunur.
- `test-employee-http.mjs`: 44; CSRF, sessiya, admin/employee izolyasiyası.
- `test-payment-method-selection.mjs`: 6 responsive ssenari; dinamik məbləğ testi yeni async inventory preflight tamamlandıqdan sonra yoxlanılır, test üçün ayrıca uyğun inventory fixture-i verilir.
- `test-receipt-confirmation-gate.mjs`: 6 responsive ssenari + JPG/PNG/WEBP/PDF, retry, timeout, server təsdiqi və double-click.

9 sayılan paketdə 724 yoxlama və əlavə 2 browser ssenari paketi keçib. Yekun uğursuz paket 0. Ölçülər üzrə overflow, console/JS xətası, qırıq görünən şəkil, 404 və testdən production yazısı 0.

## Məhsullar (canonical ID)

CapCut Pro (`capcut`); ChatGPT Plus Şəxsi (`chatgpt`); Google/Gemini Pro (`google_ai`); Netflix Şəxsi (`netflix`); Netflix Ümumi (`netflix_umumi`); Amazon Prime (`prime`); Claude (`claude_ai`); Spotify (`spotify`); YouTube Yeniləmə (`youtube_sexsi`); YouTube Yeni (`youtube`); Adobe (`adobecc`); HBO Max (`hbomax`); TikTok (`tiktok_jeton`); Surfshark (`surfshark`); Google Ultra (`google_ai_ultra`); Captions (`captions`); Grok (`grok_supergrok`); Zoom (`zoom`); Duolingo (`duolingo`); Canva (`canva`); Netflix Yeniləmə (`netflix_sexsi`); ChatGPT Ortaq (`chatgpt_ortaq`).

Read-only canlı audit: `payment-test-artifacts/inventory-catalog-audit.json`. Nişanı çatışmayan manual satışdan bağlı variantların rəqəmsal stoku izlənmirdi; onların stoku test məqsədilə production-da 0/1 edilməyib. Bu iş database-də yeni stok siyasəti, vahid, sifariş, rezerv, bonus və mesaj yaratmır. Schema 5 yetərlidir; yeni migration yoxdur, mövcud migration production-da təkrarlanmır.

Screenshot-lar: `payment-test-artifacts/inventory-catalog-visuals/` və `payment-test-artifacts/inventory-visuals/`. Əlaqəsiz əvvəlki `test-header-product-media.mjs`, `test-splash.mjs`, `.wrangler/`, `outputs/` dəyişiklikləri commitə daxil edilmir.

## Dəyişən fayllar

- `inventory-availability.mjs`
- `stock-display-fix.js`
- `stock-display-fix.css`
- `order-confirmation.js`
- `payment-flow.js`
- `mirpanel-admin/payment-api.mjs`
- `mirpanel-admin/product-pages.mjs` (cache versiyası)
- `index.html` (cache versiyaları)
- `mehsul/adobe-creative-cloud.page`
- `mehsul/amazon-prime-video.page`
- `mehsul/canva-premium.page`
- `mehsul/capcut-pro.page`
- `mehsul/captions-ai.page`
- `mehsul/chatgpt-plus-ortaq-hesab.page`
- `mehsul/chatgpt-plus.page`
- `mehsul/cloud-ai-pro.page`
- `mehsul/duolingo-super.page`
- `mehsul/google-ai-pro-ultra.page`
- `mehsul/google-ai-pro-v3.page`
- `mehsul/grok-ai.page`
- `mehsul/hbo-max.page`
- `mehsul/netflix-sexsi-yenilemek.page`
- `mehsul/netflix-sexsi.page`
- `mehsul/netflix-umumi.page`
- `mehsul/spotify-premium.page`
- `mehsul/surfshark-vpn.page`
- `mehsul/tiktok-jeton.page`
- `mehsul/youtube-eyni-hesab.page`
- `mehsul/youtube-premium.page`
- `mehsul/zoom-pro.page`
- `scripts/receipt-gate-fixture.mjs`
- `scripts/test-inventory-api.mjs`
- `scripts/test-inventory-browser.mjs`
- `scripts/test-inventory-availability.mjs`
- `scripts/test-inventory-catalog-browser.mjs`
- `scripts/test-payment-method-selection.mjs`
- `docs/inventory-display-unified.md`

22 `.page` faylında yalnız 4 əlaqəli asset query versiyası dəyişib. Story/banner, header/footer, məhsul məzmunu, canonical ID/slug və database məlumatları dəyişməyib.
