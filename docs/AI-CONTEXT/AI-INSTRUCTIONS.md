# AI-INSTRUCTIONS

> **Baca file ini lebih dulu setiap sesi.** Ini kontrak kerja untuk AI coding agent (dan developer baru).
> Jika instruksi ini bertabrakan dengan permintaan user, **tanyakan** — jangan diam-diam memilih.

## 0. Urutan baca wajib (Rule 1)

```
1. README.md (root repo)
2. docs/00-START-HERE/PROJECT-OVERVIEW.md
3. docs/AI-CONTEXT/AI-INSTRUCTIONS.md   ← file ini
4. docs/AI-CONTEXT/CURRENT-STATE.md
5. docs/AI-CONTEXT/NEXT-TASKS.md
6. kode/modul yang relevan + prisma/schema.prisma
```

## 1. Identitas proyek

- **Nama:** TFN Management Platform (Temanggung Fight Night).
- **Lokasi:** `/home/irhan/Projects/My-Projects/TFN` (produksi: `/www/wwwroot/boxing`).
- **Domain produksi:** `https://tfn.pimpom.id` (target: website/admin/pos/api 4 subdomain).
- **Stack sekarang:** Next.js 16 App Router + TypeScript strict + Prisma 7 + MySQL + Tailwind v4.
- **Stack target:** monorepo pnpm+turbo, `apps/{website,admin,pos,api,worker}`, Express + Prisma,
  Redis + BullMQ, S3, Google Sheets.
- **Bahasa:** kode & identifier Inggris; UI, pesan error, dan dokumentasi **Indonesia**.

## 2. Arsitektur (ringkas)

- Modular monolith, API-first, multi-tenant ready. Satu database (`tfn_management_db`).
- Logika bisnis di service layer; controller hanya HTTP; repository hanya data.
- Detail: `02-ARCHITECTURE/SYSTEM-ARCHITECTURE.md`, `BACKEND-ARCHITECTURE.md`.

## 3. Struktur repo (sekarang)

```
src/app/(public)   website        src/app/admin   admin (path-based)
src/app/api        route handler  src/server/services  logika bisnis
src/lib            shared (db, security, permissions, ticketing, i18n)
prisma/            schema + seed + migrations
scripts/           deploy, cron, backup, verify (probe browser .cjs)
tests/unit | tests/integration
docs/              dokumentasi (lihat docs/README.md)
```

## 4. Coding standards (mengikat)

- TypeScript strict; tidak ada `any` (lint menolak).
- **`dangerouslySetInnerHTML` dilarang** oleh `no-restricted-syntax` — pakai React node / script
  nonce ter-allowlist.
- Server action mengembalikan `ActionResult`; client wajib memeriksa `.ok`.
- Error domain memakai kelas yang terdaftar di `src/lib/actions/result.ts`.
- Uang: `Decimal` di DB, konversi eksplisit sebelum melewati RSC boundary.
- Halaman tidak merender `<main>` (layout sudah); gunakan `<Button asChild><Link/></Button>`.
- Data publik diambil di server (RSC), bukan `useEffect` first paint.
- Komentar hanya untuk keputusan non-obvious; jangan mengomentari tiap baris.

## 5. Database conventions

| Topik | Aturan |
|---|---|
| PK | tabel baru: **ULID** `CHAR(26)`; tabel lama: `cuid` (tidak dikonversi) |
| Uang | `Decimal(14,2)`; tidak pernah `Float` |
| Waktu | UTC; render `Asia/Jakarta` |
| Tenant | tabel bisnis baru **wajib** `organizationId` + index |
| Soft delete | entitas berhistori; transaksi finansial tidak pernah dihapus |
| Migration | dokumentasikan dulu di `03-DATABASE/`; tidak destruktif tanpa backup |
| ID publik | pakai `slug`, jangan ekspos ID internal |

## 6. API conventions

- Base `/api/v1`, envelope `{success, message, data, meta}` / `{success, message, errors, code}`.
- Pagination `page/perPage` (maks 100), sort di-whitelist.
- `Idempotency-Key` untuk pembayaran/order/refund.
- Setiap endpoint: auth + permission + validasi Zod + dokumentasi Swagger.
- Detail: `04-API/API-STANDARDS.md`.

## 7. Security rules (tidak bisa dinegosiasi)

1. Jangan pernah menyimpan password plaintext / secret di kode / `localStorage` default.
2. NIK, KTP, BPJS = data privat. Tidak pernah ke `public/`, tidak pernah ke DTO publik, tidak pernah ke log.
3. Semua mutasi: origin/CSRF check + `requirePermission`.
4. Status pembayaran hanya dari webhook tervalidasi atau rekonsiliasi resmi.
5. Jangan memakai data produksi sebagai data dev/test.
6. Temuan keamanan dicatat di `KNOWN-ISSUES.md` walau belum diperbaiki.
7. Detail: `08-SECURITY/SECURITY-POLICY.md`.

## 8. Testing rules

```bash
npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build
```

- `TEST_DATABASE_URL` saja untuk integration test.
- Skipped / timeout / tidak dijalankan **bukan** lulus — tulis apa adanya.
- Permission baru wajib punya test allow + deny.
- Invariant (kuota, uang, idempotency) diuji dengan concurrency nyata.

## 9. Documentation rules

- Setiap perubahan arsitektur/DB/API/business rule/security/deploy **wajib** memperbarui dokumen terkait.
- Jangan menulis fitur sebagai selesai bila kodenya belum ada. Dokumen modul baru dibuat setelah modulnya ada.
- Akhir sesi: perbarui `CURRENT-STATE.md`, `NEXT-TASKS.md`, `SESSION-HANDOVER.md`,
  `../00-START-HERE/PROJECT-STATUS.md`, `../11-DEVELOPMENT-LOG/{CHANGELOG,TASK-TRACKER}.md`.

## 10. Status & batasan saat ini (jujur)

**Ada:** auth/session/MFA, RBAC+four-eyes, fighter, weight class, fight+result approval, belt,
ranking, tournament, CMS, ticketing+PDF+QR+check-in+expiry, website publik.

**Belum ada:** Organization/tenant, club/coach, registrasi fighter, NIK/KTP/BPJS, payment gateway,
POS, officials, finance, workflow, Google Sheets, reporting/export, notifikasi, Swagger, monorepo,
Express API, Redis/BullMQ, Docker app produksi.

**Blocker:** DB lokal tidak tersedia (port bentrok, volume kosong); lint gagal (`layout.tsx`);
menunggu persetujuan ADR-001.

## 11. Cara melanjutkan

Ikuti `NEXT-TASKS.md` berurutan. Jangan melewati gate. Jangan menambah modul baru ke Next.js
route handler — modul baru masuk ke `web-tnf/api` setelah Phase 1 disetujui.

## 12. Larangan eksplisit

- Menghapus/menimpa project lama tanpa backup + persetujuan.
- Mengubah nilai bisnis (harga, honor, status) tanpa sumber dari penyelenggara.
- Menambahkan fitur F&B/penjualan makanan di POS.
- Menjalankan probe/script verifikasi pada database produksi.
- Menyatakan task `DONE` tanpa bukti eksekusi.
