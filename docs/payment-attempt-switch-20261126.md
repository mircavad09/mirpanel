# Yarımçıq elektron ödənişdən üsul dəyişməsi — 26.11.2026

## Sübut olunan səbəb
`startProductPayment` eyni səbəti son 24 saatdakı `submitted` checkout ilə tutuşdurur və fərqli üsulu `PAYMENT_METHOD_PENDING` ilə dayandırırdı. Qayıdış ekranı da `pending` üçün yekun düyməni bağlayırdı. Səhifədən çıxış maliyyə statusundan ayrı saxlanmırdı. Stok rezervinin on dəqiqədən sonra buraxılması provayder cəhdini bağlamır.

Yalnız oxuma canlı yoxlamasında 1,12 AZN məbləğli №13406 Birbank qeydi və provayder cavabı `error / canceled`, paid=false, rezerv buraxılmış olaraq görüldü. Şəkildə istifadəçi identifikatoru yoxdur: bunun məhz həmin istifadəçi olduğu iddia edilmir. Vəsait çatışmazlığı səbəbi təsdiqlənmədi. Yoxlama heç bir status/ledger/təhvil yazmadı.

## Mexanizm
- POST payment-abandon sahiblik yoxlanıldıqdan sonra UI cəhdini ayrıca, idempotent qeyd edir. Qeyri-müəyyən bank nəticəsi uğursuz edilmir.
- Provayder sorğusu heç claim edilməyibsə yerli cəhd bağlanır. `creating` claim transport qeyri-müəyyənliyi sayılır. Təsdiqlənmiş terminal provayder nəticəsi ayrıca saxlanılır.
- Qayıdış, ləğv keçidi və itmiş browser-back konteksti ilə fərqli üsula aydın submit eyni mexanizmdən istifadə edir. Yeni cəhd köhnə URL-i təkrar qaytarmır.
- Bank nəticəsi açıq qalmış cəhd üçün elektron üsulla davam mümkündür; balansdan yeni tutulma bank nəticəsi həll edilməyənədək bağlı qalır.
- Bütün elektron cəhdlər sabit `attempt_family` zəncirinə bağlanır. Köhnə retry zəncirləri də uyğunlaşdırılır. Paralel callback-lər mövcud settlement kilidində seriyalaşdırılır.
- Birinci real uğur təhvil üçün əsasdır. İkinci real uğur `epoint_excess_payments`, audit və sifariş snapshot-unda qeyd olunur; mövcud fulfillment hold trigger-i bütün təhvil yollarını bloklayır. Admin maliyyə siyahısında ARTÍQ ÖDƏNİŞ xəbərdarlığı görünür. Heç bir avtomatik refund və ya balans mədaxili yoxdur. Məhsul sayğacı artıq ödənişi ikinci satış saymır.
- Qeyri-müəyyən, tərk edilmiş cəhdlər əvvəlki 10/20 yoxlama limitindən sonra da serverdə arxa planda izlənir. Gecikmiş uğur yeni açılış/restartdan asılı deyil.
- Eyni səbətə aid draft istinadları saxlanır; həssas forma məlumatı brauzer yaddaşına çıxarılmır. Məbləğ dəyişirsə razılıq təkrar tələb edilir.

## Provayder məhdudiyyəti
Epoint-in rəsmi API sənədində `reverse` pul əməliyyatının ləğvi və qismən geri qaytarma məbləği ilə təsvir edilir. Yalnız ödənilməmiş URL-i, yarışda gələn uğurlu ödənişə toxunmadan etibarsızlaşdıran şərt sənədləşdirilməyib. Ona görə avtomatik reverse/refund çağırılmır. Köhnə provayder keçidinin etibarsızlaşdırıldığı iddia edilmir; UI köhnə keçidi təklif etmir və gecikmiş nəticəni izləyir. “Cəhd bağlandı” yalnız no-issued/terminal hallarda yazılır; qeyri-müəyyən halda ayrıca dürüst mətn göstərilir.
Mənbə: https://epointbucket.s3.eu-central-1.amazonaws.com/files/instructions/API%20Epoint%20en.pdf — Cancel operations.

## İzolyasiya edilmiş sınaqlar
- 52 server yoxlaması: no-issued, claimed/unknown, provider failed/error/canceled/expired/returned, Birbank→Apple Pay, itmiş return konteksti, təkrar klik/iki tab, gecikmiş iki uğur, ikinci təhvil trigger-i, yeni Node prosesində restart/replay, köhnə zəncir, qiymət dəyişməsi, gizli draftlar və sahiblik.
- 208 Chrome/WebKit yoxlaması: 320/390/430/1440, terminal/pending qayıdış→Apple Pay, iki klik bir synthetic create, fərqli UUID, paket/miqdar/draft, geri və ləğv.
- Mövcud birbaşa alış 216, əvvəlki qayıdış DB 65 və ödəniş tarixçəsi 177 yoxlaması keçdi. Satış sayğacı testi də artıq ödəniş istisnası ilə keçdi.
- Bütün sınaq provayder cavabları saxtadır. Real sınaq ödənişi, balans və təhvil yaradılmayıb. Fiziki telefonda bank təsdiqi sınağı aparıldığı iddia edilmir.

Son yoxlama: istifadə olunmamış stok rezervi geri qayıdışda buraxılır; gecikmiş ilk uğur eyni zəncirin ödənilməmiş alternativ rezervlərini buraxaraq ikinci təhvili deyil, qalib sifarişin bərpasını təmin edir. Server sınağı 56 yoxlama ilə keçdi. Saytın dar POST proksi siyahısı və girişsiz 401 cavabı ayrıca yoxlanıldı.
