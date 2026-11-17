# Changelog

Format: tanggal · ringkas · bukti. Hanya perubahan yang benar-benar terjadi.

## 2026-11-17 — Langkah A: aplikasi Next.js pindah ke `apps/web` + Prisma Client jadi `@tfn/db`

**Blocker yang diselesaikan lebih dulu (Opsi A):** Prisma Client digenerate ke `src/generated/prisma`
(di dalam `src/`), dipakai web **dan** `apps/api`. Memindahkan `src/` akan memutus salah satu sisi.

**Yang dikerjakan:**
- `packages/db` (`@tfn/db`): satu-satunya pintu ke Prisma Client. Output generator dipindah ke
  `packages/db/src/generated/prisma` (`prisma/schema.prisma`), tetap gitignored. Subpath export
  `@tfn/db/client` dan `@tfn/db/enums` supaya impor tetap granular.
- 7 impor diarahkan ulang: `src/lib/db/prisma.ts`, `ticketing.service.ts`, `settings.service.ts`,
  `apps/api/src/db/prisma.ts`, `scripts/bootstrap-admin.ts`, `scripts/reset-password.ts`, `prisma/seed.ts`.
- `apps/web` dibuat: `src/app`, `src/components`, `src/lib`, `src/server`, `src/proxy.ts`, `src/styles`,
  `public`, `tests`, `storage`, plus `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`,
  `vitest.config.ts`, `postcss.config.mjs`, `scripts/verify/`. `apps/web/package.json` = `@tfn/web`.
- Root jadi orchestrator: script `dev/build/start/test:*` meneruskan ke `@tfn/web`, `typecheck` root
  hanya untuk `scripts/` + `prisma/`. `package-lock.json` dihapus (pnpm satu-satunya package manager).

**Tiga bug nyata yang muncul saat pemindahan (bukan teoretis):**
1. `--packages=external` membuat esbuild meng-external-kan `@tfn/db` (source TS) → `ERR_MODULE_NOT_FOUND`
   saat `node dist/index.js`. Diperbaiki dengan `--alias` untuk `@tfn/db`, `@tfn/db/client`, `@tfn/db/enums`.
2. Next hanya membaca `.env` di direktori app → semua koneksi DB jatuh ke default. Diperbaiki: `next.config.ts`
   memuat `../../.env` via dotenv, `tests/setup.ts` menunjuk path `.env` root secara eksplisit.
3. `turbopack.root` diarahkan ke `apps/web` → Turbopack menganggap `next` tidak terpasang (node_modules
   ada di root, `node-linker=hoisted`). Diperbaiki: `turbopack.root` + `outputFileTracingRoot` = root repo.

**Bukti:**
- `pnpm turbo:verify` → **9/9 task sukses** (root typecheck; web typecheck+lint+test; api typecheck+lint+test+verify:dist; db typecheck).
- `apps/web` test: **105 lulus** (75 unit + 30 integration).
- `next build` dari `apps/web` sukses; 26 `page.tsx` terdeteksi.
- `next start -p 3123` probe: `/`, `/events`, `/fighters`, `/fights`, `/rankings`, `/news`, `/belts`,
  `/grand-prix`, `/tickets`, `/tickets/status`, `/robots.txt`, `/sitemap.xml` → **200**;
  `/admin/users` → **307** (redirect auth, sesuai); `/admin/login` → **200**; `/api/auth/login` GET → **405**.

## 2026-11-17 — `apps/api`: artefak produksi + smoke test `dist`

**Masalah:** `build` (`tsc -p tsconfig.build.json`) **gagal** — `TS6059`: Prisma Client 7 yang
digenerate sebagai **TypeScript** di root (`src/generated/prisma`) berada di luar `rootDir`
`apps/api`. Artinya selama ini "build lulus" hanya berarti `tsc --noEmit` (typecheck), **bukan**
artefak yang bisa dijalankan.

**Perbaikan:**
- `build` diganti ke **esbuild** bundle: `dist/index.js` (345 kb + sourcemap). `--packages=external`
  agar dependency Node tidak di-bundle; Prisma Client (import relatif) ikut masuk bundle.
