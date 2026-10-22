"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import type { OrderView } from "@/lib/types";
import { cancelMyOrderAction, reportIssueAction } from "@/server/actions/order";

/** Customer-side actions on a tracking page: cancel while placed, report a problem after delivery. */
export function OrderActions({ order }: { order: OrderView }) {
  const router = useRouter();
  const { toast } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueText, setIssueText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setBusy(true);
    const res = await cancelMyOrderAction({ id: order.id });
    setBusy(false);
    if (res.ok) {
      setCancelOpen(false);
      toast("Order cancelled");
      router.refresh();
    } else setError(res.errors.form ?? "That didn't save.");
  }

  async function report() {
    setBusy(true);
    const res = await reportIssueAction({ orderId: order.id, text: issueText });
    setBusy(false);
    if (res.ok) {
      setIssueOpen(false);
      toast("Report sent to the store");
      router.refresh();
    } else setError(res.errors.text ?? res.errors.form ?? "That didn't save.");
  }

  const canCancel = order.status === "placed";
  const canReport = order.status === "delivered" && !order.issue;
  if (!canCancel && !canReport) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canCancel && (
        <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
          Cancel order
        </Button>
      )}
      {canReport && (
        <Button variant="outline" size="sm" onClick={() => setIssueOpen(true)}>
          Report broken or missing eggs
        </Button>
      )}

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this order?">
        <p className="text-sm text-ink-2">
          The trays go back into stock and your delivery spot is released. This can&apos;t be undone.
          {order.payment === "online" && order.paymentStatus === "paid" && " Your online payment is refunded to the same UPI, card or bank account, usually within 5–7 working days."}
        </p>
        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCancelOpen(false)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={cancel} loading={busy}>
            Cancel order
          </Button>
        </div>
      </Modal>

      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title={`Report a problem with ${order.id}`}>
        <label htmlFor="issue-text" className="text-sm font-semibold">
          What went wrong?
        </label>
        <textarea id="issue-text" className="input min-h-24" placeholder="e.g. 3 eggs broken in the second tray" value={issueText} onChange={(e) => setIssueText(e.target.value)} />
        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIssueOpen(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={report} loading={busy} disabled={issueText.trim().length < 3}>
            Send report
          </Button>
        </div>
      </Modal>
    </div>
  );
}
