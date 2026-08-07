export type JobCategory =
  | "it"
  | "marketing-sales"
  | "finance"
  | "design"
  | "hr"
  | "operations"
  | "other";

// icon = tên component lucide-react (map ở phía UI).
export const JOB_CATEGORIES = [
  { slug: "it", label: "Công nghệ thông tin", icon: "Code" },
  { slug: "marketing-sales", label: "Marketing / Kinh doanh", icon: "Megaphone" },
  { slug: "finance", label: "Kế toán / Tài chính", icon: "Calculator" },
  { slug: "design", label: "Thiết kế", icon: "Palette" },
  { slug: "hr", label: "Nhân sự", icon: "Users" },
  { slug: "operations", label: "Vận hành", icon: "Settings" },
  { slug: "other", label: "Khác", icon: "Briefcase" },
] as const satisfies readonly { slug: JobCategory; label: string; icon: string }[];

export const JOB_CATEGORY_LABELS = Object.fromEntries(
  JOB_CATEGORIES.map((c) => [c.slug, c.label]),
) as Record<JobCategory, string>;

const SLUGS = new Set<string>(JOB_CATEGORIES.map((c) => c.slug));

export function isJobCategory(v: unknown): v is JobCategory {
  return typeof v === "string" && SLUGS.has(v);
}

export function normalizeCategory(v: unknown): JobCategory | null {
  return isJobCategory(v) ? v : null;
}
