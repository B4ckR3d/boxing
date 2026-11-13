# REST API Documentation — Boxing Championship Platform

> **Status:** v1.0  
> **Source of Truth:** [prd.md](../prd.md)  
> **Base URL:** `/api`  

---

## 1. Authentication Endpoints

### `POST /api/auth/login`
Authenticates user credentials and establishes an HTTP-only secure cookie session.

**Rate Limit:** 10 requests / 15 minutes per email, 30 requests / 15 minutes per IP.

**Request Body:**
```json
{
  "email": "admin@boxing.local",
  "password": "Demo-Ringside-2026!"
}
```

**Response (200 OK — Standard Login):**
```json
{
  "success": true,
  "user": {
    "id": "cm3abc1230000",
    "email": "admin@boxing.local",
    "name": "Platform Admin",
    "roles": ["administrator"]
  }
}
```
*Sets cookie `__Host-bx_session` with HttpOnly, Secure, SameSite=Lax flags.*

**Response (200 OK — MFA Step-Up Required):**
```json
{
  "requiresMfa": true,
  "tempToken": "base64url-temporary-preauth-token"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid email or password"
}
```

**Response (429 Too Many Requests):**
```json
{
  "error": "Too many login attempts. Please wait 450 seconds."
}
```

---

### `POST /api/auth/logout`
Revokes the current active session in the database and clears the session cookie.

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## 2. Public Data Endpoints

### `GET /api/rankings`
Retrieves published official rankings for a specified division or pound-for-pound.

**Query Parameters:**
- `scopeKey` (optional): e.g. `DIV:heavyweight`, `P4P:MALE`

**Response (200 OK):**
```json
{
  "versionNumber": 1,
  "effectiveDate": "2026-11-01T00:00:00.000Z",
  "notes": "Official Heavyweight Divisional Rankings",
  "entries": [
    {
      "rank": null,
      "isChampion": true,
      "fighterName": "Marcus Vale",
      "fighterSlug": "marcus-iron-vale",
      "record": "28-0-0",
      "points": 1500.0,
      "movement": 0
    },
    {
      "rank": 1,
      "isChampion": false,
      "fighterName": "Dario Storm",
      "fighterSlug": "dario-storm",
      "record": "24-1-0",
      "points": 1320.0,
      "movement": 2
    }
  ]
}
```

---

### `GET /api/fighters`
Searchable fighter directory with pagination.

**Query Parameters:**
- `q` (optional): Search query matching first name, last name, or ring alias.
- `division` (optional): Weight class slug.
- `page` (optional, default 1)
- `limit` (optional, default 20)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cm3fgt123000",
      "slug": "marcus-iron-vale",
      "fullName": "Marcus Vale",
      "ringName": "Iron",
      "division": "Heavyweight",
      "nationality": "US",
      "stance": "ORTHODOX",
      "record": "28-0-0",
      "koWins": 24
    }
  ],
  "meta": {
    "total": 6,
    "page": 1,
    "limit": 20
  }
}
```
*Note: Private attributes (`contactEmail`, `contactPhone`, `privateNotes`) are strictly omitted.*

---

## 3. Administrative Mutation Safeguards

All endpoints modifying data require:
1. Valid session with appropriate permission.
2. `x-csrf-token` header matching the active session HMAC.
3. Strict Zod schema validation.
4. Automatic entry generated in `AuditLog` table.


---

## 4. Ticketing Endpoints (public, no login)

Guest checkout is anonymous. Access to an individual order is gated by a one-time **capability
token** returned at creation, not by a session cookie.

### `POST /api/ticketing/orders`

Creates a guest order and atomically reserves capacity.

**Headers:** `Origin` must match `APP_URL` (CSRF check), `content-type: application/json`.

**Body**

| Field | Type | Required | Rules |
|---|---|---|---|
| `eventId` | string (ULID) | yes | published, `SCHEDULED`, `startsAt > now` |
| `ticketTypeId` | string (ULID) | yes | active category of the same event |
| `quantity` | int | yes | 1–10 |
| `customerName` | string | yes | 2–120 chars |
| `customerEmail` | string | yes | valid email, ≤191 |
| `customerPhone` | string | yes | 5–40 chars |
| `paymentMethod` | enum | no | `BANK_TRANSFER` (default) / `QRIS` / `CASH` |
| `reference` | string | no | ≤120; presence sets payment status `PROOF_SUBMITTED` |
| `note` | string | no | ≤500 |

```bash
curl -X POST http://localhost:3015/api/ticketing/orders \
  -H 'Origin: http://localhost:3015' -H 'content-type: application/json' \
  -d '{"eventId":"<ULID>","ticketTypeId":"<ULID>","quantity":2,
       "customerName":"Rina","customerEmail":"rina@example.com",
       "customerPhone":"081399998888","reference":"TRX-001"}'
