# Business Objectives

## Tujuan bisnis

1. **Satu sistem untuk semua edisi** — TFN Vol. 6 dan seterusnya dijalankan dari platform yang sama,
   tanpa deploy kode baru per event.
2. **Data fighter permanen** — riwayat, statistik, dan identitas bertahan lintas event.
3. **Uang yang bisa diaudit** — setiap rupiah punya sumber transaksi + referensi; tidak ada
   pencatatan ganda.
4. **Kuota tiket terkendali** — tidak oversell, tidak ada kursi "hilang" karena hold menggantung.
5. **Operasional hari-H cepat** — kasir & gate bisa bekerja dari HP/tablet.
6. **Kredibilitas** — ranking hanya berubah dari hasil pertandingan yang disahkan; dokumen fighter privat.
7. **Siap tumbuh** — organisasi lain bisa memakai platform tanpa fork kode.

## Metrik keberhasilan (terukur)

| Metrik | Target awal | Cara ukur |
|---|---|---|
| Waktu proses pendaftaran → terverifikasi | < 10 menit kerja admin per fighter | workflow log |
| Oversell tiket | **0** | invariant `TicketType.sold` vs kuota, test paralel |
| Duplikasi pembayaran | **0** | idempotency key + unique invoice |
| Pemasukan event tercatat lengkap | 100% transaksi punya referensi | query finance: transaksi tanpa `sourceId`/`reference` = 0 |
| Waktu check-in per penonton | < 3 detik | probe lapangan |
| Ranking berubah tanpa hasil resmi | **0** | audit `RankingChangeLog` |

## Bukan tujuan (non-goals)

- Menjual makanan/minuman (POS hanya tiket).
- Menjadi marketplace tiket multi-promotor pada rilis pertama.
- Menggantikan akuntansi penuh (pajak, neraca) — finance di sini untuk kontrol event, bukan laporan pajak.
