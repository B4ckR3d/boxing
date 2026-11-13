import "server-only";

/** Exact configured origin only; never trust a client-supplied Host suffix. */
export function hasValidAuthOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    const expected = new URL(process.env.APP_URL || "http://localhost:3000").origin;
    return origin === expected && request.headers.get("sec-fetch-site") !== "cross-site";
  } catch {
    return false;
  }
}
