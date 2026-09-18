import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import type { Onboarding } from "@/lib/dashboard/onboarding";

export default function OnboardingCard({ onboarding }: { onboarding: Onboarding }) {
  if (onboarding.allDone) return null;

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Bắt đầu</h2>
        <span className="text-xs text-muted-foreground">
          {onboarding.completed}/{onboarding.total} bước
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {onboarding.steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2 text-sm">
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            {step.done ? (
              <span className="text-muted-foreground line-through">{step.label}</span>
            ) : (
              <Link href={step.href} className="flex items-center gap-1 text-foreground hover:text-primary">
                {step.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
