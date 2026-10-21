"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { loginAction } from "@/server/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Owner password" htmlFor="password" error={state?.error}>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" autoFocus />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending}>
        Open admin
      </Button>
    </form>
  );
}
