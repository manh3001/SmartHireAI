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
              className="rounded-lg border border-slate-200 bg-white p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-blue-700">{STATUS_LABELS[status]}</span>
                <span className="text-xs text-slate-400">{col.length}</span>
              </div>
              <div className="grid gap-2">
                {col.map((c) => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    className="cursor-grab rounded-md border border-slate-200 bg-slate-50 p-2 text-sm active:cursor-grabbing"
                  >
                    <p className="font-medium text-slate-800">{c.candidateName}</p>
                    {c.score !== null && (
                      <p className="text-xs text-blue-600">Điểm phù hợp: {c.score}/100</p>
                    )}
                    {c.coverLetter && (
                      <p className="mt-1 line-clamp-3 text-xs text-slate-500">{c.coverLetter}</p>
                    )}
                    <Link
                      href={`/jobs/${jobId}/applicants/${c.id}`}
                      draggable={false}
                      className="mt-1 inline-block text-xs text-blue-600 hover:underline"
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
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-sm font-semibold text-slate-500">
            Đã rút ({withdrawn.length})
          </p>
          <div className="grid gap-1">
            {withdrawn.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm text-slate-500">
                <span>{c.candidateName}</span>
                <Link
                  href={`/jobs/${jobId}/applicants/${c.id}`}
                  className="text-xs text-blue-600 hover:underline"
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
