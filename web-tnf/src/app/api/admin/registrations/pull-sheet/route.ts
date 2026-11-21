import { NextRequest, NextResponse } from "next/server";
import { requirePermission, AuthenticationError, AuthorizationError } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { pullRegistrationsFromSheet } from "@/server/services/fighter-registration.service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyRequestOrigin())) {
      return NextResponse.json({ ok: false, error: "Origin permintaan tidak valid" }, { status: 403 });
    }

    await requirePermission("registrations.read");

    const result = await pullRegistrationsFromSheet();
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    console.error("[api/admin/registrations/pull-sheet] POST:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message || "Gagal menarik data dari Google Sheets" },
      { status: 500 }
    );
  }
}
