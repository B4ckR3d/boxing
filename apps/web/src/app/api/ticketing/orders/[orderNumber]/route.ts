import { NextRequest, NextResponse } from "next/server";
import { getGuestOrder } from "@/server/services/ticketing.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token diperlukan" }, { status: 401 });
  try { return NextResponse.json(await getGuestOrder(orderNumber, token)); }
  catch { return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 }); }
}
