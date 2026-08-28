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
