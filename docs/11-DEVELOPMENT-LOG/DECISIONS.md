# Architecture Decision Records

Format ringkas: konteks → keputusan → konsekuensi. Status: `PROPOSED` / `ACCEPTED` / `SUPERSEDED`.

## ADR-001 — Strategi migrasi: strangler + monorepo bertahap
**Status:** **ACCEPTED** — disetujui Irhan, 17 November 2026 (sebelumnya PROPOSED).
**Konteks:** ada app Next.js fullstack 13,5k LOC yang hidup di produksi dengan invariant ticketing
yang sudah terverifikasi. Spec menuntut monorepo + Express API + app POS/worker terpisah. Data bisnis
nyata belum ada (produksi masih data demo).
**Keputusan:** Opsi B — buat monorepo sekarang, pindahkan modul ke `apps/api` bertahap, bangun modul
baru langsung di API, app lama tetap hidup sampai parity.

**Ruang lingkup yang disetujui untuk Phase 1 (bertahap, TIDAK memindahkan app lama):**
1. Struktur monorepo: `pnpm-workspace.yaml`, `turbo.json`, `apps/api`.
2. Skeleton Express + TypeScript di `apps/api` (health, error handling, logging, env tervalidasi).
3. Prisma + koneksi MySQL dari `apps/api` (lihat ADR-009: schema tetap satu sumber di root).
4. Standar environment/logging/error/OpenAPI di `apps/api`.
5. `apps/web` **belum** dibuat dan modul Next.js **belum** dipindah.

**Konsekuensi:**
- Sementara ada dua backend (Next route handler + Express). Aturan disiplin: modul baru
  **tidak boleh** ditambahkan ke Next.js — hanya ke `apps/api`.
- Root tetap berisi app Next.js selama Phase 1; `apps/web` baru dibuat setelah ada
  **migration plan** yang disetujui (butuh daftar route, dependensi, dan urutan pemindahan).
- Risiko: dua proses build (Next + tsx/tsc API) → dimitigasi lewat orchestrasi Turborepo dengan
  cache dan `dependsOn`, plus gate CI tunggal (`pnpm run verify`).
- Alternatif ditolak: big-bang rewrite (risiko regresi tinggi), lanjut fullstack (menyalahi spec,
  utang teknis).

## ADR-002 — Pola autentikasi lintas app
**Status:** PROPOSED
**Konteks:** hari ini cookie sesi pada satu host; target 4 subdomain.
**Keputusan sementara:** cookie sesi ber-`Domain=.tfn.pimpom.id` untuk admin & POS; website RSC memakai
service token internal; access+refresh token hanya bila ada klien eksternal/mobile.
**Konsekuensi:** CSRF harus matang (origin + token); hindari menyimpan token di `localStorage`.

## ADR-003 — ID: ULID untuk tabel baru
**Status:** PROPOSED
**Konteks:** schema lama memakai `cuid()`. Preferensi pemilik produk: ULID (26 char, time-sortable).
**Keputusan:** tabel baru memakai ULID `CHAR(26)`; tabel lama **tidak** dikonversi (biaya > manfaat,
risiko regresi). `cuid` lama tetap valid karena hanya identifier internal.
**Konsekuensi:** dua format ID hidup berdampingan — dokumentasikan di table dictionary agar tidak
membingungkan.

## ADR-004 — Spreadsheet satu arah
**Status:** PROPOSED
**Keputusan:** MySQL → Sheets saja pada fase awal. Tidak ada impor balik dari Sheets.
**Konsekuensi:** perubahan manual di Sheets akan tertimpa pada sync berikutnya — beri peringatan di
UI dan dokumentasi.

## ADR-005 — Ticketing lama tidak ditulis ulang
**Status:** ACCEPTED (praktik)
**Konteks:** reservasi atomik, cap pembeli, PDF+QR, check-in, expiry sweep sudah terbukti.
**Keputusan:** pindahkan apa adanya ke `apps/api`, refactor hanya bila ada alasan terukur.
**Konsekuensi:** gaya kode lama (service besar) ikut terbawa; boleh dipecah setelah ada test penjaga.

## ADR-006 — Pemetaan status event
**Status:** PROPOSED
**Konteks:** spec butuh 8 status (Draft → Published → Registration Open → Registration Closed →
Preparation → Ongoing → Completed, + Cancelled); schema sekarang: `DRAFT, SCHEDULED, LIVE, COMPLETED,
POSTPONED, CANCELLED`.
**Keputusan:** tambah status baru + transition guard di service (bukan hanya enum), dengan mapping:

