-- Sinkronisasi 4 kartu petarung & tabel peringkat menjadi COMING SOON
-- Jalankan di MySQL VPS: mysql -u root -p boxing < scripts/sync_coming_soon_fighters.sql

INSERT INTO mediaasset (id, storageKey, url, kind, mimeType, sizeBytes, originalName, checksum, createdAt, updatedAt)
VALUES ('media-cs-card', 'fighters/coming-soon-card.jpg', '/images/fighters/coming-soon-card.jpg', 'IMAGE', 'image/jpeg', 817767, 'coming-soon-card.jpg', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', NOW(), NOW())
ON DUPLICATE KEY UPDATE url = '/images/fighters/coming-soon-card.jpg';

-- 1. Perbarui SEMUA petarung lama / dummy menjadi COMING SOON
UPDATE fighter 
SET firstName = 'COMING', 
    lastName = 'SOON', 
    ringName = 'TBA', 
    wins = 0, 
    losses = 0, 
    draws = 0, 
    koWins = 0, 
    nationality = 'ID', 
    portraitId = 'media-cs-card';

-- 2. Soft delete petarung di luar 4 slot utama
UPDATE fighter 
SET deletedAt = NOW() 
WHERE slug IN ('kenji-arata', 'aleksandr-volkov', 'bagus-kucir-0229');

-- 3. Pastikan 4 slot utama aktif dan masuk divisi Heavyweight
UPDATE fighter 
SET deletedAt = NULL,
    weightClassId = 'cmwd0cui60012y03k6x5muty3'
WHERE slug IN ('marcus-iron-vale', 'tomas-reyes', 'carlos-mendoza', 'dario-storm');

-- 4. Bersihkan entri peringkat Heavyweight versi publikasi aktif
-- Hapus entri lama untuk versi cmwd0cumy001my03kobqa7zuc
DELETE FROM rankingentry WHERE versionId = 'cmwd0cumy001my03kobqa7zuc';
DELETE FROM fighterranking WHERE scopeKey = 'DIV:cmwd0cui60012y03k6x5muty3';

-- 5. Masukkan 4 entri peringkat COMING SOON (Juara + 3 Contender)
INSERT INTO `rankingentry` (`id`, `versionId`, `fighterId`, `rank`, `isChampion`, `points`, `movement`, `isNew`, `createdAt`, `updatedAt`)
VALUES 
  ('re_champ', 'cmwd0cumy001my03kobqa7zuc', (SELECT `id` FROM `fighter` WHERE `slug` = 'marcus-iron-vale' LIMIT 1), NULL, 1, 1500.00, 0, 0, NOW(), NOW()),
  ('re_rank1', 'cmwd0cumy001my03kobqa7zuc', (SELECT `id` FROM `fighter` WHERE `slug` = 'dario-storm' LIMIT 1), 1, 0, 1320.00, 0, 0, NOW(), NOW()),
  ('re_rank2', 'cmwd0cumy001my03kobqa7zuc', (SELECT `id` FROM `fighter` WHERE `slug` = 'tomas-reyes' LIMIT 1), 2, 0, 1200.00, 0, 0, NOW(), NOW()),
  ('re_rank3', 'cmwd0cumy001my03kobqa7zuc', (SELECT `id` FROM `fighter` WHERE `slug` = 'carlos-mendoza' LIMIT 1), 3, 0, 1100.00, 0, 0, NOW(), NOW());

INSERT INTO `fighterranking` (`id`, `fighterId`, `scopeKey`, `versionId`, `rank`, `isChampion`, `updatedAt`)
VALUES
  ('fr_champ', (SELECT `id` FROM `fighter` WHERE `slug` = 'marcus-iron-vale' LIMIT 1), 'DIV:cmwd0cui60012y03k6x5muty3', 'cmwd0cumy001my03kobqa7zuc', NULL, 1, NOW()),
  ('fr_rank1', (SELECT `id` FROM `fighter` WHERE `slug` = 'dario-storm' LIMIT 1), 'DIV:cmwd0cui60012y03k6x5muty3', 'cmwd0cumy001my03kobqa7zuc', 1, 0, NOW()),
  ('fr_rank2', (SELECT `id` FROM `fighter` WHERE `slug` = 'tomas-reyes' LIMIT 1), 'DIV:cmwd0cui60012y03k6x5muty3', 'cmwd0cumy001my03kobqa7zuc', 2, 0, NOW()),
  ('fr_rank3', (SELECT `id` FROM `fighter` WHERE `slug` = 'carlos-mendoza' LIMIT 1), 'DIV:cmwd0cui60012y03k6x5muty3', 'cmwd0cumy001my03kobqa7zuc', 3, 0, NOW());
