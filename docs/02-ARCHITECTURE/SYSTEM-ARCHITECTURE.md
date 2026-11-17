# System Architecture (TARGET)

> **Status: 🟡 rencana.** Belum diimplementasi. Kondisi hari ini = satu app Next.js (lihat
> `FRONTEND-ARCHITECTURE.md` dan `../00-START-HERE/PHASE-0-AUDIT.md` §2).

## 1. Prinsip

- **Modular monolith**: satu deployable API, modul terpisah secara kode, bukan microservices.
- **API-first**: website, admin, POS, worker semuanya konsumen API yang sama.
- **Database-centric**: aturan bisnis dijaga di service + constraint DB, bukan di UI.
- **Multi-tenant ready**: setiap tabel bisnis membawa `organizationId`.
- **Multi-event ready**: data bisnis ter-scope `eventId` bila relevan.

## 2. Topologi target

```
                    ┌──────────────────── Nginx (TLS, rate limit) ────────────────────┐
                    │                                                                 │
  tfn.pimpom.id     │  admin.tfn.pimpom.id     pos.tfn.pimpom.id     api.tfn.pimpom.id │
  ┌──────────┐      │   ┌──────────┐            ┌──────────┐          ┌────────────┐   │
  │ website  │──────┼──▶│  admin   │───────────▶│   pos    │─────────▶│  api       │◀──┼── worker
  │ :3000    │      │   │ :3001    │            │ :3002    │          │ :4000      │   │  (BullMQ)
  └──────────┘      │   └──────────┘            └──────────┘          └─────┬──────┘   │
                    └───────────────────────────────────────────────────────┼──────────┘
                                                                            │
                                    ┌───────────────┬───────────────┬───────┴────────┐
                                    │ MySQL 8       │ Redis 7       │ S3 storage     │
                                    │ (source of    │ (cache, queue,│ (media, KTP,   │
                                    │  truth)       │  rate limit)  │  PDF tiket)    │
                                    └───────────────┴───────────────┴────────────────┘
                                                                            │
                                                              Google Sheets API (output only)
```

## 3. Alur request

1. Client → Nginx (TLS, gzip, rate limit kasar, security header).
2. Nginx → app tujuan (static/SSR Next.js atau API Express).
3. App → `api.tfn.pimpom.id` dengan access token (cookie httpOnly atau bearer, tergantung keputusan ADR-002).
4. API: `middleware → auth → tenant context → validation (Zod) → controller → service → repository → Prisma`.
5. Response mengikuti envelope standar (`04-API/API-STANDARDS.md`).

## 4. Batas modul (modular monolith)

```
auth · users · organizations · events · fighters · clubs · registrations · payments
ticketing · pos · matches · championships · rankings · officials · sponsorships
finance · workflows · spreadsheets · reports · notifications · audit
```

Aturan: modul **tidak** mengimpor repository modul lain. Komunikasi lewat service publik modul
(interface) atau event internal. Tujuannya agar suatu hari bisa dipisah tanpa rewrite.

## 5. Worker (async)

| Job | Pemicu | Sifat |
|---|---|---|
| `ticket.hold.expire` | cron (sudah ada versi script) | idempoten |
| `payment.reconcile` | cron + manual | idempoten |
| `spreadsheet.sync` | setelah registrasi/order berubah | retry + log |
| `notification.send` | event domain | retry |
| `report.export` | permintaan admin | one-shot |
| `ranking.recalculate` | hasil disahkan | transaksional |

Semua job wajib idempoten dan punya log (`WorkflowLog` / `SpreadsheetSyncLog`).

## 6. Keputusan yang belum diambil

1. Auth lintas subdomain: cookie ber-`Domain=.tfn.pimpom.id` vs bearer token per app (ADR-002).
2. Apakah website tetap RSC memanggil API internal (server-side fetch) — ya untuk SEO, tapi butuh
   service token, bukan cookie browser.
3. Strategi migrasi bertahap dari Next.js fullstack (ADR-001, opsi B).
