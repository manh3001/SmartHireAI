import Navbar from "@/components/Navbar";
import { ApplicationCardSkeleton } from "@/components/applications/ApplicationCardSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicantsLoading() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <Skeleton className="mb-4 h-4 w-24" />
        <Skeleton className="mb-6 h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ApplicationCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
