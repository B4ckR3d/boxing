-- Development-only bootstrap: test database + privileges required by `prisma migrate dev` (shadow DB).
-- NEVER grant global privileges to the application user in production.
--
-- NOTE: the grant target must match MYSQL_USER from .env (default in this repo: `boxing_user`).
-- MySQL 8 no longer creates users implicitly through GRANT, so granting to a non-existent
-- account ('boxing'@'%') aborts container initialization.
CREATE DATABASE IF NOT EXISTS boxing_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON *.* TO 'boxing_user'@'%';
FLUSH PRIVILEGES;
