"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { addToCart } from "@/lib/cart";

type Props = {
  /** Exact tray count to put in the cart; omit to keep the current cart (or start one with a single tray). */
  trays?: number;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  /** Render as a plain link (no button styling). */
  plain?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

/**
 * Every "Order" call to action on the site: puts trays in the cart, confirms
 * it with a toast (the header cart pops at the same moment), then opens the
 * cart, which is also the checkout. Without JavaScript it still lands on /cart.
 */
export function AddToCart({ trays, variant = "sage", size = "md", className, plain, onClick, children }: Props) {
  const { toast } = useToast();
  return (
    <Link
      href="/cart"
      onClick={() => {
        const n = addToCart(trays);
        toast(`${n} tray${n === 1 ? "" : "s"} in your cart`);
        onClick?.();
      }}
      className={plain ? className : buttonClass(variant, size, className)}
    >
      {children}
    </Link>
  );
}
