import Navbar from "@/components/Navbar";
import { JobCardSkeleton } from "@/components/jobs/JobCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function JobsLoading() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
        <Skeleton className="mb-4 h-8 w-40" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr]">
          <div className="space-y-3 rounded-2xl border bg-card p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <JobCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