```

`201 Created`
```json
{ "orderNumber": "TFN-MWEBJJSG-_I9LEO8",
  "capabilityToken": "wrN…9chars",
  "status": "PENDING_CONFIRMATION" }
```

**Errors**

| Status | `error` | Cause |
|---|---|---|
| 400 | `Event tidak valid.` / `Pilih kategori tiket terlebih dahulu.` / `Jumlah tiket harus antara 1 dan 10.` / `Nama pemesan minimal 2 karakter.` / `Alamat email tidak valid.` / `Nomor telepon minimal 5 digit.` / `Metode pembayaran tidak dikenali.` | Zod validation, mapped per field |
| 400 | `Format permintaan tidak valid.` | malformed JSON |
| 400 | `Pesanan tidak dapat dibuat. Coba lagi.` | unexpected server failure (logged as `[ticketing] unexpected failure`) |
| 403 | `Invalid request origin` | `Origin` mismatch |
| 409 | `Kuota tiket tidak mencukupi` (`SOLD_OUT`) | guard `sold <= quota - qty` failed |
| 409 | `Kategori tiket tidak tersedia` (`TICKET_UNAVAILABLE`) / `Tiket hanya tersedia untuk event terjadwal yang dipublikasikan` (`EVENT_UNAVAILABLE`) | category/event not sellable |
| 409 | `Batas pembelian 10 tiket per pembeli untuk kategori <name>. Anda sudah memesan N tiket. Hubungi admin untuk pembelian tambahan.` (`PURCHASE_LIMIT`) | per-buyer cap reached — see below |
| 429 | `Terlalu banyak permintaan` | `rateLimit("publicApi", ip)`, honour `Retry-After` |

**Per-buyer purchase cap** — `MAX_TICKETS_PER_BUYER_PER_CATEGORY = 10`
(`MAX_TICKETS_PER_ORDER` still caps a single request at 10; this caps the sum across requests).

- Scope: one ticket category of one event. A different category, or the same category name in
  another event, has its own budget.
- Counted statuses: `PENDING_CONFIRMATION` (hold) and `CONFIRMED`. `REJECTED` / `CANCELLED` released
  their seats, so they no longer count — a buyer who was rejected may buy again.
- Identity: buyer is recognised by `customerEmail` (case-insensitive) **or** `customerPhone`
  (canonicalised, so `+62 812-3456-7890`, `628123456789`, `812 3456 7890` and `081234567890` are the
  same line — `src/lib/ticketing/buyer-identity.ts`). A refused request reserves nothing: `sold` and
  the order table are untouched.
- Known limitation: the cap is checked read-then-write inside the order transaction, so two truly
  simultaneous requests from one buyer can both pass. Manual confirmation still lets an admin reject
  the duplicate.

### `GET /api/ticketing/orders/[orderNumber]?token=…`

Returns the buyer-facing view of an order.

- `401 {"error":"Token diperlukan"}` when `token` is missing.
- `404 {"error":"Pesanan tidak ditemukan"}` for both wrong tokens and unknown order numbers
  (by design — no enumeration oracle).

**200 shape**
```json
{ "id":"…", "orderNumber":"TFN-…", "status":"PENDING_CONFIRMATION",
  "totalAmount":"700000",
  "event":{ "name":"…", "startsAt":"2026-…" },
  "items":[{ "name":"Tribun Barat","quantity":2,"unitPrice":"350000","subtotal":"700000" }],
  "payment":{ "status":"PROOF_SUBMITTED","method":"BANK_TRANSFER","reference":"TRX-001" } }
