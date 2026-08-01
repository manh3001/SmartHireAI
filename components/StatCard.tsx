import { Card, CardContent } from "@/components/ui/card";

export default function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="py-4">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </CardContent>
    </Card>
  );
}
