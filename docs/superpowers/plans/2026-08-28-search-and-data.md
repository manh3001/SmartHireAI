# Search & Data (Gói B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng tìm kiếm việc làm lên chất lượng web tuyển dụng thật: pg_trgm relevance + fuzzy + không dấu, phân trang cursor "Xem thêm", facet counts động, và ~1000 job seed để mọi thứ trông sống.

**Architecture:** Đường tìm kiếm dùng `prisma.$queryRawUnsafe` tham số hoá; toàn bộ dựng SQL/cursor/facet tách thành hàm THUẦN (`lib/jobs/job-sql.ts`, `search-query.ts`, `facets.ts`, `cursor.ts`) unit-test không cần DB. Extension/index đưa vào qua SQL script chạy bằng `prisma db execute` (giữ `db push`). Seed bằng `@faker-js/faker` locale vi, idempotent.

**Tech Stack:** Next.js 16, Prisma 6 + Neon Postgres, pg_trgm + unaccent, `$queryRawUnsafe`, @faker-js/faker, Vitest.

## Global Constraints

- Prisma giữ **v6** (không nâng v7). Giữ workflow `prisma db push` (không dùng migrate).
- Mọi lệnh chạm DB đặt `NODE_OPTIONS=--dns-result-order=ipv4first` (dùng `cross-env` như scripts hiện có).
- Giá trị người dùng (term, filter) **LUÔN** qua tham số `$1,$2...` — không nội suy vào chuỗi SQL (chống injection). Chỉ tên cột/hằng do code kiểm soát mới ghi thẳng.
- Cột Postgres của `JobDescription` là camelCase → trong SQL phải quote: `"rawText"`, `"createdAt"`, `"isPublic"`, `"salaryMin"`, `"salaryMax"`, `"salaryNegotiable"`, `"employmentType"`, `"experienceLevel"`. Enum cast: `$n::"EmploymentType"`, `$n::"ExperienceLevel"`. `title`, `company`, `location`, `skills`, `category`, `id` là lowercase (không cần quote).
- Fuzzy dùng `<%` / `word_similarity` (KHÔNG `%`/`similarity` — sai khi văn bản dài).
- Test chỉ cho logic thuần (SQL builder, cursor, facet builder) — đúng phong cách repo. DB/route/seed: kiểm thử tay.
- Vietnamese cho chuỗi hiển thị. limit mặc định 20. DRY: bộ lọc dùng chung `appendFilters`.

---

### Task 1: `job-sql.ts` — mảnh SQL dùng chung (thuần)

**Files:**
- Create: `lib/jobs/job-sql.ts`
- Create: `lib/jobs/__tests__/job-sql.test.ts`

**Interfaces:**
- Produces:
  - `SEARCH_EXPR: string`, `MILLION = 1_000_000`
  - `type JobFilterInput = { term?: string; employmentType?: string; experienceLevel?: string; category?: string; salaryMillions?: number | null }`
  - `makePush(params: unknown[]): (v: unknown) => string` — đẩy param, trả `$n`
  - `appendFilters(input: JobFilterInput, push, exclude?: "employmentType"|"experienceLevel"|"category"): { clauses: string[]; nqRef: string | null }`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/jobs/__tests__/job-sql.test.ts
import { describe, it, expect } from "vitest";
import { makePush, appendFilters } from "../job-sql";

describe("appendFilters", () => {
  it("luon co isPublic; khong term/filter -> chi 1 clause", () => {
    const params: unknown[] = [];
    const { clauses, nqRef } = appendFilters({}, makePush(params));
    expect(clauses).toEqual([`"isPublic" = true`]);
    expect(nqRef).toBeNull();
    expect(params).toEqual([]);
  });

  it("term -> them clause search voi param, va nqRef", () => {
    const params: unknown[] = [];
    const { clauses, nqRef } = appendFilters({ term: "react" }, makePush(params));
    expect(params).toEqual(["react"]);
    expect(nqRef).toBe("immutable_unaccent(lower($1))");
    expect(clauses.some((c) => c.includes("ILIKE") && c.includes("<%"))).toBe(true);
  });

  it("moi filter qua param, enum co cast", () => {
    const params: unknown[] = [];
    const { clauses } = appendFilters(
      { employmentType: "FULL_TIME", experienceLevel: "SENIOR", category: "it", salaryMillions: 15 },
      makePush(params),
    );
    expect(clauses).toContain(`"employmentType" = $1::"EmploymentType"`);
    expect(clauses).toContain(`"experienceLevel" = $2::"ExperienceLevel"`);
    expect(clauses).toContain(`category = $3`);
    expect(params).toEqual(["FULL_TIME", "SENIOR", "it", 15 * 1_000_000]);
  });

  it("exclude bo qua dung chieu do", () => {
    const params: unknown[] = [];
    const { clauses } = appendFilters(
      { employmentType: "FULL_TIME", category: "it" },
      makePush(params),
      "employmentType",
    );
    expect(clauses.some((c) => c.includes(`"employmentType"`))).toBe(false);
    expect(clauses).toContain(`category = $1`);
  });
});
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `npx vitest run lib/jobs/__tests__/job-sql.test.ts`
Expected: FAIL — chưa có `../job-sql`.

