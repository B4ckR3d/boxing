# CURRENT-STATE

> ⚠️ **Ditulis 17 Nov 2026, sebelum restruktur 18 Nov 2026.** Path `apps/*` dan perintah
> `pnpm turbo:*` di bawah **sudah tidak berlaku** — sekarang repo hanya berisi `web-tnf/` dan
> `ticket-tnf/`. Terjemahan path: `../02-ARCHITECTURE/PATH-MIGRATION-2026-11.md`.

> Diperbarui: **17 November 2026** — Phase 0 selesai + **fondasi Phase 1 terverifikasi**.
> Sumber: eksekusi nyata (bukan rencana).
> Setiap sesi berikutnya **wajib** memperbarui file ini.

## 1. Status project

| Aspek | Kondisi |
|---|---|
| Phase | 0 selesai. Phase 1: **fondasi selesai** (workspace + turbo + `web-tnf/api`); Langkah A (`web-tnf`) **belum** disetujui |
| Kode | Phase 0: tidak ada perubahan. Phase 1: **hanya penambahan** (`web-tnf/api`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, 2 file docs); file app lama tidak dipindah/dihapus |
| Repo | `main`, commit `119b39f`; working tree **kotor**: `src/app/layout.tsx` |
| Produksi | `https://tfn.pimpom.id` hidup, Next.js :3000, data = demo seed |
| Arsitektur | **Monorepo parsial**: app Next.js masih di root (semua route bisnis di `src/app/api/*`), `web-tnf/api` Express hidup di :4000 tapi **masih skeleton** (health/meta/docs saja) |

## 2. Modul selesai (terverifikasi)

Auth (session, MFA, lockout) · RBAC + four-eyes · Audit log · Fighter (+ weight class, fight history) ·
Championship belt · Ranking versioning · Tournament bracket · CMS (hero/page/media) ·
Ticketing (guest checkout, PDF+QR, check-in, hold expiry, cap pembeli) · Website publik.
Sponsorship **baru showcase logo** (bukan modul komersial).

## 3. Modul sedang dikerjakan

Tidak ada yang setengah jadi secara kode. Yang "in progress" statusnya karena scope belum lengkap:
- **Event management** — model `Event` masih minimal (belum periode registrasi, kuota, ruleset, budget).
- **Match management** — belum ada guard konflik jadwal fighter.
- **Sponsorship** — belum ada paket/kontrak/invoice.
- **Deployment** — 3 subdomain target belum ada.

## 4. Modul belum dikerjakan

Organization/tenant · Club/Coach · Registrasi fighter · Dokumen & NIK/KTP/BPJS · Payment gateway ·
POS · Officials · Finance · Workflow · Google Sheets · Reporting/Export · Notifikasi · Swagger ·
Monorepo/Express API/Worker/Redis · Docker app.

## 5. File penting yang berubah

| File | Status |
|---|---|
| `docs/**` (baru, 40 file) | ditambahkan pada audit ini |
| `src/app/layout.tsx` | **dimodifikasi sebelumnya, belum di-commit, menggagalkan lint** |
| `scripts/audit/*` | dibuat lalu dihapus (tidak ada jejak) |

## 6. Database

- 3 migration existing: `init_championship_schema`, `ticketing_mvp`, `ticket_checkin`.
- **Tidak ada migration baru** pada audit ini.
- DB lokal **tidak tersedia** (port bentrok + volume kosong) → integration test tidak bisa dijalankan.

## 7. Hasil test (17 Nov 2026)

| Test | Hasil |
|---|---|
| `tsc --noEmit` | ✅ 0 error |
| `eslint .` | ❌ 1 error (`layout.tsx:69`), 1 warning (`official-crest.cjs`) |
| `vitest --project unit` | ✅ 75 lulus / 15 file (1,14 s) |
| `vitest --project integration` | ⚠️ tidak dijalankan (DB tidak ada) |
| `npm run build` | ⚠️ tidak dijalankan ulang |
| Probe produksi | ✅ 9 halaman 200 · ❌ sitemap/robots 404 |

## 8. Known issues aktif

K-02 (DB lokal), K-03 (lint), K-01 (sitemap/robots), K-07 (data demo di produksi), K-10
(integration test belum terverifikasi), K-12 (belum ada tenant). Lihat `../11-DEVELOPMENT-LOG/KNOWN-ISSUES.md`.

## 9. Keputusan menunggu persetujuan

- **ADR-001** strategi migrasi (strangler) — blocker Phase 1.
- **ADR-003** ULID untuk tabel baru.
- **ADR-006** pemetaan status event.
- 8 item **NEEDS CLARIFICATION** bisnis (`01-PRODUCT/BUSINESS-RULES.md` §6).

## Status terbaru (17 Nov 2026, terverifikasi) — Langkah A selesai

- Struktur: `web-tnf` (Next 16, `@tfn/web`) + `web-tnf/api` (Express 5, `@tfn/api`) + `packages/db` (`@tfn/db`).
  Root = orchestrator (pnpm + turbo + Prisma schema/migrasi + `scripts/` ops + `docker/` + `docs/`).
- Satu `.env` di root repo; dimuat eksplisit oleh `web-tnf/next.config.ts` dan `web-tnf/tests/setup.ts`;
  `web-tnf/api` mencarinya lewat `process.cwd()` + induk.
- `next build`/`next start` dijalankan dari `web-tnf`; `turbopack.root` & `outputFileTracingRoot` = root repo.
- Gate tunggal: `pnpm turbo:verify` → 9 task (root typecheck; web typecheck+lint+test; api
  typecheck+lint+test+verify:dist; db typecheck). Terakhir: **9/9 sukses**.
- Aplikasi web: 105 test lulus (75 unit + 30 integration), 26 `page.tsx`, probe produksi 200/307 sesuai.
