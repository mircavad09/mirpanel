# Beş oyun məhsulu — təhlükəsiz qaralamalar (22.11.2026)

## Hazır olan hissə

Canlı `app.js` 22.11.2026, Bakı vaxtı 20:41-də oxundu: beş məhsulun heç biri mövcud deyildi. Mövcud 36 məhsulun məlumatları dəyişdirilmədən beş **deaktiv** məhsul əlavə edilir. Kateqoriya `games` — “Oyunlar və oyun balansları”dır. İndeksləmə və sitemap daxilolması bağlıdır; əsas slayderə banner əlavə edilmir.

| Məhsul | Admin qaralamasında qiymət hədəfli paket | Əlavə araşdırma namizədləri | Cari vəziyyət |
|---|---:|---:|---|
| Mobile Legends | 2 | 41 | Deaktiv; cari hesab API qiyməti/stok/hesab ölkəsi təsdiqlənməyib |
| Honor of Kings | 15 | 2 | Deaktiv; cari hesab API qiyməti/stok/uyğunluq təsdiqlənməyib |
| Arena Breakout — mobil | 0 | 25 | Deaktiv; qiymət təsdiqi yoxdur, mobil valyuta/hesab uyğunluğu yoxlanmalıdır |
| Arena Breakout Infinite — PC | 0 | 12 | Deaktiv; qiymət təsdiqi yoxdur, PC hesabı və paket uyğunluğu yoxlanmalıdır |
| Stumble Guys | 0 | 6 | Deaktiv; qiymət, platforma və Gems/Tokens uyğunluğu təsdiqlənməyib |

Qiymətsiz 86 namizəd `catalog/five-games-20261122.json` yoxlama siyahısında oyun/kateqoriya/paket ID-si və tələb olunan sahələrlə saxlanılıb. Onlar sıfır qiymətli satış paketlərinə çevrilməyib. Qaralamaların özündə yalnız qiymət hədəfi verilmiş 17 paket bağlıdır; hamısının `active=false` dəyəri var. Sadəcə məhsulu aktiv etmək paketləri satışa açmır.

## Excel-dən götürülmüş hədəflər (satış hazır deyil)

Mənbə: `MirPanel-kataloq-ve-qiymet-arasdirmasi.xlsx`, “Qiymət təklifi”, H6:H22. İş kitabının SHA-256 izi yoxlama siyahısındadır.

| Məhsul / paket | EpinBy ID | Excel xanası | AZN satış hədəfi |
|---|---:|---|---:|
| Honor of Kings — 16 Tokens | 3825 | H6 | 0,39 |
| Double Token Lucky Bag | 3826 | H7 | 0,63 |
| Honor Point Value Pack | 3827 | H8 | 0,63 |
| 80 Tokens | 3830 | H9 | 1,81 |
| Weekly Card | 3831 | H10 | 2,06 |
| Premium Purchase Rebate Pack | 3832 | H11 | 2,37 |
| 240 Tokens | 3833 | H12 | 5,20 |
| Weekly Card Plus | 3834 | H13 | 5,44 |
| 400 Tokens | 3835 | H14 | 8,48 |
| 560 Tokens | 3836 | H15 | 11,79 |
| 830 Tokens | 3837 | H16 | 16,67 |
| 1245 Tokens | 3838 | H17 | 24,72 |
| 2508 Tokens | 3839 | H18 | 49,39 |
| 4180 Tokens | 3840 | H19 | 82,19 |
| 8360 Tokens | 3841 | H20 | 162,71 |
| Mobile Legends — Weekly | 413 | H21 | 2,91 |
| Mobile Legends — Twilight | 414 | H22 | 15,30 |

## Maya və aktivləşdirmə sərhədi

1 USD = **1,73 AZN** və ayrıca komissiya 0% yoxlama parametridir. Hesab API-si yenidən oxunmadığından **heç bir cari maya bazaya yazılmayıb**. Köhnə Excel qiyməti cari maya kimi təqdim edilmir. Tarixi sifariş xərcləri, PUBG/Free Fire qiymətləri və mövcud ümumi məzənnə dəyişdirilməyib.

