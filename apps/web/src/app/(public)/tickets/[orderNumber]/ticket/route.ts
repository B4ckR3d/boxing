/**
 * GET /tickets/[orderNumber]/ticket?token=<capability-token>
 *
 * Streams the entry PDF for a CONFIRMED or already-USED order. The capability token is the only
 * credential — same model as the status page, so a leaked order number alone reveals nothing.
 * USED is allowed on purpose: after the gate scan the buyer may still want a copy, and re-downloading
 * cannot admit anyone twice because check-in is driven by the database status, not by the PDF.
 *
 * Status codes: 401 missing token, 404 wrong order/token, 409 order not confirmed, 429 (none: the
 * route is read-only and cheap enough for the single-instance deployment).
 */
import { getTicketArtifact, TicketingError } from "@/server/services/ticketing.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";

  if (!token) {
    return new Response("Token akses wajib diisi.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  try {
    const { filename, buffer } = await getTicketArtifact(orderNumber, token);
    return new Response(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof TicketingError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "INVALID_STATE" ? 409 : 400;
      return new Response(error.message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    }
    return new Response("Gagal membuat tiket.", { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
