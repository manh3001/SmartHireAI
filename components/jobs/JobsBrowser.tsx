"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import JobCard, { type JobCardData } from "@/components/JobCard";
import JobDetail from "@/components/jobs/JobDetail";
import SaveJobButton from "@/app/jobs/SaveJobButton";
import { loadMoreJobs } from "@/lib/jobs/search-actions";
import type { SearchInput } from "@/lib/jobs/search";

export default function JobsBrowser({
  jobs: initialJobs,
  initialCursor = null,
  searchInput,
  savedJobIds = [],
  isCandidate = false,
}: {
  jobs: JobCardData[];
  initialCursor?: string | null;
  searchInput?: SearchInput;
  savedJobIds?: string[];
  isCandidate?: boolean;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobCardData[]>(initialJobs);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialJobs[0]?.id ?? null);
  const selected = jobs.find((j) => j.id === selectedId) ?? jobs[0] ?? null;
  const savedSet = new Set(savedJobIds);

  function saveSlot(id: string) {
    return isCandidate ? <SaveJobButton jobId={id} initialSaved={savedSet.has(id)} /> : undefined;
  }

  async function onLoadMore() {
    if (!cursor || !searchInput || loading) return;
    setLoading(true);
    try {
      const res = await loadMoreJobs({ ...searchInput, cursor });
      setJobs((prev) => [...prev, ...(res.items as unknown as JobCardData[])]);
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="space-y-3">
        {jobs.map((j) => (
          <div key={j.id}>
            <div className="lg:hidden">
              <JobCard job={j} href={`/jobs/${j.id}`} saveSlot={saveSlot(j.id)} />
            </div>
            <div className="hidden lg:block">
              <JobCard job={j} selected={j.id === selectedId} onSelect={() => setSelectedId(j.id)} saveSlot={saveSlot(j.id)} />
            </div>
          </div>
        ))}
        {cursor && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {loading ? "Đang tải..." : "Xem thêm"}
          </button>
        )}
      </div>
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
        ) : null}
      </div>
    </div>
  );
}
