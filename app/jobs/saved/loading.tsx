import Navbar from "@/components/Navbar";
import { JobCardSkeleton } from "@/components/jobs/JobCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function SavedJobsLoading() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="mb-4 mt-2 h-8 w-32" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
