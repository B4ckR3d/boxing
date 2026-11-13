-- AlterEnum: add USED (ticket consumed at the gate)
ALTER TABLE `TicketOrder`
    MODIFY COLUMN `status` ENUM('PENDING_CONFIRMATION', 'CONFIRMED', 'USED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_CONFIRMATION';

-- AlterTable: record who scanned the ticket and when
ALTER TABLE `TicketOrder`
    ADD COLUMN `checkedInAt` DATETIME(3) NULL,
    ADD COLUMN `checkedInById` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `TicketOrder_checkedInById_idx` ON `TicketOrder`(`checkedInById`);

-- AddForeignKey
ALTER TABLE `TicketOrder` ADD CONSTRAINT `TicketOrder_checkedInById_fkey` FOREIGN KEY (`checkedInById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
