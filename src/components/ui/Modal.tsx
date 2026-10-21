"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = { open: boolean; onClose: () => void; title: string; children: ReactNode };

/** Accessible dialog built on the native <dialog> element. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(100%-2rem,28rem)] rounded-[var(--radius-card)] bg-paper p-0 text-ink shadow-float backdrop:bg-black/45"
      aria-labelledby="modal-title"
    >
      <div className="grid gap-4 p-6">
        <h3 id="modal-title" className="text-lg font-bold">
          {title}
        </h3>
        {children}
      </div>
    </dialog>
  );
}
