import Link from "next/link";
import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LOCATION_OPTIONS } from "@/lib/jobs/locations";

export default function HomeSearch({ trendingSkills = [] }: { trendingSkills?: string[] }) {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <form
        action="/jobs"
        method="get"
        className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm sm:flex-row"
      >
        <div className="flex flex-1 items-center gap-2 px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            name="q"
            placeholder="Vị trí, công ty, kỹ năng..."
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        <select
          name="location"
          defaultValue=""
          aria-label="Địa điểm"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground sm:border-0 sm:bg-transparent"
        >
          <option value="">Mọi địa điểm</option>
          {LOCATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button type="submit" className={buttonVariants({ size: "lg", className: "bg-brand-gradient" })}>
          Tìm việc
        </button>
      </form>

      {trendingSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Xu hướng:</span>
          {trendingSkills.map((skill) => (
            <Link
              key={skill}
              href={`/jobs?q=${encodeURIComponent(skill)}`}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {skill}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
