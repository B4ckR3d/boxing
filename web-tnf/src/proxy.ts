import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 Proxy Convention (replaces middleware.ts).
 * Handles network boundaries, security headers, CSP nonce generation, and IP rate-limiting.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---------------------------------------------------------------------------------------------
  // Alihan tiket → aplikasi `ticket-tnf` (18 Nov 2026).
  //
  // web-tnf tidak lagi menjual tiket: seluruh alur tiket (pesan → bayar → tiket PDF → check-in
  // gate) hidup di aplikasi terpisah. Redirect dipertahankan di layer proxy supaya URL lama yang
  // mungkin sudah dibagikan (WA/IG, poster QR, bookmark admin) tetap sampai ke tempat yang benar,
  // bukan 404.
  //
  // Hanya path yang sudah dipetakan yang dialihkan; `/tickets/*` lain jatuh ke beranda ticketing.
  // ---------------------------------------------------------------------------------------------
  const TICKETING = (process.env.TICKETING_URL ?? "https://tiket.pimpom.id").replace(/\/+$/, "");
  const ticketRedirect = ticketDestination(pathname);
  if (ticketRedirect) {
    return NextResponse.redirect(`${TICKETING}${ticketRedirect}`, 308);
  }

  // Skip static assets, favicon, and next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  // Content Security Policy
  // Notes:
  // - 'strict-dynamic' propagates trust to dynamically-loaded scripts (required for Next.js chunks).
  //   When strict-dynamic is present, browsers ignore 'self' and 'unsafe-inline' for external scripts.
  //   Next.js automatically injects the nonce onto its own <script> tags during SSR.
  // - 'unsafe-inline' is included as a fallback for older browsers that don't support nonces —
  //   it is ignored by nonce-aware browsers, so it doesn't weaken security on modern clients.
  // - In dev, 'unsafe-eval' is required by React for error stack reconstruction.
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://*;
    font-src 'self' data: https://fonts.gstatic.com;
    media-src 'self' blob: data: https://*;
    connect-src 'self' https://*;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Enterprise Security Headers
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  return response;
}

/**
 * Peta URL tiket lama (web-tnf) → path padanannya di `ticket-tnf`, atau `null` bila bukan rute tiket.
 *
 * | web-tnf lama                    | ticket-tnf                  |
 * |---------------------------------|-----------------------------|
 * | `/tickets`                      | `/` (daftar event)          |
 * | `/tickets/status`               | `/my-tickets`               |
 * | `/tickets/<order>`              | `/orders/<order>`           |
 * | `/tickets/<order>/ticket` (PDF) | `/api/tickets/<order>/pdf`  |
 * | `/admin/ticketing`              | `/admin/orders`             |
 * | `/admin/ticketing/scan`         | `/admin/scan`               |
 */
function ticketDestination(pathname: string): string | null {
  if (pathname === "/tickets" || pathname === "/tickets/") return "/";
  if (pathname === "/tickets/status") return "/my-tickets";

  const pdf = /^\/tickets\/([^/]+)\/ticket$/.exec(pathname);
  if (pdf) return `/api/tickets/${pdf[1]}/pdf`;

  const order = /^\/tickets\/([^/]+)$/.exec(pathname);
  if (order) return `/orders/${order[1]}`;

  if (pathname.startsWith("/tickets/")) return "/";

  if (pathname === "/admin/ticketing/scan") return "/admin/scan";
  if (pathname === "/admin/ticketing" || pathname.startsWith("/admin/ticketing/")) return "/admin/orders";

  return null;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

