"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ScoreBadge from "@/components/ScoreBadge";
import { screenApplicants } from "@/lib/applications/screening-actions";
import { changeStatus } from "@/lib/applications/actions";
import type { ScreeningResultItem } from "@/lib/applications/screening";

export default function ScreeningClient({
  jobId,
  screening,
}: {
  jobId: string;
  screening: { summary: string; result: (ScreeningResultItem & { currentStatus: string | null })[] } | null;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  async function onRun() {
    setRunning(true);
    const r = await screenApplicants(jobId);
    if (r.ok) {
      toast.success("Đã sàng lọc xong");
      router.refresh();
    } else {
      toast.error(r.error);
    }
    setRunning(false);
  }

  async function onMove(applicationId: string) {
    setMovingId(applicationId);
    const r = await changeStatus(applicationId, "SCREENING", "");
    if (r.ok) {
      toast.success('Đã chuyển vào "Đang sàng lọc"');
      router.refresh();
    } else {
      toast.error(r.error);
    }
    setMovingId(null);
  }

  return (
    <div className="mt-4 grid gap-4">
      <div>
        <Button onClick={onRun} disabled={running}>
          {running ? "Đang sàng lọc..." : screening ? "Chạy lại sàng lọc AI" : "Chạy sàng lọc AI"}
        </Button>
      </div>

      {!screening ? (
        <p className="text-sm text-muted-foreground">Chưa có kết quả sàng lọc. Bấm nút trên để AI xếp hạng ứng viên.</p>
      ) : (
        <>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
            <p className="font-semibold text-foreground">Nhận xét tổng quan</p>
            <p className="mt-1 whitespace-pre-wrap">{screening.summary}</p>
          </div>

          <div className="grid gap-2">
            {screening.result.map((r, i) => (
              <div
                key={r.applicationId}
                className="rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      #{i + 1} · {r.candidateName}
                      {r.shortlisted && (
                        <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Shortlist
                        </span>
                      )}
                    </p>
                    <p className="text-xs">
                      {r.score !== null ? <ScoreBadge score={r.score} /> : <span className="text-muted-foreground">Chưa xếp hạng</span>}
                    </p>
                    <p className="mt-1 text-foreground">{r.reason}</p>
                  </div>
                  {r.shortlisted && r.currentStatus && r.currentStatus !== "SCREENING" && r.currentStatus !== "WITHDRAWN" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onMove(r.applicationId)}
                      disabled={movingId === r.applicationId}
                    >
                      {movingId === r.applicationId ? "Đang chuyển..." : "Chuyển vào Sàng lọc"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
