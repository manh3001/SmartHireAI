import Link from "next/link";
import { Building2 } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import CompanyCard from "@/components/companies/CompanyCard";
import { rankCompanies, type CompanyDirInput } from "@/lib/company/directory";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { q } = await searchParams;
  const term = (q ?? "").trim();

  const counts = await prisma.jobDescription.groupBy({
    by: ["userId"],
    where: { isPublic: true },
    _count: { _all: true },
  });
  const countByUserId: Record<string, number> = {};
  for (const c of counts) countByUserId[c.userId] = c._count._all;
  const userIds = counts.map((c) => c.userId);

  const companies: CompanyDirInput[] =
    userIds.length === 0
      ? []
      : await prisma.companyProfile.findMany({
          where: {
            userId: { in: userIds },
            ...(term ? { name: { contains: term, mode: "insensitive" as const } } : {}),
          },
          select: { id: true, userId: true, name: true, description: true, location: true, logoUrl: true },
        });

  const ranked = rankCompanies(companies, countByUserId);

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <h1 className="text-2xl font-bold text-foreground">Danh bạ công ty</h1>
        <p className="mt-1 text-sm text-muted-foreground">Các công ty đang tuyển dụng trên SmartHire.</p>

        <form method="GET" className="mt-4 flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={term}
            placeholder="Tìm theo tên công ty..."
            className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Tìm
          </button>
        </form>

        {ranked.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            title={term ? `Không tìm thấy công ty khớp "${term}"` : "Chưa có công ty nào đang tuyển"}
            description={term ? "Thử từ khoá khác." : undefined}
            action={
              term ? (
                <Link href="/companies" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Xoá tìm kiếm
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((c) => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
