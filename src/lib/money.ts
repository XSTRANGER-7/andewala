/** "₹1,234.5" formatted for India. */
export function inr(n: number | null | undefined): string {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** Price of one egg from the tray price. */
export function perEgg(trayPrice: number): string {
  return inr(Math.round((trayPrice / 30) * 100) / 100);
}
