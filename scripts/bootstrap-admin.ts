import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { ALL_PERMISSIONS, DEFAULT_ROLES, PERMISSIONS } from "../src/lib/permissions/catalog";
import { hashPassword } from "../src/lib/security/password";

const adapter = new PrismaMariaDb({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || "boxing",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "boxing",
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

async function main() {
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

  const rawPass =
    process.env.ADMIN_PASSWORD ||
    process.env.DEMO_USER_PASSWORD ||
    "Demo-Ringside-2026!";

  console.log("🔐 [Bootstrap Admin] Hashing password with Argon2id...");
  const passwordHash = await hashPassword(rawPass);

  const accounts = [
    { email: "superadmin@boxing.local", name: "Super Admin", roleKey: "super_admin" },
    { email: "admin@boxing.local", name: "Platform Admin", roleKey: "administrator" },
    { email: "rankings@boxing.local", name: "Chief Ranking Officer", roleKey: "ranking_manager" },
    { email: "tournaments@boxing.local", name: "Grand Prix Director", roleKey: "tournament_manager" },
  ];

  console.log("🔐 [Bootstrap Admin] Upserting admin accounts...");
  for (const acc of accounts) {
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        name: acc.name,
        isActive: true,
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
      },
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
  console.log(`   Email:    admin@boxing.local / superadmin@boxing.local`);
  console.log(`   Password: ${rawPass}`);
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
