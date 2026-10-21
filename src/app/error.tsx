"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-x grid justify-items-center gap-4 py-24 text-center">
      <h1 className="font-display text-3xl font-bold">Something cracked</h1>
      <p className="max-w-md text-ink-2">An unexpected error stopped this page from loading. Nothing was charged and no order was placed.</p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="sage">
          Try again
        </Button>
        <ButtonLink href="/" variant="outline">
          Go home
        </ButtonLink>
      </div>
    </div>
  );
}
