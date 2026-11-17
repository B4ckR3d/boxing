import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createApp } from "../src/app.js";
import { createExpressCookieJar, parseCookieHeader } from "../src/lib/cookie-jar.js";

/**
 * Slice 2 Langkah B: auth di `apps/api` memakai `SessionCookieJar` Express.
 *
 * Service auth di-mock supaya test ini menguji **lapisan HTTP** (kontrak, cookie, envelope),
 * bukan logika bisnis yang sudah punya test sendiri di `apps/web`.
 */

const authenticateCredentials = vi.fn();
const destroySession = vi.fn();
const getSession = vi.fn();

vi.mock("@/server/services/auth.service", () => ({
  authenticateCredentials: (...a: unknown[]) => authenticateCredentials(...a),
  destroySession: (...a: unknown[]) => destroySession(...a),
  getSession: (...a: unknown[]) => getSession(...a),
}));

const app = () => createApp({ checkDb: async () => {}, openApiEnabled: false });

describe("parseCookieHeader", () => {
  it("mengembalikan objek kosong bila header tidak ada", () => {
    expect(parseCookieHeader(undefined)).toEqual({});
  });

  it("memisahkan beberapa cookie dan mengabaikan spasi", () => {
    expect(parseCookieHeader("a=1; b=2;c=3")).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("meng-decode nilai ter-encode dan membiarkan yang rusak apa adanya", () => {
    expect(parseCookieHeader("x=a%20b")).toEqual({ x: "a b" });
    expect(parseCookieHeader("y=%E0%A4%A")).toEqual({ y: "%E0%A4%A" });
  });

  it("mengabaikan segmen tanpa '=' dan nama kosong", () => {
    expect(parseCookieHeader("novalue; =kosong; ok=1")).toEqual({ ok: "1" });
  });
});

describe("createExpressCookieJar", () => {
  it("get membaca dari header req, set/delete menulis ke res", () => {
    const req = { headers: { cookie: "bx_session=abc" } } as never;
    const cookie = vi.fn();
    const clearCookie = vi.fn();
    const res = { cookie, clearCookie } as never;

    const jar = createExpressCookieJar(req, res);
    expect(jar.get("bx_session")).toBe("abc");
    expect(jar.get("tidak-ada")).toBeUndefined();

    jar.set("bx_session", "baru", { httpOnly: true, path: "/" });
    expect(cookie).toHaveBeenCalledWith("bx_session", "baru", { httpOnly: true, path: "/" });

    jar.delete("bx_session");
    expect(clearCookie).toHaveBeenCalledWith("bx_session", { path: "/" });
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    authenticateCredentials.mockReset();
  });

  it("menolak body tidak valid dengan 400 + envelope ADR-010", async () => {
    const res = await request(app()).post("/api/auth/login").send({ email: "bukan-email" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.requestId).toBeTruthy();
    expect(authenticateCredentials).not.toHaveBeenCalled();
  });

  it("meneruskan cookie jar Express ke service auth", async () => {
    authenticateCredentials.mockResolvedValue({
      success: true,
      user: { id: "u1", email: "a@b.co", name: "A", roles: ["admin"] },
    });

    const res = await request(app())
      .post("/api/auth/login")
      .send({ email: "a@b.co", password: "rahasia" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, user: { id: "u1" } });

    const meta = authenticateCredentials.mock.calls[0]?.[2];
    expect(meta.jar).toBeDefined();
    expect(typeof meta.jar.get).toBe("function");
    expect(typeof meta.jar.set).toBe("function");
    expect(meta.ip).toBeTruthy();
  });

  it("kredensial salah → 401 INVALID_CREDENTIALS, bukan 500", async () => {
    authenticateCredentials.mockResolvedValue({ success: false, error: "Email atau password salah" });

    const res = await request(app())
      .post("/api/auth/login")
      .send({ email: "a@b.co", password: "salah" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(res.body.error.message).toBe("Email atau password salah");
  });

  it("butuh MFA → 401 dengan details.requiresMfa", async () => {
    authenticateCredentials.mockResolvedValue({
      success: false,
      requiresMfa: true,
      error: "MFA diperlukan",
    });

    const res = await request(app())
      .post("/api/auth/login")
      .send({ email: "a@b.co", password: "x" });

    expect(res.status).toBe(401);
    expect(res.body.error.details).toMatchObject({ requiresMfa: true });
  });
});

describe("GET /api/auth/me", () => {
  beforeEach(() => getSession.mockReset());

  it("tanpa sesi sah → 401 UNAUTHORIZED", async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app()).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("dengan sesi sah → 200 + permissions jadi array", async () => {
    getSession.mockResolvedValue({
      id: "u1",
      email: "a@b.co",
      name: "A",
      roles: ["admin"],
      permissions: new Set(["user.read", "event.write"]),
      mfaVerified: true,
    });

    const res = await request(app()).get("/api/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.user.permissions).toEqual(["user.read", "event.write"]);
    expect(res.body.user.mfaVerified).toBe(true);
  });
});

describe("POST /api/auth/logout", () => {
  it("memanggil destroySession dengan jar Express dan membalas 200", async () => {
    destroySession.mockReset();
    destroySession.mockResolvedValue(undefined);

    const res = await request(app()).post("/api/auth/logout").set("Cookie", "bx_session=abc");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const jar = destroySession.mock.calls[0]?.[0];
    expect(jar.get("bx_session")).toBe("abc");
  });
});