- `tsconfig.build.json` dihapus (tidak dipakai, menyesatkan).
- Script baru: `start:prod` (`node dist/index.js`), `verify:dist` (`pnpm build && node
  scripts/smoke-dist.mjs`).

**Bug produksi ke-4 yang ketemu lewat smoke test ini:** menjalankan `node dist/index.js` membuat
`/health/ready` → **503** walau DB sehat. Penyebab: `env.ts` menghitung path `.env` dari
`import.meta.url`; setelah di-bundle lokasinya pindah `src/config/` → `dist/`, sehingga `.env`
root tidak ditemukan dan service **diam-diam** memakai default (`MYSQL_USER=boxing`, password
kosong) → `Access denied ... (using password: NO)`. Bukan masalah kredensial, murni resolusi path.
Perbaikan: kandidat `.env` diturunkan dari `process.cwd()` + induknya (apps/api → apps → root),
fallback berbasis lokasi file, plus dukungan `ENV_FILE`; file yang benar-benar dibaca kini
**dicatat di log startup** bersama target DB (tanpa password).

**Bukti (semua dijalankan):**

| Cek | Hasil |
|---|---|
| `pnpm --filter @tfn/api build` | `dist/index.js` 345.8 kb + map, 14 ms |
| `node dist/index.js` dari **`cwd=/tmp`** | start OK; log `config resolved` menyebut `.env` root |
| `/health` · `/health/ready` · `/api/v1/meta` · 404 | **200 · 200 `{"database":"up"}` · 200 · 404** envelope standar |
| `pnpm turbo:verify` | **7/7 task** (typecheck, lint, test, verify:dist), 8.8 s |
| Smoke `dist` (port 4123, `cwd=tmpdir()`) | ✓ lulus — kini masuk gate |

**Catatan gate:** `verify:dist` **tidak** memakai `turbo` `dependsOn: ["build"]` karena itu akan
memicu `next build` di root app (berat + butuh DB); script membangun dirinya sendiri lebih dulu.

## 2026-11-17 — Phase 1: fondasi monorepo + `apps/api` skeleton

Ruang lingkup disetujui Irhan. **Tidak ada file aplikasi existing yang dipindah atau dihapus.**

**Struktur baru**
- `pnpm-workspace.yaml` — workspace `"."` + `"apps/*"` (root ikut agar Turborepo menjalankan
  typecheck/lint/test app lama dalam satu perintah). `packages/*` sengaja belum dibuat: tidak
  ada kode bersama yang nyata (ADR-001).
