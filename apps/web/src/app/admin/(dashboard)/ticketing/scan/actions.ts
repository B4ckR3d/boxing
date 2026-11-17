"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError } from "@/lib/actions/result";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * Bentuk hasil yang dibaca UI. `checkedInAt` berupa string karena Date tidak menyeberang batas
 * server action dengan andal — konversi dilakukan sekali di sini.
 */
export type CheckInOutcome = {
  orderNumber: string;
  customerName: string;
  eventName: string;
  venue: string | null;
  seats: number;
  categories: { name: string; quantity: number }[];
  checkedInAt: string;
  method: "QR" | "MANUAL";
};

export type CheckInActionResult =
  | { ok: true; result: CheckInOutcome }
  | { ok: false; error: string; code?: string };

/**
 * Gate check-in (Langkah C) — dieksekusi oleh `apps/api`.
 *
 * Pesan `TicketingError` ("sudah dipakai pada …") tetap diteruskan apa adanya: itulah kalimat yang
 * dibutuhkan petugas di pintu masuk, dan `actionError()` akan menyembunyikannya.
 */
export async function checkInTicketAction(raw: unknown, eventId?: string | null): Promise<CheckInActionResult> {
  try {
    if (!(await verifyRequestOrigin())) return { ok: false, error: "Invalid request origin" };
    await requirePermission("ticketing.confirm");

    const h = await headers();
    const cookie = h.get("cookie");
    const origin = h.get("origin");

    const response = await apiFetch<{ data: CheckInOutcome }>("/api/ticketing/check-in", {
      method: "POST",
      body: { raw: typeof raw === "string" ? raw : "", eventId: eventId || null },
      headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) },
    });

    revalidatePath("/admin/ticketing");
    revalidatePath("/admin/ticketing/scan");
    return { ok: true, result: response.data };
  } catch (error) {
    if (error instanceof ApiClientError) {
      // `INVALID_TICKET`/`ALREADY_USED` dsb. punya kalimat untuk petugas — jangan ditelan.
      return { ok: false, error: error.message, code: error.code };
    }
    if (error instanceof ZodError) return { ok: false, error: "Masukkan kode tiket yang valid." };
    return { ok: false, error: actionError(error) };
  }
}
