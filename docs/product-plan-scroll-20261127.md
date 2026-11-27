# Məhsul səhifəsində yığcam paket siyahısı

Əsas başlanğıc: `b79023e3`. Ayrı iş qolu: `feat/compact-product-plans-20261127`. Mövcud saxlanmamış əməliyyat skriptləri dəyişdirilməyib və commit-ə daxil edilməyib.

## Dəyişiklik

`product-plan-scroll.mjs` yalnız məhsul səhifəsinin mövcud `#pp-plans-container` elementini əhatə edir. Dördədək görünən paketdə daxili sürüşdürmə və istiqamət göstəriciləri yoxdur. Daha çox paketdə təxminən dörd sətirlik, genişlənmiş fakt sətrinə yer ayıran sabit pəncərə var. Sağda daimi nazik qızılı göstərici və yuxarı/aşağı düymələri, altda faktiki ekrandan aşağıda qalan sətirlərdən hesablanan “Daha N paket ↓” var. Bu düymələr yalnız siyahını sürüşdürür.

Seçim mövcud `row.click` və `currentPlanIdx` ilə işləyir. Qiymət, aktivlik, hazır stok, təchizatçı stoku, zəmanət, çatdırılma və sifariş məntiqi dəyişməyib. Gizli paketlər sayılmır; stokda olmayan görünən paketlər yerində və bağlı qalır. Yalnız seçilmiş paketin əlavə məlumatı açılır. Mövcud faktların yumşaq girişinə sətirlərin qısa mövqe animasiyası əlavə olunur. Azaldılmış hərəkətdə söndürülür.

Alış düymələri siyahıdan kənardadır. Hover və sürüşdürmə paket seçmir. Home/End və mövcud ox/Enter/Space seçimləri stok məhdudiyyətini keçmir. Fokus görünür. Wheel/touch hadisələri bloklanmır; `overscroll-behavior:auto` səhifəyə təbii ötürməni saxlayır. Məhsuldan çıxarkən müşahidəçilər və animasiya kadrları təmizlənir.

İlkin HTML-də də beşdən çox görünən sətir olduqda CSS hündürlük həddi var; JavaScript gələnə qədər bütün paketlər səhifəni uzatmır. `product-page.js` versiyası generator və mövcud məhsul fayllarında eyniləşdirilib; keş başlıqları yenidən yoxlamanı tələb edir. Ana səhifə, səbət və ödəniş dizaynı dəyişməyib.

## Yoxlama

`node scripts/test-product-plan-scroll.mjs`: tam yerli yaradılmış məhsul səhifələri, saxta stok cavabları, bloklanmış xarici yazılar. Chrome/WebKit × 320/390/430/1440 × 1/4/5/14 paket və cari CapCut, Free Fire, Mobile Legends kataloq nüsxələri. Uzun ad, real paket qiymətinin xülasəyə ötürülməsi, tək genişlənmiş metadata, stokda olmayan seçim, zəmanətsiz paket, hover, “Daha N”, Home/End/oxlar, son paket, səhifəyə wheel ötürülməsi və reduced motion yoxlanır. Chrome-da 390 px toxunma sürüşməsi CDP ilə emulyasiya olunur. Bu, real telefonda fiziki toxunma yoxlaması deyil. WebKit yoxlaması da real iPhone/Safari testi kimi təqdim edilmir.

Görüntülərdə `fixture_*` adlı məhsullar izolyasiya edilmiş sınaq məlumatıdır; qiymətlər və stok canlıya yazılmır. Canlı açılış üçün ayrıca yalnız GET və paket seçimi istifadə olunur; alış düyməsi basılmır.

Köhnə ümumi `test-product-pages.mjs` cari kataloqda 16 aktiv məhsula qarşı sabit 22 gözləyir. Bu əvvəlki kataloq gözləntisi bu görünüş işi çərçivəsində dəyişdirilməyib. Cari kataloq sayı yeni məqsədli testdə sabit rəqəm kimi fərz edilmir.
