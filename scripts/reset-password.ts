import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hashPassword, passwordPolicy } from "../src/lib/security/password";

/**
 * Reset an admin password directly in the database.
 *
 * Neither `prisma db seed` nor `scripts/bootstrap-admin.ts` could fix a wrong
 * password: both use `update: {}`, so an existing row keeps its old hash.
 * This script is the explicit escape hatch.
 *
 *   npm run user:reset-password -- --email=superadmin@boxing.local --password='...'
 *   npm run user:reset-password -- --all-demo        # every @boxing.local demo account
 *
 * `--all-demo` uses DEMO_USER_PASSWORD from .env; a single-account run uses
 * `--password` or NEW_PASSWORD. Passwords are never printed back.
 */

const DEMO_EMAILS = [
  "superadmin@boxing.local",
  "admin@boxing.local",
  "rankings@boxing.local",
  "tournaments@boxing.local",
  "editor@boxing.local",
  "data@boxing.local",
  "reviewer@boxing.local",
  "viewer@boxing.local",
];

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

let dbHost = process.env.MYSQL_HOST || "127.0.0.1";
let dbPort = Number(process.env.MYSQL_PORT) || 3306;
let dbUser = process.env.MYSQL_USER || "boxing";
let dbPass = process.env.MYSQL_PASSWORD || "";
let dbName = process.env.MYSQL_DATABASE || "boxing";

if (process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    if (u.hostname) dbHost = u.hostname;
    if (u.port) dbPort = Number(u.port);
    if (u.username) dbUser = decodeURIComponent(u.username);
    if (u.password) dbPass = decodeURIComponent(u.password);
    if (u.pathname) dbName = u.pathname.replace(/^\//, "");
  } catch {}
}

const adapter = new PrismaMariaDb({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPass,
  database: dbName,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const allDemo = process.argv.includes("--all-demo");
  const emailArg = argValue("email")?.trim().toLowerCase();
  const passwordArg = argValue("password") ?? process.env.NEW_PASSWORD;

  const targets = allDemo ? DEMO_EMAILS : emailArg ? [emailArg] : [];
  if (targets.length === 0) {
    console.error("✗ Give --email=<address> --password=<new> or --all-demo (DEMO_USER_PASSWORD).");
    process.exit(1);
  }

  const rawPassword = allDemo ? process.env.DEMO_USER_PASSWORD : passwordArg;
  if (!rawPassword) {
    console.error(allDemo ? "✗ DEMO_USER_PASSWORD is empty in .env" : "✗ --password / NEW_PASSWORD is required");
    process.exit(1);
  }
  const parsed = passwordPolicy.safeParse(rawPassword);
  if (!parsed.success) {
    console.error(`✗ Password rejected: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    process.exit(1);
  }

  console.log(`→ Database: ${dbUser}@${dbHost}:${dbPort}/${dbName}`);
  console.log(`→ Hashing with Argon2id (${parsed.data.length} char password)`);
  const passwordHash = await hashPassword(parsed.data);

  let missing = 0;
  for (const email of targets) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`  ✗ ${email}: not found (account was never seeded)`);
      missing += 1;
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, isActive: true, failedLoginCount: 0, lockedUntil: null, passwordChangedAt: new Date() },
    });
    console.log(`  ✓ ${email}: password reset, account unlocked`);
  }

  if (missing === targets.length) {
    console.error("\n✗ Nothing updated — run the bootstrap for the primary admin first.");
    process.exit(1);
  }
  console.log(`\n✅ ${targets.length - missing}/${targets.length} account(s) updated.`);
}

main()
  .catch((e) => {
    console.error("❌ [Reset Password] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
