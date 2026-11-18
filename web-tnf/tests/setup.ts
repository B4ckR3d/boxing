import { config as loadEnv } from "dotenv";

// Monorepo: .env tunggal di root repo. `dotenv/config` membaca cwd (apps/web), jadi
// path-nya ditunjuk eksplisit agar unit & integration test memakai konfigurasi yang sama
// dengan dev/produksi.
loadEnv({ path: new URL("../../../.env", import.meta.url).pathname });

// Fallback dummy env for tests if not provided
process.env.MYSQL_DATABASE ??= "boxing_test";
process.env.MYSQL_USER ??= "boxing";
process.env.MYSQL_PASSWORD ??= "testpass";
process.env.AUTH_SECRET ??= "test-secret-at-least-32-characters-long-123456";
process.env.ENCRYPTION_KEY ??= "zS9RNQd83tfaqENs5iwZ7vGw0vgaJ3vbfd1EeKDX03A=";

