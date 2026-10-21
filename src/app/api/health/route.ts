import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/** Uptime check: confirms the app and database respond. */
export async function GET() {
  try {
    await prisma.storeConfig.count();
    return NextResponse.json({ ok: true, time: new Date().toISOString() });
  } catch (e) {
    console.error("health check failed", e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
