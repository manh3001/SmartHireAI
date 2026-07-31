"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import SaveJobButton from "../SaveJobButton";
import { recommendJobs } from "@/lib/jobs/recommend-actions";
import type { RecommendationItem } from "@/lib/jobs/recommendations";

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
      <p className="mt-4 text-sm text-slate-500">
        Bạn chưa có CV nào. Hãy tạo CV trước ở bảng điều khiển rồi quay lại.
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={cvId}
          onChange={(e) => setCvId(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
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
            <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-blue-700">Nhận xét</p>
              <p className="mt-1 whitespace-pre-wrap">{result.summary}</p>
            </div>
          )}
          {result.items.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa tìm được tin phù hợp để gợi ý.</p>
          ) : (
            <div className="grid gap-2">
              {result.items.map((it, i) => (
                <div key={it.jobId} className="relative rounded-lg border border-slate-200 bg-white p-3 pr-10 text-sm">
                  <p className="font-medium text-slate-800">
                    #{i + 1} ·{" "}
                    <Link href={`/jobs/${it.jobId}`} className="text-blue-700 hover:underline">
                      {it.title || "(chưa có tiêu đề)"}
                    </Link>{" "}
                    <span className="text-xs text-slate-400">{it.company || "—"}</span>
                  </p>
                  <p className="text-xs text-blue-600">Điểm phù hợp: {it.score}/100</p>
                  <p className="mt-1 text-slate-700">{it.reason}</p>
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
