import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

/**
 * Kontrak OpenAPI 3.1 — sumber dokumentasi API yang dipakai bersama FE/admin/POS.
 *
 * Ditulis sebagai objek TypeScript (bukan YAML) supaya ikut ter-typecheck dan tidak
 * bisa "hanyut" dari kode tanpa ketahuan.
 */
export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "TFN API",
    version: "0.1.0",
    description:
      "API resmi TFN (Express + TypeScript). Skeleton Phase 1: health, meta, dan standar error. " +
      "Modul bisnis dipindah bertahap dari app Next.js (ADR-001).",
  },
  servers: [{ url: "/", description: "Same-origin (di belakang reverse proxy)" }],
  tags: [
    { name: "Health", description: "Liveness & readiness probe" },
    { name: "Meta", description: "Informasi service" },
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
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
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
                      required: ["database"],
                    },
                  },
                  required: ["status", "checks"],
                },
              },
            },
          },
          "503": {
            description: "Dependency tidak tersedia",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
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
                    modules: { type: "array", items: { type: "string" } },
                  },
                  required: ["service", "version", "status", "modules"],
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", const: "ok" },
          service: { type: "string" },
          uptimeSeconds: { type: "integer", minimum: 0 },
        },
        required: ["status", "service", "uptimeSeconds"],
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
              requestId: { type: "string" },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
    },
  },
} as const;

const SWAGGER_OPTIONS = {
  customSiteTitle: "TFN API — Docs",
  swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
};

/** Mount `/api/openapi.json` + UI di `/api/docs`. */
export function mountApiDocs(app: Express): void {
  app.get("/api/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, SWAGGER_OPTIONS));
}
