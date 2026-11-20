import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requirePermission, AuthenticationError, AuthorizationError } from "@/lib/permissions/guard";
import { getFighterRegistration, privateFilePath } from "@/server/services/fighter-registration.service";

export const runtime = "nodejs";

/**
 * Menyajikan lampiran privat pendaftaran (bukti transfer / KTP-KK).
 *
 * Hanya bisa diakses user dengan permission `registrations.read`. File TIDAK berada di
 * `storage/uploads` sehingga tidak pernah bisa diambil anonim lewat /api/uploads.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; kind: string }> },
) {
  try {
    await requirePermission("registrations.read");
    const { id, kind } = await context.params;

    if (kind !== "payment-proof" && kind !== "id-document") {
      return new NextResponse("Not Found", { status: 404 });
    }

    const registration = await getFighterRegistration(id);
    if (!registration) return new NextResponse("Not Found", { status: 404 });

    const relativePath =
      kind === "payment-proof" ? registration.paymentProofPath : registration.idDocumentPath;
    const mimeType = kind === "payment-proof" ? registration.paymentProofMime : registration.idDocumentMime;
    const originalName = kind === "payment-proof" ? registration.paymentProofName : registration.idDocumentName;

    if (!relativePath) return new NextResponse("Not Found", { status: 404 });

    const absolute = privateFilePath(relativePath);
    if (!absolute) return new NextResponse("Not Found", { status: 404 });

    const buffer = await readFile(absolute);
    const download = request.nextUrl.searchParams.get("download") === "1";
    const baseName = path.basename(originalName ?? path.basename(absolute)).replace(/[^\w.\- ]/g, "_");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "content-type": mimeType ?? "application/octet-stream",
        "content-length": String(buffer.byteLength),
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${baseName}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof AuthenticationError) return new NextResponse("Unauthorized", { status: 401 });
    if (err instanceof AuthorizationError) return new NextResponse("Forbidden", { status: 403 });
    console.error("[api/admin/registrations/:id/file/:kind]:", err);
    return new NextResponse("Server Error", { status: 500 });
  }
}
