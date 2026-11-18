# Business Rules

> Sumber angka: master instruction proyek. **Semua nilai harus bisa diubah dari dashboard** —
> angka di dokumen ini adalah nilai awal (default) TFN Vol. 6, bukan konstanta kode.

## 1. Konfigurasi event TFN Vol. 6

| Item | Nilai awal | Catatan |
|---|---|---|
| Nama event | TEMANGGUNG FIGHT NIGHT | — |
| Edisi | TFN VOL. 6 | — |
| Lokasi | GOR BAMBU RUNCING | — |
| Jam | 13.00 – 00.00 WIB | — |
| Tanggal event | 9 Januari 2027 | UTC di DB, render `Asia/Jakarta` |
| Registrasi dibuka | 20 November 2026 | — |
| Sponsorship dibuka | 20 November 2025 | ⚠️ **NEEDS CLARIFICATION** — tanggal sudah lewat saat proyek dikembangkan |
| Final match fixing | 15 Desember 2026 | — |
| Batas match | H-3 tanggal event | dihitung dari tanggal event |
| Referensi | TFN Vol. 5 = 37 partai | target jumlah partai |

## 2. Biaya & harga

| Item | Harga |
|---|---|
| Registrasi fighter | Rp200.000 |
| Fighter dadakan (on-site) | Rp50.000 |
| Tiket online — Regular / VIP / VVIP | Rp20.000 / Rp50.000 / Rp100.000 |
| Tiket on the spot — Regular / VIP / VVIP | Rp30.000 / Rp60.000 / Rp110.000 |
| Hadiah juara 1 | Rp1.000.000 |
| Hadiah juara 2 | Rp500.000 |
| Honor wasit | Rp500.000 |
| Honor chief | Rp1.000.000 |

VVIP mendapat fasilitas tambahan sesuai keputusan penyelenggara — **tidak** dikelola sebagai
penjualan makanan/minuman di POS.

## 3. Anggaran event (nilai awal, dapat diubah)

| Pos | Nominal | Status |
|---|---|---|
| BPJS Ketenagakerjaan | Rp16.000/orang | ⚠️ jangan dianggap kewajiban otomatis — perlu konfigurasi & verifikasi ketentuan |
| Perizinan | Rp500.000 | pasti |
| Ring Boxing | Rp7.500.000 | pasti |
| Sewa GOR | Rp2.000.000 | pasti |
| Ring Oktagon | — | **NEEDS CLARIFICATION** (belum ditentukan) |
| Gelang anti air | — | **NEEDS CLARIFICATION** |
| ID Card panitia | — | **NEEDS CLARIFICATION** |
| Trophy juara umum | — | **NEEDS CLARIFICATION** |
| Medal Lanyard | — | **NEEDS CLARIFICATION** |

Personel official awal: 8 orang, sistem rolling.

## 4. Aturan operasional yang mengikat

| # | Aturan |
|---|---|
| BR-01 | Fighter adalah entitas global dalam organisasi; boleh ikut banyak event |
| BR-02 | Setiap pendaftaran **wajib** terikat satu event |
| BR-03 | Setiap pembayaran punya invoice unik; satu pembayaran tidak boleh diproses dua kali (idempotency) |
| BR-04 | Status pembayaran **hanya** dari callback tervalidasi / rekonsiliasi — redirect bukan bukti bayar |
| BR-05 | Setiap tiket punya QR unik; tiket `USED` tidak bisa dipakai ulang |
| BR-06 | POS hanya menjual tiket |
| BR-07 | Setiap event punya laporan keuangan sendiri; organisasi punya laporan konsolidasi |
| BR-08 | Ranking hanya berubah dari hasil pertandingan yang **disahkan**; pendaftaran tidak menaikkan ranking |
| BR-09 | Riwayat pertandingan tidak boleh hilang (tidak ada hard delete) |
| BR-10 | Dokumen fighter (KTP, BPJS, NIK) privat — tidak pernah tampil publik |
| BR-11 | Spreadsheet adalah output, MySQL adalah sumber kebenaran |
| BR-12 | Semua transaksi keuangan harus bisa diaudit (aktor, waktu, referensi) |
| BR-13 | Organisasi hanya bisa mengakses datanya sendiri (tenant isolation) |
| BR-14 | Event lama tetap tersedia sebagai histori (arsip, bukan hapus) |
| BR-15 | Persetujuan fighter menyimpan **versi dokumen** + timestamp, bukan hanya checkbox |
| BR-16 | Satu fighter tidak boleh dijadwalkan pada dua partai yang bertabrakan tanpa persetujuan khusus |
| BR-17 | Tiket yang sudah check-in tetap dihitung sebagai pendapatan |

## 5. Status & transisi

**Event (target spec):** Draft → Published → Registration Open → Registration Closed → Preparation →
Ongoing → Completed, plus Cancelled. *Status saat ini di schema:* `DRAFT, SCHEDULED, LIVE, COMPLETED,
POSTPONED, CANCELLED` → **perlu pemetaan** (lihat `TASK-TRACKER` TFN-007).

**Registrasi (target):** Draft → Pending Payment → Paid → Under Review → Verified / Rejected / Cancelled.
Status pembayaran dan status verifikasi **dipisah**.

**Pembayaran:** Pending · Paid · Expired · Failed · Refunded · Partially Refunded.

**Sponsorship:** Prospect → Contacted → Negotiation → Approved → Paid → Completed / Cancelled.

**Tiket (implementasi sekarang):** `PENDING_CONFIRMATION → CONFIRMED → USED`; `REJECTED`; `CANCELLED`
(expiry). Status pembayaran tiket terpisah: `UNPAID → PROOF_SUBMITTED → VERIFIED / REJECTED`.

## 6. Hal yang belum diputuskan (NEEDS CLARIFICATION)

1. Tanggal sponsorship open (2025 sudah lewat).
2. Nominal pos anggaran yang kosong.
3. Apakah BPJS wajib untuk semua fighter atau opsional per event.
4. Aturan pasti kategori Atlet / Non Atlet / Pemula (kriteria masuk).
5. Ruleset mana yang dipakai per partai & bagaimana penalti "No Strikes Under".
6. Fasilitas VVIP (apa saja, bagaimana verifikasi di gate).
7. Kebijakan refund tiket (siapa berwenang, batas waktu).
8. Retensi dokumen sensitif (berapa lama setelah event).
