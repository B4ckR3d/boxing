import { NextResponse } from "next/server";
import { destroySession } from "@/server/services/auth.service";
import { hasValidAuthOrigin } from "../origin";

export async function POST(request: Request) {
  if (!hasValidAuthOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/auth/logout] Error:", err);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}

