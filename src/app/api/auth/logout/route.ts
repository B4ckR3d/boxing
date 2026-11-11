import { NextResponse } from "next/server";
import { destroySession } from "@/server/services/auth.service";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/auth/logout] Error:", err);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}

