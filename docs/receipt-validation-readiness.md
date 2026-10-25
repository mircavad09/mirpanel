# Qəbz migration-u: tətbiq hazırlığı və HOLD planı

Bu sənəd əvvəlki geniş əhatənin tarixçəsidir. Son qəbul siyasəti docs/receipt-shape-release.md sənədindədir: yalnız qəbz mövcudluğu, schema 5, migration YOX. Bu sənəddəki receipt schema-6 SQL-i bu buraxılış üçün işlətməyin.

## Qərar və yoxlama sərhədi

Başlanğıc commit `6f70d651497320580c8b6c45eecbdad99a299d77` qorunur. Bu mərhələdə production migration, push/deploy, işçi hesabı və biznes yazısı yoxdur. Başqa işə aid lokal dəyişikliklər saxlanır.

**Production uyğunluğu HƏLƏ TƏSDİQLƏNMƏYİB.** Bu sessiyada production SQL bağlantısı, Supabase credential-i və işlək SQL/Render CLI konfiqurasiyası tapılmadı. Production məlumatı oxunmayıb və lokala köçürülməyib. Keçmiş istifadəçi schema-5 təsdiqi cari sxemin faktiki introspeksiyası kimi təqdim edilmir. Lokal test PostgreSQL **18.4**-də repository migration zəncirindən qurulan schema 5 üzərindədir; bu, production-un eyni olduğunu sübut etmir.

**İndiki qərar: migration/deploy HOLD.** Yalnız aşağıdakı read-only preflight və backup/bərpa hazırlığı nəzərdən keçirilə bilər. Production-u dəyişən SQL bu hesabatdan avtomatik icazə almır.

## Aşkarlanan və düzəldilənlər

1. Əvvəlki `3/3` yoxlaması yalnız eyni DB-də üç CTAS surətinin sayını yoxlayırdı. Eyni sətir sayı ilə məzmun dəyişməsi görünmürdü. İndi snapshot sütun siyahısı və UTC-də SHA-256 məzmun izi saxlanır; eyni saylı sintetik dəyişiklik `BACKUP_CONTENT_MISMATCH` verir. Bakı timezone-lu verifier ilə izlər ayrıca tutuşdurulub. Bu yenə də xarici backup deyil.
2. Əvvəlki migration `receipt_*` pattern-inə düşən əlaqəsiz funksiyaların ACL-ini də dəyişirdi. `6f70` SQL-i ilə sintetik `receipt_unrelated_probe()` üzərində təkrarlandı. İndi yalnız yeddi dəqiq funksiya imzasına icazə tətbiq edilir; əlaqəsiz ACL qorunur.
3. Əvvəlki rollback yoxlamaya bağlı açıq sifariş varkən schema-nı 5-ə qaytarırdı. `6f70` ilə təkrarlandı. İndi yeni yoxlamaya bağlı qeyri-final sifariş və ya aktiv, hələ sifarişə bağlanmamış qəbul olunmuş qəbz varsa `ROLLBACK_BLOCKED_OPEN_RECEIPTS` ilə transaction dayanır.
4. Verification əvvəllər bütün funksiya ACL-lərini, hər iki cədvəlin RLS/DML icazələrini və unikal qorumanı yoxlamırdı. İndi bunlar və aktiv approval trigger yoxlanır.
5. `reservation_id=NULL` ehtimalı repository sxemində problem deyil: schema 5 zəncirində `NOT NULL` və FK var. Constraint zəiflədilməyib. Sintetik drift yaradıldıqda preflight dayanır; production-da bu constraint fərqlidirsə avtomatik düzəltmək olmaz.
6. Geri dönüşdə saxlanmış readiness funksiyası yoxdursa və ya faktiki schema 5-ə qaytarmırsa transaction artıq `ROLLBACK_DEFINITION_MISSING` / `RECEIPT_ROLLBACK_TARGET_MISMATCH` verir. Sintetik yanlış hədəflə sınaqdan keçirilib. Tanınmayan schema-6 başlanğıcı da ayrıca dayandırılır.

## Fayllar (layihə kökünə nisbətən)

