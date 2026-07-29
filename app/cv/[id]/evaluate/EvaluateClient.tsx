"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { scoreColor } from "@/lib/ai/score";
import type { EvaluationResult } from "@/lib/ai/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type PastEvaluation = {
  id: string;
  overallScore: number;
  summary: string;
  createdAt: string;
  jdTitle: string;
  jdCompany: string;
};

const colorClass: Record<"red" | "yellow" | "green", string> = {
  red: "text-red-600",
  yellow: "text-yellow-600",
  green: "text-green-600",
};

const ringClass: Record<"red" | "yellow" | "green", string> = {
  red: "border-red-200",
  yellow: "border-yellow-200",
  green: "border-green-200",
};

export default function EvaluateClient({
  cvId,
  cvTitle,
  history,
}: {
  cvId: string;
  cvTitle: string;
  history: PastEvaluation[];
}) {
  const [jdText, setJdText] = useState("");
  const [jdTitle, setJdTitle] = useState("");
  const [jdCompany, setJdCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  async function onEvaluate() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cv/${cvId}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, jdTitle, jdCompany }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.result as EvaluationResult);
        toast.success("Đã đánh giá xong");
      } else {
        toast.error(data.error ?? "Đánh giá thất bại");
      }
    } catch {
      toast.error("Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-full max-w-3xl bg-slate-50 p-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/cv/${cvId}`} className="text-sm underline">← Về CV</Link>
        <h1 className="text-lg font-semibold">Đánh giá: {cvTitle}</h1>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle>Mô tả công việc (JD)</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex gap-2">
            <Input placeholder="Tên vị trí (tuỳ chọn)" value={jdTitle} onChange={(e) => setJdTitle(e.target.value)} />
            <Input placeholder="Công ty (tuỳ chọn)" value={jdCompany} onChange={(e) => setJdCompany(e.target.value)} />
          </div>
          <div>
            <Label>Dán nội dung JD vào đây</Label>
            <Textarea rows={8} value={jdText} onChange={(e) => setJdText(e.target.value)}
              placeholder="Copy mô tả công việc từ tin tuyển dụng và dán vào..." />
          </div>
          <Button onClick={onEvaluate} disabled={loading || !jdText.trim()} className="justify-self-start">
            {loading ? "Đang đánh giá..." : "Đánh giá bằng AI"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="mb-4">
          <CardHeader><CardTitle>Kết quả</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-col items-center rounded-lg bg-blue-50/50 p-4 text-center">
              <div className={`flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 bg-white ${ringClass[scoreColor(result.overallScore)]}`}>
                <span className={`text-4xl font-bold ${colorClass[scoreColor(result.overallScore)]}`}>
                  {result.overallScore}
                </span>
                <span className="text-xs text-slate-400">/100</span>
              </div>
              <p className="mt-3 max-w-xl text-slate-600">{result.summary}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="font-semibold text-green-700">Điểm mạnh</h3>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-red-700">Điểm yếu</h3>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {result.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="mb-1 font-semibold text-slate-700">Từ khóa khớp</p>
                <div className="flex flex-wrap gap-1">
                  {result.matchedKeywords.length === 0 && <span className="text-slate-400">—</span>}
                  {result.matchedKeywords.map((k, i) => (
                    <span key={i} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{k}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 font-semibold text-slate-700">Từ khóa còn thiếu</p>
                <div className="flex flex-wrap gap-1">
                  {result.missingKeywords.length === 0 && <span className="text-slate-400">—</span>}
                  {result.missingKeywords.map((k, i) => (
                    <span key={i} className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{k}</span>
                  ))}
                </div>
              </div>
            </div>

            {result.skillGaps.length > 0 && (
              <div>
                <h3 className="font-semibold">Kỹ năng còn thiếu & cách học</h3>
                <div className="mt-2 grid gap-2">
                  {result.skillGaps.map((g, i) => (
                    <div key={i} className="rounded border p-3 text-sm">
                      <div className="font-medium">{g.skill}</div>
                      <div className="text-gray-600">Vì sao: {g.why}</div>
                      <div className="text-gray-600">Học thế nào: {g.howToLearn}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Lịch sử đánh giá</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {history.length === 0 && <p className="text-sm text-gray-500">Chưa có lần đánh giá nào.</p>}
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between border-b pb-2 last:border-0 text-sm">
              <div>
                <span className={`font-bold ${colorClass[scoreColor(h.overallScore)]}`}>{h.overallScore}/100</span>
                <span className="ml-2 text-gray-600">
                  {h.jdTitle || "JD"}{h.jdCompany ? ` @ ${h.jdCompany}` : ""}
                </span>
              </div>
              <span className="text-gray-400">{new Date(h.createdAt).toLocaleDateString("vi-VN")}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
