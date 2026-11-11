-- Development-only bootstrap: test database + privileges required by `prisma migrate dev` (shadow DB).
-- NEVER grant global privileges to the application user in production.
CREATE DATABASE IF NOT EXISTS boxing_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON *.* TO 'boxing'@'%';
FLUSH PRIVILEGES;

