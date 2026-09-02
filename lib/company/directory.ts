export type CompanyDirInput = {
  id: string;
  userId: string;
  name: string;
  description: string;
  location: string;
  logoUrl: string;
};

export type CompanyRating = { average: number; count: number };

export type CompanyDirItem = CompanyDirInput & {
  jobCount: number;
  rating: number;
  reviewCount: number;
};

export function rankCompanies(
  companies: CompanyDirInput[],
  countByUserId: Record<string, number>,
  ratingByCompanyId: Record<string, CompanyRating> = {},
): CompanyDirItem[] {
  return companies
    .map((c) => {
      const r = ratingByCompanyId[c.id];
      return {
        ...c,
        jobCount: countByUserId[c.userId] ?? 0,
        rating: r?.average ?? 0,
        reviewCount: r?.count ?? 0,
      };
    })
    .sort((a, b) => b.jobCount - a.jobCount || a.name.localeCompare(b.name, "vi"));
}
