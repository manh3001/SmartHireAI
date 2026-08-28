"use client";

import { InlineError } from "@/components/ui/inline-error";

export default function ChatError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <InlineError
      message="Không thể tải cuộc trò chuyện."
      onRetry={reset}
      backHref="/dashboard"
    />
  );
}
