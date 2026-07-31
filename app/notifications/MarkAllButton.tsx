"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/lib/notifications/actions";

export default function MarkAllButton() {
  const router = useRouter();

  async function onClick() {
    await markAllNotificationsRead();
    toast.success("Đã đánh dấu tất cả đã đọc");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      Đánh dấu tất cả đã đọc
    </Button>
  );
}
