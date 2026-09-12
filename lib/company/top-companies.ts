import prisma from "@/lib/db/prisma";
import { rankCompanies, type CompanyDirInput, type CompanyDirItem, type CompanyRating } from "@/lib/company/directory";

export async function fetchTopCompanies(limit = 12): Promise<CompanyDirItem[]> {
  const counts = await prisma.jobDescription.groupBy({
    by: ["userId"],
    where: { isPublic: true },
    _count: { _all: true },
  });
  const countByUserId: Record<string, number> = {};
  for (const c of counts) countByUserId[c.userId] = c._count._all;
  const userIds = counts.map((c) => c.userId);
  if (userIds.length === 0) return [];

  const companies: CompanyDirInput[] = await prisma.companyProfile.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true, name: true, description: true, location: true, logoUrl: true },
  });

  const companyIds = companies.map((c) => c.id);
  const ratingRows = companyIds.length === 0 ? [] : await prisma.companyReview.groupBy({
    by: ["companyId"],
    where: { companyId: { in: companyIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const ratingByCompanyId: Record<string, CompanyRating> = {};
  for (const row of ratingRows) {
    ratingByCompanyId[row.companyId] = {
      average: Math.round((row._avg.rating ?? 0) * 10) / 10,
      count: row._count.rating,
    };
  }

  return rankCompanies(companies, countByUserId, ratingByCompanyId).slice(0, limit);
}
