"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelInterview } from "@/lib/applications/interview";

export default function CancelInterviewButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    if (!window.confirm("Huỷ lịch phỏng vấn này?")) return;
    startTransition(async () => {
      const r = await cancelInterview(applicationId);
      if (r.ok) {
        toast.success("Đã huỷ lịch phỏng vấn");
        router.refresh();
      } else {
        toast.error(r.error ?? "Huỷ lịch thất bại");
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCancel} disabled={isPending}>
      {isPending ? "Đang huỷ..." : "Huỷ lịch"}
    </Button>
  );
}
