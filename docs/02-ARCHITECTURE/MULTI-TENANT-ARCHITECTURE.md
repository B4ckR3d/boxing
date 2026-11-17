# Multi-Tenant Architecture (TARGET)

> **Status: 🟡 belum diimplementasi.** Hari ini tidak ada entitas organisasi; `OrganizationSetting`
> hanyalah key-value singleton milik satu organisasi.

## 1. Model tenancy

**Shared database, shared schema, discriminator `organizationId`.** Alasan: volume data kecil,
operasional sederhana, biaya rendah; isolasi ditegakkan di backend (bukan mengandalkan UI).

```
Organization (tenant)
  ├── OrganizationMember (userId, roleId, status)
  ├── Event (organizationId)
  │     ├── Registration (organizationId, eventId)
  │     ├── Match (organizationId, eventId)
  │     ├── TicketType / TicketOrder (organizationId, eventId)
  │     ├── Budget / Income / Expense (organizationId, eventId)
  │     └── SponsorshipAgreement (organizationId, eventId)
  ├── Fighter (organizationId)      ← global dalam organisasi, lintas event
  └── Club / Coach / Official (organizationId)
```

## 2. Aturan wajib

| # | Aturan |
|---|---|
| MT-01 | Setiap tabel bisnis punya `organizationId` (FK, indexed, NOT NULL) |
| MT-02 | `organizationId` **selalu** diambil dari sesi/membership, tidak dari body/query |
| MT-03 | Setiap query repository menyertakan filter `organizationId` — diuji dengan test deny |
| MT-04 | Unique constraint bersifat per-tenant: `@@unique([organizationId, slug])` |
| MT-05 | Super admin platform memakai jalur eksplisit + audit log |
| MT-06 | File storage memakai prefix `org/<organizationId>/...` |
| MT-07 | Job worker membawa `organizationId` di payload dan memvalidasinya |
| MT-08 | Test otomatis wajib membuktikan organisasi A gagal membaca data B (404/403, bukan data kosong diam-diam) |

## 3. Bahaya yang harus dihindari

- **Cross-tenant leak lewat ID**: CUID tidak menjamin otorisasi. Selalu cek kepemilikan.
- **Aggregate tanpa filter**: dashboard konsolidasi hanya untuk peran yang berhak.
- **Cache key tanpa tenant**: prefix cache wajib memuat `organizationId`.
- **Unique global**: `slug` event harus unik per organisasi, bukan global.

## 4. Rencana implementasi

1. Tambah model `Organization`, `OrganizationMember`, dan `organizationId` ke tabel bisnis
   (migration bertahap + backfill ke organisasi default "TFN").
2. Tambah `tenantMiddleware` + helper repository `scoped(organizationId)`.
3. Ubah semua query di modul yang sudah ada; setiap modul butuh test isolasi.
4. Baru setelah isolasi terbukti, buka fitur "buat organisasi baru" di UI.
