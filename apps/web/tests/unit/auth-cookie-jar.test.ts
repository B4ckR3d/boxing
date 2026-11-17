import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Bukti bahwa `auth.service` sudah bisa dipakai proses non-Next (persiapan Langkah B).
 *
 * Sebelum refactor, `getSession`/`setSessionCookie`/`destroySession` memanggil `next/headers`
 * langsung sehingga mustahil dipanggil dari Express. Test ini menyuntik jar sendiri dan
 * memastikan service tidak menyentuh `next/headers` sama sekali.
 */

const mockPrisma = {
  session: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma, get prismaClient() { return mockPrisma; } }));
vi.mock("server-only", () => ({}));
// Melempar hanya bila `cookies()` benar-benar DIPANGGIL — bukan saat modul diimpor.
const forbidden = () => {
  throw new Error("auth.service tidak boleh memanggil next/headers saat jar disuntik");
};
vi.mock("next/headers", () => ({ cookies: forbidden }));

const { createMemoryCookieJar } = await import("@/lib/auth/session-cookie-jar");
const { getSession, destroySession, SESSION_COOKIE_NAME } = await import("@/server/services/auth.service");

describe("auth.service memakai SessionCookieJar (persiapan Langkah B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengembalikan null tanpa menyentuh database bila cookie sesi tidak ada", async () => {
    const jar = createMemoryCookieJar();
    await expect(getSession(jar)).resolves.toBeNull();
    expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("membaca token dari jar yang disuntik, bukan dari next/headers", async () => {
    const jar = createMemoryCookieJar({ [SESSION_COOKIE_NAME]: "token-uji" });
    mockPrisma.session.findUnique.mockResolvedValue(null);

    await expect(getSession(jar)).resolves.toBeNull();
    expect(mockPrisma.session.findUnique).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.session.findUnique.mock.calls[0]?.[0];
    expect(arg.where.tokenHash).toMatch(/^[a-f0-9]{64}$/); // sha256 dari token, bukan token mentah
  });

  it("destroySession menghapus cookie di jar yang disuntik", async () => {
    const jar = createMemoryCookieJar({ [SESSION_COOKIE_NAME]: "token-uji" });
    mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });

    await destroySession(jar);

    expect(mockPrisma.session.updateMany).toHaveBeenCalledTimes(1);
    expect(jar.snapshot()[SESSION_COOKIE_NAME]).toBeUndefined();
  });

  it("destroySession tetap jalan walau cookie tidak ada", async () => {
    const jar = createMemoryCookieJar();
    await expect(destroySession(jar)).resolves.toBeUndefined();
    expect(mockPrisma.session.updateMany).not.toHaveBeenCalled();
  });
});
