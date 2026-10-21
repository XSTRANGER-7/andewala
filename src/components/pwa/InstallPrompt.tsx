"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** Chrome / Edge / Samsung Internet's install event (not in the TypeScript DOM types yet). */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

type Platform = "android" | "ios" | "ios-other" | "desktop";

const DISMISS_KEY = "eggspress:install-dismissed";
/** Fired by the "Install the app" button in My account to open the sheet on demand. */
export const OPEN_INSTALL_EVENT = "andewala:install";
const HIDDEN_ON = ["/admin", "/cart", "/login"];

function detect(): Platform {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (ios) {
    // In-app browsers (Instagram, Facebook, Gmail…) can't add to the home screen.
    const inApp = /FBAN|FBAV|Instagram|Line\/|GSA\/|Snapchat/.test(ua);
    return inApp ? "ios-other" : "ios";
  }
  return /Android/.test(ua) ? "android" : "desktop";
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const read = (k: string) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string) => {
  try {
    sessionStorage.setItem(k, "1");
  } catch {
    /* private mode: the sheet just shows again next time */
  }
};

/**
 * Registers the service worker and asks visitors to install AndeWala as an
 * app. Shown once per visit (closing it hides it until the next visit), never
 * inside the installed app, and not on checkout or login screens.
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  /** Opened from the "Install the app" button rather than on its own. */
  const [asked, setAsked] = useState(false);

  // Service worker: production only (in development it would cache stale code).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    const p = detect();
    const onBefore = (e: Event) => {
      e.preventDefault(); // keep the browser's mini-bar away; we show our own sheet
      setDeferred(e as InstallEvent);
    };
    const onInstalled = () => {
      setOpen(false);
      setDeferred(null);
      write(DISMISS_KEY);
    };
    const onAsk = () => {
      setPlatform(p);
      setAsked(true);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(OPEN_INSTALL_EVENT, onAsk);
    const t = setTimeout(() => {
      setPlatform(p);
      if (!read(DISMISS_KEY)) setOpen(true);
    }, 2500);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(OPEN_INSTALL_EVENT, onAsk);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    write(DISMISS_KEY);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function install() {
    if (!deferred) return;
    setInstalling(true);
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setInstalling(false);
    setDeferred(null);
    if (outcome === "accepted") close();
  }

  const hiddenHere = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!open || !platform || (hiddenHere && !asked)) return null;
  // Desktop browsers without an install button (Firefox, Safari on Mac): only when asked for.
  if (platform === "desktop" && !deferred && !asked) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="install-title"
      className="install-sheet fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[24rem] sm:px-0 sm:pb-0"
    >
      <div className="relative overflow-hidden rounded-3xl bg-paper p-5 shadow-[0_-8px_40px_-12px_rgb(15_40_30/0.45)] ring-1 ring-line">
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-mint-100" aria-hidden="true" />
        <button type="button" onClick={close} className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-mint-100 hover:text-ink" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <div className="relative flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={60} height={60} className="h-15 w-15 shrink-0 rounded-2xl shadow-md" />
          <div className="min-w-0 pr-6">
            <h2 id="install-title" className="font-display text-lg font-bold leading-tight">
              Get the AndeWala app
            </h2>
            <p className="mt-0.5 text-sm text-ink-2">Order eggs in one tap from your home screen. Free, and no app store needed.</p>
          </div>
        </div>

        <ul className="relative mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-ink-2">
          {["Opens instantly", "Full screen", "Tiny, ~1 MB"].map((t) => (
            <li key={t} className="rounded-xl bg-mint-50 px-2 py-2 ring-1 ring-line">
              {t}
            </li>
          ))}
        </ul>

        {platform === "ios" ? (
          <IosSteps />
        ) : platform === "ios-other" ? (
          <p className="relative mt-4 rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-ink">
            Open this page in <b>Safari</b> to install: tap <b>⋯</b> then <b>Open in Safari</b>, and then Share → Add to Home Screen.
          </p>
        ) : deferred ? null : (
          <p className="relative mt-4 rounded-xl bg-mint-50 px-3 py-2.5 text-sm text-ink-2 ring-1 ring-line">
            Tap your browser&apos;s <b>⋮ menu</b>, then <b>Install app</b> or <b>Add to Home screen</b>.
          </p>
        )}

        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={close} className="h-12 rounded-xl border border-line text-sm font-semibold text-ink-2 hover:bg-mint-50">
            Use website
          </button>
          {deferred ? (
            <button
              type="button"
              onClick={install}
              disabled={installing}
              className="h-12 rounded-xl bg-forest-900 text-sm font-bold text-white shadow-md transition hover:bg-forest-800 disabled:opacity-70"
            >
              {installing ? "Installing…" : "Install app"}
            </button>
          ) : (
            <button type="button" onClick={close} className="h-12 rounded-xl bg-forest-900 text-sm font-bold text-white shadow-md hover:bg-forest-800">
              Got it
            </button>
          )}
        </div>
      </div>
      {platform === "ios" && (
        <div className={cn("ios-arrow pointer-events-none mx-auto mt-1 h-0 w-0 border-x-[10px] border-t-[12px] border-x-transparent border-t-paper drop-shadow sm:hidden")} aria-hidden="true" />
      )}
    </div>
  );
}

/** Safari on iPhone/iPad has no install button: show the two taps it takes. */
function IosSteps() {
  const icon = "mx-1 inline-grid h-7 w-7 place-items-center rounded-md bg-paper align-middle ring-1 ring-line";
  const steps = [
    <>
      Tap
      <span className={`${icon} text-[#0a84ff]`} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M8 7l4-4 4 4" />
          <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
        </svg>
      </span>
      <b>Share</b> in Safari
    </>,
    <>
      Choose
      <span className={icon} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      </span>
      <b>Add to Home Screen</b>
    </>,
    <>
      Tap <b>Add</b>. Done!
    </>,
  ];
  return (
    <ol className="relative mt-4 grid gap-1.5 text-sm">
      {steps.map((content, i) => (
        <li key={i} className="flex items-center gap-3 rounded-xl bg-mint-50 px-3 py-2 ring-1 ring-line">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest-900 text-xs font-bold text-white">{i + 1}</span>
          <span className="leading-7">{content}</span>
        </li>
      ))}
    </ol>
  );
}

/** "Install the app" for My account: opens the same sheet. Hidden inside the installed app. */
export function InstallAppButton({ className }: { className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(!isStandalone()), 0);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new Event(OPEN_INSTALL_EVENT));
      }}
      className={className}
    >
      Install the AndeWala app
    </button>
  );
}
