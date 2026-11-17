import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";
import { EventManager, type EventItem } from "@/components/admin/EventManager";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const canManage =
    session.roles.includes("super_admin") || hasPermission(session, "events.manage");

  const rawEvents = await prisma.event.findMany({
    include: {
      _count: {
        select: { fights: true },
      },
    },
    orderBy: { startsAt: "desc" },
  });

  const events: EventItem[] = rawEvents.map((e) => ({
    id: e.id,
    name: e.name,
    slug: e.slug,
    description: e.description,
    venue: e.venue,
    city: e.city,
    country: e.country,
    startsAt: e.startsAt.toISOString(),
    status: e.status,
    isPublished: e.isPublished,
    fightsCount: e._count.fights,
  }));

  return <EventManager events={events} canManage={canManage} />;
}

