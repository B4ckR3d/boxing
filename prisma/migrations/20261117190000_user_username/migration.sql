-- Tambah kolom `username` sebagai handle login (login menerima username ATAU email).
--
-- Kolom sengaja ditambah dalam tiga langkah. `ADD COLUMN ... NOT NULL` tanpa default akan gagal
-- pada tabel yang sudah berisi 8 akun demo, dan memakai DEFAULT '' akan menabrak unique index
-- karena semua baris kosong dianggap duplikat.

-- 1) Tambah sebagai nullable dulu
ALTER TABLE `User` ADD COLUMN `username` VARCHAR(64) NULL;

-- 2) Backfill dari local-part email, lowercase. Semua email demo memakai domain @boxing.local
--    dengan local-part unik (diverifikasi sebelum migrasi: nol bentrok), jadi hasilnya unik.
UPDATE `User` SET `username` = LOWER(SUBSTRING_INDEX(`email`, '@', 1)) WHERE `username` IS NULL;

-- 3) Baru kunci sebagai NOT NULL + unique
ALTER TABLE `User` MODIFY COLUMN `username` VARCHAR(64) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);
