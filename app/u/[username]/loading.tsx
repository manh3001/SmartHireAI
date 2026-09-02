import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <div>
          <Skeleton className="mb-2 h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
    </div>
  );
}
