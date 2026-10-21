import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "sage" | "dark" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<ButtonVariant, string> = {
  primary: "bg-forest-900 text-white hover:bg-forest-800",
  sage: "bg-sage-500 text-white hover:bg-sage-600",
  dark: "bg-ink text-white hover:bg-black",
  outline: "border border-line bg-paper text-ink hover:border-ink-3",
  ghost: "text-ink-2 hover:bg-mint-100 hover:text-ink",
  danger: "border border-bad/40 bg-paper text-bad hover:bg-bad-soft",
};
const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-[15px]",
  lg: "px-6 py-3.5 text-base",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> } & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean };

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type ButtonLinkProps = { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode; prefetch?: boolean };

export function ButtonLink({ href, variant = "primary", size = "md", className, children, prefetch }: ButtonLinkProps) {
  return (
    <Link href={href} prefetch={prefetch} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
