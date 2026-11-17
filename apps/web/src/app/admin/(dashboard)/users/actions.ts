"use server";

import { revalidatePath } from "next/cache";
import { ApiClientError } from "@/lib/api/client";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError, type ActionResult } from "@/lib/actions/result";
// Otoritas RBAC ada di `apps/api` (Langkah F lanjutan) — klien ini meneruskan cookie + origin asli.
import {
  createUser,
  grantRole,
  revokeRole,
  reviewRoleRequest,
  setUserActive,
} from "@/lib/api/rbac";

/**
 * Buat user baru. Hanya pemegang `users.manage`.
 *
 * Password plaintext **tidak pernah** dicatat di sini — diteruskan apa adanya ke `apps/api` yang
 * langsung meng-hash-nya. `revalidatePath` dipanggil agar daftar user di halaman ikut segar.
 */
export async function createUserAction(input: unknown): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("users.manage");
    const created = await createUser(user.id, input);
    revalidatePath("/admin/users");
    return { ok: true, id: created.id, username: created.username };
  } catch (err) {
    // Pesan domain dari API ("Username is already taken", "Email is already registered")
    // ditulis untuk operator dan harus terlihat. `actionError` sengaja menyembunyikan error
    // yang tidak dikenal, jadi jalur 4xx diteruskan lebih dulu.
    if (err instanceof ApiClientError && err.status >= 400 && err.status < 500) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: actionError(err) };
  }
}

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
