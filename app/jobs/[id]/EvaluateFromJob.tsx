"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EvaluateFromJob({
  jdText,
  jdTitle,
  jdCompany,
  cvs,
}: {
  jobId: string;
  jdText: string;
  jdTitle: string;
  jdCompany: string;
  cvs: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [cvId, setCvId] = useState(cvs[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  async function onEvaluate() {
    if (!cvId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cv/${cvId}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, jdTitle, jdCompany }),
      });
      if (res.ok) {
        toast.success("Đã đánh giá xong");
        router.push(`/cv/${cvId}/evaluate`);
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Đánh giá thất bại");
      }
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader><CardTitle className="text-blue-700">Đánh giá CV của bạn với tin này</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {cvs.length === 0 ? (
          <p className="text-sm text-slate-500">Bạn chưa có CV nào. Hãy tạo CV trước ở dashboard.</p>
        ) : (
          <>
            <select
              value={cvId}
              onChange={(e) => setCvId(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {cvs.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <Button onClick={onEvaluate} disabled={loading || !cvId} className="justify-self-start">
              {loading ? "Đang đánh giá..." : "Đánh giá bằng AI"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
