# Fərdi canlı dəstək

Mövcud sağ aşağı Söhbət pəncərəsi serverdə saxlanılan fərdi yazışmaya çevrilib. Ümumi qrup açılmır; WhatsApp saxlanır. Heç bir ödənişli AI xidməti əlavə edilmir.

## İdarəetmə

- Sahib: Admin → Canlı dəstək (`/admin.html#canli-destek`). Botun beş mövzu üzrə cavabları burada redaktə edilir və ayrıca Yayımla tələb etmədən serverdə saxlanır.
- Əməkdaş: `/canli-destek`, öz MirPanel hesabı. Sahib mövcud İstifadəçilər bölməsində işçi rolunu və dəstək icazəsini verir. Maliyyə, təhvil və hesab məlumatlarını dəyişmək hüququ əlavə edilmir. İcazə hər sorğuda bazadan yoxlanır.
- Yazışmanı ilk götürən icraçıdır. Paralel claim, transfer, close və mesajlar sətir kilidi, sabit əməliyyat açarı və unikal məhdudiyyətlərlə qorunur. Bot icraçı qoşulduqdan sonra susur.
- Yeni / Cavab gözləyir / İcrada / Bağlanmış filtrləri və səhifələmə var. Müştəri son 30 müraciətdən seçim edə, köhnə mesajları səhifələyə bilir.

## Məxfilik və davamlılıq

Hesablı müştəri yalnız öz user_id-si ilə bağlı yazışmanı açır. Qonaq üçün Secure/HttpOnly/SameSite=Lax, host-only təsadüfi cookie istifadə olunur; bazada yalnız hash saxlanır. Cookie itərsə qonaq əvvəlki yazışmaya özbaşına bağlanmır; tarixçə serverdə qalır. Qonağa sifariş məlumatları açılmır. Giriş etdikdə əvvəlki qonaq yazışması sübutsuz hesabına köçürülmür.

Mesajlar, oxunma göstəriciləri, təyinat və bot cavabları PostgreSQL-dədir. Şəxsi mətn URL/localStorage-a yazılmır; göndərilməyən qaralama yalnız tabın yaddaşında qalır. Səhifədən çıxış xəbərdarlığı var. Yenilənməzdən əvvəl uğursuz mesajı təkrar göndərmək lazımdır; serverdə artıq saxlanmış cavab itkisi eyni UUID ilə təkrar yazılmır.

Söhbət nə şifrə/kod/kart məlumatı istəyir, nə də balans, stok, təsdiq, geri ödəniş və təhvil əməliyyatı edir. Təsdiqlənmiş hesab sahibinin sifariş baxışı yalnız oxuma üçündür, məxfi təhvil məlumatları daxil deyil. Birbaşa cədvəl oxuma anon/authenticated rolları üçün qadağandır.

## Yenilənmə və səs

Müştəri açıq pəncərədə 4 saniyə, bağlı pəncərədə mövcud müraciət varsa 15 saniyə; əməkdaş siyahısı 5 saniyə, ümumi oxunmamış göstərici 8 saniyə aralıqla yenilənir. Gizli tabın siyahı sorğuları dayandırılır. Sorğuların 12 saniyə vaxt həddi, aydın xəta və təhlükəsiz təkrar cəhd var. Bot həll etmədikdə növbəyə qəbul bildirişi verir; saxta Onlayn yazılmır.

Səs yalnız Səsi aktiv et basıldıqdan sonra. İlk tarixçə, öz cavabı, köhnə seq, təkrar bağlantı və gizli tab səs yaratmır. IndexedDB atomik açarı eyni adminin çox tabında təkrarı dayandırır. Səsin testləri AudioContext simulyasiyasıdır; fiziki səs avadanlığı təsdiqi deyil. Arxa planda brauzer məhdudlaşdırması mümkündür. Bağlı brauzer üçün dəstək Push/OS bildirişi bu buraxılışa daxil deyil; mövcud balans bildirişləri dəyişməyib.

## Təhlükəsiz yoxlama

`MIRPANEL_SHOP_TEST_PORT=55475` ilə yalnız yerli müvəqqəti bazalarda:

- `node scripts/test-private-support.mjs`: müştəri/əməkdaş icazələri, parallel claim, restart, idempotent mesaj/əməliyyat, bot handoff, config version, RLS və maliyyə toxunulmazlığı.
- `node scripts/test-private-support-browser.mjs`: Chrome/WebKit, 320/390/430/1440, itmiş cavab, offline bərpa, unread/read, mobil sərhədlər, qaralama qorunması və bot redaktoru. Admin görüntüləri izolyasiya edilmiş məlumatlardır.
- `node scripts/test-support-sound-proxy.mjs`: qonaq cookie/origin/no-store, mock səs, tablararası deduplikasiya, reconnect.

Canlı açılış yoxlaması yalnız GET və pəncərəni açmaqdır; yeni müştəri mesajı, sifariş, maliyyə və təhvil yaratmır.
