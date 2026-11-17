# NEXT-TASKS

> Prioritas berurutan. Jangan lompat ke Phase 2 sebelum Phase 1 lulus gate.

## P0 — Phase 1: fondasi monorepo — ✅ FONDASI SELESAI 2026-11-17

Bukti: `pnpm turbo:verify` → 7/7 task (root typecheck+lint+unit, api typecheck+lint+test+verify:dist) dalam
9,6 s; `apps/api` 19 test lulus; `/health/ready` → `{"database":"up"}` (container :3307);
regresi app lama: 75 unit + 30 integration + `next build` lulus. Detail: CHANGELOG entri
"Phase 1: fondasi monorepo".

**Yang sudah ada:** `pnpm-workspace.yaml` (`.` + `apps/*` + `allowBuilds`), `turbo.json`,
`.npmrc` (`node-linker=hoisted`), root `packageManager: pnpm@12.10.1`, `apps/api` (health,
meta, OpenAPI 3.1 + Swagger UI, error standard `{error:{code,message,requestId}}`, pino log,
graceful shutdown).

**BLOKIR BERIKUTNYA — butuh keputusan Irhan** (detail: `02-ARCHITECTURE/MIGRATION-PLAN-WEB.md`):
1. ~~**NT-4** Setujui **Langkah A**: pindahkan app Next.js ke `apps/web` (tanpa mengubah logika)?~~
   ✅ **SELESAI 17 Nov 2026** — dijalankan (ADR-012); blocker `src/generated/prisma` diselesaikan lewat `@tfn/db` (ADR-011).
2. ~~**NT-5** Nama paket web: `@tfn/web`?~~ ✅ **SELESAI** — `apps/web/package.json` = `@tfn/web`.
3. **NT-6** Pola akses FE→API: Next sebagai BFF (proxy) atau browser memanggil API langsung
   (butuh CORS + cookie lintas subdomain, ADR-002)?
4. **NT-7** Worker: `apps/worker` terpisah (usulan) atau cron di dalam API?

**NT-8 — ✅ SELESAI 17 Nov (ADR-010).** Envelope kanonik adalah yang sudah berjalan di
`apps/api`: `{"error":{code,message,details?,requestId}}`, sukses = JSON domain langsung.
Envelope `{"success":true,"data":…}` di `04-API/API-STANDARDS.md` ternyata **tidak pernah
diimplementasikan** dan sekarang ditandai DITOLAK. Route Next lama (`{"error":"string"}`) tidak
disentuh; diseragamkan saat modulnya pindah (Langkah B/C).

Selama 4 pertanyaan di atas belum dijawab: **jangan** memindahkan file app lama, **jangan**
membuat `apps/web`/`apps/worker`, dan modul baru tetap ditahan.

## P0 — Buka blocker — ✅ SELESAI 2026-11-17 (lihat `11-DEVELOPMENT-LOG/CHANGELOG.md`)

> Ketiga blocker sudah ditutup dan diverifikasi. Detail bukti ada di CHANGELOG
> (entri "Blocker P0"). Ringkasan keputusan: **NT-1** port 3307 + init SQL diperbaiki;
> **NT-2** opsi **(c)** dipilih — tema dipindah ke cookie/SSR, `public/theme-init.js` dihapus;
> **NT-3** `sitemap.ts` + `robots.ts` dibuat (sebelumnya tidak ada sama sekali).

### NT-1 · TFN-021 — Perbaiki database lokal
- **Kenapa:** integration test & dev tidak bisa jalan; semua klaim integrasi tidak terverifikasi.
- **Langkah:** set `MYSQL_PORT=3307` + `DATABASE_URL` di `.env` → `npm run db:up` → `db:wait` →
  `db:deploy` → `db:seed` → `npm run test:integration`.
- **File:** `docker-compose.yml`, `.env`, `package.json` scripts.
- **Acceptance:** `npm run test:integration` lulus; `docker ps` menampilkan container TFN di 3307;
  `SELECT COUNT(*) FROM Fighter` > 0 setelah seed.
- **Test:** integration suite + satu probe check-in.

### NT-2 · TFN-022 — Lint hijau
- **Kenapa:** gate DoD gagal; risiko deploy dari tree kotor.
- **Konteks:** aturan `no-restricted-syntax` melarang `dangerouslySetInnerHTML`. Perubahan
  `layout.tsx` memakai inline script untuk mencegah FOUC tema.
- **Opsi:** (a) kembalikan ke `/theme-init.js` + `next/script` dengan nonce; (b) pertahankan inline
  tapi tambahkan pengecualian terarah + justifikasi tertulis di ADR; (c) pindahkan logika tema ke
  server (cookie) sehingga tidak perlu inline script.
- **KEPUTUSAN: (c) dipilih.** Opsi (a) sudah diukur dan **gagal**: dengan `next/script
  strategy="beforeInteractive"` (baik di body maupun di `<head>`), Next hanya mengeluarkan
  `<link rel=preload>` + push `self.__next_s`, sehingga class tema baru terpasang **setelah**
  first paint (`first-paint 180ms` vs class light `366ms`) → FOUC tetap ada.
  Implementasi final: `layout.tsx` membaca cookie `tfn_theme` via `cookies()` dan merender
  `<html class>` yang benar sejak byte pertama; `ThemeContext` menulis cookie + localStorage.
  Tidak ada inline JS, tidak ada aturan ESLint yang dimatikan.
- **Acceptance:** `npm run lint` 0 error, tidak ada FOUC pada reload, CSP tetap ketat.
- **Test:** probe layout (`scripts/verify/*layout*`), cek console tanpa error CSP.

### NT-3 · TFN-023 — Sitemap & robots
- **Kenapa:** SEO; produksi 404.
- **Acceptance:** `/sitemap.xml` 200 dengan URL publik, `/robots.txt` 200 dan menunjuk sitemap;
  diverifikasi pada **build produksi** (`npm run start`), bukan dev.

## P0 — Butuh persetujuan dulu

### NT-4 · ADR-001 (strategi migrasi) → kemudian TFN-002 monorepo
Setelah disetujui: buat `pnpm-workspace.yaml`, `turbo.json`, `apps/api` (Express + health + Swagger),
`apps/worker` skeleton, `packages/{types,validators,utils,config}`. **Jangan pindahkan modul** pada
langkah ini — hanya fondasi + CI gate.

### NT-5 · TFN-024 — Desain data sensitif (sebelum TFN-009)
Prasyarat modul registrasi: skema enkripsi NIK/BPJS, storage privat + signed URL, permission khusus,
audit pembacaan, kebijakan retensi. Output: dokumen desain + ADR, belum implementasi.

## P1 — Setelah P0 beres

1. TFN-006 Organization/tenant (+ test isolasi deny-path).
2. TFN-007 Event configuration lengkap (status transition guard, periode, kuota, kategori, ruleset, budget).
3. TFN-009 Registrasi fighter (+ consent versioned, invoice).
4. TFN-010 Payment abstraction + QRIS + webhook idempoten.
5. TFN-012 POS (setelah API stable).
6. TFN-017 Finance (setelah payment ada sumber transaksi).

## Definition of Done pengingat

`typecheck` ✅ · `lint` ✅ · test relevan ✅ · `build` ✅ · authorization diuji ✅ ·
endpoint dipakai UI ✅ · dokumentasi + tracker diperbarui ✅.

## Yang JANGAN dikerjakan sekarang

- Menambah modul baru langsung di Next.js route handler.
- Mengubah harga/honor/status tanpa sumber dari penyelenggara.
- Menyentuh data produksi (migration/reset).
- Menulis dokumen modul yang belum ada kodenya.