- `pnpm-workspace.yaml` → `allowBuilds`: pnpm 12 memblokir lifecycle script dependency secara
  default. Dua percobaan gagal dicatat: `package.json#pnpm.onlyBuiltDependencies` **diabaikan**
  ("no longer read by pnpm") dan bentuk *list* pada `allowBuilds` **gagal parse** ("expected
  mapping start"). Bentuk yang benar: mapping `nama-paket: true|false`.
  Diizinkan: `@prisma/engines`, `prisma`, `esbuild`, `sharp`, `@node-rs/argon2`;
  `@scarf/scarf: false` (postinstall-nya hanya telemetri).
- `.npmrc` — `node-linker=hoisted` supaya app Next.js lama tetap berjalan dengan `node_modules`
  gaya lama setelah pindah ke pnpm.
- `turbo.json` — task `build`/`typecheck`/`lint`/`test`/`dev`/`db:generate`; `test.outputs: []`
  (sebelumnya `coverage/**` memicu peringatan "no output files found").
- `package.json` root — `packageManager: pnpm@12.10.1` (**wajib**, tanpa ini Turborepo menolak
  dengan "Could not resolve workspace"), `turbo ^2.11.11`, script `turbo:verify`, `api:dev`,
  `api:test`. Script app lama tidak diubah.

**`apps/api` (Express 5 + TypeScript)**
`src/config/env.ts` (zod, fail fast, baca `apps/api/.env` → `<root>/.env`, parse `DATABASE_URL`),
`src/lib/{logger,errors}.ts`, `src/middleware/{request-context,not-found,error-handler}.ts`,
`src/db/prisma.ts` (Prisma 7 + `@prisma/adapter-mariadb`, client digenerate dari
`prisma/schema.prisma` root — ADR-009, tidak ada schema duplikat), `src/routes/{health,v1}.ts`,
`src/docs/openapi.ts` (OpenAPI 3.1 + Swagger UI), `src/{app,index}.ts` (`createApp()` factory,
graceful shutdown), 4 file test, `eslint.config.mjs`, `tsconfig{,.build}.json`,
`vitest.config.mts`, `.env.example`, `README.md`.

**Dua bug ditemukan & diperbaiki saat verifikasi**
1. Parser `bool` di `env.ts` mengubah nilai kosong menjadi `false`, sehingga `/api/openapi.json`
   dan `/api/docs` **404 di runtime** walau test lulus (test lama hanya menguji jalur
   `openApiEnabled: true` eksplisit). Sekarang `undefined` tetap `undefined`; ditambah test
   regresi "docs aktif secara default".
2. `pnpm add -D typescript` menarik TypeScript **7.0.2**, dan `typescript-eslint` menolak jalan
   ("does not support TS 7.0"). Dipin ke `typescript@5.9.3` (sama dengan root).

**Bukti (dijalankan, bukan perkiraan)**
- `pnpm --filter @tfn/api typecheck` → 0 error · `lint` → 0 error/0 warning ·
  `test` → **19 lulus / 4 file**.
- `pnpm turbo:verify` → **6 task sukses, 0 cached, 9,62 s** (root typecheck+lint+unit, api
  typecheck+lint+test).
- API live (`:4000`, DB container `:3307`): `/health` 200 ·
  `/health/ready` 200 `{"database":"up"}` · `/api/v1/meta` 200 · `/api/openapi.json` 200
  (OpenAPI 3.1.0) · `/api/docs/` 200 · route tak dikenal → 404 dengan
  `{error:{code,message,requestId}}` · header `x-request-id` selalu ada.
- Regresi app lama pasca `pnpm install`: `typecheck` 0 · `lint` 0 · `next build` sukses ·
  unit **75 lulus (15 file)** · integration **30 lulus (5 file)**.

**Dokumentasi**
- `docs/02-ARCHITECTURE/MIGRATION-PLAN-WEB.md` (baru, **DRAFT — belum disetujui**): 5 langkah
  (A `apps/web` → B auth → C ticketing → D worker → E bersih-bersih) + risiko, rollback,
  acceptance criteria, dan 4 pertanyaan yang menunggu keputusan Irhan.
- `docs/02-ARCHITECTURE/MONOREPO-STRUCTURE.md` — status: sebagian terwujud (lihat §Status).

## 2026-11-17 — Blocker P0: database lokal, lint, sitemap

**Blockers fixed**

1. **DB lokal (port 3307).** Dua penyebab: (a) `.env` memakai `MYSQL_PORT=3306` +
   `DATABASE_URL ...:3306/boxing` padahal Compose memetakan host ke 3307 (3306 dipakai MariaDB
   sistem), jadi container dibuat tapi gagal bind; (b) `docker/mysql/init/01-dev-setup.sql`
   melakukan `GRANT ... TO 'boxing'@'%'` sementara `MYSQL_USER=boxing_user` — MySQL 8 menolak
   GRANT ke user yang tidak ada sehingga inisialisasi volume gagal.
   `TEST_DATABASE_URL` juga menunjuk DB `boxing` (sama dengan dev) — sekarang `boxing_test`.
2. **Lint.** `layout.tsx` memakai `dangerouslySetInnerHTML` (dilarang `no-restricted-syntax`);
   `official-crest.cjs` punya variabel `rgb` tak terpakai.
3. **Sitemap.** `sitemap.ts`/`robots.ts` tidak ada (produksi 404).

**Diubah**
- `.env` — `MYSQL_PORT=3307`, `DATABASE_URL` → `127.0.0.1:3307/boxing`,
  `TEST_DATABASE_URL` → `127.0.0.1:3307/boxing_test` (backup: `backups/config-20261117-105216/`).
- `docker/mysql/init/01-dev-setup.sql` — grant ke `'boxing_user'@'%'` + catatan kenapa.
- `src/app/layout.tsx` — tema dari cookie via `cookies()`, render `<html class>` di server;
  tidak ada `next/script`/inline JS.
- `src/lib/theme/ThemeContext.tsx` — `useSyncExternalStore` (localStorage → cookie → dark),
  `setTheme` menulis localStorage + cookie; reconcile pasca-hydration tanpa `setState` di effect.
- `src/app/sitemap.ts` (baru) — 9 route statis + fighter `ACTIVE`/`deletedAt: null`, try/catch,
  `revalidate = 3600`; mengecualikan `/admin`, `/api`, `/tickets/status`.
- `src/app/robots.ts` (baru) — disallow `/admin`, `/admin/`, `/api/`, `/tickets/status`, + sitemap.
- `src/app/(public)/tickets/status/page.tsx`, `src/app/admin/(dashboard)/layout.tsx` — `robots: noindex`.
- `scripts/verify/official-crest.cjs` — hapus helper `rgb` yang tidak dipakai.
- `public/theme-init.js` — **dihapus** (digantikan render SSR dari cookie).

**Diverifikasi**
- `docker ps` → `boxing-mysql` running/healthy, `3306/tcp -> 127.0.0.1:3307`.
- `prisma migrate deploy` 3 migration applied; `prisma db seed` sukses (dev); test DB terpisah.
- `npm run test:integration` → **30 lulus / 5 file** (sebelumnya tidak bisa jalan).
- `npx vitest run --project unit` → **75 lulus / 15 file**.
- `npm run typecheck` exit 0; `npm run lint` **0 error 0 warning**.
- `npm run build` sukses; `/sitemap.xml` & `/robots.txt` ter-prerender.
- `GET /sitemap.xml` → 200, XML valid, **15 URL** (9 statis + 6 fighter), 0 URL terlarang.
- `GET /robots.txt` → 200, `Disallow` + `Sitemap` + `Host` benar.
- Probe Playwright (cookie `tfn_theme=light`): class `light` sudah ada pada first paint
  (692ms), **0 mutasi class**, 0 error console; toggle → `dark` + cookie/localStorage `dark`;
  reload → SSR langsung `dark`, 0 mutasi (tanpa FOUC).

## 2026-11-17 — Phase 0: Audit & Discovery (dokumentasi saja)

**Ditambahkan**
- `docs/00-START-HERE/PHASE-0-AUDIT.md` — audit lengkap repo, DB, API, keamanan, deployment, risiko.
- `docs/00-START-HERE/` — PROJECT-OVERVIEW, QUICK-START, PROJECT-STATUS, DEVELOPMENT-GUIDE, GLOSSARY.
- `docs/01-PRODUCT/` — PRD, business rules, roles, journeys, roadmap, objectives.
- `docs/02-ARCHITECTURE/` — system, monorepo, backend, frontend, multi-tenant, auth, integrasi, modular monolith.
- `docs/03-DATABASE/` — database design, ERD, migration guide, seed data.
- `docs/04-API/API-STANDARDS.md`, `docs/08-SECURITY/{SECURITY-POLICY,RBAC}.md`,
  `docs/09-TESTING/TESTING-STRATEGY.md`, `docs/10-DEPLOYMENT/DEPLOYMENT-GUIDE.md`,
  `docs/11-DEVELOPMENT-LOG/*`, `docs/AI-CONTEXT/*`.

**Diubah**
- Tidak ada source code yang diubah.

**Diverifikasi**
- `tsc --noEmit` exit 0.
- `vitest run --project unit` → 75 lulus / 15 file.
- `eslint .` → 1 error (K-03), 1 warning.
- Probe HTTP produksi → 9 halaman 200; sitemap/robots 404.

## 2026-11-13 — Ticketing & sponsorship (riwayat repo)

- Guest checkout, PDF tiket + QR HMAC, check-in scanner, hold expiry + cron, cap pembeli.
- Sponsorship CMS (`/admin/sponsors`) + showcase di landing.
- Blok dukungan resmi Pemkab Temanggung (`OfficialSupport`).

> Riwayat lengkap sebelum audit ada di `CHANGELOG.md` root repo (27 KB) — tidak diduplikasi di sini.
