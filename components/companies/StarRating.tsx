"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarDisplay({ value, className }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span className={cn("inline-flex items-center", className)} aria-label={`${value} trên 5 sao`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} sao`}
          className="rounded p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400",
            )}
          />
        </button>
      ))}
    </div>
  );
}
