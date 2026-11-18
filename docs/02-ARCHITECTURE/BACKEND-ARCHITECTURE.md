# Backend Architecture (TARGET)

> **Status: 🟡 target.** Hari ini logika ada di `src/server/services/*` dan route handler Next.js.
> Struktur di bawah menjadi acuan saat `web-tnf/api` dibangun (Phase 1–2).

## 1. Struktur per modul

```
web-tnf/api/src/
├── config/            env (Zod), logger, swagger, prisma
├── middlewares/       auth, tenant, rbac, validate, rate-limit, error, request-log
├── modules/
│   └── registrations/
│       ├── registrations.routes.ts
│       ├── registrations.controller.ts
│       ├── registrations.service.ts      ← semua business logic
│       ├── registrations.repository.ts   ← query Prisma
│       ├── registrations.validation.ts   ← Zod
│       ├── registrations.types.ts
│       └── registrations.test.ts
├── shared/            response envelope, pagination, errors, money, datetime
├── jobs/              definisi job queue
├── routes/            agregasi router v1
├── app.ts             express app (tanpa listen)
└── server.ts          listen + graceful shutdown
```

## 2. Tanggung jawab tiap lapisan

| Lapisan | Boleh | Tidak boleh |
|---|---|---|
| Route | deklarasi path, middleware | logika bisnis |
| Controller | parse request, panggil service, bentuk response | query DB langsung |
| Service | aturan bisnis, transaksi, otorisasi domain | akses `req`/`res` |
| Repository | query Prisma, filter tenant | aturan bisnis, lempar error HTTP |
| Validation | skema Zod (dipakai juga oleh frontend) | akses DB |

## 3. Alur error & response

```
throw new AppError(code, message, httpStatus, details?)  →  globalErrorHandler → envelope error
```

Kode error yang sudah dipakai di repo lama: `VALIDATION_ERROR`, `SOLD_OUT`, `PURCHASE_LIMIT`,
`CAPACITY_ERROR`, plus kode baru per modul. Pesan ke user memakai bahasa Indonesia yang bisa dibaca;
detail teknis hanya di log.

## 4. Transaksi & integritas

- Semua proses yang menyentuh uang/kuota memakai `prisma.$transaction`.
- Reservasi kuota memakai `updateMany` dengan guard (`sold <= quota - qty`) — **bukan** read-then-write.
- Uang: `Decimal(14,2)`, tidak pernah `number` di jalur penyimpanan.
- Waktu: simpan UTC, render `Asia/Jakarta`.
- Idempotency: unique constraint pada `invoiceNumber` / `idempotencyKey` + cek sebelum efek samping.

## 5. Tenant & otorisasi

```
request → authMiddleware (user + session)
        → tenantMiddleware (organizationId dari membership, divalidasi, bukan dari body)
        → requirePermission('registrations.verify')
        → service (semua query memakai organizationId dari context)
```

Body/query **tidak boleh** menentukan `organizationId`. Super admin memakai jalur eksplisit
(`?organizationId=` hanya untuk peran platform) dan aksinya diaudit.

## 6. Dokumentasi API

Swagger di `/api/v1/docs` (dev/staging; produksi di balik auth). Setiap route wajib punya
`summary`, `security`, contoh request/response, dan kode error.

## 7. Yang dipertahankan dari backend lama

| Aset | Alasan |
|---|---|
| `auth.service.ts` (Argon2id, session, lockout, MFA) | sudah teruji, aman |
| `rbac.service.ts` + catalog permission | fondasi RBAC |
| `ticketing.service.ts` (reservasi atomik, cap, check-in, expiry) | invariant mahal, jangan ditulis ulang |
| `ticket-pdf.service.ts` + `ticket-token.ts` | PDF + QR HMAC sudah diverifikasi |
| `audit.service.ts` | kebutuhan compliance |
| `security/*` (crypto, csrf, sanitize, rate-limit, redact) | dipindah, bukan ditulis ulang |
