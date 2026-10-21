import { randomBytes, randomUUID } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/** EGG-1021-7K3M style order id: date part for humans, random part for uniqueness. */
export function newOrderId(date: string): string {
  const bytes = randomBytes(4);
  let code = "";
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `EGG-${date.slice(5).replace("-", "")}-${code}`;
}

export function newCustomerId(): string {
  return randomUUID();
}
