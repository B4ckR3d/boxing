/**
 * Binding `apps/web` → `@tfn/core` (sponsor publik).
 *
 * Call site lama (`@/server/services/sponsor.service`) tetap valid.
 */
import { prisma } from "@/lib/db/prisma";
import { getPublicSponsors as getPublicSponsorsDomain, type PublicSponsor } from "@tfn/core/sponsors";

export type { PublicSponsor };

export async function getPublicSponsors(): Promise<PublicSponsor[]> {
  return getPublicSponsorsDomain(prisma);
}
