# Netflix təsdiqi — izolə olunmuş pilot, 31 avqust 2026

## Faktiki vəziyyət

Bu sənəd tamamlanmış məhsul hesabatı deyil. Müştəri səhifəsi, admin bölməsi,
OAuth oxuma bağlantısı, database miqrasiyası və canlı indeksləmə hələ qoşulmayıb.
Yeni policy modulu heç bir server route-u və generator tərəfindən import edilmir.
`REVIEWED_NETFLIX_PROFILES` boşdur: real təsdiq qaytaran production profili yoxdur.

- Baza: `14931dcae2d91783c58fc55cfef17e57a266d063`; fetch zamanı `origin/main` ilə eyni.
- İş branch-i: `feature/netflix-confirmation-pilot`.
- Mövcud `payment-mail.mjs` yalnız Gmail `messages/send` istifadə edir.
- Göndərmə `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` ilə işləyir.
  Bu dəyişənlərə və göndərmə koduna toxunulmayıb. Məktub göndərmə bu mərhələdə canlı sınaqdan keçirilməyib.
- Admin autentifikasiya və CSRF funksiyaları `server.mjs` daxilindədir. Yeni admin
  əməliyyatları sonrakı mərhələdə məhz bu yoxlamalardan keçməlidir.
- Naviqasiya `product-pages.mjs` daxilində `renderSiteNav` / `renderSharedHeader`,
  admin menyusu `public/cms-admin.js` vasitəsilə yaradılır. Pilotdan sonra yeni
  səhifə bu ortaq mənbələrə qoşulacaq; generasiya olunmuş səhifələr əl ilə dəyişməyəcək.
- Əvvəlki admin auditində ayrıca GitHub 401 problemi sübut olunub; onun həll edildiyi
  fərz edilmir. Yeni funksiyanı düzəltmək üçün autentifikasiya keçilməyəcək.

Google Cloud brauzerində faktiki yoxlanılan `Mirpanel Notifications`
(`mirpanel-notifications`) layihəsində Gmail API aktivdir. Audience: External,
In production, 1 user / 100 user cap. Data Access-in non-sensitive, sensitive və
restricted siyahıları hamısı boşdur. Verification Center hazırda sensitive/restricted
scope tələb olunmadığı üçün yoxlamanın lazım olmadığını bildirir. Bu, gmail.readonly
icazəsinin yoxlanıldığı və ya mövcud tokenin həmin scope-a malik olduğu demək deyil.
Tokenlərin dəyərləri oxunmayıb, consent verilməyib, ayarlar dəyişdirilməyib.
Oxuma pilotu üçün ayrıca layihə/client qurulması növbəti təhlükəsizlik təsdiqi tələb edən addımdır.

Kommersiya snapshot: 31 məhsul, 22 aktiv. SHA-256:
`3c65186881cde085e590866ea15924be76f20db44106bb6a392e9fd51e26640d`.
Bu task real sifariş, kart, rezerv, maya, çek və CMS məlumatlarına yazmır.

## Hazır izolə olunmuş hissə

`mirpanel-admin/netflix-verification-policy.mjs`:

- ASCII Gmail validasiyası; nöqtə, böyük/kiçik hərf, plus və googlemail aliaslarının
  eyni canonical açara çevrilməsi. Eyni Gmail üçün ikinci müstəqil Netflix hesabı yaradılmamalıdır.
- 500 sətir / 64 KiB toplu əlavə önizləməsi; düzgün/təkrar/etibarsız bölgüsü.
- Dəqiq HTTPS host/path/query yoxlaması, boş production allowlist.
- Hesab, autentiklik, yönləndirmə, məktub növü, dil, ilkin vaxt və qeyri-müəyyən
  paralel müraciətlər üçün fail-closed nəticə sərhədi.
- Keş/oxuma sonrası hesabın status/versiyasının yenidən yoxlanması.
- Bağlantı xətası ilə məktub tapılmamasının ayrılması, minimal nəticə proyeksiyası.

**Vacib:** `verify` callback-i hələ həqiqi Gmail verifier deyil. Testdə süni
evidence qaytarır. Onun boolean sahələri müştəri payload-ından və ya adi poçt
başlıqlarından qurularsa təhlükəsizlik yaranmaz. Raw MIME/DKIM/ARC adapteri və
etibarlı mənbə uyğunlaşdırılması hazırlanıb yoxlanmadan modul public API-yə qoşulmamalıdır.

Test fixture-dəki yol, token və 15 dəqiqə TTL yalnız süni nümunədir, Netflix
protokolunun və bütün dillərdə müddətin sübutu deyil. Türk/rus/ingilis real
formatlarının heç biri hələ təsdiqlənməyib.

## Google icazəsi və deploy qapısı

Yeni oxuma üçün ayrıca OAuth client/token konfiqurasiyası istifadə olunmalıdır.
Mövcud sifariş bildirişlərinin tokenini dəyişmək və ya ona scope artırmaq olmaz.
Təklif olunan ayrıca Render secret adları (hələ runtime-a qoşulmayıb):

