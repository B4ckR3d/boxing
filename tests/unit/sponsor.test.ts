import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  delete: vi.fn(),
  mediaCreate: vi.fn(),
  requirePermission: vi.fn(),
  verifyOrigin: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    sponsor: {
      create: mocks.create,
      update: mocks.update,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
      delete: mocks.delete,
    },
    mediaAsset: { create: mocks.mediaCreate },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/permissions/guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/permissions/guard")>();
  return { ...actual, requirePermission: mocks.requirePermission };
});
vi.mock("@/lib/security/csrf", () => ({ verifyRequestOrigin: mocks.verifyOrigin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/i18n/LanguageContext", () => ({ useLanguage: () => ({ lang: "id" }) }));

import {
  SPONSOR_TIER_KEYS,
  isSafeLogoSource,
  normalizeSponsorTier,
  sponsorTierLabel,
} from "@/lib/sponsors/tiers";
import { SponsorShowcase } from "@/components/landing/SponsorShowcase";
import { createSponsorAction, toggleSponsorActiveAction } from "@/app/admin/(dashboard)/sponsors/actions";

const baseInput = { name: "Bank Jateng", tier: "GOLD", isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyOrigin.mockResolvedValue(true);
  mocks.requirePermission.mockResolvedValue({ id: "user_1" });
  mocks.create.mockResolvedValue({ id: "sponsor_1" });
  mocks.mediaCreate.mockResolvedValue({ id: "asset_1" });
});

describe("sponsor tiers", () => {
  it("normalizes unknown or empty tier to PARTNER instead of crashing the homepage", () => {
    expect(normalizeSponsorTier("platinum")).toBe("PLATINUM");
    expect(normalizeSponsorTier(" MEDIA_PARTNER ")).toBe("MEDIA_PARTNER");
    expect(normalizeSponsorTier("SUPER_GOLD")).toBe("PARTNER");
    expect(normalizeSponsorTier(null)).toBe("PARTNER");
  });

  it("exposes stable tier keys and bilingual labels", () => {
    expect(SPONSOR_TIER_KEYS).toEqual(["PLATINUM", "GOLD", "SILVER", "PARTNER", "MEDIA_PARTNER"]);
    expect(sponsorTierLabel("GOLD", "id")).toBe("Sponsor Gold");
    expect(sponsorTierLabel("GOLD", "en")).toBe("Gold sponsors");
  });

  it("rejects unsafe logo sources", () => {
    expect(isSafeLogoSource("/images/sponsors/a.png")).toBe(true);
    expect(isSafeLogoSource("https://cdn.example.com/logo.png")).toBe(true);
    expect(isSafeLogoSource("javascript:alert(1)")).toBe(false);
    expect(isSafeLogoSource("data:image/png;base64,AAAA")).toBe(false);
    expect(isSafeLogoSource("//evil.example.com/logo.png")).toBe(false);
    expect(isSafeLogoSource("")).toBe(false);
  });
});

describe("SponsorShowcase", () => {
  it("renders nothing at all when no sponsor is registered", () => {
    const html = renderToStaticMarkup(React.createElement(SponsorShowcase, { sponsors: [] }));
    expect(html).toBe("");
  });

  it("renders active sponsor logos grouped by tier with a safe external link", () => {
    const html = renderToStaticMarkup(
      React.createElement(SponsorShowcase, {
        sponsors: [
          { id: "1", name: "Bank Jateng", url: "https://bankjateng.co.id", tier: "PLATINUM", logoUrl: "/images/sponsors/bj.png" },
          { id: "2", name: "Radar Semarang", url: null, tier: "MEDIA_PARTNER", logoUrl: null },
        ],
      })
    );

    expect(html).toContain("Sponsor Platinum");
    expect(html).toContain("Media partner");
    expect(html).toContain('src="/images/sponsors/bj.png"');
    expect(html).toContain('alt="Logo Bank Jateng"');
    expect(html).toContain('href="https://bankjateng.co.id"');
    expect(html).toContain('rel="noopener noreferrer nofollow sponsored"');
    // Sponsor tanpa logo tetap tampil sebagai plate nama, tanpa <img> kosong.
    expect(html).toContain("Radar Semarang");
  });
});

describe("sponsor actions", () => {
  it("blocks creation without the content.manage permission", async () => {
    const { AuthorizationError } = await import("@/lib/permissions/guard");
    mocks.requirePermission.mockRejectedValue(new AuthorizationError("Required permission missing"));

    const res = await createSponsorAction(baseInput);

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects an unsafe logo url before touching the database", async () => {
    const res = await createSponsorAction({ ...baseInput, logoUrl: "javascript:alert(1)" });

    expect(res.ok).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("requires a sponsor name", async () => {
    const res = await createSponsorAction({ ...baseInput, name: "   " });

    expect(res.ok).toBe(false);
    expect(res.error).toContain("Nama sponsor wajib diisi");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates a sponsor with a media asset and revalidates the homepage", async () => {
    const res = await createSponsorAction({
      ...baseInput,
      logoUrl: "/images/sponsors/bj.png",
      url: "bankjateng.co.id",
      sortOrder: 2,
    });

    expect(res.ok).toBe(true);
    expect(mocks.mediaCreate).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Bank Jateng",
        tier: "GOLD",
        url: "https://bankjateng.co.id",
        logoId: "asset_1",
        sortOrder: 2,
        isActive: true,
      }),
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("toggles visibility and refreshes the public homepage", async () => {
    mocks.findUnique.mockResolvedValue({ id: "sponsor_1", isActive: true });

    const res = await toggleSponsorActiveAction("sponsor_1");

    expect(res.ok).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "sponsor_1" }, data: { isActive: false } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("refuses cross-origin action calls", async () => {
    mocks.verifyOrigin.mockResolvedValue(false);

    const res = await createSponsorAction(baseInput);

    expect(res.ok).toBe(false);
    expect(res.error).toBe("Invalid request origin");
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
