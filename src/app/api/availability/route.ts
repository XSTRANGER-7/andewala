import { NextResponse } from "next/server";
import { getAvailability } from "@/server/orders";

export const dynamic = "force-dynamic";

/** Live price, stock and delivery windows. Used by the order form to refresh and handy for debugging. */
export async function GET() {
  const availability = await getAvailability();
  return NextResponse.json(availability, { headers: { "Cache-Control": "no-store" } });
}
