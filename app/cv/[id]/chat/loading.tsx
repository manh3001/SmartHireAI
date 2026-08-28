import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
      <Skeleton className="h-14 w-2/3 rounded-2xl" />
      <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
    </div>
  );
}
