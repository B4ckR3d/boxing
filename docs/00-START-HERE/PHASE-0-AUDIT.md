# PHASE 0 — Audit & Project Discovery

> **Tanggal audit:** 17 November 2026
> **Auditor:** AI coding agent (Hermes)
> **Commit yang diaudit:** `119b39f` (`main`), working tree kotor: `src/app/layout.tsx` dimodifikasi
> **Metode:** pembacaan source code, `prisma/schema.prisma`, dokumen existing, query langsung ke
> database produksi (via HTTP publik), `tsc --noEmit`, `eslint .`, `vitest --project unit`.
> **Tidak ada source code lama yang diubah/dihapus selama audit.**

---

## 1. Ringkasan eksekutif

| Pertanyaan | Jawaban |
|---|---|
| Apakah ada project lama? | **Ya.** Satu aplikasi Next.js 16 fullstack (public site + admin + ticketing) di `/home/irhan/Projects/My-Projects/TFN`. |
| Apakah masih dipakai? | **Ya, live di produksi** `https://tfn.pimpom.id` (HTTP 200, 77 KB HTML). |
| Apakah sesuai arsitektur target (monorepo + Express API + 4 app)? | **Tidak.** Masih 1 app; backend = Next.js Route Handlers + Server Actions. |
| Data produksi yang harus dimigrasi? | **Tidak ada data bisnis nyata.** Isi DB produksi masih **data demo seed** (`WBC-X 42: Night of Champions`, 6 fighter fiktif). |
| Apakah layak dibuang? | **Tidak.** ~13.500 LOC dengan invariant yang sudah diverifikasi (anti-oversell, RBAC, audit log, PDF tiket, check-in, cron expiry). Ini modal, bukan sampah. |
| Rekomendasi | **Strangler + monorepo bertahap**, bukan big-bang rewrite (lihat §9). |

---

## 2. Kondisi repository

```
/home/irhan/Projects/My-Projects/TFN      (git: main, origin github.com/B4ckR3d/boxing)
├── src/app/(public)/      12 route publik
├── src/app/admin/         15 route admin (termasuk /admin/login)
├── src/app/api/           4 route handler  (auth/login, auth/logout, ticketing/orders, …/[orderNumber])
├── src/server/services/   7 service (auth, rbac, ticketing, ticket-pdf, audit, settings, sponsor)
├── src/lib/               22 modul (db, env, security, permissions, ticketing, i18n, …)
├── src/components/        UI (landing, admin, ticketing, ui, …)
├── prisma/schema.prisma   1.150 baris · 40 model · 29 enum
├── prisma/migrations/     3 migration
├── tests/                 13 file unit + 5 file integration
├── scripts/               deploy, cron, backup, verify (browser probes)
├── docs/                  17 dokumen existing
├── docker-compose.yml     MySQL 8.4 dev saja
└── prisma/seed.ts         demo content + user demo
```

| Metrik | Nilai |
|---|---|
| File TypeScript/TSX (tanpa generated) | 102 |
| LOC TypeScript/TSX (tanpa generated) | 13.481 |
| Model Prisma | 40 |
| Enum Prisma | 29 |
| Migration | 3 (`init_championship_schema`, `ticketing_mvp`, `ticket_checkin`) |
| Route publik | 12 halaman + 1 route PDF |
| Route admin | 15 halaman |
| API route | 4 |
| Dependency produksi | 28 paket (tanpa framework tambahan berlebihan) |

### Stack aktual (bukan target)