- Read-only əvvəlcədən yoxlama: `supabase/receipt-validation-preflight.sql`.
- Tətbiq ediləcək tam transaction: `supabase/migrations/202610250001_receipt_validation.sql`.
- Read-only tətbiq sonrası yoxlama: `supabase/receipt-validation-verify.sql`.
- Məlumat silməyən dayandırma/rollback: `supabase/rollback/202610250001_receipt_validation.sql`.
- Snapshot manifest SQL-i migration daxilindədir; ayrıca xarici backup faylı YOXDUR. Yaradılan cədvəl: `receipt_release_20261025.manifest`.
- Bu mərhələnin əlavə testləri: `scripts/test-receipt-migration-readiness.mjs`, `scripts/test-receipt-version-compatibility.mjs`.
- Əlaqəli regression dəyişiklikləri: `scripts/test-receipt-validation-postgres.mjs`, `scripts/receipt-gate-fixture.mjs`, `scripts/test-receipt-release.mjs`.
- Əvvəlki buraxılış sənədi: `docs/receipt-validation-release.md` (bu planla dəqiqləşdirilir).

Layihə kökü: `C:/Users/user/Documents/Codex/2026-07-22/mircavad09-mirpanel-layih-sind-yaln-z/work/mirpanel-latest`.

## Operator indi harada və nə işlədə bilər?

**Supabase Dashboard → MirPanel-in backend konfiqurasiyasındakı project-ref ilə eyni PRODUCTION layihə → SQL Editor → PostgreSQL `postgres` bazası → `postgres`/səlahiyyətli owner rolu.** Layihənin cari adı/ref-i bu sessiyada yoxlanmayıb; oxşar adlı staging layihəsini seçməyin və URL/key dəyərlərini çata göndərməyin.

1. İndi yalnız `receipt-validation-preflight.sql` məzmununu işlədin. Bu fayl `READ ONLY` transaction-dır; cədvəl yaratmır və müştəri məlumatı çıxarmır.
2. Gözlənilir: doğru database/user, `postgres_version_num >= 140000`, bu ilk tətbiq üçün `employee_schema_version=5`, tələb olunan JSONB/security-definer RPC-lər, sütun tipləri, reservation NOT NULL/FK və Supabase rolları; `RECEIPT_PREFLIGHT_OK` marker-i; xəta **0**.
3. Funksiya SHA-larını lokal `payment-test-artifacts/receipt-readiness/postgres.json` içindəki schema-5 dependency siyahısı ilə tutuşdurun. Fərq varsa body/version fərqi ayrıca nəzərdən keçirilməlidir; yalnız versiya nömrəsinin 5 olması semantik uyğunluğu sübut etmir. Fərqli PostgreSQL formatlaşdırması da hash fərqi yarada bilər — kor-koranə overwrite etməyin.
4. Gözlənilməyən schema 6, yarımçıq receipt obyektləri, hər hansı `*_MISSING`, `*_MISMATCH`, nullability/role/FK xətası, yanlış layihə/baza və ya yalnız nəticəsiz “Success” görünsə **DAYANIN**. Bütün nəticələr və marker yoxlanmadan migration-a keçməyin. SQL Editor xəta verərsə transaction-ı `ROLLBACK;` ilə bağlayın; “ignore error” ilə davam etməyin.
5. Yalnız secret-siz preflight nəticələri və backup/bərpa checklist-i nəzərdən keçirildikdən sonra ayrıca tətbiq qərarı verilməlidir.

## `3/3` nədir və nə DEYİL?

Üç ad: `payment_orders`, `payment_reservations`, `payment_settings`. İlk tətbiqdə SHARE lock altında eyni DB-də CTAS surətləri alınır. Manifest hər surətin sətir sayını, capture vaxtını, ilkin sütun siyahısını və SHA-256 məzmun izini saxlayır. Təkrar tətbiq ilkin surətləri yeniləmir.

Bu yalnız **daxili consistency snapshot**-dır. CTAS indeksləri, FK/PK/check constraint-lərini, default/sequence/identity, trigger, RLS, grant/role konfiqurasiyasını və bütün asılı cədvəlləri tam bərpa paketi kimi saxlamır. Snapshot production ilə eyni disk/DB nasazlığını bölüşür. Test CTAS surətində constraint sayının 0 olduğunu ayrıca göstərir. `3/3`, SHA uyğunluğu və rollback-in uğuru **restore sınağı** və ya disaster-recovery backup sertifikatı deyil.

Count-only köhnə draft manifest varsa yeni SQL onu səssizcə “təsdiqləmir”; `SNAPSHOT_MANIFEST_INCOMPLETE` ilə dayanır. Belə halda mövcud surətləri silmək/yenidən yaratmaq yox, ayrıca araşdırma və xarici backup tələb olunur.

### Production tətbiqindən ƏVVƏL məcburi xarici backup checklist-i

Hazırda aşağıdakıların hamısı **NOT VERIFIED / operator tələb olunur**:

