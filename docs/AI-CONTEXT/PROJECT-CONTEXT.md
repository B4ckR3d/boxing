# Project Context

Ringkasan padat agar sesi baru langsung nyambung.

## Bisnis

Temanggung Fight Night (TFN) — promotor combat sports di Temanggung, Jawa Tengah.
Event berikutnya: **TFN Vol. 6, 9 Januari 2027, GOR Bambu Runcing, 13.00–00.00 WIB**
(referensi Vol. 5 = 37 partai). Butuh sistem untuk pendaftaran fighter, penjualan tiket,
matchmaking, keuangan event, dan sponsor — dipakai ulang untuk edisi berikutnya.

## Pengguna

Publik (penonton/fighter/klub/sponsor) · panitia (admin, event manager, registration admin,
match coordinator, ticketing, finance, sponsorship) · kasir POS · official (wasit/juri) ·
super admin platform.

## Angka yang sudah pasti (default TFN Vol. 6)

| Item | Nilai |
|---|---|
| Registrasi fighter | Rp200.000 |
| Fighter dadakan | Rp50.000 |
| Tiket online | 20k / 50k / 100k (Regular/VIP/VVIP) |
| Tiket on-the-spot | 30k / 60k / 110k |
| Hadiah juara 1 / 2 | Rp1.000.000 / Rp500.000 |
| Honor wasit / chief | Rp500.000 / Rp1.000.000 |
| Official | 8 orang, rolling |
| Perizinan / Ring / GOR | 500k / 7.500k / 2.000k |
| BPJS | Rp16.000/orang (perlu verifikasi, bukan otomatis) |

Belum ditentukan: ring oktagon, gelang anti air, ID card panitia, trophy juara umum, medal lanyard,
tanggal sponsorship open (2025 sudah lewat), kriteria kategori Atlet/Non Atlet/Pemula.

## Batasan produk

- POS **hanya tiket** (tanpa F&B).
- Spreadsheet = output, MySQL = sumber kebenaran.
- Ranking hanya dari hasil yang disahkan.
- Dokumen pribadi fighter tidak pernah publik.

## Kondisi teknis

Satu app Next.js 16 (App Router) + Prisma 7 + MySQL, 13,5k LOC, 40 model, 75 unit test lulus,
ticketing & admin berjalan di produksi. Rekonstruksi ke monorepo + Express API direncanakan
(ADR-001, belum disetujui).

## Dokumen kunci

`00-START-HERE/PHASE-0-AUDIT.md` · `01-PRODUCT/BUSINESS-RULES.md` · `03-DATABASE/DATABASE-DESIGN.md`
· `11-DEVELOPMENT-LOG/TASK-TRACKER.md` · `AI-CONTEXT/NEXT-TASKS.md`.
