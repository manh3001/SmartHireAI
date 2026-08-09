"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import JobCard, { type JobCardData } from "@/components/JobCard";
import JobDetail from "@/components/jobs/JobDetail";
import SaveJobButton from "@/app/jobs/SaveJobButton";

export default function JobsBrowser({
  jobs,
  savedJobIds = [],
  isCandidate = false,
}: {
  jobs: JobCardData[];
  savedJobIds?: string[];
  isCandidate?: boolean;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(jobs[0]?.id ?? null);
  const selected = jobs.find((j) => j.id === selectedId) ?? jobs[0] ?? null;
  const savedSet = new Set(savedJobIds);

  function saveSlot(id: string) {
    return isCandidate ? <SaveJobButton jobId={id} initialSaved={savedSet.has(id)} /> : undefined;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      {/* Danh sách: mobile bấm -> điều hướng trang; desktop chọn pane */}
      <div className="space-y-3">
        {jobs.map((j) => (
          <div key={j.id}>
            {/* Mobile: link trang chi tiết */}
            <div className="lg:hidden">
              <JobCard job={j} href={`/jobs/${j.id}`} saveSlot={saveSlot(j.id)} />
            </div>
            {/* Desktop: chọn để xem pane phải */}
            <div className="hidden lg:block">
              <JobCard
                job={j}
                selected={j.id === selectedId}
                onSelect={() => setSelectedId(j.id)}
                saveSlot={saveSlot(j.id)}
              />
            </div>
          </div>
        ))}
      </div>
      {/* Pane chi tiết (chỉ desktop) */}
      <div className="hidden lg:block">
        {selected ? (
          <div className="sticky top-20">
            <JobDetail
              job={selected}
              action={
                <button
                  type="button"
                  onClick={() => router.push(`/jobs/${selected.id}`)}
                  className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white"
                >
                  Xem chi tiết & ứng tuyển →
                </button>
              }
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            Chọn một tin để xem chi tiết.
          </div>
        )}
      </div>
    </div>
  );
}
