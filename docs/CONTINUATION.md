# CONTINUATION.md — Handover Guide (Junior Developer & AI Agent)

> Read this first. It tells you **where things are**, **what is actually proven**, **what is still
> open**, and **how not to break the parts that are already verified**.
> Last verified: production build (`npm run build`) + Playwright E2E on `next start` port 3015.

---

## 1. What this project is

**TFN — Temanggung Fight Night.** A boxing promotion website with a public cinematic site and a
permission-controlled CMS. Tickets are sold as **guest orders with manual admin verification** — no
payment gateway, no buyer account.

Stack: Next.js 16 (App Router, RSC) · TypeScript strict · Prisma 7 + MariaDB adapter · MySQL/MariaDB
(`tfn_local`) · Tailwind CSS v4 tokens · Argon2id + DB sessions · Vitest + Playwright.

---

## 2. Run it locally (5 commands)

```bash
cd ~/Projects/My-Projects/TFN
npm install                 # postinstall runs prisma generate
npm run db:deploy           # apply migrations to tfn_local
npm run db:seed             # permissions, roles, demo event + 3 ticket categories
npm run dev -- --port 3015  # http://localhost:3015
```

`.env` keys that matter:

| Key | Why it matters |
|---|---|
| `APP_URL` | **Pinned to `http://localhost:3015`.** Login and all mutating APIs reject a mismatched `Origin` → `403`. Do not use `127.0.0.1`, or use the exact same string in `APP_URL`. |
| `MYSQL_*` / `DATABASE_URL` | Local DB connection. `TEST_DATABASE_URL` is used by integration tests only. |
| `AUTH_SECRET`, `ENCRYPTION_KEY` | Session signing + AES-256-GCM for TOTP seeds. Rotating them logs everyone out. |
| `SEED_DEMO`, `SEED_DEMO_USERS`, `DEMO_USER_PASSWORD` | Demo content and the seeded super admin. |

Seeded login: `superadmin@boxing.local` / value of `DEMO_USER_PASSWORD`.

---

## 3. Repo map (only the parts you will touch)

```
prisma/schema.prisma          ← single source of truth for models/enums
prisma/seed.ts                ← demo event "WBC-X 42: Night of Champions" + 3 categories
src/app/(public)/             ← public site; layout already renders <main id="main-content">
src/app/(public)/tickets/     ← purchase page + status self-service page
src/app/admin/(dashboard)/    ← CMS; layout renders sidebar + auth guard
src/app/api/                  ← REST handlers (origin + rate limit + Zod)
src/server/services/          ← domain logic, transactions (ticketing.service.ts lives here)
src/components/{ui,admin,ticketing,layout,landing,...}
src/lib/{db,permissions,security,actions}
docs/                         ← architecture, API, DB, RBAC, deployment, this file
tests/{unit,integration}      ← Vitest projects (`unit`, `integration`)
```

### Golden rule: pages do **not** render `<main>`
`src/app/(public)/layout.tsx` and the admin layout already provide the `<main>` landmark. Adding
another one breaks the accessibility tree (this regressed once — assertion: `document.querySelectorAll("main").length === 1`).

---

## 4. Verified state (treat as regression baseline)

| Area | Evidence |
|---|---|
| Unit + integration tests | `npm run test:all` → **58 passed / 13 files** |
| Typecheck | `npm run typecheck` → exit 0 |
| Lint | `eslint .` → 0 errors |
| Production build | `npm run build` → 28 routes, includes `/tickets/status` |
| Guest checkout UI | Playwright: category card select → qty stepper → live total → receipt with order + token |
| Concurrency safety | 50 parallel POSTs for 50 seats → 50 granted, 0 oversold |
| Pending holds capacity | qty 4 on 4 remaining → next request `409 SOLD_OUT` |
| Token gate | wrong token → `404`, zero data leak, no article rendered |
| Admin guard | anonymous `/admin/ticketing` → `307 → /admin/login` |
| Admin confirm | Playwright click → `CONFIRMED` + payment `VERIFIED` + audit actor |
| Admin reject | Playwright + reason → `REJECTED`, capacity released (public page back to 780/780) |
| Buyer status page | deep link resolved server-side, renders on first paint, shows payment method |
| Validation messages | 7 curl variants → human Indonesian sentences, `400`/`409` only |

**Do not "clean up" these on assumption** — every row above has been observed, not inferred. If you
change a rate limit, a guard, or the reservation query, re-run the matching row.

---

## 5. Ticketing invariants (break these and you oversell)

