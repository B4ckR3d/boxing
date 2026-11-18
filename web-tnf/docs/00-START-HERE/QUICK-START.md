# Quick Start

> Kondisi per Phase 0: **database lokal belum siap** (lihat §0). Ikuti langkah pemulihan dulu.

## 0. Perbaiki database lokal (wajib, sekali)

Gejala: `Access denied for user 'boxing_user'`, `docker ps` tidak menampilkan container MySQL TFN,
atau aplikasi error `pool failed to retrieve a connection`.

Penyebab yang ditemukan saat audit:
- MariaDB sistem memakai `127.0.0.1:3306`, sedangkan `.env` juga menunjuk 3306.
- Docker volume `tfn_boxing_mysql_data` baru dibuat dan **kosong** (0 tabel).

Perbaikan yang disarankan (belum dieksekusi — menunggu persetujuan):

```bash
cd ~/Projects/My-Projects/TFN

# 1) pakai port 3307 untuk MySQL Docker (hindari bentrok MariaDB sistem)
#    ubah .env:  MYSQL_PORT=3307  dan DATABASE_URL=mysql://...@127.0.0.1:3307/boxing

# 2) jalankan DB
npm run db:up
npm run db:wait

# 3) buat schema + data demo
npm run db:deploy
npm run db:seed
```

## 1. Install & jalankan (kondisi normal)

```bash
cd ~/Projects/My-Projects/TFN
npm install                 # postinstall: prisma generate
npm run dev -- --port 3015  # http://localhost:3015
```

`.env` penting:

| Key | Fungsi |
|---|---|
| `APP_URL` | **Harus sama persis** dengan URL yang dibuka. Login/mutasi menolak `Origin` berbeda → 403. |
| `MYSQL_*` / `DATABASE_URL` | Koneksi DB dev |
| `TEST_DATABASE_URL` | DB khusus integration test (jangan DB dev) |
| `AUTH_SECRET`, `ENCRYPTION_KEY` | Signing session + enkripsi TOTP. **Rotasi = semua sesi & PDF tiket lama invalid.** |
| `DEMO_USER_PASSWORD` | Password user demo hasil seed |

## 2. Akun demo (hasil seed)

| Email | Role |
|---|---|
| `superadmin@boxing.local` | super_admin |
| `admin@boxing.local` | administrator |
| `editor@boxing.local` | editor |
| `reviewer@boxing.local` | reviewer |
| `viewer@boxing.local` | viewer |

Password: nilai `DEMO_USER_PASSWORD` di `.env`.

## 3. Gate verifikasi

```bash
npm run typecheck && npm run lint && npm run test:all && npm run build
```

Integration test butuh `TEST_DATABASE_URL` yang sudah dimigrasi:

```bash
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```

## 4. Halaman penting

| URL | Isi |
|---|---|
| `/` | Landing sinematik |
| `/tickets` | Beli tiket (guest) |
| `/tickets/status` | Cek pesanan dengan kode + token |
| `/fighters`, `/rankings`, `/belts`, `/grand-prix`, `/events`, `/fights` | Publik |
| `/admin` | Dashboard (redirect ke login bila anonim) |
| `/admin/ticketing` | Konfirmasi/tolak pesanan |
| `/admin/ticketing/scan` | Check-in onsite |
| `/admin/sponsors` | Kelola sponsor |

## 5. Jangan lakukan ini

- Jangan `prisma migrate reset` pada DB yang berisi data yang mau disimpan.
- Jangan menjalankan script `scripts/verify/*` pada DB produksi (script menulis baris nyata).
- Jangan menambahkan file ke `public/` lalu berharap `next start` yang sudah jalan menyajikannya —
  restart server.
