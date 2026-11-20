-- CreateTable
CREATE TABLE `FighterRegistration` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(24) NOT NULL,
    `fullName` VARCHAR(120) NOT NULL,
    `ringName` VARCHAR(120) NOT NULL,
    `address` TEXT NOT NULL,
    `age` INTEGER NOT NULL,
    `divisionLabel` VARCHAR(120) NOT NULL,
    `weightClassId` VARCHAR(191) NULL,
    `rules` ENUM('BOXING', 'KICKBOXING') NOT NULL,
    `competitionClass` ENUM('ATLET', 'PEMULA', 'NON_ATLET') NOT NULL,
    `bpjsStatus` ENUM('AKTIF', 'TIDAK_AKTIF') NOT NULL,
    `socialUrl` VARCHAR(500) NULL,
    `instagramUrl` VARCHAR(500) NULL,
    `tiktokUrl` VARCHAR(500) NULL,
    `facebookUrl` VARCHAR(500) NULL,
    `xUrl` VARCHAR(500) NULL,
    `paymentAmount` DECIMAL(10, 2) NOT NULL DEFAULT 200000,
    `paymentMethod` VARCHAR(16) NOT NULL DEFAULT 'TRANSFER',
    `paymentProofId` VARCHAR(191) NULL,
    `idDocumentId` VARCHAR(191) NULL,
    `consentAccepted` BOOLEAN NOT NULL DEFAULT false,
    `consentAcceptedAt` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `confirmedById` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `reviewNotes` TEXT NULL,
    `sheetRowNumber` INTEGER NULL,
    `sheetSyncedAt` DATETIME(3) NULL,
    `sheetSyncError` TEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FighterRegistration_code_key`(`code`),
    INDEX `FighterRegistration_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `FighterRegistration_createdAt_idx`(`createdAt`),
    INDEX `FighterRegistration_sheetSyncedAt_idx`(`sheetSyncedAt`),
    INDEX `FighterRegistration_ringName_idx`(`ringName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FighterRegistration` ADD CONSTRAINT `FighterRegistration_weightClassId_fkey` FOREIGN KEY (`weightClassId`) REFERENCES `WeightClass`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FighterRegistration` ADD CONSTRAINT `FighterRegistration_paymentProofId_fkey` FOREIGN KEY (`paymentProofId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FighterRegistration` ADD CONSTRAINT `FighterRegistration_idDocumentId_fkey` FOREIGN KEY (`idDocumentId`) REFERENCES `MediaAsset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FighterRegistration` ADD CONSTRAINT `FighterRegistration_confirmedById_fkey` FOREIGN KEY (`confirmedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
