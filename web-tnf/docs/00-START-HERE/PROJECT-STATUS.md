# Project Status

> Diperbarui: 17 November 2026 — **Blocker P0 ditutup** & **fondasi Phase 1 terverifikasi**.
> Aturan: status di sini hanya boleh berubah berdasarkan bukti eksekusi (test/probe/build).

## 1. Posisi phase

| Phase | Isi | Status |
|---|---|---|
| 0 | Audit & project discovery | ✅ **SELESAI** (laporan: `PHASE-0-AUDIT.md`) |
| 1 | Fondasi monorepo + API + worker + Docker | 🟡 **SEDANG JALAN — fondasi DONE** (workspace pnpm + Turborepo + `apps/api` Express hidup di :4000 dengan health/docs/error standard; app lama **tidak** dipindah). Sisa: `apps/web`, `apps/worker`, Docker per app → menunggu persetujuan Langkah A) |
| 2 | Core system: organization, tenant, event config, RBAC baru | ⬜ |
| 3 | Fighter, club, registrasi, dokumen privat, consent | ⬜ |
| 4 | Payment abstraction, QRIS, ticketing lanjutan, POS, check-in | 🟡 ticketing & check-in dasar sudah ada |
| 5 | Match, official, championship, ranking | 🟡 championship & ranking sudah ada |
| 6 | Sponsorship komersial, finance, budget | 🟡 sponsor showcase saja |
| 7 | Google Sheets, workflow, notifikasi, report | ⬜ |
| 8 | Hardening, security audit, deploy produksi baru | ⬜ |

## 2. Modul yang sudah berjalan (bukti)

| Modul | Bukti terakhir |
|---|---|
| Auth + session + MFA + CSRF | unit test auth/totp/rbac, login live |
| RBAC + four-eyes role request | halaman `/admin/roles`, `/admin/users`, unit test rbac |
| Fighter + weight class + fight history | halaman publik & admin, data produksi |
| Championship belt + reign | `/belts`, `/admin/belts` |
| Ranking versioning | `/rankings`, `/admin/rankings` |
| Tournament bracket | `/grand-prix`, `/admin/grand-prix` |
| CMS (hero, page section, media) | `/admin/hero-slides`, `/admin/settings` |
| Sponsorship showcase | 11 unit test + probe `sponsor-e2e.cjs` |
| Ticketing guest checkout | 50 request paralel → 50 seat, 0 oversell |
| PDF tiket + QR HMAC | integration test + route live |
| Check-in | 9 integration test + probe |
| Hold expiry + cron | log `storage/logs/expire-holds.log`, cron hourly |
| Website publik (SEO/bilingual) | live `https://tfn.pimpom.id` |

## 3. Hasil verifikasi terakhir (dijalankan 17 Nov 2026)

| Gate | Hasil |
|---|---|
| `tsc --noEmit` | ✅ exit 0 |
| `eslint .` | ✅ **0 error, 0 warning** |
| `vitest run --project unit` | ✅ **75 test / 15 file lulus** |
| `vitest run --project integration` | ✅ **30 test / 5 file lulus** (DB lokal 3307 sudah hidup) |
| `npm run build` | ✅ sukses (build produksi, `.next` terisi) |
| Probe produksi HTTP | ✅ 9 halaman 200; ✅ `/sitemap.xml` 200 (15 URL); ✅ `/robots.txt` 200 |
| Probe tema (Playwright, cookie `tfn_theme=light`) | ✅ class `light` pada first paint, **0 mutasi class**, 0 error console; toggle→cookie/localStorage konsisten; reload SSR langsung benar |

## 4. Blocker aktif

**Tidak ada blocker terbuka.** B1/B2/B3 ditutup 17 Nov 2026 (bukti: `11-DEVELOPMENT-LOG/CHANGELOG.md`
entri "Blocker P0").

| # | Blocker lama | Status | Bukti penutupan |
|---|---|---|---|
| B1 | DB lokal tidak bisa konek (port bentrok + volume kosong) | ✅ CLOSED | `boxing-mysql` healthy di 3307; 3 migration applied; 41 tabel; `test:integration` 30 lulus |
| B2 | Lint gagal karena `layout.tsx` (`dangerouslySetInnerHTML`) | ✅ CLOSED | tema dipindah ke cookie/SSR; `public/theme-init.js` dihapus; `eslint .` 0 error |
| B3 | Belum ada keputusan strategi migrasi (ADR-001) | ✅ CLOSED | ADR-001 **ACCEPTED** 17 Nov 2026 (disetujui Irhan) |

## 5. Yang TIDAK boleh diklaim selesai

Registrasi fighter, data sensitif (NIK/KTP/BPJS), payment gateway, POS, finance, workflow,
Google Sheets, reporting/export, notifikasi, multi-tenant. Semuanya **belum ada** di kode.
