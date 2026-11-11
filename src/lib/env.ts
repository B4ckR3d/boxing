import "server-only";
import { z } from "zod";

/**
 * Server-only environment. Validated once at first access; never imported by client components.
 * Secrets never reach the client bundle (no NEXT_PUBLIC_ prefix is used for secrets).
 */
const bool = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),

  MYSQL_HOST: z.string().min(1).default("localhost"),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_DATABASE: z.string().min(1),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(1),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),

  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be a base64 32-byte key"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  AUTH_ENFORCE_MFA: bool.default(true),
  AUTH_MAX_FAILED_LOGINS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_MAX_IMAGE_MB: z.coerce.number().positive().max(50).default(8),
  UPLOAD_MAX_VIDEO_MB: z.coerce.number().positive().max(500).default(40),
  UPLOAD_MAX_MODEL_MB: z.coerce.number().positive().max(100).default(20),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  S3_FORCE_PATH_STYLE: bool.default(true),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid server environment: ${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.STORAGE_DRIVER === "local") {
    console.warn("[env] STORAGE_DRIVER=local in production is not recommended. Use s3.");
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

