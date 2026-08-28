import Navbar from "@/components/Navbar";
import { ApplicationCardSkeleton } from "@/components/applications/ApplicationCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationsLoading() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Skeleton className="mb-4 h-6 w-48" />
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ApplicationCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
