-- Sinkronisasi 4 kartu petarung menjadi COMING SOON dan menghapus dummy petarung lainnya
-- Jalankan di MySQL VPS: mysql -u root -p boxing < scripts/sync_coming_soon_fighters.sql

INSERT INTO mediaasset (id, storageKey, url, kind, mimeType, sizeBytes, originalName, createdAt, updatedAt)
VALUES ('media-cs-card', 'fighters/coming-soon-card.jpg', '/images/fighters/coming-soon-card.jpg', 'IMAGE', 'image/jpeg', 817767, 'coming-soon-card.jpg', NOW(), NOW())
ON DUPLICATE KEY UPDATE url = '/images/fighters/coming-soon-card.jpg';

-- Soft delete petarung di luar 4 slot utama
UPDATE fighter 
SET deletedAt = NOW() 
WHERE slug IN ('kenji-arata', 'aleksandr-volkov', 'bagus-kucir-0229');

-- Perbarui 4 slot petarung utama menjadi COMING SOON dengan foto teaser baru
UPDATE fighter 
SET firstName = 'COMING', 
    lastName = 'SOON', 
    ringName = 'TBA', 
    wins = 0, 
    losses = 0, 
    draws = 0, 
    koWins = 0, 
    nationality = 'ID', 
    portraitId = 'media-cs-card'
WHERE slug IN ('marcus-iron-vale', 'tomas-reyes', 'carlos-mendoza', 'dario-storm');
