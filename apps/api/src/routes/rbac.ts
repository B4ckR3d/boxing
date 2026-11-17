/**
 * Router RBAC di `apps/api` (Langkah F lanjutan).
 *
 * Otoritas role/permission/user pindah dari proses Next ke sini. Sebelumnya `apps/web` memanggil
 * `rbac.service` langsung dengan Prisma-nya sendiri, artinya aturan bisnis berjalan di proses yang
 * melayani HTML — dan proses lain (worker, CLI, integrasi) tidak bisa memakainya.
 *
 * Semua aturan tetap di `@tfn/auth` (`createRbacService`): four-eyes untuk role sensitif, proteksi
 * super-admin terakhir, pencabutan sesi saat akun dinonaktifkan. Router ini hanya transport:
 * validasi origin, sesi+permission, envelope `{ data }` / `{ error: { code, message, requestId } }`
 * (ADR-010), dan pemetaan error domain ke HTTP.
 *
 * Permission per endpoint sengaja berbeda — bukan satu gerbang global:
 *   - role & role-request  → `roles.manage`
 *   - user & pemberian role → `users.manage`
 * Kalau keduanya disamakan, pemegang `users.manage` bisa menaikkan hak akses lewat role sensitif.
 */
import { Router, type Request } from "express";
import { z } from "zod";
import { createRbacService, RbacError } from "@tfn/auth/rbac-service";
import type { PermissionKey } from "@tfn/auth/catalog";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { logAudit, withAuditContext } from "../lib/audit.js";
import { AppError } from "../lib/errors.js";
import { originAllowed, requirePermission } from "../lib/require-permission.js";

const rbac = createRbacService({ db: prisma, audit: (event) => logAudit(event) });

/** Error domain + Zod dipetakan ke envelope kanonik; sisanya dibiarkan ke error handler global. */
function toAppError(error: unknown): unknown {
  if (error instanceof RbacError) {
    return new AppError(400, "RBAC_ERROR", error.message);
  }
  if (error instanceof z.ZodError) {
    return new AppError(400, "VALIDATION_ERROR", "Data tidak valid.", {
      details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return error;
}

/** Semua mutasi wajib lolos pemeriksaan origin, sama seperti `PUT /api/settings`. */
function assertOrigin(req: Request): void {
  if (!originAllowed(req, env().APP_URL)) {
    throw new AppError(403, "INVALID_ORIGIN", "Invalid request origin");
  }
}

export function createRbacRouter(): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // Roles
  // -------------------------------------------------------------------------

  /** GET /api/rbac/roles — daftar role + jumlah pemegang + permission-nya. */
  router.get("/roles", async (req, res, next) => {
    try {
      await requirePermission(req, res, "roles.manage");
      res.json({ data: await rbac.listRolesDetailed() });
    } catch (error) {
      next(toAppError(error));
    }
  });

  router.post("/roles", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "roles.manage");
      const created = await withAuditContext(req, () => rbac.createRole(user.id, req.body));
      res.status(201).json({ data: created });
    } catch (error) {
      next(toAppError(error));
    }
  });

  router.put("/roles/:roleId", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "roles.manage");
      await withAuditContext(req, () =>
        rbac.updateRole(user.id, { ...(req.body as object), roleId: req.params.roleId }),
      );
      res.json({ data: { ok: true } });
    } catch (error) {
      next(toAppError(error));
    }
  });

  router.put("/roles/:roleId/permissions", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "roles.manage");
      await withAuditContext(req, () =>
        rbac.updateRolePermissions(user.id, {
          ...(req.body as object),
          roleId: req.params.roleId,
        }),
      );
      res.json({ data: { ok: true } });
    } catch (error) {
      next(toAppError(error));
    }
  });

  router.delete("/roles/:roleId", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "roles.manage");
      await withAuditContext(req, () => rbac.deleteRole(user.id, req.params.roleId));
      res.json({ data: { ok: true } });
    } catch (error) {
      next(toAppError(error));
    }
  });

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------

  /** GET /api/rbac/users — daftar user + role-nya (maks 200, urut waktu dibuat). */
  router.get("/users", async (req, res, next) => {
    try {
      await requirePermission(req, res, "users.manage");
      res.json({ data: await rbac.listUsersDetailed() });
    } catch (error) {
      next(toAppError(error));
    }
  });

  /** PUT /api/rbac/users/:userId/active — aktif/nonaktif. Nonaktif mencabut semua sesi hidup. */
  router.put("/users/:userId/active", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "users.manage");
      await withAuditContext(req, () =>
        rbac.setUserActive(user.id, { ...(req.body as object), userId: req.params.userId }),
      );
      res.json({ data: { ok: true } });
    } catch (error) {
      next(toAppError(error));
    }
  });

  /**
   * POST /api/rbac/user-roles/grant — beri role. Role sensitif TIDAK langsung diberikan;
   * service membuat `RoleRequest` PENDING yang harus disetujui orang lain (four-eyes).
   */
  router.post("/user-roles/grant", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "users.manage");
      const result = await withAuditContext(req, () => rbac.grantRole(user.id, req.body));
      res.status(201).json({ data: result });
    } catch (error) {
      next(toAppError(error));
    }
  });

  router.post("/user-roles/revoke", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "users.manage");
      const result = await withAuditContext(req, () => rbac.revokeRole(user.id, req.body));
      res.json({ data: result });
    } catch (error) {
      next(toAppError(error));
    }
  });

  // -------------------------------------------------------------------------
  // Role requests (four-eyes)
  // -------------------------------------------------------------------------

  router.get("/role-requests", async (req, res, next) => {
    try {
      await requirePermission(req, res, "roles.manage");
      res.json({ data: await rbac.listPendingRoleRequests() });
    } catch (error) {
      next(toAppError(error));
    }
  });

  /**
   * POST /api/rbac/role-requests/:requestId/review — setujui/tolak.
   * Penjaga four-eyes ada di paket: reviewer harus berbeda dari pemohon.
   */
  router.post("/role-requests/:requestId/review", async (req, res, next) => {
    try {
      assertOrigin(req);
      const user = await requirePermission(req, res, "roles.manage");
      await withAuditContext(req, () =>
        rbac.reviewRoleRequest(user.id, {
          ...(req.body as object),
          requestId: req.params.requestId,
        }),
      );
      res.json({ data: { ok: true } });
    } catch (error) {
      next(toAppError(error));
    }
  });

  return router;
}

/** Diekspor untuk dokumentasi OpenAPI & test: daftar izin yang dijaga tiap rute. */
export const RBAC_ROUTE_PERMISSIONS: Record<string, PermissionKey> = {
  "GET /roles": "roles.manage",
  "POST /roles": "roles.manage",
  "PUT /roles/:roleId": "roles.manage",
  "PUT /roles/:roleId/permissions": "roles.manage",
  "DELETE /roles/:roleId": "roles.manage",
  "GET /users": "users.manage",
  "PUT /users/:userId/active": "users.manage",
  "POST /user-roles/grant": "users.manage",
  "POST /user-roles/revoke": "users.manage",
  "GET /role-requests": "roles.manage",
  "POST /role-requests/:requestId/review": "roles.manage",
};