1. `TicketType.sold` includes **pending holds** *and* confirmed orders. Never compute "available" from
   confirmed orders alone.
2. Capacity is reserved with `updateMany({ where: { sold: { lte: quota - qty } }, data: { sold: { increment: qty } } })`
   inside a transaction. Never `findUnique` then `update` — that is a race.
3. `rejectOrder` **must** decrement `sold` by exactly the rejected quantity. A rejection that leaves
   `sold` untouched silently removes seats from sale forever.
4. The guest token is returned once and stored as `sha256`. Do not store plaintext, do not log it.
5. A wrong token and an unknown order must return the same response (`404`).

---

## 6. Conventions

- **Server actions** return `ActionResult` (`{ ok: true } | { ok: false, error }`). Client code must
  read `result.ok` and toast the error — a fire-and-forget call looks like a dead button.
- **Validation errors** are user-facing: map Zod issues to Indonesian sentences. Never surface
  `too_big`/`path`/`min` raw.
- **Every mutation** goes through `verifyRequestOrigin()` and permission checks
  (`ticketing.read|manage|confirm`, `admin.access`, …). Hiding UI is UX, not security.
- **Numbers** in the DB are `Decimal`; convert with `Number(...)` for display and `String(...)` when
  passing across the RSC boundary.
- **Server-rendered first paint**: resolve deep links on the server (`await searchParams`), don't
  fetch in `useEffect` — the React lint rule `react-hooks/set-state-in-effect` fails the build.
- Dates are shown with `id-ID` locale; `timezone: "Asia/Jakarta"` on events.

---

## 7. Known gaps (deliberately open — do not report as bugs)

- No payment gateway, no email/SMS delivery. The entry credential is now the ticket PDF: a signed QR
  payload (`TFN1.<order>.<HMAC>`) plus the printed order number + buyer name.
- No per-category purchase cap across repeated orders (only 1–10 per order).
- No refunds, seat numbering, or onsite check-in scanning.
- Rate limiting is in-process memory (single instance only); multi-instance needs Redis.
- Hold expiry exists (`expireStaleHolds`) but nothing schedules it yet — it must be wired into cron on
  the server (see §11), otherwise stale holds still block seats.

**Deprecated from this list:** "unpaid holds hold seats indefinitely" and "`CANCELLED` is never set" —
both are now handled by the sweep (§11).

---

## 8. Suggested next steps (with acceptance criteria)

1. ~~**Hold expiry job**~~ ✅ **DONE** — `expireStaleHolds()` in `src/server/services/ticketing.service.ts`,
   CLI `npm run ticketing:expire-holds`, tests in `tests/integration/hold-expiry.integration.test.ts`.
   *Proven:* `sold` decreases by the held quantity, a stale token returns `CANCELLED`, audit row
   `TICKET_HOLD_EXPIRED` written, confirmed orders untouched, second run is a no-op. Still needs the
   cron line installed on the server (see §11).
2. ~~**Ticket artifact**~~ ✅ **DONE** — `getTicketArtifact()` in `src/server/services/ticketing.service.ts`,
   renderer `src/server/services/ticket-pdf.service.ts` (`pdf-lib` + `qrcode`), payload
   `src/lib/ticketing/ticket-token.ts`, route `src/app/(public)/tickets/[orderNumber]/ticket/route.ts`,
   buyer button on the status page. *Proven:* confirmed order → PDF (`%PDF-`, >5 KB, 1 page, embedded
   `/Image` QR) whose payload verifies back to the order number; pending/rejected/expired → 409;
   wrong/missing capability token → 404/401. Tests: `tests/unit/ticket-token.test.ts` (7) +
   `tests/integration/ticket-artifact.integration.test.ts` (4). HMAC uses `AUTH_SECRET`, so rotating
   that secret invalidates paper tickets — treat it as a gate key.
3. ~~**Per-buyer cap**~~ ✅ **DONE** — `assertBuyerCap()` in `src/server/services/ticketing.service.ts`
   (`MAX_TICKETS_PER_BUYER_PER_CATEGORY = 10`), identity canonicalisation in
   `src/lib/ticketing/buyer-identity.ts`, `PURCHASE_LIMIT` → HTTP 409. *Proven:* 6+4 tickets pass,
   the 11th is refused with a readable message and reserves nothing (`sold` unchanged, no order row);
   the cap survives phone re-spelling (`+62…`, `62…`, `812…`, `0812…`) and email re-casing; pending
   holds count, rejected/expired orders do not; different category and different event each get their
   own budget. Tests: `tests/unit/buyer-identity.test.ts` (5) +
   `tests/integration/buyer-cap.integration.test.ts` (6). Live probe:
   `scripts/verify/probe-buyer-cap.mts`.
