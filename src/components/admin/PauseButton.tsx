"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { togglePauseAction } from "@/server/actions/admin";

export function PauseButton({ paused }: { paused: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={paused ? "sage" : "outline"}
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await togglePauseAction();
          toast(res.ok ? res.message : (res.errors.form ?? "That didn't save."), res.ok ? "default" : "error");
          router.refresh();
        })
      }
    >
      {paused ? "Resume sales" : "Pause sales"}
    </Button>
  );
}
