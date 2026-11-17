# Database Design

> Satu database: `tfn_management_db` (produksi nanti). Hari ini: `boxing`.
> Bagian 1 = **schema nyata** (40 model). Bagian 2 = domain target yang belum ada.

## 1. Konvensi

| Topik | Konvensi |
|---|---|
| Primary key | `String @id @default(cuid())` (existing). **Keputusan untuk tabel baru: ULID** — lihat ADR-003 |
| Public identifier | `slug` unik (fighter, event, belt) — ID internal tidak diekspos |
| Uang | `Decimal(14,2)` — **tidak pernah** `Float` |
| Waktu | `DateTime` UTC; render `Asia/Jakarta`; `Event.timezone` disimpan |
| Soft delete | `deletedAt` untuk entitas yang punya histori (fighter); transaksi finansial **tidak dihapus** |
| Audit | `AuditLog` untuk aksi sensitif |
| Tenant | ❌ belum ada `organizationId` — wajib ditambahkan sebelum data bisnis nyata |
| Naming | model PascalCase, kolom camelCase, enum SCREAMING_SNAKE |

## 2. Domain yang sudah ada (40 model)

### Auth & RBAC (8)
`User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `RoleRequest`, `Session`, `LoginAttempt`

### Fighter & kompetisi (9)
`WeightClass`, `Fighter`, `RankingVersion`, `RankingEntry`, `FighterRanking`, `RankingChangeLog`,
`ChampionshipBelt`, `BeltReign`, `BeltDefense`

### Event & pertandingan (7)
`Event`, `FightMethod`, `Fight`, `FightParticipant`, `FightResult`, `FightResultApproval`, `TicketType`

### Ticketing (5)
`TicketType`, `TicketOrder`, `TicketOrderItem`, `TicketPayment` (+ `TicketOrder.checkedInAt`)

### Turnamen (4)
`Tournament`, `TournamentParticipant`, `TournamentBracket`, `TournamentBout`

### CMS & konten (5)
`HeroSlide`, `Page`, `PageSection`, `PageRevision`, `MediaAsset`

### Operasional (3)
`Sponsor`, `AuditLog`, `Notification`, `OrganizationSetting`

## 3. Domain target yang belum ada

| Domain | Tabel utama | Catatan desain |
|---|---|---|
| Tenant | `Organization`, `OrganizationMember` | `organizationId` masuk ke semua tabel bisnis |
| Club | `Club`, `Coach`, `FighterClubHistory` | histori pindah club |
| Registrasi | `Registration`, `RegistrationConsent`, `RegistrationDocument`, `RegistrationPayment` | status bayar & verifikasi dipisah |
| Data sensitif | kolom terenkripsi di `Fighter`/`Registration` (`nikEnc`, `ktpObjectKey`, `bpjsNumberEnc`) | enkripsi aplikasi (AES-256-GCM) + akses permission khusus |
| Event config | `EventSetting`, `EventCategory`, `Ruleset`, `WeightClassAssignment`, `EventBudgetItem` | semua dapat diubah dari dashboard |
| Payment | `Payment`, `PaymentLog`, `Invoice`, `Refund` | provider-independent, idempotent |
| POS | `PosTransaction`, `PosShift`, `CashReconciliation` | hanya tiket |
| Officials | `Official`, `OfficialAssignment`, `OfficialHonor` | rolling + honor |
| Sponsor komersial | `SponsorshipPackage`, `SponsorshipAgreement`, `SponsorshipInvoice` | status prospek → selesai |
| Finance | `FinancialAccount`, `Income`, `Expense`, `Budget`, `LedgerEntry` | setiap transaksi punya `sourceType` + `sourceId` |
| Workflow | `Workflow`, `WorkflowStep`, `WorkflowTask`, `WorkflowLog` | ringan, bukan BPMN engine |
| Spreadsheet | `SpreadsheetIntegration`, `SpreadsheetSyncLog` | satu arah ke Sheets |
| Notifikasi | `NotificationTemplate`, `NotificationLog` | WA/email |

## 4. Aturan integritas yang mengikat

1. `TicketType.sold` mencakup hold + order confirmed (jangan pernah hitung dari confirmed saja).
2. Reservasi kuota = `updateMany` dengan guard di dalam transaksi.
3. Satu pembayaran hanya boleh diproses sekali (unique `invoiceNumber` + `providerEventId`).
4. `Income`/`Expense` tidak boleh dihapus setelah final — koreksi memakai entri pembalik.
5. Hasil pertandingan `OFFICIAL` tidak bisa diubah; koreksi lewat entri baru + alasan + audit.
6. Ranking hanya berubah dari hasil resmi; setiap perubahan tercatat di `RankingChangeLog`.

## 5. Sebelum membuat migration (wajib)

- [ ] ERD diperbarui (`ERD.md`)
- [ ] Tabel/kolom baru dijelaskan di dokumen ini
- [ ] Index & unique constraint ditentukan (alasan query-nya jelas)
- [ ] Rencana backfill bila kolom NOT NULL pada tabel berisi data
- [ ] Backup tersedia (produksi)
