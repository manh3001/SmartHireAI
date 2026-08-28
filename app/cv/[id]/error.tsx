"use client";

import { InlineError } from "@/components/ui/inline-error";

export default function CvError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <InlineError
        message="Không thể tải CV."
        onRetry={reset}
        backHref="/dashboard"
      />
    </div>
  );
}