4. ~~**Onsite check-in**~~ ✅ **DONE** — `checkInTicket()` in `src/server/services/ticketing.service.ts`,
   page `src/app/admin/(dashboard)/ticketing/scan/page.tsx`, UI `src/components/admin/TicketScanner.tsx`,
   action `…/scan/actions.ts` (guarded by `ticketing.confirm`). *Proven:* signed QR → `CONFIRMED`→`USED`
   with `checkedInAt` + `checkedInById`, audit row `TICKET_CHECKED_IN` (method `QR`/`MANUAL`, seats);
   second scan → `ALREADY_USED` naming the first entry time, record unchanged; two simultaneous scans
   admit exactly one; forged signature and unknown order return the **same** message (no oracle);
   pending/rejected refused; `eventId` scope refuses another night's ticket by name; blank input
   rejected. The PDF stays downloadable after check-in (status page shows "Sudah masuk"). Manual
   order-number entry is the fallback when a camera fails and is audited as `method: "MANUAL"`.
   Tests: `tests/integration/check-in.integration.test.ts` (9). Live probe:
   `scripts/verify/checkin-e2e.cjs`. Migration `20261113120000_ticket_checkin`.
   *Operational note:* the USED status is part of revenue on the admin panel (`CONFIRMED + USED`), so
   the headline number does not drop when the doors open.

---

## 9. Troubleshooting

| Symptom | Cause |
|---|---|
| `403 Invalid request origin` on login/API | `APP_URL` mismatch (e.g. hit `127.0.0.1` while `APP_URL` is `localhost`) |
| `404` on every ticket status check | token/order number typo — or hashes mismatch because `AUTH_SECRET`/token handling changed |
| Seats "stuck" sold | a rejected order released nothing, or a pending hold is older than the expiry window while cron is not installed → run `npm run ticketing:expire-holds` (dry evidence: it prints `scanned/expired/seatsReleased`), then compare `TicketOrder` status vs `TicketType.sold` |
| React duplicate-key warning on admin ticketing | event list deduped by object identity instead of `id`; use `new Map([[id, event]])` |
| `react-hooks/set-state-in-effect` lint error | fetching in an effect; move the lookup to the server page |
| Public page renders two `<main>` landmarks | page wrapped in its own `<main>` inside the layout |
| "overlapping controls" from `layout.cjs` | `<Button>` nested inside `<Link>` — switch to `<Button asChild>` |
| Receipt shows only the code, no amount | receipt block lost its `#receipt-total` summary — restore it; the buyer must know the exact transfer sum |

---

## 10. Verification commands before you call anything done

```bash
npm run typecheck && npm run lint && npm run test:all && npm run build
```

Then, with the production build running (`npm run start -- -p 3015`), walk: purchase → receipt →
status deep link → admin confirm/reject → status flips → quota restored. A skipped, timed-out, or
unobserved test is **not** a pass.

### Automated browser probes (run against `npm run start`, not `dev`)

```bash
npm run verify:all                                  # typecheck + lint + vitest (no server needed)
npm run verify:e2e                                  # UI walk: select → pay → receipt → status → admin confirm
npm run verify:e2e:final                            # payment lifecycle: order → deep link → wrong token → admin reject → buyer view → quota
node scripts/verify/layout.cjs                      # layout/a11y gate: overflow, broken images, card heights, overlapping controls, <main>
node scripts/verify/shots.cjs                       # refresh /tmp/shots/*.png (desktop mobile admin status) for visual review
```

`verify:e2e` and `verify:e2e:final` need `DEMO_USER_PASSWORD` exported (seeded admin password from `.env`).

**Probes write real rows.** Each run leaves `TicketOrder` records (buyer "Budi Santoso" / "Rina Uji").
Clean them before demoing, otherwise the admin dashboard shows phantom revenue — use the guarded
script (refuses to run unless the DB is `tfn_local`):

```bash
bash scripts/verify/db-clean-orders.sh     # deletes orders/payments/order audits, zeroes TicketType.sold
bash scripts/verify/db-residue.sh          # tfn_test: proves integration tests cleaned up after themselves (expect 0/0/0/0)
bash scripts/verify/expiry-evidence.sh     # dev DB: status/adminNote/sold + TICKET_HOLD_EXPIRED audit for a probe order
bash scripts/verify/expiry-cleanup.sh      # dev DB: removes that probe order without touching capacity
```

