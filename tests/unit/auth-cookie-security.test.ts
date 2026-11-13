import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cookie: { get: vi.fn(), set: vi.fn(), delete: vi.fn() }, session: { findUnique: vi.fn(), updateMany: vi.fn() } }));
vi.mock("next/headers", () => ({ cookies: async () => mocks.cookie }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { session: mocks.session } }));
vi.mock("@/lib/env", () => ({ env: () => ({ SESSION_TTL_HOURS: 12 }) }));
vi.mock("@/server/services/audit.service", () => ({ logAudit: vi.fn() }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("APP_URL", "https://admin.example.com"); });
it("sets exactly one Secure host-only production session cookie", async () => {
  const { setSessionCookie } = await import("@/server/services/auth.service");
  await setSessionCookie("token");
  expect(mocks.cookie.set).toHaveBeenCalledTimes(1);
  expect(mocks.cookie.set).toHaveBeenCalledWith("__Host-bx_session", "token", expect.objectContaining({ secure: true, httpOnly: true, path: "/", sameSite: "lax" }));
});
it("never authenticates a legacy insecure cookie in HTTPS production", async () => {
  mocks.cookie.get.mockImplementation((name: string) => name === "bx_session" ? { value: "legacy" } : undefined);
  const { getSession } = await import("@/server/services/auth.service");
  expect(await getSession()).toBeNull();
  expect(mocks.session.findUnique).not.toHaveBeenCalled();
});
