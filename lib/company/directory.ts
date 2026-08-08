export type CompanyDirInput = {
  id: string;
  userId: string;
  name: string;
  description: string;
  location: string;
  logoUrl: string;
};

export type CompanyDirItem = CompanyDirInput & { jobCount: number };

export function rankCompanies(
  companies: CompanyDirInput[],
  countByUserId: Record<string, number>,
): CompanyDirItem[] {
  return companies
    .map((c) => ({ ...c, jobCount: countByUserId[c.userId] ?? 0 }))
    .sort((a, b) => b.jobCount - a.jobCount || a.name.localeCompare(b.name, "vi"));
}
