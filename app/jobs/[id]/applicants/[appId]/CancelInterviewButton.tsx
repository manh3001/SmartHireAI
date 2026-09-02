"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cancelInterview } from "@/lib/applications/interview";

export default function CancelInterviewButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const r = await cancelInterview(applicationId);
      if (r.ok) {
        toast.success("Đã huỷ lịch phỏng vấn");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(r.error ?? "Huỷ lịch thất bại");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={isPending}>
        Huỷ lịch
      </Button>
      <Dialog open={open} onOpenChange={(v) => !isPending && setOpen(v)}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Huỷ lịch phỏng vấn?</DialogTitle>
            <DialogDescription>
              Lịch phỏng vấn sẽ bị xoá. Trạng thái đơn ứng tuyển không thay đổi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Không
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Đang huỷ..." : "Huỷ lịch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
