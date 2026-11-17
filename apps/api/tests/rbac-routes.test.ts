/**
 * Test lapisan HTTP router RBAC (Langkah F lanjutan).
 *
 * Yang diuji adalah **transport**, bukan logika bisnis: logika sudah punya test sendiri dan hidup di
 * `@tfn/auth`. Di sini yang penting adalah:
 *   1. setiap rute dijaga permission yang tepat (roles.manage vs users.manage — bukan satu gerbang),
 *   2. mutasi menolak origin asing sebelum menyentuh service,
 *   3. error domain/Zod keluar sebagai envelope ADR-010, bukan 500 mentah,
 *   4. parameter path menimpa body (`:roleId` tidak bisa dipalsukan lewat JSON).
 */
import request from "supertest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { RbacError } from "@tfn/auth/rbac-service";
import { originAllowed } from "../src/lib/require-permission.js";
import { createApp } from "../src/app.js";

const getSession = vi.fn();
const listRolesDetailed = vi.fn();
const createRole = vi.fn();
const updateRolePermissions = vi.fn();
const deleteRole = vi.fn();
const listUsersDetailed = vi.fn();
const setUserActive = vi.fn();
const grantRole = vi.fn();
const listPendingRoleRequests = vi.fn();
const reviewRoleRequest = vi.fn();

vi.mock("../src/lib/auth.js", () => ({
  getSession: (...a: unknown[]) => getSession(...a),
  authenticateCredentials: vi.fn(),
  destroySession: vi.fn(),
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("@tfn/auth/rbac-service", async () => {
  // `importActual` menjaga kelas `RbacError` asli tetap hidup, jadi `instanceof` di router valid.
  const actual = await vi.importActual<Record<string, unknown>>("@tfn/auth/rbac-service");
  return {
    ...actual,
    createRbacService: () => ({
      listRolesDetailed: (...a: unknown[]) => listRolesDetailed(...a),
      createRole: (...a: unknown[]) => createRole(...a),
      updateRole: vi.fn(),
      updateRolePermissions: (...a: unknown[]) => updateRolePermissions(...a),
      deleteRole: (...a: unknown[]) => deleteRole(...a),
      listUsersDetailed: (...a: unknown[]) => listUsersDetailed(...a),
      listPendingRoleRequests: (...a: unknown[]) => listPendingRoleRequests(...a),
      grantRole: (...a: unknown[]) => grantRole(...a),
      revokeRole: vi.fn(),
      reviewRoleRequest: (...a: unknown[]) => reviewRoleRequest(...a),
      setUserActive: (...a: unknown[]) => setUserActive(...a),
    }),
  };
});

const app = () => createApp({ checkDb: async () => {}, openApiEnabled: false });

const SUPER = {
  id: "u-super",
  email: "s@x.co",
  name: "S",
  roles: ["super_admin"],
  permissions: new Set<string>(),
};
const VIEWER = {
  id: "u-view",
  email: "v@x.co",
  name: "V",
  roles: ["viewer"],
  permissions: new Set<string>(),
};

/** Origin sah menurut env repo ini; dipakai semua test mutasi. */
const ORIGIN = process.env.APP_URL ?? "https://tfn.pimpom.id";

beforeEach(() => {
  for (const fn of [
    getSession,
    listRolesDetailed,
    createRole,
    updateRolePermissions,
    deleteRole,
    listUsersDetailed,
    setUserActive,
    grantRole,
    listPendingRoleRequests,
    reviewRoleRequest,
  ]) {
    fn.mockReset();
  }
});

describe("guard sesi + permission", () => {
  it("tanpa sesi → 401 UNAUTHORIZED", async () => {
    getSession.mockResolvedValue(null);
    const res = await request(app()).get("/api/rbac/roles");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.requestId).toBeTruthy();
    expect(listRolesDetailed).not.toHaveBeenCalled();
  });

  it("sesi tanpa roles.manage → 403 FORBIDDEN, service tak dipanggil", async () => {
    getSession.mockResolvedValue(VIEWER);
    const res = await request(app()).get("/api/rbac/roles");

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(res.body.error.message).toContain("roles.manage");
    expect(listRolesDetailed).not.toHaveBeenCalled();
  });

  it("roles.manage → 200 dengan envelope { data }", async () => {
    getSession.mockResolvedValue(SUPER);
    listRolesDetailed.mockResolvedValue([{ id: "r1", key: "viewer", permissions: [] }]);

    const res = await request(app()).get("/api/rbac/roles");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.error).toBeUndefined();
  });

  it("GET /users dijaga users.manage, bukan roles.manage", async () => {
    getSession.mockResolvedValue(SUPER);
    listUsersDetailed.mockResolvedValue([]);
    const ok = await request(app()).get("/api/rbac/users");
    expect(ok.status).toBe(200);

    getSession.mockResolvedValue(VIEWER);
    const res = await request(app()).get("/api/rbac/users");
    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain("users.manage");
  });
});

describe("origin check pada mutasi", () => {
  it("menolak origin asing dengan 403 INVALID_ORIGIN sebelum service", async () => {
    getSession.mockResolvedValue(SUPER);
    const res = await request(app())
      .post("/api/rbac/roles")
      .set("origin", "https://evil.example.com")
      .send({ key: "hacker", name: "Hacker" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("INVALID_ORIGIN");
    expect(createRole).not.toHaveBeenCalled();
  });

  it("menerima origin yang cocok", async () => {
    getSession.mockResolvedValue(SUPER);
    createRole.mockResolvedValue({ id: "r9", key: "coach" });

    const res = await request(app())
      .post("/api/rbac/roles")
      .set("origin", ORIGIN)
      .send({ key: "coach", name: "Coach", description: "" });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ id: "r9", key: "coach" });
    expect(createRole).toHaveBeenCalledWith("u-super", expect.objectContaining({ key: "coach" }));
  });
});

/**
 * Escape hatch loopback hanya untuk development.
 *
 * `.env` repo ini memakai `APP_URL=https://tfn.pimpom.id`, jadi membuka `http://localhost:3000`
 * membuat origin tidak cocok. Tanpa cabang dev, semua mutasi dari UI lokal akan 403 — persis bug
 * yang dulu terjadi pada login. Yang dijaga di sini: cabang itu **mati** di produksi dan tidak
 * pernah meloloskan origin asing.
 */
describe("originAllowed: loopback hanya di development", () => {
  const req = (origin: string) => ({ headers: { origin } }) as never;

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("development: loopback diterima, origin asing tetap ditolak", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(originAllowed(req("http://localhost:3000"), ORIGIN)).toBe(true);
    expect(originAllowed(req("http://127.0.0.1:3000"), ORIGIN)).toBe(true);
    expect(originAllowed(req("https://evil.example.com"), ORIGIN)).toBe(false);
    expect(originAllowed(req("https://evil.example.com.tfn.pimpom.id"), ORIGIN)).toBe(false);
  });

  it("production: loopback ditolak, hanya ORIGIN yang lolos", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(originAllowed(req("http://localhost:3000"), ORIGIN)).toBe(false);
    expect(originAllowed(req(ORIGIN), ORIGIN)).toBe(true);
  });

  it("test/CI: tidak ada pelonggaran sama sekali", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(originAllowed(req("http://localhost:3000"), ORIGIN)).toBe(false);
  });
});

