"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { actionError, type ActionResult } from "@/lib/actions/result";

export interface CreateEventInput {
  name: string;
  slug?: string;
  venue?: string;
  city?: string;
  country?: string;
  startsAt: string;
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "COMPLETED" | "CANCELLED" | "POSTPONED" | any;
  isPublished: boolean;
  description?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

    const rawSlug = input.slug && input.slug.trim().length > 0 ? input.slug : slugify(input.name);
    const finalSlug = `${rawSlug}-${Date.now().toString().slice(-4)}`;

    await prisma.event.create({
      data: {
        name: input.name.trim(),
        slug: finalSlug,
        venue: input.venue?.trim() || "Gedung Pemuda Temanggung",
        city: input.city?.trim() || "Temanggung",
        country: input.country?.trim() || "ID",
        startsAt: new Date(input.startsAt || Date.now()),
        status: input.status || "SCHEDULED",
        isPublished: Boolean(input.isPublished),
        description: input.description?.trim() || null,
      },
    });

    revalidatePath("/admin/events");
    revalidatePath("/events");
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

    await prisma.event.update({
      where: { id },
      data: { isPublished: !event.isPublished },
    });

    revalidatePath("/admin/events");
    revalidatePath("/events");
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
