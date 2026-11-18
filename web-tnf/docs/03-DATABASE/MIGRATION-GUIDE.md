# Migration Guide

## 1. Aturan umum

| Aturan | Alasan |
|---|---|
| Satu migration = satu perubahan logis | rollback & review lebih mudah |
| Tidak ada migration destruktif tanpa backup + rencana rollback | data hilang tidak bisa dipulihkan |
| Migration produksi **tidak** dijalankan otomatis oleh aplikasi | sesuai spec §20 |
| Setiap migration wajib diuji di DB kosong **dan** DB berisi data | backfill sering lupa |
| Nama migration deskriptif | `add_registration_consent_version`, bukan `update` |

## 2. Alur kerja

```bash
# dev
npx prisma migrate dev --name <deskriptif>

# staging / produksi (via prosedur deploy)
npx prisma migrate deploy
```

Urutan deploy produksi: backup → deploy kode (build) → `migrate deploy` → health check → smoke test →
baru traffic penuh. Rollback: rollback kode dulu (migration dibuat kompatibel ke belakang), restore
backup hanya bila data rusak.

## 3. Pola aman untuk perubahan kolom

| Perubahan | Langkah aman |
|---|---|
| Tambah kolom NOT NULL | 1) tambah nullable → 2) backfill → 3) ubah NOT NULL (migration terpisah) |
| Rename kolom | tambah kolom baru → dual-write → backfill → hapus lama (3 rilis) |
| Hapus kolom | pastikan tidak dipakai kode versi sebelumnya (cek dulu), backup, baru hapus |
| Ubah tipe uang | jangan pernah `Float → Decimal` langsung tanpa audit nilai; konversi eksplisit + verifikasi |
| Tambah `organizationId` | tambah nullable → backfill ke organisasi default → NOT NULL + FK + index |
| Index baru pada tabel besar | ukur dampak; jalankan di jam sepi |

## 4. Migrasi dari project lama (Next.js fullstack → monorepo)

**Konteks audit:** tidak ada data bisnis nyata (produksi masih data demo seed). Karena itu migrasi
data bersifat **ringan**; yang perlu dijaga adalah kontinuitas kode & konten, bukan tabel pelanggan.

### Strategi (ADR-001 opsi B — strangler)

| Tahap | Isi | Data |
|---|---|---|
| M1 | Bekukan repo lama; tag rilis; backup DB produksi (`scripts/db-backup.mjs`) | backup `.sql` |
| M2 | Buat monorepo, `packages/*`, `apps/api` skeleton; **schema Prisma dipindah apa adanya** | schema sama → tidak ada migrasi data |
| M3 | Tambah `Organization` + backfill organisasi "TFN" + `organizationId` ke tabel bisnis | migration bertahap |
| M4 | Pindahkan `ticketing`, `auth`, `rbac`, `media` ke API; app lama memanggil API | data tetap |
| M5 | Bangun modul baru (registrasi, payment, POS, finance) langsung di API | data baru mulai masuk di DB target |
| M6 | Pindahkan website/admin ke app terpisah; app lama diarsipkan | verifikasi parity |

### Yang harus dipertahankan

- 6 fighter demo & 1 event demo (boleh tetap sebagai data demo, ditandai `isDemo`).
- Konfigurasi event TFN Vol. 6 (akan diinput ulang lewat dashboard setelah modul event siap).
- `AUTH_SECRET`/`ENCRYPTION_KEY` **jika** ingin sesi & tiket PDF lama tetap valid — kalau tidak, rotasi
  dan dokumentasikan.

### Yang tidak boleh dilakukan

- Menghapus project lama sebelum M1–M2 selesai dan backup diverifikasi.
- Menjalankan `prisma migrate reset` pada DB produksi.
- Menyalin data produksi ke DB development (spec §12). Gunakan data seed.

## 5. Checklist sebelum migration ke produksi

- [ ] Backup terbaru + **uji restore** ke DB lain
- [ ] Migration diuji pada salinan data produksi (bukan hanya DB kosong)
- [ ] Estimasi downtime & window deploy disepakati
- [ ] Health check + smoke test disiapkan
- [ ] Rollback plan tertulis (kode + data)
