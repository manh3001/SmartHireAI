"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InlineError({
  message = "Đã có lỗi xảy ra.",
  onRetry,
  backHref,
}: {
  message?: string;
  onRetry?: () => void;
  backHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-destructive" />
      <p className="text-sm text-foreground">{message}</p>
      <div className="mt-4 flex gap-3">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Thử lại
          </Button>
        )}
        {backHref && (
          <Link href={backHref} className="text-sm text-primary hover:underline">
            ← Quay lại
          </Link>
        )}
      </div>
    </div>
  );
}
