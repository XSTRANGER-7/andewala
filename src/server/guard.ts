import "server-only";
import { headers } from "next/headers";
import { prisma } from "./db";

/**
 * Abuse limits for ordering, paying and admin sign-in. Counted from the
 * database, so they hold across server instances and restarts.
 */
export const LIMITS = {
  /** Orders a customer can have on the way at once. */
  activeOrders: 5,
  /** Orders a customer can place in an hour. */
  ordersPerHour: 10,
  /** Online payments a customer can start in an hour. */
  paymentStartsPerHour: 15,
  /** Wrong admin passwords allowed from one network in 15 minutes. */
  adminFailures: 5,
  /** A second identical order inside this window is treated as a double tap. */
  duplicateWindowMs: 30_000,
};

const ACTIVE = ["placed", "confirmed", "packed", "out"];

/** The caller's IP as the hosting platform reports it. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}

/** Why this customer can't place another order right now, or null. */
export async function orderLimitError(userId: string): Promise<string | null> {
  const hourAgo = new Date(Date.now() - 3600_000);
  const [active, recent] = await Promise.all([
    prisma.order.count({ where: { customerId: userId, status: { in: ACTIVE } } }),
    prisma.order.count({ where: { customerId: userId, createdAt: { gte: hourAgo } } }),
  ]);
  if (active >= LIMITS.activeOrders) return `You already have ${active} orders on the way. Wait for one to arrive, or cancel one, before ordering again.`;
  if (recent >= LIMITS.ordersPerHour) return "That's a lot of orders in the last hour. Please try again a little later.";
  return null;
}

/** Why this customer can't start another online payment right now, or null. */
export async function paymentLimitError(userId: string): Promise<string | null> {
  const hourAgo = new Date(Date.now() - 3600_000);
  const n = await prisma.paymentAttempt.count({ where: { userId, createdAt: { gte: hourAgo } } });
  return n >= LIMITS.paymentStartsPerHour ? "Too many payment attempts in the last hour. Please try again later, or choose cash on delivery." : null;
}

/** The order a double tap already created (same customer, payment, day, trays and address in the last 30 s). */
export async function recentDuplicate(userId: string, input: { date: string; trays: number; address: string; pincode: string; payment: string }): Promise<string | null> {
  const o = await prisma.order.findFirst({
    where: { customerId: userId, status: { not: "cancelled" }, payment: input.payment, date: input.date, trays: input.trays, address: input.address, pincode: input.pincode, createdAt: { gte: new Date(Date.now() - LIMITS.duplicateWindowMs) } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return o?.id ?? null;
}

const ADMIN_FAIL = "Admin sign-in failed";

/** Too many wrong admin passwords from this network recently? */
export async function adminLoginBlocked(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60_000);
  const n = await prisma.auditLog.count({ where: { action: ADMIN_FAIL, detail: ip, at: { gte: since } } });
  return n >= LIMITS.adminFailures;
}

export async function recordAdminFailure(ip: string): Promise<void> {
  await prisma.auditLog.create({ data: { by: "security", action: ADMIN_FAIL, detail: ip } });
}
