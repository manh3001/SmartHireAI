"use client";

import { InlineError } from "@/components/ui/inline-error";

export default function ApplicationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <InlineError
        message="Không thể tải danh sách đơn ứng tuyển."
        onRetry={reset}
        backHref="/jobs"
      />
    </div>
  );
}
