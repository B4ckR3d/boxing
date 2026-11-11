import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { isPermissionKey, type PermissionKey } from "@/lib/permissions/catalog";
import { assertFourEyes } from "@/lib/permissions/guard";
import { logAudit } from "./audit.service";

export class RbacError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RbacError";
  }
}

// ---------------------------------------------------------------------------
// Schemas
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
// Roles
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

export async function listRolesDetailed(): Promise<RoleDetail[]> {
  const roles = await prisma.role.findMany({
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
    permissions: r.permissions
      .map((rp) => rp.permission.key)
      .sort((a, b) => a.localeCompare(b)),
  }));
}

async function getRoleOrThrow(roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new RbacError("Role not found");
  return role;
}

export async function createRole(
  actorId: string,
  input: unknown
): Promise<{ id: string; key: string }> {
  const data = createRoleSchema.parse(input);

  const existing = await prisma.role.findUnique({ where: { key: data.key } });
  if (existing) throw new RbacError(`Role key "${data.key}" already exists`);

  const role = await prisma.role.create({
    data: {
      key: data.key,
      name: data.name,
      description: data.description || null,
      isSystem: false,
    },
  });

  await logAudit({
    actorId,
    action: "ROLE_CREATE",
    entityType: "ROLE",
    entityId: role.id,
    summary: `Created role "${role.name}" (${role.key})`,
    metadata: { key: role.key, name: role.name },
  });

  return { id: role.id, key: role.key };
}

export async function updateRole(actorId: string, input: unknown): Promise<void> {
  const data = updateRoleSchema.parse(input);
  const role = await getRoleOrThrow(data.roleId);

  if (role.key === "super_admin") {
    throw new RbacError("The Super Admin role is immutable");
  }

  await prisma.role.update({
    where: { id: role.id },
    data: {
      name: data.name,
      description: data.description || null,
      requiresMfa: data.requiresMfa,
    },
  });

  await logAudit({
    actorId,
    action: "ROLE_UPDATE",
    entityType: "ROLE",
    entityId: role.id,
    summary: `Updated role "${role.name}" (${role.key})`,
    metadata: { name: data.name, requiresMfa: data.requiresMfa },
  });
}

