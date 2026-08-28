import {
  EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS, EXPERIENCE_LEVEL_LABELS,
} from "@/lib/jobs/job-fields";
import { SALARY_FILTER_STEPS } from "@/lib/jobs/salary";
import { JOB_CATEGORIES } from "@/lib/jobs/job-categories";
import type { FacetCounts } from "@/lib/jobs/search";

type Defaults = { q?: string; type?: string; level?: string; salary?: string; category?: string };

function label(base: string, count: number | undefined): string {
  return count != null ? `${base} (${count})` : base;
}

export default function JobFilters({ defaults, facets }: { defaults: Defaults; facets?: FacetCounts }) {
  const sel = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const cat = facets?.category ?? {};
  const type = facets?.employmentType ?? {};
  const level = facets?.experienceLevel ?? {};
  return (
    <form method="get" className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <input type="text" name="q" defaultValue={defaults.q ?? ""} placeholder="Từ khóa..." className={sel} />
      <select name="category" defaultValue={defaults.category ?? ""} className={sel}>
        <option value="">Mọi ngành</option>
        {JOB_CATEGORIES.map((c) => (
          <option key={c.slug} value={c.slug} disabled={facets != null && !cat[c.slug]}>
            {label(c.label, cat[c.slug])}
          </option>
        ))}
      </select>
      <select name="type" defaultValue={defaults.type ?? ""} className={sel}>
        <option value="">Mọi loại hình</option>
        {EMPLOYMENT_TYPES.map((t) => (
          <option key={t} value={t} disabled={facets != null && !type[t]}>
            {label(EMPLOYMENT_TYPE_LABELS[t], type[t])}
          </option>
        ))}
      </select>
      <select name="level" defaultValue={defaults.level ?? ""} className={sel}>
        <option value="">Mọi cấp bậc</option>
        {EXPERIENCE_LEVELS.map((l) => (
          <option key={l} value={l} disabled={facets != null && !level[l]}>
            {label(EXPERIENCE_LEVEL_LABELS[l], level[l])}
          </option>
        ))}
      </select>
      <select name="salary" defaultValue={defaults.salary ?? ""} className={sel}>
        <option value="">Mọi mức lương</option>
        {SALARY_FILTER_STEPS.map((s) => <option key={s} value={s}>Từ {s} triệu</option>)}
      </select>
      <button type="submit" className="w-full rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white">
        Áp dụng bộ lọc
      </button>
    </form>
  );
}
