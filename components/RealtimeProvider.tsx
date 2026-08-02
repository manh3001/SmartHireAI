"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  decidePollAction,
  type NotificationSignal,
} from "@/lib/notifications/poll-decision";

const POLL_INTERVAL_MS = 12_000;

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
  const inFlightRef = useRef(false);

  // Sync pathname to ref without recreating poll interval
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (stopped || inFlightRef.current || document.hidden) return;
      inFlightRef.current = true;
      try {
        const res = await fetch("/api/realtime", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.authenticated === false) {
          stopped = true;
          if (timer) clearInterval(timer);
          return;
        }
        const next: NotificationSignal = {
          unreadCount: data.unreadCount,
          latest: data.latest,
        };
        if (stopped) return;
        const action = decidePollAction(prevRef.current, next, pathRef.current);
        prevRef.current = next;
        if (action.shouldRefresh) router.refresh();
        if (action.toast) {
          const link = action.toast.link;
          toast(action.toast.message, {
            action: { label: "Xem", onClick: () => router.push(link) },
          });
        }
      } catch {
        // nuốt lỗi, thử lại chu kỳ sau
      } finally {
        inFlightRef.current = false;
      }
    };

    function onVisible() {
      if (!document.hidden) poll();
    }

    timer = setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
