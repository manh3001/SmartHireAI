"use client";

import { InlineError } from "@/components/ui/inline-error";

export default function RecommendationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <InlineError
        message="Không thể tải gợi ý việc làm."
        onRetry={reset}
        backHref="/dashboard"
      />
    </div>
  );
}
