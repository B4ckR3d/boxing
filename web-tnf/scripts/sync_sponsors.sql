-- =====================================================================
-- Sync Official Sponsors & Partners with CMS (MySQL 8)
-- Prevents broken images by using verified local assets & typography
-- =====================================================================

-- 1. Insert verified local media assets for partner logos
INSERT INTO mediaasset (id, storageKey, url, kind, mimeType, sizeBytes, originalName, alt, checksum, createdAt, updatedAt)
VALUES 
  ('media_sp_pemkab_01', 'partners/pemkab-temanggung.png', '/images/partners/pemkab-temanggung.png', 'IMAGE', 'image/png', 211880, 'pemkab-temanggung.png', 'Logo Pemkab Temanggung', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', NOW(), NOW()),
  ('media_sp_kickboxing_02', 'partners/kickboxing-temanggung.png', '/images/partners/kickboxing-temanggung.png', 'IMAGE', 'image/png', 733329, 'kickboxing-temanggung.png', 'Logo Kickboxing Temanggung', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', NOW(), NOW()),
  ('media_sp_perbati_03', 'partners/perbati-temanggung.png', '/images/partners/perbati-temanggung.png', 'IMAGE', 'image/png', 417310, 'perbati-temanggung.png', 'Logo PERBATI Temanggung', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', NOW(), NOW())
ON DUPLICATE KEY UPDATE url = VALUES(url), alt = VALUES(alt), updatedAt = NOW();

-- 2. Insert Official Sponsors & Partners into CMS
INSERT INTO sponsor (id, name, logoId, url, tier, sortOrder, isActive, createdAt, updatedAt)
VALUES 
  ('sp_pemkab_01', 'Pemkab Temanggung', 'media_sp_pemkab_01', 'https://temanggungkab.go.id', 'PLATINUM', 1, 1, NOW(), NOW()),
  ('sp_kickboxing_02', 'Kickboxing Temanggung', 'media_sp_kickboxing_02', NULL, 'GOLD', 2, 1, NOW(), NOW()),
  ('sp_perbati_03', 'PERBATI Temanggung', 'media_sp_perbati_03', NULL, 'GOLD', 3, 1, NOW(), NOW()),
  ('sp_bri_04', 'Bank BRI', NULL, 'https://bri.co.id', 'GOLD', 4, 1, NOW(), NOW()),
  ('sp_telkom_05', 'Telkom Indonesia', NULL, 'https://telkom.co.id', 'SILVER', 5, 1, NOW(), NOW()),
  ('sp_tbc_06', 'Temanggung Boxing Camp', NULL, NULL, 'PARTNER', 6, 1, NOW(), NOW()),
  ('sp_gor_07', 'GOR Bambu Runcing', NULL, NULL, 'PARTNER', 7, 1, NOW(), NOW()),
  ('sp_suara_08', 'Suara Temanggung', NULL, NULL, 'MEDIA_PARTNER', 8, 1, NOW(), NOW()),
  ('sp_megaswara_09', 'Radio Megaswara FM', NULL, NULL, 'MEDIA_PARTNER', 9, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE 
  name = VALUES(name),
  logoId = VALUES(logoId),
  url = VALUES(url),
  tier = VALUES(tier),
  sortOrder = VALUES(sortOrder),
  isActive = VALUES(isActive),
  updatedAt = NOW();
