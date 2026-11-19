-- =============================================================================
-- TFN GALLERY SYNC SCRIPT
-- Generated: 2026-11-19T10:47:02.313Z
-- =============================================================================

-- 1. Pastikan Kategori Galeri Tersedia
INSERT INTO `gallerycategory` (`id`, `name`, `slug`, `description`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`)
VALUES
  ('cat_vol1', 'TFN Volume 1', 'volume-1', 'Dokumentasi laga perdana Temanggung Fight Night April 2024', 1, 1, NOW(3), NOW(3)),
  ('cat_vol2', 'TFN Volume 2', 'volume-2', 'Dokumentasi laga panas Temanggung Fight Night Vol. 2 Juli 2024', 2, 1, NOW(3), NOW(3)),
  ('cat_vol3', 'TFN Volume 3', 'volume-3', 'Dokumentasi laga Temanggung Fight Night Vol. 3', 3, 1, NOW(3), NOW(3)),
  ('cat_weighin', 'Timbang Badan & Face-Off', 'weigh-in', 'Sesi timbang badan resmi & tatap muka sengit petarung', 4, 1, NOW(3), NOW(3)),
  ('cat_ring', 'Aksi Ring & Sorak Arena', 'ring-action', 'Momen pertarungan sengit dan atmosfer gemuruh penonton GOR Bambu Runcing', 5, 1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `slug` = VALUES(`slug`),
  `description` = VALUES(`description`),
  `sortOrder` = VALUES(`sortOrder`),
  `isActive` = VALUES(`isActive`),
  `updatedAt` = NOW(3);

-- 2. Sinkronisasi Seluruh Foto Galeri (42 Foto Terkompresi WebP)
INSERT INTO `galleryitem` (`id`, `title`, `description`, `imageUrl`, `categoryId`, `sortOrder`, `isActive`, `takenAt`, `createdAt`, `updatedAt`)
VALUES
  ('item_gal_001', 'Aksi Jual Beli Serangan di Sudut Ring', 'Dokumentasi fotografi lensa kamera menangkap detik-detik krusial pertarungan di arena TFN', '/images/gallery/tfn-ring-dsc02526.webp', 'cat_ring', 1, 1, '2024-07-02 21:15:00', NOW(3), NOW(3)),
  ('item_gal_002', 'Ketegangan Wasit Mengawasi Duel', 'Dokumentasi fotografi lensa kamera menangkap detik-detik krusial pertarungan di arena TFN', '/images/gallery/tfn-ring-dsc02983.webp', 'cat_ring', 2, 1, '2024-07-02 21:15:00', NOW(3), NOW(3)),
  ('item_gal_003', 'Sorakan Gemuruh Penonton Arena', 'Dokumentasi fotografi lensa kamera menangkap detik-detik krusial pertarungan di arena TFN', '/images/gallery/tfn-ring-dsc03090.webp', 'cat_ring', 3, 1, '2024-07-02 21:15:00', NOW(3), NOW(3)),
  ('item_gal_004', 'Fokus dan Konsentrasi di Atas Kanvas', 'Dokumentasi fotografi lensa kamera menangkap detik-detik krusial pertarungan di arena TFN', '/images/gallery/tfn-ring-dsc03196.webp', 'cat_ring', 4, 1, '2024-07-02 21:15:00', NOW(3), NOW(3)),
  ('item_gal_005', 'Pemberian Instruksi Corner Petarung', 'Dokumentasi fotografi lensa kamera menangkap detik-detik krusial pertarungan di arena TFN', '/images/gallery/tfn-ring-dsc03198.webp', 'cat_ring', 5, 1, '2024-07-02 21:15:00', NOW(3), NOW(3)),
  ('item_gal_006', 'Pemberian Arahan Teknis Matchmaker', 'Sesi resmi timbang badan dan tatap muka mempertemukan dua petarung sebelum naik ring', '/images/gallery/tfn-img-0004.webp', 'cat_weighin', 6, 1, '2024-07-01 15:00:00', NOW(3), NOW(3)),
  ('item_gal_007', 'Foto Bersama Petarung & Promotor', 'Sesi resmi timbang badan dan tatap muka mempertemukan dua petarung sebelum naik ring', '/images/gallery/tfn-img-0012.webp', 'cat_weighin', 7, 1, '2024-07-01 15:00:00', NOW(3), NOW(3)),
  ('item_gal_008', 'Kombinasi Pukulan Hook dan Straight', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0042.webp', 'cat_vol3', 8, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_009', 'Sorotan Pengadil & Timer Laga', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0047.webp', 'cat_vol3', 9, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_010', 'Penyerahan Sabuk & Medali Juara', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0053.webp', 'cat_vol3', 10, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_011', 'Pelukan Sportivitas Pasca Pertarungan', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0067.webp', 'cat_vol3', 11, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_012', 'Perayaan Kemenangan Bersama Tim Corner', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0109.webp', 'cat_vol3', 12, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_013', 'Sorak Antusias Suporter Temanggung', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0138.webp', 'cat_vol3', 13, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_014', 'Potret Jawara Malam Pertarungan TFN', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0153.webp', 'cat_vol3', 14, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_015', 'Kombinasi Pukulan Hook dan Straight', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0360.webp', 'cat_vol3', 15, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_016', 'Sorotan Pengadil & Timer Laga', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0395.webp', 'cat_vol3', 16, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_017', 'Penyerahan Sabuk & Medali Juara', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0500.webp', 'cat_vol3', 17, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_018', 'Pelukan Sportivitas Pasca Pertarungan', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0513-1.webp', 'cat_vol3', 18, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_019', 'Perayaan Kemenangan Bersama Tim Corner', 'Momen heroik dan ketangguhan atlet combat sports bertanding di pentas Temanggung Fight Night', '/images/gallery/tfn-img-0560.webp', 'cat_vol3', 19, 1, '2024-07-02 22:30:00', NOW(3), NOW(3)),
  ('item_gal_020', 'Pertarungan Sengit TFN Vol. 2 - Momen #20', 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2', '/images/gallery/tfn-vol2-snap-20240702-0733.webp', 'cat_vol2', 20, 1, '2024-07-02 20:00:00', NOW(3), NOW(3)),
  ('item_gal_021', 'Pertarungan Sengit TFN Vol. 2 - Momen #21', 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2', '/images/gallery/tfn-vol2-snap-20240702-0734.webp', 'cat_vol2', 21, 1, '2024-07-02 20:00:00', NOW(3), NOW(3)),
  ('item_gal_022', 'Pertarungan Sengit TFN Vol. 2 - Momen #22', 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2', '/images/gallery/tfn-vol2-snap-20240702-0752.webp', 'cat_vol2', 22, 1, '2024-07-02 20:00:00', NOW(3), NOW(3)),
  ('item_gal_023', 'Pertarungan Sengit TFN Vol. 2 - Momen #23', 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2', '/images/gallery/tfn-vol2-snap-20240702-0800.webp', 'cat_vol2', 23, 1, '2024-07-02 20:00:00', NOW(3), NOW(3)),
  ('item_gal_024', 'Pertarungan Sengit TFN Vol. 2 - Momen #24', 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2', '/images/gallery/tfn-vol2-snap-20240702-0802.webp', 'cat_vol2', 24, 1, '2024-07-02 20:00:00', NOW(3), NOW(3)),
  ('item_gal_025', 'Pertarungan Sengit TFN Vol. 2 - Momen #25', 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2', '/images/gallery/tfn-vol2-snap-20240702-0805.webp', 'cat_vol2', 25, 1, '2024-07-02 20:00:00', NOW(3), NOW(3)),
  ('item_gal_026', 'Pertarungan Sengit TFN Vol. 2 - Momen #26', 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2', '/images/gallery/tfn-vol2-snap-20240702-0808.webp', 'cat_vol2', 26, 1, '2024-07-02 20:00:00', NOW(3), NOW(3)),
  ('item_gal_027', 'Pertarungan Sengit TFN Vol. 2 - Momen #27', 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2', '/images/gallery/tfn-vol2-snap-20240702-0855.webp', 'cat_vol2', 27, 1, '2024-07-02 20:00:00', NOW(3), NOW(3)),
  ('item_gal_028', 'Pertarungan Sengit TFN Vol. 2 - Momen #28', 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2', '/images/gallery/tfn-vol2-snap-20240702-0920.webp', 'cat_vol2', 28, 1, '2024-07-02 20:00:00', NOW(3), NOW(3)),
  ('item_gal_029', 'Pertarungan Sengit TFN Vol. 2 - Momen #29', 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2', '/images/gallery/tfn-vol2-snap-20240702-0921.webp', 'cat_vol2', 29, 1, '2024-07-02 20:00:00', NOW(3), NOW(3)),
  ('item_gal_030', 'Pertarungan Sengit TFN Vol. 2 - Momen #30', 'Aksi baku pukul sengit petarung di atas kanvas Temanggung Fight Night Volume 2', '/images/gallery/tfn-vol2-snap-20240702-0923.webp', 'cat_vol2', 30, 1, '2024-07-02 20:00:00', NOW(3), NOW(3)),
  ('item_gal_031', 'Sorotan Laga TFN Vol. 1 - Momen #31', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1049.webp', 'cat_vol1', 31, 1, '2024-04-29 19:30:00', NOW(3), NOW(3)),
  ('item_gal_032', 'Sorotan Laga TFN Vol. 1 - Momen #32', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1058.webp', 'cat_vol1', 32, 1, '2024-04-29 19:30:00', NOW(3), NOW(3)),
  ('item_gal_033', 'Sorotan Laga TFN Vol. 1 - Momen #33', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1100.webp', 'cat_vol1', 33, 1, '2024-04-29 19:30:00', NOW(3), NOW(3)),
  ('item_gal_034', 'Sorotan Laga TFN Vol. 1 - Momen #34', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1101.webp', 'cat_vol1', 34, 1, '2024-04-29 19:30:00', NOW(3), NOW(3)),
  ('item_gal_035', 'Sorotan Laga TFN Vol. 1 - Momen #35', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1104.webp', 'cat_vol1', 35, 1, '2024-04-29 19:30:00', NOW(3), NOW(3)),
  ('item_gal_036', 'Sorotan Laga TFN Vol. 1 - Momen #36', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1109.webp', 'cat_vol1', 36, 1, '2024-04-29 19:30:00', NOW(3), NOW(3)),
  ('item_gal_037', 'Sorotan Laga TFN Vol. 1 - Momen #37', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1115.webp', 'cat_vol1', 37, 1, '2024-04-29 19:30:00', NOW(3), NOW(3)),
  ('item_gal_038', 'Sorotan Laga TFN Vol. 1 - Momen #38', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1122.webp', 'cat_vol1', 38, 1, '2024-04-29 19:30:00', NOW(3), NOW(3)),
  ('item_gal_039', 'Sorotan Laga TFN Vol. 1 - Momen #39', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1126.webp', 'cat_vol1', 39, 1, '2024-04-29 19:30:00', NOW(3), NOW(3)),
  ('item_gal_040', 'Sorotan Laga TFN Vol. 1 - Momen #40', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1132.webp', 'cat_vol1', 40, 1, '2024-04-29 19:30:00', NOW(3), NOW(3)),
  ('item_gal_041', 'Sorotan Laga TFN Vol. 1 - Momen #41', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1200.webp', 'cat_vol1', 41, 1, '2024-04-29 19:30:00', NOW(3), NOW(3)),
  ('item_gal_042', 'Sorotan Laga TFN Vol. 1 - Momen #42', 'Dokumentasi siaran pertandingan Temanggung Fight Night Volume 1 dari arena GOR Bambu Runcing', '/images/gallery/tfn-vol1-snap-20240429-1214.webp', 'cat_vol1', 42, 1, '2024-04-29 19:30:00', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `description` = VALUES(`description`),
  `imageUrl` = VALUES(`imageUrl`),
  `categoryId` = VALUES(`categoryId`),
  `sortOrder` = VALUES(`sortOrder`),
  `isActive` = VALUES(`isActive`),
  `takenAt` = VALUES(`takenAt`),
  `updatedAt` = NOW(3);
