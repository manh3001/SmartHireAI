import Link from "next/link";
import type { CompanyDirItem } from "@/lib/company/directory";
import CompanyAvatar from "@/components/CompanyAvatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CompanyCard({ company }: { company: CompanyDirItem }) {
  return (
    <Link href={`/companies/${company.id}`} className="block">
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.name} className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <CompanyAvatar name={company.name} className="h-12 w-12" />
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{company.name}</p>
              {company.location && (
                <p className="truncate text-sm text-muted-foreground">📍 {company.location}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {company.jobCount} tin đang tuyển
          </span>
          {company.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{company.description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
