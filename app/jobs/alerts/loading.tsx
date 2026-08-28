import Navbar from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function JobAlertsLoading() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="rounded-2xl border border-border bg-card p-4">
              <Skeleton className="mb-2 h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
