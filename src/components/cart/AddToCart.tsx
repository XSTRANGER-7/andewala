"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { addToCart } from "@/lib/cart";
import { ClosedButton, useStoreStatus } from "@/components/store/StoreStatus";

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
  const status = useStoreStatus();
  // Store closed or out of stock: a hanging sign over a disabled button, so nobody can start an order.
  if (status && !status.open && status.board) {
    if (plain) return <span className={cn(className, "cursor-not-allowed opacity-60")} aria-disabled="true">{status.text}</span>;
    return <ClosedButton board={status.board} detail={status.detail} size={size === "lg" ? "lg" : size === "sm" ? "sm" : "md"} className={cn(className, "shadow-none")} />;
  }
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
