# Changelog

All notable changes to the Boxing Championship Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.8.0] - 2026-11-13

### Changed — Official-event block redesigned, richer on the landing page
- **`variant` prop** on `OfficialSupport` (`"home"` | default compact). The landing page now gets
  a marquee strip, an oversized outlined `TEMANGGUNG` watermark, a 48 px headline, and a four-row
  "official facts" ledger (penyelenggara · dukungan · jalur tiket · verifikasi). `/tickets` keeps
  the quiet compact form directly above the purchase panel.
- Supporter card rebuilt as a seal plaque: double-ring monogram seal, red corner brackets, rotated
  `RESMI` stamp, tier label, and an outbound link only when a verified URL exists.
- Trust points became numbered cells (`01`–`03`) in a bordered grid with `hover-lift`, so the three
  answers to *"is this the official channel?"* read as one block instead of loose bullets.
- Marquee animation lives in `globals.css` (`.tfn-ticker` + `@keyframes tfn-ticker`, seamless
  two-half loop) and stops under `prefers-reduced-motion`. The strip is `aria-hidden` — the `<h2>`
  carries the claim once for assistive tech.
- New probe `scripts/verify/official-support.cjs`: asserts no horizontal overflow at 390/834/1440 px,
  uniform trust-tile heights, animated marquee, stable ledger rows, and clips a screenshot per
  breakpoint (falls back to `/usr/bin/google-chrome` when Playwright's bundled shell is absent).

---

## [1.7.1] - 2026-11-13

### Added — Official-event & government-support block
- **`src/lib/site/partners.ts`** — partner registry as the single source of truth. Only entries
  listed here can render; the government supporter is `Pemerintah Kabupaten Temanggung`
  (`tier: SUPPORTED_BY`, `kind: GOVERNMENT`).
- **`src/components/landing/OfficialSupport.tsx`** — bilingual (ID/EN) trust section: eyebrow
  badge, headline, three provenance points (official channel / no middlemen / held with the
  regency), a spotted-monogram supporter card with a rotated “Resmi” stamp, and tier groups
  (presented by · official partner · media partner) that self-hide when empty.
- Landed on **`/tickets`** (directly above the purchase panel) and **`/** (after the identity ribbon) —
  the two screens where a buyer decides.
- Missing logos fall back to a monogram tile, so the block never ships a broken image;
  `public/images/partners/` takes the real files.

---

## [1.7.0] - 2026-11-13

### Added — Seat-hold expiry is now actually scheduled
- **`scripts/cron/expire-holds.sh`** — cron entry point wrapping `npm run ticketing:expire-holds`.
  Until now the sweep existed but nothing ran it, so every unverified transfer held seats forever.
  Four things a bare crontab line cannot give you: a usable `PATH` (cron has no `npm`), `flock`
  single-instance protection (two overlapping sweeps can double-release capacity), an append-only,
  self-rotating log at `storage/logs/expire-holds.log`, and honest exit codes (`0` ok/skipped ·
  `1` failed · `3` ran but emitted no `expired=` summary).
- **`scripts/cron/install.sh`** — `install | print | status | uninstall`, idempotent via a
  `# TFN-EXPIRE-HOLDS` tag, so repeat installs never duplicate the job and `uninstall` removes only
  the managed line. `print` emits the exact crontab line for aaPanel's Cron UI.
- **Default cadence is hourly (`17 * * * *`), not daily.** With a 24h window, a daily 03:17 run
  leaves seats locked for up to 48h — on a ticket launch that is lost inventory. An idle run costs
  ~100 ms.
- **Silent-when-nothing stdout contract**: nothing released → no output; seats released or a failure
  → the summary is printed, so cron mail means something happened.
- `scripts/verify/db-sql.sh` — one-statement SQL helper for dev/test DBs, guarded by expected
  database name so it can never point at production.

### Changed
- `docs/DEPLOYMENT.md` gained §3.1 "Scheduled jobs (required)" with the aaPanel steps and the
  operational checks; its `npm ci --only=production` line is corrected to `npm ci` (the Next build
  needs devDeps).
- `scripts/expire-holds.ts` docstring now points at the wrapper instead of a raw cron line.

### Verified
- Live cron daemon, `* * * * *`: fired at 11:54:02 and 11:55:02, log `exit=0 elapsed=1s
  node=/usr/bin/node` — cron's own minimal environment resolved node through the wrapper.
- Sweep end-to-end: a 48h-old `PENDING_CONFIRMATION` order → `scanned=1 expired=1 seatsReleased=2`,
  row `CANCELLED`, `TicketType.sold` 2 → 0, audit `TICKET_HOLD_EXPIRED` with `actorId=NULL` and
  `{hours:24, orderNumber, seats:2}`; immediate rerun `scanned=0` (idempotent).
- Guards: `flock` overlap → `skipped…` exit 0; missing `node_modules/.bin/tsx` → exit 1 with a
  readable message; `install.sh` twice → exactly one crontab line; `uninstall` → zero entries.

---

## [1.6.0] - 2026-11-13

### Added — Onsite gate check-in (ticket scanner)
- **`checkInTicket()`** (`src/server/services/ticketing.service.ts`) validates a scanned ticket and
  consumes it (`CONFIRMED` → `USED`). The QR payload is verified **offline** with
  `verifyTicketPayload()` before any database call, so a forged QR never touches the orders table.
- **Idempotency is enforced by the database**: the flip is a guarded `updateMany` on
  `status = CONFIRMED`, so two operators scanning the same ticket at the same second produce exactly
  one admission and one `ALREADY_USED` — never two entries.
- **Refusals carry the sentence the usher needs**: `ALREADY_USED` names the time of the first entry,
  `NOT_CONFIRMED` says payment is unresolved, `WRONG_EVENT` names the event the ticket belongs to.
  A forged signature and an unknown order number return the *same* generic message, so the scanner
  is not an oracle for guessing valid order numbers.
- **Manual fallback**: typing a bare order number works when a camera fails, and is audited with
  `method: "MANUAL"` / `signatureVerified: false` so a supervisor can review manual admissions.
- **Audit**: every admission writes `TICKET_CHECKED_IN` with the operator id, seat count, event and
  method. New columns `checkedInAt` / `checkedInById` plus relation `TicketOrderScanner`
  (migration `20261113120000_ticket_checkin`).
- **Admin UI**: `/admin/ticketing/scan` — big code field, optional camera QR (BarcodeDetector, no new
  dependency), event scope selector, green "Silakan masuk" / red "Jangan izinkan masuk" banners, and
  a session log of the last 8 scans so an usher can see the last few people they admitted.
  Entry point: "Scan check-in" button on `/admin/ticketing`.
- **Admin panel**: new `Sudah masuk` filter and stat, plus a check-in line (time + operator) on each
  used order. Confirmed revenue now counts `CONFIRMED + USED`.
- **Buyer view**: status page shows "Sudah masuk" and still serves the PDF (re-downloading cannot
  admit anyone twice — admission is driven by the database, not the PDF).

### Tests
- `tests/integration/check-in.integration.test.ts` (9) — admission + audit, double scan, concurrent
  scan race, forged vs unknown (identical message), pending, rejected, wrong event, manual fallback.
  Total suite: **94 tests / 19 files**.

### Verification
- Gates: `tsc --noEmit` clean, `eslint .` 0 findings, `npm run build` succeeds (`/admin/ticketing/scan`
  in the route table).
- Live probe against the production build (`node scripts/verify/checkin-e2e.cjs`): buy → admin confirm
  → scan signed QR **ADMITTED** → re-scan **REFUSED** `ALREADY_USED` with the first entry time →
  forged QR **REFUSED** with the generic message → `?status=used` shows the order → buyer status page
  reads "SUDAH MASUK" and the PDF still returns `200 application/pdf`. Zero JS errors.

---

## [1.5.0] - 2026-11-13

### Added — Per-buyer, per-category purchase cap (anti-scalping)
- **`assertBuyerCap()`** (`src/server/services/ticketing.service.ts`) runs inside
  `createGuestOrder`'s transaction and refuses any request that would push a single buyer above
  `MAX_TICKETS_PER_BUYER_PER_CATEGORY = 10` tickets in one category of one event. Error code
  `PURCHASE_LIMIT` → **HTTP 409** with a buyer-readable sentence naming the category and the
  number already purchased. Nothing is reserved on refusal (`sold` and the order table untouched).
- **`src/lib/ticketing/buyer-identity.ts`** — guest orders have no account, so identity is derived
  from the typed contact details: email is case-folded, phone is canonicalised to `08…`
  (`+62 812-3456-7890`, `812 3456 7890`, `628123456789` and `081234567890` are one buyer). Values
  too short to be a phone never match, so a junk entry can't swallow the next buyer.
- Counted statuses are the ones still holding seats: `PENDING_CONFIRMATION` and `CONFIRMED`.
  `REJECTED` and auto-expired `CANCELLED` orders release the budget — a rejected buyer may retry.

### Tests
- `tests/unit/buyer-identity.test.ts` (5) — phone/email canonicalisation, junk and short values.
- `tests/integration/buyer-cap.integration.test.ts` (6) — exact boundary at 10, readable message,
  phone/email re-spelling bypass blocked, holdings counted, rejected + expired freed, category and
  event isolation. Total suite: **85 tests / 18 files**.

### Verification
- Live probe against the production build (`node scripts/verify/probe-buyer-cap.mts`): buy 6 → 201,
  buy 4 with re-cased email → 201, buy 1 with `+62` phone → **409** `PURCHASE_LIMIT`, DB shows
  `sold=10` and 2 orders.

### Known limitation
- The check is read-then-write inside the order transaction, so two truly simultaneous requests from
  the same buyer can both pass; manual admin confirmation still allows rejecting the duplicate.
  Documented in `docs/API.md`.

---

## [1.4.0] - 2026-11-13

### Added — Ticket artifact (PDF + signed QR)
- **`getTicketArtifact(orderNumber, capabilityToken)`** (`src/server/services/ticketing.service.ts`) renders
  the entry ticket for **confirmed** orders only; pending/rejected/expired orders raise
  `INVALID_STATE`, and a wrong or missing token is indistinguishable from an unknown order
  (`NOT_FOUND` → 404, no enumeration).
- **`buildTicketPdf()`** (`src/server/services/ticket-pdf.service.ts`) draws a one-page A4 ticket with
  `pdf-lib` + `qrcode` — dark header (event, date in `Asia/Jakarta`, venue), QR card, order/buyer block,
  line items, total, legality note, and issuance stamp. Text is WinAnsi-sanitised so an emoji or
  non-Latin buyer name can never crash issuance.
- **Signed QR payload** (`src/lib/ticketing/ticket-token.ts`): `TFN1.<orderNumber>.<HMAC-SHA256(AUTH_SECRET)[:12]>`,
  verified with `verifyTicketPayload()` using `timingSafeEqual`. Swapping the order number or the
  signature fails verification, so a screenshot of someone else's ticket can't be re-pointed at another
  order. Deterministic per order — repeat downloads are byte-identical.
- **Guest download route** `GET /tickets/[orderNumber]/ticket?token=…` streams `application/pdf` with
  `Content-Disposition: attachment` and `Cache-Control: private, no-store`; 401 without a token, 404
  wrong token, 409 unconfirmed.
- **Buyer UI:** the status page now shows a crimson **"Unduh tiket (PDF)"** button beside
  "Pesan tiket lagi" once the order is `CONFIRMED`.
- **Tests:** `tests/unit/ticket-token.test.ts` (7 — tamper/foreign-secret/junk handling) and
  `tests/integration/ticket-artifact.integration.test.ts` (4 — real PDF bytes, embedded `/Image` QR,
  payload→order verification, pending/rejected/expired, token oracle, determinism).

### Added — Unpaid hold expiry
- **`expireStaleHolds()`** cancels `PENDING_CONFIRMATION` orders older than 24 h (batched at 200),
  releases the held quota, writes a `TICKET_HOLD_EXPIRED` audit row per order, and is idempotent.
  CLI: `npm run ticketing:expire-holds`. Confirm/reject on an expired order now fails cleanly instead of
  confirming a dead hold.

### Changed
- New runtime dependencies: `pdf-lib`, `qrcode` (+ `@types/qrcode` dev). Both are pure JS — no system
  fonts, no headless Chrome, no native build step on the VPS.
- Docs: `API.md` documents the ticket route + payload format, `CONTINUATION.md` marks the artifact as done
  and warns that the HMAC key is `AUTH_SECRET` (rotating it invalidates already-issued paper tickets).

---

## [1.3.0] - 2026-11-13

### Added — Ticketing (guest order + manual admin verification)
- **Public purchase page `/tickets`:** hero → 3-step explainer → per-event panel with category cards
  (`aria-pressed`), quantity stepper, live total, and a receipt screen carrying the order number plus
  the one-time capability token.
- **Buyer self-service `/tickets/status`:** order number + token lookup, or a deep link from the
  receipt. The deep link is resolved server-side, so the receipt renders on first paint (no
  `setState`-in-effect).
- **Admin ticketing panel `/admin/ticketing`:** summary stats, quota progress bars, `?status=`
  filters, and confirm/reject with toasts. Rejection requires a reason and releases capacity.
- **`TicketOrderActions` client component:** server actions return `ActionResult`; the UI now reads
  `result.ok` instead of silently discarding failures.
- **Docs:** `docs/CONTINUATION.md` handover guide, plus ticketing sections in `ARCHITECTURE.md`,
  `API.md`, `DATABASE.md`, and Phase 7 evidence in `IMPLEMENTATION_CHECKLIST.md`.

### Fixed
- **Validation messages leaked the Zod schema** (`too_big`, `path`, `maximum`). Zod issues are now
  mapped per field to human Indonesian sentences, and malformed JSON returns
  `400 Format permintaan tidak valid.` instead of an unexplained 400.
- **Nested `<main>` landmark** on `/tickets` (the public layout already renders one) — duplicate
  landmark removed; asserted `main` count = 1.
- **Duplicate React key** in the admin event `<select>` caused by `new Set()` deduping object
  identity instead of `id`.
- `getGuestOrder` now returns `payment.method` so the buyer status page can show how they paid.

---

## [1.2.0] - 2026-11-04

### Added & Rebranded (TFN Temanggung Fight Night & Dual Mode i18n)
- **Hero Section 5 Fighter Slider Visual Showcase:**
  - Menghasilkan dan mengintegrasikan 5 foto petarung berkualitas tinggi ke dalam Hero Slider:
    1. **Marcus 'Iron' Vale** (`hero_fighter_1_marcus.jpg`): Juara bertahan kelas berat dengan hoodie pertarungan terbuka memperlihatkan fisik atletis, sarung tinju dengan wrap hitam/merah, dan tatapan intimidatif.
    2. **Dario 'The Storm' Rossi** (`hero_fighter_2_dario.jpg`): Petarung kekar bertato dengan kepala plontos dan janggut, kuda-kuda bertahan dengan wrap merah, serta pencahayaan dramatis duel split biru/merah.
    3. **Kenji Arata** (`hero_fighter_3_kenji.jpg`): Striker Asia atletis dalam pose striking dinamis dengan balutan perban hitam di tangan dan atmosfer arena berkabut.
    4. **Tomas 'El Toro' Reyes** (`hero_fighter_4_tomas.jpg`): Kontender petarung bertubuh kekar dalam pose siap tempur dengan keringat mengkilap di bawah lampu sorot arena.
    5. **Sabuk Emas 24K Mahkota Juara** (`hero_fighter_5_champion.jpg`): Mahkota kejuaraan dunia resmi berlapis emas 24 karat di atas panggung kehormatan.
  - Memperbarui komponen `HeroSlider.tsx`: Foto petarung kini tampil menonjol di sisi kanan layar (tinggi mencapai 94% viewport slider) dengan efek bayangan glow merah/emas (`drop-shadow-[0_20px_50px_rgba(229,9,20,0.45)]`) dan gradasi memudar lembut ke latar belakang.
  - Menambahkan thumbnail carousel interaktif untuk kelima petarung di pojok kiri bawah dengan penanda aktif border merah `#E50914`, indikator slide counter (`01 / 05`), dan tombol navigasi panah kotak putih.
- **Overhaul Total Sabuk Kejuaraan TFN (3D Emas Asli & Foto Studio 8K):**
  - Membuat foto studio ultra-realistis 8K untuk **TFN World Heavyweight Championship Belt** (`tfn-world-heavyweight-belt.jpg`) dan **TFN World Welterweight Championship Belt** (`tfn-world-welterweight-belt.jpg`) dengan pelat emas 24K, ukiran filigree, permata ruby, dan strap kulit hitam mewah di atas podium beludru.
  - Memperbarui model 3D di `src/components/belts/BeltCanvas.tsx`: menggantikan balok primitif merah dengan model 3D sabuk emas asli berlapis emas 24K murni (`#F5C542`), cincin filigree, mahkota crest TFN, batu permata ruby merah tua & zamrud hijau faset, deretan paku keling emas, strap kulit melengkung, serta partikel kilau emas (*golden embers*).
  - Menambahkan switcher mode interaktif di `src/components/belts/Belt3DViewer.tsx`: tombol toggle 1-klik antara **FOTO STUDIO 8K** (dengan zoom dan hotspot inspeksi) dan **3D INTERAKTIF** (dengan kontrol putar 360° dan tombol Jeda/Putar).
  - Memperbaiki seluruh teks dan wording: menghapus referensi WBC-X menjadi Regulasi Resmi TFN (Temanggung Fight Night) dengan Bahasa Indonesia utama.
  - Mengubah seluruh identitas platform menjadi **TFN (Temanggung Fight Night)** di navbar, footer, metadata HTML, hero banner, jadwal event (*Gedung Pemuda Temanggung*, *Stadion Bhumi Phala*), sabuk kejuaraan dunia, dan portal CMS.
- **Dukungan Dwibahasa (Bahasa Indonesia Utama & Bahasa Inggris Kedua):**
  - Arsitektur i18n baru di `src/lib/i18n/LanguageContext.tsx` dan `src/lib/i18n/translations.ts` dengan kamus lengkap untuk seluruh komponen, navbar, hero, tabel peringkat, bracket Grand Prix, jadwal event, dan login CMS.
  - Komponen `LanguageSwitcher` (`ID` | `EN`) di top-bar navbar dan portal admin login dengan persistensi `localStorage`.
- **Sistem Tema Dark Mode & Light Mode:**
  - `src/lib/theme/ThemeContext.tsx` dengan hook `useTheme()` dan tombol `ThemeToggle` (ikon Sun/Moon).
  - Skrip inisialisasi inline di `src/app/layout.tsx` untuk mencegah kedipan visual (*zero FOUT*).
  - Styling dual mode di `src/styles/globals.css`: Dark mode bernuansa near-black `#0B0B0D` cinematic, Light mode bernuansa bersih `#F4F5F8` dengan kartu putih murni `#FFFFFF` dan aksen merah `#E50914` kontras tinggi.
- **Halaman Berita Resmi / News Page (`src/app/(public)/news/page.tsx`):**
  - Mengimplementasikan rute `/news` yang sesuai presisi dengan Reference Image 5: Grid 3-kolom kartu berita dengan badge merah tanggal di sudut kiri atas (`24 DES` / `24 DEC`), tipografi tebal Oswald, dan link panah merah `→ SELENGKAPNYA / → MORE`.
- **Pembaruan Halaman Direktori Petarung & Profil (`src/app/(public)/fighters`):**
  - Grid 4-kolom atlet bertema FNT dengan icon media sosial, status juara, filter divisi, serta kartu Tale-of-the-Tape multibahasa.
- **Verifikasi Penuh Admin CMS Login:**
  - Login panel admin di `/admin/login` berfungsi normal dengan prefix session development `bx_session` yang kompatibel dengan cookie localhost HTTP.
  - Tombol 1-klik akun demo (`superadmin@boxing.local` / `Demo-Ringside-2026!`).
  - Hak akses RBAC dan dashboard metriks `/admin` terverifikasi 100%.

---

## [1.1.0] - 2026-11-04

### Added & Restyled (Combat Sports / FNT Visual Identity Overhaul)
- **Visual Design & Typography System (`src/styles/globals.css`):**
  - Integrated Google Font **Oswald** (500, 600, 700, 800) for heavy, condensed, high-impact fight promotion headlines, paired with **Inter** for crisp body text.
  - Implemented the vivid Combat Sports palette: Fight Red (`#E50914`), deep coal black (`#0B0B0D`), high-contrast pure white, and subtle subtext gray (`#8E8E99`).
  - Added angular geometric badges (`clip-slanted-r`, `clip-slanted-l`, `clip-badge-angled`) and athletic offset shadows (`shadow-fight-red`).
  - Updated Content Security Policy in `src/proxy.ts` to authorize Google Fonts stylesheets and font binaries.

- **Public Navigation & Top Ticker (`src/components/layout/Navbar.tsx`):**
  - Added the Top Live Notification Bar with animated broadcasting `LIVE` pill ticker and social media links (`FOLLOW US: f, 𝕏, o, ▶`).
  - Designed the crisp white athletic header bar featuring bold slanted `FNT·X` logo, uppercase bold navigation links, search drawer modal, and solid red `BUY TICKET` CTA button.
  - Fully responsive mobile drawer matching the red/dark combat aesthetic.

- **Cinematic Hero Slider (`src/components/landing/HeroSlider.tsx`):**
  - Restyled to match Reference Image 2: Square red date badge (`DECEMBER 24, 2026`), condensed display headline (`ONE-SPORT SUPERSTARS WHO SHINED IN 2026`), solid red action buttons.
  - Implemented carousel thumbnail preview cards on the bottom-left with active red highlight border and quick jump.
  - Added clean white square arrow navigation buttons (`←` / `→`) on the bottom-right.

- **Sponsor Ribbon & Fight Highlights (`src/components/landing/SponsorRibbon.tsx`, `FightHighlights.tsx`):**
  - Sleek horizontal monochromatic combat insignia ribbon (`FIGHTING CLUB`, `GLOVE LEAGUE`, `TITAN COMBAT`, `APEX STRIKE`).
  - 3-column news/highlight cards with red `HIGHLIGHTS` tag, bold titles, descriptions, and action photo.

- **Head-to-Head VS Matchup Showcase & Fight Night Countdown (`src/components/landing/MatchupShowcase.tsx`):**
  - Created 2-column matchup cards (`MARCUS VALE VS TOMAS REYES`, `DARIO STORM VS KENJI ARATA`) with circular fighter portraits, central red "VS" circle, date/venue, and dual `DETAIL` + `TICKETS` action buttons (Reference Image 3).
  - Integrated the live Fight Night countdown banner with real-time countdown timer (`DAYS`, `HOURS`, `MINS`, `SECS`).

- **Official Ranking Table Overhaul (`src/components/rankings/RankingPreview.tsx`, `src/app/(public)/rankings/page.tsx`):**
  - Implemented the signature table layout from Reference Image 4: Dark arena hero banner with breadcrumbs `HOME / RANKING TABLE`.
  - Centered division header (`FEATHERWEIGHT` / `HEAVYWEIGHT`).
  - Pure black table header with **solid red background pill on the `WINS` column header (`bg-[#E50914] text-white font-black`)**.
  - Clean alternating zebra rows, fighter records, points, and footnote (* Fighters who participated in the last 10 tournaments).

- **Fighter Roster & Profile Pages (`src/components/fighters/FeaturedFighters.tsx`, `src/app/(public)/fighters/page.tsx`, `[slug]/page.tsx`):**
  - 4-column athletic card grid with fighter portrait against dark arena ring, bottom info bar, social icons row (`f`, WhatsApp, `𝕏`, Instagram), and `→ VIEW PROFILE` red link (Reference Image 1).
  - Tale-of-the-tape stat cards for individual fighter profile pages.

- **Event Schedule & Fight Cards (`src/app/(public)/events/page.tsx`):**
  - 3x2 grid of event cards matching Reference Image 5 with square red date badge (`24 DEC`) pinned on the top-left of each fight action image, bold headline, and `→ MORE DETAILS` link.

- **Admin CMS Dashboard & Authentication Fixes:**
  - Resolved cookie prefix restriction (`__Host-` requiring HTTPS) by allowing `bx_session` in development so `http://localhost:3000/admin/login` works seamlessly in all browsers.
  - Restyled `/admin/login` with `FNT·X CMS` branding, one-click demo credentials (`superadmin@boxing.local` / `Demo-Ringside-2026!`), and error toast alerts.
  - Verified live login: Returns HTTP 200, sets `HttpOnly` cookie, and opens `/admin` control room successfully.
  - Restyled all admin dashboard pages (`/admin`, `/admin/fighters`, `/admin/rankings`, `/admin/belts`, `/admin/audit-logs`) with modern athletic dark CMS layout.

---

## [1.0.0] - 2026-11-04

### Added
- **Visual Assets (Gemini AI Image Generation):**
  - Generated and integrated 6 high-resolution cinematic sports imagery:
    - `public/images/fighters/marcus-vale.jpg` (Heavyweight Champion Marcus "Iron" Vale studio portrait).
    - `public/images/fighters/dario-storm.jpg` (#1 Contender Dario Storm dramatic portrait).
    - `public/images/fighters/kenji-arata.jpg` (Kenji Arata southpaw technician portrait).
    - `public/images/fighters/tomas-reyes.jpg` (Tomas Reyes inside brawler portrait).
    - `public/images/belts/world-heavyweight-belt.jpg` (WBC-X World Heavyweight Championship 2D studio display & fallback).
    - `public/images/hero/boxing-ring-arena.jpg` (Cinematic empty arena boxing ring hero background).
  - Integrated images seamlessly into `HeroSlider`, `FeaturedFighters`, `FighterProfilePage`, `FightersPage`, and `Belt2DFallback`.
- **Documentation:**
  - Added [`docs/ADMIN_LOGIN_GUIDE.md`](docs/ADMIN_LOGIN_GUIDE.md) explaining login panel architecture, one-click demo credentials, session flow, and security mechanisms.
- **Core Architecture & Schema:**
  - Complete 30-model Prisma schema (`prisma/schema.prisma`) targeting MySQL 8.4 via `@prisma/adapter-mariadb`.
  - Initial database migration `20261103235119_init_championship_schema`.
  - Comprehensive seed script (`prisma/seed.ts`) loading permissions, roles, weight classes, belts, fighters, rankings, tournaments, events, and hero slides.
- **Security & RBAC:**
  - Opaque session management in `HttpOnly`, `Secure`, `SameSite=Lax` cookies with SHA-256 database hashing.
  - Argon2id password hashing and dummy timing equalization against enumeration attacks.
  - RFC 6238 TOTP engine with base32 symmetric encoding and clock drift tolerance.
  - 8 standard roles and 21 granular permissions cataloged in `src/lib/permissions/catalog.ts`.
  - Server-side authorization guards with Four-Eyes separation of duties (`src/lib/permissions/guard.ts`).
  - Sliding-window rate limiting on login, IP, and mutation endpoints (`src/lib/security/rate-limit.ts`).
  - Double-submit and signed HMAC CSRF token verification (`src/lib/security/csrf.ts`).
  - Automatic recursive redaction of sensitive credentials in audit logs (`src/lib/security/redact.ts`).
  - Next.js 16 Proxy layer with dynamic CSP nonce generation and enterprise security headers (`src/proxy.ts`).
- **Cinematic Brutalism Public Platform:**
  - Modern, responsive landing page (`src/app/(public)/page.tsx`) with high-contrast brutalist aesthetic.
  - Interactive Hero Slider (`src/components/landing/HeroSlider.tsx`) with autoplay, swipe, keyboard controls, and scheduling.
  - Procedural 3D Championship Belt (`src/components/belts/BeltCanvas.tsx`, `Belt3DViewer.tsx`) rendered with Three.js/R3F + 2D fallback.
  - Official Divisional & Pound-for-Pound Rankings (`src/app/(public)/rankings/page.tsx`, `RankingPreview.tsx`).
  - Grand Prix Tournament Bracket Viewer (`src/app/(public)/grand-prix/page.tsx`, `GrandPrixPreview.tsx`).
  - Fighter Directory & Detailed Athlete Profiles (`src/app/(public)/fighters/page.tsx`, `[slug]/page.tsx`).
  - Verified Fight History (`src/app/(public)/fights/page.tsx`).
  - Fight Night Schedule & Event Cards (`src/app/(public)/events/page.tsx`).
  - Navigation Drawer & Sponsor Marquee Footer (`src/components/layout/Navbar.tsx`, `Footer.tsx`).
- **Admin Command Portal:**
  - Secure login page (`src/app/admin/login/page.tsx`) with error handling and one-click demo logins.
  - Dashboard overview (`src/app/admin/(dashboard)/page.tsx`) with live MySQL metrics and recent audit log entries.
  - Fighter roster management (`src/app/admin/(dashboard)/fighters/page.tsx`).
  - Ranking versioning and staging portal (`src/app/admin/(dashboard)/rankings/page.tsx`).
  - Championship belt holder lineage manager (`src/app/admin/(dashboard)/belts/page.tsx`).
  - Grand Prix tournament bracket advancement (`src/app/admin/(dashboard)/grand-prix/page.tsx`).
  - Audit log ledger viewer (`src/app/admin/(dashboard)/audit-logs/page.tsx`).
- **Testing & Documentation:**
  - Unit tests for TOTP, input sanitization, and RBAC guards (17 passing tests in Vitest).
  - Complete architecture, database ERD, RBAC matrix, API docs, deployment guide, and backup guide in `docs/`.