```

### `GET /tickets/[orderNumber]/ticket?token=…`

Streams the entry ticket as a PDF (route handler, not JSON). **Confirmed** and already-**used**
orders qualify — a buyer who has passed the gate may still want a copy, and re-downloading cannot
admit anyone twice because check-in reads the database status, not the PDF.

| Status | Body | Cause |
|---|---|---|
| 200 | `application/pdf`, `Content-Disposition: attachment; filename="tiket-<order>.pdf"`, `Cache-Control: private, no-store` | confirmed/used order + valid token |
| 401 | `Token akses wajib diisi.` | missing `token` |
| 404 | `Pesanan tidak ditemukan` | wrong token **or** unknown order (no enumeration) |
| 409 | `Tiket tersedia setelah admin mengonfirmasi pembayaran Anda` | pending / rejected / expired order |

The PDF contains a QR whose payload is `TFN1.<orderNumber>.<HMAC-SHA256(AUTH_SECRET)[:12]>`. Verify it
server-side with `verifyTicketPayload(payload, env().AUTH_SECRET)` from
`src/lib/ticketing/ticket-token.ts` — it returns `{ orderNumber }` or `null`. Payloads are
deterministic per order, so re-downloads are byte-identical for the same issuance day.

```bash
curl -sD- -o /tmp/tiket.pdf \
  "http://localhost:3015/tickets/TFN-XXXX/ticket?token=<capabilityToken>"
head -c 5 /tmp/tiket.pdf   # %PDF-
```

### Admin-only ticketing actions (server actions, not REST)

| Action | File | Permission | Effect |
|---|---|---|---|
| `confirmTicketOrderAction(orderId)` | `src/app/admin/(dashboard)/ticketing/actions.ts` | `ticketing.confirm` | order → `CONFIRMED`, payment → `VERIFIED`, audit entry, `revalidatePath` |
| `rejectTicketOrderAction(orderId, reason)` | same | `ticketing.confirm` | order → `REJECTED`, `sold -= qty` (capacity released), audit entry |
| `saveTicketTypeAction(input, id?)` | same | `ticketing.manage` | create/update a category; refuses quota below `sold` |
| `checkInTicketAction(raw, eventId?)` | `src/app/admin/(dashboard)/ticketing/scan/actions.ts` | `ticketing.confirm` | gate check-in: order → `USED`, sets `checkedInAt`/`checkedInById`, audit `TICKET_CHECKED_IN` |

All four verify `verifyRequestOrigin()` first and return `ActionResult`.

### Gate check-in semantics

`checkInTicketAction` accepts either a signed QR payload (`TFN1.<order>.<hmac>`) or a bare order number
(manual fallback when a camera fails). The payload is verified offline with `verifyTicketPayload()`
before any query, and the transition is a guarded `updateMany` on `status = CONFIRMED`, so concurrent
scans admit exactly one holder.

| Error code | Usher-facing message | Meaning |
|---|---|---|
| `ALREADY_USED` | "Tiket sudah dipakai pada <waktu>. Jangan izinkan masuk dua kali." | order already `USED`; nothing changed |
| `NOT_CONFIRMED` | "Pesanan belum dikonfirmasi. Minta pembeli menyelesaikan pembayaran." | order still `PENDING_CONFIRMATION` |
| `INVALID_STATE` | "Pesanan sudah dibatalkan atau ditolak, tiket tidak berlaku." | order `CANCELLED` or `REJECTED` |
| `WRONG_EVENT` | names the event the ticket belongs to | ticket valid but for another night, when `eventId` scope is set |
| `INVALID_TICKET` | "Tiket tidak valid. Periksa kembali QR tiket atau hubungi admin." | forged signature **or** unknown order — identical code + message, no oracle |
