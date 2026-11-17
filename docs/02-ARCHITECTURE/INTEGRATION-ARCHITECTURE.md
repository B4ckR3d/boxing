# Integration Architecture (TARGET)

> **Status: 🟡 rencana.** Saat ini belum ada integrasi eksternal aktif (payment masih manual,
> Google Sheets belum ada, notifikasi belum ada). S3 SDK sudah terpasang tetapi belum dipakai untuk
> unggah dokumen privat.

## 1. Payment provider (provider-independent)

```ts
interface PaymentProvider {
  readonly key: string;                    // 'qris-static' | 'midtrans' | ...
  createCharge(input: ChargeInput): Promise<ChargeResult>;   // invoice, qrString/redirectUrl, expiry
  verifyWebhook(raw: Buffer, headers: Record<string,string>): WebhookEvent; // signature check
  getStatus(providerRef: string): Promise<NormalizedStatus>;
  refund(providerRef: string, amount: Decimal): Promise<RefundResult>;
}
```

Aturan:

1. Business logic **tidak** boleh tahu nama provider.
2. `Payments` menyimpan `provider`, `providerRef`, `idempotencyKey`, `amount`, `status` ternormalisasi.
3. Webhook: verifikasi signature → simpan raw payload → proses idempoten (unique `providerEventId`)
   → jangan pernah percaya status dari redirect frontend.
4. Status normalisasi: `PENDING · PAID · EXPIRED · FAILED · REFUNDED · PARTIALLY_REFUNDED`.
5. Rekonsiliasi harian: bandingkan status provider vs DB, laporkan selisih (jangan auto-ubah tanpa jejak).

## 2. QRIS

- QRIS dinamis per invoice (bila penyedia mendukung), atau QRIS statis + verifikasi manual sebagai fallback.
- Nominal unik (kode unik) untuk memudahkan rekonsiliasi transfer.
- Semua pembayaran tetap punya invoice unik di DB.

## 3. Google Sheets (output, bukan sumber kebenaran)

```
MySQL (truth) → job sync (BullMQ) → Google Sheets (view/rekap)
                    │
                    ├── SpreadsheetSyncLog (rows, status, error, duration)
                    └── retry backoff + manual resync
```

Aturan: perubahan manual di spreadsheet **tidak** boleh mengalir balik ke MySQL pada fase awal
(satu arah). Bila kelak butuh dua arah, butuh konflik-resolution eksplisit.

## 4. Object storage (dokumen & media)

| Jenis | Bucket/prefix | Akses |
|---|---|---|
| Foto profil, poster, logo sponsor | `public/` | CDN publik |
| KTP, dokumen BPJS, bukti transfer | `private/org/<id>/...` | signed URL berumur pendek + permission |

Aturan: file privat **tidak pernah** masuk `public/` aplikasi; validasi MIME + ukuran; nama file
di-generate, bukan dari input user; hapus mengikuti kebijakan retensi.

## 5. Notifikasi

Kanal: WhatsApp (opsional, biaya per pesan), email (transaksional). Pola: job queue + template +
status kirim + retry. Jangan memblokir request HTTP utama karena pengiriman pesan.

## 6. Observability integrasi

Setiap integrasi wajib: log terstruktur (request id, provider ref), metrik kegagalan, alert saat
webhook gagal > N kali, dan halaman admin untuk melihat log integrasi.