- [ ] **Step 3: Implement**

```ts
// lib/jobs/job-sql.ts
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
```

- [ ] **Step 4: Chạy test → PASS**

Run: `npx vitest run lib/jobs/__tests__/job-sql.test.ts`
Expected: PASS (4 test).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/job-sql.ts lib/jobs/__tests__/job-sql.test.ts
git commit -m "feat(search): shared parameterized SQL filter builder (pg_trgm)"
```

---

### Task 2: `cursor.ts` — cursor opaque + nextCursor (thuần)

**Files:**
- Create: `lib/jobs/cursor.ts`
- Create: `lib/jobs/__tests__/cursor.test.ts`

**Interfaces:**
- Produces:
  - `type SearchCursor = { mode: "keyset"; createdAt: string; id: string } | { mode: "offset"; offset: number }`
  - `encodeCursor(c: SearchCursor): string`
  - `decodeCursor(s: string | null | undefined): SearchCursor | null`
  - `nextCursorFrom(p: { hasTerm: boolean; rows: { id: string; createdAt: Date | string }[]; limit: number; prevOffset: number }): SearchCursor | null`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/jobs/__tests__/cursor.test.ts
import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, nextCursorFrom } from "../cursor";

describe("cursor encode/decode", () => {
  it("round-trip keyset", () => {
    const c = { mode: "keyset", createdAt: "2026-01-01T00:00:00.000Z", id: "abc" } as const;
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
  it("round-trip offset", () => {
    const c = { mode: "offset", offset: 40 } as const;
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
  it("input hong/thieu -> null", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("!!!not-base64-json")).toBeNull();
    expect(decodeCursor(Buffer.from('{"mode":"x"}').toString("base64"))).toBeNull();
  });
});

describe("nextCursorFrom", () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ id: `id${i}`, createdAt: `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z` }));
  it("khong con trang sau (rows <= limit) -> null", () => {
    expect(nextCursorFrom({ hasTerm: false, rows: rows.slice(0, 20), limit: 20, prevOffset: 0 })).toBeNull();
  });
  it("browse -> keyset tu row thu 'limit'", () => {
    const c = nextCursorFrom({ hasTerm: false, rows, limit: 20, prevOffset: 0 });
    expect(c).toEqual({ mode: "keyset", createdAt: rows[19].createdAt, id: "id19" });
  });
  it("search -> offset += limit", () => {
    const c = nextCursorFrom({ hasTerm: true, rows, limit: 20, prevOffset: 40 });
    expect(c).toEqual({ mode: "offset", offset: 60 });
  });
});
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `npx vitest run lib/jobs/__tests__/cursor.test.ts`
Expected: FAIL — chưa có `../cursor`.

- [ ] **Step 3: Implement**

```ts
// lib/jobs/cursor.ts
export type SearchCursor =
  | { mode: "keyset"; createdAt: string; id: string }
  | { mode: "offset"; offset: number };

export function encodeCursor(c: SearchCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64");
}

export function decodeCursor(s: string | null | undefined): SearchCursor | null {
  if (!s) return null;
  try {
    const o = JSON.parse(Buffer.from(s, "base64").toString("utf8"));
    if (o && o.mode === "keyset" && typeof o.createdAt === "string" && typeof o.id === "string")
      return { mode: "keyset", createdAt: o.createdAt, id: o.id };
    if (o && o.mode === "offset" && typeof o.offset === "number" && o.offset >= 0)
      return { mode: "offset", offset: o.offset };
    return null;
  } catch {
    return null;
  }
}

// rows đã lấy limit+1 để biết còn trang sau. Không còn -> null.
export function nextCursorFrom(p: {
  hasTerm: boolean;
  rows: { id: string; createdAt: Date | string }[];
  limit: number;
  prevOffset: number;
}): SearchCursor | null {
  if (p.rows.length <= p.limit) return null;
  if (p.hasTerm) return { mode: "offset", offset: p.prevOffset + p.limit };
  const last = p.rows[p.limit - 1];
  const createdAt = typeof last.createdAt === "string" ? last.createdAt : last.createdAt.toISOString();
  return { mode: "keyset", createdAt, id: last.id };
}
```

- [ ] **Step 4: Chạy test → PASS**

Run: `npx vitest run lib/jobs/__tests__/cursor.test.ts`
Expected: PASS (6 test).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/cursor.ts lib/jobs/__tests__/cursor.test.ts
git commit -m "feat(search): opaque cursor (keyset/offset) + nextCursorFrom"
```