- `NETFLIX_GMAIL_CLIENT_ID`
- `NETFLIX_GMAIL_CLIENT_SECRET`
- `NETFLIX_GMAIL_REFRESH_TOKEN`
- `NETFLIX_GMAIL_MAILBOX` — yalnız serverdə
- `NETFLIX_VERIFICATION_ENABLED=false`
- ayrıca server şifrələmə və HMAC açarları; payment açarları təkrar istifadə edilməsin.

Mail body üçün minimum uyğun Gmail API scope `gmail.readonly`-dır; `gmail.metadata`
body vermir. Readonly icazə yalnız Netflix məktubları ilə məhdudlaşmır: texniki
olaraq mərkəzi qutunu oxuya bilir. Məhdudlaşdırma serverdə əlavə tətbiq olunmalıdır.
Google bunu restricted scope sayır; serverdə saxlama/ötürmə security assessment
tələbi yarada bilər. Tətbiqin istisna və verification statusu faktiki yoxlanmalıdır.
Sadəcə Production seçilməsi təsdiq və uyğunluq sübutu deyil.
[Google scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)

Testing rejimi 100 test istifadəçisi ilə məhduddur və Gmail offline refresh tokeni
7 gün sonra bitir. Burada 200 mənbə ünvanı 200 OAuth bağlantısı deyil: yalnız mərkəzi
hesab oxunmalıdır. Unverified user cap, layihənin real Audience/Data Access/Verification
vəziyyəti ayrıca yoxlanmalıdır. Production tokeninin də həmişə işləyəcəyi zəmanətli deyil.
[Audience](https://support.google.com/cloud/answer/15549945),
[token müddəti](https://developers.google.com/identity/protocols/oauth2#expiration)

Google kvotaları layihənin yaranma tarixinə görə fərqlənə bilər. Sabit query,
vaxt həddi, azsaylı backoff, batch ölçüsü, tək mərkəzi sync və dedup vacibdir.
100 istifadəçi paralel soruşanda 100 inbox scan edilməməlidir. Google Cloud-da
faktiki kvota yoxlanmalı, ayrıca ödəniş təsdiqi olmadan billing/upgrade açılmamalıdır.
[Gmail kvotaları](https://developers.google.com/workspace/gmail/api/reference/quota)

## Həqiqi nümunə ilə müəyyən ediləcək sərhədlər

Pilot üçün 2–3 sahibə məxsus mənbə Gmail və onlardan yönləndirilmiş uyğun
müvəqqəti giriş məktubları tələb olunur. Təsdiq keçidi açılmayacaq.

1. Raw məktubun autentikliyi və dəyişməz original recipient/time provenance yoxlanır.
   `From`, display name, subject, body-də Gmail, tək `To`, istənilən yerdə
   `Authentication-Results: pass` və saxtalaşdırıla bilən `X-Forwarded-*` kifayət deyil.
2. DKIM/ARC yoxlaması etibarlı signer/forwarder, imzalanmış sahələr, sıra və body-ni
   əhatə etməlidir. Test üçün redaktə edilmiş məktub real kriptoqrafik doğrulama sübutu deyil.
3. Etibarlı imzalanmış mənbə ünvanı və yönləndirmə zənciri birlikdə müəyyən
   edilmirsə paylaşım bloklanır. Lazım olduqda ayrıca, sahibin razılaşdığı
   mənbə-tərəfli autentifikasiya edilmiş relay və ya mənbə qutu oxuma arxitekturası
   qiymətləndirilir; avtomatik zəif `To` fallback edilmir.
4. Yalnız müvəqqəti giriş növü qəbul edilir. Login/reset/household dəyişmə/billing/
   recovery/email-change rədd olunur. Görülməmiş dil/şablon bloklanır.
5. İlkin etibarlı vaxt + konkret format üzrə təsdiqlənmiş TTL istifadə olunur.
   Yönləndirmənin qəbul vaxtı TTL-ni yeniləmir. Eyni hesabda müstəqil canlı
   müraciətlərin hansına aid olduğu bilinmirsə nəticə verilmir.

Real mailbox, link/token və MIME GitHub-a/test fixture-ə/loga yazılmamalıdır.
Gizli məlumatdan təmizlənmiş struktur fixture-ləri ilə yanaşı, real kriptoqrafik
test yalnız serverdə məhdud saxlanma ilə aparılmalı və yalnız boolean/say nəticəsi çıxarılmalıdır.

## Sonrakı implementasiya müqaviləsi — hələ icra edilməyib

- Ayrıca private Supabase account registry, unique canonical Gmail, soft-delete,
  active flag, version, added_at, last_verified_received_at; adi əlavə connected demək deyil.
- RLS + public/anon/authenticated deny; yalnız mövcud autentifikasiyalı Render
  admin endpointləri account idarə edir. 20-lik server pagination, status/axtarış,
  bulk preview-dən sonra transactional import, CSRF, idempotent arxiv/deaktivləşdirmə.
- Public lookup yalnız POST body ilə Gmail qəbul edir; query string/analytics yox.
  Bir server sync işçisi, məhdud timeout/retry, DB lease/single-flight və Gmail
  message ID uniqueness. İnkremental sync cursor etibarsız olarsa məhdud backfill.
- Xam məktub daimi saxlanmır. Lazımi nəticə qısaömürlü şifrəli cache-də; expiry
  yoxlaması cleanup işçisinin işləməsindən asılı deyil. E-poçtlar loglara yazılmır.
- IP/account üzrə paylaşılan atomik rate limit, HMAC açarlar, server cooldown;
  müştəri Gmail-i Gmail search query-yə birləşdirilmir. Unknown/deleted/inactive
  hesablar eyni public cavab alır. Response no-store/no-referrer/noindex.
- Mail HTML render edilmir. Yalnız yoxlanmış HTTPS keçid göstərilir; server həmin
  keçidi fetch etmir. Public interfeysə qutu, mesaj, profil/cihaz/yer məlumatı verilmir.
- Kill switch default off. Qeydiyyatsız/email-only giriş sahibin seçimidir;
  e-poçtu bilən üçün kodun əlçatanlıq riski rate limit ilə aradan qalxmır.
- Readonly scope və token expiry/UI/network xətaları məktub yoxdur kimi gizlədilmir.
- Mövcud payment/admin regressiyaları, 320/390/desktop UI, real A/B pilot və token
  məxfiliyi testlərindən sonra ayrıca atomik deploy. Təsdiqi istehlak etmək üçün ayrıca icazə.

## Hər mənbə Gmail üçün yönləndirmə addımları

Hələ heç bir Gmail ayarı dəyişdirilməyib. Əvvəl 2–3 pilot hesabda:

1. Mənbə Gmail → Settings → See all settings → Forwarding and POP/IMAP
   (və ya Forwarding) → Add a forwarding address. Mərkəzi qutunun ünvanını
   özünüz daxil edib Google-un mərkəzi qutuya göndərdiyi yönləndirmə təsdiqini tamamlayın.
2. Bütün şəxsi məktubları göndərən ümumi forwarding-i söndürün, Save Changes.
3. Mənbə Gmail axtarış sahəsində Show search options → From sahəsinə həqiqi
   nümunədə yoxlanmış Netflix göndərənini daxil edin. Subject boş qalsın; dilə bağlamayın.
   `info@account.netflix.com` istifadəçi nümunəsidir, hələ bu pilotda doğrulanmayıb.
4. Create filter → Forward it → təsdiqlənmiş mərkəzi ünvan → Create filter.
   Delete it seçməyin. Əlavə göndərən yalnız ayrı doğrulamadan sonra allowlist-ə düşsün.
5. Mərkəzi qutunun forwarding və filter ayarlarında mənbə qutulara geri
   yönləndirmə olmadığını yoxlayın. Mənbədə ikinci təkrar forwarding filtri yaratmayın.
6. Yeni müvəqqəti Netflix təsdiqi göndərib mərkəzi qutuya çatmasını və mənbə
   uyğunluğunu yoxlayın. Köhnə məktubun gəlməsi yeni filtrin işləməsi sübutu deyil.

Göndərən filtri autentiklik yoxlamasını əvəz etmir.
[Google forwarding qaydaları](https://support.google.com/mail/answer/10957)

## Test və yayımlama qeydi

31 yeni policy testi keçib (yalnız synthetic). Mövcud 26 resilience, 81 payment testi və
admin auth boundary yoxlamaları keçib. Payment testlərindəki RLS/private bucket
nəticələri izolə olunmuş testlərdir, canlı Supabase yoxlaması deyil.
OAuth consent, Gmail reading, live pilot,
private DB/RLS, yeni UI və deploy hələ yoxlanmayıb. Yeni commit/push edilməyib.
Yalnız lokal policy testlərini bütün sistemin hazır olması kimi təqdim etmək olmaz.

## Google Cloud quruluşu — 31 avqust 2026

- İstifadəçinin ayrıca icazəsi ilə yeni `Mirpanel Netflix Tesdiqi` layihəsi yaradıldı:
  `plasma-crossbar-507211-f9`. Google layihə adında `ə` simvolunu qəbul etmədi;
  OAuth tətbiqinin görünən adı formaya `Mirpanel Netflix Təsdiqi` yazıldı.
- Yalnız Gmail API aktivləşdirildi; API səhifəsində `Disable API` düyməsi ilə təsdiqləndi.
  Billing və ödənişli xidmət aktivləşdirilmədi. Mövcud bildiriş layihəsinə toxunulmadı.
- OAuth ilkin forması External / Testing üçün hazırlandı, lakin hələ yaradılmadı.
  `I agree to the Google API Services: User Data Policy` addımında istifadəçinin
  özü siyasəti nəzərdən keçirib qəbul etməsi üçün dayanıldı. Checkbox seçilmədi.
- OAuth client, readonly scope və test istifadəçisi hələ yaradılmayıb/təyin edilməyib.
  Heç bir yeni token/secret alınmayıb. Gmail oxunmayıb, pilot və deploy edilməyib.
