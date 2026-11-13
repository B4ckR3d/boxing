"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError } from "@/lib/actions/result";
import { checkInTicket, CheckInResult, TicketingError } from "@/server/services/ticketing.service";

export type CheckInActionResult =
  | { ok: true; result: Omit<CheckInResult, "checkedInAt"> & { checkedInAt: string } }
  | { ok: false; error: string; code?: string };

/**
 * Gate check-in. Uses `ticketing.confirm` — the same trust level as confirming a payment, because
 * admitting someone is the physical counterpart of confirming their money. A dedicated
 * `ticketing.scan` key would need every existing DB to be re-seeded before ushers could work.
 */
export async function checkInTicketAction(raw: unknown, eventId?: string | null): Promise<CheckInActionResult> {
  try {
    if (!(await verifyRequestOrigin())) return { ok: false, error: "Invalid request origin" };
    const user = await requirePermission("ticketing.confirm");

    const result = await checkInTicket({
      raw: typeof raw === "string" ? raw : "",
      operatorId: user.id,
      eventId: eventId || null,
    });

    revalidatePath("/admin/ticketing");
    revalidatePath("/admin/ticketing/scan");
    return { ok: true, result: { ...result, checkedInAt: result.checkedInAt.toISOString() } };
  } catch (e) {
    // TicketingError carries the sentence the usher needs ("sudah dipakai pada …"), so it must not
    // fall through `actionError`, which hides everything that isn't a known RBAC/settings error.
    if (e instanceof TicketingError) return { ok: false, error: e.message, code: e.code };
    if (e instanceof ZodError) return { ok: false, error: "Masukkan kode tiket yang valid." };
    return { ok: false, error: actionError(e) };
  }
}
