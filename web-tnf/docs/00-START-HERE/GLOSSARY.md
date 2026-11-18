# Glossary

| Istilah | Arti di proyek ini |
|---|---|
| **TFN** | Temanggung Fight Night — penyelenggara/organisasi pemilik event |
| **Vol.** | Edisi event (TFN Vol. 6, Vol. 7, …). Satu event = satu baris `Event` |
| **Organization (tenant)** | Entitas penyelenggara. Satu platform bisa banyak organisasi (target) |
| **Fighter** | Atlet terdaftar. ID internal permanen, dipakai lintas event |
| **Club / Gym** | Tempat latihan asal fighter; satu club banyak fighter |
| **Registration** | Pendaftaran fighter **ke satu event** (bukan data master fighter) |
| **Consent** | Persetujuan fighter (kebenaran data, risiko, rules). Wajib simpan versi + timestamp |
| **Fighter Dadakan** | Pendaftaran di lokasi pada hari-H, biaya khusus, diproses admin |
| **Weight class** | Kelas berat (17 kelas di schema saat ini) |
| **Fighter category** | Atlet / Non Atlet / Pemula — **berbeda** dari kelas berat |
| **Ruleset** | Aturan pertandingan: Kickboxing Low Kick, No Strikes Under, Freestyle Boxing |
| **Match / Fight** | Satu pertandingan; punya 2 corner (RED/BLUE), referee, judges, hasil |
| **Bout order** | Urutan partai dalam satu event |
| **Championship / Belt** | Gelar juara; punya reign (masa jabatan) & defense |
| **Reign** | Periode seorang juara memegang belt |
| **Ranking version** | Snapshot peringkat yang dipublikasikan; ada approval 4-eyes |
| **P4P** | Pound-for-pound — ranking lintas kelas |
| **Official** | Wasit / juri / chief yang ditugaskan ke pertandingan |
| **Hold** | Tiket ditahan sementara (`PENDING_CONFIRMATION`) sambil menunggu pembayaran |
| **Sweep / hold expiry** | Job yang membatalkan hold kedaluwarsa & mengembalikan kuota |
| **Capability token** | Token rahasia pembeli tiket untuk membuka status & PDF; disimpan `sha256` |
| **Check-in** | Validasi tiket di pintu masuk; tiket jadi `USED` dan tidak bisa dipakai ulang |
| **POS** | Aplikasi kasir lokasi — **hanya tiket** |
| **Shift / reconciliation** | Sesi kasir & pencocokan uang fisik vs sistem |
| **Sponsorship package** | Paket sponsor (benefit + harga) |
| **Budget vs actual** | Perbandingan anggaran event dengan realisasi |
| **Workflow** | Alur tugas operasional (registrasi → payment → verifikasi → matchmaking → confirmed) |
| **Spreadsheet sync** | Ekspor/sinkron data ke Google Sheets. **Sheets bukan database** |
| **Tenant isolation** | Jaminan organisasi A tidak bisa membaca data organisasi B |
| **4-eyes / four-eyes** | Aksi sensitif butuh persetujuan orang kedua (role request, belt transition) |
| **Gate** | Rangkaian verifikasi wajib sebelum task dianggap selesai |
