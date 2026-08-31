"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalyzeResult } from "@/app/api/cv/[id]/analyze/route";

type Section = AnalyzeResult["sections"][number];

function StatusIcon({ status }: { status: Section["status"] }) {
  if (status === "ok") return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

export default function CvAnalysis({ cvId }: { cvId: string }) {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cv/${cvId}/analyze`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data: AnalyzeResult = await res.json();
      setResult(data);
      setRan(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Phân tích thất bại");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 animate-spin" /> Đang phân tích CV...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={analyze}>Thử lại</Button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4 p-4">
      {/* Điểm tổng */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">Điểm tổng thể</p>
        <p className="mt-1 text-3xl font-bold text-foreground">
          {result.score}
          <span className="text-base font-normal text-muted-foreground">/100</span>
        </p>
      </div>

      {/* Từng mục */}
      <div className="space-y-2">
        {result.sections.map((s) => (
          <div key={s.name} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <StatusIcon status={s.status} />
              <span className="font-medium text-foreground text-sm">{s.name}</span>
            </div>
            {s.tip && (
              <p className="mt-1.5 pl-6 text-xs text-muted-foreground">{s.tip}</p>
            )}
          </div>
        ))}
      </div>

      {ran && (
        <Button variant="outline" size="sm" onClick={analyze} disabled={loading} className="w-full">
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Phân tích lại
        </Button>
      )}
    </div>
  );
}
