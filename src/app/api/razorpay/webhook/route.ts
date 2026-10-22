import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/server/razorpay";
import { handlePaymentWebhook } from "@/server/payments";

/**
 * Razorpay webhook (Dashboard > Webhooks): URL https://<your-site>/api/razorpay/webhook,
 * events payment.authorized and payment.captured, secret = RAZORPAY_WEBHOOK_SECRET.
 * Places the order when a customer paid but closed the app before returning.
 */
export async function POST(req: Request) {
  // Razorpay's events are a few KB; refuse anything big before reading it.
  if (Number(req.headers.get("content-length") ?? 0) > 100_000) return NextResponse.json({ ok: false }, { status: 413 });
  const raw = await req.text();
  if (raw.length > 100_000) return NextResponse.json({ ok: false }, { status: 413 });
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let event: { event?: string; payload?: { payment?: { entity?: { id: string; order_id: string | null } } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const payment = event.payload?.payment?.entity;
  if ((event.event === "payment.captured" || event.event === "payment.authorized") && payment) {
    try {
      const r = await handlePaymentWebhook(payment);
      return NextResponse.json({ ok: true, result: r ? (r.ok ? "order" : "not placed") : "ignored" });
    } catch (e) {
      console.error("razorpay webhook failed", e);
      // A 500 makes Razorpay retry later.
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, result: "ignored" });
}
