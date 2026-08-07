import { scoreColor } from "@/lib/ai/score";
import { cn } from "@/lib/utils";

// Màu ngữ nghĩa (đỏ/vàng/xanh) theo điểm — CỐ Ý không dùng token brand.
const TONE: Record<"red" | "yellow" | "green", string> = {
  red: "bg-red-50 text-red-700",
  yellow: "bg-amber-50 text-amber-700",
  green: "bg-emerald-50 text-emerald-700",
};

export default function ScoreBadge({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        TONE[scoreColor(score)],
        className,
      )}
    >
      {score}/100
    </span>
  );
}
