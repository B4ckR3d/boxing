import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, AuthenticationError, AuthorizationError } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import {
  confirmFighterRegistration,
  getFighterRegistration,
  rejectFighterRegistration,
  syncRegistrationToSheet,
} from "@/server/services/fighter-registration.service";

export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum(["confirm", "reject", "resync"]),
  reason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("registrations.read");
    const { id } = await context.params;
    const registration = await getFighterRegistration(id);
    if (!registration) return NextResponse.json({ ok: false, error: "Tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ ok: true, data: registration });
  } catch (err) {
    if (err instanceof AuthenticationError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    if (err instanceof AuthorizationError) return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    console.error("[api/admin/registrations/:id] GET:", err);
    return NextResponse.json({ ok: false, error: "Gagal memuat data" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await verifyRequestOrigin())) {
      return NextResponse.json({ ok: false, error: "Origin permintaan tidak valid" }, { status: 403 });
    }

    const user = await requirePermission("registrations.confirm");
    const { id } = await context.params;

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Aksi tidak valid" }, { status: 422 });
    }

    const actor = { id: user.id, name: user.name };

    if (parsed.data.action === "confirm") {
      const registration = await confirmFighterRegistration(id, actor, parsed.data.notes ?? null);
      return NextResponse.json({ ok: true, data: { status: registration.status, code: registration.code } });
    }

    if (parsed.data.action === "reject") {
      const reason = parsed.data.reason?.trim();
      if (!reason || reason.length < 3) {
        return NextResponse.json({ ok: false, error: "Alasan penolakan wajib diisi" }, { status: 422 });
      }
      const registration = await rejectFighterRegistration(id, actor, reason);
      return NextResponse.json({ ok: true, data: { status: registration.status, code: registration.code } });
    }

    // resync: tulis ulang ke Google Sheets (dipakai saat sheetSyncError terisi)
    const result = await syncRegistrationToSheet(id);
    return NextResponse.json({ ok: true, data: { rowNumber: result.rowNumber } });
  } catch (err) {
    if (err instanceof AuthenticationError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    if (err instanceof AuthorizationError) return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    console.error("[api/admin/registrations/:id] POST:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message || "Gagal memproses aksi" },
      { status: 500 },
    );
  }
}
