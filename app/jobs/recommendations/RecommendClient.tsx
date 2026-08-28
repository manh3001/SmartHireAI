"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import SaveJobButton from "../SaveJobButton";
import ScoreBadge from "@/components/ScoreBadge";
import { recommendJobs } from "@/lib/jobs/recommend-actions";
import type { RecommendationItem } from "@/lib/jobs/recommendations";
import { EmptyState } from "@/components/ui/empty-state";

export default function RecommendClient({
  cvs,
}: {
  cvs: { id: string; title: string }[];
}) {
  const [cvId, setCvId] = useState(cvs[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<
    { summary: string; items: RecommendationItem[] } | null
  >(null);

  async function onRecommend() {
    if (!cvId) return;
    setLoading(true);
    setResult(null);
    const r = await recommendJobs(cvId);
    if (r.ok) {
      setResult({ summary: r.summary, items: r.items });
      if (r.items.length === 0) toast.info("Chưa tìm được tin phù hợp để gợi ý");
    } else {
      toast.error(r.error);
    }
    setLoading(false);
  }

  if (cvs.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-10 w-10" />}
        title="Chưa có CV nào"
        description="Hãy tạo CV trước để nhận gợi ý việc làm phù hợp."
        action={
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Tạo CV →
          </Link>
        }
      />
    );
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={cvId}
          onChange={(e) => setCvId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {cvs.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <Button onClick={onRecommend} disabled={loading || !cvId}>
          {loading ? "Đang gợi ý..." : "Gợi ý việc cho tôi"}
        </Button>
      </div>

      {result && (
        <>
          {result.summary && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
              <p className="font-semibold text-foreground">Nhận xét</p>
              <p className="mt-1 whitespace-pre-wrap">{result.summary}</p>
            </div>
          )}
          {result.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa tìm được tin phù hợp để gợi ý.</p>
          ) : (
            <div className="grid gap-2">
              {result.items.map((it, i) => (
                <div key={it.jobId} className="relative rounded-lg border border-border bg-card p-3 pr-10 text-sm">
                  <p className="font-medium text-foreground">
                    #{i + 1} ·{" "}
                    <Link href={`/jobs/${it.jobId}`} className="text-primary hover:underline">
                      {it.title || "(chưa có tiêu đề)"}
                    </Link>{" "}
                    <span className="text-xs text-muted-foreground">{it.company || "—"}</span>
                  </p>
                  <div className="mt-0.5"><ScoreBadge score={it.score} /></div>
                  <p className="mt-1 text-foreground">{it.reason}</p>
                  <div className="absolute right-2 top-2">
                    <SaveJobButton jobId={it.jobId} initialSaved={false} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