| Layer | Aktual | Target spec | Gap |
|---|---|---|---|
| Framework | Next.js 16.4.5 (App Router, RSC, Turbopack) | Next.js + Express terpisah | ⚠️ backend belum terpisah |
| Bahasa | TypeScript strict | sama | ✅ |
| ORM/DB | Prisma 7.10.1 + `@prisma/adapter-mariadb`, MySQL/MariaDB | Prisma + MySQL 8 | ✅ |
| UI | Tailwind v4 + komponen lokal (bukan shadcn) | Tailwind + shadcn/ui | ⚠️ setara fungsi, beda basis |
| State/data | TanStack Query (ada di deps), Zustand **tidak ada** | Zustand + TanStack Query | ⚠️ |
| Auth | Argon2id + session DB (SHA-256 token) + TOTP MFA | JWT + refresh token | ⚠️ berbeda pola, **lebih aman** untuk admin panel |
| Authz | Permission-based RBAC (24 permission, 8 role seed) | RBAC permission-based | ✅ |
| Validasi | Zod 4 | Zod | ✅ |
| Payment | Manual bank transfer + verifikasi admin (tanpa gateway) | Abstraksi provider + QRIS | ❌ belum ada |
| Queue/Redis | Tidak ada | Redis + BullMQ | ❌ belum ada |
| Storage | Local + S3 SDK (`@aws-sdk/client-s3`) | S3-compatible | 🟡 SDK ada, upload privat belum |
| Spreadsheet | Tidak ada | Google Sheets API | ❌ belum ada |
| Docs API | `docs/API.md` (markdown) | Swagger/OpenAPI | ❌ belum ada |
| Test | Vitest (unit+integration), Playwright, probe `.cjs` | Vitest/Supertest/Playwright | 🟡 Supertest belum (belum ada Express) |
| Deploy | aaPanel VPS, 1 proses Next.js `:3000`, cron hourly | Docker Compose + Nginx + 4 app | ❌ |

---

## 3. Feature inventory (bukti, bukan klaim)

Legenda: **DONE** = ada kode + ada bukti verifikasi · **PARTIAL** = ada sebagian · **MISSING** = belum ada.

### 3.1 Yang sudah ada dan terverifikasi

| # | Fitur | Status | Bukti |
|---|---|---|---|
| 1 | Autentikasi admin (Argon2id, lockout, session DB, MFA TOTP, CSRF/origin) | DONE | `src/server/services/auth.service.ts`, `src/lib/security/*`, unit test auth/rbac/csrf/totp |
| 2 | RBAC permission-based + four-eyes role request | DONE | `src/lib/permissions/catalog.ts`, `src/server/services/rbac.service.ts`, halaman `/admin/roles`, `/admin/users`, `/admin/audit-logs` |
| 3 | Audit log | DONE | `AuditLog` + `audit.service.ts`, halaman `/admin/audit-logs` |
| 4 | Fighter database + direkotri publik + profil | DONE | `/fighters`, `/fighters/[slug]`, `/admin/fighters`, 6 fighter di produksi |
| 5 | Weight class (17 kelas) + fight history + result approval 4-eyes | DONE | model `WeightClass`, `Fight`, `FightResult`, `/admin/*` |
| 6 | Championship belt + reign + defense + lineage | DONE | `ChampionshipBelt`, `BeltReign`, `BeltDefense`, `/belts`, `/admin/belts` |
| 7 | Ranking versioning + publikasi + change log | DONE | `RankingVersion`, `RankingEntry`, `FighterRanking`, `/rankings`, `/admin/rankings` |
| 8 | Grand Prix / turnamen bracket (single & double elimination) | DONE | `Tournament*` models, `/grand-prix`, `/admin/grand-prix` |
| 9 | CMS landing (hero slides, page sections, page revision, media asset) | DONE | `/admin/hero-slides`, `/admin/settings`, `Page`, `PageSection`, `MediaAsset` |
| 10 | Sponsorship showcase (DB-driven, `MediaAsset` FK) | PARTIAL | `/admin/sponsors` + `SponsorShowcase`; **belum ada** paket, kontrak, invoice, laporan |
| 11 | Ticketing guest checkout (hold kapasitas atomik, token capability, cap per pembeli) | DONE | `ticketing.service.ts`, 5 integration test, probe 50 paralel 0 oversell |
| 12 | PDF tiket + QR bertanda tangan (HMAC) | DONE | `ticket-pdf.service.ts`, `ticket-token.ts`, route PDF, integration test |
| 13 | Check-in onsite (QR + manual, anti double-scan, audit) | DONE | `checkInTicket()`, `/admin/ticketing/scan`, 9 integration test |
| 14 | Hold expiry otomatis + cron terpasang | DONE | `expireStaleHolds()`, `scripts/cron/*`, log `storage/logs/expire-holds.log` |
| 15 | Website publik (SEO metadata, OG, bilingual ID/EN, responsif) | DONE | 12 route, `src/lib/i18n`, live di produksi |
| 16 | Blok dukungan resmi Pemkab Temanggung | DONE | `OfficialSupport.tsx`, `src/lib/site/partners.ts`, probe layout |

