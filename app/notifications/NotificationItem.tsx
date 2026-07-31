"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead } from "@/lib/notifications/actions";

export default function NotificationItem({
  id,
  message,
  link,
  read,
  time,
}: {
  id: string;
  message: string;
  link: string;
  read: boolean;
  time: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    if (!read) await markNotificationRead(id);
    router.push(link);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
        read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"
      } hover:border-blue-300`}
    >
      <p className={read ? "text-slate-600" : "font-medium text-slate-800"}>{message}</p>
      <p className="mt-1 text-[11px] text-slate-400">{time}</p>
    </button>
  );
}
