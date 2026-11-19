-- =============================================================================
-- TFN POPUP EVENT & EXHIBITION SETTINGS SYNC
-- Setting TFN Vol. 6 & Tanggal Pertandingan 9 Januari 2027
-- =============================================================================

INSERT INTO `organizationsetting` (`key`, `value`, `updatedById`, `updatedAt`)
VALUES 
(
  'popup.event',
  '{"isEnabled":true,"badge":"LAGA MENDATANG · TIKET RESMI","title":"TEMANGGUNG FIGHT NIGHT VOL. 6","subtitle":"SABTU, 9 JANUARI 2027 · GOR BAMBU RUNCING","description":"Perebutan sabuk emas kelas berat & welter. Dapatkan tiket Anda sebelum kehabisan!","imageUrl":"/images/hero/hero_fighter_5_champion.jpg","buttonLabel":"BELI TIKET SEKARANG","buttonUrl":"https://tiket.pimpom.id"}',
  NULL,
  NOW(3)
),
(
  'exhibition.vol6',
  '{"isEnabled":true,"badge":"VOL. 6 EXHIBITION","title":"SETIAP RONDE PUNYA CERITA.","rulesText":"Rules: Boxing & Kickboxing (Low Contact) · Terbuka untuk 11 Kelas Timbangan","whatsappNumber":"6281390823332","whatsappNumber2":"6285848000639","ctaLabel":"DAFTAR PARTAI VIA WA","closedDivisions":""}',
  NULL,
  NOW(3)
)
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  `updatedAt` = NOW(3);
