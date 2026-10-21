import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay (UPI, cards, netbanking, wallets) over its REST API.
 *
 * Set in .env (and on Vercel):
 *   RAZORPAY_KEY_ID        rzp_test_... or rzp_live_...  (Dashboard > Account & Settings > API keys)
 *   RAZORPAY_KEY_SECRET    the matching secret (never sent to the browser)
 *   RAZORPAY_WEBHOOK_SECRET  the secret you type when adding the webhook (Dashboard > Webhooks)
 *
 * Online payment only shows at checkout when the key id and secret are set.
 */
const keyId = () => process.env.RAZORPAY_KEY_ID ?? "";
const keySecret = () => process.env.RAZORPAY_KEY_SECRET ?? "";
/** Overridable for tests only. */
const base = () => (process.env.RAZORPAY_API_URL ?? "https://api.razorpay.com/v1").replace(/\/+$/, "");

export function razorpayEnabled(): boolean {
  return /^rzp_(test|live)_/.test(keyId()) && keySecret().length > 0;
}

export function razorpayKeyId(): string {
  return keyId();
}

export class RazorpayError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function api<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString("base64")}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  }).catch(() => null);
  if (!res) throw new RazorpayError("Couldn't reach Razorpay.", 0);
  const j = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new RazorpayError(j.error?.description ?? `Razorpay error ${res.status}`, res.status);
  return j;
}

export type RzpOrder = { id: string; amount: number; currency: string; receipt: string; status: string };
export type RzpPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  error_description?: string | null;
};

/** Create the Razorpay order the customer pays against. `amount` is in paise. */
export function createRazorpayOrder(amount: number, receipt: string, notes: Record<string, string>): Promise<RzpOrder> {
  return api<RzpOrder>("/orders", "POST", { amount, currency: "INR", receipt: receipt.slice(0, 40), notes });
}

export function fetchPayment(id: string): Promise<RzpPayment> {
  return api<RzpPayment>(`/payments/${encodeURIComponent(id)}`);
}

export function capturePayment(id: string, amount: number): Promise<RzpPayment> {
  return api<RzpPayment>(`/payments/${encodeURIComponent(id)}/capture`, "POST", { amount, currency: "INR" });
}

/** Refund a payment in full (or `amount` paise). Razorpay returns the money to the customer's source. */
export function refundPayment(id: string, amount?: number, notes: Record<string, string> = {}): Promise<{ id: string; status: string }> {
  return api(`/payments/${encodeURIComponent(id)}/refund`, "POST", { ...(amount ? { amount } : {}), speed: "normal", notes });
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The signature Razorpay Checkout hands back: HMAC-SHA256(order_id|payment_id, key secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!keySecret() || !signature) return false;
  const expected = createHmac("sha256", keySecret()).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC-SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
