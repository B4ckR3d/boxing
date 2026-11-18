import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  if (!segments || segments.length === 0 || segments.length > 4) {
    return new NextResponse("Not Found", { status: 404 });
  }

  for (const seg of segments) {
    if (!seg || seg === "." || seg === ".." || !SAFE_SEGMENT.test(seg)) {
      return new NextResponse("Not Found", { status: 404 });
    }
  }

  const uploadsRoot = path.resolve(process.cwd(), "storage", "uploads");
  const resolved = path.resolve(uploadsRoot, ...segments);
  if (!resolved.startsWith(`${uploadsRoot}${path.sep}`)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_BY_EXT[ext];
  if (!contentType) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const fileBuffer = await readFile(resolved);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileBuffer.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
