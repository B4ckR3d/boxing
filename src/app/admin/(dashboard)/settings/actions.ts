"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError, type ActionResult } from "@/lib/actions/result";
import { updateSettings } from "@/server/services/settings.service";

export async function updateSettingsAction(
  values: Record<string, unknown>
): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    const user = await requirePermission("settings.manage");
    await updateSettings(user.id, values);
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}