| Spec | Enum sekarang | Aksi |
|---|---|---|
| Draft | `DRAFT` | tetap |
| Published | `SCHEDULED`? | **perlu diskusi** — usul: tambah `PUBLISHED` |
| Registration Open/Closed | — | tambah |
| Preparation | — | tambah |
| Ongoing | `LIVE` | rename atau alias |
| Completed | `COMPLETED` | tetap |
| Cancelled | `CANCELLED` | tetap |
| — | `POSTPONED` | tetap (tidak ada di spec, tapi berguna) |

**Konsekuensi:** migration enum + update semua filter UI; jangan mengubah nilai lama tanpa backfill.

## ADR-007 — POS hanya tiket
**Status:** ACCEPTED
**Keputusan:** tidak ada katalog/stok F&B. Bila VVIP butuh konsumen, itu di luar POS (mis. vendor
terpisah, bukan transaksi POS).
**Konsekuensi:** permintaan "tambah kopi di POS" harus ditolak dan diarahkan ke keputusan bisnis baru.

## ADR-008 — Tema (dark/light) dirender di server dari cookie, tanpa inline script
**Status:** ACCEPTED (17 Nov 2026)
**Konteks:** tema sebelumnya dipasang oleh inline `<script>` yang diblokir aturan ESLint
`no-restricted-syntax` (`dangerouslySetInnerHTML`). Percobaan memakai `next/script`
`strategy="beforeInteractive"` (di `<body>` maupun `<head>`) **diukur gagal**: Next hanya mengeluarkan
`<link rel="preload">` + push `self.__next_s`, sehingga class tema baru terpasang **setelah**
first paint (`first-paint 180 ms` vs `class light 366 ms`) → tetap terjadi *flash of wrong theme*.
**Keputusan:** `src/app/layout.tsx` membaca cookie `tfn_theme` lewat `cookies()` dan merender
`<html class="dark|light scroll-smooth">` pada HTML pertama. `ThemeContext` menyimpan preferensi di
`localStorage` (sumber kebenaran di klien) dan menulis cookie yang sama; fallback urutan baca:
`localStorage → cookie → dark`. `public/theme-init.js` dihapus.
**Konsekuensi:**
- Tidak ada inline JS → CSP tetap ketat (nonce untuk script inline tidak lagi diperlukan untuk tema).
- Halaman root menjadi **dynamic** (memakai `cookies()`); jangan menambahkan `export const dynamic =
  "force-static"` pada layout root.
- Pengunjung lama yang hanya punya `localStorage` tetap dilayani: efek rekonsiliasi pasca-hydration
  menyelaraskan DOM + menulis cookie, jadi kunjungan berikutnya sudah SSR-benar.
- `localStorage` dihapus manual oleh user → tema kembali ke nilai cookie terakhir, bukan default.

## ADR-009 — Satu schema Prisma dipakai bersama root app dan `apps/api`
**Status:** ACCEPTED (17 Nov 2026)
**Konteks:** root app punya `prisma/schema.prisma` (40 model, 3 migration, ID `cuid`). `apps/api`
butuh client Prisma yang sama tanpa menduplikasi 40 model (risiko drift & dua riwayat migration).
**Keputusan:** schema tetap **satu sumber** di `prisma/schema.prisma` (root). `apps/api` tidak punya
`schema.prisma` sendiri; script `db:generate`/`db:deploy` di `apps/api` menunjuk ke `../../prisma`.
Saat modul dipindah, model ikut pindah hanya bila modul pemiliknya pindah; `packages/db` baru
dipertimbangkan setelah `apps/web` ada.
**Konsekuensi:**
- Migration **hanya** dijalankan dari root (satu riwayat, satu `_prisma_migrations`).
- `apps/api` harus tetap kompatibel dengan enum/kolom skema root yang dipakai Next.
- Bila kelak schema dipecah, butuh ADR baru + migration plan (jangan diam-diam).

