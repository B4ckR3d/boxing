# User Roles & Permission

> **Status: 🟡 target.** Role di bawah adalah kebutuhan spec. Implementasi hari ini baru 8 role
> (`super_admin`, `administrator`, `ranking_manager`, `tournament_manager`, `editor`,
> `fight_data_manager`, `reviewer`, `viewer`) dengan 24 permission. Pemetaan role baru → permission
> dilakukan pada TFN-005.

## 1. Role target

| Role | Tanggung jawab utama |
|---|---|
| Super Admin | organisasi, user, role, konfigurasi platform |
| Organization Admin | seluruh data organisasinya |
| Event Manager | event, konfigurasi, jadwal, kuota |
| Registration Admin | pendaftaran, verifikasi dokumen & pembayaran |
| Match Coordinator | matchmaking, jadwal partai, penugasan official |
| Ticketing Admin | kategori tiket, kuota, order, refund, laporan |
| Cashier | POS: transaksi, shift, rekonsiliasi |
| Finance | income/expense, budget, rekonsiliasi, laporan |
| Sponsorship Admin | prospek, paket, kontrak, pembayaran sponsor |
| Referee | penugasan, hasil pertandingan |
| Judge | scorecard |
| Check-in Officer | validasi tiket di gate |

## 2. Prinsip authorization

1. **Permission-based**, bukan cek nama role. Role = kumpulan permission.
2. Cek di **server** pada setiap request; menyembunyikan menu hanya UX.
3. Aksi sensitif (grant/revoke role, transisi belt) butuh **four-eyes** (persetujuan orang kedua).
4. Semua data bisnis ter-scope organisasi (dan event bila relevan).
5. Permission baru wajib masuk `catalog` + test authorization (deny path ikut diuji).

## 3. Permission existing (24)

```
admin.access
audit.read
belts.approve            belts.manage
content.manage           content.publish
events.manage
fighters.create          fighters.read          fighters.update        fighters.delete
fights.approve           fights.manage          fights.verify
rankings.manage          rankings.publish       rankings.read
roles.manage             settings.manage
ticketing.confirm        ticketing.manage       ticketing.read
tournaments.manage
users.manage
```

## 4. Permission yang dibutuhkan modul baru (usulan)

| Modul | Permission |
|---|---|
| Organization | `organizations.read`, `organizations.manage`, `org.members.manage` |
| Club | `clubs.read`, `clubs.manage` |
| Registration | `registrations.read`, `registrations.manage`, `registrations.verify`, `registrations.documents.read` |
| Payments | `payments.read`, `payments.reconcile`, `payments.refund` |
| POS | `pos.operate`, `pos.shift.manage`, `pos.reconcile` |
| Officials | `officials.read`, `officials.manage`, `officials.assign`, `officials.honor.manage` |
| Sponsorship | `sponsors.read`, `sponsors.manage`, `sponsors.agreements.manage` |
| Finance | `finance.read`, `finance.manage`, `finance.report` |
| Workflow | `workflows.read`, `workflows.manage` |
| Spreadsheet | `spreadsheets.manage`, `spreadsheets.sync` |
| Reports | `reports.read`, `reports.export` |

> Nama final dibekukan saat desain RBAC modul tersebut (jangan menambah permission tanpa test).
