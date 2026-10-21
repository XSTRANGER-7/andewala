"use server";

import { revalidatePath } from "next/cache";
import { getCustomerId } from "@/server/session";
import { getUser } from "@/server/customer-auth";
import { getAddress, getProfile, profileComplete } from "@/server/accounts";
import * as orders from "@/server/orders";
import { cancelSchema, checkoutSchema, fieldErrors, findOrderSchema, issueSchema, type CheckoutInput } from "@/lib/validation";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

/**
 * Place an order for the logged-in customer. The delivery address must be one
 * of their saved addresses; the server re-checks everything inside orders.placeOrder.
 */
export async function placeOrderAction(input: CheckoutInput): Promise<ActionResult<{ id: string }>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const user = await getUser();
  if (!user) return { ok: false, errors: { auth: "Please log in to place your order." } };
  try {
    const profile = await getProfile(user.id);
    if (!profile || !profileComplete(profile)) return { ok: false, errors: { auth: "Finish your profile (name and mobile number) before ordering." } };
    const address = await getAddress(user.id, parsed.data.addressId);
    if (!address) return { ok: false, errors: { addressId: "Choose a delivery address." } };
    if (address.lat === null || address.lng === null) return { ok: false, errors: { addressId: "Drop a pin on the map for this address so the rider can find you. Tap Edit on the address." } };
    const { addressId: _addressId, ...rest } = parsed.data;
    void _addressId;
    const result = await orders.placeOrder(
      { ...rest, name: address.name, phone: address.phone, address: address.address, landmark: address.landmark, pincode: address.pincode, lat: address.lat, lng: address.lng },
      user.id,
    );
    if (!result.ok) return { ok: false, errors: { [result.field === "pincode" ? "addressId" : (result.field ?? "form")]: result.error } };
    revalidatePath("/");
    revalidatePath("/cart");
    revalidatePath("/orders");
    revalidatePath("/account");
    return { ok: true, data: { id: result.order.id } };
  } catch (e) {
    console.error("placeOrder failed", e);
    return { ok: false, errors: { form: "The order didn't go through. Check your connection and try again." } };
  }
}

export async function cancelMyOrderAction(input: { id: string; phone?: string }): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const customerId = await getCustomerId();
  if (!customerId && !parsed.data.phone) return { ok: false, errors: { form: "We couldn't verify this order belongs to you." } };
  try {
    const { id } = parsed.data;
    await orders.cancelOrder(id, "customer", { customerId, phone: parsed.data.phone });
    revalidatePath(`/order/${id}`);
    revalidatePath("/orders");
    revalidatePath("/cart");
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, errors: { form: e instanceof Error ? e.message : "That didn't save. Try again." } };
  }
}

export async function reportIssueAction(input: { orderId: string; text: string; phone?: string }): Promise<ActionResult> {
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const customerId = await getCustomerId();
  if (!customerId && !parsed.data.phone) return { ok: false, errors: { form: "We couldn't verify this order belongs to you." } };
  try {
    await orders.reportIssue(parsed.data.orderId, { customerId, phone: parsed.data.phone }, parsed.data.text);
    revalidatePath(`/order/${parsed.data.orderId}`);
    revalidatePath("/orders");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, errors: { form: e instanceof Error ? e.message : "That didn't save. Try again." } };
  }
}

/** Look up an order by id and phone; returns the tracking URL on success. */
export async function findOrderAction(input: { id: string; phone: string }): Promise<ActionResult<{ url: string }>> {
  const parsed = findOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const order = await orders.getOrder(parsed.data.id);
  if (!order || order.customer.phone !== parsed.data.phone) {
    return { ok: false, errors: { form: "No order matches that ID and phone number." } };
  }
  return { ok: true, data: { url: `/order/${order.id}?phone=${parsed.data.phone}` } };
}
