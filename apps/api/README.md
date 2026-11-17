# @tfn/api

Skeleton backend Express + TypeScript (Phase 1, ADR-001). **Belum ada modul bisnis** —
ticketing/fighter/payment masih hidup di app Next.js di root.

## Isi

| Area | File | Catatan |
|---|---|---|
| Bootstrap | `src/index.ts` | validasi env → listen → graceful shutdown (SIGTERM/SIGINT) |
| App factory | `src/app.ts` | `createApp({ checkDb })` — bisa diuji tanpa port & tanpa MySQL |
| Environment | `src/config/env.ts` | zod, fail fast; baca `apps/api/.env` lalu `<root>/.env` |
| Logging | `src/lib/logger.ts` | pino JSON, redaksi header sensitif |
| Error | `src/lib/errors.ts`, `src/middleware/error-handler.ts` | satu bentuk JSON error + requestId |
| Database | `src/db/prisma.ts` | Prisma 7 + `@prisma/adapter-mariadb` |
| Health | `src/routes/health.ts` | `/health` (liveness), `/health/ready` (DB) |
| Dokumentasi | `src/docs/openapi.ts` | OpenAPI 3.1, UI di `/api/docs` |

## Perintah

```bash
pnpm --filter @tfn/api dev          # tsx watch
pnpm --filter @tfn/api start        # tanpa watch
pnpm --filter @tfn/api test         # vitest (tanpa DB — checkDb di-inject)
pnpm --filter @tfn/api typecheck
pnpm --filter @tfn/api lint
pnpm --filter @tfn/api db:generate  # prisma generate dari ../../prisma/schema.prisma
```

## Kontrak response

Sukses: JSON biasa. Gagal: selalu

```json
{ "error": { "code": "NOT_FOUND", "message": "…", "requestId": "…" } }
```

`code` stabil (aman untuk branching di FE); `message` untuk manusia; error 5xx tidak membocorkan
detail internal (detail hanya di log).

## Konfigurasi

Default `API_PORT=4000`. Aplikasi Next.js lama tetap di 3000. Variabel lengkap: `.env.example`.
Perubahan env wajib lewat PR + update `.env.example` (jangan commit secret).

### Urutan pembacaan `.env`

1. `$ENV_FILE` (path eksplisit, paling tinggi prioritas)
2. `.env` di `process.cwd()`, lalu **direktori induknya** (max 5 level) — jadi menjalankan dari
   `apps/api`, `apps/`, atau root repo sama-sama menemukan `.env` root
3. fallback relatif terhadap lokasi file (`src/config/` saat `tsx`, `dist/` saat bundle)

File yang benar-benar dipakai **dicetak di log startup** (`msg: "config resolved"`, field
`envFiles` + `db` tanpa password). Ini bukan kemewahan: pernah ada kejadian `.env` tidak terbaca
saat bundle, service diam-diam memakai default, dan `/health/ready` balas 503 padahal DB sehat.

## Build & jalankan artefak produksi

| Perintah | Fungsi |
|---|---|
| `pnpm dev` | `tsx watch` (hot reload) |
| `pnpm start` | `tsx` tanpa watch |
| `pnpm build` | **esbuild** bundle → `dist/index.js` (+ sourcemap) |
| `pnpm start:prod` | `node dist/index.js` |
| `pnpm verify:dist` | build lalu smoke test `dist` (health, ready, envelope 404) di port acak |

`build` memakai esbuild, **bukan** `tsc`, karena Prisma Client 7 digenerate sebagai TypeScript di
root dan berada di luar `rootDir` package ini (`TS6059`). `tsc` tetap dipakai untuk `typecheck`
(`--noEmit`).

## Yang sengaja BELUM ada

Auth/JWT, modul bisnis, worker, `apps/web`, `packages/*`. Lihat
`docs/02-ARCHITECTURE/MONOREPO-STRUCTURE.md` §Status implementasi dan
`docs/02-ARCHITECTURE/MIGRATION-PLAN-WEB.md` (draft, menunggu persetujuan).
