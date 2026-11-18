# Boxing Championship Platform (WBC-X)

> **Enterprise Sports Governance, Boxing Rankings, Grand Prix Tournaments & 3D Championship Belts**  
> Built with Next.js App Router (v16), TypeScript, Tailwind CSS (v4), Three.js / React Three Fiber, Motion, Prisma ORM, and MySQL 8.4.

---

## 📁 Struktur repo (sejak 18 Nov 2026)

Repo ini hanya berisi **dua project mandiri**. Masing-masing punya `package.json`,
`pnpm-workspace.yaml`, `.npmrc`, `node_modules`, env, dan proses PM2 sendiri — satu repo, dua app.

```
TFN/
├── web-tnf/      Website + CMS admin (Next.js 16) + backend
│   ├── src/        App Router: public site & /admin
│   ├── api/        Express API (:4000) — target BFF, /health/ready
│   ├── worker/     Job runner (expire-holds)
│   ├── packages/   Library bersama: db, core, auth, ticketing
│   ├── prisma/     Schema + migrations DB `boxing`
│   └── docs/       ADR, panduan deploy, dsb.
└── ticket-tnf/   Ticketing terpisah (Next.js 16 + Prisma 7)
    ├── src/        Halaman pembeli (login Google) & /admin (password + TOTP)
    └── prisma/     Schema + migrations DB `tfn_ticketing`
```

| Perintah | Lokasi | Fungsi |
|---|---|---|
| `pnpm dev` | `web-tnf/` | Website + admin CMS |
| `pnpm api:dev` | `web-tnf/` | API backend (:4000) |
| `pnpm api:build && pnpm api:start` | `web-tnf/` | API produksi (esbuild → `dist/`) |
| `pnpm worker:expire` | `web-tnf/` | Expire hold order |
| `pnpm dev` / `pnpm start` | `ticket-tnf/` | Ticketing (:3010) |
| `pnpm probe` / `pnpm probe:admin` | `ticket-tnf/` | E2E domain + gate admin |

> `web-tnf` **wajib** punya `api` (:4000) hidup — halaman berdata memanggil `API_INTERNAL_URL`
> lewat BFF dan akan balas `503 UPSTREAM_UNREACHABLE` bila API mati.

---

## 🥊 Features Overview

1. **Public Landing Page (Cinematic Brutalism):**
   - **Hero Slider:** Autoplay, swipe-enabled, keyboard-accessible fight night showcase with scheduling windows and custom CTAs.
   - **Official Boxing Ranking System:** Divisional and Pound-for-Pound ratings with versioned publication, rank movements (`▲`, `▼`, `NEW`), and champion recognition.
   - **Interactive 3D Championship Belt:** Procedural 3D metallic crown rendered in Three.js/R3F with studio lighting, spotlight, and automatic 2D fallback.
   - **World Grand Prix Tournament:** Single and double elimination tournament bracket visualization with participant seeds.
   - **Fighter Database & Detailed Profiles:** Physical tale of the tape (reach, height, stance), career statistics, fight records, and title honors.
   - **Verified Fight History:** Certified contest outcomes (`KO`, `TKO`, `UD`, `SD`, `NC`) with official sanctioning references.
   - **Event Fight Cards:** Real-time fight night schedule with main event pairings, venues, and local timezones.

2. **Ticketing (`/tickets`, `/tickets/status`):**
   - **Guest checkout, no account:** pick a category card, adjust quantity (1–10), see a live total, and get an order number plus a one-time capability token.
   - **Atomic capacity guard:** seats are reserved with `UPDATE … WHERE sold <= quota - qty` inside a transaction — pending holds count, so concurrent buyers can never oversell (verified with 50 parallel requests).
   - **Manual admin verification:** buyers transfer/QRIS/cash and an authorized admin confirms (payment → `VERIFIED`) or rejects with a reason (capacity released).
   - **Self-service status page:** order number + token (or a deep link from the receipt) shows status, line items, and the payment reference. Wrong token = `404`, no order enumeration.


3. **Admin Command Dashboard (`/admin`):**
   - **Overview:** Real-time metrics queried live from MySQL (Fighters, Rankings, Events, Belts, Tournaments, Audit logs).
   - **Roster Management (`/admin/fighters`):** Create, update, search, filter by division, and maintain combat records.
   - **Rankings Staging & Versioning (`/admin/rankings`):** Prepare draft revisions, reorder contenders, designate champions, and enforce **Four-Eyes** approval before publishing.
   - **Championship Belt Management (`/admin/belts`):** Maintain unbroken lineage ledgers and propose title holder transitions with database-level uniqueness guarantees.
   - **Grand Prix Brackets (`/admin/grand-prix`):** Seed athletes and advance bracket bouts linked directly to certified fight records.
   - **Cryptographic Audit Logs (`/admin/audit-logs`):** Tamper-evident operational audit trail capturing actor, action, timestamp, and pre-redacted metadata.

