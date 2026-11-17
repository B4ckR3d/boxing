import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, ForbiddenError, ValidationError } from "../src/lib/errors.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { requestContext } from "../src/middleware/request-context.js";

function testApp(handler: express.RequestHandler) {
  const app = express();
  app.use(requestContext);
  app.get("/boom", handler);
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("memetakan AppError ke status & code-nya", async () => {
    const res = await request(testApp(() => {
      throw new ForbiddenError("Tidak boleh");
    })).get("/boom");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: "FORBIDDEN", message: "Tidak boleh" });
  });

  it("menyertakan details bila ada", async () => {
    const res = await request(testApp(() => {
      throw new ValidationError("Field wajib", [{ path: "name" }]);
    })).get("/boom");

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([{ path: "name" }]);
  });

  it("ZodError → 422 VALIDATION_ERROR dengan daftar issue", async () => {
    const res = await request(testApp(() => {
      z.object({ name: z.string() }).parse({});
    })).get("/boom");

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([{ path: "name", message: expect.any(String) }]);
  });

  it("error tak dikenal → 500 tanpa membocorkan pesan internal", async () => {
    const res = await request(testApp(() => {
      throw new Error("password=super-secret di query");
    })).get("/boom");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("super-secret");
  });

  it("AppError 5xx tidak membocorkan pesan", async () => {
    const res = await request(testApp(() => {
      throw new AppError(500, "INTERNAL_ERROR", "detail internal: token abc", { expose: false });
    })).get("/boom");

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("token abc");
  });
});
