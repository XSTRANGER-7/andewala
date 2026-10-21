/**
 * End-to-end check of the order lifecycle against the real database.
 * Run with: npm run smoke
 * Creates orders under customer id "smoke-test" and removes them afterwards.
 */
import { prisma } from "@/server/db";
import { getSettings, updateSettings } from "@/server/settings";
import { advanceOrder, cancelOrder, getAvailability, placeOrder } from "@/server/orders";

const CUSTOMER = "smoke-test";
const PHONE = "9876543210";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error("FAILED: " + msg);
}

async function cleanup(stock: number) {
  await prisma.order.deleteMany({ where: { customerId: CUSTOMER } });
  await prisma.auditLog.deleteMany({ where: { by: "smoke" } });
  await updateSettings({ stock });
}

async function main() {
  const before = await getSettings();
  await cleanup(before.stock); // remove leftovers from an interrupted run
  try {
    await run(before.stock);
  } finally {
    await cleanup(before.stock);
  }
}

async function run(stockBefore: number) {
  const before = { ...(await getSettings()), stock: stockBefore };
  console.log(`Store: ${before.storeName} · stock ${before.stock} · price ₹${before.price}`);

  const a = await getAvailability();
  console.log(`Availability: ${a.available} trays, status "${a.status.text}", ${a.days.length} days`);
  const day = a.days.find((d) => d.open);
  assert(day, "at least one delivery day should be open");
  const slot = day.slots.find((s) => s.ok)!;

  const base = { date: day.date, slotId: slot.id, payment: "cod" as const, name: "Smoke Test", phone: PHONE, address: "12 Test Lane, Demo Nagar", landmark: "", pincode: "110001", notes: "" };

  // 1. a valid order
  const r1 = await placeOrder({ ...base, trays: 2 }, CUSTOMER);
  assert(r1.ok, "valid order should be accepted: " + (r1.ok ? "" : r1.error));
  console.log(`✓ placed ${r1.order.id} · ${r1.order.trays} trays · total ₹${r1.order.total}`);
  assert(r1.order.total === 2 * a.price + (a.freeDeliveryFrom && 2 >= a.freeDeliveryFrom ? 0 : a.deliveryFee), "total should match price + fee");

  // 2. stock is reserved
  const a2 = await getAvailability();
  assert(a2.available === a.available - 2, "available trays should drop by 2");
  console.log(`✓ stock reserved: ${a.available} → ${a2.available}`);

  // 3. over-ordering is refused (whichever limit is hit first: per-order max or stock)
  const r2 = await placeOrder({ ...base, trays: Math.min(a2.available, a2.maxTrays) + 1 }, CUSTOMER);
  assert(!r2.ok, "ordering more than allowed should fail");
  console.log(`✓ over-order refused: "${r2.ok ? "" : r2.error}"`);

  // 4. delivering reduces stock on hand
  let o = r1.order;
  for (const expected of ["confirmed", "packed", "out", "delivered"] as const) {
    o = await advanceOrder(o.id, "smoke");
    assert(o.status === expected, `status should be ${expected}`);
  }
  const afterDelivery = await getSettings();
  assert(afterDelivery.stock === before.stock - 2, "stock on hand should drop by 2 after delivery");
  console.log(`✓ delivered; stock on hand ${before.stock} → ${afterDelivery.stock}`);

  // 5. customer cancel with phone proof
  const r3 = await placeOrder({ ...base, trays: 1 }, CUSTOMER);
  assert(r3.ok, "second order should be accepted");
  const c = await cancelOrder(r3.order.id, "customer", { customerId: null, phone: PHONE });
  assert(c.status === "cancelled", "order should be cancelled");
  console.log(`✓ cancelled ${c.id} with phone proof`);
  let threw = false;
  try {
    await cancelOrder(o.id, "customer", { customerId: "someone-else" });
  } catch {
    threw = true;
  }
  assert(threw, "cancelling someone else's order must fail");
  console.log("✓ foreign cancel refused");

  // 6. slot capacity
  const a3 = await getAvailability();
  const s3 = a3.days.find((d) => d.date === day.date)!.slots.find((s) => s.id === slot.id)!;
  assert(s3.left === slot.left - 1, "one delivered order should still hold its slot spot; cancelled one released");
  console.log(`✓ slot capacity: ${slot.left} → ${s3.left}`);

  console.log("✓ all checks passed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