`reviewFiveGamePackage` mövcud `supplierCost` dəqiq onluq hesablamasını 1,73 ilə istifadə edir; tam cari hesab kataloqu, dəqiq ID/oyun/kateqoriya/nominal/icra/sahə uyğunluğu, ölkə/platforma və rəqib müqayisəsi olmadan hazır nəticəsi vermir. Heç nə aktivləşdirmir və bazaya yazmır. Sonrakı təsdiqlənmiş qiymət mövcud `saveCatalogCost` yolu ilə saxlanmalıdır. İcranın maya snapshot-u da həmin təsdiqlənmiş 1,73 qaydasına bağlanmadan satış açılmamalıdır; mövcud ümumi 1,70 parametrini dəyişmək PUBG/Free Fire-a təsir edərdi və bu işdə edilməyib.

Mobile Legends: Global adı təkbaşına sübut deyil. İndoneziya/Braziliya istisnası və Weekly üçün MY/SG/PH/ID/RU məhdudiyyəti mətndə saxlanılıb. İlk alış bonusu vəd edilmir. Arena Breakout mobil `game=14/category=33`, Infinite PC `game=13/category=34` kimi ayrıdır. Stumble Guys üçün Gems və Tokens ayrı namizədlərdir.

## Şəkillər

Beş orijinal PNG dəyişdirilməyib. WebP nüsxələr 1200×675-dir, kəsmə edilməyib. Orijinal/optimallaşdırılmış ölçülər və orijinal SHA-256 izləri yoxlama siyahısındadır. Şəkillər məhsula bağlanıb; tərəfdaşlıq və sürət zəmanəti kimi istifadə edilmir. Müştəri vitrinində iki/beş sütun düzülüşünə və başqa dizayna toxunulmayıb.

## Yoxlamalar

- `test-five-game-drafts.mjs`: beş bağlı qaralama, 17 dəqiq qiymət hədəfi, 103 paket namizədi, dublikatın qarşısı, mövcud kataloqun eyniliyi, gizli səhifələr, forma/sıfırlar, düzgün valyuta, maya həddi, natamam kataloq və naməlum stok.
- `test-five-game-orders.mjs`: yalnız yeni yerli PostgreSQL bazaları və sintetik təchizatçı. Beş oyun, altı vahid; deaktiv məhsula sorğunun rəddi; ID/server; stok/bağlantı xətasında tutulmama; müştəriyə bağlı sifariş və nəticə; paralel checkout/işçilər; cavab itkisi və işçinin yenidən yaradılmasında bir alış/bir tutulma. Qiymətsiz üç oyunun 1 AZN sınaq qiyməti yalnız sınağın yaddaşındadır, real kataloqda yoxdur.
- `test-epinby-stock.mjs`: 60 saniyə, tam səhifələnmə, tükənmə/bərpa, natamam cavab/429/backoff və adminin deaktiv seçiminin qorunması.
- `test-epinby-finance.mjs`: valyutalar, dəqiqlik, tarixçənin qorunması, qismən/çoxməhsullu maya.
- `test-epinby-execution.mjs`: ortaq axında təkrar webhook, balans, stok, qismən/növbəli icra və məxfi təhvil sınaqları; real alış yoxdur.
- `test-five-game-admin-browser.mjs`: real admin komponentləri, izolə API cavabları, Chromium/WebKit 320/390/430/1440; beş deaktiv məhsul, mətnlər, paket sayları və şəkillərin açılması. Bunlar canlı girişli admin yoxlaması deyil.

## Çatışmayan konkret giriş

Bu icra mühitində `EPINBY_API_KEY`, `EPINBY_KEY` və baza bağlantısı təqdim edilməyib. Bu, Render-də saxlanmış açarın olmadığı demək deyil. Uzaqdakı şifrəli bağlantını işlədə bilən səlahiyyətli server icrası və ya mövcud sahib icazəli `/api/admin/api-integrations?view=epinby-catalog` oxuma girişi lazımdır. `/products` cavabı seçilmiş beş oyun üzrə bütün səhifələri əhatə etməlidir. Açarı söhbətdə paylaşmaq tələb edilmir. Bu giriş olmadan cari qiymət/stok/uyğunluq və faktiki canlı icra təsdiqlənmiş hesab edilmir.

Rəsmi istinadlar: [EpinBy API](https://epinby.com/docs), [Mobile Legends bölgə qaydaları](https://epinby.com/category/mobile-legends-global-11). Açıq səhifə qiyməti hesab API qiymətini əvəz etmir.
