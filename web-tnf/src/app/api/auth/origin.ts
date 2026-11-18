import "server-only";

/**
 * Exact configured origin only; never trust a client-supplied Host suffix.
 *
 * Development escape hatch: `.env` sengaja memakai `APP_URL=https://tfn.pimpom.id` supaya cookie
 * dan probe perilakunya seperti produksi. Konsekuensinya membuka `http://localhost:3000` lalu
 * login akan ditolak 403. Karena itu origin loopback diterima **hanya ketika NODE_ENV=development**
 * — di produksi cabang ini tidak pernah aktif, sehingga CSRF tidak dilonggarkan.
 */
function isLocalDevOrigin(origin: string): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function hasValidAuthOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    const expected = new URL(process.env.APP_URL || "http://localhost:3000").origin;
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const allowed =
      origin === expected ||
      isLocalDevOrigin(origin) ||
      (Boolean(host) && (origin === `http://${host}` || origin === `https://${host}`));
    return Boolean(allowed && request.headers.get("sec-fetch-site") !== "cross-site");
  } catch {
    return false;
  }
}
