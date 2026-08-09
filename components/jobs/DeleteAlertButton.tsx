"use client";

import { useTransition } from "react";
import { deleteJobAlert } from "@/lib/jobs/alert-actions";

export default function DeleteAlertButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => deleteJobAlert(id))}
      disabled={pending}
      className="text-sm text-destructive hover:underline disabled:opacity-50"
    >
      Xóa
    </button>
  );
}
