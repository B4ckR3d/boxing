-- Seed partner/sponsor awal TFN ke tabel Sponsor + MediaAsset.
-- Idempotent: hanya menyisipkan kalau barisnya belum ada.
-- Jalankan: mysql --default-character-set=utf8mb4 ... < prisma/seed-sponsors.sql

SET @now = NOW(3);

-- Logo (MediaAsset) — hanya untuk partner yang punya berkas di public/images/partners/
INSERT INTO MediaAsset (id, storageKey, url, kind, mimeType, sizeBytes, width, height, originalName, alt, checksum, createdAt, updatedAt)
SELECT * FROM (
  SELECT 'ma_sponsor_pemkab' AS id, 'sponsor-logo-pemkab-temanggung' AS storageKey,
         '/images/partners/pemkab-temanggung.png' AS url, 'IMAGE' AS kind,
         'image/png' AS mimeType, 211880 AS sizeBytes, 640 AS width, 968 AS height,
         'pemkab-temanggung.png' AS originalName,
         'Lambang Kabupaten Temanggung' AS alt,
         REPEAT('0', 64) AS checksum, @now AS createdAt, @now AS updatedAt
) AS v
WHERE NOT EXISTS (SELECT 1 FROM MediaAsset WHERE id = 'ma_sponsor_pemkab');

INSERT INTO MediaAsset (id, storageKey, url, kind, mimeType, sizeBytes, width, height, originalName, alt, checksum, createdAt, updatedAt)
SELECT * FROM (
  SELECT 'ma_sponsor_perbati' AS id, 'sponsor-logo-perbati-temanggung' AS storageKey,
         '/images/partners/perbati-temanggung.png' AS url, 'IMAGE' AS kind,
         'image/png' AS mimeType, 417310 AS sizeBytes, 800 AS width, 800 AS height,
         'perbati-temanggung.png' AS originalName,
         'Logo PERBATI Kabupaten Temanggung' AS alt,
         REPEAT('0', 64) AS checksum, @now AS createdAt, @now AS updatedAt
) AS v
WHERE NOT EXISTS (SELECT 1 FROM MediaAsset WHERE id = 'ma_sponsor_perbati');

INSERT INTO MediaAsset (id, storageKey, url, kind, mimeType, sizeBytes, width, height, originalName, alt, checksum, createdAt, updatedAt)
SELECT * FROM (
  SELECT 'ma_sponsor_kickboxing' AS id, 'sponsor-logo-kickboxing-temanggung' AS storageKey,
         '/images/partners/kickboxing-temanggung.png' AS url, 'IMAGE' AS kind,
         'image/png' AS mimeType, 733329 AS sizeBytes, 800 AS width, 800 AS height,
         'kickboxing-temanggung.png' AS originalName,
         'Logo Kickboxing Indonesia Kabupaten Temanggung' AS alt,
         REPEAT('0', 64) AS checksum, @now AS createdAt, @now AS updatedAt
) AS v
WHERE NOT EXISTS (SELECT 1 FROM MediaAsset WHERE id = 'ma_sponsor_kickboxing');

-- Sponsor
INSERT INTO Sponsor (id, name, logoId, url, tier, sortOrder, isActive, createdAt, updatedAt)
SELECT * FROM (
  SELECT 'spn_pemkab_temanggung' AS id, 'Pemerintah Kabupaten Temanggung' AS name,
         'ma_sponsor_pemkab' AS logoId, 'https://temanggungkab.go.id' AS url,
         'PLATINUM' AS tier, 10 AS sortOrder, 1 AS isActive, @now AS createdAt, @now AS updatedAt
  UNION ALL SELECT 'spn_kickboxing_temanggung', 'Kickboxing Indonesia Kab. Temanggung', 'ma_sponsor_kickboxing', NULL, 'GOLD', 20, 1, @now, @now
  UNION ALL SELECT 'spn_perbati_temanggung', 'PERBATI Kab. Temanggung', 'ma_sponsor_perbati', NULL, 'GOLD', 30, 1, @now, @now
  UNION ALL SELECT 'spn_bank_bri', 'Bank BRI', NULL, 'https://bri.co.id', 'GOLD', 40, 1, @now, @now
  UNION ALL SELECT 'spn_telkom', 'Telkom Indonesia', NULL, 'https://telkom.co.id', 'SILVER', 50, 1, @now, @now
  UNION ALL SELECT 'spn_tbc', 'Temanggung Boxing Camp', NULL, NULL, 'PARTNER', 60, 1, @now, @now
  UNION ALL SELECT 'spn_gor_bambu_runcing', 'GOR Bambu Runcing', NULL, NULL, 'PARTNER', 70, 1, @now, @now
  UNION ALL SELECT 'spn_suara_temanggung', 'Suara Temanggung', NULL, NULL, 'MEDIA_PARTNER', 80, 1, @now, @now
  UNION ALL SELECT 'spn_megaswara_fm', 'Radio Megaswara FM', NULL, NULL, 'MEDIA_PARTNER', 90, 1, @now, @now
) AS v
WHERE NOT EXISTS (SELECT 1 FROM Sponsor);

SELECT tier, COUNT(*) AS jumlah FROM Sponsor GROUP BY tier ORDER BY MIN(sortOrder);
