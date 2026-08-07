"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { toggleSaveJob } from "@/lib/jobs/saved-actions";

export default function SaveJobButton({
  jobId,
  initialSaved,
}: {
  jobId: string;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);

  async function onToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setPending(true);
    const r = await toggleSaveJob(jobId);
    if (r.ok) {
      setSaved(r.saved);
      toast.success(r.saved ? "Đã lưu tin" : "Đã bỏ lưu");
      router.refresh();
    } else {
      toast.error(r.error);
    }
    setPending(false);
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-label={saved ? "Bỏ lưu tin" : "Lưu tin"}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-50"
    >
      {saved ? (
        <BookmarkCheck className="h-4 w-4 text-primary" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </button>
  );
}
