import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), destroy: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@/server/services/auth.service", () => ({ authenticateCredentials: mocks.authenticate, destroySession: mocks.destroy }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
import { POST } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000", ...headers }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "http://localhost:3000");
  mocks.rateLimit.mockReturnValue({ allowed: true });
  mocks.authenticate.mockResolvedValue({ success: true, user: { id: "u", email: "a@example.com", name: "A", roles: [] } });
});
describe("Authentication request boundaries", () => {
  it("rejects a cross-origin login before authentication", async () => {
    expect((await POST(request({ email: "a@example.com", password: "ok" }, { origin: "https://evil.test" }))).status).toBe(403);
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
  it("rejects missing origin", async () => {
    const req = request({ email: "a@example.com", password: "ok" });
    req.headers.delete("origin");
    expect((await POST(req)).status).toBe(403);
  });
  it("rejects null origin", async () => {
    expect((await POST(request({}, { origin: "null" }))).status).toBe(403);
  });
  it("rejects oversized passwords before hashing", async () => {
    expect((await POST(request({ email: "a@example.com", password: "a".repeat(1025) }))).status).toBe(400);
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
  it("rejects oversized body", async () => {
    expect((await POST(request({ padding: "x".repeat(17000) }))).status).toBe(413);
  });
  it("forwards validated TOTP inline with credentials", async () => {
    const res = await POST(request({ email: " a@example.com ", password: "ok", totpCode: "123456" }));
    expect(res.status).toBe(200);
    expect(mocks.authenticate).toHaveBeenCalledWith("a@example.com", "ok", expect.objectContaining({ totpCode: "123456" }));
  });
  it("returns an unsuccessful MFA challenge without any temp token", async () => {
    mocks.authenticate.mockResolvedValue({ success: false, requiresMfa: true, error: "Enter code" });
    const res = await POST(request({ email: "a@example.com", password: "ok" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, requiresMfa: true, error: "Enter code" });
  });
  it("protects logout against cross-origin requests", async () => {
    expect((await logout(request({}, { origin: "https://evil.test" }))).status).toBe(403);
    expect(mocks.destroy).not.toHaveBeenCalled();
  });
  it("accepts same-origin logout", async () => {
    expect((await logout(request({}))).status).toBe(200);
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
});
