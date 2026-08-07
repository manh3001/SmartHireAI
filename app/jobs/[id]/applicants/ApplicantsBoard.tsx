"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  BOARD_STATUSES,
  STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/applications/status";
import { changeStatus } from "@/lib/applications/actions";
import CompanyAvatar from "@/components/CompanyAvatar";
import ScoreBadge from "@/components/ScoreBadge";

export type ApplicantCard = {
  id: string;
  status: ApplicationStatus;
  candidateName: string;
  score: number | null;
  coverLetter: string;
};

export default function ApplicantsBoard({
  jobId,
  initial,
}: {
  jobId: string;
  initial: ApplicantCard[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);

  async function onDrop(status: ApplicationStatus) {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) return;

    const prev = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    const r = await changeStatus(id, status, "");
    if (r.ok) {
      toast.success(`Đã chuyển sang "${STATUS_LABELS[status]}"`);
      router.refresh();
    } else {
      setCards(prev);
      toast.error(r.error);
    }
  }

  const withdrawn = cards.filter((c) => c.status === "WITHDRAWN");

  return (
    <>
      <div className="mt-4 grid grid-flow-col gap-3 overflow-x-auto pb-2 [grid-auto-columns:minmax(220px,1fr)]">
        {BOARD_STATUSES.map((status) => {
          const col = cards.filter((c) => c.status === status);
          return (
            <div
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(status)}
              className="rounded-lg border-border bg-card border p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-foreground">{STATUS_LABELS[status]}</span>
                <span className="text-xs text-muted-foreground">{col.length}</span>
              </div>
              <div className="grid gap-2">
                {col.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    className="cursor-grab rounded-md border-border bg-muted/40 border p-2 text-sm active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2">
                      <CompanyAvatar name={c.candidateName} className="h-7 w-7 rounded-lg text-[10px]" />
                      <p className="font-medium text-foreground">{c.candidateName}</p>
                    </div>
                    {c.score !== null && (
                      <div className="mt-1"><ScoreBadge score={c.score} /></div>
                    )}
                    {c.coverLetter && (
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{c.coverLetter}</p>
                    )}
                    <Link
                      href={`/jobs/${jobId}/applicants/${c.id}`}
                      draggable={false}
                      className="mt-1 inline-block text-xs text-primary hover:underline"
                    >
                      Xem chi tiết →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {withdrawn.length > 0 && (
        <div className="mt-4 rounded-lg border-border bg-card border p-3">
          <p className="mb-2 text-sm font-semibold text-muted-foreground">
            Đã rút ({withdrawn.length})
          </p>
          <div className="grid gap-1">
            {withdrawn.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{c.candidateName}</span>
                <Link
                  href={`/jobs/${jobId}/applicants/${c.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  Xem chi tiết →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