## 11. Guardrails that lint/tests will not catch

| Rule | Why |
|---|---|
| Never write `<Link><Button>…</Button></Link>` | nests a `<button>` inside an `<a>`: two overlapping click targets, broken a11y tree. Use `<Button asChild variant=…><Link href=…>…</Link></Button>`. `scripts/verify/layout.cjs` fails on the overlap, lint does not. |
| A receipt must show the amount | the buyer has to transfer an exact sum; showing only the order code forced a manual lookup. Receipt fields: `#receipt-title`, `#receipt-total`, `#receipt-method`. |
| Render enums through `@/lib/ticketing/labels` | `BANK_TRANSFER` / `PROOF_SUBMITTED` are storage values, not UI copy. Use `methodLabel()` / `paymentStatusLabel()` in buyer **and** admin surfaces. |
| Never add a "no-op switch" to the expiry sweep | a `if (env === ...) return` shortcut left in production code silently stops seats from ever being released. Mutation-test locally instead: temporarily make the sweep return early, watch `hold-expiry` tests fail, revert. |

---

## 12. Hold expiry sweep (implemented)

`expireStaleHolds({ olderThanHours, now, limit, actorId }, db?)` releases seats from
`PENDING_CONFIRMATION` orders older than the window.

```bash
npm run ticketing:expire-holds
# [expire-holds] window=24h scanned=1 expired=1 skipped=0 seatsReleased=2 (146ms)
```

| Behaviour | Detail |
|---|---|
| Window | `TICKET_HOLD_EXPIRY_HOURS` (env, default **24**, min 1 / max 720) |
| Cutoff key | `TicketOrder.createdAt`, not `updatedAt` — proof upload must not extend the hold |
| Status flip | guarded `updateMany(status = PENDING_CONFIRMATION)` → `CANCELLED`; if an admin resolved it concurrently the sweep skips (never cancels a confirmed ticket) |
| Capacity | `updateMany(sold >= quantity)` decrement per item; a mismatch throws `CAPACITY_ERROR` (invariant breach, not silent drift) |
| Note | `adminNote` = `Kedaluwarsa otomatis setelah N jam tanpa konfirmasi` (buyer never sees it) |
| Audit | `TICKET_HOLD_EXPIRED`, `actorId = NULL` (system job), metadata `{ hours, orderNumber, seats }` |
| Batch | max 200 per run, oldest first; per-order transactions so one bad row cannot abort the batch |
| Cron | **hourly**, via `scripts/cron/expire-holds.sh` — `17 * * * *` (see §12.1) |

**Why `NODE_OPTIONS=--conditions=react-server` in the npm script:** the service imports the
`server-only` marker package, whose `exports` map only resolves to `empty.js` under the
`react-server` condition. Without it `tsx` throws
`Error: This module cannot be imported from a Client Component module`.

**Buyer-visible outcome:** the same token keeps working; `/tickets/status` shows `DIBATALKAN` +
"Pesanan dibatalkan dan kuota tiket dikembalikan." Seats reappear on `/tickets` immediately.

### 12.1 Scheduling it (cron — installed & proven)

Never put the raw `npm run` in crontab: cron gives you no PATH (so `npm` is "not found"), no
overlap protection (two slow sweeps can double-release seats), no log rotation, and no meaningful
exit code. `scripts/cron/expire-holds.sh` wraps it:

```bash
./scripts/cron/install.sh            # install, hourly at :17 (default)
./scripts/cron/install.sh print      # print the crontab line only (aaPanel: paste this)
./scripts/cron/install.sh status     # installed line + last 5 runs from the log
./scripts/cron/install.sh uninstall  # remove only the managed line
TFN_CRON_SCHEDULE="*/10 * * * *" ./scripts/cron/install.sh   # different cadence
```

| Guard | Behaviour |
|---|---|
| PATH | exports `/usr/local/bin:/usr/bin:/bin…`, then falls back to `~/.nvm/versions/node/*/bin` |
| Prereq | fails fast if `node_modules/.bin/tsx` is missing (prod install must not `--omit=dev`; **`tsx` is a real dependency**, so `npm ci --only=production` is fine) |
| Overlap | `flock -n` on `storage/expire-holds.lock`; a second concurrent run logs `skipped: a previous sweep still holds the lock` and exits **0** |
| Log | append-only `storage/logs/expire-holds.log`, self-rotating past 2 MB (keep last 400 lines) |
| Stdout | silent when nothing expired; prints the summary **only** when seats were released or something broke — so an empty cron mail means "nothing happened" |
| Exit | `0` ok/skipped · `1` sweep failed · `3` ran but output had no `expired=` summary |