### 3.2 Yang belum ada sama sekali (gap terhadap master instruction)

| Domain | Kebutuhan spec | Kondisi |
|---|---|---|
| Multi-tenant | `Organizations`, membership, tenant isolation | ❌ Tidak ada model organisasi; hanya `OrganizationSetting` (key-value singleton) |
| Club/Gym & Coach | master club, histori club fighter | ❌ Tidak ada tabel |
| Registrasi fighter | form publik, NIK/KTP, BPJS, consent versioned, biaya, verifikasi dokumen | ❌ Tidak ada modul registrasi |
| Data sensitif | NIK/KTP/BPJS terenkripsi + akses terbatas + retensi | ❌ Belum ada field & kebijakan |
| Payment gateway | abstraksi provider, QRIS dinamis, webhook, idempotency, refund | ❌ Hanya transfer manual + verifikasi admin |
| POS | app kasir, shift, rekonsiliasi, struk | ❌ Tidak ada |
| Ticketing lanjutan | kategori on-the-spot, check-in per gerbang, refund, laporan | 🟡 sebagian |
| Officials (wasit/juri) | database, penugasan, honor, rolling | ❌ Tidak ada model |
| Finance | income, expense, budget, P&L, rekonsiliasi | ❌ Tidak ada |
| Workflow engine ringan | task, deadline, approval, log | ❌ Tidak ada |
| Google Sheets sync | template, job, retry, log | ❌ Tidak ada |
| Reporting/export | Excel/PDF, dashboard agregat | 🟡 dashboard admin ada, export belum |
| Notification | email/WA | ❌ Tidak ada |
| Event configuration lengkap | periode registrasi, kuota fighter, ruleset, kategori atlet, budget, branding | 🟡 `Event` hanya name/slug/venue/city/startsAt/status/poster |
| Swagger | dokumentasi OpenAPI | ❌ |
| Atlet kategori (Atlet/Non-Atlet/Pemula) | master kategori peserta | ❌ |
| Ruleset (Kickboxing Low Kick, Freestyle Boxing, …) | configurable | ❌ |

---

## 4. Audit database

- **Engine:** MySQL/MariaDB 8.x, database `boxing`, Prisma 7 + driver adapter.
- **Model:** 40 (auth/RBAC 8, fighter/ranking/belt 9, event/fight 7, ticketing 5, tournament 4, CMS 5, ops 2).
- **Konvensi ID:** `cuid()` (bukan UUID/ULID), semua PK `String`.
- **Uang:** `Decimal` di `TicketType.price`, `TicketPayment.amount` ✅ (bukan float).
- **Timestamp:** `DateTime` (UTC) + kolom `timezone` pada `Event` ✅.
- **Soft delete:** ada di `Fighter.deletedAt` 🟡 (belum konsisten di tabel lain).
- **Tenant:** ❌ tidak ada `organizationId` di satu pun tabel.
- **Index:** sebagian besar FK sudah `@@index`; composite index pada `Event`, `Fight`, `FighterRanking` ✅.

### Data yang benar-benar ada hari ini

| Lingkungan | Kondisi |
|---|---|
| **Produksi** (`tfn.pimpom.id`) | Hidup. Isi = **data demo seed**: event `WBC-X 42: Night of Champions`, 6 fighter fiktif (Aleksandr Volkov, Carlos Mendoza, Dario Storm, Kenji Arata, Marcus Iron Vale, Tomas Reyes), 0 sponsor, 0 artikel. **Tidak ada data bisnis nyata.** |
| **Lokal (dev)** | ❌ **Tidak bisa dipakai.** Docker volume `tfn_boxing_mysql_data` dibuat 17 Nov 2026 10:01 dan **berisi 0 tabel** (container `boxing-mysql` berstatus `Created`, gagal start karena port 3306 dipakai MariaDB sistem). `.env` menunjuk `127.0.0.1:3306` = MariaDB sistem lain → `Access denied for user 'boxing_user'`. |
| **Test** | `TEST_DATABASE_URL` ada di `.env`; integration test butuh DB yang sudah dimigrasi. |

**Implikasi:** tidak ada data pelanggan/transaksi yang berisiko hilang. Yang berharga adalah **kode + konten seed**, bukan baris database. Tetap wajib backup sebelum migrasi (spec §22 Phase 0).

