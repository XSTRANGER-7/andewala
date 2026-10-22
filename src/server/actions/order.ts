"use server";

import { revalidatePath } from "next/cache";
import { getCustomerId } from "@/server/session";
import { getUser } from "@/server/customer-auth";
import { getAddress, getProfile, profileComplete } from "@/server/accounts";
import * as orders from "@/server/orders";
import * as payments from "@/server/payments";
import { orderLimitError, paymentLimitError, recentDuplicate } from "@/server/guard";
import { cancelSchema, checkoutSchema, fieldErrors, issueSchema, type CheckoutInput, type placeOrderSchema } from "@/lib/validation";
import type { z } from "zod";

type OrderInput = z.output<typeof placeOrderSchema>;

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

/**
 * Place an order for the logged-in customer. The delivery address must be one
 * of their saved addresses; the server re-checks everything inside orders.placeOrder.
 */
type Prepared =
  | { ok: true; userId: string; input: OrderInput; who: { name: string; phone: string; email: string } }
  | { ok: false; errors: Record<string, string> };

/** Shared by both payment routes: who is ordering, and the order built from their chosen saved address. */
async function prepare(raw: CheckoutInput): Promise<Prepared> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const user = await getUser();
  if (!user) return { ok: false, errors: { auth: "Please log in to place your order." } };
  const profile = await getProfile(user.id);
  if (!profile || !profileComplete(profile)) return { ok: false, errors: { auth: "Finish your profile (name and mobile number) before ordering." } };
  const address = await getAddress(user.id, parsed.data.addressId);
  if (!address) return { ok: false, errors: { addressId: "Choose a delivery address." } };
  if (address.lat === null || address.lng === null) return { ok: false, errors: { addressId: "Drop a pin on the map for this address so the rider can find you. Tap Edit on the address." } };
  const { addressId: _addressId, ...rest } = parsed.data;
  void _addressId;
  return {
    ok: true,
    userId: user.id,
    input: { ...rest, name: address.name, phone: address.phone, address: address.address, landmark: address.landmark, pincode: address.pincode, lat: address.lat, lng: address.lng },
    who: { name: profile.name, phone: profile.phone ?? "", email: profile.email ?? "" },
  };
}

function refreshOrderPages() {
  revalidatePath("/");
  revalidatePath("/cart");
  revalidatePath("/orders");
  revalidatePath("/account");
}

const fieldFor = (f?: string) => (f === "pincode" ? "addressId" : (f ?? "form"));

/** Cash on delivery: place the order straight away. */
export async function placeOrderAction(input: CheckoutInput): Promise<ActionResult<{ id: string }>> {
  if (input.payment === "online") return { ok: false, errors: { payment: "Online orders are placed after payment." } };
  try {
    const p = await prepare(input);
    if (!p.ok) return p;
    // A double tap (or a replayed request) gets the order it already made.
    const dup = await recentDuplicate(p.userId, p.input);
    if (dup) return { ok: true, data: { id: dup } };
    const limited = await orderLimitError(p.userId);
    if (limited) return { ok: false, errors: { form: limited } };
    const result = await orders.placeOrder(p.input, p.userId);
    if (!result.ok) return { ok: false, errors: { [fieldFor(result.field)]: result.error } };
    refreshOrderPages();
    return { ok: true, data: { id: result.order.id } };
  } catch (e) {
    console.error("placeOrder failed", e);
    return { ok: false, errors: { form: "The order didn't go through. Check your connection and try again." } };
  }
}

/** Online payment, step 1: check and price the order, and open a Razorpay order for that amount. */
export async function startPaymentAction(input: CheckoutInput): Promise<ActionResult<Extract<payments.StartResult, { ok: true }>>> {
  try {
    const p = await prepare({ ...input, payment: "online" });
    if (!p.ok) return p;
    const limited = (await orderLimitError(p.userId)) ?? (await paymentLimitError(p.userId));
    if (limited) return { ok: false, errors: { form: limited } };
    const r = await payments.startOnlinePayment(p.userId, p.input, p.who);
    if (!r.ok) return { ok: false, errors: { [fieldFor(r.field)]: r.error } };
    return { ok: true, data: r };
  } catch (e) {
    console.error("startPayment failed", e);
    return { ok: false, errors: { form: "We couldn't start the payment. Try again." } };
  }
}

/** Online payment, step 2: Razorpay says it's paid; verify on the server and place the order. */
export async function confirmPaymentAction(r: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<ActionResult<{ id: string }> & { refunded?: boolean }> {
  const user = await getUser();
  if (!user) return { ok: false, errors: { auth: "Please log in again." } };
  const fine = (x: unknown) => typeof x === "string" && x.length > 5 && x.length < 200;
  if (!fine(r?.razorpayOrderId) || !fine(r?.razorpayPaymentId) || !fine(r?.razorpaySignature)) {
    return { ok: false, errors: { form: "We couldn't verify this payment." } };
  }
  try {
    const res = await payments.completeOnlinePayment(user.id, r);
    if (!res.ok) return { ok: false, refunded: res.refunded, errors: { form: res.error } };
    refreshOrderPages();
    return { ok: true, data: { id: res.orderId } };
  } catch (e) {
    console.error("confirmPayment failed", e);
    return {
      ok: false,
      errors: { form: "We couldn't confirm your payment yet. If money was taken, your order will appear in My orders within a few minutes, or the money will be refunded." },
    };
  }
}

/** Online payment cancelled or failed inside Razorpay: record it (no order is placed). */
export async function paymentFailedAction(razorpayOrderId: string, reason: string): Promise<void> {
  const user = await getUser();
  if (!user || typeof razorpayOrderId !== "string") return;
  await payments.markPaymentFailed(user.id, razorpayOrderId, String(reason ?? "")).catch(() => {});
}

export async function cancelMyOrderAction(input: { id: string }): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  // Only the logged-in customer who placed the order can cancel it.
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, errors: { form: "Log in to manage your order." } };
  try {
    const { id } = parsed.data;
    await orders.cancelOrder(id, "customer", { customerId });
    revalidatePath(`/order/${id}`);
    revalidatePath("/orders");
    revalidatePath("/cart");
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, errors: { form: e instanceof Error ? e.message : "That didn't save. Try again." } };
  }
}

export async function reportIssueAction(input: { orderId: string; text: string }): Promise<ActionResult> {
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const customerId = await getCustomerId();
  if (!customerId) return { ok: false, errors: { form: "Log in to manage your order." } };
  try {
    await orders.reportIssue(parsed.data.orderId, { customerId }, parsed.data.text);
    revalidatePath(`/order/${parsed.data.orderId}`);
    revalidatePath("/orders");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, errors: { form: e instanceof Error ? e.message : "That didn't save. Try again." } };
  }
}
