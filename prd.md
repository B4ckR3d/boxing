# PRD — BOXING CHAMPIONSHIP PLATFORM

> **Status dokumen:** v1.0 — Source of truth untuk seluruh pengembangan.
> **Dibuat:** 2026-11-04
> **Aturan wajib:** Dokumen ini harus selalu diingat dan dipatuhi. Setiap perubahan/update pada project WAJIB didokumentasikan di file `.md` terkait (lihat bagian [0. Documentation Rules](#0-documentation-rules)).

---

## 0. DOCUMENTATION RULES

1. `prd.md` adalah sumber kebenaran (source of truth) untuk requirement. Jangan dilanggar tanpa persetujuan.
2. Selalu buat dokumentasi `.md` untuk setiap modul/fitur/keputusan arsitektur.
3. Setiap update kode → update juga dokumen `.md` terkait (README, API docs, CHANGELOG, dsb).
4. Setiap asumsi bisnis yang belum ditentukan → pilih default aman dan catat di `docs/ASSUMPTIONS.md`.
5. Setiap perubahan dicatat di `CHANGELOG.md`.

---

## ROLE

Bertindak sebagai Senior Full-Stack Engineer, UI/UX Designer, 3D Web Designer, Security Engineer, dan Software Architect.

Bangun website Boxing Championship profesional, modern, premium, cinematic, responsive, dan production-ready. Website terdiri dari:

1. Public Landing Page.
2. Boxing Ranking System.
3. Grand Prix Management.
4. Rotating Championship Belt Management.
5. Fighter Database & Fighter Profiles.
6. Fighter Fight History.
7. Admin Dashboard untuk mengelola seluruh website dan konten.
8. Authentication, RBAC, Audit Log, dan Security System.

Jangan hanya membuat mockup. Implementasikan aplikasi dengan database nyata, API, autentikasi, validasi, serta CRUD yang berfungsi.

---

## 1. TECHNOLOGY STACK

**Frontend:**
- Next.js App Router
- TypeScript
- Tailwind CSS
- Framer Motion / Motion untuk UI animation
- GSAP + ScrollTrigger jika memang diperlukan
- Three.js / React Three Fiber untuk elemen 3D
- Lucide React untuk icons
- Gunakan Server Components secara default
- Client Components hanya untuk interaksi yang diperlukan

**Backend:**
- Next.js Route Handlers untuk REST API
- Server-side business logic
- Prisma ORM
- MySQL sebagai database utama

**Authentication:**
- Auth.js atau solusi authentication yang kompatibel dengan Next.js
- Session berbasis cookie HttpOnly, Secure di production, SameSite yang tepat
- Email/password authentication
- Password hashing menggunakan Argon2id atau implementasi aman setara

**Additional:**
- Zod untuk validasi request
- Rate limiting
- Image storage menggunakan S3-compatible object storage atau provider yang dapat dikonfigurasi
- Local development menggunakan MySQL via Docker Compose
- ESLint
- Environment variables
- npm atau pnpm

> ⚠️ Jangan menggunakan SQLite, PostgreSQL, atau MongoDB. **Database wajib MySQL.**

---

## 2. DESIGN DIRECTION

Buat identitas visual seperti organisasi boxing internasional dengan nuansa premium fight night.

**Visual:**
- Dark cinematic theme
- Background: near-black, charcoal
- Primary: championship gold
- Secondary: deep crimson red
- Text: white dan muted gray
- Typography: bold condensed untuk heading, modern sans-serif untuk body
- Spacing rapi dan hierarki visual yang kuat
- Card design elegan, bukan dashboard template generik
- Hindari tampilan seperti website hasil generate AI yang monoton

Landing page harus terlihat seperti sports brand profesional, dengan kualitas desain setara event olahraga premium.

Buat logo placeholder yang bisa diganti melalui admin.

---

## 3. PUBLIC LANDING PAGE

### A. Navigation
- Logo, Home, Rankings, Grand Prix, Belts, Fighters, Fight History, Upcoming Events, Search
- CTA: View Rankings

Navbar:
- Transparent pada awal hero
- Sticky ketika scroll
- Background blur ketika scroll
- Mobile navigation drawer
- Smooth transitions

### B. Hero Slider
Cinematic hero slider yang immersive.

Setiap slide mendukung: background image/video, fighter image, event title, event date, category, headline, short description, CTA buttons, optional 3D object, overlay gradient.

Interaksi: autoplay yang dapat dikonfigurasi, prev/next navigation, pagination, swipe support di mobile, pause autoplay saat hover/focus, keyboard accessibility, smooth transition.

Admin dapat: membuat, mengedit, menghapus slide, mengatur urutan, mengaktifkan/nonaktifkan, mengatur jadwal publikasi.

Data hero dari database, bukan hardcoded.

### C. Ranking Preview
Tampilkan: Top 10 fighters, rank number, fighter portrait, fighter name, weight class, record W-L-D, points, champion badge, ranking movement, link View All Rankings.

Kategori: Pound-for-Pound, Men's divisions, Women's divisions (jika diaktifkan), weight classes yang dapat dikonfigurasi.

Jangan menggabungkan ranking antar-weight class tanpa aturan yang jelas.

### D. Grand Prix
Tampilkan: active tournaments, tournament poster, name, division, prize/title, participant count, status, bracket preview, upcoming fight, CTA View Tournament.

Dukung: single elimination, optional double elimination, manual bracket management, tournament progression, fight results, tournament winner.

Jangan mengklaim sistem bracket otomatis sudah berjalan sebelum logic dan pengujiannya selesai.

### E. Rotating Championship Belt
Section khusus Championship Belt dengan 3D presentation.

Visual: sabuk sebagai focal point, slow rotation, premium lighting, dark studio background, gold material, dramatic spotlight, subtle particles jika performa memungkinkan.

Data: belt name, division, current holder, date won, last defense, next defense, belt status, defense history.

Rotating belt = sabuk divisional yang dapat berpindah pemegang setelah hasil pertandingan resmi disahkan. **Perpindahan harus melalui prosedur resmi dan approval** — tidak otomatis.

Fallback gambar 2D jika model 3D gagal dimuat.

### F. Fighter Directory
Listing: search, filter weight class, filter nationality, filter active/retired, sorting berdasarkan ranking, pagination, fighter cards.

Fighter profile: portrait, full name, ring name, nationality, date of birth (jika dipublikasikan), height, reach, stance, weight class, professional record, ranking, titles, biography, achievements, recent fights, fight history, statistics.

Data sensitif pribadi tidak boleh ditampilkan secara publik.

### G. Fighter Fight History
Kolom: fight date, fighter A, fighter B, event, weight class, result, method, round, time, official status.

Result: Win, Loss, Draw, No Contest.
Method: KO, TKO, Decision, Technical Decision, Disqualification, other configurable methods.

Filter: fighter, event, date range, division, result, method.

Tampilkan detail pertandingan beserta sumber/referensi verifikasi bila tersedia.

### H. Upcoming Events
Event schedule, fight card, main event, venue, poster, date/time + timezone, event status.

Jangan menampilkan jadwal palsu seolah-olah event resmi.

### I. Footer
Organization profile, contact, social media, terms, privacy, copyright, sponsor section.

---

## 4. RANKING ENGINE

Ranking harus transparan. Buat: ranking per weight class, Pound-for-Pound ranking, ranking history, previous rank, current rank, rank movement, ranking points, champion status, effective date, ranking version, ranking notes.

**MVP: MANUAL OFFICIAL RANKING sebagai default.** Admin berwenang menentukan dan mempublikasikan ranking. Siapkan struktur untuk scoring engine di masa depan, tetapi jangan mengarang ranking otomatis berdasarkan rumus yang belum disepakati.

Setiap perubahan ranking: tercatat di audit log, memiliki editor, timestamp, reason, approval status, published version.

Ranking publik hanya menampilkan versi yang telah dipublikasikan.

---

## 5. ADMIN DASHBOARD

Routes:
`/admin/login`, `/admin`, `/admin/fighters`, `/admin/rankings`, `/admin/grand-prix`, `/admin/belts`, `/admin/fights`, `/admin/events`, `/admin/hero-slides`, `/admin/media`, `/admin/pages`, `/admin/users`, `/admin/roles`, `/admin/audit-logs`, `/admin/settings`

Admin UI: sidebar, breadcrumb, responsive, dashboard metrics, searchable tables, pagination, filters, confirmation modal, form validation, loading/empty/error states, toast notifications.

Metrics: total fighters, active fighters, published rankings, upcoming events, active tournaments, championship belts, recent activity.

Semua data harus berasal dari database.

---

## 6. PAGE BUILDER / LANDING PAGE EDITOR

Section-based page builder tanpa mengubah source code.

Fitur: enable/disable section, reorder, edit headings, descriptions, CTA, select images, configure background/theme/layout/animation preset, preview desktop/tablet/mobile, save draft, preview draft, publish, revision history, rollback.

Reusable sections: Hero slider, Rankings, Grand Prix, Championship Belt, Featured Fighters, Fight History, Upcoming Events, Sponsors, CTA, Footer.

Konfigurasi section disimpan dalam JSON yang divalidasi schema (Zod).

**Dilarang:** arbitrary JavaScript, HTML, script injection, atau custom executable code.

Preset animasi: Fade, Slide, Reveal, Stagger, Parallax, None.

---

## 7. ROLE-BASED ACCESS CONTROL

RBAC wajib di backend.

| # | Role | Cakupan |
|---|------|---------|
| 1 | Super Admin | Full access, user mgmt, role & permission mgmt, system config, publish & approval |
| 2 | Administrator | General ops: fighters, events, content, limited settings |
| 3 | Ranking Manager | Manage rankings, draft, submit for approval; publish hanya jika permission eksplisit |
| 4 | Tournament Manager | Grand Prix, brackets, participants, prepare fight results |
| 5 | Editor | Landing page, hero slider, images, content, draft & preview; tidak otomatis publish |
| 6 | Fight Data Manager | Fight records, prepare results; tidak otomatis mengesahkan |
| 7 | Reviewer / Approver | Review & approve; tidak boleh approve perubahan sendiri (four-eyes) |
| 8 | Viewer | Read-only |

Granular permissions:
`fighters.read`, `fighters.create`, `fighters.update`, `fighters.delete`, `rankings.read`, `rankings.manage`, `rankings.publish`, `fights.manage`, `fights.verify`, `fights.approve`, `tournaments.manage`, `belts.manage`, `content.manage`, `content.publish`, `users.manage`, `roles.manage`, `settings.manage`, `audit.read`

- Semua API dan Server Actions yang mengubah data wajib memeriksa session, permission, dan ownership/scope.
- Jangan mengandalkan middleware atau menyembunyikan tombol UI sebagai security utama.
- Cegah privilege escalation.
- Perubahan role dan permission wajib diaudit.

---

## 8. SECURITY REQUIREMENTS

Implementasikan: secure password hashing, session management, CSRF protection, login rate limiting, brute-force protection, login failure monitoring, server-side authorization, Zod validation, ORM parameterized queries, XSS prevention, secure file upload, MIME type verification, file size limits, randomized file names, image processing jika perlu, restrict upload extensions, secure HTTP headers, CSP, secure cookies, environment secrets, no secrets in client bundle, audit logs, least privilege, database backup strategy, error handling tanpa stack trace, input sanitization sesuai konteks, IDOR protection, mass assignment protection, session revocation, account deactivation, admin action confirmation.

MFA/TOTP untuk Super Admin dan role sensitif jika memungkinkan.

Approval workflow untuk:
- Official ranking publication
- Fight result verification
- Belt holder changes
- User role escalation

Tidak boleh ada default production admin password hardcoded. Bootstrap admin via environment-based one-time setup atau CLI command yang aman.

Jangan mencatat password, token, session cookie, atau secret di audit log.

---

## 9. DATABASE DESIGN — MYSQL + PRISMA

Model minimal:
User, Role, Permission, UserRole, RolePermission, Session/auth models, Fighter, WeightClass, FighterRanking, RankingVersion, RankingEntry, RankingChangeLog, ChampionshipBelt, BeltReign, BeltDefense, Event, Fight, FightParticipant, FightResult, FightResultApproval, Tournament, TournamentParticipant, TournamentBracket, TournamentBout, HeroSlide, Page, PageSection, PageRevision, MediaAsset, Sponsor, AuditLog, Notification, OrganizationSetting.

Gunakan: PK konsisten, FK, unique constraints, indexes, createdAt/updatedAt, soft delete hanya jika sesuai, transaction untuk perubahan kritis.

- Satu fighter → banyak fight records.
- Satu fight → beberapa participants (MVP: 2 peserta).
- Satu division → ranking sendiri.
- Ranking publication harus versioned.
- Belt history mempertahankan histori pemegang.
- Tournament bracket berelasi jelas ke fight records.
- Hindari duplikasi data fighter dan fight participants.
- MySQL-compatible schema + Prisma migrations.

---

## 10. ANIMATION & 3D EXPERIENCE

Implementasikan: hero parallax, scroll reveal, section transitions, animated ranking cards, number count-up (reduced-motion fallback), fighter card hover, belt 3D rotation, animated tournament bracket, smooth page transitions, sticky navbar transitions, image reveal, subtle background particles.

3D: React Three Fiber / Three.js, GLB/GLTF assets, championship belt model, lighting & environment optimal, lazy load, Suspense fallback, static image fallback, mobile performance adaptation.

Aturan: jangan efek berat di semua section, hormati `prefers-reduced-motion`, hindari scroll hijacking, scrolling natural, teks & tombol mudah digunakan.

Target: 60 FPS pada perangkat memadai, responsive, optimasi WebGL & asset loading, hindari layout shift.

---

## 11. SEO & PERFORMANCE

Metadata per halaman, Open Graph, canonical URLs, sitemap, robots.txt, semantic HTML, accessible navigation, optimized images, lazy loading, SSR untuk halaman publik, cache invalidation setelah publish, pagination, database indexes, structured data hanya untuk informasi valid, SEO-friendly fighter URLs, custom 404.

Jangan cache halaman admin atau data privat secara publik.

---

## 12. PROJECT STRUCTURE

```
src/
  app/        (public)/ admin/ api/
  components/ ui/ layout/ landing/ fighters/ rankings/ tournaments/ belts/
  features/   auth/ fighters/ rankings/ fights/ tournaments/ belts/ cms/ users/
  lib/        auth/ db/ permissions/ security/ validation/ storage/
  server/     services/ repositories/
  hooks/
  styles/
prisma/       schema.prisma  migrations/  seed.js
tests/        unit/ integration/ e2e/
```

Struktur boleh disesuaikan dengan alasan teknis yang jelas (didokumentasikan).

---

## 13. IMPLEMENTATION PHASES

| Phase | Scope |
|-------|-------|
| 1 — Foundation | Project setup, design system, MySQL, Prisma, Authentication, RBAC, Admin shell |
| 2 — Core Data | Fighters, weight classes, fight history, events, rankings |
| 3 — Championship | Belts, belt reign history, Grand Prix, tournament bracket, fight result workflow |
| 4 — CMS | Hero slider, page builder, media management, draft & publishing, versioning |
| 5 — Public Website | Premium landing page, fighter profiles, rankings, Grand Prix pages, belts, fight history, event pages, 3D effects |
| 6 — Hardening | Authorization tests, security tests, responsive QA, performance, SEO, backup & deployment docs |

---

## 14. TESTING

Automated tests: authentication, RBAC permission enforcement, unauthorized API access, privilege escalation, CRUD, ranking versioning, ranking publication, fight result approval, belt holder transition, tournament bracket progression, CMS publishing, revision rollback, file upload restrictions.

E2E: admin login, create fighter, update ranking, submit & approve changes, publish landing page, public fighter page.

Permission matrix diuji dengan role berbeda.

---

## 15. DELIVERABLES

1. Source code lengkap
2. Prisma schema
3. Database migrations
4. Seed data demo (ditandai jelas sebagai fictional/demo)
5. Setup instructions
6. `.env.example` tanpa secret
7. Docker Compose untuk MySQL development
8. `README.md`
9. API documentation
10. Role-permission matrix
11. Database ERD / dokumentasi relasi
12. Testing instructions
13. Production deployment guide
14. Backup and restore guide

---

## 16. WORKING RULES

Sebelum implementasi:
- Buat architecture plan
- Tentukan database relationships
- Definisikan permission matrix
- Tentukan workflow official data
- Tentukan design tokens
- Buat implementation checklist

Setelah itu implementasikan bertahap. Jangan berhenti di planning atau halaman statis.

- Setiap modul terhubung ke database dan memiliki loading, error, empty, dan success states.
- Tidak ada fake functionality atau tombol yang tidak bekerja.
- Kebutuhan bisnis yang belum ditentukan → default aman + dokumentasikan asumsi.
- Jangan menimpa project existing tanpa memeriksa struktur dan perubahan yang ada.
- Mulai dari audit project, architecture plan, lalu implementasikan MVP end-to-end.
- **Selalu buat dokumentasi `.md`, dan setiap update selalu update di `.md`.**

---

## 17. PROJECT AUDIT LOG

| Tanggal | Temuan |
|---------|--------|
| 2026-11-04 | Workspace `d:\Lambordi\GITHUB\Pimpom\boxing` kosong (greenfield), bukan git repo. Tooling tersedia: Node v24.14.0, npm 11.17.0, pnpm 11.9.0, Docker 29.7.2. Tidak ada kode existing yang berisiko tertimpa. |

---

## 18. DECISION LOG

| Tanggal | Keputusan | Status |
|---------|-----------|--------|
| 2026-11-04 | **Style desain:** Brutalist Boxing UI (dipadukan dengan palet PRD: near-black, gold, crimson). Concept gallery A/B/C disiapkan untuk dipilih. | Disetujui (Cinematic Brutalism) |
| 2026-11-04 | **Authentication:** Custom session auth — DB-backed session, cookie HttpOnly/Secure/SameSite, Argon2id, TOTP untuk role sensitif. (Alternatif Auth.js tidak dipakai demi kontrol penuh atas revocation & RBAC.) | Disetujui & Diimplementasikan |
| 2026-11-04 | **3D Belt:** Model procedural Three.js/R3F, dapat diganti GLB via admin, fallback gambar 2D. | Disetujui & Diimplementasikan |
| 2026-11-04 | **Package manager:** npm. | Disetujui |
| 2026-11-04 | **Database Engine:** MySQL 8.4 via Docker Compose port 3307 & Prisma ORM 7.10.1 dengan `@prisma/adapter-mariadb`. | Berjalan & Termigrasi |
| 2026-11-04 | **Implementasi End-to-End:** Seluruh fase Phase 1 s/d Phase 5 & automated test unit selesai, build Next.js 16.4.5 sukses tanpa error. | Selesai & Terverifikasi |
| 2026-11-04 | **Visual Assets (Gemini AI):** 6 foto dummy olahraga sinematik (Marcus Vale, Dario Storm, Kenji Arata, Tomas Reyes, Belt, Arena) di-generate dan diintegrasikan ke landing page & fighter profiles. | Selesai & Terintegrasi |
| 2026-11-04 | **Restyling Combat Sports / FNT:** Seluruh visual UI dirombak presisi sesuai 5 gambar referensi pengguna (Oswald & Inter font, Red/Black/White contrast, Top Live Ticker, White Athletic Navbar, Matchup VS Cards, Fight Night Countdown, signature Ranking Table dengan Red WINS column, Athlete Cards dengan social icons, dan News Cards dengan date badge). Admin login & dashboard diverifikasi berfungsi 100%. | Selesai & Terverifikasi |

---

## 19. IMPLEMENTATION STATUS (v1.1 RESTYLED & VERIFIED)

- [x] **Combat Sports & FNT UI Overhaul:**
  - Font Oswald (Display condensed) & Inter (Body sans-serif) dari Google Fonts terintegrasi.
  - Palet Fight Red (`#E50914`), Near-Black (`#0B0B0D`), Stark White, dan Subtext Gray.
  - Top Live Ticker (`LIVE: ... | FOLLOW US: f, 𝕏, o, ▶`) & Crisp White Athletic Navbar.
  - Hero Slider dengan Date Pill, Carousel Preview Cards di kiri bawah, dan Square Arrow Navigation di kanan bawah.
  - Monochromatic Sponsor Ribbon & 3-Column Highlights News.
  - Head-to-Head VS Matchup Cards (Marcus Vale vs Tomas Reyes, Dario Storm vs Kenji Arata) & Realtime Fight Night Countdown.
  - Signature Ranking Table dari Gambar Referensi 4 (Header Hitam, Kolom `WINS` ber-background Merah pekat, Baris Zebra).
  - Athlete Cards dari Gambar Referensi 1 (Foto ring, Nama tebal, Baris Icon Sosial Media bulat).
  - News/Event Cards dari Gambar Referensi 5 (Floating Square Red Date Badge `24 DEC` di atas foto, link `→ MORE`).
- [x] **Admin CMS Login & Session Verification:**
  - Cookie prefix disesuaikan (`bx_session` di dev) sehingga kompatibel di semua browser pada `http://localhost:3000`.
  - Halaman `/admin/login` ditata rapi dengan logo `FNT·X CMS` dan tombol demo 1-klik (`superadmin@boxing.local` / `Demo-Ringside-2026!`).
  - Teruji live: POST `/api/auth/login` menghasilkan HTTP 200 dan session cookie, redirect ke `/admin` sukses.
- [x] **Visual Assets:** 6 foto sinematik resolusi tinggi tersimpan di `public/images/` dan terintegrasi di komponen.
- [x] **Database & Migrations:** 30 model di `prisma/schema.prisma` termigrasi ke MySQL 8.4 (`20261103235119_init_championship_schema`).
- [x] **Seeded Demo Data:** Roles, permissions, weight classes, belts, fighters, rankings, tournaments, events, hero slides, demo accounts di `prisma/seed.ts`.
- [x] **Security Engine:** Session cookies (HttpOnly, Secure, Lax), SHA-256 token hashing, Argon2id, RFC 6238 TOTP, Four-Eyes guard, rate limit, CSRF protection, CSP nonce proxy.
- [x] **Testing & Build:** 18 unit tests lolos (Vitest), `npm run build` Next.js 16.4.5 Turbopack berhasil 100% tanpa error TypeScript.