---

## 5. Audit API & keamanan

| Kontrol | Status | Catatan |
|---|---|---|
| Password hashing | ✅ | Argon2id (`@node-rs/argon2`) |
| Session | ✅ | Token opaque, disimpan `sha256`, cookie httpOnly; **bukan JWT** |
| Refresh token rotation | ❌ | Tidak relevan dengan pola session; perlu diputuskan pada arsitektur API baru |
| RBAC | ✅ | 24 permission, cek di server (`requirePermission`), bukan hanya sembunyikan UI |
| Tenant isolation | ❌ | Belum ada tenant |
| Origin/CSRF | ✅ | `verifyRequestOrigin()` pada semua mutasi + `Origin` allowlist `APP_URL` |
| Rate limit | 🟡 | In-memory (single instance) — gagal jika multi-replica |
| Helmet/CSP | ✅ | CSP + nonce di `next.config.ts`/middleware |
| Validasi input | ✅ | Zod di route handler + server action |
| File upload | 🟡 | `MediaAsset` + S3 SDK ada; validasi ukuran/tipe dokumen privat belum |
| Dokumentasi API | 🟡 | `docs/API.md` manual; Swagger belum |
| Audit logging | ✅ | Aksi sensitif tercatat |
| Secret di repo | ✅ | `.env`, `cred.md`, `src/generated`, `storage/` di `.gitignore` |
| Lint gate | ❌ **GAGAL** | 1 error: `src/app/layout.tsx:69` `dangerouslySetInnerHTML` (perubahan belum di-commit) |
| Typecheck | ✅ | `tsc --noEmit` exit 0 |

---

## 6. Audit deployment

| Item | Kondisi |
|---|---|
| Produksi | aaPanel VPS, `APP_DIR=/www/wwwroot/boxing`, satu proses Next.js port 3000, MySQL lokal |
| Domain | `tfn.pimpom.id` ✅ live. `admin.tfn.pimpom.id`, `api.tfn.pimpom.id`, `pos.tfn.pimpom.id` ❌ **belum resolve** |
| Admin | path-based: `https://tfn.pimpom.id/admin` → 307 → `/admin/login` |
| Cron | hourly `:17`, wrapper `scripts/cron/expire-holds.sh` (`flock`, log rotasi) |
| Docker | hanya MySQL dev; app produksi **tidak** di Docker |
| Backup | `scripts/db-backup.mjs`, `docs/BACKUP_RESTORE.md` |
| Temuan | `/sitemap.xml` dan `/robots.txt` → **404 di produksi** meski dokumen mengklaim ada (lihat `KNOWN-ISSUES.md` K-01) |

---

## 7. Verifikasi yang dijalankan auditor ini

| Perintah | Hasil |
|---|---|
| `tsc --noEmit` | exit 0 |
| `eslint .` | **1 error, 1 warning** → gate gagal (error dari perubahan belum commit) |
| `vitest run --project unit` | **75 passed / 15 file** (1,14 s) |
| HTTP probe produksi | `/`, `/tickets`, `/fighters`, `/events`, `/rankings`, `/belts`, `/grand-prix`, `/fights`, `/news` → 200; `/sitemap.xml`, `/robots.txt` → 404 |
| Query DB lokal | gagal konek (lihat §4) — **bukan** karena kode, tapi environment |

---

## 8. Risiko teknis

| # | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R1 | DB lokal mati & volume kosong | Developer baru tidak bisa jalan dalam 5 menit | Perbaiki port compose (3307) / dokumentasikan, lalu seed ulang; tambah `npm run db:doctor` |
| R2 | Lint gagal karena perubahan belum commit | Gate "Definition of Done" tidak terpenuhi; rilis bisa lolos dengan error | Selesaikan `layout.tsx` (pakai `next/script` + nonce atau izinkan aturan untuk inline theme dengan justifikasi) |
| R3 | Backend menyatu dengan Next.js | Tidak sesuai spec; sulit dipakai POS/worker | Strangler ke `web-tnf/api` (Express) bertahap |
| R4 | Tidak ada tenant/organisasi | Blocker untuk SaaS & event ganda | Tambah `Organization` + `organizationId` sebelum data bisnis nyata masuk |
| R5 | Session cookie + satu domain | Subdomain admin/api butuh kebijakan cookie (`SameSite`, `Domain`) | Putuskan pola auth final sebelum memecah app |
| R6 | Rate limit in-memory | Bypass saat lebih dari 1 instance | Redis + rate limiter terdistribusi |
| R7 | Data sensitif (NIK/KTP/BPJS) belum punya desain | Risiko hukum/PII | Desain enkripsi kolom + storage privat + retensi **sebelum** modul registrasi |
| R8 | Tidak ada payment gateway | Registrasi berbayar belum bisa otomatis | Abstraksi `PaymentProvider` + adapter QRIS; webhook idempotent |
| R9 | Sitemap/robots 404 | SEO & indexing | Perbaiki route metadata |
| R10 | Seed demo di produksi | Konten publik menyesatkan (fighter fiktif) | Ganti dengan data TFN Vol. 6 saat modul event siap |

