import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { resetEnvCache } from "../src/config/env.js";

const app = createApp({ checkDb: async () => {}, openApiEnabled: true });

describe("dokumentasi API", () => {
  it("/api/openapi.json mengembalikan dokumen OpenAPI 3.1", async () => {
    const res = await request(app).get("/api/openapi.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\.1/);
    expect(res.body.info.title).toBe("TFN API");
    expect(Object.keys(res.body.paths)).toContain("/health");
    expect(Object.keys(res.body.paths)).toContain("/health/ready");
  });

  it("docs aktif secara default ketika OPENAPI_ENABLED tidak diset", async () => {
    // Regresi: parser bool pernah mengubah undefined → false sehingga docs mati
    // tanpa peringatan di runtime (test lama hanya menguji jalur explicit=true).
    delete process.env.OPENAPI_ENABLED;
    resetEnvCache();
    const defaultApp = createApp({ checkDb: async () => {} });
    const res = await request(defaultApp).get("/api/openapi.json");
    expect(res.status).toBe(200);
  });

  it("/api/docs menyajikan UI Swagger", async () => {
    const res = await request(app).get("/api/docs/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger");
  });

  it("/api/v1/meta mengembalikan metadata service", async () => {
    const res = await request(app).get("/api/v1/meta");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ service: "tfn-api", status: "skeleton" });
    expect(Array.isArray(res.body.modules)).toBe(true);
  });
});