describe("pemetaan error", () => {
  it("ZodError → 400 VALIDATION_ERROR + details path", async () => {
    getSession.mockResolvedValue(SUPER);
    createRole.mockRejectedValue(
      // ZodError sungguhan — router memakai `instanceof z.ZodError`, bukan cek nama kelas.
      z.object({ key: z.string().regex(/^[a-z_]+$/, "Key must be lowercase snake_case") })
        .safeParse({ key: "BAD KEY" }).error,
    );

    const res = await request(app())
      .post("/api/rbac/roles")
      .set("origin", ORIGIN)
      .send({ key: "BAD KEY", name: "X" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("key");
  });

  it("RbacError → 400 RBAC_ERROR dengan pesan domain", async () => {
    getSession.mockResolvedValue(SUPER);
    deleteRole.mockRejectedValue(new RbacError("System roles cannot be deleted"));

    const res = await request(app()).delete("/api/rbac/roles/r-system").set("origin", ORIGIN);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("RBAC_ERROR");
    expect(res.body.error.message).toBe("System roles cannot be deleted");
  });
});

describe("parameter path tidak bisa dipalsukan lewat body", () => {
  it("POST /role-requests/:id/review memakai id dari URL", async () => {
    getSession.mockResolvedValue(SUPER);
    reviewRoleRequest.mockResolvedValue(undefined);

    const res = await request(app())
      .post("/api/rbac/role-requests/req-from-url/review")
      .set("origin", ORIGIN)
      .send({ requestId: "req-from-body", approve: true, reviewNote: "" });

    expect(res.status).toBe(200);
    expect(reviewRoleRequest).toHaveBeenCalledWith(
      "u-super",
      expect.objectContaining({ requestId: "req-from-url", approve: true }),
    );
  });
});

describe("four-eyes tetap di paket, bukan di router", () => {
  it("penolakan reviewer = requester diteruskan sebagai RBAC_ERROR", async () => {
    getSession.mockResolvedValue(SUPER);
    reviewRoleRequest.mockRejectedValue(
      new RbacError("Four-eyes violation: role request review"),
    );

    const res = await request(app())
      .post("/api/rbac/role-requests/req1/review")
      .set("origin", ORIGIN)
      .send({ approve: true });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("Four-eyes");
  });
});
