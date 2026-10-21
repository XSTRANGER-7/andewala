import type { PaymentMethod, PaymentStatus } from "./types";

/** How a payment reads to people: "Paid online", "Cash on delivery · due", "Refunded". */
export function paymentLabel(method: PaymentMethod, status: PaymentStatus): string {
  if (method === "online") return status === "refunded" ? "Paid online · refunded" : status === "paid" ? "Paid online" : "Online · not paid";
  const how = method === "upi" ? "UPI on delivery" : "Cash on delivery";
  return `${how} · ${status === "paid" ? "paid" : status === "refunded" ? "refunded" : "due"}`;
}
