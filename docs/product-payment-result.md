# Məhsul alışının nəticəsi

`/odenis?completed=<checkout>` yalnız sahiblik yoxlanmış server GET cavabını göstərir. URL-dəki uğur/məbləğ iddiaları istifadə edilmir. Yeni sifariş, balans əməliyyatı və təhvil yaradılmır. Məbləğ təsdiqlənmiş `payment_orders.amount` cəmidir; checkout qiyməti və təchizatçı xərci ödənilmiş məbləğ kimi götürülmür.

Hazırlıq sifarişin konkret sətirlərinə aid faktiki təhvil miqdarlarından hesablanır. Tam hazır sifarişdə “Kodlarım” əsas düymədir; digər hallarda “Sifarişlərimə bax”. Qismən təhvil ayrıca izah edilir. Kodlarım keçidinin `order` parametri yalnız həmin sifarişi göstərir və sahiblik yoxlanmış mövcud təhvil API-si ilə hesabları açır. Siyahıda və ya təhvildə məxfi məlumat URL-ə yazılmır.

Gözləmə: 3 saniyədən sonra ilk avtomatik yoxlama, sonra 12 saniyə aralıqla ən çox 8 yoxlama. Arxa planda yoxlama aparılmır. Limitdən sonra istifadəçi ayrıca “Yenidən yoxla” seçə və ya sifarişlərə keçə bilər. Rədd/ləğv/geri qaytarılma vəziyyəti uğur sayılmır.

Mövcud `08-sifaris-ugurlu.wav` səsi uğurlu məhsul nəticəsi ilk göstəriləndə çağırılır. Mövcud yaddaş/sessionStorage deduplike mexanizmi eyni sifarişin status oxunuşu, yeniləmə və geri dönüşündə təkrarı dayandırır. Səs brauzerdə bloklanarsa interfeys davam edir; heç bir keçid səsi gözləmir. Yaşıl işarə və əsas sarı düymənin ağ parıltısı azaldılmış hərəkət ayarına hörmət edir. Balans artırmanın ayrıca nəticə komponentinə toxunulmayıb.

Yoxlama: `scripts/test-product-payment-result-db.mjs` saxta yerli PostgreSQL-də sahiblik, dəqiq ödəniş, təhvil miqdarı, qismən/tam nəticə və yazısız təkrar oxunuşları yoxlayır. `scripts/test-product-payment-result.mjs` Chrome/WebKit, 320/390/430/1440 px, gecikmiş təsdiq, uğursuz/ləğv, səsin bir dəfə çağırılması və bloklanması, yeniləmə/geri dönüş, məhdud yoxlama, sifarişə bağlı Kodlarım və azaldılmış hərəkəti yoxlayır. Brauzer ölçüləri emulyasiyadır; real iPhone/Android cihazında test iddia edilmir. Görüntülər yalnız saxta məlumatlardan hazırlanır.
