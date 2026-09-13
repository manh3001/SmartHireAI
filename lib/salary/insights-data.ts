import { unstable_cache } from "next/cache";
import prisma from "@/lib/db/prisma";
import { CACHE_TAGS } from "@/lib/cache/tags";
import {
  computeSalaryInsights,
  computeSalaryByLevel,
  computeSalaryBySkill,
  computeSalaryMatrix,
  type CategorySalary,
  type SalaryBarRow,
  type SalaryMatrix,
} from "./insights";

export type SalaryData = {
  byCategory: CategorySalary[];
  byLevel: SalaryBarRow[];
  bySkill: SalaryBarRow[];
  matrix: SalaryMatrix;
};

async function fetchSalaryDataRaw(): Promise<SalaryData> {
  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { category: true, experienceLevel: true, skills: true, salaryMin: true, salaryMax: true },
  });
  return {
    byCategory: computeSalaryInsights(rows),
    byLevel: computeSalaryByLevel(rows),
    bySkill: computeSalaryBySkill(rows),
    matrix: computeSalaryMatrix(rows),
  };
}

const getCached = unstable_cache(
  fetchSalaryDataRaw,
  ["salary-data"],
  { tags: [CACHE_TAGS.jobs], revalidate: 3600 },
);

export async function getCachedSalaryData(): Promise<SalaryData> {
  return getCached();
}
