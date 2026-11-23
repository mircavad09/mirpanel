# Məhdud istifadəçi-baxış işçisi

Yeni ayrıca dəstək icazələri üçün [Müştəri dəstəyi qaydaları](staff-customer-support.md). Aşağıdakı yalnız oxuma məhdudiyyətləri dəstək icazəsi verilməmiş əvvəlki işçilərə tətbiq olunur; yeni POST əməliyyatları ayrıca server icazəsi tələb edir.

Giriş: https://mirpanel.com/isci (alternativ: /profil?tab=isci)

Bu, stok/təhvil işçisindən ayrı `customer-reader` roludur. İşçi adi MirPanel hesabı yaradır və e-poçtunu təsdiqləyir. Sahib Admin → İstifadəçilər → həmin istifadəçi → “Yalnız oxuyan işçi rolu ver” seçir. Eyni yerdə “İşçi rolunu götür” rolunu ləğv edir. İşçinin şifrəsi adi autentifikasiya sistemində, sahib şifrəsindən müstəqildir. Google hesabı ilə giriş də adi hesab səhifəsindən mümkündür; sonra işçi ünvanını açır.

Paneldə e-poçt/şifrə ilə ayrıca giriş forması var. Heç bir hesab və rol avtomatik təyin edilmir. Sahib hesabının brauzerdə açıq qalması tələb olunmur. Sahib-admin sessiyası işçi API-sində qəbul edilmir; adi MirPanel sessiyası və hər sorğuda aktiv rol tələb edilir.

GET /api/community/staff/session, /users və /customer xaricində heç bir işçi API-si yoxdur; bütün qeyri-GET sorğular 403-dür. /customer yalnız açıq ad, üzv nömrəsi, e-poçt, cari balans və sifarişin nömrə/məhsul/paket/tarix/məbləğ/valyuta/status sahələrini qaytarır. Oxu transaction-u READ ONLY-dir; şifrə, kod, receipt, checkout_snapshot, delivery message, kart və OAuth sahələri heç bir SQL projection-a daxil deyil. Bu panel müştərini impersonasiya etmir və müştəri sessiyası yaratmır.

Rol dəyişiklikləri ayrıca RLS-li, public/anon/authenticated icazələri alınmış customer_read_staff cədvəlindədir. Mövcud hesablar, balanslar, stok və sifarişlər dəyişdirilmir. İdarəetmə əməliyyatı community_audit-ə yazılır. Revokasiya növbəti API sorğusundan etibarən 403 qaytarır; açıq panel 10 saniyəlik icazə yoxlamasında və tabdan qayıdanda məzmunu təmizləyir. Şəxsi məlumat localStorage/sessionStorage-da saxlanmır; cavablar no-store-dur. Paneldən çıxış mövcud /api/auth/sign-out ilə yalnız həmin işçi sessiyasını bitirir.

Sahibin müştərilər üçün mövcud geniş “İstifadəçi gözündən bax” komponenti təhvil sirlərinə girişə malik olduğundan işçi üçün təkrar istifadə edilmir. Yeni məhdud görünüş həmin məlumatları yalnız təhlükəsiz proyeksiya ilə göstərir. Digər admin API-ləri və legacy employee/workforce səlahiyyətləri bu rol tərəfindən verilmir.
