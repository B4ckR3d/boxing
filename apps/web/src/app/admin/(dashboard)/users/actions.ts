"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError, type ActionResult } from "@/lib/actions/result";
// Otoritas RBAC ada di `apps/api` (Langkah F lanjutan) — klien ini meneruskan cookie + origin asli.
import {
  grantRole,
  revokeRole,
  reviewRoleRequest,
  setUserActive,
} from "@/lib/api/rbac";

export async function grantRoleAction(input: unknown): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("users.manage");
    const result = await grantRole(user.id, input);
    revalidatePath("/admin/users");
    return { ok: true, requiresApproval: result.requiresApproval };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function revokeRoleAction(input: unknown): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("users.manage");
    const result = await revokeRole(user.id, input);
    revalidatePath("/admin/users");
    return { ok: true, requiresApproval: result.requiresApproval };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function reviewRoleRequestAction(
  input: unknown
): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("roles.manage");
    await reviewRoleRequest(user.id, input);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function setUserActiveAction(input: unknown): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("users.manage");
    await setUserActive(user.id, input);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}
