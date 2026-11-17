import "server-only";
import { prisma } from "@/lib/db/prisma";
import {
  createRbacService,
  type PendingRoleRequest,
  type RoleDetail,
  type UserDetail,
} from "@tfn/auth/rbac-service";
import { logAudit } from "./audit.service";

/**
 * Binding `apps/web` → `@tfn/auth` (RBAC, Langkah F).
 *
 * Logika domain tidak lagi tinggal di sini — yang tersisa hanya penyuntikan dependensi proses web:
 * Prisma singleton dan `logAudit` yang menambahkan IP/User-Agent dari `headers()`. Dengan begitu
 * `apps/api` (dan worker) memakai aturan RBAC yang sama persis tanpa menyeret `next/headers`.
 *
 * Nama ekspor lama dipertahankan supaya seluruh call site (`actions.ts`, `page.tsx`, komponen)
 * tidak perlu diubah.
 */
const service = createRbacService({
  db: prisma,
  audit: (event) => logAudit(event),
});

export { RbacError } from "@tfn/auth/rbac-service";
export {
  createRoleSchema,
  updateRoleSchema,
  updateRolePermissionsSchema,
  grantRoleSchema,
  revokeRoleSchema,
  reviewRoleRequestSchema,
  setUserActiveSchema,
} from "@tfn/auth/rbac-service";
export type { PendingRoleRequest, RoleDetail, UserDetail };

export function listRolesDetailed(): Promise<RoleDetail[]> {
  return service.listRolesDetailed();
}

export function createRole(actorId: string, input: unknown): Promise<{ id: string; key: string }> {
  return service.createRole(actorId, input);
}

export function updateRole(actorId: string, input: unknown): Promise<void> {
  return service.updateRole(actorId, input);
}

export function updateRolePermissions(actorId: string, input: unknown): Promise<void> {
  return service.updateRolePermissions(actorId, input);
}

export function deleteRole(actorId: string, roleId: string): Promise<void> {
  return service.deleteRole(actorId, roleId);
}

export function listUsersDetailed(): Promise<UserDetail[]> {
  return service.listUsersDetailed();
}

export function listPendingRoleRequests(): Promise<PendingRoleRequest[]> {
  return service.listPendingRoleRequests();
}

export function grantRole(actorId: string, input: unknown): Promise<{ requiresApproval: boolean }> {
  return service.grantRole(actorId, input);
}

export function revokeRole(
  actorId: string,
  input: unknown,
): Promise<{ requiresApproval: boolean }> {
  return service.revokeRole(actorId, input);
}

export function reviewRoleRequest(actorId: string, input: unknown): Promise<void> {
  return service.reviewRoleRequest(actorId, input);
}

export function setUserActive(actorId: string, input: unknown): Promise<void> {
  return service.setUserActive(actorId, input);
}
