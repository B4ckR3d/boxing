/**
 * GET /tickets/[orderNumber]/ticket?token=<capability-token>
 *
 * Streams the entry PDF for a CONFIRMED or already-USED order. The capability token is the only
 * credential — same model as the status page, so a leaked order number alone reveals nothing.
 * USED is allowed on purpose: after the gate scan the buyer may still want a copy, and re-downloading
 * cannot admit anyone twice because check-in is driven by the database status, not by the PDF.
 *
 * Langkah C: PDF kini dibuat di `apps/api` (`ticket-pdf.service` sudah pindah ke sana). Route ini
 * hanya meneruskan byte apa adanya — jangan sampai PDF melewati parser JSON.
 *
 * Status codes: 401 missing token, 404 wrong order/token, 409 order not confirmed.
 */
import { apiFetchBinary, ApiClientError } from "@/lib/api/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";

  if (!token) return textResponse("Token akses wajib diisi.", 401);

  try {
    const { bytes, contentType, filename } = await apiFetchBinary(
      `/api/ticketing/orders/${encodeURIComponent(orderNumber)}/ticket?token=${encodeURIComponent(token)}`,
    );

    return new Response(bytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...(filename ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof ApiClientError) {
      if (error.code === "NOT_FOUND") return textResponse("Pesanan tidak ditemukan", 404);
      if (error.code === "INVALID_STATE") return textResponse(error.message, 409);
      if (error.status === 401) return textResponse(error.message, 401);
      return textResponse(error.message, error.status >= 500 ? 500 : 400);
    }
    return textResponse("Gagal membuat tiket.", 500);
  }
}
