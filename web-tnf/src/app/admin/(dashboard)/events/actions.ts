"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError, type ActionResult } from "@/lib/actions/result";

export interface TicketTypeInput {
  id?: string;
  name: string;
  price: number;
  quota: number;
  description?: string;
}

export interface CreateEventInput {
  name: string;
  slug?: string;
  venue?: string;
  city?: string;
  country?: string;
  startsAt: string;
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED";
  isPublished: boolean;
  description?: string;
  posterId?: string;
  ticketTypes?: TicketTypeInput[];
}

export interface UpdateEventInput {
  id: string;
  name: string;
  slug?: string;
  venue?: string;
  city?: string;
  country?: string;
  startsAt: string;
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED";
  isPublished: boolean;
  description?: string;
  posterId?: string;
  ticketTypes?: TicketTypeInput[];
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "event"
  );
}

export async function createEventAction(input: CreateEventInput): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("events.manage");

    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: "Nama event wajib diisi" };
    }

    const rawSlug = input.slug && input.slug.trim().length > 0 ? slugify(input.slug) : slugify(input.name);
    const finalSlug = `${rawSlug.slice(0, 140)}-${Date.now().toString().slice(-5)}`;
    const parsedDate = input.startsAt ? new Date(input.startsAt) : new Date();
    const startsAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const country = (input.country?.trim().toUpperCase() || "ID").slice(0, 2);

    const event = await prisma.event.create({
      data: {
        name: input.name.trim().slice(0, 160),
        slug: finalSlug,
        venue: input.venue?.trim().slice(0, 160) || "Gedung Pemuda Temanggung",
        city: input.city?.trim().slice(0, 120) || "Temanggung",
        country,
        startsAt,
        status: input.status || "SCHEDULED",
        isPublished: Boolean(input.isPublished),
        description: input.description?.trim() || null,
        posterId: input.posterId || null,
      },
    });

    // Simpan kategori tiket jika ada
    if (input.ticketTypes && input.ticketTypes.length > 0) {
      for (const tt of input.ticketTypes) {
        if (!tt.name?.trim()) continue;
        await prisma.ticketType.create({
          data: {
            eventId: event.id,
            name: tt.name.trim().slice(0, 100),
            code: `${slugify(tt.name).slice(0, 20)}-${Math.random().toString(36).substring(2, 6)}`,
            price: Math.max(0, Number(tt.price) || 0),
            quota: Math.max(1, Number(tt.quota) || 100),
            description: tt.description?.trim().slice(0, 500) || null,
            isActive: true,
          },
        });
      }
    }

    revalidatePath("/admin/events");
    revalidatePath("/events");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function updateEventAction(input: UpdateEventInput): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("events.manage");

    if (!input.id) {
      return { ok: false, error: "ID event tidak valid" };
    }
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: "Nama event wajib diisi" };
    }

    const parsedDate = input.startsAt ? new Date(input.startsAt) : new Date();
    const startsAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    const country = (input.country?.trim().toUpperCase() || "ID").slice(0, 2);

    const updateData: {
      name: string;
      slug?: string;
      venue: string;
      city: string;
      country: string;
      startsAt: Date;
      status: "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED";
      isPublished: boolean;
      description: string | null;
      posterId?: string | null;
    } = {
      name: input.name.trim().slice(0, 160),
      venue: input.venue?.trim().slice(0, 160) || "Gedung Pemuda Temanggung",
      city: input.city?.trim().slice(0, 120) || "Temanggung",
      country,
      startsAt,
      status: input.status || "SCHEDULED",
      isPublished: Boolean(input.isPublished),
      description: input.description?.trim() || null,
    };

    if (input.slug && input.slug.trim().length > 0) {
      updateData.slug = slugify(input.slug).slice(0, 160);
    }
    if (input.posterId !== undefined) {
      updateData.posterId = input.posterId || null;
    }

    const updated = await prisma.event.update({
      where: { id: input.id },
      data: updateData,
    });

    // Sinkronisasi kategori tiket
    if (input.ticketTypes) {
      const keepIds = input.ticketTypes.filter((t) => t.id).map((t) => t.id!);

      // Nonaktifkan tiket lama yang dihapus dari list
      await prisma.ticketType.updateMany({
        where: {
          eventId: input.id,
          id: { notIn: keepIds },
        },
        data: { isActive: false },
      });

      // Update atau buat yang baru
      for (const tt of input.ticketTypes) {
        if (!tt.name?.trim()) continue;
        if (tt.id) {
          await prisma.ticketType.update({
            where: { id: tt.id },
            data: {
              name: tt.name.trim().slice(0, 100),
              price: Math.max(0, Number(tt.price) || 0),
              quota: Math.max(1, Number(tt.quota) || 100),
              description: tt.description?.trim().slice(0, 500) || null,
              isActive: true,
            },
          });
        } else {
          await prisma.ticketType.create({
            data: {
              eventId: input.id,
              name: tt.name.trim().slice(0, 100),
              code: `${slugify(tt.name).slice(0, 20)}-${Math.random().toString(36).substring(2, 6)}`,
              price: Math.max(0, Number(tt.price) || 0),
              quota: Math.max(1, Number(tt.quota) || 100),
              description: tt.description?.trim().slice(0, 500) || null,
              isActive: true,
            },
          });
        }
      }
    }

    revalidatePath("/admin/events");
    revalidatePath("/events");
    revalidatePath(`/events/${updated.slug}`);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function togglePublishEventAction(id: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("events.manage");

    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      return { ok: false, error: "Event tidak ditemukan" };
    }

    const updated = await prisma.event.update({
      where: { id },
      data: { isPublished: !event.isPublished },
    });

    revalidatePath("/admin/events");
    revalidatePath("/events");
    revalidatePath(`/events/${updated.slug}`);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  try {
    if (!(await verifyRequestOrigin())) {
      return { ok: false, error: "Invalid request origin" };
    }
    await requirePermission("events.manage");

    await prisma.event.delete({
      where: { id },
    });

    revalidatePath("/admin/events");
    revalidatePath("/events");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: actionError(err) };
  }
}