---

### Task 3: `search-query.ts` — `buildSearchSql` (thuần)

**Files:**
- Create: `lib/jobs/search-query.ts`
- Create: `lib/jobs/__tests__/search-query.test.ts`

**Interfaces:**
- Consumes: `SEARCH_EXPR`, `makePush`, `appendFilters` (Task 1); `SearchCursor` (Task 2).
- Produces:
  - `type SearchQueryInput = JobFilterInput & { cursor?: SearchCursor | null; limit: number }`
  - `buildSearchSql(input: SearchQueryInput): { sql: string; params: unknown[] }`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/jobs/__tests__/search-query.test.ts
import { describe, it, expect } from "vitest";
import { buildSearchSql } from "../search-query";

describe("buildSearchSql", () => {
  it("khong term -> order theo createdAt, LIMIT limit+1, khong OFFSET", () => {
    const { sql, params } = buildSearchSql({ limit: 20 });
    expect(sql).toContain(`"isPublic" = true`);
    expect(sql).toContain(`ORDER BY "createdAt" DESC, id DESC`);
    expect(sql).toMatch(/LIMIT \$\d+$/);
    expect(sql).not.toContain("OFFSET");
    expect(params[params.length - 1]).toBe(21); // limit+1
  });

  it("khong term + cursor keyset -> them dieu kien row-value", () => {
    const { sql } = buildSearchSql({
      limit: 20,
      cursor: { mode: "keyset", createdAt: "2026-01-01T00:00:00.000Z", id: "abc" },
    });
    expect(sql).toContain(`("createdAt", id) < (`);
  });

  it("co term -> order theo word_similarity, co OFFSET", () => {
    const { sql, params } = buildSearchSql({ term: "react", limit: 20, cursor: { mode: "offset", offset: 40 } });
    expect(sql).toContain("word_similarity(");
    expect(sql).toContain("OFFSET");
    expect(params).toContain("react");
    expect(params).toContain(40);
  });

  it("term luon qua param (khong noi suy)", () => {
    const evil = "'; DROP TABLE \"JobDescription\"; --";
    const { sql, params } = buildSearchSql({ term: evil, limit: 20 });
    expect(sql).not.toContain("DROP TABLE");
    expect(params).toContain(evil);
  });

  it("select dung cot camelCase co quote", () => {
    const { sql } = buildSearchSql({ limit: 20 });
    expect(sql).toContain(`"rawText"`);
    expect(sql).toContain(`"salaryNegotiable"`);
    expect(sql).toContain(`FROM "JobDescription"`);
  });
});
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `npx vitest run lib/jobs/__tests__/search-query.test.ts`
Expected: FAIL — chưa có `../search-query`.

- [ ] **Step 3: Implement**

```ts
// lib/jobs/search-query.ts
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
```

- [ ] **Step 4: Chạy test → PASS**

Run: `npx vitest run lib/jobs/__tests__/search-query.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/search-query.ts lib/jobs/__tests__/search-query.test.ts
git commit -m "feat(search): buildSearchSql (trigram ranking + keyset/offset paging)"
```

---

### Task 4: `facets.ts` — `buildFacetSql` (thuần)

**Files:**
- Create: `lib/jobs/facets.ts`
- Create: `lib/jobs/__tests__/facets.test.ts`

**Interfaces:**
- Consumes: `makePush`, `appendFilters`, `JobFilterInput` (Task 1).
- Produces:
  - `type FacetDimension = "employmentType" | "experienceLevel" | "category"`
  - `buildFacetSql(dimension: FacetDimension, input: JobFilterInput): { sql: string; params: unknown[] }`

- [ ] **Step 1: Viết test thất bại**

```ts
// lib/jobs/__tests__/facets.test.ts
import { describe, it, expect } from "vitest";
import { buildFacetSql } from "../facets";

describe("buildFacetSql", () => {
  it("dem category, group by category, loai tru filter category cua chinh no", () => {
    const { sql, params } = buildFacetSql("category", { category: "it", employmentType: "FULL_TIME" });
    expect(sql).toContain("GROUP BY category");
    expect(sql).toContain("COUNT(*)::int");
    expect(sql).toContain(`category IS NOT NULL`);
    // category cua chinh chieu bi loai -> khong co clause category = ; nhung employmentType van con
    expect(sql).toContain(`"employmentType" = $1::"EmploymentType"`);
    expect(params).toEqual(["FULL_TIME"]);
  });

  it("dem employmentType van ap term", () => {
    const { sql, params } = buildFacetSql("employmentType", { term: "react" });
    expect(sql).toContain("GROUP BY");
    expect(sql).toContain(`"employmentType"`);
    expect(params).toContain("react");
  });
});
```

- [ ] **Step 2: Chạy test → FAIL**

Run: `npx vitest run lib/jobs/__tests__/facets.test.ts`
Expected: FAIL — chưa có `../facets`.

