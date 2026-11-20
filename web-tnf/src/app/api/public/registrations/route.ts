import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/security/rate-limit";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { registrationInputSchema } from "@/lib/validation/registration";
import {
  createFighterRegistration,
  RegistrationFileError,
} from "@/server/services/fighter-registration.service";

export const runtime = "nodejs";

/**
 * Pendaftaran fighter dari halaman publik /daftar-fighter.
 *
 * Multipart (karena ada 2 lampiran). Anti-spam:
 *  - honeypot field `website` harus kosong
 *  - rate limit 5 kiriman / IP / jam
 *  - validasi origin (same-origin)
 *  - semua lampiran divalidasi dari magic bytes, bukan ekstensi
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyRequestOrigin())) {
      return NextResponse.json({ ok: false, error: "Origin permintaan tidak valid" }, { status: 403 });
    }

    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";

    const limit = rateLimit("registrationSubmit", ip);
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti." },
        { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
      );
    }

    const form = await request.formData();

    // Honeypot: field tersembunyi yang hanya diisi bot.
    if (String(form.get("website") ?? "").trim().length > 0) {
      return NextResponse.json({ ok: false, error: "Permintaan ditolak" }, { status: 400 });
    }

    const raw = {
      fullName: form.get("fullName"),
      ringName: form.get("ringName"),
      address: form.get("address"),
      age: form.get("age"),
      divisionLabel: form.get("divisionLabel"),
      rules: form.get("rules"),
      competitionClass: form.get("competitionClass"),
      bpjsStatus: form.get("bpjsStatus"),
      socialUrl: form.get("socialUrl") ?? undefined,
      instagramUrl: form.get("instagramUrl") ?? undefined,
      tiktokUrl: form.get("tiktokUrl") ?? undefined,
      facebookUrl: form.get("facebookUrl") ?? undefined,
      xUrl: form.get("xUrl") ?? undefined,
      consentAccepted: form.get("consentAccepted"),
    };

    const parsed = registrationInputSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return NextResponse.json({ ok: false, error: "Data belum lengkap atau tidak valid", fieldErrors }, { status: 422 });
    }

    const paymentProof = form.get("paymentProof");
    const idDocument = form.get("idDocument");

    const { registration, sheetSynced, sheetError } = await createFighterRegistration({
      input: parsed.data,
      paymentProof: paymentProof instanceof File ? paymentProof : null,
      idDocument: idDocument instanceof File && idDocument.size > 0 ? idDocument : null,
      ipAddress: ip === "unknown" ? null : ip,
      userAgent: h.get("user-agent"),
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: registration.id,
          code: registration.code,
          ringName: registration.ringName,
          divisionLabel: registration.divisionLabel,
          status: registration.status,
          createdAt: registration.createdAt,
          sheetSynced,
          // Jangan bocorkan detail internal ke publik; cukup penanda untuk admin.
          sheetPending: !sheetSynced,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof RegistrationFileError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("[api/public/registrations] error:", err);
    return NextResponse.json(
      { ok: false, error: "Pendaftaran gagal diproses. Silakan coba lagi atau hubungi panitia." },
      { status: 500 },
    );
  }
}
