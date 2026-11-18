-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `mfaEnabled` BOOLEAN NOT NULL DEFAULT false,
    `mfaSecretEnc` VARCHAR(512) NULL,
    `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `passwordChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `requiresMfa` BOOLEAN NOT NULL DEFAULT false,
    `isSensitive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(64) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Permission_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserRole_roleId_idx`(`roleId`),
    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RolePermission_permissionId_idx`(`permissionId`),
    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoleRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `action` ENUM('GRANT', 'REVOKE') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `reason` VARCHAR(500) NOT NULL,
    `reviewNote` VARCHAR(500) NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RoleRequest_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `RoleRequest_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `mfaVerified` BOOLEAN NOT NULL DEFAULT false,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_revokedAt_idx`(`userId`, `revokedAt`),
    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoginAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `success` BOOLEAN NOT NULL,
    `reason` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LoginAttempt_email_createdAt_idx`(`email`, `createdAt`),
    INDEX `LoginAttempt_ipAddress_createdAt_idx`(`ipAddress`, `createdAt`),
    INDEX `LoginAttempt_success_createdAt_idx`(`success`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeightClass` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE') NOT NULL,
    `limitLbs` DECIMAL(6, 2) NOT NULL,
    `limitKg` DECIMAL(6, 2) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WeightClass_slug_key`(`slug`),
    INDEX `WeightClass_gender_isActive_sortOrder_idx`(`gender`, `isActive`, `sortOrder`),
    UNIQUE INDEX `WeightClass_gender_name_key`(`gender`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Fighter` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `firstName` VARCHAR(80) NOT NULL,
    `lastName` VARCHAR(80) NOT NULL,
    `ringName` VARCHAR(80) NULL,
    `gender` ENUM('MALE', 'FEMALE') NOT NULL,
    `nationality` CHAR(2) NOT NULL,
    `hometown` VARCHAR(120) NULL,
    `dateOfBirth` DATE NULL,
    `showDateOfBirth` BOOLEAN NOT NULL DEFAULT false,
    `heightCm` INTEGER NULL,
    `reachCm` INTEGER NULL,
    `stance` ENUM('ORTHODOX', 'SOUTHPAW', 'SWITCH') NOT NULL DEFAULT 'ORTHODOX',
    `weightClassId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'RETIRED', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `bio` TEXT NULL,
    `achievements` JSON NULL,
    `portraitId` VARCHAR(191) NULL,
    `debutDate` DATE NULL,
    `baseWins` INTEGER NOT NULL DEFAULT 0,
    `baseLosses` INTEGER NOT NULL DEFAULT 0,
    `baseDraws` INTEGER NOT NULL DEFAULT 0,
    `baseNoContests` INTEGER NOT NULL DEFAULT 0,
    `baseKoWins` INTEGER NOT NULL DEFAULT 0,
    `wins` INTEGER NOT NULL DEFAULT 0,
    `losses` INTEGER NOT NULL DEFAULT 0,
    `draws` INTEGER NOT NULL DEFAULT 0,
    `noContests` INTEGER NOT NULL DEFAULT 0,
    `koWins` INTEGER NOT NULL DEFAULT 0,
    `contactEmail` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(40) NULL,
    `privateNotes` TEXT NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Fighter_slug_key`(`slug`),
    INDEX `Fighter_weightClassId_status_idx`(`weightClassId`, `status`),
    INDEX `Fighter_nationality_idx`(`nationality`),
    INDEX `Fighter_status_deletedAt_idx`(`status`, `deletedAt`),
    INDEX `Fighter_lastName_firstName_idx`(`lastName`, `firstName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RankingVersion` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('DIVISION', 'POUND_FOR_POUND') NOT NULL,
    `weightClassId` VARCHAR(191) NULL,
    `gender` ENUM('MALE', 'FEMALE') NULL,
    `scopeKey` VARCHAR(80) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'SUPERSEDED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `effectiveDate` DATE NOT NULL,
    `notes` TEXT NULL,
    `method` VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    `createdById` VARCHAR(191) NULL,
    `submittedById` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RankingVersion_scopeKey_status_idx`(`scopeKey`, `status`),
    INDEX `RankingVersion_status_publishedAt_idx`(`status`, `publishedAt`),
    UNIQUE INDEX `RankingVersion_scopeKey_versionNumber_key`(`scopeKey`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RankingEntry` (
    `id` VARCHAR(191) NOT NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `fighterId` VARCHAR(191) NOT NULL,
    `rank` INTEGER NULL,
    `isChampion` BOOLEAN NOT NULL DEFAULT false,
    `points` DECIMAL(10, 2) NULL,
    `previousRank` INTEGER NULL,
    `movement` INTEGER NULL,
    `isNew` BOOLEAN NOT NULL DEFAULT false,
    `note` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RankingEntry_fighterId_idx`(`fighterId`),
    UNIQUE INDEX `RankingEntry_versionId_fighterId_key`(`versionId`, `fighterId`),
    UNIQUE INDEX `RankingEntry_versionId_rank_key`(`versionId`, `rank`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FighterRanking` (
    `id` VARCHAR(191) NOT NULL,
    `fighterId` VARCHAR(191) NOT NULL,
    `scopeKey` VARCHAR(80) NOT NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `rank` INTEGER NULL,
    `isChampion` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FighterRanking_scopeKey_rank_idx`(`scopeKey`, `rank`),
    UNIQUE INDEX `FighterRanking_fighterId_scopeKey_key`(`fighterId`, `scopeKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RankingChangeLog` (
    `id` VARCHAR(191) NOT NULL,
    `versionId` VARCHAR(191) NOT NULL,
    `fighterId` VARCHAR(191) NULL,
    `action` ENUM('CREATED', 'ADDED', 'REMOVED', 'MOVED', 'CHAMPION_SET', 'CHAMPION_REMOVED', 'POINTS_CHANGED', 'NOTE_CHANGED', 'SUBMITTED', 'REJECTED', 'PUBLISHED') NOT NULL,
    `fromRank` INTEGER NULL,
    `toRank` INTEGER NULL,
    `reason` VARCHAR(500) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RankingChangeLog_versionId_createdAt_idx`(`versionId`, `createdAt`),
    INDEX `RankingChangeLog_fighterId_idx`(`fighterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChampionshipBelt` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `weightClassId` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'VACANT', 'SUSPENDED', 'RETIRED') NOT NULL DEFAULT 'VACANT',
    `imageId` VARCHAR(191) NULL,
    `modelId` VARCHAR(191) NULL,
    `nextDefenseAt` DATETIME(3) NULL,
    `nextDefenseNote` VARCHAR(255) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChampionshipBelt_slug_key`(`slug`),
    INDEX `ChampionshipBelt_weightClassId_idx`(`weightClassId`),
    INDEX `ChampionshipBelt_status_sortOrder_idx`(`status`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BeltReign` (
    `id` VARCHAR(191) NOT NULL,
    `beltId` VARCHAR(191) NOT NULL,
    `fighterId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING_APPROVAL', 'ACTIVE', 'ENDED', 'REJECTED') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `activeKey` VARCHAR(191) NULL,
    `wonAt` DATE NOT NULL,
    `wonFightId` VARCHAR(191) NULL,
    `endedAt` DATE NULL,
    `endReason` ENUM('LOST', 'VACATED', 'STRIPPED', 'RETIRED', 'OTHER') NULL,
    `notes` VARCHAR(500) NULL,
    `proposedById` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BeltReign_activeKey_key`(`activeKey`),
    INDEX `BeltReign_beltId_status_idx`(`beltId`, `status`),
    INDEX `BeltReign_fighterId_idx`(`fighterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BeltDefense` (
    `id` VARCHAR(191) NOT NULL,
    `reignId` VARCHAR(191) NOT NULL,
    `fightId` VARCHAR(191) NULL,
    `challengerId` VARCHAR(191) NULL,
    `defendedAt` DATE NOT NULL,
    `notes` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BeltDefense_fightId_key`(`fightId`),
    INDEX `BeltDefense_reignId_defendedAt_idx`(`reignId`, `defendedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `venue` VARCHAR(160) NULL,
    `city` VARCHAR(120) NULL,
    `country` CHAR(2) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'UTC',
    `status` ENUM('DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED', 'POSTPONED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `posterId` VARCHAR(191) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Event_slug_key`(`slug`),
    INDEX `Event_isPublished_startsAt_idx`(`isPublished`, `startsAt`),
    INDEX `Event_status_startsAt_idx`(`status`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FightMethod` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(16) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `isStoppage` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FightMethod_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Fight` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NULL,
    `weightClassId` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `scheduledRounds` INTEGER NOT NULL DEFAULT 10,
    `boutOrder` INTEGER NOT NULL DEFAULT 0,
    `isMainEvent` BOOLEAN NOT NULL DEFAULT false,
    `isTitleFight` BOOLEAN NOT NULL DEFAULT false,
    `beltId` VARCHAR(191) NULL,
    `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'POSTPONED') NOT NULL DEFAULT 'SCHEDULED',
    `notes` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Fight_eventId_boutOrder_idx`(`eventId`, `boutOrder`),
    INDEX `Fight_scheduledAt_idx`(`scheduledAt`),
    INDEX `Fight_weightClassId_scheduledAt_idx`(`weightClassId`, `scheduledAt`),
    INDEX `Fight_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FightParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `fightId` VARCHAR(191) NOT NULL,
    `fighterId` VARCHAR(191) NOT NULL,
    `corner` ENUM('RED', 'BLUE') NOT NULL,
    `weighInKg` DECIMAL(6, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FightParticipant_fighterId_idx`(`fighterId`),
    UNIQUE INDEX `FightParticipant_fightId_corner_key`(`fightId`, `corner`),
    UNIQUE INDEX `FightParticipant_fightId_fighterId_key`(`fightId`, `fighterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FightResult` (
    `id` VARCHAR(191) NOT NULL,
    `fightId` VARCHAR(191) NOT NULL,
    `outcome` ENUM('WIN', 'DRAW', 'NO_CONTEST') NOT NULL,
    `winnerParticipantId` VARCHAR(191) NULL,
    `methodId` VARCHAR(191) NOT NULL,
    `endRound` INTEGER NULL,
    `endTime` VARCHAR(5) NULL,
    `scorecards` JSON NULL,
    `referee` VARCHAR(120) NULL,
    `sourceUrl` VARCHAR(500) NULL,
    `verificationNote` VARCHAR(500) NULL,
    `status` ENUM('DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'OFFICIAL', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `enteredById` VARCHAR(191) NULL,
    `verifiedById` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FightResult_fightId_key`(`fightId`),
    INDEX `FightResult_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FightResultApproval` (
    `id` VARCHAR(191) NOT NULL,
    `resultId` VARCHAR(191) NOT NULL,
    `action` ENUM('SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED') NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `comment` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FightResultApproval_resultId_createdAt_idx`(`resultId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tournament` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `weightClassId` VARCHAR(191) NOT NULL,
    `format` ENUM('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION') NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    `status` ENUM('DRAFT', 'REGISTRATION', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `size` INTEGER NOT NULL DEFAULT 8,
    `prize` VARCHAR(255) NULL,
    `titleAwarded` VARCHAR(160) NULL,
    `description` TEXT NULL,
    `posterId` VARCHAR(191) NULL,
    `startDate` DATE NULL,
    `endDate` DATE NULL,
    `winnerId` VARCHAR(191) NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tournament_slug_key`(`slug`),
    INDEX `Tournament_isPublished_status_idx`(`isPublished`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TournamentParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `fighterId` VARCHAR(191) NOT NULL,
    `seed` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'ELIMINATED', 'WITHDRAWN', 'WINNER') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TournamentParticipant_tournamentId_fighterId_key`(`tournamentId`, `fighterId`),
    UNIQUE INDEX `TournamentParticipant_tournamentId_seed_key`(`tournamentId`, `seed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TournamentBracket` (
    `id` VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `type` ENUM('WINNERS', 'LOSERS', 'GRAND_FINAL') NOT NULL DEFAULT 'WINNERS',
    `name` VARCHAR(80) NOT NULL,
    `rounds` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TournamentBracket_tournamentId_type_key`(`tournamentId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TournamentBout` (
    `id` VARCHAR(191) NOT NULL,
    `bracketId` VARCHAR(191) NOT NULL,
    `round` INTEGER NOT NULL,
    `position` INTEGER NOT NULL,
    `participantAId` VARCHAR(191) NULL,
    `participantBId` VARCHAR(191) NULL,
    `winnerParticipantId` VARCHAR(191) NULL,
    `fightId` VARCHAR(191) NULL,
    `nextBoutId` VARCHAR(191) NULL,
    `nextSlot` ENUM('A', 'B') NULL,
    `status` ENUM('PENDING', 'READY', 'COMPLETED', 'BYE') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TournamentBout_fightId_key`(`fightId`),
    UNIQUE INDEX `TournamentBout_bracketId_round_position_key`(`bracketId`, `round`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HeroSlide` (
    `id` VARCHAR(191) NOT NULL,
    `eventTitle` VARCHAR(160) NOT NULL,
    `category` VARCHAR(80) NULL,
    `headline` VARCHAR(200) NOT NULL,
    `description` VARCHAR(600) NULL,
    `eventDate` DATETIME(3) NULL,
    `backgroundId` VARCHAR(191) NULL,
    `backgroundVideoId` VARCHAR(191) NULL,
    `fighterImageId` VARCHAR(191) NULL,
    `ctaPrimaryLabel` VARCHAR(40) NULL,
    `ctaPrimaryHref` VARCHAR(500) NULL,
    `ctaSecondaryLabel` VARCHAR(40) NULL,
    `ctaSecondaryHref` VARCHAR(500) NULL,
    `show3dBelt` BOOLEAN NOT NULL DEFAULT false,
    `overlay` ENUM('DARK', 'GOLD', 'CRIMSON') NOT NULL DEFAULT 'DARK',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `publishAt` DATETIME(3) NULL,
    `unpublishAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HeroSlide_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Page` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `seoTitle` VARCHAR(160) NULL,
    `seoDescription` VARCHAR(320) NULL,
    `publishedRevisionId` VARCHAR(191) NULL,
    `draftUpdatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `draftUpdatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Page_slug_key`(`slug`),
    UNIQUE INDEX `Page_publishedRevisionId_key`(`publishedRevisionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PageSection` (
    `id` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `type` ENUM('HERO_SLIDER', 'RANKINGS', 'GRAND_PRIX', 'CHAMPIONSHIP_BELT', 'FEATURED_FIGHTERS', 'FIGHT_HISTORY', 'UPCOMING_EVENTS', 'SPONSORS', 'CTA', 'FOOTER') NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `config` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PageSection_pageId_sortOrder_idx`(`pageId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PageRevision` (
    `id` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `snapshot` JSON NOT NULL,
    `note` VARCHAR(255) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PageRevision_pageId_version_key`(`pageId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaAsset` (
    `id` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `kind` ENUM('IMAGE', 'VIDEO', 'MODEL') NOT NULL,
    `mimeType` VARCHAR(80) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `alt` VARCHAR(255) NULL,
    `checksum` CHAR(64) NOT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MediaAsset_storageKey_key`(`storageKey`),
    INDEX `MediaAsset_kind_deletedAt_createdAt_idx`(`kind`, `deletedAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sponsor` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `logoId` VARCHAR(191) NULL,
    `url` VARCHAR(500) NULL,
    `tier` VARCHAR(32) NOT NULL DEFAULT 'PARTNER',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Sponsor_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(80) NOT NULL,
    `entityType` VARCHAR(64) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `summary` VARCHAR(500) NOT NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `AuditLog_action_createdAt_idx`(`action`, `createdAt`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `body` VARCHAR(500) NULL,
    `link` VARCHAR(255) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationSetting` (
    `key` VARCHAR(64) NOT NULL,
    `value` JSON NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoleRequest` ADD CONSTRAINT `RoleRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoleRequest` ADD CONSTRAINT `RoleRequest_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoleRequest` ADD CONSTRAINT `RoleRequest_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoleRequest` ADD CONSTRAINT `RoleRequest_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fighter` ADD CONSTRAINT `Fighter_weightClassId_fkey` FOREIGN KEY (`weightClassId`) REFERENCES `WeightClass`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fighter` ADD CONSTRAINT `Fighter_portraitId_fkey` FOREIGN KEY (`portraitId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankingVersion` ADD CONSTRAINT `RankingVersion_weightClassId_fkey` FOREIGN KEY (`weightClassId`) REFERENCES `WeightClass`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankingEntry` ADD CONSTRAINT `RankingEntry_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `RankingVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankingEntry` ADD CONSTRAINT `RankingEntry_fighterId_fkey` FOREIGN KEY (`fighterId`) REFERENCES `Fighter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FighterRanking` ADD CONSTRAINT `FighterRanking_fighterId_fkey` FOREIGN KEY (`fighterId`) REFERENCES `Fighter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FighterRanking` ADD CONSTRAINT `FighterRanking_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `RankingVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankingChangeLog` ADD CONSTRAINT `RankingChangeLog_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `RankingVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RankingChangeLog` ADD CONSTRAINT `RankingChangeLog_fighterId_fkey` FOREIGN KEY (`fighterId`) REFERENCES `Fighter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChampionshipBelt` ADD CONSTRAINT `ChampionshipBelt_weightClassId_fkey` FOREIGN KEY (`weightClassId`) REFERENCES `WeightClass`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChampionshipBelt` ADD CONSTRAINT `ChampionshipBelt_imageId_fkey` FOREIGN KEY (`imageId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChampionshipBelt` ADD CONSTRAINT `ChampionshipBelt_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeltReign` ADD CONSTRAINT `BeltReign_beltId_fkey` FOREIGN KEY (`beltId`) REFERENCES `ChampionshipBelt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeltReign` ADD CONSTRAINT `BeltReign_fighterId_fkey` FOREIGN KEY (`fighterId`) REFERENCES `Fighter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeltReign` ADD CONSTRAINT `BeltReign_wonFightId_fkey` FOREIGN KEY (`wonFightId`) REFERENCES `Fight`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeltDefense` ADD CONSTRAINT `BeltDefense_reignId_fkey` FOREIGN KEY (`reignId`) REFERENCES `BeltReign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeltDefense` ADD CONSTRAINT `BeltDefense_fightId_fkey` FOREIGN KEY (`fightId`) REFERENCES `Fight`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BeltDefense` ADD CONSTRAINT `BeltDefense_challengerId_fkey` FOREIGN KEY (`challengerId`) REFERENCES `Fighter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_posterId_fkey` FOREIGN KEY (`posterId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fight` ADD CONSTRAINT `Fight_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fight` ADD CONSTRAINT `Fight_weightClassId_fkey` FOREIGN KEY (`weightClassId`) REFERENCES `WeightClass`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fight` ADD CONSTRAINT `Fight_beltId_fkey` FOREIGN KEY (`beltId`) REFERENCES `ChampionshipBelt`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FightParticipant` ADD CONSTRAINT `FightParticipant_fightId_fkey` FOREIGN KEY (`fightId`) REFERENCES `Fight`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FightParticipant` ADD CONSTRAINT `FightParticipant_fighterId_fkey` FOREIGN KEY (`fighterId`) REFERENCES `Fighter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FightResult` ADD CONSTRAINT `FightResult_fightId_fkey` FOREIGN KEY (`fightId`) REFERENCES `Fight`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FightResult` ADD CONSTRAINT `FightResult_winnerParticipantId_fkey` FOREIGN KEY (`winnerParticipantId`) REFERENCES `FightParticipant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FightResult` ADD CONSTRAINT `FightResult_methodId_fkey` FOREIGN KEY (`methodId`) REFERENCES `FightMethod`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FightResultApproval` ADD CONSTRAINT `FightResultApproval_resultId_fkey` FOREIGN KEY (`resultId`) REFERENCES `FightResult`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tournament` ADD CONSTRAINT `Tournament_weightClassId_fkey` FOREIGN KEY (`weightClassId`) REFERENCES `WeightClass`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tournament` ADD CONSTRAINT `Tournament_posterId_fkey` FOREIGN KEY (`posterId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tournament` ADD CONSTRAINT `Tournament_winnerId_fkey` FOREIGN KEY (`winnerId`) REFERENCES `Fighter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentParticipant` ADD CONSTRAINT `TournamentParticipant_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentParticipant` ADD CONSTRAINT `TournamentParticipant_fighterId_fkey` FOREIGN KEY (`fighterId`) REFERENCES `Fighter`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentBracket` ADD CONSTRAINT `TournamentBracket_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentBout` ADD CONSTRAINT `TournamentBout_bracketId_fkey` FOREIGN KEY (`bracketId`) REFERENCES `TournamentBracket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentBout` ADD CONSTRAINT `TournamentBout_participantAId_fkey` FOREIGN KEY (`participantAId`) REFERENCES `TournamentParticipant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentBout` ADD CONSTRAINT `TournamentBout_participantBId_fkey` FOREIGN KEY (`participantBId`) REFERENCES `TournamentParticipant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentBout` ADD CONSTRAINT `TournamentBout_winnerParticipantId_fkey` FOREIGN KEY (`winnerParticipantId`) REFERENCES `TournamentParticipant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentBout` ADD CONSTRAINT `TournamentBout_fightId_fkey` FOREIGN KEY (`fightId`) REFERENCES `Fight`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TournamentBout` ADD CONSTRAINT `TournamentBout_nextBoutId_fkey` FOREIGN KEY (`nextBoutId`) REFERENCES `TournamentBout`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HeroSlide` ADD CONSTRAINT `HeroSlide_backgroundId_fkey` FOREIGN KEY (`backgroundId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HeroSlide` ADD CONSTRAINT `HeroSlide_backgroundVideoId_fkey` FOREIGN KEY (`backgroundVideoId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HeroSlide` ADD CONSTRAINT `HeroSlide_fighterImageId_fkey` FOREIGN KEY (`fighterImageId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Page` ADD CONSTRAINT `Page_publishedRevisionId_fkey` FOREIGN KEY (`publishedRevisionId`) REFERENCES `PageRevision`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageSection` ADD CONSTRAINT `PageSection_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PageRevision` ADD CONSTRAINT `PageRevision_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaAsset` ADD CONSTRAINT `MediaAsset_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sponsor` ADD CONSTRAINT `Sponsor_logoId_fkey` FOREIGN KEY (`logoId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
