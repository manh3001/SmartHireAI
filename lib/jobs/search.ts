import prisma from "@/lib/db/prisma";
import { buildSearchSql, type SearchQueryInput } from "./search-query";
import { buildFacetSql, type FacetDimension } from "./facets";
import { decodeCursor, encodeCursor, nextCursorFrom } from "./cursor";
import type { JobFilterInput } from "./job-sql";
import type { EmploymentType, ExperienceLevel } from "./job-fields";

// enum types khớp JobCardData (JobCard.tsx). $queryRawUnsafe trả string đúng giá trị enum;
// annotation này để TS tương thích khi truyền xuống JobsBrowser.
export type JobRow = {
  id: string; title: string; company: string; rawText: string; createdAt: Date;
  location: string | null; employmentType: EmploymentType | null; experienceLevel: ExperienceLevel | null;
  skills: string; salaryMin: number | null; salaryMax: number | null; salaryNegotiable: boolean;
};

export type FacetCounts = {
  employmentType: Record<string, number>;
  experienceLevel: Record<string, number>;
  category: Record<string, number>;
};

export type SearchInput = JobFilterInput & { cursor?: string | null; limit?: number };

export async function searchJobs(input: SearchInput): Promise<{ items: JobRow[]; nextCursor: string | null }> {
  const limit = input.limit ?? 20;
  const cursor = decodeCursor(input.cursor);
  const hasTerm = !!(input.term ?? "").trim();
  const q: SearchQueryInput = { ...input, cursor, limit };
  const { sql, params } = buildSearchSql(q);
  const rows = await prisma.$queryRawUnsafe<JobRow[]>(sql, ...params);
  const prevOffset = cursor && cursor.mode === "offset" ? cursor.offset : 0;
  const next = nextCursorFrom({ hasTerm, rows, limit, prevOffset });
  return { items: rows.slice(0, limit), nextCursor: next ? encodeCursor(next) : null };
}

export async function jobFacets(input: JobFilterInput): Promise<FacetCounts> {
  const dims: FacetDimension[] = ["employmentType", "experienceLevel", "category"];
  const results = await Promise.all(
    dims.map(async (dim) => {
      const { sql, params } = buildFacetSql(dim, input);
      const rows = await prisma.$queryRawUnsafe<{ key: string | null; count: number }[]>(sql, ...params);
      const map: Record<string, number> = {};
      for (const r of rows) if (r.key != null) map[r.key] = Number(r.count);
      return [dim, map] as const;
    }),
  );
  return Object.fromEntries(results) as FacetCounts;
}
