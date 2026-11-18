# API Standards

> Berlaku untuk `apps/api` dan route handler Next.js yang masih ada.

> ⚠️ **Koreksi status (17 Nov 2026, dibaca dari kode).** Dokumen ini sebelumnya menulis envelope
> `{ "success": true, "data": … }` — **envelope itu tidak pernah diimplementasikan di mana pun**.
> Route handler Next.js existing mengembalikan `{ "error": "string" }`, sedangkan `apps/api`
> mengembalikan `{ "error": { code, message, details, requestId } }`. Yang **berlaku sekarang**
> adalah §2a. Envelope lama dipindah ke §2b sebagai usulan yang ditolak (ADR-010).

## 1. Base & versi

```
https://api.tfn.pimpom.id/api/v1
```

Versi di path. Perubahan breaking → `v2`; penambahan field bersifat aditif (tidak menaikkan versi).

## 2a. Envelope yang BERLAKU (`apps/api`)

Sukses: JSON domain langsung, tanpa pembungkus — mis.
`{"status":"ready","checks":{"database":"up"}}`.

Gagal: **selalu** bentuk yang sama, dengan `requestId` untuk korelasi log ↔ response:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Route GET /nope tidak ditemukan",
    "details": null,
    "requestId": "628dc65d-d399-4f33-89ed-302f2e3b2c5a"
  }
}
```

Kode yang sudah dipakai: `BAD_REQUEST` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403,
`NOT_FOUND` 404, `CONFLICT` 409, `VALIDATION_ERROR` 422, `INTERNAL_ERROR` 500,
`SERVICE_UNAVAILABLE` 503. Error 5xx **tidak** membocorkan `message` internal (hanya di log
server); `details` hanya untuk pesan yang aman ditampilkan.

## 2b. Envelope usulan lama — DITOLAK (ADR-010)

Tidak dipakai. Disimpan hanya sebagai catatan sejarah:

Sukses:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "meta": null
}
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "field": "nik", "message": "NIK harus 16 digit" }],
  "code": "VALIDATION_ERROR"
}
```

Aturan:
- `message` untuk manusia (Bahasa Indonesia, kalimat utuh). `code` untuk mesin.
- Jangan pernah mengirim stack trace / pesan Prisma mentah ke client.
- Field `errors` hanya berisi pesan yang aman ditampilkan.

## 3. HTTP status

| Kode | Kapan |
|---|---|
| 200 | sukses baca/ubah |
| 201 | resource dibuat |
| 204 | sukses tanpa body |
| 400 | validasi / payload salah |
| 401 | belum terautentikasi |
| 403 | terautentikasi tapi tidak berhak |
| 404 | tidak ada **atau** tidak boleh dilihat (hindari oracle) |
| 409 | konflik domain (kuota habis, duplikat, batas pembelian) |
| 422 | aturan bisnis ditolak (opsional, konsisten per modul) |
| 429 | rate limit |
| 500 | bug — tidak boleh dipakai untuk kesalahan bisnis |

## 4. Pagination, filter, sort, search

```
GET /api/v1/registrations?page=1&perPage=20&sort=-createdAt&status=VERIFIED&q=budi
```

```json
{ "success": true, "data": [], "meta": { "page": 1, "perPage": 20, "total": 137, "totalPages": 7 } }
```

`perPage` maksimum 100. Field sort di-whitelist (tidak boleh meneruskan string mentah ke Prisma).

## 5. Idempotency

Header `Idempotency-Key` wajib untuk endpoint yang membuat pembayaran/order/refund. Perilaku:
kunci sama + payload sama → kembalikan respons pertama; kunci sama + payload beda → `409`.

## 6. Keamanan request

- Semua endpoint non-publik: auth + permission.
- Mutasi: origin/CSRF check (selama memakai cookie).
- Rate limit per IP + per user pada endpoint sensitif (auth, checkout, registrasi, webhook).
- Ukuran body dibatasi; upload divalidasi MIME + ukuran.

## 7. Webhook

- Raw body dipertahankan untuk verifikasi signature.
- Verifikasi signature → simpan `providerEventId` unik → proses idempoten → `200`.
- Jangan memproses ulang event yang sama.
- Selalu log payload mentah (dengan redaksi data sensitif).

## 8. Dokumentasi

Setiap endpoint wajib di Swagger: `summary`, `security`, parameter, contoh request, contoh response
sukses + minimal satu error. CI gagal bila route tanpa anotasi (target).
