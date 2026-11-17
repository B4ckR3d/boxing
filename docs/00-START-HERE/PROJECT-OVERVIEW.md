# Project Overview — TFN Management Platform

## Apa ini

Platform manajemen penyelenggaraan kompetisi combat sports untuk **Temanggung Fight Night (TFN)**.
Bukan website event sekali pakai: satu platform yang dipakai berulang untuk TFN Vol. 6, Vol. 7,
Vol. 8, Championship, dan special event — dan dirancang agar kelak bisa dipakai organisasi lain
(multi-tenant).

## Masalah yang diselesaikan

| Masalah nyata | Solusi di platform |
|---|---|
| Pendaftaran fighter lewat WhatsApp/spreadsheet → data hilang, dobel, sulit diaudit | Registrasi online + database fighter permanen + consent versioned |
| Verifikasi pembayaran manual tanpa jejak | Invoice unik, abstraksi payment gateway, webhook tervalidasi, audit log |
| Tiket dijual manual, kuota tidak terkontrol, penonton bisa masuk dua kali | Ticketing berkuota atomik, QR bertanda tangan, check-in sekali pakai |
| Keuangan event dicatat di spreadsheet terpisah | Finance per event + laporan konsolidasi organisasi |
| Rekap panitia & sponsor tersebar | Reporting + spreadsheet automation (Sheets sebagai output, bukan database) |
| Event baru = ubah kode | Semua konfigurasi event dikelola dari dashboard |

## Siapa penggunanya

- **Publik** — calon penonton, fighter, klub, sponsor: website `tfn.pimpom.id`.
- **Panitia/organizer** — admin, event manager, registration admin, match coordinator, finance: dashboard `admin.tfn.pimpom.id`.
- **Kasir lokasi** — penjualan & validasi tiket: `pos.tfn.pimpom.id`.
- **Official** — wasit/juri: menerima penugasan, mengisi hasil.
- **Super admin platform** — organisasi, user, role, konfigurasi.

## Ruang lingkup produk (ringkas)

Public Website · Admin Dashboard · POS Tiket · Registrasi Fighter · Database Fighter · Event ·
Match · Championship · Ranking · Ticketing · Payment · Sponsorship · Finance · Workflow ·
Spreadsheet Automation · Reporting · User & Permission.

> **Batasan tegas:** POS **hanya** menjual tiket. Tidak ada katalog/penjualan makanan atau minuman,
> tidak ada modul stok F&B. VVIP boleh punya fasilitas tambahan, tetapi tidak dikelola sebagai
> transaksi POS.

## Status hari ini (jujur)

| Area | Status |
|---|---|
| Public website + CMS + fighter/ranking/belt/tournament | **Sudah jalan** (live di produksi) |
| Ticketing (guest checkout, PDF+QR, check-in, hold expiry) | **Sudah jalan** |
| Auth + RBAC + audit log | **Sudah jalan** |
| Organisasi/multi-tenant | **Belum ada** |
| Registrasi fighter + dokumen sensitif | **Belum ada** |
| Payment gateway, POS, finance, sponsorship komersial, Sheets, workflow | **Belum ada** |

Detail bukti: `PHASE-0-AUDIT.md`. Status per task: `../11-DEVELOPMENT-LOG/TASK-TRACKER.md`.

## Prinsip yang tidak boleh dilanggar

1. **Satu backend API, satu database.** MySQL = single source of truth.
2. **Uang tidak boleh floating point**, transaksi finansial selalu dalam DB transaction.
3. **Data sensitif (NIK/KTP/BPJS) tidak pernah publik** dan tidak pernah masuk folder `public/`.
4. **Status pembayaran hanya dari callback tervalidasi / rekonsiliasi**, bukan dari redirect.
5. **Fitur belum selesai tidak ditulis sebagai selesai** di dokumentasi.
