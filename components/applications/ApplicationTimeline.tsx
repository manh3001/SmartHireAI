import { buildApplicationTimeline } from "@/lib/applications/timeline";
import type { ApplicationStatus } from "@/lib/applications/status";
import { cn } from "@/lib/utils";

export default function ApplicationTimeline({
  app,
}: {
  app: {
    createdAt: Date;
    status: ApplicationStatus;
    events: { toStatus: ApplicationStatus; createdAt: Date }[];
  };
}) {
  const steps = buildApplicationTimeline(app);
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2",
              s.isCurrent ? "border-primary bg-primary" : "border-muted-foreground/40 bg-background",
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <div className={cn("text-sm font-medium", s.isCurrent ? "text-primary" : "text-foreground")}>
              {s.label}
            </div>
            <div className="text-xs text-muted-foreground">
              {s.date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
