# Panduan Lengkap Instalasi & Deploy TFN di aaPanel (Linux VPS)

Dokumen ini adalah panduan resmi step-by-step untuk melakukan instalasi dan deployment platform **TFN (Temanggung Fight Night)** pada server Linux yang menggunakan **aaPanel**.

---

## 1. Prasyarat Sistem
* **OS:** Ubuntu 22.04 / 24.04 LTS atau Debian 11 / 12
* **Control Panel:** aaPanel (versi 6.8+)
* **Node.js:** Versi 20.x, 22.x, atau 26.x (Install via menu *aaPanel Software Store* → *Node.js Version Manager*)
* **Database:** MySQL 8.x atau MariaDB 10.x bawaan aaPanel (Port default: `3306`)

---

## 2. Langkah-demi-Langkah Instalasi

### Langkah 1: Clone Repositori ke Direktori Server
Masuk ke terminal server aaPanel sebagai `root` atau user web:
```bash
cd /www/wwwroot
git clone https://github.com/B4ckR3d/boxing.git
cd boxing
```

---

### Langkah 2: Buat Database di aaPanel
1. Buka dashboard web aaPanel Anda (`http://IP-SERVER:8888`).
2. Masuk ke menu **Databases** di sidebar kiri → klik tombol **Add Database**.
3. Isi informasi database:
   * **DBName:** `boxing`
   * **DBUser:** `boxing_user`
   * **Password:** *(buat password alfanumerik aman, misalnya `BoxingTfn2026Pass`)*
   * **Access Permission:** Pilih **`Local server`**
4. Klik **Submit**.

> **Tips Penting:** Disarankan menggunakan kombinasi huruf besar, huruf kecil, dan angka tanpa simbol rumit (seperti `@`, `#`, `:`, `/`) agar aman saat dibaca oleh URL connection string database.

---

### Langkah 3: Konfigurasi File Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

Buka dan edit file `.env` (bisa menggunakan `nano .env` atau via menu **Files** aaPanel di `/www/wwwroot/boxing/.env`):
```env
# --- App Configuration ---
NODE_ENV=production
APP_URL=http://127.0.0.1:3000

# --- Database (MySQL Lokal aaPanel Port 3306) ---
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=boxing
MYSQL_USER=boxing_user
MYSQL_PASSWORD=BoxingTfn2026Pass

# Connection string Prisma (Gunakan 127.0.0.1, bukan localhost)
DATABASE_URL="mysql://boxing_user:BoxingTfn2026Pass@127.0.0.1:3306/boxing"

# --- Security Keys ---
AUTH_SECRET=pimpom_tfn_boxing_championship_production_secret_key_2026_32char
ENCRYPTION_KEY=dGZuLWJveGluZy1jaGFtcGlvbnNoaXAtc2VjcmV0LWtleS0yMDI2
STORAGE_DRIVER=local
```
*Simpan perubahan file `.env`.*

---

### Langkah 4: Install Dependencies & Generate Prisma
Jalankan perintah instalasi paket:
```bash
npm install
npm run db:generate
```
> Perintah `db:generate` akan membangun client database internal di `src/generated/prisma`.

---

### Langkah 5: Terapkan Skema Database (`db:deploy`)
Terapkan 30 tabel database resmi ke MySQL aaPanel:
```bash
npm run db:deploy
```
Output sukses akan menampilkan:
```
3 migrations found in prisma/migrations
Applying migration `20261103235119_init_championship_schema`
All migrations have been successfully applied.
```

---

### Langkah 6: Isi Data Awal Platform (`db:seed`)
Isi database dengan petarung elite, sabuk kejuaraan dunia TFN, rankings resmi, turnamen Grand Prix, dan akun Super Admin:
```bash
npm run db:seed
```
Output sukses akan menampilkan:
```
🥊 [Seed] Starting database seed...
  ✔ Seeding permissions...
  ✔ Seeding default roles...
  ✔ Seeding weight classes...
  ✔ Seeding championship belts...
  ✔ Seeding demo fighters...
  ✔ Seeding official rankings...
  ✔ Super admin account verified!
🥊 [Seed] Completed successfully!
```

---

### Langkah 7: Build Aplikasi Next.js untuk Production
Lakukan kompilasi seluruh aset dan kode aplikasi:
```bash
npm run build
```
Tunggu hingga proses selesai dan menghasilkan ringkasan route centang hijau:
```
✔ Generated Prisma Client to ./src/generated/prisma
✓ Compiled successfully
○ / (Static)
ƒ /admin (Dynamic)
○ /belts (Static)
...
```

---

### Langkah 8: Jalankan Website di aaPanel (24/7 Background Service)

Gunakan fitur **Node project** bawaan aaPanel agar website terus aktif otomatis:

1. Buka menu **Website** pada aaPanel → pilih tab **Node project**.
2. Klik tombol **Add Node project**:
   * **Project Name:** `tfn-boxing`
   * **Run User:** `www`
   * **Project Path:** `/www/wwwroot/boxing`
   * **Run Command:** `npm start` *(atau pilih `start`)*
   * **Port:** `3000`
   * **Node version:** Pilih Node `v20`, `v22`, atau `v26`
3. Klik **Submit**.
4. Website TFN akan otomatis berjalan dan berstatus **Running** (Green light).

#### Menghubungkan Domain & SSL:
1. Pada baris project `tfn-boxing`, klik **Domain name**.
2. Masukkan nama domain Anda (misal: `tinju.domainanda.com`).
3. Buka tab **SSL** pada project tersebut → centang domain Anda → pilih **Let's Encrypt** → klik **Apply**.
4. Website Anda kini dapat diakses secara publik dengan HTTPS!

---

## 3. Informasi Akses Portal Admin CMS
Setelah website aktif, login ke Control Room Admin:
* **URL:** `http://DOMAIN-ATAU-IP:3000/admin/login`
* **Email:** `superadmin@boxing.local`
* **Password:** `Demo-Ringside-2026!`
*(Tersedia tombol 1-klik `KREDENSIAL DEMO 1-KLIK` pada layar login).*

---

## 4. Panduan Troubleshooting Error Umum

### A. Error `P1001: Can't reach database server at localhost:3307`
* **Penyebab:** Konfigurasi `.env` masih mengarah ke port Docker `3307`.
* **Solusi:** Edit file `.env`, ubah port menjadi `3306` dan host menjadi `127.0.0.1`:
  ```env
  MYSQL_HOST=127.0.0.1
  MYSQL_PORT=3306
  DATABASE_URL="mysql://boxing_user:password@127.0.0.1:3306/boxing"
  ```

### B. Error `ERR_MODULE_NOT_FOUND: Cannot find module ... generated/prisma/client`
* **Penyebab:** Prisma Client belum di-generate setelah `npm install`.
* **Solusi:** Jalankan perintah berikut di terminal:
  ```bash
  npm run db:generate
  ```

### C. Error `Access denied for user` saat deploy database
* **Penyebab:** Password atau username database tidak cocok dengan yang terdaftar di aaPanel.
* **Solusi:** Buka menu **Databases** di aaPanel, klik ikon kunci (Password) pada database `boxing`, lalu salin ulang password tersebut ke baris `MYSQL_PASSWORD` dan `DATABASE_URL` di file `.env`.

