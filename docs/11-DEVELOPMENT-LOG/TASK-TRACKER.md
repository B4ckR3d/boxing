# Task Tracker

> ⚠️ **Catatan historis.** Baris bertanda `turbo:verify` / path `apps/*` ditulis sebelum
> restruktur 18 Nov 2026 dan tidak lagi mencerminkan kondisi repo. Lihat
> `../02-ARCHITECTURE/PATH-MIGRATION-2026-11.md`.

> Status hanya boleh berubah berdasarkan bukti. `DONE` = acceptance criteria terpenuhi + gate lulus.
> Terakhir diperbarui: 17 Nov 2026 — Phase 1 **fondasi selesai & terverifikasi**; menunggu
> keputusan Irhan untuk Langkah A (`web-tnf`).

| ID | Title | Priority | Status | Bukti / Catatan |
|---|---|---|---|---|
| TFN-001 | Project initialization & fondasi Next.js | P0 | **DONE** | App berjalan, `next build` pernah lulus, live produksi |
| TFN-002 | Monorepo (pnpm + turbo): `web-tnf` + `web-tnf/api` + `packages/db` | P0 | **DONE** (17 Nov 2026) | Langkah A dijalankan: Next pindah ke `web-tnf` (`@tfn/web`), Prisma Client jadi `@tfn/db`, root = orchestrator. `pnpm turbo:verify` **9/9 task** sukses; web 105 test (75 unit + 30 integration) + `next build` + probe 26 halaman (200/307 sesuai); api 19 test + `verify:dist` (bundle esbuild, `/health/ready` DB up). Bukti: CHANGELOG 2026-11-17, ADR-011/012 |
| TFN-003 | Database architecture & ERD | P0 | **REVIEW** | Schema 40 model terdokumentasi di `03-DATABASE/`; target tenant masih rencana |
| TFN-004 | Authentication (session, MFA, lockout) | P0 | **DONE** | 75 unit test (termasuk auth/totp), login live |
| TFN-005 | RBAC & permission management | P0 | **TESTING** | 24 permission + 8 role berjalan; role target (Cashier, Finance, Referee, …) belum ada |
| TFN-006 | Organization & multi-tenant | P0 | **BLOCKED** | Bergantung TFN-002 + keputusan ADR-003; belum ada model `Organization` |
| TFN-007 | Event management (config lengkap + status transition) | P0 | **IN PROGRESS** | `Event` dasar ada; periode registrasi, kuota, kategori, ruleset, budget belum |
| TFN-008 | Fighter database (global, lintas event) | P0 | **TESTING** | CRUD + direktori publik ada; club/coach, NIK/KTP/BPJS, consent belum |
| TFN-009 | Fighter registration (form + consent + dokumen) | P0 | **BACKLOG** | Tidak ada modul registrasi sama sekali |
| TFN-010 | Payment abstraction + QRIS + webhook | P0 | **BACKLOG** | Masih transfer manual + verifikasi admin |
| TFN-011 | Ticketing (online, QR, check-in, expiry) | P1 | **DONE** | 50 paralel 0 oversell (**Gate A2 tervalidasi 17 Nov 2026**: 50/50, 60→50, kontrol negatif 3/17); PDF+QR; 9 test check-in; cron expiry |
| TFN-012 | POS (kasir, shift, rekonsiliasi) | P1 | **BACKLOG** | Belum ada app/route |
| TFN-013 | Match management (matchmaking + konflik jadwal) | P1 | **IN PROGRESS** | `Fight` + participant + result approval ada; guard konflik jadwal belum |
| TFN-014 | Championship (belt, reign, defense) | P1 | **DONE** | Model + halaman + approval 4-eyes |
| TFN-015 | Ranking (versi, publish, history) | P1 | **DONE** | `RankingVersion` + halaman + change log |
| TFN-016 | Sponsorship (paket, kontrak, invoice) | P1 | **IN PROGRESS** | Showcase logo via CMS ada; paket/kontrak/pembayaran belum |
| TFN-017 | Finance (income, expense, budget, P&L) | P1 | **BACKLOG** | Belum ada model |
| TFN-018 | Google Sheets automation | P2 | **BACKLOG** | Belum ada |
| TFN-019 | Reporting & export (Excel/PDF) | P2 | **BACKLOG** | Dashboard admin ada; export belum |
| TFN-020 | Deployment & production readiness | P0 | **IN PROGRESS** | Prod live single app; 3 subdomain belum ada; sitemap/robots ✅ 200; lint ✅ 0 error |

## Task tambahan hasil audit

| ID | Title | Priority | Status | Catatan |
|---|---|---|---|---|
| TFN-021 | Perbaiki environment DB lokal (port bentrok + volume kosong) | P0 | **DONE** | `boxing-mysql` healthy di 127.0.0.1:3307; 3 migration applied; 41 tabel (6 fighter, 1 event); `test:integration` **30 lulus/5 file** |
| TFN-022 | Selesaikan `src/app/layout.tsx` agar lint lulus | P0 | **DONE** | Tema via cookie/SSR (ADR-008); `theme-init.js` dihapus; `eslint .` **0 error 0 warning**; probe Playwright 0 mutasi class |
| TFN-023 | Perbaiki `/sitemap.xml` & `/robots.txt` (404 di produksi) | P1 | **DONE** | `/sitemap.xml` 200, 15 URL (9 statis + 6 fighter); `/robots.txt` 200 + `noindex` di `/tickets/status` & admin |
| TFN-024 | Desain data sensitif (NIK/KTP/BPJS): enkripsi, storage privat, retensi | P0 | **TODO** | Prasyarat TFN-009 |
| TFN-025 | Swagger/OpenAPI untuk API | P2 | **BACKLOG** | Setelah `web-tnf/api` ada |

## Aturan status

- `BLOCKED` wajib menyebut **apa** yang memblokir dan siapa yang bisa membuka.
- `DONE` tanpa bukti di kolom Bukti = status tidak sah.
- Jangan menandai `DONE` karena UI tampil; endpoint + authorization + test harus jalan.
