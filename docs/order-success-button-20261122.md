# Uğurlu nəticənin sifariş düyməsi

Yalnız `shop-result[data-result=paid]` daxilindəki sifarişlər keçidinə CSS effekti əlavə edilib. Token/balans nəticələri, gözləyən və rədd edilmiş ödənişlər, digər sarı düymələr dəyişmir. `shop-ui.js`, keçidlər, server təsdiqi və sifariş/təhvil məntiqi dəyişdirilməyib.

Üç saniyəlik diaqonal ağ parıltı və maskalanmış, yumru künclərə uyğun hərəkətli bir piksellik işıq var. Qatlar `pointer-events:none`, ikon və yazı yuxarı qatdadır. Azaldılmış hərəkətdə animasiya qatları götürülür, incə statik haşiyə və kölgə qalır. CSS keçidinə yeni versiya əlavə edilib ki, köhnə keş effekti gizlətməsin.

İstinad: istifadəçinin verdiyi `mirpanel-orders-button-3s.webm` (2,974 saniyə); 0,7/1,5/2,4 saniyə kadrları oxunub. Video saytın fayllarına əlavə edilməyib.

`node scripts/test-order-success-button.mjs --record` — real müştəri komponenti, yalnız yerli sintetik GET cavabları; Chrome və WebKit-də 320, 390, 430 və 1440 px. Gözləyən cavabdan serverin təsdiq etdiyi nəticəyə keçid, üç saniyəlik hər iki animasiya, kənar işığın həqiqətən hərəkəti, sabit ölçü, daşmanın olmaması, azaldılmış hərəkət və konkret sifariş nömrəli keçid yoxlanıb. Heç bir yazıcı API sorğusu, real sifariş və ödəniş yoxdur. `--live-assets` canlı CSS-in yerli nüsxə ilə uyğunluğunu və canlı ödəniş səhifəsinin yeni CSS versiyasına bağlılığını da yoxlayır; uğurlu nəticə özü izolyasiya edilmiş məlumatla göstərilir.

Əlavə köhnə `test-checkout-sounds.mjs` ümumi sınağı ilkin məhsul seçimi mərhələsində tamamlanmadı: sınaq serveri `.mjs` fayllarını JavaScript məzmun növü ilə vermir və köhnə fixture təsdiq pəncərəsini gözləyir. Bu, uğurlu nəticəyə çatmamış baş verir. Həmin əlaqəsiz sınaq və istehsal səbət axını dəyişdirilmədi; bu hesabatda o sınaq keçmiş kimi göstərilmir.
