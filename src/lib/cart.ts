"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { PaymentMethod } from "./types";

/**
 * The cart is the customer's in-progress order, kept in this browser. It is
 * written whenever they change something at checkout, restored when they come
 * back, and cleared the moment an order is placed. Placed orders are not kept
 * here: they live in the database and are listed from the customer cookie.
 */
export const CART_KEY = "eggspress:cart";
const EVENT = "eggspress:cart-change";
/** Fired with the new tray count whenever an Order button adds to the cart, so the header icon can pulse. */
export const ADDED_EVENT = "eggspress:cart-added";
/** A cart left untouched this long is treated as abandoned and starts empty. */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export type CartDraft = {
  trays: number;
  date: string | null;
  slotId: string | null;
  payment: PaymentMethod;
  notes: string;
  updatedAt: string;
};

function safeGet(): string | null {
  try {
    return localStorage.getItem(CART_KEY);
  } catch {
    return null;
  }
}

export function parseDraft(raw: string | null): CartDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<CartDraft>;
    if (!d || typeof d.trays !== "number" || d.trays < 1) return null;
    return {
      trays: Math.floor(d.trays),
      date: typeof d.date === "string" ? d.date : null,
      slotId: typeof d.slotId === "string" ? d.slotId : null,
      payment: d.payment === "online" ? "online" : "cod",
      notes: typeof d.notes === "string" ? d.notes : "",
      updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** parseDraft plus the abandonment rule; used everywhere the cart is read. */
function liveDraft(raw: string | null): CartDraft | null {
  const d = parseDraft(raw);
  if (!d) return null;
  const age = Date.now() - new Date(d.updatedAt).getTime();
  return Number.isFinite(age) && age > MAX_AGE_MS ? null : d;
}

export function readDraft(): CartDraft | null {
  if (typeof window === "undefined") return null;
  return liveDraft(safeGet());
}

export function writeDraft(draft: Omit<CartDraft, "updatedAt">): void {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
  } catch {
    /* storage unavailable: the cart simply does not persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Put trays in the cart. With a count, the cart holds exactly that many trays
 * (a "2 trays" button means two, not two more); without one, an existing cart
 * is kept as it is and an empty cart gets one tray. Day, window, payment and
 * notes already chosen are kept.
 */
export function addToCart(trays?: number): number {
  const current = readDraft();
  const n = trays && trays >= 1 ? Math.floor(trays) : (current?.trays ?? 1);
  writeDraft({
    trays: n,
    date: current?.date ?? null,
    slotId: current?.slotId ?? null,
    payment: current?.payment ?? "cod",
    notes: current?.notes ?? "",
  });
  window.dispatchEvent(new CustomEvent(ADDED_EVENT, { detail: { trays: n, wasEmpty: !current } }));
  return n;
}

/** Change only the tray count of the cart (the quantity stepper on the cart line). */
export function setCartTrays(trays: number): void {
  const current = readDraft();
  if (!current) return;
  writeDraft({ ...current, trays: Math.max(1, Math.floor(trays)) });
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(CART_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** The current draft, live across tabs; null on the server and before hydration. */
export function useCartDraft(): CartDraft | null {
  const raw = useSyncExternalStore(subscribe, safeGet, () => null);
  return useMemo(() => liveDraft(raw), [raw]);
}