## ADR-010 — Envelope error API: `{ error: { code, message, details, requestId } }`
**Status:** ACCEPTED (17 Nov 2026)
**Konteks:** `docs/04-API/API-STANDARDS.md` menjanjikan `{"success": true, "data": …}` sejak awal,
tetapi **tidak pernah diimplementasikan**: route handler Next.js yang ada mengembalikan
`{"error": "string"}` (string tanpa kode mesin, tanpa id korelasi). `apps/api` sudah berjalan
dengan bentuk lain yang lebih lengkap. Tiga bentuk berbeda untuk masalah yang sama = klien tidak
bisa menulis satu penangan error.
**Keputusan:** bentuk **kanonik** adalah yang sudah berjalan di `apps/api`:
`{"error": {"code", "message", "details"?, "requestId"}}`. Sukses = JSON domain langsung (tanpa
pembungkus `success/data`). Envelope `success/data` **ditolak** dan dihapus dari standar.
**Alasan memilih bentuk ini, bukan `success/data`:**
- `code` stabil → klien bisa bercabang tanpa mencocokkan teks.
- `requestId` selalu ada → satu id yang sama muncul di log server (korelasi insiden).
- Tanpa pembungkus → respons health/meta tetap apa adanya; DTO tidak perlu dibungkus ulang di
  setiap modul.
**Konsekuensi:**
- Route Next.js lama (`{"error": "string"}`) **tidak** diubah sekarang (aturan: jangan sentuh
  implementasi existing tanpa persetujuan); diseragamkan saat modulnya pindah ke `apps/api`
  (Langkah B/C di `MIGRATION-PLAN-WEB.md`).
- Semua modul **baru** wajib memakai bentuk ini; `AppError` cs. di `apps/api/src/lib/errors.ts`
  adalah satu-satunya jalan membuat error.
- 5xx tidak membocorkan `message` internal; detail hanya di log.
## ADR-011 — Prisma Client dibagikan lewat package `@tfn/db`, bukan duplikasi per app

**Status:** ACCEPTED (17 Nov 2026)
**Konteks:** Prisma Client 7 digenerate sebagai **TypeScript** ke `src/generated/prisma` (gitignored),
dan dipakai bersama oleh aplikasi Next (root) serta `apps/api`. Ketika aplikasi harus pindah ke
`apps/web`, lokasi itu jatuh di dalam `src/` yang ikut berpindah — sehingga salah satu konsumen
kehilangan client. Menyalin hasil generate per app berarti dua sumber tipe yang cepat/hilang sinkron.
**Keputusan:** satu schema di root (`prisma/schema.prisma`), output generate ke
`packages/db/src/generated/prisma`, dan package `@tfn/db` menjadi satu-satunya pintu impor
(`@tfn/db/client`, `@tfn/db/enums`). Konsumen memasangnya sebagai `workspace:*`.
**Alasan:**
- Satu schema, satu hasil generate, satu tempat `prisma generate` (postinstall root).
- Subpath export menjaga impor tetap granular (enums tanpa menarik client penuh).
- `apps/api` tetap bisa di-bundle esbuild dengan `--alias` ke source TS package ini.
**Konsekuensi:**
- Next butuh `transpilePackages: ["@tfn/db"]` (package mengirim TS, bukan JS hasil build).
- `packages/db/src/generated` wajib gitignored; build/deploy harus menjalankan `prisma generate`
  sebelum typecheck app mana pun.

## ADR-012 — Langkah A: aplikasi Next menjadi `apps/web`, root menjadi orchestrator

**Status:** ACCEPTED & DIJALANKAN (17 Nov 2026)
**Konteks:** ADR-001 menetapkan strangler monorepo, tetapi selama Phase 1 aplikasi Next masih di root
sehingga `apps/api` harus mengimpor source lewat jalur relatif naik-turun direktori.
**Keputusan:**`apps/web` berisi seluruh kode & konfigurasi Next (`app`, `components`, `lib`, `server`,
`public`, `tests`, `scripts/verify`). Root hanya berisi: workspace config (pnpm/turbo), Prisma
(schema/migrasi/seed), `scripts/` ops, `docker/`, `docs/`.
**Konsekuensi:**
- Root `typecheck` hanya mencakup `scripts/` + `prisma/`; `tsconfig.json` root memetakan `@/*` →
  `apps/web/src/*` agar skrip ops tetap bisa memakai alias yang sama.
- `next.config.ts` memuat `.env` root secara eksplisit dan menetapkan `turbopack.root` = root repo.
- `package-lock.json` dihapus; npm tidak lagi dipakai.

