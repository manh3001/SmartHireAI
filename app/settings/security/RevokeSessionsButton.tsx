"use client";

import { useState, useTransition } from "react";
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
import { revokeAllSessions } from "@/lib/auth/session-actions";

export default function RevokeSessionsButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await revokeAllSessions(); // redirect -> /login khi thành công
      } catch {
        toast.error("Không thể đăng xuất các phiên. Thử lại sau.");
      }
    });
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)} disabled={isPending}>
        Đăng xuất khỏi mọi thiết bị
      </Button>
      <Dialog open={open} onOpenChange={(v) => !isPending && setOpen(v)}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Đăng xuất khỏi mọi thiết bị?</DialogTitle>
            <DialogDescription>
              Mọi phiên đăng nhập (kể cả phiên hiện tại) sẽ bị chấm dứt. Bạn cần đăng nhập lại.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Không
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Đang xử lý..." : "Đăng xuất tất cả"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
