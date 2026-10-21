import Link from "next/link";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={cn("h-8 w-7", className)} viewBox="0 0 30 34" aria-hidden="true">
      <path d="M15 2C8 2 2 13 2 21a13 13 0 0 0 26 0C28 13 22 2 15 2Z" fill="#f3ead9" stroke="#d6c8b1" strokeWidth="1.5" />
      <circle cx="15" cy="21" r="6" fill="#f0a400" />
    </svg>
  );
}

export function Logo({ name = "andewala", href = "/", dark = false }: { name?: string; href?: string; dark?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1.5 font-display text-xl font-extrabold tracking-tight max-[379px]:gap-1 max-[379px]:text-[17px] sm:gap-2 sm:text-2xl", dark ? "text-white" : "text-ink")}>
      <LogoMark className="h-7 w-6 max-[379px]:h-6 max-[379px]:w-5 sm:h-8 sm:w-7" />
      <span>
        {name.toLowerCase()}
        <sup className="ml-0.5 hidden text-[0.5em] font-semibold text-ink-3 sm:inline">TM</sup>
      </span>
    </Link>
  );
}
