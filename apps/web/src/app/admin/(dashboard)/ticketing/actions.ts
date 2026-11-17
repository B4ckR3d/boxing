"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError, type ActionResult } from "@/lib/actions/result";
import { ticketTypeInputSchema } from "@/server/services/ticketing.service";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * Server action admin ticketing (Langkah C).
 *
 * `confirm`/`reject` sekarang dieksekusi oleh `apps/api` — action ini hanya meneruskan cookie sesi
 * browser ke API, yang memeriksa `ticketing.confirm` sendiri. Penting: `requirePermission()` di
 * bawah tetap dipanggil lebih dulu supaya UI gagal cepat tanpa round-trip, tetapi **bukan** satu-
 * satunya penjaga; API memeriksa ulang dengan sesi yang sama.
 *
 * `saveTicketTypeAction` masih menyentuh `prisma` langsung (CRUD kategori tiket, bukan bagian
 * `ticketing.service`). Ini sisa yang masih harus dipindah — dicatat di NEXT-TASKS.
 */

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

function proxyError(error: unknown): { ok: false; error: string } {
  if (error instanceof ApiClientError) return { ok: false, error: error.message };
  return { ok: false, error: actionError(error) };
}

export async function saveTicketTypeAction(input: unknown, id?: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) return { ok: false, error: "Invalid request origin" };
    await requirePermission("ticketing.manage");
    const data = ticketTypeInputSchema.parse(input);
    const event = await prisma.event.findUnique({ where: { id: data.eventId } });
    if (!event) return { ok: false, error: "Event tidak ditemukan" };
    if (id) {
      const existing = await prisma.ticketType.findUnique({ where: { id } });
      if (!existing) return { ok: false, error: "Kategori tidak ditemukan" };
      if (data.quota < existing.sold) return { ok: false, error: "Kuota tidak boleh di bawah tiket terjual" };
      await prisma.ticketType.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          price: data.price,
          quota: data.quota,
          isActive: data.isActive ?? true,
        },
      });
    } else {
      await prisma.ticketType.create({ data: { ...data, price: data.price } });
    }
    revalidatePath("/tickets");
    revalidatePath("/admin/ticketing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function confirmTicketOrderAction(orderId: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) return { ok: false, error: "Invalid request origin" };
    await requirePermission("ticketing.confirm");
    await apiFetch(`/api/ticketing/orders/${encodeURIComponent(orderId)}/confirm`, {
      method: "POST",
      headers: await forwardedHeaders(),
    });
    revalidatePath("/admin/ticketing");
    return { ok: true };
  } catch (e) {
    return proxyError(e);
  }
}

export async function rejectTicketOrderAction(orderId: string, reason: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) return { ok: false, error: "Invalid request origin" };
    await requirePermission("ticketing.confirm");
    await apiFetch(`/api/ticketing/orders/${encodeURIComponent(orderId)}/reject`, {
      method: "POST",
      body: { reason },
      headers: await forwardedHeaders(),
    });
    revalidatePath("/admin/ticketing");
    return { ok: true };
  } catch (e) {
    return proxyError(e);
  }
}
