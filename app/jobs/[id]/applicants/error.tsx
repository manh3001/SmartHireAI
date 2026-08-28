"use client";

import { InlineError } from "@/components/ui/inline-error";

export default function ApplicantsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <InlineError
        message="Không thể tải danh sách ứng viên."
        onRetry={reset}
        backHref="/dashboard"
      />
    </div>
  );
}
