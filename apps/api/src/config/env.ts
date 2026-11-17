import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

/**
 * Environment untuk `apps/api`.
 *
 * Urutan pembacaan file .env (yang pertama ditemukan menang, tidak menimpa env proses):
 *   1. `$ENV_FILE` bila diset eksplisit
 *   2. `.env` di `process.cwd()` lalu direktori induknya (apps/api → apps → root)
 *   3. `.env` relatif terhadap lokasi file ini (fallback untuk `tsx` dan hasil bundle `dist/`)
 *
 * Catatan penting: `import.meta.url` **berubah** setelah di-bundle (src/config → dist), jadi
 * path tidak boleh hanya dihitung dari situ — pernah menyebabkan API produksi memakai default
 * (`boxing`, tanpa password) dan `/health/ready` 503 walau DB sehat.
 *
 * Semua variabel divalidasi sekali di awal; service menolak start bila invalid
 * (fail fast — jangan sampai jalan dengan konfigurasi setengah benar).
 */

const here = path.dirname(fileURLToPath(import.meta.url));

function envFileCandidates(): string[] {
  const candidates: string[] = [];
  if (process.env.ENV_FILE?.trim()) candidates.push(path.resolve(process.env.ENV_FILE.trim()));

  let dir = process.cwd();
  for (let depth = 0; depth < 5; depth += 1) {
    candidates.push(path.join(dir, ".env"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fallback berbasis lokasi file: src/config (tsx) atau dist (bundle).
  candidates.push(path.resolve(here, "../../.env"), path.resolve(here, "../../../.env"));

  return [...new Set(candidates)];
}

const loadedEnvFiles: string[] = [];
for (const candidate of envFileCandidates()) {
  if (!existsSync(candidate)) continue;
  loadDotenv({ path: candidate, override: false, quiet: true });
  loadedEnvFiles.push(candidate);
}

const bool = z
  .enum(["true", "false", "1", "0"])
  .optional()
  // Penting: tidak di-set HARUS tetap `undefined` (bukan false), supaya default
  // fitur (mis. OPENAPI_ENABLED) bisa "aktif kecuali dimatikan eksplisit".
  .transform((value) => (value === undefined ? undefined : value === "true" || value === "1"));

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().max(65535).default(4000),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  OPENAPI_ENABLED: bool,

  DATABASE_URL: z.string().optional(),
  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: z.coerce.number().int().positive().default(3307),
  MYSQL_DATABASE: z.string().default("boxing"),
  MYSQL_USER: z.string().default("boxing"),
  MYSQL_PASSWORD: z.string().default(""),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),

  /**
   * Secret HMAC untuk payload QR tiket (`TFN1.<order>.<SIG>`).
   *
   * HARUS sama dengan `AUTH_SECRET` di `apps/web`. Tiket yang diterbitkan web diverifikasi di gate
   * oleh API secara offline (tanpa DB), jadi secret berbeda = semua tiket sah ditolak sebagai palsu.
   * Panjang minimum 32 disamakan dengan skema web; `buildTicketPayload` menolak secret < 16.
   */
  AUTH_SECRET: z.string().trim().min(32, "AUTH_SECRET must be at least 32 characters"),

  /**
   * Variabel sesi/auth (Langkah E2). Nilai & default **disamakan dengan `apps/web/src/lib/env.ts`**
   * karena keduanya kini menjalankan implementasi `@tfn/auth` yang sama: masa hidup sesi, idle
   * timeout, dan kebijakan lockout harus identik atau sesi yang dibuat web akan dinilai berbeda
   * oleh API.
   *
   * `ENCRYPTION_KEY` wajib: dipakai `decryptSecret()` untuk membaca `mfaSecretEnc` saat login MFA.
   * Tanpa kunci yang sama dengan web, semua akun ber-MFA gagal login lewat API.
   */
  ENCRYPTION_KEY: z.string().refine((v) => {
    try {
      return Buffer.from(v, "base64").length === 32;
    } catch {
      return false;
    }
  }, "ENCRYPTION_KEY must be a base64-encoded 32-byte key"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  AUTH_ENFORCE_MFA: bool.default(true),
  AUTH_MAX_FAILED_LOGINS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
});

export type ApiEnv = z.infer<typeof rawSchema> & { corsOrigins: string[] };

let cached: ApiEnv | null = null;

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function env(): ApiEnv {
  if (cached) return cached;

  // DATABASE_URL (bila ada) mengisi field MYSQL_* yang belum diset eksplisit.
  const parsed = rawSchema.parse(process.env);
  if (parsed.DATABASE_URL) {
    const url = parseUrl(parsed.DATABASE_URL);
    if (!url) throw new Error("DATABASE_URL is not a valid URL");
    parsed.MYSQL_HOST = url.hostname || parsed.MYSQL_HOST;
    parsed.MYSQL_PORT = url.port ? Number(url.port) : parsed.MYSQL_PORT;
    parsed.MYSQL_DATABASE = url.pathname.replace(/^\//, "") || parsed.MYSQL_DATABASE;
    parsed.MYSQL_USER = decodeURIComponent(url.username) || parsed.MYSQL_USER;
    parsed.MYSQL_PASSWORD = decodeURIComponent(url.password) || parsed.MYSQL_PASSWORD;
  }

  cached = {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
  return cached;
}

/** Hanya untuk test: buang cache supaya perubahan process.env terbaca ulang. */
export function resetEnvCache(): void {
  cached = null;
}

/** File .env yang benar-benar dibaca (untuk log startup; menyembunyikan nilainya). */
export function loadedEnvFilePaths(): readonly string[] {
  return loadedEnvFiles;
}

export function describeEnvProblem(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}
