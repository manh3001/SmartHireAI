import Link from "next/link";
import Image from "next/image";
import type { CompanyDirItem } from "@/lib/company/directory";
import CompanyAvatar from "@/components/CompanyAvatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StarDisplay } from "@/components/companies/StarRating";

export default function CompanyCard({ company }: { company: CompanyDirItem }) {
  return (
    <Link href={`/companies/${company.id}`} className="block">
      <Card className="h-full transition-colors hover:border-primary/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              <Image
                src={company.logoUrl}
                alt={company.name}
                width={48}
                height={48}
                className="h-12 w-12 rounded-lg object-cover"
              />
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {company.jobCount} tin đang tuyển
            </span>
            {company.reviewCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <StarDisplay value={company.rating} className="[&_svg]:h-3.5 [&_svg]:w-3.5" />
                <span className="font-medium text-foreground">{company.rating.toFixed(1)}</span>
                <span>({company.reviewCount})</span>
              </span>
            )}
          </div>
          {company.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{company.description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
