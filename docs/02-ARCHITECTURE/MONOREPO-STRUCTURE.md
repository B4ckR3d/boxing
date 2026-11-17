# Monorepo Structure (TARGET)

> **Status: 🟡 sebagian terwujud (17 Nov 2026).** Yang **sudah ada**: `pnpm-workspace.yaml`,
> `turbo.json`, `apps/api` (Express skeleton). Yang **belum**: `apps/web` (app Next masih di
> root), `apps/worker`, `packages/*`, `infrastructure/*` — lihat §Status implementasi di bawah
> dan `MIGRATION-PLAN-WEB.md` (draft, menunggu persetujuan).

```
tfn-platform/
├── apps/
│   ├── website/          Next.js — publik (SEO, RSC)
│   ├── admin/            Next.js — dashboard internal
│   ├── pos/              Next.js (PWA) — kasir & gate, prioritas tablet/HP
│   ├── api/              Express + Prisma — semua logika bisnis
│   └── worker/           BullMQ consumer — job async
├── packages/
│   ├── ui/               komponen presentational + design tokens
│   ├── types/            DTO & tipe domain bersama
│   ├── validators/       skema Zod bersama (dipakai API + form)
│   ├── api-client/       client tipis (fetch wrapper + tipe)
│   ├── config/           eslint, tsconfig, tailwind preset
│   └── utils/            helper murni (tanggal, uang, format)
├── infrastructure/
│   ├── docker/           Dockerfile per app
│   ├── nginx/            vhost per domain
│   ├── scripts/          deploy, backup, restore
│   └── monitoring/       healthcheck, log config
├── docs/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Aturan dependensi

| Boleh | Dilarang |
|---|---|
| `apps/*` → `packages/*` | `packages/*` → `apps/*` |
| `apps/pos` → `packages/api-client`, `ui`, `types`, `validators` | frontend mengimpor `apps/api/src/**` |
| `apps/api` → `packages/validators`, `types`, `utils` | `packages/ui` mengimpor Prisma |
| `apps/worker` → `packages/types`, `utils` (+ service internal API via HTTP/queue) | worker mengakses DB tabel milik modul lain tanpa aturan |

## Pipeline Turborepo (target)

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {},
    "test": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

Setiap app wajib bisa: `pnpm --filter <app> dev|build|test|lint` secara independen.

## Migrasi dari struktur sekarang

| Sekarang | Target |
|---|---|
| `src/app/(public)/*`, `src/components/*` | `apps/website` (komponen UI dipindah ke `packages/ui` bila reusable) |
| `src/app/admin/*`, `src/components/admin/*` | `apps/admin` |
| `src/app/api/*`, `src/server/services/*` | `apps/api/src/modules/*` |
| `scripts/expire-holds.ts`, `scripts/cron/*` | `apps/worker/src/jobs/*` |
| `src/lib/{security,permissions,db,env}` | `apps/api/src/{shared,middlewares,config}` + `packages/utils` |
| `src/lib/ticketing/*` (label, token) | `packages/{utils,types}` (yang murni) |
| `prisma/` | `apps/api/prisma` (satu schema, satu DB) |

Langkah aman: pindahkan **tanpa mengubah logika**, jalankan gate, baru refactor.

---

## Status implementasi (17 Nov 2026, terverifikasi)

Kondisi nyata repo hari ini — **bukan** target di atas:

```
TFN/
├── apps/
│   └── api/                  ✅ ADA — Express 5 + TS skeleton
│       ├── src/{app,index}.ts       createApp() factory + graceful shutdown
│       ├── src/config/env.ts        zod, fail fast, .env api → root
│       ├── src/lib/{logger,errors}  pino + taksonomi error (AppError cs.)
│       ├── src/middleware/*         requestContext, notFound, errorHandler
│       ├── src/db/prisma.ts         Prisma 7 + adapter-mariadb (schema root)
│       ├── src/routes/{health,v1}   /health, /health/ready, /api/v1/meta
│       ├── src/docs/openapi.ts      OpenAPI 3.1 + Swagger UI
│       └── tests/*.test.ts          19 test (health, error, env, docs)
├── src/                      ⚠️ app Next.js MASIH DI ROOT (belum apps/web)
├── prisma/                   ⚠️ masih di root — ADR-009: satu schema, jangan diduplikasi
├── pnpm-workspace.yaml       ✅ workspace `"."` + `apps/*`, `allowBuilds`
├── turbo.json                ✅ task build/typecheck/lint/test/dev/db:generate
├── .npmrc                    ✅ node-linker=hoisted (app lama tetap jalan)
└── package.json              ✅ packageManager pnpm@12.10.1 + turbo
```

### Perintah gate monorepo

```bash
pnpm install                # wajib: pnpm, bukan npm (lockfile & build scripts)
pnpm turbo:verify           # typecheck + lint + test + verify:dist untuk SEMUA package
pnpm api:dev                # apps/api di :4000 (tsx watch)
pnpm --filter @tfn/api test # hanya test API (tidak butuh MySQL — checkDb di-inject)
```

### Jebakan yang sudah ditemui (jangan diulang)

| Gejala | Penyebab | Solusi |
|---|---|---|
| `ERR_PNPM_IGNORED_BUILDS` | pnpm 12 memblokir postinstall dependency | `allowBuilds` **mapping** di `pnpm-workspace.yaml`; `package.json#pnpm.onlyBuiltDependencies` sudah **diabaikan** |
| `Failed to parse pnpm-workspace.yaml` | `allowBuilds` ditulis sebagai list | harus mapping `paket: true|false` |
| `Could not resolve workspace` (turbo) | `packageManager` tidak ada | `"packageManager": "pnpm@12.10.1"` di root |
| Turbo hanya menjalankan task `apps/api` | root tidak terdaftar sebagai workspace project | `packages: ["."]` |
| `typescript-eslint does not support TS 7.0` | `pnpm add -D typescript` menarik v7 | pin `typescript@5.9.3` |

### Batas yang disengaja

`apps/api` **belum** punya auth, modul bisnis, atau worker. Semua route bisnis masih di
`src/app/api/*` milik app Next.js. Modul baru **hanya** boleh ditambah di `apps/api`, dan
pemindahan kode lama menunggu `MIGRATION-PLAN-WEB.md` disetujui.

### Struktur final setelah Langkah A (17 Nov 2026)

```
tfn/
├── apps/
│   ├── web/     @tfn/web  — Next.js 16 (src/app, components, lib, server, public, tests, scripts/verify)
│   └── api/     @tfn/api  — Express 5 + TS (esbuild bundle → dist/index.js)
├── packages/
│   └── db/      @tfn/db   — Prisma Client bersama (src/generated/prisma, gitignored)
├── prisma/      schema.prisma + migrations + seed.ts  (dijalankan dari root)
├── scripts/     skrip ops: bootstrap-admin, reset-password, expire-holds, wait-for-db, db-backup, monorepo/
├── docker/ · docs/ · turbo.json · pnpm-workspace.yaml · tsconfig.json (skrip ops saja)
```

Aturan yang mengikat struktur ini:

| Aturan | Alasan |
|---|---|
| Satu `.env` di root; web memuatnya eksplisit di `next.config.ts` & `tests/setup.ts` | Next hanya membaca `.env` di direktori app |
| `turbopack.root` + `outputFileTracingRoot` = root repo | `node_modules` ada di root (`node-linker=hoisted`); kalau diarahkan ke `apps/web`, `next` dianggap tidak terpasang |
| `transpilePackages: ["@tfn/db"]` | `@tfn/db` mengirim TypeScript source, bukan JS hasil build |
| esbuild `--alias:@tfn/db*` di `apps/api` | `--packages=external` akan meng-external-kan `@tfn/db` → `ERR_MODULE_NOT_FOUND` saat runtime |
| Root `tsconfig.json` memetakan `@/*` → `apps/web/src/*` | Skrip ops (`tsx scripts/*.ts`) tetap memakai alias yang sama tanpa duplikasi path |
