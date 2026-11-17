"use server";

/**
 * Server action admin settings (Langkah D).
 *
 * Sebelumnya action ini memanggil `updateSettings()` yang menulis Prisma langsung dari proses Next —
 * artinya otoritas settings ada di web. Sekarang ia **proxy tipis** ke `PUT /api/settings`:
 *   - `requirePermission("settings.manage")` + `verifyRequestOrigin()` tetap di sini (lapisan UI),
 *   - API mengulang pemeriksaan permission & origin (pertahanan berlapis, bukan duplikasi logika),
 *   - cookie sesi diteruskan agar API tahu siapa petugasnya,
 *   - audit ditulis API dengan IP/UA dari request yang diteruskan.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError, type ActionResult } from "@/lib/actions/result";
import { apiFetch } from "@/lib/api/client";

/** Header yang membuat `apps/api` melihat permintaan ini sebagai permintaan pengguna yang sama. */
async function forwardedHeaders(): Promise<Record<string, string>> {
  const h = await headers();
  const cookie = h.get("cookie");
  const origin = h.get("origin");
  return {
    ...(cookie ? { cookie } : {}),
    ...(origin ? { origin } : {}),
  };
}

export async function updateSettingsAction(values: Record<string, unknown>): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("settings.manage");

    await apiFetch("/api/settings", {
      method: "PUT",
      body: { values },
      headers: await forwardedHeaders(),
    });

    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}
