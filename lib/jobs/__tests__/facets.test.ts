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
