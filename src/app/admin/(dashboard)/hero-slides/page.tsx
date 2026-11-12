import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/server/services/auth.service";
import { hasPermission } from "@/lib/permissions/guard";
import { HeroSlideManager, type HeroSlideItem } from "@/components/admin/HeroSlideManager";

export const dynamic = "force-dynamic";

export default async function AdminHeroSlidesPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const canManage =
    session.roles.includes("super_admin") || hasPermission(session, "content.manage");

  const rawSlides = await prisma.heroSlide.findMany({
    include: {
      fighterImage: true,
      background: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  const slides: HeroSlideItem[] = rawSlides.map((s) => ({
    id: s.id,
    eventTitle: s.eventTitle,
    headline: s.headline,
    description: s.description,
    eventDate: s.eventDate ? s.eventDate.toISOString() : null,
    fighterImageUrl: s.fighterImage?.url || null,
    backgroundImageUrl: s.background?.url || null,
    ctaPrimaryLabel: s.ctaPrimaryLabel,
    ctaPrimaryHref: s.ctaPrimaryHref,
    ctaSecondaryLabel: s.ctaSecondaryLabel,
    ctaSecondaryHref: s.ctaSecondaryHref,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
  }));

  return <HeroSlideManager slides={slides} canManage={canManage} />;
}
