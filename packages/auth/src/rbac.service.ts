/**
 * Layanan RBAC — dependensi diinjeksi, tanpa `next/headers`.
 *
 * Pindah dari `apps/web/src/server/services/rbac.service.ts` (Langkah F). Versi web lama mengikat
 * dirinya ke tiga hal yang membuatnya mustahil dipakai proses lain:
 *
 *   1. `server-only` (shim Next),
 *   2. `prisma` singleton modul web (`@/lib/db/prisma`),
 *   3. `logAudit` binding web yang membaca `headers()`.
 *
 * Ketiganya kini menjadi parameter `RbacServiceDeps`. Kontrak perilaku TIDAK berubah: urutan
 * validasi, aturan four-eyes untuk role sensitif, proteksi super-admin terakhir, dan penulisan
 * audit dipertahankan persis. Yang berubah hanya sumber dependensi.
 *
 * Aturan paket: file ini tidak boleh mengimpor `next/*` maupun `server-only`.
 */
import { z } from "zod";
import type { PrismaClient } from "@tfn/db/client";
import { isPermissionKey, type PermissionKey } from "./catalog";
import { assertFourEyes } from "./permissions";

export class RbacError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RbacError";
  }
}

export interface RbacAuditEvent {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
}

export interface RbacServiceDeps {
  db: PrismaClient;
  /** Diisi binding app: `logAudit` web (menambah IP/UA) atau `logAudit` API (dari `req`). */
  audit: (event: RbacAuditEvent) => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Schemas (dipakai route/action untuk validasi input sebelum memanggil service)
// ---------------------------------------------------------------------------

export const createRoleSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "Key must be lowercase snake_case"),
  name: z.string().min(2).max(120),
  description: z.string().max(500).default(""),
});

export const updateRoleSchema = z.object({
  roleId: z.string().min(1),
  name: z.string().min(2).max(120),
  description: z.string().max(500).default(""),
  requiresMfa: z.boolean().default(false),
});

export const updateRolePermissionsSchema = z.object({
  roleId: z.string().min(1),
  permissions: z.array(z.string()).max(64),
});

export const grantRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  reason: z.string().min(4).max(500),
});

export const revokeRoleSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  reason: z.string().min(4).max(500),
});

export const reviewRoleRequestSchema = z.object({
  requestId: z.string().min(1),
  approve: z.boolean(),
  reviewNote: z.string().max(500).default(""),
});

export const setUserActiveSchema = z.object({
  userId: z.string().min(1),
  isActive: z.boolean(),
});

// ---------------------------------------------------------------------------
// Tipe hasil
// ---------------------------------------------------------------------------

export interface RoleDetail {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  requiresMfa: boolean;
  isSensitive: boolean;
  userCount: number;
  permissions: string[];
}

export interface UserDetail {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  roles: { id: string; key: string; name: string; isSensitive: boolean }[];
}

export interface PendingRoleRequest {
  id: string;
  action: string;
  status: string;
  reason: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  role: { id: string; key: string; name: string };
  requestedBy: { id: string; name: string; email: string };
}

export interface RbacService {
  listRolesDetailed(): Promise<RoleDetail[]>;
  createRole(actorId: string, input: unknown): Promise<{ id: string; key: string }>;
  updateRole(actorId: string, input: unknown): Promise<void>;
  updateRolePermissions(actorId: string, input: unknown): Promise<void>;
  deleteRole(actorId: string, roleId: string): Promise<void>;
  listUsersDetailed(): Promise<UserDetail[]>;
  listPendingRoleRequests(): Promise<PendingRoleRequest[]>;
  grantRole(actorId: string, input: unknown): Promise<{ requiresApproval: boolean }>;
  revokeRole(actorId: string, input: unknown): Promise<{ requiresApproval: boolean }>;
  reviewRoleRequest(actorId: string, input: unknown): Promise<void>;
  setUserActive(actorId: string, input: unknown): Promise<void>;
}

