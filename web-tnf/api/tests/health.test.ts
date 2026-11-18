import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const OK_CHECK = async (): Promise<void> => {};

function app(checkDb = OK_CHECK) {
  return createApp({ checkDb, openApiEnabled: false });
}

describe("GET /health", () => {
  it("mengembalikan 200 tanpa menyentuh database", async () => {
    const checkDb = vi.fn(async () => {});
    const res = await request(app(checkDb)).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", service: "tfn-api" });
    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(checkDb).not.toHaveBeenCalled();
  });

  it("menyertakan header x-request-id (dibuat bila tidak dikirim klien)", async () => {
    const res = await request(app()).get("/health");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("memakai x-request-id dari klien bila formatnya wajar", async () => {
    const res = await request(app()).get("/health").set("x-request-id", "req-abc-12345");
    expect(res.headers["x-request-id"]).toBe("req-abc-12345");
  });

  it("mengabaikan x-request-id yang tidak wajar", async () => {
    const res = await request(app()).get("/health").set("x-request-id", "a".repeat(200));
    expect(res.headers["x-request-id"]).not.toBe("a".repeat(200));
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("GET /health/ready", () => {
  it("200 ready ketika database bisa dijangkau", async () => {
    const res = await request(app(async () => {})).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", checks: { database: "up" } });
  });

  it("503 dengan bentuk error standar ketika database gagal", async () => {
    const res = await request(app(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:3307");
    })).get("/health/ready");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(res.body.error.details).toEqual({ database: "down" });
    // Detail internal tidak boleh bocor ke klien.
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
  });
});

describe("route tidak dikenal", () => {
  it("404 dengan bentuk error standar", async () => {
    const res = await request(app()).get("/tidak-ada");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.requestId).toBe(res.headers["x-request-id"]);
  });
});
