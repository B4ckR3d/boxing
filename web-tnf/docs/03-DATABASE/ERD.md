# ERD (Entity Relationship Diagram)

> Mermaid. **Bagian 1 = schema nyata.** Diagram ini disederhanakan: relasi yang tidak penting untuk
> pemahaman alur dihilangkan, kolom hanya yang kunci.

## 1. Auth & RBAC

```mermaid
erDiagram
  User ||--o{ Session : has
  User ||--o{ UserRole : has
  Role ||--o{ UserRole : granted
  Role ||--o{ RolePermission : has
  Permission ||--o{ RolePermission : in
  User ||--o{ RoleRequest : requests
  Role ||--o{ RoleRequest : targets
  User ||--o{ AuditLog : acts
```

## 2. Fighter, ranking, belt

```mermaid
erDiagram
  WeightClass ||--o{ Fighter : classifies
  MediaAsset ||--o{ Fighter : portrait
  Fighter ||--o{ FightParticipant : fights
  Fighter ||--o{ RankingEntry : ranked_in
  Fighter ||--o{ FighterRanking : current
  RankingVersion ||--o{ RankingEntry : contains
  Fighter ||--o{ RankingChangeLog : changed
  ChampionshipBelt ||--o{ BeltReign : reigns
  Fighter ||--o{ BeltReign : holds
  BeltReign ||--o{ BeltDefense : defended
```

## 3. Event, fight, ticketing

```mermaid
erDiagram
  Event ||--o{ Fight : hosts
  Event ||--o{ TicketType : sells
  Event ||--o{ TicketOrder : receives
  WeightClass ||--o{ Fight : in_class
  Fight ||--o{ FightParticipant : has
  Fight ||--o| FightResult : results_in
  FightResult ||--o{ FightResultApproval : approved_by
  TicketType ||--o{ TicketOrderItem : in
  TicketOrder ||--o{ TicketOrderItem : contains
  TicketOrder ||--o{ TicketPayment : paid_by
```

Relasi penting:

- `FightParticipant` unik pada `(fightId, corner)` **dan** `(fightId, fighterId)` → satu fighter tidak
  bisa dua kali dalam satu partai.
- `FightResult` unik pada `fightId` → satu hasil per partai.
- `TicketOrderItem` menyimpan `ticketTypeId` + `quantity` + `unitPrice` (snapshot harga).

## 4. Turnamen & CMS

```mermaid
erDiagram
  Tournament ||--o{ TournamentParticipant : seeds
  Tournament ||--o{ TournamentBracket : has
  TournamentBracket ||--o{ TournamentBout : contains
  TournamentBout ||--o| Fight : becomes
  Page ||--o{ PageSection : composed_of
  Page ||--o{ PageRevision : versioned
  HeroSlide }o--|| MediaAsset : image
```

## 5. Target tenant overlay (belum ada)

```mermaid
erDiagram
  Organization ||--o{ OrganizationMember : members
  Organization ||--o{ Event : owns
  Organization ||--o{ Fighter : owns
  Organization ||--o{ Club : owns
  Organization ||--o{ Official : owns
  Event ||--o{ Registration : receives
  Fighter ||--o{ Registration : registers
  Registration ||--o{ RegistrationConsent : consented
  Registration ||--o{ RegistrationDocument : uploads
  Registration ||--o| Payment : pays
  Event ||--o{ Match : schedules
  Match ||--o{ OfficialAssignment : assigned
  Organization ||--o{ Income : earns
  Organization ||--o{ Expense : spends
```

> Catatan: diagram target ini **rencana**, bukan implementasi. Jangan dipakai sebagai klaim status.
