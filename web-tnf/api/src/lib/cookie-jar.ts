import type { Request, Response } from "express";
import type { SessionCookieJar, SessionCookieOptions } from "../../../src/lib/auth/session-cookie-jar";

/**
 * `SessionCookieJar` di atas Express `req`/`res`.
 *
 * Pasangan dari `apps/web/src/server/services/next-session-cookie-jar.ts`: service auth hanya
 * mengenal interface `SessionCookieJar`, jadi implementasi HTTP-nya bisa diganti tanpa menyentuh
 * logika bisnis. Tidak ada dependensi baru — cookie dibaca langsung dari header `Cookie`.
 */

/** Parsing minimal header `Cookie` (nama=nilai dipisah `; `). Nilai di-URL-decode bila valid. */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    const raw = part.slice(eq + 1).trim();
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // biarkan nilai mentah bila bukan URI-encoded
    }
    out[name] = value;
  }
  return out;
}

export function createExpressCookieJar(req: Request, res: Response): SessionCookieJar {
  let parsed: Record<string, string> | null = null;
  const readAll = () => {
    if (parsed === null) parsed = parseCookieHeader(req.headers.cookie);
    return parsed;
  };

  return {
    get: (name) => readAll()[name],
    set: (name, value, options: SessionCookieOptions) => {
      /**
       * Express mengartikan `maxAge` dalam **milidetik**, sedangkan kontrak `SessionCookieOptions`
       * memakai **detik** (sama seperti `next/headers` `cookies().set()`). Tanpa konversi ini,
       * sesi 12 jam menjadi 43 detik: 43200 dianggap ms sehingga `Expires` jatuh 43 detik kemudian.
       */
      const { maxAge, ...rest } = options;
      res.cookie(name, value, maxAge === undefined ? rest : { ...rest, maxAge: maxAge * 1000 });
    },
    delete: (name) => {
      res.clearCookie(name, { path: "/" });
    },
  };
}
