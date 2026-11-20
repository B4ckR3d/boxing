/*
  Warnings:

  - You are about to drop the column `idDocumentId` on the `FighterRegistration` table. All the data in the column will be lost.
  - You are about to drop the column `paymentProofId` on the `FighterRegistration` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `FighterRegistration` DROP FOREIGN KEY `FighterRegistration_idDocumentId_fkey`;

-- DropForeignKey
ALTER TABLE `FighterRegistration` DROP FOREIGN KEY `FighterRegistration_paymentProofId_fkey`;

-- DropIndex
DROP INDEX `FighterRegistration_idDocumentId_fkey` ON `FighterRegistration`;

-- DropIndex
DROP INDEX `FighterRegistration_paymentProofId_fkey` ON `FighterRegistration`;

-- AlterTable
ALTER TABLE `FighterRegistration` DROP COLUMN `idDocumentId`,
    DROP COLUMN `paymentProofId`,
    ADD COLUMN `idDocumentBytes` INTEGER NULL,
    ADD COLUMN `idDocumentMime` VARCHAR(80) NULL,
    ADD COLUMN `idDocumentName` VARCHAR(255) NULL,
    ADD COLUMN `idDocumentPath` VARCHAR(255) NULL,
    ADD COLUMN `paymentProofBytes` INTEGER NULL,
    ADD COLUMN `paymentProofMime` VARCHAR(80) NULL,
    ADD COLUMN `paymentProofName` VARCHAR(255) NULL,
    ADD COLUMN `paymentProofPath` VARCHAR(255) NULL;
