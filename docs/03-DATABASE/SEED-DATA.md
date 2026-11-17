# Seed Data

> Sumber: `prisma/seed.ts` (24 KB). Dijalankan dengan `npm run db:seed`. Dikendalikan env
> `SEED_DEMO`, `SEED_DEMO_USERS`, `DEMO_USER_PASSWORD`.

## 1. Apa yang di-seed

| Kelompok | Isi |
|---|---|
| Permission & Role | 24 permission, 8 role (`super_admin`, `administrator`, `ranking_manager`, `tournament_manager`, `editor`, `fight_data_manager`, `reviewer`, `viewer`) |
| User demo | 8 akun (`superadmin@boxing.local`, `admin@…`, `rankings@…`, `tournaments@…`, `editor@…`, `data@…`, `reviewer@…`, `viewer@…`) |
| Weight class | 17 kelas (Heavyweight … Mini Flyweight) |
| Fight method | KO, TKO, UD, SD, MD, TD, DQ, NC, DRAW |
| Fighter | 6 fighter demo (Aleksandr Volkov, Carlos Mendoza, Dario Storm, Kenji Arata, Marcus Iron Vale, Tomas Reyes) |
| Belt | 2 sabuk demo (Heavyweight, Welterweight) |
| Event | `WBC-X 42: Night of Champions` + 3 kategori tiket (VIP Ringside, Tribun Barat, Tribun Umum) |
| Tournament | `WBC-X Heavyweight World Grand Prix 2026` (bracket) |
| CMS | Hero slide & section halaman |

## 2. Penting: ini data DEMO, bukan data TFN

Nama event & fighter di atas adalah **konten demo dari fase awal proyek** (sebelum fokus ke TFN).
Produksi saat ini masih menampilkan konten demo ini. Artinya:

- Jangan menganggapnya data pelanggan yang harus dimigrasi.
- Jangan mencampur data demo dengan data TFN Vol. 6 yang sebenarnya tanpa penanda `isDemo`.
- Saat modul Event TFN siap, buat event baru dan **arsipkan** event demo (jangan hapus histori).

## 3. Aturan seed

| Aturan | Alasan |
|---|---|
| Seed idempoten (upsert berdasarkan key unik) | aman dijalankan berulang |
| Jangan pernah memakai data produksi sebagai seed dev | spec §12 |
| Password demo berasal dari env, bukan hardcoded | mencegah kredensial commit |
| `SEED_DEMO_USERS=false` di produksi | hanya bootstrap admin yang boleh ada |
| Data yang di-seed wajib ditandai `isDemo` bila model mendukung | memudahkan pembersihan |

## 4. Seed yang dibutuhkan untuk TFN Vol. 6 (target, belum ada)

Setelah modul konfigurasi event selesai, data berikut diinput lewat dashboard (bukan seed):

- Event TFN VOL. 6: GOR Bambu Runcing, 9 Januari 2027, 13.00–00.00 WIB.
- Periode registrasi & sponsorship, batas match fixing H-3.
- Harga tiket online/on-the-spot (3 kategori), biaya registrasi fighter, biaya dadakan.
- Kategori fighter (Atlet/Non Atlet/Pemula), ruleset (Kickboxing Low Kick, No Strikes Under,
  Freestyle Boxing), kelas berat yang dipertandingkan.
- Struktur anggaran (yang nominalnya sudah pasti) + penanda untuk pos yang belum ditentukan.
- 8 official + konfigurasi honor & rolling.
