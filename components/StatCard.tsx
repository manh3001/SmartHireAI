import { Card, CardContent } from "@/components/ui/card";

export default function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="border-border">
      <CardContent className="py-4">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
