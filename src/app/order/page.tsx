import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ trays?: string; newAddress?: string }> };

/** Checkout now lives in the cart. Old /order links (and their ?trays= counts) are forwarded there. */
export default async function OrderPage({ searchParams }: Props) {
  const { trays, newAddress } = await searchParams;
  const q = new URLSearchParams();
  if (trays) q.set("trays", trays);
  if (newAddress) q.set("newAddress", newAddress);
  redirect(q.size ? `/cart?${q.toString()}` : "/cart");
}
