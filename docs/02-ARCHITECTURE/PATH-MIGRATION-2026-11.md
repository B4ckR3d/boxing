# Peta Migrasi Path — 18 Nov 2026

Restrukturisasi: monorepo (`apps/*`, `packages/*`, root Next app, Turborepo) → **dua project
mandiri** (`web-tnf/`, `ticket-tnf/`) dalam satu repo.

Dokumen historis (`11-DEVELOPMENT-LOG/CHANGELOG.md`, `DECISIONS.md`, `MIGRATION-PLAN-WEB.md`,
`HANDOVER.md`, `SESSION-HANDOVER.md`) **sengaja tidak diubah** — itu catatan kejadian pada
masanya. Saat membaca dokumen lama itu, pakai tabel ini untuk menerjemahkan path.

## Peta path

| Path lama | Path baru |
|---|---|
| `apps/web/` (Next.js, web + `/admin` CMS) | `web-tnf/` (root project, `src/`) |
| `apps/api/` (Express) | `web-tnf/api/` |
| `apps/worker/` | `web-tnf/worker/` |
| `apps/ticketing/` (dihapus 18 Nov) | `ticket-tnf/` |
| `packages/db/` | `web-tnf/packages/db/` |
| `packages/core/` | `web-tnf/packages/core/` |
| `packages/auth/` | `web-tnf/packages/auth/` |
| `packages/ticketing/` | `web-tnf/packages/ticketing/` |
| `prisma/schema.prisma` (root) | `web-tnf/prisma/schema.prisma` |
| `prisma/migrations/` (root) | `web-tnf/prisma/migrations/` |
| `scripts/` (root: deploy, db-backup, cron) | `web-tnf/scripts/` |
| `docker/mysql/` | `web-tnf/docker/mysql/` |
| `storage/` (upload lokal) | `web-tnf/storage/` |
| `.env` (root, dipakai semua app) | `web-tnf/.env` · `ticket-tnf/.env.local` |
| `docs/` | tetap di root `docs/` |

## Perubahan perintah

| Lama (root) | Baru |
|---|---|
| `pnpm dev` (root Next) | `cd web-tnf && pnpm dev` |
| `pnpm --filter @tfn/api dev` | `cd web-tnf && pnpm api:dev` |
| `pnpm --filter @tfn/worker …` | `cd web-tnf && pnpm worker:expire` |
| `pnpm turbo:verify` | `cd web-tnf && pnpm typecheck && pnpm lint && pnpm test` (lalu sama di `ticket-tnf`) |
| `pnpm turbo build` | `cd web-tnf && pnpm build` · `cd web-tnf/api && pnpm build` |
| `pnpm dev` (apps/ticketing) | `cd ticket-tnf && pnpm dev` |

## Yang ikut berubah di kode

| Berkas | Perubahan |
|---|---|
| `web-tnf/api/package.json` | alias esbuild `../../packages/*` → `../packages/*`; `--schema ../prisma/schema.prisma` |
| `web-tnf/api/src/lib/cookie-jar.ts` | import `../../../web/src/lib/auth/session-cookie-jar` → `../../../src/…` |
| `web-tnf/worker/src/cli.ts` | `.env` path `../../../` → `../../` |
| `web-tnf/next.config.ts` | env `../../.env` → `./.env`; `turbopack.root` & tracing root = folder project |
| `web-tnf/tsconfig.json` | `exclude` ditambah `api`, `worker` |

## Root yang dihapus

`apps/`, `packages/`, `prisma/`, `scripts/`, `docker/`, `storage/`, `backups/`, `.turbo/`,
`node_modules/`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`,
`tsconfig.json`, `tsconfig.tsbuildinfo`, `prisma.config.ts`, `docker-compose.yml`, `.env`,
`.env.example`, `.npmrc`.

Pemulihan: `git checkout HEAD -- apps/ packages/ …` (semua file terlacak) atau cadangan
`/tmp/TFN-full-backup-<timestamp>.tar.gz`.

## Konsekuensi operasional

- PM2 di server harus di-repoint **sebelum** `git pull`, karena `apps/web` & `apps/api` tidak ada
  lagi. Lihat `../10-DEPLOYMENT/DEPLOYMENT-GUIDE.md`.
- `web-tnf` butuh `api` (:4000) hidup; `ticket-tnf` berdiri sendiri.
