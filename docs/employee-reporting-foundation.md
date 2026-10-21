# İşçi hesabatı: sıfırdan başlama qaydası

Bu foundation artıq ayrıca İşçi Paneli, owner nəzarəti, checkout metadata və stok/bonus axını ilə birləşdirilib.
Tam buraxılış sənədi: `docs/employee-panel-release.md`.
Production SQL hələ tətbiq edilməyib; lokal nəticə canlı tamamlanma kimi təqdim edilmir.

- `employee_started_at` yalnız server vaxtı ilə, adminin start əməliyyatında yaradılır.
- Start yoxdursa şəxsi statistika və bonus 0-dır.
- `order.created_at >= employee_started_at`, işçi ID-si, cari reporting period və qəbul vaxtı birlikdə yoxlanılır.
- Köhnə sifariş sonradan təsdiqlənsə də işçinin hesabatına düşmür.
- Sifariş sayı unique order ID, məhsul miqdarı ayrıca real quantity cəmidir.
- Admin yekun təsdiqi olmadan satış/bonus yaranmır; bonus order ID üzrə unikaldır.
- Tarixi 10.000 və 1.200 maaş nümunəsi production-a yazılmır.
- Bitən məhsullar yalnız cari izlənən AVAILABLE stokdan hesablanır.
- Yeni hesabat dövrü iki təsdiq, audit və açıq sifariş yoxlaması tələb edir; köhnə məlumatları silmir.
- 62 PostgreSQL/unit yoxlaması qorunub. HTTP, UI və release SQL testləri ayrıca əlavə olunub.

Əmr: `node scripts/test-employee-reporting.mjs`.
SQL: `supabase/migrations/202610210001_employee_reporting.sql`.
Tam tətbiq paketi: `supabase/employee-release.sql` (backup + hər iki migration).
Məlumat silməyən geri qaytarma: `supabase/employee-release-rollback.sql`.
