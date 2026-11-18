# Struktur Repo (kondisi nyata, 18 Nov 2026)

> **Status: 🟢 berlaku.** Dokumen ini sebelumnya berisi *target* monorepo `tfn-platform/`
> (`apps/website`, `apps/admin`, `apps/pos`, …) yang **tidak pernah diwujudkan** dan sekarang
> **tidak berlaku**. Sejak 18 Nov 2026 repo diringkas menjadi **dua project mandiri**.
> Riwayat keputusan lama tetap ada di `MIGRATION-PLAN-WEB.md` dan `DECISIONS.md` — itu arsip,
> bukan panduan aktif. Peta path lama → baru: `PATH-MIGRATION-2026-11.md`.

## Prinsip

1. **Satu repo, dua aplikasi mandiri.** Tidak ada workspace bersama di root, tidak ada Turborepo.
2. Tiap project punya `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `pnpm-lock.yaml`,
   `node_modules`, env, dan proses PM2 **sendiri**. `pnpm install` dijalankan di dalam project.
3. Kode yang dipakai bersama tidak ditaruh di root: disalin ke `web-tnf/packages/*` (db, core,
   auth, ticketing). `ticket-tnf` sengaja **tidak** memakai paket itu — ia punya skema Prisma,
   service, dan DB sendiri (`tfn_ticketing`) agar tidak bisa merusak DB platform.

## Pohon

```
TFN/
├── web-tnf/                        Website + CMS + backend
│   ├── package.json                name: web-tnf (Next.js 16 App Router)
│   ├── pnpm-workspace.yaml         packages/*, api, worker
│   ├── src/                        app/ (public + /admin), components, lib, server, proxy
│   ├── api/                        @tfn/api — Express :4000 (esbuild bundle → dist/)
│   ├── worker/                     @tfn/worker — job `expire-holds`
│   ├── packages/
│   │   ├── db/                     Prisma client (schema ada di web-tnf/prisma)
│   │   ├── core/                   audit, settings, sponsors, redact
│   │   ├── auth/                   session, RBAC, password, TOTP, rate-limit
│   │   └── ticketing/              kode ticketing lama — TIDAK dipakai lagi (arsip migrasi)
│   ├── prisma/                     schema.prisma + migrations (DB `boxing`)
│   ├── docker/                     compose MySQL lokal
│   ├── storage/                    file upload lokal (STORAGE_DRIVER=local)
│   └── docs/                       ADR & panduan (dokumen ini ada di sini)
└── ticket-tnf/                     Ticketing terpisah
    ├── package.json                name: ticket-tnf (Next.js 16 + Prisma 7)
    ├── pnpm-workspace.yaml         mandiri, tanpa packages/*
    ├── src/                        app/, lib/ (auth, payments, ticketing), server/
    └── prisma/                     schema.prisma + migrations (DB `tfn_ticketing`)
```

Root hanya berisi: `README.md`, `CHANGELOG.md`, `prd.md`, `AGENTS.md`, `docs/`, `.gitignore`,
dan dua folder project di atas.

## Batas tanggung jawab

| Hal | `web-tnf` | `ticket-tnf` |
|---|---|---|
| Domain produksi | domain utama | subdomain tiket |
| Port dev | 3000 (web) · 4000 (api) | 3010 |
| Database | `boxing` | `tfn_ticketing` |
| Login | email+password + MFA (CMS) | pembeli: Google OAuth · admin: password + TOTP |
| Cookie | `tfn_session` | `tkt_session` (pembeli) · `tkt_admin` (panel) |
| Prisma schema | `web-tnf/prisma/schema.prisma` | `ticket-tnf/prisma/schema.prisma` |
| Payment | — | Midtrans Snap (`mock` untuk dev) |
| Tiket publik | **tidak ada** — `/tickets*` → 308 ke `ticket-tnf` | `/`, `/events/[slug]`, `/orders/[no]`, `/my-tickets` |
| Panel admin | CMS saja (tanpa menu tiket) | `/admin` (gerbang & pesanan) |
| API tiket | `/api/ticketing` **dimatikan** (router lama diarsipkan) | milik sendiri di `ticket-tnf` |

## Keputusan 18 Nov 2026 — tiket keluar dari `web-tnf`

Penjualan tiket **tidak lagi** hidup di `web-tnf`. Semua tautan tiket publik (Navbar, hero,
footer, matchup showcase) menunjuk ke base URL `NEXT_PUBLIC_TICKETING_URL` lewat helper
`src/lib/ticketing/external.ts`, dan URL lama tetap hidup sebagai redirect 308 di `src/proxy.ts`:

| URL lama `web-tnf` | Tujuan `ticket-tnf` |
|---|---|
| `/tickets` | `/` |
| `/tickets/status` | `/my-tickets` |
| `/tickets/<order>` | `/orders/<order>` |
| `/tickets/<order>/ticket` | `/api/tickets/<order>/pdf` |
| `/admin/ticketing` | `/admin/orders` |
| `/admin/ticketing/scan` | `/admin/scan` |

Yang dihapus dari `web-tnf`: halaman `/tickets/*` + `/admin/ticketing/*`, komponen
`TicketOrderForm`/`OrderStatusLookup`/`TicketScanner`, `server/services/ticketing.service.ts`
dan `ticket-pdf.service.ts`, `src/app/api/ticketing/**`, 10 test tiket, dan menu
"Tiket & Pembayaran". Yang **sengaja dibiarkan**: tabel & migrasi `TicketOrder`/`TicketType`/
`TicketPayment` di DB `boxing` (data historis, belum di-drop), `packages/ticketing`, dan
`api/src/routes/ticketing.ts` (referensi migrasi, tidak didaftarkan).

Env baru: `TICKETING_URL` (server, dipakai proxy) dan `NEXT_PUBLIC_TICKETING_URL` (client,
dipakai komponen). Dev: `http://localhost:3010`.

`web-tnf` **wajib** menjalankan `api` (:4000). Semua panggilan data dari browser lewat BFF Next
(`src/lib/api/client.ts`), yang meneruskan ke `API_INTERNAL_URL`. API mati → `503
UPSTREAM_UNREACHABLE` (bukan error 500 yang membingungkan).

## Perintah

```bash
# web-tnf
cd web-tnf
pnpm install
pnpm dev            # Next dev
pnpm api:dev        # API (tsx watch)
pnpm api:build      # esbuild → api/dist/index.js
pnpm api:start      # node dist
pnpm worker:expire  # job expire-holds
pnpm typecheck && pnpm lint && pnpm test

# ticket-tnf
cd ticket-tnf
pnpm install
pnpm dev            # Next dev :3010
pnpm probe          # E2E domain (order → bayar → tiket → gate)
pnpm probe:admin    # gate admin: password + TOTP, lockout, scan
pnpm typecheck && pnpm lint && pnpm test
```

Tidak ada lagi `pnpm turbo:verify` / `verify:integration` di root — jalankan verifikasi per
project seperti di atas. Skrip `verify:integration` milik `web-tnf/api` tetap ada di dalam
project itu (Vitest, MySQL test :3307).

## Deploy (ringkas)

PM2 + aaPanel, tanpa Dockerfile:

| Proses PM2 | cwd | perintah |
|---|---|---|
| `boxing-tfn` | `TFN/web-tnf` | `pnpm start` (Next :3000) |
| `tfn-api` | `TFN/web-tnf/api` | `node dist/index.js` (:4000, wajib sehat) |
| `tfn-ticketing` | `TFN/ticket-tnf` | `pnpm start` (:3010) |

Detail: `../10-DEPLOYMENT/DEPLOYMENT-GUIDE.md`.

## Hal yang TIDAK boleh dikembalikan tanpa keputusan baru

- Menaruh kode bersama di root repo (mematikan kemandirian dua project).
- Menghidupkan lagi Turborepo.
- Menyatukan `ticket-tnf` ke dalam `web-tnf` (skema & DB ticketing harus tetap terpisah).
