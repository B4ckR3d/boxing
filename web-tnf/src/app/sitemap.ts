import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";

/**
 * Sitemap for the public site.
 *
 * Only publicly indexable routes are listed. Explicitly excluded:
 *   - /admin/**        authenticated console
 *   - /api/**          JSON endpoints
 *   - /tickets/**      dipindah ke aplikasi ticketing terpisah (ticket-tnf)
 *
 * Fighter detail pages are read from the database. The query is defensive: if the DB is
 * unreachable while the sitemap is generated, we still emit the static routes instead of
 * failing the build/request.
 */
export const revalidate = 3600;

const BASE_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/events", changeFrequency: "daily", priority: 0.9 },
  // Catatan: /tickets sudah dipindah ke aplikasi ticketing terpisah (ticket-tnf) dan dialihkan
  // oleh src/proxy.ts — tidak lagi ada di sitemap web ini.
  { path: "/fights", changeFrequency: "daily", priority: 0.8 },
  { path: "/fighters", changeFrequency: "weekly", priority: 0.8 },
  { path: "/rankings", changeFrequency: "weekly", priority: 0.8 },
  { path: "/belts", changeFrequency: "weekly", priority: 0.7 },
  { path: "/grand-prix", changeFrequency: "weekly", priority: 0.7 },
  { path: "/news", changeFrequency: "weekly", priority: 0.6 },
];

async function fighterEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const fighters = await prisma.fighter.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });

    return fighters.map((fighter) => ({
      url: `${BASE_URL}/fighters/${fighter.slug}`,
      lastModified: fighter.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch (error) {
    console.warn("[sitemap] fighter entries skipped:", error instanceof Error ? error.message : error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const dynamicEntries = await fighterEntries();

  return [...staticEntries, ...dynamicEntries];
}
