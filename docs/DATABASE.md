# Database Design & Relational Documentation (MySQL 8 + Prisma)

> **Status:** v1.0 — Implemented in `prisma/schema.prisma`  
> **Source of Truth:** [prd.md](../prd.md)  
> **Provider:** MySQL 8.4 via `@prisma/adapter-mariadb`  

---

## 1. Entity-Relationship Overview

```mermaid
erDiagram
  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : assigned_to
  ROLE ||--o{ ROLE_PERMISSION : grants
  PERMISSION ||--o{ ROLE_PERMISSION : belongs_to
  USER ||--o{ SESSION : creates
  USER ||--o{ AUDIT_LOG : triggers
  USER ||--o{ ROLE_REQUEST : targets

  WEIGHT_CLASS ||--o{ FIGHTER : classifies
  WEIGHT_CLASS ||--o{ CHAMPIONSHIP_BELT : defines
  WEIGHT_CLASS ||--o{ TOURNAMENT : groups
  WEIGHT_CLASS ||--o{ FIGHT : categorizes
  WEIGHT_CLASS ||--o{ RANKING_VERSION : scopes

  FIGHTER ||--o{ FIGHT_PARTICIPANT : competes_in
  FIGHT ||--o{ FIGHT_PARTICIPANT : includes
  FIGHT ||--o| FIGHT_RESULT : produces
  FIGHT_RESULT ||--o{ FIGHT_RESULT_APPROVAL : tracked_by
  FIGHT_METHOD ||--o{ FIGHT_RESULT : classifies

  CHAMPIONSHIP_BELT ||--o{ BELT_REIGN : maintains
  FIGHTER ||--o{ BELT_REIGN : holds
  BELT_REIGN ||--o{ BELT_DEFENSE : logs

  RANKING_VERSION ||--o{ RANKING_ENTRY : contains
  FIGHTER ||--o{ RANKING_ENTRY : listed_in
  RANKING_VERSION ||--o{ RANKING_CHANGE_LOG : audits

  TOURNAMENT ||--o{ TOURNAMENT_PARTICIPANT : registers
  TOURNAMENT ||--o{ TOURNAMENT_BRACKET : structures
  TOURNAMENT_BRACKET ||--o{ TOURNAMENT_BOUT : contains
  TOURNAMENT_BOUT ||--o| FIGHT : links_to

  PAGE ||--o{ PAGE_SECTION : configures
  PAGE ||--o{ PAGE_REVISION : snapshots
  MEDIA_ASSET ||--o{ FIGHTER : portraits
  MEDIA_ASSET ||--o{ CHAMPIONSHIP_BELT : visuals
```

---

## 2. Table Specifications & Cardinality

### A. Authentication & Access Control
- `User`: Primary account record with Argon2id password hash, failed login counter, lockout timestamp, and encrypted TOTP secret (`mfaSecretEnc`).
- `Role`: System roles (`super_admin`, `administrator`, `ranking_manager`, `tournament_manager`, `editor`, `fight_data_manager`, `reviewer`, `viewer`). Includes flags for `requiresMfa` and `isSensitive`.
- `Permission`: Granular capabilities (`fighters.create`, `rankings.publish`, `fights.approve`, etc.).
- `UserRole` & `RolePermission`: Many-to-many join tables with audit metadata (`assignedById`, `createdAt`).
- `RoleRequest`: Four-eyes request/approval workflow for privilege escalation.
- `Session`: Token hash (`tokenHash` SHA-256), `mfaVerified` flag, `lastSeenAt`, `expiresAt`, `revokedAt`.

### B. Fighters & Weight Classes
- `WeightClass`: Divisional limits in both LBS and KG, unique gender + name constraints, sort ordering for navigation.
- `Fighter`: Personal profile, physical metrics (height/reach in cm, stance), and baseline pre-platform record.
  - **Record Normalization:** `wins`, `losses`, `draws`, `noContests`, and `koWins` are recalculated within atomic transactions when official fight results are verified and approved.
  - **Privacy:** `contactEmail`, `contactPhone`, and `privateNotes` are strictly excluded from public DTOs. `dateOfBirth` is shielded behind `showDateOfBirth`.

### C. Rankings (Versioned Official Governance)
- `RankingVersion`: Scoped by division (`DIV:<weightClassId>`) or pound-for-pound (`P4P:MALE` / `P4P:FEMALE`).
  - Version numbers increment per scope.
  - Status transitions: `DRAFT` → `PENDING_APPROVAL` → `PUBLISHED` (superseding previous active version) or `REJECTED`.
- `RankingEntry`: Snapshot of fighter position, rank movement relative to the prior published version, points, and championship flag.
- `FighterRanking`: Denormalized lookup table for instant sub-millisecond public rank queries.
- `RankingChangeLog`: Fine-grained operational audit log of every movement, draft modification, and approval reason.

### D. Championship Belts & Reign Lineage
- `ChampionshipBelt`: Divisional belts with optional 3D asset link (`modelId`) and fallback image (`imageId`).
- `BeltReign`: Chronological lineage of holders.
  - `activeKey`: Unique constraint ensuring only **one active champion** exists per belt at any given time.
  - Holder transitions require official fight result certification and approver sign-off.
- `BeltDefense`: Historical log of each title defense match against named contenders.

### E. Events, Fights & Governance Approvals
- `Event`: Fight night schedules with UTC timestamps, venue, local timezone, and publication state.
- `Fight`: Match card entries with round specifications, title fight indicators, and corner assignments.
- `FightParticipant`: Links fighters to either `RED` or `BLUE` corner, plus official weigh-in data.
- `FightResult`: Outcome (`WIN`, `DRAW`, `NO_CONTEST`), method (`KO`, `TKO`, `UD`, `SD`, etc.), round, time, and scorecards.
  - Status pipeline: `DRAFT` → `PENDING_VERIFICATION` → `VERIFIED` → `OFFICIAL`.
- `FightResultApproval`: Multi-step sign-off ledger enforcing separation of duties.

### F. Grand Prix Tournament Brackets
- `Tournament`: Single/Double elimination formats with power-of-two participant brackets (4, 8, 16, 32).
- `TournamentParticipant`: Seeded fighter entry with active, eliminated, or winner status.
- `TournamentBracket`: Winner or Loser bracket tree.
- `TournamentBout`: Individual bracket node with feeder relationships (`nextBoutId`, `nextSlot`), connected directly to an official `Fight` record.

### G. CMS Page Builder & Media
- `Page` & `PageSection`: Draft configurations for landing page components with JSON schema validation.
- `PageRevision`: Immutable published snapshots enabling single-click rollback.
- `MediaAsset`: Verified file uploads with random storage keys, SHA-256 checksums, and MIME enforcement.
- `HeroSlide`: Dynamic fight night carousel slides with scheduling windows (`publishAt`, `unpublishAt`).