export async function updateRolePermissions(
  actorId: string,
  input: unknown
): Promise<void> {
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

  const before = await prisma.rolePermission.findMany({
    where: { roleId: role.id },
    include: { permission: true },
  });
  const beforeKeys = new Set(before.map((b) => b.permission.key));
  const afterKeys = new Set<string>(permissions);
  const added = permissions.filter((p) => !beforeKeys.has(p));
  const removed = [...beforeKeys].filter((p) => !afterKeys.has(p));

  await prisma.$transaction(async (tx) => {
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

  await logAudit({
    actorId,
    action: "ROLE_PERMISSIONS_UPDATE",
    entityType: "ROLE",
    entityId: role.id,
    summary: `Updated permissions of role "${role.name}" (${role.key}): +${added.length} / -${removed.length}`,
    metadata: { added, removed },
  });
}

export async function deleteRole(actorId: string, roleId: string): Promise<void> {
  const role = await getRoleOrThrow(roleId);

  if (role.isSystem) {
    throw new RbacError("System roles cannot be deleted");
  }

  const userCount = await prisma.userRole.count({ where: { roleId: role.id } });
  if (userCount > 0) {
    throw new RbacError(
      `Cannot delete: ${userCount} user(s) still hold this role. Revoke it first.`
    );
  }

  await prisma.role.delete({ where: { id: role.id } });

  await logAudit({
    actorId,
    action: "ROLE_DELETE",
    entityType: "ROLE",
    entityId: role.id,
    summary: `Deleted role "${role.name}" (${role.key})`,
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserDetail {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  roles: { id: string; key: string; name: string; isSensitive: boolean }[];
}

export async function listUsersDetailed(): Promise<UserDetail[]> {
  const users = await prisma.user.findMany({
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
}

export async function listPendingRoleRequests() {
  const requests = await prisma.roleRequest.findMany({
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
}

/** Number of ACTIVE users (optionally excluding one) holding the super_admin role */
async function countOtherActiveSuperAdmins(excludeUserId: string): Promise<number> {
  return prisma.userRole.count({
    where: {
      role: { key: "super_admin" },
      userId: { not: excludeUserId },
      user: { isActive: true },
    },
  });
}

/**
 * Grants a non-sensitive role directly; sensitive roles create a PENDING
 * RoleRequest that another roles.manage holder must approve (four-eyes).
 */
export async function grantRole(
  actorId: string,
  input: unknown
): Promise<{ requiresApproval: boolean }> {
  const data = grantRoleSchema.parse(input);

  const role = await prisma.role.findUnique({ where: { id: data.roleId } });
  if (!role) throw new RbacError("Role not found");

  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) throw new RbacError("User not found");

  const existing = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId: data.userId, roleId: data.roleId } },
  });
  if (existing) {
    throw new RbacError(`User already holds role "${role.name}"`);
  }

  if (role.isSensitive) {
    const duplicate = await prisma.roleRequest.findFirst({
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

    await prisma.roleRequest.create({
      data: {
        userId: data.userId,
        roleId: data.roleId,
        action: "GRANT",
        reason: data.reason,
        requestedById: actorId,
      },
    });

    await logAudit({
      actorId,
      action: "ROLE_REQUEST_CREATE",
      entityType: "ROLE_REQUEST",
      entityId: `${data.userId}:${data.roleId}`,
      summary: `Requested GRANT of sensitive role "${role.name}" to ${user.email} — awaiting independent approval`,
      metadata: { userId: data.userId, roleKey: role.key },
    });

    return { requiresApproval: true };
  }

  await prisma.userRole.create({
    data: { userId: data.userId, roleId: data.roleId, assignedById: actorId },
  });

  await logAudit({
    actorId,
    action: "ROLE_GRANT",
    entityType: "USER_ROLE",
    entityId: `${data.userId}:${data.roleId}`,
    summary: `Granted role "${role.name}" to ${user.email}`,
    metadata: { userId: data.userId, roleKey: role.key },
  });

  return { requiresApproval: false };
}

export async function revokeRole(
  actorId: string,
  input: unknown
): Promise<{ requiresApproval: boolean }> {
  const data = revokeRoleSchema.parse(input);

  const role = await prisma.role.findUnique({ where: { id: data.roleId } });
  if (!role) throw new RbacError("Role not found");

  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) throw new RbacError("User not found");

  const assignment = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId: data.userId, roleId: data.roleId } },
  });
  if (!assignment) {
    throw new RbacError(`User does not hold role "${role.name}"`);
  }

  if (role.key === "super_admin" && (await countOtherActiveSuperAdmins(data.userId)) === 0) {
    throw new RbacError("Cannot revoke: this is the last active Super Admin");
  }

  if (role.isSensitive) {
    const duplicate = await prisma.roleRequest.findFirst({
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

    await prisma.roleRequest.create({
      data: {
        userId: data.userId,
        roleId: data.roleId,
        action: "REVOKE",
        reason: data.reason,
        requestedById: actorId,
      },
    });

    await logAudit({
      actorId,
      action: "ROLE_REQUEST_CREATE",
      entityType: "ROLE_REQUEST",
      entityId: `${data.userId}:${data.roleId}`,
      summary: `Requested REVOKE of sensitive role "${role.name}" from ${user.email} — awaiting independent approval`,
      metadata: { userId: data.userId, roleKey: role.key },
    });

    return { requiresApproval: true };
  }

  await prisma.userRole.delete({
    where: { userId_roleId: { userId: data.userId, roleId: data.roleId } },
  });

  await logAudit({
    actorId,
    action: "ROLE_REVOKE",
    entityType: "USER_ROLE",
    entityId: `${data.userId}:${data.roleId}`,
    summary: `Revoked role "${role.name}" from ${user.email}`,
    metadata: { userId: data.userId, roleKey: role.key },
  });

  return { requiresApproval: false };
}

/** Approves/rejects a pending RoleRequest. Reviewer must differ from requester. */
export async function reviewRoleRequest(
  actorId: string,
  input: unknown
): Promise<void> {
  const data = reviewRoleRequestSchema.parse(input);

  const request = await prisma.roleRequest.findUnique({
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
      const existing = await prisma.userRole.findUnique({
        where: {
          userId_roleId: { userId: request.userId, roleId: request.roleId },
        },
      });
      if (!existing) {
        await prisma.userRole.create({
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
      await prisma.userRole.deleteMany({
        where: { userId: request.userId, roleId: request.roleId },
      });
    }
  }

  await prisma.roleRequest.update({
    where: { id: request.id },
    data: {
      status: data.approve ? "APPROVED" : "REJECTED",
      reviewedById: actorId,
      reviewedAt: new Date(),
      reviewNote: data.reviewNote || null,
    },
  });

  await logAudit({
    actorId,
    action: data.approve ? "ROLE_REQUEST_APPROVE" : "ROLE_REQUEST_REJECT",
    entityType: "ROLE_REQUEST",
    entityId: request.id,
    summary: `${data.approve ? "Approved" : "Rejected"} ${request.action} of role "${request.role.name}" for ${request.user.email}`,
    metadata: { userId: request.userId, roleKey: request.role.key },
  });
}

export async function setUserActive(
  actorId: string,
  input: unknown
): Promise<void> {
  const data = setUserActiveSchema.parse(input);

  const user = await prisma.user.findUnique({
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

  await prisma.$transaction(async (tx) => {
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

  await logAudit({
    actorId,
    action: data.isActive ? "USER_ACTIVATE" : "USER_DEACTIVATE",
    entityType: "USER",
    entityId: user.id,
    summary: `${data.isActive ? "Activated" : "Deactivated"} account ${user.email}${data.isActive ? "" : " and revoked all sessions"}`,
    metadata: { userId: user.id },
  });
}
