import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SLOTS = [
  { id: "s1", label: "6–8 PM", start: "18:00", end: "20:00", capacity: 8 },
  { id: "s2", label: "8–9 PM", start: "20:00", end: "21:00", capacity: 4 },
];

async function main() {
  const existing = await prisma.storeConfig.findUnique({ where: { id: 1 } });
  if (existing) {
    console.log("Store config already exists; leaving it untouched.");
    return;
  }
  await prisma.storeConfig.create({
    data: {
      id: 1,
      storeName: "AndeWala",
      areaName: "our delivery zone",
      price: 210,
      priceUpdatedAt: new Date(),
      stock: 24,
      deliveryFee: 0,
      freeDeliveryFrom: 0,
      slotsJson: JSON.stringify(DEFAULT_SLOTS),
      pincodesJson: JSON.stringify([]),
    },
  });
  console.log("Seeded default store config with 24 trays in stock at ₹210.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
