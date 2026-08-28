import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function NotificationRowSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3">
        <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}
