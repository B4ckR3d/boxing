# Changelog

All notable changes to the Boxing Championship Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

