# Implementation Checklist & Phase Progression

> **Status:** Active Execution  
> **Source of Truth:** [prd.md](../prd.md)  

---

## Progress Overview

| Phase | Description | Status |
|:---:|---|:---:|
| **Phase 1** | Foundation: Setup, Prisma, MySQL, Auth, RBAC, Admin Shell | ✅ Complete |
| **Phase 2** | Core Data: Fighters, Weight Classes, Fight History, Events, Rankings | ✅ Complete |
| **Phase 3** | Championship: Belts, Reign History, Grand Prix Brackets, Result Workflow | ✅ Complete |
| **Phase 4** | CMS: Hero Slider, Section Page Builder, Media Storage, Versioning | ✅ Complete |
| **Phase 5** | Public Website: Cinematic Brutalism Landing Page, Fighter Profiles, 3D Belt, SEO | ✅ Complete |
| **Phase 6** | Hardening: Unit & Integration Tests, Security Audit, E2E Tests, Docs | ✅ Complete |

---

## Detailed Task Breakdown

### Phase 1 — Foundation
- [x] Project Scaffolding & Configuration (`package.json`, `tsconfig.json`, `eslint.config.mjs`)
- [x] Prisma Schema definition covering all 30 models (`prisma/schema.prisma`)
- [x] Prisma ORM Client generation (`src/generated/prisma`)
- [x] Environment validation with Zod (`src/lib/env.ts`)
- [x] Cryptographic & Auth utilities (Argon2id, AES-256-GCM, RFC 6238 TOTP, CSRF)
- [x] Redaction & Input sanitization libraries
- [x] RBAC catalog and permission definitions (`src/lib/permissions/catalog.ts`)
- [x] Session management service (`src/server/services/auth.service.ts`)
- [x] RBAC authorization guards (`src/lib/permissions/guard.ts`)
- [x] Audit log service (`src/server/services/audit.service.ts`)
- [x] Admin Shell Layout & Navigation (`src/app/admin/(dashboard)/layout.tsx`)
- [x] Admin Login Page & Authentication Handler (`src/app/admin/login/page.tsx`, `/api/auth/login`)

### Phase 2 — Core Data
- [x] Weight Classes CRUD & DTOs
- [x] Fighter Directory with search, filters, and profile view (`/fighters`, `/admin/fighters`)
- [x] Fight History & Fight Card management (`/fights`, `/events`)
- [x] Event scheduling & main event matchup pairing
- [x] Manual Official Ranking versioning and staging engine (`/rankings`, `/admin/rankings`)

### Phase 3 — Championship
- [x] Rotating Championship Belt manager & lineage ledger (`/belts`, `/admin/belts`)
- [x] Four-eyes belt transition approval & unique active constraint
- [x] Grand Prix Tournament creation & participant seeding (`/grand-prix`, `/admin/grand-prix`)
- [x] Tournament bracket engine (Single / Double Elimination)
- [x] Fight result verification & approval workflow

### Phase 4 — CMS
- [x] Hero Slider CMS with date scheduling (`src/components/landing/HeroSlider.tsx`)
- [x] Section-based Page Builder with Zod JSON validation
- [x] Page Revisions & instant rollback engine models in schema
- [x] Media asset management models (Local / S3)
- [x] Sponsor showcase marquee ticker (`src/components/layout/Footer.tsx`)

### Phase 5 — Public Website
- [x] Cinematic Brutalism Landing Page (Navbar, Hero Slider, Rankings, Grand Prix, Belts, Fighters, Events, Footer)
- [x] 3D Procedural Championship Belt with Three.js / R3F + 2D fallback (`BeltCanvas.tsx`, `Belt3DViewer.tsx`)
- [x] Public Fighter Directory with Search, Filters, Sorting, and Profiles (`/fighters`, `/fighters/[slug]`)
- [x] Public Rankings View (Divisional & Pound-for-Pound) (`/rankings`)
- [x] Public Grand Prix interactive bracket viewer (`/grand-prix`)
- [x] Public Fight History with outcome verification links (`/fights`)
- [x] SEO, Metadata, Open Graph, Sitemap, robots.txt

### Phase 6 — Hardening & Verification
- [x] Automated Tests — 58 passing (13 files: unit + integration, `vitest run`)
- [x] `npm run build` production compilation verified (100% clean Next.js 16.4.5 Turbopack build)
- [x] API Documentation (`docs/API.md`)
- [x] Production Deployment & Backup Guides (`docs/DEPLOYMENT.md`, `docs/BACKUP_RESTORE.md`)

### Phase 7 — Ticketing (guest order + manual admin verification)

Verification column = how the item was proven, not an assumption.

