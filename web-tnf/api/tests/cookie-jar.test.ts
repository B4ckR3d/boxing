import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createExpressCookieJar } from "../src/lib/cookie-jar.js";

/**
 * Regresi untuk bug "sesi 43 detik".
 *
 * `SessionCookieOptions.maxAge` memakai satuan **detik** (kontrak `next/headers`), sementara
 * Express `res.cookie()` memakai **milidetik**. Sebelum diperbaiki, sesi 12 jam
 * (43200 detik) terkirim sebagai `Max-Age=43` karena 43200 dibaca sebagai ms.
 */
function appWithCookie(maxAge?: number) {
  const app = express();
  app.get("/set", (req, res) => {
    const jar = createExpressCookieJar(req, res);
    jar.set("bx_session", "token-abc", { httpOnly: true, path: "/", maxAge });
    res.status(204).end();
  });
  return app;
}

describe("createExpressCookieJar", () => {
  it("mengonversi maxAge detik ke milidetik (12 jam tetap 12 jam)", async () => {
    const res = await request(appWithCookie(43200)).get("/set");
    const cookie = res.headers["set-cookie"]?.[0] ?? "";

    expect(cookie).toContain("bx_session=token-abc");
    expect(cookie).toContain("Max-Age=43200");
    expect(cookie).toContain("HttpOnly");
  });

  it("tetap mengirim Max-Age kecil secara proporsional", async () => {
    const res = await request(appWithCookie(60)).get("/set");
    expect(res.headers["set-cookie"]?.[0] ?? "").toContain("Max-Age=60");
  });

  it("tidak menambahkan Max-Age bila opsi tidak diberikan (cookie sesi)", async () => {
    const res = await request(appWithCookie(undefined)).get("/set");
    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain("bx_session=token-abc");
    expect(cookie).not.toContain("Max-Age");
  });
});