- [ ] **Step 3: Implement**

```ts
// lib/jobs/facets.ts
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
```

- [ ] **Step 4: Chạy test → PASS**

Run: `npx vitest run lib/jobs/__tests__/facets.test.ts`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/facets.ts lib/jobs/__tests__/facets.test.ts
git commit -m "feat(search): buildFacetSql (dynamic facet counts per dimension)"
```

---

### Task 5: SQL setup (extensions + immutable_unaccent + GIN index) + `db:search`

**Files:**
- Create: `prisma/search-setup.sql`
- Modify: `package.json` (scripts)

**Interfaces:** không có TS mới.

- [ ] **Step 1: Tạo `prisma/search-setup.sql`**

```sql
-- Idempotent: chạy nhiều lần an toàn. Cung cấp trigram search + bỏ dấu cho JobDescription.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent mặc định KHÔNG immutable -> không dùng được trong index. Bọc lại immutable.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT unaccent('unaccent', $1) $$;

-- GIN trigram trên vùng text đã bỏ dấu + lowercase (khớp SEARCH_EXPR trong lib/jobs/job-sql.ts).
CREATE INDEX IF NOT EXISTS job_search_trgm ON "JobDescription"
  USING gin (
    immutable_unaccent(lower(
      coalesce(title,'')||' '||coalesce(company,'')||' '||coalesce(location,'')||' '||
      coalesce(skills,'')||' '||coalesce("rawText",'')
    )) gin_trgm_ops
  );

-- Hỗ trợ keyset browse + lọc isPublic.
CREATE INDEX IF NOT EXISTS job_public_created ON "JobDescription" ("isPublic", "createdAt" DESC, id);
```

- [ ] **Step 2: Thêm script `db:search` vào `package.json`**

Trong `"scripts"`, thêm sau `"db:push"`:

```json
    "db:search": "cross-env NODE_OPTIONS=--dns-result-order=ipv4first prisma db execute --file prisma/search-setup.sql --schema prisma/schema.prisma",
```

- [ ] **Step 3: Chạy setup lên DB**

Run: `npm run db:search`
Expected: chạy không lỗi (exit 0). Nếu DB không kết nối được trong môi trường này (P1001), ghi lại BLOCKER về kết nối và đánh dấu bước chạy là thủ công (file SQL vẫn đúng); KHÔNG sửa SQL để né. Báo DONE_WITH_CONCERNS kèm thông báo lỗi thật.

- [ ] **Step 4: Xác minh index tồn tại (nếu chạy được ở Step 3)**

Run: `cross-env NODE_OPTIONS=--dns-result-order=ipv4first npx prisma db execute --schema prisma/schema.prisma --stdin <<< "SELECT indexname FROM pg_indexes WHERE tablename='JobDescription' AND indexname IN ('job_search_trgm','job_public_created');"`
Expected: không lỗi. (Không bắt buộc phần hiển thị; chỉ cần lệnh chạy sạch. Nếu Step 3 là thủ công thì bỏ qua.)

- [ ] **Step 5: Commit**

```bash
git add prisma/search-setup.sql package.json
git commit -m "feat(search): pg_trgm/unaccent extensions + GIN index setup (db:search)"
```

---

### Task 6: `search.ts` — runtime `searchJobs` + `jobFacets` + `loadMoreJobs`

**Files:**
- Create: `lib/jobs/search.ts`
- Create: `lib/jobs/search-actions.ts`

**Interfaces:**
- Consumes: `buildSearchSql` (Task 3), `buildFacetSql`/`FacetDimension` (Task 4), `decodeCursor`/`encodeCursor`/`nextCursorFrom` (Task 2), `prisma` (`@/lib/db/prisma`).
- Produces:
  - `type JobRow = { id: string; title: string; company: string; rawText: string; createdAt: Date; location: string | null; employmentType: EmploymentType | null; experienceLevel: ExperienceLevel | null; skills: string; salaryMin: number | null; salaryMax: number | null; salaryNegotiable: boolean }` (enum types nhập từ `job-fields` để tương thích `JobCardData`)
  - `type FacetCounts = { employmentType: Record<string, number>; experienceLevel: Record<string, number>; category: Record<string, number> }`
  - `searchJobs(input): Promise<{ items: JobRow[]; nextCursor: string | null }>`
  - `jobFacets(input: JobFilterInput): Promise<FacetCounts>`
  - (search-actions.ts, "use server") `loadMoreJobs(input): Promise<{ items: JobRow[]; nextCursor: string | null }>`

Ghi chú: file này chạm DB → KHÔNG unit-test (đúng phong cách repo). Xác minh bằng smoke thủ công ở Step cuối.

- [ ] **Step 1: Tạo `lib/jobs/search.ts`**

```ts
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
```

- [ ] **Step 2: Tạo `lib/jobs/search-actions.ts`**

```ts
"use server";