export function createRbacService(deps: RbacServiceDeps): RbacService {
  const { db, audit } = deps;

  async function getRoleOrThrow(roleId: string) {
    const role = await db.role.findUnique({ where: { id: roleId } });
    if (!role) throw new RbacError("Role not found");
    return role;
  }

  /** Number of ACTIVE users (optionally excluding one) holding the super_admin role */
  async function countOtherActiveSuperAdmins(excludeUserId: string): Promise<number> {
    return db.userRole.count({
      where: {
        role: { key: "super_admin" },
        userId: { not: excludeUserId },
        user: { isActive: true },
      },
    });
  }

  return {
    async listRolesDetailed() {
      const roles = await db.role.findMany({
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } },
        },
        orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
      });

      return roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        requiresMfa: r.requiresMfa,
        isSensitive: r.isSensitive,
        userCount: r._count.users,
        permissions: r.permissions.map((rp) => rp.permission.key).sort((a, b) => a.localeCompare(b)),
      }));
    },

    async createRole(actorId, input) {
      const data = createRoleSchema.parse(input);

      const existing = await db.role.findUnique({ where: { key: data.key } });
      if (existing) throw new RbacError(`Role key "${data.key}" already exists`);

      const role = await db.role.create({
        data: {
          key: data.key,
          name: data.name,
          description: data.description || null,
          isSystem: false,
        },
      });

      await audit({
        actorId,
        action: "ROLE_CREATE",
        entityType: "ROLE",
        entityId: role.id,
        summary: `Created role "${role.name}" (${role.key})`,
        metadata: { key: role.key, name: role.name },
      });

      return { id: role.id, key: role.key };
    },

    async updateRole(actorId, input) {
      const data = updateRoleSchema.parse(input);
      const role = await getRoleOrThrow(data.roleId);

      if (role.key === "super_admin") {
        throw new RbacError("The Super Admin role is immutable");
      }

      await db.role.update({
        where: { id: role.id },
        data: {
          name: data.name,
          description: data.description || null,
          requiresMfa: data.requiresMfa,
        },
      });

      await audit({
        actorId,
        action: "ROLE_UPDATE",
        entityType: "ROLE",
        entityId: role.id,
        summary: `Updated role "${role.name}" (${role.key})`,
        metadata: { name: data.name, requiresMfa: data.requiresMfa },
      });
    },

    async updateRolePermissions(actorId, input) {
      const data = updateRolePermissionsSchema.parse(input);
      const role = await getRoleOrThrow(data.roleId);

      if (role.key === "super_admin") {
        throw new RbacError("Super Admin permissions are immutable");
      }

      for (const key of data.permissions) {
        if (!isPermissionKey(key)) {
          throw new RbacError(`Unknown permission: ${key}`);
        }
      }
      const permissions = [...new Set(data.permissions)] as PermissionKey[];

      const before = await db.rolePermission.findMany({
        where: { roleId: role.id },
        include: { permission: true },
      });
      const beforeKeys = new Set(before.map((b) => b.permission.key));
      const afterKeys = new Set<string>(permissions);
      const added = permissions.filter((p) => !beforeKeys.has(p));
      const removed = [...beforeKeys].filter((p) => !afterKeys.has(p));

      await db.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        if (permissions.length > 0) {
          const perms = await tx.permission.findMany({
            where: { key: { in: permissions } },
          });
          await tx.rolePermission.createMany({
            data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
          });
        }
      });

      await audit({
        actorId,
        action: "ROLE_PERMISSIONS_UPDATE",
        entityType: "ROLE",
        entityId: role.id,
        summary: `Updated permissions of role "${role.name}" (${role.key}): +${added.length} / -${removed.length}`,
        metadata: { added, removed },
      });
    },

    async deleteRole(actorId, roleId) {
      const role = await getRoleOrThrow(roleId);

      if (role.isSystem) {
        throw new RbacError("System roles cannot be deleted");
      }

      const userCount = await db.userRole.count({ where: { roleId: role.id } });
      if (userCount > 0) {
        throw new RbacError(
          `Cannot delete: ${userCount} user(s) still hold this role. Revoke it first.`,
        );
      }

      await db.role.delete({ where: { id: role.id } });

      await audit({
        actorId,
        action: "ROLE_DELETE",
        entityType: "ROLE",
        entityId: role.id,
        summary: `Deleted role "${role.name}" (${role.key})`,
      });
    },

    async listUsersDetailed() {
      const users = await db.user.findMany({
        include: {
          roles: { include: { role: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
      });

      return users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        isActive: u.isActive,
        mfaEnabled: u.mfaEnabled,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        roles: u.roles.map((ur) => ({
          id: ur.role.id,
          key: ur.role.key,
          name: ur.role.name,
          isSensitive: ur.role.isSensitive,
        })),
      }));
    },

    async listPendingRoleRequests() {
      const requests = await db.roleRequest.findMany({
        where: { status: "PENDING" },
        include: {
          user: true,
          role: true,
          requestedBy: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      return requests.map((r) => ({
        id: r.id,
        action: r.action,
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
        user: { id: r.user.id, name: r.user.name, email: r.user.email },
        role: { id: r.role.id, key: r.role.key, name: r.role.name },
        requestedBy: {
          id: r.requestedBy.id,
          name: r.requestedBy.name,
          email: r.requestedBy.email,
        },
      }));
    },

    async grantRole(actorId, input) {
      const data = grantRoleSchema.parse(input);

      const role = await db.role.findUnique({ where: { id: data.roleId } });
      if (!role) throw new RbacError("Role not found");

      const user = await db.user.findUnique({ where: { id: data.userId } });
      if (!user) throw new RbacError("User not found");

      const existing = await db.userRole.findUnique({
        where: { userId_roleId: { userId: data.userId, roleId: data.roleId } },
      });
      if (existing) {
        throw new RbacError(`User already holds role "${role.name}"`);
      }

      if (role.isSensitive) {
        const duplicate = await db.roleRequest.findFirst({
          where: {
            userId: data.userId,
            roleId: data.roleId,
            action: "GRANT",
            status: "PENDING",
          },
        });
        if (duplicate) {
          throw new RbacError("A pending grant request for this user/role already exists");
        }

        await db.roleRequest.create({
          data: {
            userId: data.userId,
            roleId: data.roleId,
            action: "GRANT",
            reason: data.reason,
            requestedById: actorId,
          },
        });

        await audit({
          actorId,
          action: "ROLE_REQUEST_CREATE",
          entityType: "ROLE_REQUEST",
          entityId: `${data.userId}:${data.roleId}`,
          summary: `Requested GRANT of sensitive role "${role.name}" to ${user.email} — awaiting independent approval`,
          metadata: { userId: data.userId, roleKey: role.key },
        });

        return { requiresApproval: true };
      }

      await db.userRole.create({
        data: { userId: data.userId, roleId: data.roleId, assignedById: actorId },
      });

      await audit({
        actorId,
        action: "ROLE_GRANT",
        entityType: "USER_ROLE",
        entityId: `${data.userId}:${data.roleId}`,
        summary: `Granted role "${role.name}" to ${user.email}`,
        metadata: { userId: data.userId, roleKey: role.key },
      });

      return { requiresApproval: false };
    },

    async revokeRole(actorId, input) {
      const data = revokeRoleSchema.parse(input);

      const role = await db.role.findUnique({ where: { id: data.roleId } });
      if (!role) throw new RbacError("Role not found");

      const user = await db.user.findUnique({ where: { id: data.userId } });
      if (!user) throw new RbacError("User not found");

      const assignment = await db.userRole.findUnique({
        where: { userId_roleId: { userId: data.userId, roleId: data.roleId } },
      });
      if (!assignment) {
        throw new RbacError(`User does not hold role "${role.name}"`);
      }

      if (role.key === "super_admin" && (await countOtherActiveSuperAdmins(data.userId)) === 0) {
        throw new RbacError("Cannot revoke: this is the last active Super Admin");
      }

      if (role.isSensitive) {
        const duplicate = await db.roleRequest.findFirst({
          where: {
            userId: data.userId,
            roleId: data.roleId,
            action: "REVOKE",
            status: "PENDING",
          },
        });
        if (duplicate) {
          throw new RbacError("A pending revoke request for this user/role already exists");
        }

        await db.roleRequest.create({
          data: {
            userId: data.userId,
            roleId: data.roleId,
            action: "REVOKE",
            reason: data.reason,
            requestedById: actorId,
          },
        });

        await audit({
          actorId,
          action: "ROLE_REQUEST_CREATE",
          entityType: "ROLE_REQUEST",
          entityId: `${data.userId}:${data.roleId}`,
          summary: `Requested REVOKE of sensitive role "${role.name}" from ${user.email} — awaiting independent approval`,
          metadata: { userId: data.userId, roleKey: role.key },
        });

        return { requiresApproval: true };
      }

      await db.userRole.delete({
        where: { userId_roleId: { userId: data.userId, roleId: data.roleId } },
      });

      await audit({
        actorId,
        action: "ROLE_REVOKE",
        entityType: "USER_ROLE",
        entityId: `${data.userId}:${data.roleId}`,
        summary: `Revoked role "${role.name}" from ${user.email}`,
        metadata: { userId: data.userId, roleKey: role.key },
      });

      return { requiresApproval: false };
    },

    async reviewRoleRequest(actorId, input) {
      const data = reviewRoleRequestSchema.parse(input);

      const request = await db.roleRequest.findUnique({
        where: { id: data.requestId },
        include: { role: true, user: true },
      });
      if (!request) throw new RbacError("Role request not found");
      if (request.status !== "PENDING") {
        throw new RbacError(`Request already ${request.status.toLowerCase()}`);
      }

      assertFourEyes(actorId, request.requestedById, "role request review");

      if (data.approve) {
        if (request.action === "GRANT") {
          const existing = await db.userRole.findUnique({
            where: {
              userId_roleId: { userId: request.userId, roleId: request.roleId },
            },
          });
          if (!existing) {
            await db.userRole.create({
              data: {
                userId: request.userId,
                roleId: request.roleId,
                assignedById: actorId,
              },
            });
          }
        } else {
          if (
            request.role.key === "super_admin" &&
            (await countOtherActiveSuperAdmins(request.userId)) === 0
          ) {
            throw new RbacError("Cannot revoke: this is the last active Super Admin");
          }
          await db.userRole.deleteMany({
            where: { userId: request.userId, roleId: request.roleId },
          });
        }
      }

      await db.roleRequest.update({
        where: { id: request.id },
        data: {
          status: data.approve ? "APPROVED" : "REJECTED",
          reviewedById: actorId,
          reviewedAt: new Date(),
          reviewNote: data.reviewNote || null,
        },
      });

      await audit({
        actorId,
        action: data.approve ? "ROLE_REQUEST_APPROVE" : "ROLE_REQUEST_REJECT",
        entityType: "ROLE_REQUEST",
        entityId: request.id,
        summary: `${data.approve ? "Approved" : "Rejected"} ${request.action} of role "${request.role.name}" for ${request.user.email}`,
        metadata: { userId: request.userId, roleKey: request.role.key },
      });
    },

    async setUserActive(actorId, input) {
      const data = setUserActiveSchema.parse(input);

      const user = await db.user.findUnique({
        where: { id: data.userId },
        include: { roles: { include: { role: true } } },
      });
      if (!user) throw new RbacError("User not found");

      if (!data.isActive) {
        if (user.id === actorId) {
          throw new RbacError("You cannot deactivate your own account");
        }
        const isSuperAdmin = user.roles.some((ur) => ur.role.key === "super_admin");
        if (isSuperAdmin && (await countOtherActiveSuperAdmins(user.id)) === 0) {
          throw new RbacError("Cannot deactivate the last active Super Admin");
        }
      }

      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { isActive: data.isActive },
        });
        if (!data.isActive) {
          // Revoke all live sessions of the deactivated account
          await tx.session.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      });

      await audit({
        actorId,
        action: data.isActive ? "USER_ACTIVATE" : "USER_DEACTIVATE",
        entityType: "USER",
        entityId: user.id,
        summary: `${data.isActive ? "Activated" : "Deactivated"} account ${user.email}${data.isActive ? "" : " and revoked all sessions"}`,
        metadata: { userId: user.id },
      });
    },
  };
}