**Cadence is hourly, not daily.** The window is 24h, so a daily 03:17 run leaves seats locked for
up to 48h — for a ticket launch that is the difference between a sold-out screen and an inventory.
Hourly keeps the worst-case delay at 25h, and an idle run costs ~100 ms.

**Verified on a live cron daemon (not simulated):** `* * * * *` installed, daemon fired at
`11:54:02` and `11:55:02`, log lines `exit=0 elapsed=1s node=/usr/bin/node` — i.e. cron's own
minimal environment resolved `node` through the wrapper. End-to-end sweep evidence in the same
session: a 48h-old `PENDING_CONFIRMATION` order was backdated, then
`scanned=1 expired=1 seatsReleased=2`, row → `CANCELLED`, `TicketType.sold` 2 → 0, audit
`TICKET_HOLD_EXPIRED` with `actorId=NULL` and `{hours:24, orderNumber, seats:2}`, and a second run
`scanned=0` (idempotent).

---

## 13. Official event / government support block (implemented)

Audiences need to know the event is real and sanctioned before they transfer money. Two surfaces
carry that proof:

| Surface | Placement | Variant |
|---|---|---|
| `/` (landing) | directly under the TFN identity ribbon, before any content sections | `variant="home"` |
| `/tickets` | directly under the hero, **above** the purchase panel | default (compact) |

One component, `src/components/landing/OfficialSupport.tsx`. `variant="home"` adds the red marquee
strip (`.tfn-ticker`, defined in `globals.css`), an oversized `TEMANGGUNG` outline watermark,
a 48px headline, and the "official facts" ledger. The compact variant stays quiet directly above
the purchase panel so it never competes with the buy button. Copy is bilingual (ID/EN) via
`useLanguage`, matching the rest of the landing components.

### Single source of truth

`src/lib/site/partners.ts` is the only place a partner exists. Nothing renders unless it is listed
there — the repo rule "no unverified sponsor claims" is enforced structurally rather than by
reviewer memory.

```ts
GOVERNMENT_SUPPORTERS: Partner[]   // e.g. Pemerintah Kabupaten Temanggung (tier SUPPORTED_BY)
PARTNERS: Partner[]               // PRESENTED_BY | OFFICIAL_PARTNER | MEDIA_PARTNER
```

| Field | Purpose |
|---|---|
| `name` / `shortName` | Official name shown to the audience; `shortName` is the monogram fallback |
| `tier` / `kind` | Which row it lands in; `government` gets the red seal treatment |
| `logo` | Optional `/images/partners/<file>`; without it the tile shows a **text monogram, never an invented crest** |
| `note` | One-line description of the relationship, per language |
| `href` | Optional outbound link — only add a URL verified as official |

### Behaviour

- Empty tiers render **nothing** (no placeholder logos), and the whole section returns `null` if the
  registry were ever emptied, so the layout cannot break.
- With no commercial partners yet, a dashed note reads "Slot partner dan media partner masih dalam
  proses. Hanya mitra yang sudah terkonfirmasi ditampilkan di halaman ini." — honest, and it doubles
  as a sponsorship prompt.
- The government card carries a rotated `RESMI` stamp, red corner brackets, a double-ring seal, and
  sits above the partner tiers so it reads first.
- Three trust tiles (jalur resmi · tanpa perantara · sanksi daerah) answer the buyer's real question:
  *is this the official channel?*
- The marquee is `aria-hidden` (decoration) — the `<h2>` carries the same claim for screen readers,
  so it is not read four times — and it stops under `prefers-reduced-motion: reduce`.
- The ledger (home only) prints four checkable facts: penyelenggara, dukungan, jalur tiket,
  verifikasi. Every value comes from the registry or the manual-verification process, never invented.
- Layout probe: `node scripts/verify/official-support.cjs` (needs `npm run start -p 3015`; falls back
  to system Chrome). It asserts no horizontal overflow at 390/834/1440 px, uniform trust-tile heights,
  and clips one screenshot per breakpoint.

### Adding a real logo

1. Drop the file in `public/images/partners/` (PNG transparent ≥400px, or SVG).
2. Set `logo: "/images/partners/<file>"` on the matching entry in `partners.ts`.
3. Record the permission/date in `note` — that line is the audit trail for the claim.

Docs cross-reference: `docs/ASSUMPTIONS.md` §"Klaim resmi & sponsor" states the same rules in
Indonesian for the organiser.


