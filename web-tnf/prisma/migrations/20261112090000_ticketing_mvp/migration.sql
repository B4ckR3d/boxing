-- CreateTable
CREATE TABLE `TicketType` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `description` VARCHAR(500) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `quota` INTEGER NOT NULL,
    `sold` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TicketType_eventId_isActive_idx`(`eventId`, `isActive`),
    UNIQUE INDEX `TicketType_eventId_code_key`(`eventId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketOrder` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(32) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `customerName` VARCHAR(120) NOT NULL,
    `customerEmail` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(40) NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    `paymentMethod` ENUM('BANK_TRANSFER', 'CASH', 'QRIS', 'OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
    `paymentStatus` ENUM('UNPAID', 'PROOF_SUBMITTED', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'UNPAID',
    `customerNote` VARCHAR(500) NULL,
    `adminNote` VARCHAR(500) NULL,
    `rejectionReason` VARCHAR(500) NULL,
    `guestTokenHash` CHAR(64) NULL,
    `confirmedById` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TicketOrder_orderNumber_key`(`orderNumber`),
    UNIQUE INDEX `TicketOrder_guestTokenHash_key`(`guestTokenHash`),
    INDEX `TicketOrder_eventId_status_createdAt_idx`(`eventId`, `status`, `createdAt`),
    INDEX `TicketOrder_customerEmail_idx`(`customerEmail`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketOrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `ticketTypeId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TicketOrderItem_orderId_ticketTypeId_key`(`orderId`, `ticketTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketPayment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('BANK_TRANSFER', 'CASH', 'QRIS', 'OTHER') NOT NULL,
    `status` ENUM('UNPAID', 'PROOF_SUBMITTED', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PROOF_SUBMITTED',
    `proofUrl` VARCHAR(500) NULL,
    `reference` VARCHAR(120) NULL,
    `note` VARCHAR(500) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TicketPayment_orderId_key`(`orderId`),
    INDEX `TicketPayment_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TicketType` ADD CONSTRAINT `TicketType_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketOrder` ADD CONSTRAINT `TicketOrder_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketOrder` ADD CONSTRAINT `TicketOrder_confirmedById_fkey` FOREIGN KEY (`confirmedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketOrderItem` ADD CONSTRAINT `TicketOrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `TicketOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketOrderItem` ADD CONSTRAINT `TicketOrderItem_ticketTypeId_fkey` FOREIGN KEY (`ticketTypeId`) REFERENCES `TicketType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketPayment` ADD CONSTRAINT `TicketPayment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `TicketOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketPayment` ADD CONSTRAINT `TicketPayment_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