---

## 9. Rekomendasi arsitektur & strategi migrasi

Tiga opsi yang dipertimbangkan (detail + keputusan di `11-DEVELOPMENT-LOG/DECISIONS.md` ADR-001):

| Opsi | Isi | Risiko | Waktu |
|---|---|---|---|
| A. Big-bang rewrite ke monorepo penuh | Bangun ulang 4 app + API, buang kode lama | Tinggi — invariant ticketing/RBAC harus dibuktikan ulang | 6–10 minggu sebelum ada yang bisa dipakai |
| **B. Strangler + monorepo bertahap (REKOMENDASI)** | Monorepo dibuat sekarang; app lama tetap hidup sebagai `web-tnf` (website+admin). API Express dibangun modul demi modul; modul baru (registrasi, payment, POS, finance) langsung ke API. Halaman lama dipindah setelah parity. | Sedang — dua backend sementara, perlu disiplin | Bertahap, tiap phase menghasilkan sesuatu yang bisa dipakai |
| C. Lanjutkan Next.js fullstack, monorepo nanti | Cepat, tapi menyalahi spec §3 & §5 (frontend/backend terpisah, POS app) | Teknis: utang arsitektur menumpuk | Cepat di awal, mahal di akhir |

**Rekomendasi: Opsi B.** Alasan:
1. Kode lama punya invariant mahal (anti-oversell, audit 4-eyes, PDF/QR, check-in) — rewrite = risiko regresi tanpa manfaat bisnis.
2. Data bisnis nyata belum ada → migrasi data ringan, jadi kita bisa restrukturisasi **sekarang** tanpa biaya migrasi besar.
3. Spec menuntut POS, worker, dan multi-app: itu butuh API bersama; menunda hanya menambah pekerjaan.
4. Strangler menjaga situs produksi tetap hidup selama transisi.

**Urutan eksekusi yang diusulkan:** Phase 1 (fondasi monorepo + API skeleton + schema bertahap) → Phase 2 (Organization/tenant + Event config lengkap) → Phase 3 (Registrasi + dokumen privat) → Phase 4 (Payment + POS) → Phase 5 (Match/Official/Championship/Ranking) → Phase 6 (Sponsor/Finance) → Phase 7 (Sheets/Workflow/Report) → Phase 8 (Hardening).

---

## 10. Output Phase 0

| Output | Lokasi |
|---|---|
| Audit report | dokumen ini |
| Arsitektur existing | §2, §3, `02-ARCHITECTURE/FRONTEND-ARCHITECTURE.md`, `AUTHENTICATION-FLOW.md` |
| Arsitektur target | `02-ARCHITECTURE/SYSTEM-ARCHITECTURE.md`, `MONOREPO-STRUCTURE.md`, `MULTI-TENANT-ARCHITECTURE.md` |
| Database design awal | `03-DATABASE/DATABASE-DESIGN.md`, `ERD.md` |
| Rencana migrasi | `03-DATABASE/MIGRATION-GUIDE.md` §migrasi data lama |
| Risk assessment | §8 |
| Feature inventory | §3 |
| Roadmap | `01-PRODUCT/FEATURE-ROADMAP.md` |
| Task tracker | `11-DEVELOPMENT-LOG/TASK-TRACKER.md` |
| Aturan untuk AI berikutnya | `AI-CONTEXT/AI-INSTRUCTIONS.md` |

**Belum ada perubahan source code.** Menunggu persetujuan sebelum eksekusi Phase 1.
