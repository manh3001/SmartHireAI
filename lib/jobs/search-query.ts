import { SEARCH_EXPR, makePush, appendFilters, type JobFilterInput } from "./job-sql";
import type { SearchCursor } from "./cursor";

export type SearchQueryInput = JobFilterInput & { cursor?: SearchCursor | null; limit: number };

const COLS =
  `id, title, company, "rawText", "createdAt", location, "employmentType", "experienceLevel", skills, "salaryMin", "salaryMax", "salaryNegotiable"`;

export function buildSearchSql(input: SearchQueryInput): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const push = makePush(params);
  const { clauses, nqRef } = appendFilters(input, push);
  const hasTerm = nqRef !== null;

  let orderBy: string;
  let tail: string;
  const takeP = push(input.limit + 1);

  if (hasTerm) {
    orderBy = `ORDER BY word_similarity(${nqRef}, ${SEARCH_EXPR}) DESC, "createdAt" DESC, id DESC`;
    const offset = input.cursor && input.cursor.mode === "offset" ? input.cursor.offset : 0;
    tail = `LIMIT ${takeP} OFFSET ${push(offset)}`;
  } else {
    if (input.cursor && input.cursor.mode === "keyset") {
      const ca = push(input.cursor.createdAt);
      const idp = push(input.cursor.id);
      clauses.push(`("createdAt", id) < (${ca}::timestamptz, ${idp})`);
    }
    orderBy = `ORDER BY "createdAt" DESC, id DESC`;
    tail = `LIMIT ${takeP}`;
  }

  const sql = `SELECT ${COLS} FROM "JobDescription" WHERE ${clauses.join(" AND ")} ${orderBy} ${tail}`;
  return { sql, params };
}