- Backup ID və dəqiq T0/UTC vaxtı, düzgün production project-ref, PostgreSQL major versiyası, schema 5, uğurlu backup job; ayrıca qorunan saxlanma yeri və bütövlük hash-i/provider restore-point sübutu.
- Tam DB/schema/dependencies: məlumatlar, funksiyalar, trigger-lər, constraint/index/sequence-lər, RLS/ACL/rollar və işləyən tətbiq versiyasının ayrıca nüsxəsi. Mövcud encryption/token açarları secret manager-də qorunsun; çap/rotasiya edilməsin.
- Private Storage obyektləri üçün ayrıca qorunan backup və obyekt/hash inventarı. Supabase DB backup-u yalnız Storage metadata-sını əhatə edir, faylları yox: [rəsmi backup sənədi](https://supabase.com/docs/guides/platform/backups).
- Backup-u production üzərinə DEYİL, təsdiqlənmiş eyni-region məxfi, şəbəkəsi məhdud ayrıca restore layihəsi/bazasına bərpa etmək. Production məlumatını bu agentin lokal mühitinə köçürmək olmaz. Bərpa edilmiş bazaya normal app/mailer/cron qoşulmasın; heç bir WhatsApp/email/ödəniş əməliyyatı işləməsin.
- Restore nəticəsi: cədvəl sayları və məzmun izləri, PK/FK/check/index/sequence, RPC-lər, trigger/RLS/grant-lar, schema 5, private obyekt metadata/hash uyğunluğu və operatorun imzalı nəticəsi. Bərpa sınağının çıxışı olmadan “backup yoxlanıb” yazılmamalıdır.
- RTO/RPO və T0-dan sonrakı real dəyişikliklərin qorunma planı. Production-u köhnə T0-a qaytarmaq yeni sifarişləri itirə bilər; belə bərpa adi rollback DEYİL və ayrıca icazə/reconciliation tələb edir.

Platformanın restore-to-new-project imkanı mövcuddursa onun təsdiqlənmiş prosedurundan istifadə edin. Alternativ logical backup üçün `pg_dump`/`pg_restore` müvafiq versiya və Supabase-in managed-schema qaydaları ilə operator tərəfindən işlədilməlidir: [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html). Bu sessiyada həmin client binary-ləri yoxdur və xarici backup restore olunmayıb. SQL Editor CTAS əməliyyatı bu addımı əvəz etmir.

Mövcud backup-lar Supabase Dashboard → **Database → Backups** bölməsində operator tərəfindən yoxlanmalıdır. Lazımi backup/restore imkanı cari tarifdə yoxdursa alternativ təsdiqlənmiş prosedur və lazım gələrsə ayrıca xərc icazəsi tələb olunur; agent yeni layihə və ya pullu xidmət yaratmayıb.

## Tətbiq və versiya uyğunluğu

| Kombinasiya | Lokal faktiki nəticə | Əməliyyat qərarı |
|---|---|---|
| Köhnə API (`dbc4634`) + genişləndirilmiş schema 6 legacy RPC | Köhnə staged token/legacy submit işləyir; köhnə explicit admin approve legacy sifariş üçün mümkündür | Schema dəyişikliyi təkbaşına OCR tətbiq etmir. Cutover-da köhnə backend trafiki saxlanmamalıdır |
| Yeni API + schema 5, validation tələb olunur | Upload və direct submit `503`; storage/order yazısı 0 | Təhlükəsiz bağlı, istifadəçilərə ödəniş toplamaq üçün açılmamalıdır |
| Yeni API + schema 6, worker əlçatmaz | `503`, upload/order yazısı 0 | Flag-ı söndürüb yoxlamasız qəbul etmək YOX; trafik bağlı qalsın, servis düzəldilsin |
| Təhlükəsiz decode var, yalnız OCR modeli yoxdur | `manual_review`; order yalnız `reviewing`, `approved/completed` 0 | Texniki/manual qəbul bank mədaxili deyil |
| Köhnə staged token → yeni məcburi gate | `400 RECEIPT_INSPECTION_REQUIRED` | Köhnə token bypass etmir; cutover-dan əvvəl session-ları normal qaydada drain etmək lazımdır |

HTTP uyğunluq sınağı izolyasiya edilmiş store fixture-i və əvvəlki API mənbəyi ilədir; SQL uyğunluğu ayrıca real PostgreSQL-də legacy RPC-lərlə yoxlanıb. Bu ikisi production end-to-end sessiya testi kimi təqdim edilmir.

### Gələcək icazəli tətbiq ardıcıllığı

1. Production preflight + həqiqi xarici backup/restore sübutu + worker host izolyasiyası təsdiqi. Bu üç gate yoxdursa **HOLD**.
2. Operatorun təsdiqlədiyi maintenance/write gate ilə checkout girişi və staff mutation-ları dayandırılsın; artıq başlamış session-lar normal axınla drain olunsun. Real sifarişlər sırf test/rollback üçün tamamlanmasın və ya ləğv edilməsin. Queue/active session sayı yalnız read-only izlənilsin.
3. Backup T0 təsdiqindən sonra Supabase-in eyni production `postgres` SQL Editor-unda **yalnız yeni `202610250001_receipt_validation.sql`** tətbiq edilsin. Köhnə employee/inventory migration-ları təkrarlanmasın. Hər hansı xəta/lock timeout/backup mismatch olduqda dayanın, rollback edin və səbəbi araşdırın.
4. Dərhal `receipt-validation-verify.sql` işlədilsin. Gözlənilir: schema **6**, receipt version **1**, düzgün üç manifest adı, non-null sütun siyahısı/64-hex content SHA, bütün permission/RLS/unique/trigger yoxlamaları, `RECEIPT_VERIFY_OK`. Maintenance altında ilkin tətbiqdən sonra `current_original_columns_match_snapshot` üçü də **true** olmalıdır. False olduqda marker də `RECEIPT_SOURCE_CHANGED_REVIEW_REQUIRED` olur: backend deploy YOX. Xəta, source-warning və ya başqa markerin heç biri keçid icazəsi deyil.
5. Private worker əvvəl ayrıca staging-də yoxlanılsın və sonra tələb olunan host məhdudiyyətləri ilə yayımlansın; API hələ köhnədirsə public checkout bağlı qalsın. Backend yeni commitlə `RECEIPT_VALIDATION_ENABLED=true`, düzgün private URL/token və schema 6 ilə deploy edilsin. Mövcud payment açarları dəyişməsin. Flag false yoxlamanı legacy rejimə qaytarır — təhlükəsiz rollback vasitəsi deyil.
6. Bütün backend instansiyalarının yeni versiyaya keçdiyi, worker readiness və schema uyğunluğu təsdiqləndikdən sonra frontend eyni commit/asset versiyası ilə deploy edilsin. Qarışıq köhnə/yeni instansiya ilə public trafik açılmasın.
7. Canlı read-only yoxlama: mövcud health, worker health/model readiness, login route-ları, sessiyasız 401, mövcud səlahiyyətli sessiya varsa rol qoruması, receipt DOM/cache asset versiyaları. Heç bir checkout submit, reserve/upload POST, stok, bonus, işçi hesabı və WhatsApp mesajı yaradılmasın. Authenticated sessiya yoxdursa həmin yoxlamalar “yoxlanmayıb” qalsın.
8. Yalnız operatorun son təsdiqindən sonra maintenance qaldırılsın. İlk real əməliyyatları normal admin bank-mədaxil yoxlaması idarə etsin; test əməliyyatı yaradılmasın.

`current_original_columns_match_snapshot` sonrakı normal biznes yazılarından sonra false ola bilər; bu snapshot-u yenidən yaratmaq göstərişi deyil. İlk cutover verification-u ilə sonrakı audit yoxlamasını qarışdırmayın.

## Məlumat silməyən geri dönüş

- Əvvəl trafik/write gate saxlanır. Backup cədvəllərini production üzərinə kor-koranə `TRUNCATE/INSERT` və ya restore etməyin.
- Yeni validation-a bağlı qeyri-final sifariş və aktiv staged qəbz varsa SQL rollback qəsdən `ROLLBACK_BLOCKED_OPEN_RECEIPTS` verir. Real işin düzgün admin axını ilə bitməsi/expiry gözlənilir və ya roll-forward düzəlişi seçilir; guard bypass edilmir.
- Gate-lər boş olduqda owner SQL Editor-da yalnız `supabase/rollback/202610250001_receipt_validation.sql` işlədilir. Readiness **5**, yeni register/submit RPC service execute bağlı, receipt cədvəlləri/hesabatlar/sifarişlər/approval guard yerində qalır. İkinci tətbiq də eyni vəziyyəti saxlayır.
- Yeni app validation tələb etməyə davam edərsə schema 5-də `503` verəcək. Bunu “sayt normal açıqdır” kimi təqdim etməyin. Köhnə app public trafikə qaytarılarsa OCR nəzarəti yoxdur; ayrıca təhlükəsizlik qərarı olmadan checkout açılmır.
- Roll-forward: xarici backup və hazır dependency-lər qorunmaqla həmin yeni migration təkrar tətbiq edilir; snapshot-lar dəyişmir. İçəridə count-only/yarımçıq draft varsa dayanılır. Tam DB restore yalnız disaster-recovery prosedurudur, bu məlumat-silməyən rollback deyil.

## Docker və worker sübut matrisi

| Tələb | Lokal faktiki vəziyyət | Production hostunda tələb olunan sübut |
|---|---|---|
| Ayrı child process, real OCR və PDF/şəkil decode | Faktiki Node/HTTP testləri keçib | Eyni image-də sintetik staging yoxlaması |
| Token yoxlaması, 401, busy 503, 5 MB/type/unsafe rədd | Faktiki worker testləri keçib | Private ingress + health/auth yoxlaması |
| HTTP client timeout | Faktiki HTTP ilə 45 s deadline testdə 30 ms-ə ölçəklənib | Normal deadline və xidmət nasazlığı staging sınağı |
| 40 s child SIGKILL və disconnect kill | Kod/konfiqurasiya oxunub; məcburi 40 s kill yolu ayrıca sürülməyib | Uzun iş/abort staging sınağı, orphan PID olmaması |
| V8 256 MB | Spawn arqumenti yoxlanıb; RSS cap deyil | Native/WASM/RSS yük sınağı |
| non-root, read-only rootfs, cap-drop ALL, no-new-privileges | Dockerfile/Compose oxunub; Docker binary yoxdur, faktiki tətbiq yoxlanmayıb | UID≠0, rootfs write rəddi, CapEff=0, NoNewPrivs=1 |
| 768 MB cgroup, 1 CPU, PID 64, tmpfs 64 MB | Compose konfiqurasiyası var; runtime yoxlanmayıb | Faktiki cgroup/tmpfs limitləri və limit testi |
| Internal network/egress deny | Compose-da internal network var; backend bu compose-a daxil deyil | Backend-in məhdud private bağlantısı, public ingress/outbound blok testi; token təkbaşına izolyasiya deyil |
| Modellər / Linux image | Lokal aze+eng OCR keçib, Docker/Linux build yoxlanmayıb | Pinned model manifest, real decode/OCR, health/modelsReady və image digest |

Runtime yoxlanılmamış sətirlər **PASS DEYİL** və deploy gate-dir. `http://receipt-ocr:8891` yalnız backend həmin internal network-də olduqda işləyir. Başqa host/platforma eyni təhlükəsizliyi və dəstəklənən private URL-i sübut etməlidir.

## Faktiki test artefaktları və qalanlar

Bu mərhələdə tam əlaqəli **18/18 paket**, uğursuz **0**, əsas qəbz paketlərində **352** assertion yenidən keçdi. Son SQL düzəlişlərindən sonra hazırlıq suite-i ayrıca **58** yoxlama, API versiya uyğunluğu **19** yoxlama ilə yenidən keçirildi; uğursuz **0**. Tam-run JSON-də hazırlıq sayğacı həmin run anında **56** idi; son əlavə köhnə-admin guard ssenarisi ilə ayrıca son nəticə **58**-dir. Bu saylar üst-üstə düşən təkrar sınaqlardır, unikal cəm kimi toplanmır. Əsas real-PG qəbz suite-i **56** yoxlama ilə yenidən keçib. Yeni SQL üzrə final əlaqəli nəticələr faktiki log/JSON-larda saxlanır; production nəticəsi kimi təqdim edilmir.

- Tam əlaqəli runner: `node scripts/test-receipt-release.mjs` → `payment-test-artifacts/receipt-validation/release/results.json` və paket logları.
- Readiness real PG: `payment-test-artifacts/receipt-readiness/postgres.json` (orijinal səhvlərin reproduksiyası, iki təzə DB ssenarisi, ilk/təkrar migration/rollback/roll-forward, legacy məlumat qorunması, content-tamper testi).
- API uyğunluğu: `payment-test-artifacts/receipt-readiness/compatibility.json`.
- Production SQL introspeksiyası, həqiqi external backup restore-u, Storage backup və Docker host məhdudiyyətləri **bloklanmış/yoxlanmamışdır**. Lokal client paketində `pg_dump/pg_restore` yoxdur; heç bir restore nəticəsi uydurulmur.
- Production yazısı, real sifariş/rezerv/qəbz/stok/bonus/WhatsApp mesajı **0**. Push/deploy edilməyib. Qalan ilk manual addım yalnız yuxarıdakı Supabase read-only preflight və backup checklist-dir, migration deyil.
