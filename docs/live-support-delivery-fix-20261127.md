# Canlı dəstək mesajının görünməsi — 27.11.2026

Layihə: `mircavad09/mirpanel`, Render `mirpanel-frankfurt`, əsas domen `mirpanel.com`. İş `956456b6` main versiyasından ayrıca `fix/live-support-delivery` iş qolunda başlanıb. Başlanğıcda hər iki domendə müştəri, admin və səs modulları həmin mənbə ilə mətn üzrə eyni idi. Mövcud yazışmalar silinmir, rollar genişləndirilmir, miqrasiya tələb olunmur.

## Sübut edilmiş səbəb

Müştəri POST → transaction → `support_messages` INSERT → COMMIT yolu sərbəst mesaja icazə verir. İlk ümumi sərbəst mesaj bot tərəfindən tanınmadıqda thread `new` əvəzinə `waiting` olur. Köhnə admin komponenti standart `filter='new'` ilə list sorğusu göndərirdi. İzolyasiya edilmiş PostgreSQL və iki brauzer sessiyası ilə: ilk sərbəst mesaj üçün bazada bir müştəri qeydi var; `status=new` həmin thread-i qaytarmır, `all` qaytarır. Beləliklə mesajın saxlanması ilə adminin standart siyahısında görünməsi ayrı nəticələr idi. Bu sübut canlıdakı konkret şəxsin mesaj bazası sətrinə giriş iddiası deyil; canlı mənbəyə uyğun kodun reproduksiyasıdır.

Bot cavabı veriləndə siyahı önizləməsi son müştəri mətninin əvəzinə son bot mətnini göstərirdi. Səs sorğusu yalnız maksimum müştəri seq-ni qaytarırdı: iki sorğu arasında gələn bir neçə mesaja ayrı səs hadisəsi yox idi. Bağlantı xətasında bildiriş barı gizlənir, cursor sıfırlanır və bərpada gələn yeni mesajlar ilkin tarixçə kimi udulurdu. Səs seçimi saxlanmırdı, ayrıca sına düyməsi yox idi.

## Düzəliş

- Admin standart “Bütün yazışmalar” görünüşü; mesajlı bütün statuslar görünür, oxunmamışlar öndədir. Botun salamı təkbaşına boş növbə yaratmır. Son müştəri mətni və oxunmamış say önizləmədədir; bot transkripti yazışmada saxlanır.
- Mövcud təhlükəsiz GET polling saxlanıb: summary 2 saniyə, siyahı 3 saniyə; yeni summary hadisəsi siyahını əlavə yeniləyir. Bu SSE/WebSocket kimi təqdim edilmir. Bağlantı kəsiləndə göstərici itmir; online/focus/visibility zamanı bərpa var.
- Summary `after` cursor üzrə hər yeni müştəri mesajının ID/seq-sini səhifələyir. Müştəri və admin transkript catch-up oxunuşları artan sıra ilə ilk çatışmayan 100 mesajı alır, növbəti səhifəni tamamlayır. 205 mesajlıq saxta backlog ilə arada boşluq qalmadığı yoxlanıb.
- Server göndərilmiş müştəri mesajının `acceptedClientId` təsdiqini COMMIT-dən sonra qaytarır. Müştəri bu təsdiq və ya eyni mesajın saxlanmış transkript sətri olmadan “Göndərildi” göstərmir. İtmiş cavab eyni clientId ilə təkrarlanır, ikinci INSERT yaratmır.
- “Bildiriş səsini aktiv et”, “Səsi sına”, yazılı bloklanma vəziyyəti və istifadəçiyə bağlı localStorage seçimi. Yalnız etibarlı istifadəçi jesti AudioContext-i açır. IndexedDB unikal actor+message seq açarı tablararası atomik deduplikasiyadır. İlk tarixçə səssizdir; reconnect cursor-u saxlayır; hər müştəri mesajı ayrıca hadisədir. Bot/admin cavabı səs yaratmır. Mesajlar bir batch-də gəldikdə tonlar qısa ara ilə planlaşdırılır.
- Açıq admin qaralamaları və fokus qorunur. Yeni təhlükəli admin endpoint, müştəri impersonasiyası, balans/təhvil/ödəniş yazısı əlavə edilməyib.

## Yoxlamalar və limit

`test-private-support.mjs`: 61 DB/rol/claim/replay/restart/cursor/backlog yoxlaması. `test-live-support-delivery.mjs`: ayrı müştəri və admin context-ləri, sərbəst ilk mesaj, mövzu, bot aktivkən mesaj, handoff əvvəl/sonra, admin cavabı, saxlanmayan cavaba saxta uğur verilməməsi, itmiş cavab, offline bərpa, qaralama, iki admin tabı, səssiz/bloklanmış/test/yadda saxlanmış səs, köhnə tarixçə. Chrome və WebKit. `test-support-sound-proxy.mjs`: proxy cookie/origin/no-store və səs deduplikasiyası. Səs AudioContext simulyasiyasıdır; fiziki cihazda eşidilmə iddia edilmir. Bütün mesajlar ayrıca yerli sınaq bazasındadır, real müştəriyə mesaj göndərilmir.

Panel bağlı, brauzer bağlı və ya cihaz sönülü olarsa ayrıca Web Push/OS və ya xarici bildiriş kanalı lazımdır. Bu düzəliş həmin mexanizmi quraşdırmır və mövcud balans Push axınını dəyişmir.

Son main birləşməsi fayl, emoji, cavablandırma və oxunma göstəricilərini qoruyur. Transkript catch-up-dan sonra son snapshot oxunma vəziyyətlərini də yeniləyir. `test-support-media.mjs` 29 məxfilik/fayl/cavablandırma yoxlaması ilə keçib. `test-support-native-audio.mjs` Chrome-da real AudioContext və oscillator başlanmasını təsdiqləyir; bu WebKit runtime-da AudioContext olmadığından həmin native yoxlama açıq şəkildə SKIP edilir. Fiziki dinamik çıxışı təsdiqlənməyib.
