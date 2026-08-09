"use client";

import { useTransition } from "react";
import { setAlertEmail } from "@/lib/jobs/alert-actions";

export default function AlertEmailToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={enabled}
        disabled={pending}
        onChange={() => startTransition(() => setAlertEmail(id, !enabled))}
      />
      Gửi email
    </label>
  );
}
