# Menjalankan TFN di lokal (tanpa Docker)

## 1. Prasyarat
- Node >=20.19 (host verifikasi menggunakan Node 22).
- MySQL 8 atau MariaDB lokal; host ini menggunakan MariaDB 10.11, port 3306.
- `npm ci` dari root project untuk instalasi reproducible.

```bash
cd /home/irhan/Projects/My-Projects/TFN
npm ci
```

Jangan menyalin `node_modules`, `.next` atau `.env` dari komputer lain.

## 2. Database dedicated
Masuk sebagai administrator database, lalu buat database dan user khusus. Ganti `YOUR_RANDOM_PASSWORD` dengan password acak (jangan gunakan contoh untuk produksi).

```sql
CREATE DATABASE tfn_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE tfn_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tfn_app'@'localhost' IDENTIFIED BY 'YOUR_RANDOM_PASSWORD';
GRANT ALL PRIVILEGES ON tfn_local.* TO 'tfn_app'@'localhost';
GRANT ALL PRIVILEGES ON tfn_test.* TO 'tfn_app'@'localhost';
```

Akun runtime ini hanya untuk dua database TFN, bukan `*.*`. Jangan drop/reset database proyek lain. Di produksi gunakan kredensial migrator terpisah dari runtime least-privilege.

## 3. Environment
Salin `.env.example` ke `.env` jika belum ada. Jangan overwrite `.env` existing.

```bash
cp -n .env.example .env
chmod 600 .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Jalankan generator dua kali: isi `AUTH_SECRET` dan `ENCRYPTION_KEY` dengan nilai berbeda. Keduanya wajib; tidak ada fallback secret publik. Isi `MYSQL_*`, `DATABASE_URL`, `TEST_DATABASE_URL` konsisten. Password dengan karakter khusus harus URL-encoded pada URL.

```dotenv
APP_URL=http://localhost:3015
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=tfn_local
MYSQL_USER=tfn_app
MYSQL_PASSWORD=YOUR_RANDOM_PASSWORD
DATABASE_URL=mysql://tfn_app:YOUR_RANDOM_PASSWORD@127.0.0.1:3306/tfn_local
TEST_DATABASE_URL=mysql://tfn_app:YOUR_RANDOM_PASSWORD@127.0.0.1:3306/tfn_test
AUTH_ENFORCE_MFA=false
SEED_DEMO=true
SEED_DEMO_USERS=false
```

`AUTH_ENFORCE_MFA=false` khusus dev lokal; bukan rekomendasi produksi. Untuk produksi enrollment MFA harus diselesaikan dan enforcement diaktifkan. Jangan menetapkan NODE_ENV=development untuk menyamarkan build production.

## 4. Migrasi dan data awal

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
```

- `db:deploy` menerapkan migrasi versioned tanpa reset.
- `SEED_DEMO=true`: konten fiksi untuk demonstrasi; tidak boleh dipublikasikan sebagai data nyata.
- `SEED_DEMO_USERS=true` memerlukan `DEMO_USER_PASSWORD` >=12 karakter. Hanya untuk dev dan ditolak di production. Password akun existing tidak ditimpa saat seed ulang.
- Default yang aman untuk database bersih/produksi: kedua flag demo `false`.

## 5. Membuat satu admin
Isi environment `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PASSWORD` (minimal 12 karakter), lalu:

```bash
npm run admin:bootstrap
```

Script hanya membuat akun eksplisit tersebut dengan super_admin. Tidak menggunakan password bawaan, tidak mencetak password, tidak mengganti password akun existing. Simpan password di password manager; hapus variabel bootstrap dari `.env` setelah sukses.

Untuk instalasi lokal yang disiapkan dalam pekerjaan ini, akun demo aktif dan password acak ada di `.env` sebagai `DEMO_USER_PASSWORD`. Email admin `admin@boxing.local`; jangan memakai kredensial demo di deployment publik.

## 6. Menjalankan aplikasi

```bash
npm run dev -- --hostname 127.0.0.1 --port 3015
```

Buka `http://localhost:3015`, login di `/admin/login`, pemesanan di `/tickets`, pengelolaan di `/admin/ticketing`. Gunakan origin yang sama dengan APP_URL untuk request mutasi. Aplikasi tidak otomatis dapat diakses dari perangkat lain karena binding loopback; jangan buka jaringan publik sebelum hardening.

## 7. Pemeriksaan

```bash
npx prisma validate
npx prisma migrate status
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run build
```

Integration test harus menggunakan database `tfn_test` dedicated, tidak pernah `tfn_local`. Periksa kode setup test sebelum mengeksekusi di lingkungan lain. Build bukan bukti checkout dan login bekerja: lakukan smoke browser sesuai `docs/HANDOVER.md`.

## Troubleshooting
- Login 500: cek service database, `.env` dan migrasi; jangan reset password sebelum menguji koneksi.
- Cookie tidak bertahan: konsisten gunakan localhost atau 127.0.0.1, jangan berganti host. Pada HTTPS production cookie Secure harus disajikan lewat HTTPS.
- Mutasi 403 origin: APP_URL harus sama dengan origin browser; restart server setelah perubahan env.
- MFA enrollment required: jangan mematikan MFA di produksi. Siapkan enrollment dan recovery terkontrol.
- Port terpakai: identifikasi PID/project yang memiliki port; jangan membunuh semua proses node/next.
- Prisma migration drift: backup, investigasi migrasi; jangan menjalankan `db:reset` terhadap data operasional.
