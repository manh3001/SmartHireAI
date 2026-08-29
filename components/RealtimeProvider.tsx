"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  decidePollAction,
  type NotificationSignal,
} from "@/lib/notifications/poll-decision";

export default function RealtimeProvider({
  initialUnreadCount,
  initialLatestId,
}: {
  initialUnreadCount: number;
  initialLatestId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const prevRef = useRef<NotificationSignal>({
    unreadCount: initialUnreadCount,
    latest: initialLatestId
      ? { id: initialLatestId, message: "", link: "" }
      : null,
  });

  // Keep pathRef in sync without recreating the EventSource
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const es = new EventSource("/api/realtime");

    es.onmessage = (event: MessageEvent) => {
      let data: Partial<NotificationSignal>;
      try {
        data = JSON.parse(event.data as string);
      } catch {
        return;
      }
      const next: NotificationSignal = {
        unreadCount: data.unreadCount ?? 0,
        latest: data.latest ?? null,
      };
      const action = decidePollAction(prevRef.current, next, pathRef.current);
      prevRef.current = next;
      if (action.shouldRefresh) router.refresh();
      if (action.toast) {
        const link = action.toast.link;
        toast(action.toast.message, {
          action: { label: "Xem", onClick: () => router.push(link) },
        });
      }
    };

    // EventSource auto-reconnects on error; no explicit handling needed
    es.onerror = () => {};

    return () => {
      es.close();
    };
  }, [router]);

  return null;
}
