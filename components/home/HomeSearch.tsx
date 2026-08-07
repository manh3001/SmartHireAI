import { Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function HomeSearch() {
  return (
    <form
      action="/jobs"
      method="get"
      className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm sm:flex-row"
    >
      <div className="flex flex-1 items-center gap-2 px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          name="q"
          placeholder="Vị trí, công ty, kỹ năng..."
          className="w-full bg-transparent py-2 text-sm outline-none"
        />
      </div>
      <button type="submit" className={buttonVariants({ size: "lg", className: "bg-brand-gradient" })}>
        Tìm việc
      </button>
    </form>
  );
}
