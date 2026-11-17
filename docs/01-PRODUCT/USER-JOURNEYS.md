# User Journeys

## J1 — Penonton membeli tiket online (implementasi sekarang)

1. Buka `/tickets` → pilih kategori (kuota tampil real-time dari `TicketType.sold`).
2. Isi nama, WhatsApp, email opsional → setuju ketentuan.
3. Submit → order `PENDING_CONFIRMATION`, kuota langsung ditahan (atomik).
4. Dapat **kode pesanan + token** (token hanya tampil sekali).
5. Transfer manual → buka `/tickets/status`, unggah bukti (atau tunjukkan ke admin).
6. Admin verifikasi di `/admin/ticketing` → `CONFIRMED` atau `REJECTED` (kuota kembali).
7. Buka halaman status → unduh **PDF tiket ber-QR**.
8. Datang → petugas scan QR di `/admin/ticketing/scan` → `USED`.

## J2 — Penonton membeli di lokasi (target POS)

1. Kasir login → pilih event → pilih kategori & jumlah.
2. Bayar cash / QRIS → sistem membuat order `CONFIRMED` + tiket ber-QR.
3. Struk dicetak/ditampilkan; tiket bisa langsung dipakai masuk.
4. Shift ditutup → kasir input uang fisik → rekonsiliasi selisih tercatat.

## J3 — Fighter mendaftar (target, belum ada)

1. Buka `/register` (mobile-first) → isi data: nama, NIK, tempat/tanggal lahir, gender, alamat,
   WhatsApp, club, coach, kategori, kelas berat, pengalaman.
2. Unggah foto profil + foto KTP (**storage privat**), isi status BPJS (+ nomor bila perlu).
3. Centang 5 persetujuan → sistem menyimpan `consentVersion`, timestamp, IP, registration ID.
4. Sistem menerbitkan nomor registrasi + invoice unik → bayar Rp200.000 (QRIS).
5. Callback tervalidasi → status pembayaran `Paid`; admin melakukan review dokumen.
6. Admin verifikasi (dokumen, BPJS, consent, kategori) → `Verified`.
7. Fighter masuk antrean matchmaking + baris spreadsheet event.

## J4 — Match coordinator menyusun partai (target)

1. Pilih event → lihat fighter `Verified` per kelas berat.
2. Buat partai: fighter A/B, kelas, kategori, ruleset, nomor partai, jadwal, ronde.
3. Sistem menolak jika fighter punya partai lain yang bentrok waktunya (kecuali override beralasan + audit).
4. Assign referee & judges → honor tercatat di finance.
5. Hasil diisi → diverifikasi → disahkan → ranking & statistik fighter diperbarui dalam satu transaksi.

## J5 — Finance menutup event (target)

1. Review pemasukan: registrasi, tiket, sponsor (masing-masing dengan referensi transaksi).
2. Review pengeluaran: vendor, honor official, sewa, perizinan.
3. Bandingkan budget vs actual per pos.
4. Rekonsiliasi pembayaran gateway (settlement vs sistem).
5. Ekspor laporan event + laporan konsolidasi organisasi.

## J6 — Admin menyiapkan event baru (target)

1. Create event → isi identitas, jadwal, lokasi, kategori, ruleset, periode registrasi,
   konfigurasi tiket, kuota fighter/partai, branding, sponsor, budget, template spreadsheet.
2. Status `Draft` → `Published` → `Registration Open`.
3. Semua nilai dapat diubah tanpa deploy.
