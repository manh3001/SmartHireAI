export const MILLION = 1_000_000;

// Vùng văn bản để so khớp: bỏ dấu + lowercase, ghép các trường (khớp index trong prisma/search-setup.sql).
export const SEARCH_EXPR =
  `immutable_unaccent(lower(coalesce(title,'')||' '||coalesce(company,'')||' '||coalesce(location,'')||' '||coalesce(skills,'')||' '||coalesce("rawText",'')))`;

export type JobFilterInput = {
  term?: string;
  employmentType?: string;
  experienceLevel?: string;
  category?: string;
  salaryMillions?: number | null;
};

export function makePush(params: unknown[]): (v: unknown) => string {
  return (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
}

export function appendFilters(
  input: JobFilterInput,
  push: (v: unknown) => string,
  exclude?: "employmentType" | "experienceLevel" | "category",
): { clauses: string[]; nqRef: string | null } {
  const clauses: string[] = [`"isPublic" = true`];
  const term = (input.term ?? "").trim();
  let nqRef: string | null = null;

  if (term) {
    const p = push(term);
    nqRef = `immutable_unaccent(lower(${p}))`;
    clauses.push(`(${SEARCH_EXPR} ILIKE '%'||${nqRef}||'%' OR ${nqRef} <% ${SEARCH_EXPR})`);
  }
  if (input.employmentType && exclude !== "employmentType")
    clauses.push(`"employmentType" = ${push(input.employmentType)}::"EmploymentType"`);
  if (input.experienceLevel && exclude !== "experienceLevel")
    clauses.push(`"experienceLevel" = ${push(input.experienceLevel)}::"ExperienceLevel"`);
  if (input.category && exclude !== "category")
    clauses.push(`category = ${push(input.category)}`);
  if (input.salaryMillions != null) {
    const vnd = push(input.salaryMillions * MILLION);
    clauses.push(
      `(("salaryMax" IS NOT NULL AND "salaryMax" >= ${vnd}) OR ("salaryMax" IS NULL AND "salaryMin" IS NOT NULL AND "salaryMin" >= ${vnd}))`,
    );
  }
  return { clauses, nqRef };
}
