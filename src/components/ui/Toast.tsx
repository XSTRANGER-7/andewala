"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; tone: "default" | "error" };
type ToastApi = { toast: (message: string, tone?: Toast["tone"]) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, tone: Toast["tone"] = "default") => {
    const id = ++counter.current;
    setItems((list) => [...list, { id, message, tone }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 2800);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`toast-in max-w-full rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-float ${
              t.tone === "error" ? "bg-bad" : "bg-ink"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
