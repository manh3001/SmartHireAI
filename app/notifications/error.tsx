"use client";

import { InlineError } from "@/components/ui/inline-error";

export default function NotificationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <InlineError
        message="Không thể tải thông báo."
        onRetry={reset}
        backHref="/dashboard"
      />
    </div>
  );
}