import { searchJobs, type SearchInput, type JobRow } from "./search";

// Server Action cho nút "Xem thêm" — chỉ trả danh sách + cursor, không tính lại facet.
export async function loadMoreJobs(
  input: SearchInput,
): Promise<{ items: JobRow[]; nextCursor: string | null }> {
  return searchJobs(input);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sạch.

- [ ] **Step 4: Smoke thủ công (cần DB + Task 5 đã áp)**

Chạy dev (`npm run dev`) và mở `/jobs?q=react`; hoặc nếu không chạy được server ở môi trường này, ghi rõ smoke là bước thủ công. Kỳ vọng khi có DB+index+seed: truy vấn không lỗi, trả kết quả. Nếu `immutable_unaccent`/`<%` báo lỗi → Task 5 chưa áp (chạy `npm run db:search`). KHÔNG sửa SQL builder để né lỗi thiếu extension.

- [ ] **Step 5: Commit**

```bash
git add lib/jobs/search.ts lib/jobs/search-actions.ts
git commit -m "feat(search): searchJobs + jobFacets runtime + loadMoreJobs action"
```

---

### Task 7: Seed dữ liệu mẫu (`scripts/seed.ts`, `db:seed`, faker)

**Files:**
- Create: `scripts/seed.ts`
- Modify: `package.json` (dep + script)

**Interfaces:**
- Consumes: `prisma`, `hashPassword` (`@/lib/auth/password`), `JOB_CATEGORIES` (`@/lib/jobs/job-categories`), `EMPLOYMENT_TYPES`/`EXPERIENCE_LEVELS` (`@/lib/jobs/job-fields`).

- [ ] **Step 1: Cài faker**

Run: `npm install -D @faker-js/faker`
Expected: thêm `@faker-js/faker` vào devDependencies.

- [ ] **Step 2: Thêm script `db:seed`**

Trong `package.json` `"scripts"`, sau `"db:search"`:

```json
    "db:seed": "cross-env NODE_OPTIONS=--dns-result-order=ipv4first npx tsx scripts/seed.ts",
```

Nếu `tsx` chưa có, cài: `npm install -D tsx` (thêm vào Step 1: `npm install -D @faker-js/faker tsx`).

- [ ] **Step 3: Tạo `scripts/seed.ts`**

```ts
import { fakerVI as faker } from "@faker-js/faker";
import prisma from "../lib/db/prisma";
import { hashPassword } from "../lib/auth/password";
import { JOB_CATEGORIES } from "../lib/jobs/job-categories";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "../lib/jobs/job-fields";

const SEED_DOMAIN = "seed.example"; // marker idempotent
const LOCATIONS = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ", "Bình Dương", "Remote"];
const SKILLS_BY_CAT: Record<string, string[]> = {
  it: ["React", "Node.js", "TypeScript", "Python", "Java", "Docker", "AWS", "SQL", "Go", "Kubernetes"],
  "marketing-sales": ["SEO", "Google Ads", "Facebook Ads", "Content", "CRM", "B2B Sales", "Copywriting"],
  finance: ["Excel", "SAP", "IFRS", "Kiểm toán", "Thuế", "Phân tích tài chính"],
  design: ["Figma", "Photoshop", "Illustrator", "UI/UX", "Motion", "Branding"],
  hr: ["Tuyển dụng", "C&B", "Đào tạo", "HRIS", "Quan hệ lao động"],
  operations: ["Logistics", "Supply Chain", "Vận hành", "Quản lý kho", "Lean"],
  other: ["Giao tiếp", "Quản lý dự án", "Tiếng Anh", "Chăm sóc khách hàng"],
};
const TITLE_BY_CAT: Record<string, string[]> = {
  it: ["Lập trình viên {s}", "Kỹ sư {s}", "Chuyên viên {s}", "Fullstack Developer", "DevOps Engineer"],
  "marketing-sales": ["Chuyên viên Marketing", "Nhân viên Kinh doanh", "Digital Marketing", "Sales Executive"],
  finance: ["Kế toán tổng hợp", "Chuyên viên Tài chính", "Kiểm toán viên", "Kế toán thuế"],
  design: ["UI/UX Designer", "Graphic Designer", "Product Designer", "Motion Designer"],
  hr: ["Chuyên viên Tuyển dụng", "HR Generalist", "Chuyên viên C&B", "HR Manager"],
  operations: ["Nhân viên Vận hành", "Quản lý Kho", "Chuyên viên Logistics", "Operations Manager"],
  other: ["Chăm sóc khách hàng", "Trợ lý dự án", "Nhân viên văn phòng"],
};

function pick<T>(arr: readonly T[]): T { return arr[faker.number.int({ min: 0, max: arr.length - 1 })]; }

async function main() {
  // 1) Xoá dữ liệu seed cũ theo marker (cascade sẽ dọn job/company/cv liên quan).
  const del = await prisma.user.deleteMany({ where: { email: { endsWith: `@${SEED_DOMAIN}` } } });
  console.log(`Đã xoá ${del.count} user seed cũ.`);

  const passwordHash = await hashPassword("seedpass1");

  // 2) Recruiter + công ty
  const recruiters: { id: string }[] = [];
  for (let i = 0; i < 60; i++) {
    const companyName = faker.company.name();
    const user = await prisma.user.create({
      data: {
        email: `recruiter${i}@${SEED_DOMAIN}`,
        name: faker.person.fullName(),
        passwordHash,
        role: "RECRUITER",
        companyProfile: {
          create: {
            name: companyName,
            description: faker.company.catchPhrase(),
            website: faker.internet.url(),
            location: pick(LOCATIONS),
          },
        },
      },
      select: { id: true },
    });
    recruiters.push(user);
  }
  console.log(`Đã tạo ${recruiters.length} recruiter + công ty.`);

  // 3) ~1000 job
  const MILLION = 1_000_000;
  let jobCount = 0;
  for (let i = 0; i < 1000; i++) {
    const cat = pick(JOB_CATEGORIES);
    const skills = faker.helpers.arrayElements(SKILLS_BY_CAT[cat.slug], { min: 3, max: 6 });
    const title = pick(TITLE_BY_CAT[cat.slug]).replace("{s}", skills[0]);
    const owner = pick(recruiters);
    const min = faker.number.int({ min: 8, max: 40 }) * MILLION;
    const max = min + faker.number.int({ min: 3, max: 20 }) * MILLION;
    await prisma.jobDescription.create({
      data: {
        userId: owner.id,
        title,
        company: faker.company.name(),
        rawText: `${title}. ${faker.lorem.paragraphs(2)} Yêu cầu: ${skills.join(", ")}.`,
        location: pick(LOCATIONS),
        employmentType: pick(EMPLOYMENT_TYPES),
        experienceLevel: pick(EXPERIENCE_LEVELS),
        skills: skills.join(", "),
        category: cat.slug,
        salaryMin: min,
        salaryMax: max,
        salaryNegotiable: faker.datatype.boolean(),
        isPublic: true,
      },
    });
    jobCount++;
  }
  console.log(`Đã tạo ${jobCount} tin tuyển dụng.`);

  // 4) ~30 candidate
  for (let i = 0; i < 30; i++) {
    await prisma.user.create({
      data: {
        email: `candidate${i}@${SEED_DOMAIN}`,
        name: faker.person.fullName(),
        passwordHash,
        role: "CANDIDATE",
      },
    });
  }
  console.log("Đã tạo 30 candidate.");
}

main()
  .then(() => { console.log("Seed xong."); return prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
```

- [ ] **Step 4: Chạy seed**

Run: `npm run db:seed`
Expected: in log số lượng tạo, kết thúc "Seed xong.". Chạy LẦN 2 để kiểm idempotent: lần 2 phải in "Đã xoá N user seed cũ" (N>0) rồi tạo lại, không nhân đôi. Nếu DB không kết nối được (P1001) trong môi trường này → ghi BLOCKER kết nối, đánh dấu chạy seed là thủ công (file seed vẫn đúng); báo DONE_WITH_CONCERNS.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed.ts package.json package-lock.json
git commit -m "feat(search): seed ~1000 jobs/60 companies (faker vi, idempotent)"
```

---

### Task 8: Wire `/jobs` + JobsBrowser "Xem thêm"

**Files:**
- Modify: `app/jobs/page.tsx`
- Modify: `components/jobs/JobsBrowser.tsx`

**Interfaces:**
- Consumes: `searchJobs`, `jobFacets`, `type JobRow`, `type FacetCounts` (Task 6); `loadMoreJobs` (Task 6 search-actions).

- [ ] **Step 1: Sửa `app/jobs/page.tsx` — dùng searchJobs + jobFacets**

Thay khối `const jobs = await prisma.jobDescription.findMany({ where: buildJobsWhere({...}), ... })` bằng:

```ts
  const filterInput = {
    term,
    employmentType: typeFilter,
    experienceLevel: levelFilter,
    salaryMillions: salaryFilter,
    category: categoryFilter,
  };
  const [{ items: jobs, nextCursor }, facets] = await Promise.all([
    searchJobs({ ...filterInput, limit: 20 }),
    jobFacets(filterInput),
  ]);
```

- Thêm import: `import { searchJobs, jobFacets } from "@/lib/jobs/search";`
- Bỏ import `buildJobsWhere` và lời gọi `prisma.jobDescription.findMany` cho danh sách chính (giữ `prisma` cho `savedJob`).
- Truyền xuống JobsBrowser: `<JobsBrowser jobs={jobs} initialCursor={nextCursor} searchInput={{ ...filterInput, limit: 20 }} savedJobIds={savedJobIds} isCandidate={isCandidate} />`
- Truyền facets xuống JobFilters: `<JobFilters defaults={{ ... }} facets={facets} />` (JobFilters sẽ dùng ở Task 9; truyền trước không sao).
- Điều kiện empty-state giữ nguyên (dựa `jobs.length === 0`).

- [ ] **Step 2: Sửa `components/jobs/JobsBrowser.tsx` — nút "Xem thêm"**

Thêm props và trạng thái tích luỹ; nút gọi `loadMoreJobs`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import JobCard, { type JobCardData } from "@/components/JobCard";
import JobDetail from "@/components/jobs/JobDetail";
import SaveJobButton from "@/app/jobs/SaveJobButton";
import { loadMoreJobs } from "@/lib/jobs/search-actions";
import type { SearchInput } from "@/lib/jobs/search";

export default function JobsBrowser({
  jobs: initialJobs,
  initialCursor = null,
  searchInput,
  savedJobIds = [],
  isCandidate = false,
}: {
  jobs: JobCardData[];
  initialCursor?: string | null;
  searchInput?: SearchInput;
  savedJobIds?: string[];
  isCandidate?: boolean;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobCardData[]>(initialJobs);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialJobs[0]?.id ?? null);
  const selected = jobs.find((j) => j.id === selectedId) ?? jobs[0] ?? null;
  const savedSet = new Set(savedJobIds);

  function saveSlot(id: string) {
    return isCandidate ? <SaveJobButton jobId={id} initialSaved={savedSet.has(id)} /> : undefined;
  }

  async function onLoadMore() {
    if (!cursor || !searchInput || loading) return;
    setLoading(true);
    try {
      const res = await loadMoreJobs({ ...searchInput, cursor });
      setJobs((prev) => [...prev, ...(res.items as unknown as JobCardData[])]);
      setCursor(res.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="space-y-3">
        {jobs.map((j) => (
          <div key={j.id}>
            <div className="lg:hidden">
              <JobCard job={j} href={`/jobs/${j.id}`} saveSlot={saveSlot(j.id)} />
            </div>
            <div className="hidden lg:block">
              <JobCard job={j} selected={j.id === selectedId} onSelect={() => setSelectedId(j.id)} saveSlot={saveSlot(j.id)} />
            </div>
          </div>
        ))}
        {cursor && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            {loading ? "Đang tải..." : "Xem thêm"}
          </button>
        )}
      </div>
      <div className="hidden lg:block">
        {selected ? (
          <div className="sticky top-20">
            <JobDetail
              job={selected}
              action={
                <button
                  type="button"
                  onClick={() => router.push(`/jobs/${selected.id}`)}
                  className="rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white"
                >
                  Xem chi tiết & ứng tuyển →
                </button>
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

Lưu ý: đây là **nội dung đầy đủ để thay TOÀN BỘ file** — không cần chắp vá bản gốc. Trước khi viết, đọc `components/JobCard.tsx` để lấy đúng kiểu `JobCardData`; đảm bảo `JobRow` (Task 6) gán được vào `JobCardData` (nhờ enum types đã khớp). Nếu `JobCardData` có/thiếu trường nào khác, chỉnh `COLS` trong `search-query.ts` + `JobRow` cho khớp (KHÔNG nới lỏng kiểu bằng `any`). Bản gốc pane phải khi không có `selected` trả `null`; giữ như vậy (danh sách luôn tự chọn phần tử đầu nên pane không rỗng khi có kết quả).

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: sạch type; build thành công. (`JobRow` tương thích `JobCardData` vì đủ trường id/title/company/rawText/createdAt/location/employmentType/experienceLevel/skills/salary*. Nếu build báo thiếu trường, bổ sung trường đó vào `COLS` trong `search-query.ts` và `JobRow`.)

- [ ] **Step 4: Commit**

```bash
git add app/jobs/page.tsx components/jobs/JobsBrowser.tsx
git commit -m "feat(search): wire /jobs to searchJobs + 'Xem thêm' cursor pagination"
```

---

### Task 9: Facet counts trên `JobFilters`

**Files:**
- Modify: `components/jobs/JobFilters.tsx`

**Interfaces:**
- Consumes: `FacetCounts` (Task 6), truyền từ page (Task 8).

- [ ] **Step 1: Sửa `components/jobs/JobFilters.tsx` — nhận & hiển thị counts**

```tsx
import {
  EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS, EXPERIENCE_LEVEL_LABELS,
} from "@/lib/jobs/job-fields";
import { SALARY_FILTER_STEPS } from "@/lib/jobs/salary";
import { JOB_CATEGORIES } from "@/lib/jobs/job-categories";
import type { FacetCounts } from "@/lib/jobs/search";

type Defaults = { q?: string; type?: string; level?: string; salary?: string; category?: string };

function label(base: string, count: number | undefined): string {
  return count != null ? `${base} (${count})` : base;
}

export default function JobFilters({ defaults, facets }: { defaults: Defaults; facets?: FacetCounts }) {
  const sel = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const cat = facets?.category ?? {};
  const type = facets?.employmentType ?? {};
  const level = facets?.experienceLevel ?? {};
  return (
    <form method="get" className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <input type="text" name="q" defaultValue={defaults.q ?? ""} placeholder="Từ khóa..." className={sel} />
      <select name="category" defaultValue={defaults.category ?? ""} className={sel}>
        <option value="">Mọi ngành</option>
        {JOB_CATEGORIES.map((c) => (
          <option key={c.slug} value={c.slug} disabled={facets != null && !cat[c.slug]}>
            {label(c.label, cat[c.slug])}
          </option>
        ))}
      </select>
      <select name="type" defaultValue={defaults.type ?? ""} className={sel}>
        <option value="">Mọi loại hình</option>
        {EMPLOYMENT_TYPES.map((t) => (
          <option key={t} value={t} disabled={facets != null && !type[t]}>
            {label(EMPLOYMENT_TYPE_LABELS[t], type[t])}
          </option>
        ))}
      </select>
      <select name="level" defaultValue={defaults.level ?? ""} className={sel}>
        <option value="">Mọi cấp bậc</option>
        {EXPERIENCE_LEVELS.map((l) => (
          <option key={l} value={l} disabled={facets != null && !level[l]}>
            {label(EXPERIENCE_LEVEL_LABELS[l], level[l])}
          </option>
        ))}
      </select>
      <select name="salary" defaultValue={defaults.salary ?? ""} className={sel}>
        <option value="">Mọi mức lương</option>
        {SALARY_FILTER_STEPS.map((s) => <option key={s} value={s}>Từ {s} triệu</option>)}
      </select>
      <button type="submit" className="w-full rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white">
        Áp dụng bộ lọc
      </button>
    </form>
  );
}
```

(Lương không có facet count vì là ngưỡng liên tục, không phải danh mục rời rạc — giữ nguyên.)

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: sạch; build thành công.

- [ ] **Step 3: Commit**

```bash
git add components/jobs/JobFilters.tsx
git commit -m "feat(search): facet counts on JobFilters (disable 0-result options)"
```

---

### Task 10: Docs + verification toàn bộ

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Cập nhật README**

Trong mục chạy dự án, sau `npm run db:push`, thêm bước:

```markdown
# 3b. Tạo index tìm kiếm (pg_trgm) và dữ liệu mẫu
npm run db:search   # extensions + GIN trigram index (idempotent)
npm run db:seed     # ~1000 tin + 60 công ty mẫu (idempotent; user *@seed.example)
```

Thêm 3 dòng vào bảng lệnh npm: `db:search`, `db:seed`, và một dòng tính năng: "Tìm kiếm pg_trgm (relevance + chịu lỗi chính tả + không dấu), phân trang 'Xem thêm', facet counts."

- [ ] **Step 2: Chạy toàn bộ kiểm thử + lint + build**

Run: `npx vitest run`
Expected: toàn bộ PASS (bao gồm test thuần mới: job-sql, cursor, search-query, facets).

Run: `npm run lint`
Expected: không lỗi mới.

Run: `npm run build`
Expected: build thành công.

- [ ] **Step 3: Checklist thủ công (cần DB + db:search + db:seed đã chạy)**

Chạy `npm run dev`, xác nhận trên `/jobs`:
- Tìm "ha noi" (không dấu) ra tin ở "Hà Nội".
- Gõ sai chính tả nhẹ (vd "reactt") vẫn ra tin React (fuzzy `<%`).
- Kết quả xếp hạng hợp lý (khớp tiêu đề/kỹ năng lên trước).
- Nút "Xem thêm" tải thêm, không trùng/sót tin; hết thì nút biến mất.
- Số đếm facet hiển thị cạnh option và đổi theo bộ lọc; option 0 kết quả bị mờ/disable.

Nếu không chạy được DB/server trong môi trường này, ghi rõ đây là bước thủ công cho người dùng (có DB Neon).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(search): hướng dẫn db:search/db:seed + tổng kết Gói B"
```

---

## Ghi chú trade-off (có chủ đích)

- Đường **có term** dùng OFFSET (thứ tự theo điểm liên quan không keyset được); ở ~1000–vài nghìn dòng là chấp nhận được. Đường **duyệt** (không term) dùng keyset — nhanh, không suy giảm.
- Index trigram bao gồm `rawText` → index to hơn nhưng tìm được nội dung JD (đánh đổi có chủ đích).
- Facet không đếm cho lương (ngưỡng liên tục).
- `searchJobs`/seed/SQL setup chạm DB nên không unit-test (đúng phong cách repo); phủ bằng test thuần cho phần dựng SQL + checklist thủ công.
