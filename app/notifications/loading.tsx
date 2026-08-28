import Navbar from "@/components/Navbar";
import { NotificationRowSkeleton } from "@/components/notifications/NotificationRowSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <NotificationRowSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
