# Keputusan & asumsi pengembangan TFN

## Ruang lingkup
Permintaan pemilik: perbaikan website utama, login, panel admin, transaksi ticketing dengan konfirmasi admin sementara, database lokal, serta dokumentasi yang dapat diteruskan junior programmer/AI.

- Pertahankan Next.js App Router + Prisma + provider MySQL; bukan rewrite framework.
- Lokal menggunakan MariaDB 10.11 yang tersedia pada host, adapter MariaDB dan migrasi MySQL. Uji ulang pada MySQL target sebelum deployment; tidak mengklaim kedua engine identik.
- Database aplikasi `tfn_local`, pengujian `tfn_test`; jangan menggunakan database proyek lain.
- ID existing CUID dipertahankan untuk kompatibilitas histori/FK. Preferensi ULID pemilik tidak diterapkan sebagai migrasi massal tanpa kebutuhan dan rencana kompatibilitas.
- Warna/identitas TFN dipertahankan: cinematic sports, merah, emas, gelap; responsif desktop/mobile.
- Semua konten seed adalah demonstrasi, bukan jadwal/rekor/gelar resmi. Tidak menerima uang riil menggunakan data demonstrasi.
- Ticketing MVP menggunakan pemesanan tamu; tidak perlu sistem akun pembeli baru.
- Pembayaran bukan payment gateway. Nominal ditentukan server dari kategori tiket. Admin memverifikasi pembayaran secara manual; jangan mengarang rekening/QRIS.
- Tiket hanya untuk event published, scheduled, mendatang. Konfirmasi tidak menjadikan data event demo sebagai resmi.
- Tidak ada commit/push/deployment produksi atas nama pemilik.

## Keamanan lokal
- `.env` diabaikan Git dan mode 600, berisi secret acak; tidak dicantumkan dalam dokumentasi.
- `AUTH_ENFORCE_MFA=false` hanya untuk local development karena akun awal belum enrollment. Ini bukan konfigurasi produksi.
- Demo seed eksplisit, dilarang dalam production; password demo harus disuplai, tanpa default. Rerun seed tidak mengganti password akun existing.
- Bootstrap admin hanya satu akun dari BOOTSTRAP_ADMIN_*; akun existing tidak di-reset.

## Batas MVP
Scanner/check-in QR, email otomatis, payment gateway, refund otomatis, penomoran kursi dan reconciliation bank bukan bagian konfirmasi manual awal. Jangan menampilkan kemampuan tersebut sebagai tersedia sebelum implementasi + uji.

## Klaim resmi & sponsor
- Blok "Event resmi" di beranda dan `/tickets` hanya menampilkan mitra yang terdaftar di `src/lib/site/partners.ts`. Menambah logo ke `public/images/partners/` saja tidak cukup — tanpa entri di registry, tidak ada yang dirender.
- Dukungan Pemerintah Kabupaten Temanggung dinyatakan oleh penyelenggara dan disimpan sebagai entri `GOVERNMENT_SUPPORTERS`. Bila dukungan berhenti atau berubah, hapus entri tersebut; jangan biarkan klaim lama beredar.
- Tanpa berkas logo resmi, komponen merender monogram teks (mis. `PEMKAB`), bukan lambang rekaan. Kirim logo resmi ke `public/images/partners/`, lalu set `logo` pada entri terkait.
- Semua tier kosong otomatis disembunyikan, jadi tidak pernah ada slot sponsor palsu di halaman publik.
- Marquee beranda dan ledger "fakta resmi" hanya dekorasi + pengulangan fakta yang sudah ada di registry; jangan menambah klaim baru (mis. nomor SK, tanggal penetapan) sebelum dokumennya benar-benar ada.
