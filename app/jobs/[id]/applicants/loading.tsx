import Navbar from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicantsLoading() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <Skeleton className="mb-4 h-4 w-24" />
        <Skeleton className="mb-2 h-8 w-64" />
        <Skeleton className="mb-6 h-4 w-48" />
        <div className="grid grid-flow-col gap-3 overflow-x-auto pb-2 [grid-auto-columns:minmax(220px,1fr)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-4" />
              </div>
              <div className="grid gap-2">
                <Skeleton className="h-20 w-full rounded-md" />
                <Skeleton className="h-20 w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
