# Integrasi Midtrans & Google OAuth — `ticket-tnf`

Panduan mengaktifkan pembayaran dan login pembeli. Semua nilai rahasia hanya masuk ke
`ticket-tnf/.env.local` (dev) atau `ticket-tnf/.env` (server). **Jangan** pernah memakai prefix
`NEXT_PUBLIC_` untuk server key.

## Ringkasan yang dibutuhkan

| Variabel | Dari mana | Catatan |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials → OAuth client (Web) | berakhiran `.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | idem | diawali `GOCSPX-` |
| `MIDTRANS_SERVER_KEY` | Midtrans dashboard → Settings → Access Keys | sandbox diawali `SB-Mid-server-`, produksi `Mid-server-` |
| `MIDTRANS_CLIENT_KEY` | idem | sandbox `SB-Mid-client-`, produksi `Mid-client-` |

Lalu: `PAYMENT_PROVIDER=midtrans`, `MIDTRANS_MODE=sandbox|production`,
`MIDTRANS_SNAP_SCRIPT_URL` (`https://app.sandbox.midtrans.com/snap/snap.js` atau
`https://app.midtrans.com/snap/snap.js`), dan `APP_URL` yang benar (dipakai untuk redirect URI
Google + notification URL Midtrans).

## Google Cloud Console

1. Buat project → **APIs & Services → OAuth consent screen**: tipe **External**, isi nama app,
   email support, domain. Scopes: `openid`, `email`, `profile`. Tambahkan test user selama
   status masih *Testing*.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. **Authorized redirect URI** — harus persis:
   `${APP_URL}/api/auth/google/callback`
   Dev: `http://localhost:3010/api/auth/google/callback`
   Produksi: `https://<domain-tiket>/api/auth/google/callback`
   (tanpa trailing slash, `http` vs `https` dianggap beda).
4. Salin client ID + secret ke env. `redirectUri()` di `src/lib/auth/google.ts` menghitung URI yang
   sama dari `APP_URL` — kalau tidak cocok, Google membalas `redirect_uri_mismatch`.

Selama kredensial kosong dan `NODE_ENV !== production`, `isDevAuthEnabled()` aktif: login pembeli
dilewati lewat sesi dev. Di produksi, `assertProductionReady()` menolak start bila kosong.

## Midtrans

1. Daftar → ambil **Server Key** & **Client Key** (sandbox dan produksi terpisah).
2. **Settings → Payment → Notification URL**:
   `${APP_URL}/api/webhooks/midtrans`
   Signature diverifikasi server-side: `SHA512(order_id + status_code + gross_amount + server_key)`.
   Notification yang signature-nya salah ditolak, jadi URL ini wajib HTTPS di produksi.
3. Aktifkan channel yang diinginkan (QRIS, GoPay, Virtual Account, kartu). Metode yang tidak aktif
   tidak akan muncul di Snap meskipun diminta.
4. Snap bersifat **embedded** (bukan redirect): `snap.js` dimuat dari `MIDTRANS_SNAP_SCRIPT_URL`,
   token dibuat server-side, `item_details` memecah addon menjadi baris terpisah.
5. Mode `mock` (`PAYMENT_PROVIDER=mock`) tetap tersedia untuk dev/probe: order dibayar tanpa
   memanggil Midtrans, berguna untuk `pnpm probe`.

## Cara memverifikasi

```bash
cd ticket-tnf
pnpm check:integrations          # offline: bentuk key, konsistensi mode, redirect URI
pnpm check:integrations --live    # + tanya Google & Midtrans sungguhan
```

`--live` memakai dua trik yang tidak mengubah apa pun di sisi penyedia:

- **Google**: menukar `code` palsu ke `oauth2.googleapis.com/token`. Balasan `invalid_grant` =
  client ID/secret **diterima**; `invalid_client` = kredensial salah.
- **Midtrans**: `GET /v2/probe-nonexistent/status` dengan Basic auth server key. `404` = key valid
  (order memang tidak ada); `401` = key salah.

Exit code 1 bila ada pemeriksaan berstatus ❌, sehingga bisa dipakai sebelum `pm2 restart`.

Untuk menguji konfigurasi alternatif tanpa menyentuh `.env.local`:

```bash
ENV_FILE=/tmp/calon-produksi.env pnpm check:integrations --live
```

## Setelah kredensial masuk

1. `pnpm check:integrations --live` → semua ✅ (kecuali `APP_URL` yang masih `http://` di dev).
2. Uji manual: buka `/events/<slug>` → pilih tiket → checkout → Snap terbuka → bayar (sandbox:
   kartu `4811 1111 1111 1114`, OTP bebas) → tiket + PDF terbit.
3. Pastikan webhook masuk: dashboard Midtrans → Transactions → kolom notification, atau cek tabel
   `WebhookEvent`.
4. Baru naikkan `PAYMENT_PROVIDER=midtrans` + key produksi di server, lalu `pm2 restart tfn-ticketing`.
