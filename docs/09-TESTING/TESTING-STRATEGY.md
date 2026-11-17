# Testing Strategy

## 1. Piramida yang dipakai

| Level | Alat | Cakupan | Butuh DB |
|---|---|---|---|
| Unit | Vitest (`--project unit`) | logika murni, validasi, token, RBAC, sanitasi | tidak |
| Integration | Vitest (`--project integration`) | service + Prisma + transaksi | ya (`TEST_DATABASE_URL`) |
| E2E / probe | Playwright + script `.cjs` | alur nyata di build produksi | ya + server |
| Manual lapangan | checklist | POS, gate, proyektor | — |

## 2. Status hari ini

| Suite | Jumlah | Status |
|---|---|---|
| Unit | 75 test / 15 file | ✅ lulus (17 Nov 2026) |
| Integration | 5 file (ticketing, check-in, hold-expiry, ticket-artifact, buyer-cap) | ⚠️ tidak bisa dijalankan saat audit (DB lokal tidak tersedia) |
| Probe browser | `scripts/verify/*.cjs` (e2e-ui, e2e-final, layout, official-support, sponsor-e2e, checkin-e2e) | perlu `npm run start -p 3015` |

## 3. Prioritas pengujian (spec §19)

1. Authentication & session.
2. **Tenant isolation** (wajib begitu tenant ada: buktikan A gagal baca B).
3. Registrasi fighter (validasi NIK, consent, upload privat).
4. Payment (idempotency, webhook signature, status normalisasi).
5. Webhook (replay, signature salah, payload rusak).
6. Ticket generation & QR validation.
7. Check-in (double scan, concurrency).
8. Transaksi finansial (tidak ada double income, koreksi tidak menghapus).
9. Sinkronisasi spreadsheet (retry, log, gagal tidak merusak data utama).

## 4. Aturan

| Aturan | Alasan |
|---|---|
| Test DB terpisah (`TEST_DATABASE_URL`) | jangan pernah menyentuh DB dev/produksi |
| Test membersihkan dirinya (residue 0) | bukti: `scripts/verify/db-residue.sh` |
| Skipped/timed-out ≠ lulus | kejujuran status |
| Test authorization wajib termasuk deny-path | permission bocor tidak terlihat dari happy path |
| Uji invariant dengan concurrency nyata (paralel) | oversell tidak muncul di test serial |
| Test untuk bug yang diperbaiki (regression) | mencegah kambuh |

## 5. Gate sebelum menyatakan selesai

```bash
npm run typecheck && npm run lint && npm run test:all && npm run build
```

Lalu jalankan probe yang relevan pada **build produksi** (`npm run start`, bukan `dev`).
