import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function ApplicationCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-4 w-1/3" />
      </CardContent>
    </Card>
  );
}
