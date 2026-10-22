"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconPin } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { AddressView } from "@/server/accounts";
import { deleteAddressAction, setDefaultAddressAction } from "@/server/actions/account";
import { AddressForm } from "./AddressForm";
import { coverageAt, type Coverage } from "@/lib/zones";

const PinPreview = dynamic(() => import("./PinPreview").then((m) => m.PinPreview), {
  ssr: false,
  loading: () => <div className="h-36 animate-pulse rounded-xl border border-line bg-mint-100" />,
});

type Props = {
  addresses: AddressView[];
  coverage: Coverage;
  defaults: { name: string; phone: string };
  /** Checkout mode: rows are selectable radios and `selectedId` is the delivery address. */
  selectable?: { selectedId: string | null; onSelect: (id: string) => void; error?: string };
};

/** Saved addresses with add, edit, remove and set-default. Also the address picker at checkout. */
export function AddressBook({ addresses, coverage, defaults, selectable }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length ? null : "new");
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Address book page: the address whose pin map is open. */
  const [previewId, setPreviewId] = useState<string | null>(null);

  const outside = (a: AddressView) => coverageAt(coverage, a).status === "outside";
  const near = (a: AddressView) => coverageAt(coverage, a).status === "near";

  return (
    <div className="grid gap-2">
      {addresses.map((a) =>
        editing === a.id ? (
          <div key={a.id} className="rounded-xl border border-forest-900 p-3">
            <AddressForm
              initial={a}
              coverage={coverage}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                toast("Address saved");
                router.refresh();
              }}
            />
          </div>
        ) : (
          <div
            key={a.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-3.5 py-3 transition",
              selectable?.selectedId === a.id ? "border-forest-900 bg-mint-100 shadow-[inset_0_0_0_1px_var(--color-forest-900)]" : "border-line",
              selectable && "cursor-pointer hover:border-ink-3",
            )}
            onClick={selectable ? () => selectable.onSelect(a.id) : undefined}
          >
            {selectable ? (
              <input
                type="radio"
                name="addressId"
                checked={selectable.selectedId === a.id}
                onChange={() => selectable.onSelect(a.id)}
                className="mt-1 h-4 w-4 shrink-0 accent-forest-900"
                aria-label={`Deliver to ${a.label}`}
              />
            ) : (
              <IconPin className="mt-0.5 shrink-0 text-forest-900" />
            )}
            <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {a.label}
                {a.isDefault && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-forest-900">
                    <IconCheck width={12} height={12} /> Default
                  </span>
                )}
                {outside(a) && <span className="rounded-full bg-bad/10 px-2 py-0.5 text-[11px] font-semibold text-bad">Not deliverable here</span>}
                {near(a) && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">Just outside area · we still deliver</span>}
                {a.lat === null && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">No map pin</span>}
              </span>
              <span className="text-ink-2">
                {a.name} · {a.phone}
              </span>
              <span className="text-xs text-ink-3">
                {a.address}
                {a.landmark ? `, near ${a.landmark}` : ""} · {a.pincode}
              </span>
              {a.lat !== null && a.lng !== null && (selectable ? selectable.selectedId === a.id : previewId === a.id) && (
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  <PinPreview lat={a.lat} lng={a.lng} />
                  <p className="mt-1 text-[11px] text-ink-3">The rider comes to this pin. Pin in the wrong place? Tap Edit to move it.</p>
                </div>
              )}
              <span className="mt-1 flex flex-wrap gap-3 text-xs font-semibold" onClick={(e) => e.stopPropagation()}>
                {a.lat === null ? (
                  <button type="button" className="text-warn hover:underline" onClick={() => setEditing(a.id)}>
                    Add map pin
                  </button>
                ) : selectable ? null : (
                  <button type="button" className="text-forest-900 hover:underline" onClick={() => setPreviewId(previewId === a.id ? null : a.id)} aria-expanded={previewId === a.id}>
                    {previewId === a.id ? "Hide pin" : "View pin"}
                  </button>
                )}
                <button type="button" className="text-forest-900 hover:underline" onClick={() => setEditing(a.id)}>
                  Edit
                </button>
                {!a.isDefault && (
                  <button
                    type="button"
                    className="text-forest-900 hover:underline disabled:opacity-50"
                    disabled={busyId === a.id}
                    onClick={async () => {
                      setBusyId(a.id);
                      await setDefaultAddressAction(a.id);
                      setBusyId(null);
                      router.refresh();
                    }}
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  className="text-ink-3 hover:text-bad disabled:opacity-50"
                  disabled={busyId === a.id}
                  onClick={async () => {
                    setBusyId(a.id);
                    const res = await deleteAddressAction(a.id);
                    setBusyId(null);
                    toast(res.ok ? "Address removed" : (res.errors.form ?? "That didn't save."), res.ok ? "default" : "error");
                    router.refresh();
                  }}
                >
                  Remove
                </button>
              </span>
            </div>
          </div>
        ),
      )}

      {editing === "new" ? (
        <div className="rounded-xl border border-dashed border-ink-3 p-3">
          <p className="mb-2 text-sm font-semibold">New address</p>
          <AddressForm
            defaults={defaults}
            coverage={coverage}
            onCancel={addresses.length ? () => setEditing(null) : undefined}
            onSaved={(saved) => {
              setEditing(null);
              toast("Address added");
              selectable?.onSelect(saved.id);
              router.refresh();
            }}
          />
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-max" onClick={() => setEditing("new")}>
          + Add a new address
        </Button>
      )}
      {selectable?.error && <p className="text-xs text-bad">{selectable.error}</p>}
    </div>
  );
}
