import Link from "next/link";
import Image from "next/image";
import type { CompanyDirItem } from "@/lib/company/directory";
import CompanyAvatar from "@/components/CompanyAvatar";

export default function TrustedCompanies({
  companies,
  loggedIn,
}: {
  companies: CompanyDirItem[];
  loggedIn: boolean;
}) {
  if (companies.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="mb-6 text-center text-2xl font-bold text-foreground">Nhà tuyển dụng tiêu biểu</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {companies.map((c) => (
          <Link
            key={c.id}
            href={loggedIn ? `/companies/${c.id}` : "/login"}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            {c.logoUrl ? (
              <Image
                src={c.logoUrl}
                alt={c.name}
                width={40}
                height={40}
                className="h-10 w-10 flex-none rounded-lg object-cover"
              />
            ) : (
              <CompanyAvatar name={c.name} className="h-10 w-10" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{c.name}</div>
              <div className="truncate text-xs text-muted-foreground">{c.jobCount} tin đang tuyển</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
