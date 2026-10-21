/**
 * Concurrency check: with 3 trays in stock, 8 simultaneous one-tray orders
 * must produce exactly 3 orders. Run with: npm run race
 * Uses customer id "race-test" and restores stock afterwards.
 */
import { prisma } from "@/server/db";
import { getSettings, updateSettings } from "@/server/settings";
import { getAvailability, placeOrder } from "@/server/orders";

async function main() {
  const before = await getSettings();
  await prisma.order.deleteMany({ where: { customerId: "race-test" } });
  try {
    const open = await prisma.order.count({ where: { status: { in: ["placed", "confirmed", "packed", "out"] } } });
    const reservedTrays = (await prisma.order.aggregate({ where: { status: { in: ["placed", "confirmed", "packed", "out"] } }, _sum: { trays: true } }))._sum.trays ?? 0;
    await updateSettings({ stock: reservedTrays + 3 });
    const a = await getAvailability();
    const day = a.days.find((d) => d.open)!;
    const slot = day.slots.find((s) => s.ok)!;
    console.log(`available before: ${a.available} trays (${open} other open orders)`);

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        placeOrder(
          { trays: 1, date: day.date, slotId: slot.id, payment: "cod", name: `Race ${i}`, phone: "9000000000", address: "1 Test Road, Test Area", landmark: "", pincode: "110001", lat: null, lng: null, notes: "" },
          "race-test",
        ),
      ),
    );
    const placed = results.filter((r) => r.ok).length;
    const refused = results.filter((r) => !r.ok).map((r) => (r.ok ? "" : r.error));
    console.log(`placed ${placed}, refused ${refused.length}: ${[...new Set(refused)].join(" | ")}`);
    const after = await getAvailability();
    console.log(`available after: ${after.available}`);
    if (placed !== 3 || after.available !== 0) {
      console.error("FAILED: stock was oversold or undersold");
      process.exitCode = 1;
    } else console.log("✓ exactly 3 orders for 3 trays, nothing oversold");
  } finally {
    await prisma.order.deleteMany({ where: { customerId: "race-test" } });
    await updateSettings({ stock: before.stock });
    await prisma.$disconnect();
  }
}
main();
