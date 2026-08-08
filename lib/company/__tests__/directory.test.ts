import { describe, it, expect } from "vitest";
import { rankCompanies, type CompanyDirInput } from "../directory";

function mk(over: Partial<CompanyDirInput> & { id: string; userId: string; name: string }): CompanyDirInput {
  return { description: "", location: "", logoUrl: "", ...over };
}

describe("rankCompanies", () => {
  it("sắp theo jobCount giảm dần", () => {
    const companies = [
      mk({ id: "a", userId: "u1", name: "Alpha" }),
      mk({ id: "b", userId: "u2", name: "Beta" }),
      mk({ id: "c", userId: "u3", name: "Gamma" }),
    ];
    const ranked = rankCompanies(companies, { u1: 1, u2: 5, u3: 3 });
    expect(ranked.map((c) => c.id)).toEqual(["b", "c", "a"]);
    expect(ranked.map((c) => c.jobCount)).toEqual([5, 3, 1]);
  });

  it("hòa jobCount thì sắp theo tên tăng dần (locale vi)", () => {
    const companies = [
      mk({ id: "z", userId: "u1", name: "Zeta" }),
      mk({ id: "a", userId: "u2", name: "Ánh Dương" }),
      mk({ id: "m", userId: "u3", name: "Mai" }),
    ];
    const ranked = rankCompanies(companies, { u1: 2, u2: 2, u3: 2 });
    expect(ranked.map((c) => c.name)).toEqual(["Ánh Dương", "Mai", "Zeta"]);
  });

  it("công ty thiếu trong countByUserId -> jobCount 0", () => {
    const companies = [mk({ id: "a", userId: "u1", name: "Alpha" })];
    const ranked = rankCompanies(companies, {});
    expect(ranked[0].jobCount).toBe(0);
  });

  it("mảng rỗng -> mảng rỗng, không đột biến đầu vào", () => {
    const input: CompanyDirInput[] = [];
    expect(rankCompanies(input, {})).toEqual([]);
  });

  it("không đột biến mảng đầu vào", () => {
    const companies = [
      mk({ id: "a", userId: "u1", name: "Alpha" }),
      mk({ id: "b", userId: "u2", name: "Beta" }),
    ];
    const copy = [...companies];
    rankCompanies(companies, { u1: 1, u2: 9 });
    expect(companies).toEqual(copy);
  });
});
