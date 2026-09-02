"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarInput } from "@/components/companies/StarRating";
import { submitReview, deleteReview } from "@/lib/company/review-actions";

export default function ReviewForm({
  companyId,
  initial,
}: {
  companyId: string;
  initial?: { rating: number; comment: string };
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (rating < 1) {
      toast.error("Vui lòng chọn số sao");
      return;
    }
    startTransition(async () => {
      const r = await submitReview(companyId, { rating, comment });
      if (r.ok) {
        toast.success(initial ? "Đã cập nhật đánh giá" : "Đã gửi đánh giá");
        router.refresh();
      } else {
        toast.error(r.error ?? "Gửi đánh giá thất bại");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const r = await deleteReview(companyId);
      if (r.ok) {
        setRating(0);
        setComment("");
        toast.success("Đã xoá đánh giá");
        router.refresh();
      } else {
        toast.error(r.error ?? "Xoá đánh giá thất bại");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">
        {initial ? "Đánh giá của bạn" : "Viết đánh giá"}
      </p>
      <StarInput value={rating} onChange={setRating} />
      <Textarea
        placeholder="Chia sẻ trải nghiệm của bạn về công ty này..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={3}
        className="resize-none"
      />
      <div className="flex justify-end gap-2">
        {initial && (
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={isPending}>
            Xoá
          </Button>
        )}
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Đang lưu..." : initial ? "Cập nhật" : "Gửi đánh giá"}
        </Button>
      </div>
    </div>
  );
}
