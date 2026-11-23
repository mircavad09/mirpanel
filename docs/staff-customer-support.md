# Müştəri dəstəyi və hazır hesab əvəzləmə

Giriş: https://mirpanel.com/isci. Mövcud işçi paneli genişləndirilib; satıcı və legacy stok işçisi rolları ilə birləşdirilmir. İşçi öz təsdiqlənmiş MirPanel hesabı ilə daxil olur. Sahib sessiyası tələb edilmir.

Admin → İstifadəçilər → əməkdaşın hesabı:

- “İşçi panelinə giriş” köhnə yalnız oxuma girişidir.
- “Müştəri dəstəyi” ödəniş/təhvil/zəmanət tarixçəsini və dəstək qeydlərini açır.
- “Hesab əvəzləmə” ayrıca seçilməlidir; dəstək icazəsi də tələb olunur.
- “Məhsul hesabı məlumatlarına baxış” ayrıca icazədir. MirPanel şifrəsi, OTP, müştəri sessiyası və kartın tam məlumatları heç vaxt verilmir.
- “Məhsul/paket üzrə əvəzləmə qaydaları və tarixçə” içində yalnız icazə veriləcək hazır hesab paketləri seçilir. Heç bir işçi və paket avtomatik aktiv edilmir.

İşçi ad, üzv nömrəsi və e-poçt ilə müştəri tapır. Sifarişdə konkret təhvil vahidinin “Əvəzlə” düyməsini basır, müştəri/sifariş/paket/vahid və zəmanəti yoxlayır, məcburi problem səbəbini yazır və təsdiqləyir. Səbəbə və dəstək qeydinə şifrə və təsdiq kodu yazılmamalıdır.

Əvəzləmə yalnız hazır stokdan strukturlaşdırılmış e-poçt/şifrə ilə təhvil verilmiş tək vahidə tətbiq olunur. Təchizatçı UC/oyun balansı, kod, sərbəst təhvil mətni, Netflix otağı və müştərinin öz hesabında aktivləşdirmə bu axına daxil deyil. Məhsul, paket açarı, stok imzası, hesab növü və müddət uyğunluğu yoxlanır. Rezerv edilmiş stok qorunur. Stok çatmırsa “Əvəzləmə üçün stok gözlənilir” saxlanır; işçi sonra eyni müraciətdə stoku yenidən yoxlaya bilər.

Bir təhvil vahidi üçün yalnız bir tamamlanmış işçi əvəzləməsi mümkündür. Təkrar klik, ikinci işçi və cavab itkisi əvvəlki nəticəni qaytarır. Əlavə müraciət üçün admin baxışı tələb edilir. Dəqiq olmayan və bitmiş zəmanət/xidmət müddəti işçiyə keçid vermir; “Admin baxışına göndər” tarixçədə baxış qeydi açır. Adminin sərbəst təsdiq API-si əlavə edilməyib; sahibi sübutu mövcud sifariş idarəetməsində araşdırır.

Təhvilin ID-si, orijinal tarixi, xidmətin bitmə günü və zəmanəti saxlanır; yeni müddət başlamır. Köhnə şifrəli təhvil əvəzləmə qeydində qalır, köhnə stok vahidi arxivlənib satışdan çıxarılır. Eyni transaction yeni hesabı həmin təhvilə bağlayır və mövcud mail növbəsinə unikal `replacement:<id>` bildirişi əlavə edir. Müştəri “Sifarişlərim”də cari hesabı və “Hesabınız əvəzləndi” tarixini görür. E-poçtda şifrə göndərilmir.

Maliyyə qeydi, balans dəyişikliyi və yeni satış yaradılmır. İşçi ödənişi təsdiqləyə, geri qaytara, qiymət/stok/rol/admin ayarlarını dəyişə bilməz. Hər sorğuda aktiv rol yenidən yoxlanır; əvəzləmə və rolun götürülməsi eyni icazə sətrinin kilidi ilə ardıcıllaşdırılır. Açıq panel də ləğvi yoxlayıb məlumatı təmizləyir. Cavablar no-store, şəxsi məlumatlar yalnız səhifənin yaddaşındadır.

Miqrasiya `ensureStaffReaders` vasitəsilə idempotent tətbiq edilir. Yeni icazələr false-dur. Yeni sifarişlər alış anındakı zəmanət metadatasını saxlayır; köhnə sifarişə cari kataloqdan zəmanət uydurulmur.

Sınaq: `MIRPANEL_SHOP_TEST_PORT` yalnız yerli saxta PostgreSQL bazasına yönəlir. `node scripts/test-staff-support.mjs`; brauzer üçün `STAFF_BROWSER_TEST=1`. 320/390/430/1440 px, ayrıca giriş, axtarış/tarixçə, təsdiq, qeydlər, uyğun vahid, stok çatışmazlığı/yanlış SKU, çoxməhsullu sifariş, paralel işçi, təkrar klik, yazı xətası, yeni Node prosesi ilə bərpa, bir bildiriş, balans və müddətin qorunması, zəmanət və revokasiya əhatə olunur. Canlı müştəri və stok sınaqda istifadə olunmur.
