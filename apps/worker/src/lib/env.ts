/**
 * Environment `apps/worker`.
 *
 * Dulu worker membaca `env()` milik `apps/web` lewat alias `@/*` → `../web/src/*`. Itu berarti
 * variabel seperti `MYSQL_*` dan `AUTH_SECRET` divalidasi oleh skema web, bukan skema worker.
 * Sekarang worker punya skema sendiri — hanya yang benar-benar dipakai.
 *
 * Urutan pembacaan `.env`: `process.cwd()` lalu induknya (apps/worker → apps → root), sama seperti
 * `apps/api`, supaya `pnpm --filter @tfn/worker …` dan menjalankan dari root memberi hasil identik.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

function loadEnvFiles(): void {
  let dir = process.cwd();
  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = path.join(dir, ".env");
    if (existsSync(candidate)) loadDotenv({ path: candidate, override: false, quiet: true });
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

loadEnvFiles();

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().optional(),
  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: z.coerce.number().int().positive().default(3307),
  MYSQL_DATABASE: z.string().default("boxing"),
  MYSQL_USER: z.string().default("boxing"),
  MYSQL_PASSWORD: z.string().default(""),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),

  /** Samakan dengan `apps/web` & `apps/api`: secret HMAC payload QR tiket. */
  AUTH_SECRET: z.string().trim().min(32, "AUTH_SECRET must be at least 32 characters"),

  /** Ambang sapuan hold; default sama dengan `HOLD_EXPIRY_DEFAULT_HOURS` di paket ticketing. */
  TICKET_HOLD_EXPIRY_HOURS: z.coerce.number().int().min(1).max(720).default(24),
});

export type WorkerEnv = z.infer<typeof rawSchema>;

let cached: WorkerEnv | null = null;

export function env(): WorkerEnv {
  if (cached) return cached;
  const parsed = rawSchema.parse(process.env);
  if (parsed.DATABASE_URL) {
    try {
      const url = new URL(parsed.DATABASE_URL);
      parsed.MYSQL_HOST = url.hostname || parsed.MYSQL_HOST;
      parsed.MYSQL_PORT = url.port ? Number(url.port) : parsed.MYSQL_PORT;
      parsed.MYSQL_DATABASE = url.pathname.replace(/^\//, "") || parsed.MYSQL_DATABASE;
      if (url.username) parsed.MYSQL_USER = decodeURIComponent(url.username);
      if (url.password) parsed.MYSQL_PASSWORD = decodeURIComponent(url.password);
    } catch {
      // DATABASE_URL tidak valid → biarkan MYSQL_* eksplisit yang dipakai.
    }
  }
  cached = parsed;
  return cached;
}
