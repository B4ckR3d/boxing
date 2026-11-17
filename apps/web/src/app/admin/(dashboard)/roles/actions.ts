"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError, type ActionResult } from "@/lib/actions/result";
import {
  createRole,
  updateRole,
  updateRolePermissions,
  deleteRole,
} from "@/server/services/rbac.service";

export async function createRoleAction(input: unknown): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("roles.manage");
    await createRole(user.id, input);
    revalidatePath("/admin/roles");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function updateRoleAction(input: unknown): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("roles.manage");
    await updateRole(user.id, input);
    revalidatePath("/admin/roles");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function updateRolePermissionsAction(
  input: unknown
): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("roles.manage");
    await updateRolePermissions(user.id, input);
    revalidatePath("/admin/roles");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function deleteRoleAction(roleId: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("roles.manage");
    await deleteRole(user.id, roleId);
    revalidatePath("/admin/roles");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}
