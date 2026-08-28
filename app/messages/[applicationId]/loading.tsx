import Navbar from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";

export default function MessagesLoading() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Skeleton className="mb-4 h-4 w-24" />
        <div className="flex flex-col gap-3">
          <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
          <Skeleton className="h-12 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
          <Skeleton className="h-10 w-3/5 rounded-2xl" />
        </div>
      </main>
    </div>
  );
}