| # | Item | Verified by |
|---|---|---|
| 1 | `TicketOrder` / `TicketOrderItem` / `TicketPayment` schema + enums | `prisma migrate deploy` on `tfn_local`, integration tests |
| 2 | Guest checkout API with origin check, rate limit, Zod | 5 validation payloads → readable Indonesian errors, 400 |
| 3 | Atomic capacity guard (`sold <= quota - qty`) | 50 parallel requests for 50 seats → exactly 50 granted, 0 oversell |
| 4 | Pending holds consume capacity | order qty 4 on 4 remaining seats → next request 409 `SOLD_OUT` |
| 5 | Full capacity returns 409, not 500 | `sold = quota` → 409 `Kuota tiket tidak mencukupi` |
| 6 | Capability token (sha256 at rest) | 32-byte token returned once; wrong token → 404, no order leak |
| 7 | Admin-only confirm/reject + audit actor | Playwright: guard redirect to login, confirm → `CONFIRMED`/`VERIFIED`, reject → `REJECTED` |
| 8 | Rejection releases capacity | reject qty 2 → public page shows 780/780 seats again |
| 9 | Public tickets UI (category cards, stepper, live total, receipt) | Playwright on production build, no JS errors |
| 10 | Buyer self-service status page (server-resolved deep link) | deep link renders receipt on first paint; method `BANK_TRANSFER` visible |
| 11 | Admin ticketing panel (stats, quota bars, `?status=` filters, toasts) | Playwright, filters + reject-with-reason |
| 12 | Single `<main>` landmark on public pages | DOM assertion: `main` count = 1 |
| 13 | Human-readable validation + malformed JSON handling | curl: 7 payload variants |
| 14 | Typecheck + build + lint | `tsc --noEmit` exit 0, `next build` 28 routes, eslint 0 errors |
| 15 | Signed ticket QR payload (`TFN1.<order>.<HMAC>` in `src/lib/ticketing/ticket-token.ts`) | 7 unit tests: swapped order number → reject, tampered signature → reject, foreign secret → reject, junk input never throws |
| 16 | Ticket PDF artifact (`pdf-lib` + `qrcode`, A4, QR embedded, WinAnsi-safe text) | integration: bytes start `%PDF-` (>5 KB), 1 page, `/Image` XObject present, payload resolves to the order number |
| 17 | Guest download route `/tickets/[orderNumber]/ticket?token=` | live HTTP on production build: 200 `application/pdf` + `attachment` filename + `no-store`; 401 without token, 404 wrong token, 409 unconfirmed |
| 18 | Per-buyer per-category cap (`MAX_TICKETS_PER_BUYER_PER_CATEGORY = 10`) | live probe on production build: 6 + 4 = 201, 11th via `+62` re-spelling → 409 `PURCHASE_LIMIT` with readable text, `sold` stayed 10, only 2 order rows. Integration: boundary at 10, holds count, rejected/expired freed, category/event isolation, email re-case blocked |
| 19 | Buyer identity canonicalisation (`src/lib/ticketing/buyer-identity.ts`) | 5 unit tests: `+62`/`62`/`0`/bare `8` all → `08…`, short/junk phones never match, email case-insensitive |
| 20 | Onsite gate check-in (`checkInTicket()` + `/admin/ticketing/scan`) | 9 integration tests: signed QR → `USED` + `checkedInAt`/`checkedInById`, audit `TICKET_CHECKED_IN`; second scan `ALREADY_USED` naming the first entry time with the row untouched; two concurrent scans admit exactly one; forged QR and unknown order return the *same* message (no oracle); pending/rejected refused; wrong `eventId` refused; manual order-number fallback audited as `MANUAL`. Live probe: `scripts/verify/checkin-e2e.cjs` |

| 21 | Hold expiry **scheduled** (`scripts/cron/expire-holds.sh` + `scripts/cron/install.sh`) | live cron daemon at `* * * * *` fired at 11:54:02 / 11:55:02, log `exit=0 … node=/usr/bin/node` (cron's minimal PATH resolved). Sweep proof: 48h-old pending order → `scanned=1 expired=1 seatsReleased=2`, `CANCELLED`, `sold` 2 → 0, audit `TICKET_HOLD_EXPIRED` `actorId=NULL`; rerun `scanned=0`. Guards proven: `flock` overlap → `skipped` exit 0; missing `tsx` → exit 1 with a readable message; `install.sh` idempotent (2 installs → 1 crontab line), `uninstall` leaves 0 entries |

**Not covered yet (explicitly open):** email delivery, refunds, seat numbering, POS integration, an
offline-first gate mode (the scanner needs a live connection), and a hard concurrency lock on the
per-buyer cap (see the note in `docs/API.md`).
