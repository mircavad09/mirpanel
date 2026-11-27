# Müştəri–admin dəstək axınının yekun yoxlaması

İş qolu `fix/support-message-roundtrip-20261127`; başlanğıc və canlı proses yenidən oxunub: `2f8af626`. `3b76a3e7` və sonrakı emoji, fayl, cavablandırma, oxunma və maliyyə dəyişiklikləri qorunur.

## Təsdiqlənən çatışmazlıqlar

Əsas canlı nasazlıq normal girişli admin brauzeri ilə yoxlamada üzə çıxdı: admin HTML-də `/admin-private-support.js` vardı, lakin serverin fayl marşrut siyahısında yox idi. Canlı cavab 404 idi; nəticədə dəstək UI/bildiriş/səs kodu heç başlamırdı. Məqsədli yerli fixture həmin faylı birbaşa təqdim etdiyindən əvvəlki sınaqlar bunu tutmamışdı. Fayl mövcud `requireAuth` və `role=admin` qorunan marşrutuna daxil edildi. Canlı sınaq bundan sonra girişli modulun həqiqətən JavaScript 200 qaytarmasını əvvəlcədən yoxlayır.

Əvvəlki düzəliş sərbəst mesajı saxlayır və bütün yazışmalar filtrinə daxil edir; bu mexanizm təkrar yaradılmayıb. Lakin summary hadisəsindən mesajın özünə aparan görünən bildiriş yox idi. Yalnız sayğac və səs var idi. Yeni qorunan summary hadisələri minimal müştəri adı/qonaq identifikatoru, son mətn və vaxt daşıyır. Üçədək yığcam, 15 saniyəlik bildiriş göstərilir; klik düzgün thread-i açır. Hər tabda seq/id üzrə təkrar bildiriş yaranmır. Səs üçün mövcud IndexedDB atomik qorunma saxlanır.

Müştəri widget-i bağlı halda yüklənəndə ilk 15 saniyəlik timer açılışda yenilənmirdi. Açılıb-bağlanma timer-i yenidən planlaşdırır; açıq pəncərə 2 saniyəlik mövcud GET sorğusu ilə yenilənir. Yeni WebSocket/Push xidməti qurulmur.

Admin read ACK üçün log real ölçülü, görünən ekranla kəsişən və sona yaxın olmalıdır. Gizli bölmə və ekrandan kənar log avtomatik oxunmur. Admin göndərişində də `acceptedClientId`/saxlanmış mesaj sübutu yoxlanmadan qaralama təmizlənmir və Göndərildi yazılmır. Eyni UUID təkrar cəhddə qorunur.

## Təhlükəsizlik və sınaq

İcazələr hər server sorğusunda mövcud owner/staff yoxlamasından keçir. Fayl məxfiliyi, reply və MIME yoxlamaları dəyişməyib. Şəxsi məlumatlar URL/localStorage-a əlavə edilmir; bildirişdə yalnız səlahiyyətli adminin onsuz da oxuya bildiyi mətn var. Real müştəri yazışması sınaq üçün istifadə edilmir və silinmir.

`test-live-support-delivery.mjs` iki ayrı brauzer context-i və yerli PostgreSQL ilə ilk sərbəst mesaj, başqa admin bölməsində bildiriş/səs, bildirişdən doğru thread, admin cavabı, unconfirmed response, itmiş cavabın təkrarı, offline catch-up, iki tab, mute/block/test/persisted preference və köhnə tarixçəni yoxlayır. `SUPPORT_REAL_TIMERS=1` sürətləndirilməmiş 2/3 saniyəlik intervalları ölçür. `test-support-native-audio.mjs` Chrome-da native AudioContext/oscillator start təsdiqləyir; WebKit runtime native AudioContext vermirsə SKIP açıq göstərilir. Fiziki dinamik çıxışı sertifikatlaşdırılmır.

`test-private-support.mjs`, `test-support-sound-proxy.mjs`, `test-support-media.mjs` DB, rol, paralel claim, restart/replay, bot, fayl və səs deduplikasiyasını ayrıca yoxlayır.

## Canlı yoxlama yolu

Brauzer tab bağlantısı olmadan mövcud Render səlahiyyəti vasitəsilə xidmətin artıq konfiqurasiya edilmiş admin giriş məlumatları istifadə edilir. Bunlar heç bir hesabatda yazılmır və yeni icazə/sessiya imzası uydurulmur. Adi `/api/login` → `/api/session` → support permission yolu yoxlanır. `support-authorized-access.mjs` yalnız `--check` ilə normal girişin yoxlamasını edir.

`live-support-roundtrip.mjs --authorized-live-test` bir yeni qonaq context-i və normal girişli admin context-i ilə yalnız adı açıq “İcazəli sistem sınağı” olan yazışma yaradır. Sifariş/balans/rol əməliyyatı etmir. Bu sınaq tarixçəsi silinmir. Gecikmə, cavab, native səs start, iki tab deduplikasiyası və offline bərpa nəticəsi çıxışda ayrı qeydə alınır. Ekran görüntüsü yalnız sınaq detail sahəsindən götürülür, başqa müştəri kartları paylaşılmır.

Panel/brauzer bağlı və ya cihaz sönülü olduqda dəstək bildirişi üçün Web Push/OS mexanizmi bu tapşırıqda qoşulmayıb. Gizli tabı brauzer ləngidə bilər. Səs seçimi saxlanır, lakin yeni sessiyada brauzer səsi açmaq üçün istifadəçi toxunuşu tələb edə bilər.
