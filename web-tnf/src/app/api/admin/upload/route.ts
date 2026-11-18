import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission, AuthenticationError, AuthorizationError } from "@/lib/permissions/guard";
import { verifyRequestOrigin } from "@/lib/security/csrf";
import { env } from "@/lib/env";

const ALLOWED_FOLDERS = new Set([
  "hero",
  "events",
  "fighters",
  "belts",
  "tournaments",
  "sponsors",
  "general",
]);

interface DetectedImage {
  mimeType: string;
  ext: string;
}

/** Validasi magic bytes agar file non-gambar / SVG berbahaya tidak bisa lolos lewat ekstensi palsu. */
function detectImageSignature(buf: Buffer): DetectedImage | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mimeType: "image/jpeg", ext: "jpg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mimeType: "image/png", ext: "png" };
  }
  // GIF: GIF87a / GIF89a
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { mimeType: "image/gif", ext: "gif" };
  }
  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mimeType: "image/webp", ext: "webp" };
  }
  // AVIF: ....ftypavif or ....ftypavis
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis" || brand === "mif1") {
      return { mimeType: "image/avif", ext: "avif" };
    }
  }

  return null;
}

function sanitizeOriginalName(name: string, fallbackExt: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
  return cleaned || `upload.${fallbackExt}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyRequestOrigin())) {
      return NextResponse.json({ ok: false, error: "Invalid request origin" }, { status: 403 });
    }

    const user = await requireAnyPermission([
      "content.manage",
      "events.manage",
      "fighters.create",
      "fighters.update",
      "belts.manage",
      "tournaments.manage",
      "rankings.manage",
    ]);

    const formData = await request.formData();
    const file = formData.get("file");
    const rawFolder = String(formData.get("folder") || "general").trim().toLowerCase();
    const folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : "general";

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "File gambar tidak ditemukan" }, { status: 400 });
    }

    const maxBytes = Math.round(env().UPLOAD_MAX_IMAGE_MB * 1024 * 1024);
    if (file.size === 0) {
      return NextResponse.json({ ok: false, error: "File kosong" }, { status: 400 });
    }
    if (file.size > maxBytes) {
      return NextResponse.json(
        { ok: false, error: `Ukuran file melebihi batas maksimal (${env().UPLOAD_MAX_IMAGE_MB} MB)` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectImageSignature(buffer);
    if (!detected) {
      return NextResponse.json(
        { ok: false, error: "Format tidak didukung. Gunakan file JPG, PNG, WebP, GIF, atau AVIF." },
        { status: 400 },
      );
    }

    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    const randomId = crypto.randomBytes(12).toString("hex");
    const filename = `${Date.now()}-${randomId}.${detected.ext}`;
    const storageKey = `uploads/${folder}/${filename}`;

    const targetDir = path.resolve(process.cwd(), "storage", "uploads", folder);
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, filename), buffer);

    const publicUrl = `/api/uploads/${folder}/${filename}`;
    const originalName = sanitizeOriginalName(file.name, detected.ext);

    const asset = await prisma.mediaAsset.create({
      data: {
        storageKey,
        url: publicUrl,
        kind: "IMAGE",
        mimeType: detected.mimeType,
        sizeBytes: buffer.byteLength,
        originalName,
        checksum,
        uploadedById: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      id: asset.id,
      url: asset.url,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
    });
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    console.error("[api/admin/upload] error:", err);
    return NextResponse.json(
      { ok: false, error: "Gagal mengunggah gambar. Silakan coba lagi." },
      { status: 500 },
    );
  }
}
