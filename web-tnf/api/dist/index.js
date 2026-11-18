// src/app.ts
import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";

// src/config/env.ts
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
var here = path.dirname(fileURLToPath(import.meta.url));
function envFileCandidates() {
  const candidates = [];
  if (process.env.ENV_FILE?.trim()) candidates.push(path.resolve(process.env.ENV_FILE.trim()));
  let dir = process.cwd();
  for (let depth = 0; depth < 5; depth += 1) {
    candidates.push(path.join(dir, ".env"));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  candidates.push(path.resolve(here, "../../.env"), path.resolve(here, "../../../.env"));
  return [...new Set(candidates)];
}
var loadedEnvFiles = [];
for (const candidate of envFileCandidates()) {
  if (!existsSync(candidate)) continue;
  loadDotenv({ path: candidate, override: false, quiet: true });
  loadedEnvFiles.push(candidate);
}
var bool = z.enum(["true", "false", "1", "0"]).optional().transform((value) => value === void 0 ? void 0 : value === "true" || value === "1");
var rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().max(65535).default(4e3),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  OPENAPI_ENABLED: bool,
  DATABASE_URL: z.string().optional(),
  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: z.coerce.number().int().positive().default(3307),
  MYSQL_DATABASE: z.string().default("boxing"),
  MYSQL_USER: z.string().default("boxing"),
  MYSQL_PASSWORD: z.string().default(""),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  /**
   * Secret HMAC untuk payload QR tiket (`TFN1.<order>.<SIG>`).
   *
   * HARUS sama dengan `AUTH_SECRET` di `apps/web`. Tiket yang diterbitkan web diverifikasi di gate
   * oleh API secara offline (tanpa DB), jadi secret berbeda = semua tiket sah ditolak sebagai palsu.
   * Panjang minimum 32 disamakan dengan skema web; `buildTicketPayload` menolak secret < 16.
   */
  AUTH_SECRET: z.string().trim().min(32, "AUTH_SECRET must be at least 32 characters"),
  /**
   * Variabel sesi/auth (Langkah E2). Nilai & default **disamakan dengan `apps/web/src/lib/env.ts`**
   * karena keduanya kini menjalankan implementasi `@tfn/auth` yang sama: masa hidup sesi, idle
   * timeout, dan kebijakan lockout harus identik atau sesi yang dibuat web akan dinilai berbeda
   * oleh API.
   *
   * `ENCRYPTION_KEY` wajib: dipakai `decryptSecret()` untuk membaca `mfaSecretEnc` saat login MFA.
   * Tanpa kunci yang sama dengan web, semua akun ber-MFA gagal login lewat API.
   */
  ENCRYPTION_KEY: z.string().refine((v) => {
    try {
      return Buffer.from(v, "base64").length === 32;
    } catch {
      return false;
    }
  }, "ENCRYPTION_KEY must be a base64-encoded 32-byte key"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  AUTH_ENFORCE_MFA: bool.default(true),
  AUTH_MAX_FAILED_LOGINS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15)
});
var cached = null;
function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
function env() {
  if (cached) return cached;
  const parsed = rawSchema.parse(process.env);
  if (parsed.DATABASE_URL) {
    const url = parseUrl(parsed.DATABASE_URL);
    if (!url) throw new Error("DATABASE_URL is not a valid URL");
    parsed.MYSQL_HOST = url.hostname || parsed.MYSQL_HOST;
    parsed.MYSQL_PORT = url.port ? Number(url.port) : parsed.MYSQL_PORT;
    parsed.MYSQL_DATABASE = url.pathname.replace(/^\//, "") || parsed.MYSQL_DATABASE;
    parsed.MYSQL_USER = decodeURIComponent(url.username) || parsed.MYSQL_USER;
    parsed.MYSQL_PASSWORD = decodeURIComponent(url.password) || parsed.MYSQL_PASSWORD;
  }
  cached = {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
  };
  return cached;
}
function loadedEnvFilePaths() {
  return loadedEnvFiles;
}
function describeEnvProblem(error) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}

// src/docs/openapi.ts
import swaggerUi from "swagger-ui-express";
var openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "TFN API",
    version: "0.1.0",
    description: "API resmi TFN (Express + TypeScript). Skeleton Phase 1: health, meta, dan standar error. Modul bisnis dipindah bertahap dari app Next.js (ADR-001)."
  },
  servers: [{ url: "/", description: "Same-origin (di belakang reverse proxy)" }],
  tags: [
    { name: "Health", description: "Liveness & readiness probe" },
    { name: "Meta", description: "Informasi service" }
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness probe",
        description: "Tidak menyentuh database. 200 selama proses hidup.",
        responses: {
          "200": {
            description: "Proses hidup",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" }
              }
            }
          }
        }
      }
    },
    "/health/ready": {
      get: {
        tags: ["Health"],
        summary: "Readiness probe",
        description: "Menjalankan `SELECT 1` ke MySQL. 503 bila database tidak terjangkau.",
        responses: {
          "200": {
            description: "Siap menerima trafik",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", const: "ready" },
                    checks: {
                      type: "object",
                      properties: { database: { type: "string", const: "up" } },
                      required: ["database"]
                    }
                  },
                  required: ["status", "checks"]
                }
              }
            }
          },
          "503": {
            description: "Dependency tidak tersedia",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" }
              }
            }
          }
        }
      }
    },
    "/api/v1/meta": {
      get: {
        tags: ["Meta"],
        summary: "Informasi service & modul yang tersedia",
        responses: {
          "200": {
            description: "Metadata service",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    service: { type: "string" },
                    version: { type: "string" },
                    status: { type: "string" },
                    modules: { type: "array", items: { type: "string" } }
                  },
                  required: ["service", "version", "status", "modules"]
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", const: "ok" },
          service: { type: "string" },
          uptimeSeconds: { type: "integer", minimum: 0 }
        },
        required: ["status", "service", "uptimeSeconds"]
      },
      ErrorResponse: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", description: "Kode stabil, aman dipakai untuk branching" },
              message: { type: "string" },
              details: { description: "Detail tambahan (bentuk tergantung kode)" },
              requestId: { type: "string" }
            },
            required: ["code", "message"]
          }
        },
        required: ["error"]
      }
    }
  }
};
var SWAGGER_OPTIONS = {
  customSiteTitle: "TFN API \u2014 Docs",
  swaggerOptions: { persistAuthorization: true, displayRequestDuration: true }
};
function mountApiDocs(app) {
  app.get("/api/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, SWAGGER_OPTIONS));
}

// src/lib/logger.ts
import pino from "pino";
var instance = null;
function logger() {
  if (instance) return instance;
  const e = env();
  instance = pino({
    level: e.LOG_LEVEL,
    base: { service: "tfn-api", env: e.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["x-api-key"]',
        "res.headers['set-cookie']",
        "*.password",
        "*.token",
        "*.secret"
      ],
      censor: "[redacted]"
    }
  });
  return instance;
}

// src/middleware/error-handler.ts
import { ZodError } from "zod";

// src/lib/errors.ts
var AppError = class extends Error {
  statusCode;
  code;
  details;
  expose;
  constructor(statusCode, code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : void 0);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? statusCode < 500;
  }
};
var ServiceUnavailableError = class extends AppError {
  constructor(message = "Dependency tidak tersedia", details) {
    super(503, "SERVICE_UNAVAILABLE", message, { details });
    this.name = "ServiceUnavailableError";
  }
};

// src/middleware/error-handler.ts
function errorHandler(error, req, res, _next) {
  const log = logger();
  if (error instanceof AppError) {
    log.warn(
      { requestId: req.requestId, code: error.code, status: error.statusCode, path: req.originalUrl },
      "request failed"
    );
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.expose ? error.message : "Terjadi kesalahan pada server",
        ...error.details === void 0 ? {} : { details: error.details },
        requestId: req.requestId
      }
    });
    return;
  }
  if (error instanceof ZodError) {
    log.warn(
      { requestId: req.requestId, issues: error.issues.length, path: req.originalUrl },
      "validation failed"
    );
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Data permintaan tidak valid",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        })),
        requestId: req.requestId
      }
    });
    return;
  }
  log.error({ requestId: req.requestId, err: error, path: req.originalUrl }, "unhandled error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Terjadi kesalahan pada server",
      requestId: req.requestId
    }
  });
}

// src/middleware/not-found.ts
function notFound(req, res) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} tidak ditemukan`,
      requestId: req.requestId
    }
  });
}

// src/middleware/request-context.ts
import { randomUUID } from "node:crypto";
function requestContext(req, res, next) {
  const incoming = req.header("x-request-id");
  const id = incoming && /^[A-Za-z0-9._-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}

// src/routes/health.ts
import { Router } from "express";
function createHealthRouter({ checkDb, startedAt = Date.now() }) {
  const router = Router();
  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "tfn-api",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1e3)
    });
  });
  router.get("/health/ready", async (req, res, next) => {
    try {
      await checkDb();
      res.json({ status: "ready", checks: { database: "up" } });
    } catch (error) {
      logger().error(
        { requestId: req.requestId, err: error },
        "readiness check failed: database unreachable"
      );
      next(new ServiceUnavailableError("Database tidak dapat dijangkau", { database: "down" }));
    }
  });
  return router;
}

// src/routes/v1.ts
import { Router as Router2 } from "express";
function createV1Router({ version }) {
  const router = Router2();
  router.get("/meta", (_req, res) => {
    res.json({
      service: "tfn-api",
      version,
      status: "skeleton",
      modules: [],
      note: "Belum ada modul bisnis di API. Lihat docs/02-ARCHITECTURE/MONOREPO-STRUCTURE.md"
    });
  });
  return router;
}

// src/routes/auth.ts
import { Router as Router3 } from "express";
import { z as z4 } from "zod";

// ../packages/auth/src/rbac.service.ts
import { z as z3 } from "zod";

// ../packages/auth/src/catalog.ts
var PERMISSIONS = {
  "admin.access": "Access the admin dashboard (read-only operational views)",
  "fighters.read": "View fighter records including private fields",
  "fighters.create": "Create fighters",
  "fighters.update": "Update fighters",
  "fighters.delete": "Delete (soft) fighters",
  "rankings.read": "View ranking drafts and history",
  "rankings.manage": "Create and edit ranking drafts, submit for approval",
  "rankings.publish": "Approve and publish official rankings",
  "fights.manage": "Create/edit fights and prepare fight results",
  "fights.verify": "Verify submitted fight results (first approval step)",
  "fights.approve": "Approve verified fight results as OFFICIAL",
  "events.manage": "Create and edit events",
  "tournaments.manage": "Manage Grand Prix tournaments, participants and brackets",
  "belts.manage": "Manage championship belts, propose holder changes, record defenses",
  "belts.approve": "Approve championship belt holder changes",
  "content.manage": "Edit landing page, hero slides, media, sponsors (draft)",
  "content.publish": "Publish landing page revisions and roll back",
  "users.manage": "Manage users, assign non-sensitive roles, revoke sessions",
  "roles.manage": "Manage roles/permissions and approve sensitive role changes",
  "settings.manage": "Manage organization settings",
  "audit.read": "Read audit logs and login monitoring",
  "ticketing.read": "View ticket orders and payment confirmation queue",
  "ticketing.manage": "Create ticket types and manage ticket orders",
  "ticketing.confirm": "Confirm or reject ticket payments"
};
var ALL_PERMISSIONS = Object.keys(PERMISSIONS);
function isPermissionKey(value) {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, value);
}

// ../packages/auth/src/permissions.ts
var FourEyesViolationError = class extends Error {
  constructor(message = "Four-eyes policy violation: you cannot approve or verify changes you initiated") {
    super(message);
    this.name = "FourEyesViolationError";
  }
};
function hasPermission(user, permission) {
  if (user.roles.includes("super_admin")) return true;
  return user.permissions.has(permission);
}
function assertFourEyes(actorId, initiatorId, contextName = "action") {
  if (initiatorId && actorId === initiatorId) {
    throw new FourEyesViolationError(`Four-eyes policy violation: cannot approve/verify own ${contextName}`);
  }
}

// ../packages/auth/src/password.ts
import { hash, verify } from "@node-rs/argon2";
import { z as z2 } from "zod";
var ARGON_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};
async function hashPassword(plain) {
  return hash(plain, ARGON_OPTIONS);
}
async function verifyPassword(hashed, plain) {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}
var dummyHash = null;
async function verifyAgainstDummy(plain) {
  dummyHash ??= hashPassword("timing-equalizer-not-a-real-password");
  await verifyPassword(await dummyHash, plain);
}
var passwordPolicy = z2.string().min(12, "Password must be at least 12 characters").max(128, "Password must be at most 128 characters").refine((v) => /[a-z]/.test(v), "Password must contain a lowercase letter").refine((v) => /[A-Z]/.test(v), "Password must contain an uppercase letter").refine((v) => /\d/.test(v), "Password must contain a number").refine((v) => /[^A-Za-z0-9]/.test(v), "Password must contain a symbol");

// ../packages/auth/src/rbac.service.ts
var RbacError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "RbacError";
  }
};
var createRoleSchema = z3.object({
  key: z3.string().min(2).max(64).regex(/^[a-z][a-z0-9_]*$/, "Key must be lowercase snake_case"),
  name: z3.string().min(2).max(120),
  description: z3.string().max(500).default("")
});
var updateRoleSchema = z3.object({
  roleId: z3.string().min(1),
  name: z3.string().min(2).max(120),
  description: z3.string().max(500).default(""),
  requiresMfa: z3.boolean().default(false)
});
var updateRolePermissionsSchema = z3.object({
  roleId: z3.string().min(1),
  permissions: z3.array(z3.string()).max(64)
});
var grantRoleSchema = z3.object({
  userId: z3.string().min(1),
  roleId: z3.string().min(1),
  reason: z3.string().min(4).max(500)
});
var revokeRoleSchema = z3.object({
  userId: z3.string().min(1),
  roleId: z3.string().min(1),
  reason: z3.string().min(4).max(500)
});
var reviewRoleRequestSchema = z3.object({
  requestId: z3.string().min(1),
  approve: z3.boolean(),
  reviewNote: z3.string().max(500).default("")
});
var setUserActiveSchema = z3.object({
  userId: z3.string().min(1),
  isActive: z3.boolean()
});
var usernameSchema = z3.string().trim().toLowerCase().min(3, "Username must be at least 3 characters").max(64, "Username must be at most 64 characters").regex(/^[a-z0-9._-]+$/, "Username may only contain letters, numbers, dot, underscore, or hyphen").refine((v) => !v.includes("@"), "Username cannot contain @");
var createUserSchema = z3.object({
  username: usernameSchema,
  email: z3.string().trim().max(191).email("Invalid email address").toLowerCase(),
  name: z3.string().trim().min(2, "Name must be at least 2 characters").max(120),
  password: passwordPolicy,
  roleIds: z3.array(z3.string().min(1)).default([])
});
var changeOwnPasswordSchema = z3.object({
  currentPassword: z3.string().min(1, "Current password is required").max(1024),
  newPassword: passwordPolicy
});
function createRbacService(deps) {
  const { db, audit } = deps;
  async function getRoleOrThrow(roleId) {
    const role = await db.role.findUnique({ where: { id: roleId } });
    if (!role) throw new RbacError("Role not found");
    return role;
  }
  async function countOtherActiveSuperAdmins(excludeUserId) {
    return db.userRole.count({
      where: {
        role: { key: "super_admin" },
        userId: { not: excludeUserId },
        user: { isActive: true }
      }
    });
  }
  return {
    async listRolesDetailed() {
      const roles = await db.role.findMany({
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } }
        },
        orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }]
      });
      return roles.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        requiresMfa: r.requiresMfa,
        isSensitive: r.isSensitive,
        userCount: r._count.users,
        permissions: r.permissions.map((rp) => rp.permission.key).sort((a, b) => a.localeCompare(b))
      }));
    },
    async createRole(actorId, input) {
      const data = createRoleSchema.parse(input);
      const existing = await db.role.findUnique({ where: { key: data.key } });
      if (existing) throw new RbacError(`Role key "${data.key}" already exists`);
      const role = await db.role.create({
        data: {
          key: data.key,
          name: data.name,
          description: data.description || null,
          isSystem: false
        }
      });
      await audit({
        actorId,
        action: "ROLE_CREATE",
        entityType: "ROLE",
        entityId: role.id,
        summary: `Created role "${role.name}" (${role.key})`,
        metadata: { key: role.key, name: role.name }
      });
      return { id: role.id, key: role.key };
    },
    async updateRole(actorId, input) {
      const data = updateRoleSchema.parse(input);
      const role = await getRoleOrThrow(data.roleId);
      if (role.key === "super_admin") {
        throw new RbacError("The Super Admin role is immutable");
      }
      await db.role.update({
        where: { id: role.id },
        data: {
          name: data.name,
          description: data.description || null,
          requiresMfa: data.requiresMfa
        }
      });
      await audit({
        actorId,
        action: "ROLE_UPDATE",
        entityType: "ROLE",
        entityId: role.id,
        summary: `Updated role "${role.name}" (${role.key})`,
        metadata: { name: data.name, requiresMfa: data.requiresMfa }
      });
    },
    async updateRolePermissions(actorId, input) {
      const data = updateRolePermissionsSchema.parse(input);
      const role = await getRoleOrThrow(data.roleId);
      if (role.key === "super_admin") {
        throw new RbacError("Super Admin permissions are immutable");
      }
      for (const key of data.permissions) {
        if (!isPermissionKey(key)) {
          throw new RbacError(`Unknown permission: ${key}`);
        }
      }
      const permissions = [...new Set(data.permissions)];
      const before = await db.rolePermission.findMany({
        where: { roleId: role.id },
        include: { permission: true }
      });
      const beforeKeys = new Set(before.map((b) => b.permission.key));
      const afterKeys = new Set(permissions);
      const added = permissions.filter((p) => !beforeKeys.has(p));
      const removed = [...beforeKeys].filter((p) => !afterKeys.has(p));
      await db.$transaction(async (tx) => {
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        if (permissions.length > 0) {
          const perms = await tx.permission.findMany({
            where: { key: { in: permissions } }
          });
          await tx.rolePermission.createMany({
            data: perms.map((p) => ({ roleId: role.id, permissionId: p.id }))
          });
        }
      });
      await audit({
        actorId,
        action: "ROLE_PERMISSIONS_UPDATE",
        entityType: "ROLE",
        entityId: role.id,
        summary: `Updated permissions of role "${role.name}" (${role.key}): +${added.length} / -${removed.length}`,
        metadata: { added, removed }
      });
    },
    async deleteRole(actorId, roleId) {
      const role = await getRoleOrThrow(roleId);
      if (role.isSystem) {
        throw new RbacError("System roles cannot be deleted");
      }
      const userCount = await db.userRole.count({ where: { roleId: role.id } });
      if (userCount > 0) {
        throw new RbacError(
          `Cannot delete: ${userCount} user(s) still hold this role. Revoke it first.`
        );
      }
      await db.role.delete({ where: { id: role.id } });
      await audit({
        actorId,
        action: "ROLE_DELETE",
        entityType: "ROLE",
        entityId: role.id,
        summary: `Deleted role "${role.name}" (${role.key})`
      });
    },
    async listUsersDetailed() {
      const users = await db.user.findMany({
        include: {
          roles: { include: { role: true } }
        },
        orderBy: { createdAt: "asc" },
        take: 200
      });
      return users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        name: u.name,
        isActive: u.isActive,
        mfaEnabled: u.mfaEnabled,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        roles: u.roles.map((ur) => ({
          id: ur.role.id,
          key: ur.role.key,
          name: ur.role.name,
          isSensitive: ur.role.isSensitive
        }))
      }));
    },
    /**
     * Membuat user baru (dipakai super admin).
     *
     * Password di-hash di sini, bukan di route, supaya aturan "tidak pernah ada plaintext yang
     * tersimpan" hanya punya satu pintu. `passwordChangedAt` ikut diisi agar kebijakan
     * "password harus diganti" di masa depan punya titik awal yang benar.
     *
     * Role sengaja diterima sebagai `roleIds` dan divalidasi satu per satu: `createMany` akan
     * diam-diam menerima id yang tidak ada, sehingga user bisa lahir tanpa role apa pun.
     */
    async createUser(actorId, input) {
      const data = createUserSchema.parse(input);
      const [sameUsername, sameEmail] = await Promise.all([
        db.user.findUnique({ where: { username: data.username } }),
        db.user.findUnique({ where: { email: data.email } })
      ]);
      if (sameUsername) throw new RbacError("Username is already taken");
      if (sameEmail) throw new RbacError("Email is already registered");
      const roles = await db.role.findMany({ where: { id: { in: data.roleIds } } });
      if (roles.length !== data.roleIds.length) {
        throw new RbacError("One or more roles do not exist");
      }
      const sensitive = roles.filter((role) => role.isSensitive);
      if (sensitive.length > 0) {
        throw new RbacError(
          `Cannot assign sensitive roles on creation (${sensitive.map((r) => r.key).join(", ")}). Create the user first, then request the role through the four-eyes flow.`
        );
      }
      const passwordHash = await hashPassword(data.password);
      const created = await db.$transaction(async (tx) => {
        return tx.user.create({
          data: {
            username: data.username,
            email: data.email,
            name: data.name,
            passwordHash,
            passwordChangedAt: /* @__PURE__ */ new Date(),
            roles: {
              create: roles.map((role) => ({
                roleId: role.id,
                assignedById: actorId
              }))
            }
          }
        });
      });
      await audit({
        actorId,
        action: "USER_CREATE",
        entityType: "USER",
        entityId: created.id,
        summary: `Created user ${created.username} (${created.email})${roles.length ? ` with roles: ${roles.map((r) => r.key).join(", ")}` : " without roles"}`,
        metadata: { userId: created.id, username: created.username, roleIds: roles.map((r) => r.id) }
      });
      return { id: created.id, username: created.username };
    },
    async listPendingRoleRequests() {
      const requests = await db.roleRequest.findMany({
        where: { status: "PENDING" },
        include: {
          user: true,
          role: true,
          requestedBy: true
        },
        orderBy: { createdAt: "desc" },
        take: 50
      });
      return requests.map((r) => ({
        id: r.id,
        action: r.action,
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
        user: { id: r.user.id, name: r.user.name, email: r.user.email },
        role: { id: r.role.id, key: r.role.key, name: r.role.name },
        requestedBy: {
          id: r.requestedBy.id,
          name: r.requestedBy.name,
          email: r.requestedBy.email
        }
      }));
    },
    async grantRole(actorId, input) {
      const data = grantRoleSchema.parse(input);
      const role = await db.role.findUnique({ where: { id: data.roleId } });
      if (!role) throw new RbacError("Role not found");
      const user = await db.user.findUnique({ where: { id: data.userId } });
      if (!user) throw new RbacError("User not found");
      const existing = await db.userRole.findUnique({
        where: { userId_roleId: { userId: data.userId, roleId: data.roleId } }
      });
      if (existing) {
        throw new RbacError(`User already holds role "${role.name}"`);
      }
      if (role.isSensitive) {
        const duplicate = await db.roleRequest.findFirst({
          where: {
            userId: data.userId,
            roleId: data.roleId,
            action: "GRANT",
            status: "PENDING"
          }
        });
        if (duplicate) {
          throw new RbacError("A pending grant request for this user/role already exists");
        }
        await db.roleRequest.create({
          data: {
            userId: data.userId,
            roleId: data.roleId,
            action: "GRANT",
            reason: data.reason,
            requestedById: actorId
          }
        });
        await audit({
          actorId,
          action: "ROLE_REQUEST_CREATE",
          entityType: "ROLE_REQUEST",
          entityId: `${data.userId}:${data.roleId}`,
          summary: `Requested GRANT of sensitive role "${role.name}" to ${user.email} \u2014 awaiting independent approval`,
          metadata: { userId: data.userId, roleKey: role.key }
        });
        return { requiresApproval: true };
      }
      await db.userRole.create({
        data: { userId: data.userId, roleId: data.roleId, assignedById: actorId }
      });
      await audit({
        actorId,
        action: "ROLE_GRANT",
        entityType: "USER_ROLE",
        entityId: `${data.userId}:${data.roleId}`,
        summary: `Granted role "${role.name}" to ${user.email}`,
        metadata: { userId: data.userId, roleKey: role.key }
      });
      return { requiresApproval: false };
    },
    async revokeRole(actorId, input) {
      const data = revokeRoleSchema.parse(input);
      const role = await db.role.findUnique({ where: { id: data.roleId } });
      if (!role) throw new RbacError("Role not found");
      const user = await db.user.findUnique({ where: { id: data.userId } });
      if (!user) throw new RbacError("User not found");
      const assignment = await db.userRole.findUnique({
        where: { userId_roleId: { userId: data.userId, roleId: data.roleId } }
      });
      if (!assignment) {
        throw new RbacError(`User does not hold role "${role.name}"`);
      }
      if (role.key === "super_admin" && await countOtherActiveSuperAdmins(data.userId) === 0) {
        throw new RbacError("Cannot revoke: this is the last active Super Admin");
      }
      if (role.isSensitive) {
        const duplicate = await db.roleRequest.findFirst({
          where: {
            userId: data.userId,
            roleId: data.roleId,
            action: "REVOKE",
            status: "PENDING"
          }
        });
        if (duplicate) {
          throw new RbacError("A pending revoke request for this user/role already exists");
        }
        await db.roleRequest.create({
          data: {
            userId: data.userId,
            roleId: data.roleId,
            action: "REVOKE",
            reason: data.reason,
            requestedById: actorId
          }
        });
        await audit({
          actorId,
          action: "ROLE_REQUEST_CREATE",
          entityType: "ROLE_REQUEST",
          entityId: `${data.userId}:${data.roleId}`,
          summary: `Requested REVOKE of sensitive role "${role.name}" from ${user.email} \u2014 awaiting independent approval`,
          metadata: { userId: data.userId, roleKey: role.key }
        });
        return { requiresApproval: true };
      }
      await db.userRole.delete({
        where: { userId_roleId: { userId: data.userId, roleId: data.roleId } }
      });
      await audit({
        actorId,
        action: "ROLE_REVOKE",
        entityType: "USER_ROLE",
        entityId: `${data.userId}:${data.roleId}`,
        summary: `Revoked role "${role.name}" from ${user.email}`,
        metadata: { userId: data.userId, roleKey: role.key }
      });
      return { requiresApproval: false };
    },
    async reviewRoleRequest(actorId, input) {
      const data = reviewRoleRequestSchema.parse(input);
      const request = await db.roleRequest.findUnique({
        where: { id: data.requestId },
        include: { role: true, user: true }
      });
      if (!request) throw new RbacError("Role request not found");
      if (request.status !== "PENDING") {
        throw new RbacError(`Request already ${request.status.toLowerCase()}`);
      }
      assertFourEyes(actorId, request.requestedById, "role request review");
      if (data.approve) {
        if (request.action === "GRANT") {
          const existing = await db.userRole.findUnique({
            where: {
              userId_roleId: { userId: request.userId, roleId: request.roleId }
            }
          });
          if (!existing) {
            await db.userRole.create({
              data: {
                userId: request.userId,
                roleId: request.roleId,
                assignedById: actorId
              }
            });
          }
        } else {
          if (request.role.key === "super_admin" && await countOtherActiveSuperAdmins(request.userId) === 0) {
            throw new RbacError("Cannot revoke: this is the last active Super Admin");
          }
          await db.userRole.deleteMany({
            where: { userId: request.userId, roleId: request.roleId }
          });
        }
      }
      await db.roleRequest.update({
        where: { id: request.id },
        data: {
          status: data.approve ? "APPROVED" : "REJECTED",
          reviewedById: actorId,
          reviewedAt: /* @__PURE__ */ new Date(),
          reviewNote: data.reviewNote || null
        }
      });
      await audit({
        actorId,
        action: data.approve ? "ROLE_REQUEST_APPROVE" : "ROLE_REQUEST_REJECT",
        entityType: "ROLE_REQUEST",
        entityId: request.id,
        summary: `${data.approve ? "Approved" : "Rejected"} ${request.action} of role "${request.role.name}" for ${request.user.email}`,
        metadata: { userId: request.userId, roleKey: request.role.key }
      });
    },
    async setUserActive(actorId, input) {
      const data = setUserActiveSchema.parse(input);
      const user = await db.user.findUnique({
        where: { id: data.userId },
        include: { roles: { include: { role: true } } }
      });
      if (!user) throw new RbacError("User not found");
      if (!data.isActive) {
        if (user.id === actorId) {
          throw new RbacError("You cannot deactivate your own account");
        }
        const isSuperAdmin = user.roles.some((ur) => ur.role.key === "super_admin");
        if (isSuperAdmin && await countOtherActiveSuperAdmins(user.id) === 0) {
          throw new RbacError("Cannot deactivate the last active Super Admin");
        }
      }
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { isActive: data.isActive }
        });
        if (!data.isActive) {
          await tx.session.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: /* @__PURE__ */ new Date() }
          });
        }
      });
      await audit({
        actorId,
        action: data.isActive ? "USER_ACTIVATE" : "USER_DEACTIVATE",
        entityType: "USER",
        entityId: user.id,
        summary: `${data.isActive ? "Activated" : "Deactivated"} account ${user.email}${data.isActive ? "" : " and revoked all sessions"}`,
        metadata: { userId: user.id }
      });
    }
  };
}

// ../packages/auth/src/crypto.ts
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}
function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
function encryptionKeyFromBase64(key) {
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
  return buf;
}
function decryptSecret(payload, keyBase64) {
  const [ivB, tagB, encB] = payload.split(".");
  if (!ivB || !tagB || !encB) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKeyFromBase64(keyBase64), Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encB, "base64url")), decipher.final()]).toString("utf8");
}

// ../packages/auth/src/totp.ts
import { createHmac as createHmac2, randomBytes as randomBytes2, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(input) {
  const clean = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = value << 5 | idx;
    bits += 5;
    if (bits >= 8) {
      out.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function hotp(secret, counter, digits = 6) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac2("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const code = (hmac[offset] & 127) << 24 | (hmac[offset + 1] & 255) << 16 | (hmac[offset + 2] & 255) << 8 | hmac[offset + 3] & 255;
  return (code % 10 ** digits).toString().padStart(digits, "0");
}
function verifyTotp(secret, code, at = Date.now(), window = 1) {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(at / 1e3 / 30);
  for (let i = -window; i <= window; i++) {
    const expected = Buffer.from(hotp(secret, counter + i));
    const given = Buffer.from(code);
    if (expected.length === given.length && timingSafeEqual2(expected, given)) return true;
  }
  return false;
}

// ../packages/auth/src/session.service.ts
function sessionCookieName(config2) {
  return config2.NODE_ENV === "production" && config2.APP_URL?.startsWith("https://") ? "__Host-bx_session" : "bx_session";
}
function createAuthService(deps) {
  const { db } = deps;
  const env2 = () => deps.env();
  const cookieName = () => sessionCookieName(env2());
  async function getSession2(jar) {
    const rawToken = jar.get(cookieName());
    if (!rawToken) return null;
    const tokenHash = sha256Hex(rawToken);
    const now = /* @__PURE__ */ new Date();
    const session = await db.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: { permission: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!session || session.revokedAt || session.expiresAt < now || !session.user.isActive) {
      return null;
    }
    const idleThreshold = env2().SESSION_IDLE_MINUTES * 60 * 1e3;
    if (now.getTime() - session.lastSeenAt.getTime() > idleThreshold) {
      await db.session.update({ where: { id: session.id }, data: { revokedAt: now } });
      return null;
    }
    if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60 * 1e3) {
      await db.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }
    const roleKeys = [];
    const permissionKeys = /* @__PURE__ */ new Set();
    for (const ur of session.user.roles) {
      roleKeys.push(ur.role.key);
      for (const rp of ur.role.permissions) {
        permissionKeys.add(rp.permission.key);
      }
    }
    return {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      name: session.user.name,
      isActive: session.user.isActive,
      mfaEnabled: session.user.mfaEnabled,
      mfaRequired: session.user.mfaEnabled || env2().AUTH_ENFORCE_MFA && session.user.roles.some((r) => r.role.requiresMfa),
      roles: roleKeys,
      permissions: permissionKeys,
      sessionId: session.id,
      mfaVerified: session.mfaVerified
    };
  }
  async function createSession(userId, meta, mfaVerified = false) {
    const rawToken = randomToken(32);
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + env2().SESSION_TTL_HOURS * 3600 * 1e3);
    const session = await db.session.create({
      data: {
        tokenHash,
        userId,
        mfaVerified,
        ipAddress: meta?.ip?.slice(0, 64),
        userAgent: meta?.userAgent?.slice(0, 255),
        expiresAt
      }
    });
    return { id: session.id, rawToken };
  }
  async function setSessionCookie(rawToken, jar) {
    const options = {
      httpOnly: true,
      secure: env2().NODE_ENV === "production" && env2().APP_URL?.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: env2().SESSION_TTL_HOURS * 3600
    };
    jar.set(cookieName(), rawToken, options);
  }
  async function destroySession2(jar) {
    const rawToken = jar.get(cookieName());
    if (!rawToken) return;
    await db.session.updateMany({
      where: { tokenHash: sha256Hex(rawToken) },
      data: { revokedAt: /* @__PURE__ */ new Date() }
    });
    jar.delete(cookieName());
    jar.delete("bx_session");
    jar.delete("__Host-bx_session");
  }
  async function changeOwnPassword2(userId, input, keepSessionId) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "Account not found" };
    const isCurrentValid = await verifyPassword(user.passwordHash, input.currentPassword);
    if (!isCurrentValid) {
      await deps.audit?.({
        actorId: userId,
        action: "AUTH_PASSWORD_CHANGE_FAILED",
        entityType: "USER",
        entityId: userId,
        summary: `Failed password change for ${user.username}: current password incorrect`
      });
      return { success: false, error: "Current password is incorrect" };
    }
    if (input.newPassword === input.currentPassword) {
      return { success: false, error: "New password must be different from the current password" };
    }
    const policyCheck = passwordPolicy.safeParse(input.newPassword);
    if (!policyCheck.success) {
      return { success: false, error: policyCheck.error.issues[0]?.message ?? "Password does not meet the policy" };
    }
    const passwordHash = await hashPassword(input.newPassword);
    const now = /* @__PURE__ */ new Date();
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          // Password baru membatalkan lockout lama: pemilik sah sudah membuktikan identitasnya.
          failedLoginCount: 0,
          lockedUntil: null
        }
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null, id: { not: keepSessionId } },
        data: { revokedAt: now }
      });
    });
    await deps.audit?.({
      actorId: userId,
      action: "AUTH_PASSWORD_CHANGE",
      entityType: "USER",
      entityId: userId,
      summary: `User ${user.username} changed their password; all other sessions revoked`
    });
    return { success: true };
  }
  async function authenticateCredentials2(identifier, plainPassword, meta) {
    const raw2 = identifier.trim();
    const isEmail = raw2.includes("@");
    const normEmail = raw2.toLowerCase();
    const now = /* @__PURE__ */ new Date();
    const user = await db.user.findUnique({
      where: isEmail ? { email: normEmail } : { username: normEmail },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        }
      }
    });
    if (!user) {
      await verifyAgainstDummy(plainPassword);
      await db.loginAttempt.create({
        data: {
          email: normEmail,
          ipAddress: meta?.ip,
          userAgent: meta?.userAgent,
          success: false,
          reason: "USER_NOT_FOUND"
        }
      });
      return { success: false, error: "Invalid email or password" };
    }
    if (user.lockedUntil && user.lockedUntil > now) {
      return {
        success: false,
        error: `Account is temporarily locked. Try again after ${user.lockedUntil.toLocaleTimeString()}`,
        lockedUntil: user.lockedUntil
      };
    }
    if (!user.isActive) {
      return { success: false, error: "Account is disabled. Contact your administrator." };
    }
    const isPasswordValid = await verifyPassword(user.passwordHash, plainPassword);
    if (!isPasswordValid) {
      const nextFailed = user.failedLoginCount + 1;
      const shouldLock = nextFailed >= env2().AUTH_MAX_FAILED_LOGINS;
      const lockedUntil = shouldLock ? new Date(now.getTime() + env2().AUTH_LOCKOUT_MINUTES * 60 * 1e3) : null;
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: nextFailed, lockedUntil }
      });
      await db.loginAttempt.create({
        data: {
          email: normEmail,
          ipAddress: meta?.ip,
          userAgent: meta?.userAgent,
          success: false,
          reason: shouldLock ? "LOCKED_MAX_ATTEMPTS" : "INVALID_PASSWORD"
        }
      });
      return {
        success: false,
        error: shouldLock ? `Account locked due to multiple failed attempts. Try again in ${env2().AUTH_LOCKOUT_MINUTES} minutes.` : "Invalid email or password"
      };
    }
    const mfaRequired = user.mfaEnabled || env2().AUTH_ENFORCE_MFA && user.roles.some((r) => r.role.requiresMfa);
    let mfaVerified = false;
    if (mfaRequired) {
      if (!user.mfaEnabled || !user.mfaSecretEnc) {
        return { success: false, error: "MFA is required but not configured. Contact an administrator." };
      }
      if (!meta?.totpCode) {
        return { success: false, requiresMfa: true, error: "Enter your authenticator code." };
      }
      try {
        const secret = decryptSecret(user.mfaSecretEnc, env2().ENCRYPTION_KEY);
        mfaVerified = /^[A-Z2-7]{16,128}$/.test(secret) && verifyTotp(secret, meta.totpCode);
      } catch {
        return { success: false, error: "MFA is unavailable. Contact an administrator." };
      }
      if (!mfaVerified) {
        const failedLoginCount = user.failedLoginCount + 1;
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount,
            lockedUntil: failedLoginCount >= env2().AUTH_MAX_FAILED_LOGINS ? new Date(now.getTime() + env2().AUTH_LOCKOUT_MINUTES * 60 * 1e3) : null
          }
        });
        await db.loginAttempt.create({
          data: {
            email: normEmail,
            ipAddress: meta?.ip,
            userAgent: meta?.userAgent,
            success: false,
            reason: "INVALID_MFA"
          }
        });
        return { success: false, requiresMfa: true, error: "Invalid authenticator code." };
      }
    }
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now }
    });
    await db.loginAttempt.create({
      data: {
        email: normEmail,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
        success: true
      }
    });
    const session = await createSession(user.id, meta, mfaVerified);
    if (meta?.jar) await setSessionCookie(session.rawToken, meta.jar);
    await deps.audit?.({
      actorId: user.id,
      action: "AUTH_LOGIN",
      entityType: "USER",
      entityId: user.id,
      summary: `User ${user.email} signed in successfully`
    });
    const permissions = /* @__PURE__ */ new Set();
    for (const ur of user.roles) {
      for (const rp of ur.role.permissions) {
        permissions.add(rp.permission.key);
      }
    }
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        mfaEnabled: user.mfaEnabled,
        mfaRequired,
        roles: user.roles.map((r) => r.role.key),
        permissions,
        sessionId: session.id,
        mfaVerified
      }
    };
  }
  return {
    getSession: getSession2,
    authenticateCredentials: authenticateCredentials2,
    createSession,
    setSessionCookie,
    destroySession: destroySession2,
    changeOwnPassword: changeOwnPassword2,
    cookieName
  };
}

// src/db/prisma.ts
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// ../packages/db/src/generated/prisma/client.ts
import * as path2 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// ../packages/db/src/generated/prisma/internal/class.ts
import * as runtime from "@prisma/client/runtime/client";
var config = {
  "previewFeatures": [],
  "clientVersion": "7.10.1",
  "engineVersion": "d1b3f377ca835d73fd50954a5e22128b9ebdd6b8",
  "activeProvider": "mysql",
  "inlineSchema": '// =============================================================================\n// Boxing Championship Platform \u2014 Prisma schema (MySQL 8)\n// Docs: docs/DATABASE.md (ERD + relationships)\n// Conventions:\n//   - String cuid primary keys\n//   - createdAt / updatedAt on mutable tables\n//   - Soft delete (deletedAt) ONLY on Fighter, MediaAsset (referenced by history)\n//   - Critical state transitions run inside $transaction in the service layer\n// =============================================================================\n\ngenerator client {\n  provider     = "prisma-client"\n  // ADR-011: satu schema di root, client digenerate ke package bersama `@tfn/db`\n  // supaya apps/web dan apps/api memakai client yang sama tanpa duplikasi.\n  output       = "../packages/db/src/generated/prisma"\n  moduleFormat = "esm"\n}\n\ndatasource db {\n  provider = "mysql"\n}\n\n// -----------------------------------------------------------------------------\n// ENUMS\n// -----------------------------------------------------------------------------\n\nenum Gender {\n  MALE\n  FEMALE\n}\n\nenum Stance {\n  ORTHODOX\n  SOUTHPAW\n  SWITCH\n}\n\nenum FighterStatus {\n  ACTIVE\n  INACTIVE\n  RETIRED\n  SUSPENDED\n}\n\nenum RankingType {\n  DIVISION\n  POUND_FOR_POUND\n}\n\nenum RankingVersionStatus {\n  DRAFT\n  PENDING_APPROVAL\n  PUBLISHED\n  SUPERSEDED\n  REJECTED\n}\n\nenum RankingChangeAction {\n  CREATED\n  ADDED\n  REMOVED\n  MOVED\n  CHAMPION_SET\n  CHAMPION_REMOVED\n  POINTS_CHANGED\n  NOTE_CHANGED\n  SUBMITTED\n  REJECTED\n  PUBLISHED\n}\n\nenum BeltStatus {\n  ACTIVE\n  VACANT\n  SUSPENDED\n  RETIRED\n}\n\nenum BeltReignStatus {\n  PENDING_APPROVAL\n  ACTIVE\n  ENDED\n  REJECTED\n}\n\nenum BeltReignEndReason {\n  LOST\n  VACATED\n  STRIPPED\n  RETIRED\n  OTHER\n}\n\nenum EventStatus {\n  DRAFT\n  SCHEDULED\n  LIVE\n  COMPLETED\n  POSTPONED\n  CANCELLED\n}\n\nenum FightStatus {\n  SCHEDULED\n  COMPLETED\n  CANCELLED\n  POSTPONED\n}\n\nenum Corner {\n  RED\n  BLUE\n}\n\nenum FightOutcome {\n  WIN\n  DRAW\n  NO_CONTEST\n}\n\nenum FightResultStatus {\n  DRAFT\n  PENDING_VERIFICATION\n  VERIFIED\n  OFFICIAL\n  REJECTED\n}\n\nenum ApprovalAction {\n  SUBMITTED\n  VERIFIED\n  APPROVED\n  REJECTED\n}\n\nenum TournamentFormat {\n  SINGLE_ELIMINATION\n  DOUBLE_ELIMINATION\n}\n\nenum TournamentStatus {\n  DRAFT\n  REGISTRATION\n  IN_PROGRESS\n  COMPLETED\n  CANCELLED\n}\n\nenum TournamentParticipantStatus {\n  ACTIVE\n  ELIMINATED\n  WITHDRAWN\n  WINNER\n}\n\nenum BracketType {\n  WINNERS\n  LOSERS\n  GRAND_FINAL\n}\n\nenum BoutSlot {\n  A\n  B\n}\n\nenum TournamentBoutStatus {\n  PENDING\n  READY\n  COMPLETED\n  BYE\n}\n\nenum HeroOverlay {\n  DARK\n  GOLD\n  CRIMSON\n}\n\nenum PageSectionType {\n  HERO_SLIDER\n  RANKINGS\n  GRAND_PRIX\n  CHAMPIONSHIP_BELT\n  FEATURED_FIGHTERS\n  FIGHT_HISTORY\n  UPCOMING_EVENTS\n  SPONSORS\n  CTA\n  FOOTER\n}\n\nenum MediaKind {\n  IMAGE\n  VIDEO\n  MODEL\n}\n\nenum RoleRequestAction {\n  GRANT\n  REVOKE\n}\n\nenum RequestStatus {\n  PENDING\n  APPROVED\n  REJECTED\n  CANCELLED\n}\n\nenum TicketOrderStatus {\n  PENDING_CONFIRMATION\n  CONFIRMED\n  USED\n  REJECTED\n  CANCELLED\n}\n\nenum TicketPaymentMethod {\n  BANK_TRANSFER\n  CASH\n  QRIS\n  OTHER\n}\n\nenum TicketPaymentStatus {\n  UNPAID\n  PROOF_SUBMITTED\n  VERIFIED\n  REJECTED\n}\n\n// -----------------------------------------------------------------------------\n// AUTH & RBAC\n// -----------------------------------------------------------------------------\n\nmodel User {\n  id                String    @id @default(cuid())\n  /// Login handle. Wajib, unik, case-insensitive (disimpan lowercase). Email tetap ada & tetap bisa dipakai login.\n  username          String    @unique @db.VarChar(64)\n  email             String    @unique @db.VarChar(191)\n  name              String    @db.VarChar(120)\n  passwordHash      String    @db.VarChar(255)\n  isActive          Boolean   @default(true)\n  mfaEnabled        Boolean   @default(false)\n  /// AES-256-GCM encrypted TOTP secret (never stored in plain text)\n  mfaSecretEnc      String?   @db.VarChar(512)\n  failedLoginCount  Int       @default(0)\n  lockedUntil       DateTime?\n  lastLoginAt       DateTime?\n  passwordChangedAt DateTime  @default(now())\n  createdAt         DateTime  @default(now())\n  updatedAt         DateTime  @updatedAt\n\n  roles                  UserRole[]      @relation("UserRoles")\n  rolesAssigned          UserRole[]      @relation("UserRoleAssigner")\n  sessions               Session[]\n  auditLogs              AuditLog[]\n  notifications          Notification[]\n  media                  MediaAsset[]\n  roleRequests           RoleRequest[]   @relation("RoleRequestTarget")\n  roleRequested          RoleRequest[]   @relation("RoleRequestRequester")\n  roleReviewed           RoleRequest[]   @relation("RoleRequestReviewer")\n  ticketOrdersConfirmed  TicketOrder[]   @relation("TicketOrderConfirmer")\n  ticketOrdersScanned    TicketOrder[]   @relation("TicketOrderScanner")\n  ticketPaymentsReviewed TicketPayment[] @relation("TicketPaymentReviewer")\n\n  @@index([isActive])\n}\n\nmodel Role {\n  id          String   @id @default(cuid())\n  key         String   @unique @db.VarChar(64)\n  name        String   @db.VarChar(120)\n  description String?  @db.VarChar(500)\n  /// System roles cannot be deleted; super_admin permissions are immutable\n  isSystem    Boolean  @default(false)\n  /// Holders must enrol TOTP MFA before using the dashboard\n  requiresMfa Boolean  @default(false)\n  /// Granting/revoking requires an approved RoleRequest (four-eyes)\n  isSensitive Boolean  @default(false)\n  createdAt   DateTime @default(now())\n  updatedAt   DateTime @updatedAt\n\n  permissions RolePermission[]\n  users       UserRole[]\n  requests    RoleRequest[]\n}\n\nmodel Permission {\n  id          String   @id @default(cuid())\n  key         String   @unique @db.VarChar(64)\n  description String   @db.VarChar(255)\n  createdAt   DateTime @default(now())\n\n  roles RolePermission[]\n}\n\nmodel UserRole {\n  userId       String\n  roleId       String\n  assignedById String?\n  createdAt    DateTime @default(now())\n\n  user       User  @relation("UserRoles", fields: [userId], references: [id], onDelete: Cascade)\n  role       Role  @relation(fields: [roleId], references: [id], onDelete: Cascade)\n  assignedBy User? @relation("UserRoleAssigner", fields: [assignedById], references: [id], onDelete: SetNull)\n\n  @@id([userId, roleId])\n  @@index([roleId])\n}\n\nmodel RolePermission {\n  roleId       String\n  permissionId String\n  createdAt    DateTime @default(now())\n\n  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)\n  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)\n\n  @@id([roleId, permissionId])\n  @@index([permissionId])\n}\n\n/// Approval workflow for sensitive role grants/revocations (user role escalation)\nmodel RoleRequest {\n  id            String            @id @default(cuid())\n  userId        String\n  roleId        String\n  action        RoleRequestAction\n  status        RequestStatus     @default(PENDING)\n  reason        String            @db.VarChar(500)\n  reviewNote    String?           @db.VarChar(500)\n  requestedById String\n  reviewedById  String?\n  reviewedAt    DateTime?\n  createdAt     DateTime          @default(now())\n  updatedAt     DateTime          @updatedAt\n\n  user        User  @relation("RoleRequestTarget", fields: [userId], references: [id], onDelete: Cascade)\n  role        Role  @relation(fields: [roleId], references: [id], onDelete: Cascade)\n  requestedBy User  @relation("RoleRequestRequester", fields: [requestedById], references: [id], onDelete: Cascade)\n  reviewedBy  User? @relation("RoleRequestReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)\n\n  @@index([status, createdAt])\n  @@index([userId])\n}\n\nmodel Session {\n  id          String    @id @default(cuid())\n  /// SHA-256 of the opaque session token (raw token only lives in the cookie)\n  tokenHash   String    @unique @db.Char(64)\n  userId      String\n  mfaVerified Boolean   @default(false)\n  ipAddress   String?   @db.VarChar(64)\n  userAgent   String?   @db.VarChar(255)\n  createdAt   DateTime  @default(now())\n  lastSeenAt  DateTime  @default(now())\n  expiresAt   DateTime\n  revokedAt   DateTime?\n\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@index([userId, revokedAt])\n  @@index([expiresAt])\n}\n\n/// Login monitoring & brute-force detection (never stores passwords)\nmodel LoginAttempt {\n  id        String   @id @default(cuid())\n  email     String   @db.VarChar(191)\n  ipAddress String?  @db.VarChar(64)\n  userAgent String?  @db.VarChar(255)\n  success   Boolean\n  reason    String?  @db.VarChar(64)\n  createdAt DateTime @default(now())\n\n  @@index([email, createdAt])\n  @@index([ipAddress, createdAt])\n  @@index([success, createdAt])\n}\n\n// -----------------------------------------------------------------------------\n// FIGHTERS & DIVISIONS\n// -----------------------------------------------------------------------------\n\nmodel WeightClass {\n  id        String   @id @default(cuid())\n  name      String   @db.VarChar(80)\n  slug      String   @unique @db.VarChar(80)\n  gender    Gender\n  limitLbs  Decimal  @db.Decimal(6, 2)\n  limitKg   Decimal  @db.Decimal(6, 2)\n  sortOrder Int      @default(0)\n  isActive  Boolean  @default(true)\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  fighters        Fighter[]\n  fights          Fight[]\n  rankingVersions RankingVersion[]\n  belts           ChampionshipBelt[]\n  tournaments     Tournament[]\n\n  @@unique([gender, name])\n  @@index([gender, isActive, sortOrder])\n}\n\nmodel Fighter {\n  id              String        @id @default(cuid())\n  slug            String        @unique @db.VarChar(120)\n  firstName       String        @db.VarChar(80)\n  lastName        String        @db.VarChar(80)\n  ringName        String?       @db.VarChar(80)\n  gender          Gender\n  /// ISO 3166-1 alpha-2\n  nationality     String        @db.Char(2)\n  hometown        String?       @db.VarChar(120)\n  dateOfBirth     DateTime?     @db.Date\n  /// Date of birth is only shown publicly when explicitly allowed\n  showDateOfBirth Boolean       @default(false)\n  heightCm        Int?\n  reachCm         Int?\n  stance          Stance        @default(ORTHODOX)\n  weightClassId   String\n  status          FighterStatus @default(ACTIVE)\n  bio             String?       @db.Text\n  /// JSON string[] \u2014 validated by Zod\n  achievements    Json?\n  portraitId      String?\n  debutDate       DateTime?     @db.Date\n\n  /// Record accrued BEFORE platform tracking (documented manual baseline)\n  baseWins       Int @default(0)\n  baseLosses     Int @default(0)\n  baseDraws      Int @default(0)\n  baseNoContests Int @default(0)\n  baseKoWins     Int @default(0)\n\n  /// Denormalized totals = base + OFFICIAL results. Recomputed in a transaction on result approval.\n  wins       Int @default(0)\n  losses     Int @default(0)\n  draws      Int @default(0)\n  noContests Int @default(0)\n  koWins     Int @default(0)\n\n  /// PRIVATE \u2014 never exposed by public DTOs\n  contactEmail String? @db.VarChar(191)\n  contactPhone String? @db.VarChar(40)\n  privateNotes String? @db.Text\n\n  isDemo    Boolean   @default(false)\n  deletedAt DateTime?\n  createdAt DateTime  @default(now())\n  updatedAt DateTime  @updatedAt\n\n  weightClass       WeightClass             @relation(fields: [weightClassId], references: [id])\n  portrait          MediaAsset?             @relation("FighterPortrait", fields: [portraitId], references: [id], onDelete: SetNull)\n  fightParticipants FightParticipant[]\n  rankingEntries    RankingEntry[]\n  currentRankings   FighterRanking[]\n  rankingChanges    RankingChangeLog[]\n  beltReigns        BeltReign[]\n  beltDefenses      BeltDefense[]           @relation("DefenseChallenger")\n  tournamentEntries TournamentParticipant[]\n  tournamentsWon    Tournament[]            @relation("TournamentWinner")\n\n  @@index([weightClassId, status])\n  @@index([nationality])\n  @@index([status, deletedAt])\n  @@index([lastName, firstName])\n}\n\n// -----------------------------------------------------------------------------\n// RANKINGS (manual official ranking, versioned publication)\n// -----------------------------------------------------------------------------\n\nmodel RankingVersion {\n  id            String               @id @default(cuid())\n  type          RankingType\n  /// DIVISION rankings reference a weight class\n  weightClassId String?\n  /// POUND_FOR_POUND rankings are split by gender\n  gender        Gender?\n  /// "DIV:<weightClassId>" | "P4P:MALE" | "P4P:FEMALE" \u2014 groups versions of one ranking\n  scopeKey      String               @db.VarChar(80)\n  versionNumber Int\n  status        RankingVersionStatus @default(DRAFT)\n  effectiveDate DateTime             @db.Date\n  notes         String?              @db.Text\n  /// Reserved for future scoring engine; MVP is always MANUAL\n  method        String               @default("MANUAL") @db.VarChar(32)\n\n  createdById     String?\n  submittedById   String?\n  submittedAt     DateTime?\n  approvedById    String?\n  publishedAt     DateTime?\n  rejectedById    String?\n  rejectionReason String?   @db.VarChar(500)\n  createdAt       DateTime  @default(now())\n  updatedAt       DateTime  @updatedAt\n\n  weightClass WeightClass?       @relation(fields: [weightClassId], references: [id])\n  entries     RankingEntry[]\n  changes     RankingChangeLog[]\n  current     FighterRanking[]\n\n  @@unique([scopeKey, versionNumber])\n  @@index([scopeKey, status])\n  @@index([status, publishedAt])\n}\n\nmodel RankingEntry {\n  id           String   @id @default(cuid())\n  versionId    String\n  fighterId    String\n  /// null when the fighter is listed as the champion\n  rank         Int?\n  isChampion   Boolean  @default(false)\n  points       Decimal? @db.Decimal(10, 2)\n  /// Filled at publication time, relative to the previously published version\n  previousRank Int?\n  movement     Int?\n  isNew        Boolean  @default(false)\n  note         String?  @db.VarChar(255)\n  createdAt    DateTime @default(now())\n  updatedAt    DateTime @updatedAt\n\n  version RankingVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)\n  fighter Fighter        @relation(fields: [fighterId], references: [id])\n\n  @@unique([versionId, fighterId])\n  @@unique([versionId, rank])\n  @@index([fighterId])\n}\n\n/// Denormalized "current published rank" per fighter per ranking scope\nmodel FighterRanking {\n  id         String   @id @default(cuid())\n  fighterId  String\n  scopeKey   String   @db.VarChar(80)\n  versionId  String\n  rank       Int?\n  isChampion Boolean  @default(false)\n  updatedAt  DateTime @updatedAt\n\n  fighter Fighter        @relation(fields: [fighterId], references: [id], onDelete: Cascade)\n  version RankingVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)\n\n  @@unique([fighterId, scopeKey])\n  @@index([scopeKey, rank])\n}\n\nmodel RankingChangeLog {\n  id        String              @id @default(cuid())\n  versionId String\n  fighterId String?\n  action    RankingChangeAction\n  fromRank  Int?\n  toRank    Int?\n  reason    String              @db.VarChar(500)\n  actorId   String?\n  createdAt DateTime            @default(now())\n\n  version RankingVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)\n  fighter Fighter?       @relation(fields: [fighterId], references: [id], onDelete: SetNull)\n\n  @@index([versionId, createdAt])\n  @@index([fighterId])\n}\n\n// -----------------------------------------------------------------------------\n// CHAMPIONSHIP BELTS\n// -----------------------------------------------------------------------------\n\nmodel ChampionshipBelt {\n  id              String     @id @default(cuid())\n  name            String     @db.VarChar(120)\n  slug            String     @unique @db.VarChar(120)\n  weightClassId   String\n  description     String?    @db.Text\n  status          BeltStatus @default(VACANT)\n  imageId         String?\n  /// Optional GLB model uploaded via media library\n  modelId         String?\n  nextDefenseAt   DateTime?\n  nextDefenseNote String?    @db.VarChar(255)\n  sortOrder       Int        @default(0)\n  isDemo          Boolean    @default(false)\n  createdAt       DateTime   @default(now())\n  updatedAt       DateTime   @updatedAt\n\n  weightClass WeightClass @relation(fields: [weightClassId], references: [id])\n  image       MediaAsset? @relation("BeltImage", fields: [imageId], references: [id], onDelete: SetNull)\n  model       MediaAsset? @relation("BeltModel", fields: [modelId], references: [id], onDelete: SetNull)\n  reigns      BeltReign[]\n  fights      Fight[]\n\n  @@index([weightClassId])\n  @@index([status, sortOrder])\n}\n\nmodel BeltReign {\n  id              String              @id @default(cuid())\n  beltId          String\n  fighterId       String\n  status          BeltReignStatus     @default(PENDING_APPROVAL)\n  /// Equals beltId while ACTIVE, null otherwise \u2192 DB-level guarantee of ONE active reign per belt\n  activeKey       String?             @unique @db.VarChar(191)\n  wonAt           DateTime            @db.Date\n  wonFightId      String?\n  endedAt         DateTime?           @db.Date\n  endReason       BeltReignEndReason?\n  notes           String?             @db.VarChar(500)\n  proposedById    String?\n  approvedById    String?\n  approvedAt      DateTime?\n  rejectedById    String?\n  rejectionReason String?             @db.VarChar(500)\n  createdAt       DateTime            @default(now())\n  updatedAt       DateTime            @updatedAt\n\n  belt     ChampionshipBelt @relation(fields: [beltId], references: [id], onDelete: Cascade)\n  fighter  Fighter          @relation(fields: [fighterId], references: [id])\n  wonFight Fight?           @relation("ReignWonFight", fields: [wonFightId], references: [id], onDelete: SetNull)\n  defenses BeltDefense[]\n\n  @@index([beltId, status])\n  @@index([fighterId])\n}\n\nmodel BeltDefense {\n  id           String   @id @default(cuid())\n  reignId      String\n  fightId      String?  @unique\n  challengerId String?\n  defendedAt   DateTime @db.Date\n  notes        String?  @db.VarChar(255)\n  createdAt    DateTime @default(now())\n\n  reign      BeltReign @relation(fields: [reignId], references: [id], onDelete: Cascade)\n  fight      Fight?    @relation(fields: [fightId], references: [id], onDelete: SetNull)\n  challenger Fighter?  @relation("DefenseChallenger", fields: [challengerId], references: [id], onDelete: SetNull)\n\n  @@index([reignId, defendedAt])\n}\n\n// -----------------------------------------------------------------------------\n// EVENTS & FIGHTS\n// -----------------------------------------------------------------------------\n\nmodel Event {\n  id          String      @id @default(cuid())\n  name        String      @db.VarChar(160)\n  slug        String      @unique @db.VarChar(160)\n  description String?     @db.Text\n  venue       String?     @db.VarChar(160)\n  city        String?     @db.VarChar(120)\n  country     String?     @db.Char(2)\n  /// Stored in UTC; rendered with `timezone`\n  startsAt    DateTime\n  timezone    String      @default("UTC") @db.VarChar(64)\n  status      EventStatus @default(DRAFT)\n  posterId    String?\n  /// Only published events are visible publicly\n  isPublished Boolean     @default(false)\n  isDemo      Boolean     @default(false)\n  createdAt   DateTime    @default(now())\n  updatedAt   DateTime    @updatedAt\n\n  poster       MediaAsset?   @relation("EventPoster", fields: [posterId], references: [id], onDelete: SetNull)\n  fights       Fight[]\n  ticketTypes  TicketType[]\n  ticketOrders TicketOrder[]\n\n  @@index([isPublished, startsAt])\n  @@index([status, startsAt])\n}\n\n/// Configurable result methods (KO, TKO, UD, SD, ...)\nmodel FightMethod {\n  id         String   @id @default(cuid())\n  code       String   @unique @db.VarChar(16)\n  name       String   @db.VarChar(80)\n  /// counts as KO win for statistics\n  isStoppage Boolean  @default(false)\n  sortOrder  Int      @default(0)\n  isActive   Boolean  @default(true)\n  createdAt  DateTime @default(now())\n  updatedAt  DateTime @updatedAt\n\n  results FightResult[]\n}\n\nmodel Fight {\n  id              String      @id @default(cuid())\n  eventId         String?\n  weightClassId   String\n  scheduledAt     DateTime\n  scheduledRounds Int         @default(10)\n  boutOrder       Int         @default(0)\n  isMainEvent     Boolean     @default(false)\n  isTitleFight    Boolean     @default(false)\n  beltId          String?\n  status          FightStatus @default(SCHEDULED)\n  notes           String?     @db.VarChar(500)\n  createdAt       DateTime    @default(now())\n  updatedAt       DateTime    @updatedAt\n\n  event          Event?             @relation(fields: [eventId], references: [id], onDelete: SetNull)\n  weightClass    WeightClass        @relation(fields: [weightClassId], references: [id])\n  belt           ChampionshipBelt?  @relation(fields: [beltId], references: [id], onDelete: SetNull)\n  participants   FightParticipant[]\n  result         FightResult?\n  tournamentBout TournamentBout?\n  reignsWon      BeltReign[]        @relation("ReignWonFight")\n  defense        BeltDefense?\n\n  @@index([eventId, boutOrder])\n  @@index([scheduledAt])\n  @@index([weightClassId, scheduledAt])\n  @@index([status])\n}\n\nmodel FightParticipant {\n  id        String   @id @default(cuid())\n  fightId   String\n  fighterId String\n  corner    Corner\n  weighInKg Decimal? @db.Decimal(6, 2)\n  createdAt DateTime @default(now())\n\n  fight      Fight         @relation(fields: [fightId], references: [id], onDelete: Cascade)\n  fighter    Fighter       @relation(fields: [fighterId], references: [id])\n  wonResults FightResult[] @relation("ResultWinner")\n\n  @@unique([fightId, corner])\n  @@unique([fightId, fighterId])\n  @@index([fighterId])\n}\n\nmodel FightResult {\n  id                  String            @id @default(cuid())\n  fightId             String            @unique\n  outcome             FightOutcome\n  /// Required when outcome = WIN\n  winnerParticipantId String?\n  methodId            String\n  endRound            Int?\n  /// "m:ss" \u2014 time in the ending round\n  endTime             String?           @db.VarChar(5)\n  /// JSON [{ judge: string, red: number, blue: number }]\n  scorecards          Json?\n  referee             String?           @db.VarChar(120)\n  sourceUrl           String?           @db.VarChar(500)\n  verificationNote    String?           @db.VarChar(500)\n  status              FightResultStatus @default(DRAFT)\n  enteredById         String?\n  verifiedById        String?\n  verifiedAt          DateTime?\n  approvedById        String?\n  approvedAt          DateTime?\n  createdAt           DateTime          @default(now())\n  updatedAt           DateTime          @updatedAt\n\n  fight     Fight                 @relation(fields: [fightId], references: [id], onDelete: Cascade)\n  winner    FightParticipant?     @relation("ResultWinner", fields: [winnerParticipantId], references: [id], onDelete: SetNull)\n  method    FightMethod           @relation(fields: [methodId], references: [id])\n  approvals FightResultApproval[]\n\n  @@index([status])\n}\n\nmodel FightResultApproval {\n  id        String         @id @default(cuid())\n  resultId  String\n  action    ApprovalAction\n  actorId   String?\n  comment   String?        @db.VarChar(500)\n  createdAt DateTime       @default(now())\n\n  result FightResult @relation(fields: [resultId], references: [id], onDelete: Cascade)\n\n  @@index([resultId, createdAt])\n}\n\n// -----------------------------------------------------------------------------\n// TICKETING (LOCAL MVP \u2014 ADMIN PAYMENT CONFIRMATION)\n// -----------------------------------------------------------------------------\n\nmodel TicketType {\n  id          String   @id @default(cuid())\n  eventId     String\n  name        String   @db.VarChar(100)\n  code        String   @db.VarChar(40)\n  description String?  @db.VarChar(500)\n  price       Decimal  @db.Decimal(12, 2)\n  quota       Int\n  sold        Int      @default(0)\n  isActive    Boolean  @default(true)\n  createdAt   DateTime @default(now())\n  updatedAt   DateTime @updatedAt\n\n  event Event             @relation(fields: [eventId], references: [id], onDelete: Cascade)\n  items TicketOrderItem[]\n\n  @@unique([eventId, code])\n  @@index([eventId, isActive])\n}\n\nmodel TicketOrder {\n  id              String              @id @default(cuid())\n  orderNumber     String              @unique @db.VarChar(32)\n  eventId         String\n  customerName    String              @db.VarChar(120)\n  customerEmail   String              @db.VarChar(191)\n  customerPhone   String              @db.VarChar(40)\n  totalAmount     Decimal             @db.Decimal(12, 2)\n  status          TicketOrderStatus   @default(PENDING_CONFIRMATION)\n  paymentMethod   TicketPaymentMethod @default(BANK_TRANSFER)\n  paymentStatus   TicketPaymentStatus @default(UNPAID)\n  customerNote    String?             @db.VarChar(500)\n  adminNote       String?             @db.VarChar(500)\n  rejectionReason String?             @db.VarChar(500)\n  guestTokenHash  String?             @unique @db.Char(64)\n  confirmedById   String?\n  confirmedAt     DateTime?\n  rejectedAt      DateTime?\n  checkedInAt     DateTime?\n  checkedInById   String?\n  createdAt       DateTime            @default(now())\n  updatedAt       DateTime            @updatedAt\n\n  event       Event             @relation(fields: [eventId], references: [id], onDelete: Restrict)\n  items       TicketOrderItem[]\n  payment     TicketPayment?\n  confirmedBy User?             @relation("TicketOrderConfirmer", fields: [confirmedById], references: [id], onDelete: SetNull)\n  checkedInBy User?             @relation("TicketOrderScanner", fields: [checkedInById], references: [id], onDelete: SetNull)\n\n  @@index([eventId, status, createdAt])\n  @@index([customerEmail])\n  @@index([checkedInById])\n}\n\nmodel TicketOrderItem {\n  id           String   @id @default(cuid())\n  orderId      String\n  ticketTypeId String\n  quantity     Int\n  unitPrice    Decimal  @db.Decimal(12, 2)\n  subtotal     Decimal  @db.Decimal(12, 2)\n  createdAt    DateTime @default(now())\n\n  order      TicketOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)\n  ticketType TicketType  @relation(fields: [ticketTypeId], references: [id], onDelete: Restrict)\n\n  @@unique([orderId, ticketTypeId])\n}\n\nmodel TicketPayment {\n  id           String              @id @default(cuid())\n  orderId      String              @unique\n  amount       Decimal             @db.Decimal(12, 2)\n  method       TicketPaymentMethod\n  status       TicketPaymentStatus @default(PROOF_SUBMITTED)\n  proofUrl     String?             @db.VarChar(500)\n  reference    String?             @db.VarChar(120)\n  note         String?             @db.VarChar(500)\n  reviewedById String?\n  reviewedAt   DateTime?\n  createdAt    DateTime            @default(now())\n  updatedAt    DateTime            @updatedAt\n\n  order      TicketOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)\n  reviewedBy User?       @relation("TicketPaymentReviewer", fields: [reviewedById], references: [id], onDelete: SetNull)\n\n  @@index([status, createdAt])\n}\n\n// -----------------------------------------------------------------------------\n// GRAND PRIX / TOURNAMENTS\n// -----------------------------------------------------------------------------\n\nmodel Tournament {\n  id            String           @id @default(cuid())\n  name          String           @db.VarChar(160)\n  slug          String           @unique @db.VarChar(160)\n  weightClassId String\n  format        TournamentFormat @default(SINGLE_ELIMINATION)\n  status        TournamentStatus @default(DRAFT)\n  /// Bracket size (power of two: 4, 8, 16, 32)\n  size          Int              @default(8)\n  prize         String?          @db.VarChar(255)\n  titleAwarded  String?          @db.VarChar(160)\n  description   String?          @db.Text\n  posterId      String?\n  startDate     DateTime?        @db.Date\n  endDate       DateTime?        @db.Date\n  winnerId      String?\n  isPublished   Boolean          @default(false)\n  isDemo        Boolean          @default(false)\n  createdAt     DateTime         @default(now())\n  updatedAt     DateTime         @updatedAt\n\n  weightClass  WeightClass             @relation(fields: [weightClassId], references: [id])\n  poster       MediaAsset?             @relation("TournamentPoster", fields: [posterId], references: [id], onDelete: SetNull)\n  winner       Fighter?                @relation("TournamentWinner", fields: [winnerId], references: [id], onDelete: SetNull)\n  participants TournamentParticipant[]\n  brackets     TournamentBracket[]\n\n  @@index([isPublished, status])\n}\n\nmodel TournamentParticipant {\n  id           String                      @id @default(cuid())\n  tournamentId String\n  fighterId    String\n  seed         Int\n  status       TournamentParticipantStatus @default(ACTIVE)\n  createdAt    DateTime                    @default(now())\n\n  tournament Tournament       @relation(fields: [tournamentId], references: [id], onDelete: Cascade)\n  fighter    Fighter          @relation(fields: [fighterId], references: [id])\n  boutsAsA   TournamentBout[] @relation("BoutParticipantA")\n  boutsAsB   TournamentBout[] @relation("BoutParticipantB")\n  boutsWon   TournamentBout[] @relation("BoutWinner")\n\n  @@unique([tournamentId, fighterId])\n  @@unique([tournamentId, seed])\n}\n\nmodel TournamentBracket {\n  id           String      @id @default(cuid())\n  tournamentId String\n  type         BracketType @default(WINNERS)\n  name         String      @db.VarChar(80)\n  rounds       Int\n  createdAt    DateTime    @default(now())\n\n  tournament Tournament       @relation(fields: [tournamentId], references: [id], onDelete: Cascade)\n  bouts      TournamentBout[]\n\n  @@unique([tournamentId, type])\n}\n\nmodel TournamentBout {\n  id                  String               @id @default(cuid())\n  bracketId           String\n  round               Int\n  position            Int\n  participantAId      String?\n  participantBId      String?\n  winnerParticipantId String?\n  /// Link to the official fight record (one bout \u2194 one fight)\n  fightId             String?              @unique\n  nextBoutId          String?\n  nextSlot            BoutSlot?\n  status              TournamentBoutStatus @default(PENDING)\n  createdAt           DateTime             @default(now())\n  updatedAt           DateTime             @updatedAt\n\n  bracket      TournamentBracket      @relation(fields: [bracketId], references: [id], onDelete: Cascade)\n  participantA TournamentParticipant? @relation("BoutParticipantA", fields: [participantAId], references: [id], onDelete: SetNull)\n  participantB TournamentParticipant? @relation("BoutParticipantB", fields: [participantBId], references: [id], onDelete: SetNull)\n  winner       TournamentParticipant? @relation("BoutWinner", fields: [winnerParticipantId], references: [id], onDelete: SetNull)\n  fight        Fight?                 @relation(fields: [fightId], references: [id], onDelete: SetNull)\n  nextBout     TournamentBout?        @relation("BoutProgression", fields: [nextBoutId], references: [id], onDelete: SetNull)\n  feederBouts  TournamentBout[]       @relation("BoutProgression")\n\n  @@unique([bracketId, round, position])\n}\n\n// -----------------------------------------------------------------------------\n// CMS\n// -----------------------------------------------------------------------------\n\nmodel HeroSlide {\n  id                String      @id @default(cuid())\n  eventTitle        String      @db.VarChar(160)\n  category          String?     @db.VarChar(80)\n  headline          String      @db.VarChar(200)\n  description       String?     @db.VarChar(600)\n  eventDate         DateTime?\n  backgroundId      String?\n  backgroundVideoId String?\n  fighterImageId    String?\n  ctaPrimaryLabel   String?     @db.VarChar(40)\n  ctaPrimaryHref    String?     @db.VarChar(500)\n  ctaSecondaryLabel String?     @db.VarChar(40)\n  ctaSecondaryHref  String?     @db.VarChar(500)\n  show3dBelt        Boolean     @default(false)\n  overlay           HeroOverlay @default(DARK)\n  sortOrder         Int         @default(0)\n  isActive          Boolean     @default(true)\n  publishAt         DateTime?\n  unpublishAt       DateTime?\n  createdAt         DateTime    @default(now())\n  updatedAt         DateTime    @updatedAt\n\n  background      MediaAsset? @relation("HeroBackground", fields: [backgroundId], references: [id], onDelete: SetNull)\n  backgroundVideo MediaAsset? @relation("HeroVideo", fields: [backgroundVideoId], references: [id], onDelete: SetNull)\n  fighterImage    MediaAsset? @relation("HeroFighter", fields: [fighterImageId], references: [id], onDelete: SetNull)\n\n  @@index([isActive, sortOrder])\n}\n\nmodel Page {\n  id                  String   @id @default(cuid())\n  slug                String   @unique @db.VarChar(80)\n  title               String   @db.VarChar(160)\n  seoTitle            String?  @db.VarChar(160)\n  seoDescription      String?  @db.VarChar(320)\n  publishedRevisionId String?  @unique\n  draftUpdatedAt      DateTime @default(now())\n  draftUpdatedById    String?\n  createdAt           DateTime @default(now())\n  updatedAt           DateTime @updatedAt\n\n  sections          PageSection[]\n  revisions         PageRevision[] @relation("PageRevisions")\n  publishedRevision PageRevision?  @relation("PagePublished", fields: [publishedRevisionId], references: [id], onDelete: SetNull)\n}\n\n/// Working DRAFT copy of the page\'s sections. Public site renders the published revision snapshot.\nmodel PageSection {\n  id        String          @id @default(cuid())\n  pageId    String\n  type      PageSectionType\n  sortOrder Int\n  isEnabled Boolean         @default(true)\n  /// Validated JSON config (see src/features/cms/section-schemas.ts). No HTML/JS allowed.\n  config    Json\n  createdAt DateTime        @default(now())\n  updatedAt DateTime        @updatedAt\n\n  page Page @relation(fields: [pageId], references: [id], onDelete: Cascade)\n\n  @@index([pageId, sortOrder])\n}\n\nmodel PageRevision {\n  id          String   @id @default(cuid())\n  pageId      String\n  version     Int\n  /// Immutable snapshot: { title, seoTitle, seoDescription, sections: [...] }\n  snapshot    Json\n  note        String?  @db.VarChar(255)\n  createdById String?\n  createdAt   DateTime @default(now())\n\n  page          Page  @relation("PageRevisions", fields: [pageId], references: [id], onDelete: Cascade)\n  publishedPage Page? @relation("PagePublished")\n\n  @@unique([pageId, version])\n}\n\nmodel MediaAsset {\n  id           String    @id @default(cuid())\n  /// Randomized storage key, never derived from user input\n  storageKey   String    @unique @db.VarChar(255)\n  url          String    @db.VarChar(500)\n  kind         MediaKind\n  mimeType     String    @db.VarChar(80)\n  sizeBytes    Int\n  width        Int?\n  height       Int?\n  /// Sanitized original filename (display only)\n  originalName String    @db.VarChar(255)\n  alt          String?   @db.VarChar(255)\n  checksum     String    @db.Char(64)\n  uploadedById String?\n  deletedAt    DateTime?\n  createdAt    DateTime  @default(now())\n  updatedAt    DateTime  @updatedAt\n\n  uploadedBy        User?              @relation(fields: [uploadedById], references: [id], onDelete: SetNull)\n  fighterPortraits  Fighter[]          @relation("FighterPortrait")\n  beltImages        ChampionshipBelt[] @relation("BeltImage")\n  beltModels        ChampionshipBelt[] @relation("BeltModel")\n  eventPosters      Event[]            @relation("EventPoster")\n  tournamentPosters Tournament[]       @relation("TournamentPoster")\n  heroBackgrounds   HeroSlide[]        @relation("HeroBackground")\n  heroVideos        HeroSlide[]        @relation("HeroVideo")\n  heroFighters      HeroSlide[]        @relation("HeroFighter")\n  sponsorLogos      Sponsor[]          @relation("SponsorLogo")\n\n  @@index([kind, deletedAt, createdAt])\n}\n\nmodel Sponsor {\n  id        String   @id @default(cuid())\n  name      String   @db.VarChar(120)\n  logoId    String?\n  url       String?  @db.VarChar(500)\n  tier      String   @default("PARTNER") @db.VarChar(32)\n  sortOrder Int      @default(0)\n  isActive  Boolean  @default(true)\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  logo MediaAsset? @relation("SponsorLogo", fields: [logoId], references: [id], onDelete: SetNull)\n\n  @@index([isActive, sortOrder])\n}\n\n// -----------------------------------------------------------------------------\n// SYSTEM\n// -----------------------------------------------------------------------------\n\nmodel AuditLog {\n  id         String   @id @default(cuid())\n  actorId    String?\n  action     String   @db.VarChar(80)\n  entityType String   @db.VarChar(64)\n  entityId   String?  @db.VarChar(191)\n  summary    String   @db.VarChar(500)\n  /// Redacted metadata \u2014 secrets/passwords/tokens are stripped before persisting\n  metadata   Json?\n  ipAddress  String?  @db.VarChar(64)\n  userAgent  String?  @db.VarChar(255)\n  createdAt  DateTime @default(now())\n\n  actor User? @relation(fields: [actorId], references: [id], onDelete: SetNull)\n\n  @@index([entityType, entityId])\n  @@index([actorId, createdAt])\n  @@index([action, createdAt])\n  @@index([createdAt])\n}\n\nmodel Notification {\n  id        String    @id @default(cuid())\n  userId    String\n  type      String    @db.VarChar(64)\n  title     String    @db.VarChar(160)\n  body      String?   @db.VarChar(500)\n  link      String?   @db.VarChar(255)\n  readAt    DateTime?\n  createdAt DateTime  @default(now())\n\n  user User @relation(fields: [userId], references: [id], onDelete: Cascade)\n\n  @@index([userId, readAt, createdAt])\n}\n\n/// Key/value settings. Each key\'s JSON value is validated by a Zod schema (src/features/settings/schemas.ts)\nmodel OrganizationSetting {\n  key         String   @id @db.VarChar(64)\n  value       Json\n  updatedById String?\n  updatedAt   DateTime @updatedAt\n}\n',
  "runtimeDataModel": {
    "models": {},
    "enums": {},
    "types": {}
  },
  "parameterizationSchema": {
    "strings": [],
    "graph": ""
  }
};
config.runtimeDataModel = JSON.parse('{"models":{"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"username","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"passwordHash","kind":"scalar","type":"String"},{"name":"isActive","kind":"scalar","type":"Boolean"},{"name":"mfaEnabled","kind":"scalar","type":"Boolean"},{"name":"mfaSecretEnc","kind":"scalar","type":"String"},{"name":"failedLoginCount","kind":"scalar","type":"Int"},{"name":"lockedUntil","kind":"scalar","type":"DateTime"},{"name":"lastLoginAt","kind":"scalar","type":"DateTime"},{"name":"passwordChangedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"roles","kind":"object","type":"UserRole","relationName":"UserRoles"},{"name":"rolesAssigned","kind":"object","type":"UserRole","relationName":"UserRoleAssigner"},{"name":"sessions","kind":"object","type":"Session","relationName":"SessionToUser"},{"name":"auditLogs","kind":"object","type":"AuditLog","relationName":"AuditLogToUser"},{"name":"notifications","kind":"object","type":"Notification","relationName":"NotificationToUser"},{"name":"media","kind":"object","type":"MediaAsset","relationName":"MediaAssetToUser"},{"name":"roleRequests","kind":"object","type":"RoleRequest","relationName":"RoleRequestTarget"},{"name":"roleRequested","kind":"object","type":"RoleRequest","relationName":"RoleRequestRequester"},{"name":"roleReviewed","kind":"object","type":"RoleRequest","relationName":"RoleRequestReviewer"},{"name":"ticketOrdersConfirmed","kind":"object","type":"TicketOrder","relationName":"TicketOrderConfirmer"},{"name":"ticketOrdersScanned","kind":"object","type":"TicketOrder","relationName":"TicketOrderScanner"},{"name":"ticketPaymentsReviewed","kind":"object","type":"TicketPayment","relationName":"TicketPaymentReviewer"}],"dbName":null,"schema":null},"Role":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"key","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"isSystem","kind":"scalar","type":"Boolean"},{"name":"requiresMfa","kind":"scalar","type":"Boolean"},{"name":"isSensitive","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"permissions","kind":"object","type":"RolePermission","relationName":"RoleToRolePermission"},{"name":"users","kind":"object","type":"UserRole","relationName":"RoleToUserRole"},{"name":"requests","kind":"object","type":"RoleRequest","relationName":"RoleToRoleRequest"}],"dbName":null,"schema":null},"Permission":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"key","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"roles","kind":"object","type":"RolePermission","relationName":"PermissionToRolePermission"}],"dbName":null,"schema":null},"UserRole":{"fields":[{"name":"userId","kind":"scalar","type":"String"},{"name":"roleId","kind":"scalar","type":"String"},{"name":"assignedById","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"UserRoles"},{"name":"role","kind":"object","type":"Role","relationName":"RoleToUserRole"},{"name":"assignedBy","kind":"object","type":"User","relationName":"UserRoleAssigner"}],"dbName":null,"schema":null},"RolePermission":{"fields":[{"name":"roleId","kind":"scalar","type":"String"},{"name":"permissionId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"role","kind":"object","type":"Role","relationName":"RoleToRolePermission"},{"name":"permission","kind":"object","type":"Permission","relationName":"PermissionToRolePermission"}],"dbName":null,"schema":null},"RoleRequest":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"roleId","kind":"scalar","type":"String"},{"name":"action","kind":"enum","type":"RoleRequestAction"},{"name":"status","kind":"enum","type":"RequestStatus"},{"name":"reason","kind":"scalar","type":"String"},{"name":"reviewNote","kind":"scalar","type":"String"},{"name":"requestedById","kind":"scalar","type":"String"},{"name":"reviewedById","kind":"scalar","type":"String"},{"name":"reviewedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"RoleRequestTarget"},{"name":"role","kind":"object","type":"Role","relationName":"RoleToRoleRequest"},{"name":"requestedBy","kind":"object","type":"User","relationName":"RoleRequestRequester"},{"name":"reviewedBy","kind":"object","type":"User","relationName":"RoleRequestReviewer"}],"dbName":null,"schema":null},"Session":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tokenHash","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"mfaVerified","kind":"scalar","type":"Boolean"},{"name":"ipAddress","kind":"scalar","type":"String"},{"name":"userAgent","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"lastSeenAt","kind":"scalar","type":"DateTime"},{"name":"expiresAt","kind":"scalar","type":"DateTime"},{"name":"revokedAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"SessionToUser"}],"dbName":null,"schema":null},"LoginAttempt":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"ipAddress","kind":"scalar","type":"String"},{"name":"userAgent","kind":"scalar","type":"String"},{"name":"success","kind":"scalar","type":"Boolean"},{"name":"reason","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":null,"schema":null},"WeightClass":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"gender","kind":"enum","type":"Gender"},{"name":"limitLbs","kind":"scalar","type":"Decimal"},{"name":"limitKg","kind":"scalar","type":"Decimal"},{"name":"sortOrder","kind":"scalar","type":"Int"},{"name":"isActive","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"fighters","kind":"object","type":"Fighter","relationName":"FighterToWeightClass"},{"name":"fights","kind":"object","type":"Fight","relationName":"FightToWeightClass"},{"name":"rankingVersions","kind":"object","type":"RankingVersion","relationName":"RankingVersionToWeightClass"},{"name":"belts","kind":"object","type":"ChampionshipBelt","relationName":"ChampionshipBeltToWeightClass"},{"name":"tournaments","kind":"object","type":"Tournament","relationName":"TournamentToWeightClass"}],"dbName":null,"schema":null},"Fighter":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"firstName","kind":"scalar","type":"String"},{"name":"lastName","kind":"scalar","type":"String"},{"name":"ringName","kind":"scalar","type":"String"},{"name":"gender","kind":"enum","type":"Gender"},{"name":"nationality","kind":"scalar","type":"String"},{"name":"hometown","kind":"scalar","type":"String"},{"name":"dateOfBirth","kind":"scalar","type":"DateTime"},{"name":"showDateOfBirth","kind":"scalar","type":"Boolean"},{"name":"heightCm","kind":"scalar","type":"Int"},{"name":"reachCm","kind":"scalar","type":"Int"},{"name":"stance","kind":"enum","type":"Stance"},{"name":"weightClassId","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"FighterStatus"},{"name":"bio","kind":"scalar","type":"String"},{"name":"achievements","kind":"scalar","type":"Json"},{"name":"portraitId","kind":"scalar","type":"String"},{"name":"debutDate","kind":"scalar","type":"DateTime"},{"name":"baseWins","kind":"scalar","type":"Int"},{"name":"baseLosses","kind":"scalar","type":"Int"},{"name":"baseDraws","kind":"scalar","type":"Int"},{"name":"baseNoContests","kind":"scalar","type":"Int"},{"name":"baseKoWins","kind":"scalar","type":"Int"},{"name":"wins","kind":"scalar","type":"Int"},{"name":"losses","kind":"scalar","type":"Int"},{"name":"draws","kind":"scalar","type":"Int"},{"name":"noContests","kind":"scalar","type":"Int"},{"name":"koWins","kind":"scalar","type":"Int"},{"name":"contactEmail","kind":"scalar","type":"String"},{"name":"contactPhone","kind":"scalar","type":"String"},{"name":"privateNotes","kind":"scalar","type":"String"},{"name":"isDemo","kind":"scalar","type":"Boolean"},{"name":"deletedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"weightClass","kind":"object","type":"WeightClass","relationName":"FighterToWeightClass"},{"name":"portrait","kind":"object","type":"MediaAsset","relationName":"FighterPortrait"},{"name":"fightParticipants","kind":"object","type":"FightParticipant","relationName":"FightParticipantToFighter"},{"name":"rankingEntries","kind":"object","type":"RankingEntry","relationName":"FighterToRankingEntry"},{"name":"currentRankings","kind":"object","type":"FighterRanking","relationName":"FighterToFighterRanking"},{"name":"rankingChanges","kind":"object","type":"RankingChangeLog","relationName":"FighterToRankingChangeLog"},{"name":"beltReigns","kind":"object","type":"BeltReign","relationName":"BeltReignToFighter"},{"name":"beltDefenses","kind":"object","type":"BeltDefense","relationName":"DefenseChallenger"},{"name":"tournamentEntries","kind":"object","type":"TournamentParticipant","relationName":"FighterToTournamentParticipant"},{"name":"tournamentsWon","kind":"object","type":"Tournament","relationName":"TournamentWinner"}],"dbName":null,"schema":null},"RankingVersion":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"type","kind":"enum","type":"RankingType"},{"name":"weightClassId","kind":"scalar","type":"String"},{"name":"gender","kind":"enum","type":"Gender"},{"name":"scopeKey","kind":"scalar","type":"String"},{"name":"versionNumber","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"RankingVersionStatus"},{"name":"effectiveDate","kind":"scalar","type":"DateTime"},{"name":"notes","kind":"scalar","type":"String"},{"name":"method","kind":"scalar","type":"String"},{"name":"createdById","kind":"scalar","type":"String"},{"name":"submittedById","kind":"scalar","type":"String"},{"name":"submittedAt","kind":"scalar","type":"DateTime"},{"name":"approvedById","kind":"scalar","type":"String"},{"name":"publishedAt","kind":"scalar","type":"DateTime"},{"name":"rejectedById","kind":"scalar","type":"String"},{"name":"rejectionReason","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"weightClass","kind":"object","type":"WeightClass","relationName":"RankingVersionToWeightClass"},{"name":"entries","kind":"object","type":"RankingEntry","relationName":"RankingEntryToRankingVersion"},{"name":"changes","kind":"object","type":"RankingChangeLog","relationName":"RankingChangeLogToRankingVersion"},{"name":"current","kind":"object","type":"FighterRanking","relationName":"FighterRankingToRankingVersion"}],"dbName":null,"schema":null},"RankingEntry":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"versionId","kind":"scalar","type":"String"},{"name":"fighterId","kind":"scalar","type":"String"},{"name":"rank","kind":"scalar","type":"Int"},{"name":"isChampion","kind":"scalar","type":"Boolean"},{"name":"points","kind":"scalar","type":"Decimal"},{"name":"previousRank","kind":"scalar","type":"Int"},{"name":"movement","kind":"scalar","type":"Int"},{"name":"isNew","kind":"scalar","type":"Boolean"},{"name":"note","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"version","kind":"object","type":"RankingVersion","relationName":"RankingEntryToRankingVersion"},{"name":"fighter","kind":"object","type":"Fighter","relationName":"FighterToRankingEntry"}],"dbName":null,"schema":null},"FighterRanking":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"fighterId","kind":"scalar","type":"String"},{"name":"scopeKey","kind":"scalar","type":"String"},{"name":"versionId","kind":"scalar","type":"String"},{"name":"rank","kind":"scalar","type":"Int"},{"name":"isChampion","kind":"scalar","type":"Boolean"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"fighter","kind":"object","type":"Fighter","relationName":"FighterToFighterRanking"},{"name":"version","kind":"object","type":"RankingVersion","relationName":"FighterRankingToRankingVersion"}],"dbName":null,"schema":null},"RankingChangeLog":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"versionId","kind":"scalar","type":"String"},{"name":"fighterId","kind":"scalar","type":"String"},{"name":"action","kind":"enum","type":"RankingChangeAction"},{"name":"fromRank","kind":"scalar","type":"Int"},{"name":"toRank","kind":"scalar","type":"Int"},{"name":"reason","kind":"scalar","type":"String"},{"name":"actorId","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"version","kind":"object","type":"RankingVersion","relationName":"RankingChangeLogToRankingVersion"},{"name":"fighter","kind":"object","type":"Fighter","relationName":"FighterToRankingChangeLog"}],"dbName":null,"schema":null},"ChampionshipBelt":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"weightClassId","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"BeltStatus"},{"name":"imageId","kind":"scalar","type":"String"},{"name":"modelId","kind":"scalar","type":"String"},{"name":"nextDefenseAt","kind":"scalar","type":"DateTime"},{"name":"nextDefenseNote","kind":"scalar","type":"String"},{"name":"sortOrder","kind":"scalar","type":"Int"},{"name":"isDemo","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"weightClass","kind":"object","type":"WeightClass","relationName":"ChampionshipBeltToWeightClass"},{"name":"image","kind":"object","type":"MediaAsset","relationName":"BeltImage"},{"name":"model","kind":"object","type":"MediaAsset","relationName":"BeltModel"},{"name":"reigns","kind":"object","type":"BeltReign","relationName":"BeltReignToChampionshipBelt"},{"name":"fights","kind":"object","type":"Fight","relationName":"ChampionshipBeltToFight"}],"dbName":null,"schema":null},"BeltReign":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"beltId","kind":"scalar","type":"String"},{"name":"fighterId","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"BeltReignStatus"},{"name":"activeKey","kind":"scalar","type":"String"},{"name":"wonAt","kind":"scalar","type":"DateTime"},{"name":"wonFightId","kind":"scalar","type":"String"},{"name":"endedAt","kind":"scalar","type":"DateTime"},{"name":"endReason","kind":"enum","type":"BeltReignEndReason"},{"name":"notes","kind":"scalar","type":"String"},{"name":"proposedById","kind":"scalar","type":"String"},{"name":"approvedById","kind":"scalar","type":"String"},{"name":"approvedAt","kind":"scalar","type":"DateTime"},{"name":"rejectedById","kind":"scalar","type":"String"},{"name":"rejectionReason","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"belt","kind":"object","type":"ChampionshipBelt","relationName":"BeltReignToChampionshipBelt"},{"name":"fighter","kind":"object","type":"Fighter","relationName":"BeltReignToFighter"},{"name":"wonFight","kind":"object","type":"Fight","relationName":"ReignWonFight"},{"name":"defenses","kind":"object","type":"BeltDefense","relationName":"BeltDefenseToBeltReign"}],"dbName":null,"schema":null},"BeltDefense":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"reignId","kind":"scalar","type":"String"},{"name":"fightId","kind":"scalar","type":"String"},{"name":"challengerId","kind":"scalar","type":"String"},{"name":"defendedAt","kind":"scalar","type":"DateTime"},{"name":"notes","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"reign","kind":"object","type":"BeltReign","relationName":"BeltDefenseToBeltReign"},{"name":"fight","kind":"object","type":"Fight","relationName":"BeltDefenseToFight"},{"name":"challenger","kind":"object","type":"Fighter","relationName":"DefenseChallenger"}],"dbName":null,"schema":null},"Event":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"venue","kind":"scalar","type":"String"},{"name":"city","kind":"scalar","type":"String"},{"name":"country","kind":"scalar","type":"String"},{"name":"startsAt","kind":"scalar","type":"DateTime"},{"name":"timezone","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"EventStatus"},{"name":"posterId","kind":"scalar","type":"String"},{"name":"isPublished","kind":"scalar","type":"Boolean"},{"name":"isDemo","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"poster","kind":"object","type":"MediaAsset","relationName":"EventPoster"},{"name":"fights","kind":"object","type":"Fight","relationName":"EventToFight"},{"name":"ticketTypes","kind":"object","type":"TicketType","relationName":"EventToTicketType"},{"name":"ticketOrders","kind":"object","type":"TicketOrder","relationName":"EventToTicketOrder"}],"dbName":null,"schema":null},"FightMethod":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"code","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"isStoppage","kind":"scalar","type":"Boolean"},{"name":"sortOrder","kind":"scalar","type":"Int"},{"name":"isActive","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"results","kind":"object","type":"FightResult","relationName":"FightMethodToFightResult"}],"dbName":null,"schema":null},"Fight":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"eventId","kind":"scalar","type":"String"},{"name":"weightClassId","kind":"scalar","type":"String"},{"name":"scheduledAt","kind":"scalar","type":"DateTime"},{"name":"scheduledRounds","kind":"scalar","type":"Int"},{"name":"boutOrder","kind":"scalar","type":"Int"},{"name":"isMainEvent","kind":"scalar","type":"Boolean"},{"name":"isTitleFight","kind":"scalar","type":"Boolean"},{"name":"beltId","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"FightStatus"},{"name":"notes","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"event","kind":"object","type":"Event","relationName":"EventToFight"},{"name":"weightClass","kind":"object","type":"WeightClass","relationName":"FightToWeightClass"},{"name":"belt","kind":"object","type":"ChampionshipBelt","relationName":"ChampionshipBeltToFight"},{"name":"participants","kind":"object","type":"FightParticipant","relationName":"FightToFightParticipant"},{"name":"result","kind":"object","type":"FightResult","relationName":"FightToFightResult"},{"name":"tournamentBout","kind":"object","type":"TournamentBout","relationName":"FightToTournamentBout"},{"name":"reignsWon","kind":"object","type":"BeltReign","relationName":"ReignWonFight"},{"name":"defense","kind":"object","type":"BeltDefense","relationName":"BeltDefenseToFight"}],"dbName":null,"schema":null},"FightParticipant":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"fightId","kind":"scalar","type":"String"},{"name":"fighterId","kind":"scalar","type":"String"},{"name":"corner","kind":"enum","type":"Corner"},{"name":"weighInKg","kind":"scalar","type":"Decimal"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"fight","kind":"object","type":"Fight","relationName":"FightToFightParticipant"},{"name":"fighter","kind":"object","type":"Fighter","relationName":"FightParticipantToFighter"},{"name":"wonResults","kind":"object","type":"FightResult","relationName":"ResultWinner"}],"dbName":null,"schema":null},"FightResult":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"fightId","kind":"scalar","type":"String"},{"name":"outcome","kind":"enum","type":"FightOutcome"},{"name":"winnerParticipantId","kind":"scalar","type":"String"},{"name":"methodId","kind":"scalar","type":"String"},{"name":"endRound","kind":"scalar","type":"Int"},{"name":"endTime","kind":"scalar","type":"String"},{"name":"scorecards","kind":"scalar","type":"Json"},{"name":"referee","kind":"scalar","type":"String"},{"name":"sourceUrl","kind":"scalar","type":"String"},{"name":"verificationNote","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"FightResultStatus"},{"name":"enteredById","kind":"scalar","type":"String"},{"name":"verifiedById","kind":"scalar","type":"String"},{"name":"verifiedAt","kind":"scalar","type":"DateTime"},{"name":"approvedById","kind":"scalar","type":"String"},{"name":"approvedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"fight","kind":"object","type":"Fight","relationName":"FightToFightResult"},{"name":"winner","kind":"object","type":"FightParticipant","relationName":"ResultWinner"},{"name":"method","kind":"object","type":"FightMethod","relationName":"FightMethodToFightResult"},{"name":"approvals","kind":"object","type":"FightResultApproval","relationName":"FightResultToFightResultApproval"}],"dbName":null,"schema":null},"FightResultApproval":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"resultId","kind":"scalar","type":"String"},{"name":"action","kind":"enum","type":"ApprovalAction"},{"name":"actorId","kind":"scalar","type":"String"},{"name":"comment","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"result","kind":"object","type":"FightResult","relationName":"FightResultToFightResultApproval"}],"dbName":null,"schema":null},"TicketType":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"eventId","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"code","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"price","kind":"scalar","type":"Decimal"},{"name":"quota","kind":"scalar","type":"Int"},{"name":"sold","kind":"scalar","type":"Int"},{"name":"isActive","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"event","kind":"object","type":"Event","relationName":"EventToTicketType"},{"name":"items","kind":"object","type":"TicketOrderItem","relationName":"TicketOrderItemToTicketType"}],"dbName":null,"schema":null},"TicketOrder":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"orderNumber","kind":"scalar","type":"String"},{"name":"eventId","kind":"scalar","type":"String"},{"name":"customerName","kind":"scalar","type":"String"},{"name":"customerEmail","kind":"scalar","type":"String"},{"name":"customerPhone","kind":"scalar","type":"String"},{"name":"totalAmount","kind":"scalar","type":"Decimal"},{"name":"status","kind":"enum","type":"TicketOrderStatus"},{"name":"paymentMethod","kind":"enum","type":"TicketPaymentMethod"},{"name":"paymentStatus","kind":"enum","type":"TicketPaymentStatus"},{"name":"customerNote","kind":"scalar","type":"String"},{"name":"adminNote","kind":"scalar","type":"String"},{"name":"rejectionReason","kind":"scalar","type":"String"},{"name":"guestTokenHash","kind":"scalar","type":"String"},{"name":"confirmedById","kind":"scalar","type":"String"},{"name":"confirmedAt","kind":"scalar","type":"DateTime"},{"name":"rejectedAt","kind":"scalar","type":"DateTime"},{"name":"checkedInAt","kind":"scalar","type":"DateTime"},{"name":"checkedInById","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"event","kind":"object","type":"Event","relationName":"EventToTicketOrder"},{"name":"items","kind":"object","type":"TicketOrderItem","relationName":"TicketOrderToTicketOrderItem"},{"name":"payment","kind":"object","type":"TicketPayment","relationName":"TicketOrderToTicketPayment"},{"name":"confirmedBy","kind":"object","type":"User","relationName":"TicketOrderConfirmer"},{"name":"checkedInBy","kind":"object","type":"User","relationName":"TicketOrderScanner"}],"dbName":null,"schema":null},"TicketOrderItem":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"orderId","kind":"scalar","type":"String"},{"name":"ticketTypeId","kind":"scalar","type":"String"},{"name":"quantity","kind":"scalar","type":"Int"},{"name":"unitPrice","kind":"scalar","type":"Decimal"},{"name":"subtotal","kind":"scalar","type":"Decimal"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"order","kind":"object","type":"TicketOrder","relationName":"TicketOrderToTicketOrderItem"},{"name":"ticketType","kind":"object","type":"TicketType","relationName":"TicketOrderItemToTicketType"}],"dbName":null,"schema":null},"TicketPayment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"orderId","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Decimal"},{"name":"method","kind":"enum","type":"TicketPaymentMethod"},{"name":"status","kind":"enum","type":"TicketPaymentStatus"},{"name":"proofUrl","kind":"scalar","type":"String"},{"name":"reference","kind":"scalar","type":"String"},{"name":"note","kind":"scalar","type":"String"},{"name":"reviewedById","kind":"scalar","type":"String"},{"name":"reviewedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"order","kind":"object","type":"TicketOrder","relationName":"TicketOrderToTicketPayment"},{"name":"reviewedBy","kind":"object","type":"User","relationName":"TicketPaymentReviewer"}],"dbName":null,"schema":null},"Tournament":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"weightClassId","kind":"scalar","type":"String"},{"name":"format","kind":"enum","type":"TournamentFormat"},{"name":"status","kind":"enum","type":"TournamentStatus"},{"name":"size","kind":"scalar","type":"Int"},{"name":"prize","kind":"scalar","type":"String"},{"name":"titleAwarded","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"posterId","kind":"scalar","type":"String"},{"name":"startDate","kind":"scalar","type":"DateTime"},{"name":"endDate","kind":"scalar","type":"DateTime"},{"name":"winnerId","kind":"scalar","type":"String"},{"name":"isPublished","kind":"scalar","type":"Boolean"},{"name":"isDemo","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"weightClass","kind":"object","type":"WeightClass","relationName":"TournamentToWeightClass"},{"name":"poster","kind":"object","type":"MediaAsset","relationName":"TournamentPoster"},{"name":"winner","kind":"object","type":"Fighter","relationName":"TournamentWinner"},{"name":"participants","kind":"object","type":"TournamentParticipant","relationName":"TournamentToTournamentParticipant"},{"name":"brackets","kind":"object","type":"TournamentBracket","relationName":"TournamentToTournamentBracket"}],"dbName":null,"schema":null},"TournamentParticipant":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tournamentId","kind":"scalar","type":"String"},{"name":"fighterId","kind":"scalar","type":"String"},{"name":"seed","kind":"scalar","type":"Int"},{"name":"status","kind":"enum","type":"TournamentParticipantStatus"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"tournament","kind":"object","type":"Tournament","relationName":"TournamentToTournamentParticipant"},{"name":"fighter","kind":"object","type":"Fighter","relationName":"FighterToTournamentParticipant"},{"name":"boutsAsA","kind":"object","type":"TournamentBout","relationName":"BoutParticipantA"},{"name":"boutsAsB","kind":"object","type":"TournamentBout","relationName":"BoutParticipantB"},{"name":"boutsWon","kind":"object","type":"TournamentBout","relationName":"BoutWinner"}],"dbName":null,"schema":null},"TournamentBracket":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tournamentId","kind":"scalar","type":"String"},{"name":"type","kind":"enum","type":"BracketType"},{"name":"name","kind":"scalar","type":"String"},{"name":"rounds","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"tournament","kind":"object","type":"Tournament","relationName":"TournamentToTournamentBracket"},{"name":"bouts","kind":"object","type":"TournamentBout","relationName":"TournamentBoutToTournamentBracket"}],"dbName":null,"schema":null},"TournamentBout":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"bracketId","kind":"scalar","type":"String"},{"name":"round","kind":"scalar","type":"Int"},{"name":"position","kind":"scalar","type":"Int"},{"name":"participantAId","kind":"scalar","type":"String"},{"name":"participantBId","kind":"scalar","type":"String"},{"name":"winnerParticipantId","kind":"scalar","type":"String"},{"name":"fightId","kind":"scalar","type":"String"},{"name":"nextBoutId","kind":"scalar","type":"String"},{"name":"nextSlot","kind":"enum","type":"BoutSlot"},{"name":"status","kind":"enum","type":"TournamentBoutStatus"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"bracket","kind":"object","type":"TournamentBracket","relationName":"TournamentBoutToTournamentBracket"},{"name":"participantA","kind":"object","type":"TournamentParticipant","relationName":"BoutParticipantA"},{"name":"participantB","kind":"object","type":"TournamentParticipant","relationName":"BoutParticipantB"},{"name":"winner","kind":"object","type":"TournamentParticipant","relationName":"BoutWinner"},{"name":"fight","kind":"object","type":"Fight","relationName":"FightToTournamentBout"},{"name":"nextBout","kind":"object","type":"TournamentBout","relationName":"BoutProgression"},{"name":"feederBouts","kind":"object","type":"TournamentBout","relationName":"BoutProgression"}],"dbName":null,"schema":null},"HeroSlide":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"eventTitle","kind":"scalar","type":"String"},{"name":"category","kind":"scalar","type":"String"},{"name":"headline","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"eventDate","kind":"scalar","type":"DateTime"},{"name":"backgroundId","kind":"scalar","type":"String"},{"name":"backgroundVideoId","kind":"scalar","type":"String"},{"name":"fighterImageId","kind":"scalar","type":"String"},{"name":"ctaPrimaryLabel","kind":"scalar","type":"String"},{"name":"ctaPrimaryHref","kind":"scalar","type":"String"},{"name":"ctaSecondaryLabel","kind":"scalar","type":"String"},{"name":"ctaSecondaryHref","kind":"scalar","type":"String"},{"name":"show3dBelt","kind":"scalar","type":"Boolean"},{"name":"overlay","kind":"enum","type":"HeroOverlay"},{"name":"sortOrder","kind":"scalar","type":"Int"},{"name":"isActive","kind":"scalar","type":"Boolean"},{"name":"publishAt","kind":"scalar","type":"DateTime"},{"name":"unpublishAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"background","kind":"object","type":"MediaAsset","relationName":"HeroBackground"},{"name":"backgroundVideo","kind":"object","type":"MediaAsset","relationName":"HeroVideo"},{"name":"fighterImage","kind":"object","type":"MediaAsset","relationName":"HeroFighter"}],"dbName":null,"schema":null},"Page":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"seoTitle","kind":"scalar","type":"String"},{"name":"seoDescription","kind":"scalar","type":"String"},{"name":"publishedRevisionId","kind":"scalar","type":"String"},{"name":"draftUpdatedAt","kind":"scalar","type":"DateTime"},{"name":"draftUpdatedById","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"sections","kind":"object","type":"PageSection","relationName":"PageToPageSection"},{"name":"revisions","kind":"object","type":"PageRevision","relationName":"PageRevisions"},{"name":"publishedRevision","kind":"object","type":"PageRevision","relationName":"PagePublished"}],"dbName":null,"schema":null},"PageSection":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"pageId","kind":"scalar","type":"String"},{"name":"type","kind":"enum","type":"PageSectionType"},{"name":"sortOrder","kind":"scalar","type":"Int"},{"name":"isEnabled","kind":"scalar","type":"Boolean"},{"name":"config","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"page","kind":"object","type":"Page","relationName":"PageToPageSection"}],"dbName":null,"schema":null},"PageRevision":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"pageId","kind":"scalar","type":"String"},{"name":"version","kind":"scalar","type":"Int"},{"name":"snapshot","kind":"scalar","type":"Json"},{"name":"note","kind":"scalar","type":"String"},{"name":"createdById","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"page","kind":"object","type":"Page","relationName":"PageRevisions"},{"name":"publishedPage","kind":"object","type":"Page","relationName":"PagePublished"}],"dbName":null,"schema":null},"MediaAsset":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"storageKey","kind":"scalar","type":"String"},{"name":"url","kind":"scalar","type":"String"},{"name":"kind","kind":"enum","type":"MediaKind"},{"name":"mimeType","kind":"scalar","type":"String"},{"name":"sizeBytes","kind":"scalar","type":"Int"},{"name":"width","kind":"scalar","type":"Int"},{"name":"height","kind":"scalar","type":"Int"},{"name":"originalName","kind":"scalar","type":"String"},{"name":"alt","kind":"scalar","type":"String"},{"name":"checksum","kind":"scalar","type":"String"},{"name":"uploadedById","kind":"scalar","type":"String"},{"name":"deletedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"uploadedBy","kind":"object","type":"User","relationName":"MediaAssetToUser"},{"name":"fighterPortraits","kind":"object","type":"Fighter","relationName":"FighterPortrait"},{"name":"beltImages","kind":"object","type":"ChampionshipBelt","relationName":"BeltImage"},{"name":"beltModels","kind":"object","type":"ChampionshipBelt","relationName":"BeltModel"},{"name":"eventPosters","kind":"object","type":"Event","relationName":"EventPoster"},{"name":"tournamentPosters","kind":"object","type":"Tournament","relationName":"TournamentPoster"},{"name":"heroBackgrounds","kind":"object","type":"HeroSlide","relationName":"HeroBackground"},{"name":"heroVideos","kind":"object","type":"HeroSlide","relationName":"HeroVideo"},{"name":"heroFighters","kind":"object","type":"HeroSlide","relationName":"HeroFighter"},{"name":"sponsorLogos","kind":"object","type":"Sponsor","relationName":"SponsorLogo"}],"dbName":null,"schema":null},"Sponsor":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"logoId","kind":"scalar","type":"String"},{"name":"url","kind":"scalar","type":"String"},{"name":"tier","kind":"scalar","type":"String"},{"name":"sortOrder","kind":"scalar","type":"Int"},{"name":"isActive","kind":"scalar","type":"Boolean"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"logo","kind":"object","type":"MediaAsset","relationName":"SponsorLogo"}],"dbName":null,"schema":null},"AuditLog":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"actorId","kind":"scalar","type":"String"},{"name":"action","kind":"scalar","type":"String"},{"name":"entityType","kind":"scalar","type":"String"},{"name":"entityId","kind":"scalar","type":"String"},{"name":"summary","kind":"scalar","type":"String"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"ipAddress","kind":"scalar","type":"String"},{"name":"userAgent","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"actor","kind":"object","type":"User","relationName":"AuditLogToUser"}],"dbName":null,"schema":null},"Notification":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"type","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"body","kind":"scalar","type":"String"},{"name":"link","kind":"scalar","type":"String"},{"name":"readAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"user","kind":"object","type":"User","relationName":"NotificationToUser"}],"dbName":null,"schema":null},"OrganizationSetting":{"fields":[{"name":"key","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"Json"},{"name":"updatedById","kind":"scalar","type":"String"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":null,"schema":null}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","orderBy","cursor","user","role","roles","_count","permission","permissions","users","requestedBy","reviewedBy","requests","assignedBy","rolesAssigned","sessions","actor","auditLogs","notifications","uploadedBy","fighters","poster","fights","event","items","order","payment","confirmedBy","checkedInBy","ticketType","ticketTypes","ticketOrders","weightClass","image","model","belt","fighter","wonFight","reign","fight","challenger","defenses","reigns","winner","results","method","result","approvals","wonResults","participants","tournament","boutsAsA","boutsAsB","boutsWon","brackets","bouts","bracket","participantA","participantB","nextBout","feederBouts","tournamentBout","reignsWon","defense","version","entries","changes","current","rankingVersions","belts","tournaments","portrait","fightParticipants","rankingEntries","currentRankings","rankingChanges","beltReigns","beltDefenses","tournamentEntries","tournamentsWon","fighterPortraits","beltImages","beltModels","eventPosters","tournamentPosters","background","backgroundVideo","fighterImage","heroBackgrounds","heroVideos","heroFighters","logo","sponsorLogos","media","roleRequests","roleRequested","roleReviewed","ticketOrdersConfirmed","ticketOrdersScanned","ticketPaymentsReviewed","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","data","User.createOne","User.createMany","User.updateOne","User.updateMany","create","update","User.upsertOne","User.deleteOne","User.deleteMany","having","_avg","_sum","_min","_max","User.groupBy","User.aggregate","Role.findUnique","Role.findUniqueOrThrow","Role.findFirst","Role.findFirstOrThrow","Role.findMany","Role.createOne","Role.createMany","Role.updateOne","Role.updateMany","Role.upsertOne","Role.deleteOne","Role.deleteMany","Role.groupBy","Role.aggregate","Permission.findUnique","Permission.findUniqueOrThrow","Permission.findFirst","Permission.findFirstOrThrow","Permission.findMany","Permission.createOne","Permission.createMany","Permission.updateOne","Permission.updateMany","Permission.upsertOne","Permission.deleteOne","Permission.deleteMany","Permission.groupBy","Permission.aggregate","UserRole.findUnique","UserRole.findUniqueOrThrow","UserRole.findFirst","UserRole.findFirstOrThrow","UserRole.findMany","UserRole.createOne","UserRole.createMany","UserRole.updateOne","UserRole.updateMany","UserRole.upsertOne","UserRole.deleteOne","UserRole.deleteMany","UserRole.groupBy","UserRole.aggregate","RolePermission.findUnique","RolePermission.findUniqueOrThrow","RolePermission.findFirst","RolePermission.findFirstOrThrow","RolePermission.findMany","RolePermission.createOne","RolePermission.createMany","RolePermission.updateOne","RolePermission.updateMany","RolePermission.upsertOne","RolePermission.deleteOne","RolePermission.deleteMany","RolePermission.groupBy","RolePermission.aggregate","RoleRequest.findUnique","RoleRequest.findUniqueOrThrow","RoleRequest.findFirst","RoleRequest.findFirstOrThrow","RoleRequest.findMany","RoleRequest.createOne","RoleRequest.createMany","RoleRequest.updateOne","RoleRequest.updateMany","RoleRequest.upsertOne","RoleRequest.deleteOne","RoleRequest.deleteMany","RoleRequest.groupBy","RoleRequest.aggregate","Session.findUnique","Session.findUniqueOrThrow","Session.findFirst","Session.findFirstOrThrow","Session.findMany","Session.createOne","Session.createMany","Session.updateOne","Session.updateMany","Session.upsertOne","Session.deleteOne","Session.deleteMany","Session.groupBy","Session.aggregate","LoginAttempt.findUnique","LoginAttempt.findUniqueOrThrow","LoginAttempt.findFirst","LoginAttempt.findFirstOrThrow","LoginAttempt.findMany","LoginAttempt.createOne","LoginAttempt.createMany","LoginAttempt.updateOne","LoginAttempt.updateMany","LoginAttempt.upsertOne","LoginAttempt.deleteOne","LoginAttempt.deleteMany","LoginAttempt.groupBy","LoginAttempt.aggregate","WeightClass.findUnique","WeightClass.findUniqueOrThrow","WeightClass.findFirst","WeightClass.findFirstOrThrow","WeightClass.findMany","WeightClass.createOne","WeightClass.createMany","WeightClass.updateOne","WeightClass.updateMany","WeightClass.upsertOne","WeightClass.deleteOne","WeightClass.deleteMany","WeightClass.groupBy","WeightClass.aggregate","Fighter.findUnique","Fighter.findUniqueOrThrow","Fighter.findFirst","Fighter.findFirstOrThrow","Fighter.findMany","Fighter.createOne","Fighter.createMany","Fighter.updateOne","Fighter.updateMany","Fighter.upsertOne","Fighter.deleteOne","Fighter.deleteMany","Fighter.groupBy","Fighter.aggregate","RankingVersion.findUnique","RankingVersion.findUniqueOrThrow","RankingVersion.findFirst","RankingVersion.findFirstOrThrow","RankingVersion.findMany","RankingVersion.createOne","RankingVersion.createMany","RankingVersion.updateOne","RankingVersion.updateMany","RankingVersion.upsertOne","RankingVersion.deleteOne","RankingVersion.deleteMany","RankingVersion.groupBy","RankingVersion.aggregate","RankingEntry.findUnique","RankingEntry.findUniqueOrThrow","RankingEntry.findFirst","RankingEntry.findFirstOrThrow","RankingEntry.findMany","RankingEntry.createOne","RankingEntry.createMany","RankingEntry.updateOne","RankingEntry.updateMany","RankingEntry.upsertOne","RankingEntry.deleteOne","RankingEntry.deleteMany","RankingEntry.groupBy","RankingEntry.aggregate","FighterRanking.findUnique","FighterRanking.findUniqueOrThrow","FighterRanking.findFirst","FighterRanking.findFirstOrThrow","FighterRanking.findMany","FighterRanking.createOne","FighterRanking.createMany","FighterRanking.updateOne","FighterRanking.updateMany","FighterRanking.upsertOne","FighterRanking.deleteOne","FighterRanking.deleteMany","FighterRanking.groupBy","FighterRanking.aggregate","RankingChangeLog.findUnique","RankingChangeLog.findUniqueOrThrow","RankingChangeLog.findFirst","RankingChangeLog.findFirstOrThrow","RankingChangeLog.findMany","RankingChangeLog.createOne","RankingChangeLog.createMany","RankingChangeLog.updateOne","RankingChangeLog.updateMany","RankingChangeLog.upsertOne","RankingChangeLog.deleteOne","RankingChangeLog.deleteMany","RankingChangeLog.groupBy","RankingChangeLog.aggregate","ChampionshipBelt.findUnique","ChampionshipBelt.findUniqueOrThrow","ChampionshipBelt.findFirst","ChampionshipBelt.findFirstOrThrow","ChampionshipBelt.findMany","ChampionshipBelt.createOne","ChampionshipBelt.createMany","ChampionshipBelt.updateOne","ChampionshipBelt.updateMany","ChampionshipBelt.upsertOne","ChampionshipBelt.deleteOne","ChampionshipBelt.deleteMany","ChampionshipBelt.groupBy","ChampionshipBelt.aggregate","BeltReign.findUnique","BeltReign.findUniqueOrThrow","BeltReign.findFirst","BeltReign.findFirstOrThrow","BeltReign.findMany","BeltReign.createOne","BeltReign.createMany","BeltReign.updateOne","BeltReign.updateMany","BeltReign.upsertOne","BeltReign.deleteOne","BeltReign.deleteMany","BeltReign.groupBy","BeltReign.aggregate","BeltDefense.findUnique","BeltDefense.findUniqueOrThrow","BeltDefense.findFirst","BeltDefense.findFirstOrThrow","BeltDefense.findMany","BeltDefense.createOne","BeltDefense.createMany","BeltDefense.updateOne","BeltDefense.updateMany","BeltDefense.upsertOne","BeltDefense.deleteOne","BeltDefense.deleteMany","BeltDefense.groupBy","BeltDefense.aggregate","Event.findUnique","Event.findUniqueOrThrow","Event.findFirst","Event.findFirstOrThrow","Event.findMany","Event.createOne","Event.createMany","Event.updateOne","Event.updateMany","Event.upsertOne","Event.deleteOne","Event.deleteMany","Event.groupBy","Event.aggregate","FightMethod.findUnique","FightMethod.findUniqueOrThrow","FightMethod.findFirst","FightMethod.findFirstOrThrow","FightMethod.findMany","FightMethod.createOne","FightMethod.createMany","FightMethod.updateOne","FightMethod.updateMany","FightMethod.upsertOne","FightMethod.deleteOne","FightMethod.deleteMany","FightMethod.groupBy","FightMethod.aggregate","Fight.findUnique","Fight.findUniqueOrThrow","Fight.findFirst","Fight.findFirstOrThrow","Fight.findMany","Fight.createOne","Fight.createMany","Fight.updateOne","Fight.updateMany","Fight.upsertOne","Fight.deleteOne","Fight.deleteMany","Fight.groupBy","Fight.aggregate","FightParticipant.findUnique","FightParticipant.findUniqueOrThrow","FightParticipant.findFirst","FightParticipant.findFirstOrThrow","FightParticipant.findMany","FightParticipant.createOne","FightParticipant.createMany","FightParticipant.updateOne","FightParticipant.updateMany","FightParticipant.upsertOne","FightParticipant.deleteOne","FightParticipant.deleteMany","FightParticipant.groupBy","FightParticipant.aggregate","FightResult.findUnique","FightResult.findUniqueOrThrow","FightResult.findFirst","FightResult.findFirstOrThrow","FightResult.findMany","FightResult.createOne","FightResult.createMany","FightResult.updateOne","FightResult.updateMany","FightResult.upsertOne","FightResult.deleteOne","FightResult.deleteMany","FightResult.groupBy","FightResult.aggregate","FightResultApproval.findUnique","FightResultApproval.findUniqueOrThrow","FightResultApproval.findFirst","FightResultApproval.findFirstOrThrow","FightResultApproval.findMany","FightResultApproval.createOne","FightResultApproval.createMany","FightResultApproval.updateOne","FightResultApproval.updateMany","FightResultApproval.upsertOne","FightResultApproval.deleteOne","FightResultApproval.deleteMany","FightResultApproval.groupBy","FightResultApproval.aggregate","TicketType.findUnique","TicketType.findUniqueOrThrow","TicketType.findFirst","TicketType.findFirstOrThrow","TicketType.findMany","TicketType.createOne","TicketType.createMany","TicketType.updateOne","TicketType.updateMany","TicketType.upsertOne","TicketType.deleteOne","TicketType.deleteMany","TicketType.groupBy","TicketType.aggregate","TicketOrder.findUnique","TicketOrder.findUniqueOrThrow","TicketOrder.findFirst","TicketOrder.findFirstOrThrow","TicketOrder.findMany","TicketOrder.createOne","TicketOrder.createMany","TicketOrder.updateOne","TicketOrder.updateMany","TicketOrder.upsertOne","TicketOrder.deleteOne","TicketOrder.deleteMany","TicketOrder.groupBy","TicketOrder.aggregate","TicketOrderItem.findUnique","TicketOrderItem.findUniqueOrThrow","TicketOrderItem.findFirst","TicketOrderItem.findFirstOrThrow","TicketOrderItem.findMany","TicketOrderItem.createOne","TicketOrderItem.createMany","TicketOrderItem.updateOne","TicketOrderItem.updateMany","TicketOrderItem.upsertOne","TicketOrderItem.deleteOne","TicketOrderItem.deleteMany","TicketOrderItem.groupBy","TicketOrderItem.aggregate","TicketPayment.findUnique","TicketPayment.findUniqueOrThrow","TicketPayment.findFirst","TicketPayment.findFirstOrThrow","TicketPayment.findMany","TicketPayment.createOne","TicketPayment.createMany","TicketPayment.updateOne","TicketPayment.updateMany","TicketPayment.upsertOne","TicketPayment.deleteOne","TicketPayment.deleteMany","TicketPayment.groupBy","TicketPayment.aggregate","Tournament.findUnique","Tournament.findUniqueOrThrow","Tournament.findFirst","Tournament.findFirstOrThrow","Tournament.findMany","Tournament.createOne","Tournament.createMany","Tournament.updateOne","Tournament.updateMany","Tournament.upsertOne","Tournament.deleteOne","Tournament.deleteMany","Tournament.groupBy","Tournament.aggregate","TournamentParticipant.findUnique","TournamentParticipant.findUniqueOrThrow","TournamentParticipant.findFirst","TournamentParticipant.findFirstOrThrow","TournamentParticipant.findMany","TournamentParticipant.createOne","TournamentParticipant.createMany","TournamentParticipant.updateOne","TournamentParticipant.updateMany","TournamentParticipant.upsertOne","TournamentParticipant.deleteOne","TournamentParticipant.deleteMany","TournamentParticipant.groupBy","TournamentParticipant.aggregate","TournamentBracket.findUnique","TournamentBracket.findUniqueOrThrow","TournamentBracket.findFirst","TournamentBracket.findFirstOrThrow","TournamentBracket.findMany","TournamentBracket.createOne","TournamentBracket.createMany","TournamentBracket.updateOne","TournamentBracket.updateMany","TournamentBracket.upsertOne","TournamentBracket.deleteOne","TournamentBracket.deleteMany","TournamentBracket.groupBy","TournamentBracket.aggregate","TournamentBout.findUnique","TournamentBout.findUniqueOrThrow","TournamentBout.findFirst","TournamentBout.findFirstOrThrow","TournamentBout.findMany","TournamentBout.createOne","TournamentBout.createMany","TournamentBout.updateOne","TournamentBout.updateMany","TournamentBout.upsertOne","TournamentBout.deleteOne","TournamentBout.deleteMany","TournamentBout.groupBy","TournamentBout.aggregate","HeroSlide.findUnique","HeroSlide.findUniqueOrThrow","HeroSlide.findFirst","HeroSlide.findFirstOrThrow","HeroSlide.findMany","HeroSlide.createOne","HeroSlide.createMany","HeroSlide.updateOne","HeroSlide.updateMany","HeroSlide.upsertOne","HeroSlide.deleteOne","HeroSlide.deleteMany","HeroSlide.groupBy","HeroSlide.aggregate","page","sections","publishedPage","revisions","publishedRevision","Page.findUnique","Page.findUniqueOrThrow","Page.findFirst","Page.findFirstOrThrow","Page.findMany","Page.createOne","Page.createMany","Page.updateOne","Page.updateMany","Page.upsertOne","Page.deleteOne","Page.deleteMany","Page.groupBy","Page.aggregate","PageSection.findUnique","PageSection.findUniqueOrThrow","PageSection.findFirst","PageSection.findFirstOrThrow","PageSection.findMany","PageSection.createOne","PageSection.createMany","PageSection.updateOne","PageSection.updateMany","PageSection.upsertOne","PageSection.deleteOne","PageSection.deleteMany","PageSection.groupBy","PageSection.aggregate","PageRevision.findUnique","PageRevision.findUniqueOrThrow","PageRevision.findFirst","PageRevision.findFirstOrThrow","PageRevision.findMany","PageRevision.createOne","PageRevision.createMany","PageRevision.updateOne","PageRevision.updateMany","PageRevision.upsertOne","PageRevision.deleteOne","PageRevision.deleteMany","PageRevision.groupBy","PageRevision.aggregate","MediaAsset.findUnique","MediaAsset.findUniqueOrThrow","MediaAsset.findFirst","MediaAsset.findFirstOrThrow","MediaAsset.findMany","MediaAsset.createOne","MediaAsset.createMany","MediaAsset.updateOne","MediaAsset.updateMany","MediaAsset.upsertOne","MediaAsset.deleteOne","MediaAsset.deleteMany","MediaAsset.groupBy","MediaAsset.aggregate","Sponsor.findUnique","Sponsor.findUniqueOrThrow","Sponsor.findFirst","Sponsor.findFirstOrThrow","Sponsor.findMany","Sponsor.createOne","Sponsor.createMany","Sponsor.updateOne","Sponsor.updateMany","Sponsor.upsertOne","Sponsor.deleteOne","Sponsor.deleteMany","Sponsor.groupBy","Sponsor.aggregate","AuditLog.findUnique","AuditLog.findUniqueOrThrow","AuditLog.findFirst","AuditLog.findFirstOrThrow","AuditLog.findMany","AuditLog.createOne","AuditLog.createMany","AuditLog.updateOne","AuditLog.updateMany","AuditLog.upsertOne","AuditLog.deleteOne","AuditLog.deleteMany","AuditLog.groupBy","AuditLog.aggregate","Notification.findUnique","Notification.findUniqueOrThrow","Notification.findFirst","Notification.findFirstOrThrow","Notification.findMany","Notification.createOne","Notification.createMany","Notification.updateOne","Notification.updateMany","Notification.upsertOne","Notification.deleteOne","Notification.deleteMany","Notification.groupBy","Notification.aggregate","OrganizationSetting.findUnique","OrganizationSetting.findUniqueOrThrow","OrganizationSetting.findFirst","OrganizationSetting.findFirstOrThrow","OrganizationSetting.findMany","OrganizationSetting.createOne","OrganizationSetting.createMany","OrganizationSetting.updateOne","OrganizationSetting.updateMany","OrganizationSetting.upsertOne","OrganizationSetting.deleteOne","OrganizationSetting.deleteMany","OrganizationSetting.groupBy","OrganizationSetting.aggregate","AND","OR","NOT","key","value","updatedById","updatedAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","search","string_contains","string_starts_with","string_ends_with","array_starts_with","array_ends_with","array_contains","id","userId","type","title","body","link","readAt","createdAt","actorId","action","entityType","entityId","summary","metadata","ipAddress","userAgent","name","logoId","url","tier","sortOrder","isActive","storageKey","MediaKind","kind","mimeType","sizeBytes","width","height","originalName","alt","checksum","uploadedById","deletedAt","pageId","snapshot","note","createdById","PageSectionType","isEnabled","config","slug","seoTitle","seoDescription","publishedRevisionId","draftUpdatedAt","draftUpdatedById","every","some","none","pageId_version","eventTitle","category","headline","description","eventDate","backgroundId","backgroundVideoId","fighterImageId","ctaPrimaryLabel","ctaPrimaryHref","ctaSecondaryLabel","ctaSecondaryHref","show3dBelt","HeroOverlay","overlay","publishAt","unpublishAt","bracketId","round","position","participantAId","participantBId","winnerParticipantId","fightId","nextBoutId","BoutSlot","nextSlot","TournamentBoutStatus","status","tournamentId","BracketType","rounds","fighterId","seed","TournamentParticipantStatus","weightClassId","TournamentFormat","format","TournamentStatus","size","prize","titleAwarded","posterId","startDate","endDate","winnerId","isPublished","isDemo","orderId","amount","TicketPaymentMethod","TicketPaymentStatus","proofUrl","reference","reviewedById","reviewedAt","ticketTypeId","quantity","unitPrice","subtotal","orderNumber","eventId","customerName","customerEmail","customerPhone","totalAmount","TicketOrderStatus","paymentMethod","paymentStatus","customerNote","adminNote","rejectionReason","guestTokenHash","confirmedById","confirmedAt","rejectedAt","checkedInAt","checkedInById","code","price","quota","sold","resultId","ApprovalAction","comment","FightOutcome","outcome","methodId","endRound","endTime","scorecards","referee","sourceUrl","verificationNote","FightResultStatus","enteredById","verifiedById","verifiedAt","approvedById","approvedAt","Corner","corner","weighInKg","scheduledAt","scheduledRounds","boutOrder","isMainEvent","isTitleFight","beltId","FightStatus","notes","isStoppage","venue","city","country","startsAt","timezone","EventStatus","reignId","challengerId","defendedAt","BeltReignStatus","activeKey","wonAt","wonFightId","endedAt","BeltReignEndReason","endReason","proposedById","rejectedById","BeltStatus","imageId","modelId","nextDefenseAt","nextDefenseNote","versionId","RankingChangeAction","fromRank","toRank","reason","scopeKey","rank","isChampion","points","previousRank","movement","isNew","RankingType","Gender","gender","versionNumber","RankingVersionStatus","effectiveDate","submittedById","submittedAt","publishedAt","firstName","lastName","ringName","nationality","hometown","dateOfBirth","showDateOfBirth","heightCm","reachCm","Stance","stance","FighterStatus","bio","achievements","portraitId","debutDate","baseWins","baseLosses","baseDraws","baseNoContests","baseKoWins","wins","losses","draws","noContests","koWins","contactEmail","contactPhone","privateNotes","limitLbs","limitKg","gender_name","email","success","tokenHash","mfaVerified","lastSeenAt","expiresAt","revokedAt","roleId","RoleRequestAction","RequestStatus","reviewNote","requestedById","permissionId","assignedById","isSystem","requiresMfa","isSensitive","username","passwordHash","mfaEnabled","mfaSecretEnc","failedLoginCount","lockedUntil","lastLoginAt","passwordChangedAt","fighterId_scopeKey","versionId_fighterId","versionId_rank","scopeKey_versionNumber","tournamentId_type","bracketId_round_position","tournamentId_fighterId","tournamentId_seed","fightId_corner","fightId_fighterId","orderId_ticketTypeId","eventId_code","roleId_permissionId","userId_roleId","is","isNot","_relevance","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","increment","decrement","multiply","divide"]'),
  graph: "gxi4ArAEHQUAAP0JACAOAAD9CQAgDwAA8QoAIBEAAPIKACASAADzCgAgXQAA9AoAIF4AAP4JACBfAAD-CQAgYAAA_gkAIGEAAI0KACBiAACNCgAgYwAA9QoAIKEFAADwCgAwogUAABIAEKMFAADwCgAwpwVAAM0IACG6BQEAAAABwQVAAM0IACHKBQEAyggAIc8FIAD0CAAhqQcBAAAAAboHAQAAAAG7BwEAyggAIbwHIAD0CAAhvQcBAMwIACG-BwIA7wgAIb8HQACDCgAhwAdAAIMKACHBB0AAzQgAIQEAAAABACAKAwAA7QoAIAQAAPkKACANAACFCgAgoQUAAP4KADCiBQAAAwAQowUAAP4KADC7BQEAyggAIcEFQADNCAAhsAcBAMoIACG2BwEAzAgAIQUDAACvFAAgBAAA7BQAIA0AAK8UACC2BwAA_woAINIHAADwFAAgCwMAAO0KACAEAAD5CgAgDQAAhQoAIKEFAAD-CgAwogUAAAMAEKMFAAD-CgAwuwUBAMoIACHBBUAAzQgAIbAHAQDKCAAhtgcBAMwIACHPBwAA_QoAIAMAAAADACABAAAEADACAAAFACAIBAAA-QoAIAcAAPwKACChBQAA-woAMKIFAAAHABCjBQAA-woAMMEFQADNCAAhsAcBAMoIACG1BwEAyggAIQMEAADsFAAgBwAA7hQAINIHAADvFAAgCQQAAPkKACAHAAD8CgAgoQUAAPsKADCiBQAABwAQowUAAPsKADDBBUAAzQgAIbAHAQDKCAAhtQcBAMoIACHOBwAA-goAIAMAAAAHACABAAAIADACAAAJACADAAAABwAgAQAACAAwAgAACQAgAQAAAAcAIAMAAAADACABAAAEADACAAAFACATAwAA7QoAIAQAAPkKACAKAADtCgAgCwAAhQoAIKEFAAD2CgAwogUAAA4AEKMFAAD2CgAwpwVAAM0IACG6BQEAyggAIbsFAQDKCAAhwQVAAM0IACHDBQAA9wqyByKJBgAA-AqzByKjBgEAzAgAIaQGQACDCgAh-AYBAMoIACGwBwEAyggAIbMHAQDMCAAhtAcBAMoIACEIAwAArxQAIAQAAOwUACAKAACvFAAgCwAArxQAIKMGAAD_CgAgpAYAAP8KACCzBwAA_woAINIHAADtFAAgEwMAAO0KACAEAAD5CgAgCgAA7QoAIAsAAIUKACChBQAA9goAMKIFAAAOABCjBQAA9goAMKcFQADNCAAhugUBAAAAAbsFAQDKCAAhwQVAAM0IACHDBQAA9wqyByKJBgAA-AqzByKjBgEAzAgAIaQGQACDCgAh-AYBAMoIACGwBwEAyggAIbMHAQDMCAAhtAcBAMoIACEDAAAADgAgAQAADwAwAgAAEAAgHQUAAP0JACAOAAD9CQAgDwAA8QoAIBEAAPIKACASAADzCgAgXQAA9AoAIF4AAP4JACBfAAD-CQAgYAAA_gkAIGEAAI0KACBiAACNCgAgYwAA9QoAIKEFAADwCgAwogUAABIAEKMFAADwCgAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAhygUBAMoIACHPBSAA9AgAIakHAQDKCAAhugcBAMoIACG7BwEAyggAIbwHIAD0CAAhvQcBAMwIACG-BwIA7wgAIb8HQACDCgAhwAdAAIMKACHBB0AAzQgAIQEAAAASACABAAAABwAgAQAAAAMAIAEAAAAOACABAAAAEgAgAwAAAAMAIAEAAAQAMAIAAAUAIA4DAADtCgAgoQUAAO8KADCiBQAAGQAQowUAAO8KADC6BQEAyggAIbsFAQDKCAAhwQVAAM0IACHIBQEAzAgAIckFAQDMCAAhqwcBAMoIACGsByAA9AgAIa0HQADNCAAhrgdAAM0IACGvB0AAgwoAIQUDAACvFAAgyAUAAP8KACDJBQAA_woAIK8HAAD_CgAg0gcAAOsUACAOAwAA7QoAIKEFAADvCgAwogUAABkAEKMFAADvCgAwugUBAAAAAbsFAQDKCAAhwQVAAM0IACHIBQEAzAgAIckFAQDMCAAhqwcBAAAAAawHIAD0CAAhrQdAAM0IACGuB0AAzQgAIa8HQACDCgAhAwAAABkAIAEAABoAMAIAABsAIA4QAACFCgAgoQUAAO4KADCiBQAAHQAQowUAAO4KADC6BQEAyggAIcEFQADNCAAhwgUBAMwIACHDBQEAyggAIcQFAQDKCAAhxQUBAMwIACHGBQEAyggAIccFAADCCgAgyAUBAMwIACHJBQEAzAgAIQcQAACvFAAgwgUAAP8KACDFBQAA_woAIMcFAAD_CgAgyAUAAP8KACDJBQAA_woAINIHAADqFAAgDhAAAIUKACChBQAA7goAMKIFAAAdABCjBQAA7goAMLoFAQAAAAHBBUAAzQgAIcIFAQDMCAAhwwUBAMoIACHEBQEAyggAIcUFAQDMCAAhxgUBAMoIACHHBQAAwgoAIMgFAQDMCAAhyQUBAMwIACEDAAAAHQAgAQAAHgAwAgAAHwAgAQAAABIAIAwDAADtCgAgoQUAAOwKADCiBQAAIgAQowUAAOwKADC6BQEAyggAIbsFAQDKCAAhvAUBAMoIACG9BQEAyggAIb4FAQDMCAAhvwUBAMwIACHABUAAgwoAIcEFQADNCAAhBQMAAK8UACC-BQAA_woAIL8FAAD_CgAgwAUAAP8KACDSBwAA6RQAIAwDAADtCgAgoQUAAOwKADCiBQAAIgAQowUAAOwKADC6BQEAAAABuwUBAMoIACG8BQEAyggAIb0FAQDKCAAhvgUBAMwIACG_BQEAzAgAIcAFQACDCgAhwQVAAM0IACEDAAAAIgAgAQAAIwAwAgAAJAAgHBMAAIUKACBQAADnCQAgUQAA6gkAIFIAAOoJACBTAADpCgAgVAAA6wkAIFgAAOoKACBZAADqCgAgWgAA6goAIFwAAOsKACChBQAA5woAMKIFAAAmABCjBQAA5woAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIcwFAQDKCAAh0AUBAMoIACHSBQAA6ArSBSLTBQEAyggAIdQFAgDvCAAh1QUCAJoKACHWBQIAmgoAIdcFAQDKCAAh2AUBAMwIACHZBQEAyggAIdoFAQDMCAAh2wVAAIMKACEQEwAArxQAIFAAAKMSACBRAACmEgAgUgAAphIAIFMAAOUUACBUAACnEgAgWAAA5hQAIFkAAOYUACBaAADmFAAgXAAA5xQAINUFAAD_CgAg1gUAAP8KACDYBQAA_woAINoFAAD_CgAg2wUAAP8KACDSBwAA6BQAIBwTAACFCgAgUAAA5wkAIFEAAOoJACBSAADqCQAgUwAA6QoAIFQAAOsJACBYAADqCgAgWQAA6goAIFoAAOoKACBcAADrCgAgoQUAAOcKADCiBQAAJgAQowUAAOcKADCnBUAAzQgAIboFAQAAAAHBBUAAzQgAIcwFAQDKCAAh0AUBAAAAAdIFAADoCtIFItMFAQDKCAAh1AUCAO8IACHVBQIAmgoAIdYFAgCaCgAh1wUBAMoIACHYBQEAzAgAIdkFAQDKCAAh2gUBAMwIACHbBUAAgwoAIQMAAAAmACABAAAnADACAAAoACABAAAAEgAgMSAAAJEKACBHAACHCgAgSAAA4QoAIEkAAKkKACBKAACrCgAgSwAAqgoAIEwAAJcKACBNAADSCgAgTgAAkwoAIE8AAOsJACChBQAA5AoAMKIFAAArABCjBQAA5AoAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIdsFQACDCgAh4wUBAMoIACGJBgAA5gqVByKQBgEAyggAIZwGIAD0CAAhggcAAOUJggciiQcBAMoIACGKBwEAyggAIYsHAQDMCAAhjAcBAMoIACGNBwEAzAgAIY4HQACDCgAhjwcgAPQIACGQBwIAmgoAIZEHAgCaCgAhkwcAAOUKkwcilQcBAMwIACGWBwAAwgoAIJcHAQDMCAAhmAdAAIMKACGZBwIA7wgAIZoHAgDvCAAhmwcCAO8IACGcBwIA7wgAIZ0HAgDvCAAhngcCAO8IACGfBwIA7wgAIaAHAgDvCAAhoQcCAO8IACGiBwIA7wgAIaMHAQDMCAAhpAcBAMwIACGlBwEAzAgAIRggAAC2FAAgRwAAsRQAIEgAAOEUACBJAADBFAAgSgAAwxQAIEsAAMIUACBMAAC7FAAgTQAA2BQAIE4AALgUACBPAACnEgAg2wUAAP8KACCLBwAA_woAII0HAAD_CgAgjgcAAP8KACCQBwAA_woAIJEHAAD_CgAglQcAAP8KACCWBwAA_woAIJcHAAD_CgAgmAcAAP8KACCjBwAA_woAIKQHAAD_CgAgpQcAAP8KACDSBwAA5BQAIDEgAACRCgAgRwAAhwoAIEgAAOEKACBJAACpCgAgSgAAqwoAIEsAAKoKACBMAACXCgAgTQAA0goAIE4AAJMKACBPAADrCQAgoQUAAOQKADCiBQAAKwAQowUAAOQKADCnBUAAzQgAIboFAQAAAAHBBUAAzQgAIdsFQACDCgAh4wUBAAAAAYkGAADmCpUHIpAGAQDKCAAhnAYgAPQIACGCBwAA5QmCByKJBwEAyggAIYoHAQDKCAAhiwcBAMwIACGMBwEAyggAIY0HAQDMCAAhjgdAAIMKACGPByAA9AgAIZAHAgCaCgAhkQcCAJoKACGTBwAA5QqTByKVBwEAzAgAIZYHAADCCgAglwcBAMwIACGYB0AAgwoAIZkHAgDvCAAhmgcCAO8IACGbBwIA7wgAIZwHAgDvCAAhnQcCAO8IACGeBwIA7wgAIZ8HAgDvCAAhoAcCAO8IACGhBwIA7wgAIaIHAgDvCAAhowcBAMwIACGkBwEAzAgAIaUHAQDMCAAhAwAAACsAIAEAACwAMAIAAC0AIAMAAAArACABAAAsADACAAAtACAYFwAA3woAICAAAJEKACAjAADgCgAgLgAA4goAIDEAAOEKACA9AAC4CgAgPgAAlwoAID8AAOMKACChBQAA3QoAMKIFAAAwABCjBQAA3QoAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIYkGAADeCtsGIpAGAQDKCAAhqgYBAMwIACHUBkAAzQgAIdUGAgDvCAAh1gYCAO8IACHXBiAA9AgAIdgGIAD0CAAh2QYBAMwIACHbBgEAzAgAIQwXAADaFAAgIAAAthQAICMAANcUACAuAADOFAAgMQAA4RQAID0AAMsUACA-AAC7FAAgPwAA4hQAIKoGAAD_CgAg2QYAAP8KACDbBgAA_woAINIHAADjFAAgGBcAAN8KACAgAACRCgAgIwAA4AoAIC4AAOIKACAxAADhCgAgPQAAuAoAID4AAJcKACA_AADjCgAgoQUAAN0KADCiBQAAMAAQowUAAN0KADCnBUAAzQgAIboFAQAAAAHBBUAAzQgAIYkGAADeCtsGIpAGAQDKCAAhqgYBAMwIACHUBkAAzQgAIdUGAgDvCAAh1gYCAO8IACHXBiAA9AgAIdgGIAD0CAAh2QYBAMwIACHbBgEAzAgAIQMAAAAwACABAAAxADACAAAyACAWFQAAhwoAIBYAAOgJACAeAACMCgAgHwAAjQoAIKEFAACKCgAwogUAADQAEKMFAACKCgAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAhygUBAMoIACHjBQEAyggAIfAFAQDMCAAhiQYAAIsK4wYilwYBAMwIACGbBiAA9AgAIZwGIAD0CAAh3QYBAMwIACHeBgEAzAgAId8GAQDMCAAh4AZAAM0IACHhBgEAyggAIQEAAAA0ACABAAAAJgAgAwAAADAAIAEAADEAMAIAADIAIBAXAADVCgAgGAAA1goAIKEFAADcCgAwogUAADgAEKMFAADcCgAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAhygUBAMoIACHPBSAA9AgAIfAFAQDMCAAhqgYBAMoIACG7BgEAyggAIbwGEADmCQAhvQYCAO8IACG-BgIA7wgAIQQXAADaFAAgGAAA2xQAIPAFAAD_CgAg0gcAAOAUACARFwAA1QoAIBgAANYKACChBQAA3AoAMKIFAAA4ABCjBQAA3AoAMKcFQADNCAAhugUBAAAAAcEFQADNCAAhygUBAMoIACHPBSAA9AgAIfAFAQDMCAAhqgYBAMoIACG7BgEAyggAIbwGEADmCQAhvQYCAO8IACG-BgIA7wgAIc0HAADbCgAgAwAAADgAIAEAADkAMAIAADoAIAwZAACECgAgHQAA2goAIKEFAADZCgAwogUAADwAEKMFAADZCgAwugUBAMoIACHBBUAAzQgAIZ0GAQDKCAAhpQYBAMoIACGmBgIA7wgAIacGEADmCQAhqAYQAOYJACEDGQAArhQAIB0AAN4UACDSBwAA3xQAIA0ZAACECgAgHQAA2goAIKEFAADZCgAwogUAADwAEKMFAADZCgAwugUBAAAAAcEFQADNCAAhnQYBAMoIACGlBgEAyggAIaYGAgDvCAAhpwYQAOYJACGoBhAA5gkAIcwHAADYCgAgAwAAADwAIAEAAD0AMAIAAD4AIAMAAAA8ACABAAA9ADACAAA-ACARCwAAhQoAIBkAAIQKACAtAACBCqAGIqEFAACACgAwogUAAEEAEKMFAACACgAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAh3gUBAMwIACGJBgAAggqhBiKdBgEAyggAIZ4GEADmCQAhoQYBAMwIACGiBgEAzAgAIaMGAQDMCAAhpAZAAIMKACEBAAAAQQAgAQAAABIAIAEAAAASACABAAAAEgAgAQAAADwAIAEAAAA8ACAdFwAA1QoAIBgAANYKACAaAADXCgAgGwAAhQoAIBwAAIUKACChBQAA0woAMKIFAABIABCjBQAA0woAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIYkGAADUCrAGIqkGAQDKCAAhqgYBAMoIACGrBgEAyggAIawGAQDKCAAhrQYBAMoIACGuBhAA5gkAIbAGAACBCqAGIrEGAACCCqEGIrIGAQDMCAAhswYBAMwIACG0BgEAzAgAIbUGAQDMCAAhtgYBAMwIACG3BkAAgwoAIbgGQACDCgAhuQZAAIMKACG6BgEAzAgAIQ8XAADaFAAgGAAA2xQAIBoAANwUACAbAACvFAAgHAAArxQAILIGAAD_CgAgswYAAP8KACC0BgAA_woAILUGAAD_CgAgtgYAAP8KACC3BgAA_woAILgGAAD_CgAguQYAAP8KACC6BgAA_woAINIHAADdFAAgHRcAANUKACAYAADWCgAgGgAA1woAIBsAAIUKACAcAACFCgAgoQUAANMKADCiBQAASAAQowUAANMKADCnBUAAzQgAIboFAQAAAAHBBUAAzQgAIYkGAADUCrAGIqkGAQAAAAGqBgEAyggAIasGAQDKCAAhrAYBAMoIACGtBgEAyggAIa4GEADmCQAhsAYAAIEKoAYisQYAAIIKoQYisgYBAMwIACGzBgEAzAgAIbQGAQDMCAAhtQYBAAAAAbYGAQDMCAAhtwZAAIMKACG4BkAAgwoAIbkGQACDCgAhugYBAMwIACEDAAAASAAgAQAASQAwAgAASgAgAQAAADAAIAEAAAA4ACABAAAASAAgFhYAAOgJACAgAACRCgAgIQAAhwoAICIAAIcKACAqAACXCgAgoQUAAJUKADCiBQAATwAQowUAAJUKADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACHKBQEAyggAIc4FAgDvCAAh4wUBAMoIACHwBQEAzAgAIYkGAACWCvAGIpAGAQDKCAAhnAYgAPQIACHwBgEAzAgAIfEGAQDMCAAh8gZAAIMKACHzBgEAzAgAIQEAAABPACABAAAAJgAgAQAAACYAIBgjAADRCgAgJAAAmwoAICUAALcKACApAADSCgAgoQUAAM4KADCiBQAAUwAQowUAAM4KADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACGJBgAAzwrnBiKNBgEAyggAIbQGAQDMCAAhzwYBAMwIACHQBkAAgwoAIdkGAQDKCAAh2wYBAMwIACHnBgEAzAgAIegGQADNCAAh6QYBAMwIACHqBkAAgwoAIewGAADQCuwGI-0GAQDMCAAh7gYBAMwIACEPIwAA1xQAICQAALcUACAlAADKFAAgKQAA2BQAILQGAAD_CgAgzwYAAP8KACDQBgAA_woAINsGAAD_CgAg5wYAAP8KACDpBgAA_woAIOoGAAD_CgAg7AYAAP8KACDtBgAA_woAIO4GAAD_CgAg0gcAANkUACAYIwAA0QoAICQAAJsKACAlAAC3CgAgKQAA0goAIKEFAADOCgAwogUAAFMAEKMFAADOCgAwpwVAAM0IACG6BQEAAAABwQVAAM0IACGJBgAAzwrnBiKNBgEAyggAIbQGAQDMCAAhzwYBAMwIACHQBkAAgwoAIdkGAQDKCAAh2wYBAMwIACHnBgEAAAAB6AZAAM0IACHpBgEAzAgAIeoGQACDCgAh7AYAANAK7AYj7QYBAMwIACHuBgEAzAgAIQMAAABTACABAABUADACAABVACABAAAAMAAgDSYAAM0KACAnAAC3CgAgKAAAkgoAIKEFAADMCgAwogUAAFgAEKMFAADMCgAwugUBAMoIACHBBUAAzQgAIYQGAQDMCAAh2wYBAMwIACHjBgEAyggAIeQGAQDMCAAh5QZAAM0IACEHJgAA1RQAICcAAMoUACAoAAC3FAAghAYAAP8KACDbBgAA_woAIOQGAAD_CgAg0gcAANYUACANJgAAzQoAICcAALcKACAoAACSCgAgoQUAAMwKADCiBQAAWAAQowUAAMwKADC6BQEAAAABwQVAAM0IACGEBgEAAAAB2wYBAMwIACHjBgEAyggAIeQGAQDMCAAh5QZAAM0IACEDAAAAWAAgAQAAWQAwAgAAWgAgAQAAADAAIAEAAAArACABAAAAWAAgAwAAADAAIAEAADEAMAIAADIAIAEAAABTACABAAAAMAAgDCQAAJsKACAnAADECgAgMAAAtwkAIKEFAADKCgAwogUAAGIAEKMFAADKCgAwugUBAMoIACHBBUAAzQgAIYQGAQDKCAAhjQYBAMoIACHSBgAAywrSBiLTBhAAogoAIQUkAAC3FAAgJwAAyhQAIDAAAIsRACDTBgAA_woAINIHAADUFAAgDiQAAJsKACAnAADECgAgMAAAtwkAIKEFAADKCgAwogUAAGIAEKMFAADKCgAwugUBAAAAAcEFQADNCAAhhAYBAMoIACGNBgEAyggAIdIGAADLCtIGItMGEACiCgAhygcAAMgKACDLBwAAyQoAIAMAAABiACABAABjADACAABkACAaJwAAxAoAICsAAMUKACAtAADGCgAgLwAAxwoAIKEFAADACgAwogUAAGYAEKMFAADACgAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAhgwYBAMwIACGEBgEAyggAIYkGAADDCswGIsMGAADBCsMGIsQGAQDKCAAhxQYCAJoKACHGBgEAzAgAIccGAADCCgAgyAYBAMwIACHJBgEAzAgAIcoGAQDMCAAhzAYBAMwIACHNBgEAzAgAIc4GQACDCgAhzwYBAMwIACHQBkAAgwoAIREnAADKFAAgKwAA0BQAIC0AANEUACAvAADSFAAggwYAAP8KACDFBgAA_woAIMYGAAD_CgAgxwYAAP8KACDIBgAA_woAIMkGAAD_CgAgygYAAP8KACDMBgAA_woAIM0GAAD_CgAgzgYAAP8KACDPBgAA_woAINAGAAD_CgAg0gcAANMUACAaJwAAxAoAICsAAMUKACAtAADGCgAgLwAAxwoAIKEFAADACgAwogUAAGYAEKMFAADACgAwpwVAAM0IACG6BQEAAAABwQVAAM0IACGDBgEAzAgAIYQGAQAAAAGJBgAAwwrMBiLDBgAAwQrDBiLEBgEAyggAIcUGAgCaCgAhxgYBAMwIACHHBgAAwgoAIMgGAQDMCAAhyQYBAMwIACHKBgEAzAgAIcwGAQDMCAAhzQYBAMwIACHOBkAAgwoAIc8GAQDMCAAh0AZAAIMKACEDAAAAZgAgAQAAZwAwAgAAaAAgAQAAAGIAIAMAAABmACABAABnADACAABoACABAAAAZgAgCi4AAL8KACChBQAAvQoAMKIFAABtABCjBQAAvQoAMLoFAQDKCAAhwQVAAM0IACHCBQEAzAgAIcMFAAC-CsEGIr8GAQDKCAAhwQYBAMwIACEELgAAzhQAIMIFAAD_CgAgwQYAAP8KACDSBwAAzxQAIAouAAC_CgAgoQUAAL0KADCiBQAAbQAQowUAAL0KADC6BQEAAAABwQVAAM0IACHCBQEAzAgAIcMFAAC-CsEGIr8GAQDKCAAhwQYBAMwIACEDAAAAbQAgAQAAbgAwAgAAbwAgAQAAAG0AIAEAAABmACABAAAAZgAgFycAALcKACArAAC2CgAgOAAAtQoAIDkAALYKACA6AAC2CgAgOwAAuAoAIDwAALAKACChBQAAsgoAMKIFAAB0ABCjBQAAsgoAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIf4FAQDKCAAh_wUCAO8IACGABgIA7wgAIYEGAQDMCAAhggYBAMwIACGDBgEAzAgAIYQGAQDMCAAhhQYBAMwIACGHBgAAswqHBiOJBgAAtAqJBiIBAAAAdAAgAQAAACYAIAEAAAArACAOJAAAmwoAIDIAAK8KACAzAACwCgAgNAAAsAoAIDUAALAKACChBQAAuwoAMKIFAAB4ABCjBQAAuwoAMLoFAQDKCAAhwQVAAM0IACGJBgAAvAqQBiKKBgEAyggAIY0GAQDKCAAhjgYCAO8IACEGJAAAtxQAIDIAAMUUACAzAADGFAAgNAAAxhQAIDUAAMYUACDSBwAAzRQAIBAkAACbCgAgMgAArwoAIDMAALAKACA0AACwCgAgNQAAsAoAIKEFAAC7CgAwogUAAHgAEKMFAAC7CgAwugUBAAAAAcEFQADNCAAhiQYAALwKkAYiigYBAMoIACGNBgEAyggAIY4GAgDvCAAhyAcAALkKACDJBwAAugoAIAMAAAB4ACABAAB5ADACAAB6ACAOJwAAyhQAICsAAMkUACA4AADIFAAgOQAAyRQAIDoAAMkUACA7AADLFAAgPAAAxhQAIIEGAAD_CgAgggYAAP8KACCDBgAA_woAIIQGAAD_CgAghQYAAP8KACCHBgAA_woAINIHAADMFAAgGCcAALcKACArAAC2CgAgOAAAtQoAIDkAALYKACA6AAC2CgAgOwAAuAoAIDwAALAKACChBQAAsgoAMKIFAAB0ABCjBQAAsgoAMKcFQADNCAAhugUBAAAAAcEFQADNCAAh_gUBAMoIACH_BQIA7wgAIYAGAgDvCAAhgQYBAMwIACGCBgEAzAgAIYMGAQDMCAAhhAYBAAAAAYUGAQDMCAAhhwYAALMKhwYjiQYAALQKiQYixwcAALEKACADAAAAdAAgAQAAfAAwAgAAfQAgAwAAAHQAIAEAAHwAMAIAAH0AIAMAAAB0ACABAAB8ADACAAB9ACABAAAAdAAgAQAAAHQAIAEAAAB0ACALMgAArwoAIDcAALAKACChBQAArQoAMKIFAACEAQAQowUAAK0KADC6BQEAyggAIbwFAACuCowGIsEFQADNCAAhygUBAMoIACGKBgEAyggAIYwGAgDvCAAhAzIAAMUUACA3AADGFAAg0gcAAMcUACAMMgAArwoAIDcAALAKACChBQAArQoAMKIFAACEAQAQowUAAK0KADC6BQEAAAABvAUAAK4KjAYiwQVAAM0IACHKBQEAyggAIYoGAQDKCAAhjAYCAO8IACHGBwAArAoAIAMAAACEAQAgAQAAhQEAMAIAAIYBACABAAAAeAAgAQAAAIQBACADAAAAdAAgAQAAfAAwAgAAfQAgAQAAAHQAIAEAAAB4ACABAAAAeAAgAQAAAHgAIAEAAAAwACABAAAAdAAgAwAAAHQAIAEAAHwAMAIAAH0AIAEAAAB0ACADAAAAUwAgAQAAVAAwAgAAVQAgAQAAAFgAIAEAAABiACABAAAAUwAgGiAAAKgKACAtAQDKCAAhQQAAqQoAIEIAAKoKACBDAACrCgAgoQUAAKQKADCiBQAAlwEAEKMFAACkCgAwpwVAAM0IACG6BQEAyggAIbwFAAClCoEHIsEFQADNCAAh3wUBAMwIACGJBgAApwqFByKQBgEAzAgAIbQGAQDMCAAhzwYBAMwIACHbBgEAzAgAIe4GAQDMCAAh-QYBAMoIACGCBwAApgqCByODBwIA7wgAIYUHQADNCAAhhgcBAMwIACGHB0AAgwoAIYgHQACDCgAhDyAAALYUACBBAADBFAAgQgAAwhQAIEMAAMMUACDfBQAA_woAIJAGAAD_CgAgtAYAAP8KACDPBgAA_woAINsGAAD_CgAg7gYAAP8KACCCBwAA_woAIIYHAAD_CgAghwcAAP8KACCIBwAA_woAINIHAADEFAAgGyAAAKgKACAtAQDKCAAhQQAAqQoAIEIAAKoKACBDAACrCgAgoQUAAKQKADCiBQAAlwEAEKMFAACkCgAwpwVAAM0IACG6BQEAAAABvAUAAKUKgQciwQVAAM0IACHfBQEAzAgAIYkGAACnCoUHIpAGAQDMCAAhtAYBAMwIACHPBgEAzAgAIdsGAQDMCAAh7gYBAMwIACH5BgEAyggAIYIHAACmCoIHI4MHAgDvCAAhhQdAAM0IACGGBwEAzAgAIYcHQACDCgAhiAdAAIMKACHFBwAAowoAIAMAAACXAQAgAQAAmAEAMAIAAJkBACASFAAA5wkAIBYAAOgJACBEAADpCQAgRQAA6gkAIEYAAOsJACChBQAA5AkAMKIFAACbAQAQowUAAOQJADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACHKBQEAyggAIc4FAgDvCAAhzwUgAPQIACHjBQEAyggAIYIHAADlCYIHIqYHEADmCQAhpwcQAOYJACEBAAAAmwEAIBEkAACbCgAgQAAAnAoAIKEFAAChCgAwogUAAJ0BABCjBQAAoQoAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAId4FAQDMCAAhjQYBAMoIACH0BgEAyggAIfoGAgCaCgAh-wYgAPQIACH8BhAAogoAIf0GAgCaCgAh_gYCAJoKACH_BiAA9AgAIQgkAAC3FAAgQAAAvRQAIN4FAAD_CgAg-gYAAP8KACD8BgAA_woAIP0GAAD_CgAg_gYAAP8KACDSBwAAwBQAIBMkAACbCgAgQAAAnAoAIKEFAAChCgAwogUAAJ0BABCjBQAAoQoAMKcFQADNCAAhugUBAAAAAcEFQADNCAAh3gUBAMwIACGNBgEAyggAIfQGAQDKCAAh-gYCAJoKACH7BiAA9AgAIfwGEACiCgAh_QYCAJoKACH-BgIAmgoAIf8GIAD0CAAhwwcAAJ8KACDEBwAAoAoAIAMAAACdAQAgAQAAngEAMAIAAJ8BACAOJAAAkgoAIEAAAJwKACChBQAAnQoAMKIFAAChAQAQowUAAJ0KADC6BQEAyggAIcEFQADNCAAhwgUBAMwIACHDBQAAngr2BiKNBgEAzAgAIfQGAQDKCAAh9gYCAJoKACH3BgIAmgoAIfgGAQDKCAAhByQAALcUACBAAAC9FAAgwgUAAP8KACCNBgAA_woAIPYGAAD_CgAg9wYAAP8KACDSBwAAvxQAIA4kAACSCgAgQAAAnAoAIKEFAACdCgAwogUAAKEBABCjBQAAnQoAMLoFAQAAAAHBBUAAzQgAIcIFAQDMCAAhwwUAAJ4K9gYijQYBAMwIACH0BgEAyggAIfYGAgCaCgAh9wYCAJoKACH4BgEAyggAIQMAAAChAQAgAQAAogEAMAIAAKMBACABAAAAKwAgDCQAAJsKACBAAACcCgAgoQUAAJkKADCiBQAApgEAEKMFAACZCgAwpwVAAM0IACG6BQEAyggAIY0GAQDKCAAh9AYBAMoIACH5BgEAyggAIfoGAgCaCgAh-wYgAPQIACEEJAAAtxQAIEAAAL0UACD6BgAA_woAINIHAAC-FAAgDSQAAJsKACBAAACcCgAgoQUAAJkKADCiBQAApgEAEKMFAACZCgAwpwVAAM0IACG6BQEAAAABjQYBAMoIACH0BgEAyggAIfkGAQDKCAAh-gYCAJoKACH7BiAA9AgAIcIHAACYCgAgAwAAAKYBACABAACnAQAwAgAAqAEAIAEAAACdAQAgAQAAAKEBACABAAAApgEAIAsWAACkEgAgIAAAthQAICEAALEUACAiAACxFAAgKgAAuxQAIPAFAAD_CgAg8AYAAP8KACDxBgAA_woAIPIGAAD_CgAg8wYAAP8KACDSBwAAvBQAIBYWAADoCQAgIAAAkQoAICEAAIcKACAiAACHCgAgKgAAlwoAIKEFAACVCgAwogUAAE8AEKMFAACVCgAwpwVAAM0IACG6BQEAAAABwQVAAM0IACHKBQEAyggAIc4FAgDvCAAh4wUBAAAAAfAFAQDMCAAhiQYAAJYK8AYikAYBAMoIACGcBiAA9AgAIfAGAQDMCAAh8QYBAMwIACHyBkAAgwoAIfMGAQDMCAAhAwAAAE8AIAEAAK0BADACAACuAQAgGhUAAIcKACAgAACRCgAgKwAAkgoAIDEAAJMKACA2AACUCgAgoQUAAI4KADCiBQAAsAEAEKMFAACOCgAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAhygUBAMoIACHjBQEAyggAIfAFAQDMCAAhiQYAAJAKlAYikAYBAMoIACGSBgAAjwqSBiKUBgIA7wgAIZUGAQDMCAAhlgYBAMwIACGXBgEAzAgAIZgGQACDCgAhmQZAAIMKACGaBgEAzAgAIZsGIAD0CAAhnAYgAPQIACENFQAAsRQAICAAALYUACArAAC3FAAgMQAAuBQAIDYAALkUACDwBQAA_woAIJUGAAD_CgAglgYAAP8KACCXBgAA_woAIJgGAAD_CgAgmQYAAP8KACCaBgAA_woAINIHAAC6FAAgGhUAAIcKACAgAACRCgAgKwAAkgoAIDEAAJMKACA2AACUCgAgoQUAAI4KADCiBQAAsAEAEKMFAACOCgAwpwVAAM0IACG6BQEAAAABwQVAAM0IACHKBQEAyggAIeMFAQAAAAHwBQEAzAgAIYkGAACQCpQGIpAGAQDKCAAhkgYAAI8KkgYilAYCAO8IACGVBgEAzAgAIZYGAQDMCAAhlwYBAMwIACGYBkAAgwoAIZkGQACDCgAhmgYBAMwIACGbBiAA9AgAIZwGIAD0CAAhAwAAALABACABAACxAQAwAgAAsgEAIAEAAAArACABAAAAMAAgAQAAAJcBACABAAAATwAgAQAAALABACABAAAAJgAgAwAAAGIAIAEAAGMAMAIAAGQAIAMAAACdAQAgAQAAngEAMAIAAJ8BACADAAAApgEAIAEAAKcBADACAACoAQAgAwAAAKEBACABAACiAQAwAgAAowEAIAMAAABTACABAABUADACAABVACADAAAAWAAgAQAAWQAwAgAAWgAgAwAAAHgAIAEAAHkAMAIAAHoAIAMAAACwAQAgAQAAsQEAMAIAALIBACABAAAAYgAgAQAAAJ0BACABAAAApgEAIAEAAAChAQAgAQAAAFMAIAEAAABYACABAAAAeAAgAQAAALABACADAAAATwAgAQAArQEAMAIAAK4BACADAAAATwAgAQAArQEAMAIAAK4BACAKFQAAsRQAIBYAAKQSACAeAAC0FAAgHwAAqxQAIPAFAAD_CgAglwYAAP8KACDdBgAA_woAIN4GAAD_CgAg3wYAAP8KACDSBwAAtRQAIBYVAACHCgAgFgAA6AkAIB4AAIwKACAfAACNCgAgoQUAAIoKADCiBQAANAAQowUAAIoKADCnBUAAzQgAIboFAQAAAAHBBUAAzQgAIcoFAQDKCAAh4wUBAAAAAfAFAQDMCAAhiQYAAIsK4wYilwYBAMwIACGbBiAA9AgAIZwGIAD0CAAh3QYBAMwIACHeBgEAzAgAId8GAQDMCAAh4AZAAM0IACHhBgEAyggAIQMAAAA0ACABAADMAQAwAgAAzQEAIAMAAACwAQAgAQAAsQEAMAIAALIBACAbVQAAhwoAIFYAAIcKACBXAACHCgAgoQUAAIgKADCiBQAA0AEAEKMFAACICgAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAhzgUCAO8IACHPBSAA9AgAIe0FAQDKCAAh7gUBAMwIACHvBQEAyggAIfAFAQDMCAAh8QVAAIMKACHyBQEAzAgAIfMFAQDMCAAh9AUBAMwIACH1BQEAzAgAIfYFAQDMCAAh9wUBAMwIACH4BQEAzAgAIfkFIAD0CAAh-wUAAIkK-wUi_AVAAIMKACH9BUAAgwoAIRBVAACxFAAgVgAAsRQAIFcAALEUACDuBQAA_woAIPAFAAD_CgAg8QUAAP8KACDyBQAA_woAIPMFAAD_CgAg9AUAAP8KACD1BQAA_woAIPYFAAD_CgAg9wUAAP8KACD4BQAA_woAIPwFAAD_CgAg_QUAAP8KACDSBwAAsxQAIBtVAACHCgAgVgAAhwoAIFcAAIcKACChBQAAiAoAMKIFAADQAQAQowUAAIgKADCnBUAAzQgAIboFAQAAAAHBBUAAzQgAIc4FAgDvCAAhzwUgAPQIACHtBQEAyggAIe4FAQDMCAAh7wUBAMoIACHwBQEAzAgAIfEFQACDCgAh8gUBAMwIACHzBQEAzAgAIfQFAQDMCAAh9QUBAMwIACH2BQEAzAgAIfcFAQDMCAAh-AUBAMwIACH5BSAA9AgAIfsFAACJCvsFIvwFQACDCgAh_QVAAIMKACEDAAAA0AEAIAEAANEBADACAADSAQAgAQAAACYAIAEAAAAmACABAAAAJgAgAwAAANABACABAADRAQAwAgAA0gEAIAMAAADQAQAgAQAA0QEAMAIAANIBACANWwAAhwoAIKEFAACGCgAwogUAANkBABCjBQAAhgoAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIcoFAQDKCAAhywUBAMwIACHMBQEAzAgAIc0FAQDKCAAhzgUCAO8IACHPBSAA9AgAIQRbAACxFAAgywUAAP8KACDMBQAA_woAINIHAACyFAAgDVsAAIcKACChBQAAhgoAMKIFAADZAQAQowUAAIYKADCnBUAAzQgAIboFAQAAAAHBBUAAzQgAIcoFAQDKCAAhywUBAMwIACHMBQEAzAgAIc0FAQDKCAAhzgUCAO8IACHPBSAA9AgAIQMAAADZAQAgAQAA2gEAMAIAANsBACABAAAAJgAgAQAAACsAIAEAAABPACABAAAATwAgAQAAADQAIAEAAACwAQAgAQAAANABACABAAAA0AEAIAEAAADQAQAgAQAAANkBACADAAAADgAgAQAADwAwAgAAEAAgAwAAAA4AIAEAAA8AMAIAABAAIAMAAAAOACABAAAPADACAAAQACADAAAASAAgAQAASQAwAgAASgAgAwAAAEgAIAEAAEkAMAIAAEoAIAgLAACvFAAgGQAArhQAIN4FAAD_CgAgoQYAAP8KACCiBgAA_woAIKMGAAD_CgAgpAYAAP8KACDSBwAAsBQAIBELAACFCgAgGQAAhAoAIC0AAIEKoAYioQUAAIAKADCiBQAAQQAQowUAAIAKADCnBUAAzQgAIboFAQAAAAHBBUAAzQgAId4FAQDMCAAhiQYAAIIKoQYinQYBAAAAAZ4GEADmCQAhoQYBAMwIACGiBgEAzAgAIaMGAQDMCAAhpAZAAIMKACEDAAAAQQAgAQAA7AEAMAIAAO0BACABAAAAAwAgAQAAAAMAIAEAAAAZACABAAAAHQAgAQAAACIAIAEAAAAmACABAAAADgAgAQAAAA4AIAEAAAAOACABAAAASAAgAQAAAEgAIAEAAABBACABAAAAAQAgEAUAAIwTACAOAACMEwAgDwAApxQAIBEAAKgUACASAACpFAAgXQAAqhQAIF4AAI0TACBfAACNEwAgYAAAjRMAIGEAAKsUACBiAACrFAAgYwAArBQAIL0HAAD_CgAgvwcAAP8KACDABwAA_woAINIHAACtFAAgAwAAABIAIAEAAPwBADACAAABACADAAAAEgAgAQAA_AEAMAIAAAEAIAMAAAASACABAAD8AQAwAgAAAQAgGgUAAJsUACAOAACcFAAgDwAAnRQAIBEAAJ4UACASAACfFAAgXQAAoBQAIF4AAKEUACBfAACiFAAgYAAAoxQAIGEAAKQUACBiAAClFAAgYwAAphQAIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHPBSAAAAABqQcBAAAAAboHAQAAAAG7BwEAAAABvAcgAAAAAb0HAQAAAAG-BwIAAAABvwdAAAAAAcAHQAAAAAHBB0AAAAABAWkAAIACACAOpwVAAAAAAboFAQAAAAHBBUAAAAABygUBAAAAAc8FIAAAAAGpBwEAAAABugcBAAAAAbsHAQAAAAG8ByAAAAABvQcBAAAAAb4HAgAAAAG_B0AAAAABwAdAAAAAAcEHQAAAAAEBaQAAggIAMBoFAACUEwAgDgAAlRMAIA8AAJYTACARAACXEwAgEgAAmBMAIF0AAJkTACBeAACaEwAgXwAAmxMAIGAAAJwTACBhAACdEwAgYgAAnhMAIGMAAJ8TACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc8FIACYCwAhqQcBAIMLACG6BwEAgwsAIbsHAQCDCwAhvAcgAJgLACG9BwEAhAsAIb4HAgCXCwAhvwdAAIoLACHAB0AAigsAIcEHQACFCwAhAgAAAAEAIGkAAIQCACAOpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHPBSAAmAsAIakHAQCDCwAhugcBAIMLACG7BwEAgwsAIbwHIACYCwAhvQcBAIQLACG-BwIAlwsAIb8HQACKCwAhwAdAAIoLACHBB0AAhQsAIQIAAAASACBpAACGAgAgAwAAAAEAIG4AAIACACBvAACEAgAgAQAAAAEAIAEAAAASACAIBgAAjxMAIHQAAJATACB1AACTEwAgdgAAkhMAIHcAAJETACC9BwAA_woAIL8HAAD_CgAgwAcAAP8KACARoQUAAP8JADCiBQAAjAIAEKMFAAD_CQAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAhygUBALwIACHPBSAA1wgAIakHAQC8CAAhugcBALwIACG7BwEAvAgAIbwHIADXCAAhvQcBAL4IACG-BwIA1ggAIb8HQADPCAAhwAdAAM8IACHBB0AAvwgAIQMAAAASACABAACLAgAwcwAAjAIAIAMAAAASACABAAD8AQAwAgAAAQAgDwgAAPoJACAJAAD9CQAgDAAA_gkAIKEFAAD8CQAwogUAAJICABCjBQAA_AkAMKQFAQAAAAGnBUAAzQgAIboFAQAAAAHBBUAAzQgAIcoFAQDKCAAh8AUBAMwIACG3ByAA9AgAIbgHIAD0CAAhuQcgAPQIACEBAAAAjwIAIAEAAACPAgAgDwgAAPoJACAJAAD9CQAgDAAA_gkAIKEFAAD8CQAwogUAAJICABCjBQAA_AkAMKQFAQDKCAAhpwVAAM0IACG6BQEAyggAIcEFQADNCAAhygUBAMoIACHwBQEAzAgAIbcHIAD0CAAhuAcgAPQIACG5ByAA9AgAIQUIAADgEgAgCQAAjBMAIAwAAI0TACDwBQAA_woAINIHAACOEwAgAwAAAJICACABAACTAgAwAgAAjwIAIAMAAACSAgAgAQAAkwIAMAIAAI8CACADAAAAkgIAIAEAAJMCADACAACPAgAgDAgAAIkTACAJAACKEwAgDAAAixMAIKQFAQAAAAGnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAAB8AUBAAAAAbcHIAAAAAG4ByAAAAABuQcgAAAAAQFpAACXAgAgCaQFAQAAAAGnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAAB8AUBAAAAAbcHIAAAAAG4ByAAAAABuQcgAAAAAQFpAACZAgAwDAgAAOUSACAJAADmEgAgDAAA5xIAIKQFAQCDCwAhpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHwBQEAhAsAIbcHIACYCwAhuAcgAJgLACG5ByAAmAsAIQIAAACPAgAgaQAAmwIAIAmkBQEAgwsAIacFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAh8AUBAIQLACG3ByAAmAsAIbgHIACYCwAhuQcgAJgLACECAAAAkgIAIGkAAJ0CACADAAAAjwIAIG4AAJcCACBvAACbAgAgAQAAAI8CACABAAAAkgIAIAQGAADiEgAgdgAA5BIAIHcAAOMSACDwBQAA_woAIAyhBQAA-wkAMKIFAACjAgAQowUAAPsJADCkBQEAvAgAIacFQAC_CAAhugUBALwIACHBBUAAvwgAIcoFAQC8CAAh8AUBAL4IACG3ByAA1wgAIbgHIADXCAAhuQcgANcIACEDAAAAkgIAIAEAAKICADBzAACjAgAgAwAAAJICACABAACTAgAwAgAAjwIAIAgFAAD6CQAgoQUAAPkJADCiBQAAqQIAEKMFAAD5CQAwpAUBAAAAAboFAQAAAAHBBUAAzQgAIfAFAQDKCAAhAQAAAKYCACABAAAApgIAIAgFAAD6CQAgoQUAAPkJADCiBQAAqQIAEKMFAAD5CQAwpAUBAMoIACG6BQEAyggAIcEFQADNCAAh8AUBAMoIACECBQAA4BIAINIHAADhEgAgAwAAAKkCACABAACqAgAwAgAApgIAIAMAAACpAgAgAQAAqgIAMAIAAKYCACADAAAAqQIAIAEAAKoCADACAACmAgAgBQUAAN8SACCkBQEAAAABugUBAAAAAcEFQAAAAAHwBQEAAAABAWkAAK4CACAEpAUBAAAAAboFAQAAAAHBBUAAAAAB8AUBAAAAAQFpAACwAgAwBQUAANISACCkBQEAgwsAIboFAQCDCwAhwQVAAIULACHwBQEAgwsAIQIAAACmAgAgaQAAsgIAIASkBQEAgwsAIboFAQCDCwAhwQVAAIULACHwBQEAgwsAIQIAAACpAgAgaQAAtAIAIAMAAACmAgAgbgAArgIAIG8AALICACABAAAApgIAIAEAAACpAgAgAwYAAM8SACB2AADREgAgdwAA0BIAIAehBQAA-AkAMKIFAAC6AgAQowUAAPgJADCkBQEAvAgAIboFAQC8CAAhwQVAAL8IACHwBQEAvAgAIQMAAACpAgAgAQAAuQIAMHMAALoCACADAAAAqQIAIAEAAKoCADACAACmAgAgAQAAAAUAIAEAAAAFACADAAAAAwAgAQAABAAwAgAABQAgAwAAAAMAIAEAAAQAMAIAAAUAIAMAAAADACABAAAEADACAAAFACAHAwAAzBIAIAQAAM0SACANAADOEgAguwUBAAAAAcEFQAAAAAGwBwEAAAABtgcBAAAAAQFpAADCAgAgBLsFAQAAAAHBBUAAAAABsAcBAAAAAbYHAQAAAAEBaQAAxAIAMAcDAADJEgAgBAAAyhIAIA0AAMsSACC7BQEAgwsAIcEFQACFCwAhsAcBAIMLACG2BwEAhAsAIQIAAAAFACBpAADGAgAgBLsFAQCDCwAhwQVAAIULACGwBwEAgwsAIbYHAQCECwAhAgAAAAMAIGkAAMgCACADAAAABQAgbgAAwgIAIG8AAMYCACABAAAABQAgAQAAAAMAIAQGAADGEgAgdgAAyBIAIHcAAMcSACC2BwAA_woAIAehBQAA9wkAMKIFAADOAgAQowUAAPcJADC7BQEAvAgAIcEFQAC_CAAhsAcBALwIACG2BwEAvggAIQMAAAADACABAADNAgAwcwAAzgIAIAMAAAADACABAAAEADACAAAFACABAAAACQAgAQAAAAkAIAMAAAAHACABAAAIADACAAAJACADAAAABwAgAQAACAAwAgAACQAgAwAAAAcAIAEAAAgAMAIAAAkAIAUEAADEEgAgBwAAxRIAIMEFQAAAAAGwBwEAAAABtQcBAAAAAQFpAADWAgAgA8EFQAAAAAGwBwEAAAABtQcBAAAAAQFpAADYAgAwBQQAAMISACAHAADDEgAgwQVAAIULACGwBwEAgwsAIbUHAQCDCwAhAgAAAAkAIGkAANoCACADwQVAAIULACGwBwEAgwsAIbUHAQCDCwAhAgAAAAcAIGkAANwCACADAAAACQAgbgAA1gIAIG8AANoCACABAAAACQAgAQAAAAcAIAMGAAC_EgAgdgAAwRIAIHcAAMASACAGoQUAAPYJADCiBQAA4gIAEKMFAAD2CQAwwQVAAL8IACGwBwEAvAgAIbUHAQC8CAAhAwAAAAcAIAEAAOECADBzAADiAgAgAwAAAAcAIAEAAAgAMAIAAAkAIAEAAAAQACABAAAAEAAgAwAAAA4AIAEAAA8AMAIAABAAIAMAAAAOACABAAAPADACAAAQACADAAAADgAgAQAADwAwAgAAEAAgEAMAALsSACAEAAC8EgAgCgAAvRIAIAsAAL4SACCnBUAAAAABugUBAAAAAbsFAQAAAAHBBUAAAAABwwUAAACyBwKJBgAAALMHAqMGAQAAAAGkBkAAAAAB-AYBAAAAAbAHAQAAAAGzBwEAAAABtAcBAAAAAQFpAADqAgAgDKcFQAAAAAG6BQEAAAABuwUBAAAAAcEFQAAAAAHDBQAAALIHAokGAAAAswcCowYBAAAAAaQGQAAAAAH4BgEAAAABsAcBAAAAAbMHAQAAAAG0BwEAAAABAWkAAOwCADAQAwAAtxIAIAQAALgSACAKAAC5EgAgCwAAuhIAIKcFQACFCwAhugUBAIMLACG7BQEAgwsAIcEFQACFCwAhwwUAALUSsgciiQYAALYSswciowYBAIQLACGkBkAAigsAIfgGAQCDCwAhsAcBAIMLACGzBwEAhAsAIbQHAQCDCwAhAgAAABAAIGkAAO4CACAMpwVAAIULACG6BQEAgwsAIbsFAQCDCwAhwQVAAIULACHDBQAAtRKyByKJBgAAthKzByKjBgEAhAsAIaQGQACKCwAh-AYBAIMLACGwBwEAgwsAIbMHAQCECwAhtAcBAIMLACECAAAADgAgaQAA8AIAIAMAAAAQACBuAADqAgAgbwAA7gIAIAEAAAAQACABAAAADgAgBgYAALISACB2AAC0EgAgdwAAsxIAIKMGAAD_CgAgpAYAAP8KACCzBwAA_woAIA-hBQAA7wkAMKIFAAD2AgAQowUAAO8JADCnBUAAvwgAIboFAQC8CAAhuwUBALwIACHBBUAAvwgAIcMFAADwCbIHIokGAADxCbMHIqMGAQC-CAAhpAZAAM8IACH4BgEAvAgAIbAHAQC8CAAhswcBAL4IACG0BwEAvAgAIQMAAAAOACABAAD1AgAwcwAA9gIAIAMAAAAOACABAAAPADACAAAQACABAAAAGwAgAQAAABsAIAMAAAAZACABAAAaADACAAAbACADAAAAGQAgAQAAGgAwAgAAGwAgAwAAABkAIAEAABoAMAIAABsAIAsDAACxEgAgugUBAAAAAbsFAQAAAAHBBUAAAAAByAUBAAAAAckFAQAAAAGrBwEAAAABrAcgAAAAAa0HQAAAAAGuB0AAAAABrwdAAAAAAQFpAAD-AgAgCroFAQAAAAG7BQEAAAABwQVAAAAAAcgFAQAAAAHJBQEAAAABqwcBAAAAAawHIAAAAAGtB0AAAAABrgdAAAAAAa8HQAAAAAEBaQAAgAMAMAsDAACwEgAgugUBAIMLACG7BQEAgwsAIcEFQACFCwAhyAUBAIQLACHJBQEAhAsAIasHAQCDCwAhrAcgAJgLACGtB0AAhQsAIa4HQACFCwAhrwdAAIoLACECAAAAGwAgaQAAggMAIAq6BQEAgwsAIbsFAQCDCwAhwQVAAIULACHIBQEAhAsAIckFAQCECwAhqwcBAIMLACGsByAAmAsAIa0HQACFCwAhrgdAAIULACGvB0AAigsAIQIAAAAZACBpAACEAwAgAwAAABsAIG4AAP4CACBvAACCAwAgAQAAABsAIAEAAAAZACAGBgAArRIAIHYAAK8SACB3AACuEgAgyAUAAP8KACDJBQAA_woAIK8HAAD_CgAgDaEFAADuCQAwogUAAIoDABCjBQAA7gkAMLoFAQC8CAAhuwUBALwIACHBBUAAvwgAIcgFAQC-CAAhyQUBAL4IACGrBwEAvAgAIawHIADXCAAhrQdAAL8IACGuB0AAvwgAIa8HQADPCAAhAwAAABkAIAEAAIkDADBzAACKAwAgAwAAABkAIAEAABoAMAIAABsAIAqhBQAA7QkAMKIFAACQAwAQowUAAO0JADC6BQEAAAABwQVAAM0IACHIBQEAzAgAIckFAQDMCAAh-AYBAMwIACGpBwEAyggAIaoHIAD0CAAhAQAAAI0DACABAAAAjQMAIAqhBQAA7QkAMKIFAACQAwAQowUAAO0JADC6BQEAyggAIcEFQADNCAAhyAUBAMwIACHJBQEAzAgAIfgGAQDMCAAhqQcBAMoIACGqByAA9AgAIQTIBQAA_woAIMkFAAD_CgAg-AYAAP8KACDSBwAArBIAIAMAAACQAwAgAQAAkQMAMAIAAI0DACADAAAAkAMAIAEAAJEDADACAACNAwAgAwAAAJADACABAACRAwAwAgAAjQMAIAe6BQEAAAABwQVAAAAAAcgFAQAAAAHJBQEAAAAB-AYBAAAAAakHAQAAAAGqByAAAAABAWkAAJUDACAHugUBAAAAAcEFQAAAAAHIBQEAAAAByQUBAAAAAfgGAQAAAAGpBwEAAAABqgcgAAAAAQFpAACXAwAwB7oFAQCDCwAhwQVAAIULACHIBQEAhAsAIckFAQCECwAh-AYBAIQLACGpBwEAgwsAIaoHIACYCwAhAgAAAI0DACBpAACZAwAgB7oFAQCDCwAhwQVAAIULACHIBQEAhAsAIckFAQCECwAh-AYBAIQLACGpBwEAgwsAIaoHIACYCwAhAgAAAJADACBpAACbAwAgAwAAAI0DACBuAACVAwAgbwAAmQMAIAEAAACNAwAgAQAAAJADACAGBgAAqRIAIHYAAKsSACB3AACqEgAgyAUAAP8KACDJBQAA_woAIPgGAAD_CgAgCqEFAADsCQAwogUAAKEDABCjBQAA7AkAMLoFAQC8CAAhwQVAAL8IACHIBQEAvggAIckFAQC-CAAh-AYBAL4IACGpBwEAvAgAIaoHIADXCAAhAwAAAJADACABAACgAwAwcwAAoQMAIAMAAACQAwAgAQAAkQMAMAIAAI0DACATFAAA5wkAIBYAAOgJACBEAADpCQAgRQAA6gkAIEYAAOsJACChBQAA5AkAMKIFAACbAQAQowUAAOQJADCnBUAAzQgAIboFAQAAAAHBBUAAzQgAIcoFAQDKCAAhzgUCAO8IACHPBSAA9AgAIeMFAQAAAAGCBwAA5QmCByKmBxAA5gkAIacHEADmCQAhqAcAAOMJACABAAAApAMAIAEAAACkAwAgBhQAAKMSACAWAACkEgAgRAAApRIAIEUAAKYSACBGAACnEgAg0gcAAKgSACADAAAAmwEAIAEAAKcDADACAACkAwAgAwAAAJsBACABAACnAwAwAgAApAMAIAMAAACbAQAgAQAApwMAMAIAAKQDACAPFAAAnhIAIBYAAJ8SACBEAACgEgAgRQAAoRIAIEYAAKISACCnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAABzgUCAAAAAc8FIAAAAAHjBQEAAAABggcAAACCBwKmBxAAAAABpwcQAAAAAQFpAACrAwAgCqcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHOBQIAAAABzwUgAAAAAeMFAQAAAAGCBwAAAIIHAqYHEAAAAAGnBxAAAAABAWkAAK0DADAPFAAA6REAIBYAAOoRACBEAADrEQAgRQAA7BEAIEYAAO0RACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc4FAgCXCwAhzwUgAJgLACHjBQEAgwsAIYIHAAD1DoIHIqYHEADwDAAhpwcQAPAMACECAAAApAMAIGkAAK8DACAKpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHOBQIAlwsAIc8FIACYCwAh4wUBAIMLACGCBwAA9Q6CByKmBxAA8AwAIacHEADwDAAhAgAAAJsBACBpAACxAwAgAwAAAKQDACBuAACrAwAgbwAArwMAIAEAAACkAwAgAQAAAJsBACAFBgAA5BEAIHQAAOURACB1AADoEQAgdgAA5xEAIHcAAOYRACANoQUAAOIJADCiBQAAtwMAEKMFAADiCQAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAhygUBALwIACHOBQIA1ggAIc8FIADXCAAh4wUBALwIACGCBwAA2QmCByKmBxAAkAkAIacHEACQCQAhAwAAAJsBACABAAC2AwAwcwAAtwMAIAMAAACbAQAgAQAApwMAMAIAAKQDACABAAAALQAgAQAAAC0AIAMAAAArACABAAAsADACAAAtACADAAAAKwAgAQAALAAwAgAALQAgAwAAACsAIAEAACwAMAIAAC0AIC4gAADhDwAgRwAA4xEAIEgAAOIPACBJAADjDwAgSgAA5A8AIEsAAOUPACBMAADmDwAgTQAA5w8AIE4AAOgPACBPAADpDwAgpwVAAAAAAboFAQAAAAHBBUAAAAAB2wVAAAAAAeMFAQAAAAGJBgAAAJUHApAGAQAAAAGcBiAAAAABggcAAACCBwKJBwEAAAABigcBAAAAAYsHAQAAAAGMBwEAAAABjQcBAAAAAY4HQAAAAAGPByAAAAABkAcCAAAAAZEHAgAAAAGTBwAAAJMHApUHAQAAAAGWB4AAAAABlwcBAAAAAZgHQAAAAAGZBwIAAAABmgcCAAAAAZsHAgAAAAGcBwIAAAABnQcCAAAAAZ4HAgAAAAGfBwIAAAABoAcCAAAAAaEHAgAAAAGiBwIAAAABowcBAAAAAaQHAQAAAAGlBwEAAAABAWkAAL8DACAkpwVAAAAAAboFAQAAAAHBBUAAAAAB2wVAAAAAAeMFAQAAAAGJBgAAAJUHApAGAQAAAAGcBiAAAAABggcAAACCBwKJBwEAAAABigcBAAAAAYsHAQAAAAGMBwEAAAABjQcBAAAAAY4HQAAAAAGPByAAAAABkAcCAAAAAZEHAgAAAAGTBwAAAJMHApUHAQAAAAGWB4AAAAABlwcBAAAAAZgHQAAAAAGZBwIAAAABmgcCAAAAAZsHAgAAAAGcBwIAAAABnQcCAAAAAZ4HAgAAAAGfBwIAAAABoAcCAAAAAaEHAgAAAAGiBwIAAAABowcBAAAAAaQHAQAAAAGlBwEAAAABAWkAAMEDADAuIAAA-Q4AIEcAAOIRACBIAAD6DgAgSQAA-w4AIEoAAPwOACBLAAD9DgAgTAAA_g4AIE0AAP8OACBOAACADwAgTwAAgQ8AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIdsFQACKCwAh4wUBAIMLACGJBgAA9w6VByKQBgEAgwsAIZwGIACYCwAhggcAAPUOggciiQcBAIMLACGKBwEAgwsAIYsHAQCECwAhjAcBAIMLACGNBwEAhAsAIY4HQACKCwAhjwcgAJgLACGQBwIAoQsAIZEHAgChCwAhkwcAAPYOkwcilQcBAIQLACGWB4AAAAABlwcBAIQLACGYB0AAigsAIZkHAgCXCwAhmgcCAJcLACGbBwIAlwsAIZwHAgCXCwAhnQcCAJcLACGeBwIAlwsAIZ8HAgCXCwAhoAcCAJcLACGhBwIAlwsAIaIHAgCXCwAhowcBAIQLACGkBwEAhAsAIaUHAQCECwAhAgAAAC0AIGkAAMMDACAkpwVAAIULACG6BQEAgwsAIcEFQACFCwAh2wVAAIoLACHjBQEAgwsAIYkGAAD3DpUHIpAGAQCDCwAhnAYgAJgLACGCBwAA9Q6CByKJBwEAgwsAIYoHAQCDCwAhiwcBAIQLACGMBwEAgwsAIY0HAQCECwAhjgdAAIoLACGPByAAmAsAIZAHAgChCwAhkQcCAKELACGTBwAA9g6TByKVBwEAhAsAIZYHgAAAAAGXBwEAhAsAIZgHQACKCwAhmQcCAJcLACGaBwIAlwsAIZsHAgCXCwAhnAcCAJcLACGdBwIAlwsAIZ4HAgCXCwAhnwcCAJcLACGgBwIAlwsAIaEHAgCXCwAhogcCAJcLACGjBwEAhAsAIaQHAQCECwAhpQcBAIQLACECAAAAKwAgaQAAxQMAIAMAAAAtACBuAAC_AwAgbwAAwwMAIAEAAAAtACABAAAAKwAgEgYAAN0RACB0AADeEQAgdQAA4REAIHYAAOARACB3AADfEQAg2wUAAP8KACCLBwAA_woAII0HAAD_CgAgjgcAAP8KACCQBwAA_woAIJEHAAD_CgAglQcAAP8KACCWBwAA_woAIJcHAAD_CgAgmAcAAP8KACCjBwAA_woAIKQHAAD_CgAgpQcAAP8KACAnoQUAANgJADCiBQAAywMAEKMFAADYCQAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAh2wVAAM8IACHjBQEAvAgAIYkGAADbCZUHIpAGAQC8CAAhnAYgANcIACGCBwAA2QmCByKJBwEAvAgAIYoHAQC8CAAhiwcBAL4IACGMBwEAvAgAIY0HAQC-CAAhjgdAAM8IACGPByAA1wgAIZAHAgDeCAAhkQcCAN4IACGTBwAA2gmTByKVBwEAvggAIZYHAADTCAAglwcBAL4IACGYB0AAzwgAIZkHAgDWCAAhmgcCANYIACGbBwIA1ggAIZwHAgDWCAAhnQcCANYIACGeBwIA1ggAIZ8HAgDWCAAhoAcCANYIACGhBwIA1ggAIaIHAgDWCAAhowcBAL4IACGkBwEAvggAIaUHAQC-CAAhAwAAACsAIAEAAMoDADBzAADLAwAgAwAAACsAIAEAACwAMAIAAC0AIAEAAACZAQAgAQAAAJkBACADAAAAlwEAIAEAAJgBADACAACZAQAgAwAAAJcBACABAACYAQAwAgAAmQEAIAMAAACXAQAgAQAAmAEAMAIAAJkBACAXIAAA2REAIC0BAAAAAUEAANoRACBCAADbEQAgQwAA3BEAIKcFQAAAAAG6BQEAAAABvAUAAACBBwLBBUAAAAAB3wUBAAAAAYkGAAAAhQcCkAYBAAAAAbQGAQAAAAHPBgEAAAAB2wYBAAAAAe4GAQAAAAH5BgEAAAABggcAAACCBwODBwIAAAABhQdAAAAAAYYHAQAAAAGHB0AAAAABiAdAAAAAAQFpAADTAwAgEy0BAAAAAacFQAAAAAG6BQEAAAABvAUAAACBBwLBBUAAAAAB3wUBAAAAAYkGAAAAhQcCkAYBAAAAAbQGAQAAAAHPBgEAAAAB2wYBAAAAAe4GAQAAAAH5BgEAAAABggcAAACCBwODBwIAAAABhQdAAAAAAYYHAQAAAAGHB0AAAAABiAdAAAAAAQFpAADVAwAwFyAAALoRACAtAQCDCwAhQQAAuxEAIEIAALwRACBDAAC9EQAgpwVAAIULACG6BQEAgwsAIbwFAAC3EYEHIsEFQACFCwAh3wUBAIQLACGJBgAAuRGFByKQBgEAhAsAIbQGAQCECwAhzwYBAIQLACHbBgEAhAsAIe4GAQCECwAh-QYBAIMLACGCBwAAuBGCByODBwIAlwsAIYUHQACFCwAhhgcBAIQLACGHB0AAigsAIYgHQACKCwAhAgAAAJkBACBpAADXAwAgEy0BAIMLACGnBUAAhQsAIboFAQCDCwAhvAUAALcRgQciwQVAAIULACHfBQEAhAsAIYkGAAC5EYUHIpAGAQCECwAhtAYBAIQLACHPBgEAhAsAIdsGAQCECwAh7gYBAIQLACH5BgEAgwsAIYIHAAC4EYIHI4MHAgCXCwAhhQdAAIULACGGBwEAhAsAIYcHQACKCwAhiAdAAIoLACECAAAAlwEAIGkAANkDACADAAAAmQEAIG4AANMDACBvAADXAwAgAQAAAJkBACABAAAAlwEAIA8GAACyEQAgdAAAsxEAIHUAALYRACB2AAC1EQAgdwAAtBEAIN8FAAD_CgAgkAYAAP8KACC0BgAA_woAIM8GAAD_CgAg2wYAAP8KACDuBgAA_woAIIIHAAD_CgAghgcAAP8KACCHBwAA_woAIIgHAAD_CgAgFi0BALwIACGhBQAAzgkAMKIFAADfAwAQowUAAM4JADCnBUAAvwgAIboFAQC8CAAhvAUAAM8JgQciwQVAAL8IACHfBQEAvggAIYkGAADRCYUHIpAGAQC-CAAhtAYBAL4IACHPBgEAvggAIdsGAQC-CAAh7gYBAL4IACH5BgEAvAgAIYIHAADQCYIHI4MHAgDWCAAhhQdAAL8IACGGBwEAvggAIYcHQADPCAAhiAdAAM8IACEDAAAAlwEAIAEAAN4DADBzAADfAwAgAwAAAJcBACABAACYAQAwAgAAmQEAIAEAAACfAQAgAQAAAJ8BACADAAAAnQEAIAEAAJ4BADACAACfAQAgAwAAAJ0BACABAACeAQAwAgAAnwEAIAMAAACdAQAgAQAAngEAMAIAAJ8BACAOJAAAsREAIEAAANQPACCnBUAAAAABugUBAAAAAcEFQAAAAAHeBQEAAAABjQYBAAAAAfQGAQAAAAH6BgIAAAAB-wYgAAAAAfwGEAAAAAH9BgIAAAAB_gYCAAAAAf8GIAAAAAEBaQAA5wMAIAynBUAAAAABugUBAAAAAcEFQAAAAAHeBQEAAAABjQYBAAAAAfQGAQAAAAH6BgIAAAAB-wYgAAAAAfwGEAAAAAH9BgIAAAAB_gYCAAAAAf8GIAAAAAEBaQAA6QMAMA4kAACwEQAgQAAA0g8AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAId4FAQCECwAhjQYBAIMLACH0BgEAgwsAIfoGAgChCwAh-wYgAJgLACH8BhAAlA4AIf0GAgChCwAh_gYCAKELACH_BiAAmAsAIQIAAACfAQAgaQAA6wMAIAynBUAAhQsAIboFAQCDCwAhwQVAAIULACHeBQEAhAsAIY0GAQCDCwAh9AYBAIMLACH6BgIAoQsAIfsGIACYCwAh_AYQAJQOACH9BgIAoQsAIf4GAgChCwAh_wYgAJgLACECAAAAnQEAIGkAAO0DACADAAAAnwEAIG4AAOcDACBvAADrAwAgAQAAAJ8BACABAAAAnQEAIAoGAACrEQAgdAAArBEAIHUAAK8RACB2AACuEQAgdwAArREAIN4FAAD_CgAg-gYAAP8KACD8BgAA_woAIP0GAAD_CgAg_gYAAP8KACAPoQUAAM0JADCiBQAA8wMAEKMFAADNCQAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAh3gUBAL4IACGNBgEAvAgAIfQGAQC8CAAh-gYCAN4IACH7BiAA1wgAIfwGEACsCQAh_QYCAN4IACH-BgIA3ggAIf8GIADXCAAhAwAAAJ0BACABAADyAwAwcwAA8wMAIAMAAACdAQAgAQAAngEAMAIAAJ8BACABAAAAqAEAIAEAAACoAQAgAwAAAKYBACABAACnAQAwAgAAqAEAIAMAAACmAQAgAQAApwEAMAIAAKgBACADAAAApgEAIAEAAKcBADACAACoAQAgCSQAAKoRACBAAADGDwAgpwVAAAAAAboFAQAAAAGNBgEAAAAB9AYBAAAAAfkGAQAAAAH6BgIAAAAB-wYgAAAAAQFpAAD7AwAgB6cFQAAAAAG6BQEAAAABjQYBAAAAAfQGAQAAAAH5BgEAAAAB-gYCAAAAAfsGIAAAAAEBaQAA_QMAMAkkAACpEQAgQAAAxA8AIKcFQACFCwAhugUBAIMLACGNBgEAgwsAIfQGAQCDCwAh-QYBAIMLACH6BgIAoQsAIfsGIACYCwAhAgAAAKgBACBpAAD_AwAgB6cFQACFCwAhugUBAIMLACGNBgEAgwsAIfQGAQCDCwAh-QYBAIMLACH6BgIAoQsAIfsGIACYCwAhAgAAAKYBACBpAACBBAAgAwAAAKgBACBuAAD7AwAgbwAA_wMAIAEAAACoAQAgAQAAAKYBACAGBgAApBEAIHQAAKURACB1AACoEQAgdgAApxEAIHcAAKYRACD6BgAA_woAIAqhBQAAzAkAMKIFAACHBAAQowUAAMwJADCnBUAAvwgAIboFAQC8CAAhjQYBALwIACH0BgEAvAgAIfkGAQC8CAAh-gYCAN4IACH7BiAA1wgAIQMAAACmAQAgAQAAhgQAMHMAAIcEACADAAAApgEAIAEAAKcBADACAACoAQAgAQAAAKMBACABAAAAowEAIAMAAAChAQAgAQAAogEAMAIAAKMBACADAAAAoQEAIAEAAKIBADACAACjAQAgAwAAAKEBACABAACiAQAwAgAAowEAIAskAACjEQAgQAAAuA8AILoFAQAAAAHBBUAAAAABwgUBAAAAAcMFAAAA9gYCjQYBAAAAAfQGAQAAAAH2BgIAAAAB9wYCAAAAAfgGAQAAAAEBaQAAjwQAIAm6BQEAAAABwQVAAAAAAcIFAQAAAAHDBQAAAPYGAo0GAQAAAAH0BgEAAAAB9gYCAAAAAfcGAgAAAAH4BgEAAAABAWkAAJEEADALJAAAohEAIEAAALYPACC6BQEAgwsAIcEFQACFCwAhwgUBAIQLACHDBQAAtA_2BiKNBgEAhAsAIfQGAQCDCwAh9gYCAKELACH3BgIAoQsAIfgGAQCDCwAhAgAAAKMBACBpAACTBAAgCboFAQCDCwAhwQVAAIULACHCBQEAhAsAIcMFAAC0D_YGIo0GAQCECwAh9AYBAIMLACH2BgIAoQsAIfcGAgChCwAh-AYBAIMLACECAAAAoQEAIGkAAJUEACADAAAAowEAIG4AAI8EACBvAACTBAAgAQAAAKMBACABAAAAoQEAIAkGAACdEQAgdAAAnhEAIHUAAKERACB2AACgEQAgdwAAnxEAIMIFAAD_CgAgjQYAAP8KACD2BgAA_woAIPcGAAD_CgAgDKEFAADICQAwogUAAJsEABCjBQAAyAkAMLoFAQC8CAAhwQVAAL8IACHCBQEAvggAIcMFAADJCfYGIo0GAQC-CAAh9AYBALwIACH2BgIA3ggAIfcGAgDeCAAh-AYBALwIACEDAAAAoQEAIAEAAJoEADBzAACbBAAgAwAAAKEBACABAACiAQAwAgAAowEAIAEAAACuAQAgAQAAAK4BACADAAAATwAgAQAArQEAMAIAAK4BACADAAAATwAgAQAArQEAMAIAAK4BACADAAAATwAgAQAArQEAMAIAAK4BACATFgAA3w4AICAAANwOACAhAADdDgAgIgAA6g4AICoAAN4OACCnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAABzgUCAAAAAeMFAQAAAAHwBQEAAAABiQYAAADwBgKQBgEAAAABnAYgAAAAAfAGAQAAAAHxBgEAAAAB8gZAAAAAAfMGAQAAAAEBaQAAowQAIA6nBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAABzgUCAAAAAeMFAQAAAAHwBQEAAAABiQYAAADwBgKQBgEAAAABnAYgAAAAAfAGAQAAAAHxBgEAAAAB8gZAAAAAAfMGAQAAAAEBaQAApQQAMBMWAADEDgAgIAAAwQ4AICEAAMIOACAiAADoDgAgKgAAww4AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzgUCAJcLACHjBQEAgwsAIfAFAQCECwAhiQYAAL8O8AYikAYBAIMLACGcBiAAmAsAIfAGAQCECwAh8QYBAIQLACHyBkAAigsAIfMGAQCECwAhAgAAAK4BACBpAACnBAAgDqcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzgUCAJcLACHjBQEAgwsAIfAFAQCECwAhiQYAAL8O8AYikAYBAIMLACGcBiAAmAsAIfAGAQCECwAh8QYBAIQLACHyBkAAigsAIfMGAQCECwAhAgAAAE8AIGkAAKkEACADAAAArgEAIG4AAKMEACBvAACnBAAgAQAAAK4BACABAAAATwAgCgYAAJgRACB0AACZEQAgdQAAnBEAIHYAAJsRACB3AACaEQAg8AUAAP8KACDwBgAA_woAIPEGAAD_CgAg8gYAAP8KACDzBgAA_woAIBGhBQAAxAkAMKIFAACvBAAQowUAAMQJADCnBUAAvwgAIboFAQC8CAAhwQVAAL8IACHKBQEAvAgAIc4FAgDWCAAh4wUBALwIACHwBQEAvggAIYkGAADFCfAGIpAGAQC8CAAhnAYgANcIACHwBgEAvggAIfEGAQC-CAAh8gZAAM8IACHzBgEAvggAIQMAAABPACABAACuBAAwcwAArwQAIAMAAABPACABAACtAQAwAgAArgEAIAEAAABVACABAAAAVQAgAwAAAFMAIAEAAFQAMAIAAFUAIAMAAABTACABAABUADACAABVACADAAAAUwAgAQAAVAAwAgAAVQAgFSMAAOcNACAkAADoDQAgJQAA2g4AICkAAOkNACCnBUAAAAABugUBAAAAAcEFQAAAAAGJBgAAAOcGAo0GAQAAAAG0BgEAAAABzwYBAAAAAdAGQAAAAAHZBgEAAAAB2wYBAAAAAecGAQAAAAHoBkAAAAAB6QYBAAAAAeoGQAAAAAHsBgAAAOwGA-0GAQAAAAHuBgEAAAABAWkAALcEACARpwVAAAAAAboFAQAAAAHBBUAAAAABiQYAAADnBgKNBgEAAAABtAYBAAAAAc8GAQAAAAHQBkAAAAAB2QYBAAAAAdsGAQAAAAHnBgEAAAAB6AZAAAAAAekGAQAAAAHqBkAAAAAB7AYAAADsBgPtBgEAAAAB7gYBAAAAAQFpAAC5BAAwFSMAANUNACAkAADWDQAgJQAA2A4AICkAANcNACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACGJBgAA0g3nBiKNBgEAgwsAIbQGAQCECwAhzwYBAIQLACHQBkAAigsAIdkGAQCDCwAh2wYBAIQLACHnBgEAhAsAIegGQACFCwAh6QYBAIQLACHqBkAAigsAIewGAADTDewGI-0GAQCECwAh7gYBAIQLACECAAAAVQAgaQAAuwQAIBGnBUAAhQsAIboFAQCDCwAhwQVAAIULACGJBgAA0g3nBiKNBgEAgwsAIbQGAQCECwAhzwYBAIQLACHQBkAAigsAIdkGAQCDCwAh2wYBAIQLACHnBgEAhAsAIegGQACFCwAh6QYBAIQLACHqBkAAigsAIewGAADTDewGI-0GAQCECwAh7gYBAIQLACECAAAAUwAgaQAAvQQAIAMAAABVACBuAAC3BAAgbwAAuwQAIAEAAABVACABAAAAUwAgDQYAAJURACB2AACXEQAgdwAAlhEAILQGAAD_CgAgzwYAAP8KACDQBgAA_woAINsGAAD_CgAg5wYAAP8KACDpBgAA_woAIOoGAAD_CgAg7AYAAP8KACDtBgAA_woAIO4GAAD_CgAgFKEFAAC9CQAwogUAAMMEABCjBQAAvQkAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIYkGAAC-CecGIo0GAQC8CAAhtAYBAL4IACHPBgEAvggAIdAGQADPCAAh2QYBALwIACHbBgEAvggAIecGAQC-CAAh6AZAAL8IACHpBgEAvggAIeoGQADPCAAh7AYAAL8J7AYj7QYBAL4IACHuBgEAvggAIQMAAABTACABAADCBAAwcwAAwwQAIAMAAABTACABAABUADACAABVACABAAAAWgAgAQAAAFoAIAMAAABYACABAABZADACAABaACADAAAAWAAgAQAAWQAwAgAAWgAgAwAAAFgAIAEAAFkAMAIAAFoAIAomAADGDQAgJwAA5Q0AICgAAMcNACC6BQEAAAABwQVAAAAAAYQGAQAAAAHbBgEAAAAB4wYBAAAAAeQGAQAAAAHlBkAAAAABAWkAAMsEACAHugUBAAAAAcEFQAAAAAGEBgEAAAAB2wYBAAAAAeMGAQAAAAHkBgEAAAAB5QZAAAAAAQFpAADNBAAwCiYAAMQNACAnAADjDQAgKAAAxQ0AILoFAQCDCwAhwQVAAIULACGEBgEAhAsAIdsGAQCECwAh4wYBAIMLACHkBgEAhAsAIeUGQACFCwAhAgAAAFoAIGkAAM8EACAHugUBAIMLACHBBUAAhQsAIYQGAQCECwAh2wYBAIQLACHjBgEAgwsAIeQGAQCECwAh5QZAAIULACECAAAAWAAgaQAA0QQAIAMAAABaACBuAADLBAAgbwAAzwQAIAEAAABaACABAAAAWAAgBgYAAJIRACB2AACUEQAgdwAAkxEAIIQGAAD_CgAg2wYAAP8KACDkBgAA_woAIAqhBQAAvAkAMKIFAADXBAAQowUAALwJADC6BQEAvAgAIcEFQAC_CAAhhAYBAL4IACHbBgEAvggAIeMGAQC8CAAh5AYBAL4IACHlBkAAvwgAIQMAAABYACABAADWBAAwcwAA1wQAIAMAAABYACABAABZADACAABaACABAAAAzQEAIAEAAADNAQAgAwAAADQAIAEAAMwBADACAADNAQAgAwAAADQAIAEAAMwBADACAADNAQAgAwAAADQAIAEAAMwBADACAADNAQAgExUAAJERACAWAACyDgAgHgAAsw4AIB8AALQOACCnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAAB4wUBAAAAAfAFAQAAAAGJBgAAAOMGApcGAQAAAAGbBiAAAAABnAYgAAAAAd0GAQAAAAHeBgEAAAAB3wYBAAAAAeAGQAAAAAHhBgEAAAABAWkAAN8EACAPpwVAAAAAAboFAQAAAAHBBUAAAAABygUBAAAAAeMFAQAAAAHwBQEAAAABiQYAAADjBgKXBgEAAAABmwYgAAAAAZwGIAAAAAHdBgEAAAAB3gYBAAAAAd8GAQAAAAHgBkAAAAAB4QYBAAAAAQFpAADhBAAwExUAAJARACAWAADjDAAgHgAA5AwAIB8AAOUMACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIeMFAQCDCwAh8AUBAIQLACGJBgAA4QzjBiKXBgEAhAsAIZsGIACYCwAhnAYgAJgLACHdBgEAhAsAId4GAQCECwAh3wYBAIQLACHgBkAAhQsAIeEGAQCDCwAhAgAAAM0BACBpAADjBAAgD6cFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAh4wUBAIMLACHwBQEAhAsAIYkGAADhDOMGIpcGAQCECwAhmwYgAJgLACGcBiAAmAsAId0GAQCECwAh3gYBAIQLACHfBgEAhAsAIeAGQACFCwAh4QYBAIMLACECAAAANAAgaQAA5QQAIAMAAADNAQAgbgAA3wQAIG8AAOMEACABAAAAzQEAIAEAAAA0ACAIBgAAjREAIHYAAI8RACB3AACOEQAg8AUAAP8KACCXBgAA_woAIN0GAAD_CgAg3gYAAP8KACDfBgAA_woAIBKhBQAAuAkAMKIFAADrBAAQowUAALgJADCnBUAAvwgAIboFAQC8CAAhwQVAAL8IACHKBQEAvAgAIeMFAQC8CAAh8AUBAL4IACGJBgAAuQnjBiKXBgEAvggAIZsGIADXCAAhnAYgANcIACHdBgEAvggAId4GAQC-CAAh3wYBAL4IACHgBkAAvwgAIeEGAQC8CAAhAwAAADQAIAEAAOoEADBzAADrBAAgAwAAADQAIAEAAMwBADACAADNAQAgDCwAALcJACChBQAAtgkAMKIFAADxBAAQowUAALYJADCnBUAAzQgAIboFAQAAAAHBBUAAzQgAIcoFAQDKCAAhzgUCAO8IACHPBSAA9AgAIbsGAQAAAAHcBiAA9AgAIQEAAADuBAAgAQAAAO4EACAMLAAAtwkAIKEFAAC2CQAwogUAAPEEABCjBQAAtgkAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIcoFAQDKCAAhzgUCAO8IACHPBSAA9AgAIbsGAQDKCAAh3AYgAPQIACECLAAAixEAINIHAACMEQAgAwAAAPEEACABAADyBAAwAgAA7gQAIAMAAADxBAAgAQAA8gQAMAIAAO4EACADAAAA8QQAIAEAAPIEADACAADuBAAgCSwAAIoRACCnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAABzgUCAAAAAc8FIAAAAAG7BgEAAAAB3AYgAAAAAQFpAAD2BAAgCKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHOBQIAAAABzwUgAAAAAbsGAQAAAAHcBiAAAAABAWkAAPgEADAJLAAAgBEAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzgUCAJcLACHPBSAAmAsAIbsGAQCDCwAh3AYgAJgLACECAAAA7gQAIGkAAPoEACAIpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHOBQIAlwsAIc8FIACYCwAhuwYBAIMLACHcBiAAmAsAIQIAAADxBAAgaQAA_AQAIAMAAADuBAAgbgAA9gQAIG8AAPoEACABAAAA7gQAIAEAAADxBAAgBQYAAPsQACB0AAD8EAAgdQAA_xAAIHYAAP4QACB3AAD9EAAgC6EFAAC1CQAwogUAAIIFABCjBQAAtQkAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIcoFAQC8CAAhzgUCANYIACHPBSAA1wgAIbsGAQC8CAAh3AYgANcIACEDAAAA8QQAIAEAAIEFADBzAACCBQAgAwAAAPEEACABAADyBAAwAgAA7gQAIAEAAAAyACABAAAAMgAgAwAAADAAIAEAADEAMAIAADIAIAMAAAAwACABAAAxADACAAAyACADAAAAMAAgAQAAMQAwAgAAMgAgFRcAAM8OACAgAACqDgAgIwAAqw4AIC4AAK0OACAxAACsDgAgPQAArg4AID4AAK8OACA_AACwDgAgpwVAAAAAAboFAQAAAAHBBUAAAAABiQYAAADbBgKQBgEAAAABqgYBAAAAAdQGQAAAAAHVBgIAAAAB1gYCAAAAAdcGIAAAAAHYBiAAAAAB2QYBAAAAAdsGAQAAAAEBaQAAigUAIA2nBUAAAAABugUBAAAAAcEFQAAAAAGJBgAAANsGApAGAQAAAAGqBgEAAAAB1AZAAAAAAdUGAgAAAAHWBgIAAAAB1wYgAAAAAdgGIAAAAAHZBgEAAAAB2wYBAAAAAQFpAACMBQAwFRcAAM0OACAgAAC4DQAgIwAAuQ0AIC4AALsNACAxAAC6DQAgPQAAvA0AID4AAL0NACA_AAC-DQAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhiQYAALYN2wYikAYBAIMLACGqBgEAhAsAIdQGQACFCwAh1QYCAJcLACHWBgIAlwsAIdcGIACYCwAh2AYgAJgLACHZBgEAhAsAIdsGAQCECwAhAgAAADIAIGkAAI4FACANpwVAAIULACG6BQEAgwsAIcEFQACFCwAhiQYAALYN2wYikAYBAIMLACGqBgEAhAsAIdQGQACFCwAh1QYCAJcLACHWBgIAlwsAIdcGIACYCwAh2AYgAJgLACHZBgEAhAsAIdsGAQCECwAhAgAAADAAIGkAAJAFACADAAAAMgAgbgAAigUAIG8AAI4FACABAAAAMgAgAQAAADAAIAgGAAD2EAAgdAAA9xAAIHUAAPoQACB2AAD5EAAgdwAA-BAAIKoGAAD_CgAg2QYAAP8KACDbBgAA_woAIBChBQAAsQkAMKIFAACWBQAQowUAALEJADCnBUAAvwgAIboFAQC8CAAhwQVAAL8IACGJBgAAsgnbBiKQBgEAvAgAIaoGAQC-CAAh1AZAAL8IACHVBgIA1ggAIdYGAgDWCAAh1wYgANcIACHYBiAA1wgAIdkGAQC-CAAh2wYBAL4IACEDAAAAMAAgAQAAlQUAMHMAAJYFACADAAAAMAAgAQAAMQAwAgAAMgAgAQAAAGQAIAEAAABkACADAAAAYgAgAQAAYwAwAgAAZAAgAwAAAGIAIAEAAGMAMAIAAGQAIAMAAABiACABAABjADACAABkACAJJAAApw4AICcAAN8PACAwAACoDgAgugUBAAAAAcEFQAAAAAGEBgEAAAABjQYBAAAAAdIGAAAA0gYC0wYQAAAAAQFpAACeBQAgBroFAQAAAAHBBUAAAAABhAYBAAAAAY0GAQAAAAHSBgAAANIGAtMGEAAAAAEBaQAAoAUAMAkkAACWDgAgJwAA3Q8AIDAAAJcOACC6BQEAgwsAIcEFQACFCwAhhAYBAIMLACGNBgEAgwsAIdIGAACTDtIGItMGEACUDgAhAgAAAGQAIGkAAKIFACAGugUBAIMLACHBBUAAhQsAIYQGAQCDCwAhjQYBAIMLACHSBgAAkw7SBiLTBhAAlA4AIQIAAABiACBpAACkBQAgAwAAAGQAIG4AAJ4FACBvAACiBQAgAQAAAGQAIAEAAABiACAGBgAA8RAAIHQAAPIQACB1AAD1EAAgdgAA9BAAIHcAAPMQACDTBgAA_woAIAmhBQAAqgkAMKIFAACqBQAQowUAAKoJADC6BQEAvAgAIcEFQAC_CAAhhAYBALwIACGNBgEAvAgAIdIGAACrCdIGItMGEACsCQAhAwAAAGIAIAEAAKkFADBzAACqBQAgAwAAAGIAIAEAAGMAMAIAAGQAIAEAAABoACABAAAAaAAgAwAAAGYAIAEAAGcAMAIAAGgAIAMAAABmACABAABnADACAABoACADAAAAZgAgAQAAZwAwAgAAaAAgFycAAKUOACArAACGDgAgLQAAhw4AIC8AAIgOACCnBUAAAAABugUBAAAAAcEFQAAAAAGDBgEAAAABhAYBAAAAAYkGAAAAzAYCwwYAAADDBgLEBgEAAAABxQYCAAAAAcYGAQAAAAHHBoAAAAAByAYBAAAAAckGAQAAAAHKBgEAAAABzAYBAAAAAc0GAQAAAAHOBkAAAAABzwYBAAAAAdAGQAAAAAEBaQAAsgUAIBOnBUAAAAABugUBAAAAAcEFQAAAAAGDBgEAAAABhAYBAAAAAYkGAAAAzAYCwwYAAADDBgLEBgEAAAABxQYCAAAAAcYGAQAAAAHHBoAAAAAByAYBAAAAAckGAQAAAAHKBgEAAAABzAYBAAAAAc0GAQAAAAHOBkAAAAABzwYBAAAAAdAGQAAAAAEBaQAAtAUAMBcnAACjDgAgKwAA9g0AIC0AAPcNACAvAAD4DQAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhgwYBAIQLACGEBgEAgwsAIYkGAAD1DcwGIsMGAAD0DcMGIsQGAQCDCwAhxQYCAKELACHGBgEAhAsAIccGgAAAAAHIBgEAhAsAIckGAQCECwAhygYBAIQLACHMBgEAhAsAIc0GAQCECwAhzgZAAIoLACHPBgEAhAsAIdAGQACKCwAhAgAAAGgAIGkAALYFACATpwVAAIULACG6BQEAgwsAIcEFQACFCwAhgwYBAIQLACGEBgEAgwsAIYkGAAD1DcwGIsMGAAD0DcMGIsQGAQCDCwAhxQYCAKELACHGBgEAhAsAIccGgAAAAAHIBgEAhAsAIckGAQCECwAhygYBAIQLACHMBgEAhAsAIc0GAQCECwAhzgZAAIoLACHPBgEAhAsAIdAGQACKCwAhAgAAAGYAIGkAALgFACADAAAAaAAgbgAAsgUAIG8AALYFACABAAAAaAAgAQAAAGYAIBEGAADsEAAgdAAA7RAAIHUAAPAQACB2AADvEAAgdwAA7hAAIIMGAAD_CgAgxQYAAP8KACDGBgAA_woAIMcGAAD_CgAgyAYAAP8KACDJBgAA_woAIMoGAAD_CgAgzAYAAP8KACDNBgAA_woAIM4GAAD_CgAgzwYAAP8KACDQBgAA_woAIBahBQAAowkAMKIFAAC-BQAQowUAAKMJADCnBUAAvwgAIboFAQC8CAAhwQVAAL8IACGDBgEAvggAIYQGAQC8CAAhiQYAAKUJzAYiwwYAAKQJwwYixAYBALwIACHFBgIA3ggAIcYGAQC-CAAhxwYAANMIACDIBgEAvggAIckGAQC-CAAhygYBAL4IACHMBgEAvggAIc0GAQC-CAAhzgZAAM8IACHPBgEAvggAIdAGQADPCAAhAwAAAGYAIAEAAL0FADBzAAC-BQAgAwAAAGYAIAEAAGcAMAIAAGgAIAEAAABvACABAAAAbwAgAwAAAG0AIAEAAG4AMAIAAG8AIAMAAABtACABAABuADACAABvACADAAAAbQAgAQAAbgAwAgAAbwAgBy4AAOsQACC6BQEAAAABwQVAAAAAAcIFAQAAAAHDBQAAAMEGAr8GAQAAAAHBBgEAAAABAWkAAMYFACAGugUBAAAAAcEFQAAAAAHCBQEAAAABwwUAAADBBgK_BgEAAAABwQYBAAAAAQFpAADIBQAwBy4AAOoQACC6BQEAgwsAIcEFQACFCwAhwgUBAIQLACHDBQAAgw7BBiK_BgEAgwsAIcEGAQCECwAhAgAAAG8AIGkAAMoFACAGugUBAIMLACHBBUAAhQsAIcIFAQCECwAhwwUAAIMOwQYivwYBAIMLACHBBgEAhAsAIQIAAABtACBpAADMBQAgAwAAAG8AIG4AAMYFACBvAADKBQAgAQAAAG8AIAEAAABtACAFBgAA5xAAIHYAAOkQACB3AADoEAAgwgUAAP8KACDBBgAA_woAIAmhBQAAnwkAMKIFAADSBQAQowUAAJ8JADC6BQEAvAgAIcEFQAC_CAAhwgUBAL4IACHDBQAAoAnBBiK_BgEAvAgAIcEGAQC-CAAhAwAAAG0AIAEAANEFADBzAADSBQAgAwAAAG0AIAEAAG4AMAIAAG8AIAEAAAA6ACABAAAAOgAgAwAAADgAIAEAADkAMAIAADoAIAMAAAA4ACABAAA5ADACAAA6ACADAAAAOAAgAQAAOQAwAgAAOgAgDRcAAOYQACAYAACrDQAgpwVAAAAAAboFAQAAAAHBBUAAAAABygUBAAAAAc8FIAAAAAHwBQEAAAABqgYBAAAAAbsGAQAAAAG8BhAAAAABvQYCAAAAAb4GAgAAAAEBaQAA2gUAIAunBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAABzwUgAAAAAfAFAQAAAAGqBgEAAAABuwYBAAAAAbwGEAAAAAG9BgIAAAABvgYCAAAAAQFpAADcBQAwDRcAAOUQACAYAACeDQAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHPBSAAmAsAIfAFAQCECwAhqgYBAIMLACG7BgEAgwsAIbwGEADwDAAhvQYCAJcLACG-BgIAlwsAIQIAAAA6ACBpAADeBQAgC6cFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzwUgAJgLACHwBQEAhAsAIaoGAQCDCwAhuwYBAIMLACG8BhAA8AwAIb0GAgCXCwAhvgYCAJcLACECAAAAOAAgaQAA4AUAIAMAAAA6ACBuAADaBQAgbwAA3gUAIAEAAAA6ACABAAAAOAAgBgYAAOAQACB0AADhEAAgdQAA5BAAIHYAAOMQACB3AADiEAAg8AUAAP8KACAOoQUAAJ4JADCiBQAA5gUAEKMFAACeCQAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAhygUBALwIACHPBSAA1wgAIfAFAQC-CAAhqgYBALwIACG7BgEAvAgAIbwGEACQCQAhvQYCANYIACG-BgIA1ggAIQMAAAA4ACABAADlBQAwcwAA5gUAIAMAAAA4ACABAAA5ADACAAA6ACABAAAASgAgAQAAAEoAIAMAAABIACABAABJADACAABKACADAAAASAAgAQAASQAwAgAASgAgAwAAAEgAIAEAAEkAMAIAAEoAIBoXAADfEAAgGAAAjw0AIBoAAJANACAbAACRDQAgHAAAkg0AIKcFQAAAAAG6BQEAAAABwQVAAAAAAYkGAAAAsAYCqQYBAAAAAaoGAQAAAAGrBgEAAAABrAYBAAAAAa0GAQAAAAGuBhAAAAABsAYAAACgBgKxBgAAAKEGArIGAQAAAAGzBgEAAAABtAYBAAAAAbUGAQAAAAG2BgEAAAABtwZAAAAAAbgGQAAAAAG5BkAAAAABugYBAAAAAQFpAADuBQAgFacFQAAAAAG6BQEAAAABwQVAAAAAAYkGAAAAsAYCqQYBAAAAAaoGAQAAAAGrBgEAAAABrAYBAAAAAa0GAQAAAAGuBhAAAAABsAYAAACgBgKxBgAAAKEGArIGAQAAAAGzBgEAAAABtAYBAAAAAbUGAQAAAAG2BgEAAAABtwZAAAAAAbgGQAAAAAG5BkAAAAABugYBAAAAAQFpAADwBQAwGhcAAN4QACAYAAD1DAAgGgAA9gwAIBsAAPcMACAcAAD4DAAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhiQYAAPEMsAYiqQYBAIMLACGqBgEAgwsAIasGAQCDCwAhrAYBAIMLACGtBgEAgwsAIa4GEADwDAAhsAYAAPIMoAYisQYAAPMMoQYisgYBAIQLACGzBgEAhAsAIbQGAQCECwAhtQYBAIQLACG2BgEAhAsAIbcGQACKCwAhuAZAAIoLACG5BkAAigsAIboGAQCECwAhAgAAAEoAIGkAAPIFACAVpwVAAIULACG6BQEAgwsAIcEFQACFCwAhiQYAAPEMsAYiqQYBAIMLACGqBgEAgwsAIasGAQCDCwAhrAYBAIMLACGtBgEAgwsAIa4GEADwDAAhsAYAAPIMoAYisQYAAPMMoQYisgYBAIQLACGzBgEAhAsAIbQGAQCECwAhtQYBAIQLACG2BgEAhAsAIbcGQACKCwAhuAZAAIoLACG5BkAAigsAIboGAQCECwAhAgAAAEgAIGkAAPQFACADAAAASgAgbgAA7gUAIG8AAPIFACABAAAASgAgAQAAAEgAIA4GAADZEAAgdAAA2hAAIHUAAN0QACB2AADcEAAgdwAA2xAAILIGAAD_CgAgswYAAP8KACC0BgAA_woAILUGAAD_CgAgtgYAAP8KACC3BgAA_woAILgGAAD_CgAguQYAAP8KACC6BgAA_woAIBihBQAAmgkAMKIFAAD6BQAQowUAAJoJADCnBUAAvwgAIboFAQC8CAAhwQVAAL8IACGJBgAAmwmwBiKpBgEAvAgAIaoGAQC8CAAhqwYBALwIACGsBgEAvAgAIa0GAQC8CAAhrgYQAJAJACGwBgAAkQmgBiKxBgAAkgmhBiKyBgEAvggAIbMGAQC-CAAhtAYBAL4IACG1BgEAvggAIbYGAQC-CAAhtwZAAM8IACG4BkAAzwgAIbkGQADPCAAhugYBAL4IACEDAAAASAAgAQAA-QUAMHMAAPoFACADAAAASAAgAQAASQAwAgAASgAgAQAAAD4AIAEAAAA-ACADAAAAPAAgAQAAPQAwAgAAPgAgAwAAADwAIAEAAD0AMAIAAD4AIAMAAAA8ACABAAA9ADACAAA-ACAJGQAAqQ0AIB0AAI0NACC6BQEAAAABwQVAAAAAAZ0GAQAAAAGlBgEAAAABpgYCAAAAAacGEAAAAAGoBhAAAAABAWkAAIIGACAHugUBAAAAAcEFQAAAAAGdBgEAAAABpQYBAAAAAaYGAgAAAAGnBhAAAAABqAYQAAAAAQFpAACEBgAwCRkAAKcNACAdAACLDQAgugUBAIMLACHBBUAAhQsAIZ0GAQCDCwAhpQYBAIMLACGmBgIAlwsAIacGEADwDAAhqAYQAPAMACECAAAAPgAgaQAAhgYAIAe6BQEAgwsAIcEFQACFCwAhnQYBAIMLACGlBgEAgwsAIaYGAgCXCwAhpwYQAPAMACGoBhAA8AwAIQIAAAA8ACBpAACIBgAgAwAAAD4AIG4AAIIGACBvAACGBgAgAQAAAD4AIAEAAAA8ACAFBgAA1BAAIHQAANUQACB1AADYEAAgdgAA1xAAIHcAANYQACAKoQUAAJkJADCiBQAAjgYAEKMFAACZCQAwugUBALwIACHBBUAAvwgAIZ0GAQC8CAAhpQYBALwIACGmBgIA1ggAIacGEACQCQAhqAYQAJAJACEDAAAAPAAgAQAAjQYAMHMAAI4GACADAAAAPAAgAQAAPQAwAgAAPgAgAQAAAO0BACABAAAA7QEAIAMAAABBACABAADsAQAwAgAA7QEAIAMAAABBACABAADsAQAwAgAA7QEAIAMAAABBACABAADsAQAwAgAA7QEAIA4LAAD_DAAgGQAA0xAAIC0AAACgBgKnBUAAAAABugUBAAAAAcEFQAAAAAHeBQEAAAABiQYAAAChBgKdBgEAAAABngYQAAAAAaEGAQAAAAGiBgEAAAABowYBAAAAAaQGQAAAAAEBaQAAlgYAIAwtAAAAoAYCpwVAAAAAAboFAQAAAAHBBUAAAAAB3gUBAAAAAYkGAAAAoQYCnQYBAAAAAZ4GEAAAAAGhBgEAAAABogYBAAAAAaMGAQAAAAGkBkAAAAABAWkAAJgGADAOCwAA_gwAIBkAANIQACAtAADyDKAGIqcFQACFCwAhugUBAIMLACHBBUAAhQsAId4FAQCECwAhiQYAAPMMoQYinQYBAIMLACGeBhAA8AwAIaEGAQCECwAhogYBAIQLACGjBgEAhAsAIaQGQACKCwAhAgAAAO0BACBpAACaBgAgDC0AAPIMoAYipwVAAIULACG6BQEAgwsAIcEFQACFCwAh3gUBAIQLACGJBgAA8wyhBiKdBgEAgwsAIZ4GEADwDAAhoQYBAIQLACGiBgEAhAsAIaMGAQCECwAhpAZAAIoLACECAAAAQQAgaQAAnAYAIAMAAADtAQAgbgAAlgYAIG8AAJoGACABAAAA7QEAIAEAAABBACAKBgAAzRAAIHQAAM4QACB1AADREAAgdgAA0BAAIHcAAM8QACDeBQAA_woAIKEGAAD_CgAgogYAAP8KACCjBgAA_woAIKQGAAD_CgAgDy0AAJEJoAYioQUAAI8JADCiBQAAogYAEKMFAACPCQAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAh3gUBAL4IACGJBgAAkgmhBiKdBgEAvAgAIZ4GEACQCQAhoQYBAL4IACGiBgEAvggAIaMGAQC-CAAhpAZAAM8IACEDAAAAQQAgAQAAoQYAMHMAAKIGACADAAAAQQAgAQAA7AEAMAIAAO0BACABAAAAsgEAIAEAAACyAQAgAwAAALABACABAACxAQAwAgAAsgEAIAMAAACwAQAgAQAAsQEAMAIAALIBACADAAAAsAEAIAEAALEBADACAACyAQAgFxUAAIwPACAgAADTDAAgKwAA1AwAIDEAANUMACA2AADWDAAgpwVAAAAAAboFAQAAAAHBBUAAAAABygUBAAAAAeMFAQAAAAHwBQEAAAABiQYAAACUBgKQBgEAAAABkgYAAACSBgKUBgIAAAABlQYBAAAAAZYGAQAAAAGXBgEAAAABmAZAAAAAAZkGQAAAAAGaBgEAAAABmwYgAAAAAZwGIAAAAAEBaQAAqgYAIBKnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAAB4wUBAAAAAfAFAQAAAAGJBgAAAJQGApAGAQAAAAGSBgAAAJIGApQGAgAAAAGVBgEAAAABlgYBAAAAAZcGAQAAAAGYBkAAAAABmQZAAAAAAZoGAQAAAAGbBiAAAAABnAYgAAAAAQFpAACsBgAwFxUAAIoPACAgAADqCwAgKwAA6wsAIDEAAOwLACA2AADtCwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHjBQEAgwsAIfAFAQCECwAhiQYAAOgLlAYikAYBAIMLACGSBgAA5wuSBiKUBgIAlwsAIZUGAQCECwAhlgYBAIQLACGXBgEAhAsAIZgGQACKCwAhmQZAAIoLACGaBgEAhAsAIZsGIACYCwAhnAYgAJgLACECAAAAsgEAIGkAAK4GACASpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHjBQEAgwsAIfAFAQCECwAhiQYAAOgLlAYikAYBAIMLACGSBgAA5wuSBiKUBgIAlwsAIZUGAQCECwAhlgYBAIQLACGXBgEAhAsAIZgGQACKCwAhmQZAAIoLACGaBgEAhAsAIZsGIACYCwAhnAYgAJgLACECAAAAsAEAIGkAALAGACADAAAAsgEAIG4AAKoGACBvAACuBgAgAQAAALIBACABAAAAsAEAIAwGAADIEAAgdAAAyRAAIHUAAMwQACB2AADLEAAgdwAAyhAAIPAFAAD_CgAglQYAAP8KACCWBgAA_woAIJcGAAD_CgAgmAYAAP8KACCZBgAA_woAIJoGAAD_CgAgFaEFAACICQAwogUAALYGABCjBQAAiAkAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIcoFAQC8CAAh4wUBALwIACHwBQEAvggAIYkGAACKCZQGIpAGAQC8CAAhkgYAAIkJkgYilAYCANYIACGVBgEAvggAIZYGAQC-CAAhlwYBAL4IACGYBkAAzwgAIZkGQADPCAAhmgYBAL4IACGbBiAA1wgAIZwGIADXCAAhAwAAALABACABAAC1BgAwcwAAtgYAIAMAAACwAQAgAQAAsQEAMAIAALIBACABAAAAegAgAQAAAHoAIAMAAAB4ACABAAB5ADACAAB6ACADAAAAeAAgAQAAeQAwAgAAegAgAwAAAHgAIAEAAHkAMAIAAHoAIAskAADODAAgMgAAlw8AIDMAAM8MACA0AADQDAAgNQAA0QwAILoFAQAAAAHBBUAAAAABiQYAAACQBgKKBgEAAAABjQYBAAAAAY4GAgAAAAEBaQAAvgYAIAa6BQEAAAABwQVAAAAAAYkGAAAAkAYCigYBAAAAAY0GAQAAAAGOBgIAAAABAWkAAMAGADALJAAArgwAIDIAAJUPACAzAACvDAAgNAAAsAwAIDUAALEMACC6BQEAgwsAIcEFQACFCwAhiQYAAKwMkAYiigYBAIMLACGNBgEAgwsAIY4GAgCXCwAhAgAAAHoAIGkAAMIGACAGugUBAIMLACHBBUAAhQsAIYkGAACsDJAGIooGAQCDCwAhjQYBAIMLACGOBgIAlwsAIQIAAAB4ACBpAADEBgAgAwAAAHoAIG4AAL4GACBvAADCBgAgAQAAAHoAIAEAAAB4ACAFBgAAwxAAIHQAAMQQACB1AADHEAAgdgAAxhAAIHcAAMUQACAJoQUAAIQJADCiBQAAygYAEKMFAACECQAwugUBALwIACHBBUAAvwgAIYkGAACFCZAGIooGAQC8CAAhjQYBALwIACGOBgIA1ggAIQMAAAB4ACABAADJBgAwcwAAygYAIAMAAAB4ACABAAB5ADACAAB6ACABAAAAhgEAIAEAAACGAQAgAwAAAIQBACABAACFAQAwAgAAhgEAIAMAAACEAQAgAQAAhQEAMAIAAIYBACADAAAAhAEAIAEAAIUBADACAACGAQAgCDIAAMIQACA3AAChDAAgugUBAAAAAbwFAAAAjAYCwQVAAAAAAcoFAQAAAAGKBgEAAAABjAYCAAAAAQFpAADSBgAgBroFAQAAAAG8BQAAAIwGAsEFQAAAAAHKBQEAAAABigYBAAAAAYwGAgAAAAEBaQAA1AYAMAgyAADBEAAgNwAA-gsAILoFAQCDCwAhvAUAAPgLjAYiwQVAAIULACHKBQEAgwsAIYoGAQCDCwAhjAYCAJcLACECAAAAhgEAIGkAANYGACAGugUBAIMLACG8BQAA-AuMBiLBBUAAhQsAIcoFAQCDCwAhigYBAIMLACGMBgIAlwsAIQIAAACEAQAgaQAA2AYAIAMAAACGAQAgbgAA0gYAIG8AANYGACABAAAAhgEAIAEAAACEAQAgBQYAALwQACB0AAC9EAAgdQAAwBAAIHYAAL8QACB3AAC-EAAgCaEFAACACQAwogUAAN4GABCjBQAAgAkAMLoFAQC8CAAhvAUAAIEJjAYiwQVAAL8IACHKBQEAvAgAIYoGAQC8CAAhjAYCANYIACEDAAAAhAEAIAEAAN0GADBzAADeBgAgAwAAAIQBACABAACFAQAwAgAAhgEAIAEAAAB9ACABAAAAfQAgAwAAAHQAIAEAAHwAMAIAAH0AIAMAAAB0ACABAAB8ADACAAB9ACADAAAAdAAgAQAAfAAwAgAAfQAgFCcAAJwMACArAACbDAAgOAAAmAwAIDkAAJkMACA6AACaDAAgOwAAnwwAIDwAAJ0MACCnBUAAAAABugUBAAAAAcEFQAAAAAH-BQEAAAAB_wUCAAAAAYAGAgAAAAGBBgEAAAABggYBAAAAAYMGAQAAAAGEBgEAAAABhQYBAAAAAYcGAAAAhwYDiQYAAACJBgIBaQAA5gYAIA2nBUAAAAABugUBAAAAAcEFQAAAAAH-BQEAAAAB_wUCAAAAAYAGAgAAAAGBBgEAAAABggYBAAAAAYMGAQAAAAGEBgEAAAABhQYBAAAAAYcGAAAAhwYDiQYAAACJBgIBaQAA6AYAMBQnAACLDAAgKwAAigwAIDgAAJYMACA5AACIDAAgOgAAiQwAIDsAAIwMACA8AACNDAAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAh_gUBAIMLACH_BQIAlwsAIYAGAgCXCwAhgQYBAIQLACGCBgEAhAsAIYMGAQCECwAhhAYBAIQLACGFBgEAhAsAIYcGAACFDIcGI4kGAACGDIkGIgIAAAB9ACBpAADqBgAgDacFQACFCwAhugUBAIMLACHBBUAAhQsAIf4FAQCDCwAh_wUCAJcLACGABgIAlwsAIYEGAQCECwAhggYBAIQLACGDBgEAhAsAIYQGAQCECwAhhQYBAIQLACGHBgAAhQyHBiOJBgAAhgyJBiICAAAAdAAgaQAA7AYAIAMAAAB9ACBuAADmBgAgbwAA6gYAIAEAAAB9ACABAAAAdAAgCwYAALcQACB0AAC4EAAgdQAAuxAAIHYAALoQACB3AAC5EAAggQYAAP8KACCCBgAA_woAIIMGAAD_CgAghAYAAP8KACCFBgAA_woAIIcGAAD_CgAgEKEFAAD5CAAwogUAAPIGABCjBQAA-QgAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIf4FAQC8CAAh_wUCANYIACGABgIA1ggAIYEGAQC-CAAhggYBAL4IACGDBgEAvggAIYQGAQC-CAAhhQYBAL4IACGHBgAA-giHBiOJBgAA-wiJBiIDAAAAdAAgAQAA8QYAMHMAAPIGACADAAAAdAAgAQAAfAAwAgAAfQAgAQAAANIBACABAAAA0gEAIAMAAADQAQAgAQAA0QEAMAIAANIBACADAAAA0AEAIAEAANEBADACAADSAQAgAwAAANABACABAADRAQAwAgAA0gEAIBhVAADHCwAgVgAAyAsAIFcAANMLACCnBUAAAAABugUBAAAAAcEFQAAAAAHOBQIAAAABzwUgAAAAAe0FAQAAAAHuBQEAAAAB7wUBAAAAAfAFAQAAAAHxBUAAAAAB8gUBAAAAAfMFAQAAAAH0BQEAAAAB9QUBAAAAAfYFAQAAAAH3BQEAAAAB-AUBAAAAAfkFIAAAAAH7BQAAAPsFAvwFQAAAAAH9BUAAAAABAWkAAPoGACAVpwVAAAAAAboFAQAAAAHBBUAAAAABzgUCAAAAAc8FIAAAAAHtBQEAAAAB7gUBAAAAAe8FAQAAAAHwBQEAAAAB8QVAAAAAAfIFAQAAAAHzBQEAAAAB9AUBAAAAAfUFAQAAAAH2BQEAAAAB9wUBAAAAAfgFAQAAAAH5BSAAAAAB-wUAAAD7BQL8BUAAAAAB_QVAAAAAAQFpAAD8BgAwGFUAAMQLACBWAADFCwAgVwAA0QsAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIc4FAgCXCwAhzwUgAJgLACHtBQEAgwsAIe4FAQCECwAh7wUBAIMLACHwBQEAhAsAIfEFQACKCwAh8gUBAIQLACHzBQEAhAsAIfQFAQCECwAh9QUBAIQLACH2BQEAhAsAIfcFAQCECwAh-AUBAIQLACH5BSAAmAsAIfsFAADCC_sFIvwFQACKCwAh_QVAAIoLACECAAAA0gEAIGkAAP4GACAVpwVAAIULACG6BQEAgwsAIcEFQACFCwAhzgUCAJcLACHPBSAAmAsAIe0FAQCDCwAh7gUBAIQLACHvBQEAgwsAIfAFAQCECwAh8QVAAIoLACHyBQEAhAsAIfMFAQCECwAh9AUBAIQLACH1BQEAhAsAIfYFAQCECwAh9wUBAIQLACH4BQEAhAsAIfkFIACYCwAh-wUAAMIL-wUi_AVAAIoLACH9BUAAigsAIQIAAADQAQAgaQAAgAcAIAMAAADSAQAgbgAA-gYAIG8AAP4GACABAAAA0gEAIAEAAADQAQAgEQYAALIQACB0AACzEAAgdQAAthAAIHYAALUQACB3AAC0EAAg7gUAAP8KACDwBQAA_woAIPEFAAD_CgAg8gUAAP8KACDzBQAA_woAIPQFAAD_CgAg9QUAAP8KACD2BQAA_woAIPcFAAD_CgAg-AUAAP8KACD8BQAA_woAIP0FAAD_CgAgGKEFAAD1CAAwogUAAIYHABCjBQAA9QgAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIc4FAgDWCAAhzwUgANcIACHtBQEAvAgAIe4FAQC-CAAh7wUBALwIACHwBQEAvggAIfEFQADPCAAh8gUBAL4IACHzBQEAvggAIfQFAQC-CAAh9QUBAL4IACH2BQEAvggAIfcFAQC-CAAh-AUBAL4IACH5BSAA1wgAIfsFAAD2CPsFIvwFQADPCAAh_QVAAM8IACEDAAAA0AEAIAEAAIUHADBzAACGBwAgAwAAANABACABAADRAQAwAgAA0gEAIBCtBAAA6ggAIK8EAADrCAAgsAQAAOwIACChBQAA6QgAMKIFAACTBwAQowUAAOkIADCnBUAAzQgAIboFAQAAAAG9BQEAyggAIcEFQADNCAAh4wUBAAAAAeQFAQDMCAAh5QUBAMwIACHmBQEAAAAB5wVAAM0IACHoBQEAzAgAIQEAAACJBwAgDKwEAADwCAAgoQUAAPIIADCiBQAAiwcAEKMFAADyCAAwpwVAAM0IACG6BQEAyggAIbwFAADzCOEFIsEFQADNCAAhzgUCAO8IACHcBQEAyggAIeEFIAD0CAAh4gUAAMsIACACrAQAAK8QACDSBwAAsRAAIAysBAAA8AgAIKEFAADyCAAwogUAAIsHABCjBQAA8ggAMKcFQADNCAAhugUBAAAAAbwFAADzCOEFIsEFQADNCAAhzgUCAO8IACHcBQEAyggAIeEFIAD0CAAh4gUAAMsIACADAAAAiwcAIAEAAIwHADACAACNBwAgDEACAO8IACGsBAAA8AgAIK4EAADxCAAgoQUAAO4IADCiBQAAjwcAEKMFAADuCAAwugUBAMoIACHBBUAAzQgAIdwFAQDKCAAh3QUAAMsIACDeBQEAzAgAId8FAQDMCAAhBawEAACvEAAgrgQAAK8QACDeBQAA_woAIN8FAAD_CgAg0gcAALAQACANQAIA7wgAIawEAADwCAAgrgQAAPEIACChBQAA7ggAMKIFAACPBwAQowUAAO4IADC6BQEAAAABwQVAAM0IACHcBQEAyggAId0FAADLCAAg3gUBAMwIACHfBQEAzAgAIewFAADtCAAgAwAAAI8HACABAACQBwAwAgAAkQcAIBCtBAAA6ggAIK8EAADrCAAgsAQAAOwIACChBQAA6QgAMKIFAACTBwAQowUAAOkIADCnBUAAzQgAIboFAQDKCAAhvQUBAMoIACHBBUAAzQgAIeMFAQDKCAAh5AUBAMwIACHlBQEAzAgAIeYFAQDMCAAh5wVAAM0IACHoBQEAzAgAIQEAAACTBwAgAQAAAI8HACABAAAAiwcAIAEAAACPBwAgAQAAAIkHACAIrQQAAKsQACCvBAAArBAAILAEAACtEAAg5AUAAP8KACDlBQAA_woAIOYFAAD_CgAg6AUAAP8KACDSBwAArhAAIAMAAACTBwAgAQAAmQcAMAIAAIkHACADAAAAkwcAIAEAAJkHADACAACJBwAgAwAAAJMHACABAACZBwAwAgAAiQcAIA2tBAAAnBAAIK8EAACdEAAgsAQAAKoQACCnBUAAAAABugUBAAAAAb0FAQAAAAHBBUAAAAAB4wUBAAAAAeQFAQAAAAHlBQEAAAAB5gUBAAAAAecFQAAAAAHoBQEAAAABAWkAAJ0HACAKpwVAAAAAAboFAQAAAAG9BQEAAAABwQVAAAAAAeMFAQAAAAHkBQEAAAAB5QUBAAAAAeYFAQAAAAHnBUAAAAAB6AUBAAAAAQFpAACfBwAwDa0EAACAEAAgrwQAAIEQACCwBAAAqRAAIKcFQACFCwAhugUBAIMLACG9BQEAgwsAIcEFQACFCwAh4wUBAIMLACHkBQEAhAsAIeUFAQCECwAh5gUBAIQLACHnBUAAhQsAIegFAQCECwAhAgAAAIkHACBpAAChBwAgCqcFQACFCwAhugUBAIMLACG9BQEAgwsAIcEFQACFCwAh4wUBAIMLACHkBQEAhAsAIeUFAQCECwAh5gUBAIQLACHnBUAAhQsAIegFAQCECwAhAgAAAJMHACBpAACjBwAgAwAAAIkHACBuAACdBwAgbwAAoQcAIAEAAACJBwAgAQAAAJMHACAHBgAAphAAIHYAAKgQACB3AACnEAAg5AUAAP8KACDlBQAA_woAIOYFAAD_CgAg6AUAAP8KACANoQUAAOgIADCiBQAAqQcAEKMFAADoCAAwpwVAAL8IACG6BQEAvAgAIb0FAQC8CAAhwQVAAL8IACHjBQEAvAgAIeQFAQC-CAAh5QUBAL4IACHmBQEAvggAIecFQAC_CAAh6AUBAL4IACEDAAAAkwcAIAEAAKgHADBzAACpBwAgAwAAAJMHACABAACZBwAwAgAAiQcAIAEAAACNBwAgAQAAAI0HACADAAAAiwcAIAEAAIwHADACAACNBwAgAwAAAIsHACABAACMBwAwAgAAjQcAIAMAAACLBwAgAQAAjAcAMAIAAI0HACAJrAQAAKUQACCnBUAAAAABugUBAAAAAbwFAAAA4QUCwQVAAAAAAc4FAgAAAAHcBQEAAAAB4QUgAAAAAeIFgAAAAAEBaQAAsQcAIAinBUAAAAABugUBAAAAAbwFAAAA4QUCwQVAAAAAAc4FAgAAAAHcBQEAAAAB4QUgAAAAAeIFgAAAAAEBaQAAswcAMAmsBAAApBAAIKcFQACFCwAhugUBAIMLACG8BQAAmRDhBSLBBUAAhQsAIc4FAgCXCwAh3AUBAIMLACHhBSAAmAsAIeIFgAAAAAECAAAAjQcAIGkAALUHACAIpwVAAIULACG6BQEAgwsAIbwFAACZEOEFIsEFQACFCwAhzgUCAJcLACHcBQEAgwsAIeEFIACYCwAh4gWAAAAAAQIAAACLBwAgaQAAtwcAIAMAAACNBwAgbgAAsQcAIG8AALUHACABAAAAjQcAIAEAAACLBwAgBQYAAJ8QACB0AACgEAAgdQAAoxAAIHYAAKIQACB3AAChEAAgC6EFAADkCAAwogUAAL0HABCjBQAA5AgAMKcFQAC_CAAhugUBALwIACG8BQAA5QjhBSLBBUAAvwgAIc4FAgDWCAAh3AUBALwIACHhBSAA1wgAIeIFAAC9CAAgAwAAAIsHACABAAC8BwAwcwAAvQcAIAMAAACLBwAgAQAAjAcAMAIAAI0HACABAAAAkQcAIAEAAACRBwAgAwAAAI8HACABAACQBwAwAgAAkQcAIAMAAACPBwAgAQAAkAcAMAIAAJEHACADAAAAjwcAIAEAAJAHADACAACRBwAgCUACAAAAAawEAACeEAAgrgQAAI4QACC6BQEAAAABwQVAAAAAAdwFAQAAAAHdBYAAAAAB3gUBAAAAAd8FAQAAAAEBaQAAxQcAIAdAAgAAAAG6BQEAAAABwQVAAAAAAdwFAQAAAAHdBYAAAAAB3gUBAAAAAd8FAQAAAAEBaQAAxwcAMAlAAgCXCwAhrAQAAPkPACCuBAAA-g8AILoFAQCDCwAhwQVAAIULACHcBQEAgwsAId0FgAAAAAHeBQEAhAsAId8FAQCECwAhAgAAAJEHACBpAADJBwAgB0ACAJcLACG6BQEAgwsAIcEFQACFCwAh3AUBAIMLACHdBYAAAAAB3gUBAIQLACHfBQEAhAsAIQIAAACPBwAgaQAAywcAIAMAAACRBwAgbgAAxQcAIG8AAMkHACABAAAAkQcAIAEAAACPBwAgBwYAAPQPACB0AAD1DwAgdQAA-A8AIHYAAPcPACB3AAD2DwAg3gUAAP8KACDfBQAA_woAIApAAgDWCAAhoQUAAOMIADCiBQAA0QcAEKMFAADjCAAwugUBALwIACHBBUAAvwgAIdwFAQC8CAAh3QUAAL0IACDeBQEAvggAId8FAQC-CAAhAwAAAI8HACABAADQBwAwcwAA0QcAIAMAAACPBwAgAQAAkAcAMAIAAJEHACABAAAAKAAgAQAAACgAIAMAAAAmACABAAAnADACAAAoACADAAAAJgAgAQAAJwAwAgAAKAAgAwAAACYAIAEAACcAMAIAACgAIBkTAADqDwAgUAAA6w8AIFEAAOwPACBSAADtDwAgUwAA7g8AIFQAAO8PACBYAADwDwAgWQAA8Q8AIFoAAPIPACBcAADzDwAgpwVAAAAAAboFAQAAAAHBBUAAAAABzAUBAAAAAdAFAQAAAAHSBQAAANIFAtMFAQAAAAHUBQIAAAAB1QUCAAAAAdYFAgAAAAHXBQEAAAAB2AUBAAAAAdkFAQAAAAHaBQEAAAAB2wVAAAAAAQFpAADZBwAgD6cFQAAAAAG6BQEAAAABwQVAAAAAAcwFAQAAAAHQBQEAAAAB0gUAAADSBQLTBQEAAAAB1AUCAAAAAdUFAgAAAAHWBQIAAAAB1wUBAAAAAdgFAQAAAAHZBQEAAAAB2gUBAAAAAdsFQAAAAAEBaQAA2wcAMBkTAACiCwAgUAAAowsAIFEAAKQLACBSAAClCwAgUwAApgsAIFQAAKcLACBYAACoCwAgWQAAqQsAIFoAAKoLACBcAACrCwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhzAUBAIMLACHQBQEAgwsAIdIFAACgC9IFItMFAQCDCwAh1AUCAJcLACHVBQIAoQsAIdYFAgChCwAh1wUBAIMLACHYBQEAhAsAIdkFAQCDCwAh2gUBAIQLACHbBUAAigsAIQIAAAAoACBpAADdBwAgD6cFQACFCwAhugUBAIMLACHBBUAAhQsAIcwFAQCDCwAh0AUBAIMLACHSBQAAoAvSBSLTBQEAgwsAIdQFAgCXCwAh1QUCAKELACHWBQIAoQsAIdcFAQCDCwAh2AUBAIQLACHZBQEAgwsAIdoFAQCECwAh2wVAAIoLACECAAAAJgAgaQAA3wcAIAMAAAAoACBuAADZBwAgbwAA3QcAIAEAAAAoACABAAAAJgAgCgYAAJsLACB0AACcCwAgdQAAnwsAIHYAAJ4LACB3AACdCwAg1QUAAP8KACDWBQAA_woAINgFAAD_CgAg2gUAAP8KACDbBQAA_woAIBKhBQAA3AgAMKIFAADlBwAQowUAANwIADCnBUAAvwgAIboFAQC8CAAhwQVAAL8IACHMBQEAvAgAIdAFAQC8CAAh0gUAAN0I0gUi0wUBALwIACHUBQIA1ggAIdUFAgDeCAAh1gUCAN4IACHXBQEAvAgAIdgFAQC-CAAh2QUBALwIACHaBQEAvggAIdsFQADPCAAhAwAAACYAIAEAAOQHADBzAADlBwAgAwAAACYAIAEAACcAMAIAACgAIAEAAADbAQAgAQAAANsBACADAAAA2QEAIAEAANoBADACAADbAQAgAwAAANkBACABAADaAQAwAgAA2wEAIAMAAADZAQAgAQAA2gEAMAIAANsBACAKWwAAmgsAIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHLBQEAAAABzAUBAAAAAc0FAQAAAAHOBQIAAAABzwUgAAAAAQFpAADtBwAgCacFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHLBQEAAAABzAUBAAAAAc0FAQAAAAHOBQIAAAABzwUgAAAAAQFpAADvBwAwClsAAJkLACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIcsFAQCECwAhzAUBAIQLACHNBQEAgwsAIc4FAgCXCwAhzwUgAJgLACECAAAA2wEAIGkAAPEHACAJpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHLBQEAhAsAIcwFAQCECwAhzQUBAIMLACHOBQIAlwsAIc8FIACYCwAhAgAAANkBACBpAADzBwAgAwAAANsBACBuAADtBwAgbwAA8QcAIAEAAADbAQAgAQAAANkBACAHBgAAkgsAIHQAAJMLACB1AACWCwAgdgAAlQsAIHcAAJQLACDLBQAA_woAIMwFAAD_CgAgDKEFAADVCAAwogUAAPkHABCjBQAA1QgAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIcoFAQC8CAAhywUBAL4IACHMBQEAvggAIc0FAQC8CAAhzgUCANYIACHPBSAA1wgAIQMAAADZAQAgAQAA-AcAMHMAAPkHACADAAAA2QEAIAEAANoBADACAADbAQAgAQAAAB8AIAEAAAAfACADAAAAHQAgAQAAHgAwAgAAHwAgAwAAAB0AIAEAAB4AMAIAAB8AIAMAAAAdACABAAAeADACAAAfACALEAAAkQsAILoFAQAAAAHBBUAAAAABwgUBAAAAAcMFAQAAAAHEBQEAAAABxQUBAAAAAcYFAQAAAAHHBYAAAAAByAUBAAAAAckFAQAAAAEBaQAAgQgAIAq6BQEAAAABwQVAAAAAAcIFAQAAAAHDBQEAAAABxAUBAAAAAcUFAQAAAAHGBQEAAAABxwWAAAAAAcgFAQAAAAHJBQEAAAABAWkAAIMIADALEAAAkAsAILoFAQCDCwAhwQVAAIULACHCBQEAhAsAIcMFAQCDCwAhxAUBAIMLACHFBQEAhAsAIcYFAQCDCwAhxwWAAAAAAcgFAQCECwAhyQUBAIQLACECAAAAHwAgaQAAhQgAIAq6BQEAgwsAIcEFQACFCwAhwgUBAIQLACHDBQEAgwsAIcQFAQCDCwAhxQUBAIQLACHGBQEAgwsAIccFgAAAAAHIBQEAhAsAIckFAQCECwAhAgAAAB0AIGkAAIcIACADAAAAHwAgbgAAgQgAIG8AAIUIACABAAAAHwAgAQAAAB0AIAgGAACNCwAgdgAAjwsAIHcAAI4LACDCBQAA_woAIMUFAAD_CgAgxwUAAP8KACDIBQAA_woAIMkFAAD_CgAgDaEFAADSCAAwogUAAI0IABCjBQAA0ggAMLoFAQC8CAAhwQVAAL8IACHCBQEAvggAIcMFAQC8CAAhxAUBALwIACHFBQEAvggAIcYFAQC8CAAhxwUAANMIACDIBQEAvggAIckFAQC-CAAhAwAAAB0AIAEAAIwIADBzAACNCAAgAwAAAB0AIAEAAB4AMAIAAB8AIAEAAAAkACABAAAAJAAgAwAAACIAIAEAACMAMAIAACQAIAMAAAAiACABAAAjADACAAAkACADAAAAIgAgAQAAIwAwAgAAJAAgCQMAAIwLACC6BQEAAAABuwUBAAAAAbwFAQAAAAG9BQEAAAABvgUBAAAAAb8FAQAAAAHABUAAAAABwQVAAAAAAQFpAACVCAAgCLoFAQAAAAG7BQEAAAABvAUBAAAAAb0FAQAAAAG-BQEAAAABvwUBAAAAAcAFQAAAAAHBBUAAAAABAWkAAJcIADAJAwAAiwsAILoFAQCDCwAhuwUBAIMLACG8BQEAgwsAIb0FAQCDCwAhvgUBAIQLACG_BQEAhAsAIcAFQACKCwAhwQVAAIULACECAAAAJAAgaQAAmQgAIAi6BQEAgwsAIbsFAQCDCwAhvAUBAIMLACG9BQEAgwsAIb4FAQCECwAhvwUBAIQLACHABUAAigsAIcEFQACFCwAhAgAAACIAIGkAAJsIACADAAAAJAAgbgAAlQgAIG8AAJkIACABAAAAJAAgAQAAACIAIAYGAACHCwAgdgAAiQsAIHcAAIgLACC-BQAA_woAIL8FAAD_CgAgwAUAAP8KACALoQUAAM4IADCiBQAAoQgAEKMFAADOCAAwugUBALwIACG7BQEAvAgAIbwFAQC8CAAhvQUBALwIACG-BQEAvggAIb8FAQC-CAAhwAVAAM8IACHBBUAAvwgAIQMAAAAiACABAACgCAAwcwAAoQgAIAMAAAAiACABAAAjADACAAAkACAHoQUAAMkIADCiBQAApwgAEKMFAADJCAAwpAUBAAAAAaUFAADLCAAgpgUBAMwIACGnBUAAzQgAIQEAAACkCAAgAQAAAKQIACAHoQUAAMkIADCiBQAApwgAEKMFAADJCAAwpAUBAMoIACGlBQAAywgAIKYFAQDMCAAhpwVAAM0IACECpgUAAP8KACDSBwAAhgsAIAMAAACnCAAgAQAAqAgAMAIAAKQIACADAAAApwgAIAEAAKgIADACAACkCAAgAwAAAKcIACABAACoCAAwAgAApAgAIASkBQEAAAABpQWAAAAAAaYFAQAAAAGnBUAAAAABAWkAAKwIACAEpAUBAAAAAaUFgAAAAAGmBQEAAAABpwVAAAAAAQFpAACuCAAwBKQFAQCDCwAhpQWAAAAAAaYFAQCECwAhpwVAAIULACECAAAApAgAIGkAALAIACAEpAUBAIMLACGlBYAAAAABpgUBAIQLACGnBUAAhQsAIQIAAACnCAAgaQAAsggAIAMAAACkCAAgbgAArAgAIG8AALAIACABAAAApAgAIAEAAACnCAAgBAYAAIALACB2AACCCwAgdwAAgQsAIKYFAAD_CgAgB6EFAAC7CAAwogUAALgIABCjBQAAuwgAMKQFAQC8CAAhpQUAAL0IACCmBQEAvggAIacFQAC_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_BQEAvggAIcAFQADPCAAhwQVAAL8IACELBgAAxAgAIHYAANEIACB3AADRCAAgqAVAAAAAAakFQAAAAAWqBUAAAAAFqwVAAAAAAawFQAAAAAGtBUAAAAABrgVAAAAAAa8FQADQCAAhCwYAAMQIACB2AADRCAAgdwAA0QgAIKgFQAAAAAGpBUAAAAAFqgVAAAAABasFQAAAAAGsBUAAAAABrQVAAAAAAa4FQAAAAAGvBUAA0AgAIQioBUAAAAABqQVAAAAABaoFQAAAAAWrBUAAAAABrAVAAAAAAa0FQAAAAAGuBUAAAAABrwVAANEIACENoQUAANIIADCiBQAAjQgAEKMFAADSCAAwugUBALwIACHBBUAAvwgAIcIFAQC-CAAhwwUBALwIACHEBQEAvAgAIcUFAQC-CAAhxgUBALwIACHHBQAA0wgAIMgFAQC-CAAhyQUBAL4IACEPBgAAxAgAIHYAANQIACB3AADUCAAgqAWAAAAAAasFgAAAAAGsBYAAAAABrQWAAAAAAa4FgAAAAAGvBYAAAAABtAUBAAAAAbUFAQAAAAG2BQEAAAABtwWAAAAAAbgFgAAAAAG5BYAAAAABDKgFgAAAAAGrBYAAAAABrAWAAAAAAa0FgAAAAAGuBYAAAAABrwWAAAAAAbQFAQAAAAG1BQEAAAABtgUBAAAAAbcFgAAAAAG4BYAAAAABuQWAAAAAAQyhBQAA1QgAMKIFAAD5BwAQowUAANUIADCnBUAAvwgAIboFAQC8CAAhwQVAAL8IACHKBQEAvAgAIcsFAQC-CAAhzAUBAL4IACHNBQEAvAgAIc4FAgDWCAAhzwUgANcIACENBgAAwQgAIHQAANsIACB1AADBCAAgdgAAwQgAIHcAAMEIACCoBQIAAAABqQUCAAAABKoFAgAAAASrBQIAAAABrAUCAAAAAa0FAgAAAAGuBQIAAAABrwUCANoIACEFBgAAwQgAIHYAANkIACB3AADZCAAgqAUgAAAAAa8FIADYCAAhBQYAAMEIACB2AADZCAAgdwAA2QgAIKgFIAAAAAGvBSAA2AgAIQKoBSAAAAABrwUgANkIACENBgAAwQgAIHQAANsIACB1AADBCAAgdgAAwQgAIHcAAMEIACCoBQIAAAABqQUCAAAABKoFAgAAAASrBQIAAAABrAUCAAAAAa0FAgAAAAGuBQIAAAABrwUCANoIACEIqAUIAAAAAakFCAAAAASqBQgAAAAEqwUIAAAAAawFCAAAAAGtBQgAAAABrgUIAAAAAa8FCADbCAAhEqEFAADcCAAwogUAAOUHABCjBQAA3AgAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIcwFAQC8CAAh0AUBALwIACHSBQAA3QjSBSLTBQEAvAgAIdQFAgDWCAAh1QUCAN4IACHWBQIA3ggAIdcFAQC8CAAh2AUBAL4IACHZBQEAvAgAIdoFAQC-CAAh2wVAAM8IACEHBgAAwQgAIHYAAOIIACB3AADiCAAgqAUAAADSBQKpBQAAANIFCKoFAAAA0gUIrwUAAOEI0gUiDQYAAMQIACB0AADgCAAgdQAAxAgAIHYAAMQIACB3AADECAAgqAUCAAAAAakFAgAAAAWqBQIAAAAFqwUCAAAAAawFAgAAAAGtBQIAAAABrgUCAAAAAa8FAgDfCAAhDQYAAMQIACB0AADgCAAgdQAAxAgAIHYAAMQIACB3AADECAAgqAUCAAAAAakFAgAAAAWqBQIAAAAFqwUCAAAAAawFAgAAAAGtBQIAAAABrgUCAAAAAa8FAgDfCAAhCKgFCAAAAAGpBQgAAAAFqgUIAAAABasFCAAAAAGsBQgAAAABrQUIAAAAAa4FCAAAAAGvBQgA4AgAIQcGAADBCAAgdgAA4ggAIHcAAOIIACCoBQAAANIFAqkFAAAA0gUIqgUAAADSBQivBQAA4QjSBSIEqAUAAADSBQKpBQAAANIFCKoFAAAA0gUIrwUAAOII0gUiCkACANYIACGhBQAA4wgAMKIFAADRBwAQowUAAOMIADC6BQEAvAgAIcEFQAC_CAAh3AUBALwIACHdBQAAvQgAIN4FAQC-CAAh3wUBAL4IACELoQUAAOQIADCiBQAAvQcAEKMFAADkCAAwpwVAAL8IACG6BQEAvAgAIbwFAADlCOEFIsEFQAC_CAAhzgUCANYIACHcBQEAvAgAIeEFIADXCAAh4gUAAL0IACAHBgAAwQgAIHYAAOcIACB3AADnCAAgqAUAAADhBQKpBQAAAOEFCKoFAAAA4QUIrwUAAOYI4QUiBwYAAMEIACB2AADnCAAgdwAA5wgAIKgFAAAA4QUCqQUAAADhBQiqBQAAAOEFCK8FAADmCOEFIgSoBQAAAOEFAqkFAAAA4QUIqgUAAADhBQivBQAA5wjhBSINoQUAAOgIADCiBQAAqQcAEKMFAADoCAAwpwVAAL8IACG6BQEAvAgAIb0FAQC8CAAhwQVAAL8IACHjBQEAvAgAIeQFAQC-CAAh5QUBAL4IACHmBQEAvggAIecFQAC_CAAh6AUBAL4IACEQrQQAAOoIACCvBAAA6wgAILAEAADsCAAgoQUAAOkIADCiBQAAkwcAEKMFAADpCAAwpwVAAM0IACG6BQEAyggAIb0FAQDKCAAhwQVAAM0IACHjBQEAyggAIeQFAQDMCAAh5QUBAMwIACHmBQEAzAgAIecFQADNCAAh6AUBAMwIACED6QUAAIsHACDqBQAAiwcAIOsFAACLBwAgA-kFAACPBwAg6gUAAI8HACDrBQAAjwcAIA5AAgDvCAAhrAQAAPAIACCuBAAA8QgAIKEFAADuCAAwogUAAI8HABCjBQAA7ggAMLoFAQDKCAAhwQVAAM0IACHcBQEAyggAId0FAADLCAAg3gUBAMwIACHfBQEAzAgAIdAHAACPBwAg0QcAAI8HACACQAIAAAAB3AUBAAAAAQxAAgDvCAAhrAQAAPAIACCuBAAA8QgAIKEFAADuCAAwogUAAI8HABCjBQAA7ggAMLoFAQDKCAAhwQVAAM0IACHcBQEAyggAId0FAADLCAAg3gUBAMwIACHfBQEAzAgAIQioBQIAAAABqQUCAAAABKoFAgAAAASrBQIAAAABrAUCAAAAAa0FAgAAAAGuBQIAAAABrwUCAMEIACESrQQAAOoIACCvBAAA6wgAILAEAADsCAAgoQUAAOkIADCiBQAAkwcAEKMFAADpCAAwpwVAAM0IACG6BQEAyggAIb0FAQDKCAAhwQVAAM0IACHjBQEAyggAIeQFAQDMCAAh5QUBAMwIACHmBQEAzAgAIecFQADNCAAh6AUBAMwIACHQBwAAkwcAINEHAACTBwAgEq0EAADqCAAgrwQAAOsIACCwBAAA7AgAIKEFAADpCAAwogUAAJMHABCjBQAA6QgAMKcFQADNCAAhugUBAMoIACG9BQEAyggAIcEFQADNCAAh4wUBAMoIACHkBQEAzAgAIeUFAQDMCAAh5gUBAMwIACHnBUAAzQgAIegFAQDMCAAh0AcAAJMHACDRBwAAkwcAIAysBAAA8AgAIKEFAADyCAAwogUAAIsHABCjBQAA8ggAMKcFQADNCAAhugUBAMoIACG8BQAA8wjhBSLBBUAAzQgAIc4FAgDvCAAh3AUBAMoIACHhBSAA9AgAIeIFAADLCAAgBKgFAAAA4QUCqQUAAADhBQiqBQAAAOEFCK8FAADnCOEFIgKoBSAAAAABrwUgANkIACEYoQUAAPUIADCiBQAAhgcAEKMFAAD1CAAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAhzgUCANYIACHPBSAA1wgAIe0FAQC8CAAh7gUBAL4IACHvBQEAvAgAIfAFAQC-CAAh8QVAAM8IACHyBQEAvggAIfMFAQC-CAAh9AUBAL4IACH1BQEAvggAIfYFAQC-CAAh9wUBAL4IACH4BQEAvggAIfkFIADXCAAh-wUAAPYI-wUi_AVAAM8IACH9BUAAzwgAIQcGAADBCAAgdgAA-AgAIHcAAPgIACCoBQAAAPsFAqkFAAAA-wUIqgUAAAD7BQivBQAA9wj7BSIHBgAAwQgAIHYAAPgIACB3AAD4CAAgqAUAAAD7BQKpBQAAAPsFCKoFAAAA-wUIrwUAAPcI-wUiBKgFAAAA-wUCqQUAAAD7BQiqBQAAAPsFCK8FAAD4CPsFIhChBQAA-QgAMKIFAADyBgAQowUAAPkIADCnBUAAvwgAIboFAQC8CAAhwQVAAL8IACH-BQEAvAgAIf8FAgDWCAAhgAYCANYIACGBBgEAvggAIYIGAQC-CAAhgwYBAL4IACGEBgEAvggAIYUGAQC-CAAhhwYAAPoIhwYjiQYAAPsIiQYiBwYAAMQIACB2AAD_CAAgdwAA_wgAIKgFAAAAhwYDqQUAAACHBgmqBQAAAIcGCa8FAAD-CIcGIwcGAADBCAAgdgAA_QgAIHcAAP0IACCoBQAAAIkGAqkFAAAAiQYIqgUAAACJBgivBQAA_AiJBiIHBgAAwQgAIHYAAP0IACB3AAD9CAAgqAUAAACJBgKpBQAAAIkGCKoFAAAAiQYIrwUAAPwIiQYiBKgFAAAAiQYCqQUAAACJBgiqBQAAAIkGCK8FAAD9CIkGIgcGAADECAAgdgAA_wgAIHcAAP8IACCoBQAAAIcGA6kFAAAAhwYJqgUAAACHBgmvBQAA_giHBiMEqAUAAACHBgOpBQAAAIcGCaoFAAAAhwYJrwUAAP8IhwYjCaEFAACACQAwogUAAN4GABCjBQAAgAkAMLoFAQC8CAAhvAUAAIEJjAYiwQVAAL8IACHKBQEAvAgAIYoGAQC8CAAhjAYCANYIACEHBgAAwQgAIHYAAIMJACB3AACDCQAgqAUAAACMBgKpBQAAAIwGCKoFAAAAjAYIrwUAAIIJjAYiBwYAAMEIACB2AACDCQAgdwAAgwkAIKgFAAAAjAYCqQUAAACMBgiqBQAAAIwGCK8FAACCCYwGIgSoBQAAAIwGAqkFAAAAjAYIqgUAAACMBgivBQAAgwmMBiIJoQUAAIQJADCiBQAAygYAEKMFAACECQAwugUBALwIACHBBUAAvwgAIYkGAACFCZAGIooGAQC8CAAhjQYBALwIACGOBgIA1ggAIQcGAADBCAAgdgAAhwkAIHcAAIcJACCoBQAAAJAGAqkFAAAAkAYIqgUAAACQBgivBQAAhgmQBiIHBgAAwQgAIHYAAIcJACB3AACHCQAgqAUAAACQBgKpBQAAAJAGCKoFAAAAkAYIrwUAAIYJkAYiBKgFAAAAkAYCqQUAAACQBgiqBQAAAJAGCK8FAACHCZAGIhWhBQAAiAkAMKIFAAC2BgAQowUAAIgJADCnBUAAvwgAIboFAQC8CAAhwQVAAL8IACHKBQEAvAgAIeMFAQC8CAAh8AUBAL4IACGJBgAAigmUBiKQBgEAvAgAIZIGAACJCZIGIpQGAgDWCAAhlQYBAL4IACGWBgEAvggAIZcGAQC-CAAhmAZAAM8IACGZBkAAzwgAIZoGAQC-CAAhmwYgANcIACGcBiAA1wgAIQcGAADBCAAgdgAAjgkAIHcAAI4JACCoBQAAAJIGAqkFAAAAkgYIqgUAAACSBgivBQAAjQmSBiIHBgAAwQgAIHYAAIwJACB3AACMCQAgqAUAAACUBgKpBQAAAJQGCKoFAAAAlAYIrwUAAIsJlAYiBwYAAMEIACB2AACMCQAgdwAAjAkAIKgFAAAAlAYCqQUAAACUBgiqBQAAAJQGCK8FAACLCZQGIgSoBQAAAJQGAqkFAAAAlAYIqgUAAACUBgivBQAAjAmUBiIHBgAAwQgAIHYAAI4JACB3AACOCQAgqAUAAACSBgKpBQAAAJIGCKoFAAAAkgYIrwUAAI0JkgYiBKgFAAAAkgYCqQUAAACSBgiqBQAAAJIGCK8FAACOCZIGIg8tAACRCaAGIqEFAACPCQAwogUAAKIGABCjBQAAjwkAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAId4FAQC-CAAhiQYAAJIJoQYinQYBALwIACGeBhAAkAkAIaEGAQC-CAAhogYBAL4IACGjBgEAvggAIaQGQADPCAAhDQYAAMEIACB0AACYCQAgdQAAmAkAIHYAAJgJACB3AACYCQAgqAUQAAAAAakFEAAAAASqBRAAAAAEqwUQAAAAAawFEAAAAAGtBRAAAAABrgUQAAAAAa8FEACXCQAhBwYAAMEIACB2AACWCQAgdwAAlgkAIKgFAAAAoAYCqQUAAACgBgiqBQAAAKAGCK8FAACVCaAGIgcGAADBCAAgdgAAlAkAIHcAAJQJACCoBQAAAKEGAqkFAAAAoQYIqgUAAAChBgivBQAAkwmhBiIHBgAAwQgAIHYAAJQJACB3AACUCQAgqAUAAAChBgKpBQAAAKEGCKoFAAAAoQYIrwUAAJMJoQYiBKgFAAAAoQYCqQUAAAChBgiqBQAAAKEGCK8FAACUCaEGIgcGAADBCAAgdgAAlgkAIHcAAJYJACCoBQAAAKAGAqkFAAAAoAYIqgUAAACgBgivBQAAlQmgBiIEqAUAAACgBgKpBQAAAKAGCKoFAAAAoAYIrwUAAJYJoAYiDQYAAMEIACB0AACYCQAgdQAAmAkAIHYAAJgJACB3AACYCQAgqAUQAAAAAakFEAAAAASqBRAAAAAEqwUQAAAAAawFEAAAAAGtBRAAAAABrgUQAAAAAa8FEACXCQAhCKgFEAAAAAGpBRAAAAAEqgUQAAAABKsFEAAAAAGsBRAAAAABrQUQAAAAAa4FEAAAAAGvBRAAmAkAIQqhBQAAmQkAMKIFAACOBgAQowUAAJkJADC6BQEAvAgAIcEFQAC_CAAhnQYBALwIACGlBgEAvAgAIaYGAgDWCAAhpwYQAJAJACGoBhAAkAkAIRihBQAAmgkAMKIFAAD6BQAQowUAAJoJADCnBUAAvwgAIboFAQC8CAAhwQVAAL8IACGJBgAAmwmwBiKpBgEAvAgAIaoGAQC8CAAhqwYBALwIACGsBgEAvAgAIa0GAQC8CAAhrgYQAJAJACGwBgAAkQmgBiKxBgAAkgmhBiKyBgEAvggAIbMGAQC-CAAhtAYBAL4IACG1BgEAvggAIbYGAQC-CAAhtwZAAM8IACG4BkAAzwgAIbkGQADPCAAhugYBAL4IACEHBgAAwQgAIHYAAJ0JACB3AACdCQAgqAUAAACwBgKpBQAAALAGCKoFAAAAsAYIrwUAAJwJsAYiBwYAAMEIACB2AACdCQAgdwAAnQkAIKgFAAAAsAYCqQUAAACwBgiqBQAAALAGCK8FAACcCbAGIgSoBQAAALAGAqkFAAAAsAYIqgUAAACwBgivBQAAnQmwBiIOoQUAAJ4JADCiBQAA5gUAEKMFAACeCQAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAhygUBALwIACHPBSAA1wgAIfAFAQC-CAAhqgYBALwIACG7BgEAvAgAIbwGEACQCQAhvQYCANYIACG-BgIA1ggAIQmhBQAAnwkAMKIFAADSBQAQowUAAJ8JADC6BQEAvAgAIcEFQAC_CAAhwgUBAL4IACHDBQAAoAnBBiK_BgEAvAgAIcEGAQC-CAAhBwYAAMEIACB2AACiCQAgdwAAogkAIKgFAAAAwQYCqQUAAADBBgiqBQAAAMEGCK8FAAChCcEGIgcGAADBCAAgdgAAogkAIHcAAKIJACCoBQAAAMEGAqkFAAAAwQYIqgUAAADBBgivBQAAoQnBBiIEqAUAAADBBgKpBQAAAMEGCKoFAAAAwQYIrwUAAKIJwQYiFqEFAACjCQAwogUAAL4FABCjBQAAowkAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIYMGAQC-CAAhhAYBALwIACGJBgAApQnMBiLDBgAApAnDBiLEBgEAvAgAIcUGAgDeCAAhxgYBAL4IACHHBgAA0wgAIMgGAQC-CAAhyQYBAL4IACHKBgEAvggAIcwGAQC-CAAhzQYBAL4IACHOBkAAzwgAIc8GAQC-CAAh0AZAAM8IACEHBgAAwQgAIHYAAKkJACB3AACpCQAgqAUAAADDBgKpBQAAAMMGCKoFAAAAwwYIrwUAAKgJwwYiBwYAAMEIACB2AACnCQAgdwAApwkAIKgFAAAAzAYCqQUAAADMBgiqBQAAAMwGCK8FAACmCcwGIgcGAADBCAAgdgAApwkAIHcAAKcJACCoBQAAAMwGAqkFAAAAzAYIqgUAAADMBgivBQAApgnMBiIEqAUAAADMBgKpBQAAAMwGCKoFAAAAzAYIrwUAAKcJzAYiBwYAAMEIACB2AACpCQAgdwAAqQkAIKgFAAAAwwYCqQUAAADDBgiqBQAAAMMGCK8FAACoCcMGIgSoBQAAAMMGAqkFAAAAwwYIqgUAAADDBgivBQAAqQnDBiIJoQUAAKoJADCiBQAAqgUAEKMFAACqCQAwugUBALwIACHBBUAAvwgAIYQGAQC8CAAhjQYBALwIACHSBgAAqwnSBiLTBhAArAkAIQcGAADBCAAgdgAAsAkAIHcAALAJACCoBQAAANIGAqkFAAAA0gYIqgUAAADSBgivBQAArwnSBiINBgAAxAgAIHQAAK4JACB1AACuCQAgdgAArgkAIHcAAK4JACCoBRAAAAABqQUQAAAABaoFEAAAAAWrBRAAAAABrAUQAAAAAa0FEAAAAAGuBRAAAAABrwUQAK0JACENBgAAxAgAIHQAAK4JACB1AACuCQAgdgAArgkAIHcAAK4JACCoBRAAAAABqQUQAAAABaoFEAAAAAWrBRAAAAABrAUQAAAAAa0FEAAAAAGuBRAAAAABrwUQAK0JACEIqAUQAAAAAakFEAAAAAWqBRAAAAAFqwUQAAAAAawFEAAAAAGtBRAAAAABrgUQAAAAAa8FEACuCQAhBwYAAMEIACB2AACwCQAgdwAAsAkAIKgFAAAA0gYCqQUAAADSBgiqBQAAANIGCK8FAACvCdIGIgSoBQAAANIGAqkFAAAA0gYIqgUAAADSBgivBQAAsAnSBiIQoQUAALEJADCiBQAAlgUAEKMFAACxCQAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAhiQYAALIJ2wYikAYBALwIACGqBgEAvggAIdQGQAC_CAAh1QYCANYIACHWBgIA1ggAIdcGIADXCAAh2AYgANcIACHZBgEAvggAIdsGAQC-CAAhBwYAAMEIACB2AAC0CQAgdwAAtAkAIKgFAAAA2wYCqQUAAADbBgiqBQAAANsGCK8FAACzCdsGIgcGAADBCAAgdgAAtAkAIHcAALQJACCoBQAAANsGAqkFAAAA2wYIqgUAAADbBgivBQAAswnbBiIEqAUAAADbBgKpBQAAANsGCKoFAAAA2wYIrwUAALQJ2wYiC6EFAAC1CQAwogUAAIIFABCjBQAAtQkAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIcoFAQC8CAAhzgUCANYIACHPBSAA1wgAIbsGAQC8CAAh3AYgANcIACEMLAAAtwkAIKEFAAC2CQAwogUAAPEEABCjBQAAtgkAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIcoFAQDKCAAhzgUCAO8IACHPBSAA9AgAIbsGAQDKCAAh3AYgAPQIACED6QUAAGYAIOoFAABmACDrBQAAZgAgEqEFAAC4CQAwogUAAOsEABCjBQAAuAkAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIcoFAQC8CAAh4wUBALwIACHwBQEAvggAIYkGAAC5CeMGIpcGAQC-CAAhmwYgANcIACGcBiAA1wgAId0GAQC-CAAh3gYBAL4IACHfBgEAvggAIeAGQAC_CAAh4QYBALwIACEHBgAAwQgAIHYAALsJACB3AAC7CQAgqAUAAADjBgKpBQAAAOMGCKoFAAAA4wYIrwUAALoJ4wYiBwYAAMEIACB2AAC7CQAgdwAAuwkAIKgFAAAA4wYCqQUAAADjBgiqBQAAAOMGCK8FAAC6CeMGIgSoBQAAAOMGAqkFAAAA4wYIqgUAAADjBgivBQAAuwnjBiIKoQUAALwJADCiBQAA1wQAEKMFAAC8CQAwugUBALwIACHBBUAAvwgAIYQGAQC-CAAh2wYBAL4IACHjBgEAvAgAIeQGAQC-CAAh5QZAAL8IACEUoQUAAL0JADCiBQAAwwQAEKMFAAC9CQAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAhiQYAAL4J5wYijQYBALwIACG0BgEAvggAIc8GAQC-CAAh0AZAAM8IACHZBgEAvAgAIdsGAQC-CAAh5wYBAL4IACHoBkAAvwgAIekGAQC-CAAh6gZAAM8IACHsBgAAvwnsBiPtBgEAvggAIe4GAQC-CAAhBwYAAMEIACB2AADDCQAgdwAAwwkAIKgFAAAA5wYCqQUAAADnBgiqBQAAAOcGCK8FAADCCecGIgcGAADECAAgdgAAwQkAIHcAAMEJACCoBQAAAOwGA6kFAAAA7AYJqgUAAADsBgmvBQAAwAnsBiMHBgAAxAgAIHYAAMEJACB3AADBCQAgqAUAAADsBgOpBQAAAOwGCaoFAAAA7AYJrwUAAMAJ7AYjBKgFAAAA7AYDqQUAAADsBgmqBQAAAOwGCa8FAADBCewGIwcGAADBCAAgdgAAwwkAIHcAAMMJACCoBQAAAOcGAqkFAAAA5wYIqgUAAADnBgivBQAAwgnnBiIEqAUAAADnBgKpBQAAAOcGCKoFAAAA5wYIrwUAAMMJ5wYiEaEFAADECQAwogUAAK8EABCjBQAAxAkAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIcoFAQC8CAAhzgUCANYIACHjBQEAvAgAIfAFAQC-CAAhiQYAAMUJ8AYikAYBALwIACGcBiAA1wgAIfAGAQC-CAAh8QYBAL4IACHyBkAAzwgAIfMGAQC-CAAhBwYAAMEIACB2AADHCQAgdwAAxwkAIKgFAAAA8AYCqQUAAADwBgiqBQAAAPAGCK8FAADGCfAGIgcGAADBCAAgdgAAxwkAIHcAAMcJACCoBQAAAPAGAqkFAAAA8AYIqgUAAADwBgivBQAAxgnwBiIEqAUAAADwBgKpBQAAAPAGCKoFAAAA8AYIrwUAAMcJ8AYiDKEFAADICQAwogUAAJsEABCjBQAAyAkAMLoFAQC8CAAhwQVAAL8IACHCBQEAvggAIcMFAADJCfYGIo0GAQC-CAAh9AYBALwIACH2BgIA3ggAIfcGAgDeCAAh-AYBALwIACEHBgAAwQgAIHYAAMsJACB3AADLCQAgqAUAAAD2BgKpBQAAAPYGCKoFAAAA9gYIrwUAAMoJ9gYiBwYAAMEIACB2AADLCQAgdwAAywkAIKgFAAAA9gYCqQUAAAD2BgiqBQAAAPYGCK8FAADKCfYGIgSoBQAAAPYGAqkFAAAA9gYIqgUAAAD2BgivBQAAywn2BiIKoQUAAMwJADCiBQAAhwQAEKMFAADMCQAwpwVAAL8IACG6BQEAvAgAIY0GAQC8CAAh9AYBALwIACH5BgEAvAgAIfoGAgDeCAAh-wYgANcIACEPoQUAAM0JADCiBQAA8wMAEKMFAADNCQAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAh3gUBAL4IACGNBgEAvAgAIfQGAQC8CAAh-gYCAN4IACH7BiAA1wgAIfwGEACsCQAh_QYCAN4IACH-BgIA3ggAIf8GIADXCAAhFi0BALwIACGhBQAAzgkAMKIFAADfAwAQowUAAM4JADCnBUAAvwgAIboFAQC8CAAhvAUAAM8JgQciwQVAAL8IACHfBQEAvggAIYkGAADRCYUHIpAGAQC-CAAhtAYBAL4IACHPBgEAvggAIdsGAQC-CAAh7gYBAL4IACH5BgEAvAgAIYIHAADQCYIHI4MHAgDWCAAhhQdAAL8IACGGBwEAvggAIYcHQADPCAAhiAdAAM8IACEHBgAAwQgAIHYAANcJACB3AADXCQAgqAUAAACBBwKpBQAAAIEHCKoFAAAAgQcIrwUAANYJgQciBwYAAMQIACB2AADVCQAgdwAA1QkAIKgFAAAAggcDqQUAAACCBwmqBQAAAIIHCa8FAADUCYIHIwcGAADBCAAgdgAA0wkAIHcAANMJACCoBQAAAIUHAqkFAAAAhQcIqgUAAACFBwivBQAA0gmFByIHBgAAwQgAIHYAANMJACB3AADTCQAgqAUAAACFBwKpBQAAAIUHCKoFAAAAhQcIrwUAANIJhQciBKgFAAAAhQcCqQUAAACFBwiqBQAAAIUHCK8FAADTCYUHIgcGAADECAAgdgAA1QkAIHcAANUJACCoBQAAAIIHA6kFAAAAggcJqgUAAACCBwmvBQAA1AmCByMEqAUAAACCBwOpBQAAAIIHCaoFAAAAggcJrwUAANUJggcjBwYAAMEIACB2AADXCQAgdwAA1wkAIKgFAAAAgQcCqQUAAACBBwiqBQAAAIEHCK8FAADWCYEHIgSoBQAAAIEHAqkFAAAAgQcIqgUAAACBBwivBQAA1wmBByInoQUAANgJADCiBQAAywMAEKMFAADYCQAwpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAh2wVAAM8IACHjBQEAvAgAIYkGAADbCZUHIpAGAQC8CAAhnAYgANcIACGCBwAA2QmCByKJBwEAvAgAIYoHAQC8CAAhiwcBAL4IACGMBwEAvAgAIY0HAQC-CAAhjgdAAM8IACGPByAA1wgAIZAHAgDeCAAhkQcCAN4IACGTBwAA2gmTByKVBwEAvggAIZYHAADTCAAglwcBAL4IACGYB0AAzwgAIZkHAgDWCAAhmgcCANYIACGbBwIA1ggAIZwHAgDWCAAhnQcCANYIACGeBwIA1ggAIZ8HAgDWCAAhoAcCANYIACGhBwIA1ggAIaIHAgDWCAAhowcBAL4IACGkBwEAvggAIaUHAQC-CAAhBwYAAMEIACB2AADhCQAgdwAA4QkAIKgFAAAAggcCqQUAAACCBwiqBQAAAIIHCK8FAADgCYIHIgcGAADBCAAgdgAA3wkAIHcAAN8JACCoBQAAAJMHAqkFAAAAkwcIqgUAAACTBwivBQAA3gmTByIHBgAAwQgAIHYAAN0JACB3AADdCQAgqAUAAACVBwKpBQAAAJUHCKoFAAAAlQcIrwUAANwJlQciBwYAAMEIACB2AADdCQAgdwAA3QkAIKgFAAAAlQcCqQUAAACVBwiqBQAAAJUHCK8FAADcCZUHIgSoBQAAAJUHAqkFAAAAlQcIqgUAAACVBwivBQAA3QmVByIHBgAAwQgAIHYAAN8JACB3AADfCQAgqAUAAACTBwKpBQAAAJMHCKoFAAAAkwcIrwUAAN4JkwciBKgFAAAAkwcCqQUAAACTBwiqBQAAAJMHCK8FAADfCZMHIgcGAADBCAAgdgAA4QkAIHcAAOEJACCoBQAAAIIHAqkFAAAAggcIqgUAAACCBwivBQAA4AmCByIEqAUAAACCBwKpBQAAAIIHCKoFAAAAggcIrwUAAOEJggciDaEFAADiCQAwogUAALcDABCjBQAA4gkAMKcFQAC_CAAhugUBALwIACHBBUAAvwgAIcoFAQC8CAAhzgUCANYIACHPBSAA1wgAIeMFAQC8CAAhggcAANkJggcipgcQAJAJACGnBxAAkAkAIQLKBQEAAAABggcAAACCBwISFAAA5wkAIBYAAOgJACBEAADpCQAgRQAA6gkAIEYAAOsJACChBQAA5AkAMKIFAACbAQAQowUAAOQJADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACHKBQEAyggAIc4FAgDvCAAhzwUgAPQIACHjBQEAyggAIYIHAADlCYIHIqYHEADmCQAhpwcQAOYJACEEqAUAAACCBwKpBQAAAIIHCKoFAAAAggcIrwUAAOEJggciCKgFEAAAAAGpBRAAAAAEqgUQAAAABKsFEAAAAAGsBRAAAAABrQUQAAAAAa4FEAAAAAGvBRAAmAkAIQPpBQAAKwAg6gUAACsAIOsFAAArACAD6QUAADAAIOoFAAAwACDrBQAAMAAgA-kFAACXAQAg6gUAAJcBACDrBQAAlwEAIAPpBQAATwAg6gUAAE8AIOsFAABPACAD6QUAALABACDqBQAAsAEAIOsFAACwAQAgCqEFAADsCQAwogUAAKEDABCjBQAA7AkAMLoFAQC8CAAhwQVAAL8IACHIBQEAvggAIckFAQC-CAAh-AYBAL4IACGpBwEAvAgAIaoHIADXCAAhCqEFAADtCQAwogUAAJADABCjBQAA7QkAMLoFAQDKCAAhwQVAAM0IACHIBQEAzAgAIckFAQDMCAAh-AYBAMwIACGpBwEAyggAIaoHIAD0CAAhDaEFAADuCQAwogUAAIoDABCjBQAA7gkAMLoFAQC8CAAhuwUBALwIACHBBUAAvwgAIcgFAQC-CAAhyQUBAL4IACGrBwEAvAgAIawHIADXCAAhrQdAAL8IACGuB0AAvwgAIa8HQADPCAAhD6EFAADvCQAwogUAAPYCABCjBQAA7wkAMKcFQAC_CAAhugUBALwIACG7BQEAvAgAIcEFQAC_CAAhwwUAAPAJsgciiQYAAPEJswciowYBAL4IACGkBkAAzwgAIfgGAQC8CAAhsAcBALwIACGzBwEAvggAIbQHAQC8CAAhBwYAAMEIACB2AAD1CQAgdwAA9QkAIKgFAAAAsgcCqQUAAACyBwiqBQAAALIHCK8FAAD0CbIHIgcGAADBCAAgdgAA8wkAIHcAAPMJACCoBQAAALMHAqkFAAAAswcIqgUAAACzBwivBQAA8gmzByIHBgAAwQgAIHYAAPMJACB3AADzCQAgqAUAAACzBwKpBQAAALMHCKoFAAAAswcIrwUAAPIJswciBKgFAAAAswcCqQUAAACzBwiqBQAAALMHCK8FAADzCbMHIgcGAADBCAAgdgAA9QkAIHcAAPUJACCoBQAAALIHAqkFAAAAsgcIqgUAAACyBwivBQAA9AmyByIEqAUAAACyBwKpBQAAALIHCKoFAAAAsgcIrwUAAPUJsgciBqEFAAD2CQAwogUAAOICABCjBQAA9gkAMMEFQAC_CAAhsAcBALwIACG1BwEAvAgAIQehBQAA9wkAMKIFAADOAgAQowUAAPcJADC7BQEAvAgAIcEFQAC_CAAhsAcBALwIACG2BwEAvggAIQehBQAA-AkAMKIFAAC6AgAQowUAAPgJADCkBQEAvAgAIboFAQC8CAAhwQVAAL8IACHwBQEAvAgAIQgFAAD6CQAgoQUAAPkJADCiBQAAqQIAEKMFAAD5CQAwpAUBAMoIACG6BQEAyggAIcEFQADNCAAh8AUBAMoIACED6QUAAAcAIOoFAAAHACDrBQAABwAgDKEFAAD7CQAwogUAAKMCABCjBQAA-wkAMKQFAQC8CAAhpwVAAL8IACG6BQEAvAgAIcEFQAC_CAAhygUBALwIACHwBQEAvggAIbcHIADXCAAhuAcgANcIACG5ByAA1wgAIQ8IAAD6CQAgCQAA_QkAIAwAAP4JACChBQAA_AkAMKIFAACSAgAQowUAAPwJADCkBQEAyggAIacFQADNCAAhugUBAMoIACHBBUAAzQgAIcoFAQDKCAAh8AUBAMwIACG3ByAA9AgAIbgHIAD0CAAhuQcgAPQIACED6QUAAAMAIOoFAAADACDrBQAAAwAgA-kFAAAOACDqBQAADgAg6wUAAA4AIBGhBQAA_wkAMKIFAACMAgAQowUAAP8JADCnBUAAvwgAIboFAQC8CAAhwQVAAL8IACHKBQEAvAgAIc8FIADXCAAhqQcBALwIACG6BwEAvAgAIbsHAQC8CAAhvAcgANcIACG9BwEAvggAIb4HAgDWCAAhvwdAAM8IACHAB0AAzwgAIcEHQAC_CAAhEQsAAIUKACAZAACECgAgLQAAgQqgBiKhBQAAgAoAMKIFAABBABCjBQAAgAoAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAId4FAQDMCAAhiQYAAIIKoQYinQYBAMoIACGeBhAA5gkAIaEGAQDMCAAhogYBAMwIACGjBgEAzAgAIaQGQACDCgAhBKgFAAAAoAYCqQUAAACgBgiqBQAAAKAGCK8FAACWCaAGIgSoBQAAAKEGAqkFAAAAoQYIqgUAAAChBgivBQAAlAmhBiIIqAVAAAAAAakFQAAAAAWqBUAAAAAFqwVAAAAAAawFQAAAAAGtBUAAAAABrgVAAAAAAa8FQADRCAAhHxcAANUKACAYAADWCgAgGgAA1woAIBsAAIUKACAcAACFCgAgoQUAANMKADCiBQAASAAQowUAANMKADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACGJBgAA1AqwBiKpBgEAyggAIaoGAQDKCAAhqwYBAMoIACGsBgEAyggAIa0GAQDKCAAhrgYQAOYJACGwBgAAgQqgBiKxBgAAggqhBiKyBgEAzAgAIbMGAQDMCAAhtAYBAMwIACG1BgEAzAgAIbYGAQDMCAAhtwZAAIMKACG4BkAAgwoAIbkGQACDCgAhugYBAMwIACHQBwAASAAg0QcAAEgAIB8FAAD9CQAgDgAA_QkAIA8AAPEKACARAADyCgAgEgAA8woAIF0AAPQKACBeAAD-CQAgXwAA_gkAIGAAAP4JACBhAACNCgAgYgAAjQoAIGMAAPUKACChBQAA8AoAMKIFAAASABCjBQAA8AoAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIcoFAQDKCAAhzwUgAPQIACGpBwEAyggAIboHAQDKCAAhuwcBAMoIACG8ByAA9AgAIb0HAQDMCAAhvgcCAO8IACG_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-kFAABTACDqBQAAUwAg6wUAAFMAIAKNBgEAAAAB-QYBAAAAAQwkAACbCgAgQAAAnAoAIKEFAACZCgAwogUAAKYBABCjBQAAmQoAMKcFQADNCAAhugUBAMoIACGNBgEAyggAIfQGAQDKCAAh-QYBAMoIACH6BgIAmgoAIfsGIAD0CAAhCKgFAgAAAAGpBQIAAAAFqgUCAAAABasFAgAAAAGsBQIAAAABrQUCAAAAAa4FAgAAAAGvBQIAxAgAITMgAACRCgAgRwAAhwoAIEgAAOEKACBJAACpCgAgSgAAqwoAIEsAAKoKACBMAACXCgAgTQAA0goAIE4AAJMKACBPAADrCQAgoQUAAOQKADCiBQAAKwAQowUAAOQKADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACHbBUAAgwoAIeMFAQDKCAAhiQYAAOYKlQcikAYBAMoIACGcBiAA9AgAIYIHAADlCYIHIokHAQDKCAAhigcBAMoIACGLBwEAzAgAIYwHAQDKCAAhjQcBAMwIACGOB0AAgwoAIY8HIAD0CAAhkAcCAJoKACGRBwIAmgoAIZMHAADlCpMHIpUHAQDMCAAhlgcAAMIKACCXBwEAzAgAIZgHQACDCgAhmQcCAO8IACGaBwIA7wgAIZsHAgDvCAAhnAcCAO8IACGdBwIA7wgAIZ4HAgDvCAAhnwcCAO8IACGgBwIA7wgAIaEHAgDvCAAhogcCAO8IACGjBwEAzAgAIaQHAQDMCAAhpQcBAMwIACHQBwAAKwAg0QcAACsAIBwgAACoCgAgLQEAyggAIUEAAKkKACBCAACqCgAgQwAAqwoAIKEFAACkCgAwogUAAJcBABCjBQAApAoAMKcFQADNCAAhugUBAMoIACG8BQAApQqBByLBBUAAzQgAId8FAQDMCAAhiQYAAKcKhQcikAYBAMwIACG0BgEAzAgAIc8GAQDMCAAh2wYBAMwIACHuBgEAzAgAIfkGAQDKCAAhggcAAKYKggcjgwcCAO8IACGFB0AAzQgAIYYHAQDMCAAhhwdAAIMKACGIB0AAgwoAIdAHAACXAQAg0QcAAJcBACAOJAAAkgoAIEAAAJwKACChBQAAnQoAMKIFAAChAQAQowUAAJ0KADC6BQEAyggAIcEFQADNCAAhwgUBAMwIACHDBQAAngr2BiKNBgEAzAgAIfQGAQDKCAAh9gYCAJoKACH3BgIAmgoAIfgGAQDKCAAhBKgFAAAA9gYCqQUAAAD2BgiqBQAAAPYGCK8FAADLCfYGIgKNBgEAAAAB9AYBAAAAAQL0BgEAAAAB-gYCAAAAAREkAACbCgAgQAAAnAoAIKEFAAChCgAwogUAAJ0BABCjBQAAoQoAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAId4FAQDMCAAhjQYBAMoIACH0BgEAyggAIfoGAgCaCgAh-wYgAPQIACH8BhAAogoAIf0GAgCaCgAh_gYCAJoKACH_BiAA9AgAIQioBRAAAAABqQUQAAAABaoFEAAAAAWrBRAAAAABrAUQAAAAAa0FEAAAAAGuBRAAAAABrwUQAK4JACEC-QYBAAAAAYMHAgAAAAEaIAAAqAoAIC0BAMoIACFBAACpCgAgQgAAqgoAIEMAAKsKACChBQAApAoAMKIFAACXAQAQowUAAKQKADCnBUAAzQgAIboFAQDKCAAhvAUAAKUKgQciwQVAAM0IACHfBQEAzAgAIYkGAACnCoUHIpAGAQDMCAAhtAYBAMwIACHPBgEAzAgAIdsGAQDMCAAh7gYBAMwIACH5BgEAyggAIYIHAACmCoIHI4MHAgDvCAAhhQdAAM0IACGGBwEAzAgAIYcHQACDCgAhiAdAAIMKACEEqAUAAACBBwKpBQAAAIEHCKoFAAAAgQcIrwUAANcJgQciBKgFAAAAggcDqQUAAACCBwmqBQAAAIIHCa8FAADVCYIHIwSoBQAAAIUHAqkFAAAAhQcIqgUAAACFBwivBQAA0wmFByIUFAAA5wkAIBYAAOgJACBEAADpCQAgRQAA6gkAIEYAAOsJACChBQAA5AkAMKIFAACbAQAQowUAAOQJADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACHKBQEAyggAIc4FAgDvCAAhzwUgAPQIACHjBQEAyggAIYIHAADlCYIHIqYHEADmCQAhpwcQAOYJACHQBwAAmwEAINEHAACbAQAgA-kFAACdAQAg6gUAAJ0BACDrBQAAnQEAIAPpBQAAoQEAIOoFAAChAQAg6wUAAKEBACAD6QUAAKYBACDqBQAApgEAIOsFAACmAQAgArwFAAAAjAYCigYBAAAAAQsyAACvCgAgNwAAsAoAIKEFAACtCgAwogUAAIQBABCjBQAArQoAMLoFAQDKCAAhvAUAAK4KjAYiwQVAAM0IACHKBQEAyggAIYoGAQDKCAAhjAYCAO8IACEEqAUAAACMBgKpBQAAAIwGCKoFAAAAjAYIrwUAAIMJjAYiHBUAAIcKACAgAACRCgAgKwAAkgoAIDEAAJMKACA2AACUCgAgoQUAAI4KADCiBQAAsAEAEKMFAACOCgAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAhygUBAMoIACHjBQEAyggAIfAFAQDMCAAhiQYAAJAKlAYikAYBAMoIACGSBgAAjwqSBiKUBgIA7wgAIZUGAQDMCAAhlgYBAMwIACGXBgEAzAgAIZgGQACDCgAhmQZAAIMKACGaBgEAzAgAIZsGIAD0CAAhnAYgAPQIACHQBwAAsAEAINEHAACwAQAgA-kFAAB0ACDqBQAAdAAg6wUAAHQAIAP-BQEAAAAB_wUCAAAAAYAGAgAAAAEXJwAAtwoAICsAALYKACA4AAC1CgAgOQAAtgoAIDoAALYKACA7AAC4CgAgPAAAsAoAIKEFAACyCgAwogUAAHQAEKMFAACyCgAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAh_gUBAMoIACH_BQIA7wgAIYAGAgDvCAAhgQYBAMwIACGCBgEAzAgAIYMGAQDMCAAhhAYBAMwIACGFBgEAzAgAIYcGAACzCocGI4kGAAC0CokGIgSoBQAAAIcGA6kFAAAAhwYJqgUAAACHBgmvBQAA_wiHBiMEqAUAAACJBgKpBQAAAIkGCKoFAAAAiQYIrwUAAP0IiQYiDTIAAK8KACA3AACwCgAgoQUAAK0KADCiBQAAhAEAEKMFAACtCgAwugUBAMoIACG8BQAArgqMBiLBBUAAzQgAIcoFAQDKCAAhigYBAMoIACGMBgIA7wgAIdAHAACEAQAg0QcAAIQBACAQJAAAmwoAIDIAAK8KACAzAACwCgAgNAAAsAoAIDUAALAKACChBQAAuwoAMKIFAAB4ABCjBQAAuwoAMLoFAQDKCAAhwQVAAM0IACGJBgAAvAqQBiKKBgEAyggAIY0GAQDKCAAhjgYCAO8IACHQBwAAeAAg0QcAAHgAIBoXAADfCgAgIAAAkQoAICMAAOAKACAuAADiCgAgMQAA4QoAID0AALgKACA-AACXCgAgPwAA4woAIKEFAADdCgAwogUAADAAEKMFAADdCgAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAhiQYAAN4K2wYikAYBAMoIACGqBgEAzAgAIdQGQADNCAAh1QYCAO8IACHWBgIA7wgAIdcGIAD0CAAh2AYgAPQIACHZBgEAzAgAIdsGAQDMCAAh0AcAADAAINEHAAAwACAZJwAAtwoAICsAALYKACA4AAC1CgAgOQAAtgoAIDoAALYKACA7AAC4CgAgPAAAsAoAIKEFAACyCgAwogUAAHQAEKMFAACyCgAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAh_gUBAMoIACH_BQIA7wgAIYAGAgDvCAAhgQYBAMwIACGCBgEAzAgAIYMGAQDMCAAhhAYBAMwIACGFBgEAzAgAIYcGAACzCocGI4kGAAC0CokGItAHAAB0ACDRBwAAdAAgAooGAQAAAAGNBgEAAAABAooGAQAAAAGOBgIAAAABDiQAAJsKACAyAACvCgAgMwAAsAoAIDQAALAKACA1AACwCgAgoQUAALsKADCiBQAAeAAQowUAALsKADC6BQEAyggAIcEFQADNCAAhiQYAALwKkAYiigYBAMoIACGNBgEAyggAIY4GAgDvCAAhBKgFAAAAkAYCqQUAAACQBgiqBQAAAJAGCK8FAACHCZAGIgouAAC_CgAgoQUAAL0KADCiBQAAbQAQowUAAL0KADC6BQEAyggAIcEFQADNCAAhwgUBAMwIACHDBQAAvgrBBiK_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_BQEAzAgAIcAFQACDCgAhwQVAAM0IACEfBQAA_QkAIA4AAP0JACAPAADxCgAgEQAA8goAIBIAAPMKACBdAAD0CgAgXgAA_gkAIF8AAP4JACBgAAD-CQAgYQAAjQoAIGIAAI0KACBjAAD1CgAgoQUAAPAKADCiBQAAEgAQowUAAPAKADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACHKBQEAyggAIc8FIAD0CAAhqQcBAMoIACG6BwEAyggAIbsHAQDKCAAhvAcgAPQIACG9BwEAzAgAIb4HAgDvCAAhvwdAAIMKACHAB0AAgwoAIcEHQADNCAAh0AcAABIAINEHAAASACAOEAAAhQoAIKEFAADuCgAwogUAAB0AEKMFAADuCgAwugUBAMoIACHBBUAAzQgAIcIFAQDMCAAhwwUBAMoIACHEBQEAyggAIcUFAQDMCAAhxgUBAMoIACHHBQAAwgoAIMgFAQDMCAAhyQUBAMwIACEOAwAA7QoAIKEFAADvCgAwogUAABkAEKMFAADvCgAwugUBAMoIACG7BQEAyggAIcEFQADNCAAhyAUBAMwIACHJBQEAzAgAIasHAQDKCAAhrAcgAPQIACGtB0AAzQgAIa4HQADNCAAhrwdAAIMKACEdBQAA_QkAIA4AAP0JACAPAADxCgAgEQAA8goAIBIAAPMKACBdAAD0CgAgXgAA_gkAIF8AAP4JACBgAAD-CQAgYQAAjQoAIGIAAI0KACBjAAD1CgAgoQUAAPAKADCiBQAAEgAQowUAAPAKADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACHKBQEAyggAIc8FIAD0CAAhqQcBAMoIACG6BwEAyggAIbsHAQDKCAAhvAcgAPQIACG9BwEAzAgAIb4HAgDvCAAhvwdAAIMKACHAB0AAgwoAIcEHQADNCAAhA-kFAAAZACDqBQAAGQAg6wUAABkAIAPpBQAAHQAg6gUAAB0AIOsFAAAdACAD6QUAACIAIOoFAAAiACDrBQAAIgAgA-kFAAAmACDqBQAAJgAg6wUAACYAIAPpBQAAQQAg6gUAAEEAIOsFAABBACATAwAA7QoAIAQAAPkKACAKAADtCgAgCwAAhQoAIKEFAAD2CgAwogUAAA4AEKMFAAD2CgAwpwVAAM0IACG6BQEAyggAIbsFAQDKCAAhwQVAAM0IACHDBQAA9wqyByKJBgAA-AqzByKjBgEAzAgAIaQGQACDCgAh-AYBAMoIACGwBwEAyggAIbMHAQDMCAAhtAcBAMoIACEEqAUAAACyBwKpBQAAALIHCKoFAAAAsgcIrwUAAPUJsgciBKgFAAAAswcCqQUAAACzBwiqBQAAALMHCK8FAADzCbMHIhEIAAD6CQAgCQAA_QkAIAwAAP4JACChBQAA_AkAMKIFAACSAgAQowUAAPwJADCkBQEAyggAIacFQADNCAAhugUBAMoIACHBBUAAzQgAIcoFAQDKCAAh8AUBAMwIACG3ByAA9AgAIbgHIAD0CAAhuQcgAPQIACHQBwAAkgIAINEHAACSAgAgArAHAQAAAAG1BwEAAAABCAQAAPkKACAHAAD8CgAgoQUAAPsKADCiBQAABwAQowUAAPsKADDBBUAAzQgAIbAHAQDKCAAhtQcBAMoIACEKBQAA-gkAIKEFAAD5CQAwogUAAKkCABCjBQAA-QkAMKQFAQDKCAAhugUBAMoIACHBBUAAzQgAIfAFAQDKCAAh0AcAAKkCACDRBwAAqQIAIAK7BQEAAAABsAcBAAAAAQoDAADtCgAgBAAA-QoAIA0AAIUKACChBQAA_goAMKIFAAADABCjBQAA_goAMLsFAQDKCAAhwQVAAM0IACGwBwEAyggAIbYHAQDMCAAhAAAAAAHWBwEAAAABAdYHAQAAAAEB1gdAAAAAAQGzBQEAAAABAAAAAdYHQAAAAAEFbgAA_xcAIG8AAIIYACDTBwAAgBgAINQHAACBGAAg2QcAAAEAIANuAAD_FwAg0wcAAIAYACDZBwAAAQAgAAAAB24AAPoXACBvAAD9FwAg0wcAAPsXACDUBwAA_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-QUgAAAAAfsFAAAA-wUC_AVAAAAAAf0FQAAAAAECAAAA0gEAIG4AAMYLACADAAAA0gEAIG4AAMYLACBvAADDCwAgAWkAAPAXADAbVQAAhwoAIFYAAIcKACBXAACHCgAgoQUAAIgKADCiBQAA0AEAEKMFAACICgAwpwVAAM0IACG6BQEAAAABwQVAAM0IACHOBQIA7wgAIc8FIAD0CAAh7QUBAMoIACHuBQEAzAgAIe8FAQDKCAAh8AUBAMwIACHxBUAAgwoAIfIFAQDMCAAh8wUBAMwIACH0BQEAzAgAIfUFAQDMCAAh9gUBAMwIACH3BQEAzAgAIfgFAQDMCAAh-QUgAPQIACH7BQAAiQr7BSL8BUAAgwoAIf0FQACDCgAhAgAAANIBACBpAADDCwAgAgAAAMALACBpAADBCwAgGKEFAAC_CwAwogUAAMALABCjBQAAvwsAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIc4FAgDvCAAhzwUgAPQIACHtBQEAyggAIe4FAQDMCAAh7wUBAMoIACHwBQEAzAgAIfEFQACDCgAh8gUBAMwIACHzBQEAzAgAIfQFAQDMCAAh9QUBAMwIACH2BQEAzAgAIfcFAQDMCAAh-AUBAMwIACH5BSAA9AgAIfsFAACJCvsFIvwFQACDCgAh_QVAAIMKACEYoQUAAL8LADCiBQAAwAsAEKMFAAC_CwAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAhzgUCAO8IACHPBSAA9AgAIe0FAQDKCAAh7gUBAMwIACHvBQEAyggAIfAFAQDMCAAh8QVAAIMKACHyBQEAzAgAIfMFAQDMCAAh9AUBAMwIACH1BQEAzAgAIfYFAQDMCAAh9wUBAMwIACH4BQEAzAgAIfkFIAD0CAAh-wUAAIkK-wUi_AVAAIMKACH9BUAAgwoAIRSnBUAAhQsAIboFAQCDCwAhwQVAAIULACHOBQIAlwsAIc8FIACYCwAh7QUBAIMLACHuBQEAhAsAIe8FAQCDCwAh8AUBAIQLACHxBUAAigsAIfIFAQCECwAh8wUBAIQLACH1BQEAhAsAIfYFAQCECwAh9wUBAIQLACH4BQEAhAsAIfkFIACYCwAh-wUAAMIL-wUi_AVAAIoLACH9BUAAigsAIQHWBwAAAPsFAhZVAADECwAgVgAAxQsAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIc4FAgCXCwAhzwUgAJgLACHtBQEAgwsAIe4FAQCECwAh7wUBAIMLACHwBQEAhAsAIfEFQACKCwAh8gUBAIQLACHzBQEAhAsAIfUFAQCECwAh9gUBAIQLACH3BQEAhAsAIfgFAQCECwAh-QUgAJgLACH7BQAAwgv7BSL8BUAAigsAIf0FQACKCwAhB24AAOgXACBvAADuFwAg0wcAAOkXACDUBwAA7RcAINcHAAAmACDYBwAAJgAg2QcAACgAIAduAADmFwAgbwAA6xcAINMHAADnFwAg1AcAAOoXACDXBwAAJgAg2AcAACYAINkHAAAoACAWVQAAxwsAIFYAAMgLACCnBUAAAAABugUBAAAAAcEFQAAAAAHOBQIAAAABzwUgAAAAAe0FAQAAAAHuBQEAAAAB7wUBAAAAAfAFAQAAAAHxBUAAAAAB8gUBAAAAAfMFAQAAAAH1BQEAAAAB9gUBAAAAAfcFAQAAAAH4BQEAAAAB-QUgAAAAAfsFAAAA-wUC_AVAAAAAAf0FQAAAAAEDbgAA6BcAINMHAADpFwAg2QcAACgAIANuAADmFwAg0wcAAOcXACDZBwAAKAAgFlUAAMcLACBXAADTCwAgpwVAAAAAAboFAQAAAAHBBUAAAAABzgUCAAAAAc8FIAAAAAHtBQEAAAAB7gUBAAAAAe8FAQAAAAHwBQEAAAAB8QVAAAAAAfIFAQAAAAH0BQEAAAAB9QUBAAAAAfYFAQAAAAH3BQEAAAAB-AUBAAAAAfkFIAAAAAH7BQAAAPsFAvwFQAAAAAH9BUAAAAABAgAAANIBACBuAADSCwAgAwAAANIBACBuAADSCwAgbwAA0AsAIAFpAADlFwAwAgAAANIBACBpAADQCwAgAgAAAMALACBpAADPCwAgFKcFQACFCwAhugUBAIMLACHBBUAAhQsAIc4FAgCXCwAhzwUgAJgLACHtBQEAgwsAIe4FAQCECwAh7wUBAIMLACHwBQEAhAsAIfEFQACKCwAh8gUBAIQLACH0BQEAhAsAIfUFAQCECwAh9gUBAIQLACH3BQEAhAsAIfgFAQCECwAh-QUgAJgLACH7BQAAwgv7BSL8BUAAigsAIf0FQACKCwAhFlUAAMQLACBXAADRCwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhzgUCAJcLACHPBSAAmAsAIe0FAQCDCwAh7gUBAIQLACHvBQEAgwsAIfAFAQCECwAh8QVAAIoLACHyBQEAhAsAIfQFAQCECwAh9QUBAIQLACH2BQEAhAsAIfcFAQCECwAh-AUBAIQLACH5BSAAmAsAIfsFAADCC_sFIvwFQACKCwAh_QVAAIoLACEHbgAA4BcAIG8AAOMXACDTBwAA4RcAINQHAADiFwAg1wcAACYAINgHAAAmACDZBwAAKAAgFlUAAMcLACBXAADTCwAgpwVAAAAAAboFAQAAAAHBBUAAAAABzgUCAAAAAc8FIAAAAAHtBQEAAAAB7gUBAAAAAe8FAQAAAAHwBQEAAAAB8QVAAAAAAfIFAQAAAAH0BQEAAAAB9QUBAAAAAfYFAQAAAAH3BQEAAAAB-AUBAAAAAfkFIAAAAAH7BQAAAPsFAvwFQAAAAAH9BUAAAAABA24AAOAXACDTBwAA4RcAINkHAAAoACAWVgAAyAsAIFcAANMLACCnBUAAAAABugUBAAAAAcEFQAAAAAHOBQIAAAABzwUgAAAAAe0FAQAAAAHuBQEAAAAB7wUBAAAAAfAFAQAAAAHxBUAAAAAB8wUBAAAAAfQFAQAAAAH1BQEAAAAB9gUBAAAAAfcFAQAAAAH4BQEAAAAB-QUgAAAAAfsFAAAA-wUC_AVAAAAAAf0FQAAAAAECAAAA0gEAIG4AANwLACADAAAA0gEAIG4AANwLACBvAADbCwAgAWkAAN8XADACAAAA0gEAIGkAANsLACACAAAAwAsAIGkAANoLACAUpwVAAIULACG6BQEAgwsAIcEFQACFCwAhzgUCAJcLACHPBSAAmAsAIe0FAQCDCwAh7gUBAIQLACHvBQEAgwsAIfAFAQCECwAh8QVAAIoLACHzBQEAhAsAIfQFAQCECwAh9QUBAIQLACH2BQEAhAsAIfcFAQCECwAh-AUBAIQLACH5BSAAmAsAIfsFAADCC_sFIvwFQACKCwAh_QVAAIoLACEWVgAAxQsAIFcAANELACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHOBQIAlwsAIc8FIACYCwAh7QUBAIMLACHuBQEAhAsAIe8FAQCDCwAh8AUBAIQLACHxBUAAigsAIfMFAQCECwAh9AUBAIQLACH1BQEAhAsAIfYFAQCECwAh9wUBAIQLACH4BQEAhAsAIfkFIACYCwAh-wUAAMIL-wUi_AVAAIoLACH9BUAAigsAIRZWAADICwAgVwAA0wsAIKcFQAAAAAG6BQEAAAABwQVAAAAAAc4FAgAAAAHPBSAAAAAB7QUBAAAAAe4FAQAAAAHvBQEAAAAB8AUBAAAAAfEFQAAAAAHzBQEAAAAB9AUBAAAAAfUFAQAAAAH2BQEAAAAB9wUBAAAAAfgFAQAAAAH5BSAAAAAB-wUAAAD7BQL8BUAAAAAB_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-wsAMG8AAIAMADDTBwAA_AsAMNQHAAD9CwAw1QcAAP4LACDWBwAA_wsAMNcHAAD_CwAw2AcAAP8LADDZBwAA_wsAMNoHAACBDAAw2wcAAIIMADASJwAAnAwAICsAAJsMACA5AACZDAAgOgAAmgwAIDsAAJ8MACA8AACdDAAgpwVAAAAAAboFAQAAAAHBBUAAAAAB_wUCAAAAAYAGAgAAAAGBBgEAAAABggYBAAAAAYMGAQAAAAGEBgEAAAABhQYBAAAAAYcGAAAAhwYDiQYAAACJBgICAAAAfQAgbgAAngwAIAMAAAB9ACBuAACeDAAgbwAAhwwAIAFpAADWFwAwGCcAALcKACArAAC2CgAgOAAAtQoAIDkAALYKACA6AAC2CgAgOwAAuAoAIDwAALAKACChBQAAsgoAMKIFAAB0ABCjBQAAsgoAMKcFQADNCAAhugUBAAAAAcEFQADNCAAh_gUBAMoIACH_BQIA7wgAIYAGAgDvCAAhgQYBAMwIACGCBgEAzAgAIYMGAQDMCAAhhAYBAAAAAYUGAQDMCAAhhwYAALMKhwYjiQYAALQKiQYixwcAALEKACACAAAAfQAgaQAAhwwAIAIAAACDDAAgaQAAhAwAIBChBQAAggwAMKIFAACDDAAQowUAAIIMADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACH-BQEAyggAIf8FAgDvCAAhgAYCAO8IACGBBgEAzAgAIYIGAQDMCAAhgwYBAMwIACGEBgEAzAgAIYUGAQDMCAAhhwYAALMKhwYjiQYAALQKiQYiEKEFAACCDAAwogUAAIMMABCjBQAAggwAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIf4FAQDKCAAh_wUCAO8IACGABgIA7wgAIYEGAQDMCAAhggYBAMwIACGDBgEAzAgAIYQGAQDMCAAhhQYBAMwIACGHBgAAswqHBiOJBgAAtAqJBiIMpwVAAIULACG6BQEAgwsAIcEFQACFCwAh_wUCAJcLACGABgIAlwsAIYEGAQCECwAhggYBAIQLACGDBgEAhAsAIYQGAQCECwAhhQYBAIQLACGHBgAAhQyHBiOJBgAAhgyJBiIB1gcAAACHBgMB1gcAAACJBgISJwAAiwwAICsAAIoMACA5AACIDAAgOgAAiQwAIDsAAIwMACA8AACNDAAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAh_wUCAJcLACGABgIAlwsAIYEGAQCECwAhggYBAIQLACGDBgEAhAsAIYQGAQCECwAhhQYBAIQLACGHBgAAhQyHBiOJBgAAhgyJBiIHbgAAvxcAIG8AANQXACDTBwAAwBcAINQHAADTFwAg1wcAAHgAINgHAAB4ACDZBwAAegAgB24AAL0XACBvAADRFwAg0wcAAL4XACDUBwAA0BcAINcHAAB4ACDYBwAAeAAg2QcAAHoAIAduAAC7FwAgbwAAzhcAINMHAAC8FwAg1AcAAM0XACDXBwAAeAAg2AcAAHgAINkHAAB6ACAHbgAAuRcAIG8AAMsXACDTBwAAuhcAINQHAADKFwAg1wcAADAAINgHAAAwACDZBwAAMgAgB24AALcXACBvAADIFwAg0wcAALgXACDUBwAAxxcAINcHAAB0ACDYBwAAdAAg2QcAAH0AIAtuAACODAAwbwAAkgwAMNMHAACPDAAw1AcAAJAMADDVBwAAkQwAINYHAAD_CwAw1wcAAP8LADDYBwAA_wsAMNkHAAD_CwAw2gcAAJMMADDbBwAAggwAMBInAACcDAAgKwAAmwwAIDgAAJgMACA5AACZDAAgOgAAmgwAIDwAAJ0MACCnBUAAAAABugUBAAAAAcEFQAAAAAH-BQEAAAAB_wUCAAAAAYAGAgAAAAGBBgEAAAABggYBAAAAAYMGAQAAAAGEBgEAAAABhwYAAACHBgOJBgAAAIkGAgIAAAB9ACBuAACXDAAgAwAAAH0AIG4AAJcMACBvAACVDAAgAWkAAMYXADACAAAAfQAgaQAAlQwAIAIAAACDDAAgaQAAlAwAIAynBUAAhQsAIboFAQCDCwAhwQVAAIULACH-BQEAgwsAIf8FAgCXCwAhgAYCAJcLACGBBgEAhAsAIYIGAQCECwAhgwYBAIQLACGEBgEAhAsAIYcGAACFDIcGI4kGAACGDIkGIhInAACLDAAgKwAAigwAIDgAAJYMACA5AACIDAAgOgAAiQwAIDwAAI0MACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACH-BQEAgwsAIf8FAgCXCwAhgAYCAJcLACGBBgEAhAsAIYIGAQCECwAhgwYBAIQLACGEBgEAhAsAIYcGAACFDIcGI4kGAACGDIkGIgVuAADBFwAgbwAAxBcAINMHAADCFwAg1AcAAMMXACDZBwAAhgEAIBInAACcDAAgKwAAmwwAIDgAAJgMACA5AACZDAAgOgAAmgwAIDwAAJ0MACCnBUAAAAABugUBAAAAAcEFQAAAAAH-BQEAAAAB_wUCAAAAAYAGAgAAAAGBBgEAAAABggYBAAAAAYMGAQAAAAGEBgEAAAABhwYAAACHBgOJBgAAAIkGAgNuAADBFwAg0wcAAMIXACDZBwAAhgEAIANuAAC_FwAg0wcAAMAXACDZBwAAegAgA24AAL0XACDTBwAAvhcAINkHAAB6ACADbgAAuxcAINMHAAC8FwAg2QcAAHoAIANuAAC5FwAg0wcAALoXACDZBwAAMgAgBG4AAI4MADDTBwAAjwwAMNUHAACRDAAg2QcAAP8LADASJwAAnAwAICsAAJsMACA5AACZDAAgOgAAmgwAIDsAAJ8MACA8AACdDAAgpwVAAAAAAboFAQAAAAHBBUAAAAAB_wUCAAAAAYAGAgAAAAGBBgEAAAABggYBAAAAAYMGAQAAAAGEBgEAAAABhQYBAAAAAYcGAAAAhwYDiQYAAACJBgIDbgAAtxcAINMHAAC4FwAg2QcAAH0AIAY3AAChDAAgugUBAAAAAbwFAAAAjAYCwQVAAAAAAcoFAQAAAAGMBgIAAAABBG4AAPsLADDTBwAA_AsAMNUHAAD-CwAg2QcAAP8LADAJJAAAzgwAIDMAAM8MACA0AADQDAAgNQAA0QwAILoFAQAAAAHBBUAAAAABiQYAAACQBgKNBgEAAAABjgYCAAAAAQIAAAB6ACBuAADNDAAgAwAAAHoAIG4AAM0MACBvAACtDAAgAWkAALYXADAQJAAAmwoAIDIAAK8KACAzAACwCgAgNAAAsAoAIDUAALAKACChBQAAuwoAMKIFAAB4ABCjBQAAuwoAMLoFAQAAAAHBBUAAzQgAIYkGAAC8CpAGIooGAQDKCAAhjQYBAMoIACGOBgIA7wgAIcgHAAC5CgAgyQcAALoKACACAAAAegAgaQAArQwAIAIAAACqDAAgaQAAqwwAIAmhBQAAqQwAMKIFAACqDAAQowUAAKkMADC6BQEAyggAIcEFQADNCAAhiQYAALwKkAYiigYBAMoIACGNBgEAyggAIY4GAgDvCAAhCaEFAACpDAAwogUAAKoMABCjBQAAqQwAMLoFAQDKCAAhwQVAAM0IACGJBgAAvAqQBiKKBgEAyggAIY0GAQDKCAAhjgYCAO8IACEFugUBAIMLACHBBUAAhQsAIYkGAACsDJAGIo0GAQCDCwAhjgYCAJcLACEB1gcAAACQBgIJJAAArgwAIDMAAK8MACA0AACwDAAgNQAAsQwAILoFAQCDCwAhwQVAAIULACGJBgAArAyQBiKNBgEAgwsAIY4GAgCXCwAhBW4AAK4XACBvAAC0FwAg0wcAAK8XACDUBwAAsxcAINkHAAAtACALbgAAxAwAMG8AAMgMADDTBwAAxQwAMNQHAADGDAAw1QcAAMcMACDWBwAA_wsAMNcHAAD_CwAw2AcAAP8LADDZBwAA_wsAMNoHAADJDAAw2wcAAIIMADALbgAAuwwAMG8AAL8MADDTBwAAvAwAMNQHAAC9DAAw1QcAAL4MACDWBwAA_wsAMNcHAAD_CwAw2AcAAP8LADDZBwAA_wsAMNoHAADADAAw2wcAAIIMADALbgAAsgwAMG8AALYMADDTBwAAswwAMNQHAAC0DAAw1QcAALUMACDWBwAA_wsAMNcHAAD_CwAw2AcAAP8LADDZBwAA_wsAMNoHAAC3DAAw2wcAAIIMADASJwAAnAwAIDgAAJgMACA5AACZDAAgOgAAmgwAIDsAAJ8MACA8AACdDAAgpwVAAAAAAboFAQAAAAHBBUAAAAAB_gUBAAAAAf8FAgAAAAGABgIAAAABgQYBAAAAAYIGAQAAAAGEBgEAAAABhQYBAAAAAYcGAAAAhwYDiQYAAACJBgICAAAAfQAgbgAAugwAIAMAAAB9ACBuAAC6DAAgbwAAuQwAIAFpAACyFwAwAgAAAH0AIGkAALkMACACAAAAgwwAIGkAALgMACAMpwVAAIULACG6BQEAgwsAIcEFQACFCwAh_gUBAIMLACH_BQIAlwsAIYAGAgCXCwAhgQYBAIQLACGCBgEAhAsAIYQGAQCECwAhhQYBAIQLACGHBgAAhQyHBiOJBgAAhgyJBiISJwAAiwwAIDgAAJYMACA5AACIDAAgOgAAiQwAIDsAAIwMACA8AACNDAAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAh_gUBAIMLACH_BQIAlwsAIYAGAgCXCwAhgQYBAIQLACGCBgEAhAsAIYQGAQCECwAhhQYBAIQLACGHBgAAhQyHBiOJBgAAhgyJBiISJwAAnAwAIDgAAJgMACA5AACZDAAgOgAAmgwAIDsAAJ8MACA8AACdDAAgpwVAAAAAAboFAQAAAAHBBUAAAAAB_gUBAAAAAf8FAgAAAAGABgIAAAABgQYBAAAAAYIGAQAAAAGEBgEAAAABhQYBAAAAAYcGAAAAhwYDiQYAAACJBgISJwAAnAwAICsAAJsMACA4AACYDAAgOQAAmQwAIDsAAJ8MACA8AACdDAAgpwVAAAAAAboFAQAAAAHBBUAAAAAB_gUBAAAAAf8FAgAAAAGABgIAAAABgQYBAAAAAYMGAQAAAAGEBgEAAAABhQYBAAAAAYcGAAAAhwYDiQYAAACJBgICAAAAfQAgbgAAwwwAIAMAAAB9ACBuAADDDAAgbwAAwgwAIAFpAACxFwAwAgAAAH0AIGkAAMIMACACAAAAgwwAIGkAAMEMACAMpwVAAIULACG6BQEAgwsAIcEFQACFCwAh_gUBAIMLACH_BQIAlwsAIYAGAgCXCwAhgQYBAIQLACGDBgEAhAsAIYQGAQCECwAhhQYBAIQLACGHBgAAhQyHBiOJBgAAhgyJBiISJwAAiwwAICsAAIoMACA4AACWDAAgOQAAiAwAIDsAAIwMACA8AACNDAAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAh_gUBAIMLACH_BQIAlwsAIYAGAgCXCwAhgQYBAIQLACGDBgEAhAsAIYQGAQCECwAhhQYBAIQLACGHBgAAhQyHBiOJBgAAhgyJBiISJwAAnAwAICsAAJsMACA4AACYDAAgOQAAmQwAIDsAAJ8MACA8AACdDAAgpwVAAAAAAboFAQAAAAHBBUAAAAAB_gUBAAAAAf8FAgAAAAGABgIAAAABgQYBAAAAAYMGAQAAAAGEBgEAAAABhQYBAAAAAYcGAAAAhwYDiQYAAACJBgISJwAAnAwAICsAAJsMACA4AACYDAAgOgAAmgwAIDsAAJ8MACA8AACdDAAgpwVAAAAAAboFAQAAAAHBBUAAAAAB_gUBAAAAAf8FAgAAAAGABgIAAAABggYBAAAAAYMGAQAAAAGEBgEAAAABhQYBAAAAAYcGAAAAhwYDiQYAAACJBgICAAAAfQAgbgAAzAwAIAMAAAB9ACBuAADMDAAgbwAAywwAIAFpAACwFwAwAgAAAH0AIGkAAMsMACACAAAAgwwAIGkAAMoMACAMpwVAAIULACG6BQEAgwsAIcEFQACFCwAh_gUBAIMLACH_BQIAlwsAIYAGAgCXCwAhggYBAIQLACGDBgEAhAsAIYQGAQCECwAhhQYBAIQLACGHBgAAhQyHBiOJBgAAhgyJBiISJwAAiwwAICsAAIoMACA4AACWDAAgOgAAiQwAIDsAAIwMACA8AACNDAAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAh_gUBAIMLACH_BQIAlwsAIYAGAgCXCwAhggYBAIQLACGDBgEAhAsAIYQGAQCECwAhhQYBAIQLACGHBgAAhQyHBiOJBgAAhgyJBiISJwAAnAwAICsAAJsMACA4AACYDAAgOgAAmgwAIDsAAJ8MACA8AACdDAAgpwVAAAAAAboFAQAAAAHBBUAAAAAB_gUBAAAAAf8FAgAAAAGABgIAAAABggYBAAAAAYMGAQAAAAGEBgEAAAABhQYBAAAAAYcGAAAAhwYDiQYAAACJBgIJJAAAzgwAIDMAAM8MACA0AADQDAAgNQAA0QwAILoFAQAAAAHBBUAAAAABiQYAAACQBgKNBgEAAAABjgYCAAAAAQNuAACuFwAg0wcAAK8XACDZBwAALQAgBG4AAMQMADDTBwAAxQwAMNUHAADHDAAg2QcAAP8LADAEbgAAuwwAMNMHAAC8DAAw1QcAAL4MACDZBwAA_wsAMARuAACyDAAw0wcAALMMADDVBwAAtQwAINkHAAD_CwAwFSAAANMMACArAADUDAAgMQAA1QwAIDYAANYMACCnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAAB4wUBAAAAAfAFAQAAAAGJBgAAAJQGApAGAQAAAAGSBgAAAJIGApQGAgAAAAGVBgEAAAABlgYBAAAAAZgGQAAAAAGZBkAAAAABmgYBAAAAAZsGIAAAAAGcBiAAAAABA24AAKwXACDTBwAArRcAINkHAACkAwAgA24AAKoXACDTBwAAqxcAINkHAAAtACAEbgAAogwAMNMHAACjDAAw1QcAAKUMACDZBwAApgwAMARuAADuCwAw0wcAAO8LADDVBwAA8QsAINkHAADyCwAwERYAALIOACAeAACzDgAgHwAAtA4AIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHjBQEAAAAB8AUBAAAAAYkGAAAA4wYCmwYgAAAAAZwGIAAAAAHdBgEAAAAB3gYBAAAAAd8GAQAAAAHgBkAAAAAB4QYBAAAAAQIAAADNAQAgbgAAsQ4AIAMAAADNAQAgbgAAsQ4AIG8AAOIMACABaQAAqRcAMBYVAACHCgAgFgAA6AkAIB4AAIwKACAfAACNCgAgoQUAAIoKADCiBQAANAAQowUAAIoKADCnBUAAzQgAIboFAQAAAAHBBUAAzQgAIcoFAQDKCAAh4wUBAAAAAfAFAQDMCAAhiQYAAIsK4wYilwYBAMwIACGbBiAA9AgAIZwGIAD0CAAh3QYBAMwIACHeBgEAzAgAId8GAQDMCAAh4AZAAM0IACHhBgEAyggAIQIAAADNAQAgaQAA4gwAIAIAAADfDAAgaQAA4AwAIBKhBQAA3gwAMKIFAADfDAAQowUAAN4MADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACHKBQEAyggAIeMFAQDKCAAh8AUBAMwIACGJBgAAiwrjBiKXBgEAzAgAIZsGIAD0CAAhnAYgAPQIACHdBgEAzAgAId4GAQDMCAAh3wYBAMwIACHgBkAAzQgAIeEGAQDKCAAhEqEFAADeDAAwogUAAN8MABCjBQAA3gwAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIcoFAQDKCAAh4wUBAMoIACHwBQEAzAgAIYkGAACLCuMGIpcGAQDMCAAhmwYgAPQIACGcBiAA9AgAId0GAQDMCAAh3gYBAMwIACHfBgEAzAgAIeAGQADNCAAh4QYBAMoIACEOpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHjBQEAgwsAIfAFAQCECwAhiQYAAOEM4wYimwYgAJgLACGcBiAAmAsAId0GAQCECwAh3gYBAIQLACHfBgEAhAsAIeAGQACFCwAh4QYBAIMLACEB1gcAAADjBgIRFgAA4wwAIB4AAOQMACAfAADlDAAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHjBQEAgwsAIfAFAQCECwAhiQYAAOEM4wYimwYgAJgLACGcBiAAmAsAId0GAQCECwAh3gYBAIQLACHfBgEAhAsAIeAGQACFCwAh4QYBAIMLACELbgAArA0AMG8AALENADDTBwAArQ0AMNQHAACuDQAw1QcAAK8NACDWBwAAsA0AMNcHAACwDQAw2AcAALANADDZBwAAsA0AMNoHAACyDQAw2wcAALMNADALbgAAkw0AMG8AAJgNADDTBwAAlA0AMNQHAACVDQAw1QcAAJYNACDWBwAAlw0AMNcHAACXDQAw2AcAAJcNADDZBwAAlw0AMNoHAACZDQAw2wcAAJoNADALbgAA5gwAMG8AAOsMADDTBwAA5wwAMNQHAADoDAAw1QcAAOkMACDWBwAA6gwAMNcHAADqDAAw2AcAAOoMADDZBwAA6gwAMNoHAADsDAAw2wcAAO0MADAYGAAAjw0AIBoAAJANACAbAACRDQAgHAAAkg0AIKcFQAAAAAG6BQEAAAABwQVAAAAAAYkGAAAAsAYCqQYBAAAAAasGAQAAAAGsBgEAAAABrQYBAAAAAa4GEAAAAAGwBgAAAKAGArEGAAAAoQYCsgYBAAAAAbMGAQAAAAG0BgEAAAABtQYBAAAAAbYGAQAAAAG3BkAAAAABuAZAAAAAAbkGQAAAAAG6BgEAAAABAgAAAEoAIG4AAI4NACADAAAASgAgbgAAjg0AIG8AAPQMACABaQAAqBcAMB0XAADVCgAgGAAA1goAIBoAANcKACAbAACFCgAgHAAAhQoAIKEFAADTCgAwogUAAEgAEKMFAADTCgAwpwVAAM0IACG6BQEAAAABwQVAAM0IACGJBgAA1AqwBiKpBgEAAAABqgYBAMoIACGrBgEAyggAIawGAQDKCAAhrQYBAMoIACGuBhAA5gkAIbAGAACBCqAGIrEGAACCCqEGIrIGAQDMCAAhswYBAMwIACG0BgEAzAgAIbUGAQAAAAG2BgEAzAgAIbcGQACDCgAhuAZAAIMKACG5BkAAgwoAIboGAQDMCAAhAgAAAEoAIGkAAPQMACACAAAA7gwAIGkAAO8MACAYoQUAAO0MADCiBQAA7gwAEKMFAADtDAAwpwVAAM0IACG6BQEAyggAIcEFQADNCAAhiQYAANQKsAYiqQYBAMoIACGqBgEAyggAIasGAQDKCAAhrAYBAMoIACGtBgEAyggAIa4GEADmCQAhsAYAAIEKoAYisQYAAIIKoQYisgYBAMwIACGzBgEAzAgAIbQGAQDMCAAhtQYBAMwIACG2BgEAzAgAIbcGQACDCgAhuAZAAIMKACG5BkAAgwoAIboGAQDMCAAhGKEFAADtDAAwogUAAO4MABCjBQAA7QwAMKcFQADNCAAhugUBAMoIACHBBUAAzQgAIYkGAADUCrAGIqkGAQDKCAAhqgYBAMoIACGrBgEAyggAIawGAQDKCAAhrQYBAMoIACGuBhAA5gkAIbAGAACBCqAGIrEGAACCCqEGIrIGAQDMCAAhswYBAMwIACG0BgEAzAgAIbUGAQDMCAAhtgYBAMwIACG3BkAAgwoAIbgGQACDCgAhuQZAAIMKACG6BgEAzAgAIRSnBUAAhQsAIboFAQCDCwAhwQVAAIULACGJBgAA8QywBiKpBgEAgwsAIasGAQCDCwAhrAYBAIMLACGtBgEAgwsAIa4GEADwDAAhsAYAAPIMoAYisQYAAPMMoQYisgYBAIQLACGzBgEAhAsAIbQGAQCECwAhtQYBAIQLACG2BgEAhAsAIbcGQACKCwAhuAZAAIoLACG5BkAAigsAIboGAQCECwAhBdYHEAAAAAHcBxAAAAAB3QcQAAAAAd4HEAAAAAHfBxAAAAABAdYHAAAAsAYCAdYHAAAAoAYCAdYHAAAAoQYCGBgAAPUMACAaAAD2DAAgGwAA9wwAIBwAAPgMACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACGJBgAA8QywBiKpBgEAgwsAIasGAQCDCwAhrAYBAIMLACGtBgEAgwsAIa4GEADwDAAhsAYAAPIMoAYisQYAAPMMoQYisgYBAIQLACGzBgEAhAsAIbQGAQCECwAhtQYBAIQLACG2BgEAhAsAIbcGQACKCwAhuAZAAIoLACG5BkAAigsAIboGAQCECwAhC24AAIANADBvAACFDQAw0wcAAIENADDUBwAAgg0AMNUHAACDDQAg1gcAAIQNADDXBwAAhA0AMNgHAACEDQAw2QcAAIQNADDaBwAAhg0AMNsHAACHDQAwB24AAPkMACBvAAD8DAAg0wcAAPoMACDUBwAA-wwAINcHAABBACDYBwAAQQAg2QcAAO0BACAHbgAAlRcAIG8AAKYXACDTBwAAlhcAINQHAAClFwAg1wcAABIAINgHAAASACDZBwAAAQAgB24AAJMXACBvAACjFwAg0wcAAJQXACDUBwAAohcAINcHAAASACDYBwAAEgAg2QcAAAEAIAwLAAD_DAAgLQAAAKAGAqcFQAAAAAG6BQEAAAABwQVAAAAAAd4FAQAAAAGJBgAAAKEGAp4GEAAAAAGhBgEAAAABogYBAAAAAaMGAQAAAAGkBkAAAAABAgAAAO0BACBuAAD5DAAgAwAAAEEAIG4AAPkMACBvAAD9DAAgDgAAAEEAIAsAAP4MACAtAADyDKAGImkAAP0MACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHeBQEAhAsAIYkGAADzDKEGIp4GEADwDAAhoQYBAIQLACGiBgEAhAsAIaMGAQCECwAhpAZAAIoLACEMCwAA_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_DQAgAwAAAFgAIG4AAL8NACBvAADDDQAgCgAAAFgAICYAAMQNACAoAADFDQAgaQAAww0AILoFAQCDCwAhwQVAAIULACHbBgEAhAsAIeMGAQCDCwAh5AYBAIQLACHlBkAAhQsAIQgmAADEDQAgKAAAxQ0AILoFAQCDCwAhwQVAAIULACHbBgEAhAsAIeMGAQCDCwAh5AYBAIQLACHlBkAAhQsAIQVuAAD9FgAgbwAAgxcAINMHAAD-FgAg1AcAAIIXACDZBwAAVQAgB24AAPsWACBvAACAFwAg0wcAAPwWACDUBwAA_xYAINcHAAArACDYBwAAKwAg2QcAAC0AIANuAAD9FgAg0wcAAP4WACDZBwAAVQAgA24AAPsWACDTBwAA_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-BQEAAAAB_wUCAAAAAYAGAgAAAAGBBgEAAAABggYBAAAAAYMGAQAAAAGFBgEAAAABhwYAAACHBgOJBgAAAIkGAgIAAAB9ACBuAADqDQAgAwAAAHQAIG4AAOoNACBvAADuDQAgFAAAAHQAICsAAIoMACA4AACWDAAgOQAAiAwAIDoAAIkMACA7AACMDAAgPAAAjQwAIGkAAO4NACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACH-BQEAgwsAIf8FAgCXCwAhgAYCAJcLACGBBgEAhAsAIYIGAQCECwAhgwYBAIQLACGFBgEAhAsAIYcGAACFDIcGI4kGAACGDIkGIhIrAACKDAAgOAAAlgwAIDkAAIgMACA6AACJDAAgOwAAjAwAIDwAAI0MACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACH-BQEAgwsAIf8FAgCXCwAhgAYCAJcLACGBBgEAhAsAIYIGAQCECwAhgwYBAIQLACGFBgEAhAsAIYcGAACFDIcGI4kGAACGDIkGIhUrAACGDgAgLQAAhw4AIC8AAIgOACCnBUAAAAABugUBAAAAAcEFQAAAAAGDBgEAAAABiQYAAADMBgLDBgAAAMMGAsQGAQAAAAHFBgIAAAABxgYBAAAAAccGgAAAAAHIBgEAAAAByQYBAAAAAcoGAQAAAAHMBgEAAAABzQYBAAAAAc4GQAAAAAHPBgEAAAAB0AZAAAAAAQIAAABoACBuAADvDQAgAwAAAGYAIG4AAO8NACBvAADzDQAgFwAAAGYAICsAAPYNACAtAAD3DQAgLwAA-A0AIGkAAPMNACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACGDBgEAhAsAIYkGAAD1DcwGIsMGAAD0DcMGIsQGAQCDCwAhxQYCAKELACHGBgEAhAsAIccGgAAAAAHIBgEAhAsAIckGAQCECwAhygYBAIQLACHMBgEAhAsAIc0GAQCECwAhzgZAAIoLACHPBgEAhAsAIdAGQACKCwAhFSsAAPYNACAtAAD3DQAgLwAA-A0AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIYMGAQCECwAhiQYAAPUNzAYiwwYAAPQNwwYixAYBAIMLACHFBgIAoQsAIcYGAQCECwAhxwaAAAAAAcgGAQCECwAhyQYBAIQLACHKBgEAhAsAIcwGAQCECwAhzQYBAIQLACHOBkAAigsAIc8GAQCECwAh0AZAAIoLACEB1gcAAADDBgIB1gcAAADMBgIHbgAA4RYAIG8AAOgWACDTBwAA4hYAINQHAADnFgAg1wcAAGIAINgHAABiACDZBwAAZAAgBW4AAN8WACBvAADlFgAg0wcAAOAWACDUBwAA5BYAINkHAADuBAAgC24AAPkNADBvAAD-DQAw0wcAAPoNADDUBwAA-w0AMNUHAAD8DQAg1gcAAP0NADDXBwAA_Q0AMNgHAAD9DQAw2QcAAP0NADDaBwAA_w0AMNsHAACADgAwBboFAQAAAAHBBUAAAAABwgUBAAAAAcMFAAAAwQYCwQYBAAAAAQIAAABvACBuAACFDgAgAwAAAG8AIG4AAIUOACBvAACEDgAgAWkAAOMWADAKLgAAvwoAIKEFAAC9CgAwogUAAG0AEKMFAAC9CgAwugUBAAAAAcEFQADNCAAhwgUBAMwIACHDBQAAvgrBBiK_BgEAyggAIcEGAQDMCAAhAgAAAG8AIGkAAIQOACACAAAAgQ4AIGkAAIIOACAJoQUAAIAOADCiBQAAgQ4AEKMFAACADgAwugUBAMoIACHBBUAAzQgAIcIFAQDMCAAhwwUAAL4KwQYivwYBAMoIACHBBgEAzAgAIQmhBQAAgA4AMKIFAACBDgAQowUAAIAOADC6BQEAyggAIcEFQADNCAAhwgUBAMwIACHDBQAAvgrBBiK_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_DvAGIpAGAQCDCwAhnAYgAJgLACHwBgEAhAsAIfIGQACKCwAh8wYBAIQLACEFbgAAuhYAIG8AAMwWACDTBwAAuxYAINQHAADLFgAg2QcAAKQDACAHbgAAuBYAIG8AAMkWACDTBwAAuRYAINQHAADIFgAg1wcAACYAINgHAAAmACDZBwAAKAAgC24AANAOADBvAADUDgAw0wcAANEOADDUBwAA0g4AMNUHAADTDgAg1gcAAMwNADDXBwAAzA0AMNgHAADMDQAw2QcAAMwNADDaBwAA1Q4AMNsHAADPDQAwC24AAMUOADBvAADJDgAw0wcAAMYOADDUBwAAxw4AMNUHAADIDgAg1gcAALANADDXBwAAsA0AMNgHAACwDQAw2QcAALANADDaBwAAyg4AMNsHAACzDQAwExcAAM8OACAgAACqDgAgLgAArQ4AIDEAAKwOACA9AACuDgAgPgAArw4AID8AALAOACCnBUAAAAABugUBAAAAAcEFQAAAAAGJBgAAANsGApAGAQAAAAGqBgEAAAAB1AZAAAAAAdUGAgAAAAHWBgIAAAAB1wYgAAAAAdgGIAAAAAHbBgEAAAABAgAAADIAIG4AAM4OACADAAAAMgAgbgAAzg4AIG8AAMwOACABaQAAxxYAMAIAAAAyACBpAADMDgAgAgAAALQNACBpAADLDgAgDKcFQACFCwAhugUBAIMLACHBBUAAhQsAIYkGAAC2DdsGIpAGAQCDCwAhqgYBAIQLACHUBkAAhQsAIdUGAgCXCwAh1gYCAJcLACHXBiAAmAsAIdgGIACYCwAh2wYBAIQLACETFwAAzQ4AICAAALgNACAuAAC7DQAgMQAAug0AID0AALwNACA-AAC9DQAgPwAAvg0AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIYkGAAC2DdsGIpAGAQCDCwAhqgYBAIQLACHUBkAAhQsAIdUGAgCXCwAh1gYCAJcLACHXBiAAmAsAIdgGIACYCwAh2wYBAIQLACEHbgAAwhYAIG8AAMUWACDTBwAAwxYAINQHAADEFgAg1wcAADQAINgHAAA0ACDZBwAAzQEAIBMXAADPDgAgIAAAqg4AIC4AAK0OACAxAACsDgAgPQAArg4AID4AAK8OACA_AACwDgAgpwVAAAAAAboFAQAAAAHBBUAAAAABiQYAAADbBgKQBgEAAAABqgYBAAAAAdQGQAAAAAHVBgIAAAAB1gYCAAAAAdcGIAAAAAHYBiAAAAAB2wYBAAAAAQNuAADCFgAg0wcAAMMWACDZBwAAzQEAIBMkAADoDQAgJQAA2g4AICkAAOkNACCnBUAAAAABugUBAAAAAcEFQAAAAAGJBgAAAOcGAo0GAQAAAAG0BgEAAAABzwYBAAAAAdAGQAAAAAHbBgEAAAAB5wYBAAAAAegGQAAAAAHpBgEAAAAB6gZAAAAAAewGAAAA7AYD7QYBAAAAAe4GAQAAAAECAAAAVQAgbgAA2Q4AIAMAAABVACBuAADZDgAgbwAA1w4AIAFpAADBFgAwAgAAAFUAIGkAANcOACACAAAA0A0AIGkAANYOACAQpwVAAIULACG6BQEAgwsAIcEFQACFCwAhiQYAANIN5wYijQYBAIMLACG0BgEAhAsAIc8GAQCECwAh0AZAAIoLACHbBgEAhAsAIecGAQCECwAh6AZAAIULACHpBgEAhAsAIeoGQACKCwAh7AYAANMN7AYj7QYBAIQLACHuBgEAhAsAIRMkAADWDQAgJQAA2A4AICkAANcNACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACGJBgAA0g3nBiKNBgEAgwsAIbQGAQCECwAhzwYBAIQLACHQBkAAigsAIdsGAQCECwAh5wYBAIQLACHoBkAAhQsAIekGAQCECwAh6gZAAIoLACHsBgAA0w3sBiPtBgEAhAsAIe4GAQCECwAhB24AALwWACBvAAC_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-w4AIEoAAPwOACBLAAD9DgAgTAAA_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_2BiL0BgEAgwsAIfYGAgChCwAh9wYCAKELACH4BgEAgwsAIQHWBwAAAPYGAglAAAC2DwAgugUBAIMLACHBBUAAhQsAIcIFAQCECwAhwwUAALQP9gYi9AYBAIMLACH2BgIAoQsAIfcGAgChCwAh-AYBAIMLACEFbgAAmhYAIG8AAJ0WACDTBwAAmxYAINQHAACcFgAg2QcAAJkBACAJQAAAuA8AILoFAQAAAAHBBUAAAAABwgUBAAAAAcMFAAAA9gYC9AYBAAAAAfYGAgAAAAH3BgIAAAAB-AYBAAAAAQNuAACaFgAg0wcAAJsWACDZBwAAmQEAIAdAAADGDwAgpwVAAAAAAboFAQAAAAH0BgEAAAAB-QYBAAAAAfoGAgAAAAH7BiAAAAABAgAAAKgBACBuAADFDwAgAwAAAKgBACBuAADFDwAgbwAAww8AIAFpAACZFgAwDSQAAJsKACBAAACcCgAgoQUAAJkKADCiBQAApgEAEKMFAACZCgAwpwVAAM0IACG6BQEAAAABjQYBAMoIACH0BgEAyggAIfkGAQDKCAAh-gYCAJoKACH7BiAA9AgAIcIHAACYCgAgAgAAAKgBACBpAADDDwAgAgAAAMEPACBpAADCDwAgCqEFAADADwAwogUAAMEPABCjBQAAwA8AMKcFQADNCAAhugUBAMoIACGNBgEAyggAIfQGAQDKCAAh-QYBAMoIACH6BgIAmgoAIfsGIAD0CAAhCqEFAADADwAwogUAAMEPABCjBQAAwA8AMKcFQADNCAAhugUBAMoIACGNBgEAyggAIfQGAQDKCAAh-QYBAMoIACH6BgIAmgoAIfsGIAD0CAAhBqcFQACFCwAhugUBAIMLACH0BgEAgwsAIfkGAQCDCwAh-gYCAKELACH7BiAAmAsAIQdAAADEDwAgpwVAAIULACG6BQEAgwsAIfQGAQCDCwAh-QYBAIMLACH6BgIAoQsAIfsGIACYCwAhBW4AAJQWACBvAACXFgAg0wcAAJUWACDUBwAAlhYAINkHAACZAQAgB0AAAMYPACCnBUAAAAABugUBAAAAAfQGAQAAAAH5BgEAAAAB-gYCAAAAAfsGIAAAAAEDbgAAlBYAINMHAACVFgAg2QcAAJkBACAMQAAA1A8AIKcFQAAAAAG6BQEAAAABwQVAAAAAAd4FAQAAAAH0BgEAAAAB-gYCAAAAAfsGIAAAAAH8BhAAAAAB_QYCAAAAAf4GAgAAAAH_BiAAAAABAgAAAJ8BACBuAADTDwAgAwAAAJ8BACBuAADTDwAgbwAA0Q8AIAFpAACTFgAwEyQAAJsKACBAAACcCgAgoQUAAKEKADCiBQAAnQEAEKMFAAChCgAwpwVAAM0IACG6BQEAAAABwQVAAM0IACHeBQEAzAgAIY0GAQDKCAAh9AYBAMoIACH6BgIAmgoAIfsGIAD0CAAh_AYQAKIKACH9BgIAmgoAIf4GAgCaCgAh_wYgAPQIACHDBwAAnwoAIMQHAACgCgAgAgAAAJ8BACBpAADRDwAgAgAAAM8PACBpAADQDwAgD6EFAADODwAwogUAAM8PABCjBQAAzg8AMKcFQADNCAAhugUBAMoIACHBBUAAzQgAId4FAQDMCAAhjQYBAMoIACH0BgEAyggAIfoGAgCaCgAh-wYgAPQIACH8BhAAogoAIf0GAgCaCgAh_gYCAJoKACH_BiAA9AgAIQ-hBQAAzg8AMKIFAADPDwAQowUAAM4PADCnBUAAzQgAIboFAQDKCAAhwQVAAM0IACHeBQEAzAgAIY0GAQDKCAAh9AYBAMoIACH6BgIAmgoAIfsGIAD0CAAh_AYQAKIKACH9BgIAmgoAIf4GAgCaCgAh_wYgAPQIACELpwVAAIULACG6BQEAgwsAIcEFQACFCwAh3gUBAIQLACH0BgEAgwsAIfoGAgChCwAh-wYgAJgLACH8BhAAlA4AIf0GAgChCwAh_gYCAKELACH_BiAAmAsAIQxAAADSDwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAh3gUBAIQLACH0BgEAgwsAIfoGAgChCwAh-wYgAJgLACH8BhAAlA4AIf0GAgChCwAh_gYCAKELACH_BiAAmAsAIQVuAACOFgAgbwAAkRYAINMHAACPFgAg1AcAAJAWACDZBwAAmQEAIAxAAADUDwAgpwVAAAAAAboFAQAAAAHBBUAAAAAB3gUBAAAAAfQGAQAAAAH6BgIAAAAB-wYgAAAAAfwGEAAAAAH9BgIAAAAB_gYCAAAAAf8GIAAAAAEDbgAAjhYAINMHAACPFgAg2QcAAJkBACAHJwAA3w8AIDAAAKgOACC6BQEAAAABwQVAAAAAAYQGAQAAAAHSBgAAANIGAtMGEAAAAAECAAAAZAAgbgAA3g8AIAMAAABkACBuAADeDwAgbwAA3A8AIAFpAACNFgAwAgAAAGQAIGkAANwPACACAAAAkQ4AIGkAANsPACAFugUBAIMLACHBBUAAhQsAIYQGAQCDCwAh0gYAAJMO0gYi0wYQAJQOACEHJwAA3Q8AIDAAAJcOACC6BQEAgwsAIcEFQACFCwAhhAYBAIMLACHSBgAAkw7SBiLTBhAAlA4AIQVuAACIFgAgbwAAixYAINMHAACJFgAg1AcAAIoWACDZBwAAMgAgBycAAN8PACAwAACoDgAgugUBAAAAAcEFQAAAAAGEBgEAAAAB0gYAAADSBgLTBhAAAAABA24AAIgWACDTBwAAiRYAINkHAAAyACAsIAAA4Q8AIEgAAOIPACBJAADjDwAgSgAA5A8AIEsAAOUPACBMAADmDwAgTQAA5w8AIE4AAOgPACBPAADpDwAgpwVAAAAAAboFAQAAAAHBBUAAAAAB2wVAAAAAAeMFAQAAAAGJBgAAAJUHApAGAQAAAAGcBiAAAAABggcAAACCBwKJBwEAAAABigcBAAAAAYsHAQAAAAGMBwEAAAABjQcBAAAAAY4HQAAAAAGPByAAAAABkAcCAAAAAZEHAgAAAAGTBwAAAJMHApUHAQAAAAGWB4AAAAABmAdAAAAAAZkHAgAAAAGaBwIAAAABmwcCAAAAAZwHAgAAAAGdBwIAAAABngcCAAAAAZ8HAgAAAAGgBwIAAAABoQcCAAAAAaIHAgAAAAGjBwEAAAABpAcBAAAAAaUHAQAAAAEDbgAAhhYAINMHAACHFgAg2QcAAKQDACAEbgAA1Q8AMNMHAADWDwAw1QcAANgPACDZBwAAjQ4AMARuAADHDwAw0wcAAMgPADDVBwAAyg8AINkHAADLDwAwBG4AALkPADDTBwAAug8AMNUHAAC8DwAg2QcAAL0PADAEbgAAqg8AMNMHAACrDwAw1QcAAK0PACDZBwAArg8AMARuAAChDwAw0wcAAKIPADDVBwAApA8AINkHAADMDQAwBG4AAJgPADDTBwAAmQ8AMNUHAACbDwAg2QcAANwNADAEbgAAjQ8AMNMHAACODwAw1QcAAJAPACDZBwAApgwAMARuAACCDwAw0wcAAIMPADDVBwAAhQ8AINkHAADhCwAwA24AAIQWACDTBwAAhRYAINkHAAABACAEbgAA6w4AMNMHAADsDgAw1QcAAO4OACDZBwAA7w4AMARuAADgDgAw0wcAAOEOADDVBwAA4w4AINkHAAC5DgAwBG4AALUOADDTBwAAtg4AMNUHAAC4DgAg2QcAALkOADAEbgAA1wwAMNMHAADYDAAw1QcAANoMACDZBwAA2wwAMARuAADdCwAw0wcAAN4LADDVBwAA4AsAINkHAADhCwAwBG4AANQLADDTBwAA1QsAMNUHAADXCwAg2QcAALwLADAEbgAAyQsAMNMHAADKCwAw1QcAAMwLACDZBwAAvAsAMARuAAC4CwAw0wcAALkLADDVBwAAuwsAINkHAAC8CwAwBG4AAKwLADDTBwAArQsAMNUHAACvCwAg2QcAALALADAAAAAAAAVuAAD9FQAgbwAAghYAINMHAAD-FQAg1AcAAIEWACDZBwAAiQcAIAduAAD7DwAgbwAA_g8AINMHAAD8DwAg1AcAAP0PACDXBwAAkwcAINgHAACTBwAg2QcAAIkHACALrQQAAJwQACCvBAAAnRAAIKcFQAAAAAG6BQEAAAABvQUBAAAAAcEFQAAAAAHjBQEAAAAB5AUBAAAAAeUFAQAAAAHnBUAAAAAB6AUBAAAAAQIAAACJBwAgbgAA-w8AIAMAAACTBwAgbgAA-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-hUAINkHAACJBwAgA24AAPgVACDTBwAA-RUAINkHAACJBwAgAAAAB24AAPMVACBvAAD2FQAg0wcAAPQVACDUBwAA9RUAINcHAACPBwAg2AcAAI8HACDZBwAAkQcAIANuAADzFQAg0wcAAPQVACDZBwAAkQcAIAAABawEAACvEAAgrgQAAK8QACDeBQAA_woAIN8FAAD_CgAg0gcAALAQACABswUBAAAAAQitBAAAqxAAIK8EAACsEAAgsAQAAK0QACDkBQAA_woAIOUFAAD_CgAg5gUAAP8KACDoBQAA_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_YGIo0GAQCECwAh9gYCAKELACH3BgIAoQsAIfgGAQCDCwAhCSQAAKIRACC6BQEAgwsAIcEFQACFCwAhwgUBAIQLACHDBQAAtA_2BiKNBgEAhAsAIfYGAgChCwAh9wYCAKELACH4BgEAgwsAIQkkAACjEQAgugUBAAAAAcEFQAAAAAHCBQEAAAABwwUAAAD2BgKNBgEAAAAB9gYCAAAAAfcGAgAAAAH4BgEAAAABDCQAALERACCnBUAAAAABugUBAAAAAcEFQAAAAAHeBQEAAAABjQYBAAAAAfoGAgAAAAH7BiAAAAAB_AYQAAAAAf0GAgAAAAH-BgIAAAAB_wYgAAAAAQIAAACfAQAgbgAA2BEAIAMAAACfAQAgbgAA2BEAIG8AANcRACABaQAAvxUAMAIAAACfAQAgaQAA1xEAIAIAAADPDwAgaQAA1hEAIAunBUAAhQsAIboFAQCDCwAhwQVAAIULACHeBQEAhAsAIY0GAQCDCwAh-gYCAKELACH7BiAAmAsAIfwGEACUDgAh_QYCAKELACH-BgIAoQsAIf8GIACYCwAhDCQAALARACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHeBQEAhAsAIY0GAQCDCwAh-gYCAKELACH7BiAAmAsAIfwGEACUDgAh_QYCAKELACH-BgIAoQsAIf8GIACYCwAhDCQAALERACCnBUAAAAABugUBAAAAAcEFQAAAAAHeBQEAAAABjQYBAAAAAfoGAgAAAAH7BiAAAAAB_AYQAAAAAf0GAgAAAAH-BgIAAAAB_wYgAAAAAQNuAAC9FQAg0wcAAL4VACDZBwAApAMAIARuAADQEQAw0wcAANERADDVBwAA0xEAINkHAADLDwAwBG4AAMcRADDTBwAAyBEAMNUHAADKEQAg2QcAAK4PADAEbgAAvhEAMNMHAAC_EQAw1QcAAMERACDZBwAAvQ8AMAAAAAAAB24AALgVACBvAAC7FQAg0wcAALkVACDUBwAAuhUAINcHAAAmACDYBwAAJgAg2QcAACgAIANuAAC4FQAg0wcAALkVACDZBwAAKAAgAAAAAAALbgAAlRIAMG8AAJkSADDTBwAAlhIAMNQHAACXEgAw1QcAAJgSACDWBwAA7w4AMNcHAADvDgAw2AcAAO8OADDZBwAA7w4AMNoHAACaEgAw2wcAAPIOADALbgAAjBIAMG8AAJASADDTBwAAjRIAMNQHAACOEgAw1QcAAI8SACDWBwAAsA0AMNcHAACwDQAw2AcAALANADDZBwAAsA0AMNoHAACREgAw2wcAALMNADALbgAAgBIAMG8AAIUSADDTBwAAgRIAMNQHAACCEgAw1QcAAIMSACDWBwAAhBIAMNcHAACEEgAw2AcAAIQSADDZBwAAhBIAMNoHAACGEgAw2wcAAIcSADALbgAA9xEAMG8AAPsRADDTBwAA-BEAMNQHAAD5EQAw1QcAAPoRACDWBwAAuQ4AMNcHAAC5DgAw2AcAALkOADDZBwAAuQ4AMNoHAAD8EQAw2wcAALwOADALbgAA7hEAMG8AAPIRADDTBwAA7xEAMNQHAADwEQAw1QcAAPERACDWBwAA4QsAMNcHAADhCwAw2AcAAOELADDZBwAA4QsAMNoHAADzEQAw2wcAAOQLADAVFQAAjA8AICsAANQMACAxAADVDAAgNgAA1gwAIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHjBQEAAAAB8AUBAAAAAYkGAAAAlAYCkgYAAACSBgKUBgIAAAABlQYBAAAAAZYGAQAAAAGXBgEAAAABmAZAAAAAAZkGQAAAAAGaBgEAAAABmwYgAAAAAZwGIAAAAAECAAAAsgEAIG4AAPYRACADAAAAsgEAIG4AAPYRACBvAAD1EQAgAWkAALcVADACAAAAsgEAIGkAAPURACACAAAA5QsAIGkAAPQRACARpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHjBQEAgwsAIfAFAQCECwAhiQYAAOgLlAYikgYAAOcLkgYilAYCAJcLACGVBgEAhAsAIZYGAQCECwAhlwYBAIQLACGYBkAAigsAIZkGQACKCwAhmgYBAIQLACGbBiAAmAsAIZwGIACYCwAhFRUAAIoPACArAADrCwAgMQAA7AsAIDYAAO0LACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIeMFAQCDCwAh8AUBAIQLACGJBgAA6AuUBiKSBgAA5wuSBiKUBgIAlwsAIZUGAQCECwAhlgYBAIQLACGXBgEAhAsAIZgGQACKCwAhmQZAAIoLACGaBgEAhAsAIZsGIACYCwAhnAYgAJgLACEVFQAAjA8AICsAANQMACAxAADVDAAgNgAA1gwAIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHjBQEAAAAB8AUBAAAAAYkGAAAAlAYCkgYAAACSBgKUBgIAAAABlQYBAAAAAZYGAQAAAAGXBgEAAAABmAZAAAAAAZkGQAAAAAGaBgEAAAABmwYgAAAAAZwGIAAAAAERFgAA3w4AICEAAN0OACAiAADqDgAgKgAA3g4AIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHOBQIAAAAB4wUBAAAAAfAFAQAAAAGJBgAAAPAGApwGIAAAAAHwBgEAAAAB8QYBAAAAAfIGQAAAAAHzBgEAAAABAgAAAK4BACBuAAD_EQAgAwAAAK4BACBuAAD_EQAgbwAA_hEAIAFpAAC2FQAwAgAAAK4BACBpAAD-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-w4AIEoAAPwOACBLAAD9DgAgTAAA_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-QoAIAcAAPwKACChBQAA-woAMKIFAAAHABCjBQAA-woAMMEFQADNCAAhsAcBAMoIACG1BwEAyggAIc4HAAD6CgAgAgAAAAkAIGkAAN0SACACAAAA2xIAIGkAANwSACAGoQUAANoSADCiBQAA2xIAEKMFAADaEgAwwQVAAM0IACGwBwEAyggAIbUHAQDKCAAhBqEFAADaEgAwogUAANsSABCjBQAA2hIAMMEFQADNCAAhsAcBAMoIACG1BwEAyggAIQLBBUAAhQsAIbAHAQCDCwAhAwQAAMISACDBBUAAhQsAIbAHAQCDCwAhAwQAAMQSACDBBUAAAAABsAcBAAAAAQRuAADTEgAw0wcAANQSADDVBwAA1hIAINkHAADXEgAwAAGzBQEAAAABAAAAC24AAIATADBvAACEEwAw0wcAAIETADDUBwAAghMAMNUHAACDEwAg1gcAANcSADDXBwAA1xIAMNgHAADXEgAw2QcAANcSADDaBwAAhRMAMNsHAADaEgAwC24AAPQSADBvAAD5EgAw0wcAAPUSADDUBwAA9hIAMNUHAAD3EgAg1gcAAPgSADDXBwAA-BIAMNgHAAD4EgAw2QcAAPgSADDaBwAA-hIAMNsHAAD7EgAwC24AAOgSADBvAADtEgAw0wcAAOkSADDUBwAA6hIAMNUHAADrEgAg1gcAAOwSADDXBwAA7BIAMNgHAADsEgAw2QcAAOwSADDaBwAA7hIAMNsHAADvEgAwDgMAALsSACAKAAC9EgAgCwAAvhIAIKcFQAAAAAG6BQEAAAABuwUBAAAAAcEFQAAAAAHDBQAAALIHAokGAAAAswcCowYBAAAAAaQGQAAAAAH4BgEAAAABswcBAAAAAbQHAQAAAAECAAAAEAAgbgAA8xIAIAMAAAAQACBuAADzEgAgbwAA8hIAIAFpAAD_FAAwEwMAAO0KACAEAAD5CgAgCgAA7QoAIAsAAIUKACChBQAA9goAMKIFAAAOABCjBQAA9goAMKcFQADNCAAhugUBAAAAAbsFAQDKCAAhwQVAAM0IACHDBQAA9wqyByKJBgAA-AqzByKjBgEAzAgAIaQGQACDCgAh-AYBAMoIACGwBwEAyggAIbMHAQDMCAAhtAcBAMoIACECAAAAEAAgaQAA8hIAIAIAAADwEgAgaQAA8RIAIA-hBQAA7xIAMKIFAADwEgAQowUAAO8SADCnBUAAzQgAIboFAQDKCAAhuwUBAMoIACHBBUAAzQgAIcMFAAD3CrIHIokGAAD4CrMHIqMGAQDMCAAhpAZAAIMKACH4BgEAyggAIbAHAQDKCAAhswcBAMwIACG0BwEAyggAIQ-hBQAA7xIAMKIFAADwEgAQowUAAO8SADCnBUAAzQgAIboFAQDKCAAhuwUBAMoIACHBBUAAzQgAIcMFAAD3CrIHIokGAAD4CrMHIqMGAQDMCAAhpAZAAIMKACH4BgEAyggAIbAHAQDKCAAhswcBAMwIACG0BwEAyggAIQunBUAAhQsAIboFAQCDCwAhuwUBAIMLACHBBUAAhQsAIcMFAAC1ErIHIokGAAC2ErMHIqMGAQCECwAhpAZAAIoLACH4BgEAgwsAIbMHAQCECwAhtAcBAIMLACEOAwAAtxIAIAoAALkSACALAAC6EgAgpwVAAIULACG6BQEAgwsAIbsFAQCDCwAhwQVAAIULACHDBQAAtRKyByKJBgAAthKzByKjBgEAhAsAIaQGQACKCwAh-AYBAIMLACGzBwEAhAsAIbQHAQCDCwAhDgMAALsSACAKAAC9EgAgCwAAvhIAIKcFQAAAAAG6BQEAAAABuwUBAAAAAcEFQAAAAAHDBQAAALIHAokGAAAAswcCowYBAAAAAaQGQAAAAAH4BgEAAAABswcBAAAAAbQHAQAAAAEFAwAAzBIAIA0AAM4SACC7BQEAAAABwQVAAAAAAbYHAQAAAAECAAAABQAgbgAA_xIAIAMAAAAFACBuAAD_EgAgbwAA_hIAIAFpAAD-FAAwCwMAAO0KACAEAAD5CgAgDQAAhQoAIKEFAAD-CgAwogUAAAMAEKMFAAD-CgAwuwUBAMoIACHBBUAAzQgAIbAHAQDKCAAhtgcBAMwIACHPBwAA_QoAIAIAAAAFACBpAAD-EgAgAgAAAPwSACBpAAD9EgAgB6EFAAD7EgAwogUAAPwSABCjBQAA-xIAMLsFAQDKCAAhwQVAAM0IACGwBwEAyggAIbYHAQDMCAAhB6EFAAD7EgAwogUAAPwSABCjBQAA-xIAMLsFAQDKCAAhwQVAAM0IACGwBwEAyggAIbYHAQDMCAAhA7sFAQCDCwAhwQVAAIULACG2BwEAhAsAIQUDAADJEgAgDQAAyxIAILsFAQCDCwAhwQVAAIULACG2BwEAhAsAIQUDAADMEgAgDQAAzhIAILsFAQAAAAHBBUAAAAABtgcBAAAAAQMHAADFEgAgwQVAAAAAAbUHAQAAAAECAAAACQAgbgAAiBMAIAMAAAAJACBuAACIEwAgbwAAhxMAIAFpAAD9FAAwAgAAAAkAIGkAAIcTACACAAAA2xIAIGkAAIYTACACwQVAAIULACG1BwEAgwsAIQMHAADDEgAgwQVAAIULACG1BwEAgwsAIQMHAADFEgAgwQVAAAAAAbUHAQAAAAEEbgAAgBMAMNMHAACBEwAw1QcAAIMTACDZBwAA1xIAMARuAAD0EgAw0wcAAPUSADDVBwAA9xIAINkHAAD4EgAwBG4AAOgSADDTBwAA6RIAMNUHAADrEgAg2QcAAOwSADAAAAGzBQEAAAABAAAAAAALbgAAkhQAMG8AAJYUADDTBwAAkxQAMNQHAACUFAAw1QcAAJUUACDWBwAA-BIAMNcHAAD4EgAw2AcAAPgSADDZBwAA-BIAMNoHAACXFAAw2wcAAPsSADALbgAAiRQAMG8AAI0UADDTBwAAihQAMNQHAACLFAAw1QcAAIwUACDWBwAA-BIAMNcHAAD4EgAw2AcAAPgSADDZBwAA-BIAMNoHAACOFAAw2wcAAPsSADALbgAA_RMAMG8AAIIUADDTBwAA_hMAMNQHAAD_EwAw1QcAAIAUACDWBwAAgRQAMNcHAACBFAAw2AcAAIEUADDZBwAAgRQAMNoHAACDFAAw2wcAAIQUADALbgAA8RMAMG8AAPYTADDTBwAA8hMAMNQHAADzEwAw1QcAAPQTACDWBwAA9RMAMNcHAAD1EwAw2AcAAPUTADDZBwAA9RMAMNoHAAD3EwAw2wcAAPgTADALbgAA5RMAMG8AAOoTADDTBwAA5hMAMNQHAADnEwAw1QcAAOgTACDWBwAA6RMAMNcHAADpEwAw2AcAAOkTADDZBwAA6RMAMNoHAADrEwAw2wcAAOwTADALbgAA2RMAMG8AAN4TADDTBwAA2hMAMNQHAADbEwAw1QcAANwTACDWBwAA3RMAMNcHAADdEwAw2AcAAN0TADDZBwAA3RMAMNoHAADfEwAw2wcAAOATADALbgAA0BMAMG8AANQTADDTBwAA0RMAMNQHAADSEwAw1QcAANMTACDWBwAA7BIAMNcHAADsEgAw2AcAAOwSADDZBwAA7BIAMNoHAADVEwAw2wcAAO8SADALbgAAxxMAMG8AAMsTADDTBwAAyBMAMNQHAADJEwAw1QcAAMoTACDWBwAA7BIAMNcHAADsEgAw2AcAAOwSADDZBwAA7BIAMNoHAADMEwAw2wcAAO8SADALbgAAvhMAMG8AAMITADDTBwAAvxMAMNQHAADAEwAw1QcAAMETACDWBwAA7BIAMNcHAADsEgAw2AcAAOwSADDZBwAA7BIAMNoHAADDEwAw2wcAAO8SADALbgAAtRMAMG8AALkTADDTBwAAthMAMNQHAAC3EwAw1QcAALgTACDWBwAA6gwAMNcHAADqDAAw2AcAAOoMADDZBwAA6gwAMNoHAAC6EwAw2wcAAO0MADALbgAArBMAMG8AALATADDTBwAArRMAMNQHAACuEwAw1QcAAK8TACDWBwAA6gwAMNcHAADqDAAw2AcAAOoMADDZBwAA6gwAMNoHAACxEwAw2wcAAO0MADALbgAAoBMAMG8AAKUTADDTBwAAoRMAMNQHAACiEwAw1QcAAKMTACDWBwAApBMAMNcHAACkEwAw2AcAAKQTADDZBwAApBMAMNoHAACmEwAw2wcAAKcTADAMGQAA0xAAIC0AAACgBgKnBUAAAAABugUBAAAAAcEFQAAAAAHeBQEAAAABiQYAAAChBgKdBgEAAAABngYQAAAAAaEGAQAAAAGiBgEAAAABpAZAAAAAAQIAAADtAQAgbgAAqxMAIAMAAADtAQAgbgAAqxMAIG8AAKoTACABaQAA_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_BQEAAAABwAVAAAAAAcEFQAAAAAEJugUBAAAAAcEFQAAAAAHDBQEAAAABxAUBAAAAAcUFAQAAAAHGBQEAAAABxwWAAAAAAcgFAQAAAAHJBQEAAAABAgAAAB8AIG4AAPwTACADAAAAHwAgbgAA_BMAIG8AAPsTACABaQAA9BQAMA4QAACFCgAgoQUAAO4KADCiBQAAHQAQowUAAO4KADC6BQEAAAABwQVAAM0IACHCBQEAzAgAIcMFAQDKCAAhxAUBAMoIACHFBQEAzAgAIcYFAQDKCAAhxwUAAMIKACDIBQEAzAgAIckFAQDMCAAhAgAAAB8AIGkAAPsTACACAAAA-RMAIGkAAPoTACANoQUAAPgTADCiBQAA-RMAEKMFAAD4EwAwugUBAMoIACHBBUAAzQgAIcIFAQDMCAAhwwUBAMoIACHEBQEAyggAIcUFAQDMCAAhxgUBAMoIACHHBQAAwgoAIMgFAQDMCAAhyQUBAMwIACENoQUAAPgTADCiBQAA-RMAEKMFAAD4EwAwugUBAMoIACHBBUAAzQgAIcIFAQDMCAAhwwUBAMoIACHEBQEAyggAIcUFAQDMCAAhxgUBAMoIACHHBQAAwgoAIMgFAQDMCAAhyQUBAMwIACEJugUBAIMLACHBBUAAhQsAIcMFAQCDCwAhxAUBAIMLACHFBQEAhAsAIcYFAQCDCwAhxwWAAAAAAcgFAQCECwAhyQUBAIQLACEJugUBAIMLACHBBUAAhQsAIcMFAQCDCwAhxAUBAIMLACHFBQEAhAsAIcYFAQCDCwAhxwWAAAAAAcgFAQCECwAhyQUBAIQLACEJugUBAAAAAcEFQAAAAAHDBQEAAAABxAUBAAAAAcUFAQAAAAHGBQEAAAABxwWAAAAAAcgFAQAAAAHJBQEAAAABCboFAQAAAAHBBUAAAAAByAUBAAAAAckFAQAAAAGrBwEAAAABrAcgAAAAAa0HQAAAAAGuB0AAAAABrwdAAAAAAQIAAAAbACBuAACIFAAgAwAAABsAIG4AAIgUACBvAACHFAAgAWkAAPMUADAOAwAA7QoAIKEFAADvCgAwogUAABkAEKMFAADvCgAwugUBAAAAAbsFAQDKCAAhwQVAAM0IACHIBQEAzAgAIckFAQDMCAAhqwcBAAAAAawHIAD0CAAhrQdAAM0IACGuB0AAzQgAIa8HQACDCgAhAgAAABsAIGkAAIcUACACAAAAhRQAIGkAAIYUACANoQUAAIQUADCiBQAAhRQAEKMFAACEFAAwugUBAMoIACG7BQEAyggAIcEFQADNCAAhyAUBAMwIACHJBQEAzAgAIasHAQDKCAAhrAcgAPQIACGtB0AAzQgAIa4HQADNCAAhrwdAAIMKACENoQUAAIQUADCiBQAAhRQAEKMFAACEFAAwugUBAMoIACG7BQEAyggAIcEFQADNCAAhyAUBAMwIACHJBQEAzAgAIasHAQDKCAAhrAcgAPQIACGtB0AAzQgAIa4HQADNCAAhrwdAAIMKACEJugUBAIMLACHBBUAAhQsAIcgFAQCECwAhyQUBAIQLACGrBwEAgwsAIawHIACYCwAhrQdAAIULACGuB0AAhQsAIa8HQACKCwAhCboFAQCDCwAhwQVAAIULACHIBQEAhAsAIckFAQCECwAhqwcBAIMLACGsByAAmAsAIa0HQACFCwAhrgdAAIULACGvB0AAigsAIQm6BQEAAAABwQVAAAAAAcgFAQAAAAHJBQEAAAABqwcBAAAAAawHIAAAAAGtB0AAAAABrgdAAAAAAa8HQAAAAAEFAwAAzBIAIAQAAM0SACC7BQEAAAABwQVAAAAAAbAHAQAAAAECAAAABQAgbgAAkRQAIAMAAAAFACBuAACRFAAgbwAAkBQAIAFpAADyFAAwAgAAAAUAIGkAAJAUACACAAAA_BIAIGkAAI8UACADuwUBAIMLACHBBUAAhQsAIbAHAQCDCwAhBQMAAMkSACAEAADKEgAguwUBAIMLACHBBUAAhQsAIbAHAQCDCwAhBQMAAMwSACAEAADNEgAguwUBAAAAAcEFQAAAAAGwBwEAAAABBQQAAM0SACANAADOEgAgwQVAAAAAAbAHAQAAAAG2BwEAAAABAgAAAAUAIG4AAJoUACADAAAABQAgbgAAmhQAIG8AAJkUACABaQAA8RQAMAIAAAAFACBpAACZFAAgAgAAAPwSACBpAACYFAAgA8EFQACFCwAhsAcBAIMLACG2BwEAhAsAIQUEAADKEgAgDQAAyxIAIMEFQACFCwAhsAcBAIMLACG2BwEAhAsAIQUEAADNEgAgDQAAzhIAIMEFQAAAAAGwBwEAAAABtgcBAAAAAQRuAACSFAAw0wcAAJMUADDVBwAAlRQAINkHAAD4EgAwBG4AAIkUADDTBwAAihQAMNUHAACMFAAg2QcAAPgSADAEbgAA_RMAMNMHAAD-EwAw1QcAAIAUACDZBwAAgRQAMARuAADxEwAw0wcAAPITADDVBwAA9BMAINkHAAD1EwAwBG4AAOUTADDTBwAA5hMAMNUHAADoEwAg2QcAAOkTADAEbgAA2RMAMNMHAADaEwAw1QcAANwTACDZBwAA3RMAMARuAADQEwAw0wcAANETADDVBwAA0xMAINkHAADsEgAwBG4AAMcTADDTBwAAyBMAMNUHAADKEwAg2QcAAOwSADAEbgAAvhMAMNMHAAC_EwAw1QcAAMETACDZBwAA7BIAMARuAAC1EwAw0wcAALYTADDVBwAAuBMAINkHAADqDAAwBG4AAKwTADDTBwAArRMAMNUHAACvEwAg2QcAAOoMADAEbgAAoBMAMNMHAAChEwAw1QcAAKMTACDZBwAApBMAMAAAAAAAAAGzBQEAAAABDxcAANoUACAYAADbFAAgGgAA3BQAIBsAAK8UACAcAACvFAAgsgYAAP8KACCzBgAA_woAILQGAAD_CgAgtQYAAP8KACC2BgAA_woAILcGAAD_CgAguAYAAP8KACC5BgAA_woAILoGAAD_CgAg0gcAAN0UACAQBQAAjBMAIA4AAIwTACAPAACnFAAgEQAAqBQAIBIAAKkUACBdAACqFAAgXgAAjRMAIF8AAI0TACBgAACNEwAgYQAAqxQAIGIAAKsUACBjAACsFAAgvQcAAP8KACC_BwAA_woAIMAHAAD_CgAg0gcAAK0UACABswUBAAAAARATAACvFAAgUAAAoxIAIFEAAKYSACBSAACmEgAgUwAA5RQAIFQAAKcSACBYAADmFAAgWQAA5hQAIFoAAOYUACBcAADnFAAg1QUAAP8KACDWBQAA_woAINgFAAD_CgAg2gUAAP8KACDbBQAA_woAINIHAADoFAAgAbMFAQAAAAEBswUBAAAAAQABswUBAAAAAQYUAACjEgAgFgAApBIAIEQAAKUSACBFAACmEgAgRgAApxIAINIHAACoEgAgGCAAALYUACBHAACxFAAgSAAA4RQAIEkAAMEUACBKAADDFAAgSwAAwhQAIEwAALsUACBNAADYFAAgTgAAuBQAIE8AAKcSACDbBQAA_woAIIsHAAD_CgAgjQcAAP8KACCOBwAA_woAIJAHAAD_CgAgkQcAAP8KACCVBwAA_woAIJYHAAD_CgAglwcAAP8KACCYBwAA_woAIKMHAAD_CgAgpAcAAP8KACClBwAA_woAINIHAADkFAAgAAABswUBAAAAAQABswUBAAAAAQ8gAAC2FAAgQQAAwRQAIEIAAMIUACBDAADDFAAg3wUAAP8KACCQBgAA_woAILQGAAD_CgAgzwYAAP8KACDbBgAA_woAIO4GAAD_CgAgggcAAP8KACCGBwAA_woAIIcHAAD_CgAgiAcAAP8KACDSBwAAxBQAIAGzBQEAAAABAbMFAQAAAAEBswUBAAAAAQAAAAGzBQEAAAABDRUAALEUACAgAAC2FAAgKwAAtxQAIDEAALgUACA2AAC5FAAg8AUAAP8KACCVBgAA_woAIJYGAAD_CgAglwYAAP8KACCYBgAA_woAIJkGAAD_CgAgmgYAAP8KACDSBwAAuhQAIAABswUBAAAAAQMyAADFFAAgNwAAxhQAINIHAADHFAAgBiQAALcUACAyAADFFAAgMwAAxhQAIDQAAMYUACA1AADGFAAg0gcAAM0UACAMFwAA2hQAICAAALYUACAjAADXFAAgLgAAzhQAIDEAAOEUACA9AADLFAAgPgAAuxQAID8AAOIUACCqBgAA_woAINkGAAD_CgAg2wYAAP8KACDSBwAA4xQAIA4nAADKFAAgKwAAyRQAIDgAAMgUACA5AADJFAAgOgAAyRQAIDsAAMsUACA8AADGFAAggQYAAP8KACCCBgAA_woAIIMGAAD_CgAghAYAAP8KACCFBgAA_woAIIcGAAD_CgAg0gcAAMwUACABswUBAAAAAQGzBQEAAAABEScAAMoUACArAADQFAAgLQAA0RQAIC8AANIUACCDBgAA_woAIMUGAAD_CgAgxgYAAP8KACDHBgAA_woAIMgGAAD_CgAgyQYAAP8KACDKBgAA_woAIMwGAAD_CgAgzQYAAP8KACDOBgAA_woAIM8GAAD_CgAg0AYAAP8KACDSBwAA0xQAIAGzBQEAAAABBSQAALcUACAnAADKFAAgMAAAixEAINMGAAD_CgAg0gcAANQUACACLAAAixEAINIHAACMEQAgAAGzBQEAAAABAbMFAQAAAAEPIwAA1xQAICQAALcUACAlAADKFAAgKQAA2BQAILQGAAD_CgAgzwYAAP8KACDQBgAA_woAINsGAAD_CgAg5wYAAP8KACDpBgAA_woAIOoGAAD_CgAg7AYAAP8KACDtBgAA_woAIO4GAAD_CgAg0gcAANkUACABswUBAAAAAQsWAACkEgAgIAAAthQAICEAALEUACAiAACxFAAgKgAAuxQAIPAFAAD_CgAg8AYAAP8KACDxBgAA_woAIPIGAAD_CgAg8wYAAP8KACDSBwAAvBQAIAABswUBAAAAAQoVAACxFAAgFgAApBIAIB4AALQUACAfAACrFAAg8AUAAP8KACCXBgAA_woAIN0GAAD_CgAg3gYAAP8KACDfBgAA_woAINIHAAC1FAAgAAgLAACvFAAgGQAArhQAIN4FAAD_CgAgoQYAAP8KACCiBgAA_woAIKMGAAD_CgAgpAYAAP8KACDSBwAAsBQAIAGzBQEAAAABBBcAANoUACAYAADbFAAg8AUAAP8KACDSBwAA4BQAIAGzBQEAAAABAbMFAQAAAAEAByYAANUUACAnAADKFAAgKAAAtxQAIIQGAAD_CgAg2wYAAP8KACDkBgAA_woAINIHAADWFAAgAbMFAQAAAAEBswUBAAAAAQAAAAGzBQEAAAABAbMFAQAAAAEBswUBAAAAAQGzBQEAAAABBQgAAOASACAJAACMEwAgDAAAjRMAIPAFAAD_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_B0AAAAABwAdAAAAAAcEHQAAAAAECAAAAAQAgbgAAhRUAIAMAAAASACBuAACBFQAgbwAAiRUAIBsAAAASACAFAACUEwAgDwAAlhMAIBEAAJcTACASAACYEwAgXQAAmRMAIF4AAJoTACBfAACbEwAgYAAAnBMAIGEAAJ0TACBiAACeEwAgYwAAnxMAIGkAAIkVACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc8FIACYCwAhqQcBAIMLACG6BwEAgwsAIbsHAQCDCwAhvAcgAJgLACG9BwEAhAsAIb4HAgCXCwAhvwdAAIoLACHAB0AAigsAIcEHQACFCwAhGQUAAJQTACAPAACWEwAgEQAAlxMAIBIAAJgTACBdAACZEwAgXgAAmhMAIF8AAJsTACBgAACcEwAgYQAAnRMAIGIAAJ4TACBjAACfEwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHPBSAAmAsAIakHAQCDCwAhugcBAIMLACG7BwEAgwsAIbwHIACYCwAhvQcBAIQLACG-BwIAlwsAIb8HQACKCwAhwAdAAIoLACHBB0AAhQsAIQMAAACSAgAgbgAAgxUAIG8AAIwVACANAAAAkgIAIAgAAOUSACAMAADnEgAgaQAAjBUAIKQFAQCDCwAhpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHwBQEAhAsAIbcHIACYCwAhuAcgAJgLACG5ByAAmAsAIQsIAADlEgAgDAAA5xIAIKQFAQCDCwAhpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHwBQEAhAsAIbcHIACYCwAhuAcgAJgLACG5ByAAmAsAIQMAAAASACBuAACFFQAgbwAAjxUAIBsAAAASACAOAACVEwAgDwAAlhMAIBEAAJcTACASAACYEwAgXQAAmRMAIF4AAJoTACBfAACbEwAgYAAAnBMAIGEAAJ0TACBiAACeEwAgYwAAnxMAIGkAAI8VACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc8FIACYCwAhqQcBAIMLACG6BwEAgwsAIbsHAQCDCwAhvAcgAJgLACG9BwEAhAsAIb4HAgCXCwAhvwdAAIoLACHAB0AAigsAIcEHQACFCwAhGQ4AAJUTACAPAACWEwAgEQAAlxMAIBIAAJgTACBdAACZEwAgXgAAmhMAIF8AAJsTACBgAACcEwAgYQAAnRMAIGIAAJ4TACBjAACfEwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHPBSAAmAsAIakHAQCDCwAhugcBAIMLACG7BwEAgwsAIbwHIACYCwAhvQcBAIQLACG-BwIAlwsAIb8HQACKCwAhwAdAAIoLACHBB0AAhQsAIQSkBQEAAAABugUBAAAAAcEFQAAAAAHwBQEAAAABAgAAAKYCACBuAACQFQAgCwkAAIoTACAMAACLEwAgpAUBAAAAAacFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHwBQEAAAABtwcgAAAAAbgHIAAAAAG5ByAAAAABAgAAAI8CACBuAACSFQAgAwAAAKkCACBuAACQFQAgbwAAlhUAIAYAAACpAgAgaQAAlhUAIKQFAQCDCwAhugUBAIMLACHBBUAAhQsAIfAFAQCDCwAhBKQFAQCDCwAhugUBAIMLACHBBUAAhQsAIfAFAQCDCwAhAwAAAJICACBuAACSFQAgbwAAmRUAIA0AAACSAgAgCQAA5hIAIAwAAOcSACBpAACZFQAgpAUBAIMLACGnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIfAFAQCECwAhtwcgAJgLACG4ByAAmAsAIbkHIACYCwAhCwkAAOYSACAMAADnEgAgpAUBAIMLACGnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIfAFAQCECwAhtwcgAJgLACG4ByAAmAsAIbkHIACYCwAhGQUAAJsUACAOAACcFAAgDwAAnRQAIBEAAJ4UACASAACfFAAgXQAAoBQAIF4AAKEUACBfAACiFAAgYQAApBQAIGIAAKUUACBjAACmFAAgpwVAAAAAAboFAQAAAAHBBUAAAAABygUBAAAAAc8FIAAAAAGpBwEAAAABugcBAAAAAbsHAQAAAAG8ByAAAAABvQcBAAAAAb4HAgAAAAG_B0AAAAABwAdAAAAAAcEHQAAAAAECAAAAAQAgbgAAmhUAIBkFAACbFAAgDgAAnBQAIA8AAJ0UACARAACeFAAgEgAAnxQAIF0AAKAUACBeAAChFAAgYAAAoxQAIGEAAKQUACBiAAClFAAgYwAAphQAIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHPBSAAAAABqQcBAAAAAboHAQAAAAG7BwEAAAABvAcgAAAAAb0HAQAAAAG-BwIAAAABvwdAAAAAAcAHQAAAAAHBB0AAAAABAgAAAAEAIG4AAJwVACALCAAAiRMAIAkAAIoTACCkBQEAAAABpwVAAAAAAboFAQAAAAHBBUAAAAABygUBAAAAAfAFAQAAAAG3ByAAAAABuAcgAAAAAbkHIAAAAAECAAAAjwIAIG4AAJ4VACAZBQAAmxQAIA4AAJwUACAPAACdFAAgEQAAnhQAIBIAAJ8UACBdAACgFAAgXwAAohQAIGAAAKMUACBhAACkFAAgYgAApRQAIGMAAKYUACCnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAABzwUgAAAAAakHAQAAAAG6BwEAAAABuwcBAAAAAbwHIAAAAAG9BwEAAAABvgcCAAAAAb8HQAAAAAHAB0AAAAABwQdAAAAAAQIAAAABACBuAACgFQAgAwAAABIAIG4AAJoVACBvAACkFQAgGwAAABIAIAUAAJQTACAOAACVEwAgDwAAlhMAIBEAAJcTACASAACYEwAgXQAAmRMAIF4AAJoTACBfAACbEwAgYQAAnRMAIGIAAJ4TACBjAACfEwAgaQAApBUAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzwUgAJgLACGpBwEAgwsAIboHAQCDCwAhuwcBAIMLACG8ByAAmAsAIb0HAQCECwAhvgcCAJcLACG_B0AAigsAIcAHQACKCwAhwQdAAIULACEZBQAAlBMAIA4AAJUTACAPAACWEwAgEQAAlxMAIBIAAJgTACBdAACZEwAgXgAAmhMAIF8AAJsTACBhAACdEwAgYgAAnhMAIGMAAJ8TACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc8FIACYCwAhqQcBAIMLACG6BwEAgwsAIbsHAQCDCwAhvAcgAJgLACG9BwEAhAsAIb4HAgCXCwAhvwdAAIoLACHAB0AAigsAIcEHQACFCwAhAwAAABIAIG4AAJwVACBvAACnFQAgGwAAABIAIAUAAJQTACAOAACVEwAgDwAAlhMAIBEAAJcTACASAACYEwAgXQAAmRMAIF4AAJoTACBgAACcEwAgYQAAnRMAIGIAAJ4TACBjAACfEwAgaQAApxUAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzwUgAJgLACGpBwEAgwsAIboHAQCDCwAhuwcBAIMLACG8ByAAmAsAIb0HAQCECwAhvgcCAJcLACG_B0AAigsAIcAHQACKCwAhwQdAAIULACEZBQAAlBMAIA4AAJUTACAPAACWEwAgEQAAlxMAIBIAAJgTACBdAACZEwAgXgAAmhMAIGAAAJwTACBhAACdEwAgYgAAnhMAIGMAAJ8TACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc8FIACYCwAhqQcBAIMLACG6BwEAgwsAIbsHAQCDCwAhvAcgAJgLACG9BwEAhAsAIb4HAgCXCwAhvwdAAIoLACHAB0AAigsAIcEHQACFCwAhAwAAAJICACBuAACeFQAgbwAAqhUAIA0AAACSAgAgCAAA5RIAIAkAAOYSACBpAACqFQAgpAUBAIMLACGnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIfAFAQCECwAhtwcgAJgLACG4ByAAmAsAIbkHIACYCwAhCwgAAOUSACAJAADmEgAgpAUBAIMLACGnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIfAFAQCECwAhtwcgAJgLACG4ByAAmAsAIbkHIACYCwAhAwAAABIAIG4AAKAVACBvAACtFQAgGwAAABIAIAUAAJQTACAOAACVEwAgDwAAlhMAIBEAAJcTACASAACYEwAgXQAAmRMAIF8AAJsTACBgAACcEwAgYQAAnRMAIGIAAJ4TACBjAACfEwAgaQAArRUAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzwUgAJgLACGpBwEAgwsAIboHAQCDCwAhuwcBAIMLACG8ByAAmAsAIb0HAQCECwAhvgcCAJcLACG_B0AAigsAIcAHQACKCwAhwQdAAIULACEZBQAAlBMAIA4AAJUTACAPAACWEwAgEQAAlxMAIBIAAJgTACBdAACZEwAgXwAAmxMAIGAAAJwTACBhAACdEwAgYgAAnhMAIGMAAJ8TACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc8FIACYCwAhqQcBAIMLACG6BwEAgwsAIbsHAQCDCwAhvAcgAJgLACG9BwEAhAsAIb4HAgCXCwAhvwdAAIoLACHAB0AAigsAIcEHQACFCwAhGQUAAJsUACAOAACcFAAgEQAAnhQAIBIAAJ8UACBdAACgFAAgXgAAoRQAIF8AAKIUACBgAACjFAAgYQAApBQAIGIAAKUUACBjAACmFAAgpwVAAAAAAboFAQAAAAHBBUAAAAABygUBAAAAAc8FIAAAAAGpBwEAAAABugcBAAAAAbsHAQAAAAG8ByAAAAABvQcBAAAAAb4HAgAAAAG_B0AAAAABwAdAAAAAAcEHQAAAAAECAAAAAQAgbgAArhUAIAMAAAASACBuAACuFQAgbwAAshUAIBsAAAASACAFAACUEwAgDgAAlRMAIBEAAJcTACASAACYEwAgXQAAmRMAIF4AAJoTACBfAACbEwAgYAAAnBMAIGEAAJ0TACBiAACeEwAgYwAAnxMAIGkAALIVACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc8FIACYCwAhqQcBAIMLACG6BwEAgwsAIbsHAQCDCwAhvAcgAJgLACG9BwEAhAsAIb4HAgCXCwAhvwdAAIoLACHAB0AAigsAIcEHQACFCwAhGQUAAJQTACAOAACVEwAgEQAAlxMAIBIAAJgTACBdAACZEwAgXgAAmhMAIF8AAJsTACBgAACcEwAgYQAAnRMAIGIAAJ4TACBjAACfEwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHPBSAAmAsAIakHAQCDCwAhugcBAIMLACG7BwEAgwsAIbwHIACYCwAhvQcBAIQLACG-BwIAlwsAIb8HQACKCwAhwAdAAIoLACHBB0AAhQsAISOnBUAAAAABugUBAAAAAcEFQAAAAAHbBUAAAAAB4wUBAAAAAYkGAAAAlQcCnAYgAAAAAYIHAAAAggcCiQcBAAAAAYoHAQAAAAGLBwEAAAABjAcBAAAAAY0HAQAAAAGOB0AAAAABjwcgAAAAAZAHAgAAAAGRBwIAAAABkwcAAACTBwKVBwEAAAABlgeAAAAAAZcHAQAAAAGYB0AAAAABmQcCAAAAAZoHAgAAAAGbBwIAAAABnAcCAAAAAZ0HAgAAAAGeBwIAAAABnwcCAAAAAaAHAgAAAAGhBwIAAAABogcCAAAAAaMHAQAAAAGkBwEAAAABpQcBAAAAAQynBUAAAAABugUBAAAAAcEFQAAAAAGJBgAAANsGAqoGAQAAAAHUBkAAAAAB1QYCAAAAAdYGAgAAAAHXBiAAAAAB2AYgAAAAAdkGAQAAAAHbBgEAAAABEi0BAAAAAacFQAAAAAG6BQEAAAABvAUAAACBBwLBBUAAAAAB3wUBAAAAAYkGAAAAhQcCtAYBAAAAAc8GAQAAAAHbBgEAAAAB7gYBAAAAAfkGAQAAAAGCBwAAAIIHA4MHAgAAAAGFB0AAAAABhgcBAAAAAYcHQAAAAAGIB0AAAAABDacFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHOBQIAAAAB4wUBAAAAAfAFAQAAAAGJBgAAAPAGApwGIAAAAAHwBgEAAAAB8QYBAAAAAfIGQAAAAAHzBgEAAAABEacFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHjBQEAAAAB8AUBAAAAAYkGAAAAlAYCkgYAAACSBgKUBgIAAAABlQYBAAAAAZYGAQAAAAGXBgEAAAABmAZAAAAAAZkGQAAAAAGaBgEAAAABmwYgAAAAAZwGIAAAAAEYEwAA6g8AIFEAAOwPACBSAADtDwAgUwAA7g8AIFQAAO8PACBYAADwDwAgWQAA8Q8AIFoAAPIPACBcAADzDwAgpwVAAAAAAboFAQAAAAHBBUAAAAABzAUBAAAAAdAFAQAAAAHSBQAAANIFAtMFAQAAAAHUBQIAAAAB1QUCAAAAAdYFAgAAAAHXBQEAAAAB2AUBAAAAAdkFAQAAAAHaBQEAAAAB2wVAAAAAAQIAAAAoACBuAAC4FQAgAwAAACYAIG4AALgVACBvAAC8FQAgGgAAACYAIBMAAKILACBRAACkCwAgUgAApQsAIFMAAKYLACBUAACnCwAgWAAAqAsAIFkAAKkLACBaAACqCwAgXAAAqwsAIGkAALwVACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHMBQEAgwsAIdAFAQCDCwAh0gUAAKAL0gUi0wUBAIMLACHUBQIAlwsAIdUFAgChCwAh1gUCAKELACHXBQEAgwsAIdgFAQCECwAh2QUBAIMLACHaBQEAhAsAIdsFQACKCwAhGBMAAKILACBRAACkCwAgUgAApQsAIFMAAKYLACBUAACnCwAgWAAAqAsAIFkAAKkLACBaAACqCwAgXAAAqwsAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcwFAQCDCwAh0AUBAIMLACHSBQAAoAvSBSLTBQEAgwsAIdQFAgCXCwAh1QUCAKELACHWBQIAoQsAIdcFAQCDCwAh2AUBAIQLACHZBQEAgwsAIdoFAQCECwAh2wVAAIoLACEOFAAAnhIAIBYAAJ8SACBFAAChEgAgRgAAohIAIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHOBQIAAAABzwUgAAAAAeMFAQAAAAGCBwAAAIIHAqYHEAAAAAGnBxAAAAABAgAAAKQDACBuAAC9FQAgC6cFQAAAAAG6BQEAAAABwQVAAAAAAd4FAQAAAAGNBgEAAAAB-gYCAAAAAfsGIAAAAAH8BhAAAAAB_QYCAAAAAf4GAgAAAAH_BiAAAAABCLoFAQAAAAHBBUAAAAABwgUBAAAAAcMFAAAA9gYCjQYBAAAAAfYGAgAAAAH3BgIAAAAB-AYBAAAAAQanBUAAAAABugUBAAAAAY0GAQAAAAH5BgEAAAAB-gYCAAAAAfsGIAAAAAEDAAAAmwEAIG4AAL0VACBvAADEFQAgEAAAAJsBACAUAADpEQAgFgAA6hEAIEUAAOwRACBGAADtEQAgaQAAxBUAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzgUCAJcLACHPBSAAmAsAIeMFAQCDCwAhggcAAPUOggcipgcQAPAMACGnBxAA8AwAIQ4UAADpEQAgFgAA6hEAIEUAAOwRACBGAADtEQAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHOBQIAlwsAIc8FIACYCwAh4wUBAIMLACGCBwAA9Q6CByKmBxAA8AwAIacHEADwDAAhLSAAAOEPACBHAADjEQAgSAAA4g8AIEoAAOQPACBLAADlDwAgTAAA5g8AIE0AAOcPACBOAADoDwAgTwAA6Q8AIKcFQAAAAAG6BQEAAAABwQVAAAAAAdsFQAAAAAHjBQEAAAABiQYAAACVBwKQBgEAAAABnAYgAAAAAYIHAAAAggcCiQcBAAAAAYoHAQAAAAGLBwEAAAABjAcBAAAAAY0HAQAAAAGOB0AAAAABjwcgAAAAAZAHAgAAAAGRBwIAAAABkwcAAACTBwKVBwEAAAABlgeAAAAAAZcHAQAAAAGYB0AAAAABmQcCAAAAAZoHAgAAAAGbBwIAAAABnAcCAAAAAZ0HAgAAAAGeBwIAAAABnwcCAAAAAaAHAgAAAAGhBwIAAAABogcCAAAAAaMHAQAAAAGkBwEAAAABpQcBAAAAAQIAAAAtACBuAADFFQAgAwAAACsAIG4AAMUVACBvAADJFQAgLwAAACsAICAAAPkOACBHAADiEQAgSAAA-g4AIEoAAPwOACBLAAD9DgAgTAAA_g4AIE0AAP8OACBOAACADwAgTwAAgQ8AIGkAAMkVACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHbBUAAigsAIeMFAQCDCwAhiQYAAPcOlQcikAYBAIMLACGcBiAAmAsAIYIHAAD1DoIHIokHAQCDCwAhigcBAIMLACGLBwEAhAsAIYwHAQCDCwAhjQcBAIQLACGOB0AAigsAIY8HIACYCwAhkAcCAKELACGRBwIAoQsAIZMHAAD2DpMHIpUHAQCECwAhlgeAAAAAAZcHAQCECwAhmAdAAIoLACGZBwIAlwsAIZoHAgCXCwAhmwcCAJcLACGcBwIAlwsAIZ0HAgCXCwAhngcCAJcLACGfBwIAlwsAIaAHAgCXCwAhoQcCAJcLACGiBwIAlwsAIaMHAQCECwAhpAcBAIQLACGlBwEAhAsAIS0gAAD5DgAgRwAA4hEAIEgAAPoOACBKAAD8DgAgSwAA_Q4AIEwAAP4OACBNAAD_DgAgTgAAgA8AIE8AAIEPACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHbBUAAigsAIeMFAQCDCwAhiQYAAPcOlQcikAYBAIMLACGcBiAAmAsAIYIHAAD1DoIHIokHAQCDCwAhigcBAIMLACGLBwEAhAsAIYwHAQCDCwAhjQcBAIQLACGOB0AAigsAIY8HIACYCwAhkAcCAKELACGRBwIAoQsAIZMHAAD2DpMHIpUHAQCECwAhlgeAAAAAAZcHAQCECwAhmAdAAIoLACGZBwIAlwsAIZoHAgCXCwAhmwcCAJcLACGcBwIAlwsAIZ0HAgCXCwAhngcCAJcLACGfBwIAlwsAIaAHAgCXCwAhoQcCAJcLACGiBwIAlwsAIaMHAQCECwAhpAcBAIQLACGlBwEAhAsAIS0gAADhDwAgRwAA4xEAIEgAAOIPACBJAADjDwAgSwAA5Q8AIEwAAOYPACBNAADnDwAgTgAA6A8AIE8AAOkPACCnBUAAAAABugUBAAAAAcEFQAAAAAHbBUAAAAAB4wUBAAAAAYkGAAAAlQcCkAYBAAAAAZwGIAAAAAGCBwAAAIIHAokHAQAAAAGKBwEAAAABiwcBAAAAAYwHAQAAAAGNBwEAAAABjgdAAAAAAY8HIAAAAAGQBwIAAAABkQcCAAAAAZMHAAAAkwcClQcBAAAAAZYHgAAAAAGXBwEAAAABmAdAAAAAAZkHAgAAAAGaBwIAAAABmwcCAAAAAZwHAgAAAAGdBwIAAAABngcCAAAAAZ8HAgAAAAGgBwIAAAABoQcCAAAAAaIHAgAAAAGjBwEAAAABpAcBAAAAAaUHAQAAAAECAAAALQAgbgAAyhUAIAMAAAArACBuAADKFQAgbwAAzhUAIC8AAAArACAgAAD5DgAgRwAA4hEAIEgAAPoOACBJAAD7DgAgSwAA_Q4AIEwAAP4OACBNAAD_DgAgTgAAgA8AIE8AAIEPACBpAADOFQAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAh2wVAAIoLACHjBQEAgwsAIYkGAAD3DpUHIpAGAQCDCwAhnAYgAJgLACGCBwAA9Q6CByKJBwEAgwsAIYoHAQCDCwAhiwcBAIQLACGMBwEAgwsAIY0HAQCECwAhjgdAAIoLACGPByAAmAsAIZAHAgChCwAhkQcCAKELACGTBwAA9g6TByKVBwEAhAsAIZYHgAAAAAGXBwEAhAsAIZgHQACKCwAhmQcCAJcLACGaBwIAlwsAIZsHAgCXCwAhnAcCAJcLACGdBwIAlwsAIZ4HAgCXCwAhnwcCAJcLACGgBwIAlwsAIaEHAgCXCwAhogcCAJcLACGjBwEAhAsAIaQHAQCECwAhpQcBAIQLACEtIAAA-Q4AIEcAAOIRACBIAAD6DgAgSQAA-w4AIEsAAP0OACBMAAD-DgAgTQAA_w4AIE4AAIAPACBPAACBDwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAh2wVAAIoLACHjBQEAgwsAIYkGAAD3DpUHIpAGAQCDCwAhnAYgAJgLACGCBwAA9Q6CByKJBwEAgwsAIYoHAQCDCwAhiwcBAIQLACGMBwEAgwsAIY0HAQCECwAhjgdAAIoLACGPByAAmAsAIZAHAgChCwAhkQcCAKELACGTBwAA9g6TByKVBwEAhAsAIZYHgAAAAAGXBwEAhAsAIZgHQACKCwAhmQcCAJcLACGaBwIAlwsAIZsHAgCXCwAhnAcCAJcLACGdBwIAlwsAIZ4HAgCXCwAhnwcCAJcLACGgBwIAlwsAIaEHAgCXCwAhogcCAJcLACGjBwEAhAsAIaQHAQCECwAhpQcBAIQLACEtIAAA4Q8AIEcAAOMRACBIAADiDwAgSQAA4w8AIEoAAOQPACBMAADmDwAgTQAA5w8AIE4AAOgPACBPAADpDwAgpwVAAAAAAboFAQAAAAHBBUAAAAAB2wVAAAAAAeMFAQAAAAGJBgAAAJUHApAGAQAAAAGcBiAAAAABggcAAACCBwKJBwEAAAABigcBAAAAAYsHAQAAAAGMBwEAAAABjQcBAAAAAY4HQAAAAAGPByAAAAABkAcCAAAAAZEHAgAAAAGTBwAAAJMHApUHAQAAAAGWB4AAAAABlwcBAAAAAZgHQAAAAAGZBwIAAAABmgcCAAAAAZsHAgAAAAGcBwIAAAABnQcCAAAAAZ4HAgAAAAGfBwIAAAABoAcCAAAAAaEHAgAAAAGiBwIAAAABowcBAAAAAaQHAQAAAAGlBwEAAAABAgAAAC0AIG4AAM8VACADAAAAKwAgbgAAzxUAIG8AANMVACAvAAAAKwAgIAAA-Q4AIEcAAOIRACBIAAD6DgAgSQAA-w4AIEoAAPwOACBMAAD-DgAgTQAA_w4AIE4AAIAPACBPAACBDwAgaQAA0xUAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIdsFQACKCwAh4wUBAIMLACGJBgAA9w6VByKQBgEAgwsAIZwGIACYCwAhggcAAPUOggciiQcBAIMLACGKBwEAgwsAIYsHAQCECwAhjAcBAIMLACGNBwEAhAsAIY4HQACKCwAhjwcgAJgLACGQBwIAoQsAIZEHAgChCwAhkwcAAPYOkwcilQcBAIQLACGWB4AAAAABlwcBAIQLACGYB0AAigsAIZkHAgCXCwAhmgcCAJcLACGbBwIAlwsAIZwHAgCXCwAhnQcCAJcLACGeBwIAlwsAIZ8HAgCXCwAhoAcCAJcLACGhBwIAlwsAIaIHAgCXCwAhowcBAIQLACGkBwEAhAsAIaUHAQCECwAhLSAAAPkOACBHAADiEQAgSAAA-g4AIEkAAPsOACBKAAD8DgAgTAAA_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_RUAIAenBUAAAAABugUBAAAAAbwFAAAA4QUCwQVAAAAAAc4FAgAAAAHhBSAAAAAB4gWAAAAAAQZAAgAAAAG6BQEAAAABwQVAAAAAAd0FgAAAAAHeBQEAAAAB3wUBAAAAAQMAAACTBwAgbgAA_RUAIG8AAIMWACAOAAAAkwcAIGkAAIMWACCtBAAAgBAAILAEAACpEAAgpwVAAIULACG6BQEAgwsAIb0FAQCDCwAhwQVAAIULACHjBQEAgwsAIeQFAQCECwAh5QUBAIQLACHmBQEAhAsAIecFQACFCwAh6AUBAIQLACEMrQQAAIAQACCwBAAAqRAAIKcFQACFCwAhugUBAIMLACG9BQEAgwsAIcEFQACFCwAh4wUBAIMLACHkBQEAhAsAIeUFAQCECwAh5gUBAIQLACHnBUAAhQsAIegFAQCECwAhGQUAAJsUACAOAACcFAAgDwAAnRQAIBEAAJ4UACASAACfFAAgXgAAoRQAIF8AAKIUACBgAACjFAAgYQAApBQAIGIAAKUUACBjAACmFAAgpwVAAAAAAboFAQAAAAHBBUAAAAABygUBAAAAAc8FIAAAAAGpBwEAAAABugcBAAAAAbsHAQAAAAG8ByAAAAABvQcBAAAAAb4HAgAAAAG_B0AAAAABwAdAAAAAAcEHQAAAAAECAAAAAQAgbgAAhBYAIA4WAACfEgAgRAAAoBIAIEUAAKESACBGAACiEgAgpwVAAAAAAboFAQAAAAHBBUAAAAABygUBAAAAAc4FAgAAAAHPBSAAAAAB4wUBAAAAAYIHAAAAggcCpgcQAAAAAacHEAAAAAECAAAApAMAIG4AAIYWACAUFwAAzw4AICAAAKoOACAjAACrDgAgLgAArQ4AID0AAK4OACA-AACvDgAgPwAAsA4AIKcFQAAAAAG6BQEAAAABwQVAAAAAAYkGAAAA2wYCkAYBAAAAAaoGAQAAAAHUBkAAAAAB1QYCAAAAAdYGAgAAAAHXBiAAAAAB2AYgAAAAAdkGAQAAAAHbBgEAAAABAgAAADIAIG4AAIgWACADAAAAMAAgbgAAiBYAIG8AAIwWACAWAAAAMAAgFwAAzQ4AICAAALgNACAjAAC5DQAgLgAAuw0AID0AALwNACA-AAC9DQAgPwAAvg0AIGkAAIwWACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACGJBgAAtg3bBiKQBgEAgwsAIaoGAQCECwAh1AZAAIULACHVBgIAlwsAIdYGAgCXCwAh1wYgAJgLACHYBiAAmAsAIdkGAQCECwAh2wYBAIQLACEUFwAAzQ4AICAAALgNACAjAAC5DQAgLgAAuw0AID0AALwNACA-AAC9DQAgPwAAvg0AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIYkGAAC2DdsGIpAGAQCDCwAhqgYBAIQLACHUBkAAhQsAIdUGAgCXCwAh1gYCAJcLACHXBiAAmAsAIdgGIACYCwAh2QYBAIQLACHbBgEAhAsAIQW6BQEAAAABwQVAAAAAAYQGAQAAAAHSBgAAANIGAtMGEAAAAAEWIAAA2REAIC0BAAAAAUIAANsRACBDAADcEQAgpwVAAAAAAboFAQAAAAG8BQAAAIEHAsEFQAAAAAHfBQEAAAABiQYAAACFBwKQBgEAAAABtAYBAAAAAc8GAQAAAAHbBgEAAAAB7gYBAAAAAfkGAQAAAAGCBwAAAIIHA4MHAgAAAAGFB0AAAAABhgcBAAAAAYcHQAAAAAGIB0AAAAABAgAAAJkBACBuAACOFgAgAwAAAJcBACBuAACOFgAgbwAAkhYAIBgAAACXAQAgIAAAuhEAIC0BAIMLACFCAAC8EQAgQwAAvREAIGkAAJIWACCnBUAAhQsAIboFAQCDCwAhvAUAALcRgQciwQVAAIULACHfBQEAhAsAIYkGAAC5EYUHIpAGAQCECwAhtAYBAIQLACHPBgEAhAsAIdsGAQCECwAh7gYBAIQLACH5BgEAgwsAIYIHAAC4EYIHI4MHAgCXCwAhhQdAAIULACGGBwEAhAsAIYcHQACKCwAhiAdAAIoLACEWIAAAuhEAIC0BAIMLACFCAAC8EQAgQwAAvREAIKcFQACFCwAhugUBAIMLACG8BQAAtxGBByLBBUAAhQsAId8FAQCECwAhiQYAALkRhQcikAYBAIQLACG0BgEAhAsAIc8GAQCECwAh2wYBAIQLACHuBgEAhAsAIfkGAQCDCwAhggcAALgRggcjgwcCAJcLACGFB0AAhQsAIYYHAQCECwAhhwdAAIoLACGIB0AAigsAIQunBUAAAAABugUBAAAAAcEFQAAAAAHeBQEAAAAB9AYBAAAAAfoGAgAAAAH7BiAAAAAB_AYQAAAAAf0GAgAAAAH-BgIAAAAB_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-Q4AIEcAAOIRACBJAAD7DgAgSgAA_A4AIEsAAP0OACBMAAD-DgAgTQAA_w4AIE4AAIAPACBPAACBDwAgaQAA3RYAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIdsFQACKCwAh4wUBAIMLACGJBgAA9w6VByKQBgEAgwsAIZwGIACYCwAhggcAAPUOggciiQcBAIMLACGKBwEAgwsAIYsHAQCECwAhjAcBAIMLACGNBwEAhAsAIY4HQACKCwAhjwcgAJgLACGQBwIAoQsAIZEHAgChCwAhkwcAAPYOkwcilQcBAIQLACGWB4AAAAABlwcBAIQLACGYB0AAigsAIZkHAgCXCwAhmgcCAJcLACGbBwIAlwsAIZwHAgCXCwAhnQcCAJcLACGeBwIAlwsAIZ8HAgCXCwAhoAcCAJcLACGhBwIAlwsAIaIHAgCXCwAhowcBAIQLACGkBwEAhAsAIaUHAQCECwAhLSAAAPkOACBHAADiEQAgSQAA-w4AIEoAAPwOACBLAAD9DgAgTAAA_g4AIE0AAP8OACBOAACADwAgTwAAgQ8AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIdsFQACKCwAh4wUBAIMLACGJBgAA9w6VByKQBgEAgwsAIZwGIACYCwAhggcAAPUOggciiQcBAIMLACGKBwEAgwsAIYsHAQCECwAhjAcBAIMLACGNBwEAhAsAIY4HQACKCwAhjwcgAJgLACGQBwIAoQsAIZEHAgChCwAhkwcAAPYOkwcilQcBAIQLACGWB4AAAAABlwcBAIQLACGYB0AAigsAIZkHAgCXCwAhmgcCAJcLACGbBwIAlwsAIZwHAgCXCwAhnQcCAJcLACGeBwIAlwsAIZ8HAgCXCwAhoAcCAJcLACGhBwIAlwsAIaIHAgCXCwAhowcBAIQLACGkBwEAhAsAIaUHAQCECwAhBboFAQAAAAHBBUAAAAABjQYBAAAAAdIGAAAA0gYC0wYQAAAAAQinBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAABzgUCAAAAAc8FIAAAAAG7BgEAAAAB3AYgAAAAAQIAAADuBAAgbgAA3xYAIAgkAACnDgAgJwAA3w8AILoFAQAAAAHBBUAAAAABhAYBAAAAAY0GAQAAAAHSBgAAANIGAtMGEAAAAAECAAAAZAAgbgAA4RYAIAW6BQEAAAABwQVAAAAAAcIFAQAAAAHDBQAAAMEGAsEGAQAAAAEDAAAA8QQAIG4AAN8WACBvAADmFgAgCgAAAPEEACBpAADmFgAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHOBQIAlwsAIc8FIACYCwAhuwYBAIMLACHcBiAAmAsAIQinBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc4FAgCXCwAhzwUgAJgLACG7BgEAgwsAIdwGIACYCwAhAwAAAGIAIG4AAOEWACBvAADpFgAgCgAAAGIAICQAAJYOACAnAADdDwAgaQAA6RYAILoFAQCDCwAhwQVAAIULACGEBgEAgwsAIY0GAQCDCwAh0gYAAJMO0gYi0wYQAJQOACEIJAAAlg4AICcAAN0PACC6BQEAgwsAIcEFQACFCwAhhAYBAIMLACGNBgEAgwsAIdIGAACTDtIGItMGEACUDgAhLSAAAOEPACBHAADjEQAgSAAA4g8AIEkAAOMPACBKAADkDwAgSwAA5Q8AIE0AAOcPACBOAADoDwAgTwAA6Q8AIKcFQAAAAAG6BQEAAAABwQVAAAAAAdsFQAAAAAHjBQEAAAABiQYAAACVBwKQBgEAAAABnAYgAAAAAYIHAAAAggcCiQcBAAAAAYoHAQAAAAGLBwEAAAABjAcBAAAAAY0HAQAAAAGOB0AAAAABjwcgAAAAAZAHAgAAAAGRBwIAAAABkwcAAACTBwKVBwEAAAABlgeAAAAAAZcHAQAAAAGYB0AAAAABmQcCAAAAAZoHAgAAAAGbBwIAAAABnAcCAAAAAZ0HAgAAAAGeBwIAAAABnwcCAAAAAaAHAgAAAAGhBwIAAAABogcCAAAAAaMHAQAAAAGkBwEAAAABpQcBAAAAAQIAAAAtACBuAADqFgAgEhYAAN8OACAgAADcDgAgIQAA3Q4AICIAAOoOACCnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAABzgUCAAAAAeMFAQAAAAHwBQEAAAABiQYAAADwBgKQBgEAAAABnAYgAAAAAfAGAQAAAAHxBgEAAAAB8gZAAAAAAfMGAQAAAAECAAAArgEAIG4AAOwWACAUFwAAzw4AICAAAKoOACAjAACrDgAgLgAArQ4AIDEAAKwOACA9AACuDgAgPgAArw4AIKcFQAAAAAG6BQEAAAABwQVAAAAAAYkGAAAA2wYCkAYBAAAAAaoGAQAAAAHUBkAAAAAB1QYCAAAAAdYGAgAAAAHXBiAAAAAB2AYgAAAAAdkGAQAAAAHbBgEAAAABAgAAADIAIG4AAO4WACADAAAAMAAgbgAA7hYAIG8AAPIWACAWAAAAMAAgFwAAzQ4AICAAALgNACAjAAC5DQAgLgAAuw0AIDEAALoNACA9AAC8DQAgPgAAvQ0AIGkAAPIWACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACGJBgAAtg3bBiKQBgEAgwsAIaoGAQCECwAh1AZAAIULACHVBgIAlwsAIdYGAgCXCwAh1wYgAJgLACHYBiAAmAsAIdkGAQCECwAh2wYBAIQLACEUFwAAzQ4AICAAALgNACAjAAC5DQAgLgAAuw0AIDEAALoNACA9AAC8DQAgPgAAvQ0AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIYkGAAC2DdsGIpAGAQCDCwAhqgYBAIQLACHUBkAAhQsAIdUGAgCXCwAh1gYCAJcLACHXBiAAmAsAIdgGIACYCwAh2QYBAIQLACHbBgEAhAsAIQa6BQEAAAABwQVAAAAAAYQGAQAAAAHbBgEAAAAB5AYBAAAAAeUGQAAAAAEDAAAAKwAgbgAA6hYAIG8AAPYWACAvAAAAKwAgIAAA-Q4AIEcAAOIRACBIAAD6DgAgSQAA-w4AIEoAAPwOACBLAAD9DgAgTQAA_w4AIE4AAIAPACBPAACBDwAgaQAA9hYAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIdsFQACKCwAh4wUBAIMLACGJBgAA9w6VByKQBgEAgwsAIZwGIACYCwAhggcAAPUOggciiQcBAIMLACGKBwEAgwsAIYsHAQCECwAhjAcBAIMLACGNBwEAhAsAIY4HQACKCwAhjwcgAJgLACGQBwIAoQsAIZEHAgChCwAhkwcAAPYOkwcilQcBAIQLACGWB4AAAAABlwcBAIQLACGYB0AAigsAIZkHAgCXCwAhmgcCAJcLACGbBwIAlwsAIZwHAgCXCwAhnQcCAJcLACGeBwIAlwsAIZ8HAgCXCwAhoAcCAJcLACGhBwIAlwsAIaIHAgCXCwAhowcBAIQLACGkBwEAhAsAIaUHAQCECwAhLSAAAPkOACBHAADiEQAgSAAA-g4AIEkAAPsOACBKAAD8DgAgSwAA_Q4AIE0AAP8OACBOAACADwAgTwAAgQ8AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIdsFQACKCwAh4wUBAIMLACGJBgAA9w6VByKQBgEAgwsAIZwGIACYCwAhggcAAPUOggciiQcBAIMLACGKBwEAgwsAIYsHAQCECwAhjAcBAIMLACGNBwEAhAsAIY4HQACKCwAhjwcgAJgLACGQBwIAoQsAIZEHAgChCwAhkwcAAPYOkwcilQcBAIQLACGWB4AAAAABlwcBAIQLACGYB0AAigsAIZkHAgCXCwAhmgcCAJcLACGbBwIAlwsAIZwHAgCXCwAhnQcCAJcLACGeBwIAlwsAIZ8HAgCXCwAhoAcCAJcLACGhBwIAlwsAIaIHAgCXCwAhowcBAIQLACGkBwEAhAsAIaUHAQCECwAhAwAAAE8AIG4AAOwWACBvAAD5FgAgFAAAAE8AIBYAAMQOACAgAADBDgAgIQAAwg4AICIAAOgOACBpAAD5FgAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHOBQIAlwsAIeMFAQCDCwAh8AUBAIQLACGJBgAAvw7wBiKQBgEAgwsAIZwGIACYCwAh8AYBAIQLACHxBgEAhAsAIfIGQACKCwAh8wYBAIQLACESFgAAxA4AICAAAMEOACAhAADCDgAgIgAA6A4AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzgUCAJcLACHjBQEAgwsAIfAFAQCECwAhiQYAAL8O8AYikAYBAIMLACGcBiAAmAsAIfAGAQCECwAh8QYBAIQLACHyBkAAigsAIfMGAQCECwAhEKcFQAAAAAG6BQEAAAABwQVAAAAAAYkGAAAA5wYCjQYBAAAAAbQGAQAAAAHPBgEAAAAB0AZAAAAAAdkGAQAAAAHbBgEAAAAB5wYBAAAAAegGQAAAAAHqBkAAAAAB7AYAAADsBgPtBgEAAAAB7gYBAAAAAS0gAADhDwAgRwAA4xEAIEgAAOIPACBJAADjDwAgSgAA5A8AIEsAAOUPACBMAADmDwAgTgAA6A8AIE8AAOkPACCnBUAAAAABugUBAAAAAcEFQAAAAAHbBUAAAAAB4wUBAAAAAYkGAAAAlQcCkAYBAAAAAZwGIAAAAAGCBwAAAIIHAokHAQAAAAGKBwEAAAABiwcBAAAAAYwHAQAAAAGNBwEAAAABjgdAAAAAAY8HIAAAAAGQBwIAAAABkQcCAAAAAZMHAAAAkwcClQcBAAAAAZYHgAAAAAGXBwEAAAABmAdAAAAAAZkHAgAAAAGaBwIAAAABmwcCAAAAAZwHAgAAAAGdBwIAAAABngcCAAAAAZ8HAgAAAAGgBwIAAAABoQcCAAAAAaIHAgAAAAGjBwEAAAABpAcBAAAAAaUHAQAAAAECAAAALQAgbgAA-xYAIBQjAADnDQAgJAAA6A0AICUAANoOACCnBUAAAAABugUBAAAAAcEFQAAAAAGJBgAAAOcGAo0GAQAAAAG0BgEAAAABzwYBAAAAAdAGQAAAAAHZBgEAAAAB2wYBAAAAAecGAQAAAAHoBkAAAAAB6QYBAAAAAeoGQAAAAAHsBgAAAOwGA-0GAQAAAAHuBgEAAAABAgAAAFUAIG4AAP0WACADAAAAKwAgbgAA-xYAIG8AAIEXACAvAAAAKwAgIAAA-Q4AIEcAAOIRACBIAAD6DgAgSQAA-w4AIEoAAPwOACBLAAD9DgAgTAAA_g4AIE4AAIAPACBPAACBDwAgaQAAgRcAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIdsFQACKCwAh4wUBAIMLACGJBgAA9w6VByKQBgEAgwsAIZwGIACYCwAhggcAAPUOggciiQcBAIMLACGKBwEAgwsAIYsHAQCECwAhjAcBAIMLACGNBwEAhAsAIY4HQACKCwAhjwcgAJgLACGQBwIAoQsAIZEHAgChCwAhkwcAAPYOkwcilQcBAIQLACGWB4AAAAABlwcBAIQLACGYB0AAigsAIZkHAgCXCwAhmgcCAJcLACGbBwIAlwsAIZwHAgCXCwAhnQcCAJcLACGeBwIAlwsAIZ8HAgCXCwAhoAcCAJcLACGhBwIAlwsAIaIHAgCXCwAhowcBAIQLACGkBwEAhAsAIaUHAQCECwAhLSAAAPkOACBHAADiEQAgSAAA-g4AIEkAAPsOACBKAAD8DgAgSwAA_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_B0AAAAABwAdAAAAAAcEHQAAAAAECAAAAAQAgbgAAkxcAIBkFAACbFAAgDgAAnBQAIA8AAJ0UACARAACeFAAgEgAAnxQAIF0AAKAUACBeAAChFAAgXwAAohQAIGAAAKMUACBiAAClFAAgYwAAphQAIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHPBSAAAAABqQcBAAAAAboHAQAAAAG7BwEAAAABvAcgAAAAAb0HAQAAAAG-BwIAAAABvwdAAAAAAcAHQAAAAAHBB0AAAAABAgAAAAEAIG4AAJUXACAMFwAA5hAAIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHPBSAAAAAB8AUBAAAAAaoGAQAAAAG7BgEAAAABvAYQAAAAAb0GAgAAAAG-BgIAAAABAgAAADoAIG4AAJcXACADAAAAOAAgbgAAlxcAIG8AAJsXACAOAAAAOAAgFwAA5RAAIGkAAJsXACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc8FIACYCwAh8AUBAIQLACGqBgEAgwsAIbsGAQCDCwAhvAYQAPAMACG9BgIAlwsAIb4GAgCXCwAhDBcAAOUQACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc8FIACYCwAh8AUBAIQLACGqBgEAgwsAIbsGAQCDCwAhvAYQAPAMACG9BgIAlwsAIb4GAgCXCwAhBroFAQAAAAHBBUAAAAABpQYBAAAAAaYGAgAAAAGnBhAAAAABqAYQAAAAARkFAACbFAAgDgAAnBQAIA8AAJ0UACARAACeFAAgEgAAnxQAIF0AAKAUACBeAAChFAAgXwAAohQAIGAAAKMUACBhAACkFAAgYgAApRQAIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHPBSAAAAABqQcBAAAAAboHAQAAAAG7BwEAAAABvAcgAAAAAb0HAQAAAAG-BwIAAAABvwdAAAAAAcAHQAAAAAHBB0AAAAABAgAAAAEAIG4AAJ0XACADAAAAEgAgbgAAnRcAIG8AAKEXACAbAAAAEgAgBQAAlBMAIA4AAJUTACAPAACWEwAgEQAAlxMAIBIAAJgTACBdAACZEwAgXgAAmhMAIF8AAJsTACBgAACcEwAgYQAAnRMAIGIAAJ4TACBpAAChFwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHPBSAAmAsAIakHAQCDCwAhugcBAIMLACG7BwEAgwsAIbwHIACYCwAhvQcBAIQLACG-BwIAlwsAIb8HQACKCwAhwAdAAIoLACHBB0AAhQsAIRkFAACUEwAgDgAAlRMAIA8AAJYTACARAACXEwAgEgAAmBMAIF0AAJkTACBeAACaEwAgXwAAmxMAIGAAAJwTACBhAACdEwAgYgAAnhMAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzwUgAJgLACGpBwEAgwsAIboHAQCDCwAhuwcBAIMLACG8ByAAmAsAIb0HAQCECwAhvgcCAJcLACG_B0AAigsAIcAHQACKCwAhwQdAAIULACEDAAAAEgAgbgAAkxcAIG8AAKQXACAbAAAAEgAgBQAAlBMAIA4AAJUTACAPAACWEwAgEQAAlxMAIBIAAJgTACBdAACZEwAgXgAAmhMAIF8AAJsTACBgAACcEwAgYQAAnRMAIGMAAJ8TACBpAACkFwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHPBSAAmAsAIakHAQCDCwAhugcBAIMLACG7BwEAgwsAIbwHIACYCwAhvQcBAIQLACG-BwIAlwsAIb8HQACKCwAhwAdAAIoLACHBB0AAhQsAIRkFAACUEwAgDgAAlRMAIA8AAJYTACARAACXEwAgEgAAmBMAIF0AAJkTACBeAACaEwAgXwAAmxMAIGAAAJwTACBhAACdEwAgYwAAnxMAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzwUgAJgLACGpBwEAgwsAIboHAQCDCwAhuwcBAIMLACG8ByAAmAsAIb0HAQCECwAhvgcCAJcLACG_B0AAigsAIcAHQACKCwAhwQdAAIULACEDAAAAEgAgbgAAlRcAIG8AAKcXACAbAAAAEgAgBQAAlBMAIA4AAJUTACAPAACWEwAgEQAAlxMAIBIAAJgTACBdAACZEwAgXgAAmhMAIF8AAJsTACBgAACcEwAgYgAAnhMAIGMAAJ8TACBpAACnFwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHPBSAAmAsAIakHAQCDCwAhugcBAIMLACG7BwEAgwsAIbwHIACYCwAhvQcBAIQLACG-BwIAlwsAIb8HQACKCwAhwAdAAIoLACHBB0AAhQsAIRkFAACUEwAgDgAAlRMAIA8AAJYTACARAACXEwAgEgAAmBMAIF0AAJkTACBeAACaEwAgXwAAmxMAIGAAAJwTACBiAACeEwAgYwAAnxMAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzwUgAJgLACGpBwEAgwsAIboHAQCDCwAhuwcBAIMLACG8ByAAmAsAIb0HAQCECwAhvgcCAJcLACG_B0AAigsAIcAHQACKCwAhwQdAAIULACEUpwVAAAAAAboFAQAAAAHBBUAAAAABiQYAAACwBgKpBgEAAAABqwYBAAAAAawGAQAAAAGtBgEAAAABrgYQAAAAAbAGAAAAoAYCsQYAAAChBgKyBgEAAAABswYBAAAAAbQGAQAAAAG1BgEAAAABtgYBAAAAAbcGQAAAAAG4BkAAAAABuQZAAAAAAboGAQAAAAEOpwVAAAAAAboFAQAAAAHBBUAAAAABygUBAAAAAeMFAQAAAAHwBQEAAAABiQYAAADjBgKbBiAAAAABnAYgAAAAAd0GAQAAAAHeBgEAAAAB3wYBAAAAAeAGQAAAAAHhBgEAAAABLSAAAOEPACBHAADjEQAgSAAA4g8AIEkAAOMPACBKAADkDwAgSwAA5Q8AIEwAAOYPACBNAADnDwAgTgAA6A8AIKcFQAAAAAG6BQEAAAABwQVAAAAAAdsFQAAAAAHjBQEAAAABiQYAAACVBwKQBgEAAAABnAYgAAAAAYIHAAAAggcCiQcBAAAAAYoHAQAAAAGLBwEAAAABjAcBAAAAAY0HAQAAAAGOB0AAAAABjwcgAAAAAZAHAgAAAAGRBwIAAAABkwcAAACTBwKVBwEAAAABlgeAAAAAAZcHAQAAAAGYB0AAAAABmQcCAAAAAZoHAgAAAAGbBwIAAAABnAcCAAAAAZ0HAgAAAAGeBwIAAAABnwcCAAAAAaAHAgAAAAGhBwIAAAABogcCAAAAAaMHAQAAAAGkBwEAAAABpQcBAAAAAQIAAAAtACBuAACqFwAgDhQAAJ4SACAWAACfEgAgRAAAoBIAIEUAAKESACCnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAABzgUCAAAAAc8FIAAAAAHjBQEAAAABggcAAACCBwKmBxAAAAABpwcQAAAAAQIAAACkAwAgbgAArBcAIC0gAADhDwAgRwAA4xEAIEgAAOIPACBJAADjDwAgSgAA5A8AIEsAAOUPACBMAADmDwAgTQAA5w8AIE8AAOkPACCnBUAAAAABugUBAAAAAcEFQAAAAAHbBUAAAAAB4wUBAAAAAYkGAAAAlQcCkAYBAAAAAZwGIAAAAAGCBwAAAIIHAokHAQAAAAGKBwEAAAABiwcBAAAAAYwHAQAAAAGNBwEAAAABjgdAAAAAAY8HIAAAAAGQBwIAAAABkQcCAAAAAZMHAAAAkwcClQcBAAAAAZYHgAAAAAGXBwEAAAABmAdAAAAAAZkHAgAAAAGaBwIAAAABmwcCAAAAAZwHAgAAAAGdBwIAAAABngcCAAAAAZ8HAgAAAAGgBwIAAAABoQcCAAAAAaIHAgAAAAGjBwEAAAABpAcBAAAAAaUHAQAAAAECAAAALQAgbgAArhcAIAynBUAAAAABugUBAAAAAcEFQAAAAAH-BQEAAAAB_wUCAAAAAYAGAgAAAAGCBgEAAAABgwYBAAAAAYQGAQAAAAGFBgEAAAABhwYAAACHBgOJBgAAAIkGAgynBUAAAAABugUBAAAAAcEFQAAAAAH-BQEAAAAB_wUCAAAAAYAGAgAAAAGBBgEAAAABgwYBAAAAAYQGAQAAAAGFBgEAAAABhwYAAACHBgOJBgAAAIkGAgynBUAAAAABugUBAAAAAcEFQAAAAAH-BQEAAAAB_wUCAAAAAYAGAgAAAAGBBgEAAAABggYBAAAAAYQGAQAAAAGFBgEAAAABhwYAAACHBgOJBgAAAIkGAgMAAAArACBuAACuFwAgbwAAtRcAIC8AAAArACAgAAD5DgAgRwAA4hEAIEgAAPoOACBJAAD7DgAgSgAA_A4AIEsAAP0OACBMAAD-DgAgTQAA_w4AIE8AAIEPACBpAAC1FwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAh2wVAAIoLACHjBQEAgwsAIYkGAAD3DpUHIpAGAQCDCwAhnAYgAJgLACGCBwAA9Q6CByKJBwEAgwsAIYoHAQCDCwAhiwcBAIQLACGMBwEAgwsAIY0HAQCECwAhjgdAAIoLACGPByAAmAsAIZAHAgChCwAhkQcCAKELACGTBwAA9g6TByKVBwEAhAsAIZYHgAAAAAGXBwEAhAsAIZgHQACKCwAhmQcCAJcLACGaBwIAlwsAIZsHAgCXCwAhnAcCAJcLACGdBwIAlwsAIZ4HAgCXCwAhnwcCAJcLACGgBwIAlwsAIaEHAgCXCwAhogcCAJcLACGjBwEAhAsAIaQHAQCECwAhpQcBAIQLACEtIAAA-Q4AIEcAAOIRACBIAAD6DgAgSQAA-w4AIEoAAPwOACBLAAD9DgAgTAAA_g4AIE0AAP8OACBPAACBDwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAh2wVAAIoLACHjBQEAgwsAIYkGAAD3DpUHIpAGAQCDCwAhnAYgAJgLACGCBwAA9Q6CByKJBwEAgwsAIYoHAQCDCwAhiwcBAIQLACGMBwEAgwsAIY0HAQCECwAhjgdAAIoLACGPByAAmAsAIZAHAgChCwAhkQcCAKELACGTBwAA9g6TByKVBwEAhAsAIZYHgAAAAAGXBwEAhAsAIZgHQACKCwAhmQcCAJcLACGaBwIAlwsAIZsHAgCXCwAhnAcCAJcLACGdBwIAlwsAIZ4HAgCXCwAhnwcCAJcLACGgBwIAlwsAIaEHAgCXCwAhogcCAJcLACGjBwEAhAsAIaQHAQCECwAhpQcBAIQLACEFugUBAAAAAcEFQAAAAAGJBgAAAJAGAo0GAQAAAAGOBgIAAAABEycAAJwMACArAACbDAAgOAAAmAwAIDkAAJkMACA6AACaDAAgOwAAnwwAIKcFQAAAAAG6BQEAAAABwQVAAAAAAf4FAQAAAAH_BQIAAAABgAYCAAAAAYEGAQAAAAGCBgEAAAABgwYBAAAAAYQGAQAAAAGFBgEAAAABhwYAAACHBgOJBgAAAIkGAgIAAAB9ACBuAAC3FwAgFBcAAM8OACAgAACqDgAgIwAAqw4AIC4AAK0OACAxAACsDgAgPgAArw4AID8AALAOACCnBUAAAAABugUBAAAAAcEFQAAAAAGJBgAAANsGApAGAQAAAAGqBgEAAAAB1AZAAAAAAdUGAgAAAAHWBgIAAAAB1wYgAAAAAdgGIAAAAAHZBgEAAAAB2wYBAAAAAQIAAAAyACBuAAC5FwAgCiQAAM4MACAyAACXDwAgMwAAzwwAIDQAANAMACC6BQEAAAABwQVAAAAAAYkGAAAAkAYCigYBAAAAAY0GAQAAAAGOBgIAAAABAgAAAHoAIG4AALsXACAKJAAAzgwAIDIAAJcPACAzAADPDAAgNQAA0QwAILoFAQAAAAHBBUAAAAABiQYAAACQBgKKBgEAAAABjQYBAAAAAY4GAgAAAAECAAAAegAgbgAAvRcAIAokAADODAAgMgAAlw8AIDQAANAMACA1AADRDAAgugUBAAAAAcEFQAAAAAGJBgAAAJAGAooGAQAAAAGNBgEAAAABjgYCAAAAAQIAAAB6ACBuAAC_FwAgBzIAAMIQACC6BQEAAAABvAUAAACMBgLBBUAAAAABygUBAAAAAYoGAQAAAAGMBgIAAAABAgAAAIYBACBuAADBFwAgAwAAAIQBACBuAADBFwAgbwAAxRcAIAkAAACEAQAgMgAAwRAAIGkAAMUXACC6BQEAgwsAIbwFAAD4C4wGIsEFQACFCwAhygUBAIMLACGKBgEAgwsAIYwGAgCXCwAhBzIAAMEQACC6BQEAgwsAIbwFAAD4C4wGIsEFQACFCwAhygUBAIMLACGKBgEAgwsAIYwGAgCXCwAhDKcFQAAAAAG6BQEAAAABwQVAAAAAAf4FAQAAAAH_BQIAAAABgAYCAAAAAYEGAQAAAAGCBgEAAAABgwYBAAAAAYQGAQAAAAGHBgAAAIcGA4kGAAAAiQYCAwAAAHQAIG4AALcXACBvAADJFwAgFQAAAHQAICcAAIsMACArAACKDAAgOAAAlgwAIDkAAIgMACA6AACJDAAgOwAAjAwAIGkAAMkXACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACH-BQEAgwsAIf8FAgCXCwAhgAYCAJcLACGBBgEAhAsAIYIGAQCECwAhgwYBAIQLACGEBgEAhAsAIYUGAQCECwAhhwYAAIUMhwYjiQYAAIYMiQYiEycAAIsMACArAACKDAAgOAAAlgwAIDkAAIgMACA6AACJDAAgOwAAjAwAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIf4FAQCDCwAh_wUCAJcLACGABgIAlwsAIYEGAQCECwAhggYBAIQLACGDBgEAhAsAIYQGAQCECwAhhQYBAIQLACGHBgAAhQyHBiOJBgAAhgyJBiIDAAAAMAAgbgAAuRcAIG8AAMwXACAWAAAAMAAgFwAAzQ4AICAAALgNACAjAAC5DQAgLgAAuw0AIDEAALoNACA-AAC9DQAgPwAAvg0AIGkAAMwXACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACGJBgAAtg3bBiKQBgEAgwsAIaoGAQCECwAh1AZAAIULACHVBgIAlwsAIdYGAgCXCwAh1wYgAJgLACHYBiAAmAsAIdkGAQCECwAh2wYBAIQLACEUFwAAzQ4AICAAALgNACAjAAC5DQAgLgAAuw0AIDEAALoNACA-AAC9DQAgPwAAvg0AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIYkGAAC2DdsGIpAGAQCDCwAhqgYBAIQLACHUBkAAhQsAIdUGAgCXCwAh1gYCAJcLACHXBiAAmAsAIdgGIACYCwAh2QYBAIQLACHbBgEAhAsAIQMAAAB4ACBuAAC7FwAgbwAAzxcAIAwAAAB4ACAkAACuDAAgMgAAlQ8AIDMAAK8MACA0AACwDAAgaQAAzxcAILoFAQCDCwAhwQVAAIULACGJBgAArAyQBiKKBgEAgwsAIY0GAQCDCwAhjgYCAJcLACEKJAAArgwAIDIAAJUPACAzAACvDAAgNAAAsAwAILoFAQCDCwAhwQVAAIULACGJBgAArAyQBiKKBgEAgwsAIY0GAQCDCwAhjgYCAJcLACEDAAAAeAAgbgAAvRcAIG8AANIXACAMAAAAeAAgJAAArgwAIDIAAJUPACAzAACvDAAgNQAAsQwAIGkAANIXACC6BQEAgwsAIcEFQACFCwAhiQYAAKwMkAYiigYBAIMLACGNBgEAgwsAIY4GAgCXCwAhCiQAAK4MACAyAACVDwAgMwAArwwAIDUAALEMACC6BQEAgwsAIcEFQACFCwAhiQYAAKwMkAYiigYBAIMLACGNBgEAgwsAIY4GAgCXCwAhAwAAAHgAIG4AAL8XACBvAADVFwAgDAAAAHgAICQAAK4MACAyAACVDwAgNAAAsAwAIDUAALEMACBpAADVFwAgugUBAIMLACHBBUAAhQsAIYkGAACsDJAGIooGAQCDCwAhjQYBAIMLACGOBgIAlwsAIQokAACuDAAgMgAAlQ8AIDQAALAMACA1AACxDAAgugUBAIMLACHBBUAAhQsAIYkGAACsDJAGIooGAQCDCwAhjQYBAIMLACGOBgIAlwsAIQynBUAAAAABugUBAAAAAcEFQAAAAAH_BQIAAAABgAYCAAAAAYEGAQAAAAGCBgEAAAABgwYBAAAAAYQGAQAAAAGFBgEAAAABhwYAAACHBgOJBgAAAIkGAgW6BQEAAAABvAUAAACMBgLBBUAAAAABygUBAAAAAYwGAgAAAAEDAAAAKwAgbgAAqhcAIG8AANoXACAvAAAAKwAgIAAA-Q4AIEcAAOIRACBIAAD6DgAgSQAA-w4AIEoAAPwOACBLAAD9DgAgTAAA_g4AIE0AAP8OACBOAACADwAgaQAA2hcAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIdsFQACKCwAh4wUBAIMLACGJBgAA9w6VByKQBgEAgwsAIZwGIACYCwAhggcAAPUOggciiQcBAIMLACGKBwEAgwsAIYsHAQCECwAhjAcBAIMLACGNBwEAhAsAIY4HQACKCwAhjwcgAJgLACGQBwIAoQsAIZEHAgChCwAhkwcAAPYOkwcilQcBAIQLACGWB4AAAAABlwcBAIQLACGYB0AAigsAIZkHAgCXCwAhmgcCAJcLACGbBwIAlwsAIZwHAgCXCwAhnQcCAJcLACGeBwIAlwsAIZ8HAgCXCwAhoAcCAJcLACGhBwIAlwsAIaIHAgCXCwAhowcBAIQLACGkBwEAhAsAIaUHAQCECwAhLSAAAPkOACBHAADiEQAgSAAA-g4AIEkAAPsOACBKAAD8DgAgSwAA_Q4AIEwAAP4OACBNAAD_DgAgTgAAgA8AIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIdsFQACKCwAh4wUBAIMLACGJBgAA9w6VByKQBgEAgwsAIZwGIACYCwAhggcAAPUOggciiQcBAIMLACGKBwEAgwsAIYsHAQCECwAhjAcBAIMLACGNBwEAhAsAIY4HQACKCwAhjwcgAJgLACGQBwIAoQsAIZEHAgChCwAhkwcAAPYOkwcilQcBAIQLACGWB4AAAAABlwcBAIQLACGYB0AAigsAIZkHAgCXCwAhmgcCAJcLACGbBwIAlwsAIZwHAgCXCwAhnQcCAJcLACGeBwIAlwsAIZ8HAgCXCwAhoAcCAJcLACGhBwIAlwsAIaIHAgCXCwAhowcBAIQLACGkBwEAhAsAIaUHAQCECwAhAwAAAJsBACBuAACsFwAgbwAA3RcAIBAAAACbAQAgFAAA6REAIBYAAOoRACBEAADrEQAgRQAA7BEAIGkAAN0XACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc4FAgCXCwAhzwUgAJgLACHjBQEAgwsAIYIHAAD1DoIHIqYHEADwDAAhpwcQAPAMACEOFAAA6REAIBYAAOoRACBEAADrEQAgRQAA7BEAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzgUCAJcLACHPBSAAmAsAIeMFAQCDCwAhggcAAPUOggcipgcQAPAMACGnBxAA8AwAIRGnBUAAAAABugUBAAAAAcEFQAAAAAHKBQEAAAAB4wUBAAAAAfAFAQAAAAGJBgAAAJQGApAGAQAAAAGSBgAAAJIGApQGAgAAAAGVBgEAAAABlgYBAAAAAZgGQAAAAAGZBkAAAAABmgYBAAAAAZsGIAAAAAGcBiAAAAABFKcFQAAAAAG6BQEAAAABwQVAAAAAAc4FAgAAAAHPBSAAAAAB7QUBAAAAAe4FAQAAAAHvBQEAAAAB8AUBAAAAAfEFQAAAAAHzBQEAAAAB9AUBAAAAAfUFAQAAAAH2BQEAAAAB9wUBAAAAAfgFAQAAAAH5BSAAAAAB-wUAAAD7BQL8BUAAAAAB_QVAAAAAARgTAADqDwAgUAAA6w8AIFEAAOwPACBSAADtDwAgUwAA7g8AIFQAAO8PACBYAADwDwAgWQAA8Q8AIFwAAPMPACCnBUAAAAABugUBAAAAAcEFQAAAAAHMBQEAAAAB0AUBAAAAAdIFAAAA0gUC0wUBAAAAAdQFAgAAAAHVBQIAAAAB1gUCAAAAAdcFAQAAAAHYBQEAAAAB2QUBAAAAAdoFAQAAAAHbBUAAAAABAgAAACgAIG4AAOAXACADAAAAJgAgbgAA4BcAIG8AAOQXACAaAAAAJgAgEwAAogsAIFAAAKMLACBRAACkCwAgUgAApQsAIFMAAKYLACBUAACnCwAgWAAAqAsAIFkAAKkLACBcAACrCwAgaQAA5BcAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcwFAQCDCwAh0AUBAIMLACHSBQAAoAvSBSLTBQEAgwsAIdQFAgCXCwAh1QUCAKELACHWBQIAoQsAIdcFAQCDCwAh2AUBAIQLACHZBQEAgwsAIdoFAQCECwAh2wVAAIoLACEYEwAAogsAIFAAAKMLACBRAACkCwAgUgAApQsAIFMAAKYLACBUAACnCwAgWAAAqAsAIFkAAKkLACBcAACrCwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhzAUBAIMLACHQBQEAgwsAIdIFAACgC9IFItMFAQCDCwAh1AUCAJcLACHVBQIAoQsAIdYFAgChCwAh1wUBAIMLACHYBQEAhAsAIdkFAQCDCwAh2gUBAIQLACHbBUAAigsAIRSnBUAAAAABugUBAAAAAcEFQAAAAAHOBQIAAAABzwUgAAAAAe0FAQAAAAHuBQEAAAAB7wUBAAAAAfAFAQAAAAHxBUAAAAAB8gUBAAAAAfQFAQAAAAH1BQEAAAAB9gUBAAAAAfcFAQAAAAH4BQEAAAAB-QUgAAAAAfsFAAAA-wUC_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_B0AAigsAIcAHQACKCwAhwQdAAIULACEZBQAAlBMAIA4AAJUTACAPAACWEwAgEQAAlxMAIBIAAJgTACBeAACaEwAgXwAAmxMAIGAAAJwTACBhAACdEwAgYgAAnhMAIGMAAJ8TACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc8FIACYCwAhqQcBAIMLACG6BwEAgwsAIbsHAQCDCwAhvAcgAJgLACG9BwEAhAsAIb4HAgCXCwAhvwdAAIoLACHAB0AAigsAIcEHQACFCwAhGBMAAOoPACBQAADrDwAgUQAA7A8AIFIAAO0PACBTAADuDwAgVAAA7w8AIFgAAPAPACBZAADxDwAgWgAA8g8AIKcFQAAAAAG6BQEAAAABwQVAAAAAAcwFAQAAAAHQBQEAAAAB0gUAAADSBQLTBQEAAAAB1AUCAAAAAdUFAgAAAAHWBQIAAAAB1wUBAAAAAdgFAQAAAAHZBQEAAAAB2gUBAAAAAdsFQAAAAAECAAAAKAAgbgAA9RcAIAMAAAAmACBuAAD1FwAgbwAA-RcAIBoAAAAmACATAACiCwAgUAAAowsAIFEAAKQLACBSAAClCwAgUwAApgsAIFQAAKcLACBYAACoCwAgWQAAqQsAIFoAAKoLACBpAAD5FwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhzAUBAIMLACHQBQEAgwsAIdIFAACgC9IFItMFAQCDCwAh1AUCAJcLACHVBQIAoQsAIdYFAgChCwAh1wUBAIMLACHYBQEAhAsAIdkFAQCDCwAh2gUBAIQLACHbBUAAigsAIRgTAACiCwAgUAAAowsAIFEAAKQLACBSAAClCwAgUwAApgsAIFQAAKcLACBYAACoCwAgWQAAqQsAIFoAAKoLACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHMBQEAgwsAIdAFAQCDCwAh0gUAAKAL0gUi0wUBAIMLACHUBQIAlwsAIdUFAgChCwAh1gUCAKELACHXBQEAgwsAIdgFAQCECwAh2QUBAIMLACHaBQEAhAsAIdsFQACKCwAhGQUAAJsUACAOAACcFAAgDwAAnRQAIBIAAJ8UACBdAACgFAAgXgAAoRQAIF8AAKIUACBgAACjFAAgYQAApBQAIGIAAKUUACBjAACmFAAgpwVAAAAAAboFAQAAAAHBBUAAAAABygUBAAAAAc8FIAAAAAGpBwEAAAABugcBAAAAAbsHAQAAAAG8ByAAAAABvQcBAAAAAb4HAgAAAAG_B0AAAAABwAdAAAAAAcEHQAAAAAECAAAAAQAgbgAA-hcAIAMAAAASACBuAAD6FwAgbwAA_hcAIBsAAAASACAFAACUEwAgDgAAlRMAIA8AAJYTACASAACYEwAgXQAAmRMAIF4AAJoTACBfAACbEwAgYAAAnBMAIGEAAJ0TACBiAACeEwAgYwAAnxMAIGkAAP4XACCnBUAAhQsAIboFAQCDCwAhwQVAAIULACHKBQEAgwsAIc8FIACYCwAhqQcBAIMLACG6BwEAgwsAIbsHAQCDCwAhvAcgAJgLACG9BwEAhAsAIb4HAgCXCwAhvwdAAIoLACHAB0AAigsAIcEHQACFCwAhGQUAAJQTACAOAACVEwAgDwAAlhMAIBIAAJgTACBdAACZEwAgXgAAmhMAIF8AAJsTACBgAACcEwAgYQAAnRMAIGIAAJ4TACBjAACfEwAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHPBSAAmAsAIakHAQCDCwAhugcBAIMLACG7BwEAgwsAIbwHIACYCwAhvQcBAIQLACG-BwIAlwsAIb8HQACKCwAhwAdAAIoLACHBB0AAhQsAIRkFAACbFAAgDgAAnBQAIA8AAJ0UACARAACeFAAgXQAAoBQAIF4AAKEUACBfAACiFAAgYAAAoxQAIGEAAKQUACBiAAClFAAgYwAAphQAIKcFQAAAAAG6BQEAAAABwQVAAAAAAcoFAQAAAAHPBSAAAAABqQcBAAAAAboHAQAAAAG7BwEAAAABvAcgAAAAAb0HAQAAAAG-BwIAAAABvwdAAAAAAcAHQAAAAAHBB0AAAAABAgAAAAEAIG4AAP8XACADAAAAEgAgbgAA_xcAIG8AAIMYACAbAAAAEgAgBQAAlBMAIA4AAJUTACAPAACWEwAgEQAAlxMAIF0AAJkTACBeAACaEwAgXwAAmxMAIGAAAJwTACBhAACdEwAgYgAAnhMAIGMAAJ8TACBpAACDGAAgpwVAAIULACG6BQEAgwsAIcEFQACFCwAhygUBAIMLACHPBSAAmAsAIakHAQCDCwAhugcBAIMLACG7BwEAgwsAIbwHIACYCwAhvQcBAIQLACG-BwIAlwsAIb8HQACKCwAhwAdAAIoLACHBB0AAhQsAIRkFAACUEwAgDgAAlRMAIA8AAJYTACARAACXEwAgXQAAmRMAIF4AAJoTACBfAACbEwAgYAAAnBMAIGEAAJ0TACBiAACeEwAgYwAAnxMAIKcFQACFCwAhugUBAIMLACHBBUAAhQsAIcoFAQCDCwAhzwUgAJgLACGpBwEAgwsAIboHAQCDCwAhuwcBAIMLACG8ByAAmAsAIb0HAQCECwAhvgcCAJcLACG_B0AAigsAIcAHQACKCwAhwQdAAIULACENBQYCBgA3DhgCDxwJESAKEiULXSkMXucBB1_oAQdg6QEHYeoBE2LrARNj7gEUAwMAAQQAAw0XAQQGAAgICgQJDQIMEQcCBAADBwAFAgULBAYABgEFDAAEAwABBAADCgABCxMBAwgUAAkVAAwWAAEDAAEBECEBAQMAAQsGADYTKgFQLg1RygEYUssBGFPOARBUzwEmWNMBNFnXATRa2AE0XNwBNQsGADMgAA5HuQEMSLoBHUm7AS5KvAEwS70BL0y-ARlNvwEaTsABJ0_BASYGBgAyFC8NFjMPRJoBLUWvARhGswEmCQYALBc1ECAADiNQGC5zHjFlHT11JD6TARk_lAEaBQYAFxU2DBY3Dx47ER9LEwMGABYXABAYPxICGQATHQARBgYAFRcAEBhAEhpCFBtEARxFAQILQwEZABMBGEYAARhHAAMWTAAeTQAfTgAGBgAcFl8PIAAOIVEMIlIMKlYZBQYAGyMAGCQADSVXDylbGgMmABknXA8oXQ0BKV4AAhZhACpgAAQGACMkAA0nAA8waR4FBgAiJwAPK2odLQAfL3AhAgYAICxrHgEsbAABLgAeAS9xAAEwcgAIBgArJ48BDyuOASc4ACU5jAEnOo0BJzuQASQ8kQEkAwYAKjIAJjeKASQGBgApFXYMIAAOK3cNMXsnNocBJQYGACgkAA0yACYzfiQ0fyQ1gAEkAzOBAQA0ggEANYMBAAIxiAEANokBAAE3iwEAATySAQACMZUBAD6WAQAFBgAxIJwBDkGgAS5CpAEvQ6kBMAIkAA1AAC0CJKUBDUAALQIkAA1AAC0DQaoBAEKrAQBDrAEABRS0AQAWtQEARLYBAEW3AQBGuAEACEjCAQBJwwEASsQBAEvFAQBMxgEATccBAE7IAQBPyQEAA1XUAQxW1QEMV9YBDAFb3QEMCVDeAQBR3wEAUuABAFPhAQBU4gEAWOMBAFnkAQBa5QEAXOYBAAwF7wEADvABAA_xAQAR8gEAEvMBAF30AQBe9QEAX_YBAGD3AQBh-AEAYvkBAGP6AQAABQYAOnQAO3UAPHYAPXcAPgAAAAAABQYAOnQAO3UAPHYAPXcAPgMGAEF2AEJ3AEMAAAADBgBBdgBCdwBDAwYARnYAR3cASAAAAAMGAEZ2AEd3AEgDBgBLdgBMdwBNAAAAAwYAS3YATHcATQMGAFB2AFF3AFIAAAADBgBQdgBRdwBSAwYAVXYAVncAVwAAAAMGAFV2AFZ3AFcDBgBadgBbdwBcAAAAAwYAWnYAW3cAXAADBgBgdgBhdwBiAAAAAwYAYHYAYXcAYgUGAGV0AGZ1AGd2AGh3AGkAAAAAAAUGAGV0AGZ1AGd2AGh3AGkFBgBsdABtdQBudgBvdwBwAAAAAAAFBgBsdABtdQBudgBvdwBwBQYAc3QAdHUAdXYAdncAdwAAAAAABQYAc3QAdHUAdXYAdncAdwUGAHp0AHt1AHx2AH13AH4AAAAAAAUGAHp0AHt1AHx2AH13AH4FBgCBAXQAggF1AIMBdgCEAXcAhQEAAAAAAAUGAIEBdACCAXUAgwF2AIQBdwCFAQUGAIgBdACJAXUAigF2AIsBdwCMAQAAAAAABQYAiAF0AIkBdQCKAXYAiwF3AIwBBQYAjwF0AJABdQCRAXYAkgF3AJMBAAAAAAAFBgCPAXQAkAF1AJEBdgCSAXcAkwEDBgCWAXYAlwF3AJgBAAAAAwYAlgF2AJcBdwCYAQMGAJsBdgCcAXcAnQEAAAADBgCbAXYAnAF3AJ0BAwYAoAF2AKEBdwCiAQAAAAMGAKABdgChAXcAogEFBgClAXQApgF1AKcBdgCoAXcAqQEAAAAAAAUGAKUBdACmAXUApwF2AKgBdwCpAQUGAKwBdACtAXUArgF2AK8BdwCwAQAAAAAABQYArAF0AK0BdQCuAXYArwF3ALABBQYAswF0ALQBdQC1AXYAtgF3ALcBAAAAAAAFBgCzAXQAtAF1ALUBdgC2AXcAtwEFBgC6AXQAuwF1ALwBdgC9AXcAvgEAAAAAAAUGALoBdAC7AXUAvAF2AL0BdwC-AQMGAMEBdgDCAXcAwwEAAAADBgDBAXYAwgF3AMMBBQYAxgF0AMcBdQDIAXYAyQF3AMoBAAAAAAAFBgDGAXQAxwF1AMgBdgDJAXcAygEFBgDNAXQAzgF1AM8BdgDQAXcA0QEAAAAAAAUGAM0BdADOAXUAzwF2ANABdwDRAQUGANQBdADVAXUA1gF2ANcBdwDYAQAAAAAABQYA1AF0ANUBdQDWAXYA1wF3ANgBBQYA2wF0ANwBdQDdAXYA3gF3AN8BAAAAAAAFBgDbAXQA3AF1AN0BdgDeAXcA3wEFBgDiAXQA4wF1AOQBdgDlAXcA5gEAAAAAAAUGAOIBdADjAXUA5AF2AOUBdwDmAQUGAOkBdADqAXUA6wF2AOwBdwDtAQAAAAAABQYA6QF0AOoBdQDrAXYA7AF3AO0BBQYA8AF0APEBdQDyAXYA8wF3APQBAAAAAAAFBgDwAXQA8QF1APIBdgDzAXcA9AEFBgD3AXQA-AF1APkBdgD6AXcA-wEAAAAAAAUGAPcBdAD4AXUA-QF2APoBdwD7AQUGAP4BdAD_AXUAgAJ2AIECdwCCAgAAAAAABQYA_gF0AP8BdQCAAnYAgQJ3AIICBAYAhwKtBI4HhQKvBJIHhgKwBJUHhgIBrAQAhAICrAQAhAKuBJQHhAICrQSWBwCvBJcHAAMGAIkCdgCKAncAiwIAAAADBgCJAnYAigJ3AIsCBQYAjgJ0AI8CdQCQAnYAkQJ3AJICAAAAAAAFBgCOAnQAjwJ1AJACdgCRAncAkgIFBgCVAnQAlgJ1AJcCdgCYAncAmQIAAAAAAAUGAJUCdACWAnUAlwJ2AJgCdwCZAgUGAJwCdACdAnUAngJ2AJ8CdwCgAgAAAAAABQYAnAJ0AJ0CdQCeAnYAnwJ3AKACBQYAowJ0AKQCdQClAnYApgJ3AKcCAAAAAAAFBgCjAnQApAJ1AKUCdgCmAncApwIDBgCqAnYAqwJ3AKwCAAAAAwYAqgJ2AKsCdwCsAgMGAK8CdgCwAncAsQIAAAADBgCvAnYAsAJ3ALECAAMGALUCdgC2AncAtwIAAAADBgC1AnYAtgJ3ALcCZAIBZfsBAWb9AQFn_gEBaP8BAWqBAgFrgwI4bIUCAW2HAjhwiAIBcYkCAXKKAjh4jQI5eY4CP3qQAgN7kQIDfJQCA32VAgN-lgIDf5gCA4ABmgI4gQGcAgOCAZ4COIMBnwIDhAGgAgOFAaECOIYBpAJAhwGlAkSIAacCBYkBqAIFigGrAgWLAawCBYwBrQIFjQGvAgWOAbECOI8BswIFkAG1AjiRAbYCBZIBtwIFkwG4AjiUAbsCRZUBvAJJlgG9AgKXAb4CApgBvwICmQHAAgKaAcECApsBwwICnAHFAjidAccCAp4ByQI4nwHKAgKgAcsCAqEBzAI4ogHPAkqjAdACTqQB0QIEpQHSAgSmAdMCBKcB1AIEqAHVAgSpAdcCBKoB2QI4qwHbAgSsAd0COK0B3gIErgHfAgSvAeACOLAB4wJPsQHkAlOyAeUCB7MB5gIHtAHnAge1AegCB7YB6QIHtwHrAge4Ae0COLkB7wIHugHxAji7AfICB7wB8wIHvQH0Aji-AfcCVL8B-AJYwAH5AgnBAfoCCcIB-wIJwwH8AgnEAf0CCcUB_wIJxgGBAzjHAYMDCcgBhQM4yQGGAwnKAYcDCcsBiAM4zAGLA1nNAYwDXc4BjgNezwGPA17QAZIDXtEBkwNe0gGUA17TAZYDXtQBmAM41QGaA17WAZwDONcBnQNe2AGeA17ZAZ8DONoBogNf2wGjA2PcAaUDDt0BpgMO3gGoAw7fAakDDuABqgMO4QGsAw7iAa4DOOMBsAMO5AGyAzjlAbMDDuYBtAMO5wG1AzjoAbgDZOkBuQNq6gG6Aw3rAbsDDewBvAMN7QG9Aw3uAb4DDe8BwAMN8AHCAzjxAcQDDfIBxgM48wHHAw30AcgDDfUByQM49gHMA2v3Ac0DcfgBzgMt-QHPAy36AdADLfsB0QMt_AHSAy39AdQDLf4B1gM4_wHYAy2AAtoDOIEC2wMtggLcAy2DAt0DOIQC4ANyhQLhA3iGAuIDLocC4wMuiALkAy6JAuUDLooC5gMuiwLoAy6MAuoDOI0C7AMujgLuAziPAu8DLpAC8AMukQLxAziSAvQDeZMC9QN_lAL2AzCVAvcDMJYC-AMwlwL5AzCYAvoDMJkC_AMwmgL-AzibAoAEMJwCggQ4nQKDBDCeAoQEMJ8ChQQ4oAKIBIABoQKJBIYBogKKBC-jAosEL6QCjAQvpQKNBC-mAo4EL6cCkAQvqAKSBDipApQEL6oClgQ4qwKXBC-sApgEL60CmQQ4rgKcBIcBrwKdBI0BsAKeBBixAp8EGLICoAQYswKhBBi0AqIEGLUCpAQYtgKmBDi3AqgEGLgCqgQ4uQKrBBi6AqwEGLsCrQQ4vAKwBI4BvQKxBJQBvgKyBBm_ArMEGcACtAQZwQK1BBnCArYEGcMCuAQZxAK6BDjFArwEGcYCvgQ4xwK_BBnIAsAEGckCwQQ4ygLEBJUBywLFBJkBzALGBBrNAscEGs4CyAQazwLJBBrQAsoEGtECzAQa0gLOBDjTAtAEGtQC0gQ41QLTBBrWAtQEGtcC1QQ42ALYBJoB2QLZBJ4B2gLaBBDbAtsEENwC3AQQ3QLdBBDeAt4EEN8C4AQQ4ALiBDjhAuQEEOIC5gQ44wLnBBDkAugEEOUC6QQ45gLsBJ8B5wLtBKMB6ALvBB_pAvAEH-oC8wQf6wL0BB_sAvUEH-0C9wQf7gL5BDjvAvsEH_AC_QQ48QL-BB_yAv8EH_MCgAU49AKDBaQB9QKEBaoB9gKFBQ_3AoYFD_gChwUP-QKIBQ_6AokFD_sCiwUP_AKNBTj9Ao8FD_4CkQU4_wKSBQ-AA5MFD4EDlAU4ggOXBasBgwOYBbEBhAOZBR2FA5oFHYYDmwUdhwOcBR2IA50FHYkDnwUdigOhBTiLA6MFHYwDpQU4jQOmBR2OA6cFHY8DqAU4kAOrBbIBkQOsBbgBkgOtBR6TA64FHpQDrwUelQOwBR6WA7EFHpcDswUemAO1BTiZA7cFHpoDuQU4mwO6BR6cA7sFHp0DvAU4ngO_BbkBnwPABb8BoAPBBSGhA8IFIaIDwwUhowPEBSGkA8UFIaUDxwUhpgPJBTinA8sFIagDzQU4qQPOBSGqA88FIasD0AU4rAPTBcABrQPUBcQBrgPVBRGvA9YFEbAD1wURsQPYBRGyA9kFEbMD2wURtAPdBTi1A98FEbYD4QU4twPiBRG4A-MFEbkD5AU4ugPnBcUBuwPoBcsBvAPpBRO9A-oFE74D6wUTvwPsBRPAA-0FE8ED7wUTwgPxBTjDA_MFE8QD9QU4xQP2BRPGA_cFE8cD-AU4yAP7BcwByQP8BdIBygP9BRLLA_4FEswD_wUSzQOABhLOA4EGEs8DgwYS0AOFBjjRA4cGEtIDiQY40wOKBhLUA4sGEtUDjAY41gOPBtMB1wOQBtkB2AORBhTZA5IGFNoDkwYU2wOUBhTcA5UGFN0DlwYU3gOZBjjfA5sGFOADnQY44QOeBhTiA58GFOMDoAY45AOjBtoB5QOkBuAB5gOlBibnA6YGJugDpwYm6QOoBibqA6kGJusDqwYm7AOtBjjtA68GJu4DsQY47wOyBibwA7MGJvEDtAY48gO3BuEB8wO4BucB9AO5Bif1A7oGJ_YDuwYn9wO8Bif4A70GJ_kDvwYn-gPBBjj7A8MGJ_wDxQY4_QPGBif-A8cGJ_8DyAY4gATLBugBgQTMBu4BggTNBiWDBM4GJYQEzwYlhQTQBiWGBNEGJYcE0wYliATVBjiJBNcGJYoE2QY4iwTaBiWMBNsGJY0E3AY4jgTfBu8BjwTgBvUBkAThBiSRBOIGJJIE4wYkkwTkBiSUBOUGJJUE5wYklgTpBjiXBOsGJJgE7QY4mQTuBiSaBO8GJJsE8AY4nATzBvYBnQT0BvwBngT1BjSfBPYGNKAE9wY0oQT4BjSiBPkGNKME-wY0pAT9BjilBP8GNKYEgQc4pwSCBzSoBIMHNKkEhAc4qgSHB_0BqwSIB4MCsQSKB4QCsgSYB4QCswSaB4QCtASbB4QCtQScB4QCtgSeB4QCtwSgBzi4BKIHhAK5BKQHOLoEpQeEArsEpgeEArwEpwc4vQSqB4gCvgSrB4wCvwSsB4UCwAStB4UCwQSuB4UCwgSvB4UCwwSwB4UCxASyB4UCxQS0BzjGBLYHhQLHBLgHOMgEuQeFAskEugeFAsoEuwc4ywS-B40CzAS_B5MCzQTAB4YCzgTBB4YCzwTCB4YC0ATDB4YC0QTEB4YC0gTGB4YC0wTIBzjUBMoHhgLVBMwHONYEzQeGAtcEzgeGAtgEzwc42QTSB5QC2gTTB5oC2wTUBwzcBNUHDN0E1gcM3gTXBwzfBNgHDOAE2gcM4QTcBzjiBN4HDOME4Ac45AThBwzlBOIHDOYE4wc45wTmB5sC6ATnB6EC6QToBzXqBOkHNesE6gc17ATrBzXtBOwHNe4E7gc17wTwBzjwBPIHNfEE9Ac48gT1BzXzBPYHNfQE9wc49QT6B6IC9gT7B6gC9wT8Bwr4BP0HCvkE_gcK-gT_Bwr7BIAICvwEgggK_QSECDj-BIYICv8EiAg4gAWJCAqBBYoICoIFiwg4gwWOCKkChAWPCK0ChQWQCAuGBZEIC4cFkggLiAWTCAuJBZQIC4oFlggLiwWYCDiMBZoIC40FnAg4jgWdCAuPBZ4IC5AFnwg4kQWiCK4CkgWjCLICkwWlCLMClAWmCLMClQWpCLMClgWqCLMClwWrCLMCmAWtCLMCmQWvCDiaBbEIswKbBbMIOJwFtAizAp0FtQizAp4Ftgg4nwW5CLQCoAW6CLgC"
};
async function decodeBase64AsWasm(wasmBase64) {
  const { Buffer: Buffer2 } = await import("node:buffer");
  const wasmArray = Buffer2.from(wasmBase64, "base64");
  return new WebAssembly.Module(wasmArray);
}
config.compilerWasm = {
  getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.mysql.mjs"),
  getQueryCompilerWasmModule: async () => {
    const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.mysql.wasm-base64.mjs");
    return await decodeBase64AsWasm(wasm);
  },
  importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
  return runtime.getPrismaClient(config);
}

// ../packages/db/src/generated/prisma/internal/prismaNamespace.ts
import * as runtime2 from "@prisma/client/runtime/client";
var getExtensionContext = runtime2.Extensions.getExtensionContext;
var NullTypes2 = {
  DbNull: runtime2.NullTypes.DbNull,
  JsonNull: runtime2.NullTypes.JsonNull,
  AnyNull: runtime2.NullTypes.AnyNull
};
var TransactionIsolationLevel = runtime2.makeStrictEnum({
  ReadUncommitted: "ReadUncommitted",
  ReadCommitted: "ReadCommitted",
  RepeatableRead: "RepeatableRead",
  Serializable: "Serializable"
});
var defineExtension = runtime2.Extensions.defineExtension;

// ../packages/db/src/generated/prisma/client.ts
globalThis["__dirname"] = path2.dirname(fileURLToPath2(import.meta.url));
var PrismaClient = getPrismaClientClass();

// src/db/prisma.ts
function createClient() {
  const e = env();
  const adapter = new PrismaMariaDb({
    host: e.MYSQL_HOST,
    port: e.MYSQL_PORT,
    user: e.MYSQL_USER,
    password: e.MYSQL_PASSWORD,
    database: e.MYSQL_DATABASE,
    connectionLimit: e.DATABASE_POOL_SIZE,
    allowPublicKeyRetrieval: true
  });
  return new PrismaClient({
    adapter,
    log: [{ emit: "event", level: "error" }]
  });
}
var globalForPrisma = globalThis;
var prisma = globalForPrisma.__tfnApiPrisma ?? createClient();
if (env().NODE_ENV !== "production") globalForPrisma.__tfnApiPrisma = prisma;
async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}
async function disconnectDatabase() {
  logger().info("disconnecting prisma");
  await prisma.$disconnect();
}

// src/lib/audit.ts
import { AsyncLocalStorage } from "node:async_hooks";

// ../packages/core/src/redact.ts
var SENSITIVE_KEY = /pass(word)?|secret|token|cookie|session|authorization|mfa|otp|totp|code|hash|apikey|api_key|accesskey|privatekey/i;
function redact(value, depth = 0) {
  if (depth > 6) return "[TRUNCATED]";
  if (value === null || value === void 0) return null;
  if (typeof value === "string") return value.length > 1e3 ? `${value.slice(0, 1e3)}\u2026` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    if ("toJSON" in value && typeof value.toJSON === "function") {
      return redact(value.toJSON(), depth + 1);
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

// ../packages/core/src/audit.service.ts
async function logAudit(deps, params) {
  const db = params.db ?? deps.db;
  try {
    let ipAddress = params.context?.ipAddress ?? null;
    let userAgent = params.context?.userAgent?.slice(0, 255) ?? null;
    if (!params.context && deps.context) {
      try {
        const ctx = await deps.context();
        ipAddress = ctx.ipAddress ?? null;
        userAgent = ctx.userAgent?.slice(0, 255) ?? null;
      } catch {
      }
    }
    const safeMeta = params.metadata ? redact(params.metadata) : void 0;
    await db.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ? String(params.entityId) : null,
        summary: params.summary.slice(0, 500),
        metadata: safeMeta,
        ipAddress: ipAddress ? ipAddress.slice(0, 64) : null,
        userAgent
      }
    });
  } catch (err) {
    console.error("[audit] gagal menulis audit log:", err);
  }
}

// src/lib/audit.ts
var storage = new AsyncLocalStorage();
function withAuditContext(req, fn) {
  const context = {
    ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.ip ?? null,
    userAgent: req.headers["user-agent"]?.slice(0, 255) ?? null
  };
  return storage.run(context, fn);
}
async function logAudit2(params) {
  return logAudit({ db: prisma, context: () => storage.getStore() ?? {} }, params);
}

// src/lib/auth.ts
function authEnv() {
  const e = env();
  return {
    APP_URL: process.env.APP_URL ?? e.APP_URL,
    NODE_ENV: process.env.NODE_ENV ?? "development",
    SESSION_TTL_HOURS: e.SESSION_TTL_HOURS,
    SESSION_IDLE_MINUTES: e.SESSION_IDLE_MINUTES,
    AUTH_MAX_FAILED_LOGINS: e.AUTH_MAX_FAILED_LOGINS,
    AUTH_LOCKOUT_MINUTES: e.AUTH_LOCKOUT_MINUTES,
    AUTH_ENFORCE_MFA: e.AUTH_ENFORCE_MFA,
    ENCRYPTION_KEY: e.ENCRYPTION_KEY
  };
}
var service = createAuthService({
  db: prisma,
  // Getter, bukan objek: `env()` dibaca ulang tiap panggilan supaya `stubEnv`/mutasi runtime berlaku.
  env: authEnv,
  audit: (event) => logAudit2(event)
});
var SESSION_COOKIE_NAME = sessionCookieName(authEnv());
function getSession(jar) {
  return service.getSession(jar);
}
function authenticateCredentials(email, plainPassword, meta) {
  return service.authenticateCredentials(email, plainPassword, meta);
}
function destroySession(jar) {
  return service.destroySession(jar);
}
function changeOwnPassword(userId, input, keepSessionId) {
  return service.changeOwnPassword(userId, input, keepSessionId);
}

// src/lib/cookie-jar.ts
function parseCookieHeader(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    const raw2 = part.slice(eq + 1).trim();
    let value = raw2;
    try {
      value = decodeURIComponent(raw2);
    } catch {
    }
    out[name] = value;
  }
  return out;
}
function createExpressCookieJar(req, res) {
  let parsed = null;
  const readAll = () => {
    if (parsed === null) parsed = parseCookieHeader(req.headers.cookie);
    return parsed;
  };
  return {
    get: (name) => readAll()[name],
    set: (name, value, options) => {
      const { maxAge, ...rest } = options;
      res.cookie(name, value, maxAge === void 0 ? rest : { ...rest, maxAge: maxAge * 1e3 });
    },
    delete: (name) => {
      res.clearCookie(name, { path: "/" });
    }
  };
}

// src/lib/require-permission.ts
async function requirePermission(req, res, permission) {
  const user = await getSession(createExpressCookieJar(req, res));
  if (!user) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  if (!hasPermission(user, permission)) {
    throw new AppError(403, "FORBIDDEN", `Required permission missing: ${permission}`);
  }
  return user;
}
function nodeEnv() {
  return process.env.NODE_ENV ?? "development";
}
function isLocalDevOrigin(value) {
  if (nodeEnv() !== "development") return false;
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}
function originAllowed(req, appUrl) {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const sameAs = (value) => {
    if (!value) return false;
    try {
      return new URL(value).origin === new URL(appUrl).origin;
    } catch {
      return false;
    }
  };
  if (origin) return sameAs(origin) || isLocalDevOrigin(origin);
  if (referer) return sameAs(referer) || isLocalDevOrigin(referer);
  return nodeEnv() !== "production";
}

// src/routes/auth.ts
var loginSchema = z4.object({
  identifier: z4.string().trim().min(1).max(191).optional(),
  email: z4.string().trim().min(1).max(191).optional(),
  password: z4.string().min(1, "Password is required").max(1024),
  totpCode: z4.string().regex(/^\d{6}$/, "MFA code must contain six digits").optional()
}).refine((data) => Boolean(data.identifier || data.email), {
  message: "Username or email is required",
  path: ["identifier"]
});
function clientIp(headerValue, fallback) {
  return headerValue?.split(",")[0]?.trim() || fallback || "127.0.0.1";
}
function createAuthRouter() {
  const router = Router3();
  router.post("/login", async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Invalid input data", {
          details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
        });
      }
      const ip = clientIp(req.headers["x-forwarded-for"], req.ip);
      const userAgent = req.headers["user-agent"]?.slice(0, 255);
      const identifier = parsed.data.identifier || parsed.data.email || "";
      const result = await authenticateCredentials(identifier, parsed.data.password, {
        ip: ip.slice(0, 64),
        ...userAgent ? { userAgent } : {},
        ...parsed.data.totpCode ? { totpCode: parsed.data.totpCode } : {},
        jar: createExpressCookieJar(req, res)
      });
      if (!result.success) {
        throw new AppError(401, "INVALID_CREDENTIALS", result.error || "Authentication failed", {
          details: result.requiresMfa ? { requiresMfa: true } : void 0
        });
      }
      res.json({
        success: true,
        user: {
          id: result.user?.id,
          username: result.user?.username,
          email: result.user?.email,
          name: result.user?.name,
          roles: result.user?.roles
        }
      });
    } catch (err) {
      next(err);
    }
  });
  router.post("/logout", async (req, res, next) => {
    try {
      await destroySession(createExpressCookieJar(req, res));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });
  router.get("/me", async (req, res, next) => {
    try {
      const user = await getSession(createExpressCookieJar(req, res));
      if (!user) {
        throw new AppError(401, "UNAUTHORIZED", "Tidak terautentikasi");
      }
      res.json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          roles: user.roles,
          permissions: [...user.permissions],
          mfaVerified: user.mfaVerified
        }
      });
    } catch (err) {
      next(err);
    }
  });
  router.post("/change-password", async (req, res, next) => {
    try {
      if (!originAllowed(req, env().APP_URL)) {
        throw new AppError(403, "INVALID_ORIGIN", "Invalid request origin");
      }
      const user = await getSession(createExpressCookieJar(req, res));
      if (!user) {
        throw new AppError(401, "UNAUTHORIZED", "Tidak terautentikasi");
      }
      const parsed = changeOwnPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, "VALIDATION_ERROR", "Invalid input data", {
          details: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
        });
      }
      const result = await changeOwnPassword(user.id, parsed.data, user.sessionId);
      if (!result.success) {
        throw new AppError(400, "PASSWORD_CHANGE_FAILED", result.error);
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });
  return router;
}

// src/routes/settings.ts
import { Router as Router4 } from "express";
import { z as z6 } from "zod";

// ../packages/core/src/setting-schemas.ts
import { z as z5 } from "zod";
var SETTING_SCHEMAS = {
  "branding.general": z5.object({
    siteName: z5.string().min(1).max(80).default("TFN Temanggung Fight Night"),
    abbreviation: z5.string().min(1).max(12).default("TFN"),
    suffix: z5.string().max(12).default("\xB7X"),
    tagline: z5.string().max(200).default(
      "Kejuaraan Tinju Profesional Temanggung Fight Night."
    )
  }),
  "landing.featured": z5.object({
    heading: z5.string().max(120).default("FEATURED CHAMPIONS"),
    subheading: z5.string().max(240).default(""),
    ctaLabel: z5.string().max(40).default("VIEW ALL ATHLETES"),
    ctaHref: z5.string().max(500).default("/fighters")
  }),
  "footer.general": z5.object({
    copyright: z5.string().max(200).default("\xA9 2026 World Boxing Championship. All rights reserved."),
    contactEmail: z5.string().max(191).regex(/^$|^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Must be a valid email address").default(""),
    certifications: z5.string().max(255).default("Certified Sanctioning Authority \u2014 Las Vegas \xB7 Tokyo \xB7 Jakarta")
  }),
  "system.flags": z5.object({
    maintenanceMode: z5.boolean().default(false),
    showDemoContent: z5.boolean().default(true)
  })
};
var SETTING_KEYS = Object.keys(SETTING_SCHEMAS);
function isSettingKey(value) {
  return Object.prototype.hasOwnProperty.call(SETTING_SCHEMAS, value);
}

// ../packages/core/src/settings.service.ts
var SettingsError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "SettingsError";
  }
};
function resolveSetting(key, row) {
  const parsed = row ? SETTING_SCHEMAS[key].safeParse(row.value) : null;
  return parsed?.success ? parsed.data : SETTING_SCHEMAS[key].parse({});
}
async function getSettings(deps) {
  const rows = await deps.db.organizationSetting.findMany({
    where: { key: { in: [...SETTING_KEYS] } }
  });
  const result = {};
  for (const key of SETTING_KEYS) {
    result[key] = resolveSetting(key, rows.find((r) => r.key === key));
  }
  return result;
}
async function updateSettings(deps, actorId, values) {
  const applied = [];
  for (const [key, rawValue] of Object.entries(values)) {
    if (!isSettingKey(key)) {
      throw new SettingsError(`Unknown setting key: ${key}`);
    }
    const parsed = SETTING_SCHEMAS[key].safeParse(rawValue);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new SettingsError(
        `Invalid value for "${key}"${firstIssue?.path?.length ? ` (${firstIssue.path.join(".")})` : ""}: ${firstIssue?.message ?? "validation failed"}`
      );
    }
    await deps.db.organizationSetting.upsert({
      where: { key },
      update: { value: parsed.data, updatedById: actorId },
      create: { key, value: parsed.data, updatedById: actorId }
    });
    applied.push(key);
  }
  if (applied.length > 0) {
    await deps.logAudit({
      actorId,
      action: "SETTINGS_UPDATE",
      entityType: "ORGANIZATION_SETTING",
      entityId: applied.join(","),
      summary: `Updated organization settings: ${applied.join(", ")}`,
      metadata: { keys: applied }
    });
  }
  return applied;
}

// ../packages/core/src/sponsor-tiers.ts
var SPONSOR_TIERS = [
  { key: "PLATINUM", id: "Sponsor Platinum", en: "Platinum sponsors" },
  { key: "GOLD", id: "Sponsor Gold", en: "Gold sponsors" },
  { key: "SILVER", id: "Sponsor Silver", en: "Silver sponsors" },
  { key: "PARTNER", id: "Mitra pendukung", en: "Supporting partners" },
  { key: "MEDIA_PARTNER", id: "Media partner", en: "Media partners" }
];
var SPONSOR_TIER_KEYS = SPONSOR_TIERS.map((tier) => tier.key);
var DEFAULT_SPONSOR_TIER = "PARTNER";
function normalizeSponsorTier(value) {
  const upper = (value ?? "").trim().toUpperCase();
  return SPONSOR_TIER_KEYS.includes(upper) ? upper : DEFAULT_SPONSOR_TIER;
}

// ../packages/core/src/sponsor.service.ts
async function getPublicSponsors(db) {
  const rows = await db.sponsor.findMany({
    where: {
      isActive: true,
      OR: [{ logoId: null }, { logo: { deletedAt: null } }]
    },
    include: { logo: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    tier: normalizeSponsorTier(row.tier),
    logoUrl: row.logo?.deletedAt ? null : row.logo?.url ?? null
  }));
}

// src/routes/settings.ts
var updateSchema = z6.object({ values: z6.record(z6.string(), z6.unknown()) });
function toAppError(error) {
  if (error instanceof SettingsError) {
    return new AppError(400, "VALIDATION_ERROR", error.message);
  }
  if (error instanceof z6.ZodError) {
    return new AppError(400, "VALIDATION_ERROR", "Data tidak valid.", {
      details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    });
  }
  return error;
}
function createSettingsRouter() {
  const router = Router4();
  router.get("/", async (_req, res, next) => {
    try {
      res.json({ data: await getSettings({ db: prisma, logAudit: logAudit2 }) });
    } catch (error) {
      next(toAppError(error));
    }
  });
  router.put("/", async (req, res, next) => {
    try {
      if (!originAllowed(req, env().APP_URL)) throw new AppError(403, "INVALID_ORIGIN", "Invalid request origin");
      const user = await requirePermission(req, res, "settings.manage");
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;
      const result = await withAuditContext(req, async () => {
        const applied = await updateSettings({ db: prisma, logAudit: logAudit2 }, user.id, parsed.data.values);
        return { applied, settings: await getSettings({ db: prisma, logAudit: logAudit2 }) };
      });
      res.json({ data: result });
    } catch (error) {
      next(toAppError(error));
    }
  });
  return router;
}
function createSponsorsRouter() {
  const router = Router4();
  router.get("/", async (_req, res, next) => {
    try {
      res.json({ data: await getPublicSponsors(prisma) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

// src/routes/rbac.ts
import { Router as Router5 } from "express";
import { z as z7 } from "zod";
var rbac = createRbacService({ db: prisma, audit: (event) => logAudit2(event) });
function toAppError2(error) {
  if (error instanceof RbacError) {
    return new AppError(400, "RBAC_ERROR", error.message);
  }
  if (error instanceof z7.ZodError) {
    return new AppError(400, "VALIDATION_ERROR", "Data tidak valid.", {
      details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    });
  }
  return error;
}
function assertOrigin(req) {
  if (!originAllowed(req, env().APP_URL)) {
    throw new AppError(403, "INVALID_ORIGIN", "Invalid request origin");
  }
}
function createRbacRouter() {
  const router = Router5();
  router.get("/roles", async (req, res, next) => {
    try {
      await requirePermission(req, res, "roles.manage");
      res.json({ data: await rbac.listRolesDetailed() });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  router.post("/roles", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "roles.manage");
      const created = await withAuditContext(req, () => rbac.createRole(user.id, req.body));
      res.status(201).json({ data: created });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  router.put("/roles/:roleId", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "roles.manage");
      await withAuditContext(
        req,
        () => rbac.updateRole(user.id, { ...req.body, roleId: req.params.roleId })
      );
      res.json({ data: { ok: true } });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  router.put("/roles/:roleId/permissions", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "roles.manage");
      await withAuditContext(
        req,
        () => rbac.updateRolePermissions(user.id, {
          ...req.body,
          roleId: req.params.roleId
        })
      );
      res.json({ data: { ok: true } });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  router.delete("/roles/:roleId", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "roles.manage");
      await withAuditContext(req, () => rbac.deleteRole(user.id, req.params.roleId));
      res.json({ data: { ok: true } });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  router.get("/users", async (req, res, next) => {
    try {
      await requirePermission(req, res, "users.manage");
      res.json({ data: await rbac.listUsersDetailed() });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  router.post("/users", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "users.manage");
      const created = await withAuditContext(req, () => rbac.createUser(user.id, req.body));
      res.status(201).json({ data: created });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  router.put("/users/:userId/active", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "users.manage");
      await withAuditContext(
        req,
        () => rbac.setUserActive(user.id, { ...req.body, userId: req.params.userId })
      );
      res.json({ data: { ok: true } });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  router.post("/user-roles/grant", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "users.manage");
      const result = await withAuditContext(req, () => rbac.grantRole(user.id, req.body));
      res.status(201).json({ data: result });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  router.post("/user-roles/revoke", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "users.manage");
      const result = await withAuditContext(req, () => rbac.revokeRole(user.id, req.body));
      res.json({ data: result });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  router.get("/role-requests", async (req, res, next) => {
    try {
      await requirePermission(req, res, "roles.manage");
      res.json({ data: await rbac.listPendingRoleRequests() });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  router.post("/role-requests/:requestId/review", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "roles.manage");
      await withAuditContext(
        req,
        () => rbac.reviewRoleRequest(user.id, {
          ...req.body,
          requestId: req.params.requestId
        })
      );
      res.json({ data: { ok: true } });
    } catch (error) {
      next(toAppError2(error));
    }
  });
  return router;
}

// src/app.ts
function createApp({ checkDb, version = "0.1.0", openApiEnabled }) {
  const e = env();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);
  app.use(express.json({ limit: "1mb" }));
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger: logger(),
      genReqId: (req) => req.requestId,
      autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/health/ready" },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      }
    })
  );
  app.use(
    cors({
      origin: e.corsOrigins.length > 0 ? e.corsOrigins : false,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-CSRF-Token"],
      exposedHeaders: ["X-Request-Id"],
      maxAge: 600
    })
  );
  app.use(createHealthRouter({ checkDb }));
  app.use("/api/v1", createV1Router({ version }));
  app.use("/api/auth", createAuthRouter());
  app.use("/api/settings", createSettingsRouter());
  app.use("/api/sponsors", createSponsorsRouter());
  app.use("/api/rbac", createRbacRouter());
  if (openApiEnabled ?? e.OPENAPI_ENABLED !== false) mountApiDocs(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// src/index.ts
async function main() {
  let e;
  try {
    e = env();
  } catch (error) {
    process.stderr.write(`[tfn-api] konfigurasi environment tidak valid: ${describeEnvProblem(error)}
`);
    process.exit(1);
  }
  const log = logger();
  log.info(
    {
      envFiles: loadedEnvFilePaths(),
      cwd: process.cwd(),
      db: { host: e.MYSQL_HOST, port: e.MYSQL_PORT, database: e.MYSQL_DATABASE, user: e.MYSQL_USER }
    },
    "config resolved"
  );
  const app = createApp({ checkDb: pingDatabase });
  const server = app.listen(e.API_PORT, e.API_HOST, () => {
    log.info(
      { port: e.API_PORT, host: e.API_HOST, env: e.NODE_ENV },
      "tfn-api listening"
    );
  });
  const shutdown = async (signal) => {
    log.info({ signal }, "shutting down");
    server.close(() => log.info("http server closed"));
    try {
      await disconnectDatabase();
    } catch (error) {
      log.error({ err: error }, "failed to disconnect prisma");
    }
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    log.error({ err: reason }, "unhandled promise rejection");
  });
  process.on("uncaughtException", (error) => {
    log.fatal({ err: error }, "uncaught exception \u2014 exiting");
    process.exit(1);
  });
}
void main();
//# sourceMappingURL=index.js.map
