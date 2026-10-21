import "server-only";
import { prisma } from "./db";
import { logAudit } from "./audit";
import { placeOrder, quoteOrder } from "./orders";
import {
  capturePayment,
  createRazorpayOrder,
  fetchPayment,
  razorpayEnabled,
  razorpayKeyId,
  refundPayment,
  verifyCheckoutSignature,
  type RzpPayment,
} from "./razorpay";
import type { placeOrderSchema } from "@/lib/validation";
import type { z } from "zod";

type OrderInput = z.output<typeof placeOrderSchema>;
/** What is stored with an attempt: the order input plus the price that was charged. */
type Payload = { input: OrderInput; price: number; fee: number };

export type StartResult =
  | { ok: true; keyId: string; razorpayOrderId: string; amount: number; currency: "INR"; prefill: { name: string; contact: string; email: string } }
  | { ok: false; error: string; field?: string };

/**
 * Step 1 of paying online: re-check and price the order on the server, then
 * open a Razorpay order for exactly that amount. Nothing is placed yet.
 */
export async function startOnlinePayment(userId: string, input: OrderInput, who: { name: string; phone: string; email: string }): Promise<StartResult> {
  if (!razorpayEnabled()) return { ok: false, field: "payment", error: "Online payment is not available right now. Choose cash on delivery." };
  const q = await quoteOrder(input);
  if (!q.ok) return q;
  const amount = q.total * 100;
  const payload: Payload = { input, price: q.price, fee: q.fee };
  const attempt = await prisma.paymentAttempt.create({ data: { userId, amount, payloadJson: JSON.stringify(payload) } });
  try {
    const order = await createRazorpayOrder(amount, attempt.id, { attempt: attempt.id, trays: String(input.trays), date: input.date });
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { razorpayOrderId: order.id } });
    return {
      ok: true,
      keyId: razorpayKeyId(),
      razorpayOrderId: order.id,
      amount,
      currency: "INR",
      prefill: { name: who.name, contact: who.phone ? `+91${who.phone}` : "", email: who.email },
    };
  } catch (e) {
    console.error("Razorpay order create failed", e);
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "failed", error: "Could not start payment" } });
    return { ok: false, error: "We couldn't start the payment. Check your connection and try again, or choose cash on delivery." };
  }
}

export type FinishResult = { ok: true; orderId: string } | { ok: false; error: string; refunded?: boolean };

/** Make sure the payment really is ours, for the right amount, and captured. */
async function confirmPayment(paymentId: string, razorpayOrderId: string, amount: number): Promise<{ ok: true; payment: RzpPayment } | { ok: false; error: string }> {
  let p = await fetchPayment(paymentId);
  if (p.order_id !== razorpayOrderId) return { ok: false, error: "This payment belongs to a different order." };
  if (p.amount !== amount || p.currency !== "INR") return { ok: false, error: "The amount paid doesn't match the order." };
  if (p.status === "authorized") {
    // The webhook and the browser can race to capture; if the other one won, the payment is captured anyway.
    p = await capturePayment(paymentId, amount).catch(() => fetchPayment(paymentId));
  }
  if (p.status !== "captured") return { ok: false, error: p.error_description || "The payment didn't go through." };
  return { ok: true, payment: p };
}

/**
 * Turn a confirmed payment into an order. Used by the browser (after Razorpay
 * Checkout) and by the webhook (if the customer closed the app straight after
 * paying); whichever comes second gets the same order back. If the order can't
 * be placed any more (sold out in the meantime), the payment is refunded.
 */
async function finish(attemptId: string, paymentId: string): Promise<FinishResult> {
  const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  if (attempt.orderId) return { ok: true, orderId: attempt.orderId };
  if (attempt.status === "refunded") return { ok: false, refunded: true, error: attempt.error ?? "This payment was refunded." };
  if (!attempt.razorpayOrderId) return { ok: false, error: "This payment wasn't started properly." };

  const confirmed = await confirmPayment(paymentId, attempt.razorpayOrderId, attempt.amount).catch((e: Error) => ({ ok: false as const, error: e.message }));
  if (!confirmed.ok) {
    await prisma.paymentAttempt.update({ where: { id: attemptId }, data: { status: "failed", razorpayPaymentId: paymentId, error: confirmed.error } });
    return { ok: false, error: confirmed.error };
  }

  const { input, price, fee } = JSON.parse(attempt.payloadJson) as Payload;
  const placed = await placeOrder(input, attempt.userId, { attemptId, razorpayOrderId: attempt.razorpayOrderId, razorpayPaymentId: paymentId, price, fee });
  if (placed.ok) return { ok: true, orderId: placed.order.id };

  // Paid, but the order can't go through any more: give the money back.
  try {
    await refundPayment(paymentId, attempt.amount, { attempt: attemptId, reason: "order could not be placed" });
    const error = `${placed.error} Your payment of ₹${attempt.amount / 100} has been refunded.`;
    await prisma.paymentAttempt.update({ where: { id: attemptId }, data: { status: "refunded", razorpayPaymentId: paymentId, error } });
    await logAudit("system", "Payment refunded", `₹${attempt.amount / 100}: order couldn't be placed (${placed.error})`);
    return { ok: false, refunded: true, error };
  } catch (e) {
    console.error("auto-refund failed", attemptId, e);
    const error = `${placed.error} We'll refund your payment of ₹${attempt.amount / 100} shortly.`;
    await prisma.paymentAttempt.update({ where: { id: attemptId }, data: { status: "failed", razorpayPaymentId: paymentId, error: "Refund pending: " + placed.error } });
    await logAudit("system", "REFUND NEEDED", `Payment ${paymentId} (₹${attempt.amount / 100}) was taken but the order failed and the automatic refund didn't go through. Refund it from the Razorpay dashboard.`);
    return { ok: false, refunded: true, error };
  }
}

/** Step 2 (browser): Razorpay Checkout returned a payment; verify its signature and place the order. */
export async function completeOnlinePayment(
  userId: string,
  r: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
): Promise<FinishResult> {
  const attempt = await prisma.paymentAttempt.findUnique({ where: { razorpayOrderId: r.razorpayOrderId } });
  if (!attempt || attempt.userId !== userId) return { ok: false, error: "We couldn't find this payment." };
  if (!verifyCheckoutSignature(r.razorpayOrderId, r.razorpayPaymentId, r.razorpaySignature)) {
    await prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "failed", error: "Signature check failed" } });
    return { ok: false, error: "We couldn't verify this payment." };
  }
  return finish(attempt.id, r.razorpayPaymentId);
}

/** The customer closed Razorpay or the payment failed: remember why (nothing was placed). */
export async function markPaymentFailed(userId: string, razorpayOrderId: string, reason: string): Promise<void> {
  await prisma.paymentAttempt.updateMany({
    where: { razorpayOrderId, userId, status: "created" },
    data: { status: "failed", error: reason.slice(0, 300) },
  });
}

/** Webhook: a payment was authorized or captured. Place the order if the browser didn't. */
export async function handlePaymentWebhook(payment: { id: string; order_id: string | null }): Promise<FinishResult | null> {
  if (!payment.order_id) return null;
  const attempt = await prisma.paymentAttempt.findUnique({ where: { razorpayOrderId: payment.order_id } });
  if (!attempt) return null;
  return finish(attempt.id, payment.id);
}
