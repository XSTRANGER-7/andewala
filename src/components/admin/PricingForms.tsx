"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Note } from "@/components/ui/Note";
import { useToast } from "@/components/ui/Toast";
import { inr } from "@/lib/money";
import { deliveryFeeFor, marginReport } from "@/lib/pricing";
import { addDays, fmtDay, fmtWhen } from "@/lib/time";
import type { Costs, StoreSettings } from "@/lib/types";
import { addStockAction, clearScheduleAction, savePricingAction, schedulePriceAction, setStockAction, type AdminResult } from "@/server/actions/admin";

type Props = { settings: Omit<StoreSettings, "priceUpdatedAt"> & { priceUpdatedAt: string | null }; price: number; today: string; available: number; reserved: number };

const COST_ROWS: [keyof Costs, string][] = [
  ["farm", "Farm purchase"],
  ["inbound", "Inbound transport"],
  ["packaging", "Packaging and breakage"],
  ["payment", "Payment and other"],
  ["delivery", "Delivery per order"],
];

export function PricingForms({ settings, price: livePrice, today, available, reserved }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [price, setPrice] = useState(String(livePrice));
  const [costs, setCosts] = useState<Record<keyof Costs, string>>({
    farm: String(settings.costs.farm),
    inbound: String(settings.costs.inbound),
    packaging: String(settings.costs.packaging),
    payment: String(settings.costs.payment),
    delivery: String(settings.costs.delivery),
  });
  const [schedDate, setSchedDate] = useState(settings.scheduled?.date ?? addDays(today, 1));
  const [schedPrice, setSchedPrice] = useState(String(settings.scheduled?.price ?? livePrice));
  const [addTrays, setAddTrays] = useState("");
  const [addCost, setAddCost] = useState(String(settings.costs.farm));
  const [setTrays, setSetTrays] = useState(String(settings.stock));
  const [reason, setReason] = useState("Recount");

  const numericCosts: Costs = {
    farm: Number(costs.farm) || 0,
    inbound: Number(costs.inbound) || 0,
    packaging: Number(costs.packaging) || 0,
    payment: Number(costs.payment) || 0,
    delivery: Number(costs.delivery) || 0,
  };
  const report = marginReport(Number(price) || 0, numericCosts, settings.targetContribution, deliveryFeeFor(1, settings.deliveryFee, settings.freeDeliveryFrom));

  function run(fn: () => Promise<AdminResult>) {
    setErrors({});
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast(res.message);
        router.refresh();
      } else {
        setErrors(res.errors);
        toast(res.errors.form ?? "Check the form.", "error");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="card grid content-start gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => savePricingAction({ price: Number(price), costs: numericCosts }));
        }}
      >
        <h2 className="font-display text-lg font-bold">Today&apos;s selling price</h2>
        <Field label="Price per 30-egg tray (₹)" htmlFor="p-price" error={errors.price}>
          <input id="p-price" type="number" min={1} step={1} className="input num" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <table className="w-full text-sm">
          <tbody>
            {COST_ROWS.map(([k, label]) => (
              <tr key={k} className="border-b border-dashed border-line">
                <td className="py-1.5">{label}</td>
                <td className="py-1.5 text-right">
                  <input type="number" min={0} step={0.5} aria-label={`${label} in rupees`} className="input num max-w-28 px-2 py-1.5 text-right" value={costs[k]} onChange={(e) => setCosts({ ...costs, [k]: e.target.value })} />
                </td>
              </tr>
            ))}
            <tr className="border-b border-dashed border-line">
              <td className="py-1.5 font-semibold">Cost per tray</td>
              <td className="num py-1.5 text-right font-semibold">{inr(report.cost)}</td>
            </tr>
            <tr>
              <td className="py-1.5 font-semibold">Contribution per 1-tray order</td>
              <td className="num py-1.5 text-right font-semibold">{inr(report.contributionOneTray)}</td>
            </tr>
          </tbody>
        </table>
        <Note tone={report.tone}>
          {report.tone === "bad"
            ? `${inr(Number(price) || 0)} is below your cost of ${inr(report.cost)}. You lose ${inr(-report.margin)} on every tray before the delivery fee.`
            : report.tone === "warn"
              ? `Margin is ${inr(report.margin)} per tray, under your ${inr(settings.targetContribution)} target.`
              : `Margin is ${inr(report.margin)} per tray after all costs.`}
        </Note>
        <Button type="submit" variant="primary" loading={pending}>
          Save price and costs
        </Button>
        <p className="text-xs text-ink-3">New price applies to orders placed from now on. Existing orders keep the price they were placed at. Last changed {fmtWhen(settings.priceUpdatedAt)}.</p>
      </form>

      <div className="grid content-start gap-6">
        <form
          className="card grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => schedulePriceAction({ date: schedDate, price: Number(schedPrice) }));
          }}
        >
          <h2 className="font-display text-lg font-bold">Schedule tomorrow&apos;s price</h2>
          {settings.scheduled && (
            <Note tone="info">
              {inr(settings.scheduled.price)} from {fmtDay(settings.scheduled.date)}
              {settings.scheduled.date <= today ? " (live now)" : ""}.
            </Note>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" htmlFor="s-date" error={errors.date}>
              <input id="s-date" type="date" min={addDays(today, 1)} className="input" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
            </Field>
            <Field label="Price (₹)" htmlFor="s-price" error={errors.price}>
              <input id="s-price" type="number" min={1} className="input num" value={schedPrice} onChange={(e) => setSchedPrice(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={pending}>
              Schedule
            </Button>
            {settings.scheduled && (
              <Button type="button" variant="outline" disabled={pending} onClick={() => run(clearScheduleAction)}>
                Remove schedule
              </Button>
            )}
          </div>
        </form>

        <form
          className="card grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addStockAction({ trays: Number(addTrays), costPerTray: Number(addCost) }));
          }}
        >
          <h2 className="font-display text-lg font-bold">Stock</h2>
          <p className="text-sm text-ink-2">
            {settings.stock} trays on hand · {reserved} reserved by open orders · <b>{available} to sell</b>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trays bought from the farm" htmlFor="st-add" error={errors.trays}>
              <input id="st-add" type="number" min={1} placeholder="e.g. 30" className="input num" value={addTrays} onChange={(e) => setAddTrays(e.target.value)} />
            </Field>
            <Field label="Cost per tray (₹)" htmlFor="st-cost" error={errors.costPerTray}>
              <input id="st-cost" type="number" min={0} className="input num" value={addCost} onChange={(e) => setAddCost(e.target.value)} />
            </Field>
          </div>
          <div>
            <Button type="submit" variant="primary" loading={pending}>
              Add farm purchase
            </Button>
          </div>
        </form>

        <form
          className="card grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setStockAction({ trays: Number(setTrays), reason }));
          }}
        >
          <h2 className="font-display text-lg font-bold">Correct the count</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trays actually on hand" htmlFor="adj-n" error={errors.trays}>
              <input id="adj-n" type="number" min={0} className="input num" value={setTrays} onChange={(e) => setSetTrays(e.target.value)} />
            </Field>
            <Field label="Reason" htmlFor="adj-why">
              <select id="adj-why" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                {["Breakage", "Recount", "Personal use", "Returned to farm"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
          </div>
          <div>
            <Button type="submit" variant="outline" loading={pending}>
              Save count
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
