import { unstable_cache } from "next/cache";
import prisma from "@/lib/db/prisma";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { computeSalaryInsights, type CategorySalary } from "./insights";

async function fetchSalaryInsightsRaw(): Promise<CategorySalary[]> {
  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { category: true, salaryMin: true, salaryMax: true },
  });
  return computeSalaryInsights(rows);
}

const getCached = unstable_cache(
  fetchSalaryInsightsRaw,
  ["salary-insights"],
  { tags: [CACHE_TAGS.jobs], revalidate: 3600 },
);

export async function getCachedSalaryInsights(): Promise<CategorySalary[]> {
  return getCached();
}
