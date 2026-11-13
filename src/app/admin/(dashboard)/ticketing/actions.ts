"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError, type ActionResult } from "@/lib/actions/result";
import { ticketTypeInputSchema, confirmOrder, rejectOrder } from "@/server/services/ticketing.service";

export async function saveTicketTypeAction(input: unknown, id?: string): Promise<ActionResult> {
  try { if (!(await verifyRequestOrigin())) return { ok: false, error: "Invalid request origin" }; await requirePermission("ticketing.manage"); const data = ticketTypeInputSchema.parse(input); const event = await prisma.event.findUnique({ where: { id: data.eventId } }); if (!event) return { ok: false, error: "Event tidak ditemukan" }; if (id) { const existing = await prisma.ticketType.findUnique({ where: { id } }); if (!existing) return { ok: false, error: "Kategori tidak ditemukan" }; if (data.quota < existing.sold) return { ok: false, error: "Kuota tidak boleh di bawah tiket terjual" }; await prisma.ticketType.update({ where: { id }, data: { name: data.name, code: data.code, description: data.description, price: data.price, quota: data.quota, isActive: data.isActive ?? true } }); } else await prisma.ticketType.create({ data: { ...data, price: data.price } }); revalidatePath("/tickets"); revalidatePath("/admin/ticketing"); return { ok: true }; } catch (e) { return { ok: false, error: actionError(e) }; }
}
export async function confirmTicketOrderAction(orderId: string): Promise<ActionResult> { try { if (!(await verifyRequestOrigin())) return { ok: false, error: "Invalid request origin" }; const user = await requirePermission("ticketing.confirm"); await confirmOrder(orderId, user.id); revalidatePath("/admin/ticketing"); return { ok: true }; } catch (e) { return { ok: false, error: actionError(e) }; } }
export async function rejectTicketOrderAction(orderId: string, reason: string): Promise<ActionResult> { try { if (!(await verifyRequestOrigin())) return { ok: false, error: "Invalid request origin" }; const user = await requirePermission("ticketing.confirm"); await rejectOrder(orderId, user.id, reason); revalidatePath("/admin/ticketing"); return { ok: true }; } catch (e) { return { ok: false, error: actionError(e) }; } }
