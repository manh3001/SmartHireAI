"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { previewMatch, submitApplication } from "@/lib/applications/actions";

export default function ApplyForm({
  jobId,
  cvs,
}: {
  jobId: string;
  cvs: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [cvId, setCvId] = useState(cvs[0]?.id ?? "");
  const [coverLetter, setCoverLetter] = useState("");
  const [match, setMatch] = useState<{ score: number; summary: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onPreview() {
    if (!cvId) return;
    setPreviewing(true);
    setMatch(null);
    const r = await previewMatch(jobId, cvId);
    if (r.ok) {
      setMatch({ score: r.score, summary: r.summary });
    } else {
      toast.error(r.error);
    }
    setPreviewing(false);
  }

  async function onSubmit() {
    if (!cvId) return;
    setSubmitting(true);
    const r = await submitApplication({ jobId, cvId, coverLetter });
    if (r.ok) {
      toast.success("Đã nộp đơn ứng tuyển");
      router.push("/applications");
    } else {
      toast.error(r.error);
      setSubmitting(false);
    }
  }

  if (cvs.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Bạn chưa có CV nào. Hãy tạo CV trước ở dashboard rồi quay lại ứng tuyển.
      </p>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-blue-700">Ứng tuyển</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <label className="text-sm font-medium text-slate-700">Chọn CV để nộp</label>
        <select
          value={cvId}
          onChange={(e) => {
            setCvId(e.target.value);
            setMatch(null);
          }}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          {cvs.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        <div>
          <Button variant="outline" onClick={onPreview} disabled={previewing || !cvId}>
            {previewing ? "Đang tính điểm..." : "Xem điểm phù hợp"}
          </Button>
        </div>
        {match && (
          <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm">
            <p className="font-semibold text-blue-700">Điểm phù hợp: {match.score}/100</p>
            <p className="mt-1 text-slate-700">{match.summary}</p>
            <p className="mt-1 text-xs text-slate-400">Điểm chính thức sẽ được tính lại khi bạn nộp đơn.</p>
          </div>
        )}

        <label className="text-sm font-medium text-slate-700">Thư giới thiệu (không bắt buộc)</label>
        <textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          rows={5}
          maxLength={3000}
          placeholder="Vài dòng giới thiệu bản thân và lý do phù hợp..."
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        />

        <Button onClick={onSubmit} disabled={submitting || !cvId} className="justify-self-start">
          {submitting ? "Đang nộp..." : "Nộp đơn"}
        </Button>
      </CardContent>
    </Card>
  );
}
