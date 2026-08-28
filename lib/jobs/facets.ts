import { makePush, appendFilters, type JobFilterInput } from "./job-sql";

export type FacetDimension = "employmentType" | "experienceLevel" | "category";

function colOf(dim: FacetDimension): string {
  return dim === "category" ? "category" : `"${dim}"`;
}

export function buildFacetSql(
  dimension: FacetDimension,
  input: JobFilterInput,
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const push = makePush(params);
  const { clauses } = appendFilters(input, push, dimension);
  const col = colOf(dimension);
  const sql =
    `SELECT ${col} AS key, COUNT(*)::int AS count FROM "JobDescription" ` +
    `WHERE ${clauses.join(" AND ")} AND ${col} IS NOT NULL GROUP BY ${col}`;
  return { sql, params };
}
