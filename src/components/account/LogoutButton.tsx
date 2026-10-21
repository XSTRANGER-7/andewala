"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Spinner } from "@/components/ui/Button";
import { IconLogout } from "@/components/ui/Icons";
import { logoutCustomerAction } from "@/server/actions/account";

/** Log-out row for the account menu. */
export function LogoutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await logoutCustomerAction();
          router.replace("/");
          router.refresh();
        })
      }
      className="card flex w-full items-center gap-4 py-4 text-left transition hover:border-bad/40 disabled:opacity-60"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bad-soft text-bad">{pending ? <Spinner /> : <IconLogout />}</span>
      <span className="flex-1 font-semibold text-bad">Log out</span>
    </button>
  );
}