4. **Enterprise Security & RBAC Engine:**
   - **Session-Based Authentication:** Opaque tokens stored in `HttpOnly`, `Secure`, `SameSite=Lax` cookies; database-backed SHA-256 token hashing for instant revocation.
   - **Argon2id Password Hashing:** OWASP-compliant parameter configuration resistant to GPU attacks.
   - **RFC 6238 TOTP Multi-Factor Authentication:** AES-256-GCM encrypted secrets; mandatory step-up for sensitive roles.
   - **Strict Role-Based Access Control:** 8 pre-configured roles (`super_admin`, `administrator`, `ranking_manager`, `tournament_manager`, `editor`, `fight_data_manager`, `reviewer`, `viewer`) with 21 granular permissions.
   - **Separation of Duties (Four-Eyes Policy):** Users cannot approve or verify changes they initiated.
   - **CSRF & Rate Limiting Protection:** Sliding-window rate limiters on login, upload, and mutation endpoints; HMAC-signed CSRF tokens.

---

## 🛠 Tech Stack

- **Framework:** Next.js 16.4.5 (App Router, Turbopack)
- **Language:** TypeScript 5.9 (Strict mode)
- **Database:** MySQL 8.4 Community Server
- **ORM & Driver:** Prisma ORM 7.10.1 via `@prisma/adapter-mariadb`
- **3D Graphics:** Three.js + React Three Fiber + Drei
- **UI Animation:** Motion (`motion/react`)
- **Icons:** Lucide React
- **Validation:** Zod 4
- **Testing:** Vitest 5.1

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 20+ (tested on Node v24)
- Docker Desktop or a local MySQL 8.4 instance

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd boxing
npm install
```

### 2. Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```
Fill in the database credentials and generate secure keys:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Start MySQL via Docker Compose
```bash
npm run db:up
```
*Note: MySQL runs on port `3307` mapped to container `3306` to prevent collisions with existing local databases.*

> **Already running a local MySQL/MariaDB?** Skip `db:up` and point `MYSQL_*` in `.env` at that
> server. On this machine the development schema is `tfn_local` and the steps below work as-is.

### 4. Run Migrations & Seed Demo Data
```bash
npm run db:migrate
npm run db:seed
```

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) for the public landing page, or [http://localhost:3000/admin/login](http://localhost:3000/admin/login) for the admin portal.

---

## 🔐 Demo Credentials (Seeded Accounts)

| Email | Role | Password |
|---|---|---|
| `superadmin@boxing.local` | Super Admin | `Demo-Ringside-2026!` |
| `admin@boxing.local` | Administrator | `Demo-Ringside-2026!` |
| `rankings@boxing.local` | Ranking Manager | `Demo-Ringside-2026!` |
| `tournaments@boxing.local` | Tournament Manager | `Demo-Ringside-2026!` |
| `editor@boxing.local` | Lead Content Editor | `Demo-Ringside-2026!` |
| `data@boxing.local` | Fight Record Keeper | `Demo-Ringside-2026!` |
| `reviewer@boxing.local` | Sanctioning Reviewer | `Demo-Ringside-2026!` |
| `viewer@boxing.local` | Broadcast Guest (Read-only) | `Demo-Ringside-2026!` |

---

## 🧪 Testing

```bash
# Run Unit Test Suites
npm run test:unit

# Run All Automated Tests
npm run test:all
```

---

## 📚 Documentation Reference

> **New to the project (human or AI)? Start with [docs/CONTINUATION.md](docs/CONTINUATION.md)** — repo map, verified baseline, ticketing invariants, open gaps, and pre-"done" verification commands.

- [Continuation / Handover Guide](docs/CONTINUATION.md)
- [Tutorial Deploy aaPanel (Linux VPS)](docs/TUTORIAL_DEPLOY_AAPANEL.md)
- [Architecture Plan](docs/ARCHITECTURE.md)
- [Database Schema & ERD](docs/DATABASE.md)
- [Role-Based Access Control & Permission Matrix](docs/RBAC.md)
- [Official Data Approval Workflows](docs/OFFICIAL_DATA_WORKFLOW.md)
- [Design System & Tokens](docs/DESIGN_SYSTEM.md)
- [REST API Documentation](docs/API.md)
- [Production Deployment Guide](docs/DEPLOYMENT.md)
- [Backup & Disaster Recovery Guide](docs/BACKUP_RESTORE.md)
- [Implementation Checklist](docs/IMPLEMENTATION_CHECKLIST.md)
- [Product Requirements Document](prd.md)
- [Changelog](CHANGELOG.md)

