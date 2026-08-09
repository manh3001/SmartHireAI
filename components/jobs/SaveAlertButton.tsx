"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { createJobAlert } from "@/lib/jobs/alert-actions";
import type { AlertCriteria } from "@/lib/jobs/alerts";

export default function SaveAlertButton({ criteria }: { criteria: AlertCriteria }) {
  const [pending, startTransition] = useTransition();
  function onSave() {
    startTransition(async () => {
      const res = await createJobAlert(criteria);
      if (res.ok) toast.success("Đã lưu thông báo việc làm");
      else toast.error(res.error ?? "Lưu thất bại");
    });
  }
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={pending}
      className="text-primary hover:underline disabled:opacity-50"
    >
      🔔 Lưu bộ lọc làm thông báo
    </button>
  );
}
