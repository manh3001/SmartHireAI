"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveInterviewOutcome } from "@/lib/applications/interview";

export default function OutcomePanel({
  applicationId,
  initialOutcome,
}: {
  applicationId: string;
  initialOutcome: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialOutcome);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const r = await saveInterviewOutcome(applicationId, value);
      if (r.ok) {
        toast.success("Đã lưu kết quả phỏng vấn");
        router.refresh();
      } else {
        toast.error(r.error ?? "Lưu kết quả thất bại");
      }
    });
  }

  return (
    <div className="space-y-2 pt-2">
      <p className="text-sm font-medium text-foreground">Kết quả phỏng vấn</p>
      <Textarea
        placeholder="Ghi nhận kết quả buổi phỏng vấn..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={1000}
        rows={3}
        className="resize-none"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Đang lưu..." : "Lưu kết quả"}
        </Button>
      </div>
    </div>
  );
}
