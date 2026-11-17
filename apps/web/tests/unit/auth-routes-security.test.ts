import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Batas keamanan route auth di `apps/web` — sekarang lapisan **proxy** (Langkah B slice 3, ADR-013).
 *
 * Otoritas auth ada di `apps/api`, jadi yang diuji di sini adalah kontrak proxy:
 * cookie diteruskan, envelope diterjemahkan, rate limit & origin tetap berlaku.
 * Asersi keamanan lama (origin, body besar, password panjang) dipertahankan penuh.
 */

const mocks = vi.hoisted(() => ({
  apiFetchRaw: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
  return { ...actual, apiFetchRaw: mocks.apiFetchRaw };
});
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: mocks.rateLimit }));

import { POST } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_URL", "http://localhost:3000");
  mocks.rateLimit.mockReturnValue({ allowed: true });
  mocks.apiFetchRaw.mockResolvedValue({
    status: 200,
    setCookies: [],
    data: { success: true, user: { id: "u", email: "a@example.com", name: "A", roles: [] } },
  });
});

describe("Login proxy — batas request", () => {
  it("menolak login lintas origin sebelum memanggil API", async () => {
    const res = await POST(request({ email: "a@example.com", password: "ok" }, { origin: "https://evil.test" }));
    expect(res.status).toBe(403);
    expect(mocks.apiFetchRaw).not.toHaveBeenCalled();
  });

  it("menolak origin yang hilang", async () => {
    const req = request({ email: "a@example.com", password: "ok" });
    req.headers.delete("origin");
    expect((await POST(req)).status).toBe(403);
  });

  it("menolak origin 'null'", async () => {
    expect((await POST(request({}, { origin: "null" }))).status).toBe(403);
  });

  it("menolak password kepanjangan sebelum memanggil API", async () => {
    const res = await POST(request({ email: "a@example.com", password: "a".repeat(1025) }));
    expect(res.status).toBe(400);
    expect(mocks.apiFetchRaw).not.toHaveBeenCalled();
  });

  it("menolak body >16KB dengan 413 (batas stream, bukan Content-Length)", async () => {
    expect((await POST(request({ padding: "x".repeat(17000) }))).status).toBe(413);
    expect(mocks.apiFetchRaw).not.toHaveBeenCalled();
  });

  it("meneruskan TOTP yang sudah divalidasi ke API", async () => {
    const res = await POST(request({ email: " a@example.com ", password: "ok", totpCode: "123456" }));

    expect(res.status).toBe(200);
    const [path, options] = mocks.apiFetchRaw.mock.calls[0] ?? [];
    expect(path).toBe("/api/auth/login");
    expect(options.body).toMatchObject({ email: "a@example.com", password: "ok", totpCode: "123456" });
  });

  it("meneruskan Set-Cookie dari API ke browser apa adanya", async () => {
    mocks.apiFetchRaw.mockResolvedValue({
      status: 200,
      setCookies: ["bx_session=token-dari-api; Path=/; HttpOnly; SameSite=Lax"],
      data: { success: true, user: { id: "u" } },
    });

    const res = await POST(request({ email: "a@example.com", password: "ok" }));
    const cookie = res.headers.get("set-cookie") ?? "";

    expect(res.status).toBe(200);
    expect(cookie).toContain("bx_session=token-dari-api");
    expect(cookie).toContain("HttpOnly");
  });

  it("menerjemahkan envelope ADR-010 menjadi bentuk yang dibaca UI (string + requiresMfa di atas)", async () => {
    const { ApiClientError } = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
    mocks.apiFetchRaw.mockRejectedValue(
      new ApiClientError("Invalid email or password", {
        status: 401,
        code: "INVALID_CREDENTIALS",
        details: { requiresMfa: true },
      }),
    );

    const res = await POST(request({ email: "a@example.com", password: "ok" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, requiresMfa: true, error: "Invalid email or password" });
  });

  it("API tidak dapat dihubungi → 503, bukan 500", async () => {
    const { ApiClientError } = await vi.importActual<typeof import("@/lib/api/client")>("@/lib/api/client");
    mocks.apiFetchRaw.mockRejectedValue(
      new ApiClientError("apps/api tidak dapat dihubungi", { status: 503, code: "UPSTREAM_UNREACHABLE" }),
    );

    expect((await POST(request({ email: "a@example.com", password: "ok" }))).status).toBe(503);
  });

  it("rate limit per-IP tetap berlaku di lapisan proxy", async () => {
    mocks.rateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 42 });
    const res = await POST(request({ email: "a@example.com", password: "ok" }));

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(mocks.apiFetchRaw).not.toHaveBeenCalled();
  });
});

describe("Logout proxy", () => {
  it("menolak logout lintas origin", async () => {
    const res = await logout(request({}, { origin: "https://evil.test" }));
    expect(res.status).toBe(403);
    expect(mocks.apiFetchRaw).not.toHaveBeenCalled();
  });

  it("meneruskan cookie browser ke API dan meneruskan Set-Cookie penghapusan", async () => {
    mocks.apiFetchRaw.mockResolvedValue({
      status: 200,
      setCookies: ["bx_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"],
      data: { success: true },
    });

    const res = await logout(request({}, { cookie: "bx_session=abc" }));

    expect(res.status).toBe(200);
    const [path, options] = mocks.apiFetchRaw.mock.calls[0] ?? [];
    expect(path).toBe("/api/auth/logout");
    expect(options.headers.cookie).toBe("bx_session=abc");
    expect(res.headers.get("set-cookie") ?? "").toContain("Expires=Thu, 01 Jan 1970");
  });
});
