"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ACTIVE_STATUSES, ORDER_FLOW, STATUS_LABEL, type OrderView } from "@/lib/types";
import { advanceOrderAction, cancelOrderAction, markPaidAction, resolveIssueAction, type AdminResult } from "@/server/actions/admin";

export function OrderRowActions({ order }: { order: OrderView }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const i = ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]);
  const next = i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null;

  function run(fn: () => Promise<AdminResult>) {
    start(async () => {
      const res = await fn();
      toast(res.ok ? res.message : (res.errors.form ?? "That didn't save."), res.ok ? "default" : "error");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {next && order.status !== "cancelled" && (
        <Button size="sm" variant="primary" loading={pending} onClick={() => run(() => advanceOrderAction(order.id))}>
          Mark {STATUS_LABEL[next].toLowerCase()}
        </Button>
      )}
      {order.paymentStatus === "pending" && order.status !== "cancelled" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => markPaidAction(order.id))}>
          Mark paid
        </Button>
      )}
      {order.issue && !order.issue.resolved && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => resolveIssueAction(order.id))}>
          Resolve report
        </Button>
      )}
      {ACTIVE_STATUSES.includes(order.status) && (
        <Button size="sm" variant="danger" disabled={pending} onClick={() => setConfirmCancel(true)}>
          Cancel
        </Button>
      )}
      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title={`Cancel ${order.id}?`}>
        <p className="text-sm text-ink-2">The customer sees the order as cancelled and its trays return to stock.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmCancel(false)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() => {
              setConfirmCancel(false);
              run(() => cancelOrderAction(order.id));
            }}
          >
            Cancel order
          </Button>
        </div>
      </Modal>
    </div>
  );
}
