import { NextRequest, NextResponse } from "next/server";
import { apiFetch, ApiClientError } from "@/lib/api/client";

/**
 * BFF status pesanan (Langkah C).
 *
 * Hanya meneruskan ke `apps/api`. Capability token tetap satu-satunya kredensial — route ini
 * tidak menambah atau mengurangi pemeriksaan, supaya tidak ada dua tempat yang bisa berbeda
 * pendapat soal siapa yang boleh melihat pesanan.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token diperlukan" }, { status: 401 });

  try {
    return NextResponse.json(
      await apiFetch(`/api/ticketing/orders/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(token)}`),
    );
  } catch (error) {
    if (error instanceof ApiClientError) {
      // Pesanan tidak ada dan token salah sengaja dijawab sama: jangan beri oracle untuk menebak.
      const status = error.status === 401 || error.status === 404 ? 404 : error.status;
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status });
    }
    return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  }
}
