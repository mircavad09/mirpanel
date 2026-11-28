# Fərdi dəstək pəncərəsi — 28 noyabr 2026

Başlanğıc main/canlı versiya: 075a9ab6. Paralel schema hazırlığı və pool-recovery qorunmaları saxlanıb. Ümumi qrup, maliyyə, stok və rol qaydaları dəyişməyib.

## Görünüş

Müştəri bildiriş səsi başlıqda ikon, səs sınağı və açıq razılıqlı Push isə yığcam ayarlar menyusundadır. Admin səs idarələri qalır. WhatsApp keçidi saxlanıb. Qoşulma hadisəsinin əvvəlki server qeydi dəyişdirilmədən kiçik “Əməkdaş qoşuldu” sətri göstərilir; agent qoşulanda təkrar handoff gizlənir, aşağıdakı təkrar qoşulma mətni göstərilmir.

Operatorun adı mövcud profilin ad-soyadından, yoxdursa saxlanmış adından alınır; avatar mövcud profil avatar_path-dan götürülür. Yeni avatar sistemi yaradılmayıb. Profilim bölməsində hazır avatar redaktəsi, 5 MB həddi və serverdə təhlükəsiz şəkil emalı qalır. Admin dəstək başlığında həmin profilə keçid var. Şəkilsiz baş hərflər göstərilir. İctimai cavaba yeni e-poçt, telefon, giriş məlumatı çıxmır.

Operator solda, müştəri sağda; ardıcıl göndərəndə ad/avatar yığcamlaşdırılır. Hər mətnin kopyalanması və sitatla cavab ayrıdır. Kopyalama uğursuzdursa uğur göstərilmir. Server qəbulundan sonra boz iki quş, səlahiyyətli qarşı tərəfin açıq və görünən yazışmasındakı read təsdiqindən sonra mavi iki quş göstərilir. Ekran oxuyucusu üçün adlandırma qalır. Göndərilir vəziyyətində qəbul işarəsi yoxdur.

## Canlı axın və yük

Bir runtime üçün tək PostgreSQL LISTEN bağlantısı var. Tranzaksiya daxilində pg_notify yalnız söhbət identifikatoru ilə siqnal yaradır, mətn ötürmür. SSE müştəriyə yalnız sahib olduğu söhbət üzrə siqnal verir; əməkdaş məlumat sorğuları əvvəlki icazələri yenidən yoxlayır. Bağlantı icazəsi 30 saniyəlik ürək döyüntüsündə yenidən yoxlanır. Kəsilmədə stream bağlanır, EventSource yenidən qoşulur və saxlanmış seq-dən çatışmayan məlumat alınır.

Sağlam SSE zamanı 2–3 saniyəlik əsas sorğular dayanır, 30 saniyəlik təhlükəsizlik oxuması qalır. SSE alınmasa əvvəlki məhdud sorğu mexanizmi ehtiyat kimi işləyir. Hər yenilənmədə ikinci tam tarixçə sorğusu çıxarılıb; read cursor-lar ilə mövcud mesajlar yenilənir. Yeni ödənişli xidmət və DB trigger/DDL yaradılmayıb.

## İzolə edilmiş sübutlar

- 075a9ab6 müştəri faylları ilə əvvəlki real-taymer sınağı: Chrome müştəri→admin 1497 ms, admin→müştəri 920 ms; WebKit 1316/992 ms.
- Yeni SSE/UI: Chrome/WebKit 320/390/430/1440, 206 yoxlama. Müştəri→admin 243–464 ms, admin→müştəri 199–245 ms. Sınaq mühiti və şəbəkəsi canlıdan fərqlənir; fiziki telefon deyil.
- Eyni sessiyalarda boz→mavi, gizli tabda oxunmama, profil şəkli əlavə/dəyişmə, düzgün ad, kopyalama uğur/xəta, sitat, xəta/lost-response təkrarı, əlaqə bərpası və təkrar siqnalda tək mesaj yoxlanıb.
- Backend 61, fayl/sitat məxfiliyi 29, qonaq/push 22, stream ACL/yenidən icazə 9, sound/cross-tab 25, push UI 10, push worker 7 yoxlaması. Push vendoru testlərdə simulyasiya edilib, real sistem çatdırılması deyil.
- Chrome native AudioContext oscillator keçir; bu WebKit runtime-da native audio yoxdur, mock yoxlamaları var. Fiziki dinamik təsdiqi yoxdur.
- Əvvəlki schema/restart 24 və pool recovery 8 yoxlaması qorunub.

Canlı yoxlama yalnız ayrıca icazəli yeni sınaq söhbətində aparılır; mövcud real yazışmaya sınaq mesajı göndərilmir. Lokal outputs/support-messenger-20261128 sübutları canlı fayl uyğunluğu, həqiqi mesaj/oxunma və cihaz məhdudiyyətlərini ayrı qeyd edir.

İlk canlı yoxlamada müştəri→admin 1406 ms, admin→müştəri 1364 ms ölçüldü; hər iki native səs hadisəsi və müştərinin boz→mavi keçidi keçdi. Həmin yoxlama dar ekranda görünən cavab xəbərinin ayarlar ikonuna mane olduğunu aşkarladı. Xəbər başlığın altına yerləşdirildi, 5 saniyədə gizlənir və ayarlar açıqkən görünmür. Fokus dövrəsi yalnız görünən idarələri əhatə edir. Bu maneə düzəldilmədən həmin ilk cəhd tam keçmiş sayılmayıb; son canlı yoxlama ayrıca aparılır.
