import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ALL_PERMISSIONS, DEFAULT_ROLES, PERMISSIONS } from "../src/lib/permissions/catalog";
import { hashPassword } from "../src/lib/security/password";
import { getBootstrapAccount } from "./account-policy";

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
  const account = getBootstrapAccount(process.env);
  console.log("🔐 [Bootstrap Admin] Ensuring roles and permissions...");

  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { description: PERMISSIONS[key] },
      create: { key, description: PERMISSIONS[key] },
    });
  }

  for (const r of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: {
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        requiresMfa: r.requiresMfa,
        isSensitive: r.isSensitive,
      },
      create: {
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        requiresMfa: r.requiresMfa,
        isSensitive: r.isSensitive,
      },
    });

    for (const permKey of r.permissions) {
      const perm = await prisma.permission.findUnique({ where: { key: permKey } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  const rawPass = account.password;

  console.log("🔐 [Bootstrap Admin] Hashing password with Argon2id...");
  const passwordHash = await hashPassword(rawPass);

  const accounts = [{ email: account.email, name: account.name, roleKey: "super_admin" }];

  console.log("🔐 [Bootstrap Admin] Upserting admin accounts...");
  for (const acc of accounts) {
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: { passwordHash, isActive: true, failedLoginCount: 0, lockedUntil: null, passwordChangedAt: new Date() },
      create: {
        email: acc.email,
        name: acc.name,
        passwordHash,
        isActive: true,
      },
    });

    const role = await prisma.role.findUnique({ where: { key: acc.roleKey } });
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }

    console.log(`  ✓ Ready: ${acc.email} (${acc.roleKey})`);
  }

  console.log("\n=======================================================");
  console.log("✅ Admin accounts successfully bootstrapped & unlocked!");
  console.log(`   Email: ${account.email}`);
  console.log("   Password reset to BOOTSTRAP_ADMIN_PASSWORD and account unlocked.");
  console.log("   Demo/persona accounts are untouched; use user:reset-password for those.");
  console.log("=======================================================\n");
}

main()
  .catch((e) => {
    console.error("❌ [Bootstrap Admin] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

